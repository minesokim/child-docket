// Playwright config — UI e2e against the production deploys.
//
// Per /e2e skill (.claude/skills/e2e/) Path C — the API e2e at
// services/workers/scripts/e2e-app.ts proves backend composition;
// this proves the UI surfaces compose against the production deploy.
//
// USAGE
//   pnpm e2e:portal
//
// REQUIRED ENV (set in .env.local for local runs; tests read at runtime)
//   E2E_TEST_PHONE   — historically gated /api/e2e-bypass; now unused
//                       until Clerk Testing Tokens rebuild lands.
//   E2E_TEST_OTP     — same.
//   E2E_PORTAL_URL   — defaults to https://docket-portal.vercel.app.
//                       Override to test a preview deploy.
//
// !!! E2E BYPASS DELETED 2026-05-15 !!!
// The /api/e2e-bypass route was removed per audit + PRODUCTION-READINESS
// §D pre-public-launch checklist. Tests that depend on bypass-driven
// auth auto-SKIP via the existing `test.skip(!ticket, ...)` guard
// (the helper at e2e/helpers/bypass.ts returns null on the 404 now).
// The whole suite currently reports "all skipped" until the bypass is
// rebuilt on top of Clerk Testing Tokens
// (https://clerk.com/docs/testing/playwright/overview). Tracked as a
// follow-up task.

import { defineConfig, devices } from '@playwright/test';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

loadEnv({ path: path.resolve(__dirname, '.env.local') });

const PORTAL_URL = process.env.E2E_PORTAL_URL ?? 'https://docket-portal.vercel.app';

export default defineConfig({
  testDir: './e2e',
  // No retries in v1 — flaky tests should be fixed, not retried.
  retries: 0,
  // Sequential locally; Playwright's default workers in CI is fine
  // since tests use distinct synthetic users. v1 is single-user.
  workers: 1,
  // Per-test timeout. Real-prod hits + Clerk redirects take 5-15s.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: PORTAL_URL,
    // Capture trace on first retry — none in v1, so this only fires
    // if you bump retries:
    trace: 'on-first-retry',
    // Capture screenshot on failure for debug.
    screenshot: 'only-on-failure',
    // Video on failure for the "what did the page look like?" trace.
    video: 'retain-on-failure',
    // The reduced-motion + prefers-color-scheme defaults match what
    // the editorial-warm UI is designed for.
    colorScheme: 'light',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
