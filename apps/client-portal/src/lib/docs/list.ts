'use server';

// listDocuments — fetch the current client's uploaded documents for
// the /intake/docs page initial render.
//
// Returns one DocumentRow per document, sorted newest first. Each row
// includes the phase + classification + extracted fields so the UI
// can render the right state (saved / verifying / scanning / failed)
// without follow-up calls.
//
// Auth: requires resolved AuthedClient — RLS scopes to the client's
// tenant + own clientId.

import { eq, desc } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import { withTenant, schema } from '@docket/db';
import { asTenantId } from '@docket/shared';
import { getOrCreateClient } from '@/lib/intake/auth';

export type DocumentRow = {
  documentId: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  parsePhase:
    | 'uploaded'
    | 'classifying'
    | 'parsed'
    | 'accepted'
    | 'finalizing'
    | 'final'
    | 'failed';
  /** Classifier output — populated once parse_phase >= 'parsed'. */
  classification: {
    docKind: string;
    confidence: number;
    legibility: number;
    extractedFields: Record<string, unknown>;
    suggestedFilename: string;
    retakeHint: string | null;
  } | null;
  /** Final filename + binarized flag — populated once parse_phase = 'final'. */
  finalFilename: string | null;
  binarized: boolean;
  errorMessage: string | null;
  /** Bound expected-doc slot id when set at upload time. NULL for "Other" uploads. */
  slotId: string | null;
  createdAtIso: string;
};

export type ListDocumentsResult =
  | { ok: true; documents: DocumentRow[] }
  | { ok: false; error: string };

export async function listDocuments(): Promise<ListDocumentsResult> {
  try {
    const client = await getOrCreateClient();
    if (!client) return { ok: false, error: 'Not signed in' };

    return await withTenant(asTenantId(client.tenantId), async (db) => {
      const rows = await db
        .select({
          documentId: schema.documents.id,
          originalFilename: schema.documents.originalFilename,
          mimeType: schema.documents.mimeType,
          sizeBytes: schema.documents.sizeBytes,
          parsePhase: schema.documents.parsePhase,
          aiClassification: schema.documents.aiClassification,
          aiConfidence: schema.documents.aiConfidence,
          aiLegibility: schema.documents.aiLegibility,
          aiExtracted: schema.documents.aiExtracted,
          aiSuggestedFilename: schema.documents.aiSuggestedFilename,
          aiRetakeHint: schema.documents.aiRetakeHint,
          finalFilename: schema.documents.finalFilename,
          binarized: schema.documents.binarized,
          errorMessage: schema.documents.errorMessage,
          slotId: schema.documents.slotId,
          createdAt: schema.documents.createdAt,
        })
        .from(schema.documents)
        .where(eq(schema.documents.clientId, client.clientId))
        .orderBy(desc(schema.documents.createdAt));

      const documents: DocumentRow[] = rows.map((r) => ({
        documentId: r.documentId,
        originalFilename: r.originalFilename,
        mimeType: r.mimeType,
        sizeBytes: r.sizeBytes,
        parsePhase: (r.parsePhase as DocumentRow['parsePhase']) ?? 'uploaded',
        classification:
          r.aiClassification != null
            ? {
                docKind: r.aiClassification,
                confidence: r.aiConfidence ?? 0,
                legibility: r.aiLegibility ?? 0,
                extractedFields:
                  (r.aiExtracted as Record<string, unknown>) ?? {},
                suggestedFilename: r.aiSuggestedFilename ?? '',
                retakeHint: r.aiRetakeHint,
              }
            : null,
        finalFilename: r.finalFilename,
        binarized: r.binarized ?? false,
        errorMessage: r.errorMessage,
        slotId: r.slotId,
        createdAtIso: r.createdAt.toISOString(),
      }));

      return { ok: true, documents };
    });
  } catch (error) {
    console.error('[listDocuments] CAUGHT:', error);
    Sentry.captureException(error, { tags: { component: 'client-portal-docs-list' } });
    return {
      ok: false,
      error:
        error instanceof Error
          ? `List failed: ${error.message}`
          : 'List failed',
    };
  }
}
