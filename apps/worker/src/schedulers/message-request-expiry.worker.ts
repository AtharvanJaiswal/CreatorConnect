import { getPrismaClient, type PrismaClient } from '@creatorconnect/database';
import { generateUuidV7 } from '@creatorconnect/utils';
import type { MessageRequestExpiredV1Payload } from '@creatorconnect/contracts';
import type { Logger } from 'pino';

export interface MessageRequestExpiryWorkerOptions {
  prisma?: PrismaClient | undefined;
  logger?: Logger | undefined;
  now?: (() => Date) | undefined;
  batchSize?: number | undefined;
}

export interface ExpirySweepResult {
  scanned: number;
  expired: number;
  conflicted: number;
  errors: number;
}

/**
 * Production-grade background worker for expiring stale pending message requests.
 * Fulfills Milestone 2C requirements:
 * 1. Transitions only requests that remain PENDING and whose expiresAt <= now.
 * 2. Processes bounded batches with index @@index([status, expiresAt]) without full table scans.
 * 3. Uses transaction-safe conditional updates (updateMany({ id, status: 'PENDING', expiresAt: { lte: now } }))
 *    so concurrent accept/decline/cancel operations resolve consistently.
 * 4. Generates message_request.expired.v1 outbox event atomically in the same transaction.
 * 5. Concurrent workers never emit duplicate expiry events (only the winning worker gets count === 1).
 * 6. Supports deterministic injectable clock (now: () => Date).
 */
export class MessageRequestExpiryWorker {
  private readonly prisma: PrismaClient;
  private readonly logger: Logger | undefined;
  private readonly now: () => Date;
  private readonly batchSize: number;

  constructor(options: MessageRequestExpiryWorkerOptions = {}) {
    this.prisma = options.prisma || getPrismaClient();
    this.logger = options.logger;
    this.now = options.now || (() => new Date());
    this.batchSize = options.batchSize && options.batchSize > 0 ? options.batchSize : 50;
  }

  /**
   * Sweeps and transitions expired pending message requests in bounded batches.
   *
   * @param options.maxBatches Maximum number of bounded batches to process in a single sweep (default: 5).
   * @returns ExpirySweepResult with scanned, expired, conflicted, and error counts.
   */
  async expirePendingRequests(options?: { maxBatches?: number }): Promise<ExpirySweepResult> {
    const maxBatches = options?.maxBatches ?? 5;
    const result: ExpirySweepResult = {
      scanned: 0,
      expired: 0,
      conflicted: 0,
      errors: 0,
    };

    const currentTime = this.now();

    for (let batchIndex = 0; batchIndex < maxBatches; batchIndex++) {
      let candidates: Array<{
        id: string;
        senderId: string;
        recipientId: string;
        expiresAt: Date;
      }> = [];

      try {
        // Query bounded batch of candidates using index @@index([status, expiresAt])
        candidates = await this.prisma.messageRequest.findMany({
          where: {
            status: 'PENDING',
            expiresAt: { lte: currentTime },
          },
          take: this.batchSize,
          orderBy: { expiresAt: 'asc' },
          select: {
            id: true,
            senderId: true,
            recipientId: true,
            expiresAt: true,
          },
        });
      } catch (err: any) {
        result.errors++;
        this.logger?.error(
          { err: err?.message, batchIndex },
          'Failed to query expired pending message requests',
        );
        break;
      }

      if (candidates.length === 0) {
        break;
      }

      result.scanned += candidates.length;

      // Process each candidate within its own isolated transaction
      for (const candidate of candidates) {
        try {
          await this.prisma.$transaction(async (tx) => {
            // Transaction-safe conditional update: only transitions if still PENDING and expired
            const updateRes = await tx.messageRequest.updateMany({
              where: {
                id: candidate.id,
                status: 'PENDING',
                expiresAt: { lte: currentTime },
              },
              data: {
                status: 'EXPIRED',
                respondedAt: currentTime,
              },
            });

            if (updateRes.count === 0) {
              // Concurrently accepted, declined, cancelled, or already expired by another worker
              result.conflicted++;
              return;
            }

            // Atomically create outbox event for message_request.expired.v1
            const outboxPayload: MessageRequestExpiredV1Payload = {
              requestId: candidate.id,
              senderId: candidate.senderId,
              recipientId: candidate.recipientId,
              expiredAt: currentTime.toISOString(),
            };

            await tx.outboxEvent.create({
              data: {
                id: generateUuidV7(),
                eventType: 'message_request.expired.v1',
                aggregateType: 'MessageRequest',
                aggregateId: candidate.id,
                payload: outboxPayload as any,
                status: 'PENDING',
              },
            });

            result.expired++;
          });
        } catch (err: any) {
          result.errors++;
          this.logger?.warn(
            { err: err?.message, requestId: candidate.id },
            'Failed to expire message request candidate',
          );
        }
      }

      // If fewer candidates than batchSize were returned, all eligible candidates have been handled
      if (candidates.length < this.batchSize) {
        break;
      }
    }

    if (result.expired > 0 || result.conflicted > 0) {
      this.logger?.info(
        {
          scanned: result.scanned,
          expired: result.expired,
          conflicted: result.conflicted,
          errors: result.errors,
        },
        'MessageRequest expiry sweep completed',
      );
    }

    return result;
  }
}
