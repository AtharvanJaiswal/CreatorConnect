import 'dotenv/config';
import { loadWorkerConfig } from './config.js';
import { WorkerSupervisor } from './supervisor.js';
import { MediaProcessor } from './processors/media-processor.js';
import { CleanupScheduler } from './schedulers/cleanup-scheduler.js';

async function main() {
  const config = loadWorkerConfig();
  const supervisor = new WorkerSupervisor(config);
  const mediaProcessor = new MediaProcessor(supervisor.logger);
  const cleanupScheduler = new CleanupScheduler(supervisor.logger);

  let cleanupInterval: NodeJS.Timeout | null = null;

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      supervisor.logger.info({ signal }, 'Received termination signal, shutting down worker');
      if (cleanupInterval) clearInterval(cleanupInterval);
      try {
        await supervisor.shutdown();
        process.exit(0);
      } catch (err) {
        supervisor.logger.error({ err }, 'Error occurred during worker shutdown');
        process.exit(1);
      }
    });
  }

  // Start processing jobs using MediaProcessor
  await supervisor.start(async (job) => {
    if (job.name === 'media-scan-and-process') {
      return mediaProcessor.process(job as any);
    }
    return { success: true };
  });

  // Run initial cleanup pass and schedule periodic hygiene every 10 minutes
  await cleanupScheduler.cleanupExpiredQuarantine().catch(() => {});
  await cleanupScheduler.closeExpiredAssignments().catch(() => {});

  cleanupInterval = setInterval(
    async () => {
      await cleanupScheduler.cleanupExpiredQuarantine().catch(() => {});
      await cleanupScheduler.closeExpiredAssignments().catch(() => {});
    },
    10 * 60 * 1000,
  );

  supervisor.logger.info('CreatorConnect Worker running in background');
}

main().catch((err) => {
  console.error('Fatal error in worker startup:', err);
  process.exit(1);
});
