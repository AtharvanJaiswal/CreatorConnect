import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  getPrismaClient,
  type PrismaClient,
  NotificationRepository,
  InvalidNotificationCursorError,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';

describe('NotificationRepository PostgreSQL Integration Tests', () => {
  let prisma: PrismaClient;
  let repo: NotificationRepository;

  let userA: { id: string; email: string };
  let userB: { id: string; email: string };

  beforeAll(async () => {
    prisma = getPrismaClient();
    repo = new NotificationRepository(prisma);

    const ts = Date.now();
    userA = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_notif_a_${ts}`,
        email: `notif_a_${ts}@test.com`,
        firstName: 'Alice',
        lastName: 'Notif',
        status: 'ACTIVE',
      },
    });

    userB = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_notif_b_${ts}`,
        email: `notif_b_${ts}@test.com`,
        firstName: 'Bob',
        lastName: 'Notif',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    if (userA) {
      await prisma.notification.deleteMany({ where: { userId: userA.id } });
      await prisma.notificationPreference.deleteMany({ where: { userId: userA.id } });
      await prisma.user.deleteMany({ where: { id: userA.id } });
    }
    if (userB) {
      await prisma.notification.deleteMany({ where: { userId: userB.id } });
      await prisma.notificationPreference.deleteMany({ where: { userId: userB.id } });
      await prisma.user.deleteMany({ where: { id: userB.id } });
    }
  });

  describe('Notification Creation & Deduplication Invariant', () => {
    it('creates an in-app notification with eventId', async () => {
      const eventId = generateUuidV7();
      const notif = await repo.createNotification({
        userId: userA.id,
        eventId,
        type: 'MESSAGE_RECEIVED',
        title: 'New Message',
        body: 'You received a new message.',
        data: { conversationId: generateUuidV7() },
      });

      expect(notif.id).toBeDefined();
      expect(notif.userId).toBe(userA.id);
      expect(notif.eventId).toBe(eventId);
      expect(notif.type).toBe('MESSAGE_RECEIVED');
      expect(notif.readAt).toBeNull();
    });

    it('enforces database idempotency invariant on (userId, eventId) without creating duplicates', async () => {
      const eventId = generateUuidV7();
      const first = await repo.createNotification({
        userId: userA.id,
        eventId,
        type: 'MESSAGE_RECEIVED',
        title: 'New Message',
        body: 'First delivery attempt',
      });

      // Second attempt with same eventId and userId (simulating worker retry or race)
      const second = await repo.createNotification({
        userId: userA.id,
        eventId,
        type: 'MESSAGE_RECEIVED',
        title: 'New Message',
        body: 'Second delivery attempt',
      });

      expect(second.id).toBe(first.id);

      // Verify exact count in DB is 1
      const count = await prisma.notification.count({
        where: { userId: userA.id, eventId },
      });
      expect(count).toBe(1);
    });
  });

  describe('Keyset Cursor Pagination & User Isolation', () => {
    it('paginates deterministically using (createdAt, id) keyset cursor and enforces user isolation', async () => {
      // Clean user notifications
      await prisma.notification.deleteMany({ where: { userId: userA.id } });
      await prisma.notification.deleteMany({ where: { userId: userB.id } });

      // Create 3 notifications for User A with slight delay for distinct timestamps
      const notifA1 = await repo.createNotification({
        userId: userA.id,
        type: 'MESSAGE_RECEIVED',
        title: 'Message 1',
        body: 'Body 1',
      });
      const notifA2 = await repo.createNotification({
        userId: userA.id,
        type: 'MESSAGE_RECEIVED',
        title: 'Message 2',
        body: 'Body 2',
      });
      const notifA3 = await repo.createNotification({
        userId: userA.id,
        type: 'APPLICATION_ACCEPTED',
        title: 'Offer Accepted',
        body: 'Body 3',
      });

      // Create notification for User B (must not appear in User A's list)
      await repo.createNotification({
        userId: userB.id,
        type: 'MESSAGE_RECEIVED',
        title: 'User B Message',
        body: 'Private for B',
      });

      // Fetch page 1 (limit 2)
      const page1 = await repo.listNotifications({
        userId: userA.id,
        limit: 2,
      });

      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).not.toBeNull();
      expect(page1.unreadCount).toBe(3);

      // User B notification must not leak into User A's query
      expect(page1.items.every((item) => item.userId === userA.id)).toBe(true);

      // Fetch page 2 using cursor from page 1
      const page2 = await repo.listNotifications({
        userId: userA.id,
        limit: 2,
        cursor: page1.nextCursor!,
      });

      expect(page2.items).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
      expect(page2.nextCursor).toBeNull();

      // Ensure no duplicates across pages
      const page1Ids = page1.items.map((i) => i.id);
      const page2Ids = page2.items.map((i) => i.id);
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id);
      }
    });

    it('rejects invalid or tampered pagination cursors', async () => {
      await expect(
        repo.listNotifications({
          userId: userA.id,
          cursor: 'invalid-base64-garbage!',
        }),
      ).rejects.toThrow(InvalidNotificationCursorError);
    });

    it('supports unreadOnly filtering', async () => {
      await prisma.notification.deleteMany({ where: { userId: userA.id } });

      const n1 = await repo.createNotification({
        userId: userA.id,
        type: 'MESSAGE_RECEIVED',
        title: 'Unread 1',
        body: 'body',
      });
      const n2 = await repo.createNotification({
        userId: userA.id,
        type: 'MESSAGE_RECEIVED',
        title: 'Read 1',
        body: 'body',
      });

      await repo.markAsRead(n2.id, userA.id);

      const unreadOnlyResult = await repo.listNotifications({
        userId: userA.id,
        unreadOnly: true,
      });

      expect(unreadOnlyResult.items).toHaveLength(1);
      expect(unreadOnlyResult.items[0]?.id).toBe(n1.id);
      expect(unreadOnlyResult.unreadCount).toBe(1);
    });
  });

  describe('Read State Operations & Anti-Enumeration', () => {
    it('marks a single notification as read and is idempotent', async () => {
      const notif = await repo.createNotification({
        userId: userA.id,
        type: 'MESSAGE_RECEIVED',
        title: 'To Read',
        body: 'body',
      });
      expect(notif.readAt).toBeNull();

      const marked = await repo.markAsRead(notif.id, userA.id);
      expect(marked).not.toBeNull();
      expect(marked?.readAt).not.toBeNull();

      // Repeated read operation is idempotent
      const secondMark = await repo.markAsRead(notif.id, userA.id);
      expect(secondMark?.readAt).toBe(marked?.readAt);
    });

    it('returns null and does not mark read when accessed by another user', async () => {
      const notifB = await repo.createNotification({
        userId: userB.id,
        type: 'MESSAGE_RECEIVED',
        title: 'B Notification',
        body: 'body',
      });

      // User A attempts to mark User B's notification
      const result = await repo.markAsRead(notifB.id, userA.id);
      expect(result).toBeNull();

      // Verify User B's notification remains unread
      const fresh = await prisma.notification.findUnique({ where: { id: notifB.id } });
      expect(fresh?.readAt).toBeNull();
    });

    it('marks all unread notifications as read atomically', async () => {
      await prisma.notification.deleteMany({ where: { userId: userA.id } });
      await prisma.notification.deleteMany({ where: { userId: userB.id } });

      await repo.createNotification({
        userId: userA.id,
        type: 'MESSAGE_RECEIVED',
        title: 'A1',
        body: 'b',
      });
      await repo.createNotification({
        userId: userA.id,
        type: 'MESSAGE_RECEIVED',
        title: 'A2',
        body: 'b',
      });
      await repo.createNotification({
        userId: userB.id,
        type: 'MESSAGE_RECEIVED',
        title: 'B1',
        body: 'b',
      });

      const updatedCount = await repo.markAllAsRead(userA.id);
      expect(updatedCount).toBe(2);

      expect(await repo.getUnreadCount(userA.id)).toBe(0);
      // User B remains untouched
      expect(await repo.getUnreadCount(userB.id)).toBe(1);
    });
  });

  describe('Notification Preferences Operations', () => {
    it('retrieves and updates user channel preferences', async () => {
      // Default enabled check
      const defaultEnabled = await repo.isChannelEnabled(userA.id, 'MESSAGE_RECEIVED', 'IN_APP');
      expect(defaultEnabled).toBe(true);

      // Disable in-app message notifications
      const updated = await repo.updatePreferences(userA.id, [
        { type: 'MESSAGE_RECEIVED', channel: 'IN_APP', enabled: false },
        { type: 'APPLICATION_ACCEPTED', channel: 'EMAIL', enabled: true },
      ]);

      expect(updated).toHaveLength(2);
      const msgPref = updated.find((p) => p.type === 'MESSAGE_RECEIVED' && p.channel === 'IN_APP');
      expect(msgPref?.enabled).toBe(false);

      // Check isChannelEnabled reflects updated value
      const nowEnabled = await repo.isChannelEnabled(userA.id, 'MESSAGE_RECEIVED', 'IN_APP');
      expect(nowEnabled).toBe(false);
    });
  });
});
