import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../test-utils/auth-test-helper.js';
import { getPrismaClient, UserStatus, RoleType } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';

describe('Concurrency-Safe Last Active Admin Invariant', () => {
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

  it('prohibits concurrent admin deactivations from eliminating the last active admin', async () => {
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleType.ADMIN } });

    // 1. Suspend ALL active admins from previous test runs.
    //    With singleFork: true in vitest.config.ts, spec files run serially in one process,
    //    so this updateMany cannot race against admins from other concurrently-running specs.
    await prisma.user.updateMany({
      where: {
        status: UserStatus.ACTIVE,
        userRoles: { some: { role: { name: RoleType.ADMIN } } },
      },
      data: { status: UserStatus.SUSPENDED },
    });

    // 2. Provision exactly TWO active administrators for this test.
    const adminAId = generateUuidV7();
    const adminASub = `sub_admin_a_concurrency_${Date.now()}`;
    const adminAEmail = `admin_a_concurrency_${Date.now()}@test.com`;

    const adminBId = generateUuidV7();
    const adminBSub = `sub_admin_b_concurrency_${Date.now()}`;
    const adminBEmail = `admin_b_concurrency_${Date.now()}@test.com`;

    await prisma.user.createMany({
      data: [
        { id: adminAId, supabaseAuthId: adminASub, email: adminAEmail, status: UserStatus.ACTIVE },
        { id: adminBId, supabaseAuthId: adminBSub, email: adminBEmail, status: UserStatus.ACTIVE },
      ],
    });

    await prisma.userRole.createMany({
      data: [
        { id: generateUuidV7(), userId: adminAId, roleId: adminRole.id },
        { id: generateUuidV7(), userId: adminBId, roleId: adminRole.id },
      ],
    });

    const adminAToken = await createTestJwt({ sub: adminASub, email: adminAEmail });
    const adminBToken = await createTestJwt({ sub: adminBSub, email: adminBEmail });

    // 3. Concurrently execute mutual suspension: Admin A suspends Admin B, Admin B suspends Admin A.
    const [resA, resB] = await Promise.all([
      app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${adminBId}/status`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { status: 'SUSPENDED' },
      }),
      app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${adminAId}/status`,
        headers: { authorization: `Bearer ${adminBToken}` },
        payload: { status: 'SUSPENDED' },
      }),
    ]);

    // One must succeed (200) and one must be rejected (400 LAST_ADMIN_LOCKOUT_PREVENTED)
    const statuses = [resA.statusCode, resB.statusCode];
    expect(statuses).toContain(200);
    expect(statuses).toContain(400);

    const rejectedResponse = resA.statusCode === 400 ? resA.json() : resB.json();
    expect(rejectedResponse.code).toBe('LAST_ADMIN_LOCKOUT_PREVENTED');

    // 4. Verify in PostgreSQL that at least one ACTIVE administrator remains
    const activeAdminsRemaining = await prisma.user.count({
      where: {
        status: UserStatus.ACTIVE,
        userRoles: {
          some: {
            role: { name: RoleType.ADMIN },
          },
        },
      },
    });

    expect(activeAdminsRemaining).toBeGreaterThanOrEqual(1);
  });
});
