import { describe, it, expect } from 'vitest';
import { Value } from '@sinclair/typebox/value';
import {
  // Enums
  ConversationTypeSchema,
  ParticipantRoleSchema,
  MessageStatusSchema,
  ReportCategorySchema,
  ReportStatusSchema,
  ReportTargetTypeSchema,
  // Sequence & Cursor
  SequenceStringSchema,
  MessageCursorSchema,
  encodeMessageCursor,
  decodeMessageCursor,
  // Direct Conversations
  CreateDirectConversationInputSchema,
  DirectConversationResponseSchema,
  ConversationParticipantResponseSchema,
  ListConversationsQuerySchema,
  // Messages
  SendMessageInputSchema,
  EditMessageInputSchema,
  MessageResponseSchema,
  ListMessagesQuerySchema,
  MarkReadInputSchema,
  // Blocks
  CreateBlockInputSchema,
  UserBlockResponseSchema,
  ListBlocksQuerySchema,
  UserBlockCreatedV1PayloadSchema,
  UserBlockRemovedV1PayloadSchema,
  // Reports
  CreateReportInputSchema,
  ReportResponseSchema,
  // Error codes
  MessagingErrorCode,
} from './messaging.js';

const VALID_UUID = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
const ANOTHER_UUID = 'b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e';
const THIRD_UUID = 'c3d4e5f6-a1b2-4c3d-ae4f-5a6b7c8d9e0f';

