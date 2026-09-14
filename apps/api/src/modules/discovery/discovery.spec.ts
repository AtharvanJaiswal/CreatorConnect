import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';

describe('Discovery Domain Integration Tests (FTS & pg_trgm)', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let brandProfileId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    const brandUserId = generateUuidV7();
    brandProfileId = generateUuidV7();
    await prisma.user.create({
      data: {
        id: brandUserId,
        supabaseAuthId: `sub_disc_${Date.now()}`,
        email: `disc_${Date.now()}@test.com`,
        status: 'ACTIVE',
        brandProfile: {
          create: {
            id: brandProfileId,
            companyName: 'Discovery Brands Ltd',
          },
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('matches realistic typos through pg_trgm fuzzy matching without ILIKE', async () => {
    const assignmentId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: brandProfileId,
        title: 'Video Editing Masterclass Series',
        description: 'Looking for a premier editor for 4K footage',
        budgetMin: 50000,
        budgetMax: 90000,
        deadline: new Date(Date.now() + 86400000),
        status: 'PUBLISHED',
      },
    });

    // Query with realistic typo "Viddo Editing" (tsquery stem does not match, but trigram similarity > 0.3)
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/discovery/assignments?q=Viddo+Editing',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const matched = body.items.find((item: any) => item.id === assignmentId);
    expect(matched).toBeDefined();
    expect(matched.title).toBe('Video Editing Masterclass Series');
  });

  it('demonstrates stable 3-field keyset cursor pagination across identical timestamps and ranks', async () => {
    const baseDate = new Date('2026-09-01T12:00:00.000Z');
    const createdIds: string[] = [];

    // Create 9 assignments with exact identical titles and created_at timestamps
    for (let i = 0; i < 9; i++) {
      const id = generateUuidV7();
      createdIds.push(id);
      await prisma.assignment.create({
        data: {
          id,
          brandId: brandProfileId,
          title: 'Identical Production Brief',
          description: 'Identical description content',
          budgetMin: 20000,
          budgetMax: 40000,
          deadline: new Date(Date.now() + 86400000),
          status: 'PUBLISHED',
          createdAt: baseDate,
        },
      });
    }

    // Traverse all 9 assignments across 3 pages (limit=3)
    const collectedIds: string[] = [];
    let cursor: string | null = null;
    let pageCount = 0;

    do {
      const url = cursor
        ? `/api/v1/discovery/assignments?q=Identical+Production&limit=3&cursor=${encodeURIComponent(cursor)}`
        : `/api/v1/discovery/assignments?q=Identical+Production&limit=3`;

      const res = await app.inject({ method: 'GET', url });
      expect(res.statusCode).toBe(200);
      const data = res.json();

      for (const item of data.items) {
        if (createdIds.includes(item.id)) {
          collectedIds.push(item.id);
        }
      }

      cursor = data.nextCursor;
      pageCount++;
    } while (cursor && pageCount < 10);

    // Verify all 9 items were gathered with zero duplicates
    const uniqueIds = new Set(collectedIds);
    expect(collectedIds.length).toBe(9);
    expect(uniqueIds.size).toBe(9);
  });

  it('excludes PRIVATE profiles from public discovery feed', async () => {
    const privateUserId = generateUuidV7();
    await prisma.user.create({
      data: {
        id: privateUserId,
        supabaseAuthId: `sub_priv_${Date.now()}`,
        email: `priv_${Date.now()}@test.com`,
        status: 'ACTIVE',
        creatorProfile: {
          create: {
            id: generateUuidV7(),
            tagline: 'Secret Private Visual Artist',
            bio: 'Not for public eyes',
            visibility: 'PRIVATE',
          },
        },
      },
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/discovery/creators?q=Secret+Private',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    const found = body.items.find((c: any) => c.userId === privateUserId);
    expect(found).toBeUndefined();
  });

  it('lists active taxonomy categories and skills', async () => {
    const catRes = await app.inject({ method: 'GET', url: '/api/v1/discovery/categories' });
    expect(catRes.statusCode).toBe(200);
    const categories = catRes.json();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.every((c: any) => c.isActive === true)).toBe(true);

    const skillRes = await app.inject({ method: 'GET', url: '/api/v1/discovery/skills' });
    expect(skillRes.statusCode).toBe(200);
    const skills = skillRes.json();
    expect(Array.isArray(skills)).toBe(true);
    expect(skills.every((s: any) => s.isActive === true)).toBe(true);
  });
});
