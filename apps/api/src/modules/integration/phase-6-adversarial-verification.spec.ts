import crypto from 'node:crypto';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';
import { ledgerService } from '../payments/ledger/ledger.service.js';
import { UnbalancedLedgerEntryError, InvalidLedgerAmountError } from '../../errors/app-error.js';

describe('Phase 6 Adversarial Verification & Boundary Audit', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let brandUserId: string;
  let brandToken: string;
  let brandProfileId: string;

  let creatorUserId: string;
  let creatorToken: string;

  let bystanderUserId: string;
  let bystanderToken: string;

  let suspendedUserId: string;
  let suspendedToken: string;

  let adminUserId: string;
  let adminToken: string;

  let verifiedProjectId: string;
  let verifiedPaymentIntentId: string;

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    // 1. Brand User
    brandUserId = generateUuidV7();
    brandProfileId = generateUuidV7();
    brandToken = await createTestJwt({
      sub: `sub_adv_brand_${generateUuidV7().replace(/-/g, '')}`,
      email: `adv_brand_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decBrand: any = await defaultJwtVerifier.verifyToken(brandToken);
    await prisma.user.create({
      data: {
        id: brandUserId,
        supabaseAuthId: decBrand.sub,
        email: decBrand.email,
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
            id: brandProfileId,
            companyName: 'Adversarial Test Brand LLC',
            industry: 'Security & Integrity',
          },
        },
      },
    });

    // 2. Creator User
    creatorUserId = generateUuidV7();
    creatorToken = await createTestJwt({
      sub: `sub_adv_creator_${generateUuidV7().replace(/-/g, '')}`,
      email: `adv_creator_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decCreator: any = await defaultJwtVerifier.verifyToken(creatorToken);
    await prisma.user.create({
      data: {
        id: creatorUserId,
        supabaseAuthId: decCreator.sub,
        email: decCreator.email,
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
            bio: 'Verified Creator Talent',
          },
        },
      },
    });

    // 3. Bystander User
    bystanderUserId = generateUuidV7();
    bystanderToken = await createTestJwt({
      sub: `sub_adv_bystander_${generateUuidV7().replace(/-/g, '')}`,
      email: `adv_bystander_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decBystander: any = await defaultJwtVerifier.verifyToken(bystanderToken);
    await prisma.user.create({
      data: {
        id: bystanderUserId,
        supabaseAuthId: decBystander.sub,
        email: decBystander.email,
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

    // 4. Suspended User
    suspendedUserId = generateUuidV7();
    suspendedToken = await createTestJwt({
      sub: `sub_adv_suspended_${generateUuidV7().replace(/-/g, '')}`,
      email: `adv_suspended_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decSuspended: any = await defaultJwtVerifier.verifyToken(suspendedToken);
    await prisma.user.create({
      data: {
        id: suspendedUserId,
        supabaseAuthId: decSuspended.sub,
        email: decSuspended.email,
        status: 'SUSPENDED',
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

    // 5. Admin User
    adminUserId = generateUuidV7();
    adminToken = await createTestJwt({
      sub: `sub_adv_admin_${generateUuidV7().replace(/-/g, '')}`,
      email: `adv_admin_${generateUuidV7().replace(/-/g, '')}@test.com`,
      roles: ['ADMIN'],
    });
    const decAdmin: any = await defaultJwtVerifier.verifyToken(adminToken);
    await prisma.user.create({
      data: {
        id: adminUserId,
        supabaseAuthId: decAdmin.sub,
        email: decAdmin.email,
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

    // Create a base project and funded payment intent
    const assignId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: assignId,
        brandId: brandProfileId,
        title: 'Adversarial Test Assignment',
        description: 'Adversarial testing baseline',
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
        applicantId: creatorUserId,
        coverLetter: 'Adversarial application',
        proposedRate: 100000,
        status: 'ACCEPTED',
      },
    });

    verifiedProjectId = generateUuidV7();
    await prisma.project.create({
      data: {
        id: verifiedProjectId,
        assignmentId: assignId,
        applicationId: appId,
        clientId: brandUserId,
        talentId: creatorUserId,
        title: 'Adversarial Verified Project',
        totalAmount: 100000,
        currency: 'INR',
        status: 'IN_PROGRESS',
        version: 1,
      },
    });

    verifiedPaymentIntentId = generateUuidV7();
    await prisma.paymentIntent.create({
      data: {
        id: verifiedPaymentIntentId,
        projectId: verifiedProjectId,
        clientId: brandUserId,
        amount: 100000,
        currency: 'INR',
        platformFee: 10000,
        status: 'SUCCEEDED',
        provider: 'SANDBOX_MOCK',
        providerPaymentId: `pay_adv_${generateUuidV7().replace(/-/g, '')}`,
        version: 1,
      },
    });

    await ledgerService.postTransaction({
      paymentIntentId: verifiedPaymentIntentId,
      type: 'PAYMENT_CAPTURED',
      description: 'Adversarial test base funding',
      entries: [
        {
          accountCode: 'ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK',
          accountType: 'ASSET',
          direction: 'DEBIT',
          amount: 100000,
          currency: 'INR',
        },
        {
          accountCode: `LIABILITIES:ESCROW_HOLDING:${verifiedProjectId}`,
          accountName: `Project Escrow for ${verifiedProjectId}`,
          accountType: 'LIABILITY',
          direction: 'CREDIT',
          amount: 90000,
          currency: 'INR',
          projectId: verifiedProjectId,
        },
        {
          accountCode: 'REVENUE:PLATFORM_FEE',
          accountName: 'Platform Take Rate',
          accountType: 'REVENUE',
          direction: 'CREDIT',
          amount: 10000,
          currency: 'INR',
        },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ============================================================================
  // Test 1: Double-Entry Ledger Mathematical Invariant Enforcement
  // ============================================================================
  it('strictly rejects unbalanced ledger transactions and negative/zero amounts', async () => {
    // 1. Unbalanced entries (Debits != Credits)
    await expect(
      ledgerService.postTransaction({
        type: 'TEST_UNBALANCED',
        entries: [
          {
            accountCode: 'ASSETS:TEST_A',
            accountType: 'ASSET',
            direction: 'DEBIT',
            amount: 5000,
          },
          {
            accountCode: 'LIABILITIES:TEST_B',
            accountType: 'LIABILITY',
            direction: 'CREDIT',
            amount: 4999, // 1 paisa unbalanced!
          },
        ],
      }),
    ).rejects.toThrow(UnbalancedLedgerEntryError);

    // 2. Non-positive amount (zero paisa)
    await expect(
      ledgerService.postTransaction({
        type: 'TEST_ZERO_AMOUNT',
        entries: [
          {
            accountCode: 'ASSETS:TEST_A',
            accountType: 'ASSET',
            direction: 'DEBIT',
            amount: 0,
          },
          {
            accountCode: 'LIABILITIES:TEST_B',
            accountType: 'LIABILITY',
            direction: 'CREDIT',
            amount: 0,
          },
        ],
      }),
    ).rejects.toThrow(InvalidLedgerAmountError);

    // 3. Negative amount
    await expect(
      ledgerService.postTransaction({
        type: 'TEST_NEGATIVE_AMOUNT',
        entries: [
          {
            accountCode: 'ASSETS:TEST_A',
            accountType: 'ASSET',
            direction: 'DEBIT',
            amount: -100,
          },
          {
            accountCode: 'LIABILITIES:TEST_B',
            accountType: 'LIABILITY',
            direction: 'CREDIT',
            amount: -100,
          },
        ],
      }),
    ).rejects.toThrow(InvalidLedgerAmountError);
  });

  // ============================================================================
  // Test 2: Webhook Signature Verification & Tamper Resistance
  // ============================================================================
  it('rejects webhooks with missing, invalid, or tampered HMAC signatures with 400', async () => {
    const rawPayload = JSON.stringify({
      id: 'evt_tampered_123',
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_tampered_123', amount: 50000 } } },
    });

    // 1. Missing signature header -> 400 Bad Request
    const resNoSig = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/RAZORPAY',
      headers: {
        'content-type': 'application/json',
      },
      payload: rawPayload,
    });
    expect(resNoSig.statusCode).toBe(400);

    // 2. Bogus signature -> 400 Bad Request
    const resBadSig = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/RAZORPAY',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': '0000000000000000000000000000000000000000000000000000000000000000',
      },
      payload: rawPayload,
    });
    expect(resBadSig.statusCode).toBe(400);

    // 3. Valid signature for different payload (tampered payload)
    const legitPayload = JSON.stringify({ id: 'evt_legit', event: 'payment.captured' });
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_dev';
    const forgedSig = crypto.createHmac('sha256', secret).update(legitPayload).digest('hex');

    const resTampered = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/RAZORPAY',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': forgedSig,
      },
      payload: rawPayload, // Sent altered payload with signature of legitPayload!
    });
    expect(resTampered.statusCode).toBe(400);
  });

  // ============================================================================
  // Test 3: Webhook Replay & Altered Payload Protection
  // ============================================================================
  it('ignores duplicate webhook event IDs and prevents altered payload execution', async () => {
    const eventId = `evt_adv_${generateUuidV7().replace(/-/g, '')}`;
    const orderId = `order_adv_${generateUuidV7().replace(/-/g, '')}`;

    // Seed payment intent for this order
    const intentId = generateUuidV7();
    await prisma.paymentIntent.create({
      data: {
        id: intentId,
        projectId: verifiedProjectId,
        clientId: brandUserId,
        amount: 25000,
        currency: 'INR',
        platformFee: 2500,
        status: 'REQUIRES_CAPTURE',
        provider: 'RAZORPAY',
        providerOrderId: orderId,
        version: 1,
      },
    });

    const secret = process.env.PAYMENT_WEBHOOK_SECRET || 'mock_webhook_secret_dev_key';
    const payloadObj = {
      id: eventId,
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_adv_${generateUuidV7().replace(/-/g, '')}`,
            order_id: orderId,
            amount: 25000,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    };

    const rawFirst = JSON.stringify(payloadObj);
    const sigFirst = crypto.createHmac('sha256', secret).update(rawFirst).digest('hex');

    // First arrival: processes successfully
    const resFirst = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/RAZORPAY',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': sigFirst,
      },
      payload: rawFirst,
    });
    expect(resFirst.statusCode).toBe(200);
    const bodyFirst = JSON.parse(resFirst.payload);
    expect(bodyFirst.status).toBe('PROCESSED');

    const ledgerCountInitial = await prisma.ledgerTransaction.count({
      where: { paymentIntentId: intentId },
    });
    expect(ledgerCountInitial).toBe(1);

    // Second arrival: Exact duplicate replay
    const resReplay = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/RAZORPAY',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': sigFirst,
      },
      payload: rawFirst,
    });
    expect(resReplay.statusCode).toBe(200);
    const bodyReplay = JSON.parse(resReplay.payload);
    expect(bodyReplay.status).toBe('ALREADY_PROCESSED');

    // Third arrival: Reused eventId with altered payload
    const alteredPayloadObj = {
      id: eventId,
      event: 'refund.processed',
      payload: {
        refund: {
          entity: {
            id: `rfnd_fake_${generateUuidV7().replace(/-/g, '')}`,
            payment_id: `pay_adv_${generateUuidV7().replace(/-/g, '')}`,
            amount: 99999999, // Malicious amount
          },
        },
      },
    };
    const rawAltered = JSON.stringify(alteredPayloadObj);
    const sigAltered = crypto.createHmac('sha256', secret).update(rawAltered).digest('hex');

    const resAltered = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/RAZORPAY',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': sigAltered,
      },
      payload: rawAltered,
    });
    expect(resAltered.statusCode).toBe(200);
    const bodyAltered = JSON.parse(resAltered.payload);
    expect(bodyAltered.status).toBe('PAYLOAD_MISMATCH_ANOMALY');

    // Assert that an audit log integrity anomaly was created
    const anomalyAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'PAYMENT_WEBHOOK_PAYLOAD_MISMATCH_ANOMALY',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(anomalyAudit).not.toBeNull();
    expect((anomalyAudit?.metadata as any)?.eventId).toBe(eventId);

    // Assert that zero additional ledger transactions or mutations took place
    const ledgerCountFinal = await prisma.ledgerTransaction.count({
      where: { paymentIntentId: intentId },
    });
    expect(ledgerCountFinal).toBe(1);
  });

  // ============================================================================
  // Test 3B: Out-of-Order Webhook Delivery Protection
  // ============================================================================
  it('prevents late out-of-order failed events from reverting captured payment status', async () => {
    const orderId = `order_ooo_${generateUuidV7().replace(/-/g, '')}`;
    const intentId = generateUuidV7();

    await prisma.paymentIntent.create({
      data: {
        id: intentId,
        projectId: verifiedProjectId,
        clientId: brandUserId,
        amount: 30000,
        currency: 'INR',
        platformFee: 3000,
        status: 'SUCCEEDED', // Already succeeded!
        provider: 'RAZORPAY',
        providerOrderId: orderId,
        version: 1,
      },
    });

    const secret = process.env.PAYMENT_WEBHOOK_SECRET || 'mock_webhook_secret_dev_key';
    const failedPayloadObj = {
      id: `evt_ooo_${generateUuidV7().replace(/-/g, '')}`,
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: `pay_ooo_${generateUuidV7().replace(/-/g, '')}`,
            order_id: orderId,
            amount: 30000,
            currency: 'INR',
            status: 'failed',
            error_description: 'Card declined (delayed notification)',
          },
        },
      },
    };

    const rawFailed = JSON.stringify(failedPayloadObj);
    const sigFailed = crypto.createHmac('sha256', secret).update(rawFailed).digest('hex');

    const resFailed = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/RAZORPAY',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': sigFailed,
      },
      payload: rawFailed,
    });
    expect(resFailed.statusCode).toBe(200);

    // Assert that payment intent status remains SUCCEEDED and was NOT reverted to FAILED
    const intentAfter = await prisma.paymentIntent.findUniqueOrThrow({
      where: { id: intentId },
    });
    expect(intentAfter.status).toBe('SUCCEEDED');
  });

  // ============================================================================
  // Test 3C: Webhook Crash Self-Healing and Retry Recovery
  // ============================================================================
  it('resumes and completes event processing when matching webhook retries after PROCESSING state', async () => {
    const eventId = `evt_crash_${generateUuidV7().replace(/-/g, '')}`;
    const orderId = `order_crash_${generateUuidV7().replace(/-/g, '')}`;
    const intentId = generateUuidV7();

    await prisma.paymentIntent.create({
      data: {
        id: intentId,
        projectId: verifiedProjectId,
        clientId: brandUserId,
        amount: 40000,
        currency: 'INR',
        platformFee: 4000,
        status: 'REQUIRES_CAPTURE',
        provider: 'RAZORPAY',
        providerOrderId: orderId,
        version: 1,
      },
    });

    const secret = process.env.PAYMENT_WEBHOOK_SECRET || 'mock_webhook_secret_dev_key';
    const payloadObj = {
      id: eventId,
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_crash_${generateUuidV7().replace(/-/g, '')}`,
            order_id: orderId,
            amount: 40000,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    };
    const rawBody = JSON.stringify(payloadObj);
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    // Simulate an interrupted run that left the event in PROCESSING status in DB
    await prisma.paymentWebhookEvent.create({
      data: {
        id: generateUuidV7(),
        provider: 'RAZORPAY',
        eventId,
        eventType: 'payment.captured',
        payload: payloadObj,
        signature,
        status: 'PROCESSING',
      },
    });

    // Provider retries identical webhook after previous timeout
    const resRetry = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/RAZORPAY',
      headers: {
        'content-type': 'application/json',
        'x-razorpay-signature': signature,
      },
      payload: rawBody,
    });
    expect(resRetry.statusCode).toBe(200);

    // Event should now be PROCESSED and intent SUCCEEDED
    const eventRecord = await prisma.paymentWebhookEvent.findUniqueOrThrow({
      where: {
        provider_eventId: {
          provider: 'RAZORPAY',
          eventId,
        },
      },
    });
    expect(eventRecord.status).toBe('PROCESSED');

    const intentAfter = await prisma.paymentIntent.findUniqueOrThrow({
      where: { id: intentId },
    });
    expect(intentAfter.status).toBe('SUCCEEDED');
  });

  // ============================================================================
  // Test 4: Tenant Isolation & Horizontal/Vertical Authorization Boundary
  // ============================================================================
  it('enforces object-level tenant boundaries: bystanders cannot access or mutate project', async () => {
    // 1. Bystander tries to release escrow on another user's project -> 403
    const resBystanderRelease = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/projects/${verifiedProjectId}/escrow/release`,
      headers: {
        authorization: `Bearer ${bystanderToken}`,
        'content-type': 'application/json',
      },
      payload: {},
    });
    expect(resBystanderRelease.statusCode).toBe(403);

    // 2. Bystander tries to request refund on another user's payment intent -> 403
    const resBystanderRefund = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/intents/${verifiedPaymentIntentId}/refunds`,
      headers: {
        authorization: `Bearer ${bystanderToken}`,
        'content-type': 'application/json',
      },
      payload: {
        amount: 5000,
        reason: 'CLIENT_REQUESTED',
      },
    });
    expect(resBystanderRefund.statusCode).toBe(403);

    // 3. Creator tries to release escrow (only Brand owner can release) -> 403
    const resCreatorRelease = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/projects/${verifiedProjectId}/escrow/release`,
      headers: {
        authorization: `Bearer ${creatorToken}`,
        'content-type': 'application/json',
      },
      payload: {},
    });
    expect(resCreatorRelease.statusCode).toBe(403);

    // 4. Non-admin caller tries to invoke admin reconciliation endpoint -> 403
    const fakeRefundId = generateUuidV7();
    const resNonAdminReconcile = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/refunds/${fakeRefundId}/reconcile`,
      headers: {
        authorization: `Bearer ${brandToken}`, // Brand is not ADMIN
        'content-type': 'application/json',
      },
      payload: {
        resolution: 'FAILED',
        notes: 'Unauthorized reconciliation attempt',
      },
    });
    expect(resNonAdminReconcile.statusCode).toBe(403);
  });

  // ============================================================================
  // Test 5: Suspended Account Enforcement
  // ============================================================================
  it('blocks suspended accounts from performing mutations with 403 USER_SUSPENDED', async () => {
    const resSuspended = await app.inject({
      method: 'POST',
      url: '/api/v1/disputes',
      headers: {
        authorization: `Bearer ${suspendedToken}`,
        'content-type': 'application/json',
      },
      payload: {
        projectId: verifiedProjectId,
        reason: 'SCOPE_MISMATCH',
        description: 'Suspended user trying to dispute',
      },
    });

    expect(resSuspended.statusCode).toBe(403);
    const body = JSON.parse(resSuspended.payload);
    expect(body.code).toBe('USER_SUSPENDED');
  });

  // ============================================================================
  // Test 6: Mass-Assignment Protection on Financial & Status Fields
  // ============================================================================
  it('strips or rejects client-supplied privileged/state fields in DTOs', async () => {
    // Seed a deliverable on the verified project
    const delivId = generateUuidV7();
    await prisma.projectDeliverable.create({
      data: {
        id: delivId,
        projectId: verifiedProjectId,
        title: 'Initial Deliverable',
        description: 'Pending work',
        amount: 50000,
        status: 'PENDING',
      },
    });

    // Creator submits deliverable notes with an injected status: 'APPROVED'
    const resDeliverable = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${verifiedProjectId}/deliverables/${delivId}/submit`,
      headers: {
        authorization: `Bearer ${creatorToken}`,
        'content-type': 'application/json',
      },
      payload: {
        submissionNotes: 'Trying to mass-assign status',
        status: 'APPROVED', // Attacker injects privileged field!
      },
    });

    expect(resDeliverable.statusCode).toBe(200);
    const body = JSON.parse(resDeliverable.payload);
    // Crucial check: status MUST NOT be APPROVED! It must be SUBMITTED
    expect(body.status).toBe('SUBMITTED');
  });

  // ============================================================================
  // Test 7: Excess Refund Rejection & Conservation
  // ============================================================================
  it('rejects refund request exceeding total remaining refundable balance with 400', async () => {
    // Current capturable is 100,000 paise. Requesting 100,001 paise.
    const resExcess = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/intents/${verifiedPaymentIntentId}/refunds`,
      headers: {
        authorization: `Bearer ${brandToken}`,
        'content-type': 'application/json',
      },
      payload: {
        amount: 100001, // 1 paisa over the capturable balance!
        reason: 'CLIENT_REQUESTED',
      },
    });

    expect(resExcess.statusCode).toBe(400);
    const body = JSON.parse(resExcess.payload);
    expect(body.code).toBe('REFUND_EXCEEDS_CAPTURABLE_AMOUNT');
  });

  // ============================================================================
  // Test 8: Monetary Overflow Boundary Testing (PostgreSQL INTEGER Safety)
  // ============================================================================
  it('rejects monetary amounts exceeding signed 32-bit integer maximum at validation boundary with 400', async () => {
    // 2,147,483,648 is MAX_INT_32 + 1. It must be rejected by MinorUnitsSchema with 400
    // rather than causing an unhandled PostgreSQL 22003 integer out of range crash.
    const resOverflow = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/intents',
      headers: {
        authorization: `Bearer ${brandToken}`,
        'content-type': 'application/json',
      },
      payload: {
        projectId: verifiedProjectId,
        amount: 2147483648, // Exceeds signed 32-bit maximum!
        currency: 'INR',
      },
    });

    expect(resOverflow.statusCode).toBe(400);
    const body = JSON.parse(resOverflow.payload);
    expect(body.status).toBe(400);
  });
});
