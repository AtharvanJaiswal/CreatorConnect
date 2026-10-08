import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fastify, { type FastifyInstance } from 'fastify';
import { rateLimiterPlugin } from './rate-limit.js';
import { RateLimiterService } from '../services/rate-limiter.service.js';
import { errorHandler } from './error-handler.js';
import { AppError } from '../errors/app-error.js';

describe('F-14 Rate Limiting Architecture & Defense-in-Depth', () => {
  let app: FastifyInstance;
  let limiterService: RateLimiterService;

  beforeEach(async () => {
    limiterService = new RateLimiterService();
    limiterService.clearMemoryFallback();

    app = fastify({
      trustProxy: ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
    });

    app.setErrorHandler(errorHandler);

    await app.register(rateLimiterPlugin, { limiterService });

    // Mock authenticated decorator for testing
    app.decorate('fakeAuth', (userId: string) => async (req: any) => {
      req.user = { id: userId, roles: ['CREATOR'] };
    });

    // 1. Authenticated route
    app.post(
      '/api/test/auth-route',
      {
        preHandler: [
          async (req: any) => {
            if (req.headers['x-mock-user-id']) {
              req.user = { id: req.headers['x-mock-user-id'], roles: ['CREATOR'] };
            }
          },
          app.rateLimit({
            endpoint: 'test-auth',
            max: 3,
            windowSeconds: 60,
            onRedisFailure: 'bounded-fallback',
            fallbackMax: 3,
            disableTestMultiplier: true,
          }),
        ],
      },
      async () => ({ success: true }),
    );

    // 2. Anonymous route
    app.get(
      '/api/test/anon-route',
      {
        preHandler: [
          app.rateLimit({
            endpoint: 'test-anon',
            max: 2,
            windowSeconds: 60,
            onRedisFailure: 'bounded-fallback',
            fallbackMax: 2,
            disableTestMultiplier: true,
          }),
        ],
      },
      async () => ({ success: true }),
    );

    // 3. Security-sensitive fail-closed route
    app.post(
      '/api/test/fail-closed-route',
      {
        preHandler: [
          app.rateLimit({
            endpoint: 'test-fail-closed',
            max: 5,
            windowSeconds: 60,
            onRedisFailure: 'fail-closed',
            disableTestMultiplier: true,
          }),
        ],
      },
      async () => ({ success: true }),
    );

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('enforces anonymous rate limiting per IP and emits RFC 7807 429 with Retry-After header', async () => {
    const ip = '198.51.100.10';

    // Request 1: allowed
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/test/anon-route',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': ip },
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.headers['x-ratelimit-limit']).toBe('2');
    expect(res1.headers['x-ratelimit-remaining']).toBe('1');

    // Request 2: allowed
    const res2 = await app.inject({
      method: 'GET',
      url: '/api/test/anon-route',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': ip },
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.headers['x-ratelimit-remaining']).toBe('0');

    // Request 3: rejected with 429 RFC 7807
    const res3 = await app.inject({
      method: 'GET',
      url: '/api/test/anon-route',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': ip },
    });
    expect(res3.statusCode).toBe(429);
    expect(res3.headers['content-type']).toContain('application/problem+json');
    expect(res3.headers['retry-after']).toBeDefined();

    const body = res3.json();
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.status).toBe(429);
    expect(body.title).toBe('Rate Limit Exceeded');
  });

  it('enforces authenticated rate limiting keyed by verified user ID regardless of IP changes', async () => {
    const userId = 'usr_01923847291823';

    for (let i = 0; i < 3; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/test/auth-route',
        remoteAddress: '127.0.0.1',
        headers: {
          'x-mock-user-id': userId,
          'x-forwarded-for': `198.51.100.${i + 1}`, // IP rotating but same user
        },
      });
      expect(res.statusCode).toBe(200);
    }

    // 4th request from same user ID rejected even from new IP
    const res4 = await app.inject({
      method: 'POST',
      url: '/api/test/auth-route',
      remoteAddress: '127.0.0.1',
      headers: {
        'x-mock-user-id': userId,
        'x-forwarded-for': '198.51.100.99',
      },
    });
    expect(res4.statusCode).toBe(429);
    expect(res4.json().code).toBe('RATE_LIMIT_EXCEEDED');

    // Different user ID from same IP is NOT blocked
    const resOther = await app.inject({
      method: 'POST',
      url: '/api/test/auth-route',
      remoteAddress: '127.0.0.1',
      headers: {
        'x-mock-user-id': 'usr_different_user',
        'x-forwarded-for': '198.51.100.99',
      },
    });
    expect(resOther.statusCode).toBe(200);
  });

  it('handles proxy topology correctly without treating all Next.js users as one IP', async () => {
    // Two different clients hitting through trusted Next.js proxy (127.0.0.1)
    const clientA = '203.0.113.10';
    const clientB = '203.0.113.20';

    // Client A uses 2 requests (reaches limit)
    await app.inject({
      method: 'GET',
      url: '/api/test/anon-route',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': clientA },
    });
    await app.inject({
      method: 'GET',
      url: '/api/test/anon-route',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': clientA },
    });

    const clientABlocked = await app.inject({
      method: 'GET',
      url: '/api/test/anon-route',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': clientA },
    });
    expect(clientABlocked.statusCode).toBe(429);

    // Client B from different IP behind same Next.js proxy is NOT blocked
    const clientBAllowed = await app.inject({
      method: 'GET',
      url: '/api/test/anon-route',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': clientB },
    });
    expect(clientBAllowed.statusCode).toBe(200);
  });

  it('enforces fail-closed behavior on security-sensitive routes when Redis fails', async () => {
    // When limiter service is forced into disconnected state for fail-closed route
    const res = await app.inject({
      method: 'POST',
      url: '/api/test/fail-closed-route',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': '198.51.100.50' },
    });

    // In unit test where Redis client is not connected by default, fail-closed policy throws 503
    expect(res.statusCode).toBe(503);
    const body = res.json();
    expect(body.code).toBe('RATE_LIMIT_UNAVAILABLE');
    expect(body.status).toBe(503);
    expect(body.title).toBe('Service Unavailable');
  });

  it('enforces strict bounded in-memory fallback during Redis degradation', async () => {
    const ip = '198.51.100.88';

    // Route uses bounded-fallback with limit = 2
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/test/anon-route',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': ip },
    });
    expect(res1.statusCode).toBe(200);

    const res2 = await app.inject({
      method: 'GET',
      url: '/api/test/anon-route',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': ip },
    });
    expect(res2.statusCode).toBe(200);

    // Exceeded bounded fallback
    const res3 = await app.inject({
      method: 'GET',
      url: '/api/test/anon-route',
      remoteAddress: '127.0.0.1',
      headers: { 'x-forwarded-for': ip },
    });
    expect(res3.statusCode).toBe(429);
    expect(res3.json().code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
