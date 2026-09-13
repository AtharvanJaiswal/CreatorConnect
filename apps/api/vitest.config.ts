import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    fileParallelism: false,
    // Run all test files in a single Node.js fork to guarantee serial file execution and
    // shared PostgreSQL/Redis state isolation in both standalone and vitest workspace mode.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgresql://postgres:postgres_local_password@localhost:5433/creatorconnect_dev?schema=public',
      REDIS_URL: process.env.REDIS_URL || 'redis://:redis_local_password@localhost:6379/0',
      SUPABASE_JWT_ISSUER:
        process.env.SUPABASE_JWT_ISSUER || 'https://localhost.supabase.co/auth/v1',
    },
  },
});
