import { describe, expect, it, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';

describe('Phase 6 Increment 4: Reviews, Reputation Scoring & Platform Governance', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let clientUserId: string;
  let clientToken: string;
  let clientBrandProfileId: string;

  let talentUserId: string;
  let talentToken: string;

  let adminUserId: string;
  let adminToken: string;

  let adminParticipantUserId: string;
  let adminParticipantToken: string;

  let bystanderUserId: string;
  let bystanderToken: string;

  let completedProjectId: string;
  let inProgressProjectId: string;
  let disputedProjectId: string;

  async function createIndependentProject(params: {
    clientId: string;
    talentId: string;
    amount: number;
    title?: string;
    status?: any;
  }) {
    const assignId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: assignId,
        brandId: clientBrandProfileId,
        title: params.title || 'Independent Review Project Assignment',
        description: 'Brief description',
        budgetMin: params.amount,
        budgetMax: params.amount * 2,
        deadline: new Date(Date.now() + 86400000 * 30),
        status: 'IN_PROGRESS',
      },
    });

    const appId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: appId,
        assignmentId: assignId,
        applicantId: params.talentId,
        coverLetter: 'Application for review testing',
        proposedRate: params.amount,
        status: 'ACCEPTED',
      },
    });

    const projId = generateUuidV7();
    return prisma.project.create({
      data: {
        id: projId,
        assignmentId: assignId,
        applicationId: appId,
        clientId: params.clientId,
        talentId: params.talentId,
        title: params.title || 'Independent Review Project',
        totalAmount: params.amount,
        currency: 'INR',
        status: params.status || 'IN_PROGRESS',
      },
    });
  }

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    // 1. Client User (BRAND)
    clientUserId = generateUuidV7();
    clientBrandProfileId = generateUuidV7();
    clientToken = await createTestJwt({
      sub: `sub_rev_client_${generateUuidV7().replace(/-/g, '')}`,
      email: `rev_client_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedClient: any = await defaultJwtVerifier.verifyToken(clientToken);
    await prisma.user.create({
      data: {
        id: clientUserId,
        supabaseAuthId: decodedClient.sub,
        email: decodedClient.email,
        firstName: 'Client',
        lastName: 'Brand',
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
            companyName: 'Review Test Brand Corp',
            websiteUrl: 'https://brandcorp.test',
          },
        },
      },
    });

    // 2. Talent User (CREATOR)
    talentUserId = generateUuidV7();
    talentToken = await createTestJwt({
      sub: `sub_rev_talent_${generateUuidV7().replace(/-/g, '')}`,
      email: `rev_talent_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedTalent: any = await defaultJwtVerifier.verifyToken(talentToken);
    await prisma.user.create({
      data: {
        id: talentUserId,
        supabaseAuthId: decodedTalent.sub,
        email: decodedTalent.email,
        firstName: 'Talent',
        lastName: 'Creator',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: 'CREATOR' } },
          },
        },
        creatorProfile: {
          create: {
            id: generateUuidV7(),
            bio: 'Creator for review tests',
          },
        },
      },
    });

    // 3. Platform Admin (Neutral)
    adminUserId = generateUuidV7();
    adminToken = await createTestJwt({
      sub: `sub_rev_admin_${generateUuidV7().replace(/-/g, '')}`,
      email: `rev_admin_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedAdmin: any = await defaultJwtVerifier.verifyToken(adminToken);
    await prisma.user.create({
      data: {
        id: adminUserId,
        supabaseAuthId: decodedAdmin.sub,
        email: decodedAdmin.email,
        firstName: 'Neutral',
        lastName: 'Admin',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: 'ADMIN' } },
          },
        },
      },
    });

    // 4. Admin who is also a project participant (for conflict-of-interest testing)
    adminParticipantUserId = generateUuidV7();
    adminParticipantToken = await createTestJwt({
      sub: `sub_rev_admin_part_${generateUuidV7().replace(/-/g, '')}`,
      email: `rev_admin_part_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedAdminPart: any = await defaultJwtVerifier.verifyToken(adminParticipantToken);
    await prisma.user.create({
      data: {
        id: adminParticipantUserId,
        supabaseAuthId: decodedAdminPart.sub,
        email: decodedAdminPart.email,
        firstName: 'Admin',
        lastName: 'Participant',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: 'ADMIN' } },
          },
        },
      },
    });

    // 5. Bystander User
    bystanderUserId = generateUuidV7();
    bystanderToken = await createTestJwt({
      sub: `sub_rev_bystander_${generateUuidV7().replace(/-/g, '')}`,
      email: `rev_bystander_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedBystander: any = await defaultJwtVerifier.verifyToken(bystanderToken);
    await prisma.user.create({
      data: {
        id: bystanderUserId,
        supabaseAuthId: decodedBystander.sub,
        email: decodedBystander.email,
        firstName: 'Innocent',
        lastName: 'Bystander',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: { connect: { name: 'CREATOR' } },
          },
        },
      },
    });

    // Create Test Projects
    const compProj = await createIndependentProject({
      clientId: clientUserId,
      talentId: talentUserId,
      amount: 150000,
      title: 'Completed Brand Campaign Project',
      status: 'COMPLETED',
    });
    completedProjectId = compProj.id;

    const inProgProj = await createIndependentProject({
      clientId: clientUserId,
      talentId: talentUserId,
      amount: 100000,
      title: 'In Progress Campaign Project',
      status: 'IN_PROGRESS',
    });
    inProgressProjectId = inProgProj.id;

    const dispProj = await createIndependentProject({
      clientId: clientUserId,
      talentId: talentUserId,
      amount: 120000,
      title: 'Disputed Campaign Project',
      status: 'COMPLETED',
    });
    disputedProjectId = dispProj.id;
    // Attach an active dispute to disputedProjectId
    await prisma.dispute.create({
      data: {
        id: generateUuidV7(),
        projectId: disputedProjectId,
        openedById: clientUserId,
        reason: 'DELIVERABLE_POOR_QUALITY',
        description: 'Quality did not meet agreed brief',
        status: 'OPEN',
      },
    });
  });

  describe('1. Review Eligibility & Authorization Invariants', () => {
    it('rejects review submission for project in IN_PROGRESS state', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${inProgressProjectId}/reviews`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          rating: 5,
          feedback: 'Great video work delivered promptly and professionally.',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('PROJECT_NOT_REVIEWABLE');
    });

    it('rejects review submission when project has an active open dispute', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${disputedProjectId}/reviews`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          rating: 1,
          feedback: 'Dispute is open so this review must not be accepted.',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('PROJECT_NOT_REVIEWABLE');
    });

    it('rejects review submission by an unauthorized bystander', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${completedProjectId}/reviews`,
        headers: { authorization: `Bearer ${bystanderToken}` },
        payload: {
          rating: 5,
          feedback: 'I was not part of this project but I want to review anyway.',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.code).toBe('NOT_PROJECT_PARTICIPANT');
    });

    it('rejects rating outside 1-5 bounds', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${completedProjectId}/reviews`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          rating: 6,
          feedback: 'Rating 6 is out of allowed 1-5 star bounds.',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rejects feedback with less than 10 characters', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${completedProjectId}/reviews`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          rating: 5,
          feedback: 'Too short',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('successfully creates review by client for talent on COMPLETED project', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${completedProjectId}/reviews`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          rating: 5,
          communicationRating: 5,
          qualityRating: 5,
          adherenceRating: 4,
          feedback: 'Exceptional delivery quality and excellent communication throughout.',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.rating).toBe(5);
      expect(body.communicationRating).toBe(5);
      expect(body.qualityRating).toBe(5);
      expect(body.adherenceRating).toBe(4);
      expect(body.reviewerId).toBe(clientUserId);
      expect(body.revieweeId).toBe(talentUserId);
      expect(body.status).toBe('PUBLISHED');
      expect(body.editCount).toBe(0);

      // Verify notification created for talent
      const notif = await prisma.notification.findFirst({
        where: {
          userId: talentUserId,
          type: 'REVIEW_RECEIVED',
        },
      });
      expect(notif).toBeDefined();

      // Verify outbox event created
      const outbox = await prisma.outboxEvent.findFirst({
        where: {
          aggregateId: body.id,
          eventType: 'review.created.v1',
        },
      });
      expect(outbox).toBeDefined();
    });

    it('rejects duplicate review by same client for the same project', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${completedProjectId}/reviews`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          rating: 4,
          feedback: 'Trying to review a second time for the exact same project.',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.code).toBe('REVIEW_ALREADY_EXISTS');
    });

    it('successfully allows reciprocal review by creator for client', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${completedProjectId}/reviews`,
        headers: { authorization: `Bearer ${talentToken}` },
        payload: {
          rating: 4,
          communicationRating: 4,
          qualityRating: 5,
          adherenceRating: 4,
          feedback: 'Clear requirements, smooth feedback, and prompt milestone signoff.',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.rating).toBe(4);
      expect(body.reviewerId).toBe(talentUserId);
      expect(body.revieweeId).toBe(clientUserId);
      expect(body.status).toBe('PUBLISHED');
    });
  });

  describe('2. Review Editing & 48-Hour Window', () => {
    let clientReviewId: string;

    beforeAll(async () => {
      const rev = await prisma.review.findUnique({
        where: {
          projectId_reviewerId: {
            projectId: completedProjectId,
            reviewerId: clientUserId,
          },
        },
      });
      clientReviewId = rev!.id;
    });

    it('allows author to edit review within 48-hour window', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/reviews/${clientReviewId}`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          rating: 5,
          feedback: 'Updated feedback: Absolutely exceptional delivery and flawless collaboration.',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.editCount).toBe(1);
      expect(body.editedAt).toBeDefined();
      expect(body.feedback).toContain('Updated feedback');
    });

    it('rejects edit attempt by a non-author', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/reviews/${clientReviewId}`,
        headers: { authorization: `Bearer ${talentToken}` },
        payload: {
          rating: 1,
          feedback: 'Talent trying to tamper with client review maliciously.',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.code).toBe('FORBIDDEN');
    });

    it('rejects edit when 48-hour window has expired', async () => {
      // Simulate expired review by backdating createdAt by 50 hours
      const oldReviewProj = await createIndependentProject({
        clientId: clientUserId,
        talentId: talentUserId,
        amount: 80000,
        title: 'Old Project for Edit Window Test',
        status: 'COMPLETED',
      });

      const oldRevId = generateUuidV7();
      await prisma.review.create({
        data: {
          id: oldRevId,
          projectId: oldReviewProj.id,
          reviewerId: clientUserId,
          revieweeId: talentUserId,
          rating: 4,
          feedback: 'Old review feedback submitted over two days ago.',
          status: 'PUBLISHED',
          createdAt: new Date(Date.now() - 50 * 3600 * 1000), // 50 hours ago
        },
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/reviews/${oldRevId}`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          rating: 5,
          feedback: 'Attempting to edit long after 48h expiration window.',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('REVIEW_EDIT_WINDOW_EXPIRED');
    });
  });

  describe('3. Reporting Abuse & Moderation Governance', () => {
    let reviewToReportId: string;

    beforeAll(async () => {
      const testProj = await createIndependentProject({
        clientId: clientUserId,
        talentId: talentUserId,
        amount: 90000,
        title: 'Project for Abuse Reporting Test',
        status: 'COMPLETED',
      });

      const revId = generateUuidV7();
      await prisma.review.create({
        data: {
          id: revId,
          projectId: testProj.id,
          reviewerId: clientUserId,
          revieweeId: talentUserId,
          rating: 1,
          feedback: 'Offensive and inappropriate remarks violating community guidelines.',
          status: 'PUBLISHED',
        },
      });
      reviewToReportId = revId;
    });

    it('allows authenticated user to report a violating review', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${reviewToReportId}/report`,
        headers: { authorization: `Bearer ${talentToken}` },
        payload: {
          reason: 'HARASSMENT',
          details: 'This review contains personal attacks and defamatory comments.',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.reason).toBe('HARASSMENT');
      expect(body.status).toBe('PENDING');

      // Review should now be transitioned to FLAGGED
      const updatedRev = await prisma.review.findUnique({
        where: { id: reviewToReportId },
      });
      expect(updatedRev?.status).toBe('FLAGGED');
    });

    it('rejects duplicate report from same reporter', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${reviewToReportId}/report`,
        headers: { authorization: `Bearer ${talentToken}` },
        payload: {
          reason: 'HARASSMENT',
          details: 'Reporting a second time.',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.code).toBe('REVIEW_REPORT_ALREADY_EXISTS');
    });

    it('rejects non-admin attempt to moderate review', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${reviewToReportId}/moderate`,
        headers: { authorization: `Bearer ${talentToken}` },
        payload: {
          action: 'HIDE',
          reason: 'Attempting to hide my own review without admin privileges.',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.code).toBe('FORBIDDEN');
    });

    it('enforces Anti-Conflict-of-Interest Guard when admin is review participant', async () => {
      // Create a project where adminParticipantUserId is the reviewer
      const conflictProj = await createIndependentProject({
        clientId: adminParticipantUserId,
        talentId: talentUserId,
        amount: 50000,
        title: 'Admin Conflict Test Project',
        status: 'COMPLETED',
      });

      const conflictRevId = generateUuidV7();
      await prisma.review.create({
        data: {
          id: conflictRevId,
          projectId: conflictProj.id,
          reviewerId: adminParticipantUserId,
          revieweeId: talentUserId,
          rating: 2,
          feedback: 'Admin participant review that should not be self-moderated.',
          status: 'FLAGGED',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${conflictRevId}/moderate`,
        headers: { authorization: `Bearer ${adminParticipantToken}` },
        payload: {
          action: 'RESTORE',
          reason: 'Admin participant trying to clear flag on their own review.',
        },
      });

      expect(res.statusCode).toBe(403);
      const body = res.json();
      expect(body.code).toBe('SELF_MODERATION_NOT_ALLOWED');
    });

    it('allows neutral admin to HIDE reported review with reason and audit log', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${reviewToReportId}/moderate`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          action: 'HIDE',
          reason: 'Review violated platform civility policy.',
          internalNotes: 'Internal audit: confirmed harassment in feedback text.',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.review.status).toBe('HIDDEN');
      expect(body.audit.actionType).toBe('HIDE');
      expect(body.audit.reason).toContain('civility policy');
    });

    it('prevents author from editing HIDDEN review', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/reviews/${reviewToReportId}`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          rating: 3,
          feedback: 'Trying to edit after admin hid the review.',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body.code).toBe('REVIEW_ALREADY_MODERATED');
    });

    it('allows neutral admin to RESTORE review back to PUBLISHED', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${reviewToReportId}/moderate`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          action: 'RESTORE',
          reason: 'Appealed and reviewed: text meets policy threshold.',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.review.status).toBe('PUBLISHED');
    });

    it('allows admin to query moderation queue', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/reviews/moderation-queue',
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.items)).toBe(true);
    });
  });

  describe('4. Reputation Service, Cold-Start & Deterministic Bayesian Math', () => {
    it('returns cold-start defaults for a user with zero reviews', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${bystanderUserId}/reputation`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.totalReviews).toBe(0);
      expect(body.averageRating).toBeNull();
      expect(body.bayesianScore).toBeNull();
      expect(body.ratingDistribution).toEqual({
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      });
      expect(body.categoryAverages).toEqual({
        communication: null,
        quality: null,
        adherence: null,
      });
    });

    it('calculates deterministic reputation metrics and Bayesian shrinkage correctly', async () => {
      // Create a fresh talent user with multiple known reviews
      const ratedTalentId = generateUuidV7();
      await prisma.user.create({
        data: {
          id: ratedTalentId,
          supabaseAuthId: `sub_rated_${generateUuidV7().replace(/-/g, '')}`,
          email: `rated_${generateUuidV7().replace(/-/g, '')}@test.com`,
          firstName: 'Known',
          lastName: 'Scores',
          status: 'ACTIVE',
        },
      });

      // Insert 3 reviews: [5, 4, 3] -> sum = 12, avg = 4.0
      // Bayesian score: (5 * 4.0 + 12) / (5 + 3) = 32 / 8 = 4.0
      const ratings = [
        { rating: 5, comm: 5, qual: 5, adh: 5 },
        { rating: 4, comm: 4, qual: 4, adh: 4 },
        { rating: 3, comm: 3, qual: 3, adh: 3 },
      ];

      for (const r of ratings) {
        const p = await createIndependentProject({
          clientId: clientUserId,
          talentId: ratedTalentId,
          amount: 50000,
          status: 'COMPLETED',
        });
        await prisma.review.create({
          data: {
            id: generateUuidV7(),
            projectId: p.id,
            reviewerId: clientUserId,
            revieweeId: ratedTalentId,
            rating: r.rating,
            communicationRating: r.comm,
            qualityRating: r.qual,
            adherenceRating: r.adh,
            feedback: `Known rating review feedback with score ${r.rating}`,
            status: 'PUBLISHED',
          },
        });
      }

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${ratedTalentId}/reputation`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.totalReviews).toBe(3);
      expect(body.averageRating).toBe(4);
      expect(body.bayesianScore).toBe(4);
      expect(body.ratingDistribution['5']).toBe(1);
      expect(body.ratingDistribution['4']).toBe(1);
      expect(body.ratingDistribution['3']).toBe(1);
      expect(body.ratingDistribution['1']).toBe(0);
      expect(body.categoryAverages.communication).toBe(4);
      expect(body.categoryAverages.quality).toBe(4);
      expect(body.categoryAverages.adherence).toBe(4);
    });

    it('paginates public reviews for a user with cursor support', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${talentUserId}/reviews?limit=10`,
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.items.length).toBeGreaterThan(0);
      for (const item of body.items) {
        expect(item.status).toBe('PUBLISHED');
      }
    });

    it('lists reviews for a specific project', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${completedProjectId}/reviews`,
        headers: { authorization: `Bearer ${clientToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(2); // Client review + Talent reciprocal review
    });

    it('retrieves current user eligible completed projects awaiting review (GET /api/v1/reviews/pending)', async () => {
      // Create a fresh completed project where neither user has reviewed yet
      const pendingProj = await createIndependentProject({
        clientId: clientUserId,
        talentId: talentUserId,
        amount: 35000,
        title: 'Project Awaiting Verified Review',
        status: 'COMPLETED',
      });

      // Client queries pending reviews
      const clientPendingRes = await app.inject({
        method: 'GET',
        url: '/api/v1/reviews/pending',
        headers: { authorization: `Bearer ${clientToken}` },
      });
      expect(clientPendingRes.statusCode).toBe(200);
      const clientPending = clientPendingRes.json();
      expect(Array.isArray(clientPending)).toBe(true);
      const foundClient = clientPending.find((p: any) => p.projectId === pendingProj.id);
      expect(foundClient).toBeDefined();
      expect(foundClient.projectTitle).toBe('Project Awaiting Verified Review');
      expect(foundClient.counterparty.id).toBe(talentUserId);
      expect(foundClient.counterparty.role).toBe('CREATOR');

      // Talent queries pending reviews
      const talentPendingRes = await app.inject({
        method: 'GET',
        url: '/api/v1/reviews/pending',
        headers: { authorization: `Bearer ${talentToken}` },
      });
      expect(talentPendingRes.statusCode).toBe(200);
      const talentPending = talentPendingRes.json();
      const foundTalent = talentPending.find((p: any) => p.projectId === pendingProj.id);
      expect(foundTalent).toBeDefined();
      expect(foundTalent.counterparty.id).toBe(clientUserId);
      expect(foundTalent.counterparty.role).toBe('CLIENT');

      // Submit review as client
      const reviewRes = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${pendingProj.id}/reviews`,
        headers: { authorization: `Bearer ${clientToken}` },
        payload: {
          rating: 5,
          feedback: 'Excellent collaboration on this milestone project!',
        },
      });
      expect(reviewRes.statusCode).toBe(201);

      // Client should no longer have this project in pending reviews
      const updatedClientPending = await app.inject({
        method: 'GET',
        url: '/api/v1/reviews/pending',
        headers: { authorization: `Bearer ${clientToken}` },
      });
      expect(updatedClientPending.json().some((p: any) => p.projectId === pendingProj.id)).toBe(
        false,
      );

      // Talent should still have it until talent reviews
      const updatedTalentPending = await app.inject({
        method: 'GET',
        url: '/api/v1/reviews/pending',
        headers: { authorization: `Bearer ${talentToken}` },
      });
      expect(updatedTalentPending.json().some((p: any) => p.projectId === pendingProj.id)).toBe(
        true,
      );
    });

    it('enforces database uniqueness during concurrent review submissions', async () => {
      // Create a new completed project
      const raceProj = await createIndependentProject({
        clientId: clientUserId,
        talentId: talentUserId,
        amount: 40000,
        title: 'Concurrency Review Test Project',
        status: 'COMPLETED',
      });

      // Concurrently submit two reviews for the same project from the same client
      const [res1, res2] = await Promise.all([
        app.inject({
          method: 'POST',
          url: `/api/v1/projects/${raceProj.id}/reviews`,
          headers: { authorization: `Bearer ${clientToken}` },
          payload: {
            rating: 5,
            feedback: 'Concurrent submission attempt alpha feedback.',
          },
        }),
        app.inject({
          method: 'POST',
          url: `/api/v1/projects/${raceProj.id}/reviews`,
          headers: { authorization: `Bearer ${clientToken}` },
          payload: {
            rating: 4,
            feedback: 'Concurrent submission attempt beta feedback.',
          },
        }),
      ]);

      const statuses = [res1.statusCode, res2.statusCode].sort();
      expect(statuses).toEqual([201, 409]); // Exactly one 201 created, one 409 conflict
    });

    it('correctly updates aggregates after review moderation removal and reinstatement', async () => {
      const targetUserId = generateUuidV7();
      await prisma.user.create({
        data: {
          id: targetUserId,
          supabaseAuthId: `reconcile-${targetUserId}`,
          email: `reconcile-${targetUserId}@example.com`,
          firstName: 'Aggregate',
          lastName: 'Reconcile',
          status: 'ACTIVE',
        },
      });

      // Create two projects and two 5-star reviews
      const projA = await createIndependentProject({
        clientId: clientUserId,
        talentId: targetUserId,
        amount: 25000,
        title: 'Project A',
        status: 'COMPLETED',
      });

      const projB = await createIndependentProject({
        clientId: clientUserId,
        talentId: targetUserId,
        amount: 25000,
        title: 'Project B',
        status: 'COMPLETED',
      });

      const revA = await prisma.review.create({
        data: {
          id: generateUuidV7(),
          projectId: projA.id,
          reviewerId: clientUserId,
          revieweeId: targetUserId,
          rating: 5,
          feedback: 'Five star work on project A',
          status: 'PUBLISHED',
        },
      });

      const revB = await prisma.review.create({
        data: {
          id: generateUuidV7(),
          projectId: projB.id,
          reviewerId: clientUserId,
          revieweeId: targetUserId,
          rating: 3,
          feedback: 'Three star work on project B',
          status: 'PUBLISHED',
        },
      });

      // Initial state: 2 reviews, average = (5+3)/2 = 4.0
      let repRes = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${targetUserId}/reputation`,
      });
      expect(repRes.statusCode).toBe(200);
      expect(repRes.json().totalReviews).toBe(2);
      expect(repRes.json().averageRating).toBe(4);

      // Moderate revB to REMOVED
      const modRes = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${revB.id}/moderate`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          action: 'REMOVE',
          reason: 'Removed for policy violation test.',
        },
      });
      expect(modRes.statusCode).toBe(200);

      // Now only revA is eligible: 1 review, average = 5.0
      repRes = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${targetUserId}/reputation`,
      });
      expect(repRes.statusCode).toBe(200);
      expect(repRes.json().totalReviews).toBe(1);
      expect(repRes.json().averageRating).toBe(5);

      // Reinstate revB via RESTORE
      const restoreRes = await app.inject({
        method: 'POST',
        url: `/api/v1/reviews/${revB.id}/moderate`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          action: 'RESTORE',
          reason: 'Restored after appeal audit.',
        },
      });
      expect(restoreRes.statusCode).toBe(200);

      // Reinstated: exactly 2 reviews, average = (5+3)/2 = 4.0
      repRes = await app.inject({
        method: 'GET',
        url: `/api/v1/users/${targetUserId}/reputation`,
      });
      expect(repRes.statusCode).toBe(200);
      expect(repRes.json().totalReviews).toBe(2);
      expect(repRes.json().averageRating).toBe(4);
    });
  });
});
