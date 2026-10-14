import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  ProjectCancellationResponse,
  RequestCancellationInput,
  DecideCancellationInput,
} from '@creatorconnect/contracts';
import {
  NotFoundError,
  ForbiddenError,
  CancellationNotFoundError,
  CancellationStateError,
  ProjectCancellationConflictError,
  ProjectNotDisputableError,
} from '../../errors/app-error.js';

export class CancellationsService {
  constructor(private prisma = getPrismaClient()) {}

  async requestCancellation(
    callerUserId: string,
    projectId: string,
    input: RequestCancellationInput,
    isAdmin = false,
  ): Promise<ProjectCancellationResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    const isParticipant =
      project.clientId === callerUserId || project.talentId === callerUserId || isAdmin;
    if (!isParticipant) {
      throw new ForbiddenError('Only project participants can request project cancellation.');
    }

    // Projects with active disputes must be mediated via dispute resolution
    if (project.status === 'DISPUTED') {
      throw new ProjectNotDisputableError(
        'Project is currently in DISPUTED status. Cancellation must be mediated via dispute resolution.',
      );
    }

    const cancellableStatuses = ['IN_PROGRESS', 'SUBMITTED', 'REVISION_REQUESTED'];
    if (!cancellableStatuses.includes(project.status)) {
      throw new CancellationStateError(
        `Cannot request cancellation for project in '${project.status}' status.`,
      );
    }

    // Check for existing pending cancellation
    const existingPending = await this.prisma.projectCancellation.findFirst({
      where: {
        projectId,
        status: 'PENDING',
      },
    });

    if (existingPending) {
      throw new ProjectCancellationConflictError(
        'A pending cancellation request already exists for this project.',
      );
    }

    const cancellationId = generateUuidV7();
    const now = new Date();

    return await this.prisma.$transaction(async (tx) => {
      const cancellation = await tx.projectCancellation.create({
        data: {
          id: cancellationId,
          projectId,
          requestedById: callerUserId,
          reason: input.reason,
          status: 'PENDING',
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'cancellation.requested.v1',
          aggregateType: 'ProjectCancellation',
          aggregateId: cancellationId,
          payload: {
            cancellationId,
            projectId,
            requestedById: callerUserId,
            reason: input.reason,
            requestedAt: now.toISOString(),
          },
          status: 'PENDING',
        },
      });

      return this.mapCancellation(cancellation);
    });
  }

  async decideCancellation(
    callerUserId: string,
    projectId: string,
    cancellationId: string,
    input: DecideCancellationInput,
    isAdmin = false,
  ): Promise<ProjectCancellationResponse> {
    const cancellation = await this.prisma.projectCancellation.findUnique({
      where: { id: cancellationId },
      include: { project: true },
    });

    if (!cancellation || cancellation.projectId !== projectId) {
      throw new CancellationNotFoundError('Cancellation request not found for this project.');
    }

    if (cancellation.status !== 'PENDING') {
      throw new CancellationStateError(
        `Cancellation request has already been decided (status: '${cancellation.status}').`,
      );
    }

    if (cancellation.project.status === 'DISPUTED') {
      throw new ProjectNotDisputableError(
        'Cannot decide cancellation while project has an active dispute.',
      );
    }

    const cancellableStatuses = ['IN_PROGRESS', 'SUBMITTED', 'REVISION_REQUESTED'];
    if (!cancellableStatuses.includes(cancellation.project.status)) {
      throw new CancellationStateError(
        `Cannot decide cancellation for project in '${cancellation.project.status}' status.`,
      );
    }

    // Mutual consent check:
    // If client requested -> talent must decide (or Admin)
    // If talent requested -> client must decide (or Admin)
    const isClient = cancellation.project.clientId === callerUserId;
    const isTalent = cancellation.project.talentId === callerUserId;
    const isRequester = cancellation.requestedById === callerUserId;

    if (!isAdmin) {
      if (isRequester) {
        throw new ForbiddenError(
          'You cannot approve or reject your own cancellation request. Use withdraw instead.',
        );
      }
      if (!isClient && !isTalent) {
        throw new ForbiddenError('You do not have permission to decide this cancellation request.');
      }
    }

    const targetStatus = input.action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    const now = new Date();

    return await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "projects" WHERE id = ${projectId}::uuid FOR UPDATE`;
      const currentProject = await tx.project.findUniqueOrThrow({
        where: { id: projectId },
      });
      if (currentProject.status === 'DISPUTED') {
        throw new ProjectNotDisputableError(
          'Cannot decide cancellation while project has an active dispute.',
        );
      }

      const updated = await tx.projectCancellation.update({
        where: { id: cancellationId },
        data: {
          status: targetStatus,
          decidedById: callerUserId,
          decisionReason: input.decisionReason ?? null,
          decidedAt: now,
        },
      });

      if (input.action === 'APPROVE') {
        // Cancel the project
        await tx.project.update({
          where: { id: projectId },
          data: {
            status: 'CANCELLED',
            cancelledAt: now,
            version: { increment: 1 },
          },
        });
      }

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'cancellation.decided.v1',
          aggregateType: 'ProjectCancellation',
          aggregateId: cancellationId,
          payload: {
            cancellationId,
            projectId,
            action: input.action,
            decidedById: callerUserId,
            decidedAt: now.toISOString(),
          },
          status: 'PENDING',
        },
      });

      return this.mapCancellation(updated);
    });
  }

  async withdrawCancellation(
    callerUserId: string,
    projectId: string,
    cancellationId: string,
    isAdmin = false,
  ): Promise<ProjectCancellationResponse> {
    const cancellation = await this.prisma.projectCancellation.findUnique({
      where: { id: cancellationId },
    });

    if (!cancellation || cancellation.projectId !== projectId) {
      throw new CancellationNotFoundError('Cancellation request not found for this project.');
    }

    if (cancellation.status !== 'PENDING') {
      throw new CancellationStateError(
        `Cannot withdraw cancellation request in '${cancellation.status}' status.`,
      );
    }

    if (cancellation.requestedById !== callerUserId && !isAdmin) {
      throw new ForbiddenError('Only the requester can withdraw their cancellation request.');
    }

    const updated = await this.prisma.projectCancellation.update({
      where: { id: cancellationId },
      data: {
        status: 'WITHDRAWN',
      },
    });

    return this.mapCancellation(updated);
  }

  async listCancellations(
    callerUserId: string,
    projectId: string,
    isAdmin = false,
  ): Promise<ProjectCancellationResponse[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    const isParticipant =
      project.clientId === callerUserId || project.talentId === callerUserId || isAdmin;
    if (!isParticipant) {
      throw new ForbiddenError('You do not have access to cancellation records for this project.');
    }

    const cancellations = await this.prisma.projectCancellation.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    return cancellations.map((c) => this.mapCancellation(c));
  }

  private mapCancellation(c: any): ProjectCancellationResponse {
    return {
      id: c.id,
      projectId: c.projectId,
      requestedById: c.requestedById,
      reason: c.reason,
      status: c.status,
      decidedById: c.decidedById ?? null,
      decisionReason: c.decisionReason ?? null,
      decidedAt: c.decidedAt ? c.decidedAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}

export const cancellationsService = new CancellationsService();
