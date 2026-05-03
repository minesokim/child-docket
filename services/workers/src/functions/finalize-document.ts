// finalize-document — Inngest function that processes a document
// after the user accepts the AI classification.
//
// Trigger: 'document/accepted' event, fired by the
// acceptDocClassification server action.
//
// Pipeline (single-doc):
//   1. Mark parse_phase = 'finalizing'.
//   2. Fetch original bytes from R2 (storage_key).
//   3. Run @docket/document-processing.processDocument
//      → grayscale + Otsu binarize + 1-bit PDF for image inputs;
//        pass-through for PDF inputs.
//   4. Resolve final filename from AI suggestion + name prefix + slot side.
//   5. Compute final_storage_key (parallel to original, with .pdf ext).
//   6. Upload final PDF to R2.
//   7. Update documents row with final-side metadata + advance to 'final'.
//   8. Audit row capturing latency + binarized flag + final size.
//
// DL MERGE PATH
//   When this row is the BACK of a driver's-license slot AND the
//   FRONT row exists for the same client at parse_phase >= 'accepted',
//   the worker fetches both raw images, binarizes each, and emits a
//   single 2-page PDF (front = page 1, back = page 2). The merged
//   row's final_filename drops the Front/Back qualifier
//   (Minseo_Kim_DriversLicense_CA_2029exp.pdf). The front row is then
//   marked merged_into_document_id = this row's id, which hides it
//   from doc listings while preserving the raw upload for audit.
//
//   The FRONT row's own finalize is allowed to run normally (single-
//   page PDF). If the back's finalize runs second and supersedes,
//   front's single-page PDF becomes an orphan in R2 (cleaned up by a
//   sweep job). If the front's finalize runs second and finds itself
//   already merged_into something, it exits early without writing.
//
// CONCURRENCY
//   Per documentId — protects against double-fires of the same row.
//   Cross-row coordination (front/back) is handled with conditional
//   UPDATEs on the merged_into column, so only one side wins the
//   "I'm the merger" claim.
//
// FAILURE
//   3 retries. After that, parse_phase stays 'failed' and the user
//   sees "We couldn't process this — try again". The original raw
//   upload at storage_key is preserved regardless so we can debug +
//   retry server-side.

import { eq, and, isNull } from 'drizzle-orm';
import { inngest } from '../inngest-client.js';
import { schema, withTenant, decryptTree, getTenantDek } from '@docket/db';
import { asTenantId } from '@docket/shared';
import { getObjectBytes, putObject } from '@docket/storage';
import {
  processDocument,
  processMultiPage,
  resolveFinalFilename,
} from '@docket/document-processing';

// ────────────────────────────────────────────────────────────────
// Slot-id → DL side. Drives DriversLicense → DriversLicenseFront/Back
// substitution in resolveFinalFilename. Spouse slots use the same
// side semantics — the `Spouse's` distinction comes from the AI's
// suggested filename, not the slot id.
// ────────────────────────────────────────────────────────────────
function dlSideForSlot(slotId: string | null | undefined): 'front' | 'back' | undefined {
  if (!slotId) return undefined;
  if (slotId.endsWith('-dl-front')) return 'front';
  if (slotId.endsWith('-dl-back')) return 'back';
  return undefined;
}

function otherSideSlotId(slotId: string): string | null {
  if (slotId.endsWith('-dl-front')) return slotId.replace(/-front$/, '-back');
  if (slotId.endsWith('-dl-back')) return slotId.replace(/-back$/, '-front');
  return null;
}

// ────────────────────────────────────────────────────────────────
// Build the canonical name prefix from the intake's full-name field.
// "Minseo Kim" → "Minseo_Kim". Multi-word names (e.g., "Maria Del
// Carmen Lopez") preserve every word. Returns null when the answers
// have no usable name yet (intake mid-flight uploads).
// ────────────────────────────────────────────────────────────────
function namePrefixFromAnswers(answers: Record<string, unknown> | null): string | null {
  if (!answers) return null;
  const personal = (answers.personal as Record<string, unknown> | undefined) ?? null;
  const fullName = personal?.fullName;
  if (typeof fullName !== 'string') return null;
  const trimmed = fullName.trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]+/g, '')
    .replace(/^_+|_+$/g, '') || null;
}

