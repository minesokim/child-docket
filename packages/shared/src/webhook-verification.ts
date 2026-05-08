// Webhook signature verification — defends every webhook endpoint we ship.
//
// THE ATTACK
//   Without verification, anyone with the URL can POST a forged event:
//     - Forged Square "payment.completed" → mark a client paid without paying
//     - Forged DocuSign "envelope.completed" → mark 8879 signed without signing
//     - Forged Twilio inbound SMS → trigger AI flow with attacker-controlled body
//   Plus: webhook URLs leak (server logs, browser history, QA scripts), so
//   "the URL is secret" is not a defense.
//
// THE DEFENSE
//   Every webhook provider signs requests with a shared secret. We verify.
//   Each provider has subtle quirks — wrong implementation = silent
//   bypass, so we implement per-provider and unit-test each.
//
// SHAPES
//   - Twilio:    HMAC-SHA1, base64, over `url + sortedFormParams.join('')`,
//                header `X-Twilio-Signature`
//   - Square:    HMAC-SHA256, base64, over `notificationUrl + rawBody`,
//                header `X-Square-HmacSha256-Signature`
//   - DocuSign:  HMAC-SHA256, base64, over `rawBody`,
//                header `X-DocuSign-Signature-1` (also -2, -3 during rotation)
//   - Inngest:   handled by `inngest/next` serve helper internally —
//                we just ensure INNGEST_SIGNING_KEY is set in production
//                (assertion lives in apps/command-room/src/app/api/inngest/route.ts).
//                No verifier exported here.
//
// ALL VERIFIERS USE TIMING-SAFE COMPARE
//   Naive `expected === actual` comparison leaks the secret one byte at a
//   time via timing side-channel. Every helper here uses
//   `crypto.timingSafeEqual` so an attacker can't probe the signature.
//
// ALL VERIFIERS RETURN BOOLEAN
//   Never throw on bad signature — caller decides the response (typically
//   401 + log, sometimes silently drop). Throwing leaks "I tried to verify"
//   vs "verification succeeded" via timing.

import { createHmac, timingSafeEqual } from 'node:crypto';

// ────────────────────────────────────────────────────────────────
// Internal: timing-safe base64 compare with length normalization.
//
// timingSafeEqual throws on mismatched buffer lengths — we want false
// instead of an exception, so we early-return when lengths differ.
// This DOES leak "lengths differ" via timing, but in practice each
// provider produces signatures of a fixed length (HMAC-SHA1 base64 = 28
// chars, HMAC-SHA256 base64 = 44 chars), so an attacker who already
// knows the provider learns nothing useful from the length channel.
// The decoy timingSafeEqual call below is a defense-in-depth no-op
// (over a zero-buffer of the actual signature's length); it does NOT
// fully equalize timing across all branches of this function. Treat
// the boolean return value as the security contract.
// ────────────────────────────────────────────────────────────────
function timingSafeEqualBase64(expected: string, actual: string): boolean {
  let expectedBuf: Buffer;
  let actualBuf: Buffer;
  try {
    expectedBuf = Buffer.from(expected, 'base64');
    actualBuf = Buffer.from(actual, 'base64');
  } catch {
    // Buffer.from with invalid base64 doesn't typically throw — it's
    // lenient and produces best-effort bytes. The catch here is
    // defense-in-depth in case of future Node API changes.
    return false;
  }
  if (expectedBuf.length !== actualBuf.length) {
    // Decoy compare to flatten timing somewhat. Not a true constant-
    // time guarantee — see header comment above.
    timingSafeEqual(actualBuf, Buffer.alloc(actualBuf.length));
    return false;
  }
  if (expectedBuf.length === 0) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}

// ────────────────────────────────────────────────────────────────
// TWILIO
//
// Twilio signs the URL + form-encoded body params. The "params" part
// is unusual: Twilio sorts the FORM keys alphabetically and concatenates
// `key + value` for each. NOT URL-encoded. NOT JSON. Form-data only.
//
// For application/json webhooks (newer Twilio products), they sign the
// raw body bytes directly with a different scheme. v0 of Docket only
// uses Twilio for SMS (form-encoded), so we cover that case.
//
// Reference: https://www.twilio.com/docs/usage/webhooks/webhooks-security
// ────────────────────────────────────────────────────────────────

export type TwilioWebhookInput = {
  /** The full URL Twilio POSTed to, including query string if any. */
  url: string;
  /** Form-decoded body params. Order does not matter — we sort. */
  params: Record<string, string>;
  /** The X-Twilio-Signature header value. */
  signatureHeader: string;
  /** Twilio auth token from the project console. */
  authToken: string;
};

