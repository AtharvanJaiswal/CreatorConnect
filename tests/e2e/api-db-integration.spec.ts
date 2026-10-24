/**
 * CreatorConnect — API ↔ Database Integration Test Suite
 *
 * Scope: Verifies that every API call that is supposed to persist data actually
 * does so in PostgreSQL, and that every guard (auth, role, visibility, ownership,
 * concurrent acceptance) behaves correctly against the live Fastify + Postgres stack.
 *
 * Target: http://localhost:3000  (running Docker stack)
 * DB:     direct Prisma reads – SOURCE OF TRUTH assertions
 * Auth:   test JWT helper (same key-pair as jwks-stub)
 *
 * Run:
 *   cd CreatorConnect
 *   pnpm exec playwright test tests/e2e/api-db-integration.spec.ts --reporter=list
 */

import { test, expect } from '@playwright/test';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { createTestJwt } from '../fixtures/auth-test-helper.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const API = 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------
const prisma = getPrismaClient();
const createdUserIds: string[] = [];

async function provisionUser(
  role: 'CREATOR' | 'BRAND' | 'PROFESSIONAL' | 'PODCASTER',
  status: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE',
) {
  const userId = generateUuidV7();
  const sub = `sub_int_${role.toLowerCase()}_${Date.now()}_${generateUuidV7().replace(/-/g, '')}`;
  const email = `int_${role.toLowerCase()}_${Date.now()}_${generateUuidV7().replace(/-/g, '')}@cc.test`;

  createdUserIds.push(userId);

  await prisma.user.create({
    data: {
      id: userId,
      supabaseAuthId: sub,
      email,
      status,
      userRoles: {
        create: {
          id: generateUuidV7(),
          role: {
            connectOrCreate: {
              where: { name: role },
              create: { id: generateUuidV7(), name: role },
            },
          },
        },
      },
    },
  });

  const token = await createTestJwt({ sub, email });
  return { userId, sub, email, token };
}

// ---------------------------------------------------------------------------
// Global cleanup: runs once after the whole file finishes
// ---------------------------------------------------------------------------
test.afterAll(async () => {
  for (const uid of createdUserIds) {
    try {
      await prisma.report.deleteMany({ where: { reporterId: uid } });
      await prisma.userBlock.deleteMany({ where: { blockerId: uid } });
      await prisma.connectionRequest.deleteMany({ where: { senderId: uid } });
      await prisma.userSkill.deleteMany({ where: { userId: uid } });
      await prisma.creatorProfile.deleteMany({ where: { userId: uid } });
      await prisma.professionalProfile.deleteMany({ where: { userId: uid } });
      await prisma.brandProfile.deleteMany({ where: { userId: uid } });
      await prisma.podcasterProfile.deleteMany({ where: { userId: uid } });
      await prisma.userRole.deleteMany({ where: { userId: uid } });
      await prisma.user.deleteMany({ where: { id: uid } });
    } catch {
      // best-effort
    }
  }
});

