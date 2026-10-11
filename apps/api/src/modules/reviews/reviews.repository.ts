import { getPrismaClient, Prisma } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type { ReviewStatus } from '@creatorconnect/contracts';

export class ReviewsRepository {
  constructor(private prisma = getPrismaClient()) {}

  async findById(id: string) {
    return this.prisma.review.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            clientId: true,
            talentId: true,
            status: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        reviewee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        reports: {
          select: {
            id: true,
            reporterId: true,
            reason: true,
            details: true,
            status: true,
            createdAt: true,
          },
        },
        moderationAudit: {
          orderBy: { createdAt: 'desc' },
          include: {
            moderator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async findByProjectAndReviewer(projectId: string, reviewerId: string) {
    return this.prisma.review.findUnique({
      where: {
        projectId_reviewerId: {
          projectId,
          reviewerId,
        },
      },
    });
  }

  async findProjectById(projectId: string) {
    return this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        client: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        talent: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        disputes: {
          select: { id: true, status: true },
        },
      },
    });
  }

  async createReview(
    reviewData: {
      id: string;
      projectId: string;
      reviewerId: string;
      revieweeId: string;
      rating: number;
      communicationRating?: number | null;
      qualityRating?: number | null;
      adherenceRating?: number | null;
      feedback: string;
      status: ReviewStatus;
    },
    outboxPayload: Record<string, unknown>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          id: reviewData.id,
          projectId: reviewData.projectId,
          reviewerId: reviewData.reviewerId,
          revieweeId: reviewData.revieweeId,
          rating: reviewData.rating,
          communicationRating: reviewData.communicationRating ?? null,
          qualityRating: reviewData.qualityRating ?? null,
          adherenceRating: reviewData.adherenceRating ?? null,
          feedback: reviewData.feedback,
          status: reviewData.status,
          editCount: 0,
        },
        include: {
          reviewer: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
          reviewee: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      });

      // Transactional Outbox Event
      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'review.created.v1',
          aggregateType: 'Review',
          aggregateId: review.id,
          payload: outboxPayload as Prisma.InputJsonValue,
          status: 'PENDING',
        },
      });

      // In-app Notification for reviewee
      await tx.notification.create({
        data: {
          id: generateUuidV7(),
          userId: reviewData.revieweeId,
          type: 'REVIEW_RECEIVED',
          title: 'New Review Received',
          body: `You received a ${reviewData.rating}-star review for project completion.`,
          data: { reviewId: review.id, projectId: reviewData.projectId } as Prisma.InputJsonValue,
        },
      });

      return review;
    });
  }

  async updateReview(
    id: string,
    updateData: {
      rating?: number;
      communicationRating?: number | null;
      qualityRating?: number | null;
      adherenceRating?: number | null;
      feedback?: string;
    },
    outboxPayload: Record<string, unknown>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.update({
        where: { id },
        data: {
          ...(updateData.rating !== undefined ? { rating: updateData.rating } : {}),
          ...(updateData.communicationRating !== undefined
            ? { communicationRating: updateData.communicationRating }
            : {}),
          ...(updateData.qualityRating !== undefined
            ? { qualityRating: updateData.qualityRating }
            : {}),
          ...(updateData.adherenceRating !== undefined
            ? { adherenceRating: updateData.adherenceRating }
            : {}),
          ...(updateData.feedback !== undefined ? { feedback: updateData.feedback } : {}),
          editCount: { increment: 1 },
          editedAt: new Date(),
        },
        include: {
          reviewer: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
          reviewee: {
            select: { id: true, firstName: true, lastName: true, avatarUrl: true },
          },
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'review.updated.v1',
          aggregateType: 'Review',
          aggregateId: review.id,
          payload: outboxPayload as Prisma.InputJsonValue,
          status: 'PENDING',
        },
      });

      return review;
    });
  }

  async findReport(reviewId: string, reporterId: string) {
    return this.prisma.reviewReport.findUnique({
      where: {
        reviewId_reporterId: {
          reviewId,
          reporterId,
        },
      },
    });
  }

  async createReport(
    reportData: {
      id: string;
      reviewId: string;
      reporterId: string;
      reason: any;
      details: string;
    },
    shouldFlag: boolean,
    outboxPayload: Record<string, unknown>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.reviewReport.create({
        data: {
          id: reportData.id,
          reviewId: reportData.reviewId,
          reporterId: reportData.reporterId,
          reason: reportData.reason,
          details: reportData.details,
          status: 'PENDING',
        },
      });

      if (shouldFlag) {
        await tx.review.update({
          where: { id: reportData.reviewId },
          data: { status: 'FLAGGED' },
        });
      }

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'review.reported.v1',
          aggregateType: 'ReviewReport',
          aggregateId: report.id,
          payload: outboxPayload as Prisma.InputJsonValue,
          status: 'PENDING',
        },
      });

      return report;
    });
  }

  async moderateReview(
    reviewId: string,
    auditData: {
      id: string;
      moderatorId: string;
      actionType: any;
      fromStatus: ReviewStatus;
      toStatus: ReviewStatus;
      reason: string;
      internalNotes?: string | null | undefined;
    },
    outboxPayload: Record<string, unknown>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const review = await tx.review.update({
        where: { id: reviewId },
        data: {
          status: auditData.toStatus,
        },
        include: {
          reviewer: { select: { id: true, firstName: true, lastName: true } },
          reviewee: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      const audit = await tx.reviewModerationAudit.create({
        data: {
          id: auditData.id,
          reviewId,
          moderatorId: auditData.moderatorId,
          actionType: auditData.actionType,
          fromStatus: auditData.fromStatus,
          toStatus: auditData.toStatus,
          reason: auditData.reason,
          internalNotes: auditData.internalNotes ?? null,
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'review.moderated.v1',
          aggregateType: 'Review',
          aggregateId: reviewId,
          payload: outboxPayload as Prisma.InputJsonValue,
          status: 'PENDING',
        },
      });

      return { review, audit };
    });
  }

  async listPublicReviewsForUser(
    userId: string,
    options: {
      cursor?: string;
      limit?: number;
      minRating?: number;
    },
  ) {
    const limit = Math.min(options.limit ?? 20, 50);
    const where: Prisma.ReviewWhereInput = {
      revieweeId: userId,
      status: 'PUBLISHED',
      ...(options.minRating ? { rating: { gte: options.minRating } } : {}),
    };

    const reviews = await this.prisma.review.findMany({
      where,
      take: limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });

    const hasNextPage = reviews.length > limit;
    const items = hasNextPage ? reviews.slice(0, limit) : reviews;
    const nextCursor = hasNextPage ? items[items.length - 1]?.id : null;

    return { items, nextCursor };
  }

  async listProjectReviews(projectId: string) {
    return this.prisma.review.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      include: {
        reviewer: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
        reviewee: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
        },
      },
    });
  }

  async listModerationQueue(options: { cursor?: string; limit?: number; status?: ReviewStatus }) {
    const limit = Math.min(options.limit ?? 20, 50);
    const where: Prisma.ReviewWhereInput = {
      ...(options.status ? { status: options.status } : { status: { in: ['FLAGGED', 'HIDDEN'] } }),
    };

    const reviews = await this.prisma.review.findMany({
      where,
      take: limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: { select: { id: true, email: true, firstName: true, lastName: true } },
        reviewee: { select: { id: true, email: true, firstName: true, lastName: true } },
        reports: {
          orderBy: { createdAt: 'desc' },
          include: {
            reporter: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
        moderationAudit: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    const hasNextPage = reviews.length > limit;
    const items = hasNextPage ? reviews.slice(0, limit) : reviews;
    const nextCursor = hasNextPage ? items[items.length - 1]?.id : null;

    return { items, nextCursor };
  }

  async aggregateReputation(userId: string) {
    // Strictly published reviews count towards public reputation
    const [aggregates, ratingCounts] = await Promise.all([
      this.prisma.review.aggregate({
        where: {
          revieweeId: userId,
          status: 'PUBLISHED',
        },
        _count: {
          id: true,
        },
        _avg: {
          rating: true,
          communicationRating: true,
          qualityRating: true,
          adherenceRating: true,
        },
      }),
      this.prisma.review.groupBy({
        by: ['rating'],
        where: {
          revieweeId: userId,
          status: 'PUBLISHED',
        },
        _count: {
          id: true,
        },
      }),
    ]);

    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const group of ratingCounts) {
      if (group.rating >= 1 && group.rating <= 5) {
        distribution[group.rating] = group._count.id;
      }
    }

    return {
      totalCount: aggregates._count.id,
      averageRating: aggregates._avg.rating,
      communicationAverage: aggregates._avg.communicationRating,
      qualityAverage: aggregates._avg.qualityRating,
      adherenceAverage: aggregates._avg.adherenceRating,
      distribution,
    };
  }
}
