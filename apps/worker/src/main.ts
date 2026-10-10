import 'dotenv/config';
import type { Logger } from 'pino';
import { loadWorkerConfig, type WorkerConfig } from './config.js';
import { WorkerSupervisor } from './supervisor.js';
import { MediaProcessor } from './processors/media-processor.js';
import { CleanupScheduler } from './schedulers/cleanup-scheduler.js';
import { OutboxProcessor } from './outbox/outbox-processor.js';
import { NotificationEventHandler } from './notifications/notification-event-handler.js';
import {
  BlockEvictionDispatcher,
  CompositeEventDispatcher,
  SocketIoEventDispatcher,
  RealtimeBridge,
  type IRealtimeBridge,
} from './outbox/event-dispatcher.js';
import { getPrismaClient, type PrismaClient } from '@creatorconnect/database';

export interface WorkerRuntimeOptions {
  config?: WorkerConfig | undefined;
  logger?: Logger | undefined;
  bridge?: IRealtimeBridge | undefined;
  prisma?: PrismaClient | undefined;
}

export interface WorkerRuntime {
  supervisor: WorkerSupervisor;
  bridge: IRealtimeBridge;
  outboxProcessor: OutboxProcessor;
  compositeDispatcher: CompositeEventDispatcher;
  blockEvictionDispatcher: BlockEvictionDispatcher;
  socketIoDispatcher: SocketIoEventDispatcher;
  notificationHandler: NotificationEventHandler;
  logger: Logger;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * Factory creating the production Worker runtime composition.
 * Connects the Transactional Outbox processor to the shared Redis cluster via RealtimeBridge,
 * wiring both active-socket block eviction and real-time message broadcasting across processes.
 */
export async function createWorkerRuntime(
  options: WorkerRuntimeOptions = {},
): Promise<WorkerRuntime> {
  const config = options.config || loadWorkerConfig();
  const supervisor = new WorkerSupervisor(config, options.logger);
  const logger = supervisor.logger;
  const prisma = options.prisma || getPrismaClient();

  const bridge =
    options.bridge ||
    new RealtimeBridge({
      redisUrl: config.redisUrl,
      logger,
      prisma,
    });

  const mediaProcessor = new MediaProcessor(logger);
  const cleanupScheduler = new CleanupScheduler(logger);

  const notificationHandler = new NotificationEventHandler({
    prisma,
    logger,
  });

  const blockEvictionDispatcher = new BlockEvictionDispatcher({
    evictionService: bridge.evictionService,
    logger,
  });

  const socketIoDispatcher = new SocketIoEventDispatcher({
    emitter: bridge.emitter,
    prisma,
    logger,
  });

  const compositeDispatcher = new CompositeEventDispatcher([
    blockEvictionDispatcher,
    notificationHandler,
    socketIoDispatcher,
  ]);

  const outboxProcessor = new OutboxProcessor({
    config: {
      batchSize: config.outboxBatchSize,
      pollIntervalMs: config.outboxPollIntervalMs,
      leaseDurationSeconds: config.outboxLeaseDurationSeconds,
      maxAttempts: config.outboxMaxAttempts,
      baseDelayMs: config.outboxBaseDelayMs,
      maxDelayMs: config.outboxMaxDelayMs,
      jitterMs: config.outboxJitterMs,
    },
    dispatcher: compositeDispatcher,
    logger,
  });

  let cleanupInterval: NodeJS.Timeout | null = null;

  async function start(): Promise<void> {
    logger.info('Initializing Realtime Bridge and Outbox Processor');

    // 1. Establish Redis connection for cross-node realtime bridge
    await bridge.connect();

    // 2. Start Transactional Outbox polling loop
    await outboxProcessor.start();

    // 3. Start BullMQ background media processing
    await supervisor.start(async (job) => {
      if (job.name === 'media-scan-and-process') {
        return mediaProcessor.process(job as any);
      }
      return { success: true };
    });

    // 4. Initial hygiene pass and periodic cleanup interval
    await cleanupScheduler.cleanupExpiredQuarantine().catch(() => {});
    await cleanupScheduler.closeExpiredAssignments().catch(() => {});

    cleanupInterval = setInterval(
      async () => {
        await cleanupScheduler.cleanupExpiredQuarantine().catch(() => {});
        await cleanupScheduler.closeExpiredAssignments().catch(() => {});
      },
      10 * 60 * 1000,
    );

    logger.info('CreatorConnect Worker runtime started successfully');
  }

  async function stop(): Promise<void> {
    logger.info('Stopping CreatorConnect Worker runtime cleanly...');
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }

    try {
      await outboxProcessor.stop();
    } catch (err: any) {
      logger.warn({ err: err?.message }, 'Warning stopping OutboxProcessor');
    }

    try {
      await bridge.close();
    } catch (err: any) {
      logger.warn({ err: err?.message }, 'Warning closing RealtimeBridge');
    }

    try {
      await supervisor.shutdown();
    } catch (err: any) {
      logger.warn({ err: err?.message }, 'Warning shutting down WorkerSupervisor');
    }

    logger.info('CreatorConnect Worker runtime stopped cleanly');
  }

  return {
    supervisor,
    bridge,
    outboxProcessor,
    compositeDispatcher,
    blockEvictionDispatcher,
    socketIoDispatcher,
    notificationHandler,
    logger,
    start,
    stop,
  };
}

async function main() {
  const runtime = await createWorkerRuntime();

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      runtime.logger.info({ signal }, 'Received termination signal, shutting down worker');
      try {
        await runtime.stop();
        process.exit(0);
      } catch (err) {
        runtime.logger.error({ err }, 'Error occurred during worker shutdown');
        process.exit(1);
      }
    });
  }

  await runtime.start();
}

// Only execute main when run directly
if (process.env.NODE_ENV !== 'test') {
  main().catch((err) => {
    console.error('Fatal error in worker startup:', err);
    process.exit(1);
  });
}
