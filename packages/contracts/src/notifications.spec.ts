import { describe, it, expect } from 'vitest';
import { Value } from '@creatorconnect/validation';
import {
  NotificationChannelSchema,
  NotificationTypeSchema,
  NotificationItemSchema,
  ListNotificationsQuerySchema,
  ListNotificationsResponseSchema,
  UpdateNotificationPreferencesInputSchema,
  encodeNotificationCursor,
  decodeNotificationCursor,
} from './notifications.js';

describe('Notification Contracts & Validation', () => {
  it('validates supported notification channels and types', () => {
    expect(Value.Check(NotificationChannelSchema, 'IN_APP')).toBe(true);
    expect(Value.Check(NotificationChannelSchema, 'PUSH')).toBe(true);
    expect(Value.Check(NotificationChannelSchema, 'EMAIL')).toBe(true);
    expect(Value.Check(NotificationChannelSchema, 'SMS')).toBe(false);

    expect(Value.Check(NotificationTypeSchema, 'MESSAGE_RECEIVED')).toBe(true);
    expect(Value.Check(NotificationTypeSchema, 'APPLICATION_ACCEPTED')).toBe(true);
    expect(Value.Check(NotificationTypeSchema, 'HYPOTHETICAL_EVENT')).toBe(false);
  });

  it('validates a well-formed NotificationItem', () => {
    const validItem = {
      id: '01a12457-6ff8-7179-9351-c7dc03349a16',
      userId: '01a12457-6ff8-7179-9351-c7dc03349a17',
      eventId: '01a12457-6ff8-7179-9351-c7dc03349a18',
      type: 'MESSAGE_RECEIVED',
      title: 'New Message',
      body: 'You received a new message from Alice.',
      data: { conversationId: '01a12457-6ff8-7179-9351-c7dc03349a19' },
      readAt: null,
      createdAt: '2026-10-10T11:00:00.000Z',
    };

    expect(Value.Check(NotificationItemSchema, validItem)).toBe(true);
  });

  it('rejects invalid notification items missing required fields', () => {
    const invalidItem = {
      id: 'not-a-uuid',
      userId: '01a12457-6ff8-7179-9351-c7dc03349a17',
      type: 'MESSAGE_RECEIVED',
      title: '',
    };

    expect(Value.Check(NotificationItemSchema, invalidItem)).toBe(false);
  });

  it('validates query pagination bounds', () => {
    expect(Value.Check(ListNotificationsQuerySchema, { limit: 20, unreadOnly: true })).toBe(true);
    expect(Value.Check(ListNotificationsQuerySchema, { limit: 0 })).toBe(false); // below minimum 1
    expect(Value.Check(ListNotificationsQuerySchema, { limit: 100 })).toBe(false); // above maximum 50
  });

  it('validates preferences update input allowlisting', () => {
    const validInput = {
      preferences: [
        {
          type: 'MESSAGE_RECEIVED',
          channel: 'IN_APP',
          enabled: false,
        },
      ],
    };
    expect(Value.Check(UpdateNotificationPreferencesInputSchema, validInput)).toBe(true);

    const invalidInput = {
      preferences: [
        {
          type: 'INVALID_TYPE',
          channel: 'IN_APP',
          enabled: true,
        },
      ],
    };
    expect(Value.Check(UpdateNotificationPreferencesInputSchema, invalidInput)).toBe(false);
  });

  describe('Keyset Cursor Encoding and Decoding', () => {
    it('correctly round-trips a valid (createdAt, id) cursor', () => {
      const now = new Date('2026-10-10T11:20:30.123Z');
      const id = '01a12457-6ff8-7179-9351-c7dc03349a16';

      const encoded = encodeNotificationCursor(now, id);
      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);

      const decoded = decodeNotificationCursor(encoded);
      expect(decoded).not.toBeNull();
      expect(decoded?.createdAt.toISOString()).toBe(now.toISOString());
      expect(decoded?.id).toBe(id);
    });

    it('returns null for tampered, malformed, or oversized cursors', () => {
      expect(decodeNotificationCursor('')).toBeNull();
      expect(decodeNotificationCursor('not-valid-base64-json!')).toBeNull();
      expect(decodeNotificationCursor(Buffer.from('{}').toString('base64'))).toBeNull();
      expect(
        decodeNotificationCursor(
          Buffer.from(JSON.stringify({ c: 'invalid-date', i: 'not-uuid' })).toString('base64'),
        ),
      ).toBeNull();

      // Oversized cursor (> 512 chars)
      const oversized = 'a'.repeat(513);
      expect(decodeNotificationCursor(oversized)).toBeNull();
    });

    it('throws when encoding invalid inputs', () => {
      expect(() =>
        encodeNotificationCursor(new Date('invalid'), '01a12457-6ff8-7179-9351-c7dc03349a16'),
      ).toThrow();
      expect(() => encodeNotificationCursor(new Date(), '')).toThrow();
    });
  });
});
