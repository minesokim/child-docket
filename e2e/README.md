# Petal Playwright e2e

Browser tests against `https://docket-portal.vercel.app` (or any preview URL via `E2E_PORTAL_URL`). The Vercel project name is still `docket-portal` post-rebrand — the brand is Petal, the deployment identifier is historical.

> **⚠️ E2E AUTH BYPASS DELETED 2026-05-15.** The `/api/e2e-bypass` route was removed per audit + PRODUCTION-READINESS §D pre-public-launch checklist (a public auth-bypass route in production code is a SOC 2 CC6.1 fail even with four env gates). The Playwright suite currently reports "all skipped" because the bypass helper returns null on the 404. The suite needs a rebuild on top of Clerk Testing Tokens — see https://clerk.com/docs/testing/playwright/overview. Tracked as a follow-up task. The rest of this README describes the historical setup for reference.


## What this catches

Composition failures the per-feature smokes can't:
- Sign-in flow (Clerk + ticket consumption)
- Intake step gating (canAdvanceFromStep wiring)
- /api/health endpoint shape + auth-gating

These are PATH-C complement to the API e2e at `services/workers/scripts/e2e-app.ts`. API e2e proves backend composition; Playwright proves the UI surfaces compose against the deployed app.

## Setup (first time)

```bash
pnpm e2e:portal:install   # downloads chromium browser binary
```

## Configuration

Tests gate on env vars. Without them, every test auto-skips (the suite still passes, just empty).

In `.env.local`:

```bash
E2E_TEST_PHONE=+15555550199         # match the Vercel app env
E2E_TEST_OTP=777777                 # match the Vercel app env
E2E_PORTAL_URL=https://docket-portal.vercel.app   # default
```

The bypass is gated by FOUR env vars on the deployed app side (`E2E_BYPASS_ENABLED`, `E2E_TEST_PHONE`, `E2E_TEST_OTP`, `E2E_ALLOW_PROD_BYPASS`). Set those in Vercel → Settings → Environment Variables for `docket-portal` (and `docket-command-room` if testing both apps). Without all four set, `/api/e2e-bypass` returns 403 and the tests skip.

## Run

```bash
pnpm e2e:portal              # run all tests
pnpm e2e:portal -- e2e/sign-in.spec.ts   # one suite
pnpm e2e:portal -- --headed  # see the browser
```

## Files

- `playwright.config.ts` (workspace root) — Playwright config, baseURL, timeouts.
- `e2e/helpers/bypass.ts` — `getBypassTicket(request)` is a no-op stub that always returns null (the `/api/e2e-bypass` route was deleted 2026-05-15). Tests auto-skip via the existing `test.skip(!ticket, ...)` guard. Replace this helper with a Clerk Testing Tokens-based `getTestingSessionToken` when the suite is rebuilt.
- `e2e/sign-in.spec.ts` — login page renders, ticket consumes, lands on /welcome.
- `e2e/intake.spec.ts` — partial intake flow (first 3 steps).
- `e2e/health.spec.ts` — `/api/health` shape + auth gating.

## Removed before launch — 2026-05-15

Per `docs/PRODUCTION-READINESS.md` pre-public-launch removal checklist, the following were completed in commit `<TODO: filled in by commit>`:

- [x] Deleted `apps/client-portal/src/app/api/e2e-bypass/`
- [x] Removed the `/api/e2e-bypass` allowlist line from `apps/client-portal/src/middleware.ts`
- [x] Removed the ticket-consumption useEffect from `apps/client-portal/src/app/(auth)/login/page.tsx`
- [ ] **Operator action**: unset `E2E_BYPASS_ENABLED` / `E2E_TEST_PHONE` / `E2E_TEST_OTP` / `E2E_ALLOW_PROD_BYPASS` from Vercel env (`docket-portal` project) — the route is gone from code but stale env vars on Vercel are pointless noise.

The Playwright tests stay in place; they auto-skip via the `test.skip(!ticket, ...)` guard now that the helper returns null on every call. Rebuild the suite on top of Clerk Testing Tokens (https://clerk.com/docs/testing/playwright/overview) before the next E2E run is expected to pass.
