import pino, { type Logger } from 'pino';
import { PrismaClient, UserStatus, RoleType } from '@creatorconnect/database';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type { UserIdentity } from '@creatorconnect/auth';
import type {
  AccountLifecycleState,
  UserLifecycleTransitionedV1Payload,
} from '@creatorconnect/contracts';
import {
  LastAdminLockoutError,
  InvalidLifecycleTransitionError,
  ForbiddenError,
  NotFoundError,
  AccountAlreadyDeletedError,
} from '../../errors/app-error.js';
import { redisCache, RedisCacheService } from '../../services/redis-cache.js';
import { loggerConfig } from '../../plugins/logger.js';

const logger: Logger = pino(loggerConfig);

/**
 * Valid transitions table:
 * Map of current status -> allowed next statuses
 */
const ALLOWED_TRANSITIONS: Record<UserStatus, UserStatus[]> = {
  [UserStatus.ACTIVE]: [UserStatus.SUSPENDED, UserStatus.DEACTIVATED],
  [UserStatus.SUSPENDED]: [UserStatus.ACTIVE],
  [UserStatus.DEACTIVATED]: [UserStatus.ACTIVE],
};

export interface LifecycleTransitionOptions {
  targetUserId: string;
  newStatus: UserStatus;
  actorUserId: string;
  actorRoles: RoleType[];
  reason: string;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export class AccountLifecycleService {
  private prisma: PrismaClient;
  private cache: RedisCacheService;

  constructor(prismaClient?: PrismaClient, cacheSvc?: RedisCacheService) {
    this.prisma = prismaClient || getPrismaClient();
    this.cache = cacheSvc || redisCache;
  }

  /**
   * Validates whether a state transition is permitted according to formal lifecycle rules.
   */
  public isValidTransition(currentStatus: UserStatus, newStatus: UserStatus): boolean {
    if (currentStatus === newStatus) return false;
    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    return allowed ? allowed.includes(newStatus) : false;
  }

  /**
   * Concurrency-safe, transactionally locked state transition.
   * Acquires row-level lock on the User record to serialize concurrent lifecycle changes.
   */
  public async transitionStatus(options: LifecycleTransitionOptions): Promise<{
    user: UserIdentity;
    previousStatus: UserStatus;
    newStatus: UserStatus;
  }> {
    const { targetUserId, newStatus, actorUserId, actorRoles, reason, ipAddress, userAgent } =
      options;

    const isAdmin = actorRoles.includes('ADMIN');
    const isSelf = targetUserId === actorUserId;

    // Authorization checks
    if (!isAdmin && !isSelf) {
      throw new ForbiddenError('You are not authorized to modify another user account status.');
    }

    if (!isAdmin && isSelf) {
      // Non-admins can only transition:
      // ACTIVE -> DEACTIVATED (self-deactivate)
      // DEACTIVATED -> ACTIVE (self-reactivate)
      if (newStatus === UserStatus.SUSPENDED) {
        throw new ForbiddenError('Users cannot self-suspend their account.');
      }
    }

    return await this.prisma
      .$transaction(async (tx) => {
        // 1. Acquire exclusive row-level lock on the target user to eliminate race conditions
        const userRows = await tx.$queryRaw<
          Array<{
            id: string;
            status: UserStatus;
            supabase_auth_id: string;
            email: string;
            first_name: string | null;
            last_name: string | null;
          }>
        >`
        SELECT id, status, supabase_auth_id, email, first_name, last_name
        FROM users
        WHERE id = ${targetUserId}::uuid
        FOR UPDATE
      `;

        if (!userRows || userRows.length === 0) {
          throw new NotFoundError(`User with ID ${targetUserId} was not found.`);
        }

        const currentRecord = userRows[0];
        if (!currentRecord) {
          throw new NotFoundError(`User with ID ${targetUserId} was not found.`);
        }
        const previousStatus = currentRecord.status;

        // Prevent resurrecting permanently erased / pseudonymized accounts
        if (
          currentRecord.email.endsWith('@deleted.invalid') ||
          currentRecord.email.startsWith(`deleted-${targetUserId}`)
        ) {
          throw new AccountAlreadyDeletedError(
            `Account ${targetUserId} has completed Right to Erasure and cannot undergo lifecycle transitions.`,
          );
        }

        // 2. Validate lifecycle transition
        if (!this.isValidTransition(previousStatus, newStatus)) {
          throw new InvalidLifecycleTransitionError(
            `Cannot transition account from ${previousStatus} to ${newStatus}.`,
          );
        }

        // 3. Last admin lockout prevention
        if (newStatus !== UserStatus.ACTIVE) {
          const activeAdmins = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT u.id 
          FROM users u
          JOIN user_roles ur ON u.id = ur.user_id
          JOIN roles r ON ur.role_id = r.id
          WHERE r.name = 'ADMIN' AND u.status = 'ACTIVE'
          FOR UPDATE OF u
        `;

          const isTargetAnActiveAdmin = activeAdmins.some((a) => a.id === targetUserId);
          if (isTargetAnActiveAdmin && activeAdmins.length <= 1) {
            throw new LastAdminLockoutError();
          }
        }

        // 4. Update status in PostgreSQL (authoritative source of truth)
        const updated = await tx.user.update({
          where: { id: targetUserId },
          data: { status: newStatus },
          include: {
            userRoles: {
              include: { role: true },
            },
          },
        });

        // 5. Emit forensically complete AuditLog
        const auditLogId = generateUuidV7();
        await tx.auditLog.create({
          data: {
            id: auditLogId,
            userId: actorUserId,
            action: 'USER_LIFECYCLE_TRANSITIONED',
            entity: 'User',
            entityId: targetUserId,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            metadata: {
              previousStatus,
              newStatus,
              reason,
              actorUserId,
              targetUserId,
            },
          },
        });

        // 6. Publish Transactional Outbox Event
        const outboxPayload: UserLifecycleTransitionedV1Payload = {
          userId: targetUserId,
          previousStatus: previousStatus as AccountLifecycleState,
          newStatus: newStatus as AccountLifecycleState,
          transitionedById: actorUserId,
          reason,
          timestamp: new Date().toISOString(),
        };

        await tx.outboxEvent.create({
          data: {
            id: generateUuidV7(),
            eventType: 'user.lifecycle.transitioned.v1',
            aggregateType: 'User',
            aggregateId: targetUserId,
            payload: outboxPayload as any,
            status: 'PENDING',
          },
        });

        const updatedIdentity: UserIdentity = {
          id: updated.id,
          supabaseAuthId: updated.supabaseAuthId,
          email: updated.email,
          firstName: updated.firstName,
          lastName: updated.lastName,
          status: updated.status as UserStatus,
          roles: updated.userRoles.map((ur) => ur.role.name as RoleType),
        };

        return {
          user: updatedIdentity,
          previousStatus,
          newStatus,
        };
      })
      .then(async (result) => {
        // 7. Immediate post-commit Redis cache invalidation
        const evicted = await this.cache.invalidateUser(targetUserId, result.user.supabaseAuthId);
        if (!evicted) {
          logger.warn(
            {
              event: 'LIFECYCLE_CACHE_INVALIDATION_FAILED',
              metric: 'auth_cache_invalidation_failure_total',
              userId: targetUserId,
            },
            'Redis cache eviction failed post lifecycle transition. PostgreSQL remains authoritative.',
          );
        }

        return result;
      });
  }

  /**
   * Self-service account deactivation.
   */
  public async selfDeactivate(
    userId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserIdentity> {
    const result = await this.transitionStatus({
      targetUserId: userId,
      newStatus: UserStatus.DEACTIVATED,
      actorUserId: userId,
      actorRoles: ['CREATOR'], // standard role
      reason: reason || 'Self-service account deactivation requested by user.',
      ipAddress,
      userAgent,
    });
    return result.user;
  }

  /**
   * Self-service account reactivation.
   */
  public async selfReactivate(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserIdentity> {
    const result = await this.transitionStatus({
      targetUserId: userId,
      newStatus: UserStatus.ACTIVE,
      actorUserId: userId,
      actorRoles: ['CREATOR'],
      reason: 'Self-service account reactivation confirmed by user.',
      ipAddress,
      userAgent,
    });
    return result.user;
  }
}

export const accountLifecycleService = new AccountLifecycleService();
