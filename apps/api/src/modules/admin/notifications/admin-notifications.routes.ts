import type { FastifyPluginAsync } from 'fastify';
import {
  CampaignListQuerySchema,
  CampaignListResponseSchema,
  NotificationCampaignResponseSchema,
  CreateNotificationCampaignRequestSchema,
  EstimateCampaignRequestSchema,
  EstimateCampaignResponseSchema,
  type CampaignListQuery,
  type CreateNotificationCampaignRequest,
  type EstimateCampaignRequest,
} from '@creatorconnect/contracts';
import { IdParamSchema, type IdParam, ProblemDetailsSchema } from '@creatorconnect/validation';
import {
  adminNotificationsService,
  AdminNotificationsService,
} from './admin-notifications.service.js';

export interface AdminNotificationsRoutesOptions {
  notificationsSvc?: AdminNotificationsService;
}

export const adminNotificationsRoutes: FastifyPluginAsync<AdminNotificationsRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.notificationsSvc || adminNotificationsService;

  // GET /api/v1/admin/notifications/campaigns
  fastify.get<{ Querystring: CampaignListQuery }>(
    '/api/v1/admin/notifications/campaigns',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('settings.read')],
      schema: {
        description: 'Lists all broadcast notification campaigns with delivery metrics',
        tags: ['Admin Notifications'],
        security: [{ bearerAuth: [] }],
        querystring: CampaignListQuerySchema,
        response: {
          200: CampaignListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listCampaigns(request.query);
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/admin/notifications/campaigns/estimate
  fastify.post<{ Body: EstimateCampaignRequest }>(
    '/api/v1/admin/notifications/campaigns/estimate',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('settings.read')],
      schema: {
        description:
          'Estimates target recipient audience count for notification broadcast parameters',
        tags: ['Admin Notifications'],
        security: [{ bearerAuth: [] }],
        body: EstimateCampaignRequestSchema,
        response: {
          200: EstimateCampaignResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const count = await service.estimateRecipients(request.body.targetType);
      return reply.status(200).send({
        targetType: request.body.targetType,
        estimatedCount: count,
      });
    },
  );

  // POST /api/v1/admin/notifications/campaigns
  fastify.post<{ Body: CreateNotificationCampaignRequest }>(
    '/api/v1/admin/notifications/campaigns',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('settings.manage')],
      schema: {
        description: 'Creates and stages a notification broadcast campaign',
        tags: ['Admin Notifications'],
        security: [{ bearerAuth: [] }],
        body: CreateNotificationCampaignRequestSchema,
        response: {
          201: NotificationCampaignResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const campaign = await service.createCampaign(request.body, request.user.id);
      return reply.status(201).send(campaign);
    },
  );

  // POST /api/v1/admin/notifications/campaigns/:id/send
  fastify.post<{ Params: IdParam }>(
    '/api/v1/admin/notifications/campaigns/:id/send',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('settings.manage')],
      schema: {
        description: 'Executes immediate broadcast dispatch for a staged notification campaign',
        tags: ['Admin Notifications'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: NotificationCampaignResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const sent = await service.sendCampaign(request.params.id, request.user.id);
      return reply.status(200).send(sent);
    },
  );

  // POST /api/v1/admin/notifications/campaigns/:id/cancel
  fastify.post<{ Params: IdParam }>(
    '/api/v1/admin/notifications/campaigns/:id/cancel',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('settings.manage')],
      schema: {
        description: 'Cancels a pending or scheduled notification broadcast campaign',
        tags: ['Admin Notifications'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: NotificationCampaignResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const cancelled = await service.cancelCampaign(request.params.id, request.user.id);
      return reply.status(200).send(cancelled);
    },
  );
};
