// Helper: get a Clerk session via the /api/e2e-bypass endpoint.
//
// Tests use this in beforeEach to skip Clerk OTP flow:
//
//   const ticket = await getBypassTicket(request);
//   await page.goto(`/login?ticket=${ticket}`);
//   await page.waitForURL('**/welcome');
//
// Returns null if the bypass is disabled (any env gate fails). Tests
// that depend on auth should call test.skip() based on this.

import type { APIRequestContext } from '@playwright/test';

export async function getBypassTicket(request: APIRequestContext): Promise<string | null> {
  const phone = process.env.E2E_TEST_PHONE;
  const otp = process.env.E2E_TEST_OTP;
  if (!phone || !otp) return null;

  const res = await request.post('/api/e2e-bypass', {
    data: { phone, otp },
    failOnStatusCode: false,
  });
  if (res.status() !== 200) return null;
  const body = (await res.json()) as { ok?: boolean; token?: string };
  if (!body.ok || !body.token) return null;
  return body.token;
}
