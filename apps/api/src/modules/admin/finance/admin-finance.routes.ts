import type { FastifyPluginAsync } from 'fastify';
import {
  AdminPaymentQuerySchema,
  AdminPaymentListResponseSchema,
  AdminRefundQuerySchema,
  AdminRefundListResponseSchema,
  AdminRefundListItemSchema,
  CreateRefundRequestSchema,
  DecideRefundApprovalRequestSchema,
  AdminReconciliationReportSchema,
  type AdminPaymentQuery,
  type AdminRefundQuery,
  type CreateRefundRequest,
  type DecideRefundApprovalRequest,
} from '@creatorconnect/contracts';
import { Type } from '@sinclair/typebox';
import { IdParamSchema, type IdParam, ProblemDetailsSchema } from '@creatorconnect/validation';
import { adminFinanceService, AdminFinanceService } from './admin-finance.service.js';
import { BadRequestError } from '../../../errors/app-error.js';

function extractOptionalIdempotencyKey(
  rawHeader: string | string[] | undefined,
): string | undefined {
  if (rawHeader === undefined) {
    return undefined;
  }
  if (Array.isArray(rawHeader)) {
    throw new BadRequestError('Multiple Idempotency-Key headers are not permitted.');
  }
  const trimmed = rawHeader.trim();
  if (trimmed.length === 0) {
    throw new BadRequestError('Idempotency-Key header cannot be empty.');
  }
  if (trimmed.length > 128) {
    throw new BadRequestError('Idempotency-Key header exceeds maximum length of 128 characters.');
  }
  return trimmed;
}

export interface AdminFinanceRoutesOptions {
  financeSvc?: AdminFinanceService;
}

export const adminFinanceRoutes: FastifyPluginAsync<AdminFinanceRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.financeSvc || adminFinanceService;

  // ==============================================================================
  // Payment Intention & Escrow Endpoints
  // ==============================================================================

  // GET /api/v1/admin/payments
  fastify.get<{ Querystring: AdminPaymentQuery }>(
    '/api/v1/admin/payments',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('payments.read')],
      schema: {
        description:
          'Searches all payments and escrow intents with status, provider, and range filters',
        tags: ['Admin Finance'],
        security: [{ bearerAuth: [] }],
        querystring: AdminPaymentQuerySchema,
        response: {
          200: AdminPaymentListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listPayments(request.query);
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/admin/payments/:id
  fastify.get<{ Params: IdParam }>(
    '/api/v1/admin/payments/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('payments.read')],
      schema: {
        description:
          'Retrieves payment intent details with ledger postings, refunds, and fee breakdown',
        tags: ['Admin Finance'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: Type.Any(),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const payment = await service.getPayment(request.params.id);
      return reply.status(200).send(payment);
    },
  );

  // ==============================================================================
  // Refund Administration & Dual Approval Endpoints
  // ==============================================================================

  // GET /api/v1/admin/refunds
  fastify.get<{ Querystring: AdminRefundQuery }>(
    '/api/v1/admin/refunds',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('payments.read')],
      schema: {
        description: 'Lists refunds with status, dual-approval state, and project relations',
        tags: ['Admin Finance'],
        security: [{ bearerAuth: [] }],
        querystring: AdminRefundQuerySchema,
        response: {
          200: AdminRefundListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listRefunds(request.query);
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/admin/refunds
  fastify.post<{ Body: CreateRefundRequest }>(
    '/api/v1/admin/refunds',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('payments.refund.request')],
      schema: {
        description:
          'Initiates a refund request with automatic dual-approval gating for high-value sums',
        tags: ['Admin Finance'],
        security: [{ bearerAuth: [] }],
        body: CreateRefundRequestSchema,
        response: {
          201: AdminRefundListItemSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const adminPerms = request.user.adminPermissions || [];
      const hasApprovePermission =
        adminPerms.includes('*') || adminPerms.includes('payments.refund.approve');
      const idempotencyKey = extractOptionalIdempotencyKey(request.headers['idempotency-key']);

      const result = await service.createRefund(
        request.body,
        request.user.id,
        hasApprovePermission,
        idempotencyKey,
      );
      return reply.status(201).send(result);
    },
  );

  // POST /api/v1/admin/refunds/:id/approve
  fastify.post<{ Params: IdParam; Body: { reason: string } }>(
    '/api/v1/admin/refunds/:id/approve',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('payments.refund.approve')],
      schema: {
        description: 'Approves a pending refund request with strict anti-self-approval enforcement',
        tags: ['Admin Finance'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: Type.Object({
          reason: Type.String({ minLength: 3, maxLength: 500 }),
        }),
        response: {
          200: AdminRefundListItemSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const idempotencyKey = extractOptionalIdempotencyKey(request.headers['idempotency-key']);
      const result = await service.decideRefund(
        request.params.id,
        request.user.id,
        {
          decision: 'APPROVE',
          reason: request.body.reason,
        },
        idempotencyKey,
      );
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/admin/refunds/:id/reject
  fastify.post<{ Params: IdParam; Body: { reason: string } }>(
    '/api/v1/admin/refunds/:id/reject',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('payments.refund.approve')],
      schema: {
        description: 'Rejects a pending refund request with strict anti-self-approval enforcement',
        tags: ['Admin Finance'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: Type.Object({
          reason: Type.String({ minLength: 3, maxLength: 500 }),
        }),
        response: {
          200: AdminRefundListItemSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const idempotencyKey = extractOptionalIdempotencyKey(request.headers['idempotency-key']);
      const result = await service.decideRefund(
        request.params.id,
        request.user.id,
        {
          decision: 'REJECT',
          reason: request.body.reason,
        },
        idempotencyKey,
      );
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/admin/refunds/:id/decide
  fastify.post<{ Params: IdParam; Body: DecideRefundApprovalRequest }>(
    '/api/v1/admin/refunds/:id/decide',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('payments.refund.approve')],
      schema: {
        description: 'Decides a pending dual-approval refund (APPROVE or REJECT)',
        tags: ['Admin Finance'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: DecideRefundApprovalRequestSchema,
        response: {
          200: AdminRefundListItemSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const idempotencyKey = extractOptionalIdempotencyKey(request.headers['idempotency-key']);
      const result = await service.decideRefund(
        request.params.id,
        request.user.id,
        request.body,
        idempotencyKey,
      );
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // Ledger Reconciliation & Audit Endpoint
  // ==============================================================================

  // GET /api/v1/admin/reconciliation
  fastify.get(
    '/api/v1/admin/reconciliation',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('payments.reconcile')],
      schema: {
        description:
          'Audits double-entry ledger balance integrity and returns unbalanced account discrepancies',
        tags: ['Admin Finance'],
        security: [{ bearerAuth: [] }],
        response: {
          200: AdminReconciliationReportSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const report = await service.getReconciliationReport(request.user.id);
      return reply.status(200).send(report);
    },
  );
};
