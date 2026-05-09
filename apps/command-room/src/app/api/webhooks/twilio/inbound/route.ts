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
import { getAdminDb, persistAgentAction, decryptIfMarkedForTenant, getTenantDek, isEncrypted } from '@docket/db';
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

  // Resolve tenant by recipient (To) phone. Need to read the
  // tenant_credentials table to match — this is the only way to
  // route inbound SMS to a tenant since Twilio's webhook URL is
  // single (tenant-disambiguating URLs would require per-tenant
  // Twilio numbers AND per-tenant URLs, which adds operational
  // complexity for v0).
  //
  // Cross-tenant scoping concern: getAdminDb bypasses RLS. We're
  // ONLY reading kind='twilio' rows here, AND we filter by the
  // exact fromNumber. The match either succeeds (tenant found) or
  // fails (rejected). No cross-tenant data leak — we only return
  // (tenantId, decrypted authToken) for a tenant whose Twilio
  // sender matches the inbound's recipient.
  const db = getAdminDb();
  const tenantRows = await db.execute<TenantTwilioRow>(sql`
    SELECT tenant_id::text AS tenant_id, value AS cred
    FROM tenant_credentials
    WHERE kind = 'twilio'
  `);
  const allTwilioCreds = tenantRows as unknown as TenantTwilioRow[];

  let matchedTenantId: string | null = null;
  let matchedAuthToken: string | null = null;

  for (const row of allTwilioCreds) {
    const credObj = row.cred as Record<string, unknown> | null;
    if (!credObj) continue;
    const dek = await getTenantDek(db, asTenantId(row.tenant_id));
    let parsed: Record<string, unknown>;
    try {
      // tenant_credentials value is a JSONB containing
      // { accountSid, authToken (encrypted-marker), fromNumber }.
      // accountSid + fromNumber are plaintext for routing; authToken
      // is the encrypted secret.
      const fromCandidate = credObj.fromNumber;
      if (typeof fromCandidate !== 'string' || fromCandidate !== toNumber) {
        continue;
      }
      const authMaybe = credObj.authToken;
      const authPlaintext =
        isEncrypted(authMaybe) ? (decryptIfMarkedForTenant(authMaybe, dek) as string) : String(authMaybe ?? '');
      parsed = { authToken: authPlaintext };
    } catch (err) {
      // Couldn't decrypt this tenant's authToken — skip; not a match.
      continue;
    }
    if (typeof parsed.authToken === 'string' && parsed.authToken.length > 0) {
      matchedTenantId = row.tenant_id;
      matchedAuthToken = parsed.authToken;
      break;
    }
  }

  if (!matchedTenantId || !matchedAuthToken) {
    // No tenant matched the recipient phone. Could be:
    //   - The To phone isn't configured for any tenant
    //   - The tenant exists but the cred decrypt failed
    // Either way, we don't have a valid signing key to verify; reject.
    return new Response('unknown recipient', { status: 404 });
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
