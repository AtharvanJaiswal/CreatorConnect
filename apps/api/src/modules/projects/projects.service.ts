import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  ProjectResponse,
  ProjectDeliverableResponse,
  ProjectStatus,
  SubmitDeliverableInput,
  ReviewDeliverableInput,
  CreateProjectInput,
  CreateProjectDeliverableInput,
  UpdateProjectDeliverableInput,
  DeliverableSubmissionResponse,
  DeliverableAttachmentResponse,
} from '@creatorconnect/contracts';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  UserSuspendedError,
  UserDeactivatedError,
  DeliverableStateError,
  AttachmentScanPendingError,
  AttachmentRejectedError,
  MilestoneNotEditableError,
  DeliverableNotFoundError,
  ProjectNotFoundError,
} from '../../errors/app-error.js';
import {
  projectsRepository,
  ProjectsRepository,
  type DeliverableSubmissionWithDetails,
} from './projects.repository.js';
import { idempotencyService, IdempotencyService } from '../payments/idempotency.service.js';
import {
  S3StorageService,
  MockStorageService,
  type IStorageService,
} from '../media/storage.service.js';

export class ProjectsService {
  constructor(
    private prisma = getPrismaClient(),
    private repo: ProjectsRepository = projectsRepository,
    private idempotency: IdempotencyService = idempotencyService,
    private storage: IStorageService = process.env.NODE_ENV === 'test'
      ? new MockStorageService()
      : new S3StorageService(),
  ) {}

