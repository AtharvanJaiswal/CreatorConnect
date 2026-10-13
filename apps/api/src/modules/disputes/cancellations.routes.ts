import type { FastifyPluginAsync } from 'fastify';
import {
  ProjectCancellationResponseSchema,
  RequestCancellationInputSchema,
  DecideCancellationInputSchema,
  type RequestCancellationInput,
  type DecideCancellationInput,
} from '@creatorconnect/contracts';
import { Type, type Static } from '@sinclair/typebox';
import {
  IdParamSchema,
  type IdParam,
  ProblemDetailsSchema,
  UuidSchema,
} from '@creatorconnect/validation';
import { cancellationsService, CancellationsService } from './cancellations.service.js';

export interface CancellationsRoutesOptions {
  cancellationsSvc?: CancellationsService;
}

const ProjectCancellationParamsSchema = Type.Object({
  id: UuidSchema,
  cancellationId: UuidSchema,
});
type ProjectCancellationParams = Static<typeof ProjectCancellationParamsSchema>;

export const cancellationsRoutes: FastifyPluginAsync<CancellationsRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.cancellationsSvc || cancellationsService;

  // POST /api/v1/projects/:id/cancellations
  fastify.post<{ Params: IdParam; Body: RequestCancellationInput }>(
    '/api/v1/projects/:id/cancellations',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'project-cancellation-request',
          max: 10,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description: 'Requests mutual consent project cancellation',
        tags: ['Projects', 'Cancellations'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: RequestCancellationInputSchema,
        response: {
          201: ProjectCancellationResponseSchema,
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
      const result = await service.requestCancellation(
        request.user.id,
        request.params.id,
        request.body,
        isAdmin,
      );
      return reply.status(201).send(result);
    },
  );

  // GET /api/v1/projects/:id/cancellations
  fastify.get<{ Params: IdParam }>(
    '/api/v1/projects/:id/cancellations',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Lists cancellation history for a project',
        tags: ['Projects', 'Cancellations'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: Type.Array(ProjectCancellationResponseSchema),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = (request.user.roles || []).includes('ADMIN');
      const results = await service.listCancellations(request.user.id, request.params.id, isAdmin);
      return reply.send(results);
    },
  );

  // POST /api/v1/projects/:id/cancellations/:cancellationId/decide
  fastify.post<{ Params: ProjectCancellationParams; Body: DecideCancellationInput }>(
    '/api/v1/projects/:id/cancellations/:cancellationId/decide',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'project-cancellation-decide',
          max: 10,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description: 'Approves or rejects a cancellation request (counterparty or ADMIN)',
        tags: ['Projects', 'Cancellations'],
        security: [{ bearerAuth: [] }],
        params: ProjectCancellationParamsSchema,
        body: DecideCancellationInputSchema,
        response: {
          200: ProjectCancellationResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = (request.user.roles || []).includes('ADMIN');
      const result = await service.decideCancellation(
        request.user.id,
        request.params.id,
        request.params.cancellationId,
        request.body,
        isAdmin,
      );
      return reply.send(result);
    },
  );

  // POST /api/v1/projects/:id/cancellations/:cancellationId/withdraw
  fastify.post<{ Params: ProjectCancellationParams }>(
    '/api/v1/projects/:id/cancellations/:cancellationId/withdraw',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Withdraws a pending cancellation request by the requester',
        tags: ['Projects', 'Cancellations'],
        security: [{ bearerAuth: [] }],
        params: ProjectCancellationParamsSchema,
        response: {
          200: ProjectCancellationResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = (request.user.roles || []).includes('ADMIN');
      const result = await service.withdrawCancellation(
        request.user.id,
        request.params.id,
        request.params.cancellationId,
        isAdmin,
      );
      return reply.send(result);
    },
  );
};
