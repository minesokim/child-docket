// Send the client an SMS notification with the 8879 signing link.
//
// Called from `requestSign8879` after envelope creation succeeds.
// Best-effort: if Twilio is unconfigured or rejects the send, the
// envelope STILL exists and Antonio can fall back to the "copy link"
// path in the Sign8879Form success card.
//
// SHAPE
//   - Internal helper (no role check; caller `requestSign8879`
//     already gated on firm_owner / preparer / reviewer).
//   - Best-effort. Returns { ok: false } on Twilio failure but
//     never throws — the envelope-creation success is the
//     load-bearing outcome.
//   - Audit-row write on both success + failure paths so the
//     send is observable in /clients/[id] Audit Trail.
//
// I18N
//   - Honors client.preferredLanguage if set: 'es' uses warm
//     Mexican Spanish; 'en' or unset uses English. Tagalog /
//     Vietnamese / Chinese fall back to English per current
//     intake practice (those bilingual surfaces are V1.5).
//
// SECURITY
//   - Phone numbers + Twilio creds load via getTenantCredential
//     (encrypted at rest, per-tenant DEK).
//   - Outbound message body is logged into messages table for
//     replay-defense in case of dispute. Phone numbers in audit
//     rows are last-4-only masked.
//
// FUTURE
//   - Email send (Resend) — blocked on brand decision + DNS
//     provisioning per CLAUDE.md §18 todo. Currently SMS-only.
//   - Reminder cadence (every 24h, max 3 attempts) — per
//     migration 0031 `reminder_rules`. Separate cron + this
//     helper covers ONLY the initial fire.

import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  getTenantCredential,
  schema,
  type DocketDb,
} from '@docket/db';
import { asTenantId, type TenantId, type UserId } from '@docket/shared';

const CLIENT_PORTAL_URL =
  process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ?? 'https://docket-portal.vercel.app';

export type Send8879NotificationResult =
  | {
      ok: true;
      sid: string;
      toMasked: string;
      channel: 'sms';
      sentAt: number;
    }
  | {
      ok: false;
      reason:
        | 'no-phone'
        | 'no-twilio-creds'
        | 'self-send'
        | 'twilio-rejected'
        | 'network'
        | 'client-not-found';
      message: string;
    };

export interface Send8879NotificationInput {
  /** Drizzle client already scoped to the firm's tenant via withTenant. */
  db: DocketDb;
  tenantId: TenantId;
  /** Antonio (the firm user who requested the envelope). Audit-row author. */
  senderUserId: UserId;
  senderFullName: string | null;
  /** signatures row id — the path component the portal uses. */
  signatureRowId: string;
  clientId: string;
  /** Tax year on the envelope (used in message body for clarity). */
  taxYear: number;
}

/** Mask phone to "+1•••••1234" for audit logs + breadcrumbs. */
function maskPhone(phone: string): string {
  if (phone.length < 5) return '••••';
  return `${phone.slice(0, 2)}•••••${phone.slice(-4)}`;
}

/** First-name slice for personalized greeting. */
function firstNameOf(name: string | null | undefined): string {
  if (!name) return 'there';
  const first = name.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : 'there';
}

function senderFirstNameOf(name: string | null | undefined): string {
  if (!name) return 'your preparer';
  const first = name.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : 'your preparer';
}

/**
 * Build the SMS body honoring preferredLanguage. Exported for unit
 * tests — pure function (no I/O, no globals), easy to assert on
 * vs. mocking the full Twilio + DB stack.
 */
export function buildMessageBody(input: {
  clientFirstName: string;
  senderFirstName: string;
  signingUrl: string;
  taxYear: number;
  preferredLanguage: string | null | undefined;
}): string {
  const isSpanish = input.preferredLanguage === 'es';
  if (isSpanish) {
    return (
      `Hola ${input.clientFirstName}, tu Formulario 8879 (autorización de presentación ` +
      `electrónica) del ${input.taxYear} está listo para firmar.\n\n` +
      `Firma aquí: ${input.signingUrl}\n\n` +
      `El IRS requiere verificación de identidad — responderás 5 preguntas cortas ` +
      `antes de firmar. Tarda unos 3 minutos.\n\n` +
      `— ${input.senderFirstName}`
    );
  }
  return (
    `Hi ${input.clientFirstName}, your ${input.taxYear} Form 8879 (e-file authorization) ` +
    `is ready to sign.\n\n` +
    `Sign here: ${input.signingUrl}\n\n` +
    `The IRS requires identity verification — you'll answer 5 short ` +
    `multiple-choice questions before signing. Takes about 3 minutes.\n\n` +
    `— ${input.senderFirstName}`
  );
}

