import 'dotenv/config';
import { loadWorkerConfig } from './config.js';
import { WorkerSupervisor } from './supervisor.js';

async function main() {
  const config = loadWorkerConfig();
  const supervisor = new WorkerSupervisor(config);

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      supervisor.logger.info({ signal }, 'Received termination signal, shutting down worker');
      try {
        await supervisor.shutdown();
        process.exit(0);
      } catch (err) {
        supervisor.logger.error({ err }, 'Error occurred during worker shutdown');
        process.exit(1);
      }
    });
  }

  await supervisor.start();
  supervisor.logger.info('CreatorConnect Worker running in background');
}

main().catch((err) => {
  console.error('Fatal error in worker startup:', err);
  process.exit(1);
});
