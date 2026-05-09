'use server';

// Server action: request 8879 e-signature via DocuSign + KBA.
//
// Per CLAUDE.md section 6 + section 15 Phase 2 + IRS Pub 1345.
//
// FLOW
//   1. Auth (firm_owner | preparer can request; reviewer cannot —
//      8879 signing is firm-policy-bound).
//   2. Pull DocuSign credentials from tenant_credentials vault.
//   3. Mint JWT + exchange for access token. Cache token for 1h
//      (DocuSign user-app TTL); we don't store it cross-request,
//      Vercel lambdas are short-lived enough that re-minting per
//      request is fine.
//   4. Pull client info (legal name, email, last-4 SSN — last-4 is
//      decrypted from the encrypted intake field).
//   5. Build + create the envelope with KBA recipient.
//   6. Insert a row into signatures (type='form_8879',
//      status='pending', kbaRequired=true, kbaProvider='lexisnexis',
//      audit_payload includes envelope_id).
//   7. Audit-log the request via persistAgentAction.
//   8. Return { envelopeId } so the portal can construct the
//      embedded signing URL (or wait for the email DocuSign sends).
//
// ANTI-ABUSE
//   Rate-limit: 6 requests per minute per Clerk user.
//   Body length: not relevant (envelope built server-side).
//
// FAILURE MODES
//   - Tenant has no DocuSign creds -> { ok: false, reason: 'no-creds' }
//   - JWT consent not granted -> { ok: false, reason: 'consent-required' }
//   - Token exchange failed -> { ok: false, reason: 'token-exchange-failed' }
//   - Envelope creation failed -> { ok: false, reason: 'envelope-failed' }
//   - Client missing legal name / email / SSN -> { ok: false, reason: 'client-incomplete' }
//   - Rate limit -> { ok: false, reason: 'rate-limit' }
//
// FUTURE WORK (not in this scaffold)
//   - PDF bytes for the 8879: today this submits an empty document
//     placeholder. DocuSign rejects with INVALID_DOCUMENT_BASE64.
//     v1 wires the return-prep PDF from the OLT integration.
//   - Embedded signing URL: today the signer clicks the email
//     DocuSign sends. v1 calls POST /views/recipient to mint a
//     URL the portal can iframe.
//   - Webhook for envelope-completed: DocuSign POSTs to a webhook
//     when KBA passes + signature lands. v1 wires the webhook to
//     update signatures.status='signed' + signatures.signedAt.

import { eq, and, desc } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  decryptIfMarkedForTenant,
  getTenantCredential,
  getTenantDek,
  isEncrypted,
  persistAgentAction,
  schema,
  withTenant,
} from '@docket/db';
import {
  asTenantId,
  asClientId,
  asUserId,
  consumeRateToken,
  getAtPath,
} from '@docket/shared';
import { getCurrentDocketUser } from '@/lib/current-user';
import { getDocuSignAccessToken } from './jwt';
import { createEnvelope } from './envelope';

const ALLOWED_ROLES = new Set(['firm_owner', 'preparer']);

export type RequestSign8879Result =
  | {
      ok: true;
      envelopeId: string;
      signatureRowId: string;
      status: string;
    }
  | {
      ok: false;
      reason:
        | 'unauthenticated'
        | 'forbidden'
        | 'no-creds'
        | 'consent-required'
        | 'token-exchange-failed'
        | 'envelope-failed'
        | 'client-not-found'
        | 'client-incomplete'
        | 'rate-limit'
        | 'network';
      message: string;
      retryAfterMs?: number;
      docusignErrorCode?: string;
    };

export interface RequestSign8879Input {
  clientId: string;
  /** Tax year on the engagement (e.g., 2024 for filings due Apr 2025). */
  taxYear: number;
  /**
   * Auth host. 'account-d.docusign.com' for sandbox / DocuSign demo,
   * 'account.docusign.com' for production. v0 defaults to demo so
   * dev/staging use sandbox tokens; tenants flip to prod via env or
   * (later) a tenants.docusign_environment column.
   */
  authHost?: 'account-d.docusign.com' | 'account.docusign.com';
}

