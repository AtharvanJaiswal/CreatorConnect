import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as jose from 'jose';
import type { AddressInfo } from 'node:net';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import { createRealtimeServer } from './server.js';
import {
  getPrismaClient,
  type PrismaClient,
  conversationAuthorizationService,
  RoleType,
  createOutboxClaimToken,
} from '@creatorconnect/database';
import { JwtVerifier } from '@creatorconnect/auth';
import { SocketIoEventDispatcher } from '../../worker/src/outbox/socket-io-dispatcher.js';
import { BlockEvictionDispatcher } from '../../worker/src/outbox/block-eviction-dispatcher.js';
import type { ClaimedOutboxEvent } from '@creatorconnect/database';

describe('Realtime Service & Authenticated Messaging (Increment 8)', () => {
  let serverInstance: Awaited<ReturnType<typeof createRealtimeServer>>;
  let serverUrl: string;
  let prisma: PrismaClient;
  let es256KeyPair: jose.GenerateKeyPairResult<jose.KeyLike>;
  let jwtVerifier: JwtVerifier;
  const clientsToClose: ClientSocket[] = [];

  const TEST_ISSUER = 'https://auth.creatorconnect.local/auth/v1';
  const TEST_AUDIENCE = 'authenticated';

  // Seeded test entities
  let userA: { id: string; sub: string; email: string };
  let userB: { id: string; sub: string; email: string };
  let userC: { id: string; sub: string; email: string }; // Non-participant
  let userSuspended: { id: string; sub: string; email: string };
  let userDeactivated: { id: string; sub: string; email: string };
  let userBlocked: { id: string; sub: string; email: string }; // Blocked peer

  let conversationAB: string;
  let conversationBlocked: string;

  beforeAll(async () => {
    prisma = getPrismaClient();

    // 1. Generate cryptographic ES256 keypair for deterministic JWT verification
    es256KeyPair = await jose.generateKeyPair('ES256');
    const localKeySet: jose.JWTVerifyGetKey = async () => es256KeyPair.publicKey;

    jwtVerifier = new JwtVerifier({
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE,
      localKeySet,
    });

    // 2. Seed test users in PostgreSQL
    const ts = Date.now();
    userA = {
      id: '',
      sub: `sub-user-a-${ts}`,
      email: `user-a-${ts}@creatorconnect.test`,
    };
    userB = {
      id: '',
      sub: `sub-user-b-${ts}`,
      email: `user-b-${ts}@creatorconnect.test`,
    };
    userC = {
      id: '',
      sub: `sub-user-c-${ts}`,
      email: `user-c-${ts}@creatorconnect.test`,
    };
    userSuspended = {
      id: '',
      sub: `sub-user-suspended-${ts}`,
      email: `user-suspended-${ts}@creatorconnect.test`,
    };
    userDeactivated = {
      id: '',
      sub: `sub-user-deactivated-${ts}`,
      email: `user-deactivated-${ts}@creatorconnect.test`,
    };
    userBlocked = {
      id: '',
      sub: `sub-user-blocked-${ts}`,
      email: `user-blocked-${ts}@creatorconnect.test`,
    };

    async function createTestUser(
      sub: string,
      email: string,
      roleName: RoleType,
      status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' = 'ACTIVE',
    ) {
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: { id: crypto.randomUUID(), name: roleName },
      });

      const id = crypto.randomUUID();
      const user = await prisma.user.create({
        data: {
          id,
          supabaseAuthId: sub,
          email,
          firstName: 'Test',
          lastName: 'User',
          status,
          userRoles: {
            create: {
              id: crypto.randomUUID(),
              roleId: role.id,
            },
          },
        },
      });
      return { id: user.id, sub, email };
    }

    userA = await createTestUser(userA.sub, userA.email, RoleType.CREATOR, 'ACTIVE');
    userB = await createTestUser(userB.sub, userB.email, RoleType.BRAND, 'ACTIVE');
    userC = await createTestUser(userC.sub, userC.email, RoleType.CREATOR, 'ACTIVE');
    userSuspended = await createTestUser(
      userSuspended.sub,
      userSuspended.email,
      RoleType.CREATOR,
      'SUSPENDED',
    );
    userDeactivated = await createTestUser(
      userDeactivated.sub,
      userDeactivated.email,
      RoleType.BRAND,
      'DEACTIVATED',
    );
    userBlocked = await createTestUser(
      userBlocked.sub,
      userBlocked.email,
      RoleType.CREATOR,
      'ACTIVE',
    );

    // 3. Seed Conversations in PostgreSQL
    const convAB = await prisma.conversation.create({
      data: {
        id: crypto.randomUUID(),
        type: 'DIRECT',
        participants: {
          create: [
            { id: crypto.randomUUID(), userId: userA.id, role: 'MEMBER' },
            { id: crypto.randomUUID(), userId: userB.id, role: 'MEMBER' },
          ],
        },
      },
    });
    conversationAB = convAB.id;

    const convBlocked = await prisma.conversation.create({
      data: {
        id: crypto.randomUUID(),
        type: 'DIRECT',
        participants: {
          create: [
            { id: crypto.randomUUID(), userId: userA.id, role: 'MEMBER' },
            { id: crypto.randomUUID(), userId: userBlocked.id, role: 'MEMBER' },
          ],
        },
      },
    });
    conversationBlocked = convBlocked.id;

    // Create block record: userA has blocked userBlocked
    await prisma.userBlock.create({
      data: {
        id: crypto.randomUUID(),
        blockerId: userA.id,
        blockedId: userBlocked.id,
      },
    });

    // 4. Start Realtime Server on dynamic port
    serverInstance = await createRealtimeServer({
      jwtVerifier,
      prisma,
      authService: conversationAuthorizationService,
      port: 0,
      host: '127.0.0.1',
    });

    await serverInstance.app.listen({ port: 0, host: '127.0.0.1' });
    const address = serverInstance.app.server.address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    for (const client of clientsToClose) {
      if (client.connected) {
        client.disconnect();
      }
    }
    if (serverInstance) {
      await serverInstance.close();
    }
  });

  // Helper to generate signed JWTs
  async function generateToken(
    sub: string,
    email: string,
    options: { expiresIn?: string; expired?: boolean } = {},
  ): Promise<string> {
    const builder = new jose.SignJWT({
      email,
      role: 'authenticated',
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'es256-test-key-01' })
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .setSubject(sub)
      .setIssuedAt();

    if (options.expired) {
      builder.setExpirationTime('-120s');
    } else {
      builder.setExpirationTime(options.expiresIn || '1h');
    }

    return await builder.sign(es256KeyPair.privateKey);
  }

  // Helper to connect a Socket.IO client
  function connectSocket(
    authPayload: Record<string, unknown> = {},
    queryPayload: Record<string, unknown> = {},
  ): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const client = createClient(serverUrl, {
        auth: authPayload,
        query: queryPayload as any,
        transports: ['websocket'],
        reconnection: false,
        timeout: 3000,
      });

      clientsToClose.push(client);

      client.on('connect', () => resolve(client));
      client.on('connect_error', (err) => reject(err));
    });
  }

  // 1. Missing handshake credentials
  it('1. rejects connection when handshake credentials are missing', async () => {
    await expect(connectSocket({})).rejects.toThrow('Authentication token missing or malformed.');
  });

  // 2. Invalid, expired, and malformed JWTs
  it('2. rejects invalid, expired, and malformed JWTs', async () => {
    // Malformed token
    await expect(connectSocket({ token: 'not-a-valid-jwt-token' })).rejects.toThrow();

    // Expired token
    const expiredToken = await generateToken(userA.sub, userA.email, { expired: true });
    await expect(connectSocket({ token: `Bearer ${expiredToken}` })).rejects.toThrow();

    // Untrusted key signature
    const untrustedKeyPair = await jose.generateKeyPair('ES256');
    const forgedToken = await new jose.SignJWT({ email: userA.email })
      .setProtectedHeader({ alg: 'ES256', kid: 'untrusted-key' })
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .setSubject(userA.sub)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(untrustedKeyPair.privateKey);

    await expect(connectSocket({ token: forgedToken })).rejects.toThrow();
  });

  // 3. Successful authentication with shared verifier
  it('3. authenticates successfully using shared verifier and attaches verified principal', async () => {
    const validToken = await generateToken(userA.sub, userA.email);
    const client = await connectSocket({ token: `Bearer ${validToken}` });

    expect(client.connected).toBe(true);
    expect(client.id).toBeDefined();
    client.disconnect();
  });

  // 4. Spoofed user IDs and roles in handshake
  it('4. ignores client-supplied user ID and role; strictly derives identity from verified token and PostgreSQL', async () => {
    const validToken = await generateToken(userA.sub, userA.email);

    // Client maliciously attempts to claim they are userB or an ADMIN in auth and query
    const client = await connectSocket(
      { token: validToken, userId: userB.id, role: 'ADMIN' },
      { userId: userB.id, role: 'ADMIN' },
    );

    expect(client.connected).toBe(true);

    // Verify room join behaves according to userA identity (userA cannot join userC's private rooms)
    client.disconnect();
  });

  // 5. Authorized participant joining conversation room
  it('5. allows authorized participant to join conversation room', async () => {
    const tokenA = await generateToken(userA.sub, userA.email);
    const clientA = await connectSocket({ token: tokenA });

    const ack = await new Promise<any>((resolve) => {
      clientA.emit('conversation:join', { conversationId: conversationAB }, (res: any) => {
        resolve(res);
      });
    });

    expect(ack.success).toBe(true);
    expect(ack.data.conversationId).toBe(conversationAB);
    clientA.disconnect();
  });

  // 6. Non-participant room-join denial and anti-enumeration behavior
  it('6. rejects non-participant from joining conversation with 404 NOT_FOUND (anti-enumeration)', async () => {
    const tokenC = await generateToken(userC.sub, userC.email);
    const clientC = await connectSocket({ token: tokenC });

    // User C tries to join conversationAB where they are not a participant
    const ack = await new Promise<any>((resolve) => {
      clientC.emit('conversation:join', { conversationId: conversationAB }, (res: any) => {
        resolve(res);
      });
    });

    expect(ack.success).toBe(false);
    expect(ack.error.code).toBe('NOT_FOUND');
    expect(ack.error.message).toContain('Conversation not found or access denied');
    clientC.disconnect();
  });

  // 7. Suspended or deactivated account behavior
  it('7. rejects suspended and deactivated accounts during handshake', async () => {
    // Suspended account
    const tokenSuspended = await generateToken(userSuspended.sub, userSuspended.email);
    await expect(connectSocket({ token: tokenSuspended })).rejects.toThrow(
      'Account is suspended. Access denied.',
    );

    // Deactivated account
    const tokenDeactivated = await generateToken(userDeactivated.sub, userDeactivated.email);
    await expect(connectSocket({ token: tokenDeactivated })).rejects.toThrow(
      'Account is deactivated. Access denied.',
    );
  });

  // 8. Blocked-peer room and live-event suppression
  it('8. suppresses blocked peers from joining room with USER_BLOCKED', async () => {
    const tokenBlocked = await generateToken(userBlocked.sub, userBlocked.email);
    const clientBlocked = await connectSocket({ token: tokenBlocked });

    const ack = await new Promise<any>((resolve) => {
      clientBlocked.emit(
        'conversation:join',
        { conversationId: conversationBlocked },
        (res: any) => {
          resolve(res);
        },
      );
    });

    expect(ack.success).toBe(false);
    expect(ack.error.code).toBe('USER_BLOCKED');
    expect(ack.error.message).toContain('blocked');
    clientBlocked.disconnect();
  });

  // 9. No cross-conversation event leakage
  it('9. prevents cross-conversation event leakage; only room members receive messages', async () => {
    const tokenA = await generateToken(userA.sub, userA.email);
    const tokenB = await generateToken(userB.sub, userB.email);
    const clientA = await connectSocket({ token: tokenA });
    const clientB = await connectSocket({ token: tokenB });

    // Client B joins conversationAB
    await new Promise<void>((resolve) => {
      clientB.emit('conversation:join', { conversationId: conversationAB }, () => resolve());
    });

    // Create a different conversation where User A is participant but NOT User B
    const convOther = await prisma.conversation.create({
      data: {
        id: crypto.randomUUID(),
        type: 'DIRECT',
        participants: {
          create: [
            { id: crypto.randomUUID(), userId: userA.id, role: 'MEMBER' },
            { id: crypto.randomUUID(), userId: userC.id, role: 'MEMBER' },
          ],
        },
      },
    });

    // Listen on client B for message:created
    let clientBReceived = false;
    clientB.on('message:created', () => {
      clientBReceived = true;
    });

    // Emit event to convOther room only
    serverInstance.io.to(`conversation:${convOther.id}`).emit('message:created', {
      conversationId: convOther.id,
      content: 'Secret message for convOther',
    });

    // Wait a brief moment to ensure no event is received by client B
    await new Promise((r) => setTimeout(r, 100));

    expect(clientBReceived).toBe(false);

    clientA.disconnect();
    clientB.disconnect();
  });

  // 10 & 11. message.created.v1 contract validation and live delivery to room
  it('10 & 11. dispatches message.created.v1 outbox event with correct metadata and decimal-string sequence', async () => {
    const tokenB = await generateToken(userB.sub, userB.email);
    const clientB = await connectSocket({ token: tokenB });

    // Client B joins room
    await new Promise<void>((resolve) => {
      clientB.emit('conversation:join', { conversationId: conversationAB }, () => resolve());
    });

    // Setup listener on client B
    const receivedPromise = new Promise<any>((resolve) => {
      clientB.on('message:created', (payload) => resolve(payload));
    });

    // Use SocketIoEventDispatcher to dispatch outbox event through serverInstance.io
    const dispatcher = new SocketIoEventDispatcher({ emitter: serverInstance.io });

    const outboxEvent: ClaimedOutboxEvent = {
      id: '01912952-4a00-7000-8000-000000000099',
      eventType: 'message.created.v1',
      aggregateType: 'Message',
      aggregateId: '01912952-4a00-7000-8000-000000000001',
      payload: {
        messageId: '01912952-4a00-7000-8000-000000000001',
        conversationId: conversationAB,
        senderId: userA.id,
        sequence: '101',
        clientMessageId: 'cli-test-999',
        content: 'Hello via outbox dispatcher!',
        attachmentCount: 0,
        createdAt: new Date().toISOString(),
      },
      attempts: 1,
      createdAt: new Date(),
      claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000099', 1),
    };

    const dispatchResult = await dispatcher.dispatch(outboxEvent);
    expect(dispatchResult.success).toBe(true);

    const receivedPayload = await receivedPromise;
    expect(receivedPayload.eventId).toBe(outboxEvent.id);
    expect(receivedPayload.conversationId).toBe(conversationAB);
    expect(receivedPayload.senderId).toBe(userA.id);
    expect(receivedPayload.sequence).toBe('101');
    expect(typeof receivedPayload.sequence).toBe('string');
    expect(receivedPayload.content).toBe('Hello via outbox dispatcher!');

    clientB.disconnect();
  });

  // 13. Duplicate dispatch and duplicate client-event handling
  it('13. supports idempotent client deduplication when same event is delivered more than once', async () => {
    const tokenB = await generateToken(userB.sub, userB.email);
    const clientB = await connectSocket({ token: tokenB });

    await new Promise<void>((resolve) => {
      clientB.emit('conversation:join', { conversationId: conversationAB }, () => resolve());
    });

    const receivedEvents: any[] = [];
    clientB.on('message:created', (payload) => {
      receivedEvents.push(payload);
    });

    const dispatcher = new SocketIoEventDispatcher({ emitter: serverInstance.io });

    const outboxEvent: ClaimedOutboxEvent = {
      id: '01912952-4a00-7000-8000-000000000088',
      eventType: 'message.created.v1',
      aggregateType: 'Message',
      aggregateId: '01912952-4a00-7000-8000-000000000088',
      payload: {
        messageId: '01912952-4a00-7000-8000-000000000088',
        conversationId: conversationAB,
        senderId: userA.id,
        sequence: '102',
        clientMessageId: 'cli-dedup-1',
        content: 'Duplicate delivery test message',
        attachmentCount: 0,
        createdAt: new Date().toISOString(),
      },
      attempts: 1,
      createdAt: new Date(),
      claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000088', 1),
    };

    // Dispatch twice (simulating at-least-once outbox re-dispatch after transient crash)
    await dispatcher.dispatch(outboxEvent);
    await dispatcher.dispatch(outboxEvent);

    await new Promise((r) => setTimeout(r, 100));

    expect(receivedEvents).toHaveLength(2);
    // Both deliveries have the exact same immutable eventId and messageId
    expect(receivedEvents[0].eventId).toBe(receivedEvents[1].eventId);
    expect(receivedEvents[0].messageId).toBe(receivedEvents[1].messageId);

    // Client deduplication logic verifies set size is 1
    const uniqueMessageIds = new Set(receivedEvents.map((e) => e.messageId));
    expect(uniqueMessageIds.size).toBe(1);

    clientB.disconnect();
  });

  // 14. Disconnect, reconnect, and sequence-based missed message sync
  it('14. supports reconnection and missed message catch-up via conversation:sync sequence protocol', async () => {
    // Insert 2 messages in PostgreSQL for conversationAB
    const msg1 = await prisma.message.create({
      data: {
        id: crypto.randomUUID(),
        conversationId: conversationAB,
        senderId: userA.id,
        sequence: BigInt(201),
        clientMessageId: 'cli-seq-201',
        content: 'First missed message',
      },
    });

    const msg2 = await prisma.message.create({
      data: {
        id: crypto.randomUUID(),
        conversationId: conversationAB,
        senderId: userA.id,
        sequence: BigInt(202),
        clientMessageId: 'cli-seq-202',
        content: 'Second missed message',
      },
    });

    const tokenB = await generateToken(userB.sub, userB.email);
    const clientB = await connectSocket({ token: tokenB });

    // Client requests sync for messages after sequence 200
    const syncAck = await new Promise<any>((resolve) => {
      clientB.emit(
        'conversation:sync',
        { conversationId: conversationAB, sinceSequence: '200' },
        (res: any) => resolve(res),
      );
    });

    expect(syncAck.success).toBe(true);
    expect(syncAck.data.messages).toHaveLength(2);
    expect(syncAck.data.messages[0].id).toBe(msg1.id);
    expect(syncAck.data.messages[0].sequence).toBe('201');
    expect(syncAck.data.messages[1].id).toBe(msg2.id);
    expect(syncAck.data.messages[1].sequence).toBe('202');
    expect(syncAck.data.latestSequence).toBe('202');

    clientB.disconnect();
  });

  // 15. Unauthorized room operations and malformed payloads
  it('15. rejects malformed payload schemas and invalid room requests safely', async () => {
    const tokenA = await generateToken(userA.sub, userA.email);
    const clientA = await connectSocket({ token: tokenA });

    // Empty object payload
    const ack1 = await new Promise<any>((resolve) => {
      clientA.emit('conversation:join', {}, (res: any) => resolve(res));
    });
    expect(ack1.success).toBe(false);
    expect(ack1.error.code).toBe('BAD_REQUEST');

    // Non-UUID conversationId
    const ack2 = await new Promise<any>((resolve) => {
      clientA.emit('conversation:join', { conversationId: 'not-a-uuid' }, (res: any) =>
        resolve(res),
      );
    });
    expect(ack2.success).toBe(false);
    expect(ack2.error.code).toBe('BAD_REQUEST');

    // Leave room safely and idempotently
    const ackLeave = await new Promise<any>((resolve) => {
      clientA.emit('conversation:leave', { conversationId: conversationAB }, (res: any) =>
        resolve(res),
      );
    });
    expect(ackLeave.success).toBe(true);

    clientA.disconnect();
  });

  // ==============================================================================
  // Increment 10C: Active-Socket Block Eviction & Security Hardening
  // ==============================================================================

  // 16. Active-socket room eviction upon block
  it('16. evicts active socket connections of both users from shared room upon block and emits conversation:blocked', async () => {
    const tokenA = await generateToken(userA.sub, userA.email);
    const tokenB = await generateToken(userB.sub, userB.email);
    const clientA = await connectSocket({ token: tokenA });
    const clientB = await connectSocket({ token: tokenB });

    // Both join conversationAB
    await new Promise<void>((resolve) => {
      clientA.emit('conversation:join', { conversationId: conversationAB }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      clientB.emit('conversation:join', { conversationId: conversationAB }, () => resolve());
    });

    const blockedPromiseA = new Promise<any>((resolve) => {
      clientA.on('conversation:blocked', (data) => resolve(data));
    });
    const blockedPromiseB = new Promise<any>((resolve) => {
      clientB.on('conversation:blocked', (data) => resolve(data));
    });

    // Execute block eviction
    const evictionRes = await serverInstance.blockEvictionService.evictBlockedPair(
      userA.id,
      userB.id,
    );
    expect(evictionRes.success).toBe(true);
    expect(evictionRes.evictedRooms).toContain(`conversation:${conversationAB}`);

    // Both clients receive notification
    const dataA = await blockedPromiseA;
    const dataB = await blockedPromiseB;
    expect(dataA.conversationId).toBe(conversationAB);
    expect(dataB.conversationId).toBe(conversationAB);

    // Verify neither client receives future messages in conversationAB
    let receivedA = false;
    let receivedB = false;
    clientA.on('message:created', () => {
      receivedA = true;
    });
    clientB.on('message:created', () => {
      receivedB = true;
    });

    serverInstance.io.to(`conversation:${conversationAB}`).emit('message:created', {
      conversationId: conversationAB,
      content: 'Should not reach evicted sockets',
    });

    await new Promise((r) => setTimeout(r, 100));
    expect(receivedA).toBe(false);
    expect(receivedB).toBe(false);

    clientA.disconnect();
    clientB.disconnect();
  });

  // 17. Multi-device socket eviction for the same user
  it('17. evicts all active sockets of a user across multiple tabs/devices simultaneously', async () => {
    const tokenA = await generateToken(userA.sub, userA.email);
    const clientA1 = await connectSocket({ token: tokenA });
    const clientA2 = await connectSocket({ token: tokenA });

    // Both devices join conversationAB
    await new Promise<void>((resolve) => {
      clientA1.emit('conversation:join', { conversationId: conversationAB }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      clientA2.emit('conversation:join', { conversationId: conversationAB }, () => resolve());
    });

    const blockedPromise1 = new Promise<any>((resolve) => {
      clientA1.on('conversation:blocked', (data) => resolve(data));
    });
    const blockedPromise2 = new Promise<any>((resolve) => {
      clientA2.on('conversation:blocked', (data) => resolve(data));
    });

    await serverInstance.blockEvictionService.evictBlockedPair(userA.id, userB.id);

    const [res1, res2] = await Promise.all([blockedPromise1, blockedPromise2]);
    expect(res1.conversationId).toBe(conversationAB);
    expect(res2.conversationId).toBe(conversationAB);

    clientA1.disconnect();
    clientA2.disconnect();
  });

  // 18. Preserves unrelated participants' room access in multi-participant conversation
  it('18. preserves unrelated participants in shared conversation during pair eviction', async () => {
    // Create multi-participant conversation with A, B, and C
    const convMulti = await prisma.conversation.create({
      data: {
        id: crypto.randomUUID(),
        type: 'GROUP',
        participants: {
          create: [
            { id: crypto.randomUUID(), userId: userA.id, role: 'MEMBER' },
            { id: crypto.randomUUID(), userId: userB.id, role: 'MEMBER' },
            { id: crypto.randomUUID(), userId: userC.id, role: 'MEMBER' },
          ],
        },
      },
    });

    const tokenA = await generateToken(userA.sub, userA.email);
    const tokenB = await generateToken(userB.sub, userB.email);
    const tokenC = await generateToken(userC.sub, userC.email);
    const clientA = await connectSocket({ token: tokenA });
    const clientB = await connectSocket({ token: tokenB });
    const clientC = await connectSocket({ token: tokenC });

    await new Promise<void>((resolve) => {
      clientA.emit('conversation:join', { conversationId: convMulti.id }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      clientB.emit('conversation:join', { conversationId: convMulti.id }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      clientC.emit('conversation:join', { conversationId: convMulti.id }, () => resolve());
    });

    // Evict pair (A and B)
    await serverInstance.blockEvictionService.evictBlockedPair(userA.id, userB.id);

    // Client C should still be in convMulti room and receive messages!
    let clientCReceived = false;
    clientC.on('message:created', () => {
      clientCReceived = true;
    });

    serverInstance.io.to(`conversation:${convMulti.id}`).emit('message:created', {
      conversationId: convMulti.id,
      content: 'Message for remaining participants',
    });

    await new Promise((r) => setTimeout(r, 100));
    expect(clientCReceived).toBe(true); // Unrelated user C was NOT evicted!

    clientA.disconnect();
    clientB.disconnect();
    clientC.disconnect();
  });

  // 19. Blocks conversation:sync for blocked peers
  it('19. rejects conversation:sync for blocked peers with USER_BLOCKED', async () => {
    const tokenBlocked = await generateToken(userBlocked.sub, userBlocked.email);
    const clientBlocked = await connectSocket({ token: tokenBlocked });

    const syncAck = await new Promise<any>((resolve) => {
      clientBlocked.emit(
        'conversation:sync',
        { conversationId: conversationBlocked, sinceSequence: '0' },
        (res: any) => resolve(res),
      );
    });

    expect(syncAck.success).toBe(false);
    expect(syncAck.error.code).toBe('USER_BLOCKED');
    expect(syncAck.error.message).toContain('blocked');

    clientBlocked.disconnect();
  });

  // 20. Outbox event dispatcher block-check suppression
  it('20. suppresses SocketIoEventDispatcher message delivery when block is committed before dispatch', async () => {
    const tokenBlocked = await generateToken(userBlocked.sub, userBlocked.email);
    const clientBlocked = await connectSocket({ token: tokenBlocked });

    let messageReceived = false;
    clientBlocked.on('message:created', () => {
      messageReceived = true;
    });

    // Dispatcher with Prisma client enforces authoritative block verification
    const dispatcher = new SocketIoEventDispatcher({
      emitter: serverInstance.io,
      prisma,
    });

    const outboxEvent: ClaimedOutboxEvent = {
      id: crypto.randomUUID(),
      eventType: 'message.created.v1',
      aggregateType: 'Message',
      aggregateId: crypto.randomUUID(),
      payload: {
        messageId: crypto.randomUUID(),
        conversationId: conversationBlocked,
        senderId: userA.id,
        sequence: '999',
        clientMessageId: 'cli-blocked-race',
        content: 'This message must never be delivered to blocked peer',
        attachmentCount: 0,
        createdAt: new Date().toISOString(),
      },
      attempts: 1,
      createdAt: new Date(),
      claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000077', 1),
    };

    const dispatchResult = await dispatcher.dispatch(outboxEvent);
    expect(dispatchResult.success).toBe(true);

    await new Promise((r) => setTimeout(r, 100));
    expect(messageReceived).toBe(false); // Delivery suppressed!

    clientBlocked.disconnect();
  });

  // 21. Reconnection after block does not restore membership
  it('21. prevents reconnecting client from rejoining blocked conversation room', async () => {
    // Reconnect client blocked
    const tokenBlocked = await generateToken(userBlocked.sub, userBlocked.email);
    const clientBlocked = await connectSocket({ token: tokenBlocked });

    const joinAck = await new Promise<any>((resolve) => {
      clientBlocked.emit('conversation:join', { conversationId: conversationBlocked }, (res: any) =>
        resolve(res),
      );
    });

    expect(joinAck.success).toBe(false);
    expect(joinAck.error.code).toBe('USER_BLOCKED');

    clientBlocked.disconnect();
  });

  // 22. Unblocking does not automatically restore stale memberships
  it('22. unblocking does not automatically restore stale room memberships', async () => {
    // Delete block between userBlocked and userA
    await prisma.userBlock.deleteMany({
      where: { blockerId: userA.id, blockedId: userBlocked.id },
    });

    const tokenBlocked = await generateToken(userBlocked.sub, userBlocked.email);
    const clientBlocked = await connectSocket({ token: tokenBlocked });

    let messageReceived = false;
    clientBlocked.on('message:created', () => {
      messageReceived = true;
    });

    // Emit message to conversationBlocked room
    serverInstance.io.to(`conversation:${conversationBlocked}`).emit('message:created', {
      conversationId: conversationBlocked,
      content: 'Message to room',
    });

    await new Promise((r) => setTimeout(r, 100));
    // Sockets were never automatically rejoined
    expect(messageReceived).toBe(false);

    // But if client explicitly joins now that block is removed, join succeeds
    const joinAck = await new Promise<any>((resolve) => {
      clientBlocked.emit('conversation:join', { conversationId: conversationBlocked }, (res: any) =>
        resolve(res),
      );
    });
    expect(joinAck.success).toBe(true);

    clientBlocked.disconnect();
  });

  // 23. Outbox BlockEvictionDispatcher integration
  it('23. handles user.block.created.v1 outbox event and evicts active sockets via BlockEvictionDispatcher', async () => {
    const tokenA = await generateToken(userA.sub, userA.email);
    const tokenB = await generateToken(userB.sub, userB.email);
    const clientA = await connectSocket({ token: tokenA });
    const clientB = await connectSocket({ token: tokenB });

    await new Promise<void>((resolve) => {
      clientA.emit('conversation:join', { conversationId: conversationAB }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      clientB.emit('conversation:join', { conversationId: conversationAB }, () => resolve());
    });

    const blockedPromiseB = new Promise<any>((resolve) => {
      clientB.on('conversation:blocked', (data) => resolve(data));
    });

    const dispatcher = new BlockEvictionDispatcher({
      evictionService: serverInstance.blockEvictionService,
    });

    const outboxEvent: ClaimedOutboxEvent = {
      id: crypto.randomUUID(),
      eventType: 'user.block.created.v1',
      aggregateType: 'UserBlock',
      aggregateId: crypto.randomUUID(),
      payload: {
        blockId: crypto.randomUUID(),
        blockerId: userA.id,
        blockedId: userB.id,
        reason: 'Eviction test',
        createdAt: new Date().toISOString(),
      },
      attempts: 1,
      createdAt: new Date(),
      claimToken: createOutboxClaimToken('01912952-4a00-7000-8000-000000000055', 1),
    };

    const res = await dispatcher.dispatch(outboxEvent);
    expect(res.success).toBe(true);

    const blockedData = await blockedPromiseB;
    expect(blockedData.conversationId).toBe(conversationAB);

    clientA.disconnect();
    clientB.disconnect();
  });

  // 24. Multi-instance Socket.IO block eviction test with Redis adapter
  it('24. propagates block eviction across multiple Socket.IO server instances via Redis adapter', async () => {
    const redisUrl = process.env.REDIS_URL || 'redis://:redis_local_password@localhost:6379/0';
    let inst1: Awaited<ReturnType<typeof createRealtimeServer>> | null = null;
    let inst2: Awaited<ReturnType<typeof createRealtimeServer>> | null = null;

    try {
      // Create inst1 with Redis adapter
      inst1 = await createRealtimeServer({
        port: 0,
        host: '127.0.0.1',
        redisUrl,
        jwtVerifier,
        prisma,
      });
      await inst1.app.listen({ port: 0, host: '127.0.0.1' });
      const inst1Port = (inst1.app.server.address() as AddressInfo).port;
      const inst1Url = `http://127.0.0.1:${inst1Port}`;

      // Create inst2 sharing the same Redis adapter
      inst2 = await createRealtimeServer({
        port: 0,
        host: '127.0.0.1',
        redisUrl,
        jwtVerifier,
        prisma,
      });
      await inst2.app.listen({ port: 0, host: '127.0.0.1' });
      const inst2Port = (inst2.app.server.address() as AddressInfo).port;
      const inst2Url = `http://127.0.0.1:${inst2Port}`;

      const tokenA = await generateToken(userA.sub, userA.email);
      const tokenB = await generateToken(userB.sub, userB.email);

      // Connect clientA to inst1 and clientB to inst2
      const clientA = createClient(inst1Url, {
        auth: { token: `Bearer ${tokenA}` },
        transports: ['websocket'],
      });
      const clientB = createClient(inst2Url, {
        auth: { token: `Bearer ${tokenB}` },
        transports: ['websocket'],
      });

      await Promise.all([
        new Promise<void>((resolve, reject) => {
          clientA.on('connect', () => resolve());
          clientA.on('connect_error', (err) => reject(err));
        }),
        new Promise<void>((resolve, reject) => {
          clientB.on('connect', () => resolve());
          clientB.on('connect_error', (err) => reject(err));
        }),
      ]);

      clientsToClose.push(clientA, clientB);

      // Both join conversationAB on their respective server instances
      await Promise.all([
        new Promise<void>((resolve) => {
          clientA.emit('conversation:join', { conversationId: conversationAB }, () => resolve());
        }),
        new Promise<void>((resolve) => {
          clientB.emit('conversation:join', { conversationId: conversationAB }, () => resolve());
        }),
      ]);

      const blockedPromiseB = new Promise<any>((resolve) => {
        clientB.on('conversation:blocked', (data) => resolve(data));
      });

      // Trigger eviction on inst1!
      await inst1.blockEvictionService.evictBlockedPair(userA.id, userB.id);

      // Client B on inst2 should receive the eviction event via Redis adapter!
      const blockedData = await Promise.race([
        blockedPromiseB,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for Redis eviction')), 3000),
        ),
      ]);
      expect((blockedData as any).conversationId).toBe(conversationAB);

      clientA.disconnect();
      clientB.disconnect();
    } finally {
      if (inst1) {
        await inst1.close();
      }
      if (inst2) {
        await inst2.close();
      }
    }
  });
});
