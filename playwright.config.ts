import { defineConfig } from '@playwright/test';

/**
 * Playwright drives a real Chromium with the built extension loaded from disk.
 *
 * MV3 extensions cannot be loaded into an incognito/ephemeral context, so every
 * test uses a persistent context created per worker in tests/e2e/fixtures.ts.
 * That context runs headless on `channel: 'chromium'` — the full build, not
 * the headless shell, which cannot load an extension at all. CI runs the same
 * way: no xvfb, no headed path, nothing that differs from a local run except
 * the operating system underneath it.
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
