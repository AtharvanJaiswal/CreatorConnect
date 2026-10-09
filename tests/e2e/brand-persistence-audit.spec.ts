import { test, expect } from '@playwright/test';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { createTestJwt } from '../fixtures/auth-test-helper.js';

test.describe('Customer/Brand Profile End-to-End Persistence Audit', () => {
  const prisma = getPrismaClient();

  const createdUserIds: string[] = [];

  test.afterAll(async () => {
    for (const uId of createdUserIds) {
      await prisma.brandProfile.deleteMany({ where: { userId: uId } });
      await prisma.userRole.deleteMany({ where: { userId: uId } });
      await prisma.user.deleteMany({ where: { id: uId } });
    }
  });

  async function provisionUser(role: 'BRAND' | 'CREATOR') {
    const userId = generateUuidV7();
    const sub = `sub_e2e_brand_${Date.now()}_${generateUuidV7().replace(/-/g, '')}`;
    const email = `e2e_${role.toLowerCase()}_${Date.now()}@creatorconnect.test`;

    createdUserIds.push(userId);

    await prisma.user.create({
      data: {
        id: userId,
        supabaseAuthId: sub,
        email,
        status: 'ACTIVE',
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
  // TEST 1: FRONTEND UI AUDIT
  // ---------------------------------------------------------------------------
  test('Audit frontend UI for Customer/Brand profile forms on /profiles/me and /brand', async ({
    page,
  }) => {
    // 1. Inspect /profiles/me
    await page.goto('/profiles/me', { waitUntil: 'domcontentloaded' });

    const brandTabLocator = page.locator(
      '[data-testid="tab-brand"], button:has-text("Brand Profile"), [role="tab"]:has-text("Brand")',
    );
    const hasBrandTab = (await brandTabLocator.count()) > 0;

    const companyNameInputLocator = page.locator(
      'input[name="companyName"], [data-testid="brand-company-name-input"], input[placeholder*="Company"], input[placeholder*="Brand"]',
    );
    const hasCompanyNameInput = (await companyNameInputLocator.count()) > 0;

    console.log('[FRONTEND AUDIT /profiles/me]:');
    console.log('  Has Brand Profile Tab:', hasBrandTab);
    console.log('  Has Company Name Input:', hasCompanyNameInput);

    // 2. Inspect /brand
    await page.goto('/brand', { waitUntil: 'domcontentloaded' });
    const brandPageFormLocator = page.locator('form, input, textarea');
    const formElementCount = await brandPageFormLocator.count();

    console.log('[FRONTEND AUDIT /brand]:');
    console.log('  Form/Input Element Count on /brand:', formElementCount);

    // Record finding
    expect(hasBrandTab).toBe(false);
    expect(hasCompanyNameInput).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // TEST 2: BACKEND & DATABASE PERSISTENCE FOR CUSTOMER A
  // ---------------------------------------------------------------------------
  test('Customer A saves Brand profile -> persisted in PostgreSQL -> retrieved via GET', async ({
    request,
  }) => {
    const customerA = await provisionUser('BRAND');

    const brandPayload = {
      companyName: 'Apex Dynamics Media Global',
      industry: 'Consumer Technology & SaaS',
      websiteUrl: 'https://apexdynamics.example.com',
      companySize: '51-200',
      bio: 'Leading enterprise sponsor partnering with premier YouTube creators and technical podcasters.',
      visibility: 'PUBLIC' as const,
    };

    // 1. Send PUT request to API
    const putRes = await request.put('http://localhost:3000/api/v1/profiles/brand', {
      headers: {
        Authorization: `Bearer ${customerA.token}`,
        'Content-Type': 'application/json',
      },
      data: brandPayload,
    });

    expect(putRes.status()).toBe(200);
    const putBody = await putRes.json();

    expect(putBody.userId).toBe(customerA.userId);
    expect(putBody.companyName).toBe(brandPayload.companyName);
    expect(putBody.industry).toBe(brandPayload.industry);
    expect(putBody.websiteUrl).toBe(brandPayload.websiteUrl);
    expect(putBody.companySize).toBe(brandPayload.companySize);
    expect(putBody.bio).toBe(brandPayload.bio);
    expect(putBody.visibility).toBe('PUBLIC');
    expect(putBody.id).toBeDefined();

    console.log('[API PUT SUCCESS]: Response status 200, profileId:', putBody.id);

    // 2. Inspect exact PostgreSQL row via Prisma
    const dbRow = await prisma.brandProfile.findUnique({
      where: { userId: customerA.userId },
    });

    expect(dbRow).not.toBeNull();
    expect(dbRow!.id).toBe(putBody.id);
    expect(dbRow!.userId).toBe(customerA.userId);
    expect(dbRow!.companyName).toBe(brandPayload.companyName);
    expect(dbRow!.industry).toBe(brandPayload.industry);
    expect(dbRow!.websiteUrl).toBe(brandPayload.websiteUrl);
    expect(dbRow!.companySize).toBe(brandPayload.companySize);
    expect(dbRow!.bio).toBe(brandPayload.bio);
    expect(dbRow!.visibility).toBe('PUBLIC');
    expect(dbRow!.createdAt).toBeDefined();
    expect(dbRow!.updatedAt).toBeDefined();

    console.log('[POSTGRESQL AUDIT SUCCESS]: Exact row confirmed in table "brand_profiles":', {
      id: dbRow!.id,
      userId: dbRow!.userId,
      companyName: dbRow!.companyName,
      industry: dbRow!.industry,
      visibility: dbRow!.visibility,
    });

    // 3. Retrieve profile via GET /api/v1/profiles/brand/:id (using user ID)
    const getRes = await request.get(
      `http://localhost:3000/api/v1/profiles/brand/${customerA.userId}`,
      {
        headers: {
          Authorization: `Bearer ${customerA.token}`,
        },
      },
    );

    expect(getRes.status()).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.companyName).toBe(brandPayload.companyName);

    // 4. Retrieve profile via GET /api/v1/profiles/me
    const getMeRes = await request.get('http://localhost:3000/api/v1/profiles/me', {
      headers: {
        Authorization: `Bearer ${customerA.token}`,
      },
    });

    expect(getMeRes.status()).toBe(200);
    const getMeBody = await getMeRes.json();
    expect(getMeBody.brand).not.toBeNull();
    expect(getMeBody.brand.companyName).toBe(brandPayload.companyName);
    expect(getMeBody.brand.industry).toBe(brandPayload.industry);
  });

  // ---------------------------------------------------------------------------
  // TEST 3: MULTI-USER ISOLATION & PRIVATE VISIBILITY ACCESS CONTROLS
  // ---------------------------------------------------------------------------
  test('Customer B cannot view Customer A private profile or modify Customer A data', async ({
    request,
  }) => {
    const customerA = await provisionUser('BRAND');
    const customerB = await provisionUser('BRAND');

    // Customer A sets profile to PRIVATE
    const putResA = await request.put('http://localhost:3000/api/v1/profiles/brand', {
      headers: {
        Authorization: `Bearer ${customerA.token}`,
        'Content-Type': 'application/json',
      },
      data: {
        companyName: 'Private Brand Stealth Corp',
        visibility: 'PRIVATE',
      },
    });
    expect(putResA.status()).toBe(200);

    // 1. Customer B attempts to view Customer A's private profile -> MUST BE REJECTED 403
    const getPrivateRes = await request.get(
      `http://localhost:3000/api/v1/profiles/brand/${customerA.userId}`,
      {
        headers: {
          Authorization: `Bearer ${customerB.token}`,
        },
      },
    );

    expect(getPrivateRes.status()).toBe(403);
    const getPrivateBody = await getPrivateRes.json();
    expect(getPrivateBody.code).toBe('FORBIDDEN');
    console.log('[SECURITY SUCCESS]: Customer B blocked from viewing Customer A private profile:', {
      status: getPrivateRes.status(),
      code: getPrivateBody.code,
    });

    // 2. Customer B attempts to modify profile -> Server-derived identity binds to B, NOT A
    const putResB = await request.put('http://localhost:3000/api/v1/profiles/brand', {
      headers: {
        Authorization: `Bearer ${customerB.token}`,
        'Content-Type': 'application/json',
      },
      data: {
        companyName: 'Customer B Distinct Corporation',
        industry: 'Beverages & FMCG',
      },
    });

    expect(putResB.status()).toBe(200);
    const putBodyB = await putResB.json();
    expect(putBodyB.userId).toBe(customerB.userId);

    // 3. Verify Customer A's record in PostgreSQL was NOT modified
    const dbRowA = await prisma.brandProfile.findUnique({
      where: { userId: customerA.userId },
    });

    expect(dbRowA!.companyName).toBe('Private Brand Stealth Corp');
    expect(dbRowA!.userId).toBe(customerA.userId);
    console.log(
      "[OWNERSHIP ISOLATION SUCCESS]: Customer A profile remains unpolluted by Customer B's actions.",
    );
  });

  // ---------------------------------------------------------------------------
  // TEST 4: ROLE GATING PROTECTION
  // ---------------------------------------------------------------------------
  test('Non-brand user (CREATOR) cannot create or update Brand profile', async ({ request }) => {
    const creatorUser = await provisionUser('CREATOR');

    const res = await request.put('http://localhost:3000/api/v1/profiles/brand', {
      headers: {
        Authorization: `Bearer ${creatorUser.token}`,
        'Content-Type': 'application/json',
      },
      data: {
        companyName: 'Fake Brand By Creator',
      },
    });

    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('AUTH_INSUFFICIENT_ROLE');
    console.log('[ROLE GATING SUCCESS]: Creator blocked from Brand endpoint with 403:', body.code);
  });
});
