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

describe('Admin Dashboard Analytics (Milestone 2)', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let superAdminUser: { id: string; email: string; sub: string };
  let superAdminToken: string;

  let analyticsViewerUser: { id: string; email: string; sub: string };
  let analyticsViewerToken: string;

  let normalUser: { id: string; email: string; sub: string };
  let normalUserToken: string;

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
    const analyticsViewerRole = await prisma.adminRole.findUniqueOrThrow({
      where: { name: 'ANALYTICS_VIEWER' },
    });

    const ts = Date.now();

    // 1. Super Admin
    superAdminUser = {
      id: generateUuidV7(),
      email: `dash_sa_${ts}@test.com`,
      sub: `sub_dash_sa_${ts}`,
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

    // 2. Analytics Viewer
    analyticsViewerUser = {
      id: generateUuidV7(),
      email: `dash_av_${ts}@test.com`,
      sub: `sub_dash_av_${ts}`,
    };
    createdUserIds.push(analyticsViewerUser.id);

    await prisma.user.create({
      data: {
        id: analyticsViewerUser.id,
        supabaseAuthId: analyticsViewerUser.sub,
        email: analyticsViewerUser.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: analyticsViewerUser.id, roleId: adminGlobalRole.id },
    });
    await prisma.adminUserRole.create({
      data: {
        id: generateUuidV7(),
        userId: analyticsViewerUser.id,
        roleId: analyticsViewerRole.id,
      },
    });
    analyticsViewerToken = await createTestJwt({
      sub: analyticsViewerUser.sub,
      email: analyticsViewerUser.email,
    });

    // 3. Normal User
    normalUser = {
      id: generateUuidV7(),
      email: `dash_user_${ts}@test.com`,
      sub: `sub_dash_user_${ts}`,
    };
    createdUserIds.push(normalUser.id);

    await prisma.user.create({
      data: {
        id: normalUser.id,
        supabaseAuthId: normalUser.sub,
        email: normalUser.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: normalUser.id, roleId: creatorGlobalRole.id },
    });
    normalUserToken = await createTestJwt({ sub: normalUser.sub, email: normalUser.email });
  });

  afterAll(async () => {
    for (const uId of createdUserIds) {
      await prisma.adminUserRole.deleteMany({ where: { userId: uId } });
      await prisma.userRole.deleteMany({ where: { userId: uId } });
      await prisma.auditLog.deleteMany({ where: { userId: uId } });
      await prisma.user.deleteMany({ where: { id: uId } });
    }
    await app.close();
  });

  it('rejects unauthenticated requests to dashboard overview (401)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard/overview',
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects non-admin users from accessing dashboard overview (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard/overview',
      headers: { authorization: `Bearer ${normalUserToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows Analytics Viewer to fetch dashboard overview with default 7d period', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard/overview',
      headers: { authorization: `Bearer ${analyticsViewerToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.period).toBe('7d');
    expect(body.metrics).toBeDefined();
    expect(typeof body.metrics.totalUsers).toBe('number');
    expect(typeof body.metrics.activeUsers).toBe('number');
    expect(typeof body.metrics.registrationGrowthPercent).toBe('number');
    expect(typeof body.metrics.paymentSuccessRate).toBe('number');
    expect(typeof body.metrics.projectCompletionRate).toBe('number');
    expect(typeof body.metrics.totalTransactionVolumeMinor).toBe('string');
    expect(typeof body.metrics.platformRevenueMinor).toBe('string');
  });

  it('supports filtered periods: today, yesterday, 30d, 90d, custom', async () => {
    const periods = ['today', 'yesterday', '30d', '90d'];
    for (const p of periods) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/dashboard/overview?period=${p}`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.period).toBe(p);
    }

    // Custom date range
    const start = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date().toISOString();
    const customRes = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/dashboard/overview?period=custom&startDate=${start}&endDate=${end}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(customRes.statusCode).toBe(200);
    expect(customRes.json().period).toBe('custom');
  });

  it('fetches registrations breakdown endpoint', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard/registrations?period=7d',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalUsers).toBeGreaterThanOrEqual(1);
    expect(body.newRegistrations).toBeGreaterThanOrEqual(0);
  });

  it('fetches transactions and financial metrics breakdown', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard/transactions?period=30d',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.totalTransactions).toBe('number');
    expect(typeof body.paymentSuccessRate).toBe('number');
    expect(typeof body.totalTransactionVolumeMinor).toBe('string');
  });

  it('fetches projects and moderation sub-endpoints', async () => {
    const projRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard/projects',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(projRes.statusCode).toBe(200);

    const modRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/dashboard/moderation',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(modRes.statusCode).toBe(200);
  });
});
