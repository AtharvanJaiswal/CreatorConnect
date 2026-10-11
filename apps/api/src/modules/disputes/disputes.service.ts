import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  DisputeResponse,
  DisputeEvidenceResponse,
  DisputeStatus,
  OpenDisputeInput,
  AddDisputeEvidenceInput,
  UpdateDisputeStatusInput,
  ResolveDisputeInput,
} from '@creatorconnect/contracts';
import {
  NotFoundError,
  ForbiddenError,
  DisputeNotFoundError,
  DisputeStateError,
  SelfDisputeResolutionNotAllowedError,
  ProjectNotDisputableError,
  DisputeAlreadyOpenError,
  InvalidMediaStateError,
} from '../../errors/app-error.js';
import { disputesRepository, DisputesRepository } from './disputes.repository.js';

export class DisputesService {
  constructor(
    private prisma = getPrismaClient(),
    private repo: DisputesRepository = disputesRepository,
  ) {}

  async openDispute(
    callerUserId: string,
    input: OpenDisputeInput,
    isAdmin = false,
  ): Promise<DisputeResponse> {
    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
    });

    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    const isParticipant =
      project.clientId === callerUserId || project.talentId === callerUserId || isAdmin;
    if (!isParticipant) {
      throw new ForbiddenError(
        'Only project participants or platform administrators can open disputes.',
      );
    }

    // Check if active dispute already exists
    if (project.status === 'DISPUTED') {
      throw new DisputeAlreadyOpenError(
        'An active dispute is already in progress for this project.',
      );
    }

    const activeDispute = await this.repo.findActiveDisputeByProjectId(input.projectId);
    if (activeDispute) {
      throw new DisputeAlreadyOpenError(
        'An active dispute is already in progress for this project.',
      );
    }

    // Guard project status: must be active
    const eligibleStatuses = ['IN_PROGRESS', 'SUBMITTED', 'REVISION_REQUESTED', 'APPROVED'];
    if (!eligibleStatuses.includes(project.status)) {
      throw new ProjectNotDisputableError(
        `Cannot open dispute on project in '${project.status}' status. Only active projects can be disputed.`,
      );
    }

    if (input.deliverableId) {
      const deliverable = await this.prisma.projectDeliverable.findUnique({
        where: { id: input.deliverableId },
      });
      if (!deliverable || deliverable.projectId !== input.projectId) {
        throw new NotFoundError('Deliverable not found for this project.');
      }
    }

    // Verify evidence media assets if provided
    if (input.evidenceMediaAssetIds && input.evidenceMediaAssetIds.length > 0) {
      const mediaAssets = await this.prisma.mediaAsset.findMany({
        where: { id: { in: input.evidenceMediaAssetIds } },
      });

      if (mediaAssets.length !== input.evidenceMediaAssetIds.length) {
        throw new NotFoundError('One or more evidence media assets not found.');
      }

      for (const asset of mediaAssets) {
        if (asset.status !== 'ACTIVE') {
          throw new InvalidMediaStateError(
            `Media asset '${asset.id}' is not in ACTIVE state (current: '${asset.status}'). Uploaded evidence must be scanned clean.`,
          );
        }
      }
    }

    const disputeId = generateUuidV7();
    const now = new Date();

    return await this.prisma.$transaction(async (tx) => {
      // 1. Create Dispute
      await tx.dispute.create({
        data: {
          id: disputeId,
          projectId: input.projectId,
          deliverableId: input.deliverableId ?? null,
          openedById: callerUserId,
          reason: input.reason,
          description: input.description,
          status: 'OPEN',
          version: 1,
        },
      });

      // 2. Transition Project to DISPUTED (freezes escrow release)
      await tx.project.update({
        where: { id: input.projectId },
        data: {
          status: 'DISPUTED',
          version: { increment: 1 },
        },
      });

      // 3. Record Audit History
      await tx.disputeStatusHistory.create({
        data: {
          id: generateUuidV7(),
          disputeId,
          fromStatus: 'OPEN',
          toStatus: 'OPEN',
          actorId: callerUserId,
          reason: `Dispute opened: ${input.reason}`,
        },
      });

      // 4. Attach initial evidence assets if provided
      if (input.evidenceMediaAssetIds && input.evidenceMediaAssetIds.length > 0) {
        for (const assetId of input.evidenceMediaAssetIds) {
          await tx.disputeEvidence.create({
            data: {
              id: generateUuidV7(),
              disputeId,
              uploadedById: callerUserId,
              mediaAssetId: assetId,
              title: `Evidence: ${assetId}`,
            },
          });
        }
      }

      // 5. Transactional Outbox Event
      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'dispute.opened.v1',
          aggregateType: 'Dispute',
          aggregateId: disputeId,
          payload: {
            disputeId,
            projectId: input.projectId,
            deliverableId: input.deliverableId ?? null,
            openedById: callerUserId,
            reason: input.reason,
            openedAt: now.toISOString(),
          },
          status: 'PENDING',
        },
      });

      const fullDispute = await tx.dispute.findUniqueOrThrow({
        where: { id: disputeId },
        include: {
          evidence: true,
          history: true,
        },
      });

      return this.mapDispute(fullDispute);
    });
  }

  async getDispute(
    callerUserId: string,
    disputeId: string,
    isAdmin = false,
  ): Promise<DisputeResponse> {
    const dispute = await this.repo.findById(disputeId);
    if (!dispute) {
      throw new DisputeNotFoundError();
    }

    const isParticipant =
      dispute.project.clientId === callerUserId ||
      dispute.project.talentId === callerUserId ||
      isAdmin;

    if (!isParticipant) {
      throw new ForbiddenError('You do not have permission to view this dispute.');
    }

    return this.mapDispute(dispute);
  }

  async listDisputes(
    callerUserId: string,
    filters?: {
      projectId?: string | undefined;
      status?: DisputeStatus | undefined;
    },
    isAdmin = false,
  ): Promise<DisputeResponse[]> {
    const disputes = await this.repo.listDisputes({
      ...filters,
      userId: callerUserId,
      isAdmin,
    });
    return disputes.map((d) => this.mapDispute(d));
  }

  async addEvidence(
    callerUserId: string,
    disputeId: string,
    input: AddDisputeEvidenceInput,
    isAdmin = false,
  ): Promise<DisputeEvidenceResponse> {
    const dispute = await this.repo.findById(disputeId);
    if (!dispute) {
      throw new DisputeNotFoundError();
    }

    const isParticipant =
      dispute.project.clientId === callerUserId ||
      dispute.project.talentId === callerUserId ||
      isAdmin;

    if (!isParticipant) {
      throw new ForbiddenError('You are not authorized to add evidence to this dispute.');
    }

    if (dispute.status === 'CLOSED') {
      throw new DisputeStateError('Cannot add evidence to a closed dispute.');
    }

    if (input.mediaAssetId) {
      const media = await this.prisma.mediaAsset.findUnique({
        where: { id: input.mediaAssetId },
      });
      if (!media) {
        throw new NotFoundError('Media asset not found.');
      }
      if (media.status !== 'ACTIVE') {
        throw new InvalidMediaStateError(
          `Media asset is not ACTIVE (current: '${media.status}'). Scanned clean media is required.`,
        );
      }
    }

    const evidenceId = generateUuidV7();

    return await this.prisma.$transaction(async (tx) => {
      const evidence = await tx.disputeEvidence.create({
        data: {
          id: evidenceId,
          disputeId,
          uploadedById: callerUserId,
          mediaAssetId: input.mediaAssetId ?? null,
          title: input.title,
          description: input.description ?? null,
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'dispute.evidence_added.v1',
          aggregateType: 'Dispute',
          aggregateId: disputeId,
          payload: {
            disputeId,
            evidenceId,
            uploadedById: callerUserId,
            title: input.title,
            mediaAssetId: input.mediaAssetId ?? null,
          },
          status: 'PENDING',
        },
      });

      return {
        id: evidence.id,
        disputeId: evidence.disputeId,
        uploadedById: evidence.uploadedById,
        mediaAssetId: evidence.mediaAssetId,
        title: evidence.title,
        description: evidence.description,
        createdAt: evidence.createdAt.toISOString(),
      };
    });
  }

  async updateDisputeStatus(
    callerUserId: string,
    disputeId: string,
    input: UpdateDisputeStatusInput,
    isAdmin = false,
  ): Promise<DisputeResponse> {
    if (!isAdmin) {
      throw new ForbiddenError('Only platform administrators can transition dispute status.');
    }

    const dispute = await this.repo.findById(disputeId);
    if (!dispute) {
      throw new DisputeNotFoundError();
    }

    // Anti-conflict-of-interest check: Admin cannot resolve their own dispute
    if (dispute.project.clientId === callerUserId || dispute.project.talentId === callerUserId) {
      throw new SelfDisputeResolutionNotAllowedError();
    }

    const fromStatus = dispute.status;
    const targetStatus = input.status;

    // Guard state transitions
    const validTransitions: Record<DisputeStatus, DisputeStatus[]> = {
      OPEN: ['UNDER_REVIEW', 'EVIDENCE_REQUESTED'],
      UNDER_REVIEW: ['EVIDENCE_REQUESTED'],
      EVIDENCE_REQUESTED: ['UNDER_REVIEW'],
      RESOLVED_FOR_CLIENT: [],
      RESOLVED_FOR_CREATOR: [],
      CLOSED: [],
    };

    if (!validTransitions[fromStatus]?.includes(targetStatus)) {
      throw new DisputeStateError(
        `Cannot transition dispute from '${fromStatus}' to '${targetStatus}'.`,
      );
    }

    const deadline = input.evidenceDeadline ? new Date(input.evidenceDeadline) : null;

    return await this.prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: targetStatus,
          deadline: deadline ?? dispute.deadline,
          version: { increment: 1 },
        },
      });

      await tx.disputeStatusHistory.create({
        data: {
          id: generateUuidV7(),
          disputeId,
          fromStatus,
          toStatus: targetStatus,
          actorId: callerUserId,
          reason: input.notes ?? `Dispute status transitioned to ${targetStatus}`,
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'dispute.status_updated.v1',
          aggregateType: 'Dispute',
          aggregateId: disputeId,
          payload: {
            disputeId,
            fromStatus,
            toStatus: targetStatus,
            actorId: callerUserId,
            deadline: deadline ? deadline.toISOString() : null,
          },
          status: 'PENDING',
        },
      });

      const fullDispute = await tx.dispute.findUniqueOrThrow({
        where: { id: disputeId },
        include: { evidence: true, history: true },
      });

      return this.mapDispute(fullDispute);
    });
  }

  async resolveDispute(
    callerUserId: string,
    disputeId: string,
    input: ResolveDisputeInput,
    isAdmin = false,
  ): Promise<DisputeResponse> {
    if (!isAdmin) {
      throw new ForbiddenError('Only platform administrators can resolve disputes.');
    }

    const dispute = await this.repo.findById(disputeId);
    if (!dispute) {
      throw new DisputeNotFoundError();
    }

    // Anti-conflict-of-interest check: Admin cannot arbitrate their own dispute
    if (dispute.project.clientId === callerUserId || dispute.project.talentId === callerUserId) {
      throw new SelfDisputeResolutionNotAllowedError();
    }

    const resolvableStatuses: DisputeStatus[] = ['OPEN', 'UNDER_REVIEW', 'EVIDENCE_REQUESTED'];
    if (!resolvableStatuses.includes(dispute.status)) {
      throw new DisputeStateError(
        `Dispute cannot be resolved in '${dispute.status}' status. Only active disputes can be resolved.`,
      );
    }

    const now = new Date();

    return await this.prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: input.resolution,
          resolvedById: callerUserId,
          resolutionReason: input.resolutionReason,
          resolutionNotes: input.resolutionNotes ?? null,
          resolvedAt: now,
          version: { increment: 1 },
        },
      });

      // Project state update based on resolution:
      // If resolved for creator -> restore project status to IN_PROGRESS (unfreezing escrow)
      // If resolved for client -> remain DISPUTED until refund or cancellation completes
      if (input.resolution === 'RESOLVED_FOR_CREATOR') {
        await tx.project.update({
          where: { id: dispute.projectId },
          data: {
            status: 'IN_PROGRESS',
            version: { increment: 1 },
          },
        });
      }

      await tx.disputeStatusHistory.create({
        data: {
          id: generateUuidV7(),
          disputeId,
          fromStatus: dispute.status,
          toStatus: input.resolution,
          actorId: callerUserId,
          reason: `Dispute resolved: ${input.resolutionReason}`,
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'dispute.resolved.v1',
          aggregateType: 'Dispute',
          aggregateId: disputeId,
          payload: {
            disputeId,
            projectId: dispute.projectId,
            resolution: input.resolution,
            resolvedById: callerUserId,
            resolutionReason: input.resolutionReason,
            refundAmount: input.refundAmount ?? null,
            resolvedAt: now.toISOString(),
          },
          status: 'PENDING',
        },
      });

      const fullDispute = await tx.dispute.findUniqueOrThrow({
        where: { id: disputeId },
        include: { evidence: true, history: true },
      });

      return this.mapDispute(fullDispute);
    });
  }

  async closeDispute(
    callerUserId: string,
    disputeId: string,
    isAdmin = false,
  ): Promise<DisputeResponse> {
    if (!isAdmin) {
      throw new ForbiddenError('Only administrators can close disputes.');
    }

    const dispute = await this.repo.findById(disputeId);
    if (!dispute) {
      throw new DisputeNotFoundError();
    }

    if (dispute.project.clientId === callerUserId || dispute.project.talentId === callerUserId) {
      throw new SelfDisputeResolutionNotAllowedError();
    }

    if (dispute.status !== 'RESOLVED_FOR_CLIENT' && dispute.status !== 'RESOLVED_FOR_CREATOR') {
      throw new DisputeStateError(
        `Dispute must be resolved before it can be closed (current status: '${dispute.status}').`,
      );
    }

    const now = new Date();

    return await this.prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id: disputeId },
        data: {
          status: 'CLOSED',
          closedAt: now,
          version: { increment: 1 },
        },
      });

      await tx.disputeStatusHistory.create({
        data: {
          id: generateUuidV7(),
          disputeId,
          fromStatus: dispute.status,
          toStatus: 'CLOSED',
          actorId: callerUserId,
          reason: 'Dispute closed post-resolution.',
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'dispute.status_updated.v1',
          aggregateType: 'Dispute',
          aggregateId: disputeId,
          payload: {
            disputeId,
            fromStatus: dispute.status,
            toStatus: 'CLOSED',
            actorId: callerUserId,
            closedAt: now.toISOString(),
          },
          status: 'PENDING',
        },
      });

      const fullDispute = await tx.dispute.findUniqueOrThrow({
        where: { id: disputeId },
        include: { evidence: true, history: true },
      });

      return this.mapDispute(fullDispute);
    });
  }

  private mapDispute(d: any): DisputeResponse {
    return {
      id: d.id,
      projectId: d.projectId,
      deliverableId: d.deliverableId ?? null,
      openedById: d.openedById,
      reason: d.reason,
      description: d.description,
      status: d.status,
      deadline: d.deadline ? d.deadline.toISOString() : null,
      resolvedById: d.resolvedById ?? null,
      resolutionReason: d.resolutionReason ?? null,
      resolutionNotes: d.resolutionNotes ?? null,
      resolvedAt: d.resolvedAt ? d.resolvedAt.toISOString() : null,
      closedAt: d.closedAt ? d.closedAt.toISOString() : null,
      version: d.version,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      evidence: d.evidence
        ? d.evidence.map((e: any) => ({
            id: e.id,
            disputeId: e.disputeId,
            uploadedById: e.uploadedById,
            mediaAssetId: e.mediaAssetId ?? null,
            title: e.title,
            description: e.description ?? null,
            createdAt: e.createdAt.toISOString(),
          }))
        : undefined,
      history: d.history
        ? d.history.map((h: any) => ({
            id: h.id,
            disputeId: h.disputeId,
            fromStatus: h.fromStatus,
            toStatus: h.toStatus,
            actorId: h.actorId,
            reason: h.reason ?? null,
            createdAt: h.createdAt.toISOString(),
          }))
        : undefined,
    };
  }
}

export const disputesService = new DisputesService();
