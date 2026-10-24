import type { FastifyPluginAsync } from 'fastify';
import {
  CreateDirectConversationInputSchema,
  DirectConversationResponseSchema,
  ListConversationsQuerySchema,
  ListConversationsResponseSchema,
  ListMessagesQuerySchema,
  ListMessagesResponseSchema,
  SendMessageInputSchema,
  MessageResponseSchema,
  MarkReadInputSchema,
  MarkReadResponseSchema,
  CreateBlockInputSchema,
  UserBlockResponseSchema,
  ListBlocksQuerySchema,
  ListBlocksResponseSchema,
  CreateReportInputSchema,
  ReportResponseSchema,
  EditMessageInputSchema,
  AttachmentDownloadParamsSchema,
  AttachmentDownloadResponseSchema,
  type CreateDirectConversationInput,
  type ListConversationsQuery,
  type ListMessagesQuery,
  type SendMessageInput,
  type MarkReadInput,
  type CreateBlockInput,
  type ListBlocksQuery,
  type CreateReportInput,
  type EditMessageInput,
  type AttachmentDownloadParams,
} from '@creatorconnect/contracts';
import {
  IdParamSchema,
  type IdParam,
  ProblemDetailsSchema,
  Type,
  type Static,
  UuidSchema,
} from '@creatorconnect/validation';
import { messagingService, MessagingService } from './messaging.service.js';

export const ConversationMessageParamsSchema = Type.Object({
  id: UuidSchema,
  messageId: UuidSchema,
});
export type ConversationMessageParams = Static<typeof ConversationMessageParamsSchema>;

export interface MessagingRoutesOptions {
  messagingSvc?: MessagingService;
}

