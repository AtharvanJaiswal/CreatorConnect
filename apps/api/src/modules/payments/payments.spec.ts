import crypto from 'node:crypto';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../app.js';
import { defaultJwtVerifier } from '../../services/jwt-verifier.js';
import { createTestJwt, createTestKeySet } from '../../../../../tests/fixtures/auth-test-helper.js';
import { ledgerService } from './ledger/ledger.service.js';

describe('Phase 6 Increment 2: Payments, Ledger & Escrow Integration Tests', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  let clientUserId: string;
  let clientToken: string;
  let clientBrandProfileId: string;

  let talentUserId: string;
  let talentToken: string;

  let bystanderUserId: string;
  let bystanderToken: string;

  let projectId: string;
  let deliverableId: string;
  let assignmentId: string;
  let applicationId: string;

  const testWebhookSecret = 'mock_webhook_secret_dev_key';

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    // 1. Client User with BRAND profile
    clientUserId = generateUuidV7();
    clientBrandProfileId = generateUuidV7();
    clientToken = await createTestJwt({
      sub: `sub_pay_client_${generateUuidV7().replace(/-/g, '')}`,
      email: `pay_client_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedClient: any = await defaultJwtVerifier.verifyToken(clientToken);
    await prisma.user.create({
      data: {
        id: clientUserId,
        supabaseAuthId: decodedClient.sub,
        email: decodedClient.email,
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
            companyName: 'FinTech Media Group',
          },
        },
      },
    });

    // 2. Talent User
    talentUserId = generateUuidV7();
    talentToken = await createTestJwt({
      sub: `sub_pay_talent_${generateUuidV7().replace(/-/g, '')}`,
      email: `pay_talent_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedTalent: any = await defaultJwtVerifier.verifyToken(talentToken);
    await prisma.user.create({
      data: {
        id: talentUserId,
        supabaseAuthId: decodedTalent.sub,
        email: decodedTalent.email,
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

    // 3. Bystander User
    bystanderUserId = generateUuidV7();
    bystanderToken = await createTestJwt({
      sub: `sub_pay_by_${generateUuidV7().replace(/-/g, '')}`,
      email: `pay_by_${generateUuidV7().replace(/-/g, '')}@test.com`,
    });
    const decodedBy: any = await defaultJwtVerifier.verifyToken(bystanderToken);
    await prisma.user.create({
      data: {
        id: bystanderUserId,
        supabaseAuthId: decodedBy.sub,
        email: decodedBy.email,
        status: 'ACTIVE',
      },
    });

    // 4. Assignment & Accepted Application
    assignmentId = generateUuidV7();
    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: clientBrandProfileId,
        title: 'Escrow FinTech Campaign',
        description: 'Payment escrow test assignment',
        budgetMin: 50000,
        budgetMax: 100000,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        status: 'IN_PROGRESS',
      },
    });

    applicationId = generateUuidV7();
    await prisma.application.create({
      data: {
        id: applicationId,
        assignmentId,
        applicantId: talentUserId,
        coverLetter: 'Escrow contract application',
        proposedRate: 80000,
        status: 'ACCEPTED',
        version: 1,
      },
    });

    // 5. Project & Milestone Deliverable
    projectId = generateUuidV7();
    deliverableId = generateUuidV7();
    await prisma.project.create({
      data: {
        id: projectId,
        assignmentId,
        applicationId,
        clientId: clientUserId,
        talentId: talentUserId,
        title: 'FinTech Escrow Contract',
        totalAmount: 80000,
        currency: 'INR',
        status: 'IN_PROGRESS',
        version: 1,
        deliverables: {
          create: [
            {
              id: deliverableId,
              title: 'Milestone 1: Deliverable',
              amount: 80000,
              status: 'PENDING',
              version: 1,
            },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ============================================================================
  // Section A: Double-Entry Immutable Balanced Ledger Tests
  // ============================================================================

  it('rejects unbalanced ledger transaction where debits do not equal credits', async () => {
    await expect(
      ledgerService.postTransaction({
        type: 'UNBALANCED_TEST',
        entries: [
          {
            accountCode: 'ASSETS:BANK_CLEARING',
            accountType: 'ASSET',
            direction: 'DEBIT',
            amount: 50000,
            currency: 'INR',
          },
          {
            accountCode: 'LIABILITIES:ESCROW_HOLDING:TEST',
            accountType: 'LIABILITY',
            direction: 'CREDIT',
            amount: 40000, // Discrepancy of 10000
            currency: 'INR',
          },
        ],
      }),
    ).rejects.toThrow(/unbalanced/i);
  });

  it('rejects ledger transaction with non-positive or floating point amounts', async () => {
    await expect(
      ledgerService.postTransaction({
        type: 'INVALID_AMOUNT_TEST',
        entries: [
          {
            accountCode: 'ASSETS:BANK_CLEARING',
            accountType: 'ASSET',
            direction: 'DEBIT',
            amount: -100,
            currency: 'INR',
          },
          {
            accountCode: 'LIABILITIES:ESCROW_HOLDING:TEST',
            accountType: 'LIABILITY',
            direction: 'CREDIT',
            amount: -100,
            currency: 'INR',
          },
        ],
      }),
    ).rejects.toThrow(/invalid.*positive integer/i);
  });

  it('successfully posts balanced ledger transaction and emits outbox event', async () => {
    const testAccountCode = `ASSETS:TEST_SETTLEMENT_${generateUuidV7().replace(/-/g, '')}`;
    const tx = await ledgerService.postTransaction({
      type: 'INITIAL_CAPITAL',
      description: 'Test balanced journal entry',
      entries: [
        {
          accountCode: testAccountCode,
          accountType: 'ASSET',
          direction: 'DEBIT',
          amount: 15000,
          currency: 'INR',
        },
        {
          accountCode: `EQUITY:TEST_RETAINED_${generateUuidV7().replace(/-/g, '')}`,
          accountType: 'EQUITY',
          direction: 'CREDIT',
          amount: 15000,
          currency: 'INR',
        },
      ],
    });

    expect(tx.id).toBeDefined();
    expect(tx.entries).toHaveLength(2);

    const assetAcc = await ledgerService.getAccount(testAccountCode);
    expect(assetAcc.balance).toBe('15000');

    const outbox = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: tx.id,
        eventType: 'ledger.transaction.posted.v1',
      },
    });
    expect(outbox).toBeDefined();
    expect(outbox?.status).toBe('PENDING');
  });

  // ============================================================================
  // Section B: Idempotent Payment Intent Creation & Authorization
  // ============================================================================

  let createdIntentId: string;
  let orderId: string;
  const testIdempotencyKey = `idem_key_${generateUuidV7().replace(/-/g, '')}`;

  it('rejects payment intent creation from non-client user with 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/intents',
      headers: { authorization: `Bearer ${talentToken}` },
      payload: {
        projectId,
        amount: 80000,
        currency: 'INR',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('successfully creates idempotent payment intent for project with outbox event', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/intents',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        projectId,
        deliverableId,
        amount: 80000,
        currency: 'INR',
        provider: 'SANDBOX_MOCK',
        idempotencyKey: testIdempotencyKey,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.id).toBeDefined();
    expect(body.projectId).toBe(projectId);
    expect(body.amount).toBe(80000);
    expect(body.platformFee).toBe(8000); // 10%
    expect(body.status).toBe('REQUIRES_PAYMENT_METHOD');
    expect(body.providerOrderId).toBeDefined();
    expect(body.clientSecret).toBeDefined();

    createdIntentId = body.id;
    orderId = body.providerOrderId;

    const outbox = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: createdIntentId,
        eventType: 'payment.intent.created.v1',
      },
    });
    expect(outbox).toBeDefined();
  });

  it('returns cached response when identical idempotency key is re-sent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/intents',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        projectId,
        deliverableId,
        amount: 80000,
        currency: 'INR',
        provider: 'SANDBOX_MOCK',
        idempotencyKey: testIdempotencyKey,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(createdIntentId); // Identical cached resource
  });

  it('rejects reuse of idempotency key with modified request payload with 409 Conflict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/intents',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        projectId,
        deliverableId,
        amount: 50000, // Altered amount!
        currency: 'INR',
        provider: 'SANDBOX_MOCK',
        idempotencyKey: testIdempotencyKey,
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('allows client and talent to inspect payment intent details', async () => {
    const clientRes = await app.inject({
      method: 'GET',
      url: `/api/v1/payments/intents/${createdIntentId}`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(clientRes.statusCode).toBe(200);
    expect(clientRes.json().id).toBe(createdIntentId);

    const talentRes = await app.inject({
      method: 'GET',
      url: `/api/v1/payments/intents/${createdIntentId}`,
      headers: { authorization: `Bearer ${talentToken}` },
    });
    expect(talentRes.statusCode).toBe(200);

    const bystanderRes = await app.inject({
      method: 'GET',
      url: `/api/v1/payments/intents/${createdIntentId}`,
      headers: { authorization: `Bearer ${bystanderToken}` },
    });
    expect(bystanderRes.statusCode).toBe(403);
  });

  // ============================================================================
  // Section C: Payment Confirmation, Ledger Escrow Posting & Query
  // ============================================================================

  it('confirms payment intent, transitions to SUCCEEDED, and records balanced escrow entries', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/intents/${createdIntentId}/confirm`,
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        providerPaymentId: 'pay_mock_confirmed_123',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('SUCCEEDED');
    expect(body.providerPaymentId).toBe('pay_mock_confirmed_123');

    // Verify ledger escrow holding account has 72000 (80000 - 8000 fee)
    const escrowRes = await app.inject({
      method: 'GET',
      url: `/api/v1/payments/projects/${projectId}/escrow`,
      headers: { authorization: `Bearer ${clientToken}` },
    });
    expect(escrowRes.statusCode).toBe(200);
    expect(escrowRes.json().balance).toBe(72000);

    // Verify platform fee account has 8000
    const feeAcc = await ledgerService.getAccount('REVENUE:PLATFORM_FEE');
    expect(Number(feeAcc.balance)).toBeGreaterThanOrEqual(8000);

    // Verify outbox event emitted
    const outbox = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: createdIntentId,
        eventType: 'payment.intent.succeeded.v1',
      },
    });
    expect(outbox).toBeDefined();
  });

  // ============================================================================
  // Section D: Signed Webhook Ingestion & Deduplication
  // ============================================================================

  it('rejects provider webhook with invalid signature with 400', async () => {
    const rawPayload = JSON.stringify({
      id: 'evt_tampered_001',
      event: 'payment.captured',
      payload: {
        order: { id: orderId },
        payment: { id: 'pay_tampered_001', amount: 80000, currency: 'INR' },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/SANDBOX_MOCK',
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': 'invalid_bad_hex_signature',
      },
      payload: rawPayload,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('INVALID_WEBHOOK_SIGNATURE');
  });

  it('processes valid signed provider webhook and deduplicates replayed events', async () => {
    // Create a new separate payment intent for webhook testing
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/intents',
      headers: { authorization: `Bearer ${clientToken}` },
      payload: {
        projectId,
        amount: 25000,
        currency: 'INR',
        provider: 'SANDBOX_MOCK',
      },
    });
    const webhookIntent = createRes.json();
    const webhookOrderId = webhookIntent.providerOrderId;

    const webhookEventId = `evt_valid_${generateUuidV7().substring(0, 10)}`;
    const rawPayload = JSON.stringify({
      id: webhookEventId,
      event: 'payment.captured',
      payload: {
        order: { id: webhookOrderId },
        payment: {
          id: `pay_wh_${generateUuidV7().substring(0, 8)}`,
          amount: 25000,
          currency: 'INR',
        },
      },
    });

    const validSignature = crypto
      .createHmac('sha256', testWebhookSecret)
      .update(rawPayload)
      .digest('hex');

    // First webhook delivery
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/SANDBOX_MOCK',
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': validSignature,
      },
      payload: rawPayload,
    });

    expect(res1.statusCode).toBe(200);
    expect(res1.json().received).toBe(true);
    expect(res1.json().status).toBe('PROCESSED');

    // Verify webhook payment intent transitioned to SUCCEEDED
    const intentCheck = await prisma.paymentIntent.findUnique({
      where: { id: webhookIntent.id },
    });
    expect(intentCheck?.status).toBe('SUCCEEDED');

    // Replayed duplicate webhook delivery with exact same event ID
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/v1/payments/webhooks/SANDBOX_MOCK',
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': validSignature,
      },
      payload: rawPayload,
    });

    expect(res2.statusCode).toBe(200);
    expect(res2.json().status).toBe('ALREADY_PROCESSED');
  });

  // ============================================================================
  // Section E: Milestone Escrow Release
  // ============================================================================

  it('releases funded project escrow to creator payable account and updates outbox', async () => {
    // Current escrow balance before release
    const balanceBefore = await ledgerService.getProjectEscrowBalance(projectId);
    expect(balanceBefore).toBeGreaterThan(0);

    const releaseRes = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/projects/${projectId}/escrow/release`,
      headers: { authorization: `Bearer ${clientToken}` },
    });

    expect(releaseRes.statusCode).toBe(200);
    expect(releaseRes.json().releasedAmount).toBe(balanceBefore);

    // Verify project escrow holding is now 0
    const balanceAfter = await ledgerService.getProjectEscrowBalance(projectId);
    expect(balanceAfter).toBe(0);

    // Verify creator payable balance equals released amount
    const creatorPayable = await ledgerService.getCreatorPayableBalance(talentUserId);
    expect(creatorPayable).toBe(balanceBefore);

    // Verify outbox event emitted
    const outbox = await prisma.outboxEvent.findFirst({
      where: {
        aggregateId: projectId,
        eventType: 'escrow.released.v1',
      },
    });
    expect(outbox).toBeDefined();
  });

  it('rejects escrow release when project has no remaining escrow balance with 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/payments/projects/${projectId}/escrow/release`,
      headers: { authorization: `Bearer ${clientToken}` },
    });

    expect(res.statusCode).toBe(400);
  });
});
