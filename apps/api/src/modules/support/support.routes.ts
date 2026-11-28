import type { FastifyPluginAsync } from 'fastify';
import {
  CreateSupportTicketInputSchema,
  SupportTicketResponseSchema,
  SupportTicketListResponseSchema,
  CreateSupportMessageInputSchema,
  CreateSupportInternalNoteInputSchema,
  SupportTicketMessageResponseSchema,
  SupportTicketMessageListResponseSchema,
  UpdateSupportTicketStatusInputSchema,
  AssignSupportTicketInputSchema,
  CustomerSupportTicketQuerySchema,
  StaffSupportTicketQuerySchema,
  type CreateSupportTicketInput,
  type CreateSupportMessageInput,
  type CreateSupportInternalNoteInput,
  type UpdateSupportTicketStatusInput,
  type AssignSupportTicketInput,
  type CustomerSupportTicketQuery,
  type StaffSupportTicketQuery,
} from '@creatorconnect/contracts';
import { ProblemDetailsSchema } from '@creatorconnect/validation';
import { Type, type Static } from '@sinclair/typebox';
import { hasAnyAdminPermission } from '@creatorconnect/auth';
import { supportService, SupportService } from './support.service.js';

const TicketIdParamSchema = Type.Object({
  id: Type.String({ minLength: 3, maxLength: 64 }),
});
type TicketIdParam = Static<typeof TicketIdParamSchema>;

export interface SupportRoutesOptions {
  service?: SupportService;
}

