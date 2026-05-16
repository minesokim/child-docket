'use server';

// Send the client invite SMS via Twilio.
//
// Wires up the previously-greyed-out "Send via SMS" button on the
// /clients/new success card. Per-tenant Twilio creds live in the
// tenant_credentials vault (encrypted with the firm's DEK); we fetch
// them, format an E.164 message with the firm-owner's first name +
// signed-in URL, POST to Twilio's REST API, audit-log the send.
//
// SECURITY POSTURE
//   - Role-gate: firm_owner | preparer | reviewer | admin (assistant
//     blocked — same gate as createClient).
//   - Rate-limit: 6 sends per minute per Clerk user. Enough for a
//     preparer onboarding ~6 clients/min (unusually fast); blocks
//     a compromised session from blasting hundreds of SMS.
//   - Audit row per send. action_class = 'send-external'. tool_input
//     records clientId + masked phone + which template; tool_output
//     records Twilio SID. Phone is masked to last-4 in the audit row
//     to avoid creating a queryable PII honeypot.
//   - Phone validation: client must belong to the user's tenant
//     (RLS-bound via withTenant) AND have a non-null phone.
//
// FAILURE MODES
//   - Twilio creds not configured for tenant → "Twilio not configured"
//   - Tenant Twilio sender number same as recipient → blocked
//   - Twilio API error → real status code + body surfaced to client
//   - Rate limit exceeded → retry-after seconds in error message

import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  withTenant,
  schema,
  getTenantCredential,
} from '@docket/db';
import {
  asTenantId,
  consumeRateToken,
} from '@docket/shared';
import { requireRole } from '@/lib/require-role';
import { assertWritable } from '@/lib/read-only-mode';

export type SendInviteSmsResult =
  | { ok: true; sid: string; toMasked: string; sentAt: number }
  | { ok: false; error: string };

const CLIENT_PORTAL_URL =
  process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ?? 'https://docket-portal.vercel.app';

/** Mask a phone to "+1•••••1234" for audit logs. */
function maskPhone(phone: string): string {
  if (phone.length < 5) return '••••';
  return `${phone.slice(0, 2)}•••••${phone.slice(-4)}`;
}

/** First name for the firm owner, e.g. "Antonio" from "Antonio Vazquez". */
function firstNameOf(name: string | null | undefined): string {
  if (!name) return 'your preparer';
  return name.trim().split(/\s+/)[0] || 'your preparer';
}

/** Country-code guess from a US-or-CA-or-other phone for the prefilled login. */
function countryOf(e164: string): string {
  if (e164.startsWith('+1')) return 'US';
  if (e164.startsWith('+52')) return 'MX';
  if (e164.startsWith('+82')) return 'KR';
  if (e164.startsWith('+86')) return 'CN';
  if (e164.startsWith('+91')) return 'IN';
  if (e164.startsWith('+63')) return 'PH';
  if (e164.startsWith('+84')) return 'VN';
  if (e164.startsWith('+44')) return 'GB';
  if (e164.startsWith('+55')) return 'BR';
  return 'US';
}

