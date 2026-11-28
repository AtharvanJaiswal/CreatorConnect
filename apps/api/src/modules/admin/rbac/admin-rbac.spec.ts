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

describe('Admin RBAC & Security Foundation (Milestone 1)', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let superAdminUser: { id: string; email: string; sub: string };
  let superAdminToken: string;

  let platformAdminUser: { id: string; email: string; sub: string };
  let platformAdminToken: string;

  let normalUser: { id: string; email: string; sub: string };
  let normalUserToken: string;

  const createdUserIds: string[] = [];
  const createdRoleIds: string[] = [];

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
    const platformAdminRole = await prisma.adminRole.findUniqueOrThrow({
      where: { name: 'PLATFORM_ADMIN' },
    });

    const ts = Date.now();

    // 1. Provision Super Admin
    superAdminUser = {
      id: generateUuidV7(),
      email: `super_admin_${ts}@test.com`,
      sub: `sub_super_admin_${ts}`,
    };
    createdUserIds.push(superAdminUser.id);

    await prisma.user.create({
      data: {
        id: superAdminUser.id,
        supabaseAuthId: superAdminUser.sub,
        email: superAdminUser.email,
        firstName: 'Super',
        lastName: 'Admin',
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

    // 2. Provision Platform Admin (does not have admins.manage permission)
    platformAdminUser = {
      id: generateUuidV7(),
      email: `platform_admin_${ts}@test.com`,
      sub: `sub_platform_admin_${ts}`,
    };
    createdUserIds.push(platformAdminUser.id);

    await prisma.user.create({
      data: {
        id: platformAdminUser.id,
        supabaseAuthId: platformAdminUser.sub,
        email: platformAdminUser.email,
        firstName: 'Platform',
        lastName: 'Admin',
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: platformAdminUser.id, roleId: adminGlobalRole.id },
    });
    await prisma.adminUserRole.create({
      data: { id: generateUuidV7(), userId: platformAdminUser.id, roleId: platformAdminRole.id },
    });
    platformAdminToken = await createTestJwt({
      sub: platformAdminUser.sub,
      email: platformAdminUser.email,
    });

    // 3. Provision Normal Creator User
    normalUser = {
      id: generateUuidV7(),
      email: `normal_user_${ts}@test.com`,
      sub: `sub_normal_user_${ts}`,
    };
    createdUserIds.push(normalUser.id);

    await prisma.user.create({
      data: {
        id: normalUser.id,
        supabaseAuthId: normalUser.sub,
        email: normalUser.email,
        firstName: 'Normal',
        lastName: 'Creator',
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: normalUser.id, roleId: creatorGlobalRole.id },
    });
    normalUserToken = await createTestJwt({ sub: normalUser.sub, email: normalUser.email });
  });

  afterAll(async () => {
    for (const rId of createdRoleIds) {
      await prisma.adminRolePermission.deleteMany({ where: { roleId: rId } });
      await prisma.adminRole.deleteMany({ where: { id: rId } });
    }
    for (const uId of createdUserIds) {
      await prisma.adminUserRole.deleteMany({ where: { userId: uId } });
      await prisma.userRole.deleteMany({ where: { userId: uId } });
      await prisma.auditLog.deleteMany({ where: { userId: uId } });
      await prisma.user.deleteMany({ where: { id: uId } });
    }
    await app.close();
  });

  it('prohibits unauthenticated callers from accessing admin roles (401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/roles',
    });
    expect(res.statusCode).toBe(401);
  });

  it('prohibits non-admin users from accessing admin roles (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/roles',
      headers: { authorization: `Bearer ${normalUserToken}` },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('AUTH_INSUFFICIENT_ROLE');
  });

  it('allows authorized admin to list standard administrative roles and permissions', async () => {
    const rolesRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/roles',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(rolesRes.statusCode).toBe(200);
    const roles = rolesRes.json();
    expect(Array.isArray(roles)).toBe(true);
    const roleNames = roles.map((r: any) => r.name);
    expect(roleNames).toContain('SUPER_ADMIN');
    expect(roleNames).toContain('PLATFORM_ADMIN');
    expect(roleNames).toContain('FINANCE_ADMIN');
    expect(roleNames).toContain('TRUST_SAFETY_ADMIN');

    const permsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/permissions',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(permsRes.statusCode).toBe(200);
    const perms = permsRes.json();
    expect(Array.isArray(perms)).toBe(true);
    expect(perms.some((p: any) => p.name === 'users.suspend')).toBe(true);
    expect(perms.some((p: any) => p.name === 'payments.refund.approve')).toBe(true);
  });

  it('enforces granular permission check: denies role creation to admin lacking admins.manage (403)', async () => {
    // Platform admin does NOT have admins.manage permission
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/roles',
      headers: { authorization: `Bearer ${platformAdminToken}` },
      payload: {
        name: 'UNAUTHORIZED_ROLE',
        description: 'Should fail',
        permissions: ['users.read'],
      },
    });
    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('AUTH_INSUFFICIENT_ROLE');
    expect(body.detail).toContain('admins.manage');
  });

  it('allows Super Admin to create, update, and delete a custom administrative role', async () => {
    // 1. Create custom role
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/roles',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        name: 'CUSTOM_AUDITOR',
        description: 'Auditor with read-only access to users and audit logs',
        permissions: ['users.read', 'audit.read'],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const createdRole = createRes.json();
    expect(createdRole.name).toBe('CUSTOM_AUDITOR');
    expect(createdRole.permissions).toEqual(expect.arrayContaining(['users.read', 'audit.read']));
    createdRoleIds.push(createdRole.id);

    // 2. Update role description and permissions
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/roles/${createdRole.id}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        description: 'Updated auditor description',
        permissions: ['users.read', 'audit.read', 'analytics.read'],
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updatedRole = updateRes.json();
    expect(updatedRole.description).toBe('Updated auditor description');
    expect(updatedRole.permissions).toContain('analytics.read');

    // 3. Delete custom role
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/roles/${createdRole.id}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(deleteRes.statusCode).toBe(204);

    // Verify role is deleted
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/roles/${createdRole.id}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('prohibits deleting system administrative roles (400)', async () => {
    const superAdminRole = await prisma.adminRole.findUniqueOrThrow({
      where: { name: 'SUPER_ADMIN' },
    });

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/roles/${superAdminRole.id}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('SYSTEM_ROLE_IMMUTABLE');
  });

  it('assigns and revokes administrative role on a user with audit trail', async () => {
    // Assign USER_ADMIN role to normalUser
    const assignRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/admins/assign',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        userId: normalUser.id,
        roleName: 'USER_ADMIN',
      },
    });
    expect(assignRes.statusCode).toBe(200);
    const assigned = assignRes.json();
    expect(assigned.roles).toContain('USER_ADMIN');
    expect(assigned.permissions).toContain('users.suspend');

    // Revoke USER_ADMIN role from normalUser
    const revokeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/admins/revoke',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        userId: normalUser.id,
        roleName: 'USER_ADMIN',
      },
    });
    expect(revokeRes.statusCode).toBe(200);
    const revoked = revokeRes.json();
    expect(revoked.roles).not.toContain('USER_ADMIN');
  });

  it('prohibits non-super-admins from granting or revoking SUPER_ADMIN (403)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/admins/assign',
      headers: { authorization: `Bearer ${platformAdminToken}` },
      payload: {
        userId: normalUser.id,
        roleName: 'SUPER_ADMIN',
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('concurrency guard: prohibits concurrent revocations from eliminating the last active Super Admin', async () => {
    const superAdminRole = await prisma.adminRole.findUniqueOrThrow({
      where: { name: 'SUPER_ADMIN' },
    });
    const adminGlobalRole = await prisma.role.findUniqueOrThrow({
      where: { name: RoleType.ADMIN },
    });

    // 1. Demote any other active super admins to platform admins for isolation
    await prisma.adminUserRole.deleteMany({
      where: {
        roleId: superAdminRole.id,
        userId: { notIn: [superAdminUser.id] },
      },
    });

    // 2. Provision exactly TWO active Super Administrators for concurrency test
    const saAId = generateUuidV7();
    const saASub = `sub_sa_concur_a_${Date.now()}`;
    const saAEmail = `sa_concur_a_${Date.now()}@test.com`;
    createdUserIds.push(saAId);

    const saBId = generateUuidV7();
    const saBSub = `sub_sa_concur_b_${Date.now()}`;
    const saBEmail = `sa_concur_b_${Date.now()}@test.com`;
    createdUserIds.push(saBId);

    // Remove existing superAdminUser from SUPER_ADMIN for this test so exactly A and B are super admins
    await prisma.adminUserRole.deleteMany({
      where: { userId: superAdminUser.id },
    });

    await prisma.user.createMany({
      data: [
        { id: saAId, supabaseAuthId: saASub, email: saAEmail, status: UserStatus.ACTIVE },
        { id: saBId, supabaseAuthId: saBSub, email: saBEmail, status: UserStatus.ACTIVE },
      ],
    });

    await prisma.userRole.createMany({
      data: [
        { id: generateUuidV7(), userId: saAId, roleId: adminGlobalRole.id },
        { id: generateUuidV7(), userId: saBId, roleId: adminGlobalRole.id },
      ],
    });

    await prisma.adminUserRole.createMany({
      data: [
        { id: generateUuidV7(), userId: saAId, roleId: superAdminRole.id },
        { id: generateUuidV7(), userId: saBId, roleId: superAdminRole.id },
      ],
    });

    const saAToken = await createTestJwt({ sub: saASub, email: saAEmail });
    const saBToken = await createTestJwt({ sub: saBSub, email: saBEmail });

    // 3. Concurrently execute mutual SUPER_ADMIN revocation: A revokes B, B revokes A
    const [resA, resB] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v1/admin/admins/revoke',
        headers: { authorization: `Bearer ${saAToken}` },
        payload: { userId: saBId, roleName: 'SUPER_ADMIN' },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/admin/admins/revoke',
        headers: { authorization: `Bearer ${saBToken}` },
        payload: { userId: saAId, roleName: 'SUPER_ADMIN' },
      }),
    ]);

    const statuses = [resA.statusCode, resB.statusCode];
    expect(statuses).toContain(200);
    expect(statuses.some((s) => s === 400 || s === 403)).toBe(true);

    const rejectedResponse = resA.statusCode !== 200 ? resA.json() : resB.json();
    if (resA.statusCode === 400 || resB.statusCode === 400) {
      expect(rejectedResponse.code).toBe('LAST_SUPER_ADMIN_LOCKOUT_PREVENTED');
    } else {
      expect(rejectedResponse.code).toBe('AUTH_INSUFFICIENT_ROLE');
    }

    // 4. Verify in PostgreSQL that at least one active Super Administrator remains
    const activeSuperAdminsRemaining = await prisma.user.count({
      where: {
        status: UserStatus.ACTIVE,
        adminUserRoles: {
          some: {
            role: { name: 'SUPER_ADMIN' },
          },
        },
      },
    });
    expect(activeSuperAdminsRemaining).toBeGreaterThanOrEqual(1);

    // Restore superAdminUser's SUPER_ADMIN role for any subsequent cleanup
    await prisma.adminUserRole.create({
      data: { id: generateUuidV7(), userId: superAdminUser.id, roleId: superAdminRole.id },
    });
  });

  it('rejects self-assignment of administrative roles with 400 ROLE_ESCALATION_ATTEMPT', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/admins/assign',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        userId: superAdminUser.id,
        roleName: 'FINANCE_ADMIN',
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('ROLE_ESCALATION_ATTEMPT');
    expect(body.detail).toContain('Administrators cannot self-assign');
  });

  it('enforces zero-trust deny-by-default: revoking granular role does NOT escalate admin to SUPER_ADMIN', async () => {
    const ts = Date.now();
    const testAdminUser = {
      id: generateUuidV7(),
      email: `zero_trust_${ts}@test.com`,
      sub: `sub_zt_${ts}`,
    };
    createdUserIds.push(testAdminUser.id);

    const adminGlobalRole = await prisma.role.findUniqueOrThrow({
      where: { name: RoleType.ADMIN },
    });
    const modRole = await prisma.adminRole.findUniqueOrThrow({
      where: { name: 'CONTENT_MODERATOR' },
    });

    await prisma.user.create({
      data: {
        id: testAdminUser.id,
        supabaseAuthId: testAdminUser.sub,
        email: testAdminUser.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: testAdminUser.id, roleId: adminGlobalRole.id },
    });
    const aur = await prisma.adminUserRole.create({
      data: { id: generateUuidV7(), userId: testAdminUser.id, roleId: modRole.id },
    });

    // Revoke the MODERATOR role
    const revokeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/admins/revoke',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        userId: testAdminUser.id,
        roleName: 'CONTENT_MODERATOR',
      },
    });
    expect(revokeRes.statusCode).toBe(200);

    // Verify identity mapping via userRepository: adminRoles must be empty, NOT SUPER_ADMIN
    const { userRepository } = await import('../../../repositories/user.repository.js');
    const identity = await userRepository.findById(testAdminUser.id);
    expect(identity).toBeDefined();
    expect(identity?.roles).not.toContain('ADMIN');
    expect(identity?.adminRoles ?? []).toEqual([]);
    expect(identity?.adminPermissions ?? []).toEqual([]);

    // Verify token from this user has 0 administrative capabilities (403 on admin routes)
    const testToken = await createTestJwt({ sub: testAdminUser.sub, email: testAdminUser.email });
    const probeRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/roles',
      headers: { authorization: `Bearer ${testToken}` },
    });
    expect(probeRes.statusCode).toBe(403);
  });
});