export const messagingRoutes: FastifyPluginAsync<MessagingRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.messagingSvc || messagingService;

  // ==============================================================================
  // 1. POST /api/v1/conversations — Create or Retrieve Direct Conversation
  // ==============================================================================
  fastify.post<{ Body: CreateDirectConversationInput }>(
    '/api/v1/conversations',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description:
          'Creates a new direct conversation or retrieves the existing one between peers',
        tags: ['Messaging'],
        security: [{ bearerAuth: [] }],
        body: CreateDirectConversationInputSchema,
        response: {
          200: DirectConversationResponseSchema,
          201: DirectConversationResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.createOrGetDirectConversation(request.user.id, request.body);
      return reply.status(201).send(result);
    },
  );

  // ==============================================================================
  // 2. GET /api/v1/conversations — List User Conversations
  // ==============================================================================
  fastify.get<{ Querystring: ListConversationsQuery }>(
    '/api/v1/conversations',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Lists active conversations for the authenticated user',
        tags: ['Messaging'],
        security: [{ bearerAuth: [] }],
        querystring: ListConversationsQuerySchema,
        response: {
          200: ListConversationsResponseSchema,
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listUserConversations(request.user.id, request.query);
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // 3. GET /api/v1/conversations/:id — Get Direct Conversation by ID
  // ==============================================================================
  fastify.get<{ Params: IdParam }>(
    '/api/v1/conversations/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves conversation metadata for an active participant',
        tags: ['Messaging'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: DirectConversationResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.getConversationById(request.params.id, request.user.id);
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // 4. GET /api/v1/conversations/:id/messages — Keyset Paginated Message History
  // ==============================================================================
  fastify.get<{ Params: IdParam; Querystring: ListMessagesQuery }>(
    '/api/v1/conversations/:id/messages',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves conversation messages using keyset cursor pagination',
        tags: ['Messaging'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        querystring: ListMessagesQuerySchema,
        response: {
          200: ListMessagesResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listMessages(request.params.id, request.user.id, request.query);
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // 5. POST /api/v1/conversations/:id/messages — Send Message with Idempotency
  // ==============================================================================
  fastify.post<{ Params: IdParam; Body: SendMessageInput }>(
    '/api/v1/conversations/:id/messages',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'send-message',
          max: 30,
          windowSeconds: 60,
          onRedisFailure: 'bounded-fallback',
        }),
      ],
      schema: {
        description: 'Sends a message with client-provided idempotency key',
        tags: ['Messaging'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: SendMessageInputSchema,
        response: {
          201: MessageResponseSchema,
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
      // Note: Sender identity is exclusively derived from request.user.id
      const result = await service.sendMessage(request.params.id, request.user.id, request.body);
      return reply.status(201).send(result);
    },
  );

  // ==============================================================================
  // 5b. PATCH /api/v1/conversations/:id/messages/:messageId — Edit Message Content
  // ==============================================================================
  fastify.patch<{ Params: ConversationMessageParams; Body: EditMessageInput }>(
    '/api/v1/conversations/:id/messages/:messageId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description:
          'Updates message content within the 15-minute edit window for the original sender',
        tags: ['Messaging'],
        security: [{ bearerAuth: [] }],
        params: ConversationMessageParamsSchema,
        body: EditMessageInputSchema,
        response: {
          200: MessageResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.editMessage(
        request.params.id,
        request.params.messageId,
        request.user.id,
        request.body,
      );
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // 5c. DELETE /api/v1/conversations/:id/messages/:messageId — Soft-Delete Message
  // ==============================================================================
  fastify.delete<{ Params: ConversationMessageParams }>(
    '/api/v1/conversations/:id/messages/:messageId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Soft-deletes a message by the original sender or an administrator',
        tags: ['Messaging'],
        security: [{ bearerAuth: [] }],
        params: ConversationMessageParamsSchema,
        response: {
          204: {
            type: 'null',
            description: 'Successfully soft-deleted message',
          },
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = request.user.roles.includes('ADMIN');
      await service.deleteMessage(
        request.params.id,
        request.params.messageId,
        request.user.id,
        isAdmin,
      );
      return reply.status(204).send();
    },
  );

  // ==============================================================================
  // 6. POST /api/v1/conversations/:id/read — Mark Conversation as Read
  // ==============================================================================
  fastify.post<{ Params: IdParam; Body: MarkReadInput }>(
    '/api/v1/conversations/:id/read',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Updates the last read sequence pointer for the authenticated participant',
        tags: ['Messaging'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: MarkReadInputSchema,
        response: {
          200: MarkReadResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.markConversationRead(
        request.params.id,
        request.user.id,
        request.body,
      );
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // 7. POST /api/v1/blocks — Block a User
  // ==============================================================================
  fastify.post<{ Body: CreateBlockInput }>(
    '/api/v1/blocks',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Blocks a user, preventing further messaging and new conversation creation',
        tags: ['Moderation'],
        security: [{ bearerAuth: [] }],
        body: CreateBlockInputSchema,
        response: {
          201: UserBlockResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.blockUser(request.user.id, request.body);
      return reply.status(201).send(result);
    },
  );

  // ==============================================================================
  // 8. DELETE /api/v1/blocks/:id — Unblock a User
  // ==============================================================================
  fastify.delete<{ Params: IdParam }>(
    '/api/v1/blocks/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Unblocks a user by block ID or target user ID',
        tags: ['Moderation'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          204: {
            type: 'null',
            description: 'Successfully unblocked user',
          },
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      await service.unblockUser(request.user.id, request.params.id);
      return reply.status(204).send();
    },
  );

  // ==============================================================================
  // 8b. GET /api/v1/blocks — List Blocked Users
  // ==============================================================================
  fastify.get<{ Querystring: ListBlocksQuery }>(
    '/api/v1/blocks',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Lists users blocked by the authenticated user',
        tags: ['Moderation'],
        security: [{ bearerAuth: [] }],
        querystring: ListBlocksQuerySchema,
        response: {
          200: ListBlocksResponseSchema,
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listBlocks(request.user.id, request.query);
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // 8c. POST /api/v1/reports — Submit Abuse Report
  // ==============================================================================
  fastify.post<{ Body: CreateReportInput }>(
    '/api/v1/reports',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Submits an abuse report against a user, message, or assignment',
        tags: ['Moderation'],
        security: [{ bearerAuth: [] }],
        body: CreateReportInputSchema,
        response: {
          201: ReportResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.createReport(request.user.id, request.body);
      return reply.status(201).send(result);
    },
  );

  // ==============================================================================
  // 9. GET /api/v1/conversations/:conversationId/attachments/:attachmentId/download
  // ==============================================================================
  fastify.get<{ Params: AttachmentDownloadParams }>(
    '/api/v1/conversations/:conversationId/attachments/:attachmentId/download',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description:
          'Authorizes and generates a short-lived presigned download URL for a clean message attachment in a conversation',
        tags: ['Messaging'],
        security: [{ bearerAuth: [] }],
        params: AttachmentDownloadParamsSchema,
        response: {
          200: AttachmentDownloadResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.getAttachmentDownloadUrl(
        request.params.attachmentId,
        request.user.id,
        request.params.conversationId,
        {
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      );
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // 10. GET /api/v1/attachments/:id/download — Standalone Attachment Download Route
  // ==============================================================================
  fastify.get<{ Params: IdParam }>(
    '/api/v1/attachments/:id/download',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description:
          'Authorizes and generates a short-lived presigned download URL for a clean message attachment',
        tags: ['Messaging'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: AttachmentDownloadResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.getAttachmentDownloadUrl(
        request.params.id,
        request.user.id,
        undefined,
        {
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      );
      return reply.status(200).send(result);
    },
  );
};
