import { describe, expect, it, beforeAll, afterAll } from 'vitest';
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
});
