import pino, { type Logger } from 'pino';
import { Value } from '@creatorconnect/validation';
import {
  outboxRepository,
  type IOutboxRepository,
  type ClaimedOutboxEvent,
} from '@creatorconnect/database';
import {
  MessageCreatedV1PayloadSchema,
  UserBlockCreatedV1PayloadSchema,
  UserBlockRemovedV1PayloadSchema,
} from '@creatorconnect/contracts';
import { type IEventDispatcher, NoOpEventDispatcher } from './event-dispatcher.js';

export interface OutboxProcessorConfig {
  batchSize?: number;
  pollIntervalMs?: number;
  leaseDurationSeconds?: number;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
  consumerName?: string;
}

export class OutboxProcessor {
  private readonly config: Required<OutboxProcessorConfig>;
  private readonly logger: Logger;
  private readonly outboxRepo: IOutboxRepository;
  private readonly dispatcher: IEventDispatcher;

  private isRunning = false;
  private isProcessing = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private currentBatchPromise: Promise<number> | null = null;

  constructor(options?: {
    config?: OutboxProcessorConfig;
    logger?: Logger;
    outboxRepo?: IOutboxRepository;
    dispatcher?: IEventDispatcher;
  }) {
    this.logger =
      options?.logger ||
      pino({
        level: process.env.LOG_LEVEL || 'info',
      });

    this.outboxRepo = options?.outboxRepo || outboxRepository;
    this.dispatcher = options?.dispatcher || new NoOpEventDispatcher();

    this.config = {
      batchSize: Math.min(Math.max(options?.config?.batchSize ?? 50, 1), 500),
      pollIntervalMs: Math.max(options?.config?.pollIntervalMs ?? 50, 10),
      leaseDurationSeconds: Math.min(Math.max(options?.config?.leaseDurationSeconds ?? 30, 1), 300),
      maxAttempts: Math.max(options?.config?.maxAttempts ?? 5, 1),
      baseDelayMs: Math.max(options?.config?.baseDelayMs ?? 100, 10),
      maxDelayMs: Math.max(options?.config?.maxDelayMs ?? 30000, 100),
      jitterMs: Math.max(options?.config?.jitterMs ?? 50, 0),
      consumerName: options?.config?.consumerName || 'outbox-dispatcher',
    };
  }

  /**
   * Starts the continuous outbox polling loop.
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    this.logger.info(
      {
        batchSize: this.config.batchSize,
        pollIntervalMs: this.config.pollIntervalMs,
        leaseDurationSeconds: this.config.leaseDurationSeconds,
      },
      'Starting Transactional Outbox Processor',
    );

    this.scheduleNextPoll();
  }

  /**
   * Stops the polling loop gracefully, waiting for in-flight batches to complete.
   */
  public async stop(): Promise<void> {
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.currentBatchPromise) {
      this.logger.info('Waiting for in-flight outbox batch to complete...');
      await this.currentBatchPromise.catch(() => {});
      this.currentBatchPromise = null;
    }

