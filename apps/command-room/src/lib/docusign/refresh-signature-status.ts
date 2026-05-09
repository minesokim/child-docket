'use server';

// Polling fallback for DocuSign Connect webhook.
//
// Why this exists: DocuSign's Connect Admin UI is buggy in the new
// "Org Admin" surface — many users can't get configurations to save
// or see them in the list. This action lets Antonio MANUALLY refresh
// a signature's status by clicking a button. Same DB updates the
// webhook would do, just human-triggered.
//
// FLOW
//   1. Auth + role gate (firm_owner | preparer)
//   2. Rate-limit (10/min/user — these are read-only API calls)
//   3. Find signatures row by id (RLS-bound)
//   4. Pull DocuSign cred via withTenant
//   5. Mint access token via JWT
//   6. GET /v2.1/accounts/{accountId}/envelopes/{envelopeId}
//      — basic envelope status (sent / completed / voided / declined)
//   7. GET /v2.1/accounts/{accountId}/envelopes/{envelopeId}/recipients
//      — per-recipient KBA status + signed timestamp
//   8. Apply the SAME KBA gate the webhook does:
//      - status='completed' AND KBA both lookup + questions passed
//        → signatures.status='signed' + signed_at + kba_passed_at
//      - status='completed' BUT KBA missing/failed
//        → signatures.status='declined' + audit_payload.kbaGateNote
//      - status='voided' OR 'declined'
//        → signatures.status='declined' + audit
//      - status='sent' OR other in-flight
//        → no change; just stamp last_polled_at on audit
//   9. UPDATE signatures + audit row
//
// IDEMPOTENCY
//   Polling is read-only on DocuSign's side. Repeat polls return the
//   same data; the UPDATE is keyed by signatures.id + tenant_id.

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
import { getDocuSignAccessToken } from './jwt';

const ALLOWED_ROLES = new Set(['firm_owner', 'preparer']);

export type RefreshSignatureStatusResult =
  | {
      ok: true;
      newStatus: 'signed' | 'pending' | 'declined' | 'expired';
      kbaPassed: boolean;
      envelopeStatus: string;
      signedAt: string | null;
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
        | 'rate-limit'
        | 'network';
      message: string;
      retryAfterMs?: number;
    };

interface DocuSignEnvelopeResponse {
  status?: 'created' | 'sent' | 'delivered' | 'completed' | 'declined' | 'voided';
  completedDateTime?: string;
  voidedDateTime?: string;
  voidedReason?: string;
}

interface DocuSignRecipientsResponse {
  signers?: Array<{
    status?: string;
    signedDateTime?: string;
    deliveredDateTime?: string;
    clientUserId?: string;
    recipientAuthenticationStatus?: {
      idLookupResult?: { status?: string; eventTimestamp?: string };
      idQuestionsResult?: { status?: string; eventTimestamp?: string };
    };
  }>;
}

