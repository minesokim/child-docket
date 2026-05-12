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
  decryptIfMarkedForTenantWithAAD,
  deriveAAD,
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
import {
  getDocuSignAccessToken,
  createEnvelope,
  createRecipientView,
} from '@docket/docusign-shared';

const ALLOWED_ROLES = new Set(['firm_owner', 'preparer']);

export type RequestSign8879Result =
  | {
      ok: true;
      envelopeId: string;
      signatureRowId: string;
      status: string;
      /**
       * Embedded signing URL the portal iframes. Short-lived
       * (DocuSign default ~5 min); the portal mints a fresh URL
       * on every visit by re-calling getEmbeddedSigningUrl
       * (separate server action) keyed off the signatures row.
       */
      signingUrl: string;
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
        | 'recipient-view-failed'
        | 'invalid-pdf'
        | 'client-not-found'
        | 'client-incomplete'
        | 'already-pending'
        | 'already-signed'
        | 'rate-limit'
        | 'network';
      message: string;
      retryAfterMs?: number;
      docusignErrorCode?: string;
      existingSignatureRowId?: string;
    };

export interface RequestSign8879Input {
  clientId: string;
  /** Tax year on the engagement (e.g., 2024 for filings due Apr 2025). */
  taxYear: number;
  /**
   * 8879 PDF bytes encoded as base64. Antonio uploads this from the
   * command-room /clients/[id] surface (he exports the 8879 PDF from
   * OLT manually for v0; OLT integration auto-pulls in M2+).
   *
   * Min 1KB (DocuSign rejects empty/near-empty payloads), max 25MB
   * (DocuSign hard cap). MIME validated via PDF magic bytes
   * (%PDF-) at the start of the decoded payload.
   */
  pdfBase64: string;
  /** Filename DocuSign labels the document with in the iframe + receipt. */
  pdfFilename?: string;
  /**
   * Auth host. 'account-d.docusign.com' for sandbox / DocuSign demo,
   * 'account.docusign.com' for production. v0 defaults to demo so
   * dev/staging use sandbox tokens; tenants flip to prod via env or
   * (later) a tenants.docusign_environment column.
   */
  authHost?: 'account-d.docusign.com' | 'account.docusign.com';
  /**
   * Where DocuSign redirects the iframe after signing completes.
   * Defaults to the portal's /sign-8879/done page; pass an override
   * for testing.
   */
  returnUrl?: string;
}

