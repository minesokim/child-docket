'use server';

// Server action: void a stuck DocuSign envelope.
//
// WHY THIS EXISTS
//   The codex review on 270e7f1 (DocuSign 8879 ship) flagged a recovery
//   gap: if a signatures row sits in status='pending' but the DocuSign
//   envelope is somehow stuck (signer abandoned, Connect webhook never
//   fired, envelope expired, etc.), Antonio has NO way to start fresh
//   from the command-room. He has to:
//     1. Open DocuSign Admin in a separate tab
//     2. Find the envelope, void it manually
//     3. Wait for the webhook (which is what's broken in the first place)
//        OR click "Refresh status" and hope the void registers
//     4. THEN re-send a fresh 8879
//
//   This action shortcuts that to one button: "Void & start over." It
//   PUTs status='voided' to DocuSign + flips the signatures row to
//   'declined' atomically. After this, requestSign8879 succeeds without
//   the 'already-pending' guard tripping.
//
// FLOW
//   1. Auth (firm_owner | preparer; reviewer can't void).
//   2. Rate-limit (3/min/user — voiding is a write op + mints a fresh
//      envelope likely follows).
//   3. Fetch signatures row (RLS-bound). Must be 'pending'.
//   4. Pull DocuSign creds + envelopeId from auditPayload.
//   5. Mint access token.
//   6. PUT /v2.1/accounts/{id}/envelopes/{envelopeId}
//      body: { status: 'voided', voidedReason: <reason> }
//   7. UPDATE signatures.status='declined' + auditPayload merge
//      (voidedAt, voidedByUserId, voidedReason, lastEnvelopeStatus).
//   8. Audit row via persistAgentAction.
//
// IDEMPOTENCY
//   PUT to a DocuSign envelope already in 'voided' state returns 200
//   (idempotent on DocuSign's side). The signatures-row UPDATE is keyed
//   by id + tenantId; re-runs no-op cleanly.
//
// SAFETY
//   - Only voids signatures.status='pending'. 'signed' / 'declined' /
//     'expired' rows are rejected (no undo).
//   - voidedReason captured for audit trail (operator must supply or
//     defaults to 'Stuck pending — cleared by command-room operator').

import { and, eq } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  getTenantCredential,
  persistAgentAction,
  schema,
  withTenant,
  type DocusignCredentials,
} from '@docket/db';
import {
  asTenantId,
  asClientId,
  asUserId,
  consumeRateToken,
} from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';
import { getDocuSignAccessToken } from '@docket/docusign-shared';

const ALLOWED_ROLES = new Set(['firm_owner', 'preparer']);

export type VoidEnvelopeResult =
  | {
      ok: true;
      signatureRowId: string;
      envelopeId: string;
      previousStatus: string;
      newStatus: 'declined';
    }
  | {
      ok: false;
      reason:
        | 'unauthenticated'
        | 'forbidden'
        | 'not-found'
        | 'no-creds'
        | 'token-exchange-failed'
        | 'docusign-api'
        | 'invalid-status'
        | 'rate-limit'
        | 'network';
      message: string;
      retryAfterMs?: number;
    };

const DEFAULT_VOID_REASON =
  'Stuck pending — cleared by command-room operator';