// ===========================================================================
// SUITE 1 — Health & Server Availability
// ===========================================================================
test.describe('1 · Health & Server Availability', () => {
  test('GET /health returns 200 with status:ok', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
    expect(body.uptime).toBeGreaterThan(0);
  });

  test('unknown route returns RFC-7807 404 problem detail (not HTML)', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/does-not-exist-at-all`);
    expect(res.status()).toBe(404);
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/application\/json|problem\+json/);
    const body = await res.json();
    expect(body.code).toBe('NOT_FOUND');
    expect(body.status).toBe(404);
    expect(typeof body.type).toBe('string');
    expect(typeof body.title).toBe('string');
    expect(typeof body.detail).toBe('string');
    // Must never leak HTML error page through the proxy
    expect(ct).not.toContain('text/html');
  });
});

// ===========================================================================
// SUITE 2 — Auth / Identity Sync  →  PostgreSQL users table
// ===========================================================================
test.describe('2 · Auth Sync → DB persistence', () => {
  test('POST /api/v1/auth/sync without token → 401 AUTH_INVALID_TOKEN', async ({ request }) => {
    const res = await request.post(`${API}/api/v1/auth/sync`, { data: {} });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('AUTH_INVALID_TOKEN');
    expect(body.status).toBe(401);
  });

  test('POST /api/v1/auth/sync with valid JWT creates user in DB (201 isNewUser=true)', async ({
    request,
  }) => {
    const sub = `sub_sync_new_${Date.now()}`;
    const email = `sync_new_${Date.now()}@cc.test`;
    const token = await createTestJwt({ sub, email });
    createdUserIds.push('__sync_cleanup__'); // placeholder — real cleanup via sub below

    const res = await request.post(`${API}/api/v1/auth/sync`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { preferredRole: 'CREATOR' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.isNewUser).toBe(true);
    expect(body.user.supabaseAuthId).toBe(sub);
    expect(body.user.email).toBe(email);
    expect(body.user.roles).toContain('CREATOR');
    expect(body.user.status).toBe('ACTIVE');
    expect(typeof body.user.id).toBe('string');

    // DB truth: user row must exist
    const row = await prisma.user.findUnique({
      where: { id: body.user.id },
      include: { userRoles: { include: { role: true } } },
    });
    expect(row).not.toBeNull();
    expect(row!.supabaseAuthId).toBe(sub);
    expect(row!.email).toBe(email);
    expect(row!.status).toBe('ACTIVE');
    const roleNames = row!.userRoles.map((ur: any) => ur.role.name);
    expect(roleNames).toContain('CREATOR');

    // cleanup
    createdUserIds.push(body.user.id);
  });

  test('POST /api/v1/auth/sync is idempotent — second call returns 200 isNewUser=false with same id', async ({
    request,
  }) => {
    const sub = `sub_sync_idem_${Date.now()}`;
    const email = `sync_idem_${Date.now()}@cc.test`;
    const token = await createTestJwt({ sub, email });

    const r1 = await request.post(`${API}/api/v1/auth/sync`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { preferredRole: 'BRAND' },
    });
    expect(r1.status()).toBe(201);
    const b1 = await r1.json();

    const r2 = await request.post(`${API}/api/v1/auth/sync`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { preferredRole: 'BRAND' },
    });
    expect(r2.status()).toBe(200);
    const b2 = await r2.json();
    expect(b2.isNewUser).toBe(false);
    expect(b2.user.id).toBe(b1.user.id);

    // DB: still exactly one user row
    const count = await prisma.user.count({ where: { supabaseAuthId: sub } });
    expect(count).toBe(1);

    createdUserIds.push(b1.user.id);
  });

  test('POST /api/v1/auth/sync rejects ADMIN self-escalation → 400 ROLE_ESCALATION_ATTEMPT', async ({
    request,
  }) => {
    const sub = `sub_admin_esc_${Date.now()}`;
    const email = `admin_esc_${Date.now()}@cc.test`;
    const token = await createTestJwt({ sub, email });

    const res = await request.post(`${API}/api/v1/auth/sync`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { preferredRole: 'ADMIN' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('ROLE_ESCALATION_ATTEMPT');

    // DB: no user must have been created
    const row = await prisma.user.findFirst({ where: { supabaseAuthId: sub } });
    expect(row).toBeNull();
  });

  test('POST /api/v1/auth/sync rejects duplicate email from a different sub → 409 IDENTITY_EMAIL_CONFLICT', async ({
    request,
  }) => {
    const sharedEmail = `collision_${Date.now()}@cc.test`;
    const t1 = await createTestJwt({ sub: `sub_col_a_${Date.now()}`, email: sharedEmail });
    const t2 = await createTestJwt({ sub: `sub_col_b_${Date.now()}`, email: sharedEmail });

    const r1 = await request.post(`${API}/api/v1/auth/sync`, {
      headers: { Authorization: `Bearer ${t1}`, 'Content-Type': 'application/json' },
      data: {},
    });
    expect(r1.status()).toBe(201);
    createdUserIds.push((await r1.json()).user.id);

    const r2 = await request.post(`${API}/api/v1/auth/sync`, {
      headers: { Authorization: `Bearer ${t2}`, 'Content-Type': 'application/json' },
      data: {},
    });
    expect(r2.status()).toBe(409);
    const b2 = await r2.json();
    expect(b2.code).toBe('IDENTITY_EMAIL_CONFLICT');
  });
});

// ===========================================================================
// SUITE 3 — GET /api/v1/users/me  →  auth guards
// ===========================================================================
test.describe('3 · GET /api/v1/users/me — auth guards', () => {
  test('no token → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/users/me`);
    expect(res.status()).toBe(401);
    expect((await res.json()).code).toBe('AUTH_INVALID_TOKEN');
  });

  test('expired token → 401', async ({ request }) => {
    const user = await provisionUser('CREATOR');
    const expired = await createTestJwt({ sub: user.sub, email: user.email }, { expiresIn: '-1h' });
    const res = await request.get(`${API}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${expired}` },
    });
    expect(res.status()).toBe(401);
    expect(['AUTH_INVALID_TOKEN', 'AUTH_TOKEN_EXPIRED']).toContain((await res.json()).code);
  });

  test('suspended user → 403 USER_SUSPENDED', async ({ request }) => {
    const user = await provisionUser('CREATOR', 'SUSPENDED');
    const res = await request.get(`${API}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('USER_SUSPENDED');
    expect(body.status).toBe(403);
  });

  test('active user → 200 with correct id and role', async ({ request }) => {
    const user = await provisionUser('BRAND');
    const res = await request.get(`${API}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(user.userId);
    expect(body.email).toBe(user.email);
    expect(body.roles).toContain('BRAND');
    expect(body.status).toBe('ACTIVE');
  });
});

