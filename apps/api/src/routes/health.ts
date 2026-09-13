import type { FastifyPluginAsync } from 'fastify';

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
      return {
        status: 'ready' as const,
        timestamp: new Date().toISOString(),
        services: {
          database: 'not_configured_phase_1',
          redis: 'not_configured_phase_1',
        },
      };
    },
  );
};
