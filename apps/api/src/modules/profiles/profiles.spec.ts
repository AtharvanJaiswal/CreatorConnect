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

  let podcasterUserId: string;
  let podcasterToken: string;

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

    podcasterUserId = generateUuidV7();
    podcasterToken = await createTestJwt({
      sub: `sub_pod_${Date.now()}_${generateUuidV7()}`,
      email: `pod_${Date.now()}_${generateUuidV7()}@test.com`,
    });
    const decodedPod: any = await defaultJwtVerifier.verifyToken(podcasterToken);
    await prisma.user.create({
      data: {
        id: podcasterUserId,
        supabaseAuthId: decodedPod.sub,
        email: decodedPod.email,
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: 'PODCASTER' },
                create: { id: generateUuidV7(), name: 'PODCASTER' },
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

  describe('PATCH-like Profile Update Semantics (Phase C)', () => {
    it('preserves omitted fields when performing partial updates on CREATOR profile', async () => {
      // 1. Initial full creation
      const initialRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/creator',
        headers: { authorization: `Bearer ${creatorToken}` },
        payload: {
          tagline: 'Initial Creator Tagline',
          bio: 'Initial Bio Content',
          locationCity: 'Bengaluru',
          locationCountry: 'IN',
          startingRate: 50000,
          visibility: 'PUBLIC',
        },
      });
      expect(initialRes.statusCode).toBe(200);
      const initial = initialRes.json();
      expect(initial.tagline).toBe('Initial Creator Tagline');
      expect(initial.bio).toBe('Initial Bio Content');
      expect(initial.locationCity).toBe('Bengaluru');

      // 2. Partial update: ONLY provide new tagline
      const patchRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/creator',
        headers: { authorization: `Bearer ${creatorToken}` },
        payload: {
          tagline: 'Updated Creator Tagline Only',
        },
      });
      expect(patchRes.statusCode).toBe(200);
      const patched = patchRes.json();

      // Tagline was updated
      expect(patched.tagline).toBe('Updated Creator Tagline Only');
      // Omitted fields were NOT cleared or overwritten
      expect(patched.bio).toBe('Initial Bio Content');
      expect(patched.locationCity).toBe('Bengaluru');
      expect(patched.locationCountry).toBe('IN');
      expect(patched.startingRate).toBe(50000);
      expect(patched.visibility).toBe('PUBLIC');
    });

    it('preserves omitted fields when performing partial updates on PROFESSIONAL profile', async () => {
      // 1. Initial setup
      const initialRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/professional',
        headers: { authorization: `Bearer ${proToken}` },
        payload: {
          headline: 'Senior Sound Designer & Mixer',
          bio: 'Decade of post-production audio engineering.',
          dayRate: 75000,
          yearsExperience: 10,
          locationCity: 'Mumbai',
          locationCountry: 'IN',
          equipmentList: ['ProTools HD', 'Genelec 8040'],
          visibility: 'PUBLIC',
        },
      });
      expect(initialRes.statusCode).toBe(200);
      const initial = initialRes.json();
      expect(initial.headline).toBe('Senior Sound Designer & Mixer');
      expect(initial.dayRate).toBe(75000);

      // 2. Partial update: only headline and dayRate
      const patchRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/professional',
        headers: { authorization: `Bearer ${proToken}` },
        payload: {
          headline: 'Lead Audio Director',
        },
      });
      expect(patchRes.statusCode).toBe(200);
      const patched = patchRes.json();

      expect(patched.headline).toBe('Lead Audio Director');
      // Omitted fields remain intact
      expect(patched.bio).toBe('Decade of post-production audio engineering.');
      expect(patched.dayRate).toBe(75000);
      expect(patched.yearsExperience).toBe(10);
      expect(patched.locationCity).toBe('Mumbai');
      expect(patched.equipmentList).toEqual(['ProTools HD', 'Genelec 8040']);
    });

    it('preserves omitted fields when performing partial updates on BRAND profile', async () => {
      // 1. Initial setup
      const initialRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/brand',
        headers: { authorization: `Bearer ${brandToken}` },
        payload: {
          companyName: 'Acme Media Labs',
          industry: 'Film Production',
          bio: 'Independent storytelling and documentary production.',
          websiteUrl: 'https://acmemedia.example.com',
          companySize: '11-50',
          visibility: 'PUBLIC',
        },
      });
      expect(initialRes.statusCode).toBe(200);
      const initial = initialRes.json();
      expect(initial.companyName).toBe('Acme Media Labs');
      expect(initial.industry).toBe('Film Production');

      // 2. Partial update: only update industry
      const patchRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/brand',
        headers: { authorization: `Bearer ${brandToken}` },
        payload: {
          companyName: 'Acme Media Labs',
          industry: 'Commercial & Advertising',
        },
      });
      expect(patchRes.statusCode).toBe(200);
      const patched = patchRes.json();

      expect(patched.industry).toBe('Commercial & Advertising');
      expect(patched.companyName).toBe('Acme Media Labs');
      // Omitted fields remain intact
      expect(patched.bio).toBe('Independent storytelling and documentary production.');
      expect(patched.websiteUrl).toBe('https://acmemedia.example.com');
      expect(patched.companySize).toBe('11-50');
    });

    it('preserves omitted fields when performing partial updates on PODCASTER profile', async () => {
      // 1. Initial setup
      const initialRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/podcaster',
        headers: { authorization: `Bearer ${podcasterToken}` },
        payload: {
          podcastName: 'The Creative Frontier',
          description: 'Weekly deep dives with top creators.',
          rssFeedUrl: 'https://feeds.example.com/creative-frontier',
          guestGuidelines: 'Seeking tech and media visionaries.',
          visibility: 'PUBLIC',
        },
      });
      expect(initialRes.statusCode).toBe(200);
      const initial = initialRes.json();
      expect(initial.podcastName).toBe('The Creative Frontier');
      expect(initial.rssFeedUrl).toBe('https://feeds.example.com/creative-frontier');

      // 2. Partial update: only description
      const patchRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/profiles/podcaster',
        headers: { authorization: `Bearer ${podcasterToken}` },
        payload: {
          podcastName: 'The Creative Frontier',
          description: 'Updated weekly deep dive descriptions.',
        },
      });
      expect(patchRes.statusCode).toBe(200);
      const patched = patchRes.json();

      expect(patched.description).toBe('Updated weekly deep dive descriptions.');
      // Omitted fields remain intact
      expect(patched.rssFeedUrl).toBe('https://feeds.example.com/creative-frontier');
      expect(patched.guestGuidelines).toBe('Seeking tech and media visionaries.');
    });
  });
});