export async function requestSign8879(
  input: RequestSign8879Input,
): Promise<RequestSign8879Result> {
  const user = await getCurrentDocketUser();
  if (!user) return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  if (!ALLOWED_ROLES.has(user.role)) {
    return {
      ok: false,
      reason: 'forbidden',
      message: `Role ${user.role} cannot request 8879 signing`,
    };
  }

  const limit = consumeRateToken(`docusign-8879:${user.clerkUserId}`, 6, 60_000);
  if (!limit.allowed) {
    return {
      ok: false,
      reason: 'rate-limit',
      message: `Too many requests. Retry in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      retryAfterMs: limit.retryAfterMs,
    };
  }

  const startedAt = Date.now();
  const authHost = input.authHost ?? 'account-d.docusign.com';

  try {
    return await withTenant(asTenantId(user.tenantId), async (db) => {
      const creds = await getTenantCredential(db, asTenantId(user.tenantId), 'docusign');
      if (!creds) {
        return {
          ok: false,
          reason: 'no-creds' as const,
          message: 'No DocuSign credentials configured for this tenant',
        };
      }

      // Pull the client + their intake for legal name / email / SSN-last-4.
      const [client] = await db
        .select({
          id: schema.clients.id,
          fullName: schema.clients.fullName,
          email: schema.clients.email,
        })
        .from(schema.clients)
        .where(eq(schema.clients.id, input.clientId))
        .limit(1);
      if (!client) {
        return {
          ok: false,
          reason: 'client-not-found' as const,
          message: 'Client not found in your tenant',
        };
      }
      if (!client.fullName || !client.email) {
        return {
          ok: false,
          reason: 'client-incomplete' as const,
          message: 'Client missing legal name or email',
        };
      }

      // Decrypt SSN to extract last-4 for KBA pre-fill.
      const dek = await getTenantDek(db, asTenantId(user.tenantId));
      const [intake] = await db
        .select()
        .from(schema.intakeResponses)
        .where(
          and(
            eq(schema.intakeResponses.clientId, input.clientId),
            eq(schema.intakeResponses.taxYear, input.taxYear),
          ),
        )
        .orderBy(desc(schema.intakeResponses.startedAt))
        .limit(1);
      const storedSsn = intake ? getAtPath(intake.answers as unknown, 'personal.ssn') : null;
      let last4 = '0000';
      if (storedSsn) {
        let plaintext: string;
        if (isEncrypted(storedSsn)) {
          plaintext = (decryptIfMarkedForTenant(storedSsn, dek) as string) ?? '';
        } else if (typeof storedSsn === 'string') {
          plaintext = storedSsn;
        } else {
          plaintext = '';
        }
        const digits = plaintext.replace(/\D/g, '');
        if (digits.length >= 4) last4 = digits.slice(-4);
      }
      if (last4 === '0000') {
        return {
          ok: false,
          reason: 'client-incomplete' as const,
          message: 'Client SSN not on file — required for KBA pre-fill',
        };
      }

      // 1. Mint + exchange JWT for DocuSign access token.
      const tokenResult = await getDocuSignAccessToken({
        integrationKey: creds.integrationKey,
        userId: creds.userId,
        privateKey: creds.privateKey,
        authHost,
      });
      if (!tokenResult.ok) {
        await writeAuditRow(user, input.clientId, false, {
          stage: 'token-exchange',
          reason: tokenResult.reason,
          message: tokenResult.message,
        });
        return {
          ok: false,
          reason:
            tokenResult.reason === 'consent-required'
              ? 'consent-required'
              : tokenResult.reason === 'network'
                ? 'network'
                : 'token-exchange-failed',
          message: tokenResult.message,
          docusignErrorCode:
            'docusignErrorCode' in tokenResult ? tokenResult.docusignErrorCode : undefined,
        };
      }

      // 2. Create envelope with KBA recipient.
      const envelopeResult = await createEnvelope({
        accessToken: tokenResult.accessToken,
        apiBaseUri: tokenResult.apiBaseUri,
        accountId: creds.accountId,
        emailSubject: `${user.tenantName} · ${input.taxYear} Form 8879`,
        emailBody:
          `${user.name ?? user.email} has prepared your ${input.taxYear} federal return ` +
          `and needs your e-signature on Form 8879 to authorize e-filing. After clicking the ` +
          `link below you'll answer 5 quick identity-verification questions, then sign.`,
        signerName: client.fullName,
        signerEmail: client.email,
        signerLast4Ssn: last4,
        externalRef: `${input.clientId}:${input.taxYear}`,
        // documentBase64: omitted — see scaffold note in the file
        // header. v0 fails at envelope-creation; v1 wires the PDF.
      });
      if (!envelopeResult.ok) {
        await writeAuditRow(user, input.clientId, false, {
          stage: 'envelope-create',
          message: envelopeResult.message,
          statusCode: envelopeResult.statusCode,
          errorCode: envelopeResult.errorCode,
        });
        return {
          ok: false,
          reason: 'envelope-failed',
          message: envelopeResult.message,
          docusignErrorCode: envelopeResult.errorCode,
        };
      }

      // 3. Persist signatures row.
      const [sig] = await db
        .insert(schema.signatures)
        .values({
          tenantId: user.tenantId,
          clientId: input.clientId,
          type: 'form_8879',
          status: 'pending',
          kbaRequired: true,
          kbaProvider: 'lexisnexis',
          sentAt: new Date(),
          auditPayload: {
            envelopeId: envelopeResult.envelopeId,
            envelopeUri: envelopeResult.uri,
            envelopeStatus: envelopeResult.status,
            taxYear: input.taxYear,
            authHost,
            requestedByUserId: user.id,
          },
        })
        .returning({ id: schema.signatures.id });

      // 4. Audit log.
      await writeAuditRow(user, input.clientId, true, {
        stage: 'envelope-create',
        envelopeId: envelopeResult.envelopeId,
        signatureRowId: sig?.id,
        latencyMs: Date.now() - startedAt,
        taxYear: input.taxYear,
      });

      return {
        ok: true,
        envelopeId: envelopeResult.envelopeId,
        signatureRowId: sig!.id,
        status: envelopeResult.status,
      };
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'docusign-8879', tenant: user.tenantId },
    });
    return {
      ok: false,
      reason: 'envelope-failed',
      message: err instanceof Error ? err.message : 'Unknown error',
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
      toolName: 'docusign.request-sign-8879',
      toolInput: {},
      toolOutput: { success, ...details },
      modelUsed: null,
      inputTokens: null,
      outputTokens: null,
      cachedTokens: null,
      costUsd: null,
      latencyMs: typeof details.latencyMs === 'number' ? details.latencyMs : 0,
      success,
      errorMessage: success ? null : String(details.message ?? 'unknown'),
    });
  } catch (err) {
    console.error('[docusign-8879] audit-row write failed:', err);
  }
}
