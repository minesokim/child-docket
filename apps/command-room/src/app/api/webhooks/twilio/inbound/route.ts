// /api/webhooks/twilio/inbound — Twilio Messages webhook for inbound SMS.
//
// Twilio POSTs here when a client replies to an SMS Antonio sent.
// Body is form-encoded (application/x-www-form-urlencoded). We:
//   1. Verify the X-Twilio-Signature header (HMAC-SHA1 via shared helper)
//   2. Identify the tenant by the recipient (To) phone matching
//      tenant_credentials.twilio.fromNumber. This is the "which firm
//      did the client text?" lookup.
//   3. Match the sender (From) phone to a client in that tenant
//   4. Insert an inbound action row (action_class='read',
//      tool_name='twilio.inbound-sms')
//   5. Fire an event for the triage classifier (sms/inbound). The
//      classifier picks it up the same way it picks up gmail messages.
//
// Twilio expects a 200 response within ~15 seconds. We do the
// signature verify + lookup + audit row write inline, then fire the
// event and return immediately. The triage classifier runs async via
// Inngest.
//
// SECURITY
//   - Signature verification BEFORE any DB read. A spoofed POST
//     can't even leak whether a phone number is registered.
//   - Public route (no Clerk gate) — Twilio doesn't carry user
//     credentials. Already allowlisted in middleware.
//   - Rate-limit at the Vercel edge layer (Twilio is the only legit
//     caller; abuse blocked by signature failure).

import { type NextRequest } from 'next/server';
import { sql } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  getAdminDb,
  persistAgentAction,
  decryptIfMarkedForTenant,
  getTenantDek,
  isEncrypted,
  tryRecordWebhookEvent,
} from '@docket/db';
import { asTenantId, asClientId } from '@docket/shared';
import { verifyTwilioSignature } from '@docket/shared/webhooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TenantTwilioRow {
  tenant_id: string;
  cred: unknown;
  [key: string]: unknown;
}

interface ClientMatchRow {
  id: string;
  full_name: string;
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  const url = req.url;
  const signatureHeader = req.headers.get('x-twilio-signature') ?? '';
  const rawBody = await req.text();

  // Parse form-encoded body into params object for verification.
  const params: Record<string, string> = {};
  const searchParams = new URLSearchParams(rawBody);
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const fromNumber = params['From'];
  const toNumber = params['To'];
  const body = params['Body'] ?? '';
  const messageSid = params['MessageSid'] ?? '';

  if (!fromNumber || !toNumber) {
    return new Response('missing From/To', { status: 400 });
  }

  // Resolve tenant by recipient (To) phone. Session 6 webhook audit
  // (2026-05-15) rewrote this lookup. The previous implementation
  // SELECTed ALL tenant_credentials rows where kind='twilio', then
  // looped in app code fetching every tenant's DEK + attempting an
  // AES-GCM decrypt to find the matching authToken. Two issues:
  //   1. DoS: each request did N DB reads (DEK lookup) + N decrypt
  //      attempts where N = number of Twilio-configured tenants.
  //      An unauthenticated attacker could sustainably DoS by
  //      POSTing garbage to this public endpoint.
  //   2. Tenant enumeration via timing: response latency differed
  //      based on whether the To number matched a configured
  //      tenant (decrypt overhead is observable).
  //
  // Fix: pre-filter in SQL by value->>'fromNumber' (plaintext
  // routing key inside the JSONB). The query returns at most ONE
  // row (one tenant per Twilio number is the invariant). We then
  // fetch one DEK + do one decrypt.
  //
  // Cross-tenant scoping concern: getAdminDb bypasses RLS. We're
  // ONLY reading the kind='twilio' row whose fromNumber matches
  // the inbound's To. No data leak — the SQL filter does the
  // narrowing.
  const db = getAdminDb();
  const tenantRows = await db.execute<TenantTwilioRow>(sql`
    SELECT tenant_id::text AS tenant_id, value AS cred
    FROM tenant_credentials
    WHERE kind = 'twilio'
      AND value->>'fromNumber' = ${toNumber}
    LIMIT 1
  `);
  const candidate = (tenantRows as unknown as TenantTwilioRow[])[0] ?? null;

  let matchedTenantId: string | null = null;
  let matchedAuthToken: string | null = null;