export async function voidEnvelope(
  signatureRowId: string,
  /** Free-text reason recorded both at DocuSign + audit_payload. */
  reason: string = DEFAULT_VOID_REASON,
): Promise<VoidEnvelopeResult> {
  const user = await getCurrentDocketUser();
  if (!user)
    return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  if (!ALLOWED_ROLES.has(user.role)) {
    return {
      ok: false,
      reason: 'forbidden',
      message: `Role ${user.role} cannot void envelopes`,
    };
  }

  const limit = consumeRateToken(`docusign-void:${user.clerkUserId}`, 3, 60_000);
  if (!limit.allowed) {
    return {
      ok: false,
      reason: 'rate-limit',
      message: `Too many void requests. Retry in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      retryAfterMs: limit.retryAfterMs,
    };
  }

  // DocuSign caps voidedReason at 200 chars; trim for safety.
  const trimmedReason = reason.trim().slice(0, 200) || DEFAULT_VOID_REASON;

  const startedAt = Date.now();

  try {
    return await withTenant(asTenantId(user.tenantId), async (db) => {
      const [sig] = await db
        .select()
        .from(schema.signatures)
        .where(eq(schema.signatures.id, signatureRowId))
        .limit(1);
      if (!sig) {
        return {
          ok: false as const,
          reason: 'not-found' as const,
          message: 'Signature record not found',
        };
      }
      if (sig.status !== 'pending') {
        return {
          ok: false as const,
          reason: 'invalid-status' as const,
          message: `Cannot void a signature in status '${sig.status}'. Only 'pending' is voidable.`,
        };
      }

      const audit = sig.auditPayload as
        | { envelopeId?: string; authHost?: string }
        | null;
      const envelopeId = audit?.envelopeId;
      if (!envelopeId) {
        return {
          ok: false as const,
          reason: 'not-found' as const,
          message: 'Signature has no envelope id',
        };
      }
      const authHost: 'account-d.docusign.com' | 'account.docusign.com' =
        audit?.authHost === 'account.docusign.com'
          ? 'account.docusign.com'
          : 'account-d.docusign.com';

      const creds = (await getTenantCredential(
        db,
        asTenantId(user.tenantId),
        'docusign',
      )) as DocusignCredentials | null;
      if (!creds) {
        return {
          ok: false as const,
          reason: 'no-creds' as const,
          message: 'Tenant has no DocuSign credentials',
        };
      }

      const tokenResult = await getDocuSignAccessToken({
        integrationKey: creds.integrationKey,
        userId: creds.userId,
        privateKey: creds.privateKey,
        authHost,
      });
      if (!tokenResult.ok) {
        return {
          ok: false as const,
          reason:
            tokenResult.reason === 'network' ? 'network' : 'token-exchange-failed',
          message: tokenResult.message,
        };
      }

      // PUT /v2.1/accounts/{accountId}/envelopes/{envelopeId}
      // body: { status: 'voided', voidedReason: <reason> }
      const url = `${tokenResult.apiBaseUri}/restapi/v2.1/accounts/${creds.accountId}/envelopes/${envelopeId}`;
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${tokenResult.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'voided',
            voidedReason: trimmedReason,
          }),
        });
      } catch (err) {
        return {
          ok: false as const,
          reason: 'network' as const,
          message: err instanceof Error ? err.message : 'Network error voiding envelope',
        };
      }

      if (!res.ok) {
        // Capture body for ops debugging; DocuSign returns errorCode/message JSON
        // on 4xx + 5xx responses.
        let errorBody = '';
        try {
          errorBody = await res.text();
        } catch {
          /* swallow */
        }
        await writeAuditRow(user, sig.clientId, false, {
          stage: 'void-envelope',
          envelopeId,
          signatureRowId,
          docusignStatus: res.status,
          docusignBody: errorBody.slice(0, 500),
        });
        return {
          ok: false as const,
          reason: 'docusign-api' as const,
          message: `DocuSign void endpoint returned ${res.status}: ${errorBody.slice(0, 200) || 'no body'}`,
        };
      }

      // UPDATE signatures row → declined.
      const previousStatus = sig.status;
      const newAudit: Record<string, unknown> = {
        ...(audit ?? {}),
        voidedAt: new Date().toISOString(),
        voidedByUserId: user.id,
        voidedReason: trimmedReason,
        lastEnvelopeStatus: 'voided',
      };

      await db
        .update(schema.signatures)
        .set({
          status: 'declined',
          auditPayload: newAudit,
        })
        .where(
          and(
            eq(schema.signatures.id, signatureRowId),
            eq(schema.signatures.tenantId, user.tenantId),
          ),
        );

      await writeAuditRow(user, sig.clientId, true, {
        stage: 'void-envelope',
        envelopeId,
        signatureRowId,
        previousStatus,
        newStatus: 'declined',
        voidedReason: trimmedReason,
        latencyMs: Date.now() - startedAt,
      });

      return {
        ok: true as const,
        signatureRowId,
        envelopeId,
        previousStatus,
        newStatus: 'declined' as const,
      };
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'docusign-void', tenant: user.tenantId },
    });
    return {
      ok: false,
      reason: 'docusign-api',
      message: 'Could not void envelope. The error has been logged for review.',
    };
  }
}

async function writeAuditRow(
  user: { id: string; tenantId: string },
  clientId: string,
  success: boolean,
  details: Record<string, unknown>,
): Promise<void> {
  const persist = persistAgentAction({
    extraToolInput: details,
    textPreviewLength: 0,
  });
  try {
    await persist({
      tenantId: asTenantId(user.tenantId),
      clientId: asClientId(clientId),
      userId: asUserId(user.id),
      agentId: null,
      actionClass: 'send-external',
      toolName: 'docusign.void-envelope',
      toolInput: {},
      toolOutput: { success, ...details },
      modelUsed: null,
      inputTokens: null,
      outputTokens: null,
      cachedTokens: null,
      costUsd: null,
      latencyMs: typeof details.latencyMs === 'number' ? details.latencyMs : 0,
      success,
      errorMessage: success ? null : String(details.docusignBody ?? details.message ?? 'unknown'),
    });
  } catch (err) {
    console.error('[docusign-void] audit-row write failed:', err);
  }
}
