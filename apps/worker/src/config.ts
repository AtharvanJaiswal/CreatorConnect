export interface WorkerConfig {
  redisUrl: string;
  concurrency: number;
  queueName: string;
  logLevel: string;
}

export function loadWorkerConfig(): WorkerConfig {
  return {
    redisUrl: process.env.REDIS_URL || 'redis://:redis_local_password@localhost:6379/0',
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
    queueName: process.env.DEFAULT_QUEUE_NAME || 'system-tasks',
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}