export async function sendInviteSms(
  clientId: string,
  /**
   * Optional custom body. When the preparer edits the SMS textarea on
   * the success card, this is the rewritten string. When absent, the
   * server falls back to the same templated body the UI shows by
   * default (so the contract is "what you see is what gets sent").
   *
   * Length-bounded: 10..1500 chars. 1500 ~= 10 SMS segments — generous
   * upper bound for follow-up reminders or longer firm-style messages.
   * The 10-char floor catches accidental clears.
   */
  customBody?: string,
): Promise<SendInviteSmsResult> {
  Sentry.addBreadcrumb({
    category: 'sms-invite',
    level: 'info',
    message: 'start',
    data: { clientIdTail: clientId.slice(-6), hasCustomBody: customBody != null },
  });
  const startedAt = Date.now();

  try {
    // 1. Auth + role gate.
    const user = await requireRole(['firm_owner', 'preparer', 'reviewer', 'admin']);
    Sentry.addBreadcrumb({
      category: 'sms-invite',
      level: 'info',
      message: 'user-authorized',
      data: { role: user.role },
    });
    await assertWritable();

    // 2. Rate limit. 6/min/user — same shape as the unlock flow.
    const limit = consumeRateToken(`sms-invite:${user.clerkUserId}`, 6, 60_000);
    if (!limit.allowed) {
      Sentry.addBreadcrumb({
        category: 'sms-invite',
        level: 'warning',
        message: 'rate-limited',
        data: { retryAfterMs: limit.retryAfterMs },
      });
      return {
        ok: false,
        error: `Too many SMS sends. Try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      };
    }

    return await withTenant(asTenantId(user.tenantId), async (db) => {
      // 3. Load the client (RLS-scoped — only this firm's clients are visible).
      const [client] = await db
        .select({
          id: schema.clients.id,
          fullName: schema.clients.fullName,
          phone: schema.clients.phone,
        })
        .from(schema.clients)
        .where(eq(schema.clients.id, clientId))
        .limit(1);

      if (!client) {
        Sentry.addBreadcrumb({
          category: 'sms-invite',
          level: 'warning',
          message: 'client-not-found',
          data: { clientIdTail: clientId.slice(-6) },
        });
        return { ok: false, error: 'Client not found' };
      }
      if (!client.phone) {
        Sentry.addBreadcrumb({
          category: 'sms-invite',
          level: 'warning',
          message: 'client-has-no-phone',
          data: { clientIdTail: clientId.slice(-6) },
        });
        return { ok: false, error: 'Client has no phone number on file' };
      }

      // 4. Load tenant Twilio creds.
      const creds = await getTenantCredential(db, asTenantId(user.tenantId), 'twilio');
      if (!creds) {
        Sentry.addBreadcrumb({
          category: 'sms-invite',
          level: 'warning',
          message: 'twilio-creds-not-configured',
        });
        return {
          ok: false,
          error:
            'Twilio not configured for this firm. Run `pnpm --filter @docket/db set-tenant-cred --tenant=<slug> --kind=twilio` to set it up.',
        };
      }
      Sentry.addBreadcrumb({
        category: 'sms-invite',
        level: 'info',
        message: 'twilio-creds-loaded',
        data: { fromNumberMasked: maskPhone(creds.fromNumber) },
      });

      // 5. Sender ≠ recipient (prevents foot-gunning).
      if (creds.fromNumber === client.phone) {
        return { ok: false, error: 'Refusing to send: sender and recipient phone are identical.' };
      }

      // 6. Build the message. If the caller passed a customBody (the
      //    preparer edited the textarea), validate + use it. Otherwise
      //    fall back to the same template the UI default-fills, so
      //    "Send via SMS" without any edit still works.
      const country = countryOf(client.phone);
      const url = `${CLIENT_PORTAL_URL}/login?phone=${encodeURIComponent(client.phone)}&country=${country}`;
      const firstName = client.fullName.split(/\s+/)[0] ?? client.fullName;
      const senderFirstName = firstNameOf(user.name);
      const defaultBody = `Hi ${firstName}, this is ${senderFirstName}. Your tax intake portal is ready. Sign in with this phone number (${client.phone}): ${url}`;

      let body: string;
      if (customBody != null) {
        const trimmed = customBody.trim();
        if (trimmed.length < 10) {
          return { ok: false, error: 'Message is too short (minimum 10 characters).' };
        }
        if (trimmed.length > 1500) {
          return {
            ok: false,
            error: `Message is too long (${trimmed.length} chars; max 1500).`,
          };
        }
        body = trimmed;
      } else {
        body = defaultBody;
      }

      // 7. POST to Twilio Messages API.
      // https://www.twilio.com/docs/messaging/api/message-resource#create-a-message-resource
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`;
      const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');
      const formBody = new URLSearchParams({
        To: client.phone,
        From: creds.fromNumber,
        Body: body,
      });
      Sentry.addBreadcrumb({
        category: 'sms-invite',
        level: 'info',
        message: 'twilio-post-start',
        data: { toMasked: maskPhone(client.phone) },
      });

      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody.toString(),
      });

      if (!response.ok) {
        // Twilio returns JSON error bodies — surface the message for
        // debugging. Common: 400 with "Unable to create record: ..."
        // for sender/recipient verification issues, 401 for bad creds,
        // 403 for unverified-trial-recipient.
        let twilioMsg = `HTTP ${response.status}`;
        try {
          const errBody = (await response.json()) as { message?: string; code?: number };
          if (errBody?.message) twilioMsg = `${twilioMsg}: ${errBody.message}`;
          if (errBody?.code) twilioMsg = `${twilioMsg} (code ${errBody.code})`;
        } catch {
          // Non-JSON error body — fall back to status-only.
        }
        Sentry.addBreadcrumb({
          category: 'sms-invite',
          level: 'error',
          message: 'twilio-rejected',
          data: { twilioStatus: response.status, twilioMessage: twilioMsg.slice(0, 200) },
        });

        // Audit the failure too — trying to send and failing is itself
        // an event worth keeping (rate-limit calibration, abuse detection).
        await db.insert(schema.actions).values({
          tenantId: user.tenantId,
          clientId,
          userId: user.id,
          agentId: null,
          actionClass: 'send-external',
          toolName: 'sendInviteSms',
          toolInput: {
            clientId,
            toMasked: maskPhone(client.phone),
            template: customBody != null ? 'custom' : 'invite-default',
            bodyChars: body.length,
            bodySegments: Math.max(1, Math.ceil(body.length / 160)),
          },
          toolOutput: { ok: false, error: twilioMsg },
          latencyMs: Date.now() - startedAt,
          success: false,
          errorMessage: twilioMsg,
        });

        return { ok: false, error: `Twilio error: ${twilioMsg}` };
      }

      const json = (await response.json()) as { sid?: string; status?: string };
      const sid = json.sid;
      if (!sid) {
        Sentry.captureMessage('Twilio response missing sid', {
          level: 'error',
          tags: { component: 'command-room-send-invite-sms', stage: 'twilio-response-parse' },
          extra: { twilioStatus: json.status ?? 'unknown' },
        });
        return { ok: false, error: 'Twilio response missing message SID — check logs.' };
      }

      // 8. Audit the success.
      const sentAt = Date.now();
      const latencyMs = sentAt - startedAt;
      await db.insert(schema.actions).values({
        tenantId: user.tenantId,
        clientId,
        userId: user.id,
        agentId: null,
        actionClass: 'send-external',
        toolName: 'sendInviteSms',
        toolInput: { clientId, toMasked: maskPhone(client.phone), template: 'invite' },
        toolOutput: { ok: true, sid, twilioStatus: json.status ?? 'queued' },
        latencyMs,
        success: true,
      });
      Sentry.addBreadcrumb({
        category: 'sms-invite',
        level: 'info',
        message: 'sent',
        data: { sidTail: sid.slice(-8), latencyMs },
      });

      return { ok: true, sid, toMasked: maskPhone(client.phone), sentAt };
    });
  } catch (error) {
    // Sentry captures the exception with the breadcrumb trail above —
    // no need to redundantly console.error the message/stack (Vercel
    // logs aren't a compliance sink; Sentry is).
    Sentry.captureException(error, {
      tags: { component: 'command-room-send-invite-sms', stage: 'outer-catch' },
    });
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Send failed: ${error.message}`
          : 'Send failed — check server logs',
    };
  }
}
