import type { FastifyPluginAsync } from 'fastify';
import { Type } from '@sinclair/typebox';
import { UuidSchema, ProblemDetailsSchema } from '@creatorconnect/validation';
import {
  SaveCreatorInputSchema,
  SavedCreatorListResponseSchema,
  CheckSavedStatusResponseSchema,
  CreateShortlistInputSchema,
  UpdateShortlistInputSchema,
  AddShortlistMemberInputSchema,
  ShortlistResponseSchema,
  ShortlistListResponseSchema,
  CreateInvitationInputSchema,
  InvitationResponseSchema,
  InvitationListResponseSchema,
  type SaveCreatorInput,
  type CreateShortlistInput,
  type UpdateShortlistInput,
  type AddShortlistMemberInput,
  type CreateInvitationInput,
} from '@creatorconnect/contracts';
import { collaborationService, CollaborationService } from './collaboration.service.js';

export interface CollaborationRoutesOptions {
  collaborationSvc?: CollaborationService;
}

const IdParamsSchema = Type.Object({
  id: UuidSchema,
});
type IdParams = { id: string };

const CreatorIdParamsSchema = Type.Object({
  creatorId: UuidSchema,
});
type CreatorIdParams = { creatorId: string };

const ShortlistMemberParamsSchema = Type.Object({
  id: UuidSchema,
  creatorId: UuidSchema,
});
type ShortlistMemberParams = { id: string; creatorId: string };

const PaginationQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
type PaginationQuery = { cursor?: string; limit?: number };

const InvitationListQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  status: Type.Optional(
    Type.Union([
      Type.Literal('PENDING'),
      Type.Literal('ACCEPTED'),
      Type.Literal('DECLINED'),
      Type.Literal('WITHDRAWN'),
      Type.Literal('EXPIRED'),
    ]),
  ),
});
type InvitationListQuery = { cursor?: string; limit?: number; status?: any };

