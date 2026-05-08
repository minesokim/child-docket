# Docket Playwright e2e

Browser tests against `https://docket-portal.vercel.app` (or any preview URL via `E2E_PORTAL_URL`).

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
- `e2e/helpers/bypass.ts` — `getBypassTicket(request)` calls `/api/e2e-bypass` and returns the Clerk sign-in token.
- `e2e/sign-in.spec.ts` — login page renders, ticket consumes, lands on /welcome.
- `e2e/intake.spec.ts` — partial intake flow (first 3 steps).
- `e2e/health.spec.ts` — `/api/health` shape + auth gating.

## Removing before launch

Per `docs/PRODUCTION-READINESS.md` pre-public-launch removal checklist:

1. Delete `apps/client-portal/src/app/api/e2e-bypass/`
2. Delete the `/api/e2e-bypass` allowlist line from `apps/client-portal/src/middleware.ts`
3. Delete the ticket-consumption useEffect from `apps/client-portal/src/app/(auth)/login/page.tsx`
4. Unset `E2E_BYPASS_ENABLED` / `E2E_ALLOW_PROD_BYPASS` from Vercel env

The Playwright tests can stay — they just auto-skip without the bypass.
