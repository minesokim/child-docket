'use server';

// Mint a short-lived signed R2 GET URL for a single document, scoped
// to the requesting firm user's tenant.
//
// Two display modes:
//   'final'    → the processed PDF (binarized for tax docs, color-PDF
//                for IDs). What Antonio actually wants to look at.
//                Falls back to the original if final_storage_key is
//                NULL (worker hasn't completed yet).
//   'original' → the raw upload (the photo as-taken). Useful for
//                debugging classification mismatches.
//
// Auth: requireRole gate is firm_owner | preparer | reviewer (the
// roles that touch real client work). Admin + assistant bounce.
//
// RLS: withTenant scopes the SELECT so a misbehaving client side
// passing some other firm's documentId returns 'not found'.
//
// URL TTL: 5 min. Tight enough that a leaked URL becomes a dead URL
// fast; long enough for a tab to render a multi-MB PDF on a slow
// connection.

import { eq, and } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import { withTenant, schema } from '@docket/db';
import { asTenantId } from '@docket/shared';
import { getPresignedDownloadUrl } from '@docket/storage';
import { requireRole } from '@/lib/require-role';

export type GetDocumentViewUrlResult =
  | { ok: true; url: string; expiresAt: number; mode: 'final' | 'original' }
  | { ok: false; error: string };

export async function getCommandRoomDocumentViewUrl(input: {
  documentId: string;
  /**
   * 'auto' (default) prefers the final processed PDF when available
   * and falls back to original when the worker hasn't finished. Pass
   * 'original' explicitly to view the raw upload regardless.
   */
  mode?: 'auto' | 'original';
}): Promise<GetDocumentViewUrlResult> {
  try {
    const user = await requireRole(['firm_owner', 'preparer', 'reviewer']);

    const doc = await withTenant(asTenantId(user.tenantId), async (db) => {
      const [row] = await db
        .select({
          id: schema.documents.id,
          storageKey: schema.documents.storageKey,
          originalFilename: schema.documents.originalFilename,
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

    const wantOriginal = input.mode === 'original';
    const useFinal = !wantOriginal && !!doc.finalStorageKey;

    const storageKey = useFinal ? doc.finalStorageKey! : doc.storageKey;
    const downloadFilename = useFinal
      ? doc.finalFilename ?? undefined
      : doc.originalFilename;

    const presigned = await getPresignedDownloadUrl({
      storageKey,
      ttlSeconds: 5 * 60,
      downloadFilename,
    });

    return {
      ok: true,
      url: presigned.url,
      expiresAt: presigned.expiresAt,
      mode: useFinal ? 'final' : 'original',
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
