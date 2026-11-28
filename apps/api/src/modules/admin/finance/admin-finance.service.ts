import crypto from 'node:crypto';
import {
  type PrismaClient,
  getPrismaClient,
  RefundStatus,
  type RefundReason,
  type PaymentStatus,
  type PaymentProvider,
  Prisma,
} from '@creatorconnect/database';
import { generateUuidV7, calculateCumulativeFeeReversal } from '@creatorconnect/utils';
import { ledgerService, type LedgerService } from '../../payments/ledger/ledger.service.js';
import { idempotencyService, type IdempotencyService } from '../../payments/idempotency.service.js';
import type {
  AdminPaymentQuery,
  AdminPaymentListResponse,
  AdminPaymentListItem,
  AdminRefundQuery,
  AdminRefundListResponse,
  AdminRefundListItem,
  CreateRefundRequest,
  DecideRefundApprovalRequest,
  AdminReconciliationReport,
} from '@creatorconnect/contracts';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ConflictOfInterestError,
} from '../../../errors/app-error.js';

export const HIGH_VALUE_REFUND_THRESHOLD_PAISA = 5_000_000; // 50,000 INR

export class AdminFinanceService {
  private prisma: PrismaClient;
  private ledger: LedgerService;
  private idempotency: IdempotencyService;

  constructor(
    prismaClient?: PrismaClient,
    ledger?: LedgerService,
    idempotency?: IdempotencyService,
  ) {
    this.prisma = prismaClient || getPrismaClient();
    this.ledger = ledger || ledgerService;
    this.idempotency = idempotency || idempotencyService;
  }

  private normalizeIdempotencyKey(rawKey?: string): string | undefined {
    if (rawKey === undefined) {
      return undefined;
    }
    const trimmed = rawKey.trim();
    if (!trimmed) {
      throw new BadRequestError('Idempotency-Key header cannot be empty.');
    }
    if (trimmed.length > 128) {
      throw new BadRequestError('Idempotency-Key header exceeds maximum length of 128 characters.');
    }
    return trimmed;
  }

  private scopeAdminIdempotencyKey(adminUserId: string, idempotencyKey: string): string {
    return crypto.createHash('sha256').update(`${adminUserId}:${idempotencyKey}`).digest('hex');
  }

  private async executeRefundLedgerAndStatus(
    tx: Prisma.TransactionClient,
    payment: {
      id: string;
      projectId: string;
      amount: number;
      platformFee: number;
      currency: string;
      provider: string;
    },
    refundId: string,
    refundAmount: number,
  ): Promise<void> {
    const priorRefunds = await tx.refund.findMany({
      where: {
        paymentIntentId: payment.id,
        status: 'SUCCEEDED',
        id: { not: refundId },
      },
      select: { amount: true },
    });

    const priorFeeReversed = priorRefunds.reduce((acc, r) => {
      return (
        acc +
        (payment.amount > 0
          ? calculateCumulativeFeeReversal(r.amount, payment.platformFee, payment.amount)
          : 0)
      );
    }, 0);

    const totalRefundedSoFar = priorRefunds.reduce((acc, r) => acc + r.amount, 0) + refundAmount;
    const isFinalRefund = totalRefundedSoFar >= payment.amount;
    const feeReversal = isFinalRefund
      ? Math.max(0, payment.platformFee - priorFeeReversed)
      : payment.amount > 0
        ? calculateCumulativeFeeReversal(totalRefundedSoFar, payment.platformFee, payment.amount) -
          priorFeeReversed
        : 0;
    const escrowReversal = refundAmount - feeReversal;

    const currentEscrow = await this.ledger.getProjectEscrowBalance(payment.projectId, tx);
    if (currentEscrow < escrowReversal) {
      throw new BadRequestError(
        `Cannot process refund: Insufficient escrow balance (${currentEscrow}) to absorb escrow reversal (${escrowReversal}). Milestone funds may have already been released.`,
      );
    }

    await this.ledger.postTransaction(
      {
        paymentIntentId: payment.id,
        type: 'PAYMENT_REFUND_ADMIN',
        description: `Admin processed refund for payment ${payment.id}`,
        entries: [
          {
            accountCode: `LIABILITIES:ESCROW_HOLDING:${payment.projectId}`,
            accountType: 'LIABILITY',
            direction: 'DEBIT',
            amount: escrowReversal,
            currency: payment.currency,
            projectId: payment.projectId,
          },
          {
            accountCode: 'REVENUE:PLATFORM_FEE',
            accountType: 'REVENUE',
            direction: 'DEBIT',
            amount: feeReversal,
            currency: payment.currency,
          },
          {
            accountCode: `ASSETS:PROCESSOR_CLEARING:${payment.provider}`,
            accountType: 'ASSET',
            direction: 'CREDIT',
            amount: refundAmount,
            currency: payment.currency,
          },
        ],
      },
      tx,
    );

    const isFullyRefunded = totalRefundedSoFar >= payment.amount;

    await tx.paymentIntent.update({
      where: { id: payment.id },
      data: {
        status: isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        version: { increment: 1 },
      },
    });

    await tx.outboxEvent.create({
      data: {
        id: generateUuidV7(),
        eventType: 'refund.succeeded.v1',
        aggregateType: 'Refund',
        aggregateId: refundId,
        payload: {
          refundId,
          paymentIntentId: payment.id,
          projectId: payment.projectId,
          amount: refundAmount,
          provider: payment.provider,
          adminInitiated: true,
        },
      },
    });
  }

