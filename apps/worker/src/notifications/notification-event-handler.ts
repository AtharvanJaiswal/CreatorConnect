import type {
  ClaimedOutboxEvent,
  INotificationRepository,
  PrismaClient,
} from '@creatorconnect/database';
import { getPrismaClient, notificationRepository } from '@creatorconnect/database';
import {
  MessageCreatedV1PayloadSchema,
  type MessageCreatedV1Payload,
} from '@creatorconnect/contracts';
import { Value } from '@creatorconnect/validation';
import type { IEventDispatcher, DispatchResult } from '../outbox/event-dispatcher.js';
import type { Logger } from 'pino';

export interface NotificationEventHandlerOptions {
  prisma?: PrismaClient;
  notificationRepo?: INotificationRepository;
  logger?: Logger;
}

/**
 * Handles outbox domain events to create durable in-app notifications.
 *
 * Implements:
 * 1. Validates event payload.
 * 2. Resolves recipient authoritatively.
 * 3. Enforces account-status policy (suspended/deactivated recipients ineligible).
 * 4. Enforces user block policy (suppresses notifications between blocked peers).
 * 5. Evaluates user in-app notification preferences.
 * 6. Creates in-app notifications idempotently with event_id deduplication.
 * 7. Privacy-safe: stores only minimal event-derived references without raw private content.
 */
export class NotificationEventHandler implements IEventDispatcher {
  private readonly prismaClient: PrismaClient | undefined;
  private readonly notificationRepo: INotificationRepository;
  private readonly logger: Logger | undefined;

  constructor(options?: NotificationEventHandlerOptions) {
    this.prismaClient = options?.prisma;
    this.notificationRepo = options?.notificationRepo || notificationRepository;
    this.logger = options?.logger;
  }

  private get prisma(): PrismaClient {
    return this.prismaClient || getPrismaClient();
  }

  async dispatch(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const eventType = event.eventType ?? (event as any).event_type;

    try {
      if (eventType === 'message.created.v1') {
        return await this.handleMessageCreated(event);
      }

      if (eventType === 'project.created.v1') {
        return await this.handleProjectCreated(event);
      }

      if (eventType === 'project.deliverable.submitted.v1') {
        return await this.handleDeliverableSubmitted(event);
      }

      if (eventType === 'project.deliverable.approved.v1') {
        return await this.handleDeliverableApproved(event);
      }

      if (eventType === 'project.deliverable.revision_requested.v1') {
        return await this.handleDeliverableRevisionRequested(event);
      }

      if (eventType === 'escrow.released.v1') {
        return await this.handleEscrowReleased(event);
      }

      if (eventType === 'dispute.opened.v1') {
        return await this.handleDisputeOpened(event);
      }

      if (eventType === 'dispute.status_updated.v1') {
        return await this.handleDisputeStatusUpdated(event);
      }

      if (eventType === 'dispute.resolved.v1') {
        return await this.handleDisputeResolved(event);
      }

      if (eventType === 'cancellation.requested.v1') {
        return await this.handleCancellationRequested(event);
      }

      if (eventType === 'cancellation.decided.v1') {
        return await this.handleCancellationDecided(event);
      }

      if (eventType === 'review.created.v1') {
        return await this.handleReviewCreated(event);
      }

      if (eventType === 'review.reported.v1') {
        return await this.handleReviewReported(event);
      }

      if (eventType === 'review.moderated.v1') {
        return await this.handleReviewModerated(event);
      }

      if (eventType === 'invitation.created.v1') {
        return await this.handleInvitationCreated(event);
      }

      if (eventType === 'invitation.accepted.v1') {
        return await this.handleInvitationAccepted(event);
      }

      if (eventType === 'invitation.declined.v1') {
        return await this.handleInvitationDeclined(event);
      }

      if (eventType === 'invitation.withdrawn.v1') {
        return await this.handleInvitationWithdrawn(event);
      }

      // Safely ignore unrecognized event types
      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger?.warn(
        {
          eventId: event.id,
          error: errorMessage,
        },
        'Transient failure processing notification event, will retry',
      );

      return {
        success: false,
        error: errorMessage,
        isTransient: true,
      };
    }
  }

