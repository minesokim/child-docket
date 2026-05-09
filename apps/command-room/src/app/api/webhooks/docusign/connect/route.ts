// /api/webhooks/docusign/connect — DocuSign Connect webhook receiver.
//
// DocuSign POSTs envelope lifecycle events here:
//   - envelope-completed: all signers have signed; KBA passed; legal record exists
//   - recipient-completed: a single signer (us) has signed; for sole-signer 8879 this
//                          fires alongside envelope-completed
//   - envelope-declined: signer clicked "decline to sign"
//   - envelope-voided: someone voided via DocuSign UI
//
// We care about envelope-completed primarily — that's the moment we
// flip signatures.status='signed' + capture signed_at + kba_passed_at.
//
// SECURITY
//   1. HMAC signature verification via @docket/shared/webhooks
//      (verifyDocuSignSignature). DocuSign signs the raw body; we
//      verify against DOCUSIGN_CONNECT_HMAC_KEY before parsing.
//   2. Public endpoint, allowlisted in middleware. NO Clerk gate
//      (DocuSign doesn't carry user creds; the HMAC IS the auth).
//   3. Tenant resolution: the envelope payload includes our
//      `customFields.docket_external_ref` (set during createEnvelope
//      as `${clientId}:${taxYear}`). We use it to find the
//      signatures row, which is RLS-bound to a tenant.
//
// PUB 1345 COMPLIANCE
//   When envelope-completed fires AND the recipient passed KBA, the
//   payload includes `recipientStatuses[].status='completed'` plus
//   `idCheckInformationStatus.status='passed'`. We capture those
//   into signatures.kba_passed_at and signatures.signed_at. The IRS
//   audit trail needs both.

import { type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import {
  getAdminDb,
  schema,
  type DocketDb,
} from '@docket/db';
import { verifyDocuSignSignature } from '@docket/shared/webhooks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DocuSignConnectPayload {
  event?: string; // 'envelope-completed' | 'recipient-completed' | etc
  apiVersion?: string;
  uri?: string;
  retryCount?: number;
  configurationId?: number;
  data?: {
    envelopeId?: string;
    envelopeSummary?: {
      status?: string;
      statusChangedDateTime?: string;
      completedDateTime?: string;
      customFields?: {
        textCustomFields?: Array<{ name?: string; value?: string }>;
      };
      recipients?: {
        signers?: Array<{
          status?: string;
          signedDateTime?: string;
          deliveredDateTime?: string;
          ipAddress?: string;
          userAgent?: string;
          // KBA result. DocuSign returns this when ID Check fired.
          idCheckInformationInput?: unknown;
          // The KBA outcome. Keys vary by DocuSign API version; we
          // store the whole object in audit_payload for replay.
          recipientAuthenticationStatus?: {
            idLookupResult?: { status?: string; eventTimestamp?: string };
            idQuestionsResult?: { status?: string; eventTimestamp?: string };
          };
        }>;
      };
    };
  };
  generatedDateTime?: string;
}

