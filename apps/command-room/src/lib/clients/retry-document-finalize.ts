'use server';

// Manual retry for a stuck document.
//
// When parse_phase is 'failed' (terminal) or 'finalizing' (likely
// stuck — Inngest exhausted retries before our onFailure handler
// landed), Antonio can click "Retry processing" in the preview
// overlay. This action:
//
//   1. Resets the row's parse_phase back to 'accepted', clears
//      error_message, and (if this row was the merge winner) clears
//      its merged_into pointer if it was set on a peer row.
//   2. Fires a fresh 'document/accepted' event so the finalize
//      worker re-attempts from a clean slate.
//
// Concurrency: a row can be retried regardless of current state
// (`failed` or `finalizing`) — the only invariant is that the row's
// classification (parse_phase had reached >= 'parsed' at some point,
// i.e., aiClassification is set). We don't reset rows that never made
// it past classify; those need a fresh upload.
//
// Auth: firm_owner | preparer | reviewer.
// Audit: writes a 'mutate-intake' actions row (TODO: 'mutate-document'
// once that enum value exists).

import { eq } from 'drizzle-orm';
import * as Sentry from '@sentry/nextjs';
import {
  withTenant,
  schema,
} from '@docket/db';
import { asTenantId, asClientId } from '@docket/shared';
import { inngest } from '@docket/shared/inngest';
import { requireRole } from '@/lib/require-role';
import { assertWritable } from '@/lib/read-only-mode';

export type RetryDocumentFinalizeResult =
  | { ok: true }
  | { ok: false; error: string };

export async function retryDocumentFinalize(input: {
  documentId: string;
}): Promise<RetryDocumentFinalizeResult> {
  try {
    const user = await requireRole(['firm_owner', 'preparer', 'reviewer']);
    await assertWritable();

    const doc = await withTenant(asTenantId(user.tenantId), async (db) => {
      const [row] = await db
        .select({
          id: schema.documents.id,
          tenantId: schema.documents.tenantId,
          clientId: schema.documents.clientId,
          parsePhase: schema.documents.parsePhase,
          aiClassification: schema.documents.aiClassification,
          mergedIntoDocumentId: schema.documents.mergedIntoDocumentId,
        })
        .from(schema.documents)
        .where(eq(schema.documents.id, input.documentId))
        .limit(1);
      return row ?? null;
    });

    if (!doc) {
      return { ok: false, error: 'Document not found' };
    }

    if (!doc.aiClassification) {
      return {
        ok: false,
        error:
          'Document has not been classified yet — re-upload to retry from the start.',
      };
    }

    if (doc.mergedIntoDocumentId) {
      return {
        ok: false,
        error:
          'This document was merged into another. Open the merged composite to retry.',
      };
    }

    if (doc.parsePhase === 'final') {
      // Already done; treat retry as a no-op success.
      return { ok: true };
    }

    // Reset state so the worker treats this as a fresh accept.
    await withTenant(asTenantId(user.tenantId), async (db) => {
      await db
        .update(schema.documents)
        .set({
          parsePhase: 'accepted',
          errorMessage: null,
          // Clear any partially-written final-side metadata. If the
          // worker writes here on the next run, these get repopulated
          // cleanly.
          finalStorageKey: null,
          finalFilename: null,
          finalSizeBytes: null,
          finalMimeType: null,
          finalizedAt: null,
          binarized: false,
        })
        .where(eq(schema.documents.id, input.documentId));

      // Audit row.
      await db.insert(schema.actions).values({
        tenantId: doc.tenantId,
        clientId: doc.clientId,
        userId: user.id,
        agentId: null,
        actionClass: 'mutate-intake',
        toolName: 'retryDocumentFinalize',
        toolInput: {
          documentId: input.documentId,
          previousPhase: doc.parsePhase,
        },
        toolOutput: { ok: true },
        latencyMs: 0,
        success: true,
      });
    });

    // Fire the event OUTSIDE the transaction. If this fails, the row
    // is already 'accepted' (visually identical to having clicked
    // "Yes, this looks right") — a sweep job or another retry click
    // would re-fire. We surface the error to the caller either way.
    try {
      await inngest.send({
        name: 'document/accepted',
        data: {
          tenantId: asTenantId(doc.tenantId),
          clientId: asClientId(doc.clientId),
          documentId: input.documentId,
        },
      });
    } catch (eventErr) {
      const msg =
        eventErr instanceof Error ? eventErr.message : String(eventErr);
      console.error('[retryDocumentFinalize] inngest.send failed:', msg);
      Sentry.captureException(eventErr, {
        tags: { component: 'retry-document-finalize' },
        extra: { documentId: input.documentId },
      });
      return {
        ok: false,
        error: `Reset succeeded but the retry event didn't dispatch (${msg}). Click again or contact engineering.`,
      };
    }

    return { ok: true };
  } catch (error) {
    console.error('[retryDocumentFinalize] CAUGHT:', error);
    Sentry.captureException(error, {
      tags: { component: 'retry-document-finalize' },
    });
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : 'Retry failed',
    };
  }
}
