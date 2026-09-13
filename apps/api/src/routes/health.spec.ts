import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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

  it('GET /ready returns 200 with readiness status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ready',
    });

    expect(response.statusCode).toBe(200);
    const payload = JSON.parse(response.payload);
    expect(payload.status).toBe('ready');
    expect(payload.services).toBeDefined();
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
