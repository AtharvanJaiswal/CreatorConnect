import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../test-utils/auth-test-helper.js';

describe('Atomic Hiring Acceptance & Concurrency-Safe Rejection Tests', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let brandUserId: string;
  let brandToken: string;
  let brandProfileId: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    brandProfileId = generateUuidV7();
    brandUserId = generateUuidV7();
    brandToken = await createTestJwt({
      sub: `sub_hb_${generateUuidV7().replace(/-/g, '')}`,
      email: `hb_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedBrand: any = await defaultJwtVerifier.verifyToken(brandToken);
    await prisma.user.create({
      data: {
        id: brandUserId,
        supabaseAuthId: decodedBrand.sub,
        email: decodedBrand.email,
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
            id: brandProfileId,
            companyName: 'Apex Brands Inc',
          },
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  async function createCandidate(prefix: string) {
    const userId = generateUuidV7();
    const token = await createTestJwt({
      sub: `sub_${prefix}_${generateUuidV7().replace(/-/g, '')}`.slice(0, 50),
      email: `${prefix}_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decoded: any = await defaultJwtVerifier.verifyToken(token);
    await prisma.user.create({
      data: {
        id: userId,
        supabaseAuthId: decoded.sub,
        email: decoded.email,
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
    return { userId, token };
  }

  it('proves concurrent acceptance produces exactly ONE accepted winner and rolls back racing caller with 409', async () => {
    const candidateA = await createCandidate('candA');
    const candidateB = await createCandidate('candB');

    // Create an assignment
    const assignmentId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: brandProfileId,
        title: 'Race Condition Acceptance Brief',
        description: 'Testing two concurrent acceptances',
        budgetMin: 50000,
        budgetMax: 100000,
        deadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
        version: 1,
      },
    });

    // Create Candidate A proposal (SHORTLISTED)
    const appAId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: appAId,
        assignmentId,
        applicantId: candidateA.userId,
        coverLetter: 'Proposal A',
        proposedRate: 60000,
        status: 'SHORTLISTED',
        version: 1,
      },
    });

    // Create Candidate B proposal (SHORTLISTED)
    const appBId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: appBId,
        assignmentId,
        applicantId: candidateB.userId,
        coverLetter: 'Proposal B',
        proposedRate: 65000,
        status: 'SHORTLISTED',
        version: 1,
      },
    });

    // Launch two simultaneous acceptance requests for Candidate A and Candidate B
    const [resA, resB] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/assignments/${assignmentId}/accept`,
        headers: { authorization: `Bearer ${brandToken}` },
        payload: {
          applicationId: appAId,
          expectedVersion: 1,
          expectedApplicationVersion: 1,
        },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/assignments/${assignmentId}/accept`,
        headers: { authorization: `Bearer ${brandToken}` },
        payload: {
          applicationId: appBId,
          expectedVersion: 1,
          expectedApplicationVersion: 1,
        },
      }),
    ]);

    const statusCodes = [resA.statusCode, resB.statusCode].sort();
    expect(statusCodes).toEqual([200, 409]);

    // Verify DB invariant: Exactly one application is ACCEPTED
    const acceptedApps = await prisma.application.findMany({
      where: { assignmentId, status: 'ACCEPTED' },
    });
    expect(acceptedApps.length).toBe(1);

    // Verify DB invariant: Assignment status is IN_PROGRESS and version is 2
    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    expect(assignment?.status).toBe('IN_PROGRESS');
    expect(assignment?.version).toBe(2);
  });

  it('concurrency-safe competitor rejection: applicant withdraws concurrently and is NEVER overwritten', async () => {
    const candidateA = await createCandidate('winnerA');
    const candidateB = await createCandidate('withdrawingB');
    const candidateC = await createCandidate('compC');

    const assignmentId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: brandProfileId,
        title: 'Concurrent Withdrawal Acceptance Test',
        description: 'Testing non-overwriting competitor rejection',
        budgetMin: 30000,
        budgetMax: 50000,
        deadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
        version: 1,
      },
    });

    const appAId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: appAId,
        assignmentId,
        applicantId: candidateA.userId,
        coverLetter: 'Proposal A (to be accepted)',
        proposedRate: 35000,
        status: 'SHORTLISTED',
        version: 1,
      },
    });

    const appBId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: appBId,
        assignmentId,
        applicantId: candidateB.userId,
        coverLetter: 'Proposal B (withdrawing concurrently)',
        proposedRate: 40000,
        status: 'SHORTLISTED',
        version: 1,
      },
    });

    const appCId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: appCId,
        assignmentId,
        applicantId: candidateC.userId,
        coverLetter: 'Proposal C (to be rejected)',
        proposedRate: 45000,
        status: 'SHORTLISTED',
        version: 1,
      },
    });

    // Candidate B withdraws their application
    const withdrawRes = await app.inject({
      method: 'POST',
      url: `/api/v1/applications/${appBId}/withdraw`,
      headers: { authorization: `Bearer ${candidateB.token}` },
    });
    expect(withdrawRes.statusCode).toBe(200);

    // Brand accepts candidate A
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/v1/assignments/${assignmentId}/accept`,
      headers: { authorization: `Bearer ${brandToken}` },
      payload: {
        applicationId: appAId,
        expectedVersion: 1,
        expectedApplicationVersion: 1,
      },
    });

    expect(acceptRes.statusCode).toBe(200);

    // Verify candidate A is ACCEPTED
    const appA = await prisma.application.findUnique({ where: { id: appAId } });
    expect(appA?.status).toBe('ACCEPTED');

    // Verify candidate B is WITHDRAWN (never overwritten by POSITION_FILLED rejection!)
    const appB = await prisma.application.findUnique({
      where: { id: appBId },
      include: { history: true },
    });
    expect(appB?.status).toBe('WITHDRAWN');
    // Ensure no REJECTED status history was created for Candidate B
    const bHasRejected = appB?.history.some((h) => h.toStatus === 'REJECTED');
    expect(bHasRejected).toBe(false);

    // Verify candidate C became REJECTED with reason POSITION_FILLED
    const appC = await prisma.application.findUnique({
      where: { id: appCId },
      include: { history: true },
    });
    expect(appC?.status).toBe('REJECTED');
    const cHasRejected = appC?.history.some((h) => h.reason === 'POSITION_FILLED');
    expect(cHasRejected).toBe(true);
  });

  it('rejects updateStatus with 400 when parent assignment has progressed to IN_PROGRESS', async () => {
    const candidate = await createCandidate('cand_lifecycle');

    const assignmentId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: brandProfileId,
        title: 'Post-Hiring Status Transition Attempt',
        description: 'Testing assignment lifecycle guard',
        budgetMin: 20000,
        budgetMax: 40000,
        deadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
        version: 1,
      },
    });

    const applicationId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: applicationId,
        assignmentId,
        applicantId: candidate.userId,
        coverLetter: 'Proposal to be updated after hiring closed',
        proposedRate: 25000,
        status: 'SUBMITTED',
        version: 1,
      },
    });

    // Advance assignment to IN_PROGRESS (e.g. after candidate hiring completed)
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: 'IN_PROGRESS', version: 2 },
    });

    // Attempt to transition application to SHORTLISTED on the IN_PROGRESS assignment
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/applications/${applicationId}/status`,
      headers: { authorization: `Bearer ${brandToken}` },
      payload: {
        status: 'SHORTLISTED',
        reason: 'Late shortlist attempt',
      },
    });

    // Must be rejected with HTTP 400
    expect(res.statusCode).toBe(400);

    // Verify application remains unchanged in SUBMITTED state and version 1
    const appRecord = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { history: true },
    });
    expect(appRecord?.status).toBe('SUBMITTED');
    expect(appRecord?.version).toBe(1);
    expect(appRecord?.history.some((h) => h.toStatus === 'SHORTLISTED')).toBe(false);
  });

  it('rejects stale updateStatus with 409 when applicant concurrently withdrew', async () => {
    const candidate = await createCandidate('cand_withdraw_race');

    const assignmentId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: brandProfileId,
        title: 'Concurrent Withdrawal vs Shortlist Brief',
        description: 'Testing optimistic locking on status update',
        budgetMin: 20000,
        budgetMax: 40000,
        deadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
        version: 1,
      },
    });

    const applicationId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: applicationId,
        assignmentId,
        applicantId: candidate.userId,
        coverLetter: 'Proposal withdrawn concurrently',
        proposedRate: 30000,
        status: 'SUBMITTED',
        version: 1,
      },
    });

    // 1. Obtain current state: SUBMITTED, version 1
    const observedApp = await prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
      include: {
        assignment: {
          include: { brand: true },
        },
      },
    });
    expect(observedApp.status).toBe('SUBMITTED');
    expect(observedApp.version).toBe(1);

    // 2. Candidate withdrawal changes: SUBMITTED -> WITHDRAWN, version 1 -> version 2
    const withdrawRes = await app.inject({
      method: 'POST',
      url: `/api/v1/applications/${applicationId}/withdraw`,
      headers: { authorization: `Bearer ${candidate.token}` },
    });
    expect(withdrawRes.statusCode).toBe(200);

    const withdrawnApp = await prisma.application.findUniqueOrThrow({
      where: { id: applicationId },
    });
    expect(withdrawnApp.status).toBe('WITHDRAWN');
    expect(withdrawnApp.version).toBe(2);

    // 3. Stale brand update attempts: SUBMITTED -> SHORTLISTED using observed version 1
    // Import applicationsRepository and spy findById to return the observed version 1 snapshot
    const { applicationsRepository } = await import('./applications.repository.js');
    const findByIdSpy = vi
      .spyOn(applicationsRepository, 'findById')
      .mockResolvedValueOnce(observedApp as any);

    const updateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/applications/${applicationId}/status`,
      headers: { authorization: `Bearer ${brandToken}` },
      payload: {
        status: 'SHORTLISTED',
        reason: 'Attempting to shortlist using stale observed version 1',
      },
    });

    findByIdSpy.mockRestore();

    // Assert HTTP/domain result is 409
    expect(updateRes.statusCode).toBe(409);
    expect(updateRes.json().code).toBe('OPTIMISTIC_LOCK_CONFLICT');

    // Assert final application status is WITHDRAWN, version remains 2, and no SHORTLISTED history is created
    const finalApp = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { history: true },
    });
    expect(finalApp?.status).toBe('WITHDRAWN');
    expect(finalApp?.version).toBe(2);
    expect(finalApp?.history.some((h) => h.toStatus === 'SHORTLISTED')).toBe(false);
  });
});
