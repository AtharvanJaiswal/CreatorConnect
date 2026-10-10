import {
  notificationRepository,
  type INotificationRepository,
  NotificationNotFoundError,
} from '@creatorconnect/database';
import type {
  ListNotificationsQuery,
  ListNotificationsResponse,
  NotificationItem,
  MarkAllNotificationsReadResponse,
  ListNotificationPreferencesResponse,
  UpdateNotificationPreferencesInput,
  UpdateNotificationPreferencesResponse,
} from '@creatorconnect/contracts';

export class NotificationsService {
  private readonly notificationRepo: INotificationRepository;

  constructor(repo?: INotificationRepository) {
    this.notificationRepo = repo || notificationRepository;
  }

  /**
   * Retrieves paginated notifications for the authenticated user.
   */
  public async listNotifications(
    userId: string,
    query: ListNotificationsQuery,
  ): Promise<ListNotificationsResponse> {
    return await this.notificationRepo.listNotifications({
      userId,
      cursor: query.cursor,
      limit: query.limit,
      unreadOnly: query.unreadOnly,
    });
  }

  /**
   * Marks a single notification owned by the user as read.
   * Throws NotificationNotFoundError if the notification does not exist or belongs to another user.
   */
  public async markAsRead(userId: string, notificationId: string): Promise<NotificationItem> {
    const updated = await this.notificationRepo.markAsRead(notificationId, userId);
    if (!updated) {
      throw new NotificationNotFoundError();
    }
    return updated;
  }

  /**
   * Marks all unread notifications for the user as read.
   */
  public async markAllAsRead(userId: string): Promise<MarkAllNotificationsReadResponse> {
    const count = await this.notificationRepo.markAllAsRead(userId);
    return {
      success: true,
      count,
    };
  }

  /**
   * Lists the user's notification channel preferences.
   */
  public async getPreferences(userId: string): Promise<ListNotificationPreferencesResponse> {
    const items = await this.notificationRepo.getPreferences(userId);
    return { items };
  }

  /**
   * Updates the user's notification channel preferences.
   */
  public async updatePreferences(
    userId: string,
    input: UpdateNotificationPreferencesInput,
  ): Promise<UpdateNotificationPreferencesResponse> {
    const items = await this.notificationRepo.updatePreferences(userId, input.preferences);
    return { items };
  }
}

export const notificationsService = new NotificationsService();
