import { test, expect } from '@playwright/test';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { createTestJwt } from '../fixtures/auth-test-helper.js';

test.describe('Brand/Customer Profile User Journey End-to-End', () => {
  const prisma = getPrismaClient();
  const createdUserIds: string[] = [];

  test.afterAll(async () => {
    for (const uId of createdUserIds) {
      try {
        await prisma.brandProfile.deleteMany({ where: { userId: uId } });
        await prisma.userRole.deleteMany({ where: { userId: uId } });
        await prisma.user.deleteMany({ where: { id: uId } });
      } catch {
        // ignore cleanup errors
      }
    }
  });

  async function provisionUser(role: 'BRAND' | 'CREATOR' | 'PROFESSIONAL') {
    const userId = generateUuidV7();
    const sub = `sub_e2e_${role.toLowerCase()}_${Date.now()}_${generateUuidV7().replace(/-/g, '')}`;
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
  // SCENARIO 1: COMPLETE BRAND PROFILE LIFECYCLE (LOAD, EDIT, SAVE, PERSIST, RELOAD)
  // ---------------------------------------------------------------------------
  test('Brand user logs in, edits all profile fields, saves, and verifies database persistence', async ({
    page,
  }) => {
    const brandUser = await provisionUser('BRAND');

    // Inject authenticated test token into browser session
    await page.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, brandUser.token);

    // Track PUT requests to verify contract and authorization headers
    let putRequestPayload: any = null;
    let putAuthHeader: string | null = null;
    let putStatusCode: number | null = null;

    page.on('request', (req) => {
      if (req.url().includes('/api/v1/profiles/brand') && req.method() === 'PUT') {
        putAuthHeader = req.headers()['authorization'] || null;
        try {
          putRequestPayload = JSON.parse(req.postData() || '{}');
        } catch {}
      }
    });

    page.on('response', (res) => {
      if (res.url().includes('/api/v1/profiles/brand') && res.request().method() === 'PUT') {
        putStatusCode = res.status();
      }
    });

    // 1. Navigate to /profiles/me
    await page.goto('/profiles/me', { waitUntil: 'networkidle' });

    // 2. Verify Brand tab is visible for authorized Brand user
    const brandTab = page.locator('[data-testid="tab-brand"]');
    await expect(brandTab).toBeVisible({ timeout: 10000 });
    await brandTab.click();

    // 3. Fill all Brand Profile fields
    const testData = {
      companyName: `Vertex Global Media ${Date.now()}`,
      industry: 'Consumer Tech & Streaming',
      websiteUrl: 'https://vertexglobal.example.com',
      companySize: '51-200',
      bio: 'Enterprise sponsor partnering with elite YouTube creator channels and technical podcasts.',
      visibility: 'PUBLIC' as const,
    };

    await page.fill('[data-testid="brand-company-name-input"]', testData.companyName);
    await page.fill('[data-testid="brand-industry-input"]', testData.industry);
    await page.fill('[data-testid="brand-website-url-input"]', testData.websiteUrl);
    await page.selectOption('[data-testid="brand-company-size-select"]', testData.companySize);
    await page.fill('[data-testid="brand-bio-input"]', testData.bio);
    await page.selectOption('[data-testid="brand-visibility-select"]', testData.visibility);

    // 4. Click Save
    const saveButton = page.locator('[data-testid="save-brand-profile-button"]');
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // 5. Verify success feedback
    await expect(page.locator('[data-testid="brand-profile-save-success"]')).toBeVisible({
      timeout: 10000,
    });

    // Verify network contract compliance
    expect(putStatusCode).toBe(200);
    expect(putAuthHeader).toBe(`Bearer ${brandUser.token}`);
    expect(putRequestPayload.companyName).toBe(testData.companyName);
    expect(putRequestPayload.industry).toBe(testData.industry);
    expect(putRequestPayload.websiteUrl).toBe(testData.websiteUrl);
    expect(putRequestPayload.companySize).toBe(testData.companySize);
    expect(putRequestPayload.bio).toBe(testData.bio);
    // Strict ownership verification: no client-supplied userId or roles in payload
    expect(putRequestPayload.userId).toBeUndefined();
    expect(putRequestPayload.roles).toBeUndefined();

    // 6. Direct PostgreSQL assertion via Prisma authority
    const persisted = await prisma.brandProfile.findUnique({
      where: { userId: brandUser.userId },
    });
    expect(persisted).not.toBeNull();
    expect(persisted!.companyName).toBe(testData.companyName);
    expect(persisted!.industry).toBe(testData.industry);
    expect(persisted!.websiteUrl).toBe(testData.websiteUrl);
    expect(persisted!.companySize).toBe(testData.companySize);
    expect(persisted!.bio).toBe(testData.bio);
    expect(persisted!.visibility).toBe('PUBLIC');

    // 7. Reload page -> verify persisted values remain populated in the UI
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="tab-brand"]')).toBeVisible();
    await page.click('[data-testid="tab-brand"]');

    await expect(page.locator('[data-testid="brand-company-name-input"]')).toHaveValue(
      testData.companyName,
    );
    await expect(page.locator('[data-testid="brand-industry-input"]')).toHaveValue(
      testData.industry,
    );
    await expect(page.locator('[data-testid="brand-website-url-input"]')).toHaveValue(
      testData.websiteUrl,
    );
    await expect(page.locator('[data-testid="brand-company-size-select"]')).toHaveValue(
      testData.companySize,
    );
    await expect(page.locator('[data-testid="brand-bio-input"]')).toHaveValue(testData.bio);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 2: /brand DASHBOARD ENTRY POINT TO EDIT PROFILE
  // ---------------------------------------------------------------------------
  test('/brand dashboard provides entry link that navigates directly to editable Brand profile', async ({
    page,
  }) => {
    const brandUser = await provisionUser('BRAND');

    await page.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, brandUser.token);

    // 1. Visit /brand dashboard
    await page.goto('/brand', { waitUntil: 'networkidle' });

    // 2. Click "Edit Brand Profile" action button
    const editProfileLink = page.locator('[data-testid="edit-brand-profile-link"]');
    await expect(editProfileLink).toBeVisible();
    await editProfileLink.click();

    // 3. Verify navigated to /profiles/me?tab=brand and form is displayed
    await page.waitForURL('**/profiles/me?tab=brand');
    await expect(page.locator('[data-testid="brand-company-name-input"]')).toBeVisible({
      timeout: 10000,
    });
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 3: ROLE GATING (CREATOR-ONLY CANNOT ACCESS BRAND EDITING)
  // ---------------------------------------------------------------------------
  test('Creator-only user does not see Brand tab and cannot edit Brand profile', async ({
    page,
  }) => {
    const creatorUser = await provisionUser('CREATOR');

    await page.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, creatorUser.token);

    // 1. Open /profiles/me
    await page.goto('/profiles/me', { waitUntil: 'networkidle' });

    // Brand tab should NOT be rendered in TabsList for Creator user
    const brandTab = page.locator('[data-testid="tab-brand"]');
    await expect(brandTab).toHaveCount(0);

    // 2. Attempt direct deep-link to ?tab=brand
    await page.goto('/profiles/me?tab=brand', { waitUntil: 'networkidle' });

    // Role-gated explanatory state appears, no form inputs visible
    await expect(page.locator('[data-testid="brand-profile-role-gate"]')).toBeVisible();
    await expect(page.locator('[data-testid="brand-company-name-input"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="save-brand-profile-button"]')).toHaveCount(0);
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 4: CLIENT-SIDE VALIDATION & INPUT PRESERVATION
  // ---------------------------------------------------------------------------
  test('Invalid website URL is rejected and user inputs are preserved', async ({ page }) => {
    const brandUser = await provisionUser('BRAND');

    await page.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, brandUser.token);

    await page.goto('/profiles/me?tab=brand', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="brand-company-name-input"]')).toBeVisible();

    // Fill valid company name but invalid insecure HTTP website URL
    await page.fill('[data-testid="brand-company-name-input"]', 'Secure Holdings Corp');
    await page.fill('[data-testid="brand-website-url-input"]', 'http://insecure-site.com');

    // Validation feedback is visible
    await expect(page.locator('text=Must use a secure HTTPS protocol')).toBeVisible();

    // Save button must remain disabled
    const saveButton = page.locator('[data-testid="save-brand-profile-button"]');
    await expect(saveButton).toBeDisabled();

    // Form input remains preserved
    await expect(page.locator('[data-testid="brand-company-name-input"]')).toHaveValue(
      'Secure Holdings Corp',
    );
    await expect(page.locator('[data-testid="brand-website-url-input"]')).toHaveValue(
      'http://insecure-site.com',
    );
  });

  // ---------------------------------------------------------------------------
  // SCENARIO 5: MULTI-USER ISOLATION (CUSTOMER A VS CUSTOMER B)
  // ---------------------------------------------------------------------------
  test('Customer B cannot mutate Customer A profile and sees isolated data', async ({
    page,
    request,
  }) => {
    const customerA = await provisionUser('BRAND');
    const customerB = await provisionUser('BRAND');

    // Setup Customer A profile via API
    await request.put('http://localhost:3000/api/v1/profiles/brand', {
      headers: {
        Authorization: `Bearer ${customerA.token}`,
        'Content-Type': 'application/json',
      },
      data: {
        companyName: 'Customer A Enterprise Org',
        industry: 'Robotics',
        visibility: 'PRIVATE',
      },
    });

    // Customer B logs in via browser
    await page.addInitScript((token) => {
      window.localStorage.setItem('creatorconnect_test_access_token', token);
      (window as any).__TEST_ACCESS_TOKEN__ = token;
    }, customerB.token);

    await page.goto('/profiles/me?tab=brand', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="brand-company-name-input"]')).toBeVisible();

    // Customer B form must NOT show Customer A data
    await expect(page.locator('[data-testid="brand-company-name-input"]')).not.toHaveValue(
      'Customer A Enterprise Org',
    );

    // Customer B saves their distinct profile
    await page.fill('[data-testid="brand-company-name-input"]', 'Customer B Independent Org');
    await page.click('[data-testid="save-brand-profile-button"]');
    await expect(page.locator('[data-testid="brand-profile-save-success"]')).toBeVisible();

    // Verify Customer A in PostgreSQL remains intact
    const rowA = await prisma.brandProfile.findUnique({
      where: { userId: customerA.userId },
    });
    expect(rowA!.companyName).toBe('Customer A Enterprise Org');

    // Verify Customer B in PostgreSQL has their own record
    const rowB = await prisma.brandProfile.findUnique({
      where: { userId: customerB.userId },
    });
    expect(rowB!.companyName).toBe('Customer B Independent Org');
    expect(rowB!.userId).toBe(customerB.userId);
  });
});
