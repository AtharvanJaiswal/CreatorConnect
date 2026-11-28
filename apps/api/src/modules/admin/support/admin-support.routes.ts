import type { FastifyPluginAsync } from 'fastify';
import {
  StaffSupportTicketQuerySchema,
  SupportTicketResponseSchema,
  SupportTicketListResponseSchema,
  AssignSupportTicketInputSchema,
  UpdateSupportTicketStatusInputSchema,
  CreateSupportMessageInputSchema,
  CreateSupportInternalNoteInputSchema,
  SupportTicketMessageResponseSchema,
  SupportTicketMessageListResponseSchema,
  CursorPaginationQuerySchema,
  type StaffSupportTicketQuery,
  type AssignSupportTicketInput,
  type UpdateSupportTicketStatusInput,
  type CreateSupportMessageInput,
  type CreateSupportInternalNoteInput,
} from '@creatorconnect/contracts';
import { Type, type Static } from '@sinclair/typebox';
import { ProblemDetailsSchema } from '@creatorconnect/validation';
import { supportService, SupportService } from '../../support/support.service.js';

const TicketIdParamSchema = Type.Object({
  id: Type.String({ minLength: 3, maxLength: 64 }),
});
type TicketIdParam = Static<typeof TicketIdParamSchema>;

export interface AdminSupportRoutesOptions {
  supportSvc?: SupportService;
}

export const adminSupportRoutes: FastifyPluginAsync<AdminSupportRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.supportSvc || supportService;

  // ==============================================================================
  // Admin Support Ticket Management Endpoints
  // ==============================================================================

  // GET /api/v1/admin/support/tickets
  fastify.get<{ Querystring: StaffSupportTicketQuery }>(
    '/api/v1/admin/support/tickets',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('support.manage')],
      schema: {
        description:
          'Searches all support inquiries across priority, status, category, and staff assignment',
        tags: ['Admin Support'],
        security: [{ bearerAuth: [] }],
        querystring: StaffSupportTicketQuerySchema,
        response: {
          200: SupportTicketListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listStaffTickets(request.query, true);
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/admin/support/tickets/:id
  fastify.get<{ Params: TicketIdParam }>(
    '/api/v1/admin/support/tickets/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('support.manage')],
      schema: {
        description: 'Retrieves complete ticket metadata and conversation state for staff',
        tags: ['Admin Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        response: {
          200: SupportTicketResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const ticket = await service.getStaffTicket(request.params.id, true);
      return reply.status(200).send(ticket);
    },
  );

  // POST /api/v1/admin/support/tickets/:id/assign
  fastify.post<{ Params: TicketIdParam; Body: AssignSupportTicketInput }>(
    '/api/v1/admin/support/tickets/:id/assign',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('support.manage')],
      schema: {
        description: 'Assigns or reassigns a support ticket to an administrative agent',
        tags: ['Admin Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        body: AssignSupportTicketInputSchema,
        response: {
          200: SupportTicketResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const ticket = await service.assignTicket(
        request.user.id,
        request.params.id,
        request.body.assignedToId,
        true,
      );
      return reply.status(200).send(ticket);
    },
  );

  // POST /api/v1/admin/support/tickets/:id/status
  fastify.post<{ Params: TicketIdParam; Body: UpdateSupportTicketStatusInput }>(
    '/api/v1/admin/support/tickets/:id/status',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('support.manage')],
      schema: {
        description:
          'Transitions support ticket lifecycle status (OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED)',
        tags: ['Admin Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        body: UpdateSupportTicketStatusInputSchema,
        response: {
          200: SupportTicketResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const ticket = await service.updateStatus(
        request.user.id,
        request.params.id,
        request.body,
        true,
      );
      return reply.status(200).send(ticket);
    },
  );

  // POST /api/v1/admin/support/tickets/:id/reply
  fastify.post<{ Params: TicketIdParam; Body: CreateSupportMessageInput }>(
    '/api/v1/admin/support/tickets/:id/reply',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('support.reply')],
      schema: {
        description: 'Sends a customer-visible response to a support ticket',
        tags: ['Admin Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        body: CreateSupportMessageInputSchema,
        response: {
          201: SupportTicketMessageResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const message = await service.sendStaffMessage(
        request.user.id,
        request.params.id,
        request.body,
        true,
      );
      return reply.status(201).send(message);
    },
  );

  // POST /api/v1/admin/support/tickets/:id/notes
  fastify.post<{ Params: TicketIdParam; Body: CreateSupportInternalNoteInput }>(
    '/api/v1/admin/support/tickets/:id/notes',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('support.notes')],
      schema: {
        description: 'Appends a staff-only internal discussion note never visible to customers',
        tags: ['Admin Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        body: CreateSupportInternalNoteInputSchema,
        response: {
          201: SupportTicketMessageResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const note = await service.createInternalNote(
        request.user.id,
        request.params.id,
        request.body,
        true,
      );
      return reply.status(201).send(note);
    },
  );

  // GET /api/v1/admin/support/tickets/:id/messages
  fastify.get<{ Params: TicketIdParam; Querystring: Static<typeof CursorPaginationQuerySchema> }>(
    '/api/v1/admin/support/tickets/:id/messages',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('support.manage')],
      schema: {
        description: 'Retrieves all conversation messages and staff internal notes for a ticket',
        tags: ['Admin Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        querystring: CursorPaginationQuerySchema,
        response: {
          200: SupportTicketMessageListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listMessages(
        request.user.id,
        request.params.id,
        true,
        request.query.cursor,
        request.query.limit,
      );
      return reply.status(200).send(result);
    },
  );
};
