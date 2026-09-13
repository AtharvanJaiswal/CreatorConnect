import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import type { RoleType } from '@creatorconnect/contracts';
import { defineAbilitiesFor, type AppAbility, type UserIdentity } from '@creatorconnect/auth';
import { defaultJwtVerifier, JwtVerifier } from '../services/jwt-verifier.js';
import { redisCache, RedisCacheService } from '../services/redis-cache.js';
import { userRepository, IUserRepository } from '../repositories/user.repository.js';
import {
  AuthInvalidTokenError,
  AuthInsufficientRoleError,
  UserSuspendedError,
  UserDeactivatedError,
  IdentityNotSyncedError,
} from '../errors/app-error.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      allowedRoles: RoleType[],
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: UserIdentity;
    ability: AppAbility;
  }
}

export interface AuthPluginOptions {
  jwtVerifier?: JwtVerifier;
  userRepo?: IUserRepository;
  cache?: RedisCacheService;
}

const authPluginAsync: FastifyPluginAsync<AuthPluginOptions> = async (fastify, options) => {
  const verifier = options.jwtVerifier || defaultJwtVerifier;
  const userRepo = options.userRepo || userRepository;
  const cache = options.cache || redisCache;

  /**
   * Authoritative authentication and account status pre-handler hook.
   * Runtime semantics:
   * 1. JWT signature and claims verification
   * 2. Supabase sub resolution
   * 3. Authoritative PostgreSQL account-status check (Redis NEVER authorizes ACTIVE status)
   * 4. Reject SUSPENDED/DEACTIVATED immediately
   * 5. Continue authorization only when PostgreSQL confirms ACTIVE
   */
  const authenticate = async (request: FastifyRequest, _reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthInvalidTokenError('Authorization header with Bearer token is required.');
    }

    const token = authHeader.substring(7).trim();
    const tokenPayload = await verifier.verifyToken(token);

    // PostgreSQL is the sole, authoritative source of truth for account status
    const statusRecord = await userRepo.getStatusBySub(tokenPayload.sub);
    if (!statusRecord) {
      throw new IdentityNotSyncedError('User profile not synchronized with platform.');
    }

    if (statusRecord.status === 'SUSPENDED') {
      throw new UserSuspendedError('Account is suspended. Access denied.');
    }

    if (statusRecord.status === 'DEACTIVATED') {
      throw new UserDeactivatedError('Account is deactivated. Access denied.');
    }

    if (statusRecord.status !== 'ACTIVE') {
      throw new UserSuspendedError('Account is not in active state.');
    }

    // Status is authoritatively ACTIVE in PostgreSQL. Now load user metadata and roles.
    let user = await cache.getCachedUserBySub(tokenPayload.sub);
    if (!user) {
      user = await userRepo.findBySub(tokenPayload.sub);
      if (user) {
        await cache.cacheUser(user);
      }
    }

    if (!user) {
      throw new IdentityNotSyncedError('User record could not be loaded.');
    }

    request.user = user;
    request.ability = defineAbilitiesFor(user);
  };

  /**
   * Pre-handler hook enforcing Tier 1 Global Role-Based Access Control.
   */
  const requireRole = (allowedRoles: RoleType[]) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      if (!request.user) {
        throw new AuthInvalidTokenError('User identity context missing.');
      }

      const hasRequiredRole = request.user.roles.some((r) => allowedRoles.includes(r));
      if (!hasRequiredRole) {
        throw new AuthInsufficientRoleError(
          `Access requires one of the following roles: ${allowedRoles.join(', ')}`,
        );
      }
    };
  };

  fastify.decorate('authenticate', authenticate);
  fastify.decorate('requireRole', requireRole);
};

export const authPlugin = fp(authPluginAsync, {
  name: 'creatorconnect-auth',
});
