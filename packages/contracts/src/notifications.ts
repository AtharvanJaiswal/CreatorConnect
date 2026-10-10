import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema, IsoDateTimeSchema } from '@creatorconnect/validation';

// ==============================================================================
// Enums & Literal Schemas
// ==============================================================================

export const NotificationChannelSchema = Type.Union([
  Type.Literal('IN_APP'),
  Type.Literal('PUSH'),
  Type.Literal('EMAIL'),
]);
export type NotificationChannel = Static<typeof NotificationChannelSchema>;

export const NotificationTypeSchema = Type.Union([
  Type.Literal('MESSAGE_RECEIVED'),
  Type.Literal('APPLICATION_ACCEPTED'),
  Type.Literal('APPLICATION_REJECTED'),
  Type.Literal('ASSIGNMENT_OFFER'),
  Type.Literal('SYSTEM_ANNOUNCEMENT'),
]);
export type NotificationType = Static<typeof NotificationTypeSchema>;

// ==============================================================================
// Notification Cursor Helpers
// ==============================================================================

export const NotificationCursorSchema = Type.String({
  minLength: 1,
  maxLength: 512,
  description:
    'Opaque base64url cursor encoding (createdAt, id) for deterministic keyset pagination',
});
export type NotificationCursor = Static<typeof NotificationCursorSchema>;

export interface DecodedNotificationCursor {
  createdAt: Date;
  id: string;
}

/**
 * Encodes a composite (createdAt, id) tuple into an opaque base64url string.
 * Uses native Node.js base64url encoding to ensure bounded O(n) execution without regexes.
 */