  // ==============================================================================
  // Payment Intention & Escrow Management
  // ==============================================================================

  public async listPayments(query: AdminPaymentQuery): Promise<AdminPaymentListResponse> {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status as PaymentStatus;
    }
    if (query.provider) {
      where.provider = query.provider as PaymentProvider;
    }
    if (query.clientId) {
      where.clientId = query.clientId;
    }
    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.minAmountMinor !== undefined || query.maxAmountMinor !== undefined) {
      where.amount = {};
      if (query.minAmountMinor !== undefined) {
        where.amount.gte = query.minAmountMinor;
      }
      if (query.maxAmountMinor !== undefined) {
        where.amount.lte = query.maxAmountMinor;
      }
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const [total, payments, volumeAggregate] = await Promise.all([
      this.prisma.paymentIntent.count({ where }),
      this.prisma.paymentIntent.findMany({
        where,
        include: {
          client: { select: { id: true, email: true } },
          project: { select: { id: true, title: true } },
          _count: { select: { refunds: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.paymentIntent.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    const items: AdminPaymentListItem[] = payments.map((p) => ({
      id: p.id,
      projectId: p.projectId,
      projectTitle: p.project?.title,
      deliverableId: p.deliverableId,
      clientId: p.clientId,
      clientEmail: p.client.email,
      amountMinor: p.amount.toString(),
      currency: p.currency,
      platformFeeMinor: p.platformFee.toString(),
      status: p.status,
      provider: p.provider,
      providerOrderId: p.providerOrderId,
      providerPaymentId: p.providerPaymentId,
      refundsCount: p._count.refunds,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));

    const totalVolume = volumeAggregate._sum.amount || 0;

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      totalVolumeMinor: totalVolume.toString(),
    };
  }

  public async getPayment(paymentId: string): Promise<any> {
    const payment = await this.prisma.paymentIntent.findUnique({
      where: { id: paymentId },
      include: {
        client: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        project: {
          select: {
            id: true,
            title: true,
            status: true,
            talentId: true,
            talent: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
        deliverable: true,
        refunds: {
          include: {
            refundedBy: { select: { id: true, email: true } },
          },
        },
        ledgerTransactions: {
          include: {
            entries: {
              include: {
                account: true,
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError(`PaymentIntent not found: ${paymentId}`);
    }

    return {
      id: payment.id,
      projectId: payment.projectId,
      project: payment.project,
      deliverable: payment.deliverable,
      clientId: payment.clientId,
      client: payment.client,
      amountMinor: payment.amount.toString(),
      currency: payment.currency,
      platformFeeMinor: payment.platformFee.toString(),
      status: payment.status,
      provider: payment.provider,
      providerOrderId: payment.providerOrderId,
      providerPaymentId: payment.providerPaymentId,
      idempotencyKey: payment.idempotencyKey,
      metadata: payment.metadata,
      refunds: payment.refunds.map((r) => ({
        id: r.id,
        amountMinor: r.amount.toString(),
        currency: r.currency,
        reason: r.reason,
        status: r.status,
        providerRefundId: r.providerRefundId,
        refundedBy: r.refundedBy,
        createdAt: r.createdAt.toISOString(),
        processedAt: r.processedAt?.toISOString() || null,
      })),
      ledgerTransactions: payment.ledgerTransactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        description: tx.description,
        postedAt: tx.postedAt.toISOString(),
        entries: tx.entries.map((e) => ({
          id: e.id,
          direction: e.direction,
          amountMinor: e.amount.toString(),
          currency: e.currency,
          account: {
            id: e.account.id,
            code: e.account.code,
            name: e.account.name,
            type: e.account.type,
          },
        })),
      })),
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }

  // ==============================================================================
  // Refund Administration & Dual Approval
  // ==============================================================================

  public async listRefunds(query: AdminRefundQuery): Promise<AdminRefundListResponse> {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.status) {
      where.status = query.status as RefundStatus;
    }
    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.paymentIntentId) {
      where.paymentIntentId = query.paymentIntentId;
    }

    const [total, refunds] = await Promise.all([
      this.prisma.refund.count({ where }),
      this.prisma.refund.findMany({
        where,
        include: {
          project: { select: { id: true, title: true } },
          refundedBy: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Fetch matching AdminActionApprovals for these refunds
    const refundIds = refunds.map((r) => r.id);
    const approvals = await this.prisma.adminActionApproval.findMany({
      where: {
        targetEntity: 'Refund',
        targetEntityId: { in: refundIds },
      },
    });
    const approvalMap = new Map(approvals.map((a) => [a.targetEntityId, a]));

    const items: AdminRefundListItem[] = refunds.map((r) => {
      const approval = approvalMap.get(r.id);
      return {
        id: r.id,
        paymentIntentId: r.paymentIntentId,
        projectId: r.projectId,
        projectTitle: r.project?.title,
        disputeId: r.disputeId,
        cancellationId: r.cancellationId,
        refundedById: r.refundedById,
        refundedByEmail: r.refundedBy.email,
        amountMinor: r.amount.toString(),
        currency: r.currency,
        reason: r.reason,
        status: r.status,
        provider: r.provider,
        providerRefundId: r.providerRefundId,
        approvalId: approval?.id || null,
        approvalStatus: approval?.status || null,
        requiresDualApproval: !!approval,
        notes: approval?.notes || null,
        processedAt: r.processedAt ? r.processedAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  public async createRefund(
    request: CreateRefundRequest,
    adminUserId: string,
    hasApprovePermission: boolean,
    rawIdempotencyKey?: string,
  ): Promise<AdminRefundListItem> {
    const idempotencyKey = this.normalizeIdempotencyKey(rawIdempotencyKey);

    return await this.prisma.$transaction(
      async (tx) => {
        const scopedKey = idempotencyKey
          ? this.scopeAdminIdempotencyKey(adminUserId, idempotencyKey)
          : undefined;

        if (scopedKey) {
          // Serialize duplicate same-key retries across any concurrent caller on the same admin
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`admin_refund_create:${scopedKey}`}))`;
          const cached = await this.idempotency.check<AdminRefundListItem>(
            'admin_refund_create',
            scopedKey,
            request,
            tx,
          );
          if (cached.isCached && cached.body) {
            return cached.body;
          }
        }

        const paymentMeta = await tx.paymentIntent.findUnique({
          where: { id: request.paymentIntentId },
          select: { id: true, projectId: true },
        });
        if (!paymentMeta) {
          throw new NotFoundError(`PaymentIntent not found: ${request.paymentIntentId}`);
        }

        // Canonical lock ordering across finance modules: projects -> payment_intents
        await tx.$queryRaw`SELECT id FROM "projects" WHERE id = ${paymentMeta.projectId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "payment_intents" WHERE id = ${paymentMeta.id}::uuid FOR UPDATE`;

        const payment = await tx.paymentIntent.findUnique({
          where: { id: paymentMeta.id },
          include: {
            project: { select: { id: true, title: true } },
            refunds: {
              where: {
                status: {
                  in: [
                    RefundStatus.SUCCEEDED,
                    RefundStatus.PROCESSING,
                    RefundStatus.REQUESTED,
                    RefundStatus.PENDING,
                  ],
                },
              },
            },
          },
        });

        if (!payment) {
          throw new NotFoundError(`PaymentIntent not found: ${request.paymentIntentId}`);
        }

        if (payment.status !== 'SUCCEEDED' && payment.status !== 'PARTIALLY_REFUNDED') {
          throw new BadRequestError(
            `Cannot refund payment with status: ${payment.status}. Payment must be SUCCEEDED or PARTIALLY_REFUNDED.`,
          );
        }

        // Verify capturable remaining amount strictly under exclusive payment lock
        const alreadyRefunded = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
        const refundableRemaining = payment.amount - alreadyRefunded;

        if (request.amountMinor > refundableRemaining) {
          throw new BadRequestError(
            `Requested refund amount (${request.amountMinor}) exceeds available refundable balance (${refundableRemaining}).`,
          );
        }

        // Requires dual approval if amount >= threshold OR requesting admin does not hold payments.refund.approve
        const requiresDualApproval =
          request.amountMinor >= HIGH_VALUE_REFUND_THRESHOLD_PAISA || !hasApprovePermission;

        const refundId = generateUuidV7();
        const adminUser = await tx.user.findUniqueOrThrow({
          where: { id: adminUserId },
          select: { id: true, email: true },
        });

        let approvalId: string | null = null;
        let approvalStatus: string | null = null;
        let refundStatus: RefundStatus;

        if (requiresDualApproval) {
          refundStatus = RefundStatus.REQUESTED;
          approvalId = generateUuidV7();
          approvalStatus = 'PENDING';

          await tx.adminActionApproval.create({
            data: {
              id: approvalId,
              actionType: 'REFUND',
              targetEntity: 'Refund',
              targetEntityId: refundId,
              requestedById: adminUserId,
              status: 'PENDING',
              payload: {
                paymentIntentId: payment.id,
                projectId: payment.projectId,
                amountMinor: request.amountMinor,
                currency: payment.currency,
                reason: request.reason,
              },
              requestedAmountMinor: BigInt(request.amountMinor),
              notes: request.notes,
              expiresAt: new Date(Date.now() + 86400000 * 7), // 7 days expiration
            },
          });

          await tx.auditLog.create({
            data: {
              id: generateUuidV7(),
              userId: adminUserId,
              action: 'REFUND_REQUESTED',
              entity: 'Refund',
              entityId: refundId,
              metadata: {
                approvalId,
                amountMinor: request.amountMinor,
                reason: request.reason,
                notes: request.notes,
                requiresDualApproval: true,
              },
            },
          });
        } else {
          refundStatus = RefundStatus.SUCCEEDED;

          await tx.auditLog.create({
            data: {
              id: generateUuidV7(),
              userId: adminUserId,
              action: 'REFUND_PROCESSED',
              entity: 'Refund',
              entityId: refundId,
              metadata: {
                amountMinor: request.amountMinor,
                reason: request.reason,
                notes: request.notes,
                requiresDualApproval: false,
              },
            },
          });
        }

        const refund = await tx.refund.create({
          data: {
            id: refundId,
            paymentIntentId: payment.id,
            projectId: payment.projectId,
            refundedById: adminUserId,
            amount: request.amountMinor,
            currency: payment.currency,
            reason: request.reason as RefundReason,
            status: refundStatus,
            provider: payment.provider,
            idempotencyKey: idempotencyKey ?? null,
            processedAt: refundStatus === RefundStatus.SUCCEEDED ? new Date() : null,
            metadata: { notes: request.notes, approvalId },
          },
        });

        if (refundStatus === RefundStatus.SUCCEEDED) {
          await this.executeRefundLedgerAndStatus(tx, payment, refund.id, request.amountMinor);
        }

        const result: AdminRefundListItem = {
          id: refund.id,
          paymentIntentId: refund.paymentIntentId,
          projectId: refund.projectId,
          projectTitle: payment.project?.title,
          disputeId: null,
          cancellationId: null,
          refundedById: adminUser.id,
          refundedByEmail: adminUser.email,
          amountMinor: refund.amount.toString(),
          currency: refund.currency,
          reason: refund.reason,
          status: refund.status,
          provider: refund.provider,
          providerRefundId: null,
          approvalId,
          approvalStatus,
          requiresDualApproval,
          notes: request.notes,
          processedAt: refund.processedAt ? refund.processedAt.toISOString() : null,
          createdAt: refund.createdAt.toISOString(),
          updatedAt: refund.updatedAt.toISOString(),
        };

        if (scopedKey) {
          await this.idempotency.record(
            'admin_refund_create',
            scopedKey,
            request,
            201,
            result,
            refund.id,
            24,
            tx,
          );
        }

        return result;
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }

  public async decideRefund(
    refundId: string,
    decidingAdminId: string,
    input: DecideRefundApprovalRequest,
    rawIdempotencyKey?: string,
  ): Promise<AdminRefundListItem> {
    const idempotencyKey = this.normalizeIdempotencyKey(rawIdempotencyKey);

    return await this.prisma.$transaction(
      async (tx) => {
        const scopedKey = idempotencyKey
          ? this.scopeAdminIdempotencyKey(decidingAdminId, idempotencyKey)
          : undefined;
        const hashPayload = { refundId, decision: input.decision, reason: input.reason };

        if (scopedKey) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`admin_refund_decide:${scopedKey}`}))`;
          const cached = await this.idempotency.check<AdminRefundListItem>(
            'admin_refund_decide',
            scopedKey,
            hashPayload,
            tx,
          );
          if (cached.isCached && cached.body) {
            return cached.body;
          }
        }

        const refundMeta = await tx.refund.findUnique({
          where: { id: refundId },
          select: { id: true, projectId: true, paymentIntentId: true },
        });

        if (!refundMeta) {
          throw new NotFoundError(`Refund not found: ${refundId}`);
        }

        // Canonical lock order: projects -> payment_intents -> refunds -> admin_action_approvals
        await tx.$queryRaw`SELECT id FROM "projects" WHERE id = ${refundMeta.projectId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "payment_intents" WHERE id = ${refundMeta.paymentIntentId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "refunds" WHERE id = ${refundMeta.id}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "admin_action_approvals" WHERE "target_entity" = 'Refund' AND "target_entity_id" = ${refundMeta.id} FOR UPDATE`;

        const refund = await tx.refund.findUnique({
          where: { id: refundId },
          include: {
            project: { select: { id: true, title: true } },
            refundedBy: { select: { id: true, email: true } },
            paymentIntent: true,
          },
        });

        if (!refund) {
          throw new NotFoundError(`Refund not found: ${refundId}`);
        }

        const approval = await tx.adminActionApproval.findFirst({
          where: {
            targetEntity: 'Refund',
            targetEntityId: refundId,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (!approval) {
          throw new BadRequestError(`Refund ${refundId} does not have a dual-approval request.`);
        }

        if (approval.status !== 'PENDING') {
          throw new ConflictError(
            `Refund ${refundId} approval request has already been decided (${approval.status}).`,
          );
        }

        if (approval.expiresAt && approval.expiresAt < new Date()) {
          throw new ConflictError(`Refund ${refundId} approval request has expired.`);
        }

        if (refund.status !== RefundStatus.REQUESTED && refund.status !== RefundStatus.PENDING) {
          throw new ConflictError(
            `Refund ${refundId} is no longer in pending approval state (current status: ${refund.status}).`,
          );
        }

        // ANTI-SELF-APPROVAL / CONFLICT OF INTEREST ENFORCEMENT
        if (approval.requestedById === decidingAdminId || refund.refundedById === decidingAdminId) {
          throw new ConflictOfInterestError(
            'Anti-conflict-of-interest violation: Administrators cannot approve or reject their own refund requests.',
          );
        }

        const isApproved = input.decision === 'APPROVE';
        const updatedApprovalStatus = isApproved ? 'APPROVED' : 'REJECTED';
        const updatedRefundStatus = isApproved ? RefundStatus.SUCCEEDED : RefundStatus.FAILED;

        const approvalUpdate = await tx.adminActionApproval.updateMany({
          where: { id: approval.id, status: 'PENDING' },
          data: {
            status: updatedApprovalStatus,
            decidedById: decidingAdminId,
            notes:
              `${approval.notes || ''}\n[Decision Note by ${decidingAdminId}]: ${input.reason}`.trim(),
          },
        });
        if (approvalUpdate.count !== 1) {
          throw new ConflictError(
            `Refund ${refundId} approval state changed concurrently. Please refresh and retry.`,
          );
        }

        const refundUpdate = await tx.refund.updateMany({
          where: {
            id: refundId,
            status: { in: [RefundStatus.REQUESTED, RefundStatus.PENDING] },
          },
          data: {
            status: updatedRefundStatus,
            processedAt: isApproved ? new Date() : null,
          },
        });
        if (refundUpdate.count !== 1) {
          throw new ConflictError(
            `Refund ${refundId} status changed concurrently. Please refresh and retry.`,
          );
        }

        const updatedRefund = await tx.refund.findUniqueOrThrow({
          where: { id: refundId },
        });

        if (isApproved) {
          if (
            refund.paymentIntent.status !== 'SUCCEEDED' &&
            refund.paymentIntent.status !== 'PARTIALLY_REFUNDED'
          ) {
            throw new ConflictError(
              `Cannot approve refund ${refundId}: PaymentIntent status is ${refund.paymentIntent.status}.`,
            );
          }

          await this.executeRefundLedgerAndStatus(
            tx,
            refund.paymentIntent,
            refund.id,
            refund.amount,
          );
        }

        await tx.auditLog.create({
          data: {
            id: generateUuidV7(),
            userId: decidingAdminId,
            action: isApproved ? 'REFUND_APPROVED' : 'REFUND_REJECTED',
            entity: 'Refund',
            entityId: refundId,
            metadata: {
              approvalId: approval.id,
              requestedById: approval.requestedById,
              decidedById: decidingAdminId,
              decision: input.decision,
              reason: input.reason,
              amountMinor: refund.amount,
            },
          },
        });

        const result: AdminRefundListItem = {
          id: updatedRefund.id,
          paymentIntentId: updatedRefund.paymentIntentId,
          projectId: updatedRefund.projectId,
          projectTitle: refund.project?.title,
          disputeId: updatedRefund.disputeId,
          cancellationId: updatedRefund.cancellationId,
          refundedById: refund.refundedById,
          refundedByEmail: refund.refundedBy.email,
          amountMinor: updatedRefund.amount.toString(),
          currency: updatedRefund.currency,
          reason: updatedRefund.reason,
          status: updatedRefund.status,
          provider: updatedRefund.provider,
          providerRefundId: updatedRefund.providerRefundId,
          approvalId: approval.id,
          approvalStatus: updatedApprovalStatus,
          requiresDualApproval: true,
          notes: input.reason,
          processedAt: updatedRefund.processedAt ? updatedRefund.processedAt.toISOString() : null,
          createdAt: updatedRefund.createdAt.toISOString(),
          updatedAt: updatedRefund.updatedAt.toISOString(),
        };

        if (scopedKey) {
          await this.idempotency.record(
            'admin_refund_decide',
            scopedKey,
            hashPayload,
            200,
            result,
            refundId,
            24,
            tx,
          );
        }

        return result;
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }

  // ==============================================================================
  // Ledger Reconciliation & Audit Verification
  // ==============================================================================

  public async getReconciliationReport(adminUserId: string): Promise<AdminReconciliationReport> {
    const checkedAt = new Date().toISOString();

    const [accounts, entries] = await Promise.all([
      this.prisma.ledgerAccount.findMany({
        where: { isActive: true },
      }),
      this.prisma.ledgerEntry.findMany(),
    ]);

    let totalDebitsBigInt = 0n;
    let totalCreditsBigInt = 0n;

    // Group entries by accountId
    const accountEntriesMap = new Map<string, { debits: bigint; credits: bigint }>();

    for (const entry of entries) {
      const amountBigInt = BigInt(entry.amount);
      if (!accountEntriesMap.has(entry.accountId)) {
        accountEntriesMap.set(entry.accountId, { debits: 0n, credits: 0n });
      }
      const acc = accountEntriesMap.get(entry.accountId)!;

      if (entry.direction === 'DEBIT') {
        totalDebitsBigInt += amountBigInt;
        acc.debits += amountBigInt;
      } else {
        totalCreditsBigInt += amountBigInt;
        acc.credits += amountBigInt;
      }
    }

    const netDifferenceBigInt = totalDebitsBigInt - totalCreditsBigInt;
    const unbalancedAccounts: Array<{
      id: string;
      code: string;
      name: string;
      type: string;
      balanceMinor: string;
      entriesSumMinor: string;
      discrepancyMinor: string;
    }> = [];

    for (const acc of accounts) {
      const entryData = accountEntriesMap.get(acc.id) || { debits: 0n, credits: 0n };
      // Normal balance:
      // ASSET, EXPENSE: Debits - Credits
      // LIABILITY, EQUITY, REVENUE: Credits - Debits
      let calculatedExpected: bigint;
      if (acc.type === 'ASSET' || acc.type === 'EXPENSE') {
        calculatedExpected = entryData.debits - entryData.credits;
      } else {
        calculatedExpected = entryData.credits - entryData.debits;
      }

      const recordedBalance = BigInt(acc.balance);
      const discrepancy = recordedBalance - calculatedExpected;

      if (discrepancy !== 0n) {
        unbalancedAccounts.push({
          id: acc.id,
          code: acc.code,
          name: acc.name,
          type: acc.type,
          balanceMinor: recordedBalance.toString(),
          entriesSumMinor: calculatedExpected.toString(),
          discrepancyMinor: discrepancy.toString(),
        });
      }
    }

    const isBalanced = netDifferenceBigInt === 0n && unbalancedAccounts.length === 0;
    const status = isBalanced ? 'BALANCED' : 'UNBALANCED';

    // Record audit log for reconciliation run
    await this.prisma.auditLog.create({
      data: {
        id: generateUuidV7(),
        userId: adminUserId,
        action: 'RECONCILIATION_AUDIT_PERFORMED',
        entity: 'LedgerAccount',
        entityId: 'ALL',
        metadata: {
          status,
          totalAccounts: accounts.length,
          totalDebitsMinor: totalDebitsBigInt.toString(),
          totalCreditsMinor: totalCreditsBigInt.toString(),
          netDifferenceMinor: netDifferenceBigInt.toString(),
          unbalancedCount: unbalancedAccounts.length,
        },
      },
    });

    return {
      status,
      checkedAt,
      totalAccounts: accounts.length,
      totalDebitsMinor: totalDebitsBigInt.toString(),
      totalCreditsMinor: totalCreditsBigInt.toString(),
      netDifferenceMinor: netDifferenceBigInt.toString(),
      unbalancedAccounts,
    };
  }
}

export const adminFinanceService = new AdminFinanceService();
