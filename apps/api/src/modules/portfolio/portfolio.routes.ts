import type { FastifyPluginAsync } from 'fastify';
import {
  CreatePortfolioItemInputSchema,
  UpdatePortfolioItemInputSchema,
  AttachPortfolioMediaInputSchema,
  ReorderPortfolioMediaInputSchema,
  PortfolioItemResponseSchema,
  PortfolioMediaResponseSchema,
  type CreatePortfolioItemInput,
  type UpdatePortfolioItemInput,
  type AttachPortfolioMediaInput,
  type ReorderPortfolioMediaInput,
} from '@creatorconnect/contracts';
import { Type } from '@sinclair/typebox';
import { IdParamSchema, type IdParam, ProblemDetailsSchema } from '@creatorconnect/validation';
import { portfolioService, PortfolioService } from './portfolio.service.js';

export interface PortfolioRoutesOptions {
  portfolioSvc?: PortfolioService;
}

export const portfolioRoutes: FastifyPluginAsync<PortfolioRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.portfolioSvc || portfolioService;

  // POST /api/v1/portfolio/items
  fastify.post<{ Body: CreatePortfolioItemInput }>(
    '/api/v1/portfolio/items',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description:
          'Creates a new portfolio showcase project for the authenticated creator or professional',
        tags: ['Portfolio'],
        security: [{ bearerAuth: [] }],
        body: CreatePortfolioItemInputSchema,
        response: {
          201: PortfolioItemResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.createItem(request.user.id, request.user.roles, request.body);
      return reply.status(201).send(result);
    },
  );

  // GET /api/v1/portfolio/items/:id
  fastify.get<{ Params: IdParam }>(
    '/api/v1/portfolio/items/:id',
    {
      schema: {
        description: 'Retrieves public or owned portfolio item by ID',
        tags: ['Portfolio'],
        params: IdParamSchema,
        response: {
          200: PortfolioItemResponseSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const callerId = (request as any).user?.id;
      const isAdmin = (request as any).user?.roles?.includes('ADMIN') ?? false;
      const result = await service.getItem(request.params.id, callerId, isAdmin);
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/portfolio/users/:id
  fastify.get<{ Params: IdParam }>(
    '/api/v1/portfolio/users/:id',
    {
      schema: {
        description: 'Retrieves visible portfolio items for a specific user',
        tags: ['Portfolio'],
        params: IdParamSchema,
        response: {
          200: Type.Array(PortfolioItemResponseSchema),
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const callerId = (request as any).user?.id;
      const isAdmin = (request as any).user?.roles?.includes('ADMIN') ?? false;
      const result = await service.getUserItems(request.params.id, callerId, isAdmin);
      return reply.status(200).send(result);
    },
  );

  // PUT /api/v1/portfolio/items/:id
  fastify.put<{ Params: IdParam; Body: UpdatePortfolioItemInput }>(
    '/api/v1/portfolio/items/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Updates attributes of an owned portfolio item',
        tags: ['Portfolio'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: UpdatePortfolioItemInputSchema,
        response: {
          200: PortfolioItemResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.updateItem(request.user.id, request.params.id, request.body);
      return reply.status(200).send(result);
    },
  );

  // DELETE /api/v1/portfolio/items/:id
  fastify.delete<{ Params: IdParam }>(
    '/api/v1/portfolio/items/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Soft-deletes an owned portfolio item',
        tags: ['Portfolio'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          204: Type.Null(),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      await service.deleteItem(request.user.id, request.params.id);
      return reply.status(204).send();
    },
  );

  // POST /api/v1/portfolio/items/:id/media
  fastify.post<{ Params: IdParam; Body: AttachPortfolioMediaInput }>(
    '/api/v1/portfolio/items/:id/media',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Attaches an ACTIVE, owned media asset to a portfolio item',
        tags: ['Portfolio'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: AttachPortfolioMediaInputSchema,
        response: {
          201: PortfolioMediaResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.attachMedia(request.user.id, request.params.id, request.body);
      return reply.status(201).send(result);
    },
  );

  // PUT /api/v1/portfolio/items/:id/media/reorder
  fastify.put<{ Params: IdParam; Body: ReorderPortfolioMediaInput }>(
    '/api/v1/portfolio/items/:id/media/reorder',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Reorders media assets attached to a portfolio item',
        tags: ['Portfolio'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        body: ReorderPortfolioMediaInputSchema,
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
      await service.reorderMedia(request.user.id, request.params.id, request.body);
      return reply.status(204).send();
    },
  );
};
