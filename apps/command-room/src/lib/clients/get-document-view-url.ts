'use server';

// Mint a short-lived signed R2 GET URL for a single document, scoped
// to the requesting firm user's tenant.
//
// Source modes (which file):
//   'final'    → the processed PDF (binarized image-input docs, multi-
//                page DL composites, pass-through PDFs). What Antonio
//                actually reviews. Falls back to original if
//                final_storage_key is NULL (worker hasn't completed).
//   'original' → the raw upload as-taken. For debugging classification
//                mismatches and seeing the color photo of an ID.
//
// Disposition modes (how the browser handles it):
//   'inline'     (default) — browser RENDERS the file in place
//                (iframe / new tab viewer). No download triggered.
//   'attachment'           — browser downloads with the suggested
//                            filename. Wired to explicit "Download"
//                            buttons in the UI; never the default.
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

export type GetDocumentViewUrlResult =
  | {
      ok: true;
      url: string;
      expiresAt: number;
      source: 'final' | 'original';
      mimeType: string;
      filename: string;
    }
  | { ok: false; error: string };

export async function getCommandRoomDocumentViewUrl(input: {
  documentId: string;
  /**
   * 'auto' (default) prefers the final processed PDF when available;
   * falls back to original when the worker hasn't finished. Pass
   * 'original' to view the raw upload regardless.
   */
  source?: 'auto' | 'original';
  /**
   * 'inline' (default) — browser renders in iframe / inline viewer.
   * 'attachment' — browser downloads with the canonical filename.
   * The DocumentPreview overlay uses 'inline'; an explicit Download
   * button uses 'attachment'.
   */
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
          finalStorageKey: schema.documents.finalStorageKey,
          finalFilename: schema.documents.finalFilename,
          finalMimeType: schema.documents.finalMimeType,
        })
        .from(schema.documents)
        .where(and(eq(schema.documents.id, input.documentId)))
        .limit(1);
      return row ?? null;
    });

    if (!doc) {
      return { ok: false, error: 'Document not found' };
    }

    const wantOriginal = input.source === 'original';
    const useFinal = !wantOriginal && !!doc.finalStorageKey;

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
      // downloadFilename only honored when disposition === 'attachment'.
      downloadFilename: disposition === 'attachment' ? filename : undefined,
    });

    return {
      ok: true,
      url: presigned.url,
      expiresAt: presigned.expiresAt,
      source: useFinal ? 'final' : 'original',
      mimeType,
      filename,
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
