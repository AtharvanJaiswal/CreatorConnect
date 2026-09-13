import type { FastifyPluginAsync } from 'fastify';
import {
  SyncUserRequestSchema,
  SyncUserResponseSchema,
  type SyncUserRequest,
} from '@creatorconnect/contracts';
import { ProblemDetailsSchema } from '@creatorconnect/validation';
import { defaultJwtVerifier, JwtVerifier } from '../../services/jwt-verifier.js';
import { authService, AuthService } from './auth.service.js';
import { AuthInvalidTokenError } from '../../errors/app-error.js';

export interface AuthRoutesOptions {
  jwtVerifier?: JwtVerifier;
  authSvc?: AuthService;
}

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (fastify, options) => {
  const verifier = options.jwtVerifier || defaultJwtVerifier;
  const service = options.authSvc || authService;

  fastify.post<{ Body: SyncUserRequest }>(
    '/api/v1/auth/sync',
    {
      schema: {
        description:
          'Synchronizes external Supabase identity to internal CreatorConnect profile and assigns initial persona role',
        tags: ['Auth'],
        headers: {
          type: 'object',
          properties: {
            authorization: { type: 'string', description: 'Bearer <supabase_jwt>' },
          },
        },

        body: SyncUserRequestSchema,
        response: {
          200: SyncUserResponseSchema,
          201: SyncUserResponseSchema,
          400: ProblemDetailsSchema,
          401: ProblemDetailsSchema,
          409: ProblemDetailsSchema,
        },
      },
    },
    async (request, reply) => {
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthInvalidTokenError('Authorization header with Bearer token is required.');
      }

      const token = authHeader.substring(7).trim();
      const tokenPayload = await verifier.verifyToken(token);

      const result = await service.syncUser(
        tokenPayload.sub,
        tokenPayload.email,
        request.body?.preferredRole,
        request.ip,
        request.headers['user-agent'],
      );

      const statusCode = result.isNewUser ? 201 : 200;
      return reply.status(statusCode).send(result);
    },
  );
};
