import type { FastifyPluginAsync } from 'fastify';
import {
  ListNotificationsQuerySchema,
  ListNotificationsResponseSchema,
  NotificationItemSchema,
  MarkNotificationReadParamsSchema,
  MarkAllNotificationsReadResponseSchema,
  ListNotificationPreferencesResponseSchema,
  UpdateNotificationPreferencesInputSchema,
  UpdateNotificationPreferencesResponseSchema,
  type ListNotificationsQuery,
  type MarkNotificationReadParams,
  type UpdateNotificationPreferencesInput,
} from '@creatorconnect/contracts';
import { ProblemDetailsSchema } from '@creatorconnect/validation';
import { notificationsService, NotificationsService } from './notifications.service.js';

export interface NotificationsRoutesOptions {
  notificationsSvc?: NotificationsService;
}

export const notificationsRoutes: FastifyPluginAsync<NotificationsRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.notificationsSvc || notificationsService;

  // ==============================================================================
  // 1. GET /api/v1/notifications — List notifications with keyset cursor pagination
  // ==============================================================================
  fastify.get<{ Querystring: ListNotificationsQuery }>(
    '/api/v1/notifications',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Lists in-app notifications for the authenticated user with keyset pagination',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        querystring: ListNotificationsQuerySchema,
        response: {
          200: ListNotificationsResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listNotifications(request.user.id, request.query);
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // 2. PATCH /api/v1/notifications/:id/read — Mark single notification as read
  // ==============================================================================
  fastify.patch<{ Params: MarkNotificationReadParams }>(
    '/api/v1/notifications/:id/read',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Marks an authenticated user’s notification as read',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        params: MarkNotificationReadParamsSchema,
        response: {
          200: NotificationItemSchema,
          401: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.markAsRead(request.user.id, request.params.id);
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // 3. POST /api/v1/notifications/read-all — Mark all unread notifications as read
  // ==============================================================================
  fastify.post(
    '/api/v1/notifications/read-all',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Marks all unread notifications for the authenticated user as read',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        response: {
          200: MarkAllNotificationsReadResponseSchema,
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.markAllAsRead(request.user.id);
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // 4. GET /api/v1/notification-preferences — Retrieve user notification preferences
  // ==============================================================================
  fastify.get(
    '/api/v1/notification-preferences',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves notification channel preferences for the authenticated user',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        response: {
          200: ListNotificationPreferencesResponseSchema,
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.getPreferences(request.user.id);
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // 5. PUT /api/v1/notification-preferences — Update user notification preferences
  // ==============================================================================
  fastify.put<{ Body: UpdateNotificationPreferencesInput }>(
    '/api/v1/notification-preferences',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Updates notification channel preferences for the authenticated user',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        body: UpdateNotificationPreferencesInputSchema,
        response: {
          200: UpdateNotificationPreferencesResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.updatePreferences(request.user.id, request.body);
      return reply.status(200).send(result);
    },
  );
};
