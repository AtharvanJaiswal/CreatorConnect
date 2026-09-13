/**
 * Fix M3 regression tests — Audit log previousStatus accuracy.
 *
 * Verifies that the USER_STATUS_UPDATED audit log records the correct
 * pre-mutation status (previousStatus) and post-mutation status (newStatus)
 * for all status transitions.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../test-utils/auth-test-helper.js';
import { getPrismaClient, UserStatus, RoleType } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';

describe('Audit Log previousStatus Accuracy (Fix M3)', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();
  let adminId: string;
  let adminSub: string;
  let adminEmail: string;
  let adminToken: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    // Provision a persistent admin user for all tests in this suite
    adminId = generateUuidV7();
    adminSub = `sub_audit_admin_${Date.now()}`;
    adminEmail = `audit_admin_${Date.now()}@test.com`;

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

    adminToken = await createTestJwt({ sub: adminSub, email: adminEmail });
  });

  afterAll(async () => {
    // Clean up the admin user created by this suite to prevent leaking an ACTIVE admin
    // into subsequent test files (particularly admin-concurrency.spec.ts).
    if (adminId) {
      await prisma.user.update({
        where: { id: adminId },
        data: { status: UserStatus.SUSPENDED },
      });
    }
    await app.close();
  });

  /**
   * Helper: sync a fresh user and return their internal userId.
   */
  async function provisionUser(): Promise<{
    userId: string;
    sub: string;
    email: string;
    token: string;
  }> {
    const sub = `sub_audit_target_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const email = `audit_target_${Date.now()}_${Math.random().toString(36).slice(2)}@test.com`;
    const token = await createTestJwt({ sub, email });

    const syncRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/sync',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    });
    expect(syncRes.statusCode).toBe(201);
    const userId = syncRes.json().user.id as string;

    return { userId, sub, email, token };
  }

  /**
   * Helper: mutate status directly in PostgreSQL (bypasses API) so we can test
   * transitions that start from SUSPENDED or DEACTIVATED.
   */
  async function setStatusDirectly(userId: string, status: UserStatus): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { status } });
  }

  /**
   * Helper: fetch the most recent USER_STATUS_UPDATED audit log entry for a target user.
   */
  async function getLatestStatusAuditLog(
    targetUserId: string,
  ): Promise<{ previousStatus: string; newStatus: string } | null> {
    const log = await prisma.auditLog.findFirst({
      where: { action: 'USER_STATUS_UPDATED', entityId: targetUserId },
      orderBy: { createdAt: 'desc' },
    });

    if (!log?.metadata || typeof log.metadata !== 'object') return null;
    const meta = log.metadata as Record<string, unknown>;
    return {
      previousStatus: meta.previousStatus as string,
      newStatus: meta.newStatus as string,
    };
  }

  it('records ACTIVE → SUSPENDED with correct previousStatus and newStatus', async () => {
    const { userId } = await provisionUser();
    // Target starts ACTIVE (default after sync)

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${userId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'SUSPENDED' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('SUSPENDED');

    const audit = await getLatestStatusAuditLog(userId);
    expect(audit).not.toBeNull();
    expect(audit!.previousStatus).toBe('ACTIVE');
    expect(audit!.newStatus).toBe('SUSPENDED');
  });

  it('records SUSPENDED → ACTIVE with correct previousStatus and newStatus', async () => {
    const { userId } = await provisionUser();
    // Directly set to SUSPENDED so we can transition SUSPENDED → ACTIVE
    await setStatusDirectly(userId, UserStatus.SUSPENDED);

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${userId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'ACTIVE' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ACTIVE');

    const audit = await getLatestStatusAuditLog(userId);
    expect(audit).not.toBeNull();
    expect(audit!.previousStatus).toBe('SUSPENDED');
    expect(audit!.newStatus).toBe('ACTIVE');
  });

  it('records ACTIVE → DEACTIVATED with correct previousStatus and newStatus', async () => {
    const { userId } = await provisionUser();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${userId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'DEACTIVATED' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('DEACTIVATED');

    const audit = await getLatestStatusAuditLog(userId);
    expect(audit).not.toBeNull();
    expect(audit!.previousStatus).toBe('ACTIVE');
    expect(audit!.newStatus).toBe('DEACTIVATED');
  });

  it('previousStatus and newStatus are never identical after a status transition', async () => {
    const { userId } = await provisionUser();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${userId}/status`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'SUSPENDED' },
    });

    expect(res.statusCode).toBe(200);

    const audit = await getLatestStatusAuditLog(userId);
    expect(audit).not.toBeNull();
    // The core regression: previousStatus must NOT equal newStatus for a real transition
    expect(audit!.previousStatus).not.toBe(audit!.newStatus);
  });
});
