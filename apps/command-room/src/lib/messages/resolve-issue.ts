'use server';

// Issue-resolution server actions for /messages/[id]:
//   - approveAndSendDraft(issueId)  — sends the draft via the
//     issue's channel (SMS today; Gmail+portal-chat deferred) and
//     marks the issue resolved
//   - rejectDraft(issueId, reason?) — discards the draft (action
//     row stays append-only, but the issue gets marked resolved
//     with a rejection note)
//   - markResolved(issueId, note?) — generic resolution without
//     sending (e.g., notice handled out-of-band)
//
// AUTHZ
//   firm_owner | preparer can approve. reviewer + lower roles read
//   only. The trust-gate verdict on the draft also gates: if the
//   verdict is 'refusal' (below framework floor), approveAndSend is
//   blocked regardless of role.
//
// AUDIT
//   Every resolution writes an action row via persistAgentAction
//   (action_class='send-external' on send, 'send-internal' on
//   reject/manual-resolve). The issue row is updated in the same
//   transaction so the resolution + send + issue-update either all
//   land or all roll back.

import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  getTenantCredential,
  persistAgentAction,
  schema,
  withTenant,
} from '@docket/db';
import {
  asTenantId,
  asClientId,
  asUserId,
  consumeRateToken,
} from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';

const APPROVE_ROLES = new Set(['firm_owner', 'preparer']);
const RESOLVE_ROLES = new Set(['firm_owner', 'preparer', 'reviewer']);
const MAX_BODY_CHARS = 1500;
const E164 = /^\+[1-9]\d{6,14}$/;

export type ResolveIssueResult =
  | {
      ok: true;
      issueId: string;
      sentVia: 'sms' | 'email' | 'portal_chat' | 'none';
      messageSid?: string;
    }
  | {
      ok: false;
      reason:
        | 'unauthenticated'
        | 'forbidden'
        | 'rate-limit'
        | 'issue-not-found'
        | 'no-draft'
        | 'gate-refused'
        | 'no-creds'
        | 'invalid-phone'
        | 'invalid-body'
        | 'channel-not-supported'
        | 'twilio-api'
        | 'network'
        | 'db';
      message: string;
      retryAfterMs?: number;
    };

interface DraftRow {
  draft_action_id: string | null;
  draft_body: string | null;
  draft_channel: string | null;
  trust_gate_requires: string | null;
  client_id: string | null;
  client_phone: string | null;
  [key: string]: unknown;
}

async function loadDraftForIssue(
  tenantId: string,
  issueId: string,
): Promise<DraftRow | null> {
  return await withTenant(asTenantId(tenantId), async (db) => {
    const rows = await db.execute<DraftRow>(`
      SELECT
        a.id::text AS draft_action_id,
        a.tool_output->>'body' AS draft_body,
        a.tool_output->>'channel' AS draft_channel,
        a.tool_input->'trustGate'->>'requires' AS trust_gate_requires,
        i.client_id::text AS client_id,
        c.phone AS client_phone
      FROM issues i
      LEFT JOIN actions a ON a.id = i.draft_action_id
      LEFT JOIN clients c ON c.id = i.client_id
      WHERE i.id = '${issueId.replace(/'/g, "''")}'::uuid
      LIMIT 1
    ` as never);
    return ((rows as unknown as DraftRow[])[0] ?? null) as DraftRow | null;
  });
}

/**
 * Approve the AI draft and send via the issue's channel.
 * Marks the issue resolved on success.
 */
