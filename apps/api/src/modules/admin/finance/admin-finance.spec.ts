import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../app.js';
import { defaultJwtVerifier } from '../../../services/jwt-verifier.js';
import {
  createTestJwt,
  createTestKeySet,
} from '../../../../../../tests/fixtures/auth-test-helper.js';
import {
  getPrismaClient,
  UserStatus,
  RoleType,
  PaymentStatus,
  PaymentProvider,
  ProjectStatus,
  LedgerAccountType,
  LedgerEntryDirection,
} from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';

describe('Admin Finance & Escrow Administration (Milestone 4)', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let superAdminUser: { id: string; email: string; sub: string };
  let superAdminToken: string;

  let financeAdminUser1: { id: string; email: string; sub: string };
  let financeAdminToken1: string;

  let financeAdminUser2: { id: string; email: string; sub: string };
  let financeAdminToken2: string;

  let regularUser: { id: string; email: string; sub: string };
  let regularToken: string;

  let clientUser: { id: string; email: string; sub: string; profileId: string };
  let talentUser: { id: string; email: string; sub: string };
  let testProject: { id: string; assignmentId: string; applicationId: string };
  let testPaymentIntent: { id: string; amount: number };

  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const createdApplicationIds: string[] = [];
  const createdPaymentIntentIds: string[] = [];
  const createdLedgerAccountIds: string[] = [];
  const createdLedgerTransactionIds: string[] = [];

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    const adminGlobalRole = await prisma.role.findUniqueOrThrow({
      where: { name: RoleType.ADMIN },
    });
    const clientGlobalRole = await prisma.role.findUniqueOrThrow({
      where: { name: RoleType.BRAND },
    });
    const creatorGlobalRole = await prisma.role.findUniqueOrThrow({
      where: { name: RoleType.CREATOR },
    });
    const superAdminRole = await prisma.adminRole.findUniqueOrThrow({
      where: { name: 'SUPER_ADMIN' },
    });
    const financeAdminRole = await prisma.adminRole.findUniqueOrThrow({
      where: { name: 'FINANCE_ADMIN' },
    });

    const ts = Date.now();

    // 1. Super Admin
    superAdminUser = {
      id: generateUuidV7(),
      email: `fin_sa_${ts}@test.com`,
      sub: `sub_fin_sa_${ts}`,
    };
    createdUserIds.push(superAdminUser.id);

    await prisma.user.create({
      data: {
        id: superAdminUser.id,
        supabaseAuthId: superAdminUser.sub,
        email: superAdminUser.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: superAdminUser.id, roleId: adminGlobalRole.id },
    });
    await prisma.adminUserRole.create({
      data: { id: generateUuidV7(), userId: superAdminUser.id, roleId: superAdminRole.id },
    });
    superAdminToken = await createTestJwt({ sub: superAdminUser.sub, email: superAdminUser.email });

    // 2. Finance Admin 1 (Requester)
    financeAdminUser1 = {
      id: generateUuidV7(),
      email: `fin_fa1_${ts}@test.com`,
      sub: `sub_fin_fa1_${ts}`,
    };
    createdUserIds.push(financeAdminUser1.id);

    await prisma.user.create({
      data: {
        id: financeAdminUser1.id,
        supabaseAuthId: financeAdminUser1.sub,
        email: financeAdminUser1.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: financeAdminUser1.id, roleId: adminGlobalRole.id },
    });
    await prisma.adminUserRole.create({
      data: { id: generateUuidV7(), userId: financeAdminUser1.id, roleId: financeAdminRole.id },
    });
    financeAdminToken1 = await createTestJwt({
      sub: financeAdminUser1.sub,
      email: financeAdminUser1.email,
    });

    // 3. Finance Admin 2 (Approver)
    financeAdminUser2 = {
      id: generateUuidV7(),
      email: `fin_fa2_${ts}@test.com`,
      sub: `sub_fin_fa2_${ts}`,
    };
    createdUserIds.push(financeAdminUser2.id);

    await prisma.user.create({
      data: {
        id: financeAdminUser2.id,
        supabaseAuthId: financeAdminUser2.sub,
        email: financeAdminUser2.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: financeAdminUser2.id, roleId: adminGlobalRole.id },
    });
    await prisma.adminUserRole.create({
      data: { id: generateUuidV7(), userId: financeAdminUser2.id, roleId: financeAdminRole.id },
    });
    financeAdminToken2 = await createTestJwt({
      sub: financeAdminUser2.sub,
      email: financeAdminUser2.email,
    });

    // 4. Regular User (No Admin Permissions)
    regularUser = {
      id: generateUuidV7(),
      email: `fin_reg_${ts}@test.com`,
      sub: `sub_fin_reg_${ts}`,
    };
    createdUserIds.push(regularUser.id);

    await prisma.user.create({
      data: {
        id: regularUser.id,
        supabaseAuthId: regularUser.sub,
        email: regularUser.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: regularUser.id, roleId: creatorGlobalRole.id },
    });
    regularToken = await createTestJwt({ sub: regularUser.sub, email: regularUser.email });

    // 5. Client & Talent Users
    const clUserId = generateUuidV7();
    const clProfileId = generateUuidV7();
    clientUser = {
      id: clUserId,
      email: `fin_client_${ts}@test.com`,
      sub: `sub_fin_client_${ts}`,
      profileId: clProfileId,
    };
    createdUserIds.push(clUserId);

    await prisma.user.create({
      data: {
        id: clUserId,
        supabaseAuthId: clientUser.sub,
        email: clientUser.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: clUserId, roleId: clientGlobalRole.id },
    });
    await prisma.brandProfile.create({
      data: {
        id: clProfileId,
        userId: clUserId,
        companyName: 'Fintech Brand Inc',
      },
    });

    const tUserId = generateUuidV7();
    talentUser = {
      id: tUserId,
      email: `fin_talent_${ts}@test.com`,
      sub: `sub_fin_talent_${ts}`,
    };
    createdUserIds.push(tUserId);

    await prisma.user.create({
      data: {
        id: tUserId,
        supabaseAuthId: talentUser.sub,
        email: talentUser.email,
        status: UserStatus.ACTIVE,
      },
    });
    await prisma.userRole.create({
      data: { id: generateUuidV7(), userId: tUserId, roleId: creatorGlobalRole.id },
    });

    // 6. Test Assignment & Project
    const assignmentId = generateUuidV7();
    const applicationId = generateUuidV7();
    const projectId = generateUuidV7();
    createdAssignmentIds.push(assignmentId);
    createdApplicationIds.push(applicationId);
    createdProjectIds.push(projectId);

    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: clProfileId,
        title: 'Fintech Explainer Video',
        description: 'Complete video production',
        budgetMin: 10000000, // 100,000 INR
        budgetMax: 10000000,
        currency: 'INR',
        deadline: new Date(Date.now() + 86400000 * 30),
      },
    });

    await prisma.application.create({
      data: {
        id: applicationId,
        assignmentId,
        applicantId: tUserId,
        coverLetter: 'Expert explainer video creator',
        proposedRate: 10000000,
        currency: 'INR',
      },
    });

    await prisma.project.create({
      data: {
        id: projectId,
        assignmentId,
        applicationId,
        clientId: clUserId,
        talentId: tUserId,
        title: 'Fintech Explainer Video Project',
        totalAmount: 10000000,
        currency: 'INR',
        status: ProjectStatus.IN_PROGRESS,
      },
    });

    testProject = { id: projectId, assignmentId, applicationId };

    // 7. Payment Intent (100,000 INR = 10,000,000 paisa)
    const paymentIntentId = generateUuidV7();
    createdPaymentIntentIds.push(paymentIntentId);

    await prisma.paymentIntent.create({
      data: {
        id: paymentIntentId,
        projectId,
        clientId: clUserId,
        amount: 10000000,
        currency: 'INR',
        platformFee: 500000,
        status: PaymentStatus.SUCCEEDED,
        provider: PaymentProvider.STRIPE,
        providerOrderId: `pi_${ts}`,
        providerPaymentId: `ch_${ts}`,
      },
    });

    testPaymentIntent = { id: paymentIntentId, amount: 10000000 };

    // 8. Balanced Ledger Setup via LedgerService
    const { ledgerService } = await import('../../payments/ledger/ledger.service.js');
    const depositTx = await ledgerService.postTransaction({
      paymentIntentId,
      type: 'ESCROW_DEPOSIT',
      description: 'Client deposit into escrow',
      entries: [
        {
          accountCode: 'ASSETS:PROCESSOR_CLEARING:STRIPE',
          accountName: 'Stripe Settlement Clearing',
          accountType: 'ASSET',
          direction: 'DEBIT',
          amount: 10000000,
          currency: 'INR',
        },
        {
          accountCode: `LIABILITIES:ESCROW_HOLDING:${projectId}`,
          accountName: `Project Escrow Holding for ${projectId}`,
          accountType: 'LIABILITY',
          direction: 'CREDIT',
          amount: 9500000,
          currency: 'INR',
          projectId,
        },
        {
          accountCode: 'REVENUE:PLATFORM_FEE',
          accountName: 'CreatorConnect Platform Take Rate',
          accountType: 'REVENUE',
          direction: 'CREDIT',
          amount: 500000,
          currency: 'INR',
        },
      ],
    });
    createdLedgerTransactionIds.push(depositTx.id);
  });

  afterAll(async () => {
    for (const piId of createdPaymentIntentIds) {
      await prisma.outboxEvent.deleteMany({
        where: { payload: { path: ['paymentIntentId'], equals: piId } },
      });
      const txs = await prisma.ledgerTransaction.findMany({ where: { paymentIntentId: piId } });
      for (const t of txs) {
        await prisma.ledgerEntry.deleteMany({ where: { transactionId: t.id } });
      }
      await prisma.ledgerTransaction.deleteMany({ where: { paymentIntentId: piId } });
      await prisma.adminActionApproval.deleteMany({ where: { targetEntity: 'Refund' } });
      await prisma.refund.deleteMany({ where: { paymentIntentId: piId } });
      await prisma.paymentIntent.deleteMany({ where: { id: piId } });
    }
    for (const txId of createdLedgerTransactionIds) {
      await prisma.ledgerEntry.deleteMany({ where: { transactionId: txId } });
      await prisma.ledgerTransaction.deleteMany({ where: { id: txId } });
    }
    for (const accId of createdLedgerAccountIds) {
      await prisma.ledgerAccount.deleteMany({ where: { id: accId } });
    }
    if (testProject?.id) {
      await prisma.ledgerAccount.deleteMany({
        where: { code: `LIABILITIES:ESCROW_HOLDING:${testProject.id}` },
      });
    }
    // Re-sync shared accounts to ensure zero residual balance discrepancies
    for (const code of ['REVENUE:PLATFORM_FEE', 'ASSETS:PROCESSOR_CLEARING:STRIPE']) {
      const acc = await prisma.ledgerAccount.findUnique({
        where: { code },
        include: { entries: true },
      });
      if (acc) {
        const debits = acc.entries
          .filter((e) => e.direction === 'DEBIT')
          .reduce((s, e) => s + BigInt(e.amount), 0n);
        const credits = acc.entries
          .filter((e) => e.direction === 'CREDIT')
          .reduce((s, e) => s + BigInt(e.amount), 0n);
        const expected =
          acc.type === 'ASSET' || acc.type === 'EXPENSE' ? debits - credits : credits - debits;
        await prisma.ledgerAccount.update({ where: { id: acc.id }, data: { balance: expected } });
      }
    }
    for (const pid of createdProjectIds) {
      await prisma.project.deleteMany({ where: { id: pid } });
    }
    for (const appId of createdApplicationIds) {
      await prisma.application.deleteMany({ where: { id: appId } });
    }
    for (const asId of createdAssignmentIds) {
      await prisma.assignment.deleteMany({ where: { id: asId } });
    }
    for (const uid of createdUserIds) {
      await prisma.auditLog.deleteMany({ where: { userId: uid } });
      await prisma.brandProfile.deleteMany({ where: { userId: uid } });
      await prisma.adminUserRole.deleteMany({ where: { userId: uid } });
      await prisma.userRole.deleteMany({ where: { userId: uid } });
      await prisma.user.deleteMany({ where: { id: uid } });
    }
    await app.close();
  });

  // ==============================================================================
  // Payment Intention Endpoints
  // ==============================================================================

  it('GET /api/v1/admin/payments - should deny unauthenticated requests with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/payments',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/v1/admin/payments - should deny unauthorized user with 403', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/payments',
      headers: { authorization: `Bearer ${regularToken}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/v1/admin/payments - should list payments with volume aggregate', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/payments?status=SUCCEEDED&clientId=${clientUser.id}`,
      headers: { authorization: `Bearer ${financeAdminToken1}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items).toBeDefined();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.totalVolumeMinor).toBeDefined();
    const found = body.items.find((p: any) => p.id === testPaymentIntent.id);
    expect(found).toBeDefined();
    expect(found.amountMinor).toBe('10000000');
  });

  it('GET /api/v1/admin/payments/:id - should return payment detail with ledger transactions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/payments/${testPaymentIntent.id}`,
      headers: { authorization: `Bearer ${financeAdminToken1}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe(testPaymentIntent.id);
    expect(body.client.id).toBe(clientUser.id);
    expect(body.ledgerTransactions).toBeDefined();
    expect(body.ledgerTransactions.length).toBeGreaterThanOrEqual(1);
    expect(body.ledgerTransactions[0].entries.length).toBeGreaterThanOrEqual(2);
  });

  // ==============================================================================
  // Refund Administration & Dual Approval
  // ==============================================================================

  it('POST /api/v1/admin/refunds - small refund auto-approved when requester has approve permission', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/refunds',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        paymentIntentId: testPaymentIntent.id,
        amountMinor: 50000, // 500 INR (< 50,000 threshold)
        reason: 'ADMIN_ADJUSTMENT',
        notes: 'Goodwill administrative refund for minor service delay',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('SUCCEEDED');
    expect(body.requiresDualApproval).toBe(false);
    expect(body.amountMinor).toBe('50000');

    // Verify AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: body.id, action: 'REFUND_PROCESSED' },
    });
    expect(audit).toBeDefined();
    expect(audit?.userId).toBe(superAdminUser.id);

    // Verify PaymentIntent was updated to PARTIALLY_REFUNDED
    const piAfter = await prisma.paymentIntent.findUnique({ where: { id: testPaymentIntent.id } });
    expect(piAfter?.status).toBe('PARTIALLY_REFUNDED');

    // Verify Ledger transaction was posted for this refund
    const refundTx = await prisma.ledgerTransaction.findFirst({
      where: { paymentIntentId: testPaymentIntent.id, type: 'PAYMENT_REFUND_ADMIN' },
      include: { entries: true },
    });
    expect(refundTx).toBeDefined();
    expect(refundTx?.entries.length).toBe(3);
  });

  it('POST /api/v1/admin/refunds - high-value refund requires dual approval and creates PENDING approval', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/refunds',
      headers: { authorization: `Bearer ${financeAdminToken1}` },
      payload: {
        paymentIntentId: testPaymentIntent.id,
        amountMinor: 6000000, // 60,000 INR (>= 50,000 threshold)
        reason: 'CLIENT_REQUESTED',
        notes: 'High value client refund requested due to scope reduction',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.status).toBe('REQUESTED');
    expect(body.requiresDualApproval).toBe(true);
    expect(body.approvalStatus).toBe('PENDING');
    expect(body.approvalId).toBeDefined();

    // Verify approval record in DB
    const approval = await prisma.adminActionApproval.findUnique({
      where: { id: body.approvalId },
    });
    expect(approval).toBeDefined();
    expect(approval?.status).toBe('PENDING');
    expect(approval?.requestedById).toBe(financeAdminUser1.id);
  });

  it('POST /api/v1/admin/refunds/:id/approve - MUST REJECT SELF-APPROVAL with 403 Conflict Of Interest', async () => {
    // List pending refunds to get the high-value refund ID
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/refunds?paymentIntentId=${testPaymentIntent.id}&status=REQUESTED`,
      headers: { authorization: `Bearer ${financeAdminToken1}` },
    });
    const pendingRefund = listRes.json().items[0];
    expect(pendingRefund).toBeDefined();

    // financeAdminUser1 tries to approve their OWN refund request
    const selfApproveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/refunds/${pendingRefund.id}/approve`,
      headers: { authorization: `Bearer ${financeAdminToken1}` },
      payload: {
        reason: 'Attempting to self-approve my own refund',
      },
    });

    expect(selfApproveRes.statusCode).toBe(403);
    const err = selfApproveRes.json();
    expect(err.code).toBe('CONFLICT_OF_INTEREST');
    expect(err.detail).toContain('Anti-conflict-of-interest');
  });

  it('POST /api/v1/admin/refunds/:id/approve - allows independent second administrator to approve', async () => {
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/refunds?paymentIntentId=${testPaymentIntent.id}&status=REQUESTED`,
      headers: { authorization: `Bearer ${financeAdminToken2}` },
    });
    const pendingRefund = listRes.json().items[0];

    // financeAdminUser2 approves financeAdminUser1's request
    const approveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/refunds/${pendingRefund.id}/approve`,
      headers: { authorization: `Bearer ${financeAdminToken2}` },
      payload: {
        reason: 'Reviewed supporting client ticket and scope reduction documentation. Approved.',
      },
    });

    expect(approveRes.statusCode).toBe(200);
    const body = approveRes.json();
    expect(body.status).toBe('SUCCEEDED');
    expect(body.approvalStatus).toBe('APPROVED');

    // Verify DB
    const approvalInDb = await prisma.adminActionApproval.findUnique({
      where: { id: pendingRefund.approvalId },
    });
    expect(approvalInDb?.status).toBe('APPROVED');
    expect(approvalInDb?.decidedById).toBe(financeAdminUser2.id);

    // Verify AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: pendingRefund.id, action: 'REFUND_APPROVED' },
    });
    expect(audit).toBeDefined();
    expect(audit?.userId).toBe(financeAdminUser2.id);

    // Verify PaymentIntent remains PARTIALLY_REFUNDED and second ledger transaction created
    const piAfterDual = await prisma.paymentIntent.findUnique({
      where: { id: testPaymentIntent.id },
    });
    expect(piAfterDual?.status).toBe('PARTIALLY_REFUNDED');

    const allRefundTxs = await prisma.ledgerTransaction.findMany({
      where: { paymentIntentId: testPaymentIntent.id, type: 'PAYMENT_REFUND_ADMIN' },
    });
    expect(allRefundTxs.length).toBe(2);
  });

  // ==============================================================================
  // Ledger Reconciliation
  // ==============================================================================

  it('GET /api/v1/admin/reconciliation - verifies balanced double-entry ledger state', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/reconciliation',
      headers: { authorization: `Bearer ${financeAdminToken1}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('BALANCED');
    expect(body.totalAccounts).toBeGreaterThanOrEqual(2);
    expect(body.netDifferenceMinor).toBe('0');
    expect(body.unbalancedAccounts.length).toBe(0);

    // Verify AuditLog
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'RECONCILIATION_AUDIT_PERFORMED', userId: financeAdminUser1.id },
    });
    expect(audit).toBeDefined();
  });
});
