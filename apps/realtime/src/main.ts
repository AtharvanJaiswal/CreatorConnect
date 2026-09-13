import 'dotenv/config';
import { createRealtimeServer } from './server.js';

async function main() {
  const port = parseInt(process.env.PORT || '3001', 10);
  const host = process.env.HOST || '0.0.0.0';
  const redisUrl = process.env.REDIS_URL;

  const { app, close, logger } = await createRealtimeServer({
    port,
    host,
    redisUrl,
    corsOrigin: process.env.CORS_ORIGIN,
  });

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, 'Received termination signal, shutting down realtime service');
      try {
        await close();
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during realtime service shutdown');
        process.exit(1);
      }
    });
  }

  await app.listen({ port, host });
  logger.info(
    { port, host },
    `CreatorConnect Realtime service listening on http://${host}:${port}`,
  );
}

main().catch((err) => {
  console.error('Fatal error starting Realtime service:', err);
  process.exit(1);
});
