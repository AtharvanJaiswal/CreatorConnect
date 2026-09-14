import { getPrismaClient, type ApplicationStatus } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  CreateApplicationInput,
  UpdateApplicationStatusInput,
  AcceptApplicationInput,
  ApplicationResponse,
} from '@creatorconnect/contracts';
import { applicationsRepository, ApplicationsRepository } from './applications.repository.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
  OptimisticLockConflictError,
  AuthInsufficientRoleError,
  AssignmentDeadlineExpiredError,
} from '../../errors/app-error.js';

import pino from 'pino';
import { loggerConfig } from '../../plugins/logger.js';

const logger = pino(loggerConfig);

export class ApplicationsService {
  constructor(
    private repo: ApplicationsRepository = applicationsRepository,
    private prisma = getPrismaClient(),
  ) {}

  async apply(
    applicantUserId: string,
    roles: string[],
    assignmentId: string,
    payload: CreateApplicationInput,
  ): Promise<ApplicationResponse> {
    if (!roles.includes('CREATOR') && !roles.includes('PROFESSIONAL')) {
      throw new AuthInsufficientRoleError(
        'Only users with CREATOR or PROFESSIONAL role can apply to assignments.',
      );
    }

    try {
      const application = await this.prisma.$transaction(async (tx) => {
        // 1. Transactionally lock assignment row with PostgreSQL SELECT ... FOR UPDATE
        const assignment = await this.repo.lockAssignmentForApply(tx, assignmentId);
        if (!assignment) {
          throw new NotFoundError('Assignment not found.');
        }

        // 2. Validate Assignment is active and in PUBLISHED status
        if (!assignment.is_active || assignment.status !== 'PUBLISHED') {
          throw new BadRequestError('Assignment is not accepting applications.');
        }

        // 3. Validate against Database Clock Time (NOW())
        if (assignment.is_past_deadline) {
          throw new AssignmentDeadlineExpiredError();
        }

        // 4. Verify Applicant is not the Assignment Brand Owner
        const brandProfile = await tx.brandProfile.findUnique({
          where: { userId: applicantUserId },
          select: { id: true },
        });
        if (brandProfile && brandProfile.id === assignment.brand_id) {
          throw new ForbiddenError('You cannot apply to your own assignment.');
        }

        // 5. Create Application (Database unique constraint @@unique([assignmentId, applicantId]) prevents duplicate races)
        const id = generateUuidV7();
        const createdApp = await tx.application.create({
          data: {
            id,
            assignmentId,
            applicantId: applicantUserId,
            coverLetter: payload.coverLetter,
            proposedRate: payload.proposedRate,
            currency: payload.currency || 'INR',
            durationDays: payload.durationDays ?? null,
            status: 'SUBMITTED',
          },
        });

        // 6. Record Initial Submission History
        await tx.applicationStatusHistory.create({
          data: {
            id: generateUuidV7(),
            applicationId: createdApp.id,
            fromStatus: 'SUBMITTED',
            toStatus: 'SUBMITTED',
            actorId: applicantUserId,
            reason: 'INITIAL_PROPOSAL',
          },
        });

        return createdApp;
      });

      const fullApp = (await this.repo.findById(application.id))!;
      return this.mapApplication(fullApp);
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictError('You have already applied to this assignment.');
      }
      throw err;
    }
  }

  async getApplication(
    id: string,
    callerUserId: string,
    isAdmin = false,
  ): Promise<ApplicationResponse> {
    const app = await this.repo.findById(id);
    if (!app) {
      throw new NotFoundError('Application not found.');
    }

    const isApplicant = app.applicantId === callerUserId;
    const isBrandOwner = app.assignment.brand.userId === callerUserId;

    if (!isApplicant && !isBrandOwner && !isAdmin) {
      throw new ForbiddenError('Access to this application is forbidden.');
    }

    return this.mapApplication(app);
  }

  async getAssignmentApplications(
    assignmentId: string,
    callerUserId: string,
    isAdmin = false,
  ): Promise<ApplicationResponse[]> {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { brand: true },
    });

    if (!assignment || assignment.deletedAt) {
      throw new NotFoundError('Assignment not found.');
    }

    if (assignment.brand.userId !== callerUserId && !isAdmin) {
      throw new ForbiddenError('Only the assignment brand owner or admin can view applications.');
    }

    const apps = await this.repo.findByAssignmentId(assignmentId);
    return apps.map((a) => this.mapApplication(a));
  }

  async getMyApplications(applicantUserId: string): Promise<ApplicationResponse[]> {
    const apps = await this.repo.findByApplicantId(applicantUserId);
    return apps.map((a) => this.mapApplication(a));
  }

  async updateStatus(
    callerUserId: string,
    isAdmin: boolean,
    applicationId: string,
    payload: UpdateApplicationStatusInput,
  ): Promise<ApplicationResponse> {
    const app = await this.repo.findById(applicationId);
    if (!app) {
      throw new NotFoundError('Application not found.');
    }

    const isBrandOwner = app.assignment.brand.userId === callerUserId;
    if (!isBrandOwner && !isAdmin) {
      throw new ForbiddenError(
        'Only the assignment brand owner or admin can transition application status.',
      );
    }

    const currentStatus = app.status;
    const targetStatus = payload.status as ApplicationStatus;

    if (currentStatus === 'ACCEPTED' || currentStatus === 'WITHDRAWN') {
      throw new BadRequestError(
        `Cannot transition application from terminal status ${currentStatus}.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.application.update({
        where: { id: applicationId },
        data: {
          status: targetStatus,
          version: { increment: 1 },
        },
      });

      await tx.applicationStatusHistory.create({
        data: {
          id: generateUuidV7(),
          applicationId,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          actorId: callerUserId,
          reason: payload.reason || 'STATUS_UPDATE',
        },
      });
    });

    const updated = (await this.repo.findById(applicationId))!;
    return this.mapApplication(updated);
  }

  async withdraw(applicantUserId: string, applicationId: string): Promise<ApplicationResponse> {
    const app = await this.repo.findById(applicationId);
    if (!app) {
      throw new NotFoundError('Application not found.');
    }

    if (app.applicantId !== applicantUserId) {
      throw new ForbiddenError('You can only withdraw your own applications.');
    }

    const currentStatus = app.status;
    if (
      currentStatus !== 'SUBMITTED' &&
      currentStatus !== 'UNDER_REVIEW' &&
      currentStatus !== 'SHORTLISTED'
    ) {
      throw new BadRequestError(
        `Cannot withdraw application with status ${currentStatus}. Only active proposals can be withdrawn.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const updateRes = await tx.application.updateMany({
        where: {
          id: applicationId,
          status: currentStatus,
          version: app.version,
        },
        data: {
          status: 'WITHDRAWN',
          version: { increment: 1 },
        },
      });

      if (updateRes.count !== 1) {
        throw new OptimisticLockConflictError(
          'Application status was modified concurrently and cannot be withdrawn.',
        );
      }

      await tx.applicationStatusHistory.create({
        data: {
          id: generateUuidV7(),
          applicationId,
          fromStatus: currentStatus,
          toStatus: 'WITHDRAWN',
          actorId: applicantUserId,
          reason: 'APPLICANT_WITHDREW',
        },
      });
    });

    const updated = (await this.repo.findById(applicationId))!;
    return this.mapApplication(updated);
  }

  // ==============================================================================
  // Concurrency-Safe Atomic Acceptance Algorithm
  // ==============================================================================

  async acceptApplication(
    brandUserId: string,
    isAdmin: boolean,
    assignmentId: string,
    applicationId: string,
    payload: AcceptApplicationInput,
  ): Promise<ApplicationResponse> {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: { brand: true },
    });

    if (!assignment || assignment.deletedAt) {
      throw new NotFoundError('Assignment not found.');
    }

    if (assignment.brand.userId !== brandUserId && !isAdmin) {
      throw new ForbiddenError('Only the assignment brand owner or admin can accept candidates.');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Conditional Atomic Update on Assignment (Must be PUBLISHED and match expectedVersion)
      const assignmentUpdate = await tx.assignment.updateMany({
        where: {
          id: assignmentId,
          status: 'PUBLISHED',
          version: payload.expectedVersion,
        },
        data: {
          status: 'IN_PROGRESS',
          version: { increment: 1 },
        },
      });

      if (assignmentUpdate.count !== 1) {
        logger.warn(
          {
            assignmentId,
            expectedVersion: payload.expectedVersion,
            metric: 'acceptance_assignment_conflict_total',
          },
          'Assignment optimistic lock conflict during candidate acceptance',
        );
        throw new OptimisticLockConflictError(
          'Assignment is no longer in PUBLISHED status or was modified concurrently.',
        );
      }

      // 2. Conditional Atomic Update on Target Application (Must be SHORTLISTED and match expectedApplicationVersion)
      const applicationUpdate = await tx.application.updateMany({
        where: {
          id: applicationId,
          assignmentId: assignmentId,
          status: 'SHORTLISTED',
          version: payload.expectedApplicationVersion,
        },
        data: {
          status: 'ACCEPTED',
          version: { increment: 1 },
        },
      });

      if (applicationUpdate.count !== 1) {
        logger.warn(
          {
            applicationId,
            assignmentId,
            expectedApplicationVersion: payload.expectedApplicationVersion,
            metric: 'acceptance_application_conflict_total',
          },
          'Target application optimistic lock conflict during candidate acceptance',
        );
        // Rollback entire transaction!
        throw new OptimisticLockConflictError(
          'Application is no longer in SHORTLISTED status or was modified concurrently.',
        );
      }

      // 3. Concurrency-Safe Conditional Rejection of Competing Active Applications
      const competingApps = await tx.application.findMany({
        where: {
          assignmentId,
          id: { not: applicationId },
          status: {
            in: ['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED'],
          },
        },
        select: { id: true, status: true, version: true },
      });

      for (const compApp of competingApps) {
        // Conditional update: only reject if the application is STILL in its observed status and version
        const rejectRes = await tx.application.updateMany({
          where: {
            id: compApp.id,
            assignmentId,
            status: compApp.status,
            version: compApp.version,
          },
          data: {
            status: 'REJECTED',
            version: { increment: 1 },
          },
        });

        // ONLY insert history if the conditional update count is exactly 1!
        // If rejectRes.count === 0, competitor transitioned concurrently (e.g. WITHDRAWN).
        // Their concurrent transition is preserved and never overwritten.
        if (rejectRes.count === 1) {
          await tx.applicationStatusHistory.create({
            data: {
              id: generateUuidV7(),
              applicationId: compApp.id,
              fromStatus: compApp.status,
              toStatus: 'REJECTED',
              actorId: brandUserId,
              reason: 'POSITION_FILLED',
            },
          });
        }
      }

      // 4. Record history for the accepted application
      await tx.applicationStatusHistory.create({
        data: {
          id: generateUuidV7(),
          applicationId,
          fromStatus: 'SHORTLISTED',
          toStatus: 'ACCEPTED',
          actorId: brandUserId,
          reason: 'CANDIDATE_HIRED',
        },
      });
    });

    const updated = (await this.repo.findById(applicationId))!;
    return this.mapApplication(updated);
  }

  private mapApplication(app: any): ApplicationResponse {
    return {
      id: app.id,
      assignmentId: app.assignmentId,
      applicantId: app.applicantId,
      coverLetter: app.coverLetter,
      proposedRate: app.proposedRate,
      currency: app.currency,
      durationDays: app.durationDays,
      status: app.status,
      version: app.version,
      history: (app.history || []).map((h: any) => ({
        id: h.id,
        applicationId: h.applicationId,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        actorId: h.actorId,
        reason: h.reason,
        createdAt: h.createdAt.toISOString(),
      })),
      createdAt: app.createdAt.toISOString(),
      updatedAt: app.updatedAt.toISOString(),
    };
  }
}

export const applicationsService = new ApplicationsService();