describe('Phase 5 Messaging Contracts & Validation', () => {
  // --------------------------------------------------------------------------
  // 1. Monotonic Sequence Representation & Serialization-Safety
  // --------------------------------------------------------------------------
  describe('SequenceStringSchema (Decimal String Representation)', () => {
    it('accepts valid decimal sequence strings', () => {
      expect(Value.Check(SequenceStringSchema, '0')).toBe(true);
      expect(Value.Check(SequenceStringSchema, '1')).toBe(true);
      expect(Value.Check(SequenceStringSchema, '42')).toBe(true);
      expect(Value.Check(SequenceStringSchema, '1000000')).toBe(true);
      expect(Value.Check(SequenceStringSchema, '9223372036854775807')).toBe(true); // Max int64 (19 digits)
    });

    it('rejects non-decimal and malformed sequence strings', () => {
      expect(Value.Check(SequenceStringSchema, '')).toBe(false);
      expect(Value.Check(SequenceStringSchema, '-1')).toBe(false);
      expect(Value.Check(SequenceStringSchema, '1.5')).toBe(false);
      expect(Value.Check(SequenceStringSchema, 'abc')).toBe(false);
      expect(Value.Check(SequenceStringSchema, ' 123')).toBe(false);
      expect(Value.Check(SequenceStringSchema, '123 ')).toBe(false);
      expect(Value.Check(SequenceStringSchema, '123n')).toBe(false);
      expect(Value.Check(SequenceStringSchema, '123456789012345678901')).toBe(false); // 21 digits > 20 max
    });

    it('rejects raw numbers and raw BigInts to protect JSON serialization', () => {
      expect(Value.Check(SequenceStringSchema, 100)).toBe(false);
      expect(Value.Check(SequenceStringSchema, 0)).toBe(false);
      expect(Value.Check(SequenceStringSchema, 100n as any)).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Keyset Pagination Cursors
  // --------------------------------------------------------------------------
  describe('Keyset Cursor Encoding and Decoding', () => {
    it('encodes and decodes valid sequence values correctly', () => {
      const cursor = encodeMessageCursor('42');
      expect(typeof cursor).toBe('string');
      expect(cursor.length).toBeGreaterThan(0);
      expect(Value.Check(MessageCursorSchema, cursor)).toBe(true);

      const decoded = decodeMessageCursor(cursor);
      expect(decoded).not.toBeNull();
      expect(decoded?.sequence).toBe('42');
    });

    it('encodes BigInt sequence values without error', () => {
      const cursor = encodeMessageCursor(9007199254740993n);
      const decoded = decodeMessageCursor(cursor);
      expect(decoded).not.toBeNull();
      expect(decoded?.sequence).toBe('9007199254740993');
    });

    it('encodes zero sequence correctly', () => {
      const cursor = encodeMessageCursor('0');
      const decoded = decodeMessageCursor(cursor);
      expect(decoded?.sequence).toBe('0');
    });

    it('rejects encoding invalid sequence values', () => {
      expect(() => encodeMessageCursor('abc')).toThrow();
      expect(() => encodeMessageCursor('-1')).toThrow();
      expect(() => encodeMessageCursor('123456789012345678901')).toThrow();
    });

    it('returns null on malformed cursor strings', () => {
      expect(decodeMessageCursor('')).toBeNull();
      expect(decodeMessageCursor('not-valid-base64-%%%')).toBeNull();
      expect(decodeMessageCursor('   ')).toBeNull();
      expect(decodeMessageCursor('a'.repeat(600))).toBeNull(); // Exceeds 512 chars
    });

    it('returns null when cursor contains non-numeric sequence or invalid structure', () => {
      const badJsonCursor = Buffer.from(JSON.stringify({ s: 'invalid' })).toString('base64');
      expect(decodeMessageCursor(badJsonCursor)).toBeNull();

      const negativeCursor = Buffer.from(JSON.stringify({ s: '-5' })).toString('base64');
      expect(decodeMessageCursor(negativeCursor)).toBeNull();

      const emptyObjectCursor = Buffer.from(JSON.stringify({})).toString('base64');
      expect(decodeMessageCursor(emptyObjectCursor)).toBeNull();
    });

    it('accepts raw decimal string encoded as base64 as fallback', () => {
      const rawBase64 = Buffer.from('12345').toString('base64');
      const decoded = decodeMessageCursor(rawBase64);
      expect(decoded).not.toBeNull();
      expect(decoded?.sequence).toBe('12345');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Direct Conversation Contracts
  // --------------------------------------------------------------------------
  describe('Direct Conversation Schemas', () => {
    it('validates a direct conversation request without assignment or application context', () => {
      const input = {
        recipientId: VALID_UUID,
      };
      expect(Value.Check(CreateDirectConversationInputSchema, input)).toBe(true);
    });

    it('validates a direct conversation request with optional assignment and application context', () => {
      const input = {
        recipientId: VALID_UUID,
        assignmentId: ANOTHER_UUID,
        applicationId: THIRD_UUID,
      };
      expect(Value.Check(CreateDirectConversationInputSchema, input)).toBe(true);
    });

    it('rejects direct conversation request with invalid UUIDs', () => {
      expect(
        Value.Check(CreateDirectConversationInputSchema, {
          recipientId: 'not-a-uuid',
        }),
      ).toBe(false);

      expect(
        Value.Check(CreateDirectConversationInputSchema, {
          recipientId: VALID_UUID,
          assignmentId: '12345',
        }),
      ).toBe(false);
    });

    it('validates a compliant DirectConversationResponse', () => {
      const response = {
        id: VALID_UUID,
        type: 'DIRECT',
        title: null,
        assignmentId: null,
        applicationId: null,
        currentSequence: '15',
        participants: [
          {
            id: ANOTHER_UUID,
            conversationId: VALID_UUID,
            userId: THIRD_UUID,
            role: 'MEMBER',
            lastReadSequence: '10',
            mutedUntil: null,
            leftAt: null,
            joinedAt: '2026-10-01T12:00:00.000Z',
            updatedAt: '2026-10-01T12:00:00.000Z',
          },
        ],
        unreadCount: 5,
        createdAt: '2026-10-01T12:00:00.000Z',
        updatedAt: '2026-10-01T12:05:00.000Z',
      };
      expect(Value.Check(DirectConversationResponseSchema, response)).toBe(true);
    });

    it('validates ListConversationsQuerySchema pagination boundaries', () => {
      expect(Value.Check(ListConversationsQuerySchema, {})).toBe(true);
      expect(Value.Check(ListConversationsQuerySchema, { limit: 20 })).toBe(true);
      expect(Value.Check(ListConversationsQuerySchema, { limit: 50 })).toBe(true);
      expect(Value.Check(ListConversationsQuerySchema, { limit: 0 })).toBe(false);
      expect(Value.Check(ListConversationsQuerySchema, { limit: 51 })).toBe(false); // Max 50
    });
  });

  // --------------------------------------------------------------------------
  // 4. Message Contracts
  // --------------------------------------------------------------------------
  describe('Message Schemas', () => {
    it('validates SendMessageInput with boundary content length (1 and 5000 chars)', () => {
      const minMessage = {
        clientMessageId: VALID_UUID,
        content: 'A',
      };
      expect(Value.Check(SendMessageInputSchema, minMessage)).toBe(true);

      const maxMessage = {
        clientMessageId: VALID_UUID,
        content: 'x'.repeat(5000),
      };
      expect(Value.Check(SendMessageInputSchema, maxMessage)).toBe(true);
    });

    it('rejects SendMessageInput with empty content or content exceeding 5000 characters', () => {
      expect(
        Value.Check(SendMessageInputSchema, {
          clientMessageId: VALID_UUID,
          content: '',
        }),
      ).toBe(false);

      expect(
        Value.Check(SendMessageInputSchema, {
          clientMessageId: VALID_UUID,
          content: 'x'.repeat(5001),
        }),
      ).toBe(false);
    });

    it('rejects SendMessageInput with non-UUID clientMessageId', () => {
      expect(
        Value.Check(SendMessageInputSchema, {
          clientMessageId: 'not-a-uuid-string',
          content: 'Hello',
        }),
      ).toBe(false);
    });

    it('validates media attachments array boundaries (max 10 items)', () => {
      const withAttachments = {
        clientMessageId: VALID_UUID,
        content: 'Check these files',
        mediaAssetIds: Array.from({ length: 10 }, () => VALID_UUID),
      };
      expect(Value.Check(SendMessageInputSchema, withAttachments)).toBe(true);

      const exceedingAttachments = {
        clientMessageId: VALID_UUID,
        content: 'Check these files',
        mediaAssetIds: Array.from({ length: 11 }, () => VALID_UUID),
      };
      expect(Value.Check(SendMessageInputSchema, exceedingAttachments)).toBe(false);
    });

    it('validates EditMessageInput boundary constraints', () => {
      expect(Value.Check(EditMessageInputSchema, { content: 'Updated' })).toBe(true);
      expect(Value.Check(EditMessageInputSchema, { content: '' })).toBe(false);
      expect(Value.Check(EditMessageInputSchema, { content: 'a'.repeat(5001) })).toBe(false);
    });

    it('validates MessageResponseSchema with string sequence and attachments', () => {
      const response = {
        id: VALID_UUID,
        conversationId: ANOTHER_UUID,
        senderId: THIRD_UUID,
        sequence: '101',
        clientMessageId: VALID_UUID,
        content: 'Hello, CreatorConnect!',
        status: 'SENT',
        attachments: [
          {
            id: VALID_UUID,
            messageId: VALID_UUID,
            mediaAssetId: ANOTHER_UUID,
            createdAt: '2026-10-01T12:00:00.000Z',
          },
        ],
        deletedAt: null,
        createdAt: '2026-10-01T12:00:00.000Z',
        updatedAt: '2026-10-01T12:00:00.000Z',
      };
      expect(Value.Check(MessageResponseSchema, response)).toBe(true);
    });

    it('validates ListMessagesQuery boundaries', () => {
      expect(Value.Check(ListMessagesQuerySchema, { limit: 50, direction: 'prev' })).toBe(true);
      expect(Value.Check(ListMessagesQuerySchema, { limit: 100, direction: 'next' })).toBe(true);
      expect(Value.Check(ListMessagesQuerySchema, { limit: 0 })).toBe(false);
      expect(Value.Check(ListMessagesQuerySchema, { limit: 101 })).toBe(false);
      expect(Value.Check(ListMessagesQuerySchema, { direction: 'invalid' as any })).toBe(false);
    });

    it('validates MarkReadInput with valid decimal sequence string', () => {
      expect(Value.Check(MarkReadInputSchema, { sequence: '42' })).toBe(true);
      expect(Value.Check(MarkReadInputSchema, { sequence: '-1' })).toBe(false);
      expect(Value.Check(MarkReadInputSchema, { sequence: 42 as any })).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 5. User Blocks
  // --------------------------------------------------------------------------
  describe('User Block Schemas', () => {
    it('validates CreateBlockInput with optional reason', () => {
      expect(Value.Check(CreateBlockInputSchema, { targetUserId: VALID_UUID })).toBe(true);
      expect(
        Value.Check(CreateBlockInputSchema, {
          targetUserId: VALID_UUID,
          reason: 'Spam messages',
        }),
      ).toBe(true);
    });

    it('rejects CreateBlockInput with invalid UUID or reason exceeding 255 chars', () => {
      expect(Value.Check(CreateBlockInputSchema, { targetUserId: 'invalid' })).toBe(false);
      expect(
        Value.Check(CreateBlockInputSchema, {
          targetUserId: VALID_UUID,
          reason: 'x'.repeat(256),
        }),
      ).toBe(false);
    });

    it('validates UserBlockResponseSchema', () => {
      const response = {
        id: VALID_UUID,
        blockerId: ANOTHER_UUID,
        blockedId: THIRD_UUID,
        reason: 'Harassment',
        createdAt: '2026-10-01T12:00:00.000Z',
      };
      expect(Value.Check(UserBlockResponseSchema, response)).toBe(true);
    });

    it('validates ListBlocksQuerySchema boundaries', () => {
      expect(Value.Check(ListBlocksQuerySchema, { limit: 20 })).toBe(true);
      expect(Value.Check(ListBlocksQuerySchema, { limit: 101 })).toBe(false);
      expect(Value.Check(ListBlocksQuerySchema, { limit: 0 })).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Abuse Reports
  // --------------------------------------------------------------------------
  describe('Abuse Report Schemas', () => {
    it('validates CreateReportInput with supported categories and minimum details length', () => {
      const report = {
        targetType: 'MESSAGE',
        targetId: VALID_UUID,
        category: 'HARASSMENT',
        details: 'User sent repetitive abusive messages.',
      };
      expect(Value.Check(CreateReportInputSchema, report)).toBe(true);
    });

    it('rejects CreateReportInput with details shorter than 10 characters', () => {
      expect(
        Value.Check(CreateReportInputSchema, {
          targetType: 'USER',
          targetId: VALID_UUID,
          category: 'SPAM',
          details: 'Short', // < 10 chars
        }),
      ).toBe(false);
    });

    it('rejects CreateReportInput with details exceeding 5000 characters', () => {
      expect(
        Value.Check(CreateReportInputSchema, {
          targetType: 'USER',
          targetId: VALID_UUID,
          category: 'SPAM',
          details: 'x'.repeat(5001),
        }),
      ).toBe(false);
    });

    it('rejects CreateReportInput with unsupported category or targetType', () => {
      expect(
        Value.Check(CreateReportInputSchema, {
          targetType: 'UNKNOWN_TYPE' as any,
          targetId: VALID_UUID,
          category: 'SPAM',
          details: 'Valid explanation here',
        }),
      ).toBe(false);

      expect(
        Value.Check(CreateReportInputSchema, {
          targetType: 'USER',
          targetId: VALID_UUID,
          category: 'NOT_A_CATEGORY' as any,
          details: 'Valid explanation here',
        }),
      ).toBe(false);
    });

    it('validates ReportResponseSchema', () => {
      const response = {
        id: VALID_UUID,
        reporterId: ANOTHER_UUID,
        targetType: 'USER',
        targetId: THIRD_UUID,
        category: 'SCAM',
        details: 'User solicited off-platform payment.',
        status: 'PENDING',
        createdAt: '2026-10-01T12:00:00.000Z',
        updatedAt: '2026-10-01T12:00:00.000Z',
      };
      expect(Value.Check(ReportResponseSchema, response)).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 7. Error Codes Taxonomy
  // --------------------------------------------------------------------------
  describe('MessagingErrorCode Constants', () => {
    it('defines expected machine-readable error codes', () => {
      expect(MessagingErrorCode.USER_BLOCKED).toBe('USER_BLOCKED');
      expect(MessagingErrorCode.CONVERSATION_NOT_FOUND).toBe('CONVERSATION_NOT_FOUND');
      expect(MessagingErrorCode.NOT_CONVERSATION_PARTICIPANT).toBe('NOT_CONVERSATION_PARTICIPANT');
      expect(MessagingErrorCode.INVALID_MESSAGE_CURSOR).toBe('INVALID_MESSAGE_CURSOR');
      expect(MessagingErrorCode.DUPLICATE_CLIENT_MESSAGE_ID).toBe('DUPLICATE_CLIENT_MESSAGE_ID');
      expect(MessagingErrorCode.SELF_MESSAGING_NOT_ALLOWED).toBe('SELF_MESSAGING_NOT_ALLOWED');
      expect(MessagingErrorCode.SELF_BLOCK_NOT_ALLOWED).toBe('SELF_BLOCK_NOT_ALLOWED');
      expect(MessagingErrorCode.SELF_REPORT_NOT_ALLOWED).toBe('SELF_REPORT_NOT_ALLOWED');
      expect(MessagingErrorCode.MESSAGE_NOT_FOUND).toBe('MESSAGE_NOT_FOUND');
      expect(MessagingErrorCode.MESSAGE_NOT_EDITABLE).toBe('MESSAGE_NOT_EDITABLE');
      expect(MessagingErrorCode.MESSAGE_DELETED).toBe('MESSAGE_DELETED');
      expect(MessagingErrorCode.ATTACHMENT_NOT_ACTIVE).toBe('ATTACHMENT_NOT_ACTIVE');
      expect(MessagingErrorCode.MESSAGE_ATTACHMENT_LIMIT_EXCEEDED).toBe(
        'MESSAGE_ATTACHMENT_LIMIT_EXCEEDED',
      );
    });
  });

  // --------------------------------------------------------------------------
  // 8. User Block Outbox Event Payloads (Increment 10C)
  // --------------------------------------------------------------------------
  describe('User Block Outbox Event Payloads', () => {
    it('validates valid UserBlockCreatedV1PayloadSchema', () => {
      const validPayload = {
        blockId: VALID_UUID,
        blockerId: ANOTHER_UUID,
        blockedId: THIRD_UUID,
        reason: 'Harassment in conversation',
        createdAt: new Date().toISOString(),
      };
      expect(Value.Check(UserBlockCreatedV1PayloadSchema, validPayload)).toBe(true);

      const nullReasonPayload = {
        ...validPayload,
        reason: null,
      };
      expect(Value.Check(UserBlockCreatedV1PayloadSchema, nullReasonPayload)).toBe(true);
    });

    it('rejects malformed UserBlockCreatedV1PayloadSchema', () => {
      expect(
        Value.Check(UserBlockCreatedV1PayloadSchema, {
          blockId: 'not-a-uuid',
          blockerId: ANOTHER_UUID,
          blockedId: THIRD_UUID,
          reason: null,
          createdAt: new Date().toISOString(),
        }),
      ).toBe(false);
    });

    it('validates valid UserBlockRemovedV1PayloadSchema', () => {
      const validPayload = {
        blockerId: ANOTHER_UUID,
        blockedId: THIRD_UUID,
        removedAt: new Date().toISOString(),
      };
      expect(Value.Check(UserBlockRemovedV1PayloadSchema, validPayload)).toBe(true);
    });

    it('rejects malformed UserBlockRemovedV1PayloadSchema', () => {
      expect(
        Value.Check(UserBlockRemovedV1PayloadSchema, {
          blockerId: 'not-a-uuid',
          blockedId: THIRD_UUID,
          removedAt: 'invalid-date',
        }),
      ).toBe(false);
    });
  });
});
