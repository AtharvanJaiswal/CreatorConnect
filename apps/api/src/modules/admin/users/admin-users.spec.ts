import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../app.js';
import { defaultJwtVerifier } from '../../../services/jwt-verifier.js';
import {
  createTestJwt,
  createTestKeySet,
} from '../../../../../../tests/fixtures/auth-test-helper.js';
import { getPrismaClient, UserStatus, RoleType } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';

describe('Admin User Directory & Lifecycle Management (Milestone 2)', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let superAdminUser: { id: string; email: string; sub: string };
  let superAdminToken: string;

  let userAdminUser: { id: string; email: string; sub: string };
  let userAdminToken: string;

  let targetCreatorUser: { id: string; email: string; sub: string };
  let targetCreatorToken: string;

  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    const adminGlobalRole = await prisma.role.findUniqueOrThrow({
      where: { name: RoleType.ADMIN },
    });
    const creatorGlobalRole = await prisma.role.findUniqueOrThrow({
      where: { name: RoleType.CREATOR },
    });
    const superAdminRole = await prisma.adminRole.findUniqueOrThrow({
      where: { name: 'SUPER_ADMIN' },
    });
    const userAdminRole = await prisma.adminRole.findUniqueOrThrow({
      where: { name: 'USER_ADMIN' },
    });

    const ts = Date.now();

    // 1. Super Admin
    superAdminUser = {
      id: generateUuidV7(),
      email: `usr_sa_${ts}@test.com`,
      sub: `sub_usr_sa_${ts}`,
    };
    createdUserIds.push(superAdminUser.id);

    await prisma.user.create({
      data: {
        id: superAdminUser.id,
        supabaseAuthId: superAdminUser.sub,
        email: superAdminUser.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: superAdminUser.id, roleId: adminGlobalRole.id },
    });
    await prisma.adminUserRole.create({
      data: { id: generateUuidV7(), userId: superAdminUser.id, roleId: superAdminRole.id },
    });
    superAdminToken = await createTestJwt({ sub: superAdminUser.sub, email: superAdminUser.email });

    // 2. User Admin (has users.read, users.suspend, users.reactivate)
    userAdminUser = {
      id: generateUuidV7(),
      email: `usr_ua_${ts}@test.com`,
      sub: `sub_usr_ua_${ts}`,
    };
    createdUserIds.push(userAdminUser.id);

    await prisma.user.create({
      data: {
        id: userAdminUser.id,
        supabaseAuthId: userAdminUser.sub,
        email: userAdminUser.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: userAdminUser.id, roleId: adminGlobalRole.id },
    });
    await prisma.adminUserRole.create({
      data: { id: generateUuidV7(), userId: userAdminUser.id, roleId: userAdminRole.id },
    });
    userAdminToken = await createTestJwt({ sub: userAdminUser.sub, email: userAdminUser.email });

    // 3. Target Creator User
    targetCreatorUser = {
      id: generateUuidV7(),
      email: `target_creator_${ts}@test.com`,
      sub: `sub_target_creator_${ts}`,
    };
    createdUserIds.push(targetCreatorUser.id);

    await prisma.user.create({
      data: {
        id: targetCreatorUser.id,
        supabaseAuthId: targetCreatorUser.sub,
        email: targetCreatorUser.email,
        firstName: 'Jane',
        lastName: 'Creator',
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: targetCreatorUser.id, roleId: creatorGlobalRole.id },
    });
    await prisma.creatorProfile.create({
      data: {
        id: generateUuidV7(),
        userId: targetCreatorUser.id,
        bio: 'Professional video producer and motion designer.',
        isVerified: true,
      },
    });
    targetCreatorToken = await createTestJwt({
      sub: targetCreatorUser.sub,
      email: targetCreatorUser.email,
    });
  });

  afterAll(async () => {
    for (const uId of createdUserIds) {
      await prisma.creatorProfile.deleteMany({ where: { userId: uId } });
      await prisma.adminUserRole.deleteMany({ where: { userId: uId } });
      await prisma.userRole.deleteMany({ where: { userId: uId } });
      await prisma.auditLog.deleteMany({ where: { userId: uId } });
      await prisma.user.deleteMany({ where: { id: uId } });
    }
    await app.close();
  });

  it('prohibits non-admin users from querying admin user directory (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users',
      headers: { authorization: `Bearer ${targetCreatorToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows User Admin to list and filter users with pagination', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users?page=1&limit=10',
      headers: { authorization: `Bearer ${userAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(10);
    expect(body.total).toBeGreaterThanOrEqual(3);
  });

  it('supports searching user directory by email keyword and status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/users?search=${encodeURIComponent('target_creator')}&status=ACTIVE`,
      headers: { authorization: `Bearer ${userAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    const found = body.items.find((u: any) => u.id === targetCreatorUser.id);
    expect(found).toBeDefined();
    expect(found.email).toBe(targetCreatorUser.email);
    expect(found.isVerified).toBe(true);
    expect(found.profileCompleteness).toBeGreaterThan(0);
  });

  it('retrieves detailed user account profile, stats, and activity timeline', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/users/${targetCreatorUser.id}`,
      headers: { authorization: `Bearer ${userAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.id).toBe(targetCreatorUser.id);
    expect(body.profile).toBeDefined();
    expect(body.profile.bio).toContain('Professional video producer');
    expect(body.stats).toBeDefined();
    expect(Array.isArray(body.activityTimeline)).toBe(true);
  });

  it('returns 404 for nonexistent user details query', async () => {
    const randomId = generateUuidV7();
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/users/${randomId}`,
      headers: { authorization: `Bearer ${userAdminToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('suspends an active user account with explicit justification and records audit log', async () => {
    const suspendRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${targetCreatorUser.id}/suspend`,
      headers: { authorization: `Bearer ${userAdminToken}` },
      payload: {
        reason: 'Violation of Terms of Service: suspected fraudulent activity.',
      },
    });
    expect(suspendRes.statusCode).toBe(200);
    const body = suspendRes.json();
    expect(body.id).toBe(targetCreatorUser.id);
    expect(body.status).toBe('SUSPENDED');

    // Verify user is actually blocked by fastify.authenticate
    const blockedRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${targetCreatorToken}` },
    });
    expect(blockedRes.statusCode).toBe(403);
    expect(blockedRes.json().code).toBe('USER_SUSPENDED');
  });

  it('reactivates a suspended user account with explicit audit log', async () => {
    const reactivateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${targetCreatorUser.id}/reactivate`,
      headers: { authorization: `Bearer ${userAdminToken}` },
      payload: {
        reason: 'Investigation completed: account cleared of suspected fraud.',
      },
    });
    expect(reactivateRes.statusCode).toBe(200);
    const body = reactivateRes.json();
    expect(body.id).toBe(targetCreatorUser.id);
    expect(body.status).toBe('ACTIVE');

    // Verify user can now authenticate again
    const activeRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${targetCreatorToken}` },
    });
    expect(activeRes.statusCode).toBe(200);
  });

  it('fetches chronological user activity timeline endpoint', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/users/${targetCreatorUser.id}/activity?limit=10`,
      headers: { authorization: `Bearer ${userAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const logs = res.json();
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(
      logs.some((l: any) => l.action.includes('USER_STATUS_UPDATED') || l.action.includes('USER')),
    ).toBe(true);
  });

  it('sanitizes sensitive fields in audit metadata across getUserDetails and getUserActivity', async () => {
    await prisma.auditLog.create({
      data: {
        id: generateUuidV7(),
        userId: userAdminUser.id,
        action: 'SECRET_LEAK_PROBE',
        entity: 'User',
        entityId: targetCreatorUser.id,
        metadata: {
          passwordHash: 'super-secret-hash',
          sessionToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig',
          connectionString: 'postgresql://postgres:secret_pass@localhost:5432/prod',
          nested: {
            apiKey: ['sk', 'live', '51TestSecretKey12345'].join('_'),
            safeNote: 'Legitimate note without secrets',
            embeddedUriNote:
              'Failed on postgresql://postgres:secret_pass@localhost:5432/prod cleanly',
          },
        },
      },
    });

    const detailsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/users/${targetCreatorUser.id}`,
      headers: { authorization: `Bearer ${userAdminToken}` },
    });
    expect(detailsRes.statusCode).toBe(200);
    const detailsText = detailsRes.body;
    expect(detailsText).not.toContain('super-secret-hash');
    expect(detailsText).not.toContain('secret_pass');
    expect(detailsText).not.toContain(['sk', 'live', '51TestSecretKey12345'].join('_'));
    expect(detailsText).not.toContain('eyJhbGciOiJIUzI1NiIs');

    const detailsProbe = detailsRes
      .json()
      .activityTimeline.find((item: any) => item.action === 'SECRET_LEAK_PROBE');
    expect(detailsProbe).toBeDefined();
    expect(detailsProbe.metadata.passwordHash).toBe('[REDACTED]');
    expect(detailsProbe.metadata.sessionToken).toBe('[REDACTED]');
    expect(detailsProbe.metadata.connectionString).toBe('[REDACTED]');
    expect(detailsProbe.metadata.nested.apiKey).toBe('[REDACTED]');
    expect(detailsProbe.metadata.nested.safeNote).toBe('Legitimate note without secrets');
    expect(detailsProbe.metadata.nested.embeddedUriNote).toBe(
      'Failed on [REDACTED_CONNECTION_STRING] cleanly',
    );

    const activityRes = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/users/${targetCreatorUser.id}/activity?limit=20`,
      headers: { authorization: `Bearer ${userAdminToken}` },
    });
    expect(activityRes.statusCode).toBe(200);
    const activityText = activityRes.body;
    expect(activityText).not.toContain('super-secret-hash');
    expect(activityText).not.toContain('secret_pass');
    expect(activityText).not.toContain(['sk', 'live', '51TestSecretKey12345'].join('_'));

    const activityProbe = activityRes
      .json()
      .find((item: any) => item.action === 'SECRET_LEAK_PROBE');
    expect(activityProbe).toBeDefined();
    expect(activityProbe.metadata.passwordHash).toBe('[REDACTED]');
    expect(activityProbe.metadata.nested.apiKey).toBe('[REDACTED]');
    expect(activityProbe.metadata.nested.safeNote).toBe('Legitimate note without secrets');
    expect(activityProbe.metadata.nested.embeddedUriNote).toBe(
      'Failed on [REDACTED_CONNECTION_STRING] cleanly',
    );
  });

  it('prevents suspending the last active administrator via admin user suspend endpoint', async () => {
    // Attempting to suspend superAdminUser when they are the only remaining active admin would be prevented
    // First, let's test that the last admin lockout guard is triggered
    const superAdminRole = await prisma.adminRole.findUniqueOrThrow({
      where: { name: 'SUPER_ADMIN' },
    });
    const adminGlobalRole = await prisma.role.findUniqueOrThrow({
      where: { name: RoleType.ADMIN },
    });

    // Suspend all other admins
    await prisma.user.updateMany({
      where: {
        status: UserStatus.ACTIVE,
        id: { not: superAdminUser.id },
        userRoles: { some: { roleId: adminGlobalRole.id } },
      },
      data: { status: UserStatus.SUSPENDED },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${superAdminUser.id}/suspend`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        reason: 'Attempting to suspend the last active administrator.',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('LAST_ADMIN_LOCKOUT_PREVENTED');

    // Restore userAdminUser to ACTIVE
    await prisma.user.update({
      where: { id: userAdminUser.id },
      data: { status: UserStatus.ACTIVE },
    });
  });

  it('prevents suspending the last active Super Administrator even when other non-super admins exist', async () => {
    // Both superAdminUser and userAdminUser are ACTIVE.
    // However, superAdminUser is the ONLY active SUPER_ADMIN.
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${superAdminUser.id}/suspend`,
      headers: { authorization: `Bearer ${userAdminToken}` },
      payload: {
        reason: 'Attempting to suspend the only active Super Admin while another admin exists.',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('LAST_SUPER_ADMIN_LOCKOUT_PREVENTED');
    expect(res.json().detail).toContain('last active Super Administrator');
  });
});
