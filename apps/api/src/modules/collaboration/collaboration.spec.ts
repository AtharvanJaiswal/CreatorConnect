import { describe, expect, it, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';

describe('Phase 11: Saved Creators, Shortlists & Hiring Invitations', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let clientUserId: string;
  let clientToken: string;
  let clientBrandProfileId: string;

  let creatorUserId: string;
  let creatorToken: string;
  let creatorProfileId: string;

  let secondCreatorUserId: string;
  let secondCreatorToken: string;
  let secondCreatorProfileId: string;

  let otherClientUserId: string;
  let otherClientToken: string;

  let suspendedCreatorUserId: string;

  let testProjectId: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    // 1. Client User (BRAND)
    clientUserId = generateUuidV7();
    clientBrandProfileId = generateUuidV7();
    clientToken = await createTestJwt({
      sub: `sub_collab_client_${generateUuidV7().replace(/-/g, '')}`,
      email: `collab_client_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedClient: any = await defaultJwtVerifier.verifyToken(clientToken);
    await prisma.user.create({
      data: {
        id: clientUserId,
        supabaseAuthId: decodedClient.sub,
        email: decodedClient.email,
        firstName: 'Campaign',
        lastName: 'Manager',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: 'BRAND' } },
          },
        },
        brandProfile: {
          create: {
            id: clientBrandProfileId,
            companyName: 'Acme Media Brands',
            websiteUrl: 'https://acmemedia.test',
          },
        },
      },
    });

    // 2. Creator User A (CREATOR)
    creatorUserId = generateUuidV7();
    creatorProfileId = generateUuidV7();
    creatorToken = await createTestJwt({
      sub: `sub_collab_creator_${generateUuidV7().replace(/-/g, '')}`,
      email: `collab_creator_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedCreator: any = await defaultJwtVerifier.verifyToken(creatorToken);
    await prisma.user.create({
      data: {
        id: creatorUserId,
        supabaseAuthId: decodedCreator.sub,
        email: decodedCreator.email,
        firstName: 'Elena',
        lastName: 'Rostova',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: 'CREATOR' } },
          },
        },
        creatorProfile: {
          create: {
            id: creatorProfileId,
            tagline: 'Tech & Lifestyle Video Director',
            startingRate: 15000,
            currency: 'INR',
            visibility: 'PUBLIC',
            isVerified: true,
            locationCity: 'Bengaluru',
            locationCountry: 'IN',
          },
        },
      },
    });

    // 3. Creator User B (CREATOR)
    secondCreatorUserId = generateUuidV7();
    secondCreatorProfileId = generateUuidV7();
    secondCreatorToken = await createTestJwt({
      sub: `sub_collab_creator2_${generateUuidV7().replace(/-/g, '')}`,
      email: `collab_creator2_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedCreator2: any = await defaultJwtVerifier.verifyToken(secondCreatorToken);
    await prisma.user.create({
      data: {
        id: secondCreatorUserId,
        supabaseAuthId: decodedCreator2.sub,
        email: decodedCreator2.email,
        firstName: 'Marcus',
        lastName: 'Vance',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: 'CREATOR' } },
          },
        },
        creatorProfile: {
          create: {
            id: secondCreatorProfileId,
            tagline: 'Sound Designer & Motion Editor',
            startingRate: 12000,
            currency: 'INR',
            visibility: 'PUBLIC',
            isVerified: false,
          },
        },
      },
    });

    // 4. Other Client (For isolation tests)
    otherClientUserId = generateUuidV7();
    otherClientToken = await createTestJwt({
      sub: `sub_collab_other_${generateUuidV7().replace(/-/g, '')}`,
      email: `collab_other_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedOther: any = await defaultJwtVerifier.verifyToken(otherClientToken);
    await prisma.user.create({
      data: {
        id: otherClientUserId,
        supabaseAuthId: decodedOther.sub,
        email: decodedOther.email,
        firstName: 'Other',
        lastName: 'Client',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: 'BRAND' } },
          },
        },
      },
    });

    // 5. Suspended Creator (For eligibility tests)
    suspendedCreatorUserId = generateUuidV7();
    const subSuspended = `sub_collab_susp_${generateUuidV7().replace(/-/g, '')}`;
    await prisma.user.create({
      data: {
        id: suspendedCreatorUserId,
        supabaseAuthId: subSuspended,
        email: `${subSuspended}@test.com`,
        status: 'SUSPENDED',
      },
    });

    // 6. Project owned by Client
    const assignId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: assignId,
        brandId: clientBrandProfileId,
        title: 'Q4 Product Launch Video Production',
        description: 'Complete commercial production',
        budgetMin: 50000,
        budgetMax: 100000,
        deadline: new Date(Date.now() + 86400000 * 30),
        status: 'IN_PROGRESS',
      },
    });

    const appId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: appId,
        assignmentId: assignId,
        applicantId: creatorUserId,
        coverLetter: 'Application for video production',
        proposedRate: 75000,
        status: 'ACCEPTED',
      },
    });

    testProjectId = generateUuidV7();
    await prisma.project.create({
      data: {
        id: testProjectId,
        assignmentId: assignId,
        applicationId: appId,
        clientId: clientUserId,
        talentId: creatorUserId,
        title: 'Q4 Product Launch Video Production',
        totalAmount: 75000,
        currency: 'INR',
        status: 'IN_PROGRESS',
      },
    });
  });

  // ==============================================================================
  // Section 1: Saved Creators
  // ==============================================================================

  describe('Saved Creators Workflow', () => {
    it('allows client to save an eligible creator (201)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/saved-creators',
        headers: { authorization: `Bearer ${clientToken}` },
        payload: { creatorId: creatorUserId },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.clientId).toBe(clientUserId);
      expect(body.creatorId).toBe(creatorUserId);
    });

    it('confirms creator is saved via check endpoint', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/saved-creators/check/${creatorUserId}`,
        headers: { authorization: `Bearer ${clientToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.isSaved).toBe(true);
    });

    it('ensures repeated save requests are idempotent (201 without duplication)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/saved-creators',
        headers: { authorization: `Bearer ${clientToken}` },
        payload: { creatorId: creatorUserId },
      });

      expect(res.statusCode).toBe(201);
      const count = await prisma.savedCreator.count({
        where: { clientId: clientUserId, creatorId: creatorUserId },
      });
      expect(count).toBe(1);
    });

    it('lists saved creators with creator details and profile info', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/saved-creators',
        headers: { authorization: `Bearer ${clientToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      const saved = body.items.find((i: any) => i.creatorId === creatorUserId);
      expect(saved).toBeDefined();
      expect(saved.creator.displayName).toBe('Elena Rostova');
      expect(saved.creator.creatorProfile.tagline).toBe('Tech & Lifestyle Video Director');
    });

    it('rejects saving own user profile (400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/saved-creators',
        headers: { authorization: `Bearer ${clientToken}` },
        payload: { creatorId: clientUserId },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects saving a suspended creator (400)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/saved-creators',
        headers: { authorization: `Bearer ${clientToken}` },
        payload: { creatorId: suspendedCreatorUserId },
      });

      expect(res.statusCode).toBe(400);
    });

    it('allows client to unsave a creator (200) and verifies check status is false', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/saved-creators/${creatorUserId}`,
        headers: { authorization: `Bearer ${clientToken}` },
      });

      expect(res.statusCode).toBe(200);

      const checkRes = await app.inject({
        method: 'GET',
        url: `/api/v1/saved-creators/check/${creatorUserId}`,
        headers: { authorization: `Bearer ${clientToken}` },
      });
      expect(JSON.parse(checkRes.body).isSaved).toBe(false);
    });
  });

  // ==============================================================================
  // Section 2: Project Shortlists
  // ==============================================================================

  describe('Project Shortlists Workflow', () => {
    let createdShortlistId: string;

    it('allows client to create a named shortlist (201)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/shortlists',
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          name: 'Campaign A Directors',
          description: 'Top tier video directors for Q4',
          projectId: testProjectId,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.name).toBe('Campaign A Directors');
      expect(body.projectId).toBe(testProjectId);
      expect(body.memberCount).toBe(0);
      createdShortlistId = body.id;
    });

    it('rejects duplicate shortlist name for the same owner (409)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/shortlists',
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          name: 'Campaign A Directors',
        },
      });

      expect(res.statusCode).toBe(409);
    });

    it('allows client to add a creator to shortlist (201)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/shortlists/${createdShortlistId}/members`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          creatorId: creatorUserId,
          note: 'Preferred for dynamic handheld shots',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.shortlistId).toBe(createdShortlistId);
      expect(body.creatorId).toBe(creatorUserId);
      expect(body.note).toBe('Preferred for dynamic handheld shots');
    });

    it('rejects duplicate creator addition to the same shortlist (409)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/shortlists/${createdShortlistId}/members`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          creatorId: creatorUserId,
        },
      });

      expect(res.statusCode).toBe(409);
    });

    it('allows client to add second creator to shortlist (201)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/shortlists/${createdShortlistId}/members`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          creatorId: secondCreatorUserId,
        },
      });

      expect(res.statusCode).toBe(201);
    });

    it('retrieves shortlist by ID with member list (200)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/shortlists/${createdShortlistId}`,
        headers: { authorization: `Bearer ${clientToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.id).toBe(createdShortlistId);
      expect(body.memberCount).toBe(2);
      expect(body.members.length).toBe(2);
    });

    it('enforces cross-client isolation: other client cannot view or mutate shortlist (403)', async () => {
      // Attempt read
      const readRes = await app.inject({
        method: 'GET',
        url: `/api/v1/shortlists/${createdShortlistId}`,
        headers: { authorization: `Bearer ${otherClientToken}` },
      });
      expect(readRes.statusCode).toBe(403);

      // Attempt add member
      const addRes = await app.inject({
        method: 'POST',
        url: `/api/v1/shortlists/${createdShortlistId}/members`,
        headers: { authorization: `Bearer ${otherClientToken}` },
        payload: { creatorId: creatorUserId },
      });
      expect(addRes.statusCode).toBe(403);
    });

    it('allows removing a member from shortlist (200)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/shortlists/${createdShortlistId}/members/${secondCreatorUserId}`,
        headers: { authorization: `Bearer ${clientToken}` },
      });

      expect(res.statusCode).toBe(200);

      const check = await app.inject({
        method: 'GET',
        url: `/api/v1/shortlists/${createdShortlistId}`,
        headers: { authorization: `Bearer ${clientToken}` },
      });
      expect(JSON.parse(check.body).memberCount).toBe(1);
    });
  });

  // ==============================================================================
  // Section 3: Hiring Invitations & Concurrency-Safe Transitions
  // ==============================================================================

  describe('Hiring Invitations & Concurrency-Safe State Machine', () => {
    let invitationId: string;

    it('allows project client to create a hiring invitation (201)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/invitations',
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          projectId: testProjectId,
          creatorId: secondCreatorUserId,
          message: 'We would love to invite you to direct our commercial video!',
          expiresInDays: 7,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.projectId).toBe(testProjectId);
      expect(body.inviterId).toBe(clientUserId);
      expect(body.inviteeId).toBe(secondCreatorUserId);
      expect(body.status).toBe('PENDING');
      invitationId = body.id;

      // Verify Transactional Outbox Event created
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: invitationId,
          eventType: 'invitation.created.v1',
        },
      });
      expect(outbox).not.toBeNull();
      expect(outbox?.status).toBe('PENDING');

      // Verify in-app Notification created for invitee
      const notif = await prisma.notification.findFirst({
        where: {
          userId: secondCreatorUserId,
          type: 'INVITATION_RECEIVED' as any,
        },
      });
      expect(notif).not.toBeNull();
    });

    it('rejects duplicate active PENDING invitation for same creator and project (409)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/invitations',
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          projectId: testProjectId,
          creatorId: secondCreatorUserId,
          message: 'Second duplicate invitation attempt',
        },
      });

      expect(res.statusCode).toBe(409);
    });

    it('rejects invitation creation from non-owner of project (403)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/invitations',
        headers: { authorization: `Bearer ${otherClientToken}` },
        payload: {
          projectId: testProjectId,
          creatorId: secondCreatorUserId,
          message: 'Unauthorized invite attempt',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('lists sent invitations for client', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/invitations/sent',
        headers: { authorization: `Bearer ${clientToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(body.items.some((i: any) => i.id === invitationId)).toBe(true);
    });

    it('lists received invitations for creator', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/invitations/received',
        headers: { authorization: `Bearer ${secondCreatorToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      expect(body.items.some((i: any) => i.id === invitationId)).toBe(true);
    });

    it('rejects unauthorized user from accepting the invitation (403)', async () => {
      // The client cannot accept their own sent invitation
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/invitations/${invitationId}/accept`,
        headers: { authorization: `Bearer ${clientToken}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('demonstrates concurrency safety under race conditions (atomic updateMany)', async () => {
      // Create a fresh invitation for race testing
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/invitations',
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          projectId: testProjectId,
          creatorId: creatorUserId,
          message: 'Concurrency race invitation',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const raceInviteId = JSON.parse(createRes.body).id;

      // Fire simultaneous Accept and Decline requests
      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: `/api/v1/invitations/${raceInviteId}/accept`,
          headers: { authorization: `Bearer ${creatorToken}` },
        }),
        app.inject({
          method: 'POST',
          url: `/api/v1/invitations/${raceInviteId}/decline`,
          headers: { authorization: `Bearer ${creatorToken}` },
        }),
      ]);

      const statusCodes = [res1.statusCode, res2.statusCode].sort();
      // Exactly one must succeed (200) and the other must fail with 400 (Invalid state transition)
      expect(statusCodes).toEqual([200, 400]);

      // Verify the resulting status is one of the terminal states and cannot be re-accepted
      const finalRes = await app.inject({
        method: 'GET',
        url: `/api/v1/invitations/${raceInviteId}`,
        headers: { authorization: `Bearer ${creatorToken}` },
      });
      const finalStatus = JSON.parse(finalRes.body).status;
      expect(['ACCEPTED', 'DECLINED']).toContain(finalStatus);

      // Re-accepting must fail
      const retryRes = await app.inject({
        method: 'POST',
        url: `/api/v1/invitations/${raceInviteId}/accept`,
        headers: { authorization: `Bearer ${creatorToken}` },
      });
      expect(retryRes.statusCode).toBe(400);
    });

    it('allows authorized client to withdraw a pending invitation (200)', async () => {
      // Create another invitation to test withdrawal
      const assignId = generateUuidV7();
      await prisma.assignment.create({
        data: {
          id: assignId,
          brandId: clientBrandProfileId,
          title: 'Secondary Project for Withdrawal Test',
          description: 'Desc',
          budgetMin: 30000,
          budgetMax: 50000,
          deadline: new Date(Date.now() + 86400000 * 30),
          status: 'IN_PROGRESS',
        },
      });
      const appId = generateUuidV7();
      await prisma.application.create({
        data: {
          id: appId,
          assignmentId: assignId,
          applicantId: creatorUserId,
          coverLetter: 'Application',
          proposedRate: 35000,
          status: 'ACCEPTED',
        },
      });
      const secondProjId = generateUuidV7();
      await prisma.project.create({
        data: {
          id: secondProjId,
          assignmentId: assignId,
          applicationId: appId,
          clientId: clientUserId,
          talentId: creatorUserId,
          title: 'Secondary Project for Withdrawal Test',
          totalAmount: 35000,
          status: 'IN_PROGRESS',
        },
      });

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/v1/invitations',
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          projectId: secondProjId,
          creatorId: secondCreatorUserId,
          message: 'Invitation to be withdrawn',
        },
      });
      expect(createRes.statusCode).toBe(201);
      const withdrawInviteId = JSON.parse(createRes.body).id;

      // Withdraw by client
      const withdrawRes = await app.inject({
        method: 'POST',
        url: `/api/v1/invitations/${withdrawInviteId}/withdraw`,
        headers: { authorization: `Bearer ${clientToken}` },
      });
      expect(withdrawRes.statusCode).toBe(200);

      // Verify status is WITHDRAWN
      const checkRes = await app.inject({
        method: 'GET',
        url: `/api/v1/invitations/${withdrawInviteId}`,
        headers: { authorization: `Bearer ${clientToken}` },
      });
      expect(JSON.parse(checkRes.body).status).toBe('WITHDRAWN');

      // Outbox event invitation.withdrawn.v1 written
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: withdrawInviteId,
          eventType: 'invitation.withdrawn.v1',
        },
      });
      expect(outbox).not.toBeNull();
    });
  });
});
