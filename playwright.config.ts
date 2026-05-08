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
//   E2E_TEST_PHONE   — must match the Vercel-side env that gates the
//                       /api/e2e-bypass endpoint (e.g., +15555550199).
//   E2E_TEST_OTP     — same.
//   E2E_PORTAL_URL   — defaults to https://docket-portal.vercel.app.
//                       Override to test a preview deploy.
//
// Without those envs, every test is auto-SKIPPED (per the per-test
// `test.skip(!process.env.E2E_TEST_PHONE, ...)` guard). This means
// running the suite in a fresh checkout doesn't fail the CI — it
// just reports "all skipped, missing creds."
//
// REMOVE BEFORE PUBLIC LAUNCH per docs/PRODUCTION-READINESS.md
// pre-public-launch removal checklist.

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
