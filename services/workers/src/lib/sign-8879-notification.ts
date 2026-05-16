// Workers-side 8879 SMS notification helper.
//
// Counterpart to apps/command-room/src/lib/docusign/send-8879-
// notification.ts. Same shape (Twilio send + audit-row write +
// bilingual body) but adapted for the workers runtime:
//   - No Sentry (workers use the Inngest logger instead)
//   - No requireRole (cron context, not user-initiated)
//   - Takes a db + tenantId from the caller (the cron's per-tenant
//     loop already has withTenant context)
//
// The pure function `buildMessageBody` is duplicated from the
// command-room helper. ~30 lines of pure-function duplication is
// cheaper than expanding @docket/docusign-shared to depend on
// @docket/db + @docket/shared (which it currently doesn't). When a
// third caller needs it, extract to a shared package.
//
// THIS HELPER IS CALLED FROM
//   services/workers/src/functions/send-8879-reminders.ts — the
//   hourly cron that walks pending 8879 signatures + fires repeat
//   reminders per reminder_rules cadence.
//
// AUDIT POLICY
//   Every send writes an actions row with toolName='send8879Notification'
//   + tool_input.signatureRowId set. The reminder cron uses this same
//   audit-row count to track attempt count + interval — no migration
//   needed for an attempts counter column.

import { eq } from 'drizzle-orm';
import {
  getTenantCredential,
  schema,
  type DocketDb,
} from '@docket/db';
import { asTenantId, type TenantId, type UserId } from '@docket/shared';

const CLIENT_PORTAL_URL =
  process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ?? 'https://docket-portal.vercel.app';

export type Send8879NotificationResult =
  | { ok: true; sid: string; toMasked: string; sentAt: number }
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
  /** Drizzle client scoped to the firm's tenant (via withTenant). */
  db: DocketDb;
  tenantId: TenantId;
  /**
   * User-id to attribute the send to in the audit chain. Cron sends
   * use the tenant's firm-owner user id (the cron acts on behalf of
   * the firm); manual sends use the requesting Antonio's user id.
   */
  attributedUserId: UserId;
  /** Display name to render in the body's "— X" sign-off line. */
  senderFullName: string | null;
  signatureRowId: string;
  clientId: string;
  taxYear: number;
  /** Optional flag tagged onto the audit row's tool_input. Helps
   *  distinguish initial sends from reminder-cron sends in the audit
   *  trail without adding a new column. */
  isReminder?: boolean;
  /** Attempt number (1 for first send; 2+ for reminders). Stamped
   *  on the audit row for query-friendly cadence inspection. */
  attemptNumber?: number;
}

/** Mask phone to "+1•••••1234" for audit logs. */
export function maskPhone(phone: string): string {
  if (phone.length < 5) return '••••';
  return `${phone.slice(0, 2)}•••••${phone.slice(-4)}`;
}

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
 * Bilingual message body. Same logic as the command-room helper —
 * duplicated to keep workers free of cross-app imports.
 */
export function buildMessageBody(input: {
  clientFirstName: string;
  senderFirstName: string;
  signingUrl: string;
  taxYear: number;
  preferredLanguage: string | null | undefined;
  isReminder?: boolean;
}): string {
  const isSpanish = input.preferredLanguage === 'es';
  // Reminders use a slightly different opener that acknowledges the
  // prior un-signed state without making the client feel chased.
  const opener_en = input.isReminder
    ? `Hi ${input.clientFirstName}, quick reminder — your ${input.taxYear} Form 8879 (e-file authorization) is still waiting on your signature.`
    : `Hi ${input.clientFirstName}, your ${input.taxYear} Form 8879 (e-file authorization) is ready to sign.`;
  const opener_es = input.isReminder
    ? `Hola ${input.clientFirstName}, recordatorio rápido — tu Formulario 8879 (autorización de presentación electrónica) del ${input.taxYear} aún espera tu firma.`
    : `Hola ${input.clientFirstName}, tu Formulario 8879 (autorización de presentación electrónica) del ${input.taxYear} está listo para firmar.`;
  if (isSpanish) {
    return (
      `${opener_es}\n\n` +
      `Firma aquí: ${input.signingUrl}\n\n` +
      `El IRS requiere verificación de identidad — responderás 5 preguntas cortas ` +
      `antes de firmar. Tarda unos 3 minutos.\n\n` +
      `— ${input.senderFirstName}`
    );
  }
  return (
    `${opener_en}\n\n` +
    `Sign here: ${input.signingUrl}\n\n` +
    `The IRS requires identity verification — you'll answer 5 short ` +
    `multiple-choice questions before signing. Takes about 3 minutes.\n\n` +
    `— ${input.senderFirstName}`
  );
}

