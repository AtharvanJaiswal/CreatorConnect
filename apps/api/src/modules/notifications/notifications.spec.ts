import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  getPrismaClient,
  type PrismaClient,
  notificationRepository,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';

describe('Notifications REST API Integration Tests', () => {
  let app: FastifyInstance;
  const prisma: PrismaClient = getPrismaClient();

  let userA: { id: string; supabaseAuthId: string; email: string };
  let userB: { id: string; supabaseAuthId: string; email: string };
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    const ts = Date.now();

    userA = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_notif_api_a_${ts}`,
        email: `notif_api_a_${ts}@test.com`,
        firstName: 'Alice',
        lastName: 'Api',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: 'CREATOR' },
                create: { id: generateUuidV7(), name: 'CREATOR' },
              },
            },
          },
        },
      },
    });
    tokenA = await createTestJwt({ sub: userA.supabaseAuthId, email: userA.email });

    userB = await prisma.user.create({
      data: {
        id: generateUuidV7(),
        supabaseAuthId: `sub_notif_api_b_${ts}`,
        email: `notif_api_b_${ts}@test.com`,
        firstName: 'Bob',
        lastName: 'Api',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: 'CREATOR' },
                create: { id: generateUuidV7(), name: 'CREATOR' },
              },
            },
          },
        },
      },
    });
    tokenB = await createTestJwt({ sub: userB.supabaseAuthId, email: userB.email });
  });

  afterAll(async () => {
    if (userA) {
      await prisma.notification.deleteMany({ where: { userId: userA.id } });
      await prisma.notificationPreference.deleteMany({ where: { userId: userA.id } });
      await prisma.userRole.deleteMany({ where: { userId: userA.id } });
      await prisma.user.deleteMany({ where: { id: userA.id } });
    }
    if (userB) {
      await prisma.notification.deleteMany({ where: { userId: userB.id } });
      await prisma.notificationPreference.deleteMany({ where: { userId: userB.id } });
      await prisma.userRole.deleteMany({ where: { userId: userB.id } });
      await prisma.user.deleteMany({ where: { id: userB.id } });
    }
    await app.close();
  });

  describe('Authentication and Security Gates', () => {
    it('rejects unauthenticated GET /api/v1/notifications with 401 Problem Details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications',
      });

      expect(res.statusCode).toBe(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const body = JSON.parse(res.payload);
      expect(body.status).toBe(401);
      expect(body.code).toBe('AUTH_INVALID_TOKEN');
    });

    it('rejects invalid token with 401 Problem Details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications',
        headers: {
          authorization: 'Bearer invalid-token-string',
        },
      });

      expect(res.statusCode).toBe(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });
  });

  describe('GET /api/v1/notifications (Listing & Keyset Pagination)', () => {
    it('lists notifications for the authenticated user and enforces user isolation', async () => {
      // Clear previous
      await prisma.notification.deleteMany({ where: { userId: userA.id } });
      await prisma.notification.deleteMany({ where: { userId: userB.id } });

      // Create notifications for A and B
      await notificationRepository.createNotification({
        userId: userA.id,
        type: 'MESSAGE_RECEIVED',
        title: 'Msg for A',
        body: 'Body A',
      });
      await notificationRepository.createNotification({
        userId: userB.id,
        type: 'MESSAGE_RECEIVED',
        title: 'Msg for B',
        body: 'Body B',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications',
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.items).toHaveLength(1);
      expect(data.items[0].userId).toBe(userA.id);
      expect(data.items[0].title).toBe('Msg for A');
      expect(data.unreadCount).toBe(1);
    });

    it('rejects out-of-bounds pagination limits with 400 Problem Details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications?limit=0',
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('rejects malformed cursor with 400 Problem Details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications?cursor=malformed_cursor!',
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.code).toBe('INVALID_NOTIFICATION_CURSOR');
    });
  });

  describe('PATCH /api/v1/notifications/:id/read (Read State)', () => {
    it('marks a notification as read and is idempotent', async () => {
      const notif = await notificationRepository.createNotification({
        userId: userA.id,
        type: 'MESSAGE_RECEIVED',
        title: 'Unread Notification',
        body: 'Body',
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/notifications/${notif.id}/read`,
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.id).toBe(notif.id);
      expect(body.readAt).not.toBeNull();

      // Repeated read
      const resRepeat = await app.inject({
        method: 'PATCH',
        url: `/api/v1/notifications/${notif.id}/read`,
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(resRepeat.statusCode).toBe(200);
    });

    it('returns 404 NOT_FOUND when attempting to mark another user’s notification (anti-enumeration)', async () => {
      const notifB = await notificationRepository.createNotification({
        userId: userB.id,
        type: 'MESSAGE_RECEIVED',
        title: 'B’s Private Notification',
        body: 'Body',
      });

      // Alice tries to mark Bob's notification
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/notifications/${notifB.id}/read`,
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(404);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const problem = JSON.parse(res.payload);
      expect(problem.code).toBe('NOTIFICATION_NOT_FOUND');
    });
  });

  describe('POST /api/v1/notifications/read-all', () => {
    it('marks all unread notifications as read for authenticated user', async () => {
      await prisma.notification.deleteMany({ where: { userId: userA.id } });

      await notificationRepository.createNotification({
        userId: userA.id,
        type: 'MESSAGE_RECEIVED',
        title: 'Unread 1',
        body: 'B',
      });
      await notificationRepository.createNotification({
        userId: userA.id,
        type: 'APPLICATION_ACCEPTED',
        title: 'Unread 2',
        body: 'B',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/read-all',
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.count).toBe(2);

      // Verify unread count is now 0
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/v1/notifications?unreadOnly=true',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      const listData = JSON.parse(listRes.payload);
      expect(listData.items).toHaveLength(0);
      expect(listData.unreadCount).toBe(0);
    });
  });

  describe('GET & PUT /api/v1/notification-preferences', () => {
    it('retrieves and updates notification preferences', async () => {
      // GET initial
      const getRes = await app.inject({
        method: 'GET',
        url: '/api/v1/notification-preferences',
        headers: { authorization: `Bearer ${tokenA}` },
      });
      expect(getRes.statusCode).toBe(200);

      // PUT updates
      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/notification-preferences',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          preferences: [
            {
              type: 'MESSAGE_RECEIVED',
              channel: 'IN_APP',
              enabled: false,
            },
            {
              type: 'APPLICATION_ACCEPTED',
              channel: 'EMAIL',
              enabled: true,
            },
          ],
        },
      });

      expect(putRes.statusCode).toBe(200);
      const putBody = JSON.parse(putRes.payload);
      expect(putBody.items).toHaveLength(2);

      const msgPref = putBody.items.find(
        (p: any) => p.type === 'MESSAGE_RECEIVED' && p.channel === 'IN_APP',
      );
      expect(msgPref.enabled).toBe(false);
    });

    it('rejects invalid preference types with 400 Problem Details', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/v1/notification-preferences',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: {
          preferences: [
            {
              type: 'NONEXISTENT_TYPE',
              channel: 'IN_APP',
              enabled: true,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });
  });
});