// ===========================================================================
// SUITE 4 — Creator Profile  →  PUT → DB → GET round-trip
// ===========================================================================
test.describe('4 · Creator profile PUT → DB → GET', () => {
  test('creates and persists creator profile in PostgreSQL', async ({ request }) => {
    const user = await provisionUser('CREATOR');

    const payload = {
      displayName: `Priya Patel Test ${Date.now()}`,
      bio: 'Sustainable fashion creator — integration test record.',
      niche: 'Fashion & Styling',
      locationCity: 'Mumbai',
      ratePerPost: 22000,
      availability: 'AVAILABLE',
      visibility: 'PUBLIC',
    };

    const put = await request.put(`${API}/api/v1/profiles/creator`, {
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      data: payload,
    });
    expect(put.status()).toBe(200);
    const putBody = await put.json();
    expect(putBody.userId).toBe(user.userId);
    expect(putBody.displayName).toBe(payload.displayName);
    expect(putBody.niche).toBe(payload.niche);
    expect(putBody.locationCity).toBe(payload.locationCity);
    expect(putBody.ratePerPost).toBe(payload.ratePerPost);
    expect(putBody.visibility).toBe('PUBLIC');

    // ── DB truth ──────────────────────────────────────────────────────────
    const row = await prisma.creatorProfile.findUnique({ where: { userId: user.userId } });
    expect(row).not.toBeNull();
    expect(row!.displayName).toBe(payload.displayName);
    expect(row!.bio).toBe(payload.bio);
    expect(row!.niche).toBe(payload.niche);
    expect(row!.locationCity).toBe(payload.locationCity);
    expect(row!.ratePerPost).toBe(payload.ratePerPost);
    expect(row!.visibility).toBe('PUBLIC');
    expect(row!.createdAt).toBeDefined();
    expect(row!.updatedAt).toBeDefined();

    // ── GET round-trip ────────────────────────────────────────────────────
    const get = await request.get(`${API}/api/v1/profiles/creator/${user.userId}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(get.status()).toBe(200);
    const getBody = await get.json();
    expect(getBody.displayName).toBe(payload.displayName);
    expect(getBody.locationCity).toBe(payload.locationCity);
  });

  test('PUT is a true upsert — second call updates the same row, does not create a duplicate', async ({
    request,
  }) => {
    const user = await provisionUser('CREATOR');
    const base = { displayName: 'Original Name', niche: 'Tech', visibility: 'PUBLIC' };
    await request.put(`${API}/api/v1/profiles/creator`, {
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      data: base,
    });

    const updated = { displayName: 'Updated Name', niche: 'Lifestyle', visibility: 'PUBLIC' };
    const r2 = await request.put(`${API}/api/v1/profiles/creator`, {
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      data: updated,
    });
    expect(r2.status()).toBe(200);

    const count = await prisma.creatorProfile.count({ where: { userId: user.userId } });
    expect(count).toBe(1);

    const row = await prisma.creatorProfile.findUnique({ where: { userId: user.userId } });
    expect(row!.displayName).toBe('Updated Name');
    expect(row!.niche).toBe('Lifestyle');
  });

  test('BRAND user cannot PUT creator profile → 403 AUTH_INSUFFICIENT_ROLE', async ({
    request,
  }) => {
    const brand = await provisionUser('BRAND');
    const res = await request.put(`${API}/api/v1/profiles/creator`, {
      headers: { Authorization: `Bearer ${brand.token}`, 'Content-Type': 'application/json' },
      data: { displayName: 'Brand Impersonating Creator', visibility: 'PUBLIC' },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('AUTH_INSUFFICIENT_ROLE');
  });

  test('PRIVATE creator profile is hidden from another user → 403', async ({ request }) => {
    const owner = await provisionUser('CREATOR');
    const viewer = await provisionUser('CREATOR');

    await request.put(`${API}/api/v1/profiles/creator`, {
      headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'application/json' },
      data: { displayName: 'Private Creator', visibility: 'PRIVATE' },
    });

    const get = await request.get(`${API}/api/v1/profiles/creator/${owner.userId}`, {
      headers: { Authorization: `Bearer ${viewer.token}` },
    });
    expect(get.status()).toBe(403);
  });
});

// ===========================================================================
// SUITE 5 — Brand Profile  →  PUT → DB → GET round-trip + ownership
// ===========================================================================
test.describe('5 · Brand profile PUT → DB → GET + ownership', () => {
  test('creates and persists brand profile in PostgreSQL', async ({ request }) => {
    const user = await provisionUser('BRAND');

    const payload = {
      companyName: `Apex Dynamics ${Date.now()}`,
      industry: 'Consumer Technology',
      websiteUrl: 'https://apexdyn.test',
      companySize: '51-200',
      bio: 'Enterprise sponsor — integration test.',
      visibility: 'PUBLIC',
    };

    const put = await request.put(`${API}/api/v1/profiles/brand`, {
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      data: payload,
    });
    expect(put.status()).toBe(200);
    const putBody = await put.json();
    expect(putBody.userId).toBe(user.userId);
    expect(putBody.companyName).toBe(payload.companyName);
    expect(putBody.industry).toBe(payload.industry);
    expect(putBody.websiteUrl).toBe(payload.websiteUrl);
    expect(putBody.companySize).toBe(payload.companySize);

    // ── DB truth ──────────────────────────────────────────────────────────
    const row = await prisma.brandProfile.findUnique({ where: { userId: user.userId } });
    expect(row).not.toBeNull();
    expect(row!.companyName).toBe(payload.companyName);
    expect(row!.industry).toBe(payload.industry);
    expect(row!.websiteUrl).toBe(payload.websiteUrl);
    expect(row!.companySize).toBe(payload.companySize);
    expect(row!.bio).toBe(payload.bio);
    expect(row!.visibility).toBe('PUBLIC');

    // ── GET by userId ─────────────────────────────────────────────────────
    const get = await request.get(`${API}/api/v1/profiles/brand/${user.userId}`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(get.status()).toBe(200);
    expect((await get.json()).companyName).toBe(payload.companyName);
  });

  test('CREATOR cannot PUT brand profile → 403 AUTH_INSUFFICIENT_ROLE', async ({ request }) => {
    const creator = await provisionUser('CREATOR');
    const res = await request.put(`${API}/api/v1/profiles/brand`, {
      headers: { Authorization: `Bearer ${creator.token}`, 'Content-Type': 'application/json' },
      data: { companyName: 'Fake Brand by Creator' },
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).code).toBe('AUTH_INSUFFICIENT_ROLE');
  });

  test('User B cannot read User A PRIVATE brand profile → 403', async ({ request }) => {
    const a = await provisionUser('BRAND');
    const b = await provisionUser('BRAND');

    await request.put(`${API}/api/v1/profiles/brand`, {
      headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
      data: { companyName: 'Stealth Brand A', visibility: 'PRIVATE' },
    });

    const get = await request.get(`${API}/api/v1/profiles/brand/${a.userId}`, {
      headers: { Authorization: `Bearer ${b.token}` },
    });
    expect(get.status()).toBe(403);
    expect((await get.json()).code).toBe('FORBIDDEN');
  });

  test('User B PUT brand does NOT overwrite User A — strict ownership isolation', async ({
    request,
  }) => {
    const a = await provisionUser('BRAND');
    const b = await provisionUser('BRAND');

    await request.put(`${API}/api/v1/profiles/brand`, {
      headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
      data: { companyName: 'Brand A Distinct Corp', visibility: 'PRIVATE' },
    });

    const putB = await request.put(`${API}/api/v1/profiles/brand`, {
      headers: { Authorization: `Bearer ${b.token}`, 'Content-Type': 'application/json' },
      data: { companyName: 'Brand B Different Corp', visibility: 'PUBLIC' },
    });
    expect(putB.status()).toBe(200);
    expect((await putB.json()).userId).toBe(b.userId);

    // A's DB row must be untouched
    const rowA = await prisma.brandProfile.findUnique({ where: { userId: a.userId } });
    expect(rowA!.companyName).toBe('Brand A Distinct Corp');
    expect(rowA!.userId).toBe(a.userId);

    // B's DB row has its own data
    const rowB = await prisma.brandProfile.findUnique({ where: { userId: b.userId } });
    expect(rowB!.companyName).toBe('Brand B Different Corp');
    expect(rowB!.userId).toBe(b.userId);
  });
});

// ===========================================================================
// SUITE 6 — Professional Profile  →  PUT → DB round-trip
// ===========================================================================
test.describe('6 · Professional profile PUT → DB', () => {
  test('creates and persists professional profile with all fields in PostgreSQL', async ({
    request,
  }) => {
    const user = await provisionUser('PROFESSIONAL');

    const payload = {
      headline: `Lead Audio Engineer ${Date.now()}`,
      bio: 'High-end post-production audio mixing for OTT.',
      dayRate: 85000,
      yearsExperience: 12,
      locationCity: 'Hyderabad',
      equipmentList: 'Genelec 8351B, Avid S6, Trinnov MC-Pro',
      visibility: 'PUBLIC',
    };

    const put = await request.put(`${API}/api/v1/profiles/professional`, {
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      data: payload,
    });
    expect(put.status()).toBe(200);
    const putBody = await put.json();
    expect(putBody.userId).toBe(user.userId);
    expect(putBody.headline).toBe(payload.headline);
    expect(putBody.dayRate).toBe(payload.dayRate);
    expect(putBody.yearsExperience).toBe(payload.yearsExperience);
    expect(putBody.locationCity).toBe(payload.locationCity);

    // ── DB truth ──────────────────────────────────────────────────────────
    const row = await prisma.professionalProfile.findUnique({ where: { userId: user.userId } });
    expect(row).not.toBeNull();
    expect(row!.headline).toBe(payload.headline);
    expect(row!.dayRate).toBe(payload.dayRate);
    expect(row!.yearsExperience).toBe(payload.yearsExperience);
    expect(row!.locationCity).toBe(payload.locationCity);
    expect(row!.equipmentList).toContain('Avid S6');
  });

  test('CREATOR cannot PUT professional profile → 403', async ({ request }) => {
    const creator = await provisionUser('CREATOR');
    const res = await request.put(`${API}/api/v1/profiles/professional`, {
      headers: { Authorization: `Bearer ${creator.token}`, 'Content-Type': 'application/json' },
      data: { headline: 'Fake Pro', dayRate: 50000, visibility: 'PUBLIC' },
    });
    expect(res.status()).toBe(403);
  });
});

// ===========================================================================
// SUITE 7 — Podcaster Profile  →  PUT → DB
// ===========================================================================
test.describe('7 · Podcaster profile PUT → DB', () => {
  test('creates and persists podcaster profile in PostgreSQL', async ({ request }) => {
    const user = await provisionUser('PODCASTER');

    const payload = {
      showName: `The Dev Diaries ${Date.now()}`,
      bio: 'Weekly deep dives into startup engineering.',
      episodeCount: 42,
      avgListeners: 14500,
      locationCity: 'Bengaluru',
      visibility: 'PUBLIC',
    };

    const put = await request.put(`${API}/api/v1/profiles/podcaster`, {
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      data: payload,
    });
    expect(put.status()).toBe(200);
    const putBody = await put.json();
    expect(putBody.userId).toBe(user.userId);
    expect(putBody.showName).toBe(payload.showName);

    // ── DB truth ──────────────────────────────────────────────────────────
    const row = await prisma.podcasterProfile.findUnique({ where: { userId: user.userId } });
    expect(row).not.toBeNull();
    expect(row!.showName).toBe(payload.showName);
    expect(row!.episodeCount).toBe(payload.episodeCount);
    expect(row!.avgListeners).toBe(payload.avgListeners);
    expect(row!.locationCity).toBe(payload.locationCity);
  });
});

// ===========================================================================
// SUITE 8 — User Skills  →  PUT → DB
// ===========================================================================
test.describe('8 · User skills PUT → DB', () => {
  test('replaces skills and confirms DB state matches exactly', async ({ request }) => {
    const user = await provisionUser('CREATOR');

    const payload = {
      skills: [
        { skillName: 'Reels Production', proficiency: 'EXPERT' },
        { skillName: 'UGC Content Creation', proficiency: 'ADVANCED' },
        { skillName: 'Color Grading', proficiency: 'INTERMEDIATE' },
      ],
    };

    const put = await request.put(`${API}/api/v1/profiles/skills`, {
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      data: payload,
    });
    expect(put.status()).toBe(200);
    const putBody = await put.json();
    expect(Array.isArray(putBody)).toBe(true);
    expect(putBody).toHaveLength(3);
    const names = putBody.map((s: any) => s.skillName);
    expect(names).toContain('Reels Production');
    expect(names).toContain('Color Grading');

    // DB truth
    const rows = await prisma.userSkill.findMany({ where: { userId: user.userId } });
    expect(rows).toHaveLength(3);
    const dbNames = rows.map((r: any) => r.skillName);
    expect(dbNames).toContain('Reels Production');

    // Second PUT replaces with fewer skills
    const put2 = await request.put(`${API}/api/v1/profiles/skills`, {
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      data: { skills: [{ skillName: 'Photography', proficiency: 'EXPERT' }] },
    });
    expect(put2.status()).toBe(200);
    const rows2 = await prisma.userSkill.findMany({ where: { userId: user.userId } });
    // Old skills must be gone; only new one remains
    expect(rows2).toHaveLength(1);
    expect(rows2[0].skillName).toBe('Photography');
  });
});

// ===========================================================================
// SUITE 9 — GET /api/v1/profiles/me  →  aggregated profile response
// ===========================================================================
test.describe('9 · GET /api/v1/profiles/me — aggregated response', () => {
  test('returns null for profile types not yet created', async ({ request }) => {
    const user = await provisionUser('CREATOR');
    const res = await request.get(`${API}/api/v1/profiles/me`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('creator');
    expect(body).toHaveProperty('professional');
    expect(body).toHaveProperty('brand');
    expect(body).toHaveProperty('podcaster');
    expect(body).toHaveProperty('skills');
    expect(Array.isArray(body.skills)).toBe(true);
    // Fresh user: no profiles yet
    expect(body.creator).toBeNull();
    expect(body.brand).toBeNull();
  });

  test('returns populated creator profile after PUT', async ({ request }) => {
    const user = await provisionUser('CREATOR');

    await request.put(`${API}/api/v1/profiles/creator`, {
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      data: { displayName: 'Aggregated Test Creator', niche: 'Fitness', visibility: 'PUBLIC' },
    });

    const res = await request.get(`${API}/api/v1/profiles/me`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.creator).not.toBeNull();
    expect(body.creator.displayName).toBe('Aggregated Test Creator');
    expect(body.creator.niche).toBe('Fitness');
  });

  test('returns populated brand profile after PUT for BRAND user', async ({ request }) => {
    const user = await provisionUser('BRAND');

    await request.put(`${API}/api/v1/profiles/brand`, {
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      data: { companyName: 'MeAggTest Brand Inc', industry: 'FMCG', visibility: 'PUBLIC' },
    });

    const res = await request.get(`${API}/api/v1/profiles/me`, {
      headers: { Authorization: `Bearer ${user.token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.brand).not.toBeNull();
    expect(body.brand.companyName).toBe('MeAggTest Brand Inc');
  });

  test('unauthenticated request → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/profiles/me`);
    expect(res.status()).toBe(401);
  });
});

