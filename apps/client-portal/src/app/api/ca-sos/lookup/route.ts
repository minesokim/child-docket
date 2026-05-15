// API route — CA SoS BE Public Search lookup for /business-info intake.
//
// Antonio's intake feedback (2026-05-14): when a CA-addressed business
// types their legal name, surface the entity's CA SoS standing live.
// Catches FTB Suspended / Forfeited / Dissolved before the engagement
// gets deep enough that the discovery hurts.
//
// SECURITY POSTURE
//   - CA_SOS_API_KEY must NEVER appear in the client bundle. This
//     route handler runs server-side, reads the key from env, and
//     proxies the request. The browser only sees the bucketed result.
//   - Rate-limited per Clerk user id (4 lookups per 10s; an intake
//     might legitimately retype the name a few times but never spam).
//   - Input validated: legalName trimmed, max 200 chars, min 2.
//   - On 429 from CA SoS Azure APIM the route returns 429 to the
//     client so the UI can backoff gracefully.
//
// GRACEFUL DEGRADATION
//   - Missing CA_SOS_API_KEY → returns 200 with { ok: false, reason:
//     'unconfigured' }. Intake never blocks; the pill stays hidden.
//   - Network timeout (3s) → returns 200 with { ok: false, reason:
//     'network' }. Same UI handling.
//
// NOT BUILT YET (V1.5 follow-ups, captured here for the next pass)
//   - Per-tenant API key (firm-owned subscription). V0 uses the
//     Docket-shared key. When the founder-50 cohort onboards a firm
//     with their own CA SoS subscription, swap to per-tenant.
//   - Caching at the route layer. CA SoS records change rarely (weeks
//     to months). A short-TTL cache would cut Azure APIM cost during
//     intake retypes.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { consumeRateToken, fetchCaSoSEntity, normalizeCaSoSQuery } from '@docket/shared';

export const runtime = 'nodejs';

type LookupBody = { legalName?: unknown };

export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  // 4 lookups per 10s per user. An intake might legitimately type the
  // legal name slightly differently a couple of times; spamming the
  // API past that is either a bug or abuse.
  const limit = consumeRateToken(`ca-sos:${userId}`, 4, 10_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, reason: 'rate_limited' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) },
      },
    );
  }

  let body: LookupBody;
  try {
    body = (await req.json()) as LookupBody;
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 });
  }

  const raw = typeof body.legalName === 'string' ? body.legalName : '';
  const query = normalizeCaSoSQuery(raw);
  if (query.length < 2 || query.length > 200) {
    return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 });
  }

  // Key is server-only. NEVER expose to the client bundle, NEVER log
  // the key in error paths (the fetchCaSoSEntity helper returns a
  // narrow reason enum without surfacing the key).
  const apiKey = process.env.CA_SOS_API_KEY ?? '';
  if (!apiKey) {
    // Soft-fail. The pill stays hidden; intake proceeds normally.
    return NextResponse.json({ ok: false, reason: 'unconfigured' });
  }

  const result = await fetchCaSoSEntity(query, apiKey, { timeoutMs: 3000 });
  return NextResponse.json(result);
}
