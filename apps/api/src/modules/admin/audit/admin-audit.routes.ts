import type { FastifyPluginAsync } from 'fastify';
import {
  AdminAuditLogQuerySchema,
  AdminAuditLogResponseSchema,
  type AdminAuditLogQuery,
} from '@creatorconnect/contracts';
import { ProblemDetailsSchema } from '@creatorconnect/validation';
import { adminAuditService, AdminAuditService } from './admin-audit.service.js';

export interface AdminAuditRoutesOptions {
  auditSvc?: AdminAuditService;
}

export const adminAuditRoutes: FastifyPluginAsync<AdminAuditRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.auditSvc || adminAuditService;

  // GET /api/v1/admin/audit
  fastify.get<{ Querystring: AdminAuditLogQuery }>(
    '/api/v1/admin/audit',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('audit.read')],
      schema: {
        description:
          'Unified platform-wide administrative immutable audit log stream with keyset pagination, actor filtering, and sensitive metadata redaction',
        tags: ['Admin Audit'],
        security: [{ bearerAuth: [] }],
        querystring: AdminAuditLogQuerySchema,
        response: {
          200: AdminAuditLogResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listAuditLogs(request.query);
      return reply.status(200).send(result);
    },
  );
};
