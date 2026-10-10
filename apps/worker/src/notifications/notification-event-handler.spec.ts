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
});
