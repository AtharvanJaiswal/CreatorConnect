import { PrismaClient, Prisma } from '@prisma/client';
import { getPrismaClient } from './index.js';
import { generateUuidV7 } from '@creatorconnect/utils';
import {
  type NotificationType,
  type NotificationChannel,
  type NotificationItem,
  type NotificationPreferenceItem,
  type UpdateNotificationPreferenceItem,
  encodeNotificationCursor,
  decodeNotificationCursor,
} from '@creatorconnect/contracts';
import { InvalidNotificationCursorError } from './errors.js';

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown> | null | undefined;
  eventId?: string | null | undefined;
}

export interface ListNotificationsParams {
  userId: string;
  limit?: number | undefined;
  cursor?: string | undefined;
  unreadOnly?: boolean | undefined;
}

export interface ListNotificationsResult {
  items: NotificationItem[];
  nextCursor: string | null;
  hasMore: boolean;
  unreadCount: number;
}

export interface INotificationRepository {
  createNotification(params: CreateNotificationParams): Promise<NotificationItem>;
  listNotifications(params: ListNotificationsParams): Promise<ListNotificationsResult>;
  markAsRead(notificationId: string, userId: string): Promise<NotificationItem | null>;
  markAllAsRead(userId: string): Promise<number>;
  getUnreadCount(userId: string): Promise<number>;
  getPreferences(userId: string): Promise<NotificationPreferenceItem[]>;
  updatePreferences(
    userId: string,
    updates: UpdateNotificationPreferenceItem[],
  ): Promise<NotificationPreferenceItem[]>;
  isChannelEnabled(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
  ): Promise<boolean>;
}

export class NotificationRepository implements INotificationRepository {
  private prismaClient: PrismaClient | undefined;

  constructor(prismaClient?: PrismaClient) {
    this.prismaClient = prismaClient;
  }

  private get prisma(): PrismaClient {
    return this.prismaClient || getPrismaClient();
  }

  /**
   * Idempotently creates an in-app notification.
   * If eventId is provided, the unique constraint (user_id, event_id) guarantees
   * that concurrent workers or retries cannot insert duplicate notifications.
   */
  public async createNotification(params: CreateNotificationParams): Promise<NotificationItem> {
    const { userId, type, title, body, data, eventId } = params;
    const notificationId = generateUuidV7();

    try {
      const created = await this.prisma.notification.create({
        data: {
          id: notificationId,
          userId,
          eventId: eventId ?? null,
          type: type as any,
          title,
          body,
          data: (data as any) ?? Prisma.JsonNull,
        },
      });

      return this.formatNotification(created);
    } catch (err: unknown) {
      // If unique constraint on (user_id, event_id) is violated, return existing notification
      if (eventId && err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await this.prisma.notification.findUnique({
          where: {
            userId_eventId: {
              userId,
              eventId,
            },
          },
        });
        if (existing) {
          return this.formatNotification(existing);
        }
      }
      throw err;
    }
  }

  /**
   * Lists notifications for the authenticated user using deterministic keyset pagination
   * on composite key (created_at DESC, id DESC).
   */
  public async listNotifications(
    params: ListNotificationsParams,
  ): Promise<ListNotificationsResult> {
    const { userId, unreadOnly } = params;
    const limit = Math.min(Math.max(params.limit || 20, 1), 50);

    let cursorFilter: { createdAt: Date; id: string } | null = null;
    if (params.cursor) {
      cursorFilter = decodeNotificationCursor(params.cursor);
      if (!cursorFilter) {
        throw new InvalidNotificationCursorError();
      }
    }

    // Build raw SQL query for exact composite keyset tuple comparison:
    // (created_at, id) < (cursorCreatedAt, cursorId)
    // with index scan on notifications_user_id_created_at_id_idx
    let rows: Array<{
      id: string;
      user_id: string;
      event_id: string | null;
      type: string;
      title: string;
      body: string;
      data: unknown;
      read_at: Date | null;
      created_at: Date;
    }>;

    const fetchLimit = limit + 1;

    if (cursorFilter) {
      if (unreadOnly) {
        rows = await this.prisma.$queryRaw`
          SELECT id, user_id, event_id, type, title, body, data, read_at, created_at
          FROM notifications
          WHERE user_id = ${userId}::uuid
            AND read_at IS NULL
            AND (created_at < ${cursorFilter.createdAt} OR (created_at = ${cursorFilter.createdAt} AND id < ${cursorFilter.id}::uuid))
          ORDER BY created_at DESC, id DESC
          LIMIT ${fetchLimit}
        `;
      } else {
        rows = await this.prisma.$queryRaw`
          SELECT id, user_id, event_id, type, title, body, data, read_at, created_at
          FROM notifications
          WHERE user_id = ${userId}::uuid
            AND (created_at < ${cursorFilter.createdAt} OR (created_at = ${cursorFilter.createdAt} AND id < ${cursorFilter.id}::uuid))
          ORDER BY created_at DESC, id DESC
          LIMIT ${fetchLimit}
        `;
      }
    } else {
      if (unreadOnly) {
        rows = await this.prisma.$queryRaw`
          SELECT id, user_id, event_id, type, title, body, data, read_at, created_at
          FROM notifications
          WHERE user_id = ${userId}::uuid
            AND read_at IS NULL
          ORDER BY created_at DESC, id DESC
          LIMIT ${fetchLimit}
        `;
      } else {
        rows = await this.prisma.$queryRaw`
          SELECT id, user_id, event_id, type, title, body, data, read_at, created_at
          FROM notifications
          WHERE user_id = ${userId}::uuid
          ORDER BY created_at DESC, id DESC
          LIMIT ${fetchLimit}
        `;
      }
    }

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((row) => ({
      id: row.id,
      userId: row.user_id,
      eventId: row.event_id,
      type: row.type as NotificationType,
      title: row.title,
      body: row.body,
      data: (row.data as Record<string, unknown>) ?? null,
      readAt: row.read_at ? row.read_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
    }));

    const lastItem = items[items.length - 1];
    const nextCursor =
      hasMore && lastItem !== undefined
        ? encodeNotificationCursor(lastItem.createdAt, lastItem.id)
        : null;

    const unreadCount = await this.getUnreadCount(userId);

    return {
      items,
      nextCursor,
      hasMore,
      unreadCount,
    };
  }

