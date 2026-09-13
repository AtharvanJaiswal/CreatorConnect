import { Redis } from 'ioredis';
import type { UserIdentity } from '@creatorconnect/auth';

export interface CacheMetrics {
  hits: number;
  misses: number;
  invalidationFailures: number;
}

export class RedisCacheService {
  private client: Redis | null = null;
  private isConnected = false;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    invalidationFailures: 0,
  };

  // Local fallback tombstones if Redis invalidation fails
  private invalidationTombstones = new Set<string>();

  constructor(redisUrl?: string) {
    const url = redisUrl || process.env.REDIS_URL;
    if (url) {
      try {
        this.client = new Redis(url, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
        });

        this.client.on('connect', () => {
          this.isConnected = true;
        });

        this.client.on('error', () => {
          this.isConnected = false;
          // Fail-closed resilience: Redis connection issues will not crash the app
        });
      } catch {
        this.client = null;
        this.isConnected = false;
      }
    }
  }

  public async connect(): Promise<void> {
    if (this.client && !this.isConnected) {
      try {
        await this.client.connect();
        this.isConnected = true;
      } catch {
        this.isConnected = false;
      }
    }
  }

  public getMetrics(): Readonly<CacheMetrics> {
    return { ...this.metrics };
  }

  /**
   * Caches user identity metadata with a short TTL.
   * NOTE: Per architectural invariant, Redis is NEVER the sole authority for account status.
   */
  public async cacheUser(user: UserIdentity, ttlSeconds = 300): Promise<void> {
    if (!this.client || !this.isConnected) return;

    try {
      const data = JSON.stringify(user);
      await this.client.setex(`user:sub:${user.supabaseAuthId}`, ttlSeconds, data);
      await this.client.setex(`user:id:${user.id}`, ttlSeconds, data);
    } catch {
      // Ephemeral cache write failure: fail silently, DB remains authoritative
    }
  }

  /**
   * Retrieves cached user identity metadata if available and not marked with an invalidation tombstone.
   */
  public async getCachedUserBySub(sub: string): Promise<UserIdentity | null> {
    if (this.invalidationTombstones.has(`sub:${sub}`)) {
      return null; // Force DB check
    }

    if (!this.client || !this.isConnected) {
      this.metrics.misses++;
      return null;
    }

    try {
      const data = await this.client.get(`user:sub:${sub}`);
      if (!data) {
        this.metrics.misses++;
        return null;
      }
      this.metrics.hits++;
      return JSON.parse(data) as UserIdentity;
    } catch {
      this.metrics.misses++;
      return null;
    }
  }

  /**
   * Invalidate cached identity immediately upon status mutation.
   * If Redis eviction fails, emits failure metrics and records an in-memory tombstone
   * ensuring authorization falls back to PostgreSQL.
   */
  public async invalidateUser(userId: string, supabaseAuthId: string): Promise<boolean> {
    // Record in-memory tombstone as defense-in-depth
    this.invalidationTombstones.add(`sub:${supabaseAuthId}`);
    this.invalidationTombstones.add(`id:${userId}`);

    if (!this.client || !this.isConnected) {
      this.metrics.invalidationFailures++;
      return false;
    }

    try {
      await this.client.del(`user:sub:${supabaseAuthId}`, `user:id:${userId}`);
      return true;
    } catch (err) {
      this.metrics.invalidationFailures++;
      return false;
    }
  }

  /**
   * Test helper to simulate Redis failure.
   */
  public simulateFailure(shouldFail: boolean): void {
    if (shouldFail) {
      this.isConnected = false;
    } else {
      this.isConnected = true;
    }
  }
}

export const redisCache = new RedisCacheService();
