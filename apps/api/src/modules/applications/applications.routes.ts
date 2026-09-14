import type { FastifyPluginAsync } from 'fastify';
import {
  CreateApplicationInputSchema,
  UpdateApplicationStatusInputSchema,
  AcceptApplicationInputSchema,
  ApplicationResponseSchema,
  type CreateApplicationInput,
  type UpdateApplicationStatusInput,
  type AcceptApplicationInput,
} from '@creatorconnect/contracts';
import { Type } from '@sinclair/typebox';
import { IdParamSchema, type IdParam, ProblemDetailsSchema } from '@creatorconnect/validation';
import { applicationsService, ApplicationsService } from './applications.service.js';

export interface ApplicationsRoutesOptions {
  applicationsSvc?: ApplicationsService;
}

export const applicationsRoutes: FastifyPluginAsync<ApplicationsRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.applicationsSvc || applicationsService;

  // POST /api/v1/assignments/:id/apply
  fastify.post<{ Params: IdParam; Body: CreateApplicationInput }>(
    '/api/v1/assignments/:id/apply',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Submits a proposal for an active assignment with deadline row lock',
        tags: ['Applications'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: CreateApplicationInputSchema,
        response: {
          201: ApplicationResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.apply(
        request.user.id,
        request.user.roles,
        request.params.id,
        request.body,
      );
      return reply.status(201).send(result);
    },
  );

  // GET /api/v1/assignments/:id/applications
  fastify.get<{ Params: IdParam }>(
    '/api/v1/assignments/:id/applications',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves all proposals received for an assignment (brand owner/admin only)',
        tags: ['Applications'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: Type.Array(ApplicationResponseSchema),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = request.user.roles.includes('ADMIN');
      const result = await service.getAssignmentApplications(
        request.params.id,
        request.user.id,
        isAdmin,
      );
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/applications/mine
  fastify.get(
    '/api/v1/applications/mine',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves all proposals submitted by the authenticated applicant',
        tags: ['Applications'],
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Array(ApplicationResponseSchema),
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.getMyApplications(request.user.id);
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/applications/:id
  fastify.get<{ Params: IdParam }>(
    '/api/v1/applications/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves a single application by ID (side-effect free)',
        tags: ['Applications'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: ApplicationResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = request.user.roles.includes('ADMIN');
      const result = await service.getApplication(request.params.id, request.user.id, isAdmin);
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/applications/:id/status
  fastify.post<{ Params: IdParam; Body: UpdateApplicationStatusInput }>(
    '/api/v1/applications/:id/status',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Explicitly transitions proposal status (UNDER_REVIEW, SHORTLISTED, REJECTED)',
        tags: ['Applications'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: UpdateApplicationStatusInputSchema,
        response: {
          200: ApplicationResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = request.user.roles.includes('ADMIN');
      const result = await service.updateStatus(
        request.user.id,
        isAdmin,
        request.params.id,
        request.body,
      );
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/applications/:id/withdraw
  fastify.post<{ Params: IdParam }>(
    '/api/v1/applications/:id/withdraw',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Withdraws an active proposal (applicant only)',
        tags: ['Applications'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: ApplicationResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.withdraw(request.user.id, request.params.id);
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/assignments/:id/accept
  fastify.post<{ Params: IdParam; Body: AcceptApplicationInput & { applicationId: string } }>(
    '/api/v1/assignments/:id/accept',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description:
          'Executes atomic hiring acceptance and concurrency-safe competitor auto-rejection',
        tags: ['Applications'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: Type.Intersect([
          AcceptApplicationInputSchema,
          Type.Object({ applicationId: Type.String({ format: 'uuid' }) }),
        ]),
        response: {
          200: ApplicationResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = request.user.roles.includes('ADMIN');
      const result = await service.acceptApplication(
        request.user.id,
        isAdmin,
        request.params.id,
        request.body.applicationId,
        request.body,
      );
      return reply.status(200).send(result);
    },
  );
};
