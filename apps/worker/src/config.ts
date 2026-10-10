export interface WorkerConfig {
  redisUrl: string;
  concurrency: number;
  queueName: string;
  logLevel: string;
  outboxBatchSize: number;
  outboxPollIntervalMs: number;
  outboxLeaseDurationSeconds: number;
  outboxMaxAttempts: number;
  outboxBaseDelayMs: number;
  outboxMaxDelayMs: number;
  outboxJitterMs: number;
}

export function loadWorkerConfig(): WorkerConfig {
  return {
    redisUrl: process.env.REDIS_URL || 'redis://:redis_local_password@localhost:6379/0',
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    queueName: process.env.DEFAULT_QUEUE_NAME || 'system-tasks',
    logLevel: process.env.LOG_LEVEL || 'info',
    outboxBatchSize: Math.min(
      Math.max(parseInt(process.env.OUTBOX_BATCH_SIZE || '50', 10), 1),
      500,
    ),
    outboxPollIntervalMs: Math.max(parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || '50', 10), 10),
    outboxLeaseDurationSeconds: Math.min(
      Math.max(parseInt(process.env.OUTBOX_LEASE_DURATION_SECONDS || '30', 10), 5),
      300,
    ),
    outboxMaxAttempts: Math.max(parseInt(process.env.OUTBOX_MAX_ATTEMPTS || '5', 10), 1),
    outboxBaseDelayMs: Math.max(parseInt(process.env.OUTBOX_BASE_DELAY_MS || '100', 10), 10),
    outboxMaxDelayMs: Math.max(parseInt(process.env.OUTBOX_MAX_DELAY_MS || '30000', 10), 100),
    outboxJitterMs: Math.max(parseInt(process.env.OUTBOX_JITTER_MS || '50', 10), 0),
  };
}
