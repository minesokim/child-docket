// E2E auth bypass — Playwright + automation only.
//
// !!! SECURITY-SENSITIVE !!!
// This endpoint bypasses normal Clerk OTP verification. It is gated
// by FOUR INDEPENDENT env vars; ALL must be set for any bypass to
// occur. The default-prod-disabled gate is the safety net — even
// if the bypass code is in the production deploy, the bypass refuses
// to fire unless an additional explicit env var is set on the
// production environment.
//
// REMOVE BEFORE PUBLIC LAUNCH. Tracked in
// docs/PRODUCTION-READINESS.md launch-prep checklist.
//
// HOW IT WORKS
//   POST /api/e2e-bypass
//     Body: { phone: string, otp: string }
//     Headers: none required
//
//   Validates the four gates. If all pass:
//     1. Find or create a Clerk user with the test phone.
//     2. Generate a Clerk sign-in TOKEN via the Backend SDK (this is
//        Clerk's standard E2E-testing primitive).
//     3. Return the token in the JSON response.
//     4. Client (Playwright) navigates to
//        /login?ticket=<token>, the login page detects the ticket
//        param and calls signIn.create({strategy:'ticket', ticket})
//        + setActive() to consume it.
//
//   Sentry tagged: every successful + failed bypass fires a Sentry
//   event with severity=warning + tag e2e_bypass=true. Anyone with
//   Sentry access can see if this is being abused.
//
// THE FOUR GATES
//   1. E2E_BYPASS_ENABLED=true                — master switch
//   2. E2E_TEST_PHONE matches submitted phone — exact match
//   3. E2E_TEST_OTP matches submitted otp     — exact match
//   4. NODE_ENV != 'production' OR E2E_ALLOW_PROD_BYPASS=true
//                                              — explicit prod ack
//
// ANY gate fails → 403, no information disclosed about which gate.
// ALL gates pass → 200 with sign-in token.

import { type NextRequest } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface BypassBody {
  phone?: string;
  otp?: string;
}

function gatesPass(body: BypassBody): { pass: boolean; reason?: string } {
  if (process.env.E2E_BYPASS_ENABLED !== 'true') {
    return { pass: false, reason: 'master_disabled' };
  }
  const expectedPhone = process.env.E2E_TEST_PHONE;
  const expectedOtp = process.env.E2E_TEST_OTP;
  if (!expectedPhone || !expectedOtp) {
    return { pass: false, reason: 'env_unset' };
  }
  if (body.phone !== expectedPhone || body.otp !== expectedOtp) {
    return { pass: false, reason: 'mismatch' };
  }
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.E2E_ALLOW_PROD_BYPASS !== 'true'
  ) {
    return { pass: false, reason: 'prod_not_acked' };
  }
  return { pass: true };
}

export async function POST(req: NextRequest) {
  let body: BypassBody;
  try {
    body = (await req.json()) as BypassBody;
  } catch {
    body = {};
  }

  const gate = gatesPass(body);
  if (!gate.pass) {
    // Don't tell the caller which gate failed — same response shape
    // for every failure to avoid information disclosure.
    Sentry.captureMessage('e2e-bypass denied', {
      level: 'warning',
      tags: { e2e_bypass: 'denied', reason: gate.reason ?? 'unknown' },
    });
    return Response.json({ ok: false }, { status: 403 });
  }

  const phone = body.phone!;

  try {
    const clerk = await clerkClient();

    // Find or create the test user.
    const existing = await clerk.users.getUserList({ phoneNumber: [phone] });
    let userId: string;
    if (existing.data.length > 0) {
      userId = existing.data[0]!.id;
    } else {
      const created = await clerk.users.createUser({
        phoneNumber: [phone],
        skipPasswordRequirement: true,
      });
      userId = created.id;
    }

    // Generate a sign-in token. Clerk's documented E2E pattern.
    // The token is single-use + short-lived (default 30s); the client
    // consumes it via signIn.create({strategy:'ticket', ticket}).
    const token = await clerk.signInTokens.createSignInToken({
      userId,
      expiresInSeconds: 60,
    });

    Sentry.captureMessage('e2e-bypass granted', {
      level: 'warning',
      tags: { e2e_bypass: 'granted', phone_masked: phone.slice(0, 5) + '***' },
    });

    return Response.json({ ok: true, token: token.token, userId });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { e2e_bypass: 'error' },
    });
    return Response.json(
      { ok: false, error: 'bypass_internal_error' },
      { status: 500 },
    );
  }
}
