import pino, { type Logger } from 'pino';
import { PrismaClient, Prisma } from '@creatorconnect/database';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  LegalHoldReason,
  LegalHoldStatus,
  UserLegalHoldAppliedV1Payload,
  UserLegalHoldReleasedV1Payload,
} from '@creatorconnect/contracts';
import {
  LegalHoldActiveError,
  LegalHoldNotFoundError,
  NotFoundError,
  ConflictError,
} from '../../errors/app-error.js';
import { loggerConfig } from '../../plugins/logger.js';

const logger: Logger = pino(loggerConfig);

export interface LegalHoldRecord {
  id: string;
  userId: string;
  reason: LegalHoldReason;
  caseReference: string;
  status: LegalHoldStatus;
  notes: string;
  releaseNotes?: string | null;
  appliedById: string;
  releasedById?: string | null;
  appliedAt: Date;
  releasedAt?: Date | null;
}

export interface CreateHoldParams {
  userId: string;
  reason: LegalHoldReason;
  caseReference: string;
  notes: string;
  appliedById: string;
}

export interface ReleaseHoldParams {
  holdId: string;
  releasedById: string;
  releaseNotes: string;
  expectedUserId?: string;
}

/**
 * Repository interface for Legal Hold persistence.
 * Allows seamless swap between AuditLog-backed storage in current schema (0013)
 * and dedicated legal_holds table when Migration 0014 is approved in Phase 3B.9.
 */
export interface ILegalHoldRepository {
  applyHold(tx: Prisma.TransactionClient, data: LegalHoldRecord): Promise<LegalHoldRecord>;
  releaseHold(
    tx: Prisma.TransactionClient,
    holdId: string,
    releaseNotes: string,
    releasedById: string,
    releasedAt: Date,
  ): Promise<LegalHoldRecord>;
  getActiveHoldsByUserId(tx: Prisma.TransactionClient, userId: string): Promise<LegalHoldRecord[]>;
  getHoldById(tx: Prisma.TransactionClient, holdId: string): Promise<LegalHoldRecord | null>;
}

/**
 * Schema-compatible Legal Hold Repository leveraging the existing AuditLog table.
 * Fully preserves parent-row locking and transaction atomicity without requiring unapproved Migration 0014.
 */
export class AuditLogLegalHoldRepository implements ILegalHoldRepository {
  public async applyHold(
    tx: Prisma.TransactionClient,
    data: LegalHoldRecord,
  ): Promise<LegalHoldRecord> {
    await tx.auditLog.create({
      data: {
        id: data.id,
        userId: data.appliedById,
        action: 'LEGAL_HOLD_APPLIED',
        entity: 'User',
        entityId: data.userId,
        metadata: {
          holdId: data.id,
          userId: data.userId,
          reason: data.reason,
          caseReference: data.caseReference,
          status: 'ACTIVE',
          notes: data.notes,
          appliedById: data.appliedById,
          appliedAt: data.appliedAt.toISOString(),
        },
      },
    });

    return data;
  }

  public async releaseHold(
    tx: Prisma.TransactionClient,
    holdId: string,
    releaseNotes: string,
    releasedById: string,
    releasedAt: Date,
  ): Promise<LegalHoldRecord> {
    const existing = await this.getHoldById(tx, holdId);
    if (!existing) {
      throw new LegalHoldNotFoundError(`Legal hold ${holdId} was not found.`);
    }

    if (existing.status === 'RELEASED') {
      throw new ConflictError(`Legal hold ${holdId} is already released.`);
    }

    const updatedRecord: LegalHoldRecord = {
      ...existing,
      status: 'RELEASED',
      releaseNotes,
      releasedById,
      releasedAt,
    };

    // Record release in audit log
    await tx.auditLog.create({
      data: {
        id: generateUuidV7(),
        userId: releasedById,
        action: 'LEGAL_HOLD_RELEASED',
        entity: 'User',
        entityId: existing.userId,
        metadata: {
          holdId: existing.id,
          userId: existing.userId,
          caseReference: existing.caseReference,
          status: 'RELEASED',
          releaseNotes,
          releasedById,
          releasedAt: releasedAt.toISOString(),
        },
      },
    });

    return updatedRecord;
  }

