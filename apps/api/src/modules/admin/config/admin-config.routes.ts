import type { FastifyPluginAsync } from 'fastify';
import {
  PlatformSettingResponseSchema,
  UpdatePlatformSettingRequestSchema,
  PlatformSettingAuditResponseSchema,
  RollbackPlatformSettingRequestSchema,
  type UpdatePlatformSettingRequest,
  type RollbackPlatformSettingRequest,
} from '@creatorconnect/contracts';
import { Type, type Static } from '@sinclair/typebox';
import { ProblemDetailsSchema } from '@creatorconnect/validation';
import { adminConfigService, AdminConfigService } from './admin-config.service.js';

const SettingKeyParamSchema = Type.Object({
  key: Type.String({ minLength: 2, maxLength: 128 }),
});
type SettingKeyParam = Static<typeof SettingKeyParamSchema>;

export interface AdminConfigRoutesOptions {
  configSvc?: AdminConfigService;
}

export const adminConfigRoutes: FastifyPluginAsync<AdminConfigRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.configSvc || adminConfigService;

  // GET /api/v1/admin/settings
  fastify.get(
    '/api/v1/admin/settings',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('settings.read')],
      schema: {
        description: 'Lists all dynamic platform configuration parameters and operational switches',
        tags: ['Admin Settings'],
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Array(PlatformSettingResponseSchema),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (_request, reply) => {
      const settings = await service.listSettings();
      return reply.status(200).send(settings);
    },
  );

  // GET /api/v1/admin/settings/:key
  fastify.get<{ Params: SettingKeyParam }>(
    '/api/v1/admin/settings/:key',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('settings.read')],
      schema: {
        description: 'Retrieves a single platform setting by key with active value and schema',
        tags: ['Admin Settings'],
        security: [{ bearerAuth: [] }],
        params: SettingKeyParamSchema,
        response: {
          200: PlatformSettingResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const setting = await service.getSetting(request.params.key);
      return reply.status(200).send(setting);
    },
  );

  // PATCH /api/v1/admin/settings/:key
  fastify.post<{ Params: SettingKeyParam; Body: UpdatePlatformSettingRequest }>(
    '/api/v1/admin/settings/:key',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('settings.manage')],
      schema: {
        description: 'Updates a platform setting value with mandatory audit justification',
        tags: ['Admin Settings'],
        security: [{ bearerAuth: [] }],
        params: SettingKeyParamSchema,
        body: UpdatePlatformSettingRequestSchema,
        response: {
          200: PlatformSettingResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const updated = await service.updateSetting(
        request.params.key,
        request.body,
        request.user.id,
      );
      return reply.status(200).send(updated);
    },
  );

  // GET /api/v1/admin/settings/:key/history
  fastify.get<{ Params: SettingKeyParam }>(
    '/api/v1/admin/settings/:key/history',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('settings.read')],
      schema: {
        description: 'Retrieves complete immutable version history and change logs for a setting',
        tags: ['Admin Settings'],
        security: [{ bearerAuth: [] }],
        params: SettingKeyParamSchema,
        response: {
          200: Type.Array(PlatformSettingAuditResponseSchema),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const history = await service.getSettingHistory(request.params.key);
      return reply.status(200).send(history);
    },
  );

  // POST /api/v1/admin/settings/:key/rollback
  fastify.post<{ Params: SettingKeyParam; Body: RollbackPlatformSettingRequest }>(
    '/api/v1/admin/settings/:key/rollback',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('settings.manage')],
      schema: {
        description: 'Rolls back a platform setting to a specified prior version',
        tags: ['Admin Settings'],
        security: [{ bearerAuth: [] }],
        params: SettingKeyParamSchema,
        body: RollbackPlatformSettingRequestSchema,
        response: {
          200: PlatformSettingResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const rolledBack = await service.rollbackSetting(
        request.params.key,
        request.body,
        request.user.id,
      );
      return reply.status(200).send(rolledBack);
    },
  );
};
