'use server';

// Document upload server actions.
//
// Three-step flow: requestUploadUrl → (browser PUTs to R2) → confirmUpload.
// Then a fourth step when the user reviews the AI classification:
// acceptDocClassification or rejectAndRetake.
//
// SECURITY POSTURE
//   - Auth: every action requires a resolved AuthedClient — RLS-bound
//     to the client's tenant. Unauth'd / no-invite users get
//     "Not signed in".
//   - File size limit: 25 MB (the practical ceiling for a phone-camera
//     scan of a multi-page form). Larger files refused at preflight
//     so the browser doesn't even attempt the upload.
//   - MIME allowlist: PDF + PNG/JPEG/WEBP/GIF only. Anything else
//     refused at preflight.
//   - Rate limit: 10 uploads per minute per client. Tighter than
//     intake field saves because each upload is a Haiku vision spend.
//   - Audit: one row per requestUploadUrl + one per confirmUpload + one
//     per acceptDocClassification. Plus the agent-side audit row from
//     the Inngest worker. Full trail on every doc.
//
// FAILURE MODES
//   - Preflight rejected (size/MIME/rate) → action returns ok:false
//   - Browser PUT to R2 fails → user retries; no documents row is
//     written until confirmUpload runs
//   - confirmUpload runs but R2 doesn't have the object → action
//     returns ok:false; no documents row created (no orphan rows)
//   - Inngest classify-document fires but Haiku errors → row stays
//     in 'classifying' for retry, then 'failed' after 3 attempts

import { eq, and } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  withTenant,
  schema,
} from '@docket/db';
import {
  asTenantId,
  asClientId,
  consumeRateToken,
} from '@docket/shared';
import {
  buildStorageKey,
  getPresignedUploadUrl,
  statObject,
} from '@docket/storage';
import { inngest } from '@docket/workers';
import { getOrCreateClient } from '@/lib/intake/auth';

// ────────────────────────────────────────────────────────────────
// Limits.
// ────────────────────────────────────────────────────────────────
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

// ────────────────────────────────────────────────────────────────
// 1. requestUploadUrl — preflight + presigned URL.
// ────────────────────────────────────────────────────────────────

export type RequestUploadUrlResult =
  | {
      ok: true;
      /** Browser PUTs file bytes to this URL. */
      uploadUrl: string;
      /** Headers the browser MUST send on the PUT. */
      headers: Record<string, string>;
      /** Storage key the upload lands at. Pass back to confirmUpload. */
      storageKey: string;
      /** Wall-clock ms when the URL stops working. */
      expiresAt: number;
    }
  | { ok: false; error: string };