export async function send8879NotificationWorker(
  input: Send8879NotificationInput,
): Promise<Send8879NotificationResult> {
  const startedAt = Date.now();

  // 1. Load client.
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
      message: `Client ${input.clientId} not found`,
    };
  }
  if (!client.phone) {
    return {
      ok: false,
      reason: 'no-phone',
      message: 'Client has no phone number on file',
    };
  }

  // 2. Load tenant Twilio creds.
  const creds = await getTenantCredential(input.db, asTenantId(input.tenantId), 'twilio');
  if (!creds) {
    return {
      ok: false,
      reason: 'no-twilio-creds',
      message: 'Twilio not configured for this tenant',
    };
  }

  // 3. Sender ≠ recipient guard.
  if (creds.fromNumber === client.phone) {
    return {
      ok: false,
      reason: 'self-send',
      message: 'Sender and recipient phone are identical',
    };
  }

  // 4. Build URL + body.
  const signingUrl = `${CLIENT_PORTAL_URL}/portal/sign-8879/${input.signatureRowId}`;
  const body = buildMessageBody({
    clientFirstName: firstNameOf(client.fullName),
    senderFirstName: senderFirstNameOf(input.senderFullName),
    signingUrl,
    taxYear: input.taxYear,
    preferredLanguage: client.preferredLanguage,
    isReminder: input.isReminder,
  });

  // 5. POST to Twilio.
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
    await writeAuditRow(input.db, {
      tenantId: input.tenantId,
      clientId: input.clientId,
      userId: input.attributedUserId,
      signatureRowId: input.signatureRowId,
      toMasked: maskPhone(client.phone),
      ok: false,
      errorMessage: err instanceof Error ? err.message : 'network',
      latencyMs: Date.now() - startedAt,
      bodyChars: body.length,
      isReminder: input.isReminder ?? false,
      attemptNumber: input.attemptNumber ?? 1,
    });
    return {
      ok: false,
      reason: 'network',
      message: err instanceof Error ? err.message : 'Network error reaching Twilio',
    };
  }

  if (!response.ok) {
    let twilioMsg = `HTTP ${response.status}`;
    try {
      const errBody = (await response.json()) as { message?: string; code?: number };
      if (errBody?.message) twilioMsg = `${twilioMsg}: ${errBody.message}`;
      if (errBody?.code) twilioMsg = `${twilioMsg} (code ${errBody.code})`;
    } catch {
      // non-JSON; keep status-only
    }
    await writeAuditRow(input.db, {
      tenantId: input.tenantId,
      clientId: input.clientId,
      userId: input.attributedUserId,
      signatureRowId: input.signatureRowId,
      toMasked: maskPhone(client.phone),
      ok: false,
      errorMessage: twilioMsg,
      latencyMs: Date.now() - startedAt,
      bodyChars: body.length,
      isReminder: input.isReminder ?? false,
      attemptNumber: input.attemptNumber ?? 1,
    });
    return { ok: false, reason: 'twilio-rejected', message: twilioMsg };
  }

  const json = (await response.json()) as { sid?: string; status?: string };
  const sid = json.sid;
  if (!sid) {
    await writeAuditRow(input.db, {
      tenantId: input.tenantId,
      clientId: input.clientId,
      userId: input.attributedUserId,
      signatureRowId: input.signatureRowId,
      toMasked: maskPhone(client.phone),
      ok: false,
      errorMessage: 'response missing sid',
      latencyMs: Date.now() - startedAt,
      bodyChars: body.length,
      isReminder: input.isReminder ?? false,
      attemptNumber: input.attemptNumber ?? 1,
    });
    return {
      ok: false,
      reason: 'twilio-rejected',
      message: 'Twilio response missing SID',
    };
  }

  const sentAt = Date.now();
  await writeAuditRow(input.db, {
    tenantId: input.tenantId,
    clientId: input.clientId,
    userId: input.attributedUserId,
    signatureRowId: input.signatureRowId,
    toMasked: maskPhone(client.phone),
    ok: true,
    twilioSid: sid,
    twilioStatus: json.status ?? 'queued',
    latencyMs: sentAt - startedAt,
    bodyChars: body.length,
    isReminder: input.isReminder ?? false,
    attemptNumber: input.attemptNumber ?? 1,
  });

  return {
    ok: true,
    sid,
    toMasked: maskPhone(client.phone),
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
  isReminder: boolean;
  attemptNumber: number;
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
        template: row.isReminder ? '8879-reminder' : '8879-signing-link',
        isReminder: row.isReminder,
        attemptNumber: row.attemptNumber,
      },
      toolOutput: row.ok
        ? { ok: true, sid: row.twilioSid, twilioStatus: row.twilioStatus }
        : { ok: false, error: row.errorMessage ?? 'unknown' },
      latencyMs: row.latencyMs,
      success: row.ok,
      errorMessage: row.ok ? null : row.errorMessage ?? null,
    });
  } catch {
    // Audit-write failure is non-blocking; the cron's Inngest logger
    // surfaces the broader pattern. Same posture as the command-room
    // helper.
  }
}
