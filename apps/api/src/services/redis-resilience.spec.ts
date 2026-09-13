import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { defaultJwtVerifier } from './jwt-verifier.js';
import { redisCache } from './redis-cache.js';
import { createTestJwt, createTestKeySet } from '../test-utils/auth-test-helper.js';
import { getPrismaClient, UserStatus } from '@creatorconnect/database';

describe('Redis Cache Failure Resilience & Authoritative Status', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('denies access (403 USER_SUSPENDED) when Redis invalidation fails and stale cache exists', async () => {
    const sub = `sub_stale_cache_${Date.now()}`;
    const email = `stale_cache_${Date.now()}@test.com`;

    const token = await createTestJwt({ sub, email });

    // 1. Sync user (creates user in PostgreSQL as ACTIVE)
    const syncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(syncRes.statusCode).toBe(201);
    const userId = syncRes.json().user.id;

    // 2. Perform authenticated GET /users/me to warm up the Redis cache with ACTIVE status
    const firstGet = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(firstGet.statusCode).toBe(200);

    // 3. Mutate status in PostgreSQL authoritatively to SUSPENDED
    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.SUSPENDED },
    });

    // 4. Simulate Redis DEL failure / disconnect
    redisCache.simulateFailure(true);
    // Attempt invalidation which will record failure
    const evicted = await redisCache.invalidateUser(userId, sub);
    expect(evicted).toBe(false); // Invalidation failed as simulated!

    // Verify metrics recorded failure
    const metrics = redisCache.getMetrics();
    expect(metrics.invalidationFailures).toBeGreaterThanOrEqual(1);

    // 5. Subsequent request arrives with valid cryptographically signed token
    // Runtime semantics: PostgreSQL account-status check is authoritative;
    // stale Redis ACTIVE state must NEVER authorize the request!
    const subsequentRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(subsequentRes.statusCode).toBe(403);
    const body = subsequentRes.json();
    expect(body.code).toBe('USER_SUSPENDED');

    // Restore redisCache failure flag
    redisCache.simulateFailure(false);
  });
});