  private async handleMessageCreated(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    if (!Value.Check(MessageCreatedV1PayloadSchema, event.payload)) {
      const errors = Array.from(Value.Errors(MessageCreatedV1PayloadSchema, event.payload));
      const errorDetail = errors.map((e) => `${e.path}: ${e.message}`).join(', ');
      return {
        success: false,
        error: `Invalid message.created.v1 payload schema: ${errorDetail}`,
        isTransient: false,
      };
    }

    const payload = event.payload as MessageCreatedV1Payload;

    const participants = await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId: payload.conversationId,
        leftAt: null,
      },
      select: {
        userId: true,
      },
    });

    const recipientIds = participants
      .map((p) => p.userId)
      .filter((userId) => userId !== payload.senderId);

    for (const recipientId of recipientIds) {
      const eligible = await this.isRecipientEligible(recipientId, payload.senderId);
      if (!eligible) continue;

      const isEnabled = await this.notificationRepo.isChannelEnabled(
        recipientId,
        'MESSAGE_RECEIVED',
        'IN_APP',
      );
      if (!isEnabled) continue;

      await this.notificationRepo.createNotification({
        userId: recipientId,
        eventId: event.id,
        type: 'MESSAGE_RECEIVED',
        title: 'New Message',
        body: 'You received a new message.',
        data: {
          conversationId: payload.conversationId,
          messageId: payload.messageId,
          senderId: payload.senderId,
        },
      });
    }

    return { success: true };
  }

  private async handleProjectCreated(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.talentId || !payload?.clientId) return { success: true };

    const eligible = await this.isRecipientEligible(payload.talentId, payload.clientId);
    if (!eligible) return { success: true };

    const isEnabled = await this.notificationRepo.isChannelEnabled(
      payload.talentId,
      'PROJECT_CREATED',
      'IN_APP',
    );
    if (!isEnabled) return { success: true };

    await this.notificationRepo.createNotification({
      userId: payload.talentId,
      eventId: event.id,
      type: 'PROJECT_CREATED',
      title: 'Project Contract Initialized',
      body: 'A new project contract has been created for your accepted application.',
      data: {
        projectId: payload.projectId,
        assignmentId: payload.assignmentId,
        totalAmount: payload.totalAmount,
      },
    });

    return { success: true };
  }

  private async handleDeliverableSubmitted(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.clientId || !payload?.talentId) return { success: true };

    const eligible = await this.isRecipientEligible(payload.clientId, payload.talentId);
    if (!eligible) return { success: true };

    const isEnabled = await this.notificationRepo.isChannelEnabled(
      payload.clientId,
      'DELIVERABLE_SUBMITTED',
      'IN_APP',
    );
    if (!isEnabled) return { success: true };

    await this.notificationRepo.createNotification({
      userId: payload.clientId,
      eventId: event.id,
      type: 'DELIVERABLE_SUBMITTED',
      title: 'Deliverable Submitted',
      body: `A deliverable version ${payload.version || 1} has been submitted for review.`,
      data: {
        projectId: payload.projectId,
        deliverableId: payload.deliverableId,
        version: payload.version,
      },
    });

    return { success: true };
  }

  private async handleDeliverableApproved(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.talentId || !payload?.clientId) return { success: true };

    const eligible = await this.isRecipientEligible(payload.talentId, payload.clientId);
    if (!eligible) return { success: true };

    const isEnabled = await this.notificationRepo.isChannelEnabled(
      payload.talentId,
      'DELIVERABLE_APPROVED',
      'IN_APP',
    );
    if (!isEnabled) return { success: true };

    await this.notificationRepo.createNotification({
      userId: payload.talentId,
      eventId: event.id,
      type: 'DELIVERABLE_APPROVED',
      title: 'Deliverable Approved',
      body: payload.allApproved
        ? 'All project deliverables approved! Project completed.'
        : 'Your deliverable submission was approved.',
      data: {
        projectId: payload.projectId,
        deliverableId: payload.deliverableId,
        allApproved: payload.allApproved,
      },
    });

    return { success: true };
  }

  private async handleDeliverableRevisionRequested(
    event: ClaimedOutboxEvent,
  ): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.talentId || !payload?.clientId) return { success: true };

    const eligible = await this.isRecipientEligible(payload.talentId, payload.clientId);
    if (!eligible) return { success: true };

    const isEnabled = await this.notificationRepo.isChannelEnabled(
      payload.talentId,
      'REVISION_REQUESTED',
      'IN_APP',
    );
    if (!isEnabled) return { success: true };

    await this.notificationRepo.createNotification({
      userId: payload.talentId,
      eventId: event.id,
      type: 'REVISION_REQUESTED',
      title: 'Revision Requested',
      body: 'The client has requested revisions on your deliverable submission.',
      data: {
        projectId: payload.projectId,
        deliverableId: payload.deliverableId,
        notes: payload.notes,
      },
    });

    return { success: true };
  }

  private async handleEscrowReleased(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.talentId) return { success: true };

    const recipient = await this.prisma.user.findUnique({
      where: { id: payload.talentId },
      select: { status: true },
    });
    if (!recipient || recipient.status === 'SUSPENDED' || recipient.status === 'DEACTIVATED') {
      return { success: true };
    }

    const isEnabled = await this.notificationRepo.isChannelEnabled(
      payload.talentId,
      'ESCROW_RELEASED',
      'IN_APP',
    );
    if (!isEnabled) return { success: true };

    await this.notificationRepo.createNotification({
      userId: payload.talentId,
      eventId: event.id,
      type: 'ESCROW_RELEASED',
      title: 'Escrow Funds Released',
      body: `Milestone escrow funds of ${payload.currency || 'INR'} ${payload.releasedAmount} have been released to your payable account.`,
      data: {
        projectId: payload.projectId,
        deliverableId: payload.deliverableId,
        releasedAmount: payload.releasedAmount,
      },
    });

    return { success: true };
  }

  private async handleDisputeOpened(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.projectId || !payload?.openedById) return { success: true };

    const project = await this.prisma.project.findUnique({
      where: { id: payload.projectId },
      select: { clientId: true, talentId: true },
    });
    if (!project) return { success: true };

    const recipientId =
      payload.openedById === project.clientId ? project.talentId : project.clientId;
    const eligible = await this.isRecipientEligible(recipientId, payload.openedById);
    if (!eligible) return { success: true };

    const isEnabled = await this.notificationRepo.isChannelEnabled(
      recipientId,
      'DISPUTE_OPENED',
      'IN_APP',
    );
    if (!isEnabled) return { success: true };

    await this.notificationRepo.createNotification({
      userId: recipientId,
      eventId: event.id,
      type: 'DISPUTE_OPENED',
      title: 'Dispute Raised',
      body: 'A dispute has been raised on your project and is pending evidence submission.',
      data: {
        disputeId: payload.disputeId,
        projectId: payload.projectId,
        reason: payload.reason,
      },
    });

    return { success: true };
  }

  private async handleDisputeStatusUpdated(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.projectId || !payload?.toStatus) return { success: true };

    const project = await this.prisma.project.findUnique({
      where: { id: payload.projectId },
      select: { clientId: true, talentId: true },
    });
    if (!project) return { success: true };

    const recipientIds = [project.clientId, project.talentId].filter(
      (id) => id !== payload.actorId,
    );

    for (const recipientId of recipientIds) {
      const eligible = await this.isRecipientEligible(recipientId, payload.actorId);
      if (!eligible) continue;

      const isEnabled = await this.notificationRepo.isChannelEnabled(
        recipientId,
        'DISPUTE_STATUS_UPDATED',
        'IN_APP',
      );
      if (!isEnabled) continue;

      await this.notificationRepo.createNotification({
        userId: recipientId,
        eventId: `${event.id}_${recipientId}`,
        type: 'DISPUTE_STATUS_UPDATED',
        title: 'Dispute Status Updated',
        body: `Dispute status transitioned to ${payload.toStatus}.`,
        data: {
          disputeId: payload.disputeId,
          projectId: payload.projectId,
          fromStatus: payload.fromStatus,
          toStatus: payload.toStatus,
        },
      });
    }

    return { success: true };
  }

  private async handleDisputeResolved(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.projectId || !payload?.resolution) return { success: true };

    const project = await this.prisma.project.findUnique({
      where: { id: payload.projectId },
      select: { clientId: true, talentId: true },
    });
    if (!project) return { success: true };

    const parties = [project.clientId, project.talentId];
    for (const recipientId of parties) {
      const eligible = await this.isRecipientEligible(recipientId, payload.resolvedById);
      if (!eligible) continue;

      const isEnabled = await this.notificationRepo.isChannelEnabled(
        recipientId,
        'DISPUTE_RESOLVED',
        'IN_APP',
      );
      if (!isEnabled) continue;

      await this.notificationRepo.createNotification({
        userId: recipientId,
        eventId: `${event.id}_${recipientId}`,
        type: 'DISPUTE_RESOLVED',
        title: 'Dispute Resolved',
        body: `The dispute has been resolved: ${payload.resolution}.`,
        data: {
          disputeId: payload.disputeId,
          projectId: payload.projectId,
          resolution: payload.resolution,
          refundAmount: payload.refundAmount,
        },
      });
    }

    return { success: true };
  }

  private async handleCancellationRequested(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.projectId || !payload?.requestedById) return { success: true };

    const project = await this.prisma.project.findUnique({
      where: { id: payload.projectId },
      select: { clientId: true, talentId: true },
    });
    if (!project) return { success: true };

    const recipientId =
      payload.requestedById === project.clientId ? project.talentId : project.clientId;
    const eligible = await this.isRecipientEligible(recipientId, payload.requestedById);
    if (!eligible) return { success: true };

    const isEnabled = await this.notificationRepo.isChannelEnabled(
      recipientId,
      'CANCELLATION_REQUESTED',
      'IN_APP',
    );
    if (!isEnabled) return { success: true };

    await this.notificationRepo.createNotification({
      userId: recipientId,
      eventId: event.id,
      type: 'CANCELLATION_REQUESTED',
      title: 'Project Cancellation Requested',
      body: 'A project cancellation request has been submitted and awaits your review.',
      data: {
        cancellationId: payload.cancellationId,
        projectId: payload.projectId,
        reason: payload.reason,
      },
    });

    return { success: true };
  }

  private async handleCancellationDecided(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.projectId || !payload?.decidedById) return { success: true };

    const project = await this.prisma.project.findUnique({
      where: { id: payload.projectId },
      select: { clientId: true, talentId: true },
    });
    if (!project) return { success: true };

    const recipientId =
      payload.decidedById === project.clientId ? project.talentId : project.clientId;
    const eligible = await this.isRecipientEligible(recipientId, payload.decidedById);
    if (!eligible) return { success: true };

    const isEnabled = await this.notificationRepo.isChannelEnabled(
      recipientId,
      'CANCELLATION_RESOLVED',
      'IN_APP',
    );
    if (!isEnabled) return { success: true };

    const actionText =
      payload.action === 'APPROVE'
        ? 'approved'
        : payload.action === 'REJECT'
          ? 'rejected'
          : 'withdrawn';

    await this.notificationRepo.createNotification({
      userId: recipientId,
      eventId: event.id,
      type: 'CANCELLATION_RESOLVED',
      title: 'Cancellation Request Updated',
      body: `The project cancellation request was ${actionText}.`,
      data: {
        cancellationId: payload.cancellationId,
        projectId: payload.projectId,
        action: payload.action,
      },
    });

    return { success: true };
  }

  private async handleReviewCreated(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.reviewId || !payload?.revieweeId || !payload?.reviewerId)
      return { success: true };

    const recipientId = payload.revieweeId;
    const eligible = await this.isRecipientEligible(recipientId, payload.reviewerId);
    if (!eligible) return { success: true };

    const isEnabled = await this.notificationRepo.isChannelEnabled(
      recipientId,
      'REVIEW_RECEIVED',
      'IN_APP',
    );
    if (!isEnabled) return { success: true };

    const ratingText = payload.rating ? `${payload.rating}-star ` : '';
    await this.notificationRepo.createNotification({
      userId: recipientId,
      eventId: event.id,
      type: 'REVIEW_RECEIVED',
      title: 'New Review Received',
      body: `You received a ${ratingText}review for project completion.`,
      data: {
        reviewId: payload.reviewId,
        projectId: payload.projectId,
        rating: payload.rating,
      },
    });

    return { success: true };
  }

  private async handleReviewReported(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.reportId || !payload?.reviewId || !payload?.reporterId) return { success: true };

    const admins = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        userRoles: {
          some: {
            role: {
              name: 'ADMIN',
            },
          },
        },
      },
      select: { id: true },
    });

    for (const admin of admins) {
      if (admin.id === payload.reporterId) continue;
      const isEnabled = await this.notificationRepo.isChannelEnabled(
        admin.id,
        'REVIEW_REPORTED',
        'IN_APP',
      );
      if (!isEnabled) continue;

      await this.notificationRepo.createNotification({
        userId: admin.id,
        eventId: event.id,
        type: 'REVIEW_REPORTED',
        title: 'Review Reported',
        body: `A review has been reported (${payload.reason ?? 'policy violation'}) and added to the moderation queue.`,
        data: {
          reportId: payload.reportId,
          reviewId: payload.reviewId,
          reason: payload.reason,
        },
      });
    }

    return { success: true };
  }

  private async handleReviewModerated(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.reviewId || !payload?.toStatus) return { success: true };

    const review = await this.prisma.review.findUnique({
      where: { id: payload.reviewId },
      select: { reviewerId: true, revieweeId: true },
    });
    if (!review) return { success: true };

    const recipientId = review.reviewerId;
    const eligible = await this.isRecipientEligible(recipientId, payload.moderatorId);
    if (!eligible) return { success: true };

    const isEnabled = await this.notificationRepo.isChannelEnabled(
      recipientId,
      'REVIEW_MODERATED',
      'IN_APP',
    );
    if (!isEnabled) return { success: true };

    const statusText =
      payload.toStatus === 'PUBLISHED'
        ? 'restored to published'
        : payload.toStatus === 'HIDDEN'
          ? 'temporarily hidden'
          : payload.toStatus === 'REMOVED'
            ? 'removed for policy violation'
            : String(payload.toStatus).toLowerCase();

    await this.notificationRepo.createNotification({
      userId: recipientId,
      eventId: event.id,
      type: 'REVIEW_MODERATED',
      title: 'Review Moderation Update',
      body: `Your review has been ${statusText}. Reason: ${payload.reason || 'Platform moderation decision'}.`,
      data: {
        reviewId: payload.reviewId,
        actionType: payload.actionType,
        toStatus: payload.toStatus,
      },
    });

    return { success: true };
  }

  private async isRecipientEligible(recipientId: string, senderId?: string): Promise<boolean> {
    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { status: true },
    });

    if (!recipient || recipient.status === 'SUSPENDED' || recipient.status === 'DEACTIVATED') {
      return false;
    }

    if (senderId && senderId !== recipientId) {
      const isBlocked = await this.prisma.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: recipientId, blockedId: senderId },
            { blockerId: senderId, blockedId: recipientId },
          ],
        },
      });

      if (isBlocked) {
        return false;
      }
    }

    return true;
  }

  private async handleInvitationCreated(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.inviteeId) return { success: true };

    const recipient = await this.prisma.user.findUnique({
      where: { id: payload.inviteeId },
      select: { status: true },
    });
    if (!recipient || recipient.status !== 'ACTIVE') return { success: true };

    const isEnabled = await this.notificationRepo.isChannelEnabled(
      payload.inviteeId,
      'INVITATION_RECEIVED',
      'IN_APP',
    );
    if (!isEnabled) return { success: true };

    await this.notificationRepo.createNotification({
      userId: payload.inviteeId,
      eventId: event.id,
      type: 'INVITATION_RECEIVED',
      title: 'Project Collaboration Invitation',
      body: 'You received a collaboration invitation for a project.',
      data: {
        invitationId: payload.invitationId,
        projectId: payload.projectId,
      },
    });

    return { success: true };
  }

  private async handleInvitationAccepted(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.invitationId) return { success: true };

    const invitation = await (this.prisma as any).projectInvitation.findUnique({
      where: { id: payload.invitationId },
      include: {
        inviter: { select: { status: true } },
        project: { select: { title: true } },
      },
    });
    if (!invitation || invitation.inviter.status !== 'ACTIVE') return { success: true };

    const isEnabled = await this.notificationRepo.isChannelEnabled(
      invitation.inviterId,
      'INVITATION_ACCEPTED',
      'IN_APP',
    );
    if (!isEnabled) return { success: true };

    await this.notificationRepo.createNotification({
      userId: invitation.inviterId,
      eventId: event.id,
      type: 'INVITATION_ACCEPTED',
      title: 'Invitation Accepted',
      body: `Your invitation for "${invitation.project.title}" has been accepted.`,
      data: {
        invitationId: invitation.id,
        projectId: invitation.projectId,
      },
    });

    return { success: true };
  }

  private async handleInvitationDeclined(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.invitationId) return { success: true };

    const invitation = await (this.prisma as any).projectInvitation.findUnique({
      where: { id: payload.invitationId },
      include: {
        inviter: { select: { status: true } },
        project: { select: { title: true } },
      },
    });
    if (!invitation || invitation.inviter.status !== 'ACTIVE') return { success: true };

    const isEnabled = await this.notificationRepo.isChannelEnabled(
      invitation.inviterId,
      'INVITATION_DECLINED',
      'IN_APP',
    );
    if (!isEnabled) return { success: true };

    await this.notificationRepo.createNotification({
      userId: invitation.inviterId,
      eventId: event.id,
      type: 'INVITATION_DECLINED',
      title: 'Invitation Declined',
      body: `Your invitation for "${invitation.project.title}" was declined.`,
      data: {
        invitationId: invitation.id,
        projectId: invitation.projectId,
      },
    });

    return { success: true };
  }

  private async handleInvitationWithdrawn(event: ClaimedOutboxEvent): Promise<DispatchResult> {
    const payload = event.payload as any;
    if (!payload?.invitationId) return { success: true };

    const invitation = await (this.prisma as any).projectInvitation.findUnique({
      where: { id: payload.invitationId },
      include: {
        invitee: { select: { status: true } },
        project: { select: { title: true } },
      },
    });
    if (!invitation || invitation.invitee.status !== 'ACTIVE') return { success: true };

    const isEnabled = await this.notificationRepo.isChannelEnabled(
      invitation.inviteeId,
      'INVITATION_WITHDRAWN',
      'IN_APP',
    );
    if (!isEnabled) return { success: true };

    await this.notificationRepo.createNotification({
      userId: invitation.inviteeId,
      eventId: event.id,
      type: 'INVITATION_WITHDRAWN',
      title: 'Invitation Withdrawn',
      body: `The invitation for "${invitation.project.title}" has been withdrawn by the client.`,
      data: {
        invitationId: invitation.id,
        projectId: invitation.projectId,
      },
    });

    return { success: true };
  }
}
