import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../test-utils/auth-test-helper.js';

describe('Profiles Domain Integration Tests', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let creatorUserId: string;
  let creatorToken: string;

  let brandUserId: string;
  let brandToken: string;

  let proUserId: string;
  let proToken: string;

  let activeCategoryId: string;
  let inactiveCategoryId: string;
  let activeSkillId: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    // Create taxonomy entries
    activeCategoryId = generateUuidV7();
    await prisma.category.create({
      data: {
        id: activeCategoryId,
        slug: `active-cat-${Date.now()}`,
        name: 'Active Category',
        isActive: true,
      },
    });

    inactiveCategoryId = generateUuidV7();
    await prisma.category.create({
      data: {
        id: inactiveCategoryId,
        slug: `inactive-cat-${Date.now()}`,
        name: 'Inactive Category',
        isActive: false,
      },
    });

    activeSkillId = generateUuidV7();
    await prisma.skill.create({
      data: {
        id: activeSkillId,
        slug: `skill-${Date.now()}`,
        name: 'TypeScript',
        isActive: true,
      },
    });

    // Create users
    creatorUserId = generateUuidV7();
    creatorToken = await createTestJwt({
      sub: `sub_creator_${Date.now()}_${generateUuidV7()}`,
      email: `creator_${Date.now()}_${generateUuidV7()}@test.com`,
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

    brandUserId = generateUuidV7();
    brandToken = await createTestJwt({
      sub: `sub_brand_${Date.now()}_${generateUuidV7()}`,
      email: `brand_${Date.now()}_${generateUuidV7()}@test.com`,
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
      },
    });

    proUserId = generateUuidV7();
    proToken = await createTestJwt({
      sub: `sub_pro_${Date.now()}_${generateUuidV7()}`,
      email: `pro_${Date.now()}_${generateUuidV7()}@test.com`,
    });
    const decodedPro: any = await defaultJwtVerifier.verifyToken(proToken);
    await prisma.user.create({
      data: {
        id: proUserId,
        supabaseAuthId: decodedPro.sub,
        email: decodedPro.email,
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: 'PROFESSIONAL' },
                create: { id: generateUuidV7(), name: 'PROFESSIONAL' },
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

  it('allows CREATOR to update creator profile with active categories', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/profiles/creator',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: {
        tagline: 'Leading Tech & Design Creator',
        bio: 'Creating videos on software and modern tech.',
        locationCountry: 'IN',
        locationCity: 'Bengaluru',
        startingRate: 50000,
        categoryIds: [activeCategoryId],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tagline).toBe('Leading Tech & Design Creator');
    expect(body.completionScore).toBeGreaterThanOrEqual(80);
    expect(body.categories[0].id).toBe(activeCategoryId);
  });

  it('rejects inactive taxonomy category when updating creator profile', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/profiles/creator',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: {
        tagline: 'Tech Creator',
        categoryIds: [inactiveCategoryId],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe('INACTIVE_TAXONOMY_ENTRY');
  });

  it('prohibits CREATOR from mutating BRAND profile (role protection)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/profiles/brand',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: {
        companyName: 'Creator Pretending to be Brand',
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.code).toBe('AUTH_INSUFFICIENT_ROLE');
  });

  it('enforces visibility isolation: PRIVATE profile returns 403 to non-owner', async () => {
    // Creator marks profile PRIVATE
    await app.inject({
      method: 'PUT',
      url: '/api/v1/profiles/creator',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: { visibility: 'PRIVATE' },
    });

    // Brand attempts to read creator profile directly
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/profiles/creator/${creatorUserId}`,
      headers: { authorization: `Bearer ${brandToken}` },
    });

    expect(res.statusCode).toBe(403);
  });

  it('allows user to configure skills with SkillProficiency enum', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/v1/profiles/skills',
      headers: { authorization: `Bearer ${creatorToken}` },
      payload: {
        skills: [{ skillId: activeSkillId, proficiency: 'EXPERT' }],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body[0].skillId).toBe(activeSkillId);
    expect(body[0].proficiency).toBe('EXPERT');
  });
});