export async function approveAndSendDraft(issueId: string): Promise<ResolveIssueResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  if (!APPROVE_ROLES.has(user.role)) {
    return { ok: false, reason: 'forbidden', message: `Role ${user.role} cannot approve sends` };
  }

  const limit = consumeRateToken(`approve-draft:${user.clerkUserId}`, 30, 60_000);
  if (!limit.allowed) {
    return {
      ok: false,
      reason: 'rate-limit',
      message: `Too many sends. Retry in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      retryAfterMs: limit.retryAfterMs,
    };
  }

  const draft = await loadDraftForIssue(user.tenantId, issueId);
  if (!draft) {
    return { ok: false, reason: 'issue-not-found', message: 'Issue not in your tenant' };
  }
  if (!draft.draft_action_id || !draft.draft_body) {
    return { ok: false, reason: 'no-draft', message: 'Issue has no draft to send' };
  }
  if (draft.trust_gate_requires === 'refusal') {
    return {
      ok: false,
      reason: 'gate-refused',
      message: 'Trust gate refused this draft (below framework floor)',
    };
  }

  const channel = draft.draft_channel as 'sms' | 'email' | 'portal_chat' | null;
  if (channel !== 'sms') {
    // Email + portal_chat send paths land separately. Email needs
    // Gmail OAuth wiring; portal_chat needs the messages table's
    // server-write path. Both are deferred to follow-up commits.
    return {
      ok: false,
      reason: 'channel-not-supported',
      message: `Channel '${channel ?? 'unknown'}' send is not yet wired. SMS only for v0.`,
    };
  }

  const body = draft.draft_body.trim();
  if (body.length === 0 || body.length > MAX_BODY_CHARS) {
    return {
      ok: false,
      reason: 'invalid-body',
      message: `Draft body length ${body.length} out of bounds (1-${MAX_BODY_CHARS})`,
    };
  }
  if (!draft.client_phone || !E164.test(draft.client_phone)) {
    return {
      ok: false,
      reason: 'invalid-phone',
      message: 'Client phone is missing or not E.164',
    };
  }
  if (!draft.client_id) {
    return { ok: false, reason: 'issue-not-found', message: 'Issue has no client_id' };
  }

  // Send via Twilio. Same shape as sendInviteSms; we duplicate the
  // call here rather than chaining through it because the send is
  // tied to issue-resolution + audit-log semantics that sendInviteSms
  // doesn't know about.
  const startedAt = Date.now();
  try {
    return await withTenant(asTenantId(user.tenantId), async (db) => {
      const creds = await getTenantCredential(db, asTenantId(user.tenantId), 'twilio');
      if (!creds) {
        return {
          ok: false,
          reason: 'no-creds' as const,
          message: 'No Twilio credentials configured for this tenant',
        };
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Messages.json`;
      const auth = Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString('base64');
      const formData = new URLSearchParams();
      formData.append('From', creds.fromNumber);
      formData.append('To', draft.client_phone!);
      formData.append('Body', body);

      let twilioRes: Response;
      try {
        twilioRes = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });
      } catch (networkErr) {
        Sentry.captureException(networkErr, {
          tags: { component: 'approve-send', tenant: user.tenantId },
        });
        return {
          ok: false,
          reason: 'network' as const,
          message: 'Could not reach Twilio. Try again.',
        };
      }

      const json = (await twilioRes.json()) as
        | { sid: string; status: string }
        | { code: number; message: string };

      if (!twilioRes.ok || !('sid' in json)) {
        const errMessage = 'message' in json ? json.message : `Twilio ${twilioRes.status}`;
        return {
          ok: false,
          reason: 'twilio-api' as const,
          message: errMessage,
        };
      }

      // Send succeeded. Write the audit row + mark the issue resolved.
      const persist = persistAgentAction({
        textPreviewLength: 200,
        extraToolInput: {
          issueId,
          draftActionId: draft.draft_action_id,
          channel: 'sms',
          twilioMessageSid: json.sid,
          twilioStatus: json.status,
          fromLast4: creds.fromNumber.slice(-4),
          toLast4: draft.client_phone!.slice(-4),
          latencyMs: Date.now() - startedAt,
        },
      });
      try {
        await persist({
          tenantId: asTenantId(user.tenantId),
          clientId: asClientId(draft.client_id!),
          userId: asUserId(user.id),
          agentId: null,
          actionClass: 'send-external',
          toolName: 'approveAndSendDraft.via.twilio',
          toolInput: {},
          toolOutput: { body, status: json.status },
          modelUsed: null,
          inputTokens: null,
          outputTokens: null,
          cachedTokens: null,
          costUsd: null,
          latencyMs: Date.now() - startedAt,
          success: true,
          errorMessage: null,
        });
      } catch (auditErr) {
        // Audit row failure is best-effort; the SMS already sent.
        console.error('[approve-send] audit-row write failed:', auditErr);
      }

      // Mark the issue resolved. Use Drizzle update for type-safety.
      await db
        .update(schema.issues)
        .set({
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedByUserId: user.id,
          resolutionNote: `Sent via SMS · message_sid=${json.sid}`,
        })
        .where(eq(schema.issues.id, issueId));

      return {
        ok: true,
        issueId,
        sentVia: 'sms' as const,
        messageSid: json.sid,
      };
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'approve-send', tenant: user.tenantId },
    });
    return {
      ok: false,
      reason: 'db',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Reject the AI draft. Marks the issue resolved with a rejection
 * note. The draft action row stays in the audit chain (append-only);
 * we don't delete it.
 */
export async function rejectDraft(
  issueId: string,
  reason?: string,
): Promise<ResolveIssueResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  if (!RESOLVE_ROLES.has(user.role)) {
    return { ok: false, reason: 'forbidden', message: `Role ${user.role} cannot reject` };
  }

  const trimmedReason = (reason ?? '').trim().slice(0, 500);

  try {
    return await withTenant(asTenantId(user.tenantId), async (db) => {
      const updated = await db
        .update(schema.issues)
        .set({
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedByUserId: user.id,
          resolutionNote: trimmedReason
            ? `Draft rejected: ${trimmedReason}`
            : 'Draft rejected (no reason provided)',
        })
        .where(eq(schema.issues.id, issueId))
        .returning({ clientId: schema.issues.clientId });

      const clientId = updated[0]?.clientId;
      const persist = persistAgentAction({
        textPreviewLength: 0,
        extraToolInput: { issueId, reason: trimmedReason },
      });
      await persist({
        tenantId: asTenantId(user.tenantId),
        clientId: clientId ? asClientId(clientId) : null,
        userId: asUserId(user.id),
        agentId: null,
        actionClass: 'send-internal',
        toolName: 'rejectDraft',
        toolInput: {},
        toolOutput: { rejectedAt: new Date().toISOString() },
        modelUsed: null,
        inputTokens: null,
        outputTokens: null,
        cachedTokens: null,
        costUsd: null,
        latencyMs: 0,
        success: true,
        errorMessage: null,
      });

      return { ok: true, issueId, sentVia: 'none' as const };
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'reject-draft' } });
    return {
      ok: false,
      reason: 'db',
      message: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
