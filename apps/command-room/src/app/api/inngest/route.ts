// Inngest serve handler.
//
// Inngest's platform discovers + invokes worker functions by hitting
// this endpoint. Three HTTP methods are exposed:
//   - PUT  → app sync (Inngest pulls function definitions on deploy)
//   - POST → function invocation (Inngest fires events at us)
//   - GET  → health / metadata
//
// The functions array comes from @docket/workers — that's where the
// classify-document, finalize-document, and Gmail workers are defined.
// The inngest client is the same singleton used to SEND events from
// client-portal (lives in @docket/shared/inngest as a subpath export
// to avoid pulling node:async_hooks into the client portal browser
// bundle).
//
// Auth model: Inngest's serve handler validates incoming POST signatures
// against INNGEST_SIGNING_KEY (set on Vercel env vars by the Inngest
// Vercel integration). Unauthenticated requests get rejected by the
// SDK before reaching any function. This route does NOT need its own
// auth gate.

import { serve } from 'inngest/next';
import { inngest, functions } from '@docket/workers';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
