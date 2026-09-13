import type { FastifyPluginAsync } from 'fastify';
import {
  UserResponseSchema,
  UpdateProfileRequestSchema,
  UpdateUserStatusRequestSchema,
  type UpdateProfileRequest,
  type UpdateUserStatusRequest,
  type UserStatus,
} from '@creatorconnect/contracts';
import { IdParamSchema, type IdParam, ProblemDetailsSchema } from '@creatorconnect/validation';
import { subject } from '@creatorconnect/auth';
import { usersService, UsersService } from './users.service.js';
import { AuthInsufficientRoleError } from '../../errors/app-error.js';

export interface UsersRoutesOptions {
  usersSvc?: UsersService;
}

export const usersRoutes: FastifyPluginAsync<UsersRoutesOptions> = async (fastify, options) => {
  const service = options.usersSvc || usersService;

  // GET /api/v1/users/me
  fastify.get(
    '/api/v1/users/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves current authenticated user profile, roles, and status',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        response: {
          200: UserResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const profile = await service.getProfile(request.user.id);
      return reply.status(200).send(profile);
    },
  );

  // PATCH /api/v1/users/me
  fastify.patch<{ Body: UpdateProfileRequest }>(
    '/api/v1/users/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Updates current authenticated user profile attributes',
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        body: UpdateProfileRequestSchema,
        response: {
          200: UserResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      // Tier 3 CASL check: verify ownership of User resource
      if (!request.ability.can('update', subject('User', { id: request.user.id }))) {
        throw new AuthInsufficientRoleError('You are not authorized to update this profile.');
      }

      const updated = await service.updateProfile(request.user.id, request.body);
      return reply.status(200).send(updated);
    },
  );

  // PATCH /api/v1/admin/users/:id/status
  fastify.patch<{ Params: IdParam; Body: UpdateUserStatusRequest }>(
    '/api/v1/admin/users/:id/status',
    {
      preHandler: [fastify.authenticate, fastify.requireRole(['ADMIN'])],
      schema: {
        description:
          'Administratively updates a user account status (ACTIVE, SUSPENDED, DEACTIVATED)',
        tags: ['Admin'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: UpdateUserStatusRequestSchema,
        response: {
          200: UserResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const targetUserId = request.params.id;
      const newStatus = request.body.status as UserStatus;

      const updated = await service.updateUserStatus(
        targetUserId,
        newStatus,
        request.user.id,
        request.ip,
        request.headers['user-agent'],
      );

      return reply.status(200).send(updated);
    },
  );
};
