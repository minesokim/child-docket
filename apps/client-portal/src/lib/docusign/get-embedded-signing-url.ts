'use server';

// Portal-side: mint the embedded DocuSign signing URL for an existing
// pending 8879 envelope.
//
// Counterpart to the command-room's getEmbeddedSigningUrl. Both call
// DocuSign's createRecipientView API; both must use the SAME tenant
// + same envelopeId + same clientUserId. This file is the path the
// taxpayer's portal session reads through.
//
// AUTH POSTURE
//   The taxpayer is Clerk-authenticated via phone OTP. resolveClient
//   binds them to a tenant + client UUID — that's what's used for
//   the RLS-scoped signatures lookup.
//
// IDEMPOTENCY
//   DocuSign signing URLs expire after ~5 min (per DocuSign docs).
//   This action mints a FRESH url on every call. Caller (the
//   /sign-8879/[envelopeId]/page.tsx) calls on every visit, not on
//   first render only.
//
// FOLLOWUP
//   Both apps now have ~80 LOC duplicated DocuSign helpers (jwt.ts +
//   envelope.ts). When a third caller needs them, extract to
//   packages/docusign-shared/ — for now duplication is acceptable
//   v0 cost (matches the pattern existing apps use for Square /
//   Twilio integration code).

import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  getTenantCredential,
  schema,
  withTenant,
} from '@docket/db';
import {
  asTenantId,
  consumeRateToken,
} from '@docket/shared';
import { getOrCreateClient } from '@/lib/intake/auth';
import { getDocuSignAccessToken, createRecipientView } from '@docket/docusign-shared';

export type GetEmbeddedSigningUrlResult =
  | { ok: true; signingUrl: string; envelopeId: string; signatureRowId: string }
  | {
      ok: false;
      reason:
        | 'unauthenticated'
        | 'not-found'
        | 'no-creds'
        | 'token-exchange-failed'
        | 'recipient-view-failed'
        | 'already-signed'
        | 'rate-limit'
        | 'network';
      message: string;
    };

export async function getEmbeddedSigningUrlPortal(
  signatureRowId: string,
  /** The /sign-8879/[envelopeId]/done URL DocuSign redirects to after sign. */
  returnUrl: string,
): Promise<GetEmbeddedSigningUrlResult> {
  const ctx = await getOrCreateClient();
  if (!ctx) {
    return { ok: false, reason: 'unauthenticated', message: 'Not signed in' };
  }
  const tenantId = ctx.tenantId;
  const clientId = ctx.clientId;

  const limit = consumeRateToken(`portal-sign-url:${signatureRowId}`, 30, 60_000);
  if (!limit.allowed) {
    return {
      ok: false,
      reason: 'rate-limit',
      message: 'Too many signing-URL requests. Wait a minute and retry.',
    };
  }

  try {
    return await withTenant(asTenantId(tenantId), async (db) => {
      const [sig] = await db
        .select()
        .from(schema.signatures)
        .where(eq(schema.signatures.id, signatureRowId))
        .limit(1);
      if (!sig) {
        return { ok: false as const, reason: 'not-found' as const, message: 'Signature record not found' };
      }
      if (sig.clientId !== clientId) {
        // Belt-and-suspenders past RLS — never let one taxpayer's
        // portal session mint a signing URL for someone else's
        // envelope. RLS already filters by tenant; clientId match
        // adds the per-client check.
        return { ok: false as const, reason: 'not-found' as const, message: 'Signature record not found' };
      }
      if (sig.status === 'signed') {
        return { ok: false as const, reason: 'already-signed' as const, message: 'Already signed' };
      }
      const audit = sig.auditPayload as
        | { envelopeId?: string; authHost?: string }
        | null;
      const envelopeId = audit?.envelopeId;
      // Auth host: use what was stored when the envelope was created
      // (authHost is captured in audit_payload at request-sign-8879
      // time). Falls back to sandbox for old rows that pre-date the
      // authHost field. When a tenant graduates to production
      // DocuSign, request-sign-8879 stamps 'account.docusign.com'
      // and the portal here uses the same host — no drift between
      // create and re-mint.
      const authHost: 'account-d.docusign.com' | 'account.docusign.com' =
        audit?.authHost === 'account.docusign.com'
          ? 'account.docusign.com'
          : 'account-d.docusign.com';
      if (!envelopeId) {
        return {
          ok: false as const,
          reason: 'not-found' as const,
          message: 'Signature has no envelope id',
        };
      }

      const creds = await getTenantCredential(db, asTenantId(tenantId), 'docusign');
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

      // Fetch the client row for fullName + email — getOrCreateClient
      // returns the binding (clientId, tenantId) but not the
      // display fields needed for the DocuSign signer block.
      const [clientRow] = await db
        .select({
          fullName: schema.clients.fullName,
          email: schema.clients.email,
        })
        .from(schema.clients)
        .where(eq(schema.clients.id, clientId))
        .limit(1);
      if (!clientRow || !clientRow.fullName || !clientRow.email) {
        return {
          ok: false as const,
          reason: 'not-found' as const,
          message: 'Client record incomplete',
        };
      }

      const viewResult = await createRecipientView({
        accessToken: tokenResult.accessToken,
        apiBaseUri: tokenResult.apiBaseUri,
        accountId: creds.accountId,
        envelopeId,
        clientUserId: clientId,
        signerName: clientRow.fullName,
        signerEmail: clientRow.email,
        returnUrl,
      });
      if (!viewResult.ok) {
        return {
          ok: false as const,
          reason: 'recipient-view-failed' as const,
          message: viewResult.message,
        };
      }

      return {
        ok: true as const,
        signingUrl: viewResult.signingUrl,
        envelopeId,
        signatureRowId,
      };
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'portal-docusign', surface: 'getEmbeddedSigningUrl' },
    });
    return {
      ok: false,
      reason: 'recipient-view-failed',
      message: 'Could not mint signing URL. The error has been logged for review.',
    };
  }
}
