import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { getPrismaClient, RoleType, UserStatus } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import { buildApp } from '../../../app.js';
import { defaultJwtVerifier } from '../../../services/jwt-verifier.js';
import { ledgerService } from '../../payments/ledger/ledger.service.js';
import {
  createTestJwt,
  createTestKeySet,
} from '../../../../../../tests/fixtures/auth-test-helper.js';

describe('Workstream B — Financial Four-Eyes Concurrency, Locking & Idempotency', () => {
  let app: FastifyInstance;
  const prisma = getPrismaClient();

  const createdUserIds: string[] = [];
  const createdProjectIds: string[] = [];
  const createdPaymentIntentIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const createdApplicationIds: string[] = [];
  const createdIdempotencyKeys: string[] = [];

  let requesterAdmin: { id: string; token: string };
  let approverAdminA: { id: string; token: string };
  let approverAdminB: { id: string; token: string };
  let clientUserId: string;
  let creatorUserId: string;

  async function seedPaymentWithEscrow(amountMinor: number, platformFeeMinor: number) {
    const projectId = generateUuidV7();
    const assignmentId = generateUuidV7();
    const applicationId = generateUuidV7();
    const paymentIntentId = generateUuidV7();
    const brandProfileId = (
      await prisma.brandProfile.findFirstOrThrow({
        where: { userId: clientUserId },
        select: { id: true },
      })
    ).id;

    createdAssignmentIds.push(assignmentId);
    createdApplicationIds.push(applicationId);
    createdProjectIds.push(projectId);
    createdPaymentIntentIds.push(paymentIntentId);

    await prisma.assignment.create({
      data: {
        id: assignmentId,
        brandId: brandProfileId,
        title: `Concurrency Test Project ${projectId.slice(0, 8)}`,
        description: 'Testing four-eyes locking & idempotency',
        budgetMin: amountMinor,
        budgetMax: amountMinor,
        currency: 'INR',
        deadline: new Date(Date.now() + 86400000 * 14),
      },
    });

    await prisma.application.create({
      data: {
        id: applicationId,
        assignmentId,
        applicantId: creatorUserId,
        coverLetter: 'Test cover letter',
        proposedRate: amountMinor,
        currency: 'INR',
      },
    });

    await prisma.project.create({
      data: {
        id: projectId,
        applicationId,
        assignmentId,
        clientId: clientUserId,
        talentId: creatorUserId,
        title: `Escrow Project ${projectId.slice(0, 8)}`,
        totalAmount: amountMinor,
        currency: 'INR',
      },
    });

    await prisma.paymentIntent.create({
      data: {
        id: paymentIntentId,
        projectId,
        clientId: clientUserId,
        amount: amountMinor,
        platformFee: platformFeeMinor,
        currency: 'INR',
        status: 'SUCCEEDED',
        provider: 'SANDBOX_MOCK',
        providerOrderId: `ord_wb_${paymentIntentId.slice(0, 8)}`,
        providerPaymentId: `pay_wb_${paymentIntentId.slice(0, 8)}`,
      },
    });

    await ledgerService.postTransaction({
      paymentIntentId,
      type: 'PAYMENT_CAPTURE',
      description: 'Seed escrow holding for Workstream B concurrency tests',
      entries: [
        {
          accountCode: `ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK`,
          accountType: 'ASSET',
          direction: 'DEBIT',
          amount: amountMinor,
          currency: 'INR',
        },
        {
          accountCode: `LIABILITIES:ESCROW_HOLDING:${projectId}`,
          accountType: 'LIABILITY',
          direction: 'CREDIT',
          amount: amountMinor - platformFeeMinor,
          currency: 'INR',
          projectId,
        },
        {
          accountCode: 'REVENUE:PLATFORM_FEE',
          accountType: 'REVENUE',
          direction: 'CREDIT',
          amount: platformFeeMinor,
          currency: 'INR',
        },
      ],
    });

    return { projectId, paymentIntentId };
  }

  beforeAll(async () => {
    const testKeySet = await createTestKeySet();
    defaultJwtVerifier.setKeySet(testKeySet);

    app = await buildApp();
    await app.ready();

    const ts = Date.now();
    const provisionAdmin = async (tag: string) => {
      const id = generateUuidV7();
      const sub = `sub_wb_${tag}_${ts}_${id.slice(0, 6)}`;
      const email = `wb_${tag}_${ts}_${id.slice(0, 6)}@test.invalid`;
      createdUserIds.push(id);
      await prisma.user.create({
        data: {
          id,
          supabaseAuthId: sub,
          email,
          status: UserStatus.ACTIVE,
          userRoles: {
            create: { id: generateUuidV7(), role: { connect: { name: RoleType.ADMIN } } },
          },
          adminUserRoles: {
            create: { id: generateUuidV7(), role: { connect: { name: 'FINANCE_ADMIN' } } },
          },
        },
      });
      const token = await createTestJwt({ sub, email });
      return { id, token };
    };

    requesterAdmin = await provisionAdmin('req');
    approverAdminA = await provisionAdmin('appA');
    approverAdminB = await provisionAdmin('appB');

    clientUserId = generateUuidV7();
    createdUserIds.push(clientUserId);
    await prisma.user.create({
      data: {
        id: clientUserId,
        supabaseAuthId: `sub_wb_client_${ts}`,
        email: `wb_client_${ts}@test.invalid`,
        status: UserStatus.ACTIVE,
        userRoles: {
          create: { id: generateUuidV7(), role: { connect: { name: RoleType.BRAND } } },
        },
        brandProfile: { create: { id: generateUuidV7(), companyName: 'Workstream B Co' } },
      },
    });

    creatorUserId = generateUuidV7();
    createdUserIds.push(creatorUserId);
    await prisma.user.create({
      data: {
        id: creatorUserId,
        supabaseAuthId: `sub_wb_creator_${ts}`,
        email: `wb_creator_${ts}@test.invalid`,
        status: UserStatus.ACTIVE,
        userRoles: {
          create: { id: generateUuidV7(), role: { connect: { name: RoleType.CREATOR } } },
        },
      },
    });
  });

  afterAll(async () => {
    for (const piId of createdPaymentIntentIds) {
      const refunds = await prisma.refund.findMany({
        where: { paymentIntentId: piId },
        select: { id: true },
      });
      for (const r of refunds) {
        await prisma.outboxEvent.deleteMany({ where: { aggregateId: r.id } });
        await prisma.auditLog.deleteMany({ where: { entityId: r.id } });
        await prisma.adminActionApproval.deleteMany({ where: { targetEntityId: r.id } });
      }
      const ledgerTxs = await prisma.ledgerTransaction.findMany({
        where: { paymentIntentId: piId },
        select: { id: true },
      });
      if (ledgerTxs.length > 0) {
        const txIds = ledgerTxs.map((t) => t.id);
        const entriesToRemove = await prisma.ledgerEntry.findMany({
          where: { transactionId: { in: txIds } },
          include: { account: { select: { id: true, type: true } } },
        });
        await prisma.$transaction(async (tx) => {
          for (const entry of entriesToRemove) {
            const isDebitNormal =
              entry.account.type === 'ASSET' || entry.account.type === 'EXPENSE';
            const delta = isDebitNormal
              ? entry.direction === 'DEBIT'
                ? -entry.amount
                : entry.amount
              : entry.direction === 'CREDIT'
                ? -entry.amount
                : entry.amount;
            await tx.ledgerAccount.update({
              where: { id: entry.accountId },
              data: { balance: { increment: delta } },
            });
          }
          await tx.ledgerEntry.deleteMany({
            where: { transactionId: { in: txIds } },
          });
          await tx.ledgerTransaction.deleteMany({
            where: { id: { in: txIds } },
          });
        });
      }
      await prisma.refund.deleteMany({ where: { paymentIntentId: piId } });
      await prisma.paymentIntent.deleteMany({ where: { id: piId } });
    }
    for (const pId of createdProjectIds) {
      await prisma.ledgerAccount.deleteMany({
        where: { code: `LIABILITIES:ESCROW_HOLDING:${pId}` },
      });
      await prisma.project.deleteMany({ where: { id: pId } });
    }
    if (createdApplicationIds.length > 0) {
      await prisma.application.deleteMany({ where: { id: { in: createdApplicationIds } } });
    }
    if (createdAssignmentIds.length > 0) {
      await prisma.assignment.deleteMany({ where: { id: { in: createdAssignmentIds } } });
    }
    if (createdIdempotencyKeys.length > 0) {
      const allHashes: string[] = [];
      for (const key of createdIdempotencyKeys) {
        for (const uid of [requesterAdmin.id, approverAdminA.id, approverAdminB.id]) {
          allHashes.push(crypto.createHash('sha256').update(`${uid}:${key}`).digest('hex'));
        }
      }
      await prisma.idempotencyRecord.deleteMany({ where: { key: { in: allHashes } } });
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

  it('prevents simultaneous double-approval of a dual-approval refund (strictly 1x 200, 1x 409, single ledger tx & outbox event)', async () => {
    const { paymentIntentId } = await seedPaymentWithEscrow(10_000_000, 1_000_000);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/refunds',
      headers: { authorization: `Bearer ${requesterAdmin.token}` },
      payload: {
        paymentIntentId,
        amountMinor: 6_000_000,
        reason: 'CLIENT_REQUESTED',
        notes: 'High-value refund concurrency race test.',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const refund = createRes.json();

    const [resA, resB] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/admin/refunds/${refund.id}/approve`,
        headers: { authorization: `Bearer ${approverAdminA.token}` },
        payload: { reason: 'Approver A reviewed documentation and approved.' },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/admin/refunds/${refund.id}/approve`,
        headers: { authorization: `Bearer ${approverAdminB.token}` },
        payload: { reason: 'Approver B reviewed documentation and approved.' },
      }),
    ]);

    const statuses = [resA.statusCode, resB.statusCode].sort();
    expect(statuses).toEqual([200, 409]);

    const refundTxs = await prisma.ledgerTransaction.findMany({
      where: { paymentIntentId, type: 'PAYMENT_REFUND_ADMIN' },
    });
    expect(refundTxs).toHaveLength(1);

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: { aggregateId: refund.id, eventType: 'refund.succeeded.v1' },
    });
    expect(outboxEvents).toHaveLength(1);
  });

  it('serializes simultaneous APPROVE vs REJECT decisions on the same pending refund without split brain', async () => {
    const { paymentIntentId } = await seedPaymentWithEscrow(10_000_000, 1_000_000);

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/refunds',
      headers: { authorization: `Bearer ${requesterAdmin.token}` },
      payload: {
        paymentIntentId,
        amountMinor: 6_500_000,
        reason: 'PROJECT_CANCELLED',
        notes: 'Conflicting dual-decision test.',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const refund = createRes.json();

    const [approveRes, rejectRes] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/v1/admin/refunds/${refund.id}/approve`,
        headers: { authorization: `Bearer ${approverAdminA.token}` },
        payload: { reason: 'Approver A chose approve.' },
      }),
      app.inject({
        method: 'POST',
        url: `/api/v1/admin/refunds/${refund.id}/reject`,
        headers: { authorization: `Bearer ${approverAdminB.token}` },
        payload: { reason: 'Approver B chose reject.' },
      }),
    ]);

    expect([approveRes.statusCode, rejectRes.statusCode].sort()).toEqual([200, 409]);

    const approval = await prisma.adminActionApproval.findFirstOrThrow({
      where: { targetEntity: 'Refund', targetEntityId: refund.id },
    });
    const dbRefund = await prisma.refund.findUniqueOrThrow({ where: { id: refund.id } });
    if (approval.status === 'APPROVED') {
      expect(dbRefund.status).toBe('SUCCEEDED');
    } else {
      expect(approval.status).toBe('REJECTED');
      expect(dbRefund.status).toBe('FAILED');
    }
  });

  it('prevents concurrent over-refunding above remaining payment balance via payment_intents row locks', async () => {
    const { paymentIntentId } = await seedPaymentWithEscrow(5_000_000, 500_000);

    const [res1, res2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v1/admin/refunds',
        headers: { authorization: `Bearer ${requesterAdmin.token}` },
        payload: {
          paymentIntentId,
          amountMinor: 3_000_000,
          reason: 'ADMIN_ADJUSTMENT',
          notes: 'Concurrent partial refund 1',
        },
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/admin/refunds',
        headers: { authorization: `Bearer ${approverAdminA.token}` },
        payload: {
          paymentIntentId,
          amountMinor: 3_000_000,
          reason: 'ADMIN_ADJUSTMENT',
          notes: 'Concurrent partial refund 2',
        },
      }),
    ]);

    expect([res1.statusCode, res2.statusCode].sort()).toEqual([201, 400]);

    const allRefunds = await prisma.refund.findMany({
      where: {
        paymentIntentId,
        status: { in: ['SUCCEEDED', 'REQUESTED', 'PENDING', 'PROCESSING'] },
      },
    });
    expect(allRefunds).toHaveLength(1);
    expect(allRefunds[0].amount).toBe(3_000_000);
  });

  it('supports Idempotency-Key deduplication, concurrent replay, payload conflict (409), and rollback on escrow failure', async () => {
    const { projectId, paymentIntentId } = await seedPaymentWithEscrow(10_000_000, 1_000_000);
    const createKey = `idem-create-${Date.now()}`;
    const decideKey = `idem-decide-${Date.now()}`;
    const emptyEscrowKey = `idem-escrow-fail-${Date.now()}`;
    createdIdempotencyKeys.push(createKey, decideKey, emptyEscrowKey);

    const createPayload = {
      paymentIntentId,
      amountMinor: 6_000_000,
      reason: 'CLIENT_REQUESTED' as const,
      notes: 'Idempotent refund creation test.',
    };

    // 1. Concurrent identical createRefund requests with the same Idempotency-Key return the exact same refund
    const [c1, c2] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/v1/admin/refunds',
        headers: {
          authorization: `Bearer ${requesterAdmin.token}`,
          'idempotency-key': createKey,
        },
        payload: createPayload,
      }),
      app.inject({
        method: 'POST',
        url: '/api/v1/admin/refunds',
        headers: {
          authorization: `Bearer ${requesterAdmin.token}`,
          'idempotency-key': createKey,
        },
        payload: createPayload,
      }),
    ]);
    expect(c1.statusCode).toBe(201);
    expect(c2.statusCode).toBe(201);
    expect(c1.json().id).toBe(c2.json().id);

    // 2. Reusing same create Idempotency-Key with different payload returns 409 IDEMPOTENCY_CONFLICT
    const conflictCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/refunds',
      headers: {
        authorization: `Bearer ${requesterAdmin.token}`,
        'idempotency-key': createKey,
      },
      payload: { ...createPayload, amountMinor: 6_100_000 },
    });
    expect(conflictCreate.statusCode).toBe(409);
    expect(conflictCreate.json().code).toBe('IDEMPOTENCY_CONFLICT');

    // 3. Idempotent retry on approve returns cached 200 without double ledger entry; modified payload returns 409
    const refundId = c1.json().id;
    const approvePayload = { reason: 'Independent approval confirmed.' };
    const app1 = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/refunds/${refundId}/approve`,
      headers: {
        authorization: `Bearer ${approverAdminA.token}`,
        'idempotency-key': decideKey,
      },
      payload: approvePayload,
    });
    const app2 = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/refunds/${refundId}/approve`,
      headers: {
        authorization: `Bearer ${approverAdminA.token}`,
        'idempotency-key': decideKey,
      },
      payload: approvePayload,
    });
    expect(app1.statusCode).toBe(200);
    expect(app2.statusCode).toBe(200);
    expect(app1.json().status).toBe('SUCCEEDED');

    const conflictDecide = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/refunds/${refundId}/reject`,
      headers: {
        authorization: `Bearer ${approverAdminA.token}`,
        'idempotency-key': decideKey,
      },
      payload: approvePayload,
    });
    expect(conflictDecide.statusCode).toBe(409);
    expect(conflictDecide.json().code).toBe('IDEMPOTENCY_CONFLICT');

    // 4. Simulated escrow depletion triggers atomic rollback including idempotency cache (retryable cleanly)
    await ledgerService.postTransaction({
      paymentIntentId,
      type: 'MILESTONE_PAYOUT',
      description: 'Drain remaining escrow to force refund ledger failure',
      entries: [
        {
          accountCode: `LIABILITIES:ESCROW_HOLDING:${projectId}`,
          accountType: 'LIABILITY',
          direction: 'DEBIT',
          amount: 3_600_000,
          currency: 'INR',
          projectId,
        },
        {
          accountCode: `ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK`,
          accountType: 'ASSET',
          direction: 'CREDIT',
          amount: 3_600_000,
          currency: 'INR',
        },
      ],
    });

    const failedAutoRefund = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/refunds',
      headers: {
        authorization: `Bearer ${approverAdminB.token}`,
        'idempotency-key': emptyEscrowKey,
      },
      payload: {
        paymentIntentId,
        amountMinor: 1_000_000,
        reason: 'CLIENT_REQUESTED',
        notes: 'Should roll back on insufficient escrow',
      },
    });
    expect(failedAutoRefund.statusCode).toBe(400);

    // Ensure idempotency record was NOT committed on rolled-back error
    const scopedFailKey = crypto
      .createHash('sha256')
      .update(`${approverAdminB.id}:${emptyEscrowKey}`)
      .digest('hex');
    const cachedFailRecord = await prisma.idempotencyRecord.findUnique({
      where: { scope_key: { scope: 'admin_refund_create', key: scopedFailKey } },
    });
    expect(cachedFailRecord).toBeNull();

    // 5. After replenishing escrow, retrying the EXACT same Idempotency-Key succeeds cleanly
    await ledgerService.postTransaction({
      paymentIntentId,
      type: 'ADJUSTMENT',
      description: 'Replenish escrow for retry verification',
      entries: [
        {
          accountCode: `ASSETS:PROCESSOR_CLEARING:SANDBOX_MOCK`,
          accountType: 'ASSET',
          direction: 'DEBIT',
          amount: 1_000_000,
          currency: 'INR',
        },
        {
          accountCode: `LIABILITIES:ESCROW_HOLDING:${projectId}`,
          accountType: 'LIABILITY',
          direction: 'CREDIT',
          amount: 1_000_000,
          currency: 'INR',
          projectId,
        },
      ],
    });

    const retryRecovered = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/refunds',
      headers: {
        authorization: `Bearer ${approverAdminB.token}`,
        'idempotency-key': emptyEscrowKey,
      },
      payload: {
        paymentIntentId,
        amountMinor: 1_000_000,
        reason: 'CLIENT_REQUESTED',
        notes: 'Should roll back on insufficient escrow',
      },
    });
    expect(retryRecovered.statusCode).toBe(201);
    expect(retryRecovered.json().status).toBe('SUCCEEDED');
  });
});
