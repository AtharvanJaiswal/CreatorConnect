import { Worker, type Job, type Processor } from 'bullmq';
import { Redis } from 'ioredis';
import pino, { type Logger } from 'pino';
import type { WorkerConfig } from './config.js';

export class WorkerSupervisor {
  private redisConnection: Redis | null = null;
  private worker: Worker | null = null;
  private isShuttingDown = false;
  readonly logger: Logger;

  constructor(
    private readonly config: WorkerConfig,
    logger?: Logger,
  ) {
    this.logger = logger || pino({ level: config.logLevel });
  }

  async start(processor?: Processor) {
    this.logger.info({ queue: this.config.queueName }, 'Starting Worker Supervisor');

    this.redisConnection = new Redis(this.config.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    const defaultProcessor: Processor = async (job: Job) => {
      this.logger.info({ jobId: job.id, jobName: job.name }, 'Processing background job');
      return { success: true };
    };

    this.worker = new Worker(this.config.queueName, processor || defaultProcessor, {
      connection: this.redisConnection,
      concurrency: this.config.concurrency,
    });

    this.worker.on('ready', () => {
      this.logger.info('BullMQ worker is ready and listening for jobs');
    });

    this.worker.on('completed', (job: Job) => {
      this.logger.info({ jobId: job.id, jobName: job.name }, 'Job completed successfully');
    });

    this.worker.on('failed', (job: Job | undefined, err: Error) => {
      this.logger.error({ jobId: job?.id, jobName: job?.name, err }, 'Job processing failed');
    });

    this.worker.on('error', (err: Error) => {
      if (!this.isShuttingDown) {
        this.logger.error({ err }, 'Worker internal error');
      }
    });
  }

  async shutdown() {
    this.isShuttingDown = true;
    this.logger.info('Shutting down Worker Supervisor...');

    if (this.worker) {
      await this.worker.close();
      this.logger.info('Worker closed');
    }

    if (this.redisConnection) {
      await this.redisConnection.quit();
      this.logger.info('Redis connection closed');
    }

    this.logger.info('Worker Supervisor terminated cleanly');
  }

  isRunning(): boolean {
    return !this.isShuttingDown && this.worker !== null;
  }
}
