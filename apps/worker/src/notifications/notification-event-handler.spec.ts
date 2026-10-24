import { describe, expect, it, beforeEach } from 'vitest';
import { NotificationEventHandler } from './notification-event-handler.js';
import type { INotificationRepository, ClaimedOutboxEvent } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';

class FakeNotificationRepository implements INotificationRepository {
  public notifications: any[] = [];
  public preferences: Map<string, boolean> = new Map();

  async createNotification(params: any): Promise<any> {
    // Enforce idempotency: unique on (userId, eventId)
    const existing = this.notifications.find(
      (n) => n.userId === params.userId && n.eventId === params.eventId,
    );
    if (existing) {
      return existing;
    }
    const created = {
      id: generateUuidV7(),
      ...params,
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    this.notifications.push(created);
    return created;
  }

  async listNotifications(): Promise<any> {
    return { items: this.notifications, nextCursor: null, hasMore: false, unreadCount: 0 };
  }
  async markAsRead(): Promise<any> {
    return null;
  }
  async markAllAsRead(): Promise<number> {
    return 0;
  }
  async getUnreadCount(): Promise<number> {
    return 0;
  }
  async getPreferences(): Promise<any[]> {
    return [];
  }
  async updatePreferences(): Promise<any[]> {
    return [];
  }
  async isChannelEnabled(userId: string, type: string, channel: string): Promise<boolean> {
    const key = `${userId}:${type}:${channel}`;
    return this.preferences.get(key) ?? true;
  }
}

describe('NotificationEventHandler Unit Tests', () => {
  let fakeRepo: FakeNotificationRepository;
  let fakePrisma: any;
  let handler: NotificationEventHandler;

  const senderId = generateUuidV7();
  const recipientId = generateUuidV7();
  const conversationId = generateUuidV7();
  const messageId = generateUuidV7();
  const eventId = generateUuidV7();

  beforeEach(() => {
    fakeRepo = new FakeNotificationRepository();
    fakePrisma = {
      conversationParticipant: {
        findMany: async () => [{ userId: senderId }, { userId: recipientId }],
      },
      user: {
        findUnique: async () => ({ status: 'ACTIVE' }),
      },
      userBlock: {
        findFirst: async () => null,
      },
    };

    handler = new NotificationEventHandler({
      prisma: fakePrisma as any,
      notificationRepo: fakeRepo,
    });
  });

  const createEvent = (
    payloadOverrides: any = {},
    eventOverrides: any = {},
  ): ClaimedOutboxEvent => ({
    id: eventId,
    eventType: 'message.created.v1',
    aggregateType: 'Message',
    aggregateId: messageId,
    payload: {
      messageId,
      conversationId,
      senderId,
      sequence: '1',
      clientMessageId: 'client-msg-1',
      content: 'Hello, this is a test message.',
      attachmentCount: 0,
      createdAt: new Date().toISOString(),
      ...payloadOverrides,
    },
    attempts: 1,
    createdAt: new Date(),
    claimToken: { eventId, attempt: 1 },
    ...eventOverrides,
  });

  it('creates in-app notification for the message recipient', async () => {
    const event = createEvent();
    const result = await handler.dispatch(event);

    expect(result.success).toBe(true);
    expect(fakeRepo.notifications).toHaveLength(1);

    const notification = fakeRepo.notifications[0];
    expect(notification.userId).toBe(recipientId);
    expect(notification.eventId).toBe(eventId);
    expect(notification.type).toBe('MESSAGE_RECEIVED');
    expect(notification.title).toBe('New Message');
    // Privacy safe: does not store sensitive raw message body
    expect(notification.data.conversationId).toBe(conversationId);
    expect(notification.data.messageId).toBe(messageId);
    expect(notification.data.senderId).toBe(senderId);
  });

  it('excludes the message sender from notification creation', async () => {
    // Conversation where sender is the only participant (e.g. self-notes or empty)
    fakePrisma.conversationParticipant.findMany = async () => [{ userId: senderId }];

    const event = createEvent();
    const result = await handler.dispatch(event);

    expect(result.success).toBe(true);
    expect(fakeRepo.notifications).toHaveLength(0);
  });

  it('suppresses notification if recipient account is suspended', async () => {
    fakePrisma.user.findUnique = async () => ({ status: 'SUSPENDED' });

    const event = createEvent();
    const result = await handler.dispatch(event);

    expect(result.success).toBe(true);
    expect(fakeRepo.notifications).toHaveLength(0);
  });

  it('suppresses notification if peer is blocked under moderation policy', async () => {
    fakePrisma.userBlock.findFirst = async () => ({
      id: generateUuidV7(),
      blockerId: recipientId,
      blockedId: senderId,
    });

    const event = createEvent();
    const result = await handler.dispatch(event);

    expect(result.success).toBe(true);
    expect(fakeRepo.notifications).toHaveLength(0);
  });

  it('suppresses notification if recipient disabled in-app preference for message receipt', async () => {
    fakeRepo.preferences.set(`${recipientId}:MESSAGE_RECEIVED:IN_APP`, false);

    const event = createEvent();
    const result = await handler.dispatch(event);

    expect(result.success).toBe(true);
    expect(fakeRepo.notifications).toHaveLength(0);
  });

  it('is idempotent when the same event is dispatched multiple times', async () => {
    const event = createEvent();
    await handler.dispatch(event);
    expect(fakeRepo.notifications).toHaveLength(1);

    // Second dispatch with same event
    const secondResult = await handler.dispatch(event);
    expect(secondResult.success).toBe(true);
    expect(fakeRepo.notifications).toHaveLength(1); // No duplicate notification
  });

  it('fails terminally if event payload is invalid', async () => {
    const invalidEvent = createEvent({ messageId: 'not-a-uuid' });
    const result = await handler.dispatch(invalidEvent);

    expect(result.success).toBe(false);
    expect(result.isTransient).toBe(false);
    expect(result.error).toContain('Invalid message.created.v1 payload schema');
  });

  it('safely ignores unrelated event types', async () => {
    const unrelatedEvent = createEvent({}, { eventType: 'user.created.v1' });
    const result = await handler.dispatch(unrelatedEvent);

    expect(result.success).toBe(true);
    expect(fakeRepo.notifications).toHaveLength(0);
  });

  it('creates in-app notification when dispute is opened', async () => {
    const clientId = generateUuidV7();
    const talentId = generateUuidV7();
    const projectId = generateUuidV7();
    const disputeId = generateUuidV7();

    fakePrisma.project = {
      findUnique: async () => ({ clientId, talentId }),
    };

    const event: ClaimedOutboxEvent = {
      id: generateUuidV7(),
      eventType: 'dispute.opened.v1',
      aggregateType: 'Dispute',
      aggregateId: disputeId,
      payload: {
        disputeId,
        projectId,
        openedById: clientId,
        reason: 'Work not delivered according to specifications',
        openedAt: new Date().toISOString(),
      },
      attempts: 1,
      createdAt: new Date(),
      claimToken: { eventId: generateUuidV7(), attempt: 1 },
    };

    const result = await handler.dispatch(event);

    expect(result.success).toBe(true);
    expect(fakeRepo.notifications).toHaveLength(1);
    const notification = fakeRepo.notifications[0];
    expect(notification.userId).toBe(talentId); // Recipient is the counterparty
    expect(notification.type).toBe('DISPUTE_OPENED');
    expect(notification.title).toBe('Dispute Raised');
  });

  it('creates notifications for both parties when dispute is resolved', async () => {
    const clientId = generateUuidV7();
    const talentId = generateUuidV7();
    const projectId = generateUuidV7();
    const disputeId = generateUuidV7();
    const adminId = generateUuidV7();

    fakePrisma.project = {
      findUnique: async () => ({ clientId, talentId }),
    };

    const event: ClaimedOutboxEvent = {
      id: generateUuidV7(),
      eventType: 'dispute.resolved.v1',
      aggregateType: 'Dispute',
      aggregateId: disputeId,
      payload: {
        disputeId,
        projectId,
        resolution: 'RESOLVED_FOR_CLIENT',
        resolvedById: adminId,
        resolutionReason: 'Milestone criteria were not met.',
        refundAmount: 5000,
        resolvedAt: new Date().toISOString(),
      },
      attempts: 1,
      createdAt: new Date(),
      claimToken: { eventId: generateUuidV7(), attempt: 1 },
    };

    const result = await handler.dispatch(event);

    expect(result.success).toBe(true);
    expect(fakeRepo.notifications).toHaveLength(2);
    expect(fakeRepo.notifications.map((n) => n.userId)).toContain(clientId);
    expect(fakeRepo.notifications.map((n) => n.userId)).toContain(talentId);
    expect(fakeRepo.notifications[0].type).toBe('DISPUTE_RESOLVED');
  });

  it('creates in-app notification when cancellation is requested', async () => {
    const clientId = generateUuidV7();
    const talentId = generateUuidV7();
    const projectId = generateUuidV7();
    const cancellationId = generateUuidV7();

    fakePrisma.project = {
      findUnique: async () => ({ clientId, talentId }),
    };

    const event: ClaimedOutboxEvent = {
      id: generateUuidV7(),
      eventType: 'cancellation.requested.v1',
      aggregateType: 'ProjectCancellation',
      aggregateId: cancellationId,
      payload: {
        cancellationId,
        projectId,
        requestedById: talentId,
        reason: 'Unable to continue due to scope mismatch.',
        requestedAt: new Date().toISOString(),
      },
      attempts: 1,
      createdAt: new Date(),
      claimToken: { eventId: generateUuidV7(), attempt: 1 },
    };

    const result = await handler.dispatch(event);

    expect(result.success).toBe(true);
    expect(fakeRepo.notifications).toHaveLength(1);
    const notification = fakeRepo.notifications[0];
    expect(notification.userId).toBe(clientId); // Recipient is client
    expect(notification.type).toBe('CANCELLATION_REQUESTED');
  });

  it('creates in-app notification when review is created', async () => {
    const reviewerId = generateUuidV7();
    const revieweeId = generateUuidV7();
    const projectId = generateUuidV7();
    const reviewId = generateUuidV7();

    const event: ClaimedOutboxEvent = {
      id: generateUuidV7(),
      eventType: 'review.created.v1',
      aggregateType: 'Review',
      aggregateId: reviewId,
      payload: {
        reviewId,
        projectId,
        reviewerId,
        revieweeId,
        rating: 5,
      },
      attempts: 1,
      createdAt: new Date(),
      claimToken: { eventId: generateUuidV7(), attempt: 1 },
    };

    const result = await handler.dispatch(event);

    expect(result.success).toBe(true);
    expect(fakeRepo.notifications).toHaveLength(1);
    const notification = fakeRepo.notifications[0];
    expect(notification.userId).toBe(revieweeId);
    expect(notification.type).toBe('REVIEW_RECEIVED');
    expect(notification.title).toBe('New Review Received');
    expect(notification.body).toContain('5-star');

    // Duplicate delivery of the exact same event
    const retryResult = await handler.dispatch(event);
    expect(retryResult.success).toBe(true);
    // Verified: No duplicate notification inserted
    expect(fakeRepo.notifications).toHaveLength(1);
  });

  it('notifies admins when a review is reported', async () => {
    const reporterId = generateUuidV7();
    const adminId1 = generateUuidV7();
    const adminId2 = generateUuidV7();
    const reviewId = generateUuidV7();
    const reportId = generateUuidV7();

    fakePrisma.user.findMany = async () => [{ id: adminId1 }, { id: adminId2 }];

    const event: ClaimedOutboxEvent = {
      id: generateUuidV7(),
      eventType: 'review.reported.v1',
      aggregateType: 'ReviewReport',
      aggregateId: reportId,
      payload: {
        reportId,
        reviewId,
        reporterId,
        reason: 'SPAM',
      },
      attempts: 1,
      createdAt: new Date(),
      claimToken: { eventId: generateUuidV7(), attempt: 1 },
    };

    const result = await handler.dispatch(event);

    expect(result.success).toBe(true);
    expect(fakeRepo.notifications).toHaveLength(2);
    expect(fakeRepo.notifications.map((n) => n.userId)).toContain(adminId1);
    expect(fakeRepo.notifications.map((n) => n.userId)).toContain(adminId2);
    expect(fakeRepo.notifications[0].type).toBe('REVIEW_REPORTED');
  });

  it('notifies review author when moderation decision is recorded', async () => {
    const authorId = generateUuidV7();
    const revieweeId = generateUuidV7();
    const moderatorId = generateUuidV7();
    const reviewId = generateUuidV7();

    fakePrisma.review = {
      findUnique: async () => ({ reviewerId: authorId, revieweeId }),
    };

    const event: ClaimedOutboxEvent = {
      id: generateUuidV7(),
      eventType: 'review.moderated.v1',
      aggregateType: 'Review',
      aggregateId: reviewId,
      payload: {
        reviewId,
        moderatorId,
        actionType: 'HIDE',
        fromStatus: 'PUBLISHED',
        toStatus: 'HIDDEN',
        reason: 'Violated platform policy.',
      },
      attempts: 1,
      createdAt: new Date(),
      claimToken: { eventId: generateUuidV7(), attempt: 1 },
    };

    const result = await handler.dispatch(event);

    expect(result.success).toBe(true);
    expect(fakeRepo.notifications).toHaveLength(1);
    const notification = fakeRepo.notifications[0];
    expect(notification.userId).toBe(authorId);
    expect(notification.type).toBe('REVIEW_MODERATED');
    expect(notification.body).toContain('temporarily hidden');
  });
});