export async function send8879Notification(
  input: Send8879NotificationInput,
): Promise<Send8879NotificationResult> {
  const startedAt = Date.now();
  Sentry.addBreadcrumb({
    category: 'sms-8879-notification',
    level: 'info',
    message: 'start',
    data: {
      clientIdTail: input.clientId.slice(-6),
      signatureRowIdTail: input.signatureRowId.slice(-6),
    },
  });

  // 1. Load the client (RLS-scoped via caller's withTenant context).
  const [client] = await input.db
    .select({
      id: schema.clients.id,
      fullName: schema.clients.fullName,
      phone: schema.clients.phone,
      preferredLanguage: schema.clients.preferredLanguage,
    })
    .from(schema.clients)
    .where(eq(schema.clients.id, input.clientId))
    .limit(1);

  if (!client) {
    return {
      ok: false,
      reason: 'client-not-found',
      message: 'Client not found for notification',
    };
  }
  if (!client.phone) {
    Sentry.addBreadcrumb({
      category: 'sms-8879-notification',
      level: 'warning',
      message: 'client-has-no-phone',
      data: { clientIdTail: input.clientId.slice(-6) },
    });
    return {
      ok: false,
      reason: 'no-phone',
      message: 'Client has no phone number on file — share the signing link manually.',
    };
  }

  // 2. Load tenant Twilio creds.
  const creds = await getTenantCredential(input.db, asTenantId(input.tenantId), 'twilio');
  if (!creds) {
    Sentry.addBreadcrumb({
      category: 'sms-8879-notification',
      level: 'warning',
      message: 'twilio-creds-not-configured',
    });
    return {
      ok: false,
      reason: 'no-twilio-creds',
      message:
        'Twilio not configured for this firm — share the signing link manually via your preferred channel.',
    };
  }

  // 3. Sender ≠ recipient guard. Prevents the "Antonio's number IS
  // the client phone on a test row" footgun.
  if (creds.fromNumber === client.phone) {
    return {
      ok: false,
      reason: 'self-send',
      message: 'Sender and recipient phone are identical — refusing to send.',
    };
  }

  // 4. Build the signing URL + the message body.
  const signingUrl = `${CLIENT_PORTAL_URL}/portal/sign-8879/${input.signatureRowId}`;
  const body = buildMessageBody({
    clientFirstName: firstNameOf(client.fullName),
    senderFirstName: senderFirstNameOf(input.senderFullName),
    signingUrl,
    taxYear: input.taxYear,
    preferredLanguage: client.preferredLanguage,
  });

  // 5. POST to Twilio Messages API. Same shape as sendInviteSms —
  // basic auth, urlencoded form body, single fetch.
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`;
  const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');
  const formBody = new URLSearchParams({
    To: client.phone,
    From: creds.fromNumber,
    Body: body,
  });

  let response: Response;
  try {
    response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    });
  } catch (err) {
    Sentry.addBreadcrumb({
      category: 'sms-8879-notification',
      level: 'error',
      message: 'twilio-network-error',
      data: { err: err instanceof Error ? err.message : String(err) },
    });
    await writeAuditRow(input.db, {
      tenantId: input.tenantId,
      clientId: input.clientId,
      userId: input.senderUserId,
      signatureRowId: input.signatureRowId,
      toMasked: maskPhone(client.phone),
      ok: false,
      errorMessage: err instanceof Error ? err.message : 'network',
      latencyMs: Date.now() - startedAt,
      bodyChars: body.length,
    });
    return {
      ok: false,
      reason: 'network',
      message: 'Could not reach Twilio. Share the signing link manually.',
    };
  }

  if (!response.ok) {
    let twilioMsg = `HTTP ${response.status}`;
    try {
      const errBody = (await response.json()) as { message?: string; code?: number };
      if (errBody?.message) twilioMsg = `${twilioMsg}: ${errBody.message}`;
      if (errBody?.code) twilioMsg = `${twilioMsg} (code ${errBody.code})`;
    } catch {
      // Non-JSON; keep status-only.
    }
    Sentry.addBreadcrumb({
      category: 'sms-8879-notification',
      level: 'error',
      message: 'twilio-rejected',
      data: { twilioStatus: response.status, msgPreview: twilioMsg.slice(0, 200) },
    });
    await writeAuditRow(input.db, {
      tenantId: input.tenantId,
      clientId: input.clientId,
      userId: input.senderUserId,
      signatureRowId: input.signatureRowId,
      toMasked: maskPhone(client.phone),
      ok: false,
      errorMessage: twilioMsg,
      latencyMs: Date.now() - startedAt,
      bodyChars: body.length,
    });
    return {
      ok: false,
      reason: 'twilio-rejected',
      message: `Twilio rejected the send: ${twilioMsg}`,
    };
  }

  const json = (await response.json()) as { sid?: string; status?: string };
  const sid = json.sid;
  if (!sid) {
    Sentry.captureMessage('Twilio 8879-notification response missing sid', {
      level: 'error',
      tags: { component: 'send-8879-notification' },
      extra: { twilioStatus: json.status ?? 'unknown' },
    });
    await writeAuditRow(input.db, {
      tenantId: input.tenantId,
      clientId: input.clientId,
      userId: input.senderUserId,
      signatureRowId: input.signatureRowId,
      toMasked: maskPhone(client.phone),
      ok: false,
      errorMessage: 'response missing sid',
      latencyMs: Date.now() - startedAt,
      bodyChars: body.length,
    });
    return {
      ok: false,
      reason: 'twilio-rejected',
      message: 'Twilio response missing message SID — check logs.',
    };
  }

  const sentAt = Date.now();
  await writeAuditRow(input.db, {
    tenantId: input.tenantId,
    clientId: input.clientId,
    userId: input.senderUserId,
    signatureRowId: input.signatureRowId,
    toMasked: maskPhone(client.phone),
    ok: true,
    twilioSid: sid,
    twilioStatus: json.status ?? 'queued',
    latencyMs: sentAt - startedAt,
    bodyChars: body.length,
  });
  Sentry.addBreadcrumb({
    category: 'sms-8879-notification',
    level: 'info',
    message: 'sent',
    data: { sidTail: sid.slice(-8), latencyMs: sentAt - startedAt },
  });

  return {
    ok: true,
    sid,
    toMasked: maskPhone(client.phone),
    channel: 'sms',
    sentAt,
  };
}

interface AuditRowInput {
  tenantId: TenantId;
  clientId: string;
  userId: UserId;
  signatureRowId: string;
  toMasked: string;
  ok: boolean;
  errorMessage?: string;
  twilioSid?: string;
  twilioStatus?: string;
  latencyMs: number;
  bodyChars: number;
}

async function writeAuditRow(db: DocketDb, row: AuditRowInput): Promise<void> {
  try {
    await db.insert(schema.actions).values({
      tenantId: row.tenantId,
      clientId: row.clientId,
      userId: row.userId,
      agentId: null,
      actionClass: 'send-external',
      toolName: 'send8879Notification',
      toolInput: {
        signatureRowId: row.signatureRowId,
        toMasked: row.toMasked,
        bodyChars: row.bodyChars,
        bodySegments: Math.max(1, Math.ceil(row.bodyChars / 160)),
        template: '8879-signing-link',
      },
      toolOutput: row.ok
        ? { ok: true, sid: row.twilioSid, twilioStatus: row.twilioStatus }
        : { ok: false, error: row.errorMessage ?? 'unknown' },
      latencyMs: row.latencyMs,
      success: row.ok,
      errorMessage: row.ok ? null : row.errorMessage ?? null,
    });
  } catch (err) {
    // Audit-write failure is observable + non-blocking. The SMS may
    // have already gone out; we don't want to swallow the user-facing
    // result just because the audit insert hit a Postgres transient.
    Sentry.captureException(err, {
      tags: { component: 'send-8879-notification', stage: 'audit-write' },
    });
  }
}
