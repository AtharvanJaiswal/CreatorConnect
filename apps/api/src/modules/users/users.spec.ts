import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../test-utils/auth-test-helper.js';
import { getPrismaClient, UserStatus, RoleType } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';

describe('Users & Profile Integration Endpoints', () => {
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

  it('rejects unauthenticated calls to GET /api/v1/users/me with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('AUTH_INVALID_TOKEN');
  });

  it('rejects unsynced users with 401 IDENTITY_NOT_SYNCED', async () => {
    const token = await createTestJwt({ sub: 'unsynced_sub_999', email: 'unsynced@example.com' });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('IDENTITY_NOT_SYNCED');
  });

  it('returns profile and active roles for an authenticated ACTIVE user (200 OK)', async () => {
    const sub = `sub_active_${Date.now()}`;
    const email = `active_${Date.now()}@test.com`;

    // 1. Sync user
    const token = await createTestJwt({ sub, email });
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: { preferredRole: 'CREATOR' },
    });

    // 2. Fetch profile
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.email).toBe(email);
    expect(body.roles).toContain('CREATOR');
    expect(body.status).toBe('ACTIVE');
  });

  it('authoritatively rejects SUSPENDED users with 403 USER_SUSPENDED', async () => {
    const sub = `sub_suspended_${Date.now()}`;
    const email = `suspended_${Date.now()}@test.com`;

    // 1. Sync user
    const token = await createTestJwt({ sub, email });
    const syncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    const userId = syncRes.json().user.id;

    // 2. Update status in PostgreSQL directly to SUSPENDED
    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.SUSPENDED },
    });

    // 3. Request /users/me with valid cryptographically signed JWT
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('USER_SUSPENDED');
  });

  it('authoritatively rejects DEACTIVATED users with 403 USER_DEACTIVATED', async () => {
    const sub = `sub_deactivated_${Date.now()}`;
    const email = `deactivated_${Date.now()}@test.com`;

    const token = await createTestJwt({ sub, email });
    const syncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    const userId = syncRes.json().user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.DEACTIVATED },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('USER_DEACTIVATED');
  });

  it('updates profile via PATCH /api/v1/users/me (200 OK)', async () => {
    const sub = `sub_patch_${Date.now()}`;
    const email = `patch_${Date.now()}@test.com`;

    const token = await createTestJwt({ sub, email });
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        firstName: 'Sarah',
        lastName: 'Connor',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.firstName).toBe('Sarah');
    expect(body.lastName).toBe('Connor');
  });

  it('prohibits non-admin users from calling PATCH /api/v1/admin/users/:id/status (403 AUTH_INSUFFICIENT_ROLE)', async () => {
    const creatorSub = `sub_creator_${Date.now()}`;
    const creatorEmail = `creator_${Date.now()}@test.com`;

    const creatorToken = await createTestJwt({ sub: creatorSub, email: creatorEmail });
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: { preferredRole: 'CREATOR' },
    });

    const randomId = generateUuidV7();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${randomId}/status`,
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: { status: 'SUSPENDED' },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('AUTH_INSUFFICIENT_ROLE');
  });

  it('allows an ADMIN to update another user status', async () => {
    // 1. Create an admin user in PostgreSQL
    const adminId = generateUuidV7();
    const adminSub = `sub_admin_${Date.now()}`;
    const adminEmail = `admin_${Date.now()}@test.com`;

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: RoleType.ADMIN } });

    await prisma.user.create({
      data: {
        id: adminId,
        supabaseAuthId: adminSub,
        email: adminEmail,
        status: UserStatus.ACTIVE,
        userRoles: {
          create: {
            id: generateUuidV7(),
            roleId: adminRole.id,
          },
        },
      },
    });

    // 2. Create a normal user to be updated
    const targetSub = `sub_target_${Date.now()}`;
    const targetEmail = `target_${Date.now()}@test.com`;
    const targetToken = await createTestJwt({ sub: targetSub, email: targetEmail });

    const syncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: `Bearer ${targetToken}` },
      payload: {},
    });
    const targetUserId = syncRes.json().user.id;

    // 3. Admin calls status update
    const adminToken = await createTestJwt({ sub: adminSub, email: adminEmail });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${targetUserId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'SUSPENDED' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('SUSPENDED');

    // Verify DB
    const dbUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    expect(dbUser?.status).toBe(UserStatus.SUSPENDED);
  });
});
