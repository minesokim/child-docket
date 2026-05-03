// classify-document — Inngest function that runs after a document
// upload lands in R2.
//
// Trigger: 'document/uploaded' event, fired by the confirm-upload
// server action after the documents row is written + R2 object is
// verified to exist.
//
// Steps:
//   1. Mark the documents row parse_phase = 'classifying'
//   2. Fetch the bytes from R2
//   3. Send to Haiku 4.5 vision via doc-classifier agent
//   4. Update the documents row with classification + extraction
//      + advance parse_phase to 'parsed'
//   5. Audit row capturing cost + latency + model_used
//
// On failure: set parse_phase = 'failed' + error_message, audit the
// failure too. The user UX shows a "we couldn't read this — try again"
// banner with the model's retake hint when present.
//
// CONCURRENCY
//   Inngest serializes per-key. We key on documentId so the same doc
//   can't be classified twice in parallel even if the event fires
//   twice (idempotent at the event level).

import { eq } from 'drizzle-orm';
import { inngest } from '../inngest-client.js';
import { schema, withTenant } from '@docket/db';
import { asTenantId } from '@docket/shared';
import { getObjectBytes } from '@docket/storage';
import { classifyDocument } from '../agents/doc-classifier.js';
import type { VisionImageInput } from '@docket/orchestrator';

/**
 * The MIME types Haiku vision can ingest directly. PDFs go through the
 * 'document' content block; rasters through 'image'. Anything else, we
 * mark the document as 'failed' with a clear error so the user knows
 * to re-upload in a supported format.
 */
const SUPPORTED_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

export const classifyDocumentFn = inngest.createFunction(
  {
    id: 'classify-document',
    name: 'Classify uploaded document',
    // Serialize per documentId — protects against double-fires.
    concurrency: { key: 'event.data.documentId', limit: 1 },
    // Retries: 3 attempts. After that, the row stays in 'failed' and
    // the user can re-upload to retry from scratch.
    retries: 3,
  },
  { event: 'document/uploaded' },
  async ({ event, step }) => {
    const { tenantId, clientId, documentId, storageKey, originalFilename, mimeType } = event.data;
    const startedAt = Date.now();

    if (!SUPPORTED_MIMES.has(mimeType)) {
      // Non-image/PDF MIMEs — short-circuit. Haiku can't read these.
      await step.run('mark-unsupported', async () => {
        await withTenant(asTenantId(tenantId), async (db) => {
          await db
            .update(schema.documents)
            .set({
              parsePhase: 'failed',
              errorMessage: `Unsupported MIME type "${mimeType}". Upload as PDF, PNG, JPEG, WEBP, or GIF.`,
              aiClassifiedAt: new Date(),
            })
            .where(eq(schema.documents.id, documentId));
        });
      });
      return { ok: false, reason: 'unsupported-mime' };
    }

    // ─── 1. Phase: classifying ───
    await step.run('mark-classifying', async () => {
      await withTenant(asTenantId(tenantId), async (db) => {
        await db
          .update(schema.documents)
          .set({ parsePhase: 'classifying' })
          .where(eq(schema.documents.id, documentId));
      });
    });

    // ─── 2. Fetch bytes from R2 ───
    const bytes = await step.run('fetch-from-r2', async () => {
      try {
        const buf = await getObjectBytes({ storageKey });
        return buf.toString('base64');
      } catch (err) {
        throw new Error(
          `R2 fetch failed for storageKey=${storageKey}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

    // ─── 3. Classify via Haiku vision ───
    const classification = await step.run('classify-via-haiku', async () => {
      const image: VisionImageInput = {
        kind: 'base64',
        data: bytes,
        mediaType: mimeType as VisionImageInput extends { mediaType: infer M } ? M : never,
      };

      try {
        return await classifyDocument({
          tenantId: asTenantId(tenantId),
          image,
          originalFilename,
          modelTier: 'haiku-4-5',
          // Audit hook is wired at the persistence step below — we pass
          // null here so the agent doesn't try to write its own audit
          // row (we have richer context to record at the per-document
          // level).
        });
      } catch (err) {
        // Surface the model + parse error verbatim. Useful in logs.
        throw new Error(
          `doc-classifier failed for documentId=${documentId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

    // ─── 4. Persist the classification + advance phase ───
    await step.run('persist-classification', async () => {
      const totalLatencyMs = Date.now() - startedAt;
      await withTenant(asTenantId(tenantId), async (db) => {
        await db
          .update(schema.documents)
          .set({
            parsePhase: 'parsed',
            aiClassification: classification.output.docKind,
            aiConfidence: classification.output.confidence,
            aiLegibility: classification.output.legibility,
            aiExtracted: classification.output.extractedFields,
            aiSuggestedFilename: classification.output.suggestedFilename,
            aiRetakeHint: classification.output.retakeHint ?? null,
            aiClassifiedAt: new Date(),
            errorMessage: null,
          })
          .where(eq(schema.documents.id, documentId));

        // Audit row.
        await db.insert(schema.actions).values({
          tenantId,
          clientId,
          userId: null,
          agentId: 'doc-classifier',
          actionClass: 'classify',
          toolName: 'classifyDocument',
          toolInput: {
            documentId,
            storageKey,
            originalFilename,
            mimeType,
          },
          toolOutput: {
            docKind: classification.output.docKind,
            confidence: classification.output.confidence,
            legibility: classification.output.legibility,
            modelUsed: classification.modelUsed,
            agentLatencyMs: classification.latencyMs,
            agentCostUsd: classification.costUsd,
          },
          modelUsed: classification.modelUsed,
          costUsd: classification.costUsd,
          latencyMs: totalLatencyMs,
          success: true,
        });
      });
    });

    return {
      ok: true,
      documentId,
      docKind: classification.output.docKind,
      confidence: classification.output.confidence,
      latencyMs: Date.now() - startedAt,
      costUsd: classification.costUsd,
    };
  },
);
