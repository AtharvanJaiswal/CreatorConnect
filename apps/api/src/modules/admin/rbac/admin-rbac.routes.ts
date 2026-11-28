import type { FastifyPluginAsync } from 'fastify';
import {
  AdminRoleResponseSchema,
  CreateAdminRoleRequestSchema,
  UpdateAdminRoleRequestSchema,
  AdminPermissionResponseSchema,
  AdminUserRoleResponseSchema,
  AssignAdminRoleRequestSchema,
  RevokeAdminRoleRequestSchema,
  type CreateAdminRoleRequest,
  type UpdateAdminRoleRequest,
  type AssignAdminRoleRequest,
  type RevokeAdminRoleRequest,
} from '@creatorconnect/contracts';
import { Type } from '@sinclair/typebox';
import { IdParamSchema, type IdParam, ProblemDetailsSchema } from '@creatorconnect/validation';
import { adminRbacService, AdminRbacService } from './admin-rbac.service.js';
import { AdminRoleNotFoundError } from '../../../errors/app-error.js';

export interface AdminRbacRoutesOptions {
  rbacSvc?: AdminRbacService;
}

export const adminRbacRoutes: FastifyPluginAsync<AdminRbacRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.rbacSvc || adminRbacService;

  // GET /api/v1/admin/roles
  fastify.get(
    '/api/v1/admin/roles',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('admins.read')],
      schema: {
        description: 'Lists all administrative roles, user counts, and assigned permissions',
        tags: ['Admin RBAC'],
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Array(AdminRoleResponseSchema),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (_request, reply) => {
      const roles = await service.listRoles();
      return reply.status(200).send(roles);
    },
  );

  // GET /api/v1/admin/roles/:id
  fastify.get<{ Params: IdParam }>(
    '/api/v1/admin/roles/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('admins.read')],
      schema: {
        description: 'Retrieves details and permissions for an administrative role',
        tags: ['Admin RBAC'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: AdminRoleResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const role = await service.getRole(request.params.id);
      if (!role) {
        throw new AdminRoleNotFoundError(`Administrative role not found: ${request.params.id}`);
      }
      return reply.status(200).send(role);
    },
  );

  // POST /api/v1/admin/roles
  fastify.post<{ Body: CreateAdminRoleRequest }>(
    '/api/v1/admin/roles',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('admins.manage')],
      schema: {
        description: 'Creates a custom administrative role with designated permissions',
        tags: ['Admin RBAC'],
        security: [{ bearerAuth: [] }],
        body: CreateAdminRoleRequestSchema,
        response: {
          201: AdminRoleResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const created = await service.createRole(request.body, request.user.id);
      return reply.status(201).send(created);
    },
  );

  // PATCH /api/v1/admin/roles/:id
  fastify.patch<{ Params: IdParam; Body: UpdateAdminRoleRequest }>(
    '/api/v1/admin/roles/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('admins.manage')],
      schema: {
        description: 'Updates description or permission assignments for an administrative role',
        tags: ['Admin RBAC'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: UpdateAdminRoleRequestSchema,
        response: {
          200: AdminRoleResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const updated = await service.updateRole(request.params.id, request.body, request.user.id);
      return reply.status(200).send(updated);
    },
  );

  // DELETE /api/v1/admin/roles/:id
  fastify.delete<{ Params: IdParam }>(
    '/api/v1/admin/roles/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('admins.manage')],
      schema: {
        description: 'Deletes a custom administrative role (system roles cannot be deleted)',
        tags: ['Admin RBAC'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          204: Type.Null(),
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      await service.deleteRole(request.params.id, request.user.id);
      return reply.status(204).send(null);
    },
  );

  // GET /api/v1/admin/permissions
  fastify.get(
    '/api/v1/admin/permissions',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('admins.read')],
      schema: {
        description: 'Lists all platform administrative permissions and module groupings',
        tags: ['Admin RBAC'],
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Array(AdminPermissionResponseSchema),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (_request, reply) => {
      const permissions = await service.listPermissions();
      return reply.status(200).send(permissions);
    },
  );

  // GET /api/v1/admin/admins
  fastify.get(
    '/api/v1/admin/admins',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('admins.read')],
      schema: {
        description: 'Lists all administrator users, active roles, and permissions',
        tags: ['Admin RBAC'],
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Array(AdminUserRoleResponseSchema),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (_request, reply) => {
      const admins = await service.listAdminUsers();
      return reply.status(200).send(admins);
    },
  );

  // POST /api/v1/admin/admins/assign
  fastify.post<{ Body: AssignAdminRoleRequest }>(
    '/api/v1/admin/admins/assign',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('admins.manage')],
      schema: {
        description: 'Assigns an administrative role to a platform user',
        tags: ['Admin RBAC'],
        security: [{ bearerAuth: [] }],
        body: AssignAdminRoleRequestSchema,
        response: {
          200: AdminUserRoleResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.assignRole(
        request.body.userId,
        request.body.roleName,
        { id: request.user.id, adminRoles: request.user.adminRoles },
        request.ip,
        request.headers['user-agent'],
      );
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/admin/admins/revoke
  fastify.post<{ Body: RevokeAdminRoleRequest }>(
    '/api/v1/admin/admins/revoke',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('admins.manage')],
      schema: {
        description:
          'Revokes an administrative role from a user, enforcing the last active super admin lockout guard',
        tags: ['Admin RBAC'],
        security: [{ bearerAuth: [] }],
        body: RevokeAdminRoleRequestSchema,
        response: {
          200: AdminUserRoleResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.revokeRole(
        request.body.userId,
        request.body.roleName,
        { id: request.user.id, adminRoles: request.user.adminRoles },
        request.ip,
        request.headers['user-agent'],
      );
      return reply.status(200).send(result);
    },
  );
};
