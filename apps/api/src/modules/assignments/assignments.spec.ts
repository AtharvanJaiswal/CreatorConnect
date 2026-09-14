import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../test-utils/auth-test-helper.js';

describe('Assignments Domain Integration Tests', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let brandUserId: string;
  let brandToken: string;
  let creatorUserId: string;
  let creatorToken: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

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
            id: generateUuidV7(),
            companyName: 'Acme Corporation',
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows BRAND user to create an assignment with deliverables', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assignments',
      headers: { authorization: `Bearer ${brandToken}` },
      payload: {
        title: 'Tech Review Video Series',
        description: 'Need a 4K video review of our new flagship device.',
        budgetType: 'FIXED',
        budgetMin: 50000,
        budgetMax: 75000,
        deadline: futureDate,
        requirements: [
          { title: '4K 60FPS deliverable', isMandatory: true },
          { title: 'Color graded master file', isMandatory: false },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe('Tech Review Video Series');
    expect(body.status).toBe('PUBLISHED');
    expect(body.version).toBe(1);
    expect(body.requirements.length).toBe(2);
  });

  it('prohibits CREATOR from creating an assignment (BRAND role required)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/assignments',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: {
        title: 'Unauthorized Assignment',
        description: 'Should fail',
        budgetMin: 1000,
        budgetMax: 2000,
        deadline: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe('AUTH_INSUFFICIENT_ROLE');
  });

  it('enforces optimistic concurrency control: returning 409 on version mismatch', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/assignments',
      headers: { authorization: `Bearer ${brandToken}` },
      payload: {
        title: 'Concurrency Test Assignment',
        description: 'Testing optimistic locking',
        budgetMin: 10000,
        budgetMax: 20000,
        deadline: futureDate,
      },
    });
    const assignment = createRes.json();

    // First update with matching version 1 succeeds and bumps version to 2
    const update1 = await app.inject({
      method: 'PUT',
      url: `/api/v1/assignments/${assignment.id}`,
      headers: { authorization: `Bearer ${brandToken}` },
      payload: {
        version: 1,
        title: 'Updated Title v2',
      },
    });
    expect(update1.statusCode).toBe(200);
    expect(update1.json().version).toBe(2);

    // Stale update still sending version 1 rejected with 409 Conflict
    const update2 = await app.inject({
      method: 'PUT',
      url: `/api/v1/assignments/${assignment.id}`,
      headers: { authorization: `Bearer ${brandToken}` },
      payload: {
        version: 1,
        title: 'Stale Update',
      },
    });
    expect(update2.statusCode).toBe(409);
    expect(update2.json().code).toBe('OPTIMISTIC_LOCK_CONFLICT');
  });

  it('verifies PostgreSQL database CHECK constraint rejects negative budget', async () => {
    const brandProfile = await prisma.brandProfile.findUnique({ where: { userId: brandUserId } });

    await expect(
      prisma.assignment.create({
        data: {
          id: generateUuidV7(),
          brandId: brandProfile!.id,
          title: 'Direct DB Invalid Budget',
          description: 'Constraint test',
          budgetMin: -500, // Violates chk_assignments_budget_nonneg
          budgetMax: 1000,
          deadline: new Date(Date.now() + 86400000),
        },
      }),
    ).rejects.toThrow();
  });
});
