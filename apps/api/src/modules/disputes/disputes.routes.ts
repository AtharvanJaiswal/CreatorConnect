import type { FastifyPluginAsync } from 'fastify';
import {
  DisputeResponseSchema,
  DisputeEvidenceResponseSchema,
  OpenDisputeInputSchema,
  AddDisputeEvidenceInputSchema,
  UpdateDisputeStatusInputSchema,
  ResolveDisputeInputSchema,
  DisputeStatusSchema,
  type OpenDisputeInput,
  type AddDisputeEvidenceInput,
  type UpdateDisputeStatusInput,
  type ResolveDisputeInput,
  type AdminPermission,
} from '@creatorconnect/contracts';
import { Type, type Static } from '@sinclair/typebox';
import { hasAnyAdminPermission } from '@creatorconnect/auth';
import {
  IdParamSchema,
  type IdParam,
  ProblemDetailsSchema,
  UuidSchema,
} from '@creatorconnect/validation';
import { disputesService, DisputesService } from './disputes.service.js';

const DISPUTE_ADMIN_READ_PERMISSIONS: readonly AdminPermission[] = [
  'projects.moderate',
  'reports.review',
  'reports.resolve',
  'payments.read',
  'payments.refund.approve',
];

const DISPUTE_ADMIN_MANAGE_PERMISSIONS: readonly AdminPermission[] = [
  'projects.moderate',
  'reports.resolve',
  'payments.refund.approve',
];

export interface DisputesRoutesOptions {
  disputesSvc?: DisputesService;
}

const ListDisputesQuerySchema = Type.Object({
  projectId: Type.Optional(UuidSchema),
  status: Type.Optional(DisputeStatusSchema),
});
type ListDisputesQuery = Static<typeof ListDisputesQuerySchema>;

export const disputesRoutes: FastifyPluginAsync<DisputesRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.disputesSvc || disputesService;

  // POST /api/v1/disputes
  fastify.post<{ Body: OpenDisputeInput }>(
    '/api/v1/disputes',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'dispute-open',
          max: 10,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description: 'Opens a formal dispute on an active project and freezes escrow',
        tags: ['Disputes'],
        security: [{ bearerAuth: [] }],
        body: OpenDisputeInputSchema,
        response: {
          201: DisputeResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = hasAnyAdminPermission(request.user, DISPUTE_ADMIN_MANAGE_PERMISSIONS);
      const result = await service.openDispute(request.user.id, request.body, isAdmin);
      return reply.status(201).send(result);
    },
  );

  // GET /api/v1/disputes
  fastify.get<{ Querystring: ListDisputesQuery }>(
    '/api/v1/disputes',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Lists disputes accessible to the authenticated participant or administrator',
        tags: ['Disputes'],
        security: [{ bearerAuth: [] }],
        querystring: ListDisputesQuerySchema,
        response: {
          200: Type.Array(DisputeResponseSchema),
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = hasAnyAdminPermission(request.user, DISPUTE_ADMIN_READ_PERMISSIONS);
      const results = await service.listDisputes(request.user.id, request.query, isAdmin);
      return reply.send(results);
    },
  );

  // GET /api/v1/disputes/:id
  fastify.get<{ Params: IdParam }>(
    '/api/v1/disputes/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves dispute details, timeline history, and uploaded evidence',
        tags: ['Disputes'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: DisputeResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = hasAnyAdminPermission(request.user, DISPUTE_ADMIN_READ_PERMISSIONS);
      const result = await service.getDispute(request.user.id, request.params.id, isAdmin);
      return reply.send(result);
    },
  );

  // POST /api/v1/disputes/:id/evidence
  fastify.post<{ Params: IdParam; Body: AddDisputeEvidenceInput }>(
    '/api/v1/disputes/:id/evidence',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'dispute-evidence',
          max: 20,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description: 'Uploads and attaches verified media evidence to a dispute',
        tags: ['Disputes'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: AddDisputeEvidenceInputSchema,
        response: {
          201: DisputeEvidenceResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = hasAnyAdminPermission(request.user, DISPUTE_ADMIN_MANAGE_PERMISSIONS);
      const result = await service.addEvidence(
        request.user.id,
        request.params.id,
        request.body,
        isAdmin,
      );
      return reply.status(201).send(result);
    },
  );

  // PATCH /api/v1/disputes/:id/status
  fastify.patch<{ Params: IdParam; Body: UpdateDisputeStatusInput }>(
    '/api/v1/disputes/:id/status',
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireAdminPermission(DISPUTE_ADMIN_MANAGE_PERMISSIONS),
      ],
      schema: {
        description:
          'Transitions dispute lifecycle status (Admin with dispute resolution permissions only)',
        tags: ['Disputes'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: UpdateDisputeStatusInputSchema,
        response: {
          200: DisputeResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.updateDisputeStatus(
        request.user.id,
        request.params.id,
        request.body,
        true,
      );
      return reply.send(result);
    },
  );

  // POST /api/v1/disputes/:id/resolve
  fastify.post<{ Params: IdParam; Body: ResolveDisputeInput }>(
    '/api/v1/disputes/:id/resolve',
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireAdminPermission(DISPUTE_ADMIN_MANAGE_PERMISSIONS),
      ],
      schema: {
        description:
          'Arbitrates and resolves dispute for client or creator (Admin with dispute resolution permissions only)',
        tags: ['Disputes'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: ResolveDisputeInputSchema,
        response: {
          200: DisputeResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.resolveDispute(
        request.user.id,
        request.params.id,
        request.body,
        true,
      );
      return reply.send(result);
    },
  );

  // POST /api/v1/disputes/:id/close
  fastify.post<{ Params: IdParam }>(
    '/api/v1/disputes/:id/close',
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireAdminPermission(DISPUTE_ADMIN_MANAGE_PERMISSIONS),
      ],
      schema: {
        description:
          'Finalizes and closes a resolved dispute (Admin with dispute resolution permissions only)',
        tags: ['Disputes'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: DisputeResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.closeDispute(request.user.id, request.params.id, true);
      return reply.send(result);
    },
  );
};