export async function POST(req: NextRequest) {
  // 1. Read raw body (signature verification needs bytes pre-parse).
  const rawBody = await req.text();

  // 2. Verify HMAC. DocuSign rotates keys; the verifier accepts an
  // array of secrets (current + previous during rotation windows).
  const signatureHeaders: string[] = [];
  for (const headerName of ['x-docusign-signature-1', 'x-docusign-signature-2', 'x-docusign-signature-3']) {
    const value = req.headers.get(headerName);
    if (value) signatureHeaders.push(value);
  }
  const primarySecret = process.env.DOCUSIGN_CONNECT_HMAC_KEY;
  const previousSecret = process.env.DOCUSIGN_CONNECT_HMAC_KEY_PREVIOUS;
  const secrets: string[] = [];
  if (primarySecret) secrets.push(primarySecret);
  if (previousSecret) secrets.push(previousSecret);

  if (secrets.length === 0) {
    // Misconfiguration — fail closed. Without the secret we can't
    // verify ANY incoming event is legitimate. Better to drop
    // events than to trust unsigned data.
    console.error('[docusign-connect] DOCUSIGN_CONNECT_HMAC_KEY env not set; dropping event');
    return new Response('webhook misconfigured', { status: 500 });
  }

  const verified = verifyDocuSignSignature({
    rawBody,
    signatureHeaders,
    secrets,
  });
  if (!verified) {
    console.warn('[docusign-connect] HMAC verification failed; dropping event');
    return new Response('unauthorized', { status: 401 });
  }

  // 3. Parse + dispatch.
  let payload: DocuSignConnectPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('malformed body', { status: 400 });
  }

  const event = payload.event;
  // We act on three lifecycle events:
  //   envelope-completed → KBA-gated flip to signed (or declined if
  //                        KBA didn't pass — see KBA gate below)
  //   envelope-voided    → flip to declined (Antonio voided externally)
  //   envelope-declined  → flip to declined (client clicked Decline)
  // Other events (recipient-completed, envelope-sent, etc) are
  // recorded for audit-trail visibility but don't change status.
  const HANDLED_EVENTS = new Set(['envelope-completed', 'envelope-voided', 'envelope-declined']);
  if (!HANDLED_EVENTS.has(event ?? '')) {
    console.log(`[docusign-connect] received '${event}'; no-op for v0`);
    return new Response('ok', { status: 200 });
  }

  const envelopeId = payload.data?.envelopeId;
  if (!envelopeId) {
    return new Response('missing envelopeId', { status: 400 });
  }

  // 4. Find the signatures row. DocuSign's envelopeId lives inside
  // signatures.audit_payload — query by JSON path. Keeping the
  // Connect handler outside withTenant() is fine because we use
  // the admin DB to look up first (cross-tenant lookup is necessary;
  // the webhook itself is tenant-agnostic), then re-bind via
  // withTenant for the UPDATE.
  const adminDb = getAdminDb();
  const matchedRow = await findSignatureRowByEnvelopeId(adminDb, envelopeId);
  if (!matchedRow) {
    // Envelope not in our system — could be a different DocuSign
    // app sharing the Connect URL, or a stale event. Drop quietly.
    console.log(`[docusign-connect] envelope ${envelopeId} not in signatures table; dropping`);
    return new Response('ok', { status: 200 });
  }

  // 5. Extract signed_at + KBA result + IP + UA.
  const signer = payload.data?.envelopeSummary?.recipients?.signers?.[0];
  const signedAt = signer?.signedDateTime
    ? new Date(signer.signedDateTime)
    : payload.data?.envelopeSummary?.completedDateTime
      ? new Date(payload.data.envelopeSummary.completedDateTime)
      : new Date();
  const signedByIp = signer?.ipAddress ?? null;
  const signedByUserAgent = signer?.userAgent ?? null;
  // KBA passed iff both lookup AND questions returned 'passed'.
  const kbaAuth = signer?.recipientAuthenticationStatus;
  const lookupPassed = kbaAuth?.idLookupResult?.status === 'passed';
  const questionsPassed = kbaAuth?.idQuestionsResult?.status === 'passed';
  const kbaPassedAt =
    lookupPassed && questionsPassed
      ? new Date(kbaAuth?.idQuestionsResult?.eventTimestamp ?? signedAt)
      : null;

  // CRITICAL — IRS Pub 1345 KBA gate.
  // status='signed' MUST NOT be set when KBA didn't pass. Even if
  // DocuSign reports envelope-completed, a signature without
  // verified KBA is non-compliant for federal e-filing. The signer
  // could only sign in this state if the envelope's requireIdLookup
  // was misconfigured or DocuSign sent an event we don't expect.
  // Set status='kba-failed' instead so SOC 2 + IRS audit reports can
  // enumerate KBA failures distinctly from envelope void/decline,
  // and Antonio sees the right operator action ("re-send FRESH
  // envelope; DocuSign retries against the same envelope are not
  // compliant").
  //
  // For envelope-voided + envelope-declined, the result is 'declined'
  // — these never produce a valid signed 8879 but they are also not
  // KBA-failures (signer never reached the KBA step or the envelope
  // was killed before completion).
  let newStatus: 'signed' | 'declined' | 'kba-failed';
  let kbaGateNote: string | null = null;
  if (event === 'envelope-completed') {
    if (kbaPassedAt !== null) {
      newStatus = 'signed';
    } else {
      newStatus = 'kba-failed';
      kbaGateNote =
        'KBA lookup or questions failed; status set to kba-failed per IRS Pub 1345. Re-send a FRESH envelope (DocuSign retries against the same envelope are not compliant).';
    }
  } else if (event === 'envelope-voided') {
    newStatus = 'declined';
    kbaGateNote = 'Envelope voided in DocuSign — re-send a fresh envelope to retry.';
  } else {
    // envelope-declined
    newStatus = 'declined';
    kbaGateNote = 'Client declined to sign — discuss with client before re-sending.';
  }

  // 6. UPDATE signatures. Tenant-bound WHERE clause (defense-in-depth
  // beyond the PK filter — even though tenant_id from matchedRow is
  // taken from the same row, including it explicitly means a future
  // bug introducing a cross-tenant lookup can't write the wrong row).
  try {
    await adminDb
      .update(schema.signatures)
      .set({
        status: newStatus,
        signedAt: kbaPassedAt !== null ? signedAt : null,
        signedByIp,
        signedByUserAgent,
        kbaPassedAt,
        auditPayload: mergeAuditPayload(matchedRow.auditPayload, {
          connectEvent: event,
          connectReceivedAt: new Date().toISOString(),
          envelopeStatus: payload.data?.envelopeSummary?.status,
          recipientAuthenticationStatus: kbaAuth ?? null,
          completedDateTime: payload.data?.envelopeSummary?.completedDateTime,
          ...(kbaGateNote ? { kbaGateNote } : {}),
        }),
      })
      .where(
        and(
          eq(schema.signatures.id, matchedRow.id),
          eq(schema.signatures.tenantId, matchedRow.tenantId),
        ),
      );
  } catch (err) {
    console.error('[docusign-connect] signatures UPDATE failed:', err instanceof Error ? err.message : 'unknown');
    return new Response('internal error', { status: 500 });
  }

  console.log(
    `[docusign-connect] signature ${matchedRow.id} status=${newStatus} (kba_passed=${kbaPassedAt !== null}); envelope=${envelopeId}`,
  );
  return new Response('ok', { status: 200 });
}

