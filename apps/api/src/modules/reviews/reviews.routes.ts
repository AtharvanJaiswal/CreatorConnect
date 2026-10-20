import type { FastifyPluginAsync } from 'fastify';
import {
  ReviewResponseSchema,
  CreateReviewBodySchema,
  UpdateReviewBodySchema,
  ReportReviewBodySchema,
  ReviewReportResponseSchema,
  ModerateReviewBodySchema,
  ReputationSummaryResponseSchema,
  PublicReviewsQuerySchema,
  ModerationQueueQuerySchema,
  ProjectReviewParamsSchema,
  ReviewIdParamsSchema,
  UserReviewParamsSchema,
  PendingReviewsResponseSchema,
  type CreateReviewBody,
  type UpdateReviewBody,
  type ReportReviewBody,
  type ModerateReviewBody,
  type PublicReviewsQuery,
  type ModerationQueueQuery,
  type ProjectReviewParams,
  type ReviewIdParams,
  type UserReviewParams,
} from '@creatorconnect/contracts';
import { Type } from '@sinclair/typebox';
import { ProblemDetailsSchema } from '@creatorconnect/validation';
import { ReviewsService } from './reviews.service.js';
import { ForbiddenError } from '../../errors/app-error.js';

export const reviewsService = new ReviewsService();

export interface ReviewsRoutesOptions {
  reviewsSvc?: ReviewsService;
}

