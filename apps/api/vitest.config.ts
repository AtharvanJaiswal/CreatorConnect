import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    fileParallelism: false,
    env: {
      DATABASE_URL:
        'postgresql://postgres:postgres_local_password@localhost:5433/creatorconnect_dev?schema=public',
      REDIS_URL: 'redis://:redis_local_password@localhost:6379/0',
      SUPABASE_JWT_ISSUER: 'https://localhost.supabase.co/auth/v1',
    },
  },
});
