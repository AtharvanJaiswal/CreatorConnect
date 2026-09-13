import fastify, { type FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import pino from 'pino';

export interface RealtimeServerOptions {
  port?: number | undefined;
  host?: string | undefined;
  redisUrl?: string | undefined;
  corsOrigin?: string | undefined;
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

  let pubClient: Redis | null = null;
  let subClient: Redis | null = null;

  if (options.redisUrl) {
    try {
      pubClient = new Redis(options.redisUrl, { lazyConnect: true });
      subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Connected Socket.IO Redis adapter');
    } catch (err) {
      logger.warn({ err }, 'Redis connection failed; falling back to in-memory adapter');
    }
  }

  // Health endpoint for orchestrator / probes
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      connections: io.engine.clientsCount,
      uptime: process.uptime(),
    };
  });

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'Socket client connected');

    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'Socket client disconnected');
    });
  });

  async function close() {
    logger.info('Closing Realtime service...');
    await new Promise<void>((resolve) => io.close(() => resolve()));
    if (pubClient) await pubClient.quit();
    if (subClient) await subClient.quit();
    await app.close();
    logger.info('Realtime service closed cleanly');
  }

  return { app, io, close, logger };
}
