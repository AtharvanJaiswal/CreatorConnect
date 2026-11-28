import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { Type } from '@sinclair/typebox';
import { UuidSchema, ProblemDetailsSchema } from '@creatorconnect/validation';
import {
  CreateCommunityPostInputSchema,
  CommunityPostItemSchema,
  CommunityPostListResponseSchema,
  CreateCommunityCommentInputSchema,
  CommunityCommentItemSchema,
  CommunityCommentListResponseSchema,
  CreateCommunityEventInputSchema,
  CommunityEventItemSchema,
  CommunityEventListResponseSchema,
  RsvpEventInputSchema,
  EventRsvpResponseSchema,
  FollowHubInputSchema,
  HubFollowResponseSchema,
  UserFollowedHubsResponseSchema,
  ModerateCommunityPostInputSchema,
  type CreateCommunityPostInput,
  type CreateCommunityCommentInput,
  type CreateCommunityEventInput,
  type RsvpEventInput,
  type FollowHubInput,
  type ModerateCommunityPostInput,
  type AdminPermission,
} from '@creatorconnect/contracts';
import { hasAnyAdminPermission } from '@creatorconnect/auth';
import { communityService, CommunityService } from './community.service.js';

const COMMUNITY_READ_MODERATION_PERMISSIONS: readonly AdminPermission[] = [
  'reports.review',
  'reports.resolve',
  'reviews.moderate',
  'projects.moderate',
];

const COMMUNITY_MODERATE_PERMISSIONS: readonly AdminPermission[] = [
  'reports.resolve',
  'reviews.moderate',
  'projects.moderate',
];

export interface CommunityRoutesOptions {
  communitySvc?: CommunityService;
}

const IdParamsSchema = Type.Object({
  id: UuidSchema,
});
type IdParams = { id: string };

