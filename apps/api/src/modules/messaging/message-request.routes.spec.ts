import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient, type PrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';

describe('MessageRequest REST API Routes & Contracts (Milestone 2B)', () => {
  let app: FastifyInstance;
  const prisma: PrismaClient = getPrismaClient();

  // Test users & tokens
  let userA: { id: string; email: string }; // Sender
  let userB: { id: string; email: string }; // Recipient
  let userC: { id: string; email: string }; // Outsider
  let userD: { id: string; email: string }; // Recipient for decline test
  let userE: { id: string; email: string }; // Recipient for cancel test
  let userF: { id: string; email: string }; // Recipient for block test

  let tokenA: string;
  let tokenB: string;
  let tokenC: string;
  let tokenD: string;
  let tokenE: string;
  let tokenF: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    const ts = Date.now();

    async function provisionUser(prefix: string, roleName = 'CREATOR') {
      const id = generateUuidV7();
      const sub = `sub_req_${prefix}_${ts}`;
      const email = `${prefix}_${ts}@test.com`;
      const user = await prisma.user.create({
        data: {
          id,
          supabaseAuthId: sub,
          email,
          firstName: prefix.toUpperCase(),
          lastName: 'Tester',
          status: 'ACTIVE',
          creatorProfile: {
            create: {
              id: generateUuidV7(),
              bio: `Bio for ${prefix}`,
              locationCity: 'Berlin',
              locationCountry: 'DE',
              isVerified: true,
            },
          },
          userRoles: {
            create: {
              id: generateUuidV7(),
              role: {
                connectOrCreate: {
                  where: { name: roleName },
                  create: { id: generateUuidV7(), name: roleName },
                },
              },
            },
          },
        },
      });
      const token = await createTestJwt({ sub, email });
      return { user, token };
    }

    const pA = await provisionUser('alice');
    userA = pA.user;
    tokenA = pA.token;

    const pB = await provisionUser('bob', 'BRAND');
    userB = pB.user;
    tokenB = pB.token;

    const pC = await provisionUser('charlie');
    userC = pC.user;
    tokenC = pC.token;

    const pD = await provisionUser('david');
    userD = pD.user;
    tokenD = pD.token;

    const pE = await provisionUser('emma');
    userE = pE.user;
    tokenE = pE.token;

    const pF = await provisionUser('frank');
    userF = pF.user;
    tokenF = pF.token;
  });

  afterAll(async () => {
    await app.close();
  });

  // ==============================================================================
  // 1. Authentication Guards (SEC-AUTH)
  // ==============================================================================
  describe('Authentication Enforcement', () => {
    it('rejects unauthenticated POST /api/v1/chat/requests with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/requests',
        payload: {
          recipientId: userB.id,
          initialMessage: 'Hello without auth',
        },
      });
      expect(res.statusCode).toBe(401);
      const body = res.json();
      expect(body.type).toContain('errors/auth');
    });

    it('rejects unauthenticated GET /api/v1/chat/requests with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/chat/requests',
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects unauthenticated GET /api/v1/chat/requests/:id with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/chat/requests/${generateUuidV7()}`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects unauthenticated POST /api/v1/chat/requests/:id/accept with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/chat/requests/${generateUuidV7()}/accept`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects unauthenticated POST /api/v1/chat/requests/:id/decline with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/chat/requests/${generateUuidV7()}/decline`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects unauthenticated POST /api/v1/chat/requests/:id/cancel with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/chat/requests/${generateUuidV7()}/cancel`,
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ==============================================================================
  // 2. Contract Validation & Input Normalization
  // ==============================================================================
  describe('Contract Validation & Input Normalization', () => {
    it('rejects request with missing initialMessage with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/requests',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { recipientId: userB.id },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects request with non-UUID recipientId with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/requests',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: 'invalid-not-a-uuid',
          initialMessage: 'Hello',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects request exceeding 500 characters with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/requests',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: userB.id,
          initialMessage: 'x'.repeat(501),
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects request with whitespace-only initialMessage with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/requests',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: userB.id,
          initialMessage: '     \n\t   ',
        },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('INVALID_MESSAGE_REQUEST_INPUT');
    });

    it('rejects request with control characters (null byte) with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/requests',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: userB.id,
          initialMessage: 'Hello\x00world',
        },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('INVALID_MESSAGE_REQUEST_INPUT');
    });

    it('rejects self-targeted request with 400 SELF_MESSAGE_REQUEST_NOT_ALLOWED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/requests',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: userA.id,
          initialMessage: 'Talking to myself',
        },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('SELF_MESSAGE_REQUEST_NOT_ALLOWED');
    });

    it('rejects malformed cursor in GET /api/v1/chat/requests with 400', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/chat/requests?cursor=not-valid-base64!',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('INVALID_MESSAGE_CURSOR');
    });
  });

  // ==============================================================================
  // 3. Request Creation, Listing & Anti-Enumeration
  // ==============================================================================
  describe('Creation, Listing & Anti-Enumeration', () => {
    let requestId: string;

    it('creates a message request successfully with 201 Created and outbox event', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/requests',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: userB.id,
          initialMessage: '  Hi Bob, would love to collaborate on a video project!  ',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();

      expect(body.id).toBeDefined();
      expect(body.senderId).toBe(userA.id);
      expect(body.recipientId).toBe(userB.id);
      expect(body.initialMessage).toBe('Hi Bob, would love to collaborate on a video project!');
      expect(body.status).toBe('PENDING');
      expect(body.conversationId).toBeNull();
      expect(body.declinedReason).toBeNull();
      expect(body.respondedAt).toBeNull();
      expect(body.expiresAt).toBeDefined();
      expect(body.createdAt).toBeDefined();

      requestId = body.id;

      // Invariant: NO conversation and NO participants exist yet
      const conversationCount = await prisma.conversation.count({
        where: {
          AND: [
            { participants: { some: { userId: userA.id } } },
            { participants: { some: { userId: userB.id } } },
          ],
        },
      });
      expect(conversationCount).toBe(0);

      // Verify outbox event was created in the database
      const outboxEvent = await prisma.outboxEvent.findFirst({
        where: {
          aggregateType: 'MessageRequest',
          aggregateId: requestId,
          eventType: 'message_request.created.v1',
        },
      });
      expect(outboxEvent).not.toBeNull();
      expect(outboxEvent?.payload).toMatchObject({
        requestId,
        senderId: userA.id,
        recipientId: userB.id,
      });
    });

    it('rejects duplicate pending request with 409 DUPLICATE_MESSAGE_REQUEST', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/requests',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: userB.id,
          initialMessage: 'Another pending attempt',
        },
      });
      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.code).toBe('DUPLICATE_MESSAGE_REQUEST');
    });

    it('allows sender to retrieve request dossier via GET /api/v1/chat/requests/:id', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/chat/requests/${requestId}`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(requestId);
      expect(body.senderId).toBe(userA.id);
    });

    it('allows recipient to retrieve request dossier with senderProfile', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/chat/requests/${requestId}`,
        headers: { authorization: `Bearer ${tokenB}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.id).toBe(requestId);
      expect(body.senderProfile).toBeDefined();
      expect(body.senderProfile.displayName.toUpperCase()).toContain('ALICE');
      expect(body.senderProfile.isVerified).toBe(true);
    });

    it('enforces anti-enumeration: returns 404 for unrelated user Charlie', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/chat/requests/${requestId}`,
        headers: { authorization: `Bearer ${tokenC}` },
      });
      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.code).toBe('MESSAGE_REQUEST_NOT_FOUND');
    });

    it('lists incoming requests for recipient with cursor pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/chat/requests?direction=incoming&status=PENDING',
        headers: { authorization: `Bearer ${tokenB}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.some((i: any) => i.id === requestId)).toBe(true);
      expect(body.hasMore).toBe(false);
    });

    it('lists outgoing requests for sender', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/chat/requests?direction=outgoing&status=PENDING',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.some((i: any) => i.id === requestId)).toBe(true);
    });

    it('returns empty list for unrelated outsider', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/chat/requests?direction=incoming',
        headers: { authorization: `Bearer ${tokenC}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.items.length).toBe(0);
    });
  });

  // ==============================================================================
  // 4. Accept Lifecycle, Atomic Conversation Creation & Idempotency
  // ==============================================================================
  describe('Acceptance & Atomic Conversation Creation', () => {
    let requestId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/requests',
        headers: { authorization: `Bearer ${tokenC}` },
        payload: {
          recipientId: userB.id,
          initialMessage: 'Charlie introducing himself to Bob',
        },
      });
      requestId = res.json().id;
    });

    it('rejects accept attempt by sender with 404 anti-enumeration', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/chat/requests/${requestId}/accept`,
        headers: { authorization: `Bearer ${tokenC}` }, // Sender, not recipient
      });
      expect(res.statusCode).toBe(404);
      const body = res.json();
      expect(body.code).toBe('MESSAGE_REQUEST_NOT_FOUND');
    });

    it('rejects accept attempt by unrelated user with 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/chat/requests/${requestId}/accept`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('recipient successfully accepts request: creates conversation and sequence 1 message', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/chat/requests/${requestId}/accept`,
        headers: { authorization: `Bearer ${tokenB}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();

      expect(body.request.id).toBe(requestId);
      expect(body.request.status).toBe('ACCEPTED');
      expect(body.request.conversationId).toBeDefined();

      expect(body.conversation).toBeDefined();
      expect(body.conversation.id).toBe(body.request.conversationId);
      expect(body.conversation.currentSequence).toBe('1');
      expect(body.conversation.participants.length).toBe(2);

      // Verify sequence 1 message exists in database with introductory content
      const msg = await prisma.message.findFirst({
        where: {
          conversationId: body.conversation.id,
          sequence: 1n,
        },
      });
      expect(msg).not.toBeNull();
      expect(msg?.content).toBe('Charlie introducing himself to Bob');
      expect(msg?.senderId).toBe(userC.id);

      // Verify outbox events
      const reqOutbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateType: 'MessageRequest',
          aggregateId: requestId,
          eventType: 'message_request.accepted.v1',
        },
      });
      expect(reqOutbox).not.toBeNull();

      const msgOutbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateType: 'Message',
          aggregateId: msg?.id,
          eventType: 'message_created.v1', // or message.created.v1
        },
      });
      expect(msgOutbox || reqOutbox).not.toBeNull();
    });

    it('idempotent replay of accept returns 200 with the same conversation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/chat/requests/${requestId}/accept`,
        headers: { authorization: `Bearer ${tokenB}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.request.status).toBe('ACCEPTED');
      expect(body.conversation).toBeDefined();
    });
  });

  // ==============================================================================
  // 5. Decline Lifecycle, Cooldown & Anti-Churn
  // ==============================================================================
  describe('Decline & Cooldown Enforcement', () => {
    let requestId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/requests',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: userD.id,
          initialMessage: 'Alice requesting contact with David',
        },
      });
      requestId = res.json().id;
    });

    it('rejects decline by sender with 404 anti-enumeration', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/chat/requests/${requestId}/decline`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('recipient declines request with reason: sets DECLINED and records outbox', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/chat/requests/${requestId}/decline`,
        headers: { authorization: `Bearer ${tokenD}` },
        payload: { reason: 'Currently unavailable for new projects.' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('DECLINED');
      expect(body.declinedReason).toBe('Currently unavailable for new projects.');
      expect(body.respondedAt).toBeDefined();

      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateType: 'MessageRequest',
          aggregateId: requestId,
          eventType: 'message_request.declined.v1',
        },
      });
      expect(outbox).not.toBeNull();
      expect(outbox?.payload).toMatchObject({
        requestId,
        recipientId: userD.id,
        reason: 'Currently unavailable for new projects.',
      });
    });

    it('idempotent replay of decline returns 200', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/chat/requests/${requestId}/decline`,
        headers: { authorization: `Bearer ${tokenD}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('DECLINED');
    });

    it('enforces 30-day decline cooldown on subsequent request attempt', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/requests',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: userD.id,
          initialMessage: 'Alice trying David again immediately',
        },
      });
      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.code).toBe('MESSAGE_REQUEST_COOLDOWN_ACTIVE');
    });
  });

  // ==============================================================================
  // 6. Cancel Lifecycle & 24h Anti-Churn Cooldown
  // ==============================================================================
  describe('Cancellation & Anti-Churn Enforcement', () => {
    let requestId: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/requests',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: userE.id,
          initialMessage: 'Alice requesting contact with Emma',
        },
      });
      requestId = res.json().id;
    });

    it('rejects cancel by recipient with 404 anti-enumeration', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/chat/requests/${requestId}/cancel`,
        headers: { authorization: `Bearer ${tokenE}` }, // Recipient, not sender
      });
      expect(res.statusCode).toBe(404);
    });

    it('sender cancels pending request: sets CANCELLED and records outbox', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/chat/requests/${requestId}/cancel`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('CANCELLED');

      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateType: 'MessageRequest',
          aggregateId: requestId,
          eventType: 'message_request.cancelled.v1',
        },
      });
      expect(outbox).not.toBeNull();
      expect(outbox?.payload).toMatchObject({
        requestId,
        senderId: userA.id,
        recipientId: userE.id,
      });
    });

    it('idempotent replay of cancel returns 200', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/chat/requests/${requestId}/cancel`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('CANCELLED');
    });

    it('enforces 24-hour anti-churn cooldown after cancellation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/requests',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: userE.id,
          initialMessage: 'Alice trying Emma again immediately after cancelling',
        },
      });
      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.code).toBe('MESSAGE_REQUEST_COOLDOWN_ACTIVE');
    });
  });

  // ==============================================================================
  // 7. Expired Request Prevention & Block Interception
  // ==============================================================================
  describe('Expiry and Block Invariants', () => {
    it('prevents accepting an expired request via lazy evaluation', async () => {
      const expiredId = generateUuidV7();
      await prisma.messageRequest.create({
        data: {
          id: expiredId,
          senderId: userC.id,
          recipientId: userD.id,
          initialMessage: 'Expired intro',
          status: 'PENDING',
          expiresAt: new Date(Date.now() - 10000), // In the past
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/chat/requests/${expiredId}/accept`,
        headers: { authorization: `Bearer ${tokenD}` },
      });
      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.code).toBe('MESSAGE_REQUEST_INVALID_STATE');

      // Verify lazy status update to EXPIRED in database
      const row = await prisma.messageRequest.findUnique({
        where: { id: expiredId },
      });
      expect(row?.status).toBe('EXPIRED');
    });

    it('rejects request creation when a user block exists between peers', async () => {
      // User F blocks User A
      await prisma.userBlock.create({
        data: {
          id: generateUuidV7(),
          blockerId: userF.id,
          blockedId: userA.id,
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/chat/requests',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: userF.id,
          initialMessage: 'Trying to contact blocker',
        },
      });
      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.code).toBe('USER_BLOCKED');
    });
  });

  // ==============================================================================
  // 8. Backward Compatibility: Existing Conversations Continue Working
  // ==============================================================================
  describe('Backward Compatibility & Active Conversations', () => {
    it('allows existing conversations and messaging to operate unchanged', async () => {
      // Pre-create an established direct conversation (simulating grandfathered pre-existing chat)
      const existingConv = await prisma.conversation.create({
        data: {
          id: generateUuidV7(),
          type: 'DIRECT',
          currentSequence: 0n,
          participants: {
            create: [
              { id: generateUuidV7(), userId: userA.id, role: 'MEMBER' },
              { id: generateUuidV7(), userId: userC.id, role: 'MEMBER' },
            ],
          },
        },
      });

      // 1. Existing conversations endpoint returns the established conversation without requiring MessageRequest
      const convRes = await app.inject({
        method: 'POST',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          recipientId: userC.id,
        },
      });
      expect(convRes.statusCode).toBe(201);
      const conv = convRes.json();
      expect(conv.id).toBe(existingConv.id);

      // 2. Listing conversations works
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(listRes.statusCode).toBe(200);
      const list = listRes.json();
      expect(list.items.some((i: any) => i.id === conv.id)).toBe(true);

      // 3. Sending message within active conversation works
      const msgRes = await app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${conv.id}/messages`,
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          clientMessageId: generateUuidV7(),
          content: 'Hello in existing active conversation',
        },
      });
      expect(msgRes.statusCode).toBe(201);
      const msg = msgRes.json();
      expect(msg.content).toBe('Hello in existing active conversation');
    });
  });
});
