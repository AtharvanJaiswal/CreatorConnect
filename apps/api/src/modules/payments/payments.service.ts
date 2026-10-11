import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  PaymentIntentResponse,
  PaymentProvider,
  CreatePaymentIntentInput,
  ConfirmPaymentIntentInput,
  WebhookIngestResponse,
  RefundResponse,
  CreateRefundInput,
  RefundStatus,
} from '@creatorconnect/contracts';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  WebhookSignatureVerificationError,
  PaymentIntentStateError,
  RefundStateError,
  RefundExceedsCapturableAmountError,
  PaymentProviderError,
} from '../../errors/app-error.js';
import { paymentsRepository, PaymentsRepository } from './payments.repository.js';
import { ledgerService, LedgerService } from './ledger/ledger.service.js';
import { idempotencyService, IdempotencyService } from './idempotency.service.js';
import { getPaymentProvider } from './providers/index.js';

export class PaymentsService {
  constructor(
    private prisma = getPrismaClient(),
    private repo: PaymentsRepository = paymentsRepository,
    private ledger: LedgerService = ledgerService,
    private idempotency: IdempotencyService = idempotencyService,
  ) {}

  async createPaymentIntent(
    callerUserId: string,
    input: CreatePaymentIntentInput,
    isAdmin = false,
  ): Promise<PaymentIntentResponse> {
    const scope = 'payment_intent_create';

    // 1. Idempotency Check
    if (input.idempotencyKey) {
      const cached = await this.idempotency.check<PaymentIntentResponse>(
        scope,
        input.idempotencyKey,
        input,
      );
      if (cached.isCached && cached.body) {
        return cached.body;
      }
    }

    // 2. Project and Client Authorization Check
    const project = await this.prisma.project.findUnique({
      where: { id: input.projectId },
      include: { client: true },
    });

    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    if (project.clientId !== callerUserId && !isAdmin) {
      throw new ForbiddenError('Only the project client can create payment intents.');
    }

    if (project.status === 'CANCELLED' || project.status === 'COMPLETED') {
      throw new BadRequestError(`Cannot fund project in '${project.status}' status.`);
    }

    if (input.deliverableId) {
      const deliverable = await this.prisma.projectDeliverable.findUnique({
        where: { id: input.deliverableId },
      });
      if (!deliverable || deliverable.projectId !== input.projectId) {
        throw new NotFoundError('Deliverable not found for this project.');
      }
    }

    const providerType = input.provider || 'SANDBOX_MOCK';
    const provider = getPaymentProvider(providerType);
    const intentId = generateUuidV7();
    const currency = input.currency || 'INR';

    // 10% platform fee calculation in integer minor units
    const platformFee = Math.floor(input.amount * 0.1);

    // 3. Provider Order Creation OUTSIDE database transaction
    const orderResult = await provider.createOrder({
      amount: input.amount,
      currency,
      receipt: intentId,
      notes: {
        projectId: input.projectId,
        clientId: callerUserId,
      },
    });

    // 4. Atomic Database Transaction for Intent, Idempotency, and Outbox Event
    const response = await this.prisma.$transaction(async (tx) => {
      const intent = await tx.paymentIntent.create({
        data: {
          id: intentId,
          projectId: input.projectId,
          deliverableId: input.deliverableId ?? null,
          clientId: callerUserId,
          amount: input.amount,
          currency,
          platformFee,
          status: 'REQUIRES_PAYMENT_METHOD',
          provider: providerType,
          providerOrderId: orderResult.providerOrderId,
          clientSecret: orderResult.clientSecret ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          version: 1,
        },
      });

      // Outbox Event
      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'payment.intent.created.v1',
          aggregateType: 'PaymentIntent',
          aggregateId: intentId,
          payload: {
            paymentIntentId: intentId,
            projectId: input.projectId,
            clientId: callerUserId,
            amount: input.amount,
            currency,
            platformFee,
            provider: providerType,
            providerOrderId: orderResult.providerOrderId,
          },
          status: 'PENDING',
        },
      });

