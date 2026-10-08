import { test, expect } from '@playwright/test';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import * as jose from 'jose';

// Test token generator for real authentication
async function generateTestAuthToken(sub: string, email: string): Promise<string> {
  const kid = 'test-key-01';
  // Use pre-shared or generated ES256 key pair
  const { privateKey } = await jose.generateKeyPair('ES256', { extractable: true });
  return await new jose.SignJWT({ email })
    .setProtectedHeader({ alg: 'ES256', kid })
    .setSubject(sub)
    .setAudience('authenticated')
    .setIssuer('https://localhost.supabase.co/auth/v1')
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(privateKey);
}

test.describe('Real Web → API Integration: Professional Profile Journey (Phase D)', () => {
  const prisma = getPrismaClient();

  let testUserId: string;
  let testSub: string;
  let testEmail: string;
  let testAuthToken: string;

  test.beforeAll(async () => {
    testUserId = generateUuidV7();
    testSub = `sub_e2e_pro_${Date.now()}_${generateUuidV7().replace(/-/g, '')}`;
    testEmail = `e2e_pro_${Date.now()}@creatorconnect.test`;

    // 1. Provision user directly in real PostgreSQL with ACTIVE status and PROFESSIONAL role
    await prisma.user.create({
      data: {
        id: testUserId,
        supabaseAuthId: testSub,
        email: testEmail,
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

    // 2. Obtain real signed JWT using auth helper
    const { createTestJwt } = await import('../fixtures/auth-test-helper.js');
    testAuthToken = await createTestJwt({
      sub: testSub,
      email: testEmail,
    });
  });

  test.afterAll(async () => {
    // Cleanup created test records
    try {
      await prisma.professionalProfile.deleteMany({ where: { userId: testUserId } });
      await prisma.userRole.deleteMany({ where: { userId: testUserId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('executes real profile edit journey through Next.js rewrite into Fastify and PostgreSQL', async ({
    page,
  }) => {
    // Inject test session token before page scripts execute
    await page.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, testAuthToken);

    // Track network requests to verify proxy behavior and headers
    let capturedAuthHeader: string | null = null;
    let proxyEndpointHit = false;
    let responseStatus: number | null = null;
    let isJsonContentType = false;

    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/v1/profiles/professional')) {
        proxyEndpointHit = true;
        capturedAuthHeader = req.headers()['authorization'] || null;
      }
    });

    page.on('response', (res) => {
      const url = res.url();
      if (url.includes('/api/v1/profiles/professional') && res.request().method() === 'PUT') {
        responseStatus = res.status();
        const ct = res.headers()['content-type'] || '';
        isJsonContentType = ct.includes('application/json');
      }
    });

    // 1. Open the real profile UI on port 3002
    await page.goto('/profiles/me', { waitUntil: 'networkidle' });

    // 2. Select Professional Profile tab
    await page.click('[data-testid="tab-professional"]');

    // 3. Edit professional profile fields
    const newHeadline = `Lead Dolby Atmos Audio Engineer ${Date.now()}`;
    const newBio = 'High-end post production audio mixing for OTT and features.';
    const newDayRate = '85000';
    const newYearsExp = '12';
    const newCity = 'Hyderabad';
    const newEquipment = 'Genelec 8351B, Avid S6, Trinnov MC-Pro';

    await page.fill('[data-testid="profile-headline-input"]', newHeadline);
    await page.fill('[data-testid="profile-bio-input"]', newBio);
    await page.fill('[data-testid="profile-day-rate-input"]', newDayRate);
    await page.fill('[data-testid="profile-years-experience-input"]', newYearsExp);
    await page.fill('[data-testid="profile-city-input"]', newCity);
    await page.fill('[data-testid="profile-equipment-input"]', newEquipment);

    // 4. Save profile
    await page.click('[data-testid="save-profile-button"]');

    // 5. Verify request reached Fastify via proxy
    await expect(page.locator('[data-testid="profile-save-success"]')).toBeVisible({
      timeout: 10000,
    });

    expect(proxyEndpointHit).toBe(true);
    expect(capturedAuthHeader).toBe(`Bearer ${testAuthToken}`);
    expect(responseStatus).toBe(200);
    expect(isJsonContentType).toBe(true);

    // 6. Reload the page to test persistence
    await page.reload({ waitUntil: 'networkidle' });
    await page.click('[data-testid="tab-professional"]');

    // Verify UI displays persisted values
    await expect(page.locator('[data-testid="profile-headline-input"]')).toHaveValue(newHeadline);
    await expect(page.locator('[data-testid="profile-day-rate-input"]')).toHaveValue(newDayRate);
    await expect(page.locator('[data-testid="profile-city-input"]')).toHaveValue(newCity);

    // 7. Verify directly from PostgreSQL authority
    const persistedInDb = await prisma.professionalProfile.findUnique({
      where: { userId: testUserId },
    });
    expect(persistedInDb).not.toBeNull();
    expect(persistedInDb!.headline).toBe(newHeadline);
    expect(persistedInDb!.dayRate).toBe(85000);
    expect(persistedInDb!.yearsExperience).toBe(12);
    expect(persistedInDb!.locationCity).toBe('Hyderabad');
    expect(persistedInDb!.equipmentList).toContain('Avid S6');
  });

  test('negative test: verifies nonexistent API route returns RFC7807 problem details and rejects HTML 404', async ({
    request,
  }) => {
    // Make request to intentionally nonexistent path through proxy
    const res = await request.get('/api/v1/intentionally-nonexistent-api-path', {
      headers: {
        Accept: 'application/json, application/problem+json',
      },
    });

    expect(res.status()).toBe(404);
    const contentType = res.headers()['content-type'] || '';

    // Must be application/problem+json or application/json (RFC7807), NOT text/html
    expect(contentType).toMatch(/problem\+json|application\/json/);
    expect(contentType).not.toContain('text/html');

    const body = await res.json();
    expect(body.type).toBe('https://api.creatorconnect.com/errors/not-found');
    expect(body.title).toBe('Resource Not Found');
    expect(body.status).toBe(404);
    expect(body.detail).toMatch(/not found/i);
  });
});
