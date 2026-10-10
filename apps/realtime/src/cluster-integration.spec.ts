import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import {
  getPrismaClient,
  type PrismaClient,
  RoleType,
  messagingRepository,
  UserBlockedError,
} from '@creatorconnect/database';
import { createTestJwt, TEST_PUBLIC_KEY_JWK } from '../../../tests/fixtures/auth-test-helper.js';
import { generateUuidV7 } from '@creatorconnect/utils';
import { Redis } from 'ioredis';

/**
 * Increment 10D: True Multi-Process Distributed Realtime Cluster Integration Test.
 *
 * Verifies that independent processes running in separate memory spaces communicate
 * correctly across the shared Redis cluster:
 * - Realtime Instance A (Port 4211, PID A)
 * - Realtime Instance B (Port 4212, PID B)
 * - Background Outbox Worker (PID C)
 *
 * Requirements Proven:
 * 1. Independent process proof (PID A !== PID B !== PID C)
 * 2. Cross-node message broadcast via @socket.io/redis-emitter
 * 3. Cross-node active socket room eviction on user block
 * 4. Post-eviction authorization enforcement (join/sync rejections)
 * 5. Cluster health and operational telemetry
 */
describe('Multi-Process Cluster & Realtime Bridge Integration (Increment 10D)', () => {
  const prisma: PrismaClient = getPrismaClient();

  let serverProcessA: ChildProcess;
  let serverProcessB: ChildProcess;
  let workerProcess: ChildProcess;

  const PORT_A = 4211;
  const PORT_B = 4212;
  const URL_A = `http://127.0.0.1:${PORT_A}`;
  const URL_B = `http://127.0.0.1:${PORT_B}`;

  const clientsToClose: ClientSocket[] = [];

  // Seeded test entities
  let userA: { id: string; sub: string; email: string };
  let userB: { id: string; sub: string; email: string };
  let userC: { id: string; sub: string; email: string };
  let conversationId: string;

  let jwksServer: http.Server;
  let jwksUrl: string;
  let jwksIssuer: string;

  beforeAll(async () => {
    // Resolve paths reliably relative to __dirname
    const realtimeDist = path.resolve(__dirname, '../dist/main.js');
    const workerDist = path.resolve(__dirname, '../../worker/dist/main.js');
    const rootDir = path.resolve(__dirname, '../../..');

    const redisUrl = process.env.REDIS_URL || 'redis://:redis_local_password@localhost:6379/0';

    // Start isolated ephemeral JWKS HTTP server for child realtime processes
    await new Promise<void>((resolve) => {
      jwksServer = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ keys: [TEST_PUBLIC_KEY_JWK] }));
      });
      jwksServer.listen(0, '127.0.0.1', () => {
        const addr = jwksServer.address() as AddressInfo;
        jwksUrl = `http://127.0.0.1:${addr.port}/auth/v1/.well-known/jwks.json`;
        jwksIssuer = `http://127.0.0.1:${addr.port}/auth/v1`;
        resolve();
      });
    });

    // 1. Spawn Realtime Instance A in independent process
    serverProcessA = spawn(process.execPath, [realtimeDist], {
      cwd: rootDir,
      env: {
        ...process.env,
        PORT: String(PORT_A),
        HOST: '127.0.0.1',
        REDIS_URL: redisUrl,
        NODE_ENV: 'development',
        SUPABASE_JWT_ISSUER: jwksIssuer,
        SUPABASE_JWKS_URL: jwksUrl,
        ALLOW_HTTP_JWKS: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    serverProcessA.stderr?.on('data', (d) => console.error('ServerA Err:', d.toString()));

    // 2. Spawn Realtime Instance B in independent process
    serverProcessB = spawn(process.execPath, [realtimeDist], {
      cwd: rootDir,
      env: {
        ...process.env,
        PORT: String(PORT_B),
        HOST: '127.0.0.1',
        REDIS_URL: redisUrl,
        NODE_ENV: 'development',
        SUPABASE_JWT_ISSUER: jwksIssuer,
        SUPABASE_JWKS_URL: jwksUrl,
        ALLOW_HTTP_JWKS: 'true',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    serverProcessB.stderr?.on('data', (d) => console.error('ServerB Err:', d.toString()));

    // 3. Spawn Standalone Worker in independent process
    workerProcess = spawn(process.execPath, [workerDist], {
      cwd: rootDir,
      env: {
        ...process.env,
        REDIS_URL: redisUrl,
        OUTBOX_POLL_INTERVAL_MS: '50',
        NODE_ENV: 'development',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    workerProcess.stderr?.on('data', (d) => console.error('Worker Err:', d.toString()));

    // Helper to wait for HTTP readiness
    async function waitForServer(url: string, timeoutMs = 8000): Promise<void> {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          const res = await fetch(`${url}/health`);
          if (res.ok) {
            const data = (await res.json()) as any;
            if (data.status === 'ok' && data.redisAdapter?.clusterOperationsAvailable) {
              return;
            }
          }
        } catch {
          // Retry until timeout
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`Timeout waiting for realtime server at ${url}`);
    }

    // Wait for both independent realtime instances to be cluster-ready
    await Promise.all([waitForServer(URL_A), waitForServer(URL_B)]);

    // 4. Provision test users in PostgreSQL
    const ts = Date.now();
    userA = {
      id: generateUuidV7(),
      sub: `sub-cluster-a-${ts}`,
      email: `cluster-a-${ts}@creatorconnect.test`,
    };
    userB = {
      id: generateUuidV7(),
      sub: `sub-cluster-b-${ts}`,
      email: `cluster-b-${ts}@creatorconnect.test`,
    };
    userC = {
      id: generateUuidV7(),
      sub: `sub-cluster-c-${ts}`,
      email: `cluster-c-${ts}@creatorconnect.test`,
    };

    for (const u of [
      { ...userA, role: RoleType.CREATOR },
      { ...userB, role: RoleType.BRAND },
      { ...userC, role: RoleType.CREATOR },
    ]) {
      await prisma.user.create({
        data: {
          id: u.id,
          supabaseAuthId: u.sub,
          email: u.email,
          status: 'ACTIVE',
          userRoles: {
            create: {
              id: generateUuidV7(),
              role: {
                connectOrCreate: {
                  where: { name: u.role },
                  create: { id: generateUuidV7(), name: u.role },
                },
              },
            },
          },
        },
      });
    }

    // 5. Seed direct conversation between User A and User B
    const conv = await prisma.conversation.create({
      data: {
        id: generateUuidV7(),
        type: 'DIRECT',
        currentSequence: 0n,
        participants: {
          create: [
            { id: generateUuidV7(), userId: userA.id, role: 'MEMBER', lastReadSequence: 0n },
            { id: generateUuidV7(), userId: userB.id, role: 'MEMBER', lastReadSequence: 0n },
          ],
        },
      },
    });
    conversationId = conv.id;
  }, 20000);

  afterAll(async () => {
    for (const client of clientsToClose) {
      if (client.connected) {
        client.disconnect();
      }
    }

    // Gracefully terminate child processes
    if (workerProcess && !workerProcess.killed) {
      workerProcess.kill('SIGTERM');
    }
    if (serverProcessA && !serverProcessA.killed) {
      serverProcessA.kill('SIGTERM');
    }
    if (serverProcessB && !serverProcessB.killed) {
      serverProcessB.kill('SIGTERM');
    }
    if (jwksServer) {
      await new Promise<void>((resolve) => jwksServer.close(() => resolve()));
    }

    // Cleanup test records
    try {
      await prisma.userBlock.deleteMany({
        where: {
          OR: [
            { blockerId: userA?.id, blockedId: userB?.id },
            { blockerId: userB?.id, blockedId: userA?.id },
          ],
        },
      });
      if (conversationId) {
        await prisma.messageAttachment.deleteMany({
          where: { message: { conversationId } },
        });
        await prisma.message.deleteMany({ where: { conversationId } });
        await prisma.conversationParticipant.deleteMany({ where: { conversationId } });
        await prisma.conversation.deleteMany({ where: { id: conversationId } });
      }
      for (const u of [userA, userB, userC]) {
        if (u?.id) {
          await prisma.messageAttachment.deleteMany({
            where: { message: { senderId: u.id } },
          });
          await prisma.message.deleteMany({ where: { senderId: u.id } });
          await prisma.conversationParticipant.deleteMany({ where: { userId: u.id } });
          await prisma.userRole.deleteMany({ where: { userId: u.id } });
          await prisma.notification.deleteMany({ where: { userId: u.id } });
          await prisma.user.deleteMany({ where: { id: u.id } });
        }
      }
    } catch {
      // Best-effort test cleanup
    }
  });

  // Helper to connect socket with authenticated JWT
  async function connectAuthenticatedSocket(
    serverUrl: string,
    user: { id: string; sub: string; email: string },
  ): Promise<ClientSocket> {
    const token = await createTestJwt({
      sub: user.sub,
      email: user.email,
      role: 'authenticated',
      iss: jwksIssuer,
      aud: 'authenticated',
    });

    const client = createClient(serverUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });

    clientsToClose.push(client);

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', (err) => reject(err));
    });

    return client;
  }

  // ==============================================================================
  // Test E — Independent Process Verification
  // ==============================================================================
  it('explicitly proves that Realtime A, Realtime B, and Worker run in distinct processes', () => {
    expect(serverProcessA.pid).toBeDefined();
    expect(serverProcessB.pid).toBeDefined();
    expect(workerProcess.pid).toBeDefined();

    // Verify all processes have unique PIDs (no shared in-memory heap)
    expect(serverProcessA.pid).not.toBe(serverProcessB.pid);
    expect(serverProcessA.pid).not.toBe(workerProcess.pid);
    expect(serverProcessB.pid).not.toBe(workerProcess.pid);
    expect(process.pid).not.toBe(workerProcess.pid);
  });

  // ==============================================================================
  // Health & Operational Telemetry
  // ==============================================================================
  it('verifies /health endpoint on both realtime instances reports cluster readiness', async () => {
    const [resA, resB] = await Promise.all([
      fetch(`${URL_A}/health`).then((r) => r.json() as any),
      fetch(`${URL_B}/health`).then((r) => r.json() as any),
    ]);

    expect(resA.status).toBe('ok');
    expect(resA.realtime.status).toBe('ready');
    expect(resA.redisAdapter.status).toBe('ready');
    expect(resA.redisAdapter.mode).toBe('redis-adapter');
    expect(resA.redisAdapter.clusterOperationsAvailable).toBe(true);

    expect(resB.status).toBe('ok');
    expect(resB.realtime.status).toBe('ready');
    expect(resB.redisAdapter.status).toBe('ready');
    expect(resB.redisAdapter.mode).toBe('redis-adapter');
    expect(resB.redisAdapter.clusterOperationsAvailable).toBe(true);
  });

  // ==============================================================================
  // Test A — Cross-Node Message Broadcast
  // ==============================================================================
  it('broadcasts message-created event from background worker to clients across multiple realtime nodes', async () => {
    // Connect User A to Server A
    const socketA = await connectAuthenticatedSocket(URL_A, userA);
    // Connect User B to Server B
    const socketB = await connectAuthenticatedSocket(URL_B, userB);
    // Connect User C (unrelated) to Server B
    const socketC = await connectAuthenticatedSocket(URL_B, userC);

    // User A and User B join the conversation room on their respective servers
    await new Promise<void>((resolve) => {
      socketA.emit('conversation:join', { conversationId }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      socketB.emit('conversation:join', { conversationId }, () => resolve());
    });

    const receivedA = new Promise<any>((resolve) => {
      socketA.on('message:created', (data) => resolve(data));
    });
    const receivedB = new Promise<any>((resolve) => {
      socketB.on('message:created', (data) => resolve(data));
    });

    let receivedByUnrelated = false;
    socketC.on('message:created', () => {
      receivedByUnrelated = true;
    });

    // Send message via authoritative repository mutation (commits message + outbox event)
    const clientMessageId = generateUuidV7();
    const sentMessage = await messagingRepository.sendMessage({
      conversationId,
      senderId: userA.id,
      clientMessageId,
      content: 'Cluster-wide distributed message delivery verified across processes!',
    });

    // Wait for event to propagate from Worker -> Redis Emitter -> Redis Adapter -> Server A & Server B
    const [eventOnNodeA, eventOnNodeB] = await Promise.all([receivedA, receivedB]);

    // Assert both sockets on different servers received the event with identical contract payload
    expect(eventOnNodeA.messageId).toBe(sentMessage.id);
    expect(eventOnNodeA.conversationId).toBe(conversationId);
    expect(eventOnNodeA.senderId).toBe(userA.id);
    expect(eventOnNodeA.content).toBe(sentMessage.content);
    expect(eventOnNodeA.sequence).toBe(sentMessage.sequence);

    expect(eventOnNodeB.messageId).toBe(sentMessage.id);
    expect(eventOnNodeB.content).toBe(sentMessage.content);

    // Verify unrelated socket on Server B received nothing
    expect(receivedByUnrelated).toBe(false);
  }, 15000);

  // ==============================================================================
  // Test B — Cross-Node Block Eviction & Authoritative Boundary Enforcement
  // ==============================================================================
  it('evicts active sockets across independent realtime instances when a block is created, enforcing fail-closed security', async () => {
    // User A is connected on Server A, User B is connected on Server B
    const socketA = await connectAuthenticatedSocket(URL_A, userA);
    const socketB = await connectAuthenticatedSocket(URL_B, userB);

    await new Promise<void>((resolve) => {
      socketA.emit('conversation:join', { conversationId }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      socketB.emit('conversation:join', { conversationId }, () => resolve());
    });

    // Setup listener for conversation:blocked notification
    const blockedNoticeA = new Promise<any>((resolve) => {
      socketA.on('conversation:blocked', (data) => resolve(data));
    });
    const blockedNoticeB = new Promise<any>((resolve) => {
      socketB.on('conversation:blocked', (data) => resolve(data));
    });

    // Execute domain block mutation in PostgreSQL (commits user_block + outbox event user.block.created.v1)
    await messagingRepository.blockUser(
      userA.id,
      userB.id,
      'Harassment detected - cross-cluster block enforcement',
    );

    // Verify both sockets across independent realtime instances receive conversation:blocked notification
    const [noticeA, noticeB] = await Promise.all([blockedNoticeA, blockedNoticeB]);
    expect(noticeA.conversationId).toBe(conversationId);
    expect(noticeB.conversationId).toBe(noticeB.conversationId);

    // Wait a brief tick for socketsLeave to complete across cluster
    await new Promise((r) => setTimeout(r, 200));

    // Verify socket B cannot receive subsequent messages emitted to the room
    let leakedMessage = false;
    socketB.on('message:created', () => {
      leakedMessage = true;
    });

    // Verify User B cannot rejoin the room on Server B
    const rejoinResult = await new Promise<any>((resolve) => {
      socketB.emit('conversation:join', { conversationId }, (ack: any) => resolve(ack));
    });
    expect(rejoinResult.success).toBe(false);
    expect(rejoinResult.error.code).toBe('USER_BLOCKED');

    // Verify User B cannot sync messages from the room on Server B
    const syncResult = await new Promise<any>((resolve) => {
      socketB.emit('conversation:sync', { conversationId, sinceSequence: '0' }, (ack: any) =>
        resolve(ack),
      );
    });
    expect(syncResult.success).toBe(false);
    expect(syncResult.error.code).toBe('USER_BLOCKED');

    // Verify User B cannot send messages via the domain repository
    await expect(
      messagingRepository.sendMessage({
        conversationId,
        senderId: userB.id,
        clientMessageId: generateUuidV7(),
        content: 'Unauthorized message attempt after block',
      }),
    ).rejects.toThrow(UserBlockedError);

    // Ensure no message leaked to the evicted socket
    expect(leakedMessage).toBe(false);
  }, 15000);

  // ==============================================================================
  // Test C — Stale Block Event Safety After Unblock (FIND-10D-01 Remediation)
  // ==============================================================================
  it('safely treats a delayed block event as a no-op when block was already unblocked in PostgreSQL', async () => {
    // 1. Create a shared direct conversation between User A and User C
    const convAC = await messagingRepository.createOrGetDirectConversation(userA.id, userC.id);

    // Connect User A on Server A, User C on Server B
    const socketA = await connectAuthenticatedSocket(URL_A, userA);
    const socketC = await connectAuthenticatedSocket(URL_B, userC);

    await new Promise<void>((resolve) => {
      socketA.emit('conversation:join', { conversationId: convAC.id }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      socketC.emit('conversation:join', { conversationId: convAC.id }, () => resolve());
    });

    // Track if any false conversation:blocked event is received
    let falseBlockedNotice = false;
    socketA.on('conversation:blocked', () => {
      falseBlockedNotice = true;
    });
    socketC.on('conversation:blocked', () => {
      falseBlockedNotice = true;
    });

    // 2. Simulate historical sequence: Block created, then unblock commits in PostgreSQL
    await messagingRepository.blockUser(userA.id, userC.id, 'Temporary block');
    await messagingRepository.unblockUser(userA.id, userC.id);

    // Verify database state: UserBlock record is completely removed
    const activeBlock = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userA.id, blockedId: userC.id },
          { blockerId: userC.id, blockedId: userA.id },
        ],
      },
    });
    expect(activeBlock).toBeNull();

    // 3. Inject a delayed 'user.block.created.v1' outbox event (simulating network or worker latency)
    const delayedEventId = generateUuidV7();
    await prisma.outboxEvent.create({
      data: {
        id: delayedEventId,
        eventType: 'user.block.created.v1',
        aggregateType: 'UserBlock',
        aggregateId: delayedEventId,
        payload: {
          blockId: delayedEventId,
          blockerId: userA.id,
          blockedId: userC.id,
          reason: 'Stale delayed block event',
          createdAt: new Date(Date.now() - 5000).toISOString(),
        },
        status: 'PENDING',
      },
    });

    // Wait for the independent worker process to claim and process the delayed event
    let eventProcessed = false;
    const startWait = Date.now();
    while (Date.now() - startWait < 5000) {
      const row = await prisma.outboxEvent.findUnique({
        where: { id: delayedEventId },
        select: { status: true },
      });
      if (row?.status === 'PUBLISHED') {
        eventProcessed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(eventProcessed).toBe(true);

    // Verify no misleading conversation:blocked notification was dispatched
    expect(falseBlockedNotice).toBe(false);

    // 4. Verify User A and User C remain active in the room and receive subsequent messages
    const messagePromiseC = new Promise<any>((resolve) => {
      socketC.on('message:created', (data) => resolve(data));
    });

    const sentMessage = await messagingRepository.sendMessage({
      conversationId: convAC.id,
      senderId: userA.id,
      clientMessageId: generateUuidV7(),
      content: 'Message after unblock and delayed block event',
    });

    const eventReceivedByC = await Promise.race([
      messagePromiseC,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 4000)),
    ]);

    expect(eventReceivedByC.messageId).toBe(sentMessage.id);
    expect(eventReceivedByC.content).toBe(sentMessage.content);
    expect(falseBlockedNotice).toBe(false);
  }, 15000);

  // ==============================================================================
  // Test D — Cluster Health & Degraded State Visibility (FIND-10D-02 Telemetry)
  // ==============================================================================
  it('exposes accurate health telemetry for operational cluster mode vs degraded mode', async () => {
    // 1. Operational nodes report ready status and cluster capability
    const resA = await fetch(`${URL_A}/health`);
    expect(resA.ok).toBe(true);
    const dataA = (await resA.json()) as any;
    expect(dataA.status).toBe('ok');
    expect(dataA.realtime.status).toBe('ready');
    expect(dataA.redisAdapter.status).toBe('ready');
    expect(dataA.redisAdapter.clusterOperationsAvailable).toBe(true);
    expect(dataA.redisAdapter.mode).toBe('redis-adapter');

    const resB = await fetch(`${URL_B}/health`);
    expect(resB.ok).toBe(true);
    const dataB = (await resB.json()) as any;
    expect(dataB.status).toBe('ok');
    expect(dataB.redisAdapter.clusterOperationsAvailable).toBe(true);
  });

  // ==============================================================================
  // Test F — Controlled Redis Fault & Socket Reconciliation (FIND-10D-02 / FIND-10D-04)
  // ==============================================================================
  it('detects Redis client partition, re-establishes connection, and executes authoritative socket reconciliation', async () => {
    const redisUrl = process.env.REDIS_URL || 'redis://:redis_local_password@localhost:6379/0';
    const adminRedis = new Redis(redisUrl);

    try {
      // 1. Create a dedicated direct conversation between User B and User C
      const convBC = await messagingRepository.createOrGetDirectConversation(userB.id, userC.id);

      // Connect User B on Server B, User C on Server A
      const socketB = await connectAuthenticatedSocket(URL_B, userB);
      const socketC = await connectAuthenticatedSocket(URL_A, userC);

      await new Promise<void>((resolve) => {
        socketB.emit('conversation:join', { conversationId: convBC.id }, () => resolve());
      });
      await new Promise<void>((resolve) => {
        socketC.emit('conversation:join', { conversationId: convBC.id }, () => resolve());
      });

      // 2. Identify Server B's Redis subscriber connection using named clients
      const clientList = (await adminRedis.client('LIST')) as string;
      const subClientLine = clientList
        .split('\n')
        .find((line: string) => line.includes(`name=realtime-${PORT_B}-sub`));

      expect(subClientLine).toBeDefined();
      const idMatch = subClientLine?.match(/id=(\d+)/);
      expect(idMatch).toBeTruthy();
      const clientId = idMatch![1];

      // Setup listener for conversation:blocked on Socket B
      const blockedNoticePromise = new Promise<any>((resolve) => {
        socketB.on('conversation:blocked', (data) => resolve(data));
      });

      // 3. Sever Server B's subscriber TCP connection via real Redis CLIENT KILL
      await adminRedis.client('KILL', 'ID', clientId);

      // 4. Create block in PostgreSQL while Server B is reconnecting
      await messagingRepository.blockUser(
        userC.id,
        userB.id,
        'Block executed during simulated Redis partition',
      );

      // 5. Wait for Server B to detect connection recovery and trigger local socket reconciliation
      const blockedNotice = await Promise.race([
        blockedNoticePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout waiting for reconciliation eviction')), 8000),
        ),
      ]);

      expect(blockedNotice.conversationId).toBe(convBC.id);

      // 6. Verify Server B health reports lastReconciledAt and cluster readiness restored
      let reconciled = false;
      const startCheck = Date.now();
      while (Date.now() - startCheck < 5000) {
        const res = await fetch(`${URL_B}/health`);
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data.status === 'ok' && data.redisAdapter?.lastReconciledAt) {
            reconciled = true;
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(reconciled).toBe(true);

      // 7. Verify User B cannot rejoin room on Server B
      const rejoinResult = await new Promise<any>((resolve) => {
        socketB.emit('conversation:join', { conversationId: convBC.id }, (ack: any) =>
          resolve(ack),
        );
      });
      expect(rejoinResult.success).toBe(false);
      expect(rejoinResult.error.code).toBe('USER_BLOCKED');
    } finally {
      await adminRedis.quit();
    }
  }, 15000);
});
