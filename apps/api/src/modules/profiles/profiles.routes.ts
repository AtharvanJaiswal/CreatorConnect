import type { FastifyPluginAsync } from 'fastify';
import {
  UpdateCreatorProfileInputSchema,
  CreatorProfileResponseSchema,
  UpdateProfessionalProfileInputSchema,
  ProfessionalProfileResponseSchema,
  UpdateBrandProfileInputSchema,
  BrandProfileResponseSchema,
  UpdatePodcasterProfileInputSchema,
  PodcasterProfileResponseSchema,
  UpdateUserSkillsInputSchema,
  UserSkillResponseSchema,
  type UpdateCreatorProfileInput,
  type UpdateProfessionalProfileInput,
  type UpdateBrandProfileInput,
  type UpdatePodcasterProfileInput,
  type UpdateUserSkillsInput,
} from '@creatorconnect/contracts';
import { Type } from '@sinclair/typebox';
import { IdParamSchema, type IdParam, ProblemDetailsSchema } from '@creatorconnect/validation';
import { profilesService, ProfilesService } from './profiles.service.js';

export interface ProfilesRoutesOptions {
  profilesSvc?: ProfilesService;
}

export const profilesRoutes: FastifyPluginAsync<ProfilesRoutesOptions> = async (
  fastify,
  options,
) => {
  const service = options.profilesSvc || profilesService;

  // ==============================================================================
  // Creator Profile Routes
  // ==============================================================================

  fastify.get<{ Params: IdParam }>(
    '/api/v1/profiles/creator/:id',
    {
      schema: {
        description: 'Retrieves public or owned creator profile by ID',
        tags: ['Profiles'],
        params: IdParamSchema,
        response: {
          200: CreatorProfileResponseSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const callerId = (request as any).user?.id;
      const isAdmin = (request as any).user?.roles?.includes('ADMIN') ?? false;
      const result = await service.getCreatorProfile(request.params.id, callerId, isAdmin);
      return reply.status(200).send(result);
    },
  );

  fastify.put<{ Body: UpdateCreatorProfileInput }>(
    '/api/v1/profiles/creator',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Creates or updates the authenticated user creator profile',
        tags: ['Profiles'],
        security: [{ bearerAuth: [] }],
        body: UpdateCreatorProfileInputSchema,
        response: {
          200: CreatorProfileResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.updateCreatorProfile(
        request.user.id,
        request.user.roles,
        request.body,
      );
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // Professional Profile Routes
  // ==============================================================================

  fastify.get<{ Params: IdParam }>(
    '/api/v1/profiles/professional/:id',
    {
      schema: {
        description: 'Retrieves public or owned professional profile by ID',
        tags: ['Profiles'],
        params: IdParamSchema,
        response: {
          200: ProfessionalProfileResponseSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const callerId = (request as any).user?.id;
      const isAdmin = (request as any).user?.roles?.includes('ADMIN') ?? false;
      const result = await service.getProfessionalProfile(request.params.id, callerId, isAdmin);
      return reply.status(200).send(result);
    },
  );

  fastify.put<{ Body: UpdateProfessionalProfileInput }>(
    '/api/v1/profiles/professional',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Creates or updates the authenticated user professional profile',
        tags: ['Profiles'],
        security: [{ bearerAuth: [] }],
        body: UpdateProfessionalProfileInputSchema,
        response: {
          200: ProfessionalProfileResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.updateProfessionalProfile(
        request.user.id,
        request.user.roles,
        request.body,
      );
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // Brand Profile Routes
  // ==============================================================================

  fastify.get<{ Params: IdParam }>(
    '/api/v1/profiles/brand/:id',
    {
      schema: {
        description: 'Retrieves public or owned brand profile by ID',
        tags: ['Profiles'],
        params: IdParamSchema,
        response: {
          200: BrandProfileResponseSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const callerId = (request as any).user?.id;
      const isAdmin = (request as any).user?.roles?.includes('ADMIN') ?? false;
      const result = await service.getBrandProfile(request.params.id, callerId, isAdmin);
      return reply.status(200).send(result);
    },
  );

  fastify.put<{ Body: UpdateBrandProfileInput }>(
    '/api/v1/profiles/brand',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Creates or updates the authenticated user brand profile',
        tags: ['Profiles'],
        security: [{ bearerAuth: [] }],
        body: UpdateBrandProfileInputSchema,
        response: {
          200: BrandProfileResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.updateBrandProfile(
        request.user.id,
        request.user.roles,
        request.body,
      );
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // Podcaster Profile Routes
  // ==============================================================================

  fastify.get<{ Params: IdParam }>(
    '/api/v1/profiles/podcaster/:id',
    {
      schema: {
        description: 'Retrieves public or owned podcaster profile by ID',
        tags: ['Profiles'],
        params: IdParamSchema,
        response: {
          200: PodcasterProfileResponseSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const callerId = (request as any).user?.id;
      const isAdmin = (request as any).user?.roles?.includes('ADMIN') ?? false;
      const result = await service.getPodcasterProfile(request.params.id, callerId, isAdmin);
      return reply.status(200).send(result);
    },
  );

  fastify.put<{ Body: UpdatePodcasterProfileInput }>(
    '/api/v1/profiles/podcaster',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Creates or updates the authenticated user podcaster profile',
        tags: ['Profiles'],
        security: [{ bearerAuth: [] }],
        body: UpdatePodcasterProfileInputSchema,
        response: {
          200: PodcasterProfileResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.updatePodcasterProfile(
        request.user.id,
        request.user.roles,
        request.body,
      );
      return reply.status(200).send(result);
    },
  );

  // ==============================================================================
  // User Skills & Aggregated Profiles
  // ==============================================================================

  fastify.put<{ Body: UpdateUserSkillsInput }>(
    '/api/v1/profiles/skills',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Replaces the skills attached to the authenticated user profile',
        tags: ['Profiles'],
        security: [{ bearerAuth: [] }],
        body: UpdateUserSkillsInputSchema,
        response: {
          200: Type.Array(UserSkillResponseSchema),
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.updateUserSkills(request.user.id, request.body);
      return reply.status(200).send(result);
    },
  );

  fastify.get(
    '/api/v1/profiles/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Aggregates all profiles and skills configured for the authenticated user',
        tags: ['Profiles'],
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Object({
            creator: Type.Union([CreatorProfileResponseSchema, Type.Null()]),
            professional: Type.Union([ProfessionalProfileResponseSchema, Type.Null()]),
            brand: Type.Union([BrandProfileResponseSchema, Type.Null()]),
            podcaster: Type.Union([PodcasterProfileResponseSchema, Type.Null()]),
            skills: Type.Array(UserSkillResponseSchema),
          }),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.getMeProfiles(request.user.id);
      return reply.status(200).send(result);
    },
  );
};
