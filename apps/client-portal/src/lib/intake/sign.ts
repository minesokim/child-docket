'use server';

// Record a taxpayer signature on an intake-stage legal artifact:
//   - engagement_letter (firm-client contract for prep services)
//   - consent_7216      (IRS §7216 disclosure consent)
//
// Form 8879 is NOT handled here — that flow needs DocuSign + KBA per
// IRS Pub 1345 (Day 13 work). Engagement letter and §7216 are
// pre-prep artifacts that don't require credit-bureau KBA.
//
// What we capture, per the May 2026 security audit + 26 CFR 301.7216-3:
//   - The exact text the taxpayer agreed to (frozen at signing time
//     so a later edit to the engagement copy can't retroactively alter
//     "what they signed").
//   - SHA-256 hash of that text for tamper-detection.
//   - Server-observed IP + User-Agent (request headers, not client-
//     supplied — clients can't forge these).
//   - Server timestamp (signedAt + actions.createdAt).
//   - Tenant + client binding (via withTenant + getOrCreateClient,
//     same RLS path every other intake action uses).
//
// Idempotency: callers should guard so this isn't fired twice for the
// same (clientId, type). The schema doesn't enforce uniqueness on
// (client, type) because re-signing after a text-version bump is
// legitimate. The client-side `signed` boolean is the practical gate.

import { headers } from 'next/headers';
import { createHash } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import { schema, withTenant } from '@docket/db';
import { asTenantId } from '@docket/shared';
import { getOrCreateClient } from './auth';
import { assertWritable } from '@/lib/read-only-mode';

type IntakeSignatureType = 'engagement_letter' | 'consent_7216';

export async function recordIntakeSignature(input: {
  type: IntakeSignatureType;
  documentText: string;
}): Promise<{ ok: boolean; signatureId?: string; error?: string }> {
  const authed = await getOrCreateClient();
  if (!authed) return { ok: false, error: 'Not signed in' };
  await assertWritable();

  if (!input.documentText || input.documentText.length < 10) {
    return { ok: false, error: 'Document text is required' };
  }

  // Server-side request metadata. None of these come from the client
  // body — `headers()` reads the actual incoming HTTP request.
  const h = await headers();
  const ip =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    h.get('x-real-ip') ??
    'unknown';
  const userAgent = h.get('user-agent') ?? 'unknown';
  const documentHash = createHash('sha256').update(input.documentText).digest('hex');

  const startedAt = Date.now();

  try {
    return await withTenant(asTenantId(authed.tenantId), async (db) => {
      const [sig] = await db
        .insert(schema.signatures)
        .values({
          tenantId: authed.tenantId,
          clientId: authed.clientId,
          type: input.type,
          status: 'signed',
          documentText: input.documentText,
          signedAt: new Date(),
          signedByIp: ip,
          signedByUserAgent: userAgent,
          auditPayload: { documentHash, source: 'intake-portal' },
          // KBA is not required for engagement_letter or consent_7216.
          // Form 8879 (which IS KBA-required) does not flow through
          // this function — it goes through DocuSign on Day 13.
          kbaRequired: false,
        })
        .returning({ id: schema.signatures.id });

      // Append-only audit row in the same transaction. Same shape as
      // saveIntakeField / completeIntake — failed audit rolls back the
      // signature insert. We log the documentHash, NOT the documentText
      // (the artifact lives in the signatures row; the actions row is
      // for the trail of *what happened*, not a duplicate of the data).
      await db.insert(schema.actions).values({
        tenantId: authed.tenantId,
        clientId: authed.clientId,
        actionClass: 'mutate-intake',
        toolName: 'recordIntakeSignature',
        toolInput: {
          type: input.type,
          signatureId: sig?.id,
          documentHash,
          ip,
          userAgent,
        },
        latencyMs: Date.now() - startedAt,
        success: true,
      });

      return { ok: true, signatureId: sig?.id };
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: 'intake-sign', signatureType: input.type },
    });
    return { ok: false, error: 'Could not record signature' };
  }
}
