import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotificationsService } from './notifications.service.js';
import { NotificationNotFoundError } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';

describe('NotificationsService Unit Tests', () => {
  let fakeRepo: any;
  let service: NotificationsService;
  const userId = generateUuidV7();
  const notificationId = generateUuidV7();

  beforeEach(() => {
    fakeRepo = {
      listNotifications: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      getPreferences: vi.fn(),
      updatePreferences: vi.fn(),
    };
    service = new NotificationsService(fakeRepo);
  });

  it('delegates listNotifications to repository with user scoping', async () => {
    const mockResult = {
      items: [],
      nextCursor: null,
      hasMore: false,
      unreadCount: 0,
    };
    fakeRepo.listNotifications.mockResolvedValue(mockResult);

    const query = { limit: 15, unreadOnly: true };
    const result = await service.listNotifications(userId, query);

    expect(fakeRepo.listNotifications).toHaveBeenCalledWith({
      userId,
      cursor: undefined,
      limit: 15,
      unreadOnly: true,
    });
    expect(result).toBe(mockResult);
  });

  it('marks single notification as read if found', async () => {
    const mockItem = {
      id: notificationId,
      userId,
      readAt: new Date().toISOString(),
    };
    fakeRepo.markAsRead.mockResolvedValue(mockItem);

    const result = await service.markAsRead(userId, notificationId);
    expect(fakeRepo.markAsRead).toHaveBeenCalledWith(notificationId, userId);
    expect(result).toBe(mockItem);
  });

  it('throws NotificationNotFoundError if notification is not found or not owned by user', async () => {
    fakeRepo.markAsRead.mockResolvedValue(null);

    await expect(service.markAsRead(userId, notificationId)).rejects.toThrow(
      NotificationNotFoundError,
    );
  });

  it('marks all unread notifications as read and returns count', async () => {
    fakeRepo.markAllAsRead.mockResolvedValue(5);

    const result = await service.markAllAsRead(userId);
    expect(fakeRepo.markAllAsRead).toHaveBeenCalledWith(userId);
    expect(result).toEqual({ success: true, count: 5 });
  });

  it('retrieves user preferences', async () => {
    const mockPrefs = [
      { id: generateUuidV7(), userId, type: 'MESSAGE_RECEIVED', channel: 'IN_APP', enabled: true },
    ];
    fakeRepo.getPreferences.mockResolvedValue(mockPrefs);

    const result = await service.getPreferences(userId);
    expect(fakeRepo.getPreferences).toHaveBeenCalledWith(userId);
    expect(result).toEqual({ items: mockPrefs });
  });

  it('updates user preferences', async () => {
    const updates = {
      preferences: [
        { type: 'MESSAGE_RECEIVED' as const, channel: 'IN_APP' as const, enabled: false },
      ],
    };
    const mockUpdatedPrefs = [
      { id: generateUuidV7(), userId, type: 'MESSAGE_RECEIVED', channel: 'IN_APP', enabled: false },
    ];
    fakeRepo.updatePreferences.mockResolvedValue(mockUpdatedPrefs);

    const result = await service.updatePreferences(userId, updates);
    expect(fakeRepo.updatePreferences).toHaveBeenCalledWith(userId, updates.preferences);
    expect(result).toEqual({ items: mockUpdatedPrefs });
  });
});
