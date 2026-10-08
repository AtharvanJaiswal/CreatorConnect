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
import { assertValidApplicationTransition } from './application-state-machine.js';

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

    // Finding 01: Validate parent assignment lifecycle
    if (app.assignment.status !== 'PUBLISHED' || app.assignment.deletedAt) {
      throw new BadRequestError(
        `Cannot transition application status when assignment is in ${app.assignment.status} status. Only active proposals for PUBLISHED assignments may be reviewed.`,
      );
    }

    const currentStatus = app.status;
    const targetStatus = payload.status as ApplicationStatus;

    // Explicit state machine transition enforcement (F-09)
    assertValidApplicationTransition(currentStatus, targetStatus);

    await this.prisma.$transaction(async (tx) => {
      // Concurrency & Invariant Hardening: Lock parent assignment within transaction
      const lockedAssignment = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status FROM assignments
        WHERE id = ${app.assignmentId}::uuid AND deleted_at IS NULL
        FOR SHARE
      `;

      const firstLocked = lockedAssignment[0];
      if (!firstLocked || firstLocked.status !== 'PUBLISHED') {
        throw new BadRequestError(
          `Cannot transition application status when parent assignment is in ${
            firstLocked ? firstLocked.status : 'DELETED'
          } status. Only active proposals for PUBLISHED assignments may be reviewed.`,
        );
      }

      // Finding 02: Conditional atomic update preventing race conditions
      const updateRes = await tx.application.updateMany({
        where: {
          id: applicationId,
          status: currentStatus,
          version: app.version,
        },
        data: {
          status: targetStatus,
          version: { increment: 1 },
        },
      });

      if (updateRes.count !== 1) {
        throw new OptimisticLockConflictError(
          'Application status was modified concurrently and cannot be updated.',
        );
      }

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
    // Explicit state machine transition enforcement (F-09)
    assertValidApplicationTransition(currentStatus, 'WITHDRAWN');

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
    return await this.prisma.$transaction(async (tx) => {
      // 1. Lock parent assignment first within transaction using SELECT ... FOR UPDATE (F-08 / F-09)
      const lockedAssignments = await tx.$queryRaw<
        Array<{
          id: string;
          brand_id: string;
          status: string;
          deadline: Date;
          version: number;
          now: Date;
        }>
      >`
        SELECT a.id, a.brand_id, a.status, a.deadline, a.version, NOW() as now
        FROM assignments a
        WHERE a.id = ${assignmentId}::uuid AND a.deleted_at IS NULL
        FOR UPDATE
      `;

      const assignment = lockedAssignments[0];
      if (!assignment) {
        throw new NotFoundError('Assignment not found.');
      }

      // 2. Ownership verification
      const brandProfile = await tx.brandProfile.findUnique({
        where: { id: assignment.brand_id },
        select: { userId: true },
      });

      if (!brandProfile || (brandProfile.userId !== brandUserId && !isAdmin)) {
        throw new ForbiddenError('Only the assignment brand owner or admin can accept candidates.');
      }

      // 3. Status and version verification
      if (assignment.version !== payload.expectedVersion || assignment.status !== 'PUBLISHED') {
        throw new OptimisticLockConflictError(
          `Assignment state conflict: assignment was modified concurrently (current status: ${assignment.status}, version: ${assignment.version}).`,
        );
      }

      // 4. PostgreSQL database time deadline verification (F-08 Hardening)
      // Acceptance does NOT depend on scheduler timing. If deadline <= database NOW(), reject immediately.
      if (assignment.deadline && new Date(assignment.deadline) <= new Date(assignment.now)) {
        throw new AssignmentDeadlineExpiredError(
          'Assignment deadline has passed. Cannot accept applications for expired assignments.',
        );
      }

      // 5. Lock and verify target application
      const lockedApplications = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          version: number;
        }>
      >`
        SELECT id, status, version
        FROM applications
        WHERE id = ${applicationId}::uuid AND assignment_id = ${assignmentId}::uuid
        FOR UPDATE
      `;

      const targetApp = lockedApplications[0];
      if (!targetApp) {
        throw new NotFoundError('Application not found.');
      }

      // State machine transition check: must be SHORTLISTED -> ACCEPTED
      assertValidApplicationTransition(targetApp.status as ApplicationStatus, 'ACCEPTED');

      if (targetApp.version !== payload.expectedApplicationVersion) {
        throw new OptimisticLockConflictError(
          'Application was modified concurrently. Please reload and retry.',
        );
      }

      // 6. Transition Assignment to IN_PROGRESS
      await tx.assignment.update({
        where: { id: assignmentId },
        data: {
          status: 'IN_PROGRESS',
          version: { increment: 1 },
        },
      });

      // 7. Transition Target Application to ACCEPTED
      await tx.application.update({
        where: { id: applicationId },
        data: {
          status: 'ACCEPTED',
          version: { increment: 1 },
        },
      });

      // 8. Reject competing active applications with reason POSITION_FILLED
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

      // 9. Record history for the accepted application
      await tx.applicationStatusHistory.create({
        data: {
          id: generateUuidV7(),
          applicationId,
          fromStatus: targetApp.status as ApplicationStatus,
          toStatus: 'ACCEPTED',
          actorId: brandUserId,
          reason: 'CANDIDATE_HIRED',
        },
      });

      const updated = await tx.application.findUniqueOrThrow({
        where: { id: applicationId },
        include: {
          assignment: { include: { brand: true } },
          applicant: true,
          history: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });

      return this.mapApplication(updated as any);
    });
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
