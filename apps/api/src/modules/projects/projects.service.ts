import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  ProjectResponse,
  ProjectDeliverableResponse,
  ProjectStatus,
  SubmitDeliverableInput,
  ReviewDeliverableInput,
  CreateProjectInput,
} from '@creatorconnect/contracts';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../errors/app-error.js';
import { projectsRepository, ProjectsRepository } from './projects.repository.js';

export class ProjectsService {
  constructor(
    private prisma = getPrismaClient(),
    private repo: ProjectsRepository = projectsRepository,
  ) {}

  async getProject(userId: string, projectId: string, isAdmin = false): Promise<ProjectResponse> {
    const project = await this.repo.findById(projectId);
    if (!project) {
      throw new NotFoundError('Project not found.');
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
    const projects = await this.repo.findByUserId(userId, filters);
    return projects.map((p) => this.mapProject(p));
  }

  async createProject(
    callerUserId: string,
    input: CreateProjectInput,
    isAdmin = false,
  ): Promise<ProjectResponse> {
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

  async submitDeliverable(
    talentUserId: string,
    projectId: string,
    deliverableId: string,
    input: SubmitDeliverableInput,
  ): Promise<ProjectDeliverableResponse> {
    const deliverable = await this.repo.findDeliverableById(deliverableId);
    if (!deliverable || deliverable.projectId !== projectId) {
      throw new NotFoundError('Deliverable not found for this project.');
    }

    if (deliverable.project.talentId !== talentUserId) {
      throw new ForbiddenError('Only the assigned talent can submit deliverables.');
    }

    if (deliverable.status !== 'PENDING' && deliverable.status !== 'REVISION_REQUESTED') {
      throw new BadRequestError(
        `Cannot submit deliverable in '${deliverable.status}' status. Only PENDING or REVISION_REQUESTED can be submitted.`,
      );
    }

    const now = new Date();

    return await this.prisma.$transaction(async (tx) => {
      const updatedDeliverable = await tx.projectDeliverable.update({
        where: { id: deliverableId },
        data: {
          status: 'SUBMITTED',
          submittedAt: now,
          submittedAssetId: input.submittedAssetId ?? null,
          submissionNotes: input.submissionNotes ?? null,
          version: { increment: 1 },
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
            submittedAssetId: input.submittedAssetId ?? null,
            submissionNotes: input.submissionNotes ?? null,
            submittedAt: now.toISOString(),
          },
          status: 'PENDING',
        },
      });

      return this.mapDeliverable(updatedDeliverable);
    });
  }

  async reviewDeliverable(
    clientUserId: string,
    projectId: string,
    deliverableId: string,
    input: ReviewDeliverableInput,
  ): Promise<ProjectDeliverableResponse> {
    const deliverable = await this.repo.findDeliverableById(deliverableId);
    if (!deliverable || deliverable.projectId !== projectId) {
      throw new NotFoundError('Deliverable not found for this project.');
    }

    if (deliverable.project.clientId !== clientUserId) {
      throw new ForbiddenError('Only the project client can review deliverables.');
    }

    if (deliverable.status !== 'SUBMITTED' && deliverable.status !== 'IN_REVIEW') {
      throw new BadRequestError(
        `Cannot review deliverable in '${deliverable.status}' status. Only SUBMITTED deliverables can be reviewed.`,
      );
    }

    const now = new Date();

    return await this.prisma.$transaction(async (tx) => {
      if (input.action === 'APPROVE') {
        const updatedDeliverable = await tx.projectDeliverable.update({
          where: { id: deliverableId },
          data: {
            status: 'APPROVED',
            approvedAt: now,
            version: { increment: 1 },
          },
        });

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

        return this.mapDeliverable(updatedDeliverable);
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

        return this.mapDeliverable(updatedDeliverable);
      }
    });
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
