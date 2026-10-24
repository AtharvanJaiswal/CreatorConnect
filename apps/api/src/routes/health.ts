import type { FastifyPluginAsync } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { redisCache } from '../services/redis-cache.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/health',
    {
      schema: {
        description: 'Liveness check probe',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok'] },
              timestamp: { type: 'string', format: 'date-time' },
              uptime: { type: 'number' },
            },
            required: ['status', 'timestamp', 'uptime'],
          },
        },
      },
    },
    async () => {
      return {
        status: 'ok' as const,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    },
  );

  fastify.get(
    '/ready',
    {
      schema: {
        description: 'Readiness check probe',
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ready', 'degraded'] },
              timestamp: { type: 'string', format: 'date-time' },
              services: {
                type: 'object',
                additionalProperties: { type: 'string' },
              },
            },
            required: ['status', 'timestamp', 'services'],
          },
        },
      },
    },
    async () => {
      let dbStatus = 'ok';
      let redisStatus = 'ok';

      try {
        const prisma = getPrismaClient();
        await prisma.$queryRawUnsafe('SELECT 1');
      } catch {
        dbStatus = 'degraded';
      }

      try {
        if (!redisCache.isRedisConnected()) {
          redisStatus = 'degraded';
        }
      } catch {
        redisStatus = 'degraded';
      }

      const isReady = dbStatus === 'ok' && redisStatus === 'ok';

      return {
        status: isReady ? ('ready' as const) : ('degraded' as const),
        timestamp: new Date().toISOString(),
        services: {
          database: dbStatus,
          redis: redisStatus,
        },
      };
    },
  );
};