    this.logger.info('Transactional Outbox Processor stopped cleanly');
  }

  public getStatus(): { isRunning: boolean; isProcessing: boolean } {
    return {
      isRunning: this.isRunning,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Processes a single batch of claimed outbox events.
   * Can be called directly by polling loops, schedulers, or tests.
   */
  public async processNextBatch(): Promise<number> {
    if (this.isProcessing) {
      return 0; // Avoid overlapping runs within the same instance
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // 1. Claim a bounded batch with PostgreSQL row lock
      const claimedEvents = await this.outboxRepo.claimBatch({
        batchSize: this.config.batchSize,
        leaseDurationSeconds: this.config.leaseDurationSeconds,
      });

      if (claimedEvents.length === 0) {
        return 0;
      }

      this.logger.info(
        { count: claimedEvents.length },
        'Claimed outbox event batch for processing',
      );

      // 2. Process each event with batch isolation
      let processedCount = 0;
      for (const event of claimedEvents) {
        // Individual try/catch guarantees one poison event never blocks others in the batch
        try {
          await this.processEvent(event);
          processedCount++;
        } catch (err: unknown) {
          this.logger.error(
            {
              eventId: event.id,
              eventType: event.eventType,
              err: err instanceof Error ? err.message : String(err),
            },
            'Unhandled error processing outbox event',
          );
        }
      }

      const durationMs = Date.now() - startTime;
      this.logger.info(
        {
          claimed: claimedEvents.length,
          processed: processedCount,
          durationMs,
        },
        'Finished outbox event batch',
      );

      return processedCount;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Processes a single claimed outbox event idempotently.
   */
  private async processEvent(event: ClaimedOutboxEvent): Promise<void> {
    // 1. Schema & Event Type Policy Check
    if (event.eventType === 'message.created.v1') {
      const isValid = Value.Check(MessageCreatedV1PayloadSchema, event.payload);
      if (!isValid) {
        const errors = [...Value.Errors(MessageCreatedV1PayloadSchema, event.payload)];
        const errorDetail = errors.map((e) => `${e.path}: ${e.message}`).join(', ');

        this.logger.error(
          {
            eventId: event.id,
            eventType: event.eventType,
            errorDetail,
          },
          'Outbox event payload validation failed, moving to DEAD_LETTER',
        );

        await this.outboxRepo.markFailed(event.claimToken, {
          error: `PAYLOAD_VALIDATION_FAILED: ${errorDetail}`,
          isTerminal: true,
        });
        return;
      }
    } else if (event.eventType === 'user.block.created.v1') {
      const isValid = Value.Check(UserBlockCreatedV1PayloadSchema, event.payload);
      if (!isValid) {
        const errors = [...Value.Errors(UserBlockCreatedV1PayloadSchema, event.payload)];
        const errorDetail = errors.map((e) => `${e.path}: ${e.message}`).join(', ');

        this.logger.error(
          {
            eventId: event.id,
            eventType: event.eventType,
            errorDetail,
          },
          'Outbox event payload validation failed, moving to DEAD_LETTER',
        );

        await this.outboxRepo.markFailed(event.claimToken, {
          error: `PAYLOAD_VALIDATION_FAILED: ${errorDetail}`,
          isTerminal: true,
        });
        return;
      }
    } else if (event.eventType === 'user.block.removed.v1') {
      const isValid = Value.Check(UserBlockRemovedV1PayloadSchema, event.payload);
      if (!isValid) {
        const errors = [...Value.Errors(UserBlockRemovedV1PayloadSchema, event.payload)];
        const errorDetail = errors.map((e) => `${e.path}: ${e.message}`).join(', ');

        this.logger.error(
          {
            eventId: event.id,
            eventType: event.eventType,
            errorDetail,
          },
          'Outbox event payload validation failed, moving to DEAD_LETTER',
        );

        await this.outboxRepo.markFailed(event.claimToken, {
          error: `PAYLOAD_VALIDATION_FAILED: ${errorDetail}`,
          isTerminal: true,
        });
        return;
      }
    } else {
      // Unknown event type policy: record terminal failure without silent drop
      this.logger.error(
        {
          eventId: event.id,
          eventType: event.eventType,
        },
        'Unknown outbox event type encountered, moving to DEAD_LETTER',
      );

      await this.outboxRepo.markFailed(event.claimToken, {
        error: `UNKNOWN_EVENT_TYPE: ${event.eventType}`,
        isTerminal: true,
      });
      return;
    }

    // 2. Idempotency Check via processed_events table
    const alreadyProcessed = await this.outboxRepo.isEventProcessed(
      event.id,
      this.config.consumerName,
    );

    if (alreadyProcessed) {
      this.logger.warn(
        { eventId: event.id, consumerName: this.config.consumerName },
        'Event already processed by consumer, finalizing outbox status as PUBLISHED',
      );
      await this.outboxRepo.markPublished(event.claimToken);
      return;
    }

    // 3. Dispatch Event via Injected Adapter
    const dispatchResult = await this.dispatcher.dispatch(event);

    if (!dispatchResult.success) {
      const isTerminal =
        dispatchResult.isTransient === false || event.attempts >= this.config.maxAttempts;

      this.logger.warn(
        {
          eventId: event.id,
          eventType: event.eventType,
          attempt: event.attempts,
          isTerminal,
          error: dispatchResult.error,
        },
        isTerminal
          ? 'Event dispatch failed permanently, transitioned to DEAD_LETTER'
          : 'Event dispatch failed transiently, scheduled for backoff retry',
      );

      await this.outboxRepo.markFailed(event.claimToken, {
        error: dispatchResult.error || 'Dispatch adapter rejected event',
        isTerminal,
        maxAttempts: this.config.maxAttempts,
        baseDelayMs: this.config.baseDelayMs,
        maxDelayMs: this.config.maxDelayMs,
        jitterMs: this.config.jitterMs,
      });
      return;
    }

    // 4. Record Deduplication Record & Mark Published
    await this.outboxRepo.recordProcessedEvent(event.id, this.config.consumerName);

    const marked = await this.outboxRepo.markPublished(event.claimToken);
    if (!marked) {
      this.logger.warn(
        {
          eventId: event.id,
          attempt: event.claimToken.attempt,
        },
        'Claim token was stale when marking PUBLISHED (lease expired or reclaimed)',
      );
    } else {
      this.logger.info(
        {
          eventId: event.id,
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          attempt: event.attempts,
        },
        'Successfully dispatched and finalized outbox event',
      );
    }
  }

  private scheduleNextPoll(): void {
    if (!this.isRunning) return;

    this.pollTimer = setTimeout(async () => {
      if (!this.isRunning) return;

      this.currentBatchPromise = this.processNextBatch();
      try {
        await this.currentBatchPromise;
      } catch (err: unknown) {
        this.logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          'Error during outbox polling tick',
        );
      } finally {
        this.currentBatchPromise = null;
        this.scheduleNextPoll();
      }
    }, this.config.pollIntervalMs);
  }
}