export const reviewsRoutes: FastifyPluginAsync<ReviewsRoutesOptions> = async (fastify, options) => {
  const service = options.reviewsSvc || reviewsService;

  // POST /api/v1/projects/:id/reviews
  fastify.post<{ Params: ProjectReviewParams; Body: CreateReviewBody }>(
    '/api/v1/projects/:id/reviews',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'review-create',
          max: 20,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description: 'Creates a verified review for a completed project',
        tags: ['Reviews'],
        security: [{ bearerAuth: [] }],
        params: ProjectReviewParamsSchema,
        body: CreateReviewBodySchema,
        response: {
          201: ReviewResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const review = await service.createReview(request.user.id, request.params.id, request.body);
      return reply.code(201).send(review);
    },
  );

  // GET /api/v1/projects/:id/reviews
  fastify.get<{ Params: ProjectReviewParams }>(
    '/api/v1/projects/:id/reviews',
    {
      schema: {
        description: 'Lists reviews associated with a specific project',
        tags: ['Reviews'],
        params: ProjectReviewParamsSchema,
        response: {
          200: Type.Array(ReviewResponseSchema),
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const callerUserId = request.user?.id;
      const isAdmin = (request.user?.roles || []).includes('ADMIN');
      const reviews = await service.listProjectReviews(request.params.id, callerUserId, isAdmin);
      return reply.code(200).send(reviews);
    },
  );

  // GET /api/v1/reviews/:id
  fastify.get<{ Params: ReviewIdParams }>(
    '/api/v1/reviews/:id',
    {
      schema: {
        description: 'Retrieves a review by its ID',
        tags: ['Reviews'],
        params: ReviewIdParamsSchema,
        response: {
          200: ReviewResponseSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const callerUserId = request.user?.id;
      const isAdmin = (request.user?.roles || []).includes('ADMIN');
      const review = await service.getReview(request.params.id, callerUserId, isAdmin);
      return reply.code(200).send(review);
    },
  );

  // PATCH /api/v1/reviews/:id
  fastify.patch<{ Params: ReviewIdParams; Body: UpdateReviewBody }>(
    '/api/v1/reviews/:id',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'review-update',
          max: 20,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description: 'Edits an existing review within the 48-hour editing window',
        tags: ['Reviews'],
        security: [{ bearerAuth: [] }],
        params: ReviewIdParamsSchema,
        body: UpdateReviewBodySchema,
        response: {
          200: ReviewResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const updated = await service.updateReview(request.user.id, request.params.id, request.body);
      return reply.code(200).send(updated);
    },
  );

  // GET /api/v1/users/:userId/reviews
  fastify.get<{ Params: UserReviewParams; Querystring: PublicReviewsQuery }>(
    '/api/v1/users/:userId/reviews',
    {
      schema: {
        description: 'Lists published reviews received by a user with cursor pagination',
        tags: ['Reviews'],
        params: UserReviewParamsSchema,
        querystring: PublicReviewsQuerySchema,
        response: {
          200: Type.Object({
            items: Type.Array(ReviewResponseSchema),
            nextCursor: Type.Union([Type.String(), Type.Null()]),
          }),
        },
      },
    },
    async (request, reply) => {
      const result = await service.listUserReviews(request.params.userId, request.query);
      return reply.code(200).send(result);
    },
  );

  // GET /api/v1/users/:userId/reputation
  fastify.get<{ Params: UserReviewParams }>(
    '/api/v1/users/:userId/reputation',
    {
      schema: {
        description:
          'Retrieves public reputation summary and deterministic Bayesian score for a user',
        tags: ['Reviews'],
        params: UserReviewParamsSchema,
        response: {
          200: ReputationSummaryResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const summary = await service.getUserReputation(request.params.userId);
      return reply.code(200).send(summary);
    },
  );

  // POST /api/v1/reviews/:id/report
  fastify.post<{ Params: ReviewIdParams; Body: ReportReviewBody }>(
    '/api/v1/reviews/:id/report',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'review-report',
          max: 10,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description: 'Reports an abusive or policy-violating review',
        tags: ['Reviews'],
        security: [{ bearerAuth: [] }],
        params: ReviewIdParamsSchema,
        body: ReportReviewBodySchema,
        response: {
          201: ReviewReportResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const report = await service.reportReview(request.user.id, request.params.id, request.body);
      return reply.code(201).send(report);
    },
  );

  // POST /api/v1/reviews/:id/moderate
  fastify.post<{ Params: ReviewIdParams; Body: ModerateReviewBody }>(
    '/api/v1/reviews/:id/moderate',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'review-moderate',
          max: 30,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description:
          'Applies administrative moderation decision (HIDE, REMOVE, RESTORE) to a review',
        tags: ['Reviews'],
        security: [{ bearerAuth: [] }],
        params: ReviewIdParamsSchema,
        body: ModerateReviewBodySchema,
        response: {
          200: Type.Object({
            review: ReviewResponseSchema,
            audit: Type.Object({
              id: Type.String(),
              actionType: Type.String(),
              fromStatus: Type.String(),
              toStatus: Type.String(),
              reason: Type.String(),
              internalNotes: Type.Union([Type.String(), Type.Null()]),
              createdAt: Type.String(),
            }),
          }),
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = (request.user.roles || []).includes('ADMIN');
      if (!isAdmin) {
        throw new ForbiddenError('Only platform administrators can moderate reviews.');
      }

      const result = await service.moderateReview(request.user.id, request.params.id, request.body);
      return reply.code(200).send(result);
    },
  );

  // GET /api/v1/reviews/moderation-queue
  fastify.get<{ Querystring: ModerationQueueQuery }>(
    '/api/v1/reviews/moderation-queue',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Lists reviews awaiting administrative moderation or flagged by reports',
        tags: ['Reviews'],
        security: [{ bearerAuth: [] }],
        querystring: ModerationQueueQuerySchema,
        response: {
          200: Type.Object({
            items: Type.Array(Type.Any()),
            nextCursor: Type.Union([Type.String(), Type.Null()]),
          }),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const isAdmin = (request.user.roles || []).includes('ADMIN');
      if (!isAdmin) {
        throw new ForbiddenError('Only platform administrators can access the moderation queue.');
      }

      const queue = await service.listModerationQueue(request.user.id, request.query);
      return reply.code(200).send(queue);
    },
  );

  // GET /api/v1/reviews/pending
  fastify.get(
    '/api/v1/reviews/pending',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: "Retrieves the current user's eligible completed projects awaiting review",
        tags: ['Reviews'],
        security: [{ bearerAuth: [] }],
        response: {
          200: PendingReviewsResponseSchema,
          401: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const pending = await service.getPendingReviews(request.user.id);
      return reply.code(200).send(pending);
    },
  );
};
