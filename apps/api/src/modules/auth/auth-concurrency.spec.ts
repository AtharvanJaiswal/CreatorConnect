import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';

describe('Auth Sync 25-Way Concurrency & Race-Safety Test (F-04)', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  const testSub = generateUuidV7();
  const testEmail = `concurrent_${Date.now()}@test.com`;
  let testToken: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    testToken = await createTestJwt({
      sub: testSub,
      email: testEmail,
    });
  });

  afterAll(async () => {
    // Cleanup created test records
    const user = await prisma.user.findUnique({ where: { supabaseAuthId: testSub } });
    if (user) {
      await prisma.auditLog.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
    }
    await app.close();
  });

  it('safely handles 25 concurrent /api/v1/auth/sync requests for the same new identity', async () => {
    const concurrency = 25;

    // Fire 25 concurrent requests simultaneously
    const requests = Array.from({ length: concurrency }).map(() =>
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/sync',
        headers: { authorization: `Bearer ${testToken}` },
        payload: {
          preferredRole: 'CREATOR',
        },
      }),
    );

    const responses = await Promise.all(requests);

    // 1. None should return 500 or any unexpected error
    for (const res of responses) {
      expect([200, 201]).toContain(res.statusCode);
      const body = res.json();
      expect(body.user).toBeDefined();
      expect(body.user.supabaseAuthId).toBe(testSub);
      expect(body.user.email).toBe(testEmail);
    }

    // Exactly one request was the new user creator (status 201), the rest resolved the existing identity (status 200)
    const createdCount = responses.filter((r) => r.statusCode === 201).length;
    expect(createdCount).toBe(1);

    // 2. Exactly one internal user must exist in PostgreSQL
    const usersInDb = await prisma.user.findMany({
      where: { supabaseAuthId: testSub },
    });
    expect(usersInDb.length).toBe(1);
    const internalUserId = usersInDb[0].id;

    // 3. Exactly one role assignment
    const rolesInDb = await prisma.userRole.findMany({
      where: { userId: internalUserId },
    });
    expect(rolesInDb.length).toBe(1);

    // 4. Exactly one USER_REGISTERED audit log record (no duplicate audit corruption)
    const auditLogsInDb = await prisma.auditLog.findMany({
      where: {
        userId: internalUserId,
        action: 'USER_REGISTERED',
      },
    });
    expect(auditLogsInDb.length).toBe(1);
  });
});
