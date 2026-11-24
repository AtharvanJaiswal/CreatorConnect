import pino, { type Logger } from 'pino';
import { PrismaClient, UserStatus } from '@creatorconnect/database';
import { getPrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type {
  ErasureWorkflowStage,
  PrivacyReceiptResponse,
  UserErasureStageCompletedV1Payload,
  UserErasureCompletedV1Payload,
} from '@creatorconnect/contracts';
import {
  LegalHoldActiveError,
  PrivacyRequestNotFoundError,
  PrivacyRequestInvalidStateError,
  NotFoundError,
} from '../../errors/app-error.js';
import { LegalHoldService } from './legal-hold.service.js';
import { PiiRedactionService, piiRedactionService } from './pii-redaction.service.js';
import {
  IExternalStoragePurgeService,
  externalStoragePurgeService,
} from './external-storage-purge.service.js';
import { ISupabaseAdminService, supabaseAdminService } from './supabase-admin.service.js';
import { PrivacyAuditService, privacyAuditService } from './privacy-audit.service.js';
import {
  IPrivacyRequestRepository,
  AuditLogPrivacyRequestRepository,
} from './privacy-request.service.js';
import { RedisCacheService, redisCache } from '../../services/redis-cache.js';
import { loggerConfig } from '../../plugins/logger.js';

const logger: Logger = pino(loggerConfig);

export interface ErasureExecutionResult {
  requestId: string;
  userId: string;
  status: 'COMPLETED' | 'REJECTED_LEGAL_HOLD';
  stagesCompleted: ErasureWorkflowStage[];
  recordsScrubbed: number;
  mediaFilesPurged: number;
  receipt?: PrivacyReceiptResponse;
  rejectionReason?: string;
}

export class DataErasureOrchestrator {
  private prisma: PrismaClient;
  private holdService: LegalHoldService;
  private redactionService: PiiRedactionService;
  private storagePurgeService: IExternalStoragePurgeService;
  private supabaseAdmin: ISupabaseAdminService;
  private auditService: PrivacyAuditService;
  private privacyRepo: IPrivacyRequestRepository;
  private cache: RedisCacheService;

  constructor(options?: {
    prismaClient?: PrismaClient;
    holdSvc?: LegalHoldService;
    redactionSvc?: PiiRedactionService;
    storagePurge?: IExternalStoragePurgeService;
    supabase?: ISupabaseAdminService;
    auditSvc?: PrivacyAuditService;
    privacyRepo?: IPrivacyRequestRepository;
    cacheSvc?: RedisCacheService;
  }) {
    this.prisma = options?.prismaClient || getPrismaClient();
    this.holdService = options?.holdSvc || new LegalHoldService(this.prisma);
    this.redactionService = options?.redactionSvc || piiRedactionService;
    this.storagePurgeService = options?.storagePurge || externalStoragePurgeService;
    this.supabaseAdmin = options?.supabase || supabaseAdminService;
    this.auditService = options?.auditSvc || privacyAuditService;
    this.privacyRepo = options?.privacyRepo || new AuditLogPrivacyRequestRepository();
    this.cache = options?.cacheSvc || redisCache;
  }

  /**
   * Executes the full multi-stage erasure workflow idempotently.
   * Atomic parent-row lock -> Hold verification -> DB Pseudonymization -> S3 Purge -> Supabase Purge -> Certificate.
   */
  public async executeErasure(requestId: string): Promise<ErasureExecutionResult> {
    const stagesCompleted: ErasureWorkflowStage[] = [];

    // Step A: Load the privacy request
    const request = await this.prisma.$transaction(async (tx) => {
      return await this.privacyRepo.findById(tx, requestId);
    });

    if (!request) {
      throw new PrivacyRequestNotFoundError(`Privacy request ${requestId} was not found.`);
    }

    if (request.status === 'COMPLETED') {
      logger.info({ requestId }, 'Erasure request is already completed (idempotent no-op).');
      return {
        requestId,
        userId: request.userId,
        status: 'COMPLETED',
        stagesCompleted: ['ERASURE_COMPLETED'],
        recordsScrubbed: 0,
        mediaFilesPurged: 0,
      };
    }

    if (request.status === 'CANCELLED') {
      throw new PrivacyRequestInvalidStateError(
        `Cannot execute erasure: privacy request ${requestId} was cancelled by user.`,
      );
    }

    if (request.status === 'PENDING_CONFIRMATION') {
      throw new PrivacyRequestInvalidStateError(
        `Cannot execute erasure: privacy request ${requestId} has not been confirmed with verification code.`,
      );
    }

    if (request.status === 'REJECTED_LEGAL_HOLD') {
      throw new LegalHoldActiveError(
        `Cannot execute erasure: privacy request ${requestId} is currently blocked by an active legal hold.`,
      );
    }

    const userId = request.userId;
    let supabaseAuthId = '';
    let recordsScrubbed = 0;

    // =========================================================================
    // Phase 1: Database Atomic Transaction (Parent Lock + Legal Hold + Redaction)
    // =========================================================================
    try {
      await this.prisma.$transaction(async (tx) => {
        // 1. Acquire exclusive lock on parent User row
        const users = await tx.$queryRaw<
          Array<{ id: string; email: string; supabase_auth_id: string; status: UserStatus }>
        >`
          SELECT id, email, supabase_auth_id, status FROM users WHERE id = ${userId}::uuid FOR UPDATE
        `;

        if (!users || users.length === 0) {
          throw new NotFoundError(`User ${userId} not found during erasure execution.`);
        }

        const userRow = users[0];
        if (!userRow) {
          throw new NotFoundError(`User ${userId} not found during erasure execution.`);
        }
        supabaseAuthId = userRow.supabase_auth_id;

        // 2. TOCTOU Legal Hold Check under lock
        const activeHolds = await this.holdService.getActiveHolds(userId);
        if (activeHolds.length > 0) {
          const firstHold = activeHolds[0];
          const reason = `Erasure blocked at execution time: ${activeHolds.length} active legal hold(s) present (${firstHold ? firstHold.reason : 'ACTIVE_HOLD'}).`;
          await this.privacyRepo.updateRequest(tx, requestId, {
            status: 'REJECTED_LEGAL_HOLD',
            rejectionReason: reason,
          });
          throw new LegalHoldActiveError(reason);
        }

        // 3. In-Place Database Pseudonymization (if not already pseudonymized)
        const expectedTombstone = this.redactionService.generateTombstoneEmail(userId);
        if (userRow.email !== expectedTombstone) {
          const redactResult = await this.redactionService.pseudonymizeUser(tx, userId);
          recordsScrubbed = redactResult.recordsScrubbed;
        }

        // 4. Update request stage
        await this.privacyRepo.updateRequest(tx, requestId, {
          status: 'PROCESSING',
          currentStage: 'DATABASE_PSEUDONYMIZATION_COMPLETED',
        });

        // 5. Publish Stage Completed Outbox Event
        const stagePayload: UserErasureStageCompletedV1Payload = {
          requestId,
          userId,
          stage: 'DATABASE_PSEUDONYMIZATION_COMPLETED',
          completedAt: new Date().toISOString(),
        };

        await tx.outboxEvent.create({
          data: {
            id: generateUuidV7(),
            eventType: 'user.erasure.stage_completed.v1',
            aggregateType: 'PrivacyRequest',
            aggregateId: requestId,
            payload: stagePayload as any,
            status: 'PENDING',
          },
        });
      });

      stagesCompleted.push('DATABASE_PSEUDONYMIZATION_COMPLETED');
    } catch (err: any) {
      if (err instanceof LegalHoldActiveError) {
        logger.warn(
          { requestId, userId, err: err.message },
          'Erasure rejected due to active legal hold.',
        );
        return {
          requestId,
          userId,
          status: 'REJECTED_LEGAL_HOLD',
          stagesCompleted,
          recordsScrubbed: 0,
          mediaFilesPurged: 0,
          rejectionReason: err.message,
        };
      }
      throw err;
    }

    // Immediate post-commit Redis cache invalidation
    if (supabaseAuthId) {
      await this.cache.invalidateUser(userId, supabaseAuthId);
    }

    // =========================================================================
    // Phase 2: External Storage (S3 / R2) Purge
    // =========================================================================
    let mediaFilesPurged = 0;
    try {
      const purgeResult = await this.storagePurgeService.purgeUserAssets(userId);
      mediaFilesPurged = purgeResult.purgedCount;
      stagesCompleted.push('MEDIA_PURGE_COMPLETED');

      await this.prisma.$transaction(async (tx) => {
        await this.privacyRepo.updateRequest(tx, requestId, {
          currentStage: 'MEDIA_PURGE_COMPLETED',
        });
      });
    } catch (storageErr: any) {
      logger.error(
        { requestId, userId, err: storageErr.message },
        'External storage purge failed; will retry.',
      );
      throw storageErr;
    }

    // =========================================================================
    // Phase 3: Supabase Auth Identity Purge
    // =========================================================================
    try {
      if (supabaseAuthId) {
        await this.supabaseAdmin.deleteUserIdentity(supabaseAuthId);
      }
      stagesCompleted.push('SUPABASE_IDENTITY_PURGE_COMPLETED');

      await this.prisma.$transaction(async (tx) => {
        await this.privacyRepo.updateRequest(tx, requestId, {
          currentStage: 'SUPABASE_IDENTITY_PURGE_COMPLETED',
        });
      });
    } catch (supaErr: any) {
      logger.error(
        { requestId, userId, err: supaErr.message },
        'Supabase identity deletion failed; will retry.',
      );
      throw supaErr;
    }

    // =========================================================================
    // Phase 4: Privacy Audit Certificate Issuance & Finalization
    // =========================================================================
    const finalResult = await this.prisma.$transaction(async (tx) => {
      // 1. Issue Privacy Audit Certificate
      const { receipt, rawToken } = await this.auditService.issueCertificate(tx, {
        requestId,
        userId,
        actionTaken: 'IN_PLACE_PSEUDONYMIZATION_AND_STORAGE_PURGE',
        recordsProcessed: recordsScrubbed,
        mediaFilesPurged,
      });

      const completedAt = new Date();
      const tokenHash = this.auditService.hashToken(rawToken);

      // 2. Mark Privacy Request COMPLETED
      await this.privacyRepo.updateRequest(tx, requestId, {
        status: 'COMPLETED',
        currentStage: 'ERASURE_COMPLETED',
        completedAt,
        certificateTokenHash: tokenHash,
      });

      // 3. Publish Erasure Completed Outbox Event
      const completedPayload: UserErasureCompletedV1Payload = {
        requestId,
        userId,
        certificateTokenHash: tokenHash,
        completedAt: completedAt.toISOString(),
      };

      await tx.outboxEvent.create({
        data: {
          id: generateUuidV7(),
          eventType: 'user.erasure.completed.v1',
          aggregateType: 'PrivacyRequest',
          aggregateId: requestId,
          payload: completedPayload as any,
          status: 'PENDING',
        },
      });

      stagesCompleted.push('ERASURE_COMPLETED');

      return { receipt };
    });

    logger.info(
      {
        event: 'ERASURE_WORKFLOW_COMPLETED',
        requestId,
        userId,
        recordsScrubbed,
        mediaFilesPurged,
      },
      'Right to erasure workflow finalized successfully across all stores.',
    );

    return {
      requestId,
      userId,
      status: 'COMPLETED',
      stagesCompleted,
      recordsScrubbed,
      mediaFilesPurged,
      receipt: finalResult.receipt,
    };
  }
}

export const dataErasureOrchestrator = new DataErasureOrchestrator();
