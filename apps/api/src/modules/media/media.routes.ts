import type { FastifyPluginAsync } from 'fastify';
import {
  RequestUploadUrlInputSchema,
  RequestUploadUrlResponseSchema,
  ConfirmUploadInputSchema,
  MediaAssetResponseSchema,
  type RequestUploadUrlInput,
  type ConfirmUploadInput,
} from '@creatorconnect/contracts';
import { IdParamSchema, type IdParam, ProblemDetailsSchema } from '@creatorconnect/validation';
import { mediaService, MediaService } from './media.service.js';

export interface MediaRoutesOptions {
  mediaSvc?: MediaService;
}

export const mediaRoutes: FastifyPluginAsync<MediaRoutesOptions> = async (fastify, options) => {
  const service = options.mediaSvc || mediaService;

  // POST /api/v1/media/upload-url
  fastify.post<{ Body: RequestUploadUrlInput }>(
    '/api/v1/media/upload-url',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Generates a presigned S3/R2 PUT URL for uploading a media binary',
        tags: ['Media'],
        security: [{ bearerAuth: [] }],
        body: RequestUploadUrlInputSchema,
        response: {
          200: RequestUploadUrlResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.requestUploadUrl(request.user.id, request.body);
      return reply.status(200).send(result);
    },
  );

  // POST /api/v1/media/upload-confirm
  fastify.post<{ Body: ConfirmUploadInput }>(
    '/api/v1/media/upload-confirm',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Confirms upload completion, validates size, and enqueues processing',
        tags: ['Media'],
        security: [{ bearerAuth: [] }],
        body: ConfirmUploadInputSchema,
        response: {
          200: MediaAssetResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.confirmUpload(request.user.id, request.body);
      return reply.status(200).send(result);
    },
  );

  // GET /api/v1/media/:id
  fastify.get<{ Params: IdParam }>(
    '/api/v1/media/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        description: 'Retrieves media metadata and download URL',
        tags: ['Media'],
        security: [{ bearerAuth: [] }],
        params: IdParamSchema,
        response: {
          200: MediaAssetResponseSchema,
          401: ProblemDetailsSchema,
          403: ProblemDetailsSchema,
          404: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await service.getAsset(request.user.id, request.params.id);
      return reply.status(200).send(result);
    },
  );
};
