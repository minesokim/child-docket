// finalize-document — Inngest function that processes a document
// after the user accepts the AI classification.
//
// Trigger: 'document/accepted' event, fired by the
// acceptDocClassification server action.
//
// Pipeline:
//   1. Mark parse_phase = 'finalizing'
//   2. Fetch original bytes from R2 (storage_key)
//   3. Run @docket/document-processing.processDocument
//      → binarize for tax docs / preserve color for IDs / pass-through PDFs
//   4. Resolve final filename from AI suggestion + user edit
//   5. Compute final_storage_key (parallel to original, with .pdf ext)
//   6. Upload final PDF to R2 at final_storage_key
//   7. Update documents row with final-side metadata + advance to 'final'
//   8. Audit row capturing latency + binarized flag + final size
//
// CONCURRENCY
//   Per documentId — same as classify-document. Protects against
//   double-fires.
//
// FAILURE
//   3 retries. After that, parse_phase stays 'failed' and the user
//   sees "We couldn't process this — try again" with a re-upload
//   affordance. The original raw upload at storage_key is preserved
//   regardless so we can debug + retry server-side.

import { eq } from 'drizzle-orm';
import { inngest } from '../inngest-client.js';
import { schema, withTenant } from '@docket/db';
import { asTenantId } from '@docket/shared';
import { getObjectBytes, putObject } from '@docket/storage';
import {
  processDocument,
  resolveFinalFilename,
} from '@docket/document-processing';

export const finalizeDocumentFn = inngest.createFunction(
  {
    id: 'finalize-document',
    name: 'Finalize accepted document',
    concurrency: { key: 'event.data.documentId', limit: 1 },
    retries: 3,
  },
  { event: 'document/accepted' },
  async ({ event, step }) => {
    const { tenantId, clientId, documentId } = event.data;
    const startedAt = Date.now();

    // ─── 1. Fetch the documents row + mark finalizing ───
    const docRow = await step.run('fetch-and-mark-finalizing', async () => {
      return await withTenant(asTenantId(tenantId), async (db) => {
        const [doc] = await db
          .select({
            id: schema.documents.id,
            storageKey: schema.documents.storageKey,
            originalFilename: schema.documents.originalFilename,
            mimeType: schema.documents.mimeType,
            aiClassification: schema.documents.aiClassification,
            aiSuggestedFilename: schema.documents.aiSuggestedFilename,
            finalFilename: schema.documents.finalFilename,
          })
          .from(schema.documents)
          .where(eq(schema.documents.id, documentId))
          .limit(1);

        if (!doc) {
          throw new Error(`finalize-document: documents row ${documentId} not found`);
        }

        await db
          .update(schema.documents)
          .set({ parsePhase: 'finalizing' })
          .where(eq(schema.documents.id, documentId));

        return doc;
      });
    });

    // ─── 2. Fetch original bytes ───
    const originalBytes = await step.run('fetch-from-r2', async () => {
      const buf = await getObjectBytes({ storageKey: docRow.storageKey });
      return { base64: buf.toString('base64'), length: buf.length };
    });

    // ─── 3. Process (binarize + PDF) ───
    const processed = await step.run('process-image', async () => {
      const inputBuffer = Buffer.from(originalBytes.base64, 'base64');
      const result = await processDocument({
        input: inputBuffer,
        inputMimeType: docRow.mimeType,
        docKind: docRow.aiClassification ?? 'other',
      });
      return {
        pdfBase64: result.pdf.toString('base64'),
        sizeBytes: result.sizeBytes,
        binarized: result.binarized,
      };
    });

    // ─── 4. Resolve final filename ───
    // Caller may have set finalFilename in acceptDocClassification
    // (if the user edited the filename in the verification UI). Fall
    // back to the AI's suggestion, then to the original filename.
    const finalFilename = resolveFinalFilename({
      suggested: docRow.aiSuggestedFilename ?? '',
      userEdit: docRow.finalFilename ?? undefined,
      fallback: docRow.originalFilename,
    });

    // ─── 5. Compute final storage key ───
    // Parallel to the original storage key but with /docs/ → /docs-final/
    // and the chosen filename. Same tenant/client prefix so RLS stays
    // consistent and per-tenant token scoping still works in the future.
    const finalStorageKey = docRow.storageKey
      .replace('/docs/', '/docs-final/')
      .replace(/[^/]+$/, finalFilename);

    // ─── 6. Upload final PDF to R2 ───
    await step.run('upload-final', async () => {
      await putObject({
        storageKey: finalStorageKey,
        body: Buffer.from(processed.pdfBase64, 'base64'),
        mimeType: 'application/pdf',
      });
    });

    // ─── 7. Update documents row ───
    await step.run('persist-final', async () => {
      const totalLatencyMs = Date.now() - startedAt;
      await withTenant(asTenantId(tenantId), async (db) => {
        await db
          .update(schema.documents)
          .set({
            parsePhase: 'final',
            finalStorageKey,
            finalFilename,
            finalSizeBytes: processed.sizeBytes,
            finalMimeType: 'application/pdf',
            finalizedAt: new Date(),
            binarized: processed.binarized,
            errorMessage: null,
          })
          .where(eq(schema.documents.id, documentId));

        await db.insert(schema.actions).values({
          tenantId,
          clientId,
          userId: null,
          agentId: 'doc-finalizer',
          actionClass: 'mutate-intake',
          toolName: 'finalizeDocument',
          toolInput: {
            documentId,
            originalStorageKey: docRow.storageKey,
            originalSizeBytes: originalBytes.length,
            inputMimeType: docRow.mimeType,
            docKind: docRow.aiClassification,
          },
          toolOutput: {
            finalStorageKey,
            finalFilename,
            finalSizeBytes: processed.sizeBytes,
            binarized: processed.binarized,
            compressionRatio:
              originalBytes.length > 0
                ? Math.round((processed.sizeBytes / originalBytes.length) * 100) / 100
                : null,
          },
          latencyMs: totalLatencyMs,
          success: true,
        });
      });
    });

    return {
      ok: true,
      documentId,
      finalStorageKey,
      finalFilename,
      binarized: processed.binarized,
      sizeBytes: processed.sizeBytes,
      latencyMs: Date.now() - startedAt,
    };
  },
);
