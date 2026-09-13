import pino from 'pino';
import type { UpdateProfileRequest, UserResponse } from '@creatorconnect/contracts';
import { UserStatus } from '@creatorconnect/database';
import { IUserRepository, userRepository } from '../../repositories/user.repository.js';
import { redisCache, RedisCacheService } from '../../services/redis-cache.js';
import { IdentityNotSyncedError } from '../../errors/app-error.js';
import { loggerConfig } from '../../plugins/logger.js';

/**
 * Module-level structured logger for UsersService.
 * Reuses the application-wide Pino configuration (redaction rules, log level).
 */
const logger = pino(loggerConfig);

export class UsersService {
  private userRepo: IUserRepository;
  private cache: RedisCacheService;

  constructor(repo?: IUserRepository, cacheSvc?: RedisCacheService) {
    this.userRepo = repo || userRepository;
    this.cache = cacheSvc || redisCache;
  }

  public async getProfile(userId: string): Promise<UserResponse> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new IdentityNotSyncedError('User profile not found.');
    }

    return {
      id: user.id,
      supabaseAuthId: user.supabaseAuthId,
      email: user.email,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      avatarUrl: null,
      status: user.status,
      roles: user.roles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  public async updateProfile(userId: string, input: UpdateProfileRequest): Promise<UserResponse> {
    const updateData: { firstName?: string; lastName?: string; avatarUrl?: string } = {};
    if (input.firstName !== undefined) updateData.firstName = input.firstName;
    if (input.lastName !== undefined) updateData.lastName = input.lastName;
    if (input.avatarUrl !== undefined) updateData.avatarUrl = input.avatarUrl;

    const updated = await this.userRepo.updateProfile(userId, updateData);

    // Invalidate cached identity to keep profile up to date
    await this.cache.invalidateUser(userId, updated.supabaseAuthId);

    return {
      id: updated.id,
      supabaseAuthId: updated.supabaseAuthId,
      email: updated.email,
      firstName: updated.firstName ?? null,
      lastName: updated.lastName ?? null,
      avatarUrl: input.avatarUrl || null,
      status: updated.status,
      roles: updated.roles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Concurrency-safe status update enforcing the last active admin invariant.
   * Transactionally executes row locking in PostgreSQL, then invalidates Redis post-commit.
   */
  public async updateUserStatus(
    targetUserId: string,
    newStatus: UserStatus,
    adminUserId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserResponse> {
    const updated = await this.userRepo.updateStatus(
      targetUserId,
      newStatus,
      adminUserId,
      ipAddress,
      userAgent,
    );

    // Immediate post-commit Redis invalidation
    const evicted = await this.cache.invalidateUser(targetUserId, updated.supabaseAuthId);
    if (!evicted) {
      // Invalidation failure is recorded in metrics and local tombstones.
      // PostgreSQL remains the sole authorization authority — stale Redis state cannot grant access.
      logger.warn(
        {
          event: 'CACHE_INVALIDATION_FAILED',
          metric: 'auth_cache_invalidation_failure_total',
          userId: targetUserId,
          note: 'Redis eviction failed post status-mutation. DB remains authoritative.',
        },
        'Cache invalidation failure: PostgreSQL remains authoritative for account status.',
      );
    }

    return {
      id: updated.id,
      supabaseAuthId: updated.supabaseAuthId,
      email: updated.email,
      firstName: updated.firstName ?? null,
      lastName: updated.lastName ?? null,
      avatarUrl: null,
      status: updated.status,
      roles: updated.roles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

export const usersService = new UsersService();
