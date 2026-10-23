import type { FastifyPluginAsync } from 'fastify';
import {
  HomeDashboardResponseSchema,
  DiscoverQuerySchema,
  DiscoverResponseSchema,
  AutocompleteQuerySchema,
  AutocompleteResponseSchema,
  RecommendationsResponseSchema,
  PublicProfileResponseSchema,
  ConnectionRequestInputSchema,
  ConnectionRequestResponseSchema,
  BlockUserInputSchema,
  CreateReportInputSchema,
  type DiscoverQuery,
  type AutocompleteQuery,
  type ConnectionRequestInput,
  type BlockUserInput,
  type CreateReportInput,
} from '@creatorconnect/contracts';
import { Type } from '@sinclair/typebox';
import { ProblemDetailsSchema } from '@creatorconnect/validation';
import { AuthInsufficientRoleError } from '../../errors/app-error.js';
import { discoveryModuleDService } from './discovery.module-d.service.js';

export const discoveryModuleDRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. GET /api/v1/home/dashboard
  fastify.get<{ Querystring: { role?: string } }>(
    '/api/v1/home/dashboard',
    {
      schema: {
        description:
          'Returns role-specific stats, pending alerts, recommended profiles, and active briefs',
        tags: ['Home'],
        querystring: Type.Object({
          role: Type.Optional(Type.String()),
        }),
        response: {
          200: HomeDashboardResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      // Authenticate if bearer token is provided
      if (request.headers.authorization && request.headers.authorization.startsWith('Bearer ')) {
        await fastify.authenticate(request, reply);
      }

      const user = request.user;
      let role: string;

      if (user) {
        const userRoles = (user.roles || []).map((r: any) => String(r).toUpperCase());
        const isBrandUser = userRoles.includes('BRAND');
        const isCreatorUser = userRoles.some((r: string) =>
          ['CREATOR', 'PODCASTER', 'PROFESSIONAL'].includes(r),
        );

        if (request.query.role) {
          const requestedRole = request.query.role.toUpperCase();
          if (requestedRole === 'BRAND' && !isBrandUser) {
            throw new AuthInsufficientRoleError(
              'Access denied: Creator accounts cannot access the Brand dashboard.',
            );
          }
          if (
            ['CREATOR', 'PODCASTER', 'PROFESSIONAL'].includes(requestedRole) &&
            !isCreatorUser &&
            isBrandUser
          ) {
            throw new AuthInsufficientRoleError(
              'Access denied: Brand accounts cannot access the Creator dashboard.',
            );
          }
          role = requestedRole;
        } else {
          role = isBrandUser ? 'BRAND' : userRoles[0] || 'CREATOR';
        }
      } else {
        role = (request.query.role || 'CREATOR').toUpperCase();
      }

      const userId = user?.id;
      const result = await discoveryModuleDService.getHomeDashboard(userId, role);
      return reply.status(200).send(result);
    },
  );

  // 2. GET /api/v1/discover
  fastify.get<{ Querystring: DiscoverQuery }>(
    '/api/v1/discover',
    {
      preHandler: [
        fastify.rateLimit({
          endpoint: 'discovery-search',
          max: 120,
          windowSeconds: 60,
          onRedisFailure: 'bounded-fallback',
          fallbackMax: 40,
        }),
      ],
      schema: {
        description: 'Advanced multi-criteria discovery search with 60-second Redis caching',
        tags: ['Discovery'],
        querystring: DiscoverQuerySchema,
        response: {
          200: DiscoverResponseSchema,
          400: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await discoveryModuleDService.discover(request.query);
      return reply.status(200).send(result);
    },
  );

  // 3. GET /api/v1/search/autocomplete
  fastify.get<{ Querystring: AutocompleteQuery }>(
    '/api/v1/search/autocomplete',
    {
      schema: {
        description:
          'Returns categorized autocomplete suggestions (niches, skills, locations, profiles)',
        tags: ['Discovery'],
        querystring: AutocompleteQuerySchema,
        response: {
          200: AutocompleteResponseSchema,
          400: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await discoveryModuleDService.autocomplete(request.query.q);
      return reply.status(200).send(result);
    },
  );

  // 4. GET /api/v1/discover/recommendations
  fastify.get<{ Querystring: { role?: string } }>(
    '/api/v1/discover/recommendations',
    {
      schema: {
        description: 'Rule-based matching recommendation engine with explicit match reason badges',
        tags: ['Discovery'],
        querystring: Type.Object({
          role: Type.Optional(Type.String()),
        }),
        response: {
          200: RecommendationsResponseSchema,
          400: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const role = request.query.role || (request as any).user?.roles?.[0] || 'CREATOR';
      const result = await discoveryModuleDService.getRecommendations(role);
      return reply.status(200).send(result);
    },
  );

  // 5. GET /api/v1/profile/:id
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/profile/:id',
    {
      preHandler: async (request, reply) => {
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          try {
            await fastify.authenticate(request, reply);
          } catch {
            // Optional auth, proceed if invalid
          }
        }
      },
      schema: {
        description:
          'Returns comprehensive public profile details with verifications, reviews, and portfolio',
        tags: ['Profiles'],
        params: Type.Object({
          id: Type.String(),
        }),
        response: {
          200: PublicProfileResponseSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      let targetId = request.params.id;
      if (targetId === 'self' || targetId === 'me') {
        if (request.user?.id) {
          targetId = request.user.id;
        }
      }
      const result = await discoveryModuleDService.getPublicProfile(targetId, request.user?.id);
      return reply.status(200).send(result);
    },
  );

  // 6. POST /api/v1/connections/request
  fastify.post<{ Body: ConnectionRequestInput }>(
    '/api/v1/connections/request',
    {
      preHandler: [
        fastify.authenticate,
        fastify.rateLimit({
          endpoint: 'expensive-mutation',
          max: 60,
          windowSeconds: 60,
          onRedisFailure: 'fail-closed',
        }),
      ],
      schema: {
        description: 'Sends a connection request, enforcing a 5/day Free tier quota per SOW §17',
        tags: ['Connections'],
        security: [{ bearerAuth: [] }],
        body: ConnectionRequestInputSchema,
        response: {
          200: ConnectionRequestResponseSchema,
          403: ProblemDetailsSchema,
          400: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const callerId = request.user.id;
      const result = await discoveryModuleDService.requestConnection(callerId, request.body);
      return reply.status(200).send(result);
    },
  );

  // 7. POST /api/v1/users/block
  fastify.post<{ Body: BlockUserInput }>(
    '/api/v1/users/block',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Blocks a user and removes them from future searches/feeds',
        tags: ['Safety'],
        security: [{ bearerAuth: [] }],
        body: BlockUserInputSchema,
        response: {
          200: Type.Object({ success: Type.Boolean() }),
          400: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const callerId = request.user.id;
      const result = await discoveryModuleDService.blockUser(
        callerId,
        request.body.targetUserId,
        request.body.reason,
      );
      return reply.status(200).send(result);
    },
  );

  // 8. POST /api/v1/reports
  fastify.post<{ Body: CreateReportInput }>(
    '/api/v1/reports',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description:
          'Dispatches content or profile moderation report directly to the Admin moderation queue',
        tags: ['Safety'],
        security: [{ bearerAuth: [] }],
        body: CreateReportInputSchema,
        response: {
          200: Type.Object({ success: Type.Boolean(), reportId: Type.String() }),
          400: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const callerId = request.user.id;
      const result = await discoveryModuleDService.createReport(
        callerId,
        request.body.targetId,
        request.body.targetType,
        request.body.category,
        request.body.details,
      );
      return reply.status(200).send(result);
    },
  );
};
