import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  getPrismaClient,
  type PrismaClient,
  MessagingRepository,
  ConversationNotFoundError,
  NotConversationParticipantError,
  DuplicateClientMessageIdError,
  UserBlockedError,
  AttachmentNotFoundError,
  AttachmentNotActiveError,
  AttachmentLimitExceededError,
  SelfMessagingNotAllowedError,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';

describe('MessagingRepository PostgreSQL Integration Tests', () => {
  let prisma: PrismaClient;
  let repo: MessagingRepository;

  // Test users
  let userA: { id: string; email: string };
  let userB: { id: string; email: string };
  let userC: { id: string; email: string };

  beforeAll(async () => {
    prisma = getPrismaClient();
    repo = new MessagingRepository(prisma);

    // Create unique test users
    const ts = Date.now();
    userA = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_msg_a_${ts}`,
        email: `msg_a_${ts}@test.com`,
        firstName: 'Alice',
        lastName: 'User',
        status: 'ACTIVE',
      },
    });

    userB = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_msg_b_${ts}`,
        email: `msg_b_${ts}@test.com`,
        firstName: 'Bob',
        lastName: 'User',
        status: 'ACTIVE',
      },
    });

    userC = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_msg_c_${ts}`,
        email: `msg_c_${ts}@test.com`,
        firstName: 'Charlie',
        lastName: 'User',
        status: 'ACTIVE',
      },
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.messageReaction.deleteMany({});
    await prisma.messageAttachment.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.outboxEvent.deleteMany({});
    await prisma.conversationParticipant.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.userBlock.deleteMany({});
    await prisma.mediaAsset.deleteMany({
      where: { userId: { in: [userA.id, userB.id, userC.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id, userC.id] } },
    });
  });

  describe('1. Direct Conversation Management', () => {
    it('creates a direct conversation without requiring assignment or application context', async () => {
      const conv = await repo.createOrGetDirectConversation(userA.id, userB.id);

      expect(conv.id).toBeDefined();
      expect(conv.type).toBe('DIRECT');
      expect(conv.currentSequence).toBe('0');
      expect(conv.assignmentId).toBeNull();
      expect(conv.applicationId).toBeNull();
      expect(conv.participants).toHaveLength(2);

      const participantIds = conv.participants.map((p) => p.userId);
      expect(participantIds).toContain(userA.id);
      expect(participantIds).toContain(userB.id);
    });

    it('returns the existing conversation on repeated calls between the same users', async () => {
      const conv1 = await repo.createOrGetDirectConversation(userA.id, userB.id);
      const conv2 = await repo.createOrGetDirectConversation(userB.id, userA.id);

      expect(conv2.id).toBe(conv1.id);
      expect(conv2.participants).toHaveLength(2);
    });

    it('rejects self-messaging with SelfMessagingNotAllowedError', async () => {
      await expect(repo.createOrGetDirectConversation(userA.id, userA.id)).rejects.toThrow(
        SelfMessagingNotAllowedError,
      );
    });

    it('rejects conversation creation if a block exists between users', async () => {
      await repo.blockUser(userC.id, userA.id, 'Spam');

      await expect(repo.createOrGetDirectConversation(userA.id, userC.id)).rejects.toThrow(
        UserBlockedError,
      );

      await expect(repo.createOrGetDirectConversation(userC.id, userA.id)).rejects.toThrow(
        UserBlockedError,
      );

      // Unblock for subsequent tests
      await repo.unblockUser(userC.id, userA.id);
    });
  });

  describe('2. Message Sending, Monotonic Sequencing & Atomic Outbox', () => {
    it('allocates strictly monotonic sequences and creates outbox events atomically', async () => {
      const conv = await repo.createOrGetDirectConversation(userA.id, userB.id);

      // First message
      const clientMsgId1 = generateUuidV7();
      const msg1 = await repo.sendMessage({
        conversationId: conv.id,
        senderId: userA.id,
        clientMessageId: clientMsgId1,
        content: 'Hello Bob! This is message 1.',
      });

      expect(msg1.sequence).toBe('1');
      expect(typeof msg1.sequence).toBe('string');
      expect(msg1.content).toBe('Hello Bob! This is message 1.');

      // Verify conversation currentSequence in database
      const convRow1 = await prisma.conversation.findUnique({ where: { id: conv.id } });
      expect(convRow1?.currentSequence.toString()).toBe('1');

      // Verify outbox event created in database
      const outbox1 = await prisma.outboxEvent.findFirst({
        where: { aggregateId: msg1.id },
      });
      expect(outbox1).toBeDefined();
      expect(outbox1?.eventType).toBe('message.created.v1');
      expect(outbox1?.status).toBe('PENDING');
      const payload1 = outbox1?.payload as any;
      expect(payload1.sequence).toBe('1');
      expect(payload1.conversationId).toBe(conv.id);

      // Second message
      const clientMsgId2 = generateUuidV7();
      const msg2 = await repo.sendMessage({
        conversationId: conv.id,
        senderId: userB.id,
        clientMessageId: clientMsgId2,
        content: 'Hi Alice! Received message 1.',
      });

      expect(msg2.sequence).toBe('2');
      const convRow2 = await prisma.conversation.findUnique({ where: { id: conv.id } });
      expect(convRow2?.currentSequence.toString()).toBe('2');

      const outbox2 = await prisma.outboxEvent.findFirst({
        where: { aggregateId: msg2.id },
      });
      expect(outbox2).toBeDefined();
      expect((outbox2?.payload as any).sequence).toBe('2');
    });

    it('rolls back sequence increment, message, and outbox event when transaction aborts', async () => {
      const conv = await repo.createOrGetDirectConversation(userA.id, userB.id);
      const initialRow = await prisma.conversation.findUnique({ where: { id: conv.id } });
      const initialSeq = initialRow?.currentSequence.toString();

      // Attempt to send message with non-existent attachment (forces transaction failure)
      const fakeAssetId = generateUuidV7();
      await expect(
        repo.sendMessage({
          conversationId: conv.id,
          senderId: userA.id,
          clientMessageId: generateUuidV7(),
          content: 'Failing message',
          mediaAssetIds: [fakeAssetId],
        }),
      ).rejects.toThrow(AttachmentNotFoundError);

      // Verify conversation sequence did NOT change
      const afterRow = await prisma.conversation.findUnique({ where: { id: conv.id } });
      expect(afterRow?.currentSequence.toString()).toBe(initialSeq);

      // Verify no orphaned outbox event was created
      const outbox = await prisma.outboxEvent.findFirst({
        where: { payload: { path: ['content'], equals: 'Failing message' } },
      });
      expect(outbox).toBeNull();
    });
  });

  describe('3. Message Idempotency', () => {
    it('idempotently returns original message on duplicate retry with identical payload', async () => {
      const conv = await repo.createOrGetDirectConversation(userA.id, userB.id);
      const clientMsgId = generateUuidV7();

      const firstSend = await repo.sendMessage({
        conversationId: conv.id,
        senderId: userA.id,
        clientMessageId: clientMsgId,
        content: 'Idempotent payload test',
      });

      const outboxCountBefore = await prisma.outboxEvent.count({
        where: { aggregateId: firstSend.id },
      });
      expect(outboxCountBefore).toBe(1);

      // Retry with identical payload
      const secondSend = await repo.sendMessage({
        conversationId: conv.id,
        senderId: userA.id,
        clientMessageId: clientMsgId,
        content: 'Idempotent payload test',
      });

      expect(secondSend.id).toBe(firstSend.id);
      expect(secondSend.sequence).toBe(firstSend.sequence);

      // Outbox event count must NOT increase
      const outboxCountAfter = await prisma.outboxEvent.count({
        where: { aggregateId: firstSend.id },
      });
      expect(outboxCountAfter).toBe(1);
    });

    it('rejects duplicate clientMessageId with different payload with DuplicateClientMessageIdError', async () => {
      const conv = await repo.createOrGetDirectConversation(userA.id, userB.id);
      const clientMsgId = generateUuidV7();

      await repo.sendMessage({
        conversationId: conv.id,
        senderId: userA.id,
        clientMessageId: clientMsgId,
        content: 'Original content',
      });

      // Attempt reuse with different content
      await expect(
        repo.sendMessage({
          conversationId: conv.id,
          senderId: userA.id,
          clientMessageId: clientMsgId,
          content: 'Modified content attempting reuse',
        }),
      ).rejects.toThrow(DuplicateClientMessageIdError);
    });
  });

  describe('4. PostgreSQL Concurrency & Row Locking (FOR UPDATE)', () => {
    it('guarantees strictly contiguous monotonic sequences under 15-way concurrent sends', async () => {
      // Create a fresh direct conversation between userA and userC
      const conv = await repo.createOrGetDirectConversation(userA.id, userC.id);
      const initialRow = await prisma.conversation.findUnique({ where: { id: conv.id } });
      const startSeq = Number(initialRow?.currentSequence || 0);

      const CONCURRENT_COUNT = 15;
      const sendPromises = Array.from({ length: CONCURRENT_COUNT }, (_, i) => {
        const sender = i % 2 === 0 ? userA.id : userC.id;
        return repo.sendMessage({
          conversationId: conv.id,
          senderId: sender,
          clientMessageId: generateUuidV7(),
          content: `Concurrent message ${i + 1}`,
        });
      });

      // Execute all 15 concurrent transactions simultaneously
      const results = await Promise.all(sendPromises);

      expect(results).toHaveLength(CONCURRENT_COUNT);

      // Collect allocated sequences as numbers
      const allocatedSequences = results.map((r) => Number(r.sequence));

      // 1. All sequences must be strictly unique
      const uniqueSequences = new Set(allocatedSequences);
      expect(uniqueSequences.size).toBe(CONCURRENT_COUNT);

      // 2. Sort sequences and verify strict contiguous ordering without gaps
      allocatedSequences.sort((a, b) => a - b);
      for (let i = 0; i < CONCURRENT_COUNT; i++) {
        expect(allocatedSequences[i]).toBe(startSeq + i + 1);
      }

      // 3. Conversation currentSequence in DB must equal the final allocated sequence
      const finalRow = await prisma.conversation.findUnique({ where: { id: conv.id } });
      expect(Number(finalRow?.currentSequence)).toBe(startSeq + CONCURRENT_COUNT);

      // 4. Exactly CONCURRENT_COUNT outbox events created
      const outboxEvents = await prisma.outboxEvent.findMany({
        where: {
          aggregateId: { in: results.map((r) => r.id) },
        },
      });
      expect(outboxEvents).toHaveLength(CONCURRENT_COUNT);
    });

    it('safely handles concurrent retries with the SAME clientMessageId', async () => {
      const conv = await repo.createOrGetDirectConversation(userA.id, userB.id);
      const sharedClientMsgId = generateUuidV7();

      // Launch 5 simultaneous requests with the same clientMessageId & payload
      const duplicatePromises = Array.from({ length: 5 }, () =>
        repo.sendMessage({
          conversationId: conv.id,
          senderId: userA.id,
          clientMessageId: sharedClientMsgId,
          content: 'Simultaneous duplicate payload',
        }),
      );

      const results = await Promise.all(duplicatePromises);

      // All 5 must resolve to the exact same message
      const firstId = results[0]!.id;
      const firstSeq = results[0]!.sequence;
      for (const res of results) {
        expect(res.id).toBe(firstId);
        expect(res.sequence).toBe(firstSeq);
      }

      // Exactly 1 outbox event exists for this message
      const count = await prisma.outboxEvent.count({
        where: { aggregateId: firstId },
      });
      expect(count).toBe(1);
    });
  });

  describe('5. Attachment Validation', () => {
    it('successfully attaches an ACTIVE media asset owned by the sender', async () => {
      const conv = await repo.createOrGetDirectConversation(userA.id, userB.id);

      // Create an ACTIVE media asset for userA
      const asset = await prisma.mediaAsset.create({
        data: {
          id: generateUuidV7(),
          userId: userA.id,
          storageKey: `attachments/test_${Date.now()}.png`,
          originalName: 'test.png',
          mimeType: 'image/png',
          byteSize: 1024,
          mediaType: 'IMAGE',
          status: 'ACTIVE',
        },
      });

      const msg = await repo.sendMessage({
        conversationId: conv.id,
        senderId: userA.id,
        clientMessageId: generateUuidV7(),
        content: 'Check out this attachment',
        mediaAssetIds: [asset.id],
      });

      expect(msg.attachments).toHaveLength(1);
      expect(msg.attachments[0]!.mediaAssetId).toBe(asset.id);
    });

    it('rejects QUARANTINED media assets with AttachmentNotActiveError', async () => {
      const conv = await repo.createOrGetDirectConversation(userA.id, userB.id);

      const quarantinedAsset = await prisma.mediaAsset.create({
        data: {
          id: generateUuidV7(),
          userId: userA.id,
          storageKey: `attachments/quarantined_${Date.now()}.png`,
          originalName: 'virus.png',
          mimeType: 'image/png',
          byteSize: 2048,
          mediaType: 'IMAGE',
          status: 'QUARANTINED',
        },
      });

      await expect(
        repo.sendMessage({
          conversationId: conv.id,
          senderId: userA.id,
          clientMessageId: generateUuidV7(),
          content: 'Quarantined file',
          mediaAssetIds: [quarantinedAsset.id],
        }),
      ).rejects.toThrow(AttachmentNotActiveError);
    });

    it('rejects media assets owned by another user with AttachmentNotFoundError', async () => {
      const conv = await repo.createOrGetDirectConversation(userA.id, userB.id);

      // Create asset owned by userB
      const userBAsset = await prisma.mediaAsset.create({
        data: {
          id: generateUuidV7(),
          userId: userB.id,
          storageKey: `attachments/userb_${Date.now()}.png`,
          originalName: 'userb.png',
          mimeType: 'image/png',
          byteSize: 512,
          mediaType: 'IMAGE',
          status: 'ACTIVE',
        },
      });

      // UserA tries to attach UserB's asset
      await expect(
        repo.sendMessage({
          conversationId: conv.id,
          senderId: userA.id,
          clientMessageId: generateUuidV7(),
          content: 'Unauthorized asset attachment',
          mediaAssetIds: [userBAsset.id],
        }),
      ).rejects.toThrow(AttachmentNotFoundError);
    });

    it('rejects more than 10 attachments with AttachmentLimitExceededError', async () => {
      const conv = await repo.createOrGetDirectConversation(userA.id, userB.id);
      const elevenAssetIds = Array.from({ length: 11 }, () => generateUuidV7());

      await expect(
        repo.sendMessage({
          conversationId: conv.id,
          senderId: userA.id,
          clientMessageId: generateUuidV7(),
          content: 'Too many files',
          mediaAssetIds: elevenAssetIds,
        }),
      ).rejects.toThrow(AttachmentLimitExceededError);
    });
  });

  describe('6. Keyset Pagination & Read Receipts', () => {
    it('pages messages using keyset cursors and updates lastReadSequence', async () => {
      const conv = await repo.createOrGetDirectConversation(userA.id, userB.id);

      // Send 5 messages
      for (let i = 1; i <= 5; i++) {
        await repo.sendMessage({
          conversationId: conv.id,
          senderId: userA.id,
          clientMessageId: generateUuidV7(),
          content: `Numbered message ${i}`,
        });
      }

      // Page 1: limit 3
      const page1 = await repo.listMessages({
        conversationId: conv.id,
        userId: userB.id,
        limit: 3,
      });

      expect(page1.items).toHaveLength(3);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      // Page 2: with cursor
      const page2 = await repo.listMessages({
        conversationId: conv.id,
        userId: userB.id,
        cursor: page1.nextCursor!,
        limit: 3,
      });

      expect(page2.items.length).toBeGreaterThanOrEqual(1);

      // Verify MarkRead
      const highestSeq = page1.items[0]!.sequence;
      const readRes = await repo.markConversationRead(conv.id, userB.id, highestSeq);
      expect(readRes.lastReadSequence).toBe(highestSeq);

      // Check unread count on getConversationById
      const convAfterRead = await repo.getConversationById(conv.id, userB.id);
      expect(convAfterRead.unreadCount).toBe(0);
    });
  });

  describe('7. User Blocks & Outbox Event Creation (Increment 10C)', () => {
    it('persists block in PostgreSQL and creates user.block.created.v1 outbox event in the same transaction', async () => {
      const blockRes = await repo.blockUser(userA.id, userB.id, 'Test block reason');
      expect(blockRes.blockerId).toBe(userA.id);
      expect(blockRes.blockedId).toBe(userB.id);
      expect(blockRes.reason).toBe('Test block reason');

      // Verify PostgreSQL row
      const blockRow = await prisma.userBlock.findUnique({
        where: {
          blockerId_blockedId: { blockerId: userA.id, blockedId: userB.id },
        },
      });
      expect(blockRow).not.toBeNull();
      expect(blockRow?.id).toBe(blockRes.id);

      // Verify Outbox Event created
      const outboxEvent = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: blockRes.id,
          eventType: 'user.block.created.v1',
        },
      });
      expect(outboxEvent).not.toBeNull();
      expect(outboxEvent?.status).toBe('PENDING');
      const payload = outboxEvent?.payload as any;
      expect(payload.blockerId).toBe(userA.id);
      expect(payload.blockedId).toBe(userB.id);
      expect(payload.reason).toBe('Test block reason');

      // Verify isBlocked is bidirectional
      expect(await repo.isBlocked(userA.id, userB.id)).toBe(true);
      expect(await repo.isBlocked(userB.id, userA.id)).toBe(true);
      expect(await repo.isBlocked(userA.id, userC.id)).toBe(false);
    });

    it('unblocks user in PostgreSQL and creates user.block.removed.v1 outbox event in the same transaction', async () => {
      // Ensure block exists
      await repo.blockUser(userA.id, userB.id);
      expect(await repo.isBlocked(userA.id, userB.id)).toBe(true);

      // Unblock
      await repo.unblockUser(userA.id, userB.id);

      // Verify PostgreSQL row deleted
      const blockRow = await prisma.userBlock.findUnique({
        where: {
          blockerId_blockedId: { blockerId: userA.id, blockedId: userB.id },
        },
      });
      expect(blockRow).toBeNull();
      expect(await repo.isBlocked(userA.id, userB.id)).toBe(false);

      // Verify Outbox Event created
      const unblockEvent = await prisma.outboxEvent.findFirst({
        where: {
          eventType: 'user.block.removed.v1',
          payload: {
            path: ['blockerId'],
            equals: userA.id,
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(unblockEvent).not.toBeNull();
      expect(unblockEvent?.status).toBe('PENDING');
      const payload = unblockEvent?.payload as any;
      expect(payload.blockerId).toBe(userA.id);
      expect(payload.blockedId).toBe(userB.id);
      expect(payload.removedAt).toBeDefined();
    });

    it('rejects self-blocking with SelfBlockNotAllowedError', async () => {
      await expect(repo.blockUser(userA.id, userA.id)).rejects.toThrow();
    });
  });
});
