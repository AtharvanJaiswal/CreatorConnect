import fastify, { type FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import pino from 'pino';
import type { JwtVerifier } from '@creatorconnect/auth';
import type { PrismaClient, ConversationAuthorizationService } from '@creatorconnect/database';
import { createSocketAuthMiddleware } from './auth/socket-auth.middleware.js';
import { registerConversationHandlers } from './handlers/conversation.handler.js';
import { BlockEvictionService } from './services/block-eviction.service.js';

export interface RealtimeServerOptions {
  port?: number | undefined;
  host?: string | undefined;
  redisUrl?: string | undefined;
  corsOrigin?: string | undefined;
  jwtVerifier?: JwtVerifier | undefined;
  prisma?: PrismaClient | undefined;
  authService?: ConversationAuthorizationService | undefined;
  skipAuth?: boolean | undefined;
}

export async function createRealtimeServer(options: RealtimeServerOptions = {}) {
  const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
  });

  const app: FastifyInstance = fastify({ logger: false });

  const io = new SocketIOServer(app.server, {
    cors: {
      origin: options.corsOrigin || '*',
      methods: ['GET', 'POST'],
    },
  });

  const blockEvictionService = new BlockEvictionService({
    io,
    prisma: options.prisma,
    logger,
  });

  let pubClient: Redis | null = null;
  let subClient: Redis | null = null;
  let hasConnectedOnce = false;
  let lastReconciledAt: string | null = null;
  let isReconciling = false;
  let reconciliationFailed = false;

  if (options.redisUrl) {
    try {
      const portSuffix = options.port ? `-${options.port}` : '';
      pubClient = new Redis(options.redisUrl, {
        lazyConnect: true,
        connectionName: `realtime${portSuffix}-pub`,
      });
      subClient = new Redis(options.redisUrl, {
        lazyConnect: true,
        connectionName: `realtime${portSuffix}-sub`,
      });

      pubClient.on('error', (err) => {
        logger.warn({ err: err?.message }, 'Redis pub client warning');
      });
      subClient.on('error', (err) => {
        logger.warn({ err: err?.message }, 'Redis sub client warning');
      });

      const triggerReconciliation = async () => {
        if (!hasConnectedOnce) {
          hasConnectedOnce = true;
          return;
        }

        if (isReconciling) {
          return;
        }

        // Both pub and sub must be in ready status for cluster operations
        if (pubClient?.status !== 'ready' || subClient?.status !== 'ready') {
          return;
        }

        logger.info('Redis connection restored; triggering local socket reconciliation');
        isReconciling = true;
        reconciliationFailed = false;
        try {
          await blockEvictionService.reconcileLocalSockets();
          lastReconciledAt = new Date().toISOString();
        } catch (err: any) {
          reconciliationFailed = true;
          logger.warn(
            { err: err?.message },
            'Failed during post-reconnection socket reconciliation',
          );
        } finally {
          isReconciling = false;
        }
      };

      pubClient.on('ready', () => {
        void triggerReconciliation();
      });
      subClient.on('ready', () => {
        void triggerReconciliation();
      });

      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Connected Socket.IO Redis adapter');
    } catch (err) {
      logger.warn({ err }, 'Redis connection failed; falling back to in-memory adapter');
    }
  }

  // 1. Handshake Authentication Middleware
  if (!options.skipAuth) {
    io.use(
      createSocketAuthMiddleware({
        jwtVerifier: options.jwtVerifier,
        prisma: options.prisma,
        logger,
      }),
    );
  }

  // Health endpoint for orchestrator / probes
  app.get('/health', async () => {
    const isRedisConfigured = Boolean(options.redisUrl);
    const isPubReady = pubClient ? pubClient.status === 'ready' : false;
    const isSubReady = subClient ? subClient.status === 'ready' : false;
    const isRedisReady = isPubReady && isSubReady;
    const isDegraded =
      isRedisConfigured && (!isRedisReady || isReconciling || reconciliationFailed);

    return {
      status: isDegraded ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      connections: io.engine.clientsCount,
      uptime: process.uptime(),
      realtime: {
        status: 'ready',
      },
      redisAdapter: {
        status: pubClient ? (isRedisReady ? 'ready' : pubClient.status) : 'disconnected',
        mode: isRedisReady ? 'redis-adapter' : 'in-memory-fallback',
        clusterOperationsAvailable: isRedisReady && !isReconciling && !reconciliationFailed,
        ...(lastReconciledAt ? { lastReconciledAt } : {}),
      },
    };
  });

  // 2. Connection and Room Management Lifecycle
  io.on('connection', async (socket) => {
    const userId = socket.data?.user?.id;
    if (userId) {
      // Automatically join personal user room for targeted notifications and cluster-wide eviction
      await socket.join(`user:${userId}`);
    }
    logger.debug({ socketId: socket.id, userId }, 'Socket client authenticated and connected');

    // Register room joining and conversation handlers
    registerConversationHandlers(socket, io, {
      authService: options.authService,
      prisma: options.prisma,
      logger,
    });

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, userId, reason }, 'Socket client disconnected');
    });
  });

  async function close() {
    logger.info('Closing Realtime service...');
    blockEvictionService.shutdown();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    if (pubClient) await pubClient.quit();
    if (subClient) await subClient.quit();
    await app.close();
    logger.info('Realtime service closed cleanly');
  }

  return { app, io, close, logger, pubClient, subClient, blockEvictionService };
}