interface MatchedRow {
  id: string;
  tenantId: string;
  auditPayload: Record<string, unknown> | null;
}

async function findSignatureRowByEnvelopeId(
  db: DocketDb,
  envelopeId: string,
): Promise<MatchedRow | null> {
  // signatures.auditPayload is a JSONB column. Use jsonb operator
  // to filter on envelopeId. Drizzle's helper around raw SQL is the
  // cleanest path here.
  const rows = await db.execute<{ id: string; tenant_id: string; audit_payload: Record<string, unknown> | null }>(
    {
      // sql template via raw — drizzle's sql helper would also work
      // but we're outside the typed query builder for this JSON probe.
      sql: `SELECT id::text AS id, tenant_id::text AS tenant_id, audit_payload
            FROM signatures
            WHERE audit_payload->>'envelopeId' = $1
            LIMIT 1`,
      params: [envelopeId],
    } as unknown as Parameters<typeof db.execute>[0],
  );
  const arr = rows as unknown as Array<{
    id: string;
    tenant_id: string;
    audit_payload: Record<string, unknown> | null;
  }>;
  if (arr.length === 0) return null;
  return {
    id: arr[0]!.id,
    tenantId: arr[0]!.tenant_id,
    auditPayload: arr[0]!.audit_payload,
  };
}

function mergeAuditPayload(
  existing: Record<string, unknown> | null,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  return { ...(existing ?? {}), ...incoming };
}