      const mapped = this.mapIntent(intent);

      // Record Idempotency Record
      if (input.idempotencyKey) {
        await this.idempotency.record(
          scope,
          input.idempotencyKey,
          input,
          201,
          mapped,
          intentId,
          24,
          tx,
        );
      }

      return mapped;
    });

    return response;
  }

  async getPaymentIntent(
    callerUserId: string,
    intentId: string,
    isAdmin = false,
  ): Promise<PaymentIntentResponse> {
    const intent = await this.repo.findIntentById(intentId);
    if (!intent) {
      throw new NotFoundError('Payment intent not found.');
    }

    const isClient = intent.clientId === callerUserId;
    const isTalent = intent.project.talentId === callerUserId;

    if (!isClient && !isTalent && !isAdmin) {
      throw new ForbiddenError('You do not have permission to view this payment intent.');
    }

    return this.mapIntent(intent);
  }

  async confirmPaymentIntent(
    callerUserId: string,
    intentId: string,
    input: ConfirmPaymentIntentInput,
    isAdmin = false,
  ): Promise<PaymentIntentResponse> {
    const intent = await this.repo.findIntentById(intentId);
    if (!intent) {
      throw new NotFoundError('Payment intent not found.');
    }

    if (intent.clientId !== callerUserId && !isAdmin) {
      throw new ForbiddenError('Only the paying client can confirm this payment.');
    }

    if (intent.status === 'SUCCEEDED') {
      return this.mapIntent(intent);
    }

    if (intent.status !== 'REQUIRES_PAYMENT_METHOD' && intent.status !== 'PROCESSING') {
      throw new PaymentIntentStateError(
        `Cannot confirm payment intent in '${intent.status}' state.`,
      );
    }

    const providerPaymentId =
      input.providerPaymentId || `pay_mock_${generateUuidV7().substring(0, 12)}`;

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.paymentIntent.update({
        where: { id: intentId },
        data: {
          status: 'SUCCEEDED',
          providerPaymentId,
          version: { increment: 1 },
        },
      });

      // Post Balanced Double-Entry Ledger Transaction
      // Debit: Asset (Processor Clearing)
      // Credit: Liability (Project Escrow Holding)
      // Credit: Revenue (Platform Fee)
      const escrowAmount = intent.amount - intent.platformFee;
      await this.ledger.postTransaction(
        {
          paymentIntentId: intentId,
          type: 'PAYMENT_CAPTURED',
          description: `Captured payment intent for project ${intent.projectId}`,
          entries: [
            {
              accountCode: `ASSETS:PROCESSOR_CLEARING:${intent.provider}`,
              accountName: `${intent.provider} Settlement Clearing`,
              accountType: 'ASSET',
              direction: 'DEBIT',
              amount: intent.amount,
              currency: intent.currency,
            },
            {
              accountCode: `LIABILITIES:ESCROW_HOLDING:${intent.projectId}`,
              accountName: `Project Escrow Holding for ${intent.projectId}`,
              accountType: 'LIABILITY',
              direction: 'CREDIT',
              amount: escrowAmount,
              currency: intent.currency,
              projectId: intent.projectId,
            },
            {
              accountCode: 'REVENUE:PLATFORM_FEE',
              accountName: 'CreatorConnect Platform Take Rate',
              accountType: 'REVENUE',
              direction: 'CREDIT',
              amount: intent.platformFee,
              currency: intent.currency,
            },
          ],
        },
        tx,
      );

      // Outbox Event
      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'payment.intent.succeeded.v1',
          aggregateType: 'PaymentIntent',
          aggregateId: intentId,
          payload: {
            paymentIntentId: intentId,
            projectId: intent.projectId,
            amount: intent.amount,
            currency: intent.currency,
            providerPaymentId,
          },
          status: 'PENDING',
        },
      });

      return this.mapIntent(updated);
    });
  }

  async processWebhook(
    providerName: PaymentProvider,
    rawBody: string,
    signature: string,
    secretOverride?: string,
  ): Promise<WebhookIngestResponse> {
    const provider = getPaymentProvider(providerName);
    const secret =
      secretOverride || process.env.PAYMENT_WEBHOOK_SECRET || 'mock_webhook_secret_dev_key';

    // 1. Verify Webhook Signature
    const isValid = provider.verifyWebhookSignature({
      rawBody,
      signature,
      secret,
    });

    if (!isValid) {
      throw new WebhookSignatureVerificationError('Invalid provider webhook signature.');
    }

    // 2. Parse Normalized Event
    const event = provider.parseWebhookEvent(rawBody, signature);

    // 3. Atomic Ingestion and Deduplication in Database Transaction
    return await this.prisma.$transaction(async (tx) => {
      const existing = await tx.paymentWebhookEvent.findUnique({
        where: {
          provider_eventId: {
            provider: providerName,
            eventId: event.eventId,
          },
        },
      });

      if (existing) {
        return {
          received: true,
          eventId: event.eventId,
          status: 'ALREADY_PROCESSED',
        };
      }

      await tx.paymentWebhookEvent.create({
        data: {
          id: generateUuidV7(),
          provider: providerName,
          eventId: event.eventId,
          eventType: event.eventType,
          payload: event.rawPayload as any,
          signature,
          status: 'PROCESSING',
        },
      });

      if (event.status === 'succeeded') {
        const intent = event.providerOrderId
          ? await tx.paymentIntent.findFirst({
              where: {
                provider: providerName,
                providerOrderId: event.providerOrderId,
              },
            })
          : event.providerPaymentId
            ? await tx.paymentIntent.findFirst({
                where: {
                  provider: providerName,
                  providerPaymentId: event.providerPaymentId,
                },
              })
            : null;

        if (intent && intent.status !== 'SUCCEEDED') {
          await tx.paymentIntent.update({
            where: { id: intent.id },
            data: {
              status: 'SUCCEEDED',
              providerPaymentId: event.providerPaymentId || intent.providerPaymentId,
              version: { increment: 1 },
            },
          });

          // Post balanced double-entry ledger entries
          const escrowAmount = intent.amount - intent.platformFee;
          await this.ledger.postTransaction(
            {
              paymentIntentId: intent.id,
              type: 'PAYMENT_CAPTURED_WEBHOOK',
              description: `Webhook captured payment for order ${event.providerOrderId}`,
              entries: [
                {
                  accountCode: `ASSETS:PROCESSOR_CLEARING:${providerName}`,
                  accountName: `${providerName} Settlement Clearing`,
                  accountType: 'ASSET',
                  direction: 'DEBIT',
                  amount: intent.amount,
                  currency: intent.currency,
                },
                {
                  accountCode: `LIABILITIES:ESCROW_HOLDING:${intent.projectId}`,
                  accountName: `Project Escrow Holding for ${intent.projectId}`,
                  accountType: 'LIABILITY',
                  direction: 'CREDIT',
                  amount: escrowAmount,
                  currency: intent.currency,
                  projectId: intent.projectId,
                },
                {
                  accountCode: 'REVENUE:PLATFORM_FEE',
                  accountName: 'CreatorConnect Platform Take Rate',
                  accountType: 'REVENUE',
                  direction: 'CREDIT',
                  amount: intent.platformFee,
                  currency: intent.currency,
                },
              ],
            },
            tx,
          );

          await tx.outboxEvent.create({
            data: {
              id: generateUuidV7(),
              eventType: 'payment.intent.succeeded.v1',
              aggregateType: 'PaymentIntent',
              aggregateId: intent.id,
              payload: {
                paymentIntentId: intent.id,
                eventId: event.eventId,
                provider: providerName,
              },
              status: 'PENDING',
            },
          });
        }
      } else if (event.status === 'failed') {
        const intent = event.providerOrderId
          ? await tx.paymentIntent.findFirst({
              where: {
                provider: providerName,
                providerOrderId: event.providerOrderId,
              },
            })
          : null;

        if (intent && intent.status !== 'FAILED') {
          await tx.paymentIntent.update({
            where: { id: intent.id },
            data: {
              status: 'FAILED',
              errorMessage: event.errorMessage ?? 'Payment authorization failed.',
              version: { increment: 1 },
            },
          });

          await tx.outboxEvent.create({
            data: {
              id: generateUuidV7(),
              eventType: 'payment.intent.failed.v1',
              aggregateType: 'PaymentIntent',
              aggregateId: intent.id,
              payload: {
                paymentIntentId: intent.id,
                eventId: event.eventId,
                errorMessage: event.errorMessage,
              },
              status: 'PENDING',
            },
          });
        }
      } else if (event.status === 'refunded') {
        let refund = event.providerRefundId
          ? await tx.refund.findFirst({
              where: {
                provider: providerName,
                providerRefundId: event.providerRefundId,
              },
              include: { paymentIntent: true },
            })
          : null;

        if (!refund && event.providerPaymentId) {
          refund = await tx.refund.findFirst({
            where: {
              provider: providerName,
              paymentIntent: {
                providerPaymentId: event.providerPaymentId,
              },
              status: { in: ['PROCESSING', 'RECONCILIATION_REQUIRED', 'PENDING'] },
            },
            include: { paymentIntent: true },
          });
        }

        if (refund && refund.status !== 'SUCCEEDED') {
          const refundAmount = event.amount || refund.amount;
          const intent = refund.paymentIntent;

          await tx.refund.update({
            where: { id: refund.id },
            data: {
              status: 'SUCCEEDED',
              providerRefundId: event.providerRefundId || refund.providerRefundId,
              processedAt: new Date(),
            },
          });

          // Calculate transaction-specific fee reversal dynamically rather than assuming universal 90/10 split
          const feeReversal =
            intent.amount > 0 ? Math.floor((refundAmount * intent.platformFee) / intent.amount) : 0;
          const escrowReversal = refundAmount - feeReversal;

          await this.ledger.postTransaction(
            {
              paymentIntentId: intent.id,
              type: 'PAYMENT_REFUNDED_WEBHOOK',
              description: `Webhook processed refund for intent ${intent.id}`,
              entries: [
                {
                  accountCode: `LIABILITIES:ESCROW_HOLDING:${intent.projectId}`,
                  accountType: 'LIABILITY',
                  direction: 'DEBIT',
                  amount: escrowReversal,
                  currency: intent.currency,
                  projectId: intent.projectId,
                },
                {
                  accountCode: 'REVENUE:PLATFORM_FEE',
                  accountType: 'REVENUE',
                  direction: 'DEBIT',
                  amount: feeReversal,
                  currency: intent.currency,
                },
                {
                  accountCode: `ASSETS:PROCESSOR_CLEARING:${providerName}`,
                  accountType: 'ASSET',
                  direction: 'CREDIT',
                  amount: refundAmount,
                  currency: intent.currency,
                },
              ],
            },
            tx,
          );

          const totalPriorRefunds = await tx.refund.aggregate({
            where: {
              paymentIntentId: intent.id,
              status: 'SUCCEEDED',
            },
            _sum: { amount: true },
          });
          const totalRefunded = totalPriorRefunds._sum.amount ?? refundAmount;
          const isFullyRefunded = totalRefunded >= intent.amount;

          await tx.paymentIntent.update({
            where: { id: intent.id },
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
              aggregateId: refund.id,
              payload: {
                refundId: refund.id,
                paymentIntentId: intent.id,
                projectId: intent.projectId,
                amount: refundAmount,
                currency: intent.currency,
                providerRefundId: event.providerRefundId || refund.providerRefundId,
              },
              status: 'PENDING',
            },
          });
        }
      }

      await tx.paymentWebhookEvent.update({
        where: {
          provider_eventId: {
            provider: providerName,
            eventId: event.eventId,
          },
        },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
        },
      });

      return {
        received: true,
        eventId: event.eventId,
        status: 'PROCESSED',
      };
    });
  }

  async releaseProjectEscrow(
    callerUserId: string,
    projectId: string,
    isAdmin = false,
  ): Promise<{ releasedAmount: number; currency: string }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { talent: true },
    });

    if (!project) {
      throw new NotFoundError('Project not found.');
    }

    if (project.clientId !== callerUserId && !isAdmin) {
      throw new ForbiddenError('Only the project client can release escrow funds.');
    }

    if (project.status === 'DISPUTED') {
      throw new BadRequestError('Cannot release escrow funds while project has an active dispute.');
    }
    if (project.status === 'CANCELLED') {
      throw new BadRequestError('Cannot release escrow funds for a cancelled project.');
    }

    const currentEscrowBalance = await this.ledger.getProjectEscrowBalance(projectId);
    if (currentEscrowBalance <= 0) {
      throw new BadRequestError('No funded escrow balance available to release for this project.');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Transfer from Project Escrow Liability to Creator Payable Liability
      await this.ledger.postTransaction(
        {
          type: 'ESCROW_RELEASE_TO_CREATOR',
          description: `Released milestone escrow funds to creator for project ${projectId}`,
          entries: [
            {
              accountCode: `LIABILITIES:ESCROW_HOLDING:${projectId}`,
              accountType: 'LIABILITY',
              direction: 'DEBIT',
              amount: currentEscrowBalance,
              currency: project.currency,
              projectId,
            },
            {
              accountCode: `LIABILITIES:CREATOR_PAYABLE:${project.talentId}`,
              accountName: `Creator Payable for ${project.talentId}`,
              accountType: 'LIABILITY',
              direction: 'CREDIT',
              amount: currentEscrowBalance,
              currency: project.currency,
              userId: project.talentId,
            },
          ],
        },
        tx,
      );

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'escrow.released.v1',
          aggregateType: 'Project',
          aggregateId: projectId,
          payload: {
            projectId,
            talentId: project.talentId,
            releasedAmount: currentEscrowBalance,
            currency: project.currency,
          },
          status: 'PENDING',
        },
      });

      return {
        releasedAmount: currentEscrowBalance,
        currency: project.currency,
      };
    });
  }

  private mapIntent(p: any): PaymentIntentResponse {
    return {
      id: p.id,
      projectId: p.projectId,
      deliverableId: p.deliverableId ?? null,
      clientId: p.clientId,
      amount: p.amount,
      currency: p.currency,
      platformFee: p.platformFee,
      status: p.status,
      provider: p.provider,
      providerOrderId: p.providerOrderId ?? null,
      providerPaymentId: p.providerPaymentId ?? null,
      idempotencyKey: p.idempotencyKey ?? null,
      clientSecret: p.clientSecret ?? null,
      errorMessage: p.errorMessage ?? null,
      version: p.version,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async createRefund(
    callerUserId: string,
    paymentIntentId: string,
    input: CreateRefundInput,
    isAdmin = false,
  ): Promise<RefundResponse> {
    const scope = 'refund_create';

    // 1. Idempotency Check
    if (input.idempotencyKey) {
      const cached = await this.idempotency.check<RefundResponse>(
        scope,
        input.idempotencyKey,
        input,
      );
      if (cached.isCached && cached.body) {
        return cached.body;
      }
    }

    // 2. Fetch Payment Intent and Validate Invariants
    const intent = await this.repo.findIntentById(paymentIntentId);
    if (!intent) {
      throw new NotFoundError('Payment intent not found.');
    }

    const isClient = intent.clientId === callerUserId;
    if (!isClient && !isAdmin) {
      throw new ForbiddenError(
        'Only the paying client or platform administrators can request refunds.',
      );
    }

    if (intent.status !== 'SUCCEEDED' && intent.status !== 'PARTIALLY_REFUNDED') {
      throw new RefundStateError(
        `Cannot issue refund for payment intent in '${intent.status}' state. Only captured payments can be refunded.`,
      );
    }

    if (!Number.isInteger(input.amount) || input.amount <= 0) {
      throw new BadRequestError('Refund amount must be a positive integer in minor units (paisa).');
    }

    const alreadyRefunded = await this.repo.sumRefundedAmountForIntent(paymentIntentId);
    const refundableAmount = intent.amount - alreadyRefunded;

    if (input.amount > refundableAmount) {
      throw new RefundExceedsCapturableAmountError(
        `Requested refund amount (${input.amount}) exceeds total remaining refundable amount (${refundableAmount}).`,
      );
    }

    // Calculate transaction-specific fee reversal dynamically rather than assuming universal 90/10 split
    const feeReversal =
      intent.amount > 0 ? Math.floor((input.amount * intent.platformFee) / intent.amount) : 0;
    const escrowReversal = input.amount - feeReversal;
    const currentEscrow = await this.ledger.getProjectEscrowBalance(intent.projectId);

    if (currentEscrow < escrowReversal) {
      throw new RefundExceedsCapturableAmountError(
        `Insufficient escrow balance (${currentEscrow}) to process refund (requires ${escrowReversal} from escrow). Milestone funds may have already been released.`,
      );
    }

    const refundId = generateUuidV7();
    const provider = getPaymentProvider(intent.provider);

    // 3. Provider Refund Execution OUTSIDE database transaction
    let providerRefundResult: { providerRefundId: string; status: string };
    try {
      providerRefundResult = await provider.createRefund({
        paymentId: intent.providerPaymentId || intent.id,
        amount: input.amount,
        currency: intent.currency,
        receipt: refundId,
        notes: {
          projectId: intent.projectId,
          paymentIntentId,
          callerUserId,
        },
      });
    } catch (err: any) {
      await this.prisma.refund.create({
        data: {
          id: refundId,
          paymentIntentId,
          projectId: intent.projectId,
          refundedById: callerUserId,
          amount: input.amount,
          currency: intent.currency,
          reason: input.reason,
          status: 'FAILED',
          provider: intent.provider,
          idempotencyKey: input.idempotencyKey ?? null,
          errorMessage: err.message,
        },
      });

      throw new PaymentProviderError(`Payment provider rejected refund: ${err.message}`);
    }

    // 4. Atomic Database Transaction with Concurrent Protection and Recovery
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Re-verify inside atomic transaction to prevent concurrent race conditions from over-refunding
        const aggregateInTx = await tx.refund.aggregate({
          where: {
            paymentIntentId,
            status: { in: ['SUCCEEDED', 'PROCESSING'] },
          },
          _sum: { amount: true },
        });
        const alreadyRefundedInTx = aggregateInTx._sum.amount ?? 0;
        if (alreadyRefundedInTx + input.amount > intent.amount) {
          throw new RefundExceedsCapturableAmountError(
            `Concurrent refund request exceeded total capturable amount. Already processed/processing: ${alreadyRefundedInTx}, requested: ${input.amount}, total captured: ${intent.amount}.`,
          );
        }

        // Re-verify escrow balance inside atomic transaction
        const escrowInTx = await this.ledger.getProjectEscrowBalance(intent.projectId, tx);
        if (escrowInTx < escrowReversal) {
          throw new RefundExceedsCapturableAmountError(
            `Insufficient escrow balance (${escrowInTx}) to process refund (requires ${escrowReversal} from escrow). Milestone funds may have already been released.`,
          );
        }

        const isSucceeded = providerRefundResult.status === 'succeeded';
        const status: RefundStatus = isSucceeded ? 'SUCCEEDED' : 'PROCESSING';
        const now = new Date();

        const refund = await tx.refund.create({
          data: {
            id: refundId,
            paymentIntentId,
            projectId: intent.projectId,
            refundedById: callerUserId,
            amount: input.amount,
            currency: intent.currency,
            reason: input.reason,
            status,
            provider: intent.provider,
            providerRefundId: providerRefundResult.providerRefundId,
            idempotencyKey: input.idempotencyKey ?? null,
            processedAt: isSucceeded ? now : null,
          },
        });

        if (isSucceeded) {
          // Compensating balanced double-entry ledger entries
          await this.ledger.postTransaction(
            {
              paymentIntentId,
              type: 'PAYMENT_REFUNDED',
              description: `Compensating refund entry for payment intent ${paymentIntentId}`,
              entries: [
                {
                  accountCode: `LIABILITIES:ESCROW_HOLDING:${intent.projectId}`,
                  accountName: `Project Escrow Holding for ${intent.projectId}`,
                  accountType: 'LIABILITY',
                  direction: 'DEBIT',
                  amount: escrowReversal,
                  currency: intent.currency,
                  projectId: intent.projectId,
                },
                {
                  accountCode: 'REVENUE:PLATFORM_FEE',
                  accountName: 'CreatorConnect Platform Take Rate',
                  accountType: 'REVENUE',
                  direction: 'DEBIT',
                  amount: feeReversal,
                  currency: intent.currency,
                },
                {
                  accountCode: `ASSETS:PROCESSOR_CLEARING:${intent.provider}`,
                  accountName: `${intent.provider} Settlement Clearing`,
                  accountType: 'ASSET',
                  direction: 'CREDIT',
                  amount: input.amount,
                  currency: intent.currency,
                },
              ],
            },
            tx,
          );

          const newTotalRefunded = alreadyRefunded + input.amount;
          const isFullyRefunded = newTotalRefunded >= intent.amount;

          await tx.paymentIntent.update({
            where: { id: paymentIntentId },
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
                paymentIntentId,
                projectId: intent.projectId,
                amount: input.amount,
                currency: intent.currency,
                providerRefundId: providerRefundResult.providerRefundId,
                processedAt: now.toISOString(),
              },
              status: 'PENDING',
            },
          });
        } else {
          await tx.outboxEvent.create({
            data: {
              id: generateUuidV7(),
              eventType: 'refund.processing.v1',
              aggregateType: 'Refund',
              aggregateId: refundId,
              payload: {
                refundId,
                paymentIntentId,
                projectId: intent.projectId,
                amount: input.amount,
                providerRefundId: providerRefundResult.providerRefundId,
              },
              status: 'PENDING',
            },
          });
        }

        const mapped = this.mapRefund(refund);

        if (input.idempotencyKey) {
          await this.idempotency.record(
            scope,
            input.idempotencyKey,
            input,
            201,
            mapped,
            refundId,
            24,
            tx,
          );
        }

        return mapped;
      });
    } catch (dbErr: any) {
      // Provider succeeded, but DB transaction failed.
      // Persist refund in recoverable PROCESSING state so it can be reconciled without duplicate money movement.
      try {
        await this.prisma.refund.create({
          data: {
            id: refundId,
            paymentIntentId,
            projectId: intent.projectId,
            refundedById: callerUserId,
            amount: input.amount,
            currency: intent.currency,
            reason: input.reason,
            status: 'PROCESSING',
            provider: intent.provider,
            providerRefundId: providerRefundResult.providerRefundId,
            idempotencyKey: input.idempotencyKey ?? null,
            errorMessage: `Provider refund succeeded (${providerRefundResult.providerRefundId}) but local database transaction failed: ${dbErr.message}`,
          },
        });
      } catch {
        // Non-fatal if fallback create also fails; error continues to bubble
      }
      throw dbErr;
    }
  }

  async getRefund(
    callerUserId: string,
    refundId: string,
    isAdmin = false,
  ): Promise<RefundResponse> {
    const refund = await this.repo.findRefundById(refundId);
    if (!refund) {
      throw new NotFoundError('Refund not found.');
    }

    const isClient = refund.paymentIntent.clientId === callerUserId;
    const isTalent = refund.project.talentId === callerUserId;
    if (!isClient && !isTalent && !isAdmin) {
      throw new ForbiddenError('You do not have permission to view this refund.');
    }

    return this.mapRefund(refund);
  }

  async listRefundsForIntent(
    callerUserId: string,
    paymentIntentId: string,
    isAdmin = false,
  ): Promise<RefundResponse[]> {
    const intent = await this.repo.findIntentById(paymentIntentId);
    if (!intent) {
      throw new NotFoundError('Payment intent not found.');
    }

    const isClient = intent.clientId === callerUserId;
    const isTalent = intent.project.talentId === callerUserId;
    if (!isClient && !isTalent && !isAdmin) {
      throw new ForbiddenError('You do not have permission to view refunds for this payment.');
    }

    const refunds = await this.repo.listRefundsByPaymentIntentId(paymentIntentId);
    return refunds.map((r) => this.mapRefund(r));
  }

  async reconcileRefund(
    callerUserId: string,
    refundId: string,
    isAdmin = false,
  ): Promise<RefundResponse> {
    if (!isAdmin) {
      throw new ForbiddenError('Only platform administrators can manually reconcile refunds.');
    }

    const refund = await this.repo.findRefundById(refundId);
    if (!refund) {
      throw new NotFoundError('Refund not found.');
    }

    if (refund.status === 'SUCCEEDED') {
      return this.mapRefund(refund);
    }

    const intent = refund.paymentIntent;
    const now = new Date();

    return await this.prisma.$transaction(async (tx) => {
      const updated = await tx.refund.update({
        where: { id: refundId },
        data: {
          status: 'SUCCEEDED',
          processedAt: now,
        },
      });

      // Transaction-specific proportional fee reversal from actual intent records
      const feeReversal =
        intent.amount > 0 ? Math.floor((refund.amount * intent.platformFee) / intent.amount) : 0;
      const escrowReversal = refund.amount - feeReversal;

      await this.ledger.postTransaction(
        {
          paymentIntentId: intent.id,
          type: 'PAYMENT_REFUND_RECONCILED',
          description: `Reconciliation posted refund entry for intent ${intent.id}`,
          entries: [
            {
              accountCode: `LIABILITIES:ESCROW_HOLDING:${intent.projectId}`,
              accountType: 'LIABILITY',
              direction: 'DEBIT',
              amount: escrowReversal,
              currency: intent.currency,
              projectId: intent.projectId,
            },
            {
              accountCode: 'REVENUE:PLATFORM_FEE',
              accountType: 'REVENUE',
              direction: 'DEBIT',
              amount: feeReversal,
              currency: intent.currency,
            },
            {
              accountCode: `ASSETS:PROCESSOR_CLEARING:${intent.provider}`,
              accountType: 'ASSET',
              direction: 'CREDIT',
              amount: refund.amount,
              currency: intent.currency,
            },
          ],
        },
        tx,
      );

      const totalPriorRefunds = await tx.refund.aggregate({
        where: {
          paymentIntentId: intent.id,
          status: 'SUCCEEDED',
        },
        _sum: { amount: true },
      });
      const totalRefunded = totalPriorRefunds._sum.amount ?? refund.amount;
      const isFullyRefunded = totalRefunded >= intent.amount;

      await tx.paymentIntent.update({
        where: { id: intent.id },
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
            paymentIntentId: intent.id,
            projectId: intent.projectId,
            amount: refund.amount,
            currency: intent.currency,
            providerRefundId: refund.providerRefundId,
            reconciledById: callerUserId,
          },
          status: 'PENDING',
        },
      });

      return this.mapRefund(updated);
    });
  }

  private mapRefund(r: any): RefundResponse {
    return {
      id: r.id,
      paymentIntentId: r.paymentIntentId,
      projectId: r.projectId,
      disputeId: r.disputeId ?? null,
      cancellationId: r.cancellationId ?? null,
      refundedById: r.refundedById,
      amount: r.amount,
      currency: r.currency,
      reason: r.reason,
      status: r.status,
      provider: r.provider,
      providerRefundId: r.providerRefundId ?? null,
      idempotencyKey: r.idempotencyKey ?? null,
      errorMessage: r.errorMessage ?? null,
      processedAt: r.processedAt ? r.processedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}

export const paymentsService = new PaymentsService();
