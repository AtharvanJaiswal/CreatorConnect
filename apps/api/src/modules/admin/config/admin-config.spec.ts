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

describe('Admin Configuration, Notifications & Background Jobs (Milestone 6)', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let superAdminUser: { id: string; email: string; sub: string };
  let superAdminToken: string;

  let regularUser: { id: string; email: string; sub: string };
  let regularToken: string;

  const testSettingKey = `test.feature.flag.${Date.now()}`;
  let testSettingId: string;
  let testCampaignId: string;

  const createdUserIds: string[] = [];
  const createdSettingIds: string[] = [];
  const createdCampaignIds: string[] = [];

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

    const ts = Date.now();

    // 1. Super Admin
    superAdminUser = {
      id: generateUuidV7(),
      email: `cfg_sa_${ts}@test.com`,
      sub: `sub_cfg_sa_${ts}`,
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

    // 2. Regular user (No Admin Permissions)
    regularUser = {
      id: generateUuidV7(),
      email: `cfg_reg_${ts}@test.com`,
      sub: `sub_cfg_reg_${ts}`,
    };
    createdUserIds.push(regularUser.id);

    await prisma.user.create({
      data: {
        id: regularUser.id,
        supabaseAuthId: regularUser.sub,
        email: regularUser.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: regularUser.id, roleId: creatorGlobalRole.id },
    });
    regularToken = await createTestJwt({ sub: regularUser.sub, email: regularUser.email });

    // 3. Test Setting
    testSettingId = generateUuidV7();
    createdSettingIds.push(testSettingId);
    await prisma.platformSetting.create({
      data: {
        id: testSettingId,
        key: testSettingKey,
        value: { enabled: false, maxUploadMb: 50 },
        description: 'Test platform setting for video uploads',
        version: 1,
        updatedById: superAdminUser.id,
      },
    });
  });

  afterAll(async () => {
    for (const cid of createdCampaignIds) {
      await prisma.notificationCampaign.deleteMany({ where: { id: cid } });
    }
    for (const sid of createdSettingIds) {
      await prisma.platformSettingAudit.deleteMany({ where: { settingId: sid } });
      await prisma.platformSetting.deleteMany({ where: { id: sid } });
    }
    for (const uid of createdUserIds) {
      await prisma.auditLog.deleteMany({ where: { userId: uid } });
      await prisma.adminUserRole.deleteMany({ where: { userId: uid } });
      await prisma.userRole.deleteMany({ where: { userId: uid } });
      await prisma.user.deleteMany({ where: { id: uid } });
    }
    await app.close();
  });

  // ==============================================================================
  // Platform Settings Tests
  // ==============================================================================

  it('GET /api/v1/admin/settings - should deny unauthenticated requests with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/settings',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/admin/settings - should deny regular users with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/settings',
      headers: { authorization: `Bearer ${regularToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/v1/admin/settings - should list platform settings for authorized admin', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/settings',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    const found = body.find((s: any) => s.key === testSettingKey);
    expect(found).toBeDefined();
    expect(found.version).toBe(1);
    expect(found.value.enabled).toBe(false);
  });

  it('POST /api/v1/admin/settings/:key - should update setting value, increment version, and record audit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/settings/${testSettingKey}`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        value: { enabled: true, maxUploadMb: 100 },
        reason: 'Increasing max upload size to 100MB for 4K video rollout',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version).toBe(2);
    expect(body.value.enabled).toBe(true);
    expect(body.value.maxUploadMb).toBe(100);

    // Verify DB
    const settingInDb = await prisma.platformSetting.findUnique({
      where: { key: testSettingKey },
    });
    expect(settingInDb?.version).toBe(2);

    // Verify PlatformSettingAudit
    const auditRecord = await prisma.platformSettingAudit.findFirst({
      where: { key: testSettingKey, version: 2 },
    });
    expect(auditRecord).toBeDefined();
    expect(auditRecord?.changedById).toBe(superAdminUser.id);

    // Verify AuditLog
    const auditLog = await prisma.auditLog.findFirst({
      where: { entityId: testSettingId, action: 'PLATFORM_SETTING_UPDATED' },
    });
    expect(auditLog).toBeDefined();
  });

  it('GET /api/v1/admin/settings/:key/history - should return setting audit version history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/settings/${testSettingKey}/history`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const history = res.json();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].version).toBe(2);
  });

  it('POST /api/v1/admin/settings/:key/rollback - should roll back setting to previous version', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/settings/${testSettingKey}/rollback`,
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        targetVersion: 1,
        reason: 'Rollback 4K rollout due to transcode pipeline latency',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version).toBe(3);
    expect(body.value.enabled).toBe(false);
    expect(body.value.maxUploadMb).toBe(50);
  });

  // ==============================================================================
  // Notification Campaigns Tests
  // ==============================================================================

  it('POST /api/v1/admin/notifications/campaigns/estimate - should estimate recipients count', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/notifications/campaigns/estimate',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        targetType: 'ALL_USERS',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.targetType).toBe('ALL_USERS');
    expect(body.estimatedCount).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/v1/admin/notifications/campaigns - should create and stage broadcast campaign', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/notifications/campaigns',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        title: 'Platform Maintenance Notification',
        message:
          'CreatorConnect will undergo scheduled maintenance this Sunday from 2 AM to 4 AM IST.',
        targetType: 'ALL_USERS',
        channels: ['IN_APP', 'PUSH'],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.status).toBe('DRAFT');
    expect(body.estimatedRecipients).toBeGreaterThanOrEqual(1);

    testCampaignId = body.id;
    createdCampaignIds.push(testCampaignId);

    // Verify AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: testCampaignId, action: 'NOTIFICATION_CAMPAIGN_CREATED' },
    });
    expect(audit).toBeDefined();
  });

  it('GET /api/v1/admin/notifications/campaigns - should list staged campaigns', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/notifications/campaigns',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeDefined();
    const found = body.items.find((c: any) => c.id === testCampaignId);
    expect(found).toBeDefined();
    expect(found.title).toBe('Platform Maintenance Notification');
  });

  it('POST /api/v1/admin/notifications/campaigns/:id/send - should execute immediate broadcast dispatch', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/notifications/campaigns/${testCampaignId}/send`,
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('SENT');
    expect(body.sentCount).toBeGreaterThanOrEqual(1);

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: testCampaignId, action: 'NOTIFICATION_CAMPAIGN_SENT' },
    });
    expect(audit).toBeDefined();
  });

  // ==============================================================================
  // Background Job Monitoring Tests
  // ==============================================================================

  it('GET /api/v1/admin/jobs/queues - should monitor worker queues and return health metrics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/jobs/queues',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    const queues = res.json();
    expect(Array.isArray(queues)).toBe(true);
    expect(queues.length).toBeGreaterThanOrEqual(4);
    const notifQueue = queues.find((q: any) => q.queueName === 'notification-queue');
    expect(notifQueue).toBeDefined();
    expect(notifQueue.paused).toBe(false);
  });

  it('POST /api/v1/admin/jobs/queues/:queueName/retry-failed - should retry failed jobs and write audit log', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/jobs/queues/notification-queue/retry-failed',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().retriedCount).toBeDefined();

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: 'notification-queue', action: 'QUEUE_FAILED_JOBS_RETRIED' },
    });
    expect(audit).toBeDefined();
    expect(audit?.userId).toBe(superAdminUser.id);
  });
});