export function encodeNotificationCursor(createdAt: Date | string, id: string): string {
  const dateObj = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date for notification cursor encoding: ${createdAt}`);
  }
  if (!id || typeof id !== 'string') {
    throw new Error(`Invalid id for notification cursor encoding: ${id}`);
  }

  const payload = JSON.stringify({
    c: dateObj.toISOString(),
    i: id,
  });

  return Buffer.from(payload, 'utf-8').toString('base64url');
}

/**
 * Decodes and deterministically validates an opaque base64url notification cursor.
 * Returns null for malformed, oversized, or unparseable input.
 * Bounded by maximum input length (512 chars) with linear O(n) character validation.
 */
export function decodeNotificationCursor(cursor: string): DecodedNotificationCursor | null {
  if (!cursor || typeof cursor !== 'string' || cursor.length > 512) {
    return null;
  }

  try {
    // Linear O(n) character validation: accept base64url ([A-Za-z0-9_-]) and optional standard base64 ([+/=])
    for (let i = 0; i < cursor.length; i++) {
      const code = cursor.charCodeAt(i);
      if (!(
        (code >= 65 && code <= 90) || // A-Z
        (code >= 97 && code <= 122) || // a-z
        (code >= 48 && code <= 57) || // 0-9
        code === 45 || // -
        code === 95 || // _
        code === 43 || // +
        code === 47 || // /
        code === 61 // =
      )) {
        return null;
      }
    }

    // RFC 4648 padding invariant: '=' is only permitted at the end, maximum 2 padding characters
    const firstEquals = cursor.indexOf('=');
    if (firstEquals !== -1) {
      if (firstEquals < cursor.length - 2) {
        return null;
      }
      if (cursor.slice(firstEquals) !== '='.repeat(cursor.length - firstEquals)) {
        return null;
      }
    }

    const jsonStr =
      cursor.includes('+') || cursor.includes('/') || cursor.includes('=')
        ? Buffer.from(cursor, 'base64').toString('utf-8')
        : Buffer.from(cursor, 'base64url').toString('utf-8');

    const parsed = JSON.parse(jsonStr);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if (typeof parsed.c !== 'string' || typeof parsed.i !== 'string') {
      return null;
    }

    const date = new Date(parsed.c);
    if (isNaN(date.getTime())) {
      return null;
    }

    // Validate UUID format for cursor id
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(parsed.i)) {
      return null;
    }

    return {
      createdAt: date,
      id: parsed.i,
    };
  } catch {
    return null;
  }
}

// ==============================================================================
// DTO Schemas
// ==============================================================================

export const NotificationItemSchema = Type.Object({
  id: UuidSchema,
  userId: UuidSchema,
  eventId: Type.Optional(Type.Union([UuidSchema, Type.Null()])),
  type: NotificationTypeSchema,
  title: Type.String({ minLength: 1, maxLength: 150 }),
  body: Type.String(),
  data: Type.Optional(Type.Union([Type.Record(Type.String(), Type.Unknown()), Type.Null()])),
  readAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  createdAt: IsoDateTimeSchema,
});
export type NotificationItem = Static<typeof NotificationItemSchema>;

export const ListNotificationsQuerySchema = Type.Object({
  cursor: Type.Optional(NotificationCursorSchema),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
  unreadOnly: Type.Optional(Type.Boolean({ default: false })),
});
export type ListNotificationsQuery = Static<typeof ListNotificationsQuerySchema>;

export const ListNotificationsResponseSchema = Type.Object({
  items: Type.Array(NotificationItemSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  hasMore: Type.Boolean(),
  unreadCount: Type.Integer({ minimum: 0 }),
});
export type ListNotificationsResponse = Static<typeof ListNotificationsResponseSchema>;

export const MarkNotificationReadParamsSchema = Type.Object({
  id: UuidSchema,
});
export type MarkNotificationReadParams = Static<typeof MarkNotificationReadParamsSchema>;

export const MarkAllNotificationsReadResponseSchema = Type.Object({
  success: Type.Boolean(),
  count: Type.Integer({ minimum: 0 }),
});
export type MarkAllNotificationsReadResponse = Static<
  typeof MarkAllNotificationsReadResponseSchema
>;

export const NotificationPreferenceItemSchema = Type.Object({
  id: UuidSchema,
  userId: UuidSchema,
  type: NotificationTypeSchema,
  channel: NotificationChannelSchema,
  enabled: Type.Boolean(),
});
export type NotificationPreferenceItem = Static<typeof NotificationPreferenceItemSchema>;

export const ListNotificationPreferencesResponseSchema = Type.Object({
  items: Type.Array(NotificationPreferenceItemSchema),
});
export type ListNotificationPreferencesResponse = Static<
  typeof ListNotificationPreferencesResponseSchema
>;

export const UpdateNotificationPreferenceItemSchema = Type.Object({
  type: NotificationTypeSchema,
  channel: NotificationChannelSchema,
  enabled: Type.Boolean(),
});
export type UpdateNotificationPreferenceItem = Static<
  typeof UpdateNotificationPreferenceItemSchema
>;

export const UpdateNotificationPreferencesInputSchema = Type.Object({
  preferences: Type.Array(UpdateNotificationPreferenceItemSchema, { minItems: 1, maxItems: 20 }),
});
export type UpdateNotificationPreferencesInput = Static<
  typeof UpdateNotificationPreferencesInputSchema
>;

export const UpdateNotificationPreferencesResponseSchema = Type.Object({
  items: Type.Array(NotificationPreferenceItemSchema),
});
export type UpdateNotificationPreferencesResponse = Static<
  typeof UpdateNotificationPreferencesResponseSchema
>;

// ==============================================================================
// Error Codes & Constants
// ==============================================================================

export const NotificationErrorCode = {
  NOTIFICATION_NOT_FOUND: 'NOTIFICATION_NOT_FOUND',
  INVALID_NOTIFICATION_CURSOR: 'INVALID_NOTIFICATION_CURSOR',
  NOTIFICATION_ACCESS_DENIED: 'NOTIFICATION_ACCESS_DENIED',
  INVALID_NOTIFICATION_PREFERENCE: 'INVALID_NOTIFICATION_PREFERENCE',
} as const;
export type NotificationErrorCode =
  (typeof NotificationErrorCode)[keyof typeof NotificationErrorCode];