  private async assertUserActive(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!user) {
      throw new NotFoundError('User not found.');
    }
    if (user.status === 'SUSPENDED') {
      throw new UserSuspendedError('Account is suspended. Access denied.');
    }
    if (user.status === 'DEACTIVATED') {
      throw new UserDeactivatedError('Account is deactivated. Access denied.');
    }
  }

  async getProject(userId: string, projectId: string, isAdmin = false): Promise<ProjectResponse> {
    await this.assertUserActive(userId);

    const project = await this.repo.findById(projectId);
    if (!project) {
      throw new ProjectNotFoundError('Project not found.');
    }

    const isParticipant = project.clientId === userId || project.talentId === userId || isAdmin;
    if (!isParticipant) {
      throw new ForbiddenError('You do not have access to this project.');
    }

    return this.mapProject(project);
  }

  async listProjects(
    userId: string,
    filters?: {
      role?: 'client' | 'talent' | undefined;
      status?: ProjectStatus | undefined;
    },
  ): Promise<ProjectResponse[]> {
    await this.assertUserActive(userId);

    const projects = await this.repo.findByUserId(userId, filters);
    return projects.map((p) => this.mapProject(p));
  }

  async createProject(
    callerUserId: string,
    input: CreateProjectInput,
    isAdmin = false,
  ): Promise<ProjectResponse> {
    await this.assertUserActive(callerUserId);

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: input.assignmentId },
      include: { brand: true },
    });

    if (!assignment || assignment.deletedAt) {
      throw new NotFoundError('Assignment not found.');
    }

    if (assignment.brand.userId !== callerUserId && !isAdmin) {
      throw new ForbiddenError('Only the assignment owner can initialize projects.');
    }

    const application = await this.prisma.application.findUnique({
      where: { id: input.applicationId },
    });

    if (!application || application.assignmentId !== input.assignmentId) {
      throw new NotFoundError('Application not found for this assignment.');
    }

    if (application.status !== 'ACCEPTED') {
      throw new BadRequestError('A project can only be created for an accepted application.');
    }

    const existing = await this.repo.findByApplicationId(input.applicationId);
    if (existing) {
      throw new BadRequestError('A project already exists for this accepted application.');
    }

    const projectId = generateUuidV7();
    const deliverablesData =
      input.deliverables && input.deliverables.length > 0
        ? input.deliverables.map((d) => ({
            id: generateUuidV7(),
            title: d.title,
            description: d.description ?? null,
            amount: d.amount,
            dueDate: d.dueDate ? new Date(d.dueDate) : null,
            status: 'PENDING' as const,
            version: 1,
          }))
        : [
            {
              id: generateUuidV7(),
              title: `${input.title} - Final Deliverable`,
              description: input.description ?? null,
              amount: input.totalAmount,
              dueDate: null,
              status: 'PENDING' as const,
              version: 1,
            },
          ];

    return await this.prisma.$transaction(async (tx) => {
      await tx.project.create({
        data: {
          id: projectId,
          assignmentId: input.assignmentId,
          applicationId: input.applicationId,
          clientId: assignment.brand.userId,
          talentId: application.applicantId,
          title: input.title,
          description: input.description ?? null,
          totalAmount: input.totalAmount,
          currency: input.currency ?? 'INR',
          status: 'IN_PROGRESS',
          version: 1,
          deliverables: {
            create: deliverablesData,
          },
        },
        include: {
          deliverables: true,
        },
      });

      // Outbox Event
      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'project.created.v1',
          aggregateType: 'Project',
          aggregateId: projectId,
          payload: {
            projectId,
            assignmentId: input.assignmentId,
            applicationId: input.applicationId,
            clientId: assignment.brand.userId,
            talentId: application.applicantId,
            totalAmount: input.totalAmount,
            currency: input.currency ?? 'INR',
            deliverablesCount: deliverablesData.length,
          },
          status: 'PENDING',
        },
      });

      const fullProject = await tx.project.findUniqueOrThrow({
        where: { id: projectId },
        include: {
          deliverables: { orderBy: { createdAt: 'asc' } },
        },
      });

      return this.mapProject(fullProject);
    });
  }

  async listMilestones(
    userId: string,
    projectId: string,
    isAdmin = false,
  ): Promise<ProjectDeliverableResponse[]> {
    await this.assertUserActive(userId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        deliverables: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!project) {
      throw new ProjectNotFoundError('Project not found.');
    }

    const isParticipant = project.clientId === userId || project.talentId === userId || isAdmin;
    if (!isParticipant) {
      throw new ProjectNotFoundError('Project not found.');
    }

    return project.deliverables.map((d) => this.mapDeliverable(d));
  }

  async getMilestone(
    userId: string,
    projectId: string,
    deliverableId: string,
    isAdmin = false,
  ): Promise<ProjectDeliverableResponse> {
    await this.assertUserActive(userId);

    const deliverable = await this.repo.findDeliverableById(deliverableId);
    if (!deliverable || deliverable.projectId !== projectId) {
      throw new DeliverableNotFoundError('Deliverable not found.');
    }

    const isParticipant =
      deliverable.project.clientId === userId || deliverable.project.talentId === userId || isAdmin;
    if (!isParticipant) {
      throw new DeliverableNotFoundError('Deliverable not found.');
    }

    return this.mapDeliverable(deliverable);
  }

  async createMilestone(
    callerUserId: string,
    projectId: string,
    input: CreateProjectDeliverableInput,
    isAdmin = false,
  ): Promise<ProjectDeliverableResponse> {
    await this.assertUserActive(callerUserId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new ProjectNotFoundError('Project not found.');
    }

    if (project.clientId !== callerUserId && !isAdmin) {
      throw new ForbiddenError('Only the project client can create milestones.');
    }

    if (project.status === 'DISPUTED') {
      throw new BadRequestError('Cannot add milestones while project is in DISPUTED status.');
    }
    if (project.status === 'CANCELLED') {
      throw new BadRequestError('Cannot add milestones to a cancelled project.');
    }
    if (project.status === 'COMPLETED') {
      throw new BadRequestError('Cannot add milestones to an already completed project.');
    }

    const deliverableId = generateUuidV7();

    return await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "projects" WHERE id = ${projectId}::uuid FOR UPDATE`;

      const deliverable = await tx.projectDeliverable.create({
        data: {
          id: deliverableId,
          projectId,
          title: input.title,
          description: input.description ?? null,
          amount: input.amount,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          status: 'PENDING',
          version: 1,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: {
          totalAmount: { increment: input.amount },
          version: { increment: 1 },
        },
      });

      return this.mapDeliverable(deliverable);
    });
  }

  async updateMilestone(
    callerUserId: string,
    projectId: string,
    deliverableId: string,
    input: UpdateProjectDeliverableInput,
    isAdmin = false,
  ): Promise<ProjectDeliverableResponse> {
    await this.assertUserActive(callerUserId);

    const deliverable = await this.repo.findDeliverableById(deliverableId);
    if (!deliverable || deliverable.projectId !== projectId) {
      throw new DeliverableNotFoundError('Deliverable not found.');
    }

    if (deliverable.project.clientId !== callerUserId && !isAdmin) {
      throw new ForbiddenError('Only the project client can edit milestones.');
    }

    if (deliverable.project.status === 'DISPUTED' || deliverable.project.status === 'CANCELLED') {
      throw new BadRequestError('Cannot edit milestones on a disputed or cancelled project.');
    }

    if (deliverable.status !== 'PENDING') {
      throw new MilestoneNotEditableError(
        `Cannot edit milestone in '${deliverable.status}' status. Only PENDING milestones can be updated.`,
      );
    }

    return await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "project_deliverables" WHERE id = ${deliverableId}::uuid FOR UPDATE`;

      const dataToUpdate: any = {};
      if (input.title !== undefined) dataToUpdate.title = input.title;
      if (input.description !== undefined) dataToUpdate.description = input.description;
      if (input.dueDate !== undefined)
        dataToUpdate.dueDate = input.dueDate ? new Date(input.dueDate) : null;

      let amountDelta = 0;
      if (input.amount !== undefined && input.amount !== deliverable.amount) {
        amountDelta = input.amount - deliverable.amount;
        dataToUpdate.amount = input.amount;
      }

      const updated = await tx.projectDeliverable.update({
        where: { id: deliverableId },
        data: dataToUpdate,
      });

      if (amountDelta !== 0) {
        await tx.project.update({
          where: { id: projectId },
          data: {
            totalAmount: { increment: amountDelta },
            version: { increment: 1 },
          },
        });
      }

      return this.mapDeliverable(updated);
    });
  }

  async submitDeliverable(
    talentUserId: string,
    projectId: string,
    deliverableId: string,
    input: SubmitDeliverableInput,
  ): Promise<ProjectDeliverableResponse> {
    const scope = 'deliverable_submit';

    // 1. Idempotency Check
    if (input.idempotencyKey) {
      const cached = await this.idempotency.check<ProjectDeliverableResponse>(
        scope,
        input.idempotencyKey,
        input,
      );
      if (cached.isCached && cached.body) {
        return cached.body;
      }
    }

    await this.assertUserActive(talentUserId);

    const deliverable = await this.repo.findDeliverableById(deliverableId);
    if (!deliverable || deliverable.projectId !== projectId) {
      // Anti-enumeration 404
      throw new DeliverableNotFoundError('Deliverable not found for this project.');
    }

    if (deliverable.project.talentId !== talentUserId) {
      throw new ForbiddenError('Only the assigned talent can submit deliverables.');
    }

    if (deliverable.project.status === 'DISPUTED') {
      throw new BadRequestError('Cannot submit deliverables while project is in DISPUTED status.');
    }
    if (deliverable.project.status === 'CANCELLED') {
      throw new BadRequestError('Cannot submit deliverables for a cancelled project.');
    }

    if (deliverable.status !== 'PENDING' && deliverable.status !== 'REVISION_REQUESTED') {
      throw new DeliverableStateError(
        `Cannot submit deliverable in '${deliverable.status}' status. Only PENDING or REVISION_REQUESTED can be submitted.`,
      );
    }

    // 2. Attachment Security & Scan Validation
    if (input.submittedAssetId) {
      const asset = await this.prisma.mediaAsset.findUnique({
        where: { id: input.submittedAssetId },
      });

      if (!asset) {
        throw new NotFoundError('Attached media asset not found.');
      }

      if (asset.userId !== talentUserId) {
        throw new ForbiddenError('Cannot attach a media asset owned by another user.');
      }

      if (asset.status === 'QUARANTINED' || asset.status === 'PENDING_SCAN') {
        throw new AttachmentScanPendingError(
          'Deliverable attachment is still undergoing security scanning. Please retry after verification completes.',
        );
      }

      if (asset.status === 'REJECTED_INVALID') {
        throw new AttachmentRejectedError(
          'Deliverable attachment was rejected by security scanning and cannot be submitted.',
        );
      }

      if (asset.status !== 'ACTIVE') {
        throw new BadRequestError(`Cannot submit attachment in '${asset.status}' state.`);
      }
    }

    const now = new Date();

    const response = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "projects" WHERE id = ${projectId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "project_deliverables" WHERE id = ${deliverableId}::uuid FOR UPDATE`;

      const currentProject = await tx.project.findUniqueOrThrow({
        where: { id: projectId },
      });
      if (currentProject.status === 'DISPUTED') {
        throw new BadRequestError(
          'Cannot submit deliverables while project is in DISPUTED status.',
        );
      }
      if (currentProject.status === 'CANCELLED') {
        throw new BadRequestError('Cannot submit deliverables for a cancelled project.');
      }

      const currentDeliverable = await tx.projectDeliverable.findUniqueOrThrow({
        where: { id: deliverableId },
      });
      if (
        currentDeliverable.status !== 'PENDING' &&
        currentDeliverable.status !== 'REVISION_REQUESTED'
      ) {
        throw new DeliverableStateError(
          `Cannot submit deliverable in '${currentDeliverable.status}' status.`,
        );
      }

      const currentSubmissionsCount = await tx.projectDeliverableSubmission.count({
        where: { deliverableId },
      });
      const nextVersion = currentSubmissionsCount + 1;

      const updatedDeliverable = await tx.projectDeliverable.update({
        where: { id: deliverableId },
        data: {
          status: 'SUBMITTED',
          submittedAt: now,
          submittedAssetId: input.submittedAssetId ?? null,
          submissionNotes: input.submissionNotes ?? null,
          version: nextVersion,
        },
      });

      // Create durable submission history record
      await tx.projectDeliverableSubmission.create({
        data: {
          id: generateUuidV7(),
          deliverableId,
          version: nextVersion,
          submittedById: talentUserId,
          submittedAssetId: input.submittedAssetId ?? null,
          submissionNotes: input.submissionNotes ?? null,
          reviewStatus: 'SUBMITTED',
          submittedAt: now,
        },
      });

      await tx.project.update({
        where: { id: projectId },
        data: {
          status: 'SUBMITTED',
          version: { increment: 1 },
        },
      });

      // Outbox event
      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'project.deliverable.submitted.v1',
          aggregateType: 'ProjectDeliverable',
          aggregateId: deliverableId,
          payload: {
            projectId,
            deliverableId,
            talentId: talentUserId,
            clientId: deliverable.project.clientId,
            version: nextVersion,
            submittedAssetId: input.submittedAssetId ?? null,
            submissionNotes: input.submissionNotes ?? null,
            submittedAt: now.toISOString(),
          },
          status: 'PENDING',
        },
      });

      const mapped = this.mapDeliverable(updatedDeliverable);

      // Record Idempotency
      if (input.idempotencyKey) {
        await this.idempotency.record(
          scope,
          input.idempotencyKey,
          input,
          200,
          mapped,
          deliverableId,
          24,
          tx,
        );
      }

      return mapped;
    });

    return response;
  }

  async reviewDeliverable(
    clientUserId: string,
    projectId: string,
    deliverableId: string,
    input: ReviewDeliverableInput,
  ): Promise<ProjectDeliverableResponse> {
    const scope = 'deliverable_review';

    // 1. Idempotency Check
    if (input.idempotencyKey) {
      const cached = await this.idempotency.check<ProjectDeliverableResponse>(
        scope,
        input.idempotencyKey,
        input,
      );
      if (cached.isCached && cached.body) {
        return cached.body;
      }
    }

    await this.assertUserActive(clientUserId);

    const deliverable = await this.repo.findDeliverableById(deliverableId);
    if (!deliverable || deliverable.projectId !== projectId) {
      // Anti-enumeration 404
      throw new DeliverableNotFoundError('Deliverable not found for this project.');
    }

    if (deliverable.project.clientId !== clientUserId) {
      throw new ForbiddenError('Only the project client can review deliverables.');
    }

    if (deliverable.project.status === 'DISPUTED') {
      throw new BadRequestError('Cannot review deliverables while project is in DISPUTED status.');
    }
    if (deliverable.project.status === 'CANCELLED') {
      throw new BadRequestError('Cannot review deliverables for a cancelled project.');
    }

    if (deliverable.status !== 'SUBMITTED' && deliverable.status !== 'IN_REVIEW') {
      throw new DeliverableStateError(
        `Cannot review deliverable in '${deliverable.status}' status. Only SUBMITTED deliverables can be reviewed.`,
      );
    }

    const now = new Date();

    const response = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "projects" WHERE id = ${projectId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "project_deliverables" WHERE id = ${deliverableId}::uuid FOR UPDATE`;

      const currentProject = await tx.project.findUniqueOrThrow({
        where: { id: projectId },
      });
      if (currentProject.status === 'DISPUTED') {
        throw new BadRequestError(
          'Cannot review deliverables while project is in DISPUTED status.',
        );
      }
      if (currentProject.status === 'CANCELLED') {
        throw new BadRequestError('Cannot review deliverables for a cancelled project.');
      }

      const currentDeliverable = await tx.projectDeliverable.findUniqueOrThrow({
        where: { id: deliverableId },
      });
      if (currentDeliverable.status !== 'SUBMITTED' && currentDeliverable.status !== 'IN_REVIEW') {
        throw new DeliverableStateError(
          `Cannot review deliverable in '${currentDeliverable.status}' status.`,
        );
      }

      if (input.action === 'APPROVE') {
        const updatedDeliverable = await tx.projectDeliverable.update({
          where: { id: deliverableId },
          data: {
            status: 'APPROVED',
            approvedAt: now,
            version: { increment: 1 },
          },
        });

        // Update latest submission history record
        const latestSubmission = await tx.projectDeliverableSubmission.findFirst({
          where: { deliverableId },
          orderBy: { version: 'desc' },
        });

        if (latestSubmission) {
          await tx.projectDeliverableSubmission.update({
            where: { id: latestSubmission.id },
            data: {
              reviewStatus: 'APPROVED',
              reviewedById: clientUserId,
              reviewNotes: input.notes ?? null,
              reviewedAt: now,
            },
          });
        }

        // Check if all deliverables in project are now APPROVED
        const remainingUnapproved = await tx.projectDeliverable.count({
          where: {
            projectId,
            id: { not: deliverableId },
            status: { not: 'APPROVED' },
          },
        });

        if (remainingUnapproved === 0) {
          await tx.project.update({
            where: { id: projectId },
            data: {
              status: 'COMPLETED',
              completedAt: now,
              version: { increment: 1 },
            },
          });
        }

        await tx.outboxEvent.create({
          data: {
            id: generateUuidV7(),
            eventType: 'project.deliverable.approved.v1',
            aggregateType: 'ProjectDeliverable',
            aggregateId: deliverableId,
            payload: {
              projectId,
              deliverableId,
              clientId: clientUserId,
              talentId: deliverable.project.talentId,
              approvedAt: now.toISOString(),
              allApproved: remainingUnapproved === 0,
            },
            status: 'PENDING',
          },
        });

        const mapped = this.mapDeliverable(updatedDeliverable);

        if (input.idempotencyKey) {
          await this.idempotency.record(
            scope,
            input.idempotencyKey,
            input,
            200,
            mapped,
            deliverableId,
            24,
            tx,
          );
        }

        return mapped;
      } else {
        // REQUEST_REVISION
        const updatedDeliverable = await tx.projectDeliverable.update({
          where: { id: deliverableId },
          data: {
            status: 'REVISION_REQUESTED',
            revisionNotes: input.notes ?? null,
            version: { increment: 1 },
          },
        });

        // Update latest submission history record
        const latestSubmission = await tx.projectDeliverableSubmission.findFirst({
          where: { deliverableId },
          orderBy: { version: 'desc' },
        });

        if (latestSubmission) {
          await tx.projectDeliverableSubmission.update({
            where: { id: latestSubmission.id },
            data: {
              reviewStatus: 'REVISION_REQUESTED',
              reviewedById: clientUserId,
              reviewNotes: input.notes ?? null,
              reviewedAt: now,
            },
          });
        }

        await tx.project.update({
          where: { id: projectId },
          data: {
            status: 'REVISION_REQUESTED',
            version: { increment: 1 },
          },
        });

        await tx.outboxEvent.create({
          data: {
            id: generateUuidV7(),
            eventType: 'project.deliverable.revision_requested.v1',
            aggregateType: 'ProjectDeliverable',
            aggregateId: deliverableId,
            payload: {
              projectId,
              deliverableId,
              clientId: clientUserId,
              talentId: deliverable.project.talentId,
              notes: input.notes ?? null,
              requestedAt: now.toISOString(),
            },
            status: 'PENDING',
          },
        });

        const mapped = this.mapDeliverable(updatedDeliverable);

        if (input.idempotencyKey) {
          await this.idempotency.record(
            scope,
            input.idempotencyKey,
            input,
            200,
            mapped,
            deliverableId,
            24,
            tx,
          );
        }

        return mapped;
      }
    });

    return response;
  }

  async getSubmissionHistory(
    userId: string,
    projectId: string,
    deliverableId: string,
    isAdmin = false,
  ): Promise<DeliverableSubmissionResponse[]> {
    await this.assertUserActive(userId);

    const deliverable = await this.repo.findDeliverableById(deliverableId);
    if (!deliverable || deliverable.projectId !== projectId) {
      throw new DeliverableNotFoundError('Deliverable not found.');
    }

    const isParticipant =
      deliverable.project.clientId === userId || deliverable.project.talentId === userId || isAdmin;
    if (!isParticipant) {
      throw new DeliverableNotFoundError('Deliverable not found.');
    }

    const submissions = await this.repo.findSubmissions(deliverableId);
    return submissions.map((s: DeliverableSubmissionWithDetails) => ({
      id: s.id,
      deliverableId: s.deliverableId,
      version: s.version,
      submittedById: s.submittedById,
      submittedAssetId: s.submittedAssetId ?? null,
      submissionNotes: s.submissionNotes ?? null,
      reviewStatus: s.reviewStatus,
      reviewedById: s.reviewedById ?? null,
      reviewNotes: s.reviewNotes ?? null,
      submittedAt: s.submittedAt.toISOString(),
      reviewedAt: s.reviewedAt ? s.reviewedAt.toISOString() : null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async getDeliverableAttachment(
    userId: string,
    projectId: string,
    deliverableId: string,
    assetId: string,
    isAdmin = false,
  ): Promise<DeliverableAttachmentResponse> {
    await this.assertUserActive(userId);

    const deliverable = await this.repo.findDeliverableById(deliverableId);
    if (!deliverable || deliverable.projectId !== projectId) {
      throw new DeliverableNotFoundError('Deliverable not found.');
    }

    const isParticipant =
      deliverable.project.clientId === userId || deliverable.project.talentId === userId || isAdmin;
    if (!isParticipant) {
      throw new DeliverableNotFoundError('Deliverable not found.');
    }

    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundError('Media asset not found.');
    }

    // Verify asset is attached to this deliverable or one of its submissions
    const isAttached =
      deliverable.submittedAssetId === assetId ||
      deliverable.submissions.some((s) => s.submittedAssetId === assetId);

    if (!isAttached && !isAdmin) {
      throw new ForbiddenError('Media asset is not attached to this deliverable.');
    }

    let downloadUrl: string | null = null;
    let expiresAt: string | null = null;

    if (asset.status === 'ACTIVE') {
      const expiresInSeconds = 3600;
      downloadUrl = await this.storage.getDownloadUrl(asset.storageKey, expiresInSeconds, true);
      expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
    }

    return {
      id: asset.id,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      mediaType: asset.mediaType,
      status: asset.status,
      downloadUrl,
      expiresAt,
    };
  }

  private mapDeliverable(d: any): ProjectDeliverableResponse {
    return {
      id: d.id,
      projectId: d.projectId,
      title: d.title,
      description: d.description ?? null,
      amount: d.amount,
      dueDate: d.dueDate ? d.dueDate.toISOString() : null,
      status: d.status,
      version: d.version,
      submittedAssetId: d.submittedAssetId ?? null,
      submissionNotes: d.submissionNotes ?? null,
      revisionNotes: d.revisionNotes ?? null,
      submittedAt: d.submittedAt ? d.submittedAt.toISOString() : null,
      approvedAt: d.approvedAt ? d.approvedAt.toISOString() : null,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  private mapProject(p: any): ProjectResponse {
    return {
      id: p.id,
      assignmentId: p.assignmentId,
      applicationId: p.applicationId,
      clientId: p.clientId,
      talentId: p.talentId,
      title: p.title,
      description: p.description ?? null,
      totalAmount: p.totalAmount,
      currency: p.currency,
      status: p.status,
      version: p.version,
      startedAt: p.startedAt.toISOString(),
      completedAt: p.completedAt ? p.completedAt.toISOString() : null,
      cancelledAt: p.cancelledAt ? p.cancelledAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      deliverables: p.deliverables
        ? p.deliverables.map((d: any) => this.mapDeliverable(d))
        : undefined,
    };
  }
}

export const projectsService = new ProjectsService();
