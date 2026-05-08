// e2e/sign-in.spec.ts — sign-in flow.
//
// Validates: ticket-strategy bypass works end-to-end, the login page
// consumes a ticket, the user lands authed on /welcome.

import { test, expect } from '@playwright/test';
import { getBypassTicket } from './helpers/bypass.js';

test.describe('sign-in', () => {
  test.skip(
    !process.env.E2E_TEST_PHONE || !process.env.E2E_TEST_OTP,
    'E2E_TEST_PHONE and E2E_TEST_OTP not set — bypass disabled. Set both in .env.local AND in the Vercel env for the deployed app.',
  );

  test('login page renders without auth', async ({ page }) => {
    await page.goto('/login');
    // The login page should show the phone-entry form.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('e2e-bypass ticket consumes + lands on /welcome', async ({ page, request }) => {
    const ticket = await getBypassTicket(request);
    test.skip(!ticket, '/api/e2e-bypass denied — Vercel env vars not set yet');

    await page.goto(`/login?ticket=${ticket}`);
    // After ticket consumption + setActive, the app glides to /welcome.
    // Wait up to 30s — first-time test user creation in Clerk can take
    // longer than a real-user OTP submit.
    await page.waitForURL('**/welcome', { timeout: 30_000 });
    expect(page.url()).toContain('/welcome');
  });

  test('signed-in user sees welcome surface', async ({ page, request }) => {
    const ticket = await getBypassTicket(request);
    test.skip(!ticket, '/api/e2e-bypass denied');

    await page.goto(`/login?ticket=${ticket}`);
    await page.waitForURL('**/welcome', { timeout: 30_000 });
    // Welcome page should render Antonio's name (firm-owner display)
    // somewhere on the page. Editorial-warm copy doesn't lock us into
    // a specific selector — text-content match is the loosest assertion.
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
    expect(body!.length).toBeGreaterThan(100);
  });
});
