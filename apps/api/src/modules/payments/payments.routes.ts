import type { FastifyPluginAsync } from 'fastify';
import {
  PaymentIntentResponseSchema,
  CreatePaymentIntentInputSchema,
  ConfirmPaymentIntentInputSchema,
  WebhookIngestResponseSchema,
  PaymentProviderSchema,
  type CreatePaymentIntentInput,
  type ConfirmPaymentIntentInput,
  type PaymentProvider,
} from '@creatorconnect/contracts';
import { Type, type Static } from '@sinclair/typebox';
import {
  IdParamSchema,
  type IdParam,
  ProblemDetailsSchema,
  UuidSchema,
} from '@creatorconnect/validation';
import { paymentsService, PaymentsService } from './payments.service.js';
import { ledgerService, LedgerService } from './ledger/ledger.service.js';

export interface PaymentsRoutesOptions {
  paymentsSvc?: PaymentsService;
  ledgerSvc?: LedgerService;
}

const WebhookParamsSchema = Type.Object({
  provider: PaymentProviderSchema,
});
type WebhookParams = Static<typeof WebhookParamsSchema>;

const EscrowBalanceResponseSchema = Type.Object({
  projectId: UuidSchema,
  balance: Type.Integer(),
  currency: Type.String(),
});

const EscrowReleaseResponseSchema = Type.Object({
  releasedAmount: Type.Integer(),
  currency: Type.String(),
});

export const paymentsRoutes: FastifyPluginAsync<PaymentsRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.paymentsSvc || paymentsService;
  const ledger = options.ledgerSvc || ledgerService;

  // POST /api/v1/payments/intents
  fastify.post<{ Body: CreatePaymentIntentInput }>(
    '/api/v1/payments/intents',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'payment-intent-create',
          max: 30,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description: 'Initializes an idempotent payment intent for project escrow',
        tags: ['Payments'],
        security: [{ bearerAuth: [] }],
        body: CreatePaymentIntentInputSchema,
        response: {
          201: PaymentIntentResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = (request.user.roles || []).includes('ADMIN');
      const result = await service.createPaymentIntent(request.user.id, request.body, isAdmin);
      return reply.status(201).send(result);
    },
  );

  // GET /api/v1/payments/intents/:id
  fastify.get<{ Params: IdParam }>(
    '/api/v1/payments/intents/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves payment intent status and authorization details',
        tags: ['Payments'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: PaymentIntentResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = (request.user.roles || []).includes('ADMIN');
      const result = await service.getPaymentIntent(request.user.id, request.params.id, isAdmin);
      return reply.send(result);
    },
  );

  // POST /api/v1/payments/intents/:id/confirm
  fastify.post<{ Params: IdParam; Body: ConfirmPaymentIntentInput }>(
    '/api/v1/payments/intents/:id/confirm',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'payment-intent-confirm',
          max: 30,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description: 'Confirms captured payment and records balanced escrow entries',
        tags: ['Payments'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: ConfirmPaymentIntentInputSchema,
        response: {
          200: PaymentIntentResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = (request.user.roles || []).includes('ADMIN');
      const result = await service.confirmPaymentIntent(
        request.user.id,
        request.params.id,
        request.body,
        isAdmin,
      );
      return reply.send(result);
    },
  );

  // GET /api/v1/payments/projects/:id/escrow
  fastify.get<{ Params: IdParam }>(
    '/api/v1/payments/projects/:id/escrow',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves current ledger escrow balance for a project',
        tags: ['Payments'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: EscrowBalanceResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const balance = await ledger.getProjectEscrowBalance(request.params.id);
      return reply.send({
        projectId: request.params.id,
        balance,
        currency: 'INR',
      });
    },
  );

  // POST /api/v1/payments/projects/:id/escrow/release
  fastify.post<{ Params: IdParam }>(
    '/api/v1/payments/projects/:id/escrow/release',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'escrow-release',
          max: 10,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description: 'Releases milestone escrow funds to creator payable account',
        tags: ['Payments'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: EscrowReleaseResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = (request.user.roles || []).includes('ADMIN');
      const result = await service.releaseProjectEscrow(
        request.user.id,
        request.params.id,
        isAdmin,
      );
      return reply.send(result);
    },
  );

  // POST /api/v1/payments/webhooks/:provider
  fastify.post<{ Params: WebhookParams }>(
    '/api/v1/payments/webhooks/:provider',
    {
      schema: {
        description: 'Ingests signed payment provider webhooks with deduplication',
        tags: ['Payments'],
        params: WebhookParamsSchema,
        response: {
          200: WebhookIngestResponseSchema,
          400: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const signature =
        (request.headers['x-razorpay-signature'] as string) ||
        (request.headers['stripe-signature'] as string) ||
        (request.headers['x-webhook-signature'] as string) ||
        '';

      const rawBody =
        (request as any).rawBody ||
        (typeof request.body === 'string' ? request.body : JSON.stringify(request.body));

      const result = await service.processWebhook(
        request.params.provider as PaymentProvider,
        rawBody,
        signature,
      );

      return reply.send(result);
    },
  );
};
