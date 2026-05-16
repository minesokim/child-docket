// Webhook replay-protection dedup helper.
//
// Pairs with migration 0037 (webhook_events table). Every inbound
// webhook handler that mutates state (square, docusign, twilio,
// future resend) calls tryRecordWebhookEvent() AFTER signature
// verification + BEFORE the state-changing work. If isFirst=false,
// the handler returns 200 + skips the mutation.
//
// THE ATTACK THIS BLOCKS
//   An attacker who captured a legitimate signed webhook from a
//   server log (or man-in-the-middle, etc.) can replay it
//   indefinitely. The HMAC signature stays valid forever because
//   it binds only the body, not a timestamp. Three concrete
//   exploits surfaced in the Session 6 audit:
//     - Square refund.created replay accumulates
//       payments.refundedCents on every replay (CRITICAL).
//     - DocuSign envelope-completed replay flips signatures.status
//       from 'declined' or 'kba-failed' back to 'signed'
//       (CRITICAL — potential 8879 audit fraud).
//     - Twilio inbound-sms replay re-writes audit rows + fires
//       the triage classifier multiple times.
//
// WHY UNIQUE-CONSTRAINT-BASED DEDUP RATHER THAN APPLICATION-LAYER
//   CHECK
//   A race between two concurrent retries of the same event from
//   the provider would slip through a SELECT-then-INSERT check.
//   INSERT ... ON CONFLICT DO NOTHING is atomic at the storage
//   layer — exactly one row wins, the other gets ON CONFLICT, no
//   double-processing. Same idiom as Square's own webhook retry
//   recipe.
//
// EVENT-ID CANON BY PROVIDER
//   Square:   payload.event_id (a UUID Square issues per event)
//   DocuSign: payload.uri      (DocuSign's unique resource URL per event)
//   Twilio:   payload.MessageSid (globally unique per inbound message)
//   Resend:   svix-message-id header (Resend uses Svix for webhooks)
//
// SECURITY
//   The dedup INSERT runs ONLY after signature verification passes.
//   An attacker who sends an unsigned or bad-signature event hits a
//   401 before this helper runs, so they cannot fill the table with
//   junk and cause legit events to be misclassified as replays.

import { sql } from 'drizzle-orm';
import type { DocketDb } from './client.js';

export type WebhookProvider = 'square' | 'docusign' | 'twilio' | 'resend';

export interface TryRecordResult {
  /** true if this is the first time we've seen (provider, eventId).
   *  false if a row already existed (= replay). */
  isFirst: boolean;
}

/**
 * Atomic dedup. INSERT a (provider, event_id) row; if the row
 * existed already (UNIQUE constraint hit), return isFirst=false so
 * the caller can short-circuit a replay.
 *
 * The caller MUST have already verified the webhook's signature
 * before calling this. Otherwise an attacker can fill webhook_events
 * with junk event_ids and DoS the table.
 *
 * @param db        Drizzle client. May be getAdminDb() — the table
 *                  has no RLS so the connection role doesn't need
 *                  bypass.
 * @param provider  Allowlisted provider name. Migration 0037
 *                  CHECK constraint enforces the allowlist at the
 *                  DB layer too.
 * @param eventId   Provider-issued unique event id (Square event_id,
 *                  DocuSign uri, Twilio MessageSid, Resend
 *                  svix-message-id).
 */
export async function tryRecordWebhookEvent(
  db: DocketDb,
  provider: WebhookProvider,
  eventId: string,
): Promise<TryRecordResult> {
  if (!eventId || eventId.length === 0) {
    // No event id supplied — can't dedup. Treat as first-seen so
    // the handler still processes (better to over-process than
    // silently drop a legit event with a missing id). The handler
    // should log this case as a warning so an operator can chase
    // the provider's payload shape.
    return { isFirst: true };
  }

  const rows = await db.execute<{ id: string }>(sql`
    INSERT INTO webhook_events (provider, event_id)
    VALUES (${provider}, ${eventId})
    ON CONFLICT (provider, event_id) DO NOTHING
    RETURNING id::text AS id
  `);
  const arr = rows as unknown as Array<{ id: string }>;
  return { isFirst: arr.length > 0 };
}
