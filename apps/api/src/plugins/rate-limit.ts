import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { rateLimiterService, RateLimiterService } from '../services/rate-limiter.service.js';
import { RateLimitExceededError } from '../errors/app-error.js';

export interface RateLimitRouteOptions {
  endpoint: string;
  max: number;
  windowSeconds?: number;
  onRedisFailure?: ('fail-closed' | 'bounded-fallback' | 'fail-open') | undefined;
  fallbackMax?: number | undefined;
  disableTestMultiplier?: boolean | undefined;
}

export interface RateLimiterPluginOptions {
  limiterService?: RateLimiterService;
}

declare module 'fastify' {
  interface FastifyInstance {
    rateLimit: (
      options: RateLimitRouteOptions,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const rateLimiterPluginAsync: FastifyPluginAsync<RateLimiterPluginOptions> = async (
  fastify,
  options,
) => {
  const limiter = options.limiterService || rateLimiterService;

  const createRateLimiter = (routeOpts: RateLimitRouteOptions) => {
    const {
      endpoint,
      max,
      windowSeconds = 60,
      onRedisFailure = 'bounded-fallback',
      fallbackMax,
      disableTestMultiplier,
    } = routeOpts;

    return async (request: FastifyRequest, reply: FastifyReply) => {
      // Authenticated requests keyed on verified user ID; anonymous requests keyed on client IP
      const isAuth = !!request.user?.id;
      const primaryKey = isAuth ? `usr:${request.user.id}` : `ip:${request.ip}`;
      const clientIp = request.ip;

      const isTestEnv =
        (process.env.NODE_ENV === 'test' || !!process.env.VITEST) && !disableTestMultiplier;
      const effectiveLimit = isTestEnv ? max * 50 : max;
      const effectiveFallback = isTestEnv && fallbackMax ? fallbackMax * 50 : fallbackMax;

      const result = await limiter.checkLimit({
        primaryKey,
        ip: clientIp,
        endpoint,
        limit: effectiveLimit,
        windowSeconds,
        onRedisFailure,
        fallbackMax: effectiveFallback,
      });

      // Standard Rate-Limiting Headers
      reply.header('X-RateLimit-Limit', result.limit);
      reply.header('X-RateLimit-Remaining', Math.max(0, result.remaining));
      reply.header('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + result.resetSeconds);

      if (!result.allowed) {
        reply.header('Retry-After', result.resetSeconds);
        throw new RateLimitExceededError(
          result.resetSeconds,
          `Rate limit of ${result.limit} requests per ${windowSeconds}s exceeded for endpoint '${endpoint}'. Retry in ${result.resetSeconds}s.`,
        );
      }
    };
  };

  fastify.decorate('rateLimit', createRateLimiter);
};

export const rateLimiterPlugin = fp(rateLimiterPluginAsync, {
  name: 'creatorconnect-rate-limit',
});