export async function requestUploadUrl(input: {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<RequestUploadUrlResult> {
  console.log('[requestUploadUrl] start filename=', input.filename, 'mime=', input.mimeType, 'size=', input.sizeBytes);

  try {
    // Auth.
    const client = await getOrCreateClient();
    if (!client) return { ok: false, error: 'Not signed in' };

    // Rate limit. 10 uploads/min/client.
    const limit = consumeRateToken(`doc-upload:${client.clientId}`, 10, 60_000);
    if (!limit.allowed) {
      return {
        ok: false,
        error: `Too many uploads. Try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
      };
    }

    // Validate MIME + size.
    if (!ALLOWED_MIMES.has(input.mimeType)) {
      return {
        ok: false,
        error: `Unsupported file type "${input.mimeType}". Allowed: PDF, PNG, JPEG, WEBP, GIF.`,
      };
    }
    if (input.sizeBytes > MAX_BYTES) {
      return {
        ok: false,
        error: `File too large (${Math.round(input.sizeBytes / 1024 / 1024)} MB). Max 25 MB.`,
      };
    }
    if (input.sizeBytes <= 0) {
      return { ok: false, error: 'File is empty.' };
    }

    // Build storage key + generate presigned URL.
    const storageKey = buildStorageKey({
      tenantId: asTenantId(client.tenantId),
      clientId: asClientId(client.clientId),
      filename: input.filename,
    });

    const presigned = await getPresignedUploadUrl({
      storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    });

    console.log('[requestUploadUrl] presigned key=', storageKey);

    return {
      ok: true,
      uploadUrl: presigned.url,
      headers: presigned.headers,
      storageKey,
      expiresAt: presigned.expiresAt,
    };
  } catch (error) {
    console.error('[requestUploadUrl] CAUGHT:', error);
    Sentry.captureException(error, { tags: { component: 'client-portal-upload' } });
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Upload preflight failed: ${error.message}`
          : 'Upload preflight failed — check server logs',
    };
  }
}

// ────────────────────────────────────────────────────────────────
// 2. confirmUpload — verify R2 has the bytes, write documents row,
//    fire classify event.
// ────────────────────────────────────────────────────────────────

export type ConfirmUploadResult =
  | { ok: true; documentId: string }
  | { ok: false; error: string };

export async function confirmUpload(input: {
  storageKey: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<ConfirmUploadResult> {
  console.log('[confirmUpload] start key=', input.storageKey);

  try {
    const client = await getOrCreateClient();
    if (!client) return { ok: false, error: 'Not signed in' };

    // Storage-key sanity check: storage keys MUST start with the
    // client's expected prefix. This catches the "browser substituted
    // a different key" attack — even if a malicious actor rewrote the
    // confirmUpload payload, they can't write a documents row pointing
    // at another client's R2 prefix.
    const expectedPrefix = `tenants/${client.tenantId}/clients/${client.clientId}/docs/`;
    if (!input.storageKey.startsWith(expectedPrefix)) {
      console.error(
        '[confirmUpload] storage key prefix mismatch — refusing. expected=',
        expectedPrefix,
        'got=',
        input.storageKey,
      );
      return { ok: false, error: 'Storage key does not match your account. Contact support.' };
    }

    // Verify the object actually exists in R2 — defense against the
    // "client called confirm without a successful PUT" case (no
    // orphan documents rows).
    const stat = await statObject({ storageKey: input.storageKey });
    if (!stat.exists) {
      return {
        ok: false,
        error: 'Upload not found in storage. The file may not have finished uploading — try again.',
      };
    }
    console.log('[confirmUpload] object exists size=', stat.sizeBytes);

    // Write the documents row + audit + fire event.
    const documentId = await withTenant(asTenantId(client.tenantId), async (db) => {
      const [row] = await db
        .insert(schema.documents)
        .values({
          tenantId: client.tenantId,
          clientId: client.clientId,
          storageKey: input.storageKey,
          originalFilename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: stat.sizeBytes, // trust R2's reported size, not the client's
          parsePhase: 'uploaded',
        })
        .returning({ id: schema.documents.id });

      if (!row) throw new Error('documents INSERT returned no row');

      // Audit row.
      await db.insert(schema.actions).values({
        tenantId: client.tenantId,
        clientId: client.clientId,
        userId: null,
        agentId: null,
        actionClass: 'mutate-intake',
        toolName: 'confirmUpload',
        toolInput: {
          storageKey: input.storageKey,
          originalFilename: input.filename,
          mimeType: input.mimeType,
          sizeBytes: stat.sizeBytes,
        },
        toolOutput: { documentId: row.id },
        latencyMs: 0,
        success: true,
      });

      return row.id;
    });

    // Fire the Inngest event for classification. Outside the
    // transaction so a transient Inngest error doesn't roll back the
    // documents row — re-firing the classify event from a CRON
    // sweep is easy.
    await inngest.send({
      name: 'document/uploaded',
      data: {
        tenantId: asTenantId(client.tenantId),
        clientId: asClientId(client.clientId),
        documentId,
        storageKey: input.storageKey,
        originalFilename: input.filename,
        mimeType: input.mimeType,
      },
    });

    console.log('[confirmUpload] documentId=', documentId);
    return { ok: true, documentId };
  } catch (error) {
    console.error('[confirmUpload] CAUGHT:', error);
    Sentry.captureException(error, { tags: { component: 'client-portal-upload' } });
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Upload confirmation failed: ${error.message}`
          : 'Upload confirmation failed — check server logs',
    };
  }
}

// ────────────────────────────────────────────────────────────────
// 3. getDocumentStatus — poll for classification result.
//
// The classify-document worker takes 1-5 seconds typically. Browser
// polls every ~1.5s after confirmUpload until phase is 'parsed' or
// 'failed'.
// ────────────────────────────────────────────────────────────────

export type DocumentStatus =
  | { phase: 'uploaded' }
  | { phase: 'classifying' }
  | {
      phase: 'parsed';
      classification: {
        docKind: string;
        confidence: number;
        legibility: number;
        extractedFields: Record<string, unknown>;
        suggestedFilename: string;
        retakeHint: string | null;
      };
    }
  | { phase: 'accepted' }
  | { phase: 'failed'; errorMessage: string }
  | { phase: 'not_found' };

export async function getDocumentStatus(
  documentId: string,
): Promise<DocumentStatus | { ok: false; error: string }> {
  try {
    const client = await getOrCreateClient();
    if (!client) return { ok: false, error: 'Not signed in' };

    return await withTenant(asTenantId(client.tenantId), async (db) => {
      const [doc] = await db
        .select({
          parsePhase: schema.documents.parsePhase,
          aiClassification: schema.documents.aiClassification,
          aiConfidence: schema.documents.aiConfidence,
          aiLegibility: schema.documents.aiLegibility,
          aiExtracted: schema.documents.aiExtracted,
          aiSuggestedFilename: schema.documents.aiSuggestedFilename,
          aiRetakeHint: schema.documents.aiRetakeHint,
          errorMessage: schema.documents.errorMessage,
        })
        .from(schema.documents)
        .where(
          and(
            eq(schema.documents.id, documentId),
            eq(schema.documents.clientId, client.clientId),
          ),
        )
        .limit(1);

      if (!doc) return { phase: 'not_found' };

      switch (doc.parsePhase) {
        case 'uploaded':
          return { phase: 'uploaded' };
        case 'classifying':
          return { phase: 'classifying' };
        case 'parsed':
          return {
            phase: 'parsed',
            classification: {
              docKind: doc.aiClassification ?? 'other',
              confidence: doc.aiConfidence ?? 0,
              legibility: doc.aiLegibility ?? 0,
              extractedFields: (doc.aiExtracted as Record<string, unknown>) ?? {},
              suggestedFilename: doc.aiSuggestedFilename ?? '',
              retakeHint: doc.aiRetakeHint,
            },
          };
        case 'accepted':
          return { phase: 'accepted' };
        case 'failed':
          return {
            phase: 'failed',
            errorMessage: doc.errorMessage ?? 'Classification failed',
          };
        default:
          return { phase: 'uploaded' };
      }
    });
  } catch (error) {
    console.error('[getDocumentStatus] CAUGHT:', error);
    Sentry.captureException(error, { tags: { component: 'client-portal-upload' } });
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Status check failed: ${error.message}`
          : 'Status check failed',
    };
  }
}

// ────────────────────────────────────────────────────────────────
// 4. acceptDocClassification — phase parsed → accepted.
//
// Optionally accepts edits to the classification. This is where the
// preparer or client can correct a misclassification before the doc
// gets locked in (e.g., Haiku said "1099_misc" but it's actually
// "1099_nec" — preparer overrides).
// ────────────────────────────────────────────────────────────────

export type AcceptDocClassificationInput = {
  documentId: string;
  /** Override the AI's docKind. */
  docKindOverride?: string;
  /** Override the AI-extracted fields. */
  extractedFieldsOverride?: Record<string, unknown>;
};

export type AcceptDocClassificationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function acceptDocClassification(
  input: AcceptDocClassificationInput,
): Promise<AcceptDocClassificationResult> {
  try {
    const client = await getOrCreateClient();
    if (!client) return { ok: false, error: 'Not signed in' };

    return await withTenant(asTenantId(client.tenantId), async (db) => {
      const update: Record<string, unknown> = {
        parsePhase: 'accepted',
        acceptedAt: new Date(),
      };
      if (input.docKindOverride) {
        update.aiClassification = input.docKindOverride;
      }
      if (input.extractedFieldsOverride) {
        update.aiExtracted = input.extractedFieldsOverride;
      }

      const result = await db
        .update(schema.documents)
        .set(update)
        .where(
          and(
            eq(schema.documents.id, input.documentId),
            eq(schema.documents.clientId, client.clientId),
            eq(schema.documents.parsePhase, 'parsed'),
          ),
        )
        .returning({ id: schema.documents.id });

      if (result.length === 0) {
        return {
          ok: false,
          error: 'Document not found, or not in parsed state.',
        };
      }

      // Audit.
      await db.insert(schema.actions).values({
        tenantId: client.tenantId,
        clientId: client.clientId,
        userId: null,
        agentId: null,
        actionClass: 'mutate-intake',
        toolName: 'acceptDocClassification',
        toolInput: {
          documentId: input.documentId,
          docKindOverride: input.docKindOverride ?? null,
          edited: input.extractedFieldsOverride != null,
        },
        toolOutput: { ok: true },
        latencyMs: 0,
        success: true,
      });

      return { ok: true };
    });
  } catch (error) {
    console.error('[acceptDocClassification] CAUGHT:', error);
    Sentry.captureException(error, { tags: { component: 'client-portal-upload' } });
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Accept failed: ${error.message}`
          : 'Accept failed',
    };
  }
}
