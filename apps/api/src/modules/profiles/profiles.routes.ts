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
  PublicCreatorProfileResponseSchema,
  PublicBrandProfileResponseSchema,
  ProfileCompletionBreakdownSchema,
  BrandAuditLogResponseSchema,
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

  // GET /api/v1/profiles/creator/me
  fastify.get(
    '/api/v1/profiles/creator/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves authenticated user creator profile',
        tags: ['Profiles'],
        security: [{ bearerAuth: [] }],
        response: {
          200: CreatorProfileResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.getMyCreatorProfile(request.user.id);
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/profiles/creator/completion
  fastify.get(
    '/api/v1/profiles/creator/completion',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves profile completion score, diagnostics, and validation tips',
        tags: ['Profiles'],
        security: [{ bearerAuth: [] }],
        response: {
          200: ProfileCompletionBreakdownSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.getCreatorProfileCompletion(request.user.id);
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/profiles/public/creator/:id
  fastify.get<{ Params: IdParam }>(
    '/api/v1/profiles/public/creator/:id',
    {
      schema: {
        description:
          'Retrieves public creator profile by ID or User ID (Strict Allowlist — zero auth leakage)',
        tags: ['Profiles'],
        params: IdParamSchema,
        response: {
          200: PublicCreatorProfileResponseSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      let callerId: string | undefined;
      let isAdmin = false;
      if (request.headers.authorization?.startsWith('Bearer ')) {
        try {
          await (fastify as any).authenticate(request, reply);
          callerId = request.user?.id;
          isAdmin = request.user?.roles?.includes('ADMIN') ?? false;
        } catch {
          // Public endpoint continues anonymously
        }
      }
      const result = await service.getPublicCreatorProfile(request.params.id, callerId, isAdmin);
      return reply.status(200).send(result);
    },
  );

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

  // GET /api/v1/profiles/brand/me
  fastify.get(
    '/api/v1/profiles/brand/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves authenticated user brand profile',
        tags: ['Profiles'],
        security: [{ bearerAuth: [] }],
        response: {
          200: BrandProfileResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.getMyBrandProfile(request.user.id);
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/profiles/brand/audit
  fastify.get(
    '/api/v1/profiles/brand/audit',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves brand profile audit logs for the authenticated owner or admin',
        tags: ['Profiles'],
        security: [{ bearerAuth: [] }],
        response: {
          200: Type.Array(BrandAuditLogResponseSchema),
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.getBrandAuditLogs(request.user.id);
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/profiles/public/brand/:id
  fastify.get<{ Params: IdParam }>(
    '/api/v1/profiles/public/brand/:id',
    {
      schema: {
        description:
          'Retrieves public brand profile by ID or User ID (Strict Allowlist — zero auth leakage)',
        tags: ['Profiles'],
        params: IdParamSchema,
        response: {
          200: PublicBrandProfileResponseSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      let callerId: string | undefined;
      let isAdmin = false;
      if (request.headers.authorization?.startsWith('Bearer ')) {
        try {
          await (fastify as any).authenticate(request, reply);
          callerId = request.user?.id;
          isAdmin = request.user?.roles?.includes('ADMIN') ?? false;
        } catch {
          // Public endpoint continues anonymously
        }
      }
      const result = await service.getPublicBrandProfile(request.params.id, callerId, isAdmin);
      return reply.status(200).send(result);
    },
  );

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

  // ==============================================================================
  // Verification Endpoints (PostgreSQL Persisted)
  // ==============================================================================

  fastify.post<{ Body: { platform: string; handle: string; code: string } }>(
    '/api/v1/profiles/verification/creator',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Submits creator profile verification request',
        tags: ['Profiles'],
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          platform: Type.String(),
          handle: Type.String(),
          code: Type.String(),
        }),
      },
    },
    async (request, reply) => {
      const { platform, handle, code } = request.body;
      const prisma = (service as any).repo.prisma;
      await prisma.creatorProfile.updateMany({
        where: { userId: request.user.id },
        data: {
          socialLinks: {
            verification: {
              state: 'UNDER_REVIEW',
              platform,
              handle,
              code,
              submittedDate: new Date().toISOString(),
            },
          },
        },
      });
      return reply.status(200).send({
        success: true,
        state: 'UNDER_REVIEW',
        submittedAccount: `${platform} @${handle}`,
        oneTimeCode: code,
      });
    },
  );

  fastify.post<{
    Body: { businessName: string; regNumber: string; person: string; documents: string[] };
  }>(
    '/api/v1/profiles/verification/brand',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Submits brand business verification request',
        tags: ['Profiles'],
        security: [{ bearerAuth: [] }],
        body: Type.Object({
          businessName: Type.String(),
          regNumber: Type.String(),
          person: Type.String(),
          documents: Type.Array(Type.String()),
        }),
      },
    },
    async (request, reply) => {
      const { businessName, regNumber, person, documents } = request.body;
      const prisma = (service as any).repo.prisma;
      await prisma.brandProfile.updateMany({
        where: { userId: request.user.id },
        data: {
          bio: `[VERIFICATION_PENDING] ${businessName} | Reg: ${regNumber} | Contact: ${person}`,
        },
      });
      return reply.status(200).send({
        success: true,
        state: 'UNDER_REVIEW',
        submittedAccount: businessName,
        brandDocumentNames: documents,
      });
    },
  );

  fastify.get(
    '/api/v1/profiles/verification/status',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves current user verification state from database',
        tags: ['Profiles'],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      const prisma = (service as any).repo.prisma;
      const creator = await prisma.creatorProfile.findUnique({
        where: { userId: request.user.id },
      });
      const brand = await prisma.brandProfile.findUnique({
        where: { userId: request.user.id },
      });

      if (creator?.isVerified || brand?.isVerified) {
        return reply.status(200).send({
          state: 'APPROVED',
          isVerified: true,
          attemptsRemaining: 3,
        });
      }

      const creatorMeta = (creator?.socialLinks as any)?.verification;
      if (creatorMeta) {
        return reply.status(200).send({
          state: creatorMeta.state || 'UNDER_REVIEW',
          submittedAccount: `${creatorMeta.platform} @${creatorMeta.handle}`,
          oneTimeCode: creatorMeta.code,
          submittedDate: creatorMeta.submittedDate,
          attemptsRemaining: 2,
        });
      }

      if (brand?.bio?.includes('[VERIFICATION_PENDING]')) {
        return reply.status(200).send({
          state: 'UNDER_REVIEW',
          submittedAccount: brand.companyName,
          attemptsRemaining: 2,
        });
      }

      return reply.status(200).send({
        state: 'NOT_STARTED',
        attemptsRemaining: 3,
      });
    },
  );
};
