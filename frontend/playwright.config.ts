import { defineConfig, devices } from '@playwright/test'

/**
 * Browser tests. Points at real running app, not a mock — the whole reason this
 * exists is that until 2026-09-03 this repo had no way to see a screen actually
 * render, so "verified" meant "the code compiles and looks right".
 *
 * Default target is production, because that is what the founder asked to test
 * against and there is still no staging environment. That makes one rule
 * absolute: **these tests navigate and read. They do not create, edit or delete
 * anything.** Anything mutating belongs behind an explicit opt-in once a test
 * environment exists — see docs/jobs/playwright-harness.md.
 *
 * Credentials are never committed. Set APP_USER / APP_PASSWORD in the
 * environment (or frontend/.env.e2e, which is gitignored). Tests needing auth
 * skip themselves with a clear message when they are absent, rather than
 * failing and looking like a broken app.
 */
export default defineConfig({
  testDir: './e2e',
  // Production is shared and rate-limited; serial keeps load low and failures legible.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'e2e-report', open: 'never' }]],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://app.karix.online',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    // Real-world viewport; the app has mobile concerns but the audit starts on desktop.
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: false,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