const VERIFIED_PHASES: ReadonlySet<string> = new Set([
  'accepted',
  'finalizing',
  'final',
]);

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

    // ─── 1. Fetch the documents row + intake name + mark finalizing ───
    //
    // Also short-circuits if this row was already merged into another
    // (e.g., the BACK's finalize ran first and superseded this FRONT
    // row). In that case the merger has already produced the final
    // PDF; this worker has nothing to do.
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
            slotId: schema.documents.slotId,
            mergedIntoDocumentId: schema.documents.mergedIntoDocumentId,
          })
          .from(schema.documents)
          .where(eq(schema.documents.id, documentId))
          .limit(1);

        if (!doc) {
          throw new Error(`finalize-document: documents row ${documentId} not found`);
        }

        if (doc.mergedIntoDocumentId) {
          // Already merged — peer's finalize handled this. No-op.
          return { ...doc, alreadyMerged: true, intakeAnswers: null };
        }

        // Pull the intake's encrypted answers blob — `personal.fullName`
        // is plaintext (encryption only covers SSN/EIN/bank), but we
        // run decryptTree anyway to no-op on plaintext leaves and stay
        // consistent with read-side helpers.
        const [intake] = await db
          .select({
            answers: schema.intakeResponses.answers,
          })
          .from(schema.intakeResponses)
          .where(
            and(
              eq(schema.intakeResponses.tenantId, tenantId),
              eq(schema.intakeResponses.clientId, clientId),
            ),
          )
          .orderBy(schema.intakeResponses.taxYear)
          .limit(1);

        let answers: Record<string, unknown> | null = null;
        if (intake?.answers) {
          try {
            const dek = await getTenantDek(db, asTenantId(tenantId));
            answers = decryptTree(
              intake.answers as Record<string, unknown>,
              dek,
            ) as Record<string, unknown>;
          } catch (err) {
            console.error('[finalize-document] intake decrypt failed:', err);
          }
        }

        await db
          .update(schema.documents)
          .set({ parsePhase: 'finalizing' })
          .where(eq(schema.documents.id, documentId));

        return { ...doc, alreadyMerged: false, intakeAnswers: answers };
      });
    });

    if (docRow.alreadyMerged) {
      return {
        ok: true,
        documentId,
        skipped: 'already-merged',
        latencyMs: Date.now() - startedAt,
      };
    }

    // ─── 2. DL merge detection ───
    //
    // Only the BACK side initiates merging. If this is a FRONT slot,
    // skip the merge attempt and run the single-page path. If/when
    // the BACK runs its finalize, it picks up this row's raw and
    // produces the merged 2-page PDF (and supersedes our single-page
    // by setting our merged_into).
    const dlSide = dlSideForSlot(docRow.slotId);
    const mergeContext = await step.run('detect-merge', async () => {
      if (dlSide !== 'back' || !docRow.slotId) return { merge: false as const };
      const otherSlot = otherSideSlotId(docRow.slotId);
      if (!otherSlot) return { merge: false as const };

      return await withTenant(asTenantId(tenantId), async (db) => {
        const [other] = await db
          .select({
            id: schema.documents.id,
            storageKey: schema.documents.storageKey,
            mimeType: schema.documents.mimeType,
            parsePhase: schema.documents.parsePhase,
            mergedIntoDocumentId: schema.documents.mergedIntoDocumentId,
          })
          .from(schema.documents)
          .where(
            and(
              eq(schema.documents.clientId, clientId),
              eq(schema.documents.slotId, otherSlot),
            ),
          )
          .limit(1);

        if (!other) return { merge: false as const };
        if (!VERIFIED_PHASES.has(other.parsePhase)) return { merge: false as const };
        if (other.mergedIntoDocumentId) return { merge: false as const };

        return {
          merge: true as const,
          frontId: other.id,
          frontStorageKey: other.storageKey,
          frontMimeType: other.mimeType,
        };
      });
    });

    // ─── 3. Fetch raw bytes (own + maybe peer's) ───
    const rawBytes = await step.run('fetch-from-r2', async () => {
      const ownBuf = await getObjectBytes({ storageKey: docRow.storageKey });
      const out: {
        ownBase64: string;
        ownLength: number;
        frontBase64?: string;
        frontLength?: number;
      } = {
        ownBase64: ownBuf.toString('base64'),
        ownLength: ownBuf.length,
      };
      if (mergeContext.merge) {
        const frontBuf = await getObjectBytes({
          storageKey: mergeContext.frontStorageKey,
        });
        out.frontBase64 = frontBuf.toString('base64');
        out.frontLength = frontBuf.length;
      }
      return out;
    });

    // ─── 4. Process: single-page or merged 2-page ───
    const processed = await step.run('process-image', async () => {
      const ownInput = Buffer.from(rawBytes.ownBase64, 'base64');

      if (mergeContext.merge && rawBytes.frontBase64) {
        // 2-page merged DL: front is page 1, back is page 2.
        const frontInput = Buffer.from(rawBytes.frontBase64, 'base64');
        const result = await processMultiPage({
          pages: [
            { input: frontInput, inputMimeType: mergeContext.frontMimeType },
            { input: ownInput, inputMimeType: docRow.mimeType },
          ],
        });
        return {
          pdfBase64: result.pdf.toString('base64'),
          sizeBytes: result.sizeBytes,
          binarized: result.binarized,
        };
      }

      // Single-page (any docKind, including DL front-only or back-only).
      const result = await processDocument({
        input: ownInput,
        inputMimeType: docRow.mimeType,
        docKind: docRow.aiClassification ?? 'other',
      });
      return {
        pdfBase64: result.pdf.toString('base64'),
        sizeBytes: result.sizeBytes,
        binarized: result.binarized,
      };
    });

    // ─── 5. Resolve final filename ───
    // Composition: {NamePrefix}_{ProcessedAISuggestion}.pdf
    // For merged DL: dlSide = 'merged' strips Front/Back qualifier
    // entirely (Minseo_Kim_DriversLicense_CA_2029exp.pdf).
    const namePrefix = namePrefixFromAnswers(docRow.intakeAnswers);
    const effectiveDlSide: 'front' | 'back' | 'merged' | undefined = mergeContext.merge
      ? 'merged'
      : dlSide;
    const finalFilename = resolveFinalFilename({
      suggested: docRow.aiSuggestedFilename ?? '',
      namePrefix: namePrefix ?? undefined,
      dlSide: effectiveDlSide,
      fallback: docRow.originalFilename,
    });

    // ─── 6. Compute final storage key ───
    const finalStorageKey = docRow.storageKey
      .replace('/docs/', '/docs-final/')
      .replace(/[^/]+$/, finalFilename);

    // ─── 7. Upload final PDF to R2 ───
    await step.run('upload-final', async () => {
      await putObject({
        storageKey: finalStorageKey,
        body: Buffer.from(processed.pdfBase64, 'base64'),
        mimeType: 'application/pdf',
      });
    });

    // ─── 8. Update documents row(s) ───
    //
    // For the merge path, we run a CONDITIONAL UPDATE on the front
    // row: only set merged_into if front.merged_into IS NULL. If the
    // front's own finalize ran concurrently and beat us to writing
    // its own state, that's OK — the front's row is already 'final'
    // with a single-page PDF, and we now overwrite the listing
    // semantics by setting merged_into = us. The orphaned front
    // single-page PDF gets cleaned up later by a sweep.
    const persistResult = await step.run('persist-final', async () => {
      const totalLatencyMs = Date.now() - startedAt;
      let mergeWon = false;
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

        if (mergeContext.merge) {
          const updated = await db
            .update(schema.documents)
            .set({
              mergedIntoDocumentId: documentId,
              parsePhase: 'final',
            })
            .where(
              and(
                eq(schema.documents.id, mergeContext.frontId),
                isNull(schema.documents.mergedIntoDocumentId),
              ),
            )
            .returning({ id: schema.documents.id });
          mergeWon = updated.length > 0;
        }

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
            originalSizeBytes: rawBytes.ownLength,
            inputMimeType: docRow.mimeType,
            docKind: docRow.aiClassification,
            slotId: docRow.slotId,
            namePrefix: namePrefix ?? null,
            dlSide: effectiveDlSide ?? null,
            mergedFrontDocumentId: mergeContext.merge ? mergeContext.frontId : null,
            mergeWon,
          },
          toolOutput: {
            finalStorageKey,
            finalFilename,
            finalSizeBytes: processed.sizeBytes,
            binarized: processed.binarized,
            compressionRatio:
              rawBytes.ownLength > 0
                ? Math.round((processed.sizeBytes / rawBytes.ownLength) * 100) / 100
                : null,
          },
          latencyMs: totalLatencyMs,
          success: true,
        });
      });
      return { mergeWon };
    });

    return {
      ok: true,
      documentId,
      finalStorageKey,
      finalFilename,
      binarized: processed.binarized,
      sizeBytes: processed.sizeBytes,
      merged: mergeContext.merge,
      mergeWon: persistResult.mergeWon,
      latencyMs: Date.now() - startedAt,
    };
  },
);