export function verifyTwilioSignature(input: TwilioWebhookInput): boolean {
  if (!input.signatureHeader) return false;
  if (!input.authToken) return false;

  // Twilio: sort param keys alphabetically, concat as `key + value` per
  // pair, prepend the URL, HMAC-SHA1 with auth token, base64-encode.
  const sortedKeys = Object.keys(input.params).sort();
  let payload = input.url;
  for (const key of sortedKeys) {
    payload += key + (input.params[key] ?? '');
  }

  const computed = createHmac('sha1', input.authToken)
    .update(payload, 'utf8')
    .digest('base64');

  return timingSafeEqualBase64(computed, input.signatureHeader);
}

// ────────────────────────────────────────────────────────────────
// SQUARE
//
// Square signs the configured notification URL + raw request body.
// The notification URL MUST match what's configured in the Square
// dashboard, character-for-character. Differences (trailing slash,
// query string, http vs https) cause verification to fail.
//
// Reference: https://developer.squareup.com/docs/webhooks/step3validate
// ────────────────────────────────────────────────────────────────

export type SquareWebhookInput = {
  /** The notification URL configured in the Square dashboard. */
  notificationUrl: string;
  /** Raw request body as a string (NOT parsed JSON). */
  rawBody: string;
  /** The X-Square-HmacSha256-Signature header value. */
  signatureHeader: string;
  /** Square's webhook signature key (NOT the API access token). */
  signatureKey: string;
};

export function verifySquareSignature(input: SquareWebhookInput): boolean {
  if (!input.signatureHeader) return false;
  if (!input.signatureKey) return false;

  const computed = createHmac('sha256', input.signatureKey)
    .update(input.notificationUrl + input.rawBody, 'utf8')
    .digest('base64');

  return timingSafeEqualBase64(computed, input.signatureHeader);
}

// ────────────────────────────────────────────────────────────────
// DOCUSIGN CONNECT
//
// DocuSign signs raw request body with HMAC-SHA256. The signature
// arrives in `X-DocuSign-Signature-1`. During key rotation DocuSign
// may send -2 and -3 headers — we accept any matching one (rotation
// is short-lived, both keys valid simultaneously).
//
// The `secrets` parameter accepts an array so callers can pass
// [current, previous] during rotation windows. Most of the time it's
// a single-element array.
//
// Reference: https://developers.docusign.com/platform/webhooks/connect-hmac/
// ────────────────────────────────────────────────────────────────

export type DocuSignWebhookInput = {
  /** Raw request body bytes as a string. */
  rawBody: string;
  /**
   * All `X-DocuSign-Signature-*` header values. Accept multiple to
   * tolerate key rotation windows.
   */
  signatureHeaders: string[];
  /**
   * HMAC secrets from the DocuSign Connect configuration. During
   * rotation, pass [newKey, oldKey]. Verification succeeds if any
   * (signature, secret) pair matches.
   */
  secrets: string[];
};

export function verifyDocuSignSignature(input: DocuSignWebhookInput): boolean {
  if (input.signatureHeaders.length === 0) return false;
  if (input.secrets.length === 0) return false;

  // Try every (header, secret) pair. Verification succeeds on first
  // match. This is the rotation-tolerant path.
  for (const secret of input.secrets) {
    if (!secret) continue;
    const computed = createHmac('sha256', secret)
      .update(input.rawBody, 'utf8')
      .digest('base64');
    for (const header of input.signatureHeaders) {
      if (!header) continue;
      if (timingSafeEqualBase64(computed, header)) {
        return true;
      }
    }
  }
  return false;
}

// ────────────────────────────────────────────────────────────────
// HELPER: extract DocuSign signature headers from a Headers object.
//
// Next.js Request.headers is a Headers instance. DocuSign sends
// `x-docusign-signature-1`, `-2`, `-3` (lowercase per HTTP norm).
// This helper collects all of them in a stable order.
// ────────────────────────────────────────────────────────────────
export function extractDocuSignSignatureHeaders(headers: Headers): string[] {
  const out: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const v = headers.get(`x-docusign-signature-${i}`);
    if (v) out.push(v);
  }
  return out;
}

// ────────────────────────────────────────────────────────────────
// ENVIRONMENT-VARIABLE GUARDS
//
// In production, missing webhook secrets must FAIL CLOSED rather than
// silently accept everything. These helpers throw at first use if the
// expected env var isn't set in production.
//
// In development (NODE_ENV !== 'production'), the helpers return a
// warning string instead of throwing — local devs without the secret
// can still hit the webhook endpoint with a header that won't verify
// (and they'll see a 401, the right behavior).
// ────────────────────────────────────────────────────────────────

export function requireWebhookSecretInProd(envVarName: string, value: string | undefined): string {
  if (value && value.length > 0) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `${envVarName} is required in production — webhook signature verification cannot run without it. ` +
        `Set the env var on Vercel and redeploy.`,
    );
  }
  console.warn(
    `[webhook-verification] ${envVarName} not set in development — verification will fail. ` +
      `Set it in .env.local for local webhook testing.`,
  );
  return '';
}
