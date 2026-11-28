import {
  type PrismaClient,
  getPrismaClient,
  type ReportStatus,
  type ReportCategory,
  type ReviewStatus,
  type ModerationActionType,
  ReviewModerationActionType,
  UserStatus,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  AdminReportQuery,
  AdminReportListResponse,
  AdminReportListItem,
  ResolveReportRequest,
  DismissReportRequest,
  AdminReviewQuery,
  AdminReviewListResponse,
  AdminReviewListItem,
  ModerateReviewRequest,
} from '@creatorconnect/contracts';
import {
  NotFoundError,
  BadRequestError,
  LastAdminLockoutError,
  LastSuperAdminLockoutError,
} from '../../../errors/app-error.js';
import { redisCache } from '../../../services/redis-cache.js';

export class AdminModerationService {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  // ==============================================================================
  // Centralized Reports & Moderation Queue
  // ==============================================================================

  public async listReports(query: AdminReportQuery): Promise<AdminReportListResponse> {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status as ReportStatus;
    }
    if (query.category) {
      where.category = query.category as ReportCategory;
    }
    if (query.targetType) {
      where.targetType = query.targetType;
    }

    const [total, reports] = await Promise.all([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items: AdminReportListItem[] = reports.map((r) => ({
      id: r.id,
      reporterId: r.reporterId,
      reporterEmail: r.reporter.email,
      targetType: r.targetType,
      targetId: r.targetId,
      category: r.category,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public async getReport(reportId: string): Promise<any> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        reporter: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!report) {
      throw new NotFoundError(`Report not found: ${reportId}`);
    }

    // Optionally fetch target entity preview
    let targetDetails: any = null;
    if (report.targetType === 'USER') {
      targetDetails = await this.prisma.user.findUnique({
        where: { id: report.targetId },
        select: { id: true, email: true, firstName: true, lastName: true, status: true },
      });
    } else if (report.targetType === 'ASSIGNMENT') {
      targetDetails = await this.prisma.assignment.findUnique({
        where: { id: report.targetId },
        select: { id: true, title: true, status: true, brandId: true },
      });
    }

    return {
      ...report,
      reporterEmail: report.reporter.email,
      targetDetails,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    };
  }

  public async resolveReport(
    reportId: string,
    input: ResolveReportRequest,
    adminUserId: string,
  ): Promise<AdminReportListItem> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { reporter: { select: { id: true, email: true } } },
    });

    if (!report) {
      throw new NotFoundError(`Report not found: ${reportId}`);
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Update Report status
      const updatedReport = await tx.report.update({
        where: { id: reportId },
        data: {
          status: 'RESOLVED',
        },
        include: { reporter: { select: { id: true, email: true } } },
      });

      // 2. If moderation action is taken on a user
      const targetUserId =
        input.targetUserId || (report.targetType === 'USER' ? report.targetId : null);

      if (targetUserId && input.action !== 'NO_ACTION') {
        await tx.moderationAction.create({
          data: {
            id: generateUuidV7(),
            moderatorId: adminUserId,
            targetUserId,
            actionType: input.action as ModerationActionType,
            reason: input.notes,
          },
        });

        // Apply suspension if action is SUSPEND or BAN
        if (input.action === 'SUSPEND' || input.action === 'BAN') {
          // Concurrency-safe check against locking out last admin or last super admin
          const activeAdmins = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT u.id 
            FROM users u
            JOIN user_roles ur ON u.id = ur.user_id
            JOIN roles r ON ur.role_id = r.id
            WHERE r.name = 'ADMIN' AND u.status = 'ACTIVE'
            FOR UPDATE OF u
          `;

          const isTargetAnActiveAdmin = activeAdmins.some((a) => a.id === targetUserId);
          if (isTargetAnActiveAdmin && activeAdmins.length <= 1) {
            throw new LastAdminLockoutError();
          }

          const activeSuperAdmins = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT u.id 
            FROM users u
            JOIN admin_user_roles aur ON u.id = aur.user_id
            JOIN admin_roles ar ON aur.role_id = ar.id
            WHERE ar.name = 'SUPER_ADMIN' AND u.status = 'ACTIVE'
            FOR UPDATE OF u
          `;

          const isTargetActiveSuperAdmin = activeSuperAdmins.some((a) => a.id === targetUserId);
          if (isTargetActiveSuperAdmin && activeSuperAdmins.length <= 1) {
            throw new LastSuperAdminLockoutError(
              'Cannot suspend or ban the last active Super Administrator on the platform.',
            );
          }

          const updatedTarget = await tx.user.update({
            where: { id: targetUserId },
            data: { status: UserStatus.SUSPENDED },
            select: { id: true, supabaseAuthId: true },
          });

          await redisCache.invalidateUser(updatedTarget.id, updatedTarget.supabaseAuthId);
        }
      }

      // 3. Emit Audit Log
      await tx.auditLog.create({
        data: {
          id: generateUuidV7(),
          userId: adminUserId,
          action: 'REPORT_RESOLVED',
          entity: 'Report',
          entityId: reportId,
          metadata: {
            action: input.action,
            notes: input.notes,
            targetUserId,
            targetType: report.targetType,
            targetId: report.targetId,
          },
        },
      });

      return {
        id: updatedReport.id,
        reporterId: updatedReport.reporterId,
        reporterEmail: updatedReport.reporter.email,
        targetType: updatedReport.targetType,
        targetId: updatedReport.targetId,
        category: updatedReport.category,
        details: updatedReport.details,
        status: updatedReport.status,
        createdAt: updatedReport.createdAt.toISOString(),
        updatedAt: updatedReport.updatedAt.toISOString(),
      };
    });
  }

  public async dismissReport(
    reportId: string,
    input: DismissReportRequest,
    adminUserId: string,
  ): Promise<AdminReportListItem> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { reporter: { select: { id: true, email: true } } },
    });

    if (!report) {
      throw new NotFoundError(`Report not found: ${reportId}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedReport = await tx.report.update({
        where: { id: reportId },
        data: { status: 'DISMISSED' },
        include: { reporter: { select: { id: true, email: true } } },
      });

      await tx.auditLog.create({
        data: {
          id: generateUuidV7(),
          userId: adminUserId,
          action: 'REPORT_DISMISSED',
          entity: 'Report',
          entityId: reportId,
          metadata: {
            reason: input.reason,
            targetType: report.targetType,
            targetId: report.targetId,
          },
        },
      });

      return updatedReport;
    });

    return {
      id: updated.id,
      reporterId: updated.reporterId,
      reporterEmail: updated.reporter.email,
      targetType: updated.targetType,
      targetId: updated.targetId,
      category: updated.category,
      details: updated.details,
      status: updated.status,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  // ==============================================================================
  // Review Moderation
  // ==============================================================================

  public async listReviews(query: AdminReviewQuery): Promise<AdminReviewListResponse> {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status as ReviewStatus;
    }
    if (query.minRating !== undefined || query.maxRating !== undefined) {
      where.rating = {};
      if (query.minRating !== undefined) {
        where.rating.gte = query.minRating;
      }
      if (query.maxRating !== undefined) {
        where.rating.lte = query.maxRating;
      }
    }
    if (query.reviewerId) {
      where.reviewerId = query.reviewerId;
    }
    if (query.revieweeId) {
      where.revieweeId = query.revieweeId;
    }

    const [total, reviews] = await Promise.all([
      this.prisma.review.count({ where }),
      this.prisma.review.findMany({
        where,
        include: {
          project: { select: { id: true, title: true } },
          reviewer: { select: { id: true, email: true } },
          reviewee: { select: { id: true, email: true } },
          _count: { select: { reports: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items: AdminReviewListItem[] = reviews.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      projectTitle: r.project?.title,
      reviewerId: r.reviewerId,
      reviewerEmail: r.reviewer.email,
      revieweeId: r.revieweeId,
      revieweeEmail: r.reviewee.email,
      rating: r.rating,
      feedback: r.feedback,
      status: r.status,
      editCount: r.editCount,
      reportsCount: r._count.reports,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public async moderateReview(
    reviewId: string,
    input: ModerateReviewRequest,
    adminUserId: string,
  ): Promise<AdminReviewListItem> {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        project: { select: { id: true, title: true } },
        reviewer: { select: { id: true, email: true } },
        reviewee: { select: { id: true, email: true } },
        _count: { select: { reports: true } },
      },
    });

    if (!review) {
      throw new NotFoundError(`Review not found: ${reviewId}`);
    }

    let toStatus: ReviewStatus;
    let auditAction: ReviewModerationActionType;

    switch (input.action) {
      case 'FLAG':
        toStatus = 'FLAGGED';
        auditAction = ReviewModerationActionType.FLAG;
        break;
      case 'HIDE':
        toStatus = 'HIDDEN';
        auditAction = ReviewModerationActionType.HIDE;
        break;
      case 'REMOVE':
        toStatus = 'REMOVED';
        auditAction = ReviewModerationActionType.REMOVE;
        break;
      case 'RESTORE':
        toStatus = 'PUBLISHED';
        auditAction = ReviewModerationActionType.RESTORE;
        break;
      default:
        throw new BadRequestError(`Invalid review moderation action: ${input.action}`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id: reviewId },
        data: { status: toStatus },
        include: {
          project: { select: { id: true, title: true } },
          reviewer: { select: { id: true, email: true } },
          reviewee: { select: { id: true, email: true } },
          _count: { select: { reports: true } },
        },
      });

      // ReviewModerationAudit
      await tx.reviewModerationAudit.create({
        data: {
          id: generateUuidV7(),
          reviewId,
          moderatorId: adminUserId,
          actionType: auditAction,
          fromStatus: review.status,
          toStatus,
          reason: input.reason,
          internalNotes: input.internalNotes || null,
        },
      });

      // AuditLog
      await tx.auditLog.create({
        data: {
          id: generateUuidV7(),
          userId: adminUserId,
          action: 'REVIEW_MODERATED',
          entity: 'Review',
          entityId: reviewId,
          metadata: {
            fromStatus: review.status,
            toStatus,
            action: input.action,
            reason: input.reason,
            internalNotes: input.internalNotes,
          },
        },
      });

      return {
        id: updated.id,
        projectId: updated.projectId,
        projectTitle: updated.project?.title,
        reviewerId: updated.reviewerId,
        reviewerEmail: updated.reviewer.email,
        revieweeId: updated.revieweeId,
        revieweeEmail: updated.reviewee.email,
        rating: updated.rating,
        feedback: updated.feedback,
        status: updated.status,
        editCount: updated.editCount,
        reportsCount: updated._count.reports,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    });
  }
}

export const adminModerationService = new AdminModerationService();
