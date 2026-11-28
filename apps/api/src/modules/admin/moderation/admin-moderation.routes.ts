import type { FastifyPluginAsync } from 'fastify';
import {
  AdminReportQuerySchema,
  AdminReportListResponseSchema,
  AdminReportListItemSchema,
  ResolveReportRequestSchema,
  DismissReportRequestSchema,
  AdminReviewQuerySchema,
  AdminReviewListResponseSchema,
  AdminReviewListItemSchema,
  ModerateReviewRequestSchema,
  type AdminReportQuery,
  type ResolveReportRequest,
  type DismissReportRequest,
  type AdminReviewQuery,
  type ModerateReviewRequest,
} from '@creatorconnect/contracts';
import { Type } from '@sinclair/typebox';
import { IdParamSchema, type IdParam, ProblemDetailsSchema } from '@creatorconnect/validation';
import { adminModerationService, AdminModerationService } from './admin-moderation.service.js';

export interface AdminModerationRoutesOptions {
  moderationSvc?: AdminModerationService;
}

export const adminModerationRoutes: FastifyPluginAsync<AdminModerationRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.moderationSvc || adminModerationService;

  // ==============================================================================
  // Centralized Reports & Moderation Queue Endpoints
  // ==============================================================================

  // GET /api/v1/admin/reports
  fastify.get<{ Querystring: AdminReportQuery }>(
    '/api/v1/admin/reports',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('reports.review')],
      schema: {
        description:
          'Searches all submitted user and content reports with category and status filters',
        tags: ['Admin Moderation'],
        security: [{ bearerAuth: [] }],
        querystring: AdminReportQuerySchema,
        response: {
          200: AdminReportListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listReports(request.query);
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/admin/reports/:id
  fastify.get<{ Params: IdParam }>(
    '/api/v1/admin/reports/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('reports.review')],
      schema: {
        description: 'Retrieves report details along with reported target preview',
        tags: ['Admin Moderation'],
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
      const result = await service.getReport(request.params.id);
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/admin/reports/:id/resolve
  fastify.post<{ Params: IdParam; Body: ResolveReportRequest }>(
    '/api/v1/admin/reports/:id/resolve',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('reports.resolve')],
      schema: {
        description:
          'Resolves a report and optionally enforces account penalties (WARN, SUSPEND, BAN, CONTENT_REMOVED)',
        tags: ['Admin Moderation'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: ResolveReportRequestSchema,
        response: {
          200: AdminReportListItemSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.resolveReport(request.params.id, request.body, request.user.id);
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/admin/reports/:id/dismiss
  fastify.post<{ Params: IdParam; Body: DismissReportRequest }>(
    '/api/v1/admin/reports/:id/dismiss',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('reports.resolve')],
      schema: {
        description: 'Dismisses a report without action with audit logging',
        tags: ['Admin Moderation'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: DismissReportRequestSchema,
        response: {
          200: AdminReportListItemSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.dismissReport(request.params.id, request.body, request.user.id);
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // Review Moderation Endpoints
  // ==============================================================================

  // GET /api/v1/admin/reviews
  fastify.get<{ Querystring: AdminReviewQuery }>(
    '/api/v1/admin/reviews',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('reviews.moderate')],
      schema: {
        description: 'Searches platform reviews with rating range, status, and participant filters',
        tags: ['Admin Moderation'],
        security: [{ bearerAuth: [] }],
        querystring: AdminReviewQuerySchema,
        response: {
          200: AdminReviewListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listReviews(request.query);
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/admin/reviews/:id/moderate
  fastify.post<{ Params: IdParam; Body: ModerateReviewRequest }>(
    '/api/v1/admin/reviews/:id/moderate',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('reviews.moderate')],
      schema: {
        description:
          'Enforces moderation actions on user reviews (FLAG, HIDE, REMOVE, RESTORE) with moderation audit trail',
        tags: ['Admin Moderation'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: ModerateReviewRequestSchema,
        response: {
          200: AdminReviewListItemSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.moderateReview(request.params.id, request.body, request.user.id);
      return reply.status(200).send(result);
    },
  );
};
