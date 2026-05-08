'use server';

// Mint a short-lived signed R2 GET URL for a single document, scoped
// to the requesting firm user's tenant.
//
// The result also returns parsePhase + finalizedAt so the preview UI
// can render an honest header label — "Processed" only when the
// finalize worker actually completed; "Processing…" / "Processing
// failed" / "Awaiting verification" for non-terminal states. Earlier
// versions gated on finalStorageKey alone, which lied about state when
// finalize crashed mid-write.
//
// Source modes (which file):
//   'final'    → the processed PDF (binarized + OCR-searchable). Only
//                returned when parse_phase='final' AND
//                final_storage_key is set. ANY OTHER STATE falls back
//                to the raw upload with source='original-fallback'.
//   'original' → the raw upload as-taken. For debugging classification
//                mismatches and viewing the color photo of an ID.
//
// Disposition modes (how the browser handles it):
//   'inline'     (default) — browser renders in iframe / inline viewer.
//   'attachment'           — browser downloads with the canonical name.
//
// Auth: requireRole gate is firm_owner | preparer | reviewer.
// RLS: withTenant scopes the SELECT.
// URL TTL: 5 min.

import { eq, and } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import { withTenant, schema } from '@docket/db';
import { asTenantId } from '@docket/shared';
import { getPresignedDownloadUrl } from '@docket/storage';
import { requireRole } from '@/lib/require-role';

export type DocumentLifecyclePhase =
  | 'uploaded'
  | 'classifying'
  | 'parsed'
  | 'accepted'
  | 'finalizing'
  | 'final'
  | 'failed';

export type GetDocumentViewUrlResult =
  | {
      ok: true;
      url: string;
      expiresAt: number;
      /**
       * Which file is being served:
       *   'final'             — processed PDF (parse_phase='final').
       *   'original'          — explicit "Raw" toggle.
       *   'original-fallback' — caller asked for 'auto' but final
       *                         isn't ready (or never will be). UI
       *                         must NOT label this "Processed".
       */
      source: 'final' | 'original' | 'original-fallback';
      mimeType: string;
      filename: string;
      /**
       * Lifecycle context — included so the preview UI can render
       * "Processing… (3m ago)" / "Processing failed — retry" / etc.
       * without a second round-trip.
       */
      parsePhase: DocumentLifecyclePhase;
      finalizedAtIso: string | null;
      hasFinal: boolean;
      errorMessage: string | null;
    }
  | { ok: false; error: string };

export async function getCommandRoomDocumentViewUrl(input: {
  documentId: string;
  source?: 'auto' | 'original';
  disposition?: 'inline' | 'attachment';
}): Promise<GetDocumentViewUrlResult> {
  try {
    const user = await requireRole(['firm_owner', 'preparer', 'reviewer']);

    const doc = await withTenant(asTenantId(user.tenantId), async (db) => {
      const [row] = await db
        .select({
          id: schema.documents.id,
          storageKey: schema.documents.storageKey,
          originalFilename: schema.documents.originalFilename,
          mimeType: schema.documents.mimeType,
          parsePhase: schema.documents.parsePhase,
          finalStorageKey: schema.documents.finalStorageKey,
          finalFilename: schema.documents.finalFilename,
          finalMimeType: schema.documents.finalMimeType,
          finalizedAt: schema.documents.finalizedAt,
          errorMessage: schema.documents.errorMessage,
        })
        .from(schema.documents)
        .where(and(eq(schema.documents.id, input.documentId)))
        .limit(1);
      return row ?? null;
    });

    if (!doc) {
      return { ok: false, error: 'Document not found' };
    }

    const phase = (doc.parsePhase as DocumentLifecyclePhase) ?? 'uploaded';
    const wantOriginal = input.source === 'original';

    // CRITICAL: useFinal requires BOTH a populated final_storage_key
    // AND parse_phase='final'. Earlier the gate was finalStorageKey
    // alone, which let mid-finalize crashes (storage key written but
    // phase not advanced) show as "Processed" while serving partial
    // or color content.
    const useFinal =
      !wantOriginal && phase === 'final' && !!doc.finalStorageKey;

    const storageKey = useFinal ? doc.finalStorageKey! : doc.storageKey;
    const filename = useFinal
      ? doc.finalFilename ?? doc.originalFilename
      : doc.originalFilename;
    const mimeType = useFinal
      ? doc.finalMimeType ?? 'application/pdf'
      : doc.mimeType;

    const disposition = input.disposition ?? 'inline';

    const presigned = await getPresignedDownloadUrl({
      storageKey,
      ttlSeconds: 5 * 60,
      disposition,
      downloadFilename: disposition === 'attachment' ? filename : undefined,
    });

    const source: 'final' | 'original' | 'original-fallback' = useFinal
      ? 'final'
      : wantOriginal
        ? 'original'
        : 'original-fallback';

    return {
      ok: true,
      url: presigned.url,
      expiresAt: presigned.expiresAt,
      source,
      mimeType,
      filename,
      parsePhase: phase,
      finalizedAtIso: doc.finalizedAt
        ? new Date(doc.finalizedAt).toISOString()
        : null,
      hasFinal: !!doc.finalStorageKey,
      errorMessage: doc.errorMessage,
    };
  } catch (error) {
    console.error('[getCommandRoomDocumentViewUrl] CAUGHT:', error);
    Sentry.captureException(error, {
      tags: { component: 'command-room-doc-view' },
    });
    return {
      ok: false,
      error:
        error instanceof Error
          ? `View URL failed: ${error.message}`
          : 'View URL failed',
    };
  }
}