const PDF_MIN_BYTES = 1024;
const PDF_MAX_BYTES = 25 * 1024 * 1024;
const PDF_MAGIC = '%PDF-';

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

  // PDF validation BEFORE any DocuSign calls. Fail fast on malformed
  // input to keep the action's failure surface deterministic.
  const decodedSize = Math.floor((input.pdfBase64.length * 3) / 4);
  if (decodedSize < PDF_MIN_BYTES) {
    return {
      ok: false,
      reason: 'invalid-pdf',
      message: `PDF is too small (${decodedSize} bytes). DocuSign rejects payloads under ~1KB.`,
    };
  }
  if (decodedSize > PDF_MAX_BYTES) {
    return {
      ok: false,
      reason: 'invalid-pdf',
      message: `PDF exceeds 25MB DocuSign limit (${Math.round(decodedSize / 1024 / 1024)}MB).`,
    };
  }
  // Magic-bytes check — the first 5 chars of a PDF are '%PDF-'. Decode
  // the first 8 base64 chars (= 6 bytes) and compare. Catches users
  // accidentally uploading JPGs or empty buffers labeled .pdf.
  try {
    const head = Buffer.from(input.pdfBase64.slice(0, 8), 'base64').toString('utf8');
    if (!head.startsWith(PDF_MAGIC)) {
      return {
        ok: false,
        reason: 'invalid-pdf',
        message: 'File does not appear to be a PDF (missing %PDF- header).',
      };
    }
  } catch {
    return {
      ok: false,
      reason: 'invalid-pdf',
      message: 'PDF base64 payload could not be decoded.',
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

      // Idempotency check: if a signatures row already exists for
      // this (tenant, client, type=form_8879) with status pending or
      // signed, don't double-create. The existing envelope is the
      // legal record; minting a parallel one would create two
      // competing 8879s for one taxpayer. Antonio can void via the
      // DocuSign dashboard if a re-send is needed.
      const [existing] = await db
        .select({
          id: schema.signatures.id,
          status: schema.signatures.status,
        })
        .from(schema.signatures)
        .where(
          and(
            eq(schema.signatures.clientId, input.clientId),
            eq(schema.signatures.type, 'form_8879'),
          ),
        )
        .orderBy(desc(schema.signatures.createdAt))
        .limit(1);

      if (existing && existing.status === 'pending') {
        return {
          ok: false,
          reason: 'already-pending' as const,
          message: 'A pending 8879 signing request already exists. Open it from the Signatures section or void via DocuSign before re-sending.',
          existingSignatureRowId: existing.id,
        };
      }
      if (existing && existing.status === 'signed') {
        return {
          ok: false,
          reason: 'already-signed' as const,
          message: 'Form 8879 has already been signed for this client.',
          existingSignatureRowId: existing.id,
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
          // AAD-aware decrypt with the same (tenantId, clientId,
          // taxYear, path) tuple saveIntakeField uses on write. The
          // 3-tier fallback inside decryptIfMarkedForTenantWithAAD
          // covers AAD-bound + AAD-less + master-KEK legacy values
          // during the migration window.
          const aad = deriveAAD({
            tenantId: user.tenantId,
            clientId: input.clientId,
            taxYear: input.taxYear,
            path: 'personal.ssn',
          });
          plaintext = (decryptIfMarkedForTenantWithAAD(storedSsn, dek, aad) as string) ?? '';
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

      // 2. Create envelope with KBA recipient + EMBEDDED signing.
      // clientUserId = client.id makes the signer embedded — DocuSign
      // expects createRecipientView to mint the iframe URL (rather
      // than emailing the link). The PDF bytes are required (v0 was
      // a scaffold that omitted them; production must include).
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
        documentBase64: input.pdfBase64,
        documentName: input.pdfFilename ?? `${input.taxYear}-form-8879.pdf`,
        clientUserId: client.id,
        externalRef: `${input.clientId}:${input.taxYear}`,
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

      // 3. Persist signatures row FIRST (before createRecipientView).
      //
      // Order matters: the recipient-view URL needs a returnUrl that
      // includes the signature row id. The row id is the path param
      // the portal's /portal/sign-8879/[id] route accepts. Inserting
      // the row before minting the URL means we know the id at
      // mint time. document_text stays null — the PDF is in
      // DocuSign's vault; we'll archive the signed copy on the
      // envelope-completed webhook (TODO).
      //
      // If createRecipientView fails next, the row exists in
      // status='pending' with envelopeId in audit_payload — the
      // portal can call getEmbeddedSigningUrlPortal to retry minting
      // the iframe URL on first visit.
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

      const signatureRowId = sig!.id;

      // 4. Mint the embedded signing URL using the row id in the
      // returnUrl. The /portal prefix matches the actual portal
      // route: /portal/sign-8879/[id]/done.
      const portalBase =
        process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ?? 'https://docket-portal.vercel.app';
      const returnUrl =
        input.returnUrl ??
        `${portalBase}/portal/sign-8879/${signatureRowId}/done`;
      const viewResult = await createRecipientView({
        accessToken: tokenResult.accessToken,
        apiBaseUri: tokenResult.apiBaseUri,
        accountId: creds.accountId,
        envelopeId: envelopeResult.envelopeId,
        clientUserId: client.id,
        signerName: client.fullName,
        signerEmail: client.email,
        returnUrl,
      });
      if (!viewResult.ok) {
        // Envelope + signatures row both exist; the portal can retry
        // mint via getEmbeddedSigningUrlPortal on first visit. Caller
        // gets a distinct reason so the UI can surface "preparing
        // signing surface" rather than a hard error.
        await writeAuditRow(user, input.clientId, false, {
          stage: 'recipient-view',
          envelopeId: envelopeResult.envelopeId,
          signatureRowId,
          message: viewResult.message,
        });
        return {
          ok: false,
          reason: 'recipient-view-failed',
          message: viewResult.message,
          docusignErrorCode: viewResult.errorCode,
        };
      }

      // 4b. Stamp the freshly-minted signing URL onto the row for
      // replay/debug. Portal still re-mints via getEmbeddedSigningUrlPortal
      // on every visit; this is just diagnostic.
      await db
        .update(schema.signatures)
        .set({
          auditPayload: {
            envelopeId: envelopeResult.envelopeId,
            envelopeUri: envelopeResult.uri,
            envelopeStatus: envelopeResult.status,
            taxYear: input.taxYear,
            authHost,
            requestedByUserId: user.id,
            initialSigningUrl: viewResult.signingUrl,
            initialSigningUrlMintedAt: new Date().toISOString(),
          },
        })
        .where(eq(schema.signatures.id, signatureRowId));

      // 5. Audit log.
      await writeAuditRow(user, input.clientId, true, {
        stage: 'envelope-create',
        envelopeId: envelopeResult.envelopeId,
        signatureRowId,
        latencyMs: Date.now() - startedAt,
        taxYear: input.taxYear,
      });

      return {
        ok: true,
        envelopeId: envelopeResult.envelopeId,
        signatureRowId,
        status: envelopeResult.status,
        signingUrl: viewResult.signingUrl,
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

// ────────────────────────────────────────────────────────────────
// getEmbeddedSigningUrl — re-mint the iframe URL for an existing
// pending envelope. DocuSign signing URLs expire after ~5 min, so
// the portal calls this on every /sign-8879/[envelopeId]/page.tsx
// visit rather than caching the URL from the initial request.
//
// AUTH POSTURE
//   This action runs from the CLIENT-PORTAL surface, not command-
//   room. The caller is the taxpayer (Clerk-bound to their phone).
//   Authorization gate: the signatures row's clientId must match a
//   client in the taxpayer's tenant (via withTenant + RLS — RLS
//   alone is the source of truth; explicit checks are defense in
//   depth).
// ────────────────────────────────────────────────────────────────

export type GetEmbeddedSigningUrlResult =
  | { ok: true; signingUrl: string; envelopeId: string }
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

export async function getEmbeddedSigningUrl(
  signatureRowId: string,
  /** Portal user's tenant (resolved via portal's auth path). */
  tenantId: string,
  /** Portal user's client UUID — must match the signature's clientId. */
  clientId: string,
  /** Where DocuSign redirects after sign. */
  returnUrl: string,
  authHost: 'account-d.docusign.com' | 'account.docusign.com' = 'account-d.docusign.com',
): Promise<GetEmbeddedSigningUrlResult> {
  // Rate limit on signatureRowId — minting URLs is cheap but a
  // misbehaving client could burn DocuSign API quota.
  const limit = consumeRateToken(`docusign-sign-url:${signatureRowId}`, 30, 60_000);
  if (!limit.allowed) {
    return {
      ok: false,
      reason: 'rate-limit',
      message: 'Too many signing-URL requests for this signature. Wait a minute and retry.',
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
        // Belt-and-suspenders: RLS already filters by tenant, but
        // explicit clientId match prevents one taxpayer (with two
        // engagements) from peeking at another's signing surface.
        return { ok: false as const, reason: 'not-found' as const, message: 'Signature record not found' };
      }
      if (sig.status === 'signed') {
        return { ok: false as const, reason: 'already-signed' as const, message: 'Already signed' };
      }
      const audit = sig.auditPayload as { envelopeId?: string } | null;
      const envelopeId = audit?.envelopeId;
      if (!envelopeId) {
        return {
          ok: false as const,
          reason: 'not-found' as const,
          message: 'Signature has no envelope id; re-request from command-room',
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

      const [client] = await db
        .select({ fullName: schema.clients.fullName, email: schema.clients.email })
        .from(schema.clients)
        .where(eq(schema.clients.id, clientId))
        .limit(1);
      if (!client || !client.fullName || !client.email) {
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
        signerName: client.fullName,
        signerEmail: client.email,
        returnUrl,
      });
      if (!viewResult.ok) {
        return {
          ok: false as const,
          reason: 'recipient-view-failed' as const,
          message: viewResult.message,
        };
      }

      return { ok: true as const, signingUrl: viewResult.signingUrl, envelopeId };
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'docusign-8879', surface: 'getEmbeddedSigningUrl' },
    });
    return {
      ok: false,
      reason: 'recipient-view-failed',
      message: 'Could not mint signing URL. The error has been logged for review.',
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
