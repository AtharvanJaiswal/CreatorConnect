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

    it('accepts ISO string representations of createdAt interchangeably with Date instances', () => {
      const isoStr = '2026-10-10T11:20:30.123Z';
      const id = '01a12457-6ff8-7179-9351-c7dc03349a16';

      const encodedFromStr = encodeNotificationCursor(isoStr, id);
      const encodedFromDate = encodeNotificationCursor(new Date(isoStr), id);
      expect(encodedFromStr).toBe(encodedFromDate);

      const decoded = decodeNotificationCursor(encodedFromStr);
      expect(decoded?.createdAt.toISOString()).toBe(isoStr);
      expect(decoded?.id).toBe(id);
    });

    it('enforces strict RFC 4648 Base64URL character set without +, /, or = padding', () => {
      const testCases = [
        { date: new Date('2026-01-01T00:00:00.000Z'), id: '00000000-0000-1000-8000-000000000000' },
        { date: new Date('2026-12-31T23:59:59.999Z'), id: 'ffffffff-ffff-4fff-bfff-ffffffffffff' },
        { date: new Date('2026-07-15T12:34:56.789Z'), id: '018f4a3e-72c0-7111-9234-56789abcdef0' },
      ];

      for (const { date, id } of testCases) {
        const encoded = encodeNotificationCursor(date, id);
        // Base64URL must never contain +, /, or =
        expect(encoded).not.toContain('+');
        expect(encoded).not.toContain('/');
        expect(encoded).not.toContain('=');
        // Must contain only URL-safe characters [A-Za-z0-9_-]
        expect(/^[A-Za-z0-9_-]+$/.test(encoded)).toBe(true);

        const decoded = decodeNotificationCursor(encoded);
        expect(decoded).not.toBeNull();
        expect(decoded?.createdAt.toISOString()).toBe(date.toISOString());
        expect(decoded?.id).toBe(id);
      }
    });

    it('accepts legacy standard Base64 cursors with padding and + / for backward compatibility', () => {
      const date = new Date('2026-10-10T11:20:30.123Z');
      const id = '01a12457-6ff8-7179-9351-c7dc03349a16';
      const payload = JSON.stringify({ c: date.toISOString(), i: id });
      const standardB64 = Buffer.from(payload, 'utf-8').toString('base64');

      const decoded = decodeNotificationCursor(standardB64);
      expect(decoded).not.toBeNull();
      expect(decoded?.createdAt.toISOString()).toBe(date.toISOString());
      expect(decoded?.id).toBe(id);
    });

    it('returns null for tampered, malformed, or oversized cursors', () => {
      expect(decodeNotificationCursor('')).toBeNull();
      expect(decodeNotificationCursor('not-valid-base64-json!')).toBeNull();
      expect(decodeNotificationCursor('invalid@char#in$cursor')).toBeNull();
      expect(decodeNotificationCursor('cursor with spaces')).toBeNull();
      expect(decodeNotificationCursor('cursor\nwith\nnewlines')).toBeNull();
      expect(decodeNotificationCursor(Buffer.from('{}').toString('base64'))).toBeNull();
      expect(
        decodeNotificationCursor(
          Buffer.from(JSON.stringify({ c: 'invalid-date', i: 'not-uuid' })).toString('base64'),
        ),
      ).toBeNull();
      expect(
        decodeNotificationCursor(
          Buffer.from(JSON.stringify({ c: '2026-10-10T11:20:30.123Z', i: 12345 })).toString(
            'base64url',
          ),
        ),
      ).toBeNull();
      expect(
        decodeNotificationCursor(
          Buffer.from(
            JSON.stringify({ c: 123456789, i: '01a12457-6ff8-7179-9351-c7dc03349a16' }),
          ).toString('base64url'),
        ),
      ).toBeNull();
      expect(
        decodeNotificationCursor(
          Buffer.from(
            JSON.stringify({ missingFields: true, id: '01a12457-6ff8-7179-9351-c7dc03349a16' }),
          ).toString('base64url'),
        ),
      ).toBeNull();

      // Oversized cursor (> 512 chars) rejected immediately
      const oversized = 'a'.repeat(513);
      expect(decodeNotificationCursor(oversized)).toBeNull();

      // Exactly 512 valid characters but invalid payload handled safely
      const exactly512 = 'a'.repeat(512);
      expect(decodeNotificationCursor(exactly512)).toBeNull();
    });

    it('defends against adversarial ReDoS payloads and resource exhaustion attempts', () => {
      // Repetitive equals signs / padding sequences that previously triggered polynomial regex backtracking
      const repeatingPadding =
        'eyJjIjoiMjAyNi0xMC0xMFQxMToyMDozMC4xMjNaIiwiaSI6IjAxYTEyNDU3LTZmZjgtNzE3OS05MzUxLWM3ZGMwMzM0OWExNiJ9' +
        '='.repeat(100);
      expect(decodeNotificationCursor(repeatingPadding)).toBeNull();

      // Adversarial string exceeding maximum length by orders of magnitude rejected in O(1)
      const massiveInput = 'A'.repeat(50000);
      expect(decodeNotificationCursor(massiveInput)).toBeNull();

      // Malformed Base64 containing adversarial null bytes and non-ASCII bytes
      expect(decodeNotificationCursor('eyJjIjoi\x00\x00\x00')).toBeNull();
      expect(decodeNotificationCursor('eyJjIjoi\uFFFF\uD800')).toBeNull();
    });

    it('throws when encoding invalid inputs', () => {
      expect(() =>
        encodeNotificationCursor(new Date('invalid'), '01a12457-6ff8-7179-9351-c7dc03349a16'),
      ).toThrow();
      expect(() => encodeNotificationCursor(new Date(), '')).toThrow();
      expect(() => encodeNotificationCursor(new Date(), null as any)).toThrow();
      expect(() => encodeNotificationCursor(new Date(), 12345 as any)).toThrow();
    });
  });
});
