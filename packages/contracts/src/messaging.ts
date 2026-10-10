import { Type, type Static } from '@sinclair/typebox';
import { UuidSchema, IsoDateTimeSchema, SequenceStringSchema } from '@creatorconnect/validation';

// ==============================================================================
// Enums & Literal Schemas
// ==============================================================================

export const ConversationTypeSchema = Type.Union([Type.Literal('DIRECT'), Type.Literal('GROUP')]);
export type ConversationType = Static<typeof ConversationTypeSchema>;

export const ParticipantRoleSchema = Type.Union([Type.Literal('MEMBER'), Type.Literal('ADMIN')]);
export type ParticipantRole = Static<typeof ParticipantRoleSchema>;

export const MessageStatusSchema = Type.Union([
  Type.Literal('SENT'),
  Type.Literal('EDITED'),
  Type.Literal('DELETED'),
]);
export type MessageStatus = Static<typeof MessageStatusSchema>;

export const ReportCategorySchema = Type.Union([
  Type.Literal('SPAM'),
  Type.Literal('HARASSMENT'),
  Type.Literal('ABUSE'),
  Type.Literal('SCAM'),
  Type.Literal('INAPPROPRIATE_CONTENT'),
  Type.Literal('MALICIOUS_FILE'),
  Type.Literal('OTHER'),
]);
export type ReportCategory = Static<typeof ReportCategorySchema>;

export const ReportStatusSchema = Type.Union([
  Type.Literal('PENDING'),
  Type.Literal('INVESTIGATING'),
  Type.Literal('RESOLVED'),
  Type.Literal('DISMISSED'),
]);
export type ReportStatus = Static<typeof ReportStatusSchema>;

export const ReportTargetTypeSchema = Type.Union([
  Type.Literal('USER'),
  Type.Literal('MESSAGE'),
  Type.Literal('ASSIGNMENT'),
]);
export type ReportTargetType = Static<typeof ReportTargetTypeSchema>;

// ==============================================================================
// Sequence & Keyset Cursor Utilities
// ==============================================================================

export { SequenceStringSchema };

export const MessageCursorSchema = Type.String({
  minLength: 1,
  maxLength: 512,
  description: 'Opaque base64/base64url cursor pointer for keyset pagination',
});
export type MessageCursor = Static<typeof MessageCursorSchema>;

export interface DecodedMessageCursor {
  sequence: string;
}

/**
 * Encodes a monotonic message sequence into an opaque base64url cursor string.
 */
export function encodeMessageCursor(sequence: string | bigint | number): string {
  const seqStr = typeof sequence === 'bigint' ? sequence.toString() : String(sequence);
  if (!/^[0-9]+$/.test(seqStr) || seqStr.length > 20) {
    throw new Error(`Invalid sequence for cursor encoding: ${seqStr}`);
  }
  return Buffer.from(JSON.stringify({ s: seqStr }), 'utf-8').toString('base64url');
}

/**
 * Decodes and validates an opaque keyset pagination cursor into its monotonic sequence.
 * Returns null if the cursor is malformed, not base64, or lacks a valid sequence string.
 */