export async function refreshSignatureStatus(
  signatureRowId: string,
): Promise<RefreshSignatureStatusResult> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  if (!ALLOWED_ROLES.has(user.role)) {
    return { ok: false, reason: 'forbidden', message: `Role ${user.role} cannot refresh signatures` };
  }

  const limit = consumeRateToken(`docusign-refresh:${user.clerkUserId}`, 10, 60_000);
  if (!limit.allowed) {
    return {
      ok: false,
      reason: 'rate-limit',
      message: `Too many refresh requests. Retry in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      retryAfterMs: limit.retryAfterMs,
    };
  }

  const startedAt = Date.now();

  try {
    return await withTenant(asTenantId(user.tenantId), async (db) => {
      const [sig] = await db
        .select()
        .from(schema.signatures)
        .where(eq(schema.signatures.id, signatureRowId))
        .limit(1);
      if (!sig) {
        return { ok: false as const, reason: 'not-found' as const, message: 'Signature record not found' };
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
        return { ok: false as const, reason: 'no-creds' as const, message: 'Tenant has no DocuSign credentials' };
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
          reason: tokenResult.reason === 'network' ? 'network' : 'token-exchange-failed',
          message: tokenResult.message,
        };
      }

      // Pull envelope status + recipients in parallel.
      const baseUrl = `${tokenResult.apiBaseUri}/restapi/v2.1/accounts/${creds.accountId}/envelopes/${envelopeId}`;
      let envRes: Response;
      let recRes: Response;
      try {
        [envRes, recRes] = await Promise.all([
          fetch(baseUrl, {
            headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
          }),
          fetch(`${baseUrl}/recipients?include_extended=true`, {
            headers: { Authorization: `Bearer ${tokenResult.accessToken}` },
          }),
        ]);
      } catch (err) {
        return {
          ok: false as const,
          reason: 'network' as const,
          message: err instanceof Error ? err.message : 'Network error fetching envelope',
        };
      }

      if (!envRes.ok) {
        return {
          ok: false as const,
          reason: 'docusign-api' as const,
          message: `DocuSign envelope endpoint returned ${envRes.status}`,
        };
      }

      const envelope = (await envRes.json()) as DocuSignEnvelopeResponse;
      const recipients = recRes.ok
        ? ((await recRes.json()) as DocuSignRecipientsResponse)
        : { signers: [] };

      const signer = recipients.signers?.[0];
      const kbaAuth = signer?.recipientAuthenticationStatus;
      const lookupPassed = kbaAuth?.idLookupResult?.status === 'passed';
      const questionsPassed = kbaAuth?.idQuestionsResult?.status === 'passed';
      const kbaPassedAt =
        lookupPassed && questionsPassed
          ? new Date(kbaAuth?.idQuestionsResult?.eventTimestamp ?? envelope.completedDateTime ?? Date.now())
          : null;

      // Map DocuSign envelope status → signatures.status.
      // SAME KBA-passed gate as the webhook: completed-without-KBA
      // does NOT flip to 'signed' (IRS Pub 1345 violation otherwise).
      let newStatus: 'signed' | 'pending' | 'declined' | 'expired' = 'pending';
      let signedAt: Date | null = null;
      let signedByIp: string | null = null;
      let signedByUserAgent: string | null = null;
      let kbaGateNote: string | null = null;

      if (envelope.status === 'completed') {
        if (kbaPassedAt) {
          newStatus = 'signed';
          signedAt = signer?.signedDateTime
            ? new Date(signer.signedDateTime)
            : envelope.completedDateTime
              ? new Date(envelope.completedDateTime)
              : new Date();
          // signedByIp/userAgent aren't returned on the basic
          // recipients endpoint; would need /audit_events. Leave
          // null — webhook captures these when it fires.
        } else {
          newStatus = 'declined';
          kbaGateNote =
            'KBA did not pass; status set to declined per IRS Pub 1345. Re-send a fresh envelope.';
        }
      } else if (envelope.status === 'declined') {
        newStatus = 'declined';
      } else if (envelope.status === 'voided') {
        newStatus = 'declined';
      }
      // 'sent' / 'delivered' / 'created' → newStatus stays 'pending';
      // we still UPDATE last_polled_at via audit_payload merge.

      void signedByIp;
      void signedByUserAgent;

      const newAudit: Record<string, unknown> = {
        ...(audit ?? {}),
        lastPolledAt: new Date().toISOString(),
        lastEnvelopeStatus: envelope.status,
        recipientAuthenticationStatus: kbaAuth ?? null,
      };
      if (kbaGateNote) newAudit.kbaGateNote = kbaGateNote;
      if (envelope.voidedReason) newAudit.voidedReason = envelope.voidedReason;

      // UPDATE only fields that should change; preserve existing
      // signed_at if a webhook already populated it.
      const updates: Partial<typeof schema.signatures.$inferInsert> = {
        status: newStatus,
        auditPayload: newAudit as Record<string, unknown>,
      };
      if (newStatus === 'signed') {
        updates.signedAt = sig.signedAt ?? signedAt;
        updates.kbaPassedAt = sig.kbaPassedAt ?? kbaPassedAt;
      }

      await db
        .update(schema.signatures)
        .set(updates)
        .where(
          and(
            eq(schema.signatures.id, signatureRowId),
            eq(schema.signatures.tenantId, user.tenantId),
          ),
        );

      // Audit row.
      const persist = persistAgentAction({
        extraToolInput: {
          signatureRowId,
          envelopeId,
          previousStatus: sig.status,
          newStatus,
          envelopeStatus: envelope.status,
          kbaPassed: kbaPassedAt !== null,
        },
        textPreviewLength: 0,
      });
      try {
        await persist({
          tenantId: asTenantId(user.tenantId),
          clientId: asClientId(sig.clientId),
          userId: asUserId(user.id),
          agentId: null,
          actionClass: 'read',
          toolName: 'docusign.refresh-signature-status',
          toolInput: {},
          toolOutput: { ok: true, newStatus, envelopeStatus: envelope.status },
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
        console.error('[docusign-refresh] audit-row write failed:', auditErr);
      }

      return {
        ok: true as const,
        newStatus,
        kbaPassed: kbaPassedAt !== null,
        envelopeStatus: envelope.status ?? 'unknown',
        signedAt: signedAt ? signedAt.toISOString() : null,
      };
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'docusign-refresh', tenant: user.tenantId },
    });
    return {
      ok: false,
      reason: 'docusign-api',
      message: 'Could not refresh signature status. The error has been logged for review.',
    };
  }
}