  /**
   * Idempotently marks a single notification as read, ensuring ownership validation.
   * If notification does not belong to user or does not exist, returns null to avoid enumeration.
   */
  public async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationItem | null> {
    const existing = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!existing || existing.userId !== userId) {
      return null;
    }

    if (existing.readAt !== null) {
      return this.formatNotification(existing);
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    return this.formatNotification(updated);
  }

  /**
   * Marks all unread notifications for a user as read in a single atomic update.
   */
  public async markAllAsRead(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return result.count;
  }

  /**
   * Returns count of unread notifications for a user using fast index scan.
   */
  public async getUnreadCount(userId: string): Promise<number> {
    return await this.prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });
  }

  /**
   * Lists all preferences for a user.
   */
  public async getPreferences(userId: string): Promise<NotificationPreferenceItem[]> {
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId },
      orderBy: [{ type: 'asc' }, { channel: 'asc' }],
    });

    return preferences.map((p) => ({
      id: p.id,
      userId: p.userId,
      type: p.type as NotificationType,
      channel: p.channel as NotificationChannel,
      enabled: p.enabled,
    }));
  }

  /**
   * Atomically upserts user preferences.
   */
  public async updatePreferences(
    userId: string,
    updates: UpdateNotificationPreferenceItem[],
  ): Promise<NotificationPreferenceItem[]> {
    return await this.prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.notificationPreference.upsert({
          where: {
            userId_type_channel: {
              userId,
              type: update.type as any,
              channel: update.channel as any,
            },
          },
          create: {
            id: generateUuidV7(),
            userId,
            type: update.type as any,
            channel: update.channel as any,
            enabled: update.enabled,
          },
          update: {
            enabled: update.enabled,
          },
        });
      }

      const allPrefs = await tx.notificationPreference.findMany({
        where: { userId },
        orderBy: [{ type: 'asc' }, { channel: 'asc' }],
      });

      return allPrefs.map((p) => ({
        id: p.id,
        userId: p.userId,
        type: p.type as NotificationType,
        channel: p.channel as NotificationChannel,
        enabled: p.enabled,
      }));
    });
  }

  /**
   * Checks whether a specific notification type and channel are enabled for a user.
   * Defaults to true if no preference record exists (opt-out model).
   */
  public async isChannelEnabled(
    userId: string,
    type: NotificationType,
    channel: NotificationChannel,
  ): Promise<boolean> {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_type_channel: {
          userId,
          type: type as any,
          channel: channel as any,
        },
      },
    });

    if (!pref) {
      return true; // Default enabled
    }

    return pref.enabled;
  }

  private formatNotification(n: {
    id: string;
    userId: string;
    eventId: string | null;
    type: string;
    title: string;
    body: string;
    data: unknown;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationItem {
    return {
      id: n.id,
      userId: n.userId,
      eventId: n.eventId,
      type: n.type as NotificationType,
      title: n.title,
      body: n.body,
      data: (n.data as Record<string, unknown>) ?? null,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}

export const notificationRepository = new NotificationRepository();