export function decodeMessageCursor(cursor: string): DecodedMessageCursor | null {
  if (!cursor || typeof cursor !== 'string' || cursor.length > 512) {
    return null;
  }
  try {
    const normalized = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const raw = Buffer.from(normalized, 'base64').toString('utf-8');

    // Attempt JSON parse { s: "..." } or { sequence: "..." } or raw number/string
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        const s = parsed.s ?? parsed.sequence;
        if (typeof s === 'string' && /^[0-9]+$/.test(s) && s.length <= 20) {
          return { sequence: s };
        }
        if (
          typeof s === 'number' &&
          Number.isInteger(s) &&
          s >= 0 &&
          s <= Number.MAX_SAFE_INTEGER
        ) {
          return { sequence: String(s) };
        }
      } else if (
        typeof parsed === 'number' &&
        Number.isInteger(parsed) &&
        parsed >= 0 &&
        parsed <= Number.MAX_SAFE_INTEGER
      ) {
        return { sequence: String(parsed) };
      } else if (typeof parsed === 'string' && /^[0-9]+$/.test(parsed) && parsed.length <= 20) {
        return { sequence: parsed };
      }
    } catch {
      // Fallback: direct decimal string encoding
      if (/^[0-9]+$/.test(raw) && raw.length <= 20) {
        return { sequence: raw };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ==============================================================================
// Direct Conversations
// ==============================================================================

export const CreateDirectConversationInputSchema = Type.Object({
  recipientId: UuidSchema,
  assignmentId: Type.Optional(UuidSchema),
  applicationId: Type.Optional(UuidSchema),
});
export type CreateDirectConversationInput = Static<typeof CreateDirectConversationInputSchema>;

export const ConversationParticipantResponseSchema = Type.Object({
  id: UuidSchema,
  conversationId: UuidSchema,
  userId: UuidSchema,
  role: ParticipantRoleSchema,
  lastReadSequence: SequenceStringSchema,
  mutedUntil: Type.Union([IsoDateTimeSchema, Type.Null()]),
  leftAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  joinedAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type ConversationParticipantResponse = Static<typeof ConversationParticipantResponseSchema>;

export const DirectConversationResponseSchema = Type.Object({
  id: UuidSchema,
  type: ConversationTypeSchema,
  title: Type.Union([Type.String({ maxLength: 150 }), Type.Null()]),
  assignmentId: Type.Union([UuidSchema, Type.Null()]),
  applicationId: Type.Union([UuidSchema, Type.Null()]),
  currentSequence: SequenceStringSchema,
  participants: Type.Array(ConversationParticipantResponseSchema),
  unreadCount: Type.Optional(Type.Integer({ minimum: 0 })),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type DirectConversationResponse = Static<typeof DirectConversationResponseSchema>;

export const ListConversationsQuerySchema = Type.Object({
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
  cursor: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
});
export type ListConversationsQuery = Static<typeof ListConversationsQuerySchema>;

export const ListConversationsResponseSchema = Type.Object({
  items: Type.Array(DirectConversationResponseSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  hasMore: Type.Boolean(),
});
export type ListConversationsResponse = Static<typeof ListConversationsResponseSchema>;

// ==============================================================================
// Messages & Attachments
// ==============================================================================

export const MessageAttachmentResponseSchema = Type.Object({
  id: UuidSchema,
  messageId: UuidSchema,
  mediaAssetId: UuidSchema,
  createdAt: IsoDateTimeSchema,
});
export type MessageAttachmentResponse = Static<typeof MessageAttachmentResponseSchema>;

export const SendMessageInputSchema = Type.Object({
  clientMessageId: UuidSchema,
  content: Type.String({ minLength: 1, maxLength: 5000 }),
  mediaAssetIds: Type.Optional(Type.Array(UuidSchema, { maxItems: 10 })),
});
export type SendMessageInput = Static<typeof SendMessageInputSchema>;

export const EditMessageInputSchema = Type.Object({
  content: Type.String({ minLength: 1, maxLength: 5000 }),
});
export type EditMessageInput = Static<typeof EditMessageInputSchema>;

export const MessageResponseSchema = Type.Object({
  id: UuidSchema,
  conversationId: UuidSchema,
  senderId: UuidSchema,
  sequence: SequenceStringSchema,
  clientMessageId: Type.String({ minLength: 1, maxLength: 64 }),
  content: Type.String(),
  status: MessageStatusSchema,
  attachments: Type.Array(MessageAttachmentResponseSchema),
  deletedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type MessageResponse = Static<typeof MessageResponseSchema>;

export const ListMessagesQuerySchema = Type.Object({
  cursor: Type.Optional(MessageCursorSchema),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
  direction: Type.Optional(
    Type.Union([Type.Literal('prev'), Type.Literal('next')], { default: 'prev' }),
  ),
});
export type ListMessagesQuery = Static<typeof ListMessagesQuerySchema>;

export const ListMessagesResponseSchema = Type.Object({
  items: Type.Array(MessageResponseSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  hasMore: Type.Boolean(),
});
export type ListMessagesResponse = Static<typeof ListMessagesResponseSchema>;

export const MarkReadInputSchema = Type.Object({
  sequence: SequenceStringSchema,
});
export type MarkReadInput = Static<typeof MarkReadInputSchema>;

export const MarkReadResponseSchema = Type.Object({
  conversationId: UuidSchema,
  lastReadSequence: SequenceStringSchema,
  updatedAt: IsoDateTimeSchema,
});
export type MarkReadResponse = Static<typeof MarkReadResponseSchema>;

// ==============================================================================
// User Blocks
// ==============================================================================

export const CreateBlockInputSchema = Type.Object({
  targetUserId: UuidSchema,
  reason: Type.Optional(Type.String({ minLength: 1, maxLength: 255 })),
});
export type CreateBlockInput = Static<typeof CreateBlockInputSchema>;

export const UserBlockResponseSchema = Type.Object({
  id: UuidSchema,
  blockerId: UuidSchema,
  blockedId: UuidSchema,
  reason: Type.Union([Type.String({ maxLength: 255 }), Type.Null()]),
  createdAt: IsoDateTimeSchema,
});
export type UserBlockResponse = Static<typeof UserBlockResponseSchema>;

export const ListBlocksQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String({ minLength: 1, maxLength: 512 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});
export type ListBlocksQuery = Static<typeof ListBlocksQuerySchema>;

export const ListBlocksResponseSchema = Type.Object({
  items: Type.Array(UserBlockResponseSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  hasMore: Type.Boolean(),
});
export type ListBlocksResponse = Static<typeof ListBlocksResponseSchema>;

// ==============================================================================
// Abuse Reports
// ==============================================================================

export const CreateReportInputSchema = Type.Object({
  targetType: ReportTargetTypeSchema,
  targetId: UuidSchema,
  category: ReportCategorySchema,
  details: Type.String({ minLength: 10, maxLength: 5000 }),
});
export type CreateReportInput = Static<typeof CreateReportInputSchema>;

export const ReportResponseSchema = Type.Object({
  id: UuidSchema,
  reporterId: UuidSchema,
  targetType: ReportTargetTypeSchema,
  targetId: UuidSchema,
  category: ReportCategorySchema,
  details: Type.String(),
  status: ReportStatusSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type ReportResponse = Static<typeof ReportResponseSchema>;

// ==============================================================================
// Message Attachments Download
// ==============================================================================

export const AttachmentDownloadParamsSchema = Type.Object({
  conversationId: UuidSchema,
  attachmentId: UuidSchema,
});
export type AttachmentDownloadParams = Static<typeof AttachmentDownloadParamsSchema>;

export const AttachmentDownloadResponseSchema = Type.Object({
  attachmentId: UuidSchema,
  mediaAssetId: UuidSchema,
  fileName: Type.String(),
  fileSize: Type.Integer(),
  mimeType: Type.String(),
  downloadUrl: Type.String(),
  expiresInSeconds: Type.Integer(),
});
export type AttachmentDownloadResponse = Static<typeof AttachmentDownloadResponseSchema>;

// ==============================================================================
// Outbox & Domain Events
// ==============================================================================

export const MessageCreatedV1PayloadSchema = Type.Object({
  messageId: UuidSchema,
  conversationId: UuidSchema,
  senderId: UuidSchema,
  sequence: SequenceStringSchema,
  clientMessageId: Type.String({ minLength: 1, maxLength: 64 }),
  content: Type.String(),
  attachmentCount: Type.Integer({ minimum: 0 }),
  createdAt: IsoDateTimeSchema,
});
export type MessageCreatedV1Payload = Static<typeof MessageCreatedV1PayloadSchema>;

export const UserBlockCreatedV1PayloadSchema = Type.Object({
  blockId: UuidSchema,
  blockerId: UuidSchema,
  blockedId: UuidSchema,
  reason: Type.Union([Type.String({ maxLength: 255 }), Type.Null()]),
  createdAt: IsoDateTimeSchema,
});
export type UserBlockCreatedV1Payload = Static<typeof UserBlockCreatedV1PayloadSchema>;

export const UserBlockRemovedV1PayloadSchema = Type.Object({
  blockerId: UuidSchema,
  blockedId: UuidSchema,
  removedAt: IsoDateTimeSchema,
});
export type UserBlockRemovedV1Payload = Static<typeof UserBlockRemovedV1PayloadSchema>;

export const OutboxStatusSchema = Type.Union([
  Type.Literal('PENDING'),
  Type.Literal('PROCESSING'),
  Type.Literal('PUBLISHED'),
  Type.Literal('FAILED'),
  Type.Literal('DEAD_LETTER'),
]);
export type OutboxStatus = Static<typeof OutboxStatusSchema>;

export const OutboxEventEnvelopeSchema = Type.Object({
  id: UuidSchema,
  eventType: Type.String(),
  aggregateType: Type.String(),
  aggregateId: UuidSchema,
  payload: Type.Record(Type.String(), Type.Unknown()),
  status: OutboxStatusSchema,
  attempts: Type.Integer({ minimum: 0 }),
  nextAttemptAt: IsoDateTimeSchema,
  lastError: Type.Union([Type.String(), Type.Null()]),
  publishedAt: Type.Union([IsoDateTimeSchema, Type.Null()]),
  createdAt: IsoDateTimeSchema,
});
export type OutboxEventEnvelope = Static<typeof OutboxEventEnvelopeSchema>;

// ==============================================================================
// Messaging Error Codes & Constants
// ==============================================================================

export const MessagingErrorCode = {
  USER_BLOCKED: 'USER_BLOCKED',
  CONVERSATION_NOT_FOUND: 'CONVERSATION_NOT_FOUND',
  NOT_CONVERSATION_PARTICIPANT: 'NOT_CONVERSATION_PARTICIPANT',
  INVALID_MESSAGE_CURSOR: 'INVALID_MESSAGE_CURSOR',
  DUPLICATE_CLIENT_MESSAGE_ID: 'DUPLICATE_CLIENT_MESSAGE_ID',
  SELF_MESSAGING_NOT_ALLOWED: 'SELF_MESSAGING_NOT_ALLOWED',
  SELF_BLOCK_NOT_ALLOWED: 'SELF_BLOCK_NOT_ALLOWED',
  SELF_REPORT_NOT_ALLOWED: 'SELF_REPORT_NOT_ALLOWED',
  MESSAGE_NOT_FOUND: 'MESSAGE_NOT_FOUND',
  MESSAGE_NOT_EDITABLE: 'MESSAGE_NOT_EDITABLE',
  MESSAGE_DELETED: 'MESSAGE_DELETED',
  ATTACHMENT_NOT_ACTIVE: 'ATTACHMENT_NOT_ACTIVE',
  ATTACHMENT_NOT_FOUND: 'ATTACHMENT_NOT_FOUND',
  MESSAGE_ATTACHMENT_LIMIT_EXCEEDED: 'MESSAGE_ATTACHMENT_LIMIT_EXCEEDED',
} as const;

export type MessagingErrorCode = (typeof MessagingErrorCode)[keyof typeof MessagingErrorCode];
