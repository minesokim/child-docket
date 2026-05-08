// Sentry verification endpoint — deliberately throws.
//
// Mirror of apps/command-room/src/app/api/sentry-test/route.ts but
// tagged `app:portal`. Hit once per deployment to confirm pipeline:
//
//   curl https://docket-portal.vercel.app/api/sentry-test?flag=verify-sentry-2026-05-08
//
// Sentry: new event tagged `app:portal` within ~30s.
//
// REMOVE before public launch (V1.5 hardening). Tracked in
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

  Sentry.setTag('verification', 'manual');
  Sentry.setContext('verification_metadata', {
    trigger_time: new Date().toISOString(),
    triggered_via: 'GET /api/sentry-test',
    purpose:
      'Verify Sentry capture pipeline + app:portal tag + scrubber path.',
  });

  throw new DocketSentryVerificationError(
    'Sentry verification trigger — if you are reading this in Sentry, the pipeline is working. Tag should be app:portal.',
  );
}
