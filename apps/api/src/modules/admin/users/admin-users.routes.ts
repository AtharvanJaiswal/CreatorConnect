import type { FastifyPluginAsync } from 'fastify';
import {
  AdminUserQuerySchema,
  AdminUserListResponseSchema,
  AdminUserDetailsResponseSchema,
  AdminUserListItemSchema,
  SuspendUserRequestSchema,
  ReactivateUserRequestSchema,
  type AdminUserQuery,
  type SuspendUserRequest,
  type ReactivateUserRequest,
} from '@creatorconnect/contracts';
import { Type } from '@sinclair/typebox';
import { IdParamSchema, type IdParam, ProblemDetailsSchema } from '@creatorconnect/validation';
import { adminUsersService, AdminUsersService } from './admin-users.service.js';

export interface AdminUsersRoutesOptions {
  usersSvc?: AdminUsersService;
}

export const adminUsersRoutes: FastifyPluginAsync<AdminUsersRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.usersSvc || adminUsersService;

  // GET /api/v1/admin/users
  fastify.get<{ Querystring: AdminUserQuery }>(
    '/api/v1/admin/users',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('users.read')],
      schema: {
        description:
          'Administrative user directory search, status filtering, and paginated overview',
        tags: ['Admin Users'],
        security: [{ bearerAuth: [] }],
        querystring: AdminUserQuerySchema,
        response: {
          200: AdminUserListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listUsers(request.query);
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/admin/users/:id
  fastify.get<{ Params: IdParam }>(
    '/api/v1/admin/users/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('users.read')],
      schema: {
        description:
          'Retrieves deep administrative user account details, profiles, statistics, and timeline',
        tags: ['Admin Users'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: AdminUserDetailsResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const userDetails = await service.getUserDetails(request.params.id);
      return reply.status(200).send(userDetails);
    },
  );

  // POST /api/v1/admin/users/:id/suspend
  fastify.post<{ Params: IdParam; Body: SuspendUserRequest }>(
    '/api/v1/admin/users/:id/suspend',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('users.suspend')],
      schema: {
        description:
          'Administratively suspends a user account with explicit justification and audit logging',
        tags: ['Admin Users'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: SuspendUserRequestSchema,
        response: {
          200: AdminUserListItemSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const updated = await service.suspendUser(
        request.params.id,
        request.body.reason,
        request.user.id,
        request.ip,
        request.headers['user-agent'],
      );
      return reply.status(200).send(updated);
    },
  );

  // POST /api/v1/admin/users/:id/reactivate
  fastify.post<{ Params: IdParam; Body: ReactivateUserRequest }>(
    '/api/v1/admin/users/:id/reactivate',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('users.reactivate')],
      schema: {
        description: 'Reactivates a previously suspended user account with explicit audit logging',
        tags: ['Admin Users'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: ReactivateUserRequestSchema,
        response: {
          200: AdminUserListItemSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const updated = await service.reactivateUser(
        request.params.id,
        request.body.reason,
        request.user.id,
        request.ip,
        request.headers['user-agent'],
      );
      return reply.status(200).send(updated);
    },
  );

  // GET /api/v1/admin/users/:id/activity
  fastify.get<{ Params: IdParam; Querystring: { limit?: number } }>(
    '/api/v1/admin/users/:id/activity',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('users.read')],
      schema: {
        description: 'Retrieves chronological audit log activity timeline for a designated user',
        tags: ['Admin Users'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        querystring: Type.Object({
          limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 50 })),
        }),
        response: {
          200: Type.Array(
            Type.Object({
              id: Type.String(),
              action: Type.String(),
              entity: Type.String(),
              entityId: Type.Union([Type.String(), Type.Null()]),
              ipAddress: Type.Union([Type.String(), Type.Null()]),
              userAgent: Type.Union([Type.String(), Type.Null()]),
              metadata: Type.Optional(Type.Any()),
              createdAt: Type.String({ format: 'date-time' }),
            }),
          ),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const activity = await service.getUserActivity(request.params.id, request.query.limit);
      return reply.status(200).send(activity);
    },
  );
};