  public async getActiveHoldsByUserId(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<LegalHoldRecord[]> {
    const logs = await tx.auditLog.findMany({
      where: {
        entity: 'User',
        entityId: userId,
        action: { in: ['LEGAL_HOLD_APPLIED', 'LEGAL_HOLD_RELEASED'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    const holdMap = new Map<string, LegalHoldRecord>();
    for (const log of logs) {
      const meta = log.metadata as any;
      if (!meta || !meta.holdId) continue;

      if (log.action === 'LEGAL_HOLD_APPLIED') {
        holdMap.set(meta.holdId, {
          id: meta.holdId,
          userId: meta.userId,
          reason: meta.reason,
          caseReference: meta.caseReference,
          status: 'ACTIVE',
          notes: meta.notes,
          appliedById: meta.appliedById,
          appliedAt: new Date(meta.appliedAt || log.createdAt),
        });
      } else if (log.action === 'LEGAL_HOLD_RELEASED') {
        const existing = holdMap.get(meta.holdId);
        if (existing) {
          existing.status = 'RELEASED';
          existing.releaseNotes = meta.releaseNotes;
          existing.releasedById = meta.releasedById;
          existing.releasedAt = new Date(meta.releasedAt || log.createdAt);
        }
      }
    }

    return Array.from(holdMap.values()).filter((h) => h.status === 'ACTIVE');
  }

  public async getHoldById(
    tx: Prisma.TransactionClient,
    holdId: string,
  ): Promise<LegalHoldRecord | null> {
    // 1. Direct O(1) indexed lookup on primary key id
    const applyLog = await tx.auditLog.findUnique({
      where: { id: holdId },
    });

    if (applyLog && applyLog.action === 'LEGAL_HOLD_APPLIED') {
      const meta = applyLog.metadata as any;
      if (!meta) return null;

      const currentHold: LegalHoldRecord = {
        id: meta.holdId || applyLog.id,
        userId: meta.userId || applyLog.entityId,
        reason: meta.reason,
        caseReference: meta.caseReference,
        status: 'ACTIVE',
        notes: meta.notes,
        appliedById: meta.appliedById || applyLog.userId || 'system',
        appliedAt: new Date(meta.appliedAt || applyLog.createdAt),
      };

      // Check for corresponding release entry
      const releaseLogs = await tx.auditLog.findMany({
        where: {
          entity: 'User',
          entityId: currentHold.userId,
          action: 'LEGAL_HOLD_RELEASED',
        },
        orderBy: { createdAt: 'desc' },
      });

      for (const rLog of releaseLogs) {
        const rMeta = rLog.metadata as any;
        if (rMeta && rMeta.holdId === holdId) {
          currentHold.status = 'RELEASED';
          currentHold.releaseNotes = rMeta.releaseNotes;
          currentHold.releasedById = rMeta.releasedById;
          currentHold.releasedAt = new Date(rMeta.releasedAt || rLog.createdAt);
          break;
        }
      }

      return currentHold;
    }

    // Fallback: If holdId was in metadata but id differed
    const logs = await tx.auditLog.findMany({
      where: {
        action: { in: ['LEGAL_HOLD_APPLIED', 'LEGAL_HOLD_RELEASED'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    let currentHold: LegalHoldRecord | null = null;
    for (const log of logs) {
      const meta = log.metadata as any;
      if (meta && meta.holdId === holdId) {
        if (log.action === 'LEGAL_HOLD_APPLIED') {
          currentHold = {
            id: meta.holdId,
            userId: meta.userId,
            reason: meta.reason,
            caseReference: meta.caseReference,
            status: 'ACTIVE',
            notes: meta.notes,
            appliedById: meta.appliedById,
            appliedAt: new Date(meta.appliedAt || log.createdAt),
          };
        } else if (log.action === 'LEGAL_HOLD_RELEASED' && currentHold) {
          currentHold.status = 'RELEASED';
          currentHold.releaseNotes = meta.releaseNotes;
          currentHold.releasedById = meta.releasedById;
          currentHold.releasedAt = new Date(meta.releasedAt || log.createdAt);
        }
      }
    }

    return currentHold;
  }
}

export class LegalHoldService {
  private prisma: PrismaClient;
  private holdRepo: ILegalHoldRepository;

  constructor(prismaClient?: PrismaClient, holdRepo?: ILegalHoldRepository) {
    this.prisma = prismaClient || getPrismaClient();
    this.holdRepo = holdRepo || new AuditLogLegalHoldRepository();
  }

  /**
   * Applies a legal hold using the mandatory PARENT-ROW LOCKING protocol.
   * Lock order: users -> legal_holds
   */
  public async applyHold(params: CreateHoldParams): Promise<LegalHoldRecord> {
    const { userId, reason, caseReference, notes, appliedById } = params;

    return await this.prisma.$transaction(async (tx) => {
      // Step 1: Mandatory parent-row exclusive lock on the User record
      const users = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status FROM users WHERE id = ${userId}::uuid FOR UPDATE
      `;

      if (!users || users.length === 0) {
        throw new NotFoundError(`User with ID ${userId} was not found.`);
      }

      // Step 2: Check for existing active hold with duplicate caseReference
      const activeHolds = await this.holdRepo.getActiveHoldsByUserId(tx, userId);
      const duplicate = activeHolds.find((h) => h.caseReference === caseReference);
      if (duplicate) {
        throw new ConflictError(
          `An active legal hold already exists for user ${userId} with case reference "${caseReference}".`,
        );
      }

      // Step 3: Insert legal hold
      const holdId = generateUuidV7();
      const holdRecord: LegalHoldRecord = {
        id: holdId,
        userId,
        reason,
        caseReference,
        status: 'ACTIVE',
        notes,
        appliedById,
        appliedAt: new Date(),
      };

      const applied = await this.holdRepo.applyHold(tx, holdRecord);

      // Step 4: Publish transactional outbox event
      const payload: UserLegalHoldAppliedV1Payload = {
        holdId,
        userId,
        reason,
        caseReference,
        appliedById,
        appliedAt: holdRecord.appliedAt.toISOString(),
      };

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'user.legal_hold.applied.v1',
          aggregateType: 'User',
          aggregateId: userId,
          payload: payload as any,
          status: 'PENDING',
        },
      });

      logger.info(
        {
          event: 'LEGAL_HOLD_APPLIED',
          holdId,
          userId,
          reason,
          caseReference,
        },
        'Legal hold applied under exclusive parent-row lock.',
      );

      return applied;
    });
  }

  /**
   * Releases an active legal hold under parent-row locking.
   */
  public async releaseHold(params: ReleaseHoldParams): Promise<LegalHoldRecord> {
    const { holdId, releasedById, releaseNotes, expectedUserId } = params;

    return await this.prisma.$transaction(async (tx) => {
      // Find the hold first to determine the target userId
      const existing = await this.holdRepo.getHoldById(tx, holdId);
      if (!existing || (expectedUserId && existing.userId !== expectedUserId)) {
        throw new LegalHoldNotFoundError(`Legal hold with ID ${holdId} was not found.`);
      }

      // Step 1: Mandatory parent-row lock
      await tx.$queryRaw`
        SELECT id FROM users WHERE id = ${existing.userId}::uuid FOR UPDATE
      `;

      // Step 2: Release hold
      const releasedAt = new Date();
      const released = await this.holdRepo.releaseHold(
        tx,
        holdId,
        releaseNotes,
        releasedById,
        releasedAt,
      );

      // Step 3: Outbox notification
      const payload: UserLegalHoldReleasedV1Payload = {
        holdId,
        userId: existing.userId,
        releasedById,
        releasedAt: releasedAt.toISOString(),
        releaseNotes,
      };

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'user.legal_hold.released.v1',
          aggregateType: 'User',
          aggregateId: existing.userId,
          payload: payload as any,
          status: 'PENDING',
        },
      });

      logger.info(
        {
          event: 'LEGAL_HOLD_RELEASED',
          holdId,
          userId: existing.userId,
        },
        'Legal hold released under exclusive parent-row lock.',
      );

      return released;
    });
  }

  /**
   * Asserts that no active legal holds exist for a user.
   * MUST be executed within an active transaction where the User row is ALREADY locked!
   */
  public async assertNoActiveHolds(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const activeHolds = await this.holdRepo.getActiveHoldsByUserId(tx, userId);
    if (activeHolds.length > 0) {
      const first = activeHolds[0];
      throw new LegalHoldActiveError(
        `User ${userId} has ${activeHolds.length} active legal hold(s) (Reason: ${first ? first.reason : 'HOLD'}, Case: ${first ? first.caseReference : 'N/A'}). Erasure is blocked.`,
      );
    }
  }

  /**
   * Lists active legal holds for a user.
   */
  public async getActiveHolds(userId: string): Promise<LegalHoldRecord[]> {
    return await this.prisma.$transaction(async (tx) => {
      return await this.holdRepo.getActiveHoldsByUserId(tx, userId);
    });
  }
}

export const legalHoldService = new LegalHoldService();
