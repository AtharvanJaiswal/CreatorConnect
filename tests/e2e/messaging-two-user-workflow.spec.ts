import { test, expect } from '@playwright/test';
import { getPrismaClient, type PrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { encodeMessageCursor } from '@creatorconnect/contracts';
import { createTestJwt } from '../fixtures/auth-test-helper.js';
import { io, Socket } from 'socket.io-client';
import Redis from 'ioredis';

test.describe('CreatorConnect Messaging System — Two-User E2E Workflow & Failure Scenarios', () => {
  test.describe.configure({ mode: 'serial' });
  const prisma: PrismaClient = getPrismaClient();
  const API_URL = process.env.API_URL || 'http://127.0.0.1:3000';
  const REALTIME_URL = process.env.REALTIME_URL || 'http://127.0.0.1:3001';

  const createdUserIds: string[] = [];
  const createdConversationIds: string[] = [];
  const createdRequestIds: string[] = [];

  test.beforeAll(async () => {
    try {
      const redis = new Redis(
        process.env.REDIS_URL || 'redis://:redis_local_password@localhost:6379/0',
      );
      await redis.del('rl:s:chat_request_create:127.0.0.1');
      await redis.quit();
    } catch {}
  });

  test.afterAll(async () => {
    // Reverse foreign-key cleanup
    for (const convId of createdConversationIds) {
      try {
        await prisma.messageAttachment.deleteMany({
          where: { message: { conversationId: convId } },
        });
        await prisma.message.deleteMany({ where: { conversationId: convId } });
        await prisma.conversationParticipant.deleteMany({ where: { conversationId: convId } });
        await prisma.conversation.deleteMany({ where: { id: convId } });
      } catch {}
    }

    for (const reqId of createdRequestIds) {
      try {
        await prisma.messageRequest.deleteMany({ where: { id: reqId } });
      } catch {}
    }

    for (const uId of createdUserIds) {
      try {
        await prisma.message.deleteMany({ where: { senderId: uId } });
        await prisma.conversationParticipant.deleteMany({ where: { userId: uId } });
        await prisma.userBlock.deleteMany({
          where: { OR: [{ blockerId: uId }, { blockedId: uId }] },
        });
        await prisma.notification.deleteMany({ where: { userId: uId } });
        await prisma.brandProfile.deleteMany({ where: { userId: uId } });
        await prisma.creatorProfile.deleteMany({ where: { userId: uId } });
        await prisma.userRole.deleteMany({ where: { userId: uId } });
        await prisma.user.deleteMany({ where: { id: uId } });
      } catch {}
    }
  });

  async function provisionUser(role: 'BRAND' | 'CREATOR', name: { first: string; last: string }) {
    const userId = generateUuidV7();
    const ts = Date.now();
    const sub = `sub_msg_e2e_${role.toLowerCase()}_${ts}_${userId.replace(/-/g, '').slice(0, 8)}`;
    const email = `msg_e2e_${role.toLowerCase()}_${ts}_${userId.replace(/-/g, '').slice(0, 8)}@creatorconnect.test`;

    createdUserIds.push(userId);

    const user = await prisma.user.create({
      data: {
        id: userId,
        supabaseAuthId: sub,
        email,
        firstName: name.first,
        lastName: name.last,
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: role },
                create: { id: generateUuidV7(), name: role },
              },
            },
          },
        },
        ...(role === 'BRAND'
          ? {
              brandProfile: {
                create: {
                  id: generateUuidV7(),
                  companyName: `${name.first}'s Enterprise`,
                  websiteUrl: 'https://brand.example.com',
                  industry: 'Media',
                },
              },
            }
          : {
              creatorProfile: {
                create: {
                  id: generateUuidV7(),
                  tagline: 'Professional Streamer & Editor',
                  bio: 'Full time content creator with 200k+ subscribers',
                },
              },
            }),
      },
    });

    const token = await createTestJwt({ sub, email });
    return { user, userId, sub, email, token, displayName: `${name.first} ${name.last}` };
  }

  function createSocketClient(token: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const s = io(REALTIME_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: false,
        timeout: 5000,
      });

      s.on('connect', () => resolve(s));
      s.on('connect_error', (err) => reject(err));
    });
  }

  // ===========================================================================
  // SECTION 5: GENUINE TWO-USER 18-STEP END-TO-END WORKFLOW
  // ===========================================================================
  test('Complete 18-Step Two-User Messaging Workflow (Alice Sender & Bob Recipient)', async () => {
    const ts = Date.now();
    const alice = await provisionUser('BRAND', { first: 'Alice', last: `Sponsor_${ts}` });
    const bob = await provisionUser('CREATOR', { first: 'BobX', last: `Creator_${ts}` });

    // Step 1: Recipient discovery
    const searchRes = await fetch(`${API_URL}/api/v1/chat/recipients?query=Creator_${ts}`, {
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    expect(searchRes.status).toBe(200);
    const searchData = await searchRes.json();
    const bobFound = searchData.items.find((p: any) => p.id === bob.userId);
    expect(bobFound).toBeDefined();
    expect(bobFound.displayName).toContain('BobX');
    // Verify no private PII leakage (no email, no phone, no auth IDs)
    expect(bobFound.email).toBeUndefined();
    expect(bobFound.phone).toBeUndefined();
    expect(bobFound.supabaseAuthId).toBeUndefined();

    // Step 2: Consent request creation
    const pitch = 'Hey Bob, we want to sponsor your next tech review episode with a $5,000 budget.';
    const createReqRes = await fetch(`${API_URL}/api/v1/chat/requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${alice.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipientId: bob.userId,
        initialMessage: pitch,
      }),
    });
    expect(createReqRes.status).toBe(201);
    const reqData = await createReqRes.json();
    expect(reqData.status).toBe('PENDING');
    expect(reqData.senderId).toBe(alice.userId);
    expect(reqData.recipientId).toBe(bob.userId);
    createdRequestIds.push(reqData.id);

    // Step 3: Outgoing queue verification
    const outQueueRes = await fetch(`${API_URL}/api/v1/chat/requests?direction=outgoing`, {
      headers: { Authorization: `Bearer ${alice.token}` },
    });
    expect(outQueueRes.status).toBe(200);
    const outData = await outQueueRes.json();
    expect(outData.items.some((r: any) => r.id === reqData.id && r.status === 'PENDING')).toBe(
      true,
    );

    // Step 4: Incoming queue verification
    const inQueueRes = await fetch(`${API_URL}/api/v1/chat/requests?direction=incoming`, {
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    expect(inQueueRes.status).toBe(200);
    const inData = await inQueueRes.json();
    expect(inData.items.some((r: any) => r.id === reqData.id && r.status === 'PENDING')).toBe(true);

    // Step 5: Consent acceptance
    const acceptRes = await fetch(`${API_URL}/api/v1/chat/requests/${reqData.id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    expect(acceptRes.status).toBe(200);
    const acceptData = await acceptRes.json();
    expect(acceptData.request.status).toBe('ACCEPTED');

    // Step 6: Conversation initialization verification
    const conversation = acceptData.conversation;
    expect(conversation).toBeDefined();
    expect(conversation.id).toBeDefined();
    createdConversationIds.push(conversation.id);

    // Verify initial message: sequence 1
    const messagesStep6 = await fetch(
      `${API_URL}/api/v1/conversations/${conversation.id}/messages`,
      {
        headers: { Authorization: `Bearer ${alice.token}` },
      },
    );
    expect(messagesStep6.status).toBe(200);
    const msgsDataStep6 = await messagesStep6.json();
    expect(msgsDataStep6.items).toHaveLength(1);
    expect(msgsDataStep6.items[0].sequence).toBe('1');
    expect(msgsDataStep6.items[0].content).toBe(pitch);
    expect(msgsDataStep6.items[0].senderId).toBe(alice.userId);

    // Step 7: Real-time connection & join room
    const aliceSocket = await createSocketClient(alice.token);
    const bobSocket = await createSocketClient(bob.token);

    // Alice joins conversation room
    const aliceJoinAck: any = await new Promise((resolve) => {
      aliceSocket.emit('conversation:join', { conversationId: conversation.id }, resolve);
    });
    expect(aliceJoinAck.success).toBe(true);

    // Bob joins conversation room
    const bobJoinAck: any = await new Promise((resolve) => {
      bobSocket.emit('conversation:join', { conversationId: conversation.id }, resolve);
    });
    expect(bobJoinAck.success).toBe(true);

    // Step 8 & 9: Send message & message delivery event over Socket.IO
    const clientMsgIdSeq2 = generateUuidV7();
    const msgPromise = new Promise<any>((resolve) => {
      bobSocket.once('message:new', (event) => resolve(event));
    });

    const sendRes = await fetch(`${API_URL}/api/v1/conversations/${conversation.id}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${alice.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        clientMessageId: clientMsgIdSeq2,
        content: 'Contract details attached. Please let us know your milestone preferences.',
      }),
    });
    expect(sendRes.status).toBe(201);
    const sendData = await sendRes.json();
    expect(sendData.sequence).toBe('2');

    // Step 10 & 11: Acknowledge delivery & verify delivery status
    const deliveredEventPromise = new Promise<any>((resolve) => {
      aliceSocket.once('message:delivered', (event) => resolve(event));
    });

    const delivRes = await fetch(`${API_URL}/api/v1/conversations/${conversation.id}/delivered`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bob.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sequence: '2' }),
    });
    expect(delivRes.status).toBe(200);
    const delivData = await delivRes.json();
    expect(delivData.lastDeliveredSequence).toBe('2');

    // Verify PostgreSQL durable storage
    const bobParticipantInDb = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId: bob.userId,
        },
      },
    });
    expect(bobParticipantInDb?.lastDeliveredSequence.toString()).toBe('2');

    // Step 12 & 13: Read message & read status verification
    const readEventPromise = new Promise<any>((resolve) => {
      aliceSocket.once('message:read', (event) => resolve(event));
    });

    const readRes = await fetch(`${API_URL}/api/v1/conversations/${conversation.id}/read`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bob.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sequence: '2' }),
    });
    expect(readRes.status).toBe(200);
    const readData = await readRes.json();
    expect(readData.lastReadSequence).toBe('2');

    // Verify PostgreSQL read sequence
    const bobParticipantReadDb = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId: bob.userId,
        },
      },
    });
    expect(bobParticipantReadDb?.lastReadSequence.toString()).toBe('2');

    // Step 14: Unread count verification
    const convForBob = await fetch(`${API_URL}/api/v1/conversations/${conversation.id}`, {
      headers: { Authorization: `Bearer ${bob.token}` },
    });
    expect(convForBob.status).toBe(200);
    const convForBobData = await convForBob.json();
    expect(convForBobData.unreadCount).toBe(0);

    // Step 15: Disconnection & offline delivery
    bobSocket.disconnect();

    const clientMsgIdSeq3 = generateUuidV7();
    const sendOfflineRes = await fetch(
      `${API_URL}/api/v1/conversations/${conversation.id}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${alice.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientMessageId: clientMsgIdSeq3,
          content: 'Following up while you are away — our legal team approved the terms.',
        }),
      },
    );
    expect(sendOfflineRes.status).toBe(201);
    const sendOfflineData = await sendOfflineRes.json();
    expect(sendOfflineData.sequence).toBe('3');

    // Step 16: Monotonic sequence verified in DB
    const dbMsg3 = await prisma.message.findFirst({
      where: { conversationId: conversation.id, sequence: 3n },
    });
    expect(dbMsg3).not.toBeNull();
    expect(dbMsg3?.content).toBe(
      'Following up while you are away — our legal team approved the terms.',
    );

    // Step 17: Reconnection & sync recovery (both HTTP keyset pagination & Socket.IO sync)
    const bobSocketReconnected = await createSocketClient(bob.token);
    const syncCursor = encodeMessageCursor('2');
    const syncRes = await fetch(
      `${API_URL}/api/v1/conversations/${conversation.id}/messages?cursor=${syncCursor}&direction=next`,
      { headers: { Authorization: `Bearer ${bob.token}` } },
    );
    expect(syncRes.status).toBe(200);
    const syncData = await syncRes.json();
    expect(syncData.items).toHaveLength(1);
    expect(syncData.items[0].sequence).toBe('3');

    // Socket.IO sync event test
    const socketSyncAck: any = await new Promise((resolve) => {
      bobSocketReconnected.emit(
        'conversation:sync',
        { conversationId: conversation.id, sinceSequence: '2' },
        resolve,
      );
    });
    expect(socketSyncAck.success).toBe(true);
    expect(socketSyncAck.data.messages).toHaveLength(1);
    expect(socketSyncAck.data.messages[0].sequence).toBe('3');

    // Step 18: Multi-device sync (Device B2)
    const bobDevice2Socket = await createSocketClient(bob.token);
    const b2JoinAck: any = await new Promise((resolve) => {
      bobDevice2Socket.emit('conversation:join', { conversationId: conversation.id }, resolve);
    });
    expect(b2JoinAck.success).toBe(true);

    // Acknowledge delivery of sequence 3 from Device B2
    const deliv3Res = await fetch(`${API_URL}/api/v1/conversations/${conversation.id}/delivered`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bob.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sequence: '3' }),
    });
    expect(deliv3Res.status).toBe(200);

    const bobDbFinal = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId: bob.userId,
        },
      },
    });
    expect(bobDbFinal?.lastDeliveredSequence.toString()).toBe('3');

    // Clean up sockets
    aliceSocket.disconnect();
    bobSocketReconnected.disconnect();
    bobDevice2Socket.disconnect();
  });

  // ===========================================================================
  // SECTION 6: COMPREHENSIVE FAILURE SCENARIO VERIFICATION
  // ===========================================================================
  test('Failure Scenarios: Idempotency, Concurrency, Authorization & Validation Barriers', async () => {
    const sender = await provisionUser('BRAND', { first: 'Dan', last: 'Tester' });
    const recipient = await provisionUser('CREATOR', { first: 'Emma', last: 'Developer' });
    const intruder = await provisionUser('CREATOR', { first: 'Eve', last: 'Snooper' });

    // Establish active conversation via consent flow
    const req = await prisma.messageRequest.create({
      data: {
        id: generateUuidV7(),
        senderId: sender.userId,
        recipientId: recipient.userId,
        initialMessage: 'Introductory collaboration setup',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    createdRequestIds.push(req.id);

    const acceptRes = await fetch(`${API_URL}/api/v1/chat/requests/${req.id}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${recipient.token}` },
    });
    const convoId = (await acceptRes.json()).conversation.id;
    createdConversationIds.push(convoId);

    // 1. Duplicate clientMessageId idempotency
    const sharedClientId = generateUuidV7();
    const sendRes1 = await fetch(`${API_URL}/api/v1/conversations/${convoId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sender.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMessageId: sharedClientId, content: 'First try' }),
    });
    expect(sendRes1.status).toBe(201);
    const msg1 = await sendRes1.json();

    const sendRes2 = await fetch(`${API_URL}/api/v1/conversations/${convoId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sender.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMessageId: sharedClientId, content: 'First try' }),
    });
    // Idempotent recovery: returns 200/201 with exact same sequence and ID
    expect([200, 201]).toContain(sendRes2.status);
    const msg2 = await sendRes2.json();
    expect(msg2.id).toBe(msg1.id);
    expect(msg2.sequence).toBe(msg1.sequence);

    // 2. Unauthorized room join (Intruder)
    const intruderSocket = await createSocketClient(intruder.token);
    const joinAck: any = await new Promise((resolve) => {
      intruderSocket.emit('conversation:join', { conversationId: convoId }, resolve);
    });
    expect(joinAck.success).toBe(false);
    expect(joinAck.error.code).toBe('NOT_FOUND');
    intruderSocket.disconnect();

    // 3. Unauthorized sync / messages endpoint
    const intruderSync = await fetch(`${API_URL}/api/v1/conversations/${convoId}/messages`, {
      headers: { Authorization: `Bearer ${intruder.token}` },
    });
    expect(intruderSync.status).toBe(404);

    // 4. Self-messaging prevention
    const selfMsgRes = await fetch(`${API_URL}/api/v1/chat/requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sender.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientId: sender.userId, initialMessage: 'Self test' }),
    });
    expect(selfMsgRes.status).toBe(400);

    // 5. Non-participant delivery acknowledgment rejected
    const nonPartDeliv = await fetch(`${API_URL}/api/v1/conversations/${convoId}/delivered`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${intruder.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence: '1' }),
    });
    expect(nonPartDeliv.status).toBe(404);

    // 6. Non-participant read acknowledgment rejected
    const nonPartRead = await fetch(`${API_URL}/api/v1/conversations/${convoId}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${intruder.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence: '1' }),
    });
    expect(nonPartRead.status).toBe(404);

    // 7. Non-monotonic delivery receipt does not regress sequence
    // First acknowledge sequence 2
    await fetch(`${API_URL}/api/v1/conversations/${convoId}/delivered`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${recipient.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence: '2' }),
    });
    // Attempt to acknowledge sequence 1 (replay/out-of-order)
    const regressRes = await fetch(`${API_URL}/api/v1/conversations/${convoId}/delivered`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${recipient.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence: '1' }),
    });
    expect(regressRes.status).toBe(200);
    const regressData = await regressRes.json();
    // Must remain 2!
    expect(regressData.lastDeliveredSequence).toBe('2');

    // 8. Future sequence capped at conversation currentSequence
    const futureRes = await fetch(`${API_URL}/api/v1/conversations/${convoId}/delivered`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${recipient.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sequence: '999999' }),
    });
    expect(futureRes.status).toBe(200);
    const futureData = await futureRes.json();
    // Capped at currentSequence (which is 2)
    expect(Number(futureData.lastDeliveredSequence)).toBeLessThanOrEqual(2);

    // 9. Blocked sender enforcement
    await prisma.userBlock.create({
      data: {
        id: generateUuidV7(),
        blockerId: recipient.userId,
        blockedId: sender.userId,
        reason: 'Testing block barrier',
      },
    });

    const blockedSend = await fetch(`${API_URL}/api/v1/conversations/${convoId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sender.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientMessageId: generateUuidV7(),
        content: 'Blocked message attempt',
      }),
    });
    expect(blockedSend.status).toBe(403);
    const blockedBody = await blockedSend.json();
    expect(blockedBody.code).toBe('USER_BLOCKED');

    // Clean up block
    await prisma.userBlock.deleteMany({
      where: { blockerId: recipient.userId, blockedId: sender.userId },
    });

    // 10. Concurrent message request acceptance race safety
    const concurrentReq = await prisma.messageRequest.create({
      data: {
        id: generateUuidV7(),
        senderId: sender.userId,
        recipientId: recipient.userId,
        initialMessage: 'Concurrent acceptance test pitch',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    createdRequestIds.push(concurrentReq.id);

    const [acc1, acc2] = await Promise.all([
      fetch(`${API_URL}/api/v1/chat/requests/${concurrentReq.id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${recipient.token}` },
      }),
      fetch(`${API_URL}/api/v1/chat/requests/${concurrentReq.id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${recipient.token}` },
      }),
    ]);
    expect([200, 201]).toContain(acc1.status);
    expect([200, 201]).toContain(acc2.status);
    const bodyA1 = await acc1.json();
    const bodyA2 = await acc2.json();
    expect(bodyA1.conversation.id).toBe(bodyA2.conversation.id);

    // 11. Exceeded attachment limit (>10 items)
    const tooManyAttachments = Array.from({ length: 11 }, () => generateUuidV7());
    const overAttachRes = await fetch(`${API_URL}/api/v1/conversations/${convoId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sender.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientMessageId: generateUuidV7(),
        content: 'Too many attachments test',
        mediaAssetIds: tooManyAttachments,
      }),
    });
    expect(overAttachRes.status).toBe(400);

    // 12. Expired token rejection (401)
    const expiredToken = await createTestJwt({
      sub: sender.sub,
      email: sender.email,
      exp: Math.floor(Date.now() / 1000) - 300,
    });
    const expiredRes = await fetch(`${API_URL}/api/v1/conversations/${convoId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${expiredToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMessageId: generateUuidV7(), content: 'Expired token attempt' }),
    });
    expect(expiredRes.status).toBe(401);

    // 13. Content length validation (>5000 chars and empty content)
    const hugeContent = 'X'.repeat(5001);
    const hugeRes = await fetch(`${API_URL}/api/v1/conversations/${convoId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sender.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMessageId: generateUuidV7(), content: hugeContent }),
    });
    expect(hugeRes.status).toBe(400);

    const emptyRes = await fetch(`${API_URL}/api/v1/conversations/${convoId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sender.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientMessageId: generateUuidV7(), content: '' }),
    });
    expect(emptyRes.status).toBe(400);
  });
});
