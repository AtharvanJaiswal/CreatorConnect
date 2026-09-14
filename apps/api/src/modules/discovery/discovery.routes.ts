import type { FastifyPluginAsync } from 'fastify';
import {
  SearchAssignmentsQuerySchema,
  SearchAssignmentsResponseSchema,
  SearchCreatorsQuerySchema,
  SearchCreatorsResponseSchema,
  CategoryResponseSchema,
  SkillResponseSchema,
  type SearchAssignmentsQuery,
  type SearchCreatorsQuery,
} from '@creatorconnect/contracts';
import { Type } from '@sinclair/typebox';
import { ProblemDetailsSchema } from '@creatorconnect/validation';
import { discoveryService, DiscoveryService } from './discovery.service.js';
import { profilesService } from '../profiles/profiles.service.js';

export interface DiscoveryRoutesOptions {
  discoverySvc?: DiscoveryService;
}

export const discoveryRoutes: FastifyPluginAsync<DiscoveryRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.discoverySvc || discoveryService;

  // GET /api/v1/discovery/assignments
  fastify.get<{ Querystring: SearchAssignmentsQuery }>(
    '/api/v1/discovery/assignments',
    {
      schema: {
        description:
          'Searches published assignments using PostgreSQL FTS and trigram fuzzy matching',
        tags: ['Discovery'],
        querystring: SearchAssignmentsQuerySchema,
        response: {
          200: SearchAssignmentsResponseSchema,
          400: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const start = Date.now();
      const result = await service.searchAssignments(request.query);
      const durationMs = Date.now() - start;
      request.log.info(
        { durationMs, query: request.query.q, count: result.items.length },
        'Discovery assignment search executed',
      );
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/discovery/creators
  fastify.get<{ Querystring: SearchCreatorsQuery }>(
    '/api/v1/discovery/creators',
    {
      schema: {
        description:
          'Searches public creator profiles using PostgreSQL FTS and trigram fuzzy matching',
        tags: ['Discovery'],
        querystring: SearchCreatorsQuerySchema,
        response: {
          200: SearchCreatorsResponseSchema,
          400: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const start = Date.now();
      const result = await service.searchCreators(request.query);
      const durationMs = Date.now() - start;
      request.log.info(
        { durationMs, query: request.query.q, count: result.items.length },
        'Discovery creator search executed',
      );
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/discovery/categories
  fastify.get(
    '/api/v1/discovery/categories',
    {
      schema: {
        description: 'Lists all active taxonomy categories',
        tags: ['Discovery'],
        response: {
          200: Type.Array(CategoryResponseSchema),
        },
      },
    },
    async (_request, reply) => {
      const result = await profilesService.getActiveCategories();
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/discovery/skills
  fastify.get(
    '/api/v1/discovery/skills',
    {
      schema: {
        description: 'Lists all active taxonomy skills',
        tags: ['Discovery'],
        response: {
          200: Type.Array(SkillResponseSchema),
        },
      },
    },
    async (_request, reply) => {
      const result = await profilesService.getActiveSkills();
      return reply.status(200).send(result);
    },
  );
};
