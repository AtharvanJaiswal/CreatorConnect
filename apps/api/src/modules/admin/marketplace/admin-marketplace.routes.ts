import type { FastifyPluginAsync } from 'fastify';
import {
  AdminCreatorQuerySchema,
  AdminCreatorListResponseSchema,
  AdminCreatorListItemSchema,
  VerifyCreatorRequestSchema,
  AdminClientQuerySchema,
  AdminClientListResponseSchema,
  AdminClientListItemSchema,
  VerifyClientRequestSchema,
  AdminProjectQuerySchema,
  AdminProjectListResponseSchema,
  ModerateProjectRequestSchema,
  type AdminCreatorQuery,
  type VerifyCreatorRequest,
  type AdminClientQuery,
  type VerifyClientRequest,
  type AdminProjectQuery,
  type ModerateProjectRequest,
} from '@creatorconnect/contracts';
import { Type } from '@sinclair/typebox';
import { IdParamSchema, type IdParam, ProblemDetailsSchema } from '@creatorconnect/validation';
import { adminMarketplaceService, AdminMarketplaceService } from './admin-marketplace.service.js';

export interface AdminMarketplaceRoutesOptions {
  marketplaceSvc?: AdminMarketplaceService;
}

export const adminMarketplaceRoutes: FastifyPluginAsync<AdminMarketplaceRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.marketplaceSvc || adminMarketplaceService;

  // ==============================================================================
  // Creator Management Endpoints
  // ==============================================================================

  // GET /api/v1/admin/creators
  fastify.get<{ Querystring: AdminCreatorQuery }>(
    '/api/v1/admin/creators',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('users.read')],
      schema: {
        description:
          'Lists creator profiles with portfolio counts, ratings, and verification status',
        tags: ['Admin Marketplace'],
        security: [{ bearerAuth: [] }],
        querystring: AdminCreatorQuerySchema,
        response: {
          200: AdminCreatorListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listCreators(request.query);
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/admin/creators/:id/verify
  fastify.post<{ Params: IdParam; Body: VerifyCreatorRequest }>(
    '/api/v1/admin/creators/:id/verify',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('users.update')],
      schema: {
        description: 'Toggles creator profile verified badge status with mandatory justification',
        tags: ['Admin Marketplace'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: VerifyCreatorRequestSchema,
        response: {
          200: AdminCreatorListItemSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const updated = await service.verifyCreator(
        request.params.id,
        request.body.isVerified,
        request.body.reason,
        request.user.id,
      );
      return reply.status(200).send(updated);
    },
  );

  // ==============================================================================
  // Client Management Endpoints
  // ==============================================================================

  // GET /api/v1/admin/clients
  fastify.get<{ Querystring: AdminClientQuery }>(
    '/api/v1/admin/clients',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('users.read')],
      schema: {
        description: 'Lists brand client profiles with total projects and historical spend volume',
        tags: ['Admin Marketplace'],
        security: [{ bearerAuth: [] }],
        querystring: AdminClientQuerySchema,
        response: {
          200: AdminClientListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listClients(request.query);
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/admin/clients/:id/verify
  fastify.post<{ Params: IdParam; Body: VerifyClientRequest }>(
    '/api/v1/admin/clients/:id/verify',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('users.update')],
      schema: {
        description: 'Toggles client organization verified badge status with audit logging',
        tags: ['Admin Marketplace'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: VerifyClientRequestSchema,
        response: {
          200: AdminClientListItemSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const updated = await service.verifyClient(
        request.params.id,
        request.body.isVerified,
        request.body.reason,
        request.user.id,
      );
      return reply.status(200).send(updated);
    },
  );

  // ==============================================================================
  // Project Governance Endpoints
  // ==============================================================================

  // GET /api/v1/admin/projects
  fastify.get<{ Querystring: AdminProjectQuery }>(
    '/api/v1/admin/projects',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('projects.read')],
      schema: {
        description:
          'Searches all marketplace projects with status, participant, and dispute filters',
        tags: ['Admin Marketplace'],
        security: [{ bearerAuth: [] }],
        querystring: AdminProjectQuerySchema,
        response: {
          200: AdminProjectListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listProjects(request.query);
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/admin/projects/:id
  fastify.get<{ Params: IdParam }>(
    '/api/v1/admin/projects/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('projects.read')],
      schema: {
        description:
          'Retrieves comprehensive project details, deliverables, disputes, and escrow state',
        tags: ['Admin Marketplace'],
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
      const projectDetails = await service.getProjectDetails(request.params.id);
      return reply.status(200).send(projectDetails);
    },
  );

  // POST /api/v1/admin/projects/:id/moderate
  fastify.post<{ Params: IdParam; Body: ModerateProjectRequest }>(
    '/api/v1/admin/projects/:id/moderate',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('projects.moderate')],
      schema: {
        description:
          'Enforces moderation action on a project (SUSPEND, RESTRICT, FLAG_UNDER_REVIEW, RESTORE)',
        tags: ['Admin Marketplace'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: ModerateProjectRequestSchema,
        response: {
          200: Type.Object({
            id: Type.String(),
            title: Type.String(),
            status: Type.String(),
            action: Type.String(),
            reason: Type.String(),
            updatedAt: Type.String({ format: 'date-time' }),
          }),
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.moderateProject(
        request.params.id,
        request.body,
        request.user.id,
      );
      return reply.status(200).send(result);
    },
  );
};
