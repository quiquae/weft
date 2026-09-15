import { defineConfig } from '@playwright/test';

/**
 * Playwright drives a real Chromium with the built extension loaded from disk.
 *
 * MV3 extensions cannot be loaded into an incognito/ephemeral context, so every
 * test uses a persistent context created per worker in tests/e2e/fixtures.ts.
 * Running headless is possible in new Chromium builds, but extension service
 * workers are noticeably more reliable headed, so CI runs headed under xvfb.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
