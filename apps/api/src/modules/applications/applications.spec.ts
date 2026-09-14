import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../test-utils/auth-test-helper.js';

describe('Applications Domain Integration Tests', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let brandUserId: string;
  let brandToken: string;
  let brandProfileId: string;

  let creatorUserId: string;
  let creatorToken: string;

  let activeAssignmentId: string;
  let expiredAssignmentId: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    brandProfileId = generateUuidV7();
    brandUserId = generateUuidV7();
    brandToken = await createTestJwt({
      sub: `sub_b_${generateUuidV7().replace(/-/g, '')}`,
      email: `b_${generateUuidV7().replace(/-/g, '')}@test.com`,
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
            companyName: 'Venture Studio',
          },
        },
      },
    });

    creatorUserId = generateUuidV7();
    creatorToken = await createTestJwt({
      sub: `sub_c_${generateUuidV7().replace(/-/g, '')}`,
      email: `c_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedCreator: any = await defaultJwtVerifier.verifyToken(creatorToken);
    await prisma.user.create({
      data: {
        id: creatorUserId,
        supabaseAuthId: decodedCreator.sub,
        email: decodedCreator.email,
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

    // Active assignment
    activeAssignmentId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: activeAssignmentId,
        brandId: brandProfileId,
        title: 'Active Brand Assignment',
        description: 'Open for submissions',
        budgetMin: 10000,
        budgetMax: 20000,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        status: 'PUBLISHED',
      },
    });

    // Expired assignment
    expiredAssignmentId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: expiredAssignmentId,
        brandId: brandProfileId,
        title: 'Expired Brand Assignment',
        description: 'Past deadline',
        budgetMin: 10000,
        budgetMax: 20000,
        deadline: new Date(Date.now() - 10000), // In past
        status: 'PUBLISHED',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('submits a proposal under real SELECT FOR UPDATE row lock', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/assignments/${activeAssignmentId}/apply`,
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: {
        coverLetter: 'I have 5 years experience creating high-impact YouTube video series.',
        proposedRate: 15000,
        currency: 'INR',
        durationDays: 14,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('SUBMITTED');
    expect(body.proposedRate).toBe(15000);
    expect(body.history.length).toBe(1);
    expect(body.history[0].reason).toBe('INITIAL_PROPOSAL');
  });

  it('rejects duplicate proposal from same applicant with 409 Conflict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/assignments/${activeAssignmentId}/apply`,
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: {
        coverLetter: 'Second duplicate proposal attempt',
        proposedRate: 18000,
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('CONFLICT');
  });

  it('rejects proposal submission when deadline has expired', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/assignments/${expiredAssignmentId}/apply`,
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: {
        coverLetter: 'Applying after deadline',
        proposedRate: 10000,
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('ASSIGNMENT_DEADLINE_EXPIRED');
  });

  it('prohibits brand owner from applying to their own assignment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/assignments/${activeAssignmentId}/apply`,
      headers: { authorization: `Bearer ${brandToken}` },
      payload: {
        coverLetter: 'Brand trying to apply to own brief',
        proposedRate: 10000,
      },
    });

    // Brand lacks CREATOR or PRO role so returns 403 AUTH_INSUFFICIENT_ROLE
    expect(res.statusCode).toBe(403);
  });

  it('allows brand owner to transition application status to SHORTLISTED', async () => {
    const appsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/assignments/${activeAssignmentId}/applications`,
      headers: { authorization: `Bearer ${brandToken}` },
    });
    const apps = appsRes.json();
    const appRecord = apps[0];

    const transitionRes = await app.inject({
      method: 'POST',
      url: `/api/v1/applications/${appRecord.id}/status`,
      headers: { authorization: `Bearer ${brandToken}` },
      payload: {
        status: 'SHORTLISTED',
        reason: 'Strong creative portfolio match',
      },
    });

    expect(transitionRes.statusCode).toBe(200);
    const body = transitionRes.json();
    expect(body.status).toBe('SHORTLISTED');
    expect(body.history[0].toStatus).toBe('SHORTLISTED');
    expect(body.history[0].reason).toBe('Strong creative portfolio match');
  });
});
