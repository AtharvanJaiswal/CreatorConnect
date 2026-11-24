import pino, { type Logger } from 'pino';
import { PrismaClient, UserStatus } from '@creatorconnect/database';
import { getPrismaClient } from '@creatorconnect/database';
import { PiiRedactionService, piiRedactionService } from './pii-redaction.service.js';
import {
  IExternalStoragePurgeService,
  externalStoragePurgeService,
} from './external-storage-purge.service.js';
import { RedisCacheService, redisCache } from '../../services/redis-cache.js';
import { loggerConfig } from '../../plugins/logger.js';

const logger: Logger = pino(loggerConfig);

export interface SanitizationReport {
  timestamp: string;
  usersEvaluated: number;
  resurrectedAccountsSanitized: number;
  mediaAssetsPurged: number;
  redisFlushed: boolean;
  operatorSignOffRequired: boolean;
  sanitizedUserIds: string[];
}

export class RestoreSanitizerService {
  private prisma: PrismaClient;
  private redactionService: PiiRedactionService;
  private storagePurgeService: IExternalStoragePurgeService;
  private cache: RedisCacheService;

  constructor(options?: {
    prismaClient?: PrismaClient;
    redactionSvc?: PiiRedactionService;
    storagePurge?: IExternalStoragePurgeService;
    cacheSvc?: RedisCacheService;
  }) {
    this.prisma = options?.prismaClient || getPrismaClient();
    this.redactionService = options?.redactionSvc || piiRedactionService;
    this.storagePurgeService = options?.storagePurge || externalStoragePurgeService;
    this.cache = options?.cacheSvc || redisCache;
  }

  /**
   * Scans a restored database for resurrected personal data and reapplies in-place pseudonymization.
   * MUST be executed pre-traffic after any database snapshot restore.
   */
  public async sanitizeRestoredDatabase(): Promise<SanitizationReport> {
    // Production Safety Guard: prevent accidental invocation against live production traffic
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.CONFIRM_RESTORE_SANITIZATION !== 'true'
    ) {
      throw new Error(
        'RESTORE SANITIZATION GUARD: Cannot run restore sanitization on production without explicit CONFIRM_RESTORE_SANITIZATION=true.',
      );
    }

    logger.info('Starting backup restore re-sanitization procedure.');

    // 1. Identify all historically completed erasure requests from the compliance audit ledger
    const certLogs = await this.prisma.auditLog.findMany({
      where: {
        action: 'PRIVACY_AUDIT_CERTIFICATE_ISSUED',
      },
    });

    const erasedUserIds = new Set<string>();
    for (const log of certLogs) {
      const meta = log.metadata as any;
      if (meta && meta.requestId) {
        // Find corresponding request to get target userId
        const reqLog = await this.prisma.auditLog.findFirst({
          where: {
            entity: 'PrivacyRequest',
            entityId: meta.requestId,
            action: 'PRIVACY_REQUEST_CREATED',
          },
        });
        if (reqLog && reqLog.userId) {
          erasedUserIds.add(reqLog.userId);
        }
      }
    }

    const sanitizedUserIds: string[] = [];
    let resurrectedCount = 0;
    let totalMediaPurged = 0;

    // 2. For each historically erased account, check if personal data was resurrected in this restored snapshot
    for (const userId of erasedUserIds) {
      await this.prisma.$transaction(async (tx) => {
        const users = await tx.$queryRaw<Array<{ id: string; email: string; status: UserStatus }>>`
          SELECT id, email, status FROM users WHERE id = ${userId}::uuid FOR UPDATE
        `;

        if (!users || users.length === 0) return;

        const user = users[0];
        if (!user) return;
        const expectedTombstone = this.redactionService.generateTombstoneEmail(userId);

        // If email does NOT match tombstone, personal data was resurrected by the restore!
        if (user.email !== expectedTombstone || user.status !== UserStatus.DEACTIVATED) {
          logger.warn(
            { userId, email: user.email },
            'Resurrected user detected in restored database! Re-applying in-place pseudonymization...',
          );

          await this.redactionService.pseudonymizeUser(tx, userId);
          sanitizedUserIds.push(userId);
          resurrectedCount++;
        }
      });

      // External storage reconciliation
      try {
        const purgeRes = await this.storagePurgeService.purgeUserAssets(userId);
        totalMediaPurged += purgeRes.purgedCount;
      } catch (err: any) {
        logger.warn(
          { userId, err: err.message },
          'Storage reconciliation warning during restore sanitization.',
        );
      }
    }

    // 3. Narrowly scoped cache invalidation of CreatorConnect identity namespaces
    // Do NOT flushall() — preserve queues (bull:*), socket.io adapters, rate-limits, and unrelated tenant keys
    let redisFlushed = false;
    try {
      const redisClient = this.cache.getClient();
      if (redisClient) {
        for (const userId of erasedUserIds) {
          const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { supabaseAuthId: true },
          });
          if (user?.supabaseAuthId) {
            await this.cache.invalidateUser(userId, user.supabaseAuthId);
          }
        }

        const namespaces = ['user:sub:*', 'user:id:*', 'user:profile:*', 'user:roles:*', 'auth:*'];
        for (const pattern of namespaces) {
          let cursor = '0';
          do {
            const [nextCursor, keys] = await redisClient.scan(
              cursor,
              'MATCH',
              pattern,
              'COUNT',
              100,
            );
            cursor = nextCursor;
            if (keys && keys.length > 0) {
              await redisClient.del(...keys);
            }
          } while (cursor !== '0');
        }
        redisFlushed = true;
      }
    } catch (err: any) {
      logger.warn(
        { err: err.message },
        'Redis namespace invalidation warning during restore sanitization.',
      );
    }

    const report: SanitizationReport = {
      timestamp: new Date().toISOString(),
      usersEvaluated: erasedUserIds.size,
      resurrectedAccountsSanitized: resurrectedCount,
      mediaAssetsPurged: totalMediaPurged,
      redisFlushed,
      operatorSignOffRequired: true,
      sanitizedUserIds,
    };

    logger.info(
      {
        event: 'RESTORE_SANITIZATION_COMPLETED',
        ...report,
      },
      'Backup restore re-sanitization procedure complete. Awaiting operator sign-off.',
    );

    return report;
  }
}

export const restoreSanitizerService = new RestoreSanitizerService();
