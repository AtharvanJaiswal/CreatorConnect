import { test, expect, type Page } from '@playwright/test';
import { getPrismaClient, type PrismaClient, RoleType } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { createTestJwt } from '../fixtures/auth-test-helper.js';

const API_BASE = process.env.E2E_API_URL || 'http://127.0.0.1:3000';

async function injectBrowserToken(page: Page, token: string): Promise<void> {
  await page.addInitScript((tok) => {
    window.localStorage.setItem('creatorconnect_test_access_token', tok);
    (window as { __TEST_ACCESS_TOKEN__?: string }).__TEST_ACCESS_TOKEN__ = tok;
  }, token);
}

test.describe('CreatorConnect Admin Console — Phase 4.1.2 Real-Backend E2E Suite', () => {
  test.describe.configure({ mode: 'serial' });

  let prisma: PrismaClient;
  const runSuffix = Date.now().toString(36);

  // Fixture user IDs
  const superAdminId = generateUuidV7();
  const userAdminId = generateUuidV7();
  const supportAdminId = generateUuidV7();
  const financeAdminAId = generateUuidV7();
  const financeAdminBId = generateUuidV7();
  const bareAdminId = generateUuidV7();
  const creatorId = generateUuidV7();
  const brandId = generateUuidV7();

  const superAdminSub = `e2e-sb-super-${runSuffix}`;
  const userAdminSub = `e2e-sb-useradm-${runSuffix}`;
  const supportAdminSub = `e2e-sb-support-${runSuffix}`;
  const financeASub = `e2e-sb-fina-${runSuffix}`;
  const financeBSub = `e2e-sb-finb-${runSuffix}`;
  const bareAdminSub = `e2e-sb-bare-${runSuffix}`;
  const creatorSub = `e2e-sb-creator-${runSuffix}`;

  // Fixture domain entity IDs
  const brandProfileId = generateUuidV7();
  const assignmentId = generateUuidV7();
  const applicationId = generateUuidV7();
  const projectId = generateUuidV7();
  const paymentIntentId = generateUuidV7();
  const disputeId = generateUuidV7();
  const secretAuditLogId = generateUuidV7();
  const tieAuditLogAId = generateUuidV7();
  const tieAuditLogBId = generateUuidV7();
  const fundingTxId = generateUuidV7();
  const escrowAccountId = generateUuidV7();

  const createdRefundIds: string[] = [];
  let superAdminToken = '';
  let userAdminToken = '';
  let supportAdminToken = '';
  let financeAdminAToken = '';
  let financeAdminBToken = '';
  let bareAdminToken = '';
  let creatorToken = '';
  let expiredToken = '';

  const createdUserPairs = [
    { id: superAdminId, sub: superAdminSub },
    { id: userAdminId, sub: userAdminSub },
    { id: supportAdminId, sub: supportAdminSub },
    { id: financeAdminAId, sub: financeASub },
    { id: financeAdminBId, sub: financeBSub },
    { id: bareAdminId, sub: bareAdminSub },
    { id: creatorId, sub: creatorSub },
    { id: brandId, sub: `e2e-sb-brand-${runSuffix}` },
  ];

  test.beforeAll(async () => {
    prisma = getPrismaClient();

    const [
      adminGlobalRole,
      creatorGlobalRole,
      brandGlobalRole,
      superAdminRole,
      userAdminRole,
      supportAdminRole,
      financeAdminRole,
      category,
    ] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { name: RoleType.ADMIN } }),
      prisma.role.findUniqueOrThrow({ where: { name: RoleType.CREATOR } }),
      prisma.role.findUniqueOrThrow({ where: { name: RoleType.BRAND } }),
      prisma.adminRole.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } }),
      prisma.adminRole.findUniqueOrThrow({ where: { name: 'USER_ADMIN' } }),
      prisma.adminRole.findUniqueOrThrow({ where: { name: 'SUPPORT_ADMIN' } }),
      prisma.adminRole.findUniqueOrThrow({ where: { name: 'FINANCE_ADMIN' } }),
      prisma.category.findFirstOrThrow(),
    ]);

    const usersToCreate = [
      {
        id: superAdminId,
        supabaseAuthId: superAdminSub,
        email: `e2e-super-${runSuffix}@creatorconnect.test`,
        firstName: 'E2E',
        lastName: 'SuperAdmin',
        roleId: adminGlobalRole.id,
        adminRoleId: superAdminRole.id,
      },
      {
        id: userAdminId,
        supabaseAuthId: userAdminSub,
        email: `e2e-useradm-${runSuffix}@creatorconnect.test`,
        firstName: 'E2E',
        lastName: 'UserAdmin',
        roleId: adminGlobalRole.id,
        adminRoleId: userAdminRole.id,
      },
      {
        id: supportAdminId,
        supabaseAuthId: supportAdminSub,
        email: `e2e-support-${runSuffix}@creatorconnect.test`,
        firstName: 'E2E',
        lastName: 'SupportAdmin',
        roleId: adminGlobalRole.id,
        adminRoleId: supportAdminRole.id,
      },
      {
        id: financeAdminAId,
        supabaseAuthId: financeASub,
        email: `e2e-fina-${runSuffix}@creatorconnect.test`,
        firstName: 'E2E',
        lastName: 'FinanceA',
        roleId: adminGlobalRole.id,
        adminRoleId: financeAdminRole.id,
      },
      {
        id: financeAdminBId,
        supabaseAuthId: financeBSub,
        email: `e2e-finb-${runSuffix}@creatorconnect.test`,
        firstName: 'E2E',
        lastName: 'FinanceB',
        roleId: adminGlobalRole.id,
        adminRoleId: financeAdminRole.id,
      },
      {
        id: bareAdminId,
        supabaseAuthId: bareAdminSub,
        email: `e2e-bare-${runSuffix}@creatorconnect.test`,
        firstName: 'E2E',
        lastName: 'BareAdmin',
        roleId: adminGlobalRole.id,
        adminRoleId: null,
      },
      {
        id: creatorId,
        supabaseAuthId: creatorSub,
        email: `e2e-creator-${runSuffix}@creatorconnect.test`,
        firstName: 'E2E',
        lastName: 'Creator',
        roleId: creatorGlobalRole.id,
        adminRoleId: null,
      },
      {
        id: brandId,
        supabaseAuthId: `e2e-sb-brand-${runSuffix}`,
        email: `e2e-brand-${runSuffix}@creatorconnect.test`,
        firstName: 'E2E',
        lastName: 'Brand',
        roleId: brandGlobalRole.id,
        adminRoleId: null,
      },
    ];

    for (const u of usersToCreate) {
      await prisma.user.create({
        data: {
          id: u.id,
          supabaseAuthId: u.supabaseAuthId,
          email: u.email,
          firstName: u.firstName,
          lastName: u.lastName,
          status: 'ACTIVE',
          userRoles: {
            create: {
              id: generateUuidV7(),
              roleId: u.roleId,
            },
          },
          ...(u.adminRoleId
            ? {
                adminUserRoles: {
                  create: {
                    id: generateUuidV7(),
                    roleId: u.adminRoleId,
                  },
                },
              }
            : {}),
        },
      });
    }

    await prisma.brandProfile.create({
      data: {
        id: brandProfileId,
        userId: brandId,
        companyName: `E2E Brand ${runSuffix}`,
      },
    });

    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: brandProfileId,
        categoryId: category.id,
        title: `E2E Campaign ${runSuffix}`,
        description: 'E2E arbitration & financial refund fixture assignment.',
        budgetType: 'FIXED',
        budgetMin: 6_000_000,
        budgetMax: 6_000_000,
        currency: 'INR',
        deadline: new Date(Date.now() + 7 * 86_400_000),
        status: 'PUBLISHED',
      },
    });

    await prisma.application.create({
      data: {
        id: applicationId,
        assignmentId,
        applicantId: creatorId,
        coverLetter: 'E2E fixture application cover letter.',
        proposedRate: 6_000_000,
        currency: 'INR',
        status: 'ACCEPTED',
      },
    });

    await prisma.project.create({
      data: {
        id: projectId,
        assignmentId,
        applicationId,
        clientId: brandId,
        talentId: creatorId,
        title: `E2E Project ${runSuffix}`,
        totalAmount: 6_000_000,
        currency: 'INR',
        status: 'DISPUTED',
      },
    });

    await prisma.paymentIntent.create({
      data: {
        id: paymentIntentId,
        projectId,
        clientId: brandId,
        amount: 6_000_000, // 60,000 INR >= 50,000 INR dual-approval threshold
        platformFee: 600_000,
        currency: 'INR',
        status: 'SUCCEEDED',
        provider: 'SANDBOX_MOCK',
        providerPaymentId: `pay_e2e_${runSuffix}`,
      },
    });

    // Fund isolated project escrow ledger cleanly with balanced entries against processor clearing & platform fee
    await prisma.$transaction(async (tx) => {
      const clearingAcc = await tx.ledgerAccount.upsert({
        where: { code: 'ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK' },
        update: { balance: { increment: BigInt(6_000_000) } },
        create: {
          id: generateUuidV7(),
          code: 'ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK',
          name: 'Processor Clearing SANDBOX_MOCK',
          type: 'ASSET',
          currency: 'INR',
          balance: BigInt(6_000_000),
        },
      });
      const feeAcc = await tx.ledgerAccount.upsert({
        where: { code: 'REVENUE:PLATFORM_FEE' },
        update: { balance: { increment: BigInt(600_000) } },
        create: {
          id: generateUuidV7(),
          code: 'REVENUE:PLATFORM_FEE',
          name: 'Platform Fee Revenue',
          type: 'REVENUE',
          currency: 'INR',
          balance: BigInt(600_000),
        },
      });
      const escrowAcc = await tx.ledgerAccount.create({
        data: {
          id: escrowAccountId,
          code: `LIABILITIES:ESCROW_HOLDING:${projectId}`,
          name: `Escrow Holding ${projectId}`,
          type: 'LIABILITY',
          currency: 'INR',
          projectId,
          balance: BigInt(5_400_000),
          isActive: true,
        },
      });

      await tx.ledgerTransaction.create({
        data: {
          id: fundingTxId,
          paymentIntentId,
          type: 'E2E_ESCROW_CAPTURE',
          description: 'Balanced escrow funding for E2E four-eyes refund test',
          entries: {
            create: [
              {
                id: generateUuidV7(),
                accountId: clearingAcc.id,
                direction: 'DEBIT',
                amount: 6_000_000,
                currency: 'INR',
              },
              {
                id: generateUuidV7(),
                accountId: escrowAcc.id,
                direction: 'CREDIT',
                amount: 5_400_000,
                currency: 'INR',
              },
              {
                id: generateUuidV7(),
                accountId: feeAcc.id,
                direction: 'CREDIT',
                amount: 600_000,
                currency: 'INR',
              },
            ],
          },
        },
      });
    });

    await prisma.dispute.create({
      data: {
        id: disputeId,
        projectId,
        openedById: brandId,
        reason: 'DELIVERABLE_POOR_QUALITY',
        description: `E2E_DISPUTE_${runSuffix} requires genuine admin arbitration`,
        status: 'OPEN',
      },
    });

    const tieTimestamp = new Date(Date.now() + 1_000);
    await prisma.auditLog.createMany({
      data: [
        {
          id: secretAuditLogId,
          userId: userAdminId,
          action: `E2E_REDACT_PROBE_${runSuffix}`,
          entity: 'User',
          entityId: creatorId,
          ipAddress: '127.0.0.1',
          metadata: {
            reason: `E2E redaction probe ${runSuffix}`,
            password: 'raw-db-secret-password-999',
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.leakSig',
            secretKey: ['sk', 'live', 'must_be_redacted_123'].join('_'),
            safeContext: 'visible-audit-field',
          },
          createdAt: new Date(Date.now() + 2_000),
        },
        {
          id: tieAuditLogAId,
          userId: userAdminId,
          action: `E2E_TIE_PROBE_${runSuffix}`,
          entity: 'User',
          entityId: brandId,
          ipAddress: '127.0.0.1',
          metadata: { reason: 'Tie-break item A' },
          createdAt: tieTimestamp,
        },
        {
          id: tieAuditLogBId,
          userId: userAdminId,
          action: `E2E_TIE_PROBE_${runSuffix}`,
          entity: 'User',
          entityId: brandId,
          ipAddress: '127.0.0.1',
          metadata: { reason: 'Tie-break item B' },
          createdAt: tieTimestamp,
        },
      ],
    });

    [
      superAdminToken,
      userAdminToken,
      supportAdminToken,
      financeAdminAToken,
      financeAdminBToken,
      bareAdminToken,
      creatorToken,
      expiredToken,
    ] = await Promise.all([
      createTestJwt({
        sub: superAdminSub,
        email: `e2e-super-${runSuffix}@creatorconnect.test`,
      }),
      createTestJwt({
        sub: userAdminSub,
        email: `e2e-useradm-${runSuffix}@creatorconnect.test`,
      }),
      createTestJwt({
        sub: supportAdminSub,
        email: `e2e-support-${runSuffix}@creatorconnect.test`,
      }),
      createTestJwt({
        sub: financeASub,
        email: `e2e-fina-${runSuffix}@creatorconnect.test`,
      }),
      createTestJwt({
        sub: financeBSub,
        email: `e2e-finb-${runSuffix}@creatorconnect.test`,
      }),
      createTestJwt({
        sub: bareAdminSub,
        email: `e2e-bare-${runSuffix}@creatorconnect.test`,
      }),
      createTestJwt({
        sub: creatorSub,
        email: `e2e-creator-${runSuffix}@creatorconnect.test`,
      }),
      createTestJwt({
        sub: userAdminSub,
        email: `e2e-useradm-${runSuffix}@creatorconnect.test`,
        exp: Math.floor(Date.now() / 1000) - 120,
      }),
    ]);
  });

  test.afterAll(async () => {
    const userIds = createdUserPairs.map((u) => u.id);

    // Clean up outbox events (including any legal holds created during Journey 7)
    const creatorHoldLogs = await prisma.auditLog.findMany({
      where: { entityId: creatorId, action: { startsWith: 'LEGAL_HOLD_' } },
      select: { metadata: true },
    });
    const holdIds = creatorHoldLogs
      .map((l) => (l.metadata as Record<string, unknown> | null)?.holdId)
      .filter((v): v is string => typeof v === 'string');

    await prisma.outboxEvent.deleteMany({
      where: {
        OR: [
          { aggregateId: disputeId },
          { aggregateId: fundingTxId },
          ...(holdIds.length > 0 ? [{ aggregateId: { in: holdIds } }] : []),
        ],
      },
    });

    const ledgerTxs = await prisma.ledgerTransaction.findMany({
      where: { paymentIntentId },
      select: {
        id: true,
        entries: {
          select: {
            accountId: true,
            direction: true,
            amount: true,
            account: { select: { code: true, type: true } },
          },
        },
      },
    });

    // If funding tx + no refund tx completed (e.g. partial test abort), net remaining delta back cleanly
    for (const txRow of ledgerTxs) {
      if (txRow.id === fundingTxId || txRow.entries.length > 0) {
        await prisma.ledgerEntry.deleteMany({ where: { transactionId: txRow.id } });
        for (const e of txRow.entries) {
          if (
            e.account.code === 'ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK' ||
            e.account.code === 'REVENUE:PLATFORM_FEE'
          ) {
            const isNormalDebit = e.account.type === 'ASSET' || e.account.type === 'EXPENSE';
            const appliedDelta =
              (isNormalDebit && e.direction === 'DEBIT') ||
              (!isNormalDebit && e.direction === 'CREDIT')
                ? BigInt(e.amount)
                : BigInt(-e.amount);
            await prisma.ledgerAccount.update({
              where: { id: e.accountId },
              data: { balance: { decrement: appliedDelta } },
            });
          }
        }
      }
    }
    await prisma.ledgerTransaction.deleteMany({ where: { paymentIntentId } });
    await prisma.ledgerAccount.deleteMany({ where: { id: escrowAccountId } });

    await prisma.adminActionApproval.deleteMany({
      where: {
        OR: [
          { requestedById: { in: userIds } },
          ...(createdRefundIds.length > 0 ? [{ targetEntityId: { in: createdRefundIds } }] : []),
        ],
      },
    });
    await prisma.refund.deleteMany({ where: { paymentIntentId } });
    await prisma.paymentIntent.deleteMany({ where: { id: paymentIntentId } });
    await prisma.disputeStatusHistory.deleteMany({ where: { disputeId } });
    await prisma.dispute.deleteMany({ where: { id: disputeId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.application.deleteMany({ where: { id: applicationId } });
    await prisma.assignment.deleteMany({ where: { id: assignmentId } });
    await prisma.brandProfile.deleteMany({ where: { id: brandProfileId } });

    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { id: { in: [secretAuditLogId, tieAuditLogAId, tieAuditLogBId] } },
          { userId: { in: userIds } },
          { entityId: { in: [disputeId, creatorId] } },
        ],
      },
    });

    await prisma.adminUserRole.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    await prisma.$disconnect();
  });

  test.beforeEach(({}, testInfo) => {
    testInfo.setTimeout(90_000);
  });

  test.describe('Journey 1: Authentication, Session Invariants & Non-Admin Barriers', () => {
    test('1.1 Root path / redirects to /admin/login and login renders hardened form only', async ({
      page,
    }) => {
      const res = await page.goto('/', { waitUntil: 'domcontentloaded' });
      expect(res).not.toBeNull();
      expect(res!.status()).toBeLessThan(400);
      await page.waitForURL('**/admin/login');
      await expect(page.getByRole('heading', { name: 'Admin Web Console' })).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.getByRole('button', { name: /Authenticate & Enter/i })).toBeVisible();
      await expect(page.locator('text=Sign up as Creator')).toHaveCount(0);
      await expect(page.locator('text=Sign up as Brand')).toHaveCount(0);
    });

    test('1.2 Unauthenticated browser & API access are strictly denied', async ({
      page,
      request,
    }) => {
      const apiRes = await request.get(`${API_BASE}/api/v1/admin/audit`);
      expect(apiRes.status()).toBe(401);

      await page.goto('/admin/dashboard', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Restricted Admin Console' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Sign In to Admin Console' })).toBeVisible();
    });

    test('1.3 Expired token fails cleanly (401) and non-admin CREATOR is blocked from console & API', async ({
      browser,
      request,
    }) => {
      const expiredApi = await request.get(`${API_BASE}/api/v1/admin/audit`, {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      expect(expiredApi.status()).toBe(401);

      const creatorApi = await request.get(`${API_BASE}/api/v1/admin/audit`, {
        headers: { Authorization: `Bearer ${creatorToken}` },
      });
      expect(creatorApi.status()).toBe(403);

      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await injectBrowserToken(page, creatorToken);
      await page.goto('/admin/audit', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Restricted Admin Console' })).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Immutable Platform Audit Trail' }),
      ).toHaveCount(0);
      await ctx.close();
    });

    test('1.4 Authorized USER_ADMIN authenticates and loads /admin/dashboard without fallback errors', async ({
      page,
    }) => {
      await injectBrowserToken(page, userAdminToken);
      await page.goto('/admin/dashboard', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Restricted Admin Console' })).toHaveCount(0);
      await expect(page.getByText('Admin Console').first()).toBeVisible();
    });
  });

  test.describe('Journey 2: Admin Navigation, Legacy Interception & 404 Handling', () => {
    const validAdminRoutes = [
      '/admin/dashboard',
      '/admin/users',
      '/admin/verification',
      '/admin/assignments',
      '/admin/disputes',
      '/admin/payments',
      '/admin/refunds',
      '/admin/reconciliation',
      '/admin/moderation',
      '/admin/reviews',
      '/admin/support',
      '/admin/config',
      '/admin/notifications',
      '/admin/jobs',
      '/admin/admins',
      '/admin/roles',
      '/admin/audit',
      '/admin/referrals',
      '/admin/lifecycle',
    ];

    test('2.1 Legacy consumer routes redirect server-side to /admin/login', async ({ page }) => {
      for (const path of ['/creator', '/brand', '/discovery', '/onboarding']) {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        expect(page.url()).toContain('/admin/login');
      }
    });

    test('2.2 Unknown admin route returns HTTP 404 and all 19 canonical admin pages render without runtime errors', async ({
      page,
    }) => {
      test.setTimeout(180_000);
      const pageErrors: string[] = [];
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const missingRes = await page.goto('/admin/nonexistent-route-phase412', {
        waitUntil: 'domcontentloaded',
      });
      expect(missingRes).not.toBeNull();
      expect(missingRes!.status()).toBe(404);

      await injectBrowserToken(page, superAdminToken);
      for (const route of validAdminRoutes) {
        const res = await page.goto(route, { waitUntil: 'networkidle' });
        expect(res, `Route ${route} failed to return HTTP response`).not.toBeNull();
        expect(res!.status(), `Route ${route} returned unexpected HTTP ${res!.status()}`).toBe(200);
        await expect(page.getByText('Verifying administrative access...')).toHaveCount(0);
        await expect(page.getByText('Restricted Admin Console')).toHaveCount(0);
      }
      expect(pageErrors, `Uncaught page errors observed: ${pageErrors.join(' | ')}`).toEqual([]);
    });
  });

  test.describe('Journey 3: Audit Trail Real Data, Keyset Pagination, Filters & Sanitization', () => {
    test('3.1 Loads real backend rows, inspects sanitized DB secret metadata, and paginates deterministically without duplicates', async ({
      page,
    }) => {
      await injectBrowserToken(page, userAdminToken);
      const page1RespPromise = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/admin/audit') &&
          !r.url().includes('cursor=') &&
          r.request().method() === 'GET',
      );
      await page.goto('/admin/audit', { waitUntil: 'domcontentloaded' });
      const page1Resp = await page1RespPromise;
      expect(page1Resp.status()).toBe(200);
      const page1Json = (await page1Resp.json()) as {
        items: Array<{ id: string }>;
        nextCursor: string | null;
        hasMore: boolean;
      };
      expect(page1Json.items.length).toBeGreaterThan(0);

      await expect(
        page.getByRole('heading', { name: 'Immutable Platform Audit Trail' }),
      ).toBeVisible();
      await expect(page.getByText('Loading records...')).toHaveCount(0);

      // Seeded secret probe row is at the top of page 1
      await expect(page.getByText(`E2E_REDACT_PROBE_${runSuffix}`)).toBeVisible();

      // Open Metadata Inspector modal and verify backend redaction of password, JWT accessToken, and secretKey
      await page
        .getByRole('button', { name: `Inspect metadata for audit event ${secretAuditLogId}` })
        .click();
      await expect(page.getByText('Sanitized Audit Event Details')).toBeVisible();
      const preText = await page.locator('pre').textContent();
      expect(preText).toContain('[REDACTED]');
      expect(preText).toContain('visible-audit-field');
      expect(preText).not.toContain('raw-db-secret-password-999');
      expect(preText).not.toContain(['sk', 'live', 'must_be_redacted_123'].join('_'));
      expect(preText).not.toContain('leakSig');
      await page.getByRole('button', { name: 'Close', exact: true }).click();

      // Keyset pagination check: Next -> Page 2, verify API response + rendered DOM have zero overlap with Page 1
      const page1Ids = page1Json.items.map((item) => item.id);

      const nextBtn = page.getByRole('button', { name: 'Next', exact: true });
      await expect(nextBtn).toBeEnabled();
      const page2RespPromise = page.waitForResponse(
        (r) => r.url().includes('/api/v1/admin/audit') && r.url().includes('cursor='),
      );
      await nextBtn.click();
      const page2Resp = await page2RespPromise;
      expect(page2Resp.status()).toBe(200);
      const page2Json = (await page2Resp.json()) as { items: Array<{ id: string }> };

      await expect(page.getByText('Loading records...')).toHaveCount(0);
      await expect(page.getByText(/Page 2\s*·/)).toBeVisible();
      expect(page2Json.items.length).toBeGreaterThan(0);
      await expect(page.locator('tbody tr')).toHaveCount(page2Json.items.length);

      for (const item of page2Json.items) {
        expect(page1Ids).not.toContain(item.id);
      }

      // Navigate back to Page 1 via Previous
      const prevRespPromise = page.waitForResponse((r) => r.url().includes('/api/v1/admin/audit'));
      await page.getByRole('button', { name: 'Previous', exact: true }).click();
      await prevRespPromise;
      await expect(page.getByText('Loading records...')).toHaveCount(0);
      await expect(page.getByText(/Page 1\s*·/)).toBeVisible();
      await expect(page.getByText(`E2E_REDACT_PROBE_${runSuffix}`)).toBeVisible();
    });

    test('3.2 Filters by exact action (tie-break items), rejects inverted dates client-side, and shows honest empty & error states', async ({
      page,
    }) => {
      await injectBrowserToken(page, userAdminToken);
      await page.goto('/admin/audit', { waitUntil: 'networkidle' });

      // Exact Action filter matches both tie-break items
      await page.getByPlaceholder('e.g. USER_SUSPENDED').fill(`E2E_TIE_PROBE_${runSuffix}`);
      await expect(page.getByText('Tie-break item A')).toBeVisible();
      await expect(page.getByText('Tie-break item B')).toBeVisible();
      await expect(page.getByText(/Showing 2 records/)).toBeVisible();

      // Empty result state
      await page
        .getByPlaceholder('Action, entity, or target ID...')
        .fill(`NO_SUCH_MATCH_${runSuffix}`);
      await expect(
        page.getByText('No administrative audit events recorded for the selected criteria.'),
      ).toBeVisible();

      // Clear filters restores rows cleanly before testing inverted date guard
      const clearRespPromise = page.waitForResponse(
        (r) =>
          r.url().includes('/api/v1/admin/audit') &&
          !r.url().includes('search=') &&
          !r.url().includes('action='),
      );
      await page.getByRole('button', { name: 'Clear Filters' }).click();
      await clearRespPromise;
      await expect(page.getByText('Loading records...')).toHaveCount(0);
      await expect(page.getByText(`E2E_REDACT_PROBE_${runSuffix}`)).toBeVisible();

      // Inverted date range validation stops cleanly before sending an inverted API request
      const dateInputs = page.locator('input[type="date"]');
      const singleStartRespPromise = page.waitForResponse(
        (r) => r.url().includes('/api/v1/admin/audit') && r.url().includes('startDate='),
      );
      await dateInputs.nth(0).fill('2026-12-20');
      await singleStartRespPromise;

      let invertedCalls = 0;
      await page.route('**/api/v1/admin/audit**', (route) => {
        invertedCalls += 1;
        return route.continue();
      });

      await dateInputs.nth(1).fill('2026-12-10');
      await expect(page.locator('main [role="alert"]')).toContainText(
        'Start date cannot be later than end date.',
      );
      expect(invertedCalls).toBe(0);

      // Clear filters and verify 500 error shows alert + Retry Connection with zero mock rows
      await page.unroute('**/api/v1/admin/audit**');
      await page.getByRole('button', { name: 'Clear Filters' }).click();
      await expect(page.getByText(`E2E_REDACT_PROBE_${runSuffix}`)).toBeVisible();

      await page.route('**/api/v1/admin/audit**', (route) =>
        route.fulfill({
          status: 500,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'https://api.creatorconnect.com/errors/internal-server-error',
            title: 'Internal Server Error',
            status: 500,
            detail: 'Simulated backend failure for audit screen test.',
          }),
        }),
      );
      await page.getByRole('button', { name: 'Refresh' }).click();
      await expect(page.locator('main [role="alert"]')).toContainText(
        'Simulated backend failure for audit screen test.',
      );
      await expect(page.getByRole('button', { name: 'Retry Connection' })).toBeVisible();
      await expect(
        page.getByText('No administrative audit events recorded for the selected criteria.'),
      ).toBeVisible();
    });

    test('3.3 SUPPORT_ADMIN lacking audit.read is denied by backend (403) and UI renders error without fake data', async ({
      browser,
      request,
    }) => {
      const apiRes = await request.get(`${API_BASE}/api/v1/admin/audit`, {
        headers: { Authorization: `Bearer ${supportAdminToken}` },
      });
      expect(apiRes.status()).toBe(403);

      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await injectBrowserToken(page, supportAdminToken);
      await page.goto('/admin/audit', { waitUntil: 'networkidle' });

      // Client does not render leaked data; backend 403 Problem Details detail is shown
      await expect(page.locator('main [role="alert"]')).toContainText('audit.read');
      await expect(page.getByText(`E2E_REDACT_PROBE_${runSuffix}`)).toHaveCount(0);
      await ctx.close();
    });
  });

  test.describe('Journey 4: Disputes Arbitration & Dual-Approval Financial Refunds', () => {
    test('4.1 Non-admin cannot resolve dispute (403) and Finance/Super admin adjudicates real OPEN dispute via UI', async ({
      page,
      request,
    }) => {
      // Direct API negative check: creator participant cannot resolve their own dispute
      const forbiddenResolve = await request.post(
        `${API_BASE}/api/v1/disputes/${disputeId}/resolve`,
        {
          headers: { Authorization: `Bearer ${creatorToken}` },
          data: {
            resolution: 'RESOLVED_FOR_CREATOR',
            resolutionReason: 'Unauthorized self-resolution attempt by participant',
          },
        },
      );
      expect(forbiddenResolve.status()).toBe(403);

      // Admin UI flow
      await injectBrowserToken(page, superAdminToken);
      await page.goto('/admin/disputes', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: /Contract Disputes/i })).toBeVisible();

      const targetRow = page.locator('tr', { hasText: `E2E_DISPUTE_${runSuffix}` });
      await expect(targetRow).toBeVisible();
      await targetRow.getByRole('button', { name: 'Adjudicate' }).click();

      await expect(page.getByText('Adjudicate Escrow Dispute')).toBeVisible();

      // Client validation guard rejects reason shorter than 5 characters
      await page.locator('#dispute-resolution-reason').fill('abc');
      await page.getByRole('button', { name: 'Confirm Adjudication' }).click();
      await expect(page.locator('main [role="alert"]')).toContainText('5 characters');

      // Submit valid adjudication rationale -> persisted in PostgreSQL
      await page
        .locator('#dispute-resolution-reason')
        .fill(`E2E approved deliverable milestone quality after reviewing project ${projectId}.`);
      await page.getByRole('button', { name: 'Confirm Adjudication' }).click();

      await expect(page.getByText('Adjudicate Escrow Dispute')).toHaveCount(0);
      await expect(targetRow).toContainText('RESOLVED_FOR_CREATOR');
      await expect(targetRow).toContainText('Finalized');

      const dbDispute = await prisma.dispute.findUniqueOrThrow({ where: { id: disputeId } });
      expect(dbDispute.status).toBe('RESOLVED_FOR_CREATOR');
      expect(dbDispute.resolvedById).toBe(superAdminId);
    });

    test('4.2 High-value refund (>= 50,000 INR) enforces Four-Eyes principle (blocks self-approval, allows distinct FINANCE_ADMIN)', async ({
      request,
    }) => {
      // USER_ADMIN lacks payments.refund.request -> 403
      const deniedReq = await request.post(`${API_BASE}/api/v1/admin/refunds`, {
        headers: { Authorization: `Bearer ${userAdminToken}` },
        data: {
          paymentIntentId,
          amountMinor: 5_000_000,
          reason: 'DISPUTE_RESOLUTION',
          notes: 'Unauthorized refund test by user admin',
        },
      });
      expect(deniedReq.status()).toBe(403);

      // Finance Admin A creates high-value refund (>= 5,000,000 paisa -> 50,000 INR)
      const createRes = await request.post(`${API_BASE}/api/v1/admin/refunds`, {
        headers: { Authorization: `Bearer ${financeAdminAToken}` },
        data: {
          paymentIntentId,
          amountMinor: 6_000_000,
          reason: 'DISPUTE_RESOLUTION',
          notes: 'E2E dual-approval test for high-value escrow reversal',
        },
      });
      expect(createRes.status()).toBe(201);
      const createdRefund = await createRes.json();
      createdRefundIds.push(createdRefund.id);
      expect(createdRefund.requiresDualApproval).toBe(true);
      expect(createdRefund.status).toBe('REQUESTED');

      // Anti-conflict-of-interest: Finance Admin A cannot approve their own refund request
      const selfApproveRes = await request.post(
        `${API_BASE}/api/v1/admin/refunds/${createdRefund.id}/approve`,
        {
          headers: { Authorization: `Bearer ${financeAdminAToken}` },
          data: { reason: 'Attempting invalid self-approval' },
        },
      );
      expect(selfApproveRes.status()).toBe(403);
      const selfApproveBody = await selfApproveRes.json();
      expect(selfApproveBody.code).toBe('CONFLICT_OF_INTEREST');

      // Second distinct Finance Admin B approves -> status SUCCEEDED and ledger remains balanced
      const peerApproveRes = await request.post(
        `${API_BASE}/api/v1/admin/refunds/${createdRefund.id}/approve`,
        {
          headers: { Authorization: `Bearer ${financeAdminBToken}` },
          data: { reason: 'Peer second-admin review completed and approved' },
        },
      );
      expect(peerApproveRes.status()).toBe(200);
      const approvedRefund = await peerApproveRes.json();
      expect(approvedRefund.status).toBe('SUCCEEDED');

      const reconRes = await request.get(`${API_BASE}/api/v1/admin/reconciliation`, {
        headers: { Authorization: `Bearer ${financeAdminBToken}` },
      });
      expect(reconRes.status()).toBe(200);
      const recon = await reconRes.json();
      expect(recon.status).toBe('BALANCED');
      expect(recon.netDifferenceMinor).toBe('0');
    });
  });

  test.describe('Journey 5: Planned Referrals Honesty & Safety', () => {
    test('5.1 /admin/referrals shows Planned Feature notice without mock figures or referral API calls', async ({
      page,
    }) => {
      const referralRequests: string[] = [];
      page.on('request', (req) => {
        if (req.url().includes('/referrals')) {
          referralRequests.push(req.url());
        }
      });

      await injectBrowserToken(page, superAdminToken);
      await page.goto('/admin/referrals', { waitUntil: 'networkidle' });

      await expect(page.getByText('Planned Feature')).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Backend Implementation Not Yet Available' }),
      ).toBeVisible();
      await expect(page.locator('table')).toHaveCount(0);

      const mainText = (await page.locator('main').textContent()) || '';
      expect(mainText).not.toMatch(/\$[\d,]+|₹[\d,]+|\d+(\.\d+)?%/);
      // Only the Next.js page navigation itself is expected; zero /api/v1/* referral calls
      expect(referralRequests.filter((u) => u.includes('/api/'))).toEqual([]);
    });
  });

  test.describe('Journey 6: RBAC Enforcement & Last Super Admin Lockout Prevention', () => {
    test('6.1 Enforces permission boundaries across admin modules and blocks revoking last active SUPER_ADMIN', async ({
      request,
    }) => {
      // USER_ADMIN cannot manage RBAC roles -> 403
      const userAdminRbac = await request.get(`${API_BASE}/api/v1/admin/roles`, {
        headers: { Authorization: `Bearer ${userAdminToken}` },
      });
      expect(userAdminRbac.status()).toBe(403);

      // SUPPORT_ADMIN cannot revoke SUPER_ADMIN -> 403
      const supportRevoke = await request.post(`${API_BASE}/api/v1/admin/admins/revoke`, {
        headers: { Authorization: `Bearer ${supportAdminToken}` },
        data: { userId: superAdminId, roleName: 'SUPER_ADMIN' },
      });
      expect(supportRevoke.status()).toBe(403);

      // Last remaining SUPER_ADMIN cannot revoke the final SUPER_ADMIN role -> 400 LAST_SUPER_ADMIN_LOCKOUT_PREVENTED
      const lockoutRes = await request.post(`${API_BASE}/api/v1/admin/admins/revoke`, {
        headers: { Authorization: `Bearer ${superAdminToken}` },
        data: { userId: superAdminId, roleName: 'SUPER_ADMIN' },
      });
      expect(lockoutRes.status()).toBe(400);
      const lockoutBody = await lockoutRes.json();
      expect(lockoutBody.code).toBe('LAST_SUPER_ADMIN_LOCKOUT_PREVENTED');
    });
  });

  test.describe('Journey 7: Phase 4.2 Production Readiness Remediation UI & Security Checks', () => {
    test('7.1 Enforces per-request cryptographic CSP nonces with zero unsafe-inline scripts, zero Google Fonts, and zero CSP errors', async ({
      page,
    }) => {
      const externalFontRequests: string[] = [];
      const cspConsoleErrors: string[] = [];
      const observedNonces: string[] = [];

      page.on('request', (req) => {
        if (req.url().includes('fonts.googleapis.com') || req.url().includes('fonts.gstatic.com')) {
          externalFontRequests.push(req.url());
        }
      });
      page.on('console', (msg) => {
        if (
          msg.type() === 'error' &&
          msg.text().toLowerCase().includes('content security policy')
        ) {
          cspConsoleErrors.push(msg.text());
        }
      });

      await injectBrowserToken(page, superAdminToken);
      for (const route of [
        '/admin/login',
        '/admin/dashboard',
        '/admin/audit',
        '/admin/refunds',
        '/admin/reconciliation',
        '/admin/lifecycle',
      ]) {
        const response = await page.goto(route, { waitUntil: 'networkidle' });
        expect(response).not.toBeNull();
        const csp = response!.headers()['content-security-policy'] || '';
        const cacheControl = response!.headers()['cache-control'] || '';
        const scriptSrc =
          csp
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith('script-src')) || '';

        expect(cacheControl).toContain('no-store');
        expect(scriptSrc).toContain("'strict-dynamic'");
        expect(scriptSrc).not.toContain("'unsafe-inline'");
        expect(scriptSrc).not.toContain("'unsafe-eval'");

        const nonceMatch = scriptSrc.match(/'nonce-([^']+)'/);
        expect(nonceMatch?.[1]).toBeTruthy();
        observedNonces.push(nonceMatch![1]!);
      }

      // Verify per-request uniqueness across navigations and Next.js nonce attachment in DOM
      expect(new Set(observedNonces).size).toBe(observedNonces.length);
      const noncedScriptsCount = await page.locator('script[nonce]').count();
      expect(noncedScriptsCount).toBeGreaterThan(0);

      expect(externalFontRequests).toEqual([]);
      expect(cspConsoleErrors).toEqual([]);
    });

    test('7.2 Fail-closed barrier blocks bare ADMIN users without assigned admin roles or permissions', async ({
      browser,
    }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await injectBrowserToken(page, bareAdminToken);

      await page.goto('/admin/users', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Restricted Admin Console' })).toBeVisible();
      await expect(page.getByText('Zero-trust access denied')).toBeVisible();
      await expect(page.locator('table')).toHaveCount(0);

      await page.goto('/admin/disputes', { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: 'Restricted Admin Console' })).toBeVisible();
      await ctx.close();
    });

    test('7.3 Unauthorized staff see explicit HTTP 403 error UI with zero mock fallback data', async ({
      browser,
    }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await injectBrowserToken(page, supportAdminToken);

      await page.goto('/admin/refunds', { waitUntil: 'networkidle' });
      await expect(page.locator('main [role="alert"]')).toContainText('HTTP 403');
      await expect(page.locator('main [role="alert"]')).toContainText('Access Denied');
      const refundsText = (await page.locator('main').textContent()) || '';
      expect(refundsText).not.toContain('ref-01');

      await page.goto('/admin/reconciliation', { waitUntil: 'networkidle' });
      await expect(page.locator('main [role="alert"]')).toContainText('HTTP 403');
      const reconText = (await page.locator('main').textContent()) || '';
      expect(reconText).not.toContain('482500000');
      expect(reconText).not.toContain('Perfect Mathematical Parity');
      await ctx.close();
    });

    test('7.4 Live reconciliation and refund pages render real canonical backend records via UI', async ({
      browser,
    }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await injectBrowserToken(page, financeAdminAToken);

      await page.goto('/admin/reconciliation', { waitUntil: 'networkidle' });
      await expect(
        page.getByRole('heading', { name: 'All Ledger Accounts in Perfect Mathematical Parity' }),
      ).toBeVisible();
      await expect(page.getByText('Status: BALANCED')).toBeVisible();

      await page.goto('/admin/refunds', { waitUntil: 'networkidle' });
      await expect(page.getByText(paymentIntentId).first()).toBeVisible();
      await expect(page.getByText('SUCCEEDED').first()).toBeVisible();
      await ctx.close();
    });

    test('7.5 Lifecycle screen manages verified per-user legal holds while keeping unapproved workflows BLOCKED', async ({
      browser,
    }) => {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await injectBrowserToken(page, userAdminToken);

      await page.goto('/admin/lifecycle', { waitUntil: 'networkidle' });
      await expect(page.getByText('Stage A Hard-Stop Active')).toBeVisible();
      await expect(page.getByText('0/12 LDR Decisions Approved')).toBeVisible();
      await expect(page.getByText('BLOCKED').first()).toBeVisible();

      // Lookup legal holds for fixture creatorId
      await page
        .getByPlaceholder('Enter User UUID to inspect or place legal holds...')
        .fill(creatorId);
      await page.getByRole('button', { name: 'Inspect Legal Holds' }).click();
      await expect(page.getByText(`No legal holds recorded for user ${creatorId}.`)).toBeVisible();

      // Apply hold via modal UI
      await page.getByRole('button', { name: 'Apply Legal Hold' }).click();
      await page
        .getByPlaceholder('e.g. CASE-2026-041 or DISPUTE-992')
        .fill(`CASE-E2E-${runSuffix}`);
      await page
        .getByPlaceholder('Document the dispute, audit, or legal preservation basis...')
        .fill('Phase 4.2 E2E litigation hold verification.');
      await page.getByRole('button', { name: 'Confirm Legal Hold' }).click();

      await expect(page.getByText(`CASE-E2E-${runSuffix}`).first()).toBeVisible();
      await expect(page.getByText('ACTIVE').first()).toBeVisible();

      // Release hold via modal UI
      await page.getByRole('button', { name: 'Release Hold' }).first().click();
      await page
        .getByPlaceholder('Confirm dispute settlement, audit closure, or release authorization...')
        .fill('Phase 4.2 E2E hold released.');
      await page.getByRole('button', { name: 'Confirm Hold Release' }).click();

      await expect(page.getByText('RELEASED').first()).toBeVisible();
      await ctx.close();
    });

    test('7.6 Responsive mobile drawer and zero horizontal overflow across 320px, 360px, 390px, and 430px viewports', async ({
      browser,
    }) => {
      const mobileViewports = [
        { width: 320, height: 568 },
        { width: 360, height: 780 },
        { width: 390, height: 844 },
        { width: 430, height: 932 },
      ];
      const adminRoutes = [
        '/admin/login',
        '/admin/dashboard',
        '/admin/users',
        '/admin/audit',
        '/admin/refunds',
        '/admin/lifecycle',
      ];

      for (const vp of mobileViewports) {
        const ctx = await browser.newContext({ viewport: vp });
        const page = await ctx.newPage();
        await injectBrowserToken(page, superAdminToken);

        for (const route of adminRoutes) {
          await page.goto(route, { waitUntil: 'networkidle' });
          const layout = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          }));
          expect(layout.scrollWidth).toBeLessThanOrEqual(layout.innerWidth);
        }

        await ctx.close();
      }

      // Interactive mobile drawer keyboard Escape, focus restoration, and navigation check (390x844)
      const drawerCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const drawerPage = await drawerCtx.newPage();
      await injectBrowserToken(drawerPage, superAdminToken);
      await drawerPage.goto('/admin/dashboard', { waitUntil: 'networkidle' });

      const menuBtn = drawerPage.getByRole('button', { name: 'Open navigation menu' });
      await expect(menuBtn).toBeVisible();
      await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');

      await menuBtn.click();
      const drawer = drawerPage.locator('#admin-mobile-drawer');
      await expect(drawer).toBeVisible();
      await expect(menuBtn).toHaveAttribute('aria-expanded', 'true');

      await drawerPage.keyboard.press('Escape');
      await expect(drawer).toBeHidden();
      await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
      await expect(menuBtn).toBeFocused();

      // Re-open and navigate to Refunds via mobile drawer link
      await menuBtn.click();
      await expect(drawer).toBeVisible();
      await drawer.getByRole('link', { name: 'Dual-Approval Refunds' }).click();
      await drawerPage.waitForURL('**/admin/refunds');
      await expect(drawer).toBeHidden();
      await expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
      await drawerCtx.close();
    });

    test('7.7 /admin/refunds layout stability (CLS <= 0.05) and 404/error CSP nonce header enforcement', async ({
      browser,
    }, testInfo) => {
      // 1. Verify /admin/refunds layout shift stays well under Good threshold (<= 0.05)
      if (testInfo.project.name === 'chromium') {
        const clsCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const clsPage = await clsCtx.newPage();
        await clsPage.addInitScript(() => {
          (window as unknown as { __e2eCls: number }).__e2eCls = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries() as Array<
              PerformanceEntry & { value?: number; hadRecentInput?: boolean }
            >) {
              if (!entry.hadRecentInput) {
                (window as unknown as { __e2eCls: number }).__e2eCls += entry.value || 0;
              }
            }
          }).observe({ type: 'layout-shift', buffered: true });
        });
        await injectBrowserToken(clsPage, financeAdminAToken);
        await clsPage.goto('/admin/refunds', { waitUntil: 'networkidle' });
        await clsPage.waitForTimeout(400);

        await clsPage.getByRole('button', { name: 'Initiate Refund' }).click();
        await clsPage.keyboard.press('Escape');
        await clsPage.getByRole('button', { name: 'Refresh' }).click();
        await clsPage.waitForLoadState('networkidle');

        const measuredCls = await clsPage.evaluate(
          () => (window as unknown as { __e2eCls: number }).__e2eCls,
        );
        expect(measuredCls).toBeLessThanOrEqual(0.05);
        await clsCtx.close();
      }

      // 2. Verify non-existent admin route enforces fresh cryptographic CSP nonces with 0 CSP console errors
      const cspCtx = await browser.newContext();
      const cspPage = await cspCtx.newPage();
      const cspErrors: string[] = [];
      cspPage.on('console', (msg) => {
        if (
          msg.type() === 'error' &&
          msg.text().toLowerCase().includes('content security policy')
        ) {
          cspErrors.push(msg.text());
        }
      });

      await injectBrowserToken(cspPage, superAdminToken);
      const res404 = await cspPage.goto('/admin/non-existent-route-csp-check', {
        waitUntil: 'networkidle',
      });
      expect(res404).not.toBeNull();
      expect(res404!.status()).toBe(404);
      const cspHeader = res404!.headers()['content-security-policy'] || '';
      const scriptSrc =
        cspHeader
          .split(';')
          .map((p) => p.trim())
          .find((p) => p.startsWith('script-src')) || '';
      expect(scriptSrc).toContain("'strict-dynamic'");
      expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/]+={0,2}'/);
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(scriptSrc).not.toContain("'unsafe-eval'");
      expect(res404!.headers()['cache-control'] || '').toContain('no-store');
      expect(cspErrors).toEqual([]);
      await cspCtx.close();
    });
  });
});
