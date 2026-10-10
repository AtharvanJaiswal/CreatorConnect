import { PrismaClient, Prisma } from '@prisma/client';
import { getPrismaClient } from './index.js';

export interface OutboxClaimToken {
  eventId: string;
  attempt: number;
}

/**
 * Creates an OutboxClaimToken representing a claimed outbox event lease.
 */
export function createOutboxClaimToken(eventId: string, attempt = 1): OutboxClaimToken {
  return {
    eventId,
    attempt,
  };
}

export interface ClaimBatchOptions {
  batchSize?: number; // bounded between 1 and 500, default 50
  leaseDurationSeconds?: number; // bounded between 5 and 300, default 30
}

export interface ClaimedOutboxEvent {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  attempts: number;
  createdAt: Date;
  claimToken: OutboxClaimToken;
}

export interface RetryDelayOptions {
  baseDelayMs?: number | undefined;
  maxDelayMs?: number | undefined;
  jitterMs?: number | undefined;
  randomFn?: (() => number) | undefined;
}

/**
 * Computes an exponentially backed-off retry delay with additive jitter.
 *
 * Mathematical Invariant:
 * 0 <= calculateRetryDelayMs(attempt, options) <= maxDelayMs
 *
 * Formula:
 * e = max(0, min(attempt - 1, 30))
 * d_exp = min(maxDelayMs, baseDelayMs * 2^e)
 * j = floor(U * jitterMs)
 * d_retry = min(maxDelayMs, d_exp + j)
 */
export function calculateRetryDelayMs(attempt: number, options?: RetryDelayOptions): number {
  const baseDelayMs =
    options?.baseDelayMs !== undefined &&
    Number.isFinite(options.baseDelayMs) &&
    options.baseDelayMs > 0
      ? options.baseDelayMs
      : 100;

  const maxDelayMs =
    options?.maxDelayMs !== undefined &&
    Number.isFinite(options.maxDelayMs) &&
    options.maxDelayMs > 0
      ? Math.max(baseDelayMs, options.maxDelayMs)
      : Math.max(baseDelayMs, 30000);

  const jitterMs =
    options?.jitterMs !== undefined && Number.isFinite(options.jitterMs)
      ? Math.max(0, options.jitterMs)
      : 50;

  const random = options?.randomFn ?? Math.random;

  // Bound exponent between 0 and 30 to prevent 2^e overflow (2^30 > 1e9 ms > 12 days)
  const normalizedAttempt = Math.max(1, Number.isFinite(attempt) ? Math.floor(attempt) : 1);
  const backoffExponent = Math.max(0, Math.min(normalizedAttempt - 1, 30));

  const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, backoffExponent));
  const rawRandom = random();
  const clampedRandom = Math.max(
    0,
    Math.min(Number.isFinite(rawRandom) ? rawRandom : 0, 0.9999999999999999),
  );
  const jitter = jitterMs > 0 ? Math.floor(clampedRandom * jitterMs) : 0;

  // Enforce strict upper bound: total delay must NEVER exceed maxDelayMs
  return Math.min(maxDelayMs, exponentialDelay + jitter);
}

export interface MarkFailedOptions {
  error: Error | string;
  isTerminal?: boolean | undefined;
  maxAttempts?: number | undefined; // default 5
  baseDelayMs?: number | undefined; // default 100
  maxDelayMs?: number | undefined; // default 30000
  jitterMs?: number | undefined; // default 50
  randomFn?: (() => number) | undefined;
}

export interface IOutboxRepository {
  claimBatch(options?: ClaimBatchOptions): Promise<ClaimedOutboxEvent[]>;
  markPublished(claimToken: OutboxClaimToken): Promise<boolean>;
  markFailed(claimToken: OutboxClaimToken, options: MarkFailedOptions): Promise<boolean>;
  recordProcessedEvent(eventId: string, consumerName: string): Promise<boolean>;
  isEventProcessed(eventId: string, consumerName: string): Promise<boolean>;
}

