import crypto from 'node:crypto';
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';
import { ledgerService } from '../payments/ledger/ledger.service.js';
import { getPaymentProvider } from '../payments/providers/index.js';

describe('Phase 6 Increment 5: Final Hardening, Financial Reconciliation & Release Integration', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let clientUserId: string;
  let clientToken: string;
  let clientBrandProfileId: string;

  let talentUserId: string;
  let talentToken: string;

  let adminUserId: string;
  let adminToken: string;

  let bystanderUserId: string;
  let bystanderToken: string;

  async function createAcceptedApplication(title = 'Phase 6 Integration Task') {
    const assignId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: assignId,
        brandId: clientBrandProfileId,
        title,
        description: 'End-to-end integration test assignment',
        budgetMin: 50000,
        budgetMax: 100000,
        deadline: new Date(Date.now() + 86400000 * 30),
        status: 'IN_PROGRESS',
      },
    });

    const appId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: appId,
        assignmentId: assignId,
        applicantId: talentUserId,
        coverLetter: 'Production Release Candidate Integration Specialist',
        proposedRate: 100000,
        status: 'ACCEPTED',
      },
    });

    return { assignmentId: assignId, applicationId: appId };
  }

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    // 1. Client User (BRAND)
    clientUserId = generateUuidV7();
    clientBrandProfileId = generateUuidV7();
    clientToken = await createTestJwt({
      sub: `sub_e2e_client_${generateUuidV7().replace(/-/g, '')}`,
      email: `e2e_client_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedClient: any = await defaultJwtVerifier.verifyToken(clientToken);
    await prisma.user.create({
      data: {
        id: clientUserId,
        supabaseAuthId: decodedClient.sub,
        email: decodedClient.email,
        firstName: 'E2E',
        lastName: 'Client',
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
            id: clientBrandProfileId,
            companyName: 'E2E Release Brand Ltd',
            websiteUrl: 'https://release.brand.test',
          },
        },
      },
    });

    // 2. Talent User (CREATOR)
    talentUserId = generateUuidV7();
    talentToken = await createTestJwt({
      sub: `sub_e2e_talent_${generateUuidV7().replace(/-/g, '')}`,
      email: `e2e_talent_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedTalent: any = await defaultJwtVerifier.verifyToken(talentToken);
    await prisma.user.create({
      data: {
        id: talentUserId,
        supabaseAuthId: decodedTalent.sub,
        email: decodedTalent.email,
        firstName: 'E2E',
        lastName: 'Talent',
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
        creatorProfile: {
          create: {
            id: generateUuidV7(),
            bio: 'Senior Release Integration Creator',
          },
        },
      },
    });

    // 3. Admin User (ADMIN)
    adminUserId = generateUuidV7();
    adminToken = await createTestJwt({
      sub: `sub_e2e_admin_${generateUuidV7().replace(/-/g, '')}`,
      email: `e2e_admin_${generateUuidV7().replace(/-/g, '')}@test.com`,
      roles: ['ADMIN'],
    });
    const decodedAdmin: any = await defaultJwtVerifier.verifyToken(adminToken);
    await prisma.user.create({
      data: {
        id: adminUserId,
        supabaseAuthId: decodedAdmin.sub,
        email: decodedAdmin.email,
        firstName: 'E2E',
        lastName: 'Administrator',
        status: 'ACTIVE',
        userRoles: {
          create: {
            id: generateUuidV7(),
            role: {
              connectOrCreate: {
                where: { name: 'ADMIN' },
                create: { id: generateUuidV7(), name: 'ADMIN' },
              },
            },
          },
        },
      },
    });

    // 4. Bystander User
    bystanderUserId = generateUuidV7();
    bystanderToken = await createTestJwt({
      sub: `sub_e2e_bystander_${generateUuidV7().replace(/-/g, '')}`,
      email: `e2e_bystander_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedBystander: any = await defaultJwtVerifier.verifyToken(bystanderToken);
    await prisma.user.create({
      data: {
        id: bystanderUserId,
        supabaseAuthId: decodedBystander.sub,
        email: decodedBystander.email,
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

  // ============================================================================
  // Section A: Financial Correctness & Reconciliation Hardening
  // ============================================================================

  it('verifies dynamic transaction-specific fee & allocation rather than assumed 90/10 split', async () => {
    const { assignmentId, applicationId } = await createAcceptedApplication(
      'Custom 5% Fee Allocation Task',
    );
    const customProjectId = generateUuidV7();

    await prisma.project.create({
      data: {
        id: customProjectId,
        assignmentId,
        applicationId,
        clientId: clientUserId,
        talentId: talentUserId,
        title: 'Custom Fee Allocation Contract',
        totalAmount: 100000,
        currency: 'INR',
        status: 'IN_PROGRESS',
        version: 1,
      },
    });

    // Create payment intent with 5% platform fee (5000 paisa out of 100000)
    const customIntentId = generateUuidV7();
    await prisma.paymentIntent.create({
      data: {
        id: customIntentId,
        projectId: customProjectId,
        clientId: clientUserId,
        amount: 100000,
        currency: 'INR',
        platformFee: 5000, // Explicitly 5%, not 10%!
        status: 'SUCCEEDED',
        provider: 'SANDBOX_MOCK',
        providerPaymentId: `pay_custom_${generateUuidV7().replace(/-/g, '')}`,
        version: 1,
      },
    });

    // Credit escrow account with net amount (95000) and platform fee (5000)
    await ledgerService.postTransaction({
      paymentIntentId: customIntentId,
      type: 'PAYMENT_CAPTURED',
      description: 'Pre-seeded custom 5% fee transaction',
      entries: [
        {
          accountCode: 'ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK',
          accountType: 'ASSET',
          direction: 'DEBIT',
          amount: 100000,
          currency: 'INR',
        },
        {
          accountCode: `LIABILITIES:ESCROW_HOLDING:${customProjectId}`,
          accountType: 'LIABILITY',
          direction: 'CREDIT',
          amount: 95000,
          currency: 'INR',
          projectId: customProjectId,
        },
        {
          accountCode: 'REVENUE:PLATFORM_FEE',
          accountType: 'REVENUE',
          direction: 'CREDIT',
          amount: 5000,
          currency: 'INR',
        },
      ],
    });

    // Initial Escrow Balance should be 95000
    const escrowInitial = await ledgerService.getProjectEscrowBalance(customProjectId);
    expect(escrowInitial).toBe(95000);

    // Issue partial refund of 40000 (40%)
    // Dynamic fee reversal = Math.floor(40000 * 5000 / 100000) = 2000 (not 4000 as under 10% hardcoding!)
    // Escrow reversal = 40000 - 2000 = 38000
    const refundRes = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/intents/${customIntentId}/refunds`,
      headers: {
        authorization: `Bearer ${clientToken}`,
      },
      payload: {
        amount: 40000,
        reason: 'CLIENT_REQUESTED',
        notes: 'Partial milestone scope reduction under 5% fee tier',
        idempotencyKey: `idemp_custom_fee_${generateUuidV7()}`,
      },
    });

    expect(refundRes.statusCode).toBe(201);
    const refundBody = refundRes.json();
    expect(refundBody.status).toBe('SUCCEEDED');
    expect(refundBody.amount).toBe(40000);

    // Inspect Escrow Balance after refund: 95000 - 38000 = 57000
    const escrowRemaining = await ledgerService.getProjectEscrowBalance(customProjectId);
    expect(escrowRemaining).toBe(57000);

    // Verify Ledger Transaction entries for the refund are balanced
    const ledgerTx = await prisma.ledgerTransaction.findFirst({
      where: { paymentIntentId: customIntentId, type: 'PAYMENT_REFUNDED' },
      include: { entries: { include: { account: true } } },
    });
    expect(ledgerTx).toBeDefined();

    const debits = ledgerTx!.entries.filter((e) => e.direction === 'DEBIT');
    const credits = ledgerTx!.entries.filter((e) => e.direction === 'CREDIT');
    const totalDebits = debits.reduce((sum, e) => sum + e.amount, 0);
    const totalCredits = credits.reduce((sum, e) => sum + e.amount, 0);

    expect(totalDebits).toBe(40000);
    expect(totalCredits).toBe(40000);

    const feeDebit = debits.find((e) => e.account.code === 'REVENUE:PLATFORM_FEE');
    const escrowDebit = debits.find(
      (e) => e.account.code === `LIABILITIES:ESCROW_HOLDING:${customProjectId}`,
    );
    expect(feeDebit?.amount).toBe(2000);
    expect(escrowDebit?.amount).toBe(38000);
  });

  it('rejects concurrent or excess refunds exceeding total capturable amount with 400', async () => {
    const { assignmentId, applicationId } = await createAcceptedApplication('Overflow Test Task');
    const overflowProjectId = generateUuidV7();
    const overflowIntentId = generateUuidV7();

    await prisma.project.create({
      data: {
        id: overflowProjectId,
        assignmentId,
        applicationId,
        clientId: clientUserId,
        talentId: talentUserId,
        title: 'Overflow Test Contract',
        totalAmount: 20000,
        currency: 'INR',
        status: 'IN_PROGRESS',
        version: 1,
      },
    });

    await prisma.paymentIntent.create({
      data: {
        id: overflowIntentId,
        projectId: overflowProjectId,
        clientId: clientUserId,
        amount: 20000,
        currency: 'INR',
        platformFee: 2000,
        status: 'SUCCEEDED',
        provider: 'SANDBOX_MOCK',
        providerPaymentId: `pay_overflow_${generateUuidV7().replace(/-/g, '')}`,
        version: 1,
      },
    });

    await ledgerService.postTransaction({
      paymentIntentId: overflowIntentId,
      type: 'PAYMENT_CAPTURED',
      description: 'Funding overflow contract',
      entries: [
        {
          accountCode: 'ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK',
          accountType: 'ASSET',
          direction: 'DEBIT',
          amount: 20000,
          currency: 'INR',
        },
        {
          accountCode: `LIABILITIES:ESCROW_HOLDING:${overflowProjectId}`,
          accountType: 'LIABILITY',
          direction: 'CREDIT',
          amount: 18000,
          currency: 'INR',
          projectId: overflowProjectId,
        },
        {
          accountCode: 'REVENUE:PLATFORM_FEE',
          accountType: 'REVENUE',
          direction: 'CREDIT',
          amount: 2000,
          currency: 'INR',
        },
      ],
    });

    // Request refund of 25000 (exceeds 20000 capturable)
    const excessRes = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/intents/${overflowIntentId}/refunds`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        amount: 25000,
        reason: 'CLIENT_REQUESTED',
        notes: 'Attempted excess refund',
      },
    });

    expect(excessRes.statusCode).toBe(400);
    expect(excessRes.json().detail).toContain('exceeds total remaining refundable amount');
  });

  // ============================================================================
  // Section B: Complete End-to-End Lifecycle & Dispute Integration
  // ============================================================================

  it('executes end-to-end lifecycle: Project -> Deliverables -> Payment -> Dispute -> Review & Reputation', async () => {
    const { assignmentId, applicationId } =
      await createAcceptedApplication('Full E2E Lifecycle Task');

    // Step 1: Client creates project with 1 milestone deliverable
    const createProjectRes = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        assignmentId,
        applicationId,
        title: 'E2E Verified Production Project',
        description: 'Complete lifecycle integration test project',
        totalAmount: 100000,
        currency: 'INR',
        deliverables: [
          {
            title: 'Milestone 1: Primary Delivery',
            description: 'Core production assets',
            amount: 100000,
          },
        ],
      },
    });

    expect(createProjectRes.statusCode).toBe(201);
    const projectBody = createProjectRes.json();
    const lifecycleProjectId = projectBody.id;
    const deliverableId = projectBody.deliverables[0].id;
    expect(projectBody.status).toBe('IN_PROGRESS');

    // Step 2: Client creates PaymentIntent and captures payment into Escrow
    const createIntentRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/intents',
      headers: {
        authorization: `Bearer ${clientToken}`,
        'idempotency-key': `idemp_fund_${lifecycleProjectId}`,
      },
      payload: {
        projectId: lifecycleProjectId,
        amount: 100000,
        currency: 'INR',
        provider: 'SANDBOX_MOCK',
      },
    });

    expect(createIntentRes.statusCode).toBe(201);
    const intentId = createIntentRes.json().id;

    const confirmPaymentRes = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/intents/${intentId}/confirm`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        providerPaymentId: `pay_e2e_${generateUuidV7().replace(/-/g, '')}`,
      },
    });

    expect(confirmPaymentRes.statusCode).toBe(200);
    expect(confirmPaymentRes.json().status).toBe('SUCCEEDED');

    // Escrow balance should now be 90000
    const escrowBalance = await ledgerService.getProjectEscrowBalance(lifecycleProjectId);
    expect(escrowBalance).toBe(90000);

    // Step 3: Creator submits deliverable
    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${lifecycleProjectId}/deliverables/${deliverableId}/submit`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        submissionNotes: 'First draft submission for client inspection',
      },
    });

    expect(submitRes.statusCode).toBe(200);
    expect(submitRes.json().status).toBe('SUBMITTED');

    // Step 4: Client requests revision
    const revisionRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${lifecycleProjectId}/deliverables/${deliverableId}/review`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        action: 'REQUEST_REVISION',
        notes: 'Please refine color grading and bitrate.',
      },
    });

    expect(revisionRes.statusCode).toBe(200);
    expect(revisionRes.json().status).toBe('REVISION_REQUESTED');

    // Step 5: Creator re-submits deliverable
    const resubmitRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${lifecycleProjectId}/deliverables/${deliverableId}/submit`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        submissionNotes: 'Second revision with enhanced audio/video quality',
      },
    });

    expect(resubmitRes.statusCode).toBe(200);
    expect(resubmitRes.json().status).toBe('SUBMITTED');

    // Step 6: Client opens a dispute on the project
    const disputeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/disputes',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        projectId: lifecycleProjectId,
        reason: 'SCOPE_MISMATCH',
        title: 'Dispute over deliverable delivery timeline',
        description: 'Client disputing delivery timeline alignment',
      },
    });

    expect(disputeRes.statusCode).toBe(201);
    const disputeId = disputeRes.json().id;

    // Verify Project status transitioned to DISPUTED
    const disputedProj = await prisma.project.findUnique({ where: { id: lifecycleProjectId } });
    expect(disputedProj?.status).toBe('DISPUTED');

    // Step 7: Verify that while DISPUTED:
    // a) Escrow release is strictly BLOCKED
    const blockedEscrowRes = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/projects/${lifecycleProjectId}/escrow/release`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(blockedEscrowRes.statusCode).toBe(400);
    expect(blockedEscrowRes.json().detail).toContain('active dispute');

    // b) Deliverable review/approval is strictly BLOCKED
    const blockedReviewRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${lifecycleProjectId}/deliverables/${deliverableId}/review`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { action: 'APPROVE' },
    });
    expect(blockedReviewRes.statusCode).toBe(400);
    expect(blockedReviewRes.json().detail).toContain('DISPUTED');

    // c) Project cancellation is strictly BLOCKED
    const blockedCancelRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${lifecycleProjectId}/cancellations`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { reason: 'Want to cancel during dispute' },
    });
    expect(blockedCancelRes.statusCode).toBe(400);
    expect(blockedCancelRes.json().detail).toContain('DISPUTED');

    // Step 8: Platform Administrator resolves dispute in favor of creator
    const resolveRes = await app.inject({
      method: 'POST',
      url: `/api/v1/disputes/${disputeId}/resolve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        resolution: 'RESOLVED_FOR_CREATOR',
        resolutionReason: 'Creator complied with milestone delivery specifications.',
      },
    });

    expect(resolveRes.statusCode).toBe(200);
    expect(resolveRes.json().status).toBe('RESOLVED_FOR_CREATOR');

    // Project status should be restored to IN_PROGRESS
    const unblockedProj = await prisma.project.findUnique({ where: { id: lifecycleProjectId } });
    expect(unblockedProj?.status).toBe('IN_PROGRESS');

    // Step 9: Deliverable review can now proceed: Client approves deliverable
    const approveDeliverableRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${lifecycleProjectId}/deliverables/${deliverableId}/review`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { action: 'APPROVE' },
    });

    expect(approveDeliverableRes.statusCode).toBe(200);
    expect(approveDeliverableRes.json().status).toBe('APPROVED');

    // All deliverables approved -> Project auto-transitions to COMPLETED
    const completedProj = await prisma.project.findUnique({ where: { id: lifecycleProjectId } });
    expect(completedProj?.status).toBe('COMPLETED');

    // Step 10: Client releases escrow funds to Creator Payable
    const releaseRes = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/projects/${lifecycleProjectId}/escrow/release`,
      headers: { authorization: `Bearer ${clientToken}` },
    });

    expect(releaseRes.statusCode).toBe(200);
    expect(releaseRes.json().releasedAmount).toBe(90000);

    const creatorPayable = await ledgerService.getCreatorPayableBalance(talentUserId);
    expect(creatorPayable).toBe(90000);

    // Step 11: Review & Reputation Governance Verification
    // a) Non-participant bystander attempting to review is rejected with 403
    const bystanderReviewRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${lifecycleProjectId}/reviews`,
      headers: { authorization: `Bearer ${bystanderToken}` },
      payload: {
        rating: 5,
        feedback: 'Unauthorized bystander review attempt',
      },
    });
    expect(bystanderReviewRes.statusCode).toBe(403);

    // b) Client submits 5-star review for Creator
    const createReviewRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${lifecycleProjectId}/reviews`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        rating: 5,
        communicationRating: 5,
        qualityRating: 5,
        adherenceRating: 5,
        feedback: 'Exceptional work and professional delivery throughout.',
      },
    });

    expect(createReviewRes.statusCode).toBe(201);
    const reviewId = createReviewRes.json().id;
    expect(createReviewRes.json().rating).toBe(5);

    // c) Duplicate review attempt is rejected
    const dupReviewRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${lifecycleProjectId}/reviews`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        rating: 4,
        feedback: 'Second review attempt',
      },
    });
    expect(dupReviewRes.statusCode).toBe(409);

    // d) Review edit within 48h allowed
    const editReviewRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/reviews/${reviewId}`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        feedback: 'Exceptional work, professional delivery, and rapid turnarounds.',
      },
    });
    expect(editReviewRes.statusCode).toBe(200);
    expect(editReviewRes.json().feedback).toContain('rapid turnarounds');

    // e) Verify Deterministic Bayesian Reputation Summary
    // Prior Mean = 4.0, Weight = 5.0
    // With 1 review of 5.0: S = (5*4.0 + 5.0) / (5 + 1) = 25 / 6 = 4.17
    const repRes = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${talentUserId}/reputation`,
    });

    expect(repRes.statusCode).toBe(200);
    const rep = repRes.json();
    expect(rep.totalReviews).toBe(1);
    expect(rep.averageRating).toBe(5);
    expect(rep.bayesianScore).toBe(4.17);
    expect(rep.categoryAverages.communication).toBe(5);
  });

  // ============================================================================
  // Section C: Review Moderation, Rating Bounds & Hidden Status Exclusion
  // ============================================================================

  it('verifies review rating bounds, moderation hiding, and exclusion from public summaries', async () => {
    const { assignmentId, applicationId } = await createAcceptedApplication(
      'Moderation & Bounds Task',
    );
    const modProjectId = generateUuidV7();

    await prisma.project.create({
      data: {
        id: modProjectId,
        assignmentId,
        applicationId,
        clientId: clientUserId,
        talentId: talentUserId,
        title: 'Moderation Test Contract',
        totalAmount: 50000,
        currency: 'INR',
        status: 'COMPLETED',
        version: 1,
      },
    });

    // 1. Rating Bounds: Rating 6 rejected with 400
    const outOfBoundsHigh = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${modProjectId}/reviews`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { rating: 6, feedback: 'Invalid high rating' },
    });
    expect(outOfBoundsHigh.statusCode).toBe(400);

    // Rating 0 rejected with 400
    const outOfBoundsLow = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${modProjectId}/reviews`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { rating: 0, feedback: 'Invalid zero rating' },
    });
    expect(outOfBoundsLow.statusCode).toBe(400);

    // 2. Client submits valid 2-star review
    const validReviewRes = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${modProjectId}/reviews`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: { rating: 2, feedback: 'Contains inappropriate remarks that violate guidelines.' },
    });
    expect(validReviewRes.statusCode).toBe(201);
    const modReviewId = validReviewRes.json().id;

    // 3. User reports review
    const reportRes = await app.inject({
      method: 'POST',
      url: `/api/v1/reviews/${modReviewId}/report`,
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        reason: 'INAPPROPRIATE_CONTENT',
        details: 'Review violates platform community guidelines.',
      },
    });
    expect(reportRes.statusCode).toBe(201);

    // 4. Admin moderates review to HIDDEN status
    const modRes = await app.inject({
      method: 'POST',
      url: `/api/v1/reviews/${modReviewId}/moderate`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        action: 'HIDE',
        reason: 'Review hidden following content policy breach.',
      },
    });
    expect(modRes.statusCode).toBe(200);
    expect(modRes.json().review.status).toBe('HIDDEN');

    // 5. Public review list must EXCLUDE the hidden review
    const publicReviewsRes = await app.inject({
      method: 'GET',
      url: `/api/v1/users/${talentUserId}/reviews`,
    });
    expect(publicReviewsRes.statusCode).toBe(200);
    const publicReviews = publicReviewsRes.json();
    const items = publicReviews.items || publicReviews;
    const containsHidden = items.some((r: any) => r.id === modReviewId);
    expect(containsHidden).toBe(false);
  });

  // ============================================================================
  // Section D: Recoverable State & Admin Refund Reconciliation Drill
  // ============================================================================

  it('verifies recoverable state and administrative reconciliation for uncertain refunds', async () => {
    const { assignmentId, applicationId } =
      await createAcceptedApplication('Refund Reconcile Task');
    const reconProjectId = generateUuidV7();
    const reconIntentId = generateUuidV7();

    await prisma.project.create({
      data: {
        id: reconProjectId,
        assignmentId,
        applicationId,
        clientId: clientUserId,
        talentId: talentUserId,
        title: 'Reconciliation Drill Contract',
        totalAmount: 60000,
        currency: 'INR',
        status: 'IN_PROGRESS',
        version: 1,
      },
    });

    await prisma.paymentIntent.create({
      data: {
        id: reconIntentId,
        projectId: reconProjectId,
        clientId: clientUserId,
        amount: 60000,
        currency: 'INR',
        platformFee: 6000,
        status: 'SUCCEEDED',
        provider: 'SANDBOX_MOCK',
        providerPaymentId: `pay_recon_${generateUuidV7().replace(/-/g, '')}`,
        version: 1,
      },
    });

    // Pre-fund escrow in ledger
    await ledgerService.postTransaction({
      paymentIntentId: reconIntentId,
      type: 'PAYMENT_CAPTURED',
      description: 'Funding recon contract',
      entries: [
        {
          accountCode: 'ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK',
          accountType: 'ASSET',
          direction: 'DEBIT',
          amount: 60000,
          currency: 'INR',
        },
        {
          accountCode: `LIABILITIES:ESCROW_HOLDING:${reconProjectId}`,
          accountType: 'LIABILITY',
          direction: 'CREDIT',
          amount: 54000,
          currency: 'INR',
          projectId: reconProjectId,
        },
        {
          accountCode: 'REVENUE:PLATFORM_FEE',
          accountType: 'REVENUE',
          direction: 'CREDIT',
          amount: 6000,
          currency: 'INR',
        },
      ],
    });

    // Simulate refund in PROCESSING state (e.g. provider succeeded but local db sync was delayed)
    const refundId = generateUuidV7();
    await prisma.refund.create({
      data: {
        id: refundId,
        paymentIntentId: reconIntentId,
        projectId: reconProjectId,
        refundedById: clientUserId,
        amount: 30000,
        currency: 'INR',
        reason: 'CLIENT_REQUESTED',
        status: 'PROCESSING',
        provider: 'SANDBOX_MOCK',
        providerRefundId: `rfnd_mock_recon_${generateUuidV7().replace(/-/g, '')}`,
      },
    });

    // Admin reconciles the refund
    const reconcileRes = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/refunds/${refundId}/reconcile`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(reconcileRes.statusCode).toBe(200);
    const reconBody = reconcileRes.json();
    expect(reconBody.status).toBe('SUCCEEDED');
    expect(reconBody.amount).toBe(30000);

    // Escrow balance should be reduced: 54000 - 27000 = 27000
    const remainingEscrow = await ledgerService.getProjectEscrowBalance(reconProjectId);
    expect(remainingEscrow).toBe(27000);

    // Verify ledger transaction was posted and balances
    const ledgerTx = await prisma.ledgerTransaction.findFirst({
      where: { paymentIntentId: reconIntentId, type: 'PAYMENT_REFUND_RECONCILED' },
      include: { entries: { include: { account: true } } },
    });
    expect(ledgerTx).toBeDefined();

    const debits = ledgerTx!.entries.filter((e) => e.direction === 'DEBIT');
    const credits = ledgerTx!.entries.filter((e) => e.direction === 'CREDIT');
    expect(debits.reduce((sum, e) => sum + e.amount, 0)).toBe(30000);
    expect(credits.reduce((sum, e) => sum + e.amount, 0)).toBe(30000);
  });

  // ============================================================================
  // Section E: Multi-Step Partial Refund Cumulative Fee Allocation & Zero Residue
  // ============================================================================

  it('guarantees zero residual fee or escrow leakage across multi-step partial refunds', async () => {
    const { assignmentId, applicationId } = await createAcceptedApplication(
      'Zero Residue Rounding Task',
    );
    const multiProjectId = generateUuidV7();
    const multiIntentId = generateUuidV7();

    // Intent: 10,000 paisa, 1,000 platform fee (10%), 9,000 escrow
    await prisma.project.create({
      data: {
        id: multiProjectId,
        assignmentId,
        applicationId,
        clientId: clientUserId,
        talentId: talentUserId,
        title: 'Multi-Refund Precision Contract',
        totalAmount: 10000,
        currency: 'INR',
        status: 'IN_PROGRESS',
        version: 1,
      },
    });

    await prisma.paymentIntent.create({
      data: {
        id: multiIntentId,
        projectId: multiProjectId,
        clientId: clientUserId,
        amount: 10000,
        currency: 'INR',
        platformFee: 1000,
        status: 'SUCCEEDED',
        provider: 'SANDBOX_MOCK',
        providerPaymentId: `pay_multi_${generateUuidV7().replace(/-/g, '')}`,
        version: 1,
      },
    });

    // Capture payment in ledger
    await ledgerService.postTransaction({
      paymentIntentId: multiIntentId,
      type: 'PAYMENT_CAPTURED',
      description: 'Funding multi-refund contract',
      entries: [
        {
          accountCode: 'ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK',
          accountType: 'ASSET',
          direction: 'DEBIT',
          amount: 10000,
          currency: 'INR',
        },
        {
          accountCode: `LIABILITIES:ESCROW_HOLDING:${multiProjectId}`,
          accountType: 'LIABILITY',
          direction: 'CREDIT',
          amount: 9000,
          currency: 'INR',
          projectId: multiProjectId,
        },
        {
          accountCode: 'REVENUE:PLATFORM_FEE',
          accountType: 'REVENUE',
          direction: 'CREDIT',
          amount: 1000,
          currency: 'INR',
        },
      ],
    });

    // Step 1: Refund 3,333
    const ref1 = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/intents/${multiIntentId}/refunds`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        amount: 3333,
        reason: 'CLIENT_REQUESTED',
        idempotencyKey: `idemp_multi_1_${generateUuidV7()}`,
      },
    });
    expect(ref1.statusCode).toBe(201);

    // Step 2: Refund 3,333
    const ref2 = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/intents/${multiIntentId}/refunds`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        amount: 3333,
        reason: 'CLIENT_REQUESTED',
        idempotencyKey: `idemp_multi_2_${generateUuidV7()}`,
      },
    });
    expect(ref2.statusCode).toBe(201);

    // Step 3: Refund final 3,334 (reaches 10,000 / 100% full refund)
    const ref3 = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/intents/${multiIntentId}/refunds`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        amount: 3334,
        reason: 'CLIENT_REQUESTED',
        idempotencyKey: `idemp_multi_3_${generateUuidV7()}`,
      },
    });
    expect(ref3.statusCode).toBe(201);

    // Verify Payment Intent is fully REFUNDED
    const finalIntent = await prisma.paymentIntent.findUniqueOrThrow({
      where: { id: multiIntentId },
    });
    expect(finalIntent.status).toBe('REFUNDED');

    // Escrow balance must be exactly 0 (Zero leakage / zero residue)
    const finalEscrow = await ledgerService.getProjectEscrowBalance(multiProjectId);
    expect(finalEscrow).toBe(0);

    // Verify sum of debits and credits across all 3 refund ledger entries
    const refundTransactions = await prisma.ledgerTransaction.findMany({
      where: { paymentIntentId: multiIntentId, type: 'PAYMENT_REFUNDED' },
      include: { entries: true },
    });
    expect(refundTransactions).toHaveLength(3);

    let totalEscrowDebited = 0;
    let totalFeeDebited = 0;
    for (const tx of refundTransactions) {
      for (const entry of tx.entries) {
        if (entry.direction === 'DEBIT') {
          if (entry.accountId) {
            const acc = await prisma.ledgerAccount.findUniqueOrThrow({
              where: { id: entry.accountId },
            });
            if (acc.code.startsWith('LIABILITIES:ESCROW_HOLDING')) {
              totalEscrowDebited += entry.amount;
            } else if (acc.code === 'REVENUE:PLATFORM_FEE') {
              totalFeeDebited += entry.amount;
            }
          }
        }
      }
    }

    expect(totalEscrowDebited).toBe(9000);
    expect(totalFeeDebited).toBe(1000);
  });

  // ============================================================================
  // Section F: Active Dispute Lifecycle Escrow & Client Refund Protection
  // ============================================================================

  it('prohibits unilateral client refund and escrow release during active disputes', async () => {
    const { assignmentId, applicationId } =
      await createAcceptedApplication('Dispute Invariant Task');
    const disputeProjectId = generateUuidV7();
    const disputeIntentId = generateUuidV7();

    await prisma.project.create({
      data: {
        id: disputeProjectId,
        assignmentId,
        applicationId,
        clientId: clientUserId,
        talentId: talentUserId,
        title: 'Dispute Invariant Contract',
        totalAmount: 50000,
        currency: 'INR',
        status: 'IN_PROGRESS',
        version: 1,
      },
    });

    await prisma.paymentIntent.create({
      data: {
        id: disputeIntentId,
        projectId: disputeProjectId,
        clientId: clientUserId,
        amount: 50000,
        currency: 'INR',
        platformFee: 5000,
        status: 'SUCCEEDED',
        provider: 'SANDBOX_MOCK',
        providerPaymentId: `pay_dispute_${generateUuidV7().replace(/-/g, '')}`,
        version: 1,
      },
    });

    // Fund escrow
    await ledgerService.postTransaction({
      paymentIntentId: disputeIntentId,
      type: 'PAYMENT_CAPTURED',
      description: 'Funding dispute invariant contract',
      entries: [
        {
          accountCode: 'ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK',
          accountType: 'ASSET',
          direction: 'DEBIT',
          amount: 50000,
          currency: 'INR',
        },
        {
          accountCode: `LIABILITIES:ESCROW_HOLDING:${disputeProjectId}`,
          accountType: 'LIABILITY',
          direction: 'CREDIT',
          amount: 45000,
          currency: 'INR',
          projectId: disputeProjectId,
        },
        {
          accountCode: 'REVENUE:PLATFORM_FEE',
          accountType: 'REVENUE',
          direction: 'CREDIT',
          amount: 5000,
          currency: 'INR',
        },
      ],
    });

    // Open active dispute
    const openDisputeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/disputes',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        projectId: disputeProjectId,
        reason: 'DELIVERABLE_POOR_QUALITY',
        description: 'Quality does not match agreed brief requirements.',
      },
    });
    expect(openDisputeRes.statusCode).toBe(201);

    // Verify project is DISPUTED
    const disputedProj = await prisma.project.findUniqueOrThrow({
      where: { id: disputeProjectId },
    });
    expect(disputedProj.status).toBe('DISPUTED');

    // 1. Unilateral client refund during active dispute MUST be rejected (400)
    const refundAttempt = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/intents/${disputeIntentId}/refunds`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        amount: 25000,
        reason: 'CLIENT_REQUESTED',
        idempotencyKey: `idemp_dispute_refund_${generateUuidV7()}`,
      },
    });
    expect(refundAttempt.statusCode).toBe(400);
    expect(refundAttempt.json().detail || refundAttempt.json().message).toContain('active dispute');

    // 2. Escrow release during active dispute MUST be rejected (400)
    const releaseAttempt = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/projects/${disputeProjectId}/escrow/release`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(releaseAttempt.statusCode).toBe(400);
    expect(releaseAttempt.json().detail || releaseAttempt.json().message).toContain(
      'active dispute',
    );
  });

  it('blocks escrow release while pending or processing refund reservations exist on the project', async () => {
    const { assignmentId, applicationId } = await createAcceptedApplication(
      'In-Flight Refund Escrow Drain Protection',
    );
    const projId = generateUuidV7();
    const intentId = generateUuidV7();

    await prisma.project.create({
      data: {
        id: projId,
        assignmentId,
        applicationId,
        clientId: clientUserId,
        talentId: talentUserId,
        title: 'Refund In-Flight Drain Guard Contract',
        totalAmount: 100000,
        currency: 'INR',
        status: 'IN_PROGRESS',
        version: 1,
      },
    });

    await prisma.paymentIntent.create({
      data: {
        id: intentId,
        projectId: projId,
        clientId: clientUserId,
        amount: 100000,
        currency: 'INR',
        platformFee: 10000,
        status: 'SUCCEEDED',
        provider: 'SANDBOX_MOCK',
        providerPaymentId: `pay_drain_${generateUuidV7().replace(/-/g, '')}`,
        version: 1,
      },
    });

    // Fund escrow: 90000 escrow holding, 10000 platform fee
    await ledgerService.postTransaction({
      paymentIntentId: intentId,
      type: 'PAYMENT_CAPTURED',
      description: 'Funding contract for in-flight refund guard test',
      entries: [
        {
          accountCode: 'ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK',
          accountType: 'ASSET',
          direction: 'DEBIT',
          amount: 100000,
          currency: 'INR',
        },
        {
          accountCode: `LIABILITIES:ESCROW_HOLDING:${projId}`,
          accountType: 'LIABILITY',
          direction: 'CREDIT',
          amount: 90000,
          currency: 'INR',
          projectId: projId,
        },
        {
          accountCode: 'REVENUE:PLATFORM_FEE',
          accountType: 'REVENUE',
          direction: 'CREDIT',
          amount: 10000,
          currency: 'INR',
        },
      ],
    });

    // Create an in-flight PENDING refund reservation
    const pendingRefundId = generateUuidV7();
    await prisma.refund.create({
      data: {
        id: pendingRefundId,
        paymentIntentId: intentId,
        projectId: projId,
        refundedById: clientUserId,
        amount: 50000,
        currency: 'INR',
        reason: 'CLIENT_REQUESTED',
        status: 'PENDING',
        provider: 'SANDBOX_MOCK',
      },
    });

    // 1. Escrow release MUST be blocked with 400 because refund is in-flight
    const blockedRelease = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/projects/${projId}/escrow/release`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(blockedRelease.statusCode).toBe(400);
    expect(blockedRelease.json().detail || blockedRelease.json().message).toContain(
      'in-flight refund reservations',
    );

    // 2. If the pending refund failed at provider, reservation is marked FAILED
    await prisma.refund.update({
      where: { id: pendingRefundId },
      data: { status: 'FAILED', errorMessage: 'Provider rejected' },
    });

    // 3. Escrow release should now succeed smoothly
    const allowedRelease = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/projects/${projId}/escrow/release`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(allowedRelease.statusCode).toBe(200);
    expect(allowedRelease.json().releasedAmount).toBe(90000);
  });

  it('preserves PROCESSING reservation on ambiguous provider timeout and allows admin reconciliation', async () => {
    const { assignmentId, applicationId } = await createAcceptedApplication(
      'Ambiguous Timeout Recovery Contract',
    );
    const projId = generateUuidV7();
    const intentId = generateUuidV7();

    await prisma.project.create({
      data: {
        id: projId,
        assignmentId,
        applicationId,
        clientId: clientUserId,
        talentId: talentUserId,
        title: 'Ambiguous Timeout Recovery Contract',
        totalAmount: 100000,
        currency: 'INR',
        status: 'IN_PROGRESS',
        version: 1,
      },
    });

    await prisma.paymentIntent.create({
      data: {
        id: intentId,
        projectId: projId,
        clientId: clientUserId,
        amount: 100000,
        currency: 'INR',
        platformFee: 10000,
        status: 'SUCCEEDED',
        provider: 'SANDBOX_MOCK',
        providerPaymentId: `pay_timeout_${generateUuidV7().replace(/-/g, '')}`,
        version: 1,
      },
    });

    // Fund escrow
    await ledgerService.postTransaction({
      paymentIntentId: intentId,
      type: 'PAYMENT_CAPTURED',
      description: 'Funding contract for ambiguous timeout test',
      entries: [
        {
          accountCode: 'ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK',
          accountType: 'ASSET',
          direction: 'DEBIT',
          amount: 100000,
          currency: 'INR',
        },
        {
          accountCode: `LIABILITIES:ESCROW_HOLDING:${projId}`,
          accountType: 'LIABILITY',
          direction: 'CREDIT',
          amount: 90000,
          currency: 'INR',
          projectId: projId,
        },
        {
          accountCode: 'REVENUE:PLATFORM_FEE',
          accountType: 'REVENUE',
          direction: 'CREDIT',
          amount: 10000,
          currency: 'INR',
        },
      ],
    });

    // Mock provider to simulate network timeout on createRefund
    const provider = getPaymentProvider('SANDBOX_MOCK');
    const spy = vi.spyOn(provider, 'createRefund').mockImplementationOnce(async () => {
      const timeoutError: any = new Error('ETIMEDOUT: Connection timed out to gateway');
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    });

    // Client requests refund of 60000
    const refundAttempt = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/intents/${intentId}/refunds`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        amount: 60000,
        reason: 'CLIENT_REQUESTED',
        idempotencyKey: `idemp_timeout_${generateUuidV7()}`,
      },
    });

    expect(refundAttempt.statusCode).toBe(502);
    expect(refundAttempt.json().detail || refundAttempt.json().message).toContain('ambiguous');

    // Verify refund in database is held in PROCESSING status (not FAILED!)
    const processingRefund = await prisma.refund.findFirstOrThrow({
      where: { paymentIntentId: intentId },
    });
    expect(processingRefund.status).toBe('PROCESSING');
    expect(processingRefund.errorMessage).toContain('ETIMEDOUT');

    // Double refund protection: A new refund of 60000 must be rejected because 60000 is still reserved
    const secondRefundAttempt = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/intents/${intentId}/refunds`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        amount: 60000,
        reason: 'CLIENT_REQUESTED',
        idempotencyKey: `idemp_timeout_attempt2_${generateUuidV7()}`,
      },
    });
    expect(secondRefundAttempt.statusCode).toBe(400); // Exceeds remaining refundable amount (40000)

    // Admin reconciles the refund after manual/bank confirmation
    const reconcileRes = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/refunds/${processingRefund.id}/reconcile`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(reconcileRes.statusCode).toBe(200);
    expect(reconcileRes.json().status).toBe('SUCCEEDED');

    // Verify final state
    const settledRefund = await prisma.refund.findUniqueOrThrow({
      where: { id: processingRefund.id },
    });
    expect(settledRefund.status).toBe('SUCCEEDED');

    spy.mockRestore();
  });
});