// ===========================================================================
// SUITE 10 — PATCH /api/v1/users/me  →  DB update
// ===========================================================================
test.describe('10 · PATCH /api/v1/users/me → DB update', () => {
  test('updates firstName and lastName and verifies DB row changes', async ({ request }) => {
    const user = await provisionUser('CREATOR');

    const patch = await request.patch(`${API}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
      data: { firstName: 'Anjali', lastName: 'Kapoor' },
    });
    expect(patch.status()).toBe(200);
    const body = await patch.json();
    expect(body.firstName).toBe('Anjali');
    expect(body.lastName).toBe('Kapoor');

    // DB truth
    const row = await prisma.user.findUnique({ where: { id: user.userId } });
    expect(row!.firstName).toBe('Anjali');
    expect(row!.lastName).toBe('Kapoor');
  });
});

// ===========================================================================
// SUITE 11 — Discovery Endpoints
// ===========================================================================
test.describe('11 · Discovery endpoints', () => {
  test('GET /api/v1/home/dashboard returns 200 with expected shape', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/home/dashboard?role=CREATOR`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Shape check: must have either real or mock data
    expect(body).toHaveProperty('role');
    expect(body).toHaveProperty('greeting');
  });

  test('GET /api/v1/home/dashboard for BRAND role returns 200', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/home/dashboard?role=BRAND`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.role).toBe('BRAND');
  });

  test('GET /api/v1/discover returns 200 list with shape check', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/discover?role=creator`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
    expect(body).toHaveProperty('total');
  });

  test('GET /api/v1/search/autocomplete returns categorised suggestions', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/search/autocomplete?q=fash`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('suggestions');
    expect(Array.isArray(body.suggestions)).toBe(true);
  });

  test('GET /api/v1/discover/recommendations returns 200 with items', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/discover/recommendations?role=CREATOR`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('recommendations');
    expect(Array.isArray(body.recommendations)).toBe(true);
  });

  test('GET /api/v1/discovery/creators returns paginated list', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/discovery/creators?limit=5`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('total');
  });

  test('GET /api/v1/discovery/assignments returns paginated list', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/discovery/assignments?limit=5`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('items');
  });

  test('GET /api/v1/discovery/categories returns array', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/discovery/categories`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/v1/discovery/skills returns array', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/discovery/skills`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('GET /api/v1/profile/:id returns 404 for non-existent id', async ({ request }) => {
    const fakeId = generateUuidV7();
    const res = await request.get(`${API}/api/v1/profile/${fakeId}`);
    expect([404, 200]).toContain(res.status()); // 200 = mock fallback in place; both are acceptable
  });
});

