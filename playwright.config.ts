import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';

// Load .env so DATABASE_URL, SUPABASE_JWT_ISSUER, etc. are available to test processes
dotenv.config({ path: path.resolve(__dirname, '.env') });

const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  ...(process.env.CI ? { workers: 2 } : {}),
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  webServer: [
    {
      command: `${pnpmCmd} --filter @creatorconnect/api dev`,
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer: true,
      timeout: 120000,
    },
    {
      command: `${pnpmCmd} --filter @creatorconnect/web-shell dev`,
      url: 'http://127.0.0.1:3002',
      reuseExistingServer: true,
      timeout: 120000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(process.env.CI
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
          },
        ]
      : []),
  ],
});
