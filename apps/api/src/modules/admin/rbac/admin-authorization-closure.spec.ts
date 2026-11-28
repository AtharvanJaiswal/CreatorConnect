import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient, RoleType, UserStatus } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../../app.js';
import { defaultJwtVerifier } from '../../../services/jwt-verifier.js';
import { redisCache } from '../../../services/redis-cache.js';
import {
  createTestJwt,
  createTestKeySet,
} from '../../../../../../tests/fixtures/auth-test-helper.js';

describe('Workstream A — Granular Authorization Closure, IDOR & Cache Integrity', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();
  const createdUserIds: string[] = [];

  let creatorUser: { id: string; token: string };
  let bystanderUser: { id: string; token: string };
  let bareAdmin: { id: string; sub: string; token: string };
  let supportAdmin: { id: string; sub: string; email: string; token: string };
  let contentModerator: { id: string; token: string };
  let financeAdmin: { id: string; token: string };
  let platformAdmin: { id: string; token: string };
  let userAdmin: { id: string; token: string };
  let superAdmin: { id: string; token: string };
  let suspendedSuperAdmin: { id: string; token: string };
  let deactivatedSuperAdmin: { id: string; token: string };

  let targetPostId: string;
  let targetTicketId: string;
  let heldUserId: string;
  let otherHeldUserId: string;
  let heldUserHoldId: string;

  async function provisionAccount(
    tag: string,
    globalRole: RoleType,
    adminRoleName?: string,
    status: UserStatus = UserStatus.ACTIVE,
  ) {
    const id = generateUuidV7();
    const sub = `sub_authz_${tag}_${Date.now()}_${id.slice(0, 6)}`;
    const email = `authz_${tag}_${Date.now()}_${id.slice(0, 6)}@test.invalid`;
    createdUserIds.push(id);

    await prisma.user.create({
      data: {
        id,
        supabaseAuthId: sub,
        email,
        firstName: tag,
        lastName: 'Authz',
        status,
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: globalRole } },
          },
        },
        ...(adminRoleName
          ? {
              adminUserRoles: {
                create: {
                  id: generateUuidV7(),
                  role: { connect: { name: adminRoleName } },
                },
              },
            }
          : {}),
      },
    });

    const token = await createTestJwt({ sub, email });
    return { id, sub, email, token };
  }

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    creatorUser = await provisionAccount('creator', RoleType.CREATOR);
    bystanderUser = await provisionAccount('bystander', RoleType.CREATOR);
    bareAdmin = await provisionAccount('bare', RoleType.ADMIN);
    supportAdmin = await provisionAccount('support', RoleType.ADMIN, 'SUPPORT_ADMIN');
    contentModerator = await provisionAccount('mod', RoleType.ADMIN, 'CONTENT_MODERATOR');
    financeAdmin = await provisionAccount('fin', RoleType.ADMIN, 'FINANCE_ADMIN');
    platformAdmin = await provisionAccount('plat', RoleType.ADMIN, 'PLATFORM_ADMIN');
    userAdmin = await provisionAccount('uadmin', RoleType.ADMIN, 'USER_ADMIN');
    superAdmin = await provisionAccount('sa', RoleType.ADMIN, 'SUPER_ADMIN');
    suspendedSuperAdmin = await provisionAccount(
      'susp_sa',
      RoleType.ADMIN,
      'SUPER_ADMIN',
      UserStatus.SUSPENDED,
    );
    deactivatedSuperAdmin = await provisionAccount(
      'deact_sa',
      RoleType.ADMIN,
      'SUPER_ADMIN',
      UserStatus.DEACTIVATED,
    );

    const post = await prisma.communityPost.create({
      data: {
        id: generateUuidV7(),
        authorId: creatorUser.id,
        title: 'Workstream A Closure Post',
        body: 'Original active post body for permission checks.',
        type: 'DISCUSSION',
        status: 'ACTIVE',
      },
    });
    targetPostId = post.id;

    const ticket = await prisma.supportTicket.create({
      data: {
        id: generateUuidV7(),
        ticketNumber: `TKT-A-${Date.now().toString(36).toUpperCase()}`,
        requesterId: creatorUser.id,
        category: 'ACCOUNT_ACCESS',
        priority: 'NORMAL',
        status: 'OPEN',
        subject: 'Confidential Creator Ticket',
        description: 'Sensitive support payload for authorization tests.',
        messages: {
          create: [
            {
              id: generateUuidV7(),
              authorId: creatorUser.id,
              authorRole: 'CUSTOMER',
              body: 'Secret attachment context',
              isInternal: false,
            },
            {
              id: generateUuidV7(),
              authorId: supportAdmin.id,
              authorRole: 'STAFF',
              body: 'Staff-only triage internal note',
              isInternal: true,
            },
          ],
        },
      },
    });
    targetTicketId = ticket.id;

    const heldTarget = await provisionAccount('held', RoleType.CREATOR);
    const otherTarget = await provisionAccount('other', RoleType.CREATOR);
    heldUserId = heldTarget.id;
    otherHeldUserId = otherTarget.id;

    const createHoldRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/users/${heldUserId}/legal-holds`,
      headers: { authorization: `Bearer ${userAdmin.token}` },
      payload: {
        reason: 'ACTIVE_DISPUTE',
        caseReference: `CASE-AUTHZ-${Date.now()}`,
        notes: 'Valid legal hold created by USER_ADMIN.',
      },
    });
    expect(createHoldRes.statusCode).toBe(201);
    heldUserHoldId = createHoldRes.json().id;
  });

  afterAll(async () => {
    if (targetPostId) {
      await prisma.moderationAction.deleteMany({ where: { targetUserId: creatorUser.id } });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: targetPostId } });
      await prisma.communityPost.deleteMany({ where: { id: targetPostId } });
    }
    if (targetTicketId) {
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: targetTicketId } });
      await prisma.supportTicketAudit.deleteMany({ where: { ticketId: targetTicketId } });
      await prisma.supportTicketMessage.deleteMany({ where: { ticketId: targetTicketId } });
      await prisma.supportTicket.deleteMany({ where: { id: targetTicketId } });
    }
    for (const uid of createdUserIds) {
      await prisma.moderationAction.deleteMany({
        where: { OR: [{ targetUserId: uid }, { moderatorId: uid }] },
      });
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: uid } });
      await prisma.auditLog.deleteMany({
        where: { OR: [{ userId: uid }, { entityId: uid }] },
      });
      await prisma.adminUserRole.deleteMany({ where: { userId: uid } });
      await prisma.userRole.deleteMany({ where: { userId: uid } });
      await prisma.user.deleteMany({ where: { id: uid } });
    }
    await app.close();
  });

  it('enforces granular RBAC across /admin/users/:id/status including separate suspend vs reactivate permissions', async () => {
    const anon = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${bystanderUser.id}/status`,
      payload: { status: 'SUSPENDED' },
    });
    expect(anon.statusCode).toBe(401);

    for (const deniedToken of [
      creatorUser.token,
      bareAdmin.token,
      supportAdmin.token,
      contentModerator.token,
      financeAdmin.token,
    ]) {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${bystanderUser.id}/status`,
        headers: { authorization: `Bearer ${deniedToken}` },
        payload: { status: 'SUSPENDED' },
      });
      expect(res.statusCode).toBe(403);
    }

    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/admin/users/${bystanderUser.id}/status`,
          headers: { authorization: `Bearer ${suspendedSuperAdmin.token}` },
          payload: { status: 'SUSPENDED' },
        })
      ).statusCode,
    ).toBe(403);

    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/admin/users/${bystanderUser.id}/status`,
          headers: { authorization: `Bearer ${deactivatedSuperAdmin.token}` },
          payload: { status: 'SUSPENDED' },
        })
      ).statusCode,
    ).toBe(403);

    // Bystander must still be ACTIVE after all denied attempts
    const stillActive = await prisma.user.findUnique({ where: { id: bystanderUser.id } });
    expect(stillActive?.status).toBe(UserStatus.ACTIVE);

    // PLATFORM_ADMIN has users.suspend -> can suspend
    const platSuspend = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${bystanderUser.id}/status`,
      headers: { authorization: `Bearer ${platformAdmin.token}` },
      payload: { status: 'SUSPENDED' },
    });
    expect(platSuspend.statusCode).toBe(200);

    // PLATFORM_ADMIN lacks users.reactivate -> cannot set ACTIVE
    const platReactivate = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${bystanderUser.id}/status`,
      headers: { authorization: `Bearer ${platformAdmin.token}` },
      payload: { status: 'ACTIVE' },
    });
    expect(platReactivate.statusCode).toBe(403);

    // USER_ADMIN has users.reactivate -> restores ACTIVE
    const uaReactivate = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${bystanderUser.id}/status`,
      headers: { authorization: `Bearer ${userAdmin.token}` },
      payload: { status: 'ACTIVE' },
    });
    expect(uaReactivate.statusCode).toBe(200);
    expect(uaReactivate.json().status).toBe('ACTIVE');
  });

  it('enforces granular moderation permissions on PATCH /api/v1/admin/community/posts/:id/moderate and hides deleted/hidden views from unauthorized admins', async () => {
    const anon = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/community/posts/${targetPostId}/moderate`,
      payload: { action: 'HIDE', reason: 'Unauthenticated check' },
    });
    expect(anon.statusCode).toBe(401);

    for (const deniedToken of [
      creatorUser.token,
      bareAdmin.token,
      supportAdmin.token,
      financeAdmin.token,
      userAdmin.token,
    ]) {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/community/posts/${targetPostId}/moderate`,
        headers: { authorization: `Bearer ${deniedToken}` },
        payload: { action: 'HIDE', reason: 'Unauthorized moderation attempt.' },
      });
      expect(res.statusCode).toBe(403);
    }

    const activePost = await prisma.communityPost.findUnique({ where: { id: targetPostId } });
    expect(activePost?.status).toBe('ACTIVE');

    // CONTENT_MODERATOR holds reviews.moderate -> allowed
    const hideRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/community/posts/${targetPostId}/moderate`,
      headers: { authorization: `Bearer ${contentModerator.token}` },
      payload: { action: 'HIDE', reason: 'Confirmed moderation policy breach.' },
    });
    expect(hideRes.statusCode).toBe(200);
    expect(hideRes.json().status).toBe('HIDDEN');

    // Bare ADMIN / FINANCE_ADMIN cannot bypass hidden-post filter via GET
    const financeReadHidden = await app.inject({
      method: 'GET',
      url: `/api/v1/community/posts/${targetPostId}`,
      headers: { authorization: `Bearer ${financeAdmin.token}` },
    });
    expect(financeReadHidden.statusCode).toBe(404);

    // SUPER_ADMIN can unhide
    const unhideRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/community/posts/${targetPostId}/moderate`,
      headers: { authorization: `Bearer ${superAdmin.token}` },
      payload: { action: 'UNHIDE', reason: 'Appeal upheld by administrator.' },
    });
    expect(unhideRes.statusCode).toBe(200);
    expect(unhideRes.json().status).toBe('ACTIVE');
  });

  it('enforces granular support.* permissions on /staff/support/* and closes customer-route ADMIN IDOR bypass', async () => {
    const anon = await app.inject({ method: 'GET', url: '/api/v1/staff/support/tickets' });
    expect(anon.statusCode).toBe(401);

    // Creator cannot touch staff queue or notes
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/staff/support/tickets',
          headers: { authorization: `Bearer ${creatorUser.token}` },
        })
      ).statusCode,
    ).toBe(403);

    // Owner creator can view own customer messages, with internal staff notes stripped
    const ownerMessages = await app.inject({
      method: 'GET',
      url: `/api/v1/support/tickets/${targetTicketId}/messages`,
      headers: { authorization: `Bearer ${creatorUser.token}` },
    });
    expect(ownerMessages.statusCode).toBe(200);
    expect(JSON.stringify(ownerMessages.json())).not.toContain('Staff-only triage internal note');

    for (const deniedToken of [
      bystanderUser.token,
      bareAdmin.token,
      contentModerator.token,
      financeAdmin.token,
      userAdmin.token,
    ]) {
      expect(
        (
          await app.inject({
            method: 'GET',
            url: '/api/v1/staff/support/tickets',
            headers: { authorization: `Bearer ${deniedToken}` },
          })
        ).statusCode,
      ).toBe(403);

      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/staff/support/tickets/${targetTicketId}/notes`,
            headers: { authorization: `Bearer ${deniedToken}` },
            payload: { body: 'Unauthorized staff internal note.' },
          })
        ).statusCode,
      ).toBe(403);

      // Customer-route IDOR check: unauthorized admin cannot inspect someone else's messages or resolve/reopen their ticket
      expect(
        (
          await app.inject({
            method: 'GET',
            url: `/api/v1/support/tickets/${targetTicketId}/messages`,
            headers: { authorization: `Bearer ${deniedToken}` },
          })
        ).statusCode,
      ).toBe(403);

      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/support/tickets/${targetTicketId}/resolve`,
            headers: { authorization: `Bearer ${deniedToken}` },
          })
        ).statusCode,
      ).toBe(403);
    }

    // SUPPORT_ADMIN succeeds on /staff/support/tickets and customer-route messages (including internal notes)
    const staffQueue = await app.inject({
      method: 'GET',
      url: '/api/v1/staff/support/tickets',
      headers: { authorization: `Bearer ${supportAdmin.token}` },
    });
    expect(staffQueue.statusCode).toBe(200);

    const staffMessages = await app.inject({
      method: 'GET',
      url: `/api/v1/support/tickets/${targetTicketId}/messages`,
      headers: { authorization: `Bearer ${supportAdmin.token}` },
    });
    expect(staffMessages.statusCode).toBe(200);
    expect(staffMessages.json().items.some((m: any) => m.isInternal === true)).toBe(true);
  });

  it('enforces users.privacy on legal holds, blocks cross-user legal-hold IDOR, enforces Stage A block on erasure execution, and rejects stale/revoked cache', async () => {
    // 1. Non-privacy admins denied 403 on legal holds
    for (const deniedToken of [
      creatorUser.token,
      bareAdmin.token,
      supportAdmin.token,
      contentModerator.token,
      financeAdmin.token,
    ]) {
      expect(
        (
          await app.inject({
            method: 'GET',
            url: `/api/v1/admin/users/${heldUserId}/legal-holds`,
            headers: { authorization: `Bearer ${deniedToken}` },
          })
        ).statusCode,
      ).toBe(403);

      expect(
        (
          await app.inject({
            method: 'POST',
            url: `/api/v1/admin/users/${heldUserId}/legal-holds`,
            headers: { authorization: `Bearer ${deniedToken}` },
            payload: {
              reason: 'ACTIVE_DISPUTE',
              caseReference: 'CASE-UNAUTH',
              notes: 'Should fail auth',
            },
          })
        ).statusCode,
      ).toBe(403);
    }

    // 2. Cross-user IDOR on DELETE legal hold: passing otherHeldUserId with heldUserHoldId fails 404 & leaves hold active
    const idorDeleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/users/${otherHeldUserId}/legal-holds/${heldUserHoldId}`,
      headers: { authorization: `Bearer ${userAdmin.token}` },
      payload: { releaseNotes: 'Attempted cross-user IDOR release' },
    });
    expect(idorDeleteRes.statusCode).toBe(404);

    const holdsStillActive = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/users/${heldUserId}/legal-holds`,
      headers: { authorization: `Bearer ${userAdmin.token}` },
    });
    expect(holdsStillActive.statusCode).toBe(200);
    expect(holdsStillActive.json()).toHaveLength(1);
    expect(holdsStillActive.json()[0].id).toBe(heldUserHoldId);

    // 3. Stage A Governance Hard-Stop on POST /api/v1/admin/privacy/requests/:id/execute
    const erasureRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/privacy/requests/${generateUuidV7()}/execute`,
      headers: { authorization: `Bearer ${superAdmin.token}` },
    });
    expect(erasureRes.statusCode).toBe(403);
    expect(erasureRes.json().code).toBe('STAGE_A_GOVERNANCE_BLOCKED');

    // 4. Stale Redis cache lacking adminPermissions cannot grant access to bare ADMIN
    await redisCache.invalidateUser(bareAdmin.id, bareAdmin.sub);
    const staleCacheProbe = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${bystanderUser.id}/status`,
      headers: { authorization: `Bearer ${bareAdmin.token}` },
      payload: { status: 'SUSPENDED' },
    });
    expect(staleCacheProbe.statusCode).toBe(403);

    // 5. Revoking SUPPORT_ADMIN role immediately invalidates authorization
    const revokeSupport = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/admins/revoke',
      headers: { authorization: `Bearer ${superAdmin.token}` },
      payload: { userId: supportAdmin.id, roleName: 'SUPPORT_ADMIN' },
    });
    expect(revokeSupport.statusCode).toBe(200);

    const afterRevoke = await app.inject({
      method: 'GET',
      url: '/api/v1/staff/support/tickets',
      headers: { authorization: `Bearer ${supportAdmin.token}` },
    });
    expect(afterRevoke.statusCode).toBe(403);
  });
});