export const supportRoutes: FastifyPluginAsync<SupportRoutesOptions> = async (fastify, options) => {
  const service = options.service || supportService;

  // ==============================================================================
  // Customer Routes
  // ==============================================================================

  // POST /api/v1/support/tickets - Create Ticket & Initial Message
  fastify.post<{ Body: CreateSupportTicketInput }>(
    '/api/v1/support/tickets',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'support-ticket-create',
          max: 10,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description: 'Creates a new support inquiry ticket and initial conversation message',
        tags: ['Support'],
        security: [{ bearerAuth: [] }],
        body: CreateSupportTicketInputSchema,
        response: {
          201: SupportTicketResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          500: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const ticket = await service.createTicket(request.user.id, request.body);
      return reply.status(201).send(ticket);
    },
  );

  // GET /api/v1/support/tickets - List Authenticated Customer's Own Tickets
  fastify.get<{ Querystring: CustomerSupportTicketQuery }>(
    '/api/v1/support/tickets',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Lists all support tickets created by the authenticated customer',
        tags: ['Support'],
        security: [{ bearerAuth: [] }],
        querystring: CustomerSupportTicketQuerySchema,
        response: {
          200: SupportTicketListResponseSchema,
          401: ProblemDetailsSchema,
          500: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listCustomerTickets(request.user.id, request.query);
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/support/tickets/:id - Get Authorized Customer Ticket
  fastify.get<{ Params: TicketIdParam }>(
    '/api/v1/support/tickets/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves an authorized customer support ticket by ID or ticket reference',
        tags: ['Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        response: {
          200: SupportTicketResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          500: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const ticket = await service.getCustomerTicket(request.user.id, request.params.id);
      return reply.status(200).send(ticket);
    },
  );

  // GET /api/v1/support/tickets/:id/messages - Retrieve Conversation History
  fastify.get<{ Params: TicketIdParam; Querystring: { cursor?: string; limit?: number } }>(
    '/api/v1/support/tickets/:id/messages',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description:
          'Retrieves conversation history for a support ticket with internal note isolation',
        tags: ['Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        response: {
          200: SupportTicketMessageListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          500: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isStaff = hasAnyAdminPermission(request.user, [
        'support.manage',
        'support.reply',
        'support.notes',
      ]);
      const messages = await service.listMessages(
        request.user.id,
        request.params.id,
        isStaff,
        request.query.cursor,
        request.query.limit,
      );
      return reply.status(200).send(messages);
    },
  );

  // POST /api/v1/support/tickets/:id/messages - Customer Submits Message
  fastify.post<{ Params: TicketIdParam; Body: CreateSupportMessageInput }>(
    '/api/v1/support/tickets/:id/messages',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'support-message-send',
          max: 30,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description: 'Submits a new message to a support ticket from the customer',
        tags: ['Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        body: CreateSupportMessageInputSchema,
        response: {
          201: SupportTicketMessageResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          500: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const message = await service.sendCustomerMessage(
        request.user.id,
        request.params.id,
        request.body,
      );
      return reply.status(201).send(message);
    },
  );

  // POST /api/v1/support/tickets/:id/resolve - Customer Confirms Ticket Resolution
  fastify.post<{ Params: TicketIdParam }>(
    '/api/v1/support/tickets/:id/resolve',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Marks a support ticket as resolved by the customer or staff',
        tags: ['Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        response: {
          200: SupportTicketResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          500: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isStaff = hasAnyAdminPermission(request.user, ['support.manage']);
      const ticket = await service.resolveTicket(request.user.id, request.params.id, isStaff);
      return reply.status(200).send(ticket);
    },
  );

  // POST /api/v1/support/tickets/:id/reopen - Customer Reopens Resolved Ticket
  fastify.post<{ Params: TicketIdParam }>(
    '/api/v1/support/tickets/:id/reopen',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Reopens a previously resolved support ticket',
        tags: ['Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        response: {
          200: SupportTicketResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          500: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isStaff = hasAnyAdminPermission(request.user, ['support.manage']);
      const ticket = await service.reopenTicket(request.user.id, request.params.id, isStaff);
      return reply.status(200).send(ticket);
    },
  );

  // ==============================================================================
  // Staff Routes (Granular support.* Administrative Permissions)
  // ==============================================================================

  // GET /api/v1/staff/support/tickets - Staff Queue
  fastify.get<{ Querystring: StaffSupportTicketQuery }>(
    '/api/v1/staff/support/tickets',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('support.manage')],
      schema: {
        description: 'Staff queue for managing and filtering all platform support inquiries',
        tags: ['Staff Support'],
        security: [{ bearerAuth: [] }],
        querystring: StaffSupportTicketQuerySchema,
        response: {
          200: SupportTicketListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          500: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listStaffTickets(request.query, true);
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/staff/support/tickets/:id - Staff Detailed Ticket View
  fastify.get<{ Params: TicketIdParam }>(
    '/api/v1/staff/support/tickets/:id',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('support.manage')],
      schema: {
        description: 'Staff-authorized view of a ticket including internal context',
        tags: ['Staff Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        response: {
          200: SupportTicketResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          500: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const ticket = await service.getStaffTicket(request.params.id, true);
      return reply.status(200).send(ticket);
    },
  );

  // POST /api/v1/staff/support/tickets/:id/assign - Assign Ticket
  fastify.post<{ Params: TicketIdParam; Body: AssignSupportTicketInput }>(
    '/api/v1/staff/support/tickets/:id/assign',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('support.manage')],
      schema: {
        description: 'Assigns or reassigns a support ticket to a designated staff member',
        tags: ['Staff Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        body: AssignSupportTicketInputSchema,
        response: {
          200: SupportTicketResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          500: ProblemDetailsSchema,
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

  // POST /api/v1/staff/support/tickets/:id/messages - Staff Sends Response to Customer
  fastify.post<{ Params: TicketIdParam; Body: CreateSupportMessageInput }>(
    '/api/v1/staff/support/tickets/:id/messages',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('support.reply')],
      schema: {
        description: 'Sends an official staff response message to the customer',
        tags: ['Staff Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        body: CreateSupportMessageInputSchema,
        response: {
          201: SupportTicketMessageResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          500: ProblemDetailsSchema,
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

  // POST /api/v1/staff/support/tickets/:id/notes - Staff Adds Internal Note
  fastify.post<{ Params: TicketIdParam; Body: CreateSupportInternalNoteInput }>(
    '/api/v1/staff/support/tickets/:id/notes',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('support.notes')],
      schema: {
        description: 'Creates a private internal note visible exclusively to staff',
        tags: ['Staff Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        body: CreateSupportInternalNoteInputSchema,
        response: {
          201: SupportTicketMessageResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          500: ProblemDetailsSchema,
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

  // POST /api/v1/staff/support/tickets/:id/status - Staff Updates Ticket Status
  fastify.post<{ Params: TicketIdParam; Body: UpdateSupportTicketStatusInput }>(
    '/api/v1/staff/support/tickets/:id/status',
    {
      preHandler: [fastify.authenticate, fastify.requireAdminPermission('support.manage')],
      schema: {
        description: 'Updates ticket status with state machine transition validation',
        tags: ['Staff Support'],
        security: [{ bearerAuth: [] }],
        params: TicketIdParamSchema,
        body: UpdateSupportTicketStatusInputSchema,
        response: {
          200: SupportTicketResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
          500: ProblemDetailsSchema,
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
};