const PostQuerySchema = Type.Object({
  city: Type.Optional(Type.String()),
  type: Type.Optional(
    Type.Union([
      Type.Literal('ANNOUNCEMENT'),
      Type.Literal('OPPORTUNITY'),
      Type.Literal('DISCUSSION'),
      Type.Literal('EVENT'),
      Type.Literal('QUESTION'),
    ]),
  ),
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
type PostQuery = {
  city?: string;
  type?: any;
  cursor?: string;
  limit?: number;
};

const EventQuerySchema = Type.Object({
  city: Type.Optional(Type.String()),
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
type EventQuery = {
  city?: string;
  cursor?: string;
  limit?: number;
};

const CommentQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
});
type CommentQuery = {
  cursor?: string;
  limit?: number;
};

export const communityRoutes: FastifyPluginAsync<CommunityRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.communitySvc || communityService;

  const optionalAuthenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        await fastify.authenticate(request, reply);
      } catch {
        // Ignored for public routes
      }
    }
  };

  // ==============================================================================
  // Posts
  // ==============================================================================

  // GET /api/v1/community/posts
  fastify.get<{ Querystring: PostQuery }>(
    '/api/v1/community/posts',
    {
      preHandler: [optionalAuthenticate],
      schema: {
        description: 'Lists community feed posts with optional city, type, and cursor filters',
        tags: ['Community'],
        querystring: PostQuerySchema,
        response: {
          200: CommunityPostListResponseSchema,
          400: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const currentUserId = request.user?.id;
      const result = await service.listPosts({
        ...request.query,
        currentUserId,
      });
      return reply.code(200).send(result);
    },
  );

  // POST /api/v1/community/posts
  fastify.post<{ Body: CreateCommunityPostInput }>(
    '/api/v1/community/posts',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'community-create-post',
          max: 20,
          windowSeconds: 60,
        }),
      ],
      schema: {
        description: 'Creates a new post in the city community feed',
        tags: ['Community'],
        security: [{ bearerAuth: [] }],
        body: CreateCommunityPostInputSchema,
        response: {
          201: CommunityPostItemSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const authorId = request.user.id;
      const created = await service.createPost(authorId, request.body);
      return reply.code(201).send(created);
    },
  );

  // GET /api/v1/community/posts/:id
  fastify.get<{ Params: IdParams }>(
    '/api/v1/community/posts/:id',
    {
      preHandler: [optionalAuthenticate],
      schema: {
        description: 'Retrieves a single community post by ID',
        tags: ['Community'],
        params: IdParamsSchema,
        response: {
          200: CommunityPostItemSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const currentUserId = request.user?.id;
      const isModerator = request.user
        ? hasAnyAdminPermission(request.user, COMMUNITY_READ_MODERATION_PERMISSIONS)
        : false;
      const post = await service.getPostById(request.params.id, currentUserId, [], isModerator);
      return reply.code(200).send(post);
    },
  );

  // POST /api/v1/community/posts/:id/applaud
  fastify.post<{ Params: IdParams }>(
    '/api/v1/community/posts/:id/applaud',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Applauds or un-applauds a community post idempotently',
        tags: ['Community'],
        security: [{ bearerAuth: [] }],
        params: IdParamsSchema,
        response: {
          200: Type.Object({
            postId: UuidSchema,
            applauded: Type.Boolean(),
            applaudsCount: Type.Integer(),
          }),
          401: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.applaudPost(request.params.id, request.user.id);
      return reply.code(200).send(result);
    },
  );

  // ==============================================================================
  // Comments / Threaded Replies
  // ==============================================================================

  // GET /api/v1/community/posts/:id/comments
  fastify.get<{ Params: IdParams; Querystring: CommentQuery }>(
    '/api/v1/community/posts/:id/comments',
    {
      preHandler: [optionalAuthenticate],
      schema: {
        description: 'Lists threaded replies for a community post',
        tags: ['Community'],
        params: IdParamsSchema,
        querystring: CommentQuerySchema,
        response: {
          200: CommunityCommentListResponseSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.listComments(request.params.id, request.query);
      return reply.code(200).send(result);
    },
  );

  // POST /api/v1/community/posts/:id/comments
  fastify.post<{ Params: IdParams; Body: CreateCommunityCommentInput }>(
    '/api/v1/community/posts/:id/comments',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'community-create-comment',
          max: 40,
          windowSeconds: 60,
        }),
      ],
      schema: {
        description: 'Posts a comment or reply to an existing community post',
        tags: ['Community'],
        security: [{ bearerAuth: [] }],
        params: IdParamsSchema,
        body: CreateCommunityCommentInputSchema,
        response: {
          201: CommunityCommentItemSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const comment = await service.createComment(
        request.params.id,
        request.user.id,
        request.body.content,
      );
      return reply.code(201).send(comment);
    },
  );

  // ==============================================================================
  // Events & RSVPs
  // ==============================================================================

  // GET /api/v1/community/events
  fastify.get<{ Querystring: EventQuery }>(
    '/api/v1/community/events',
    {
      preHandler: [optionalAuthenticate],
      schema: {
        description: 'Lists upcoming community events in a city',
        tags: ['Community'],
        querystring: EventQuerySchema,
        response: {
          200: CommunityEventListResponseSchema,
          400: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const currentUserId = request.user?.id;
      const result = await service.listEvents({
        ...request.query,
        currentUserId,
      });
      return reply.code(200).send(result);
    },
  );

  // POST /api/v1/community/events
  fastify.post<{ Body: CreateCommunityEventInput }>(
    '/api/v1/community/events',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'community-create-event',
          max: 10,
          windowSeconds: 60,
        }),
      ],
      schema: {
        description: 'Creates a new community event or meetup',
        tags: ['Community'],
        security: [{ bearerAuth: [] }],
        body: CreateCommunityEventInputSchema,
        response: {
          201: CommunityEventItemSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const event = await service.createEvent(request.user.id, request.body);
      return reply.code(201).send(event);
    },
  );

  // GET /api/v1/community/events/:id
  fastify.get<{ Params: IdParams }>(
    '/api/v1/community/events/:id',
    {
      preHandler: [optionalAuthenticate],
      schema: {
        description: 'Retrieves details for a single community event',
        tags: ['Community'],
        params: IdParamsSchema,
        response: {
          200: CommunityEventItemSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const currentUserId = request.user?.id;
      const event = await service.getEventById(request.params.id, currentUserId);
      return reply.code(200).send(event);
    },
  );

  // POST /api/v1/community/events/:id/rsvp
  fastify.post<{ Params: IdParams; Body: RsvpEventInput }>(
    '/api/v1/community/events/:id/rsvp',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Confirms or cancels an RSVP for a community event idempotently',
        tags: ['Community'],
        security: [{ bearerAuth: [] }],
        params: IdParamsSchema,
        body: RsvpEventInputSchema,
        response: {
          200: EventRsvpResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const status = request.body?.status ?? 'CONFIRMED';
      const result = await service.rsvpEvent(request.params.id, request.user.id, status);
      return reply.code(200).send(result);
    },
  );

  // ==============================================================================
  // Hub Following
  // ==============================================================================

  // GET /api/v1/community/hubs/following
  fastify.get(
    '/api/v1/community/hubs/following',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves all regional creative hubs followed by the authenticated user',
        tags: ['Community'],
        security: [{ bearerAuth: [] }],
        response: {
          200: UserFollowedHubsResponseSchema,
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.getUserFollowedHubs(request.user.id);
      return reply.code(200).send(result);
    },
  );

  // POST /api/v1/community/hubs/follow
  fastify.post<{ Body: FollowHubInput }>(
    '/api/v1/community/hubs/follow',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Follows a regional creative hub',
        tags: ['Community'],
        security: [{ bearerAuth: [] }],
        body: FollowHubInputSchema,
        response: {
          200: HubFollowResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.followHub(request.user.id, request.body.city);
      return reply.code(200).send(result);
    },
  );

  // POST /api/v1/community/hubs/unfollow
  fastify.post<{ Body: FollowHubInput }>(
    '/api/v1/community/hubs/unfollow',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Unfollows a regional creative hub',
        tags: ['Community'],
        security: [{ bearerAuth: [] }],
        body: FollowHubInputSchema,
        response: {
          200: HubFollowResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.unfollowHub(request.user.id, request.body.city);
      return reply.code(200).send(result);
    },
  );

  // ==============================================================================
  // Moderation
  // ==============================================================================

  // PATCH /api/v1/admin/community/posts/:id/moderate
  fastify.patch<{ Params: IdParams; Body: ModerateCommunityPostInput }>(
    '/api/v1/admin/community/posts/:id/moderate',
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireAdminPermission(COMMUNITY_MODERATE_PERMISSIONS),
      ],
      schema: {
        description: 'Moderates a community post (HIDE, UNHIDE, DELETE) with audit reason',
        tags: ['Admin', 'Community'],
        security: [{ bearerAuth: [] }],
        params: IdParamsSchema,
        body: ModerateCommunityPostInputSchema,
        response: {
          200: Type.Object({
            id: UuidSchema,
            status: Type.String(),
            action: Type.String(),
            moderatedAt: Type.String(),
          }),
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAuthorizedModerator = hasAnyAdminPermission(
        request.user,
        COMMUNITY_MODERATE_PERMISSIONS,
      );
      const result = await service.moderatePost(
        request.params.id,
        request.user.id,
        [],
        request.body,
        isAuthorizedModerator,
      );
      return reply.code(200).send(result);
    },
  );
};