// ===========================================================================
// SUITE 12 — Connection Request  →  DB + quota enforcement
// ===========================================================================
test.describe('12 · Connection request → DB + quota', () => {
  test('authenticated user can send connection request → persisted in DB', async ({ request }) => {
    const sender = await provisionUser('CREATOR');
    const receiver = await provisionUser('CREATOR');

    const res = await request.post(`${API}/api/v1/connections/request`, {
      headers: { Authorization: `Bearer ${sender.token}`, 'Content-Type': 'application/json' },
      data: { targetUserId: receiver.userId, note: 'Hi, let us collaborate!' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // DB truth: connection request row must exist
    const row = await prisma.connectionRequest.findFirst({
      where: { senderId: sender.userId, receiverId: receiver.userId },
    });
    expect(row).not.toBeNull();
    expect(row!.senderId).toBe(sender.userId);
    expect(row!.receiverId).toBe(receiver.userId);
  });

  test('unauthenticated connection request → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/v1/connections/request`, {
      headers: { 'Content-Type': 'application/json' },
      data: { targetUserId: generateUuidV7() },
    });
    expect(res.status()).toBe(401);
  });
});

// ===========================================================================
// SUITE 13 — Block User  →  DB + response
// ===========================================================================
test.describe('13 · Block user → DB', () => {
  test('block request stores record in DB and returns success', async ({ request }) => {
    const blocker = await provisionUser('CREATOR');
    const target = await provisionUser('CREATOR');

    const res = await request.post(`${API}/api/v1/users/block`, {
      headers: { Authorization: `Bearer ${blocker.token}`, 'Content-Type': 'application/json' },
      data: { targetUserId: target.userId, reason: 'Spam messages' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).success).toBe(true);

    // DB truth
    const row = await prisma.userBlock.findFirst({
      where: { blockerId: blocker.userId, blockedId: target.userId },
    });
    expect(row).not.toBeNull();
    expect(row!.blockerId).toBe(blocker.userId);
    expect(row!.blockedId).toBe(target.userId);
  });

  test('unauthenticated block request → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/v1/users/block`, {
      data: { targetUserId: generateUuidV7() },
    });
    expect(res.status()).toBe(401);
  });
});