export class OutboxRepository implements IOutboxRepository {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || getPrismaClient();
  }

  /**
   * Durably claims a batch of pending or expired outbox events using FOR UPDATE SKIP LOCKED.
   * Increments attempts and assigns a lease expiration timestamp within an atomic transaction.
   */
  public async claimBatch(options?: ClaimBatchOptions): Promise<ClaimedOutboxEvent[]> {
    const batchSize = Math.min(Math.max(options?.batchSize ?? 50, 1), 500);
    const leaseSeconds = Math.min(Math.max(options?.leaseDurationSeconds ?? 30, 1), 300);

    return await this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{
            id: string;
            event_type: string;
            aggregate_type: string;
            aggregate_id: string;
            payload: unknown;
            attempts: number;
            created_at: Date;
          }>
        >`
          WITH selected AS (
            SELECT id
            FROM outbox_events
            WHERE (status = 'PENDING' AND next_attempt_at <= NOW())
               OR (status = 'PROCESSING' AND next_attempt_at <= NOW())
            ORDER BY created_at ASC, id ASC
            LIMIT ${batchSize}
            FOR UPDATE SKIP LOCKED
          )
          UPDATE outbox_events
          SET status = 'PROCESSING',
              attempts = attempts + 1,
              next_attempt_at = NOW() + (${leaseSeconds} * INTERVAL '1 second')
          FROM selected
          WHERE outbox_events.id = selected.id
          RETURNING outbox_events.id,
                    outbox_events.event_type,
                    outbox_events.aggregate_type,
                    outbox_events.aggregate_id,
                    outbox_events.payload,
                    outbox_events.attempts,
                    outbox_events.created_at
        `;

        return rows.map((row) => ({
          id: row.id,
          eventType: row.event_type,
          aggregateType: row.aggregate_type,
          aggregateId: row.aggregate_id,
          payload:
            typeof row.payload === 'object' && row.payload !== null
              ? (row.payload as Record<string, unknown>)
              : {},
          attempts: Number(row.attempts),
          createdAt: row.created_at,
          claimToken: {
            eventId: row.id,
            attempt: Number(row.attempts),
          },
        }));
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 5000,
      },
    );
  }

  /**
   * Marks an event as published. Fails closed (returns false) if the claim token is stale.
   */
  public async markPublished(claimToken: OutboxClaimToken): Promise<boolean> {
    const updatedCount = await this.prisma.$executeRaw`
      UPDATE outbox_events
      SET status = 'PUBLISHED',
          published_at = NOW(),
          last_error = NULL
      WHERE id = ${claimToken.eventId}::uuid
        AND status = 'PROCESSING'
        AND attempts = ${claimToken.attempt}
    `;
    return updatedCount > 0;
  }

  /**
   * Records a processing failure with backoff or dead-letter transition.
   * Fails closed (returns false) if the claim token is stale.
   */
  public async markFailed(
    claimToken: OutboxClaimToken,
    options: MarkFailedOptions,
  ): Promise<boolean> {
    const maxAttempts = options.maxAttempts ?? 5;
    const baseDelayMs = options.baseDelayMs ?? 100;
    const maxDelayMs = options.maxDelayMs ?? 30000;
    const jitterMs = options.jitterMs ?? 50;

    const errorMessage =
      options.error instanceof Error ? options.error.message : String(options.error);

    const isTerminal = options.isTerminal || claimToken.attempt >= maxAttempts;

    if (isTerminal) {
      const updatedCount = await this.prisma.$executeRaw`
        UPDATE outbox_events
        SET status = 'DEAD_LETTER',
            last_error = ${errorMessage}
        WHERE id = ${claimToken.eventId}::uuid
          AND status = 'PROCESSING'
          AND attempts = ${claimToken.attempt}
      `;
      return updatedCount > 0;
    }

    // Compute exponential backoff with jitter strictly capped by maxDelayMs
    const totalDelayMs = calculateRetryDelayMs(claimToken.attempt, {
      baseDelayMs,
      maxDelayMs,
      jitterMs,
      randomFn: options.randomFn,
    });
    const nextAttemptAt = new Date(Date.now() + totalDelayMs);

    const updatedCount = await this.prisma.$executeRaw`
      UPDATE outbox_events
      SET status = 'PENDING',
          next_attempt_at = ${nextAttemptAt},
          last_error = ${errorMessage}
      WHERE id = ${claimToken.eventId}::uuid
        AND status = 'PROCESSING'
        AND attempts = ${claimToken.attempt}
    `;
    return updatedCount > 0;
  }

  /**
   * Idempotently records a processed event for a specific consumer.
   * Returns true if newly recorded, false if already processed.
   */
  public async recordProcessedEvent(eventId: string, consumerName: string): Promise<boolean> {
    try {
      await this.prisma.processedEvent.create({
        data: {
          eventId,
          consumerName,
        },
      });
      return true;
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return false;
      }
      throw err;
    }
  }

  /**
   * Checks whether an event was already processed by a specific consumer.
   */
  public async isEventProcessed(eventId: string, consumerName: string): Promise<boolean> {
    const existing = await this.prisma.processedEvent.findUnique({
      where: {
        eventId_consumerName: {
          eventId,
          consumerName,
        },
      },
    });
    return !!existing;
  }
}

export const outboxRepository = new OutboxRepository();
