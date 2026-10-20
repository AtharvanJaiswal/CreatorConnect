import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  getPrismaClient,
  notificationRepository,
  type PrismaClient,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';
import { NotificationEventHandler } from '../../../../worker/src/notifications/notification-event-handler.js';

describe('Messaging & Notifications End-to-End Vertical Slice Journey', () => {
  let app: FastifyInstance;
  const prisma: PrismaClient = getPrismaClient();

  // Three test users: User A (Sender), User B (Recipient), User C (Unrelated outsider)
  let userA: { id: string; supabaseAuthId: string; email: string };
  let userB: { id: string; supabaseAuthId: string; email: string };
  let userC: { id: string; supabaseAuthId: string; email: string };

  let tokenA: string;
  let tokenB: string;
  let tokenC: string;

  let conversationId: string;
  let clientMessageId: string;
  let sentMessageId: string;
  let createdOutboxEventId: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    const ts = Date.now();

    // 1. Provision User A (Alice - Creator)
    const idA = generateUuidV7();
    const subA = `sub_e2e_a_${ts}`;
    const emailA = `alice_e2e_${ts}@test.com`;
    userA = await prisma.user.create({
      data: {
        id: idA,
        supabaseAuthId: subA,
        email: emailA,
        firstName: 'Alice',
        lastName: 'Sender',
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

    // 2. Provision User B (Bob - Brand Recipient)
    const idB = generateUuidV7();
    const subB = `sub_e2e_b_${ts}`;
    const emailB = `bob_e2e_${ts}@test.com`;
    userB = await prisma.user.create({
      data: {
        id: idB,
        supabaseAuthId: subB,
        email: emailB,
        firstName: 'Bob',
        lastName: 'Recipient',
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

    // 3. Provision User C (Charlie - Outsider)
    const idC = generateUuidV7();
    const subC = `sub_e2e_c_${ts}`;
    const emailC = `charlie_e2e_${ts}@test.com`;
    userC = await prisma.user.create({
      data: {
        id: idC,
        supabaseAuthId: subC,
        email: emailC,
        firstName: 'Charlie',
        lastName: 'Outsider',
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
    // Teardown test records
    await prisma.notification.deleteMany({
      where: { userId: { in: [userA.id, userB.id, userC.id] } },
    });
    await prisma.messageAttachment.deleteMany({});
    await prisma.message.deleteMany({});
    await prisma.outboxEvent.deleteMany({});
    await prisma.conversationParticipant.deleteMany({});
    await prisma.conversation.deleteMany({});
    await prisma.userRole.deleteMany({
      where: { userId: { in: [userA.id, userB.id, userC.id] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id, userC.id] } },
    });

    await app.close();
  });

  it('Step 1: User A sends a message to User B via authorized conversation', async () => {
    // 1a. User A creates canonical conversation with User B
    const convRes = await app.inject({
      method: 'POST',
      url: '/api/v1/conversations',
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        recipientId: userB.id,
      },
    });

    expect(convRes.statusCode).toBe(201);
    const conv = convRes.json();
    conversationId = conv.id;
    expect(conv.participants).toHaveLength(2);

    // 1b. User A sends message with client idempotency key
    clientMessageId = generateUuidV7();
    const sendRes = await app.inject({
      method: 'POST',
      url: `/api/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        clientMessageId,
        content: 'Hello Bob! This is an end-to-end verified delivery test.',
      },
    });

    expect(sendRes.statusCode).toBe(201);
    const msg = sendRes.json();
    sentMessageId = msg.id;
    expect(msg.conversationId).toBe(conversationId);
    expect(msg.senderId).toBe(userA.id);
    expect(msg.clientMessageId).toBe(clientMessageId);
    expect(msg.sequence).toBe('1');
    expect(msg.status).toBe('SENT');

    // 1c. Verify transactional outbox event was created in the same database transaction
    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: sentMessageId,
        eventType: 'message.created.v1',
      },
    });
    expect(outboxEvent).not.toBeNull();
    expect(outboxEvent?.status).toBe('PENDING');
    createdOutboxEventId = outboxEvent!.id;
  });

  it('Step 2: User B retrieves the persisted message history', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(listRes.statusCode).toBe(200);
    const body = listRes.json();
    expect(body.items).toHaveLength(1);
    const retrievedMsg = body.items[0];
    expect(retrievedMsg.id).toBe(sentMessageId);
    expect(retrievedMsg.senderId).toBe(userA.id);
    expect(retrievedMsg.content).toBe('Hello Bob! This is an end-to-end verified delivery test.');
    expect(retrievedMsg.sequence).toBe('1');
  });

  it('Step 3: Background outbox processing delivers the notification to User B', async () => {
    // 3a. Claim outbox event and process via NotificationEventHandler
    const claimedEvent = await prisma.outboxEvent.findUniqueOrThrow({
      where: { id: createdOutboxEventId },
    });

    const handler = new NotificationEventHandler({
      prisma,
      notificationRepo: notificationRepository,
    });

    const dispatchResult = await handler.dispatch(claimedEvent as any);
    expect(dispatchResult.success).toBe(true);

    // 3b. User B retrieves their notifications
    const notifRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${tokenB}` },
    });

    expect(notifRes.statusCode).toBe(200);
    const notifBody = notifRes.json();
    expect(notifBody.items.length).toBeGreaterThanOrEqual(1);
    expect(notifBody.unreadCount).toBeGreaterThanOrEqual(1);

    const receivedNotif = notifBody.items.find((n: any) => n.eventId === createdOutboxEventId);
    expect(receivedNotif).toBeDefined();
    expect(receivedNotif.userId).toBe(userB.id);
    expect(receivedNotif.type).toBe('MESSAGE_RECEIVED');
    expect(receivedNotif.data.conversationId).toBe(conversationId);
    expect(receivedNotif.data.messageId).toBe(sentMessageId);

    // 3c. User B marks notification as read
    const markReadRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${receivedNotif.id}/read`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(markReadRes.statusCode).toBe(200);
    expect(markReadRes.json().readAt).not.toBeNull();
  });

  it('Step 4: Unrelated User C cannot access the conversation, messages, or notifications', async () => {
    // 4a. User C cannot access conversation by ID (anti-enumeration 404)
    const getConvRes = await app.inject({
      method: 'GET',
      url: `/api/v1/conversations/${conversationId}`,
      headers: { authorization: `Bearer ${tokenC}` },
    });
    expect(getConvRes.statusCode).toBe(404);
    expect(getConvRes.json().code).toBe('CONVERSATION_NOT_FOUND');

    // 4b. User C cannot list messages of conversation (anti-enumeration 404)
    const listMsgRes = await app.inject({
      method: 'GET',
      url: `/api/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${tokenC}` },
    });
    expect(listMsgRes.statusCode).toBe(404);
    expect(listMsgRes.json().code).toBe('CONVERSATION_NOT_FOUND');

    // 4c. User C cannot send messages into conversation (anti-enumeration 404)
    const sendMsgRes = await app.inject({
      method: 'POST',
      url: `/api/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${tokenC}` },
      payload: {
        clientMessageId: generateUuidV7(),
        content: 'Intrusion message from User C',
      },
    });
    expect(sendMsgRes.statusCode).toBe(404);
    expect(sendMsgRes.json().code).toBe('CONVERSATION_NOT_FOUND');

    // 4d. User C's notification list does not leak User B's notification
    const cNotifRes = await app.inject({
      method: 'GET',
      url: '/api/v1/notifications',
      headers: { authorization: `Bearer ${tokenC}` },
    });
    expect(cNotifRes.statusCode).toBe(200);
    expect(cNotifRes.json().items).toHaveLength(0);

    // 4e. User C cannot mark User B's notification as read
    const bNotifs = await prisma.notification.findMany({ where: { userId: userB.id } });
    expect(bNotifs.length).toBeGreaterThan(0);
    const bNotifId = bNotifs[0].id;

    const cMarkReadRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${bNotifId}/read`,
      headers: { authorization: `Bearer ${tokenC}` },
    });
    expect(cMarkReadRes.statusCode).toBe(404);
    expect(cMarkReadRes.json().code).toBe('NOTIFICATION_NOT_FOUND');
  });

  it('Step 5: Retrying the message submission produces no duplicates or sequence gaps', async () => {
    // 5a. User A replays send message with the identical clientMessageId
    const replayRes = await app.inject({
      method: 'POST',
      url: `/api/v1/conversations/${conversationId}/messages`,
      headers: { authorization: `Bearer ${tokenA}` },
      payload: {
        clientMessageId,
        content: 'Hello Bob! This is an end-to-end verified delivery test.',
      },
    });

    expect(replayRes.statusCode).toBe(201);
    const replayed = replayRes.json();
    expect(replayed.id).toBe(sentMessageId);
    expect(replayed.sequence).toBe('1'); // Does not advance sequence

    // 5b. Verify message count in database is strictly 1
    const totalMessages = await prisma.message.count({
      where: { conversationId },
    });
    expect(totalMessages).toBe(1);

    // 5c. Worker re-executes handler for the same outbox event
    const claimedEvent = await prisma.outboxEvent.findUniqueOrThrow({
      where: { id: createdOutboxEventId },
    });

    const handler = new NotificationEventHandler({
      prisma,
      notificationRepo: notificationRepository,
    });

    const redeliverResult = await handler.dispatch(claimedEvent as any);
    expect(redeliverResult.success).toBe(true);

    // 5d. Verify notification count for User B is strictly 1 (idempotent deduplication)
    const totalNotifications = await prisma.notification.count({
      where: {
        userId: userB.id,
        eventId: createdOutboxEventId,
      },
    });
    expect(totalNotifications).toBe(1);
  });
});
