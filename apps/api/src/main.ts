import 'dotenv/config';
import { buildApp } from './app.js';

async function start() {
  const app = await buildApp();

  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info({ signal }, 'Received termination signal, closing server gracefully');
      try {
        await app.close();
        app.log.info('Server closed cleanly');
        process.exit(0);
      } catch (err) {
        app.log.error({ err }, 'Error occurred while closing server');
        process.exit(1);
      }
    });
  }

  try {
    await app.listen({ port, host });
    app.log.info({ port, host }, `CreatorConnect API listening on http://${host}:${port}`);
  } catch (err) {
    app.log.error({ err }, 'Failed to start CreatorConnect API');
    process.exit(1);
  }
}

start().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
