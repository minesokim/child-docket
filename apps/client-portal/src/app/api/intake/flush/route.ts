// API route — flush pending intake field writes during page unload.
//
// Why this exists separately from the saveIntakeField Server Action:
// Server Actions are RPC'd via Next.js's internal POST mechanism, which
// browsers cancel when the tab is closing. navigator.sendBeacon (and
// fetch with keepalive: true) are guaranteed to send during unload.
//
// The handler accepts a batch of pending writes from IntakeProvider's
// flush handler and runs each through the same saveIntakeField pipeline
// (auth, validation, per-tenant encryption, audit log). Failures don't
// surface to the user — the tab is closing, there's nowhere to put a
// toast. Failures land in Sentry instead.
//
// THREAT MODEL DELTA
//   sendBeacon over HTTPS includes cookies, so Clerk auth() picks up the
//   session normally. Sensitive plaintext (SSN/EIN/bank) crosses the
//   wire here under TLS — same as a regular saveIntakeField call.
//   Server-side encryption + audit log handle the rest.

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { saveIntakeField } from '@/lib/intake-actions';

type FlushWrite = { path: string; value: unknown };
type FlushBody = { writes: FlushWrite[] };

const MAX_WRITES_PER_FLUSH = 50;

export async function POST(req: Request): Promise<Response> {
  let body: FlushBody;
  try {
    body = (await req.json()) as FlushBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body?.writes)) {
    return NextResponse.json({ ok: false, error: 'writes must be an array' }, { status: 400 });
  }

  if (body.writes.length === 0) {
    return NextResponse.json({ ok: true, applied: 0 });
  }

  if (body.writes.length > MAX_WRITES_PER_FLUSH) {
    // Cap. A real intake will never need to flush 50 fields at once;
    // an unbounded array is a footgun for DoS via large payloads.
    return NextResponse.json(
      { ok: false, error: `Too many writes (max ${MAX_WRITES_PER_FLUSH})` },
      { status: 400 },
    );
  }

  // Apply each write. Don't bail on a single failure — flush is
  // best-effort, the user is leaving the page. Capture errors to Sentry
  // (already PII-scrubbed by the beforeSend hook) so we can debug
  // patterns later.
  const results = await Promise.all(
    body.writes.map(async (write) => {
      try {
        const result = await saveIntakeField(write.path, write.value);
        return { path: write.path, ok: result.ok };
      } catch (error) {
        Sentry.captureException(error, {
          tags: { component: 'intake-flush', path: write.path },
        });
        return { path: write.path, ok: false };
      }
    }),
  );

  const succeeded = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, applied: succeeded, total: results.length });
}
