// Sentry verification endpoint — deliberately throws.
//
// Hit this once per deployment to confirm Sentry is capturing errors:
//
//   curl https://docket-command-room.vercel.app/api/sentry-test
//
// Response: 500 with a JSON error payload.
// Sentry: should show a new event tagged `app:command-room` within ~30s.
//
// Behind a query-param flag so a random visitor / search crawler
// doesn't accidentally pollute the error dashboard. The flag value is
// non-secret — just an obscurity guard, not auth. Anyone with the
// route can trigger by passing the flag.
//
// REMOVE THIS ROUTE before public launch (V1.5 hardening). Tracked in
// PRODUCTION-READINESS §B "observability + cost control."

import { type NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRIGGER_FLAG = 'verify-sentry-2026-05-08';

class DocketSentryVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocketSentryVerificationError';
  }
}

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const flag = url.searchParams.get('flag');

  if (flag !== TRIGGER_FLAG) {
    return Response.json(
      {
        ok: false,
        error: 'forbidden',
        hint: `pass ?flag=${TRIGGER_FLAG} to trigger`,
      },
      { status: 403 },
    );
  }

  // Add structured context that should appear on the Sentry event.
  // The PII scrubber (sentry-scrubber.ts) strips sensitive-keyed fields
  // before transmission, so this 'test_user' tag is safe.
  Sentry.setTag('verification', 'manual');
  Sentry.setContext('verification_metadata', {
    trigger_time: new Date().toISOString(),
    triggered_via: 'GET /api/sentry-test',
    purpose:
      'Verify Sentry capture pipeline + app:command-room tag + scrubber path.',
  });

  // Build a NAMED error class so it's easily searchable in Sentry's UI
  // and doesn't get coalesced with real production errors.
  const err = new DocketSentryVerificationError(
    'Sentry verification trigger — if you are reading this in Sentry, the pipeline is working. Tag should be app:command-room.',
  );

  // EXPLICIT CAPTURE + FLUSH.
  //
  // Why not rely on Sentry's `onRequestError` auto-capture (exported
  // from instrumentation.ts)? On Vercel serverless, the lambda
  // terminates immediately after the response is sent. Sentry's
  // transport batches events for ~1s before sending; auto-captured
  // events from a thrown error sometimes miss this window because
  // the lambda dies before flush completes.
  //
  // The reliable pattern is: capture explicitly, await flush with a
  // generous timeout, THEN throw. This guarantees the event lands
  // in Sentry before the lambda exits.
  //
  // 2s flush timeout is conservative — Sentry transport typically
  // completes in <500ms; padding for cold starts.
  const eventId = Sentry.captureException(err);
  await Sentry.flush(2000);

  // Surface the eventId in the response (developer convenience —
  // copy/paste into Sentry to find this exact event).
  return Response.json(
    {
      ok: false,
      error: 'sentry_verification_thrown',
      event_id: eventId,
      hint: 'check https://noctworks.sentry.io/issues/ — search for DocketSentryVerificationError',
    },
    { status: 500 },
  );
}