export const collaborationRoutes: FastifyPluginAsync<CollaborationRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.collaborationSvc || collaborationService;

  // ==============================================================================
  // Saved Creators
  // ==============================================================================

  // POST /api/v1/saved-creators (Save a creator)
  fastify.post<{ Body: SaveCreatorInput }>(
    '/api/v1/saved-creators',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Saves a creator profile for the authenticated client',
        tags: ['Saved Creators'],
        security: [{ bearerAuth: [] }],
        body: SaveCreatorInputSchema,
        response: {
          201: Type.Object({
            id: UuidSchema,
            clientId: UuidSchema,
            creatorId: UuidSchema,
            createdAt: Type.String(),
          }),
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const saved = await service.saveCreator(request.user.id, request.body.creatorId);
      return reply.code(201).send(saved);
    },
  );

  // DELETE /api/v1/saved-creators/:creatorId (Unsave a creator)
  fastify.delete<{ Params: CreatorIdParams }>(
    '/api/v1/saved-creators/:creatorId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Removes a saved creator profile for the authenticated client',
        tags: ['Saved Creators'],
        security: [{ bearerAuth: [] }],
        params: CreatorIdParamsSchema,
        response: {
          200: Type.Object({ success: Type.Boolean() }),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.unsaveCreator(request.user.id, request.params.creatorId);
      return reply.code(200).send(result);
    },
  );

  // GET /api/v1/saved-creators/check/:creatorId (Check saved status)
  fastify.get<{ Params: CreatorIdParams }>(
    '/api/v1/saved-creators/check/:creatorId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Checks whether a creator is saved by the authenticated client',
        tags: ['Saved Creators'],
        security: [{ bearerAuth: [] }],
        params: CreatorIdParamsSchema,
        response: {
          200: CheckSavedStatusResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const status = await service.checkSavedStatus(request.user.id, request.params.creatorId);
      return reply.code(200).send(status);
    },
  );

  // GET /api/v1/saved-creators (List saved creators)
  fastify.get<{ Querystring: PaginationQuery }>(
    '/api/v1/saved-creators',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Lists saved creators for the authenticated client',
        tags: ['Saved Creators'],
        security: [{ bearerAuth: [] }],
        querystring: PaginationQuerySchema,
        response: {
          200: SavedCreatorListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const list = await service.listSavedCreators(request.user.id, request.query);
      return reply.code(200).send(list);
    },
  );

  // ==============================================================================
  // Shortlists
  // ==============================================================================

  // POST /api/v1/shortlists (Create a shortlist)
  fastify.post<{ Body: CreateShortlistInput }>(
    '/api/v1/shortlists',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Creates a new shortlist owned by the authenticated client',
        tags: ['Shortlists'],
        security: [{ bearerAuth: [] }],
        body: CreateShortlistInputSchema,
        response: {
          201: ShortlistResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const shortlist = await service.createShortlist(request.user.id, request.body);
      return reply.code(201).send(shortlist);
    },
  );

  // GET /api/v1/shortlists (List owner shortlists)
  fastify.get(
    '/api/v1/shortlists',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Lists all shortlists owned by the authenticated client',
        tags: ['Shortlists'],
        security: [{ bearerAuth: [] }],
        response: {
          200: ShortlistListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const list = await service.listShortlists(request.user.id);
      return reply.code(200).send(list);
    },
  );

  // GET /api/v1/shortlists/:id (Get single shortlist with members)
  fastify.get<{ Params: IdParams }>(
    '/api/v1/shortlists/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves a single shortlist with members',
        tags: ['Shortlists'],
        security: [{ bearerAuth: [] }],
        params: IdParamsSchema,
        response: {
          200: ShortlistResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const shortlist = await service.getShortlist(request.user.id, request.params.id);
      return reply.code(200).send(shortlist);
    },
  );

  // PATCH /api/v1/shortlists/:id (Update shortlist)
  fastify.patch<{ Params: IdParams; Body: UpdateShortlistInput }>(
    '/api/v1/shortlists/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Updates a shortlist owned by the authenticated client',
        tags: ['Shortlists'],
        security: [{ bearerAuth: [] }],
        params: IdParamsSchema,
        body: UpdateShortlistInputSchema,
        response: {
          200: ShortlistResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const updated = await service.updateShortlist(
        request.user.id,
        request.params.id,
        request.body,
      );
      return reply.code(200).send(updated);
    },
  );

  // DELETE /api/v1/shortlists/:id (Delete shortlist)
  fastify.delete<{ Params: IdParams }>(
    '/api/v1/shortlists/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Deletes a shortlist owned by the authenticated client',
        tags: ['Shortlists'],
        security: [{ bearerAuth: [] }],
        params: IdParamsSchema,
        response: {
          200: Type.Object({ success: Type.Boolean() }),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.deleteShortlist(request.user.id, request.params.id);
      return reply.code(200).send(result);
    },
  );

  // POST /api/v1/shortlists/:id/members (Add creator to shortlist)
  fastify.post<{ Params: IdParams; Body: AddShortlistMemberInput }>(
    '/api/v1/shortlists/:id/members',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Adds a creator to an owned shortlist',
        tags: ['Shortlists'],
        security: [{ bearerAuth: [] }],
        params: IdParamsSchema,
        body: AddShortlistMemberInputSchema,
        response: {
          201: Type.Object({
            id: UuidSchema,
            shortlistId: UuidSchema,
            creatorId: UuidSchema,
            note: Type.Union([Type.String(), Type.Null()]),
            createdAt: Type.String(),
          }),
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const member = await service.addShortlistMember(
        request.user.id,
        request.params.id,
        request.body,
      );
      return reply.code(201).send(member);
    },
  );

  // DELETE /api/v1/shortlists/:id/members/:creatorId (Remove creator from shortlist)
  fastify.delete<{ Params: ShortlistMemberParams }>(
    '/api/v1/shortlists/:id/members/:creatorId',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Removes a creator from an owned shortlist',
        tags: ['Shortlists'],
        security: [{ bearerAuth: [] }],
        params: ShortlistMemberParamsSchema,
        response: {
          200: Type.Object({ success: Type.Boolean() }),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.removeShortlistMember(
        request.user.id,
        request.params.id,
        request.params.creatorId,
      );
      return reply.code(200).send(result);
    },
  );

  // ==============================================================================
  // Hiring Invitations
  // ==============================================================================

  // POST /api/v1/invitations (Create an invitation)
  fastify.post<{ Body: CreateInvitationInput }>(
    '/api/v1/invitations',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Sends a project hiring invitation to an eligible creator',
        tags: ['Invitations'],
        security: [{ bearerAuth: [] }],
        body: CreateInvitationInputSchema,
        response: {
          201: InvitationResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const invitation = await service.createInvitation(request.user.id, request.body);
      return reply.code(201).send(invitation);
    },
  );

  // GET /api/v1/invitations/sent (List sent invitations)
  fastify.get<{ Querystring: InvitationListQuery }>(
    '/api/v1/invitations/sent',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Lists invitations sent by the authenticated client',
        tags: ['Invitations'],
        security: [{ bearerAuth: [] }],
        querystring: InvitationListQuerySchema,
        response: {
          200: InvitationListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const list = await service.listSentInvitations(request.user.id, request.query);
      return reply.code(200).send(list);
    },
  );

  // GET /api/v1/invitations/received (List received invitations)
  fastify.get<{ Querystring: InvitationListQuery }>(
    '/api/v1/invitations/received',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Lists invitations received by the authenticated creator',
        tags: ['Invitations'],
        security: [{ bearerAuth: [] }],
        querystring: InvitationListQuerySchema,
        response: {
          200: InvitationListResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const list = await service.listReceivedInvitations(request.user.id, request.query);
      return reply.code(200).send(list);
    },
  );

  // GET /api/v1/invitations/:id (Get single invitation)
  fastify.get<{ Params: IdParams }>(
    '/api/v1/invitations/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves an invitation by ID for authorized participants',
        tags: ['Invitations'],
        security: [{ bearerAuth: [] }],
        params: IdParamsSchema,
        response: {
          200: InvitationResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const invitation = await service.getInvitation(request.user.id, request.params.id);
      return reply.code(200).send(invitation);
    },
  );

  // POST /api/v1/invitations/:id/accept (Accept invitation)
  fastify.post<{ Params: IdParams }>(
    '/api/v1/invitations/:id/accept',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Accepts a project invitation (invitee creator only)',
        tags: ['Invitations'],
        security: [{ bearerAuth: [] }],
        params: IdParamsSchema,
        response: {
          200: Type.Object({ success: Type.Boolean() }),
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.acceptInvitation(request.user.id, request.params.id);
      return reply.code(200).send(result);
    },
  );

  // POST /api/v1/invitations/:id/decline (Decline invitation)
  fastify.post<{ Params: IdParams }>(
    '/api/v1/invitations/:id/decline',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Declines a project invitation (invitee creator only)',
        tags: ['Invitations'],
        security: [{ bearerAuth: [] }],
        params: IdParamsSchema,
        response: {
          200: Type.Object({ success: Type.Boolean() }),
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.declineInvitation(request.user.id, request.params.id);
      return reply.code(200).send(result);
    },
  );

  // POST /api/v1/invitations/:id/withdraw (Withdraw invitation)
  fastify.post<{ Params: IdParams }>(
    '/api/v1/invitations/:id/withdraw',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Withdraws a pending project invitation (inviter client only)',
        tags: ['Invitations'],
        security: [{ bearerAuth: [] }],
        params: IdParamsSchema,
        response: {
          200: Type.Object({ success: Type.Boolean() }),
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.withdrawInvitation(request.user.id, request.params.id);
      return reply.code(200).send(result);
    },
  );
};
