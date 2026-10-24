import type { FastifyPluginAsync } from 'fastify';
import {
  CreateMessageRequestInputSchema,
  DeclineMessageRequestInputSchema,
  MessageRequestResponseSchema,
  AcceptMessageRequestResponseSchema,
  ListMessageRequestsQuerySchema,
  ListMessageRequestsResponseSchema,
  type CreateMessageRequestInput,
  type DeclineMessageRequestInput,
  type ListMessageRequestsQuery,
} from '@creatorconnect/contracts';
import { IdParamSchema, type IdParam, ProblemDetailsSchema } from '@creatorconnect/validation';
import { messagingService, MessagingService } from './messaging.service.js';

export interface MessageRequestRoutesOptions {
  messagingSvc?: MessagingService;
}

export const messageRequestRoutes: FastifyPluginAsync<MessageRequestRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.messagingSvc || messagingService;

  // ==============================================================================
  // 1. POST /api/v1/chat/requests — Submit a new message request
  // ==============================================================================
  fastify.post<{ Body: CreateMessageRequestInput }>(
    '/api/v1/chat/requests',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'chat_request_create',
          max: 10,
          windowSeconds: 3600,
        }),
      ],
      schema: {
        description:
          'Submits an introductory message request (maximum 500 plain text characters) to a peer without creating an unconsented conversation',
        tags: ['Message Requests'],
        security: [{ bearerAuth: [] }],
        body: CreateMessageRequestInputSchema,
        response: {
          201: MessageRequestResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
          429: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.createMessageRequest(request.user.id, request.body);
      return reply.status(201).send(result);
    },
  );

  // ==============================================================================
  // 2. GET /api/v1/chat/requests — List incoming or outgoing message requests
  // ==============================================================================
  fastify.get<{ Querystring: ListMessageRequestsQuery }>(
    '/api/v1/chat/requests',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Lists incoming or outgoing message requests with keyset cursor pagination',
        tags: ['Message Requests'],
        security: [{ bearerAuth: [] }],
        querystring: ListMessageRequestsQuerySchema,
        response: {
          200: ListMessageRequestsResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listMessageRequests(request.user.id, request.query);
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // 3. GET /api/v1/chat/requests/:id — Retrieve request details (participant-only)
  // ==============================================================================
  fastify.get<{ Params: IdParam }>(
    '/api/v1/chat/requests/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description:
          'Retrieves details for a specific message request with anti-enumeration protection',
        tags: ['Message Requests'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: MessageRequestResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.getMessageRequestById(request.params.id, request.user.id);
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // 4. POST /api/v1/chat/requests/:id/accept — Accept incoming message request
  // ==============================================================================
  fastify.post<{ Params: IdParam }>(
    '/api/v1/chat/requests/:id/accept',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description:
          'Atomically accepts an incoming message request, creating a direct conversation and sequence 1 introductory message',
        tags: ['Message Requests'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: AcceptMessageRequestResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.acceptMessageRequest(request.params.id, request.user.id);
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // 5. POST /api/v1/chat/requests/:id/decline — Decline incoming message request
  // ==============================================================================
  fastify.post<{ Params: IdParam; Body: DeclineMessageRequestInput }>(
    '/api/v1/chat/requests/:id/decline',
    {
      preValidation: async (request) => {
        if (!request.body) {
          (request as any).body = {};
        }
      },
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Declines an incoming message request, initiating a 30-day decline cooldown',
        tags: ['Message Requests'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: DeclineMessageRequestInputSchema,
        response: {
          200: MessageRequestResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.declineMessageRequest(
        request.params.id,
        request.user.id,
        request.body,
      );
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // 6. POST /api/v1/chat/requests/:id/cancel — Cancel outgoing message request
  // ==============================================================================
  fastify.post<{ Params: IdParam }>(
    '/api/v1/chat/requests/:id/cancel',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description:
          'Cancels an outgoing pending message request, initiating a 24-hour anti-churn cooldown',
        tags: ['Message Requests'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: MessageRequestResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.cancelMessageRequest(request.params.id, request.user.id);
      return reply.status(200).send(result);
    },
  );
};
