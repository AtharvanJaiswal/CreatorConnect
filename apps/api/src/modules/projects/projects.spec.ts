import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';

describe('Phase 6: Projects & Deliverable Escrow Integration Tests', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let clientUserId: string;
  let clientToken: string;
  let clientBrandProfileId: string;

  let talentUserId: string;
  let talentToken: string;

  let thirdPartyUserId: string;
  let thirdPartyToken: string;

  let assignmentId: string;
  let assignment2Id: string;
  let applicationAcceptedId: string;
  let applicationSubmittedId: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    // 1. Client user with Brand profile
    clientUserId = generateUuidV7();
    clientBrandProfileId = generateUuidV7();
    clientToken = await createTestJwt({
      sub: `sub_client_${generateUuidV7().replace(/-/g, '')}`,
      email: `client_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedClient: any = await defaultJwtVerifier.verifyToken(clientToken);
    await prisma.user.create({
      data: {
        id: clientUserId,
        supabaseAuthId: decodedClient.sub,
        email: decodedClient.email,
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: 'BRAND' },
                create: { id: generateUuidV7(), name: 'BRAND' },
              },
            },
          },
        },
        brandProfile: {
          create: {
            id: clientBrandProfileId,
            companyName: 'Acme Media Labs',
          },
        },
      },
    });

    // 2. Talent user
    talentUserId = generateUuidV7();
    talentToken = await createTestJwt({
      sub: `sub_talent_${generateUuidV7().replace(/-/g, '')}`,
      email: `talent_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedTalent: any = await defaultJwtVerifier.verifyToken(talentToken);
    await prisma.user.create({
      data: {
        id: talentUserId,
        supabaseAuthId: decodedTalent.sub,
        email: decodedTalent.email,
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

    // 3. Third-party bystander user
    thirdPartyUserId = generateUuidV7();
    thirdPartyToken = await createTestJwt({
      sub: `sub_third_${generateUuidV7().replace(/-/g, '')}`,
      email: `third_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedThird: any = await defaultJwtVerifier.verifyToken(thirdPartyToken);
    await prisma.user.create({
      data: {
        id: thirdPartyUserId,
        supabaseAuthId: decodedThird.sub,
        email: decodedThird.email,
        status: 'ACTIVE',
      },
    });

    // 4. Assignment
    assignmentId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: clientBrandProfileId,
        title: 'Video Campaign 2026',
        description: 'Brand commercial production',
        budgetMin: 50000,
        budgetMax: 100000,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'IN_PROGRESS',
      },
    });

    // 5. Accepted Application
    applicationAcceptedId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: applicationAcceptedId,
        assignmentId,
        applicantId: talentUserId,
        coverLetter: 'Accepted high-tier creator pitch',
        proposedRate: 75000,
        status: 'ACCEPTED',
        version: 2,
      },
    });

    // 6. Another Assignment with Submitted Application (not accepted)
    assignment2Id = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: assignment2Id,
        brandId: clientBrandProfileId,
        title: 'Secondary Campaign',
        description: 'Second campaign',
        budgetMin: 30000,
        budgetMax: 50000,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'PUBLISHED',
      },
    });

    applicationSubmittedId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: applicationSubmittedId,
        assignmentId: assignment2Id,
        applicantId: talentUserId,
        coverLetter: 'Still submitted proposal',
        proposedRate: 70000,
        status: 'SUBMITTED',
        version: 1,
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  let createdProjectId: string;
  let deliverable1Id: string;
  let deliverable2Id: string;

  it('rejects project initialization when application is not accepted', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        assignmentId: assignment2Id,
        applicationId: applicationSubmittedId,
        title: 'Premature Project',
        totalAmount: 70000,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects project initialization from non-owner user', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        assignmentId,
        applicationId: applicationAcceptedId,
        title: 'Unauthorized Creation',
        totalAmount: 75000,
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('successfully initializes project contract with milestones and creates outbox event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        assignmentId,
        applicationId: applicationAcceptedId,
        title: 'Video Campaign 2026 - Production Contract',
        description: 'Complete 2-part video commercial delivery',
        totalAmount: 75000,
        currency: 'INR',
        deliverables: [
          {
            title: 'Milestone 1: Rough Cut Draft',
            description: 'First version edit with draft audio',
            amount: 35000,
          },
          {
            title: 'Milestone 2: Final 4K Master',
            description: 'Color graded final master cut',
            amount: 40000,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.status).toBe('IN_PROGRESS');
    expect(body.clientId).toBe(clientUserId);
    expect(body.talentId).toBe(talentUserId);
    expect(body.totalAmount).toBe(75000);
    expect(body.deliverables).toHaveLength(2);
    expect(body.deliverables[0].status).toBe('PENDING');
    expect(body.deliverables[1].status).toBe('PENDING');

    createdProjectId = body.id;
    deliverable1Id = body.deliverables[0].id;
    deliverable2Id = body.deliverables[1].id;

    // Verify Outbox Event created
    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: createdProjectId,
        eventType: 'project.created.v1',
      },
    });
    expect(outboxEvent).toBeDefined();
    expect(outboxEvent?.status).toBe('PENDING');
  });

  it('rejects duplicate project initialization for same accepted application', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        assignmentId,
        applicationId: applicationAcceptedId,
        title: 'Duplicate Project Contract',
        totalAmount: 75000,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('prevents third-party access to project details', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${createdProjectId}`,
      headers: { authorization: `Bearer ${thirdPartyToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('allows talent and client to view project and deliverables', async () => {
    const talentRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${createdProjectId}`,
      headers: { authorization: `Bearer ${talentToken}` },
    });
    expect(talentRes.statusCode).toBe(200);
    expect(talentRes.json().id).toBe(createdProjectId);

    const clientRes = await app.inject({
      method: 'GET',
      url: `/api/v1/projects/${createdProjectId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(clientRes.statusCode).toBe(200);
    expect(clientRes.json().id).toBe(createdProjectId);
  });

  it('lists user projects accurately', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${talentToken}` },
    });

    expect(listRes.statusCode).toBe(200);
    const list = listRes.json();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some((p: any) => p.id === createdProjectId)).toBe(true);
  });

  it('rejects deliverable submission from client (only talent can submit)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${createdProjectId}/deliverables/${deliverable1Id}/submit`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        submissionNotes: 'Client attempting submission',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('allows talent to submit deliverable milestone and updates outbox', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${createdProjectId}/deliverables/${deliverable1Id}/submit`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        submissionNotes: 'First rough cut draft link submitted for review.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('SUBMITTED');
    expect(body.submittedAt).not.toBeNull();
    expect(body.submissionNotes).toBe('First rough cut draft link submitted for review.');

    // Outbox event
    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: deliverable1Id,
        eventType: 'project.deliverable.submitted.v1',
      },
    });
    expect(outboxEvent).toBeDefined();
    expect(outboxEvent?.status).toBe('PENDING');
  });

  it('rejects deliverable review from talent (only client can review)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${createdProjectId}/deliverables/${deliverable1Id}/review`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        action: 'APPROVE',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('allows client to request revision on deliverable', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${createdProjectId}/deliverables/${deliverable1Id}/review`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        action: 'REQUEST_REVISION',
        notes: 'Audio levels are clipping at 01:23. Please normalize.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('REVISION_REQUESTED');
    expect(body.revisionNotes).toBe('Audio levels are clipping at 01:23. Please normalize.');

    // Outbox event
    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: deliverable1Id,
        eventType: 'project.deliverable.revision_requested.v1',
      },
    });
    expect(outboxEvent).toBeDefined();
  });

  it('allows talent to re-submit revised deliverable', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${createdProjectId}/deliverables/${deliverable1Id}/submit`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        submissionNotes: 'Audio normalized to -14 LUFS standard.',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('SUBMITTED');
  });

  it('allows client to approve deliverable and marks project COMPLETED when all milestones approved', async () => {
    // Approve Milestone 1
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${createdProjectId}/deliverables/${deliverable1Id}/review`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        action: 'APPROVE',
      },
    });
    expect(res1.statusCode).toBe(200);
    expect(res1.json().status).toBe('APPROVED');

    // Milestone 2 is still PENDING, so project is not completed yet
    const projectMid = await prisma.project.findUnique({
      where: { id: createdProjectId },
    });
    expect(projectMid?.status).not.toBe('COMPLETED');

    // Submit Milestone 2
    const resSub2 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${createdProjectId}/deliverables/${deliverable2Id}/submit`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        submissionNotes: 'Final color-graded mastercut submitted.',
      },
    });
    expect(resSub2.statusCode).toBe(200);

    // Approve Milestone 2
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${createdProjectId}/deliverables/${deliverable2Id}/review`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        action: 'APPROVE',
      },
    });
    expect(res2.statusCode).toBe(200);
    expect(res2.json().status).toBe('APPROVED');

    // Now all milestones are APPROVED, verify project is COMPLETED
    const projectFinal = await prisma.project.findUnique({
      where: { id: createdProjectId },
    });
    expect(projectFinal?.status).toBe('COMPLETED');
    expect(projectFinal?.completedAt).not.toBeNull();

    // Verify approval outbox event
    const outboxApproval = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: deliverable2Id,
        eventType: 'project.deliverable.approved.v1',
      },
    });
    expect(outboxApproval).toBeDefined();
    expect((outboxApproval?.payload as any).allApproved).toBe(true);
  });
});
