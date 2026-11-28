import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';
import { getPrismaClient, UserStatus } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { privacyAuditService } from './privacy-audit.service.js';

describe('Lifecycle & Privacy Routes Integration (HTTP Endpoints)', () => {
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

  const setupUser = async (roleName: 'CREATOR' | 'ADMIN', emailPrefix: string) => {
    const userId = generateUuidV7();
    const sub = `sub_${emailPrefix}_${Date.now()}`;
    const email = `${emailPrefix}_${Date.now()}@test.invalid`;
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });

    await prisma.user.create({
      data: {
        id: userId,
        supabaseAuthId: sub,
        email,
        status: UserStatus.ACTIVE,
        userRoles: { create: { id: generateUuidV7(), roleId: role.id } },
        ...(roleName === 'ADMIN'
          ? {
              adminUserRoles: {
                create: {
                  id: generateUuidV7(),
                  role: { connect: { name: 'USER_ADMIN' } },
                },
              },
            }
          : {}),
      },
    });

    const token = await createTestJwt({ sub, email });
    return { userId, sub, email, token };
  };

  it('allows authenticated user to self-deactivate and then self-reactivate', async () => {
    const user = await setupUser('CREATOR', 'deact_react');

    // 1. Self-deactivate
    const deactRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/deactivate',
      headers: { authorization: `Bearer ${user.token}` },
      payload: {
        confirmation: true,
        reason: 'Temporary break',
      },
    });

    expect(deactRes.statusCode).toBe(200);
    expect(deactRes.json().status).toBe(UserStatus.DEACTIVATED);

    // 2. Normal authenticated endpoints must now reject with 403 USER_DEACTIVATED
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${user.token}` },
    });
    expect(meRes.statusCode).toBe(403);
    expect(meRes.json().code).toBe('USER_DEACTIVATED');

    // 3. Reactivate via dedicated reactivation route
    const reactRes = await app.inject({
      method: 'POST',
      url: '/api/v1/users/me/reactivate',
      headers: { authorization: `Bearer ${user.token}` },
      payload: {
        confirmation: true,
      },
    });

    expect(reactRes.statusCode).toBe(200);
    expect(reactRes.json().status).toBe(UserStatus.ACTIVE);

    // 4. Access restored to normal endpoints
    const meRestored = await app.inject({
      method: 'GET',
      url: '/api/v1/users/me',
      headers: { authorization: `Bearer ${user.token}` },
    });
    expect(meRestored.statusCode).toBe(200);
    expect(meRestored.json().status).toBe(UserStatus.ACTIVE);
  });

  it('executes full Privacy Erasure request lifecycle: request -> status -> confirm -> cancel', async () => {
    const user = await setupUser('CREATOR', 'dsar_flow');

    // 1. Request Erasure
    const reqRes = await app.inject({
      method: 'POST',
      url: '/api/v1/privacy/erasure-request',
      headers: { authorization: `Bearer ${user.token}` },
      payload: { reason: 'Exercising Right to Erasure' },
    });

    expect(reqRes.statusCode).toBe(202);
    const reqBody = reqRes.json();
    expect(reqBody.status).toBe('PENDING_CONFIRMATION');
    expect(reqBody.confirmationCode).toBeDefined();

    // 2. Check status
    const statusRes = await app.inject({
      method: 'GET',
      url: '/api/v1/privacy/erasure-request/status',
      headers: { authorization: `Bearer ${user.token}` },
    });
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.json().status).toBe('PENDING_CONFIRMATION');

    // 3. Confirm with valid code
    const confirmRes = await app.inject({
      method: 'POST',
      url: '/api/v1/privacy/erasure-request/confirm',
      headers: { authorization: `Bearer ${user.token}` },
      payload: { confirmationCode: reqBody.confirmationCode },
    });
    expect(confirmRes.statusCode).toBe(200);
    expect(confirmRes.json().status).toBe('COOLING_OFF');

    // 4. Cancel during cooling-off
    const cancelRes = await app.inject({
      method: 'POST',
      url: '/api/v1/privacy/erasure-request/cancel',
      headers: { authorization: `Bearer ${user.token}` },
      payload: { reason: 'Changed my mind' },
    });
    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.json().status).toBe('CANCELLED');
  });

  it('verifies privacy compliance receipt via public audit endpoint', async () => {
    const requestId = generateUuidV7();
    const userId = generateUuidV7();

    const { rawToken } = await prisma.$transaction(async (tx) => {
      return await privacyAuditService.issueCertificate(tx, {
        requestId,
        userId,
        actionTaken: 'IN_PLACE_PSEUDONYMIZATION',
        recordsProcessed: 2,
        mediaFilesPurged: 4,
      });
    });

    // Public verification call
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/privacy/verify-receipt',
      payload: { certificateToken: rawToken },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().valid).toBe(true);
    expect(res.json().recordsProcessed).toBe(2);
    expect(res.json().mediaFilesPurged).toBe(4);
  });

  it('admin endpoints manage legal holds under RBAC and parent-row locking', async () => {
    const admin = await setupUser('ADMIN', 'admin_holds');
    const user = await setupUser('CREATOR', 'held_user');

    // Non-admin attempt is rejected with 403
    const nonAdminRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${user.userId}/legal-holds`,
      headers: { authorization: `Bearer ${user.token}` },
      payload: {
        reason: 'ACTIVE_DISPUTE',
        caseReference: 'CASE-UNAUTH-01',
        notes: 'Unauthorized hold',
      },
    });
    expect(nonAdminRes.statusCode).toBe(403);

    // Admin applies hold
    const applyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${user.userId}/legal-holds`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: {
        reason: 'ACTIVE_DISPUTE',
        caseReference: 'CASE-ADMIN-01',
        notes: 'Disputed milestone payment',
      },
    });
    expect(applyRes.statusCode).toBe(201);
    const holdId = applyRes.json().id;
    expect(holdId).toBeDefined();

    // List holds
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/users/${user.userId}/legal-holds`,
      headers: { authorization: `Bearer ${admin.token}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json()).toHaveLength(1);
    expect(listRes.json()[0].caseReference).toBe('CASE-ADMIN-01');

    // Release hold
    const releaseRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/users/${user.userId}/legal-holds/${holdId}`,
      headers: { authorization: `Bearer ${admin.token}` },
      payload: {
        releaseNotes: 'Dispute closed by mutual release',
      },
    });
    expect(releaseRes.statusCode).toBe(200);
    expect(releaseRes.json().status).toBe('RELEASED');
  });
});