  if (candidate) {
    const credObj = candidate.cred as Record<string, unknown> | null;
    if (credObj) {
      try {
        const dek = await getTenantDek(db, asTenantId(candidate.tenant_id));
        const authMaybe = credObj.authToken;
        const authPlaintext = isEncrypted(authMaybe)
          ? (decryptIfMarkedForTenant(authMaybe, dek) as string)
          : String(authMaybe ?? '');
        if (authPlaintext.length > 0) {
          matchedTenantId = candidate.tenant_id;
          matchedAuthToken = authPlaintext;
        }
      } catch {
        // DEK fetch or decrypt failed — treat as no match. Sentry
        // breadcrumb so an operator chasing "tenant configured but
        // not receiving SMS" has a trail.
        Sentry.captureMessage(
          'twilio inbound: matched fromNumber but authToken decrypt failed',
          {
            level: 'warning',
            tags: { component: 'twilio-inbound', tenant: candidate.tenant_id },
          },
        );
      }
    }
  }

  // Single 401 response for BOTH unknown-recipient and bad-signature
  // paths. Returning 404 ("unknown recipient") here would leak which
  // To numbers are registered to an attacker probing the endpoint —
  // they could enumerate Antonio's Twilio numbers by response code.
  // 401 + "signature invalid" gives an attacker no information
  // beyond "auth failed" regardless of cause.
  if (!matchedTenantId || !matchedAuthToken) {
    return new Response('signature invalid', { status: 401 });
  }

  // Verify the signature using the matched tenant's auth token.
  const verified = verifyTwilioSignature({
    url,
    params,
    signatureHeader,
    authToken: matchedAuthToken,
  });
  if (!verified) {
    Sentry.captureMessage('twilio inbound: signature verification failed', {
      level: 'warning',
      tags: { component: 'twilio-inbound', tenant: matchedTenantId },
    });
    return new Response('signature invalid', { status: 401 });
  }

  // Replay-protection dedup (Session 6 webhook audit, migration 0037).
  // MessageSid is Twilio's globally-unique per-message identifier.
  // Twilio retries delivery on non-2xx for up to 4 hours; we want
  // each retry to be idempotent. INSERT ON CONFLICT DO NOTHING is
  // the dedup primitive. A captured-from-the-wire replayed legit
  // event hits this same dedup, so an attacker can't spam the
  // actions table by replaying a single valid signature indefinitely.
  if (messageSid) {
    const dedup = await tryRecordWebhookEvent(db, 'twilio', messageSid);
    if (!dedup.isFirst) {
      console.log(
        `[twilio-inbound] replay of MessageSid ${messageSid} — already processed; dropping`,
      );
      return new Response('', { status: 200 });
    }
  }

  // Match the sender (From) phone to a client.
  const clientRows = await db.execute<ClientMatchRow>(sql`
    SELECT id::text AS id, full_name
    FROM clients
    WHERE tenant_id = ${matchedTenantId}::uuid
      AND phone = ${fromNumber}
    LIMIT 1
  `);
  const client = ((clientRows as unknown as ClientMatchRow[])[0]) ?? null;

  // Audit row — always written, even when client unmatched (so
  // Antonio sees "an SMS came in from <unknown>" in the activity feed).
  const persist = persistAgentAction({
    textPreviewLength: 280,
    extraToolInput: {
      twilioMessageSid: messageSid,
      fromLast4: fromNumber.slice(-4),
      toLast4: toNumber.slice(-4),
      clientMatched: client !== null,
    },
  });
  try {
    await persist({
      tenantId: asTenantId(matchedTenantId),
      clientId: client ? asClientId(client.id) : null,
      userId: null,
      agentId: null,
      actionClass: 'read',
      toolName: 'twilio.inbound-sms',
      toolInput: {},
      toolOutput: { body },
      modelUsed: null,
      inputTokens: null,
      outputTokens: null,
      cachedTokens: null,
      costUsd: null,
      latencyMs: 0,
      success: true,
      errorMessage: null,
    });
  } catch (auditErr) {
    Sentry.captureException(auditErr, {
      tags: { component: 'twilio-inbound-audit', tenant: matchedTenantId },
    });
    // Don't fail the webhook on audit-row error — the SMS is real.
  }

  // TODO(week-1): fire an Inngest event sms/inbound that the
  // triage classifier consumes (mirror of gmail/message.received).
  // The classifier already exists; just needs the event-shape +
  // function wire-up. For now, the audit row IS the surface — the
  // /home recent-activity feed will render it as
  // "twilio.inbound-sms ...".

  // Twilio expects either an empty 200 OR a TwiML response. Empty
  // 200 is fine for v0 (no auto-reply). Returning text/xml with
  // <Response/> later if we want to send an autoresponder.
  return new Response('', { status: 200 });
}
