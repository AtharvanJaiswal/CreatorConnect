import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';

describe('Health & Readiness Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 with status ok and uptime', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload.status).toBe('ok');
    expect(payload.timestamp).toBeDefined();
    expect(payload.uptime).toBeGreaterThanOrEqual(0);
  });

  it('GET /ready returns 200 with readiness status and ok services', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload.status).toBe('ready');
    expect(payload.services).toBeDefined();
    expect(payload.services.database).toBe('ok');
    expect(payload.services.redis).toBe('ok');
  });

  it('GET /ready returns degraded when database query fails', async () => {
    const { getPrismaClient } = await import('@creatorconnect/database');
    const prisma = getPrismaClient();
    const spy = vi
      .spyOn(prisma as any, '$queryRawUnsafe')
      .mockRejectedValue(new Error('Connection refused simulated outage'));

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.status).toBe('degraded');
      expect(payload.services.database).toBe('degraded');
    } finally {
      spy.mockRestore();
    }
  });

  it('GET /ready returns degraded when redis connection fails', async () => {
    const { redisCache } = await import('../services/redis-cache.js');
    const spy = vi.spyOn(redisCache, 'isRedisConnected').mockReturnValue(false);

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.status).toBe('degraded');
      expect(payload.services.redis).toBe('degraded');
    } finally {
      spy.mockRestore();
    }
  });

  it('404 route returns RFC 7807 problem details', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/non-existent-route',
    });

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    const payload = JSON.parse(response.payload);
    expect(payload.status).toBe(404);
    expect(payload.title).toBeDefined();
  });
});
