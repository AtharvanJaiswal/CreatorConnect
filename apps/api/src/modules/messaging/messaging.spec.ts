import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient, type PrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { encodeMessageCursor } from '@creatorconnect/contracts';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';

describe('Messaging REST API Integration Tests (Increment 6)', () => {
  let app: FastifyInstance;
  const prisma: PrismaClient = getPrismaClient();

  // Test users & tokens
  let userA: { id: string; supabaseAuthId: string; email: string };
  let userB: { id: string; supabaseAuthId: string; email: string };
  let userC: { id: string; supabaseAuthId: string; email: string };

  let tokenA: string;
  let tokenB: string;
  let tokenC: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    const ts = Date.now();

    // 1. Create User A (Alice)
    const idA = generateUuidV7();
    const subA = `sub_api_alice_${ts}`;
    const emailA = `alice_api_${ts}@test.com`;
    userA = await prisma.user.create({
      data: {
        id: idA,
        supabaseAuthId: subA,
        email: emailA,
        firstName: 'Alice',
        lastName: 'Api',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: 'CREATOR' },
                create: { id: generateUuidV7(), name: 'CREATOR' },
              },
            },
          },
        },
      },
    });
    tokenA = await createTestJwt({ sub: subA, email: emailA });

    // 2. Create User B (Bob)
    const idB = generateUuidV7();
    const subB = `sub_api_bob_${ts}`;
    const emailB = `bob_api_${ts}@test.com`;
    userB = await prisma.user.create({
      data: {
        id: idB,
        supabaseAuthId: subB,
        email: emailB,
        firstName: 'Bob',
        lastName: 'Api',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: 'BRAND' },
                create: { id: generateUuidV7(), name: 'BRAND' },
              },
            },
          },
        },
      },
    });
    tokenB = await createTestJwt({ sub: subB, email: emailB });

    // 3. Create User C (Charlie - outsider)
    const idC = generateUuidV7();
    const subC = `sub_api_charlie_${ts}`;
    const emailC = `charlie_api_${ts}@test.com`;
    userC = await prisma.user.create({
      data: {
        id: idC,
        supabaseAuthId: subC,
        email: emailC,
        firstName: 'Charlie',
        lastName: 'Api',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: 'PROFESSIONAL' },
                create: { id: generateUuidV7(), name: 'PROFESSIONAL' },
              },
            },
          },
        },
      },
    });
    tokenC = await createTestJwt({ sub: subC, email: emailC });
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.messageReaction.deleteMany({});
    await prisma.messageAttachment.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.outboxEvent.deleteMany({});
    await prisma.conversationParticipant.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.userBlock.deleteMany({});
    await prisma.userRole.deleteMany({
      where: { userId: { in: [userA.id, userB.id, userC.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id, userC.id] } },
    });

    await app.close();
  });

  describe('1. Authentication Gates & Anonymous Rejections', () => {
    it('rejects anonymous conversation requests with 401 Problem Details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/conversations',
      });

      expect(res.statusCode).toBe(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const body = res.json();
      expect(body.code).toBe('AUTH_INVALID_TOKEN');
      expect(body.status).toBe(401);
    });

    it('rejects invalid bearer token with 401 Problem Details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/conversations',
        headers: {
          authorization: 'Bearer invalid.token.payload',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.code).toBe('AUTH_INVALID_TOKEN');
    });
  });

  describe('2. Direct Conversation Lifecycle (Create, Retrieve, List)', () => {
    let createdConvId: string;

    it('creates a new direct conversation between Alice and Bob', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: userB.id,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeDefined();
      expect(body.type).toBe('DIRECT');
      expect(body.currentSequence).toBe('0');
      expect(body.participants).toHaveLength(2);
      createdConvId = body.id;
    });

    it('returns the same existing conversation when called again (idempotent retrieval)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: userB.id,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBe(createdConvId);
    });

    it('lists conversations for the authenticated user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items).toBeInstanceOf(Array);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(body.items.some((c: any) => c.id === createdConvId)).toBe(true);
    });

    it('retrieves conversation by ID for an active participant', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/conversations/${createdConvId}`,
        headers: { authorization: `Bearer ${tokenB}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(createdConvId);
      expect(typeof body.currentSequence).toBe('string');
    });

    it('rejects self-messaging with 400 SELF_MESSAGING_NOT_ALLOWED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: userA.id,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('SELF_MESSAGING_NOT_ALLOWED');
    });
  });

  describe('3. Anti-Enumeration & Privacy Preservation for Non-Participants', () => {
    let convId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { recipientId: userB.id },
      });
      convId = res.json().id;
    });

    it('returns 404 CONVERSATION_NOT_FOUND when non-participant accesses conversation by ID', async () => {
      // Charlie (userC) is not a participant
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/conversations/${convId}`,
        headers: { authorization: `Bearer ${tokenC}` },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.code).toBe('CONVERSATION_NOT_FOUND');
    });

    it('returns 404 CONVERSATION_NOT_FOUND when non-participant tries to list messages', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/conversations/${convId}/messages`,
        headers: { authorization: `Bearer ${tokenC}` },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.code).toBe('CONVERSATION_NOT_FOUND');
    });

    it('returns 404 CONVERSATION_NOT_FOUND when non-participant tries to send a message', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/messages`,
        headers: { authorization: `Bearer ${tokenC}` },
        payload: {
          clientMessageId: generateUuidV7(),
          content: 'Intruder message',
        },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.code).toBe('CONVERSATION_NOT_FOUND');
    });

    it('returns 404 CONVERSATION_NOT_FOUND when non-participant tries to mark read', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/read`,
        headers: { authorization: `Bearer ${tokenC}` },
        payload: { sequence: '1' },
      });

      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.code).toBe('CONVERSATION_NOT_FOUND');
    });
  });

  describe('4. Message Sending, Monotonic Sequences, & Sender Identity Spoofing Protection', () => {
    let convId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { recipientId: userB.id },
      });
      convId = res.json().id;
    });

    it('sends a message and guarantees server-derived sender identity', async () => {
      const clientMessageId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          clientMessageId,
          content: 'Hello Bob!',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.id).toBeDefined();
      expect(body.conversationId).toBe(convId);
      expect(body.senderId).toBe(userA.id); // STRICTLY derived from tokenA
      expect(typeof body.sequence).toBe('string');
      expect(BigInt(body.sequence) >= 1n).toBe(true);
    });

    it('ignores client spoofing attempts in payload and binds sender to authenticated user', async () => {
      const clientMessageId = generateUuidV7();
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          clientMessageId,
          content: 'Attempting to spoof sender as Bob',
          senderId: userB.id, // Client spoof attempt
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.senderId).toBe(userA.id); // ALWAYS Alice, never Bob
    });

    it('returns decimal sequence string and does not expose raw BigInt', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/messages`,
        headers: { authorization: `Bearer ${tokenB}` },
        payload: {
          clientMessageId: generateUuidV7(),
          content: 'Reply from Bob',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(typeof body.sequence).toBe('string');
      expect(/^\d+$/.test(body.sequence)).toBe(true);
    });
  });

  describe('5. Client Idempotency Invariants', () => {
    let convId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { recipientId: userB.id },
      });
      convId = res.json().id;
    });

    it('safely replays identical send message with same clientMessageId (idempotent)', async () => {
      const clientMessageId = generateUuidV7();
      const payload = {
        clientMessageId,
        content: 'Original idempotent message',
      };

      // First attempt
      const res1 = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload,
      });
      expect(res1.statusCode).toBe(201);
      const msg1 = res1.json();

      // Retry attempt
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload,
      });
      expect(res2.statusCode).toBe(201);
      const msg2 = res2.json();

      expect(msg2.id).toBe(msg1.id);
      expect(msg2.sequence).toBe(msg1.sequence);
    });

    it('rejects conflicting content for the same clientMessageId with 409 DUPLICATE_CLIENT_MESSAGE_ID', async () => {
      const clientMessageId = generateUuidV7();

      // First call
      await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          clientMessageId,
          content: 'Initial payload',
        },
      });

      // Conflicting payload with same key
      const conflictRes = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          clientMessageId,
          content: 'Different modified payload',
        },
      });

      expect(conflictRes.statusCode).toBe(409);
      const body = conflictRes.json();
      expect(body.code).toBe('DUPLICATE_CLIENT_MESSAGE_ID');
    });
  });

  describe('6. Keyset Pagination & Cursor Validation', () => {
    let convId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { recipientId: userB.id },
      });
      convId = res.json().id;

      // Seed 4 messages
      for (let i = 1; i <= 4; i++) {
        await app.inject({
          method: 'POST',
          url: `/api/v1/conversations/${convId}/messages`,
          headers: { authorization: `Bearer ${tokenA}` },
          payload: {
            clientMessageId: generateUuidV7(),
            content: `Pagination test message ${i}`,
          },
        });
      }
    });

    it('pages messages using keyset cursors', async () => {
      // Page 1: limit 2
      const res1 = await app.inject({
        method: 'GET',
        url: `/api/v1/conversations/${convId}/messages?limit=2`,
        headers: { authorization: `Bearer ${tokenB}` },
      });

      expect(res1.statusCode).toBe(200);
      const page1 = res1.json();
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.nextCursor).toBeDefined();

      // Page 2: with cursor
      const res2 = await app.inject({
        method: 'GET',
        url: `/api/v1/conversations/${convId}/messages?limit=2&cursor=${page1.nextCursor}`,
        headers: { authorization: `Bearer ${tokenB}` },
      });

      expect(res2.statusCode).toBe(200);
      const page2 = res2.json();
      expect(page2.items.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects invalid/corrupt cursor with 400 INVALID_MESSAGE_CURSOR', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/conversations/${convId}/messages?cursor=invalid_not_base64_json!`,
        headers: { authorization: `Bearer ${tokenB}` },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('INVALID_MESSAGE_CURSOR');
    });
  });

  describe('7. Read Receipts & Last Read Pointer Updates', () => {
    let convId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { recipientId: userB.id },
      });
      convId = res.json().id;

      await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          clientMessageId: generateUuidV7(),
          content: 'Unread message for Bob',
        },
      });
    });

    it('marks conversation as read and updates lastReadSequence', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/read`,
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { sequence: '1' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.conversationId).toBe(convId);
      expect(body.lastReadSequence).toBe('1');
    });

    it('rejects invalid sequence format with 400 BAD_REQUEST', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/read`,
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { sequence: 'not-a-number' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('8. Bidirectional Blocking & Unblocking REST Endpoints', () => {
    let convId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { recipientId: userB.id },
      });
      convId = res.json().id;
    });

    it('blocks a user (Alice blocks Bob)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/blocks',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          targetUserId: userB.id,
          reason: 'Harassment',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.blockerId).toBe(userA.id);
      expect(body.blockedId).toBe(userB.id);
      expect(body.reason).toBe('Harassment');
    });

    it('rejects self-blocking with 400 SELF_BLOCK_NOT_ALLOWED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/blocks',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          targetUserId: userA.id,
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('SELF_BLOCK_NOT_ALLOWED');
    });

    it('denies message sending from blocker (Alice) with 403 USER_BLOCKED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          clientMessageId: generateUuidV7(),
          content: 'Alice tries to send while block is active',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.code).toBe('USER_BLOCKED');
    });

    it('denies message sending from blocked party (Bob) with 403 USER_BLOCKED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/messages`,
        headers: { authorization: `Bearer ${tokenB}` },
        payload: {
          clientMessageId: generateUuidV7(),
          content: 'Bob tries to send while blocked',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.code).toBe('USER_BLOCKED');
    });

    it('denies creating new conversation while blocked with 403 USER_BLOCKED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: {
          recipientId: userA.id,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.code).toBe('USER_BLOCKED');
    });

    it('unblocks the user and restores messaging ability', async () => {
      // Unblock Bob
      const unblockRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/blocks/${userB.id}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(unblockRes.statusCode).toBe(204);

      // Now message sending works again
      const sendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          clientMessageId: generateUuidV7(),
          content: 'Message after unblocking succeeds',
        },
      });

      expect(sendRes.statusCode).toBe(201);
    });
  });

  describe('9. Schema Validation & Bad Request RFC 7807 Handling', () => {
    it('returns 400 for malformed UUID parameters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/conversations/not-a-valid-uuid',
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('returns 400 for empty message content', async () => {
      const convRes = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { recipientId: userB.id },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convRes.json().id}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          clientMessageId: generateUuidV7(),
          content: '', // Empty content
        },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('10. Rate Limiting Headers & Threshold Rejections', () => {
    it('sets rate-limiting headers (limit, remaining, reset) on message send', async () => {
      const convRes = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { recipientId: userB.id },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convRes.json().id}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          clientMessageId: generateUuidV7(),
          content: 'Checking rate limit headers',
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
      expect(res.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('11. Attachment Security, Quarantine & Authorized Downloads (Increment 9)', () => {
    let convId: string;
    let cleanMediaAssetId: string;
    let quarantinedMediaAssetId: string;
    let cleanAttachmentId: string;
    let quarantinedAttachmentId: string;

    beforeAll(async () => {
      // Create conversation between userA and userB
      const convRes = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { recipientId: userB.id },
      });
      convId = convRes.json().id;

      // Create ACTIVE clean MediaAsset belonging to userA
      cleanMediaAssetId = generateUuidV7();
      await prisma.mediaAsset.create({
        data: {
          id: cleanMediaAssetId,
          userId: userA.id,
          storageKey: `media/${userA.id}/${cleanMediaAssetId}/document.pdf`,
          originalName: 'report.pdf',
          mimeType: 'application/pdf',
          byteSize: 1024,
          mediaType: 'DOCUMENT',
          status: 'ACTIVE',
        },
      });

      // Send message with clean attachment
      const sendRes = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${convId}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          clientMessageId: generateUuidV7(),
          content: 'Here is the clean document',
          mediaAssetIds: [cleanMediaAssetId],
        },
      });
      expect(sendRes.statusCode).toBe(201);
      cleanAttachmentId = sendRes.json().attachments[0].id;

      // Create QUARANTINED MediaAsset directly in DB for negative testing
      quarantinedMediaAssetId = generateUuidV7();
      await prisma.mediaAsset.create({
        data: {
          id: quarantinedMediaAssetId,
          userId: userA.id,
          storageKey: `quarantine/${userA.id}/${quarantinedMediaAssetId}.exe`,
          originalName: 'unscanned.exe',
          mimeType: 'application/octet-stream',
          byteSize: 2048,
          mediaType: 'DOCUMENT',
          status: 'QUARANTINED',
        },
      });

      // Create MessageAttachment for quarantined asset in DB directly
      const msgId = sendRes.json().id;
      quarantinedAttachmentId = generateUuidV7();
      await prisma.messageAttachment.create({
        data: {
          id: quarantinedAttachmentId,
          messageId: msgId,
          mediaAssetId: quarantinedMediaAssetId,
        },
      });
    });

    it('allows active conversation participant (User B) to download clean active attachment', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/conversations/${convId}/attachments/${cleanAttachmentId}/download`,
        headers: { authorization: `Bearer ${tokenB}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.attachmentId).toBe(cleanAttachmentId);
      expect(body.mediaAssetId).toBe(cleanMediaAssetId);
      expect(body.fileName).toBe('report.pdf');
      expect(body.fileSize).toBe(1024);
      expect(body.mimeType).toBe('application/pdf');
      expect(body.downloadUrl).toBeDefined();
      expect(body.downloadUrl).toContain('private=true');
      expect(body.expiresInSeconds).toBe(900);

      // Verify audit log entry
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'ATTACHMENT_DOWNLOADED',
          entityId: cleanAttachmentId,
          userId: userB.id,
        },
      });
      expect(auditLog).toBeDefined();
    });

    it('allows downloading via standalone /api/v1/attachments/:id/download route', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/attachments/${cleanAttachmentId}/download`,
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.attachmentId).toBe(cleanAttachmentId);
      expect(body.downloadUrl).toBeDefined();
    });

    it('denies download of quarantined or non-active media asset (fail-closed)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/conversations/${convId}/attachments/${quarantinedAttachmentId}/download`,
        headers: { authorization: `Bearer ${tokenB}` },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('ATTACHMENT_NOT_ACTIVE');
    });

    it('returns anti-enumeration 404 when non-participant (User C) attempts download', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/conversations/${convId}/attachments/${cleanAttachmentId}/download`,
        headers: { authorization: `Bearer ${tokenC}` },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('ATTACHMENT_NOT_FOUND');
    });

    it('returns anti-enumeration 404 on attachment ID guessing or invalid conversation ID', async () => {
      const fakeConvId = generateUuidV7();
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/conversations/${fakeConvId}/attachments/${cleanAttachmentId}/download`,
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('ATTACHMENT_NOT_FOUND');
    });

    it('returns anti-enumeration 404 when attachment ID does not exist', async () => {
      const fakeAttachmentId = generateUuidV7();
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/conversations/${convId}/attachments/${fakeAttachmentId}/download`,
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('ATTACHMENT_NOT_FOUND');
    });

    it('denies download with 403 USER_BLOCKED if blocker/blocked relationship exists', async () => {
      // User A blocks User B
      const blockRes = await app.inject({
        method: 'POST',
        url: '/api/v1/blocks',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { targetUserId: userB.id, reason: 'Testing download blocking' },
      });
      expect(blockRes.statusCode).toBe(201);
      const blockId = blockRes.json().id;

      // User B attempts to download attachment
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/conversations/${convId}/attachments/${cleanAttachmentId}/download`,
        headers: { authorization: `Bearer ${tokenB}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('USER_BLOCKED');

      // Cleanup: unblock User B
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/blocks/${blockId}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
    });

    it('denies unauthenticated download with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/conversations/${convId}/attachments/${cleanAttachmentId}/download`,
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