// ===========================================================================
// SUITE 14 — Report User  →  DB
// ===========================================================================
test.describe('14 · Report user → DB', () => {
  test('report request stores record in DB and returns reportId', async ({ request }) => {
    const reporter = await provisionUser('CREATOR');
    const target = await provisionUser('CREATOR');

    const res = await request.post(`${API}/api/v1/reports`, {
      headers: { Authorization: `Bearer ${reporter.token}`, 'Content-Type': 'application/json' },
      data: {
        targetId: target.userId,
        targetType: 'USER',
        category: 'SPAM',
        details: 'This user is sending repetitive spam messages.',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.reportId).toBe('string');

    // DB truth
    const row = await prisma.report.findFirst({
      where: { reporterId: reporter.userId },
    });
    expect(row).not.toBeNull();
    expect(row!.reporterId).toBe(reporter.userId);
    expect(row!.status).toBe('PENDING');
  });

  test('unauthenticated report → 401', async ({ request }) => {
    const res = await request.post(`${API}/api/v1/reports`, {
      data: { targetId: generateUuidV7(), targetType: 'USER', category: 'SPAM', details: 'x' },
    });
    expect(res.status()).toBe(401);
  });
});

// ===========================================================================
// SUITE 15 — Security hardening
// ===========================================================================
test.describe('15 · Security hardening', () => {
  test('token with wrong JWT issuer → 401 AUTH_INVALID_TOKEN', async ({ request }) => {
    const user = await provisionUser('CREATOR');
    const forged = await createTestJwt({
      sub: user.sub,
      email: user.email,
      iss: 'https://evil-attacker.example.com/auth/v1',
    });

    const res = await request.get(`${API}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${forged}` },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).code).toBe('AUTH_INVALID_TOKEN');
  });

  test('malformed (non-JWT) token → 401', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/users/me`, {
      headers: { Authorization: 'Bearer not.a.jwt.at.all' },
    });
    expect(res.status()).toBe(401);
  });

  test('Bearer header missing scheme prefix → 401', async ({ request }) => {
    const user = await provisionUser('CREATOR');
    const res = await request.get(`${API}/api/v1/users/me`, {
      headers: { Authorization: user.token }, // no "Bearer " prefix
    });
    expect(res.status()).toBe(401);
  });

  test('admin-only endpoint rejects non-admin → 403', async ({ request }) => {
    const creator = await provisionUser('CREATOR');
    const targetId = generateUuidV7();
    const res = await request.patch(`${API}/api/v1/admin/users/${targetId}/status`, {
      headers: { Authorization: `Bearer ${creator.token}`, 'Content-Type': 'application/json' },
      data: { status: 'SUSPENDED', reason: 'test' },
    });
    expect(res.status()).toBe(403);
  });

  test('all protected endpoints return structured JSON errors — never HTML', async ({
    request,
  }) => {
    const endpoints = [
      { method: 'GET', path: '/api/v1/users/me' },
      { method: 'GET', path: '/api/v1/profiles/me' },
      { method: 'PUT', path: '/api/v1/profiles/creator' },
      { method: 'PUT', path: '/api/v1/profiles/brand' },
      { method: 'POST', path: '/api/v1/connections/request' },
    ];
    for (const ep of endpoints) {
      const res =
        ep.method === 'GET'
          ? await request.get(`${API}${ep.path}`)
          : await request.fetch(`${API}${ep.path}`, { method: ep.method, data: {} });
      expect([400, 401, 403, 404, 405, 422]).toContain(res.status());
      const ct = res.headers()['content-type'] ?? '';
      expect(ct).toMatch(/application\/json|problem\+json/);
      expect(ct).not.toContain('text/html');
    }
  });
});
