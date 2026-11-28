import { afterAll } from 'vitest';
import { getPrismaClient } from '@creatorconnect/database';
import { redisCache } from '../services/redis-cache.js';

afterAll(async () => {
  await getPrismaClient()
    .$disconnect()
    .catch(() => {});
  await redisCache.disconnect().catch(() => {});
});
