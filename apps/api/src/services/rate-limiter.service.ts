import type { Redis } from 'ioredis';
import { redisCache, RedisCacheService } from './redis-cache.js';
import { RateLimiterDegradedError } from '../errors/app-error.js';

export interface RateLimitCheckParams {
  primaryKey: string; // e.g. "usr:<userId>" or "ip:<ip>"
  ip: string;
  endpoint: string;
  limit: number;
  windowSeconds: number;
  onRedisFailure?: ('fail-closed' | 'bounded-fallback' | 'fail-open') | undefined;
  fallbackMax?: number | undefined;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  degraded?: boolean;
}

interface InMemoBucket {
  count: number;
  resetAt: number;
}

export class RateLimiterService {
  private cacheSvc: RedisCacheService;
  private customClient: Redis | null = null;
  private inMemoryFallback = new Map<string, InMemoBucket>();

  constructor(cacheService: RedisCacheService = redisCache, customClient: Redis | null = null) {
    this.cacheSvc = cacheService;
    this.customClient = customClient;
  }

  private getClient(): Redis | null {
    if (this.customClient) return this.customClient;
    return this.cacheSvc.getClient();
  }

  private isConnected(): boolean {
    if (this.customClient) {
      return this.customClient.status === 'ready' || this.customClient.status === 'connect';
    }
    return this.cacheSvc.isRedisConnected();
  }

  /**
   * Primary + Secondary Rate Limit Evaluation.
   *
   * Primary key:
   * - Authenticated: usr:<userId>
   * - Anonymous: ip:<clientIp>
   *
   * Secondary key:
   * - Endpoint specific: ep:<endpoint>:<clientIp>
   *
   * Redis Failure Semantics:
   * - 'fail-closed': Strict security barrier; throws RateLimiterDegradedError (503).
   * - 'bounded-fallback': Strict local in-memory fallback with lower capacity bounds.
   * - 'fail-open': Non-critical reads fail open.
   */
  public async checkLimit(params: RateLimitCheckParams): Promise<RateLimitCheckResult> {
    const {
      primaryKey,
      ip,
      endpoint,
      limit,
      windowSeconds,
      onRedisFailure = 'bounded-fallback',
      fallbackMax = Math.min(limit, 5),
    } = params;

    const client = this.getClient();
    const isRedisHealthy = client && this.isConnected();

    if (!isRedisHealthy) {
      return this.handleRedisFailure(
        onRedisFailure,
        endpoint,
        primaryKey,
        fallbackMax,
        windowSeconds,
      );
    }

    try {
      const primaryRedisKey = `rl:p:${primaryKey}`;
      const secondaryRedisKey = `rl:s:${endpoint}:${ip}`;

      // Pipeline atomic execution
      const pipeline = client.pipeline();
      pipeline.incr(primaryRedisKey);
      pipeline.ttl(primaryRedisKey);
      pipeline.incr(secondaryRedisKey);
      pipeline.ttl(secondaryRedisKey);

      const results = await pipeline.exec();
      if (
        !results ||
        results.length < 4 ||
        !results[0] ||
        !results[1] ||
        !results[2] ||
        !results[3]
      ) {
        throw new Error('Redis pipeline failed to return expected results');
      }

      const primaryErr = results[0][0];
      const primaryCount = (results[0][1] as number) || 1;
      let primaryTtl = (results[1][1] as number) || -1;

      const secondaryErr = results[2][0];
      const secondaryCount = (results[2][1] as number) || 1;
      let secondaryTtl = (results[3][1] as number) || -1;

      if (primaryErr || secondaryErr) {
        throw primaryErr || secondaryErr;
      }

      // If key is new (TTL == -1), set expiration
      if (primaryTtl === -1) {
        await client.expire(primaryRedisKey, windowSeconds);
        primaryTtl = windowSeconds;
      }
      if (secondaryTtl === -1) {
        await client.expire(secondaryRedisKey, windowSeconds);
        secondaryTtl = windowSeconds;
      }

      const resetSeconds = Math.max(1, primaryTtl);
      const secondaryLimit = Math.max(limit * 2, 20); // Secondary endpoint-per-IP burst ceiling

      if (primaryCount > limit) {
        return {
          allowed: false,
          limit,
          remaining: 0,
          resetSeconds,
        };
      }

      if (secondaryCount > secondaryLimit) {
        return {
          allowed: false,
          limit: secondaryLimit,
          remaining: 0,
          resetSeconds: Math.max(1, secondaryTtl),
        };
      }

      return {
        allowed: true,
        limit,
        remaining: Math.max(0, limit - primaryCount),
        resetSeconds,
      };
    } catch {
      return this.handleRedisFailure(
        onRedisFailure,
        endpoint,
        primaryKey,
        fallbackMax,
        windowSeconds,
      );
    }
  }

  private handleRedisFailure(
    policy: 'fail-closed' | 'bounded-fallback' | 'fail-open',
    endpoint: string,
    primaryKey: string,
    fallbackMax: number,
    windowSeconds: number,
  ): RateLimitCheckResult {
    if (policy === 'fail-closed') {
      throw new RateLimiterDegradedError(
        `Security-sensitive endpoint '${endpoint}' rejected: Rate limiter cache infrastructure unavailable.`,
      );
    }

    if (policy === 'fail-open') {
      return {
        allowed: true,
        limit: fallbackMax,
        remaining: fallbackMax,
        resetSeconds: 0,
        degraded: true,
      };
    }

    // 'bounded-fallback': Strict local bounded in-memory limit
    const now = Date.now();
    const fallbackKey = `${endpoint}:${primaryKey}`;
    const existing = this.inMemoryFallback.get(fallbackKey);

    if (!existing || existing.resetAt <= now) {
      this.inMemoryFallback.set(fallbackKey, {
        count: 1,
        resetAt: now + windowSeconds * 1000,
      });
      return {
        allowed: true,
        limit: fallbackMax,
        remaining: Math.max(0, fallbackMax - 1),
        resetSeconds: windowSeconds,
        degraded: true,
      };
    }

    existing.count += 1;
    const remainingSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

    if (existing.count > fallbackMax) {
      return {
        allowed: false,
        limit: fallbackMax,
        remaining: 0,
        resetSeconds: remainingSeconds,
        degraded: true,
      };
    }

    return {
      allowed: true,
      limit: fallbackMax,
      remaining: Math.max(0, fallbackMax - existing.count),
      resetSeconds: remainingSeconds,
      degraded: true,
    };
  }

  /**
   * Clears in-memory fallback state (test utility).
   */
  public clearMemoryFallback(): void {
    this.inMemoryFallback.clear();
  }
}

export const rateLimiterService = new RateLimiterService();
