// @docket/docusign-shared
//
// Shared DocuSign primitives used by BOTH command-room (preparer flows
// — request envelope, refresh status, void) AND client-portal
// (taxpayer flows — re-mint embedded signing URL on /sign-8879/[id]).
//
// Why the package: pre-extraction, jwt.ts + envelope.ts were duplicated
// byte-for-byte across both apps. The codex MEDIUM finding on the 270e7f1
// DocuSign 8879 ship flagged this — a future change to either file (new
// API endpoint, extra header, retry logic) had to be reapplied twice or
// silently drift between the two apps.
//
// What's NOT here: the server actions themselves (request-sign-8879.ts,
// refresh-signature-status.ts, void-envelope.ts in command-room;
// get-embedded-signing-url.ts in client-portal) stay in their respective
// apps because they reach into app-specific auth (getCurrentDocketUser
// vs portal session resolver), tenant-credential vaults, and rate limits
// that are app-bound. This package owns ONLY the API-call primitives.
//
// API surface:
//   getDocuSignAccessToken — JWT mint + token exchange
//   createEnvelope         — POST /envelopes (body builder + auth)
//   createRecipientView    — POST /views/recipient (mint embedded URL)

export {
  getDocuSignAccessToken,
  type DocuSignJwtInput,
  type DocuSignTokenResult,
} from './jwt.js';

export {
  createEnvelope,
  createRecipientView,
  type CreateEnvelopeInput,
  type CreateEnvelopeResult,
  type CreateRecipientViewInput,
  type CreateRecipientViewResult,
} from './envelope.js';
