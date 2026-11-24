import crypto from 'node:crypto';
import pino, { type Logger } from 'pino';
import { PrismaClient, Prisma } from '@creatorconnect/database';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  PrivacyRequestType,
  PrivacyRequestStatus,
  ErasureWorkflowStage,
  UserErasureRequestedV1Payload,
  UserErasureConfirmedV1Payload,
} from '@creatorconnect/contracts';
import {
  PrivacyRequestNotFoundError,
  PrivacyRequestInvalidStateError,
  PrivacyConfirmationCodeInvalidError,
  NotFoundError,
  ConflictError,
} from '../../errors/app-error.js';
import { LegalHoldService } from './legal-hold.service.js';
import { loggerConfig } from '../../plugins/logger.js';

const logger: Logger = pino(loggerConfig);

export interface PrivacyRequestRecord {
  id: string;
  userId: string;
  requestType: PrivacyRequestType;
  status: PrivacyRequestStatus;
  currentStage: ErasureWorkflowStage;
  confirmationCodeHash?: string | null;
  confirmedAt?: Date | null;
  coolingOffEndsAt?: Date | null;
  scheduledPurgeAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
  rejectionReason?: string | null;
  certificateTokenHash?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPrivacyRequestRepository {
  createRequest(
    tx: Prisma.TransactionClient,
    data: PrivacyRequestRecord,
  ): Promise<PrivacyRequestRecord>;
  updateRequest(
    tx: Prisma.TransactionClient,
    requestId: string,
    updates: Partial<PrivacyRequestRecord>,
  ): Promise<PrivacyRequestRecord>;
  findActiveByUserId(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<PrivacyRequestRecord | null>;
  findById(tx: Prisma.TransactionClient, requestId: string): Promise<PrivacyRequestRecord | null>;
}

export class AuditLogPrivacyRequestRepository implements IPrivacyRequestRepository {
  public async createRequest(
    tx: Prisma.TransactionClient,
    data: PrivacyRequestRecord,
  ): Promise<PrivacyRequestRecord> {
    await tx.auditLog.create({
      data: {
        id: data.id,
        userId: data.userId,
        action: 'PRIVACY_REQUEST_CREATED',
        entity: 'PrivacyRequest',
        entityId: data.id,
        metadata: {
          ...data,
          confirmedAt: data.confirmedAt?.toISOString() || null,
          coolingOffEndsAt: data.coolingOffEndsAt?.toISOString() || null,
          scheduledPurgeAt: data.scheduledPurgeAt?.toISOString() || null,
          completedAt: data.completedAt?.toISOString() || null,
          createdAt: data.createdAt.toISOString(),
          updatedAt: data.updatedAt.toISOString(),
        },
      },
    });
    return data;
  }

  public async updateRequest(
    tx: Prisma.TransactionClient,
    requestId: string,
    updates: Partial<PrivacyRequestRecord>,
  ): Promise<PrivacyRequestRecord> {
    const existing = await this.findById(tx, requestId);
    if (!existing) {
      throw new PrivacyRequestNotFoundError(`Privacy request ${requestId} was not found.`);
    }

    const updated: PrivacyRequestRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    await tx.auditLog.create({
      data: {
        id: generateUuidV7(),
        userId: existing.userId,
        action: 'PRIVACY_REQUEST_UPDATED',
        entity: 'PrivacyRequest',
        entityId: requestId,
        metadata: {
          ...updated,
          confirmedAt: updated.confirmedAt?.toISOString() || null,
          coolingOffEndsAt: updated.coolingOffEndsAt?.toISOString() || null,
          scheduledPurgeAt: updated.scheduledPurgeAt?.toISOString() || null,
          completedAt: updated.completedAt?.toISOString() || null,
          cancelledAt: updated.cancelledAt?.toISOString() || null,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      },
    });

    return updated;
  }

  public async findActiveByUserId(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<PrivacyRequestRecord | null> {
    const logs = await tx.auditLog.findMany({
      where: {
        entity: 'PrivacyRequest',
        action: { in: ['PRIVACY_REQUEST_CREATED', 'PRIVACY_REQUEST_UPDATED'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    const requests = new Map<string, PrivacyRequestRecord>();
    for (const log of logs) {
      const meta = log.metadata as any;
      if (!meta || meta.userId !== userId) continue;

      requests.set(meta.id, {
        id: meta.id,
        userId: meta.userId,
        requestType: meta.requestType,
        status: meta.status,
        currentStage: meta.currentStage || 'DATABASE_PSEUDONYMIZATION_PENDING',
        confirmationCodeHash: meta.confirmationCodeHash,
        confirmedAt: meta.confirmedAt ? new Date(meta.confirmedAt) : null,
        coolingOffEndsAt: meta.coolingOffEndsAt ? new Date(meta.coolingOffEndsAt) : null,
        scheduledPurgeAt: meta.scheduledPurgeAt ? new Date(meta.scheduledPurgeAt) : null,
        completedAt: meta.completedAt ? new Date(meta.completedAt) : null,
        cancelledAt: meta.cancelledAt ? new Date(meta.cancelledAt) : null,
        rejectionReason: meta.rejectionReason,
        certificateTokenHash: meta.certificateTokenHash,
        metadata: meta.metadata || null,
        createdAt: new Date(meta.createdAt || log.createdAt),
        updatedAt: new Date(meta.updatedAt || log.createdAt),
      });
    }

    const activeList = Array.from(requests.values()).filter(
      (r) => r.status !== 'COMPLETED' && r.status !== 'CANCELLED',
    );
    const last = activeList[activeList.length - 1];
    return last ?? null;
  }

  public async findById(
    tx: Prisma.TransactionClient,
    requestId: string,
  ): Promise<PrivacyRequestRecord | null> {
    const logs = await tx.auditLog.findMany({
      where: {
        entity: 'PrivacyRequest',
        entityId: requestId,
        action: { in: ['PRIVACY_REQUEST_CREATED', 'PRIVACY_REQUEST_UPDATED'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (logs.length === 0) return null;

    let current: PrivacyRequestRecord | null = null;
    for (const log of logs) {
      const meta = log.metadata as any;
      if (!meta) continue;
      current = {
        id: meta.id,
        userId: meta.userId,
        requestType: meta.requestType,
        status: meta.status,
        currentStage: meta.currentStage || 'DATABASE_PSEUDONYMIZATION_PENDING',
        confirmationCodeHash: meta.confirmationCodeHash,
        confirmedAt: meta.confirmedAt ? new Date(meta.confirmedAt) : null,
        coolingOffEndsAt: meta.coolingOffEndsAt ? new Date(meta.coolingOffEndsAt) : null,
        scheduledPurgeAt: meta.scheduledPurgeAt ? new Date(meta.scheduledPurgeAt) : null,
        completedAt: meta.completedAt ? new Date(meta.completedAt) : null,
        cancelledAt: meta.cancelledAt ? new Date(meta.cancelledAt) : null,
        rejectionReason: meta.rejectionReason,
        certificateTokenHash: meta.certificateTokenHash,
        metadata: meta.metadata || null,
        createdAt: new Date(meta.createdAt || log.createdAt),
        updatedAt: new Date(meta.updatedAt || log.createdAt),
      };
    }

    return current;
  }
}

export class PrivacyRequestService {
  private prisma: PrismaClient;
  private privacyRepo: IPrivacyRequestRepository;
  private holdService: LegalHoldService;

  constructor(
    prismaClient?: PrismaClient,
    privacyRepo?: IPrivacyRequestRepository,
    holdSvc?: LegalHoldService,
  ) {
    this.prisma = prismaClient || getPrismaClient();
    this.privacyRepo = privacyRepo || new AuditLogPrivacyRequestRepository();
    this.holdService = holdSvc || new LegalHoldService(this.prisma);
  }

  /**
   * Hashes a confirmation code using SHA-256 for safe storage.
   */
  public hashCode(code: string): string {
    return crypto.createHash('sha256').update(code.trim()).digest('hex');
  }

  /**
   * Constant-time comparison for confirmation code verification.
   */
  public verifyCode(code: string, storedHash: string): boolean {
    const computedHash = this.hashCode(code);
    const codeBuf = Buffer.from(computedHash, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (codeBuf.length !== storedBuf.length) return false;
    return crypto.timingSafeEqual(codeBuf, storedBuf);
  }

  /**
   * Initiates an account erasure request under parent-row locking.
   * Rechecks legal holds atomically before scheduling.
   */
  public async requestErasure(
    userId: string,
    coolingOffDays = 30,
  ): Promise<{ request: PrivacyRequestRecord; rawConfirmationCode: string }> {
    return await this.prisma.$transaction(async (tx) => {
      // Step 1: Parent-row exclusive lock on target User
      const users = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT id, status FROM users WHERE id = ${userId}::uuid FOR UPDATE
      `;
      if (!users || users.length === 0) {
        throw new NotFoundError(`User with ID ${userId} was not found.`);
      }

      // Step 2: Atomic Legal Hold check under parent lock
      await this.holdService.assertNoActiveHolds(tx, userId);

      // Step 3: Prevent duplicate active requests
      const existing = await this.privacyRepo.findActiveByUserId(tx, userId);
      if (existing) {
        throw new ConflictError(
          `An active erasure request (${existing.id}) is already in progress with status: ${existing.status}.`,
        );
      }

      // Step 4: Generate 256-bit CSPRNG confirmation code
      const rawConfirmationCode = crypto.randomBytes(32).toString('hex');
      const confirmationCodeHash = this.hashCode(rawConfirmationCode);

      const requestId = generateUuidV7();
      const now = new Date();
      const coolingOffEndsAt = new Date(now.getTime() + coolingOffDays * 24 * 60 * 60 * 1000);

      const record: PrivacyRequestRecord = {
        id: requestId,
        userId,
        requestType: 'ACCOUNT_DELETION',
        status: 'PENDING_CONFIRMATION',
        currentStage: 'DATABASE_PSEUDONYMIZATION_PENDING',
        confirmationCodeHash,
        coolingOffEndsAt,
        createdAt: now,
        updatedAt: now,
      };

      const created = await this.privacyRepo.createRequest(tx, record);

      // Step 5: Publish Outbox Event
      const outboxPayload: UserErasureRequestedV1Payload = {
        requestId,
        userId,
        requestType: 'ACCOUNT_DELETION',
        coolingOffEndsAt: coolingOffEndsAt.toISOString(),
        timestamp: now.toISOString(),
      };

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'user.erasure.requested.v1',
          aggregateType: 'PrivacyRequest',
          aggregateId: requestId,
          payload: outboxPayload as any,
          status: 'PENDING',
        },
      });

      logger.info(
        {
          event: 'ERASURE_REQUESTED',
          requestId,
          userId,
          coolingOffEndsAt: coolingOffEndsAt.toISOString(),
        },
        'Right to erasure request initiated under parent-row lock.',
      );

      return { request: created, rawConfirmationCode };
    });
  }

  /**
   * Confirms an erasure request using the confirmation code.
   */
  public async confirmErasure(
    userId: string,
    confirmationCode: string,
  ): Promise<PrivacyRequestRecord> {
    return await this.prisma.$transaction(async (tx) => {
      // Step 1: Parent-row exclusive lock
      await tx.$queryRaw`
        SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE
      `;

      // Step 2: Recheck legal holds
      await this.holdService.assertNoActiveHolds(tx, userId);

      // Step 3: Find active request
      const active = await this.privacyRepo.findActiveByUserId(tx, userId);
      if (!active) {
        throw new PrivacyRequestNotFoundError(
          `No active erasure request found for user ${userId}.`,
        );
      }

      if (active.status !== 'PENDING_CONFIRMATION') {
        throw new PrivacyRequestInvalidStateError(
          `Erasure request is in state ${active.status}; cannot confirm.`,
        );
      }

      // Step 4: Validate confirmation code via constant-time verification
      if (
        !active.confirmationCodeHash ||
        !this.verifyCode(confirmationCode, active.confirmationCodeHash)
      ) {
        throw new PrivacyConfirmationCodeInvalidError('Invalid or expired confirmation code.');
      }

      const confirmedAt = new Date();
      const updated = await this.privacyRepo.updateRequest(tx, active.id, {
        status: 'COOLING_OFF',
        confirmedAt,
      });

      // Step 5: Transactional outbox confirmation event
      const payload: UserErasureConfirmedV1Payload = {
        requestId: active.id,
        userId,
        confirmedAt: confirmedAt.toISOString(),
      };

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'user.erasure.confirmed.v1',
          aggregateType: 'PrivacyRequest',
          aggregateId: active.id,
          payload: payload as any,
          status: 'PENDING',
        },
      });

      logger.info(
        {
          event: 'ERASURE_CONFIRMED',
          requestId: active.id,
          userId,
        },
        'Right to erasure confirmed. Entered cooling-off window.',
      );

      return updated;
    });
  }

  /**
   * Cancels an erasure request within the cooling-off period.
   */
  public async cancelErasure(userId: string, reason: string): Promise<PrivacyRequestRecord> {
    return await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE
      `;

      const active = await this.privacyRepo.findActiveByUserId(tx, userId);
      if (!active) {
        throw new PrivacyRequestNotFoundError(
          `No active erasure request found for user ${userId}.`,
        );
      }

      if (active.status !== 'PENDING_CONFIRMATION' && active.status !== 'COOLING_OFF') {
        throw new PrivacyRequestInvalidStateError(
          `Erasure request in status ${active.status} cannot be cancelled.`,
        );
      }

      const cancelled = await this.privacyRepo.updateRequest(tx, active.id, {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        rejectionReason: reason,
      });

      logger.info(
        {
          event: 'ERASURE_CANCELLED',
          requestId: active.id,
          userId,
          reason,
        },
        'Erasure request cancelled by user during cooling-off.',
      );

      return cancelled;
    });
  }

  /**
   * Gets current privacy request status for a user.
   */
  public async getStatus(userId: string): Promise<PrivacyRequestRecord | null> {
    return await this.prisma.$transaction(async (tx) => {
      return await this.privacyRepo.findActiveByUserId(tx, userId);
    });
  }
}

export const privacyRequestService = new PrivacyRequestService();
