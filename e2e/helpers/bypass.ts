// Helper: previously got a Clerk session via the /api/e2e-bypass
// endpoint.
//
// !!! BYPASS ROUTE DELETED 2026-05-15 !!!
// The /api/e2e-bypass route was removed per audit + PRODUCTION-READINESS
// §D pre-public-launch checklist — a public auth-bypass route in prod
// code is a SOC 2 CC6.1 fail even with four env gates (one operator
// env push turns it on). This helper now always returns null; the
// POST will 404. Existing tests rely on `test.skip(!ticket, ...)` and
// will auto-skip. The Playwright suite needs a Clerk Testing Tokens
// rebuild before it works against real auth again — tracked as a
// follow-up task.
//
// Once the rebuild lands, `getBypassTicket` should be replaced by a
// `getTestingSessionToken` helper using Clerk's official testing
// primitive (https://clerk.com/docs/testing/playwright/overview).

import type { APIRequestContext } from '@playwright/test';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function getBypassTicket(_request: APIRequestContext): Promise<string | null> {
  // No-op stub. Returns null so existing call sites'
  // `test.skip(!ticket, ...)` guard fires and the test is reported as
  // skipped rather than failed. See header comment.
  return null;
}
