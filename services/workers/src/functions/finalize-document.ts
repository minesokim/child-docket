// finalize-document — Inngest function that processes a document
// after the user accepts the AI classification.
//
// Trigger: 'document/accepted' event, fired by the
// acceptDocClassification server action.
//
// Pipeline (single-doc):
//   1. step('fetch-and-mark-finalizing') — small DB fetch + DEK
//      decrypt + parsePhase = 'finalizing'. Returns metadata only.
//   2. step('detect-merge') — small DB lookup for the peer DL side.
//   3. step('process-and-upload') — fetch R2 bytes (own + maybe peer),
//      run processDocument / processMultiPage (binarize + OCR + PDF),
//      upload PDF to R2 at the final key. Returns ONLY metadata.
//   4. step('persist-final') — DB update on this row + (if merge won)
//      conditional UPDATE on the front row's merged_into.
//   5. step('write-audit') — separate step so the audit insert is
//      independently memoized; Inngest retries can't double-write.
//
// CRITICAL DESIGN — multi-MB image + PDF Buffers MUST NOT cross
// step.run boundaries. Inngest's per-step output is capped at ~4MB
// (writes to its durable queue). A 5MB phone-photo base64'd is ~6.7MB,
// blows the cap, the step's RESULT-WRITE fails (after the function
// body succeeded). Inngest retries → same overflow → 3 retries → run
// dies. Without an onFailure handler, the row was stuck at 'finalizing'
// forever.
//
// FIXED in this version:
//   - process-and-upload runs R2 fetch + sharp/Tesseract + R2 upload
//     all inside one step. Returns only `{ finalStorageKey, sizeBytes,
//     binarized, ... }` — metadata, fits the cap easily.
//   - onFailure handler persists parse_phase='failed' + error_message
//     when Inngest exhausts retries.
//   - Top-level try/catch around the body persists the same state
//     defensively if onFailure isn't reached.
//   - intake_responses query uses desc(taxYear) — earlier code was
//     orderBy ASC which silently selected the OLDEST year's name.
//
// DL MERGE PATH
//   When this row is the BACK of a driver's-license slot AND the
//   FRONT row exists at parse_phase >= 'accepted', the worker fetches
//   both raw images, binarizes each, and emits a single 2-page PDF
//   (front = page 1, back = page 2). The merged row's final_filename
//   drops the Front/Back qualifier. The front row is then marked
//   merged_into_document_id = this row's id, hidden from listings,
//   raw upload preserved.
//
// CONCURRENCY
//   Per documentId — protects against double-fires of the same row.
//   Cross-row coordination (front/back) handled with conditional
//   UPDATEs on the merged_into column.

import { eq, and, isNull, desc } from 'drizzle-orm';
import { inngest } from '../inngest-client.js';
import { schema, withTenant, decryptTreeWithAAD, deriveAAD, getTenantDek } from '@docket/db';
import { asTenantId } from '@docket/shared';
import { getObjectBytes, putObject } from '@docket/storage';
import {
  binarize,
  processDocument,
  processMultiPage,
  resolveFinalFilename,
  wrapImageInPdf,
  wrapImageInSearchablePdf,
} from '@docket/document-processing';
import { runVisionAgent } from '@docket/orchestrator';

// Claude Vision OCR prompt — minimal, extracts visible text. Haiku
// 4.5 vision is the right tier here (the doc-classifier agent uses
// the same model for shape inference). No need for Sonnet — OCR is
// transcription, not reasoning.
const OCR_VISION_PROMPT =
  'Extract ALL visible text from this document, preserving line breaks. ' +
  'Include numbers, dollar amounts, names, dates, form numbers, addresses, ' +
  'and any printed text. Do not summarize, do not add commentary. Return ' +
  'only the extracted text.';

// Helper for the Claude-Vision OCR path. Calls runVisionAgent on a
// binarized PNG and returns the OCR text. Throws on API failure; the
// caller's try/catch falls back to wrapImageInPdf (image-only, non-
// searchable). Cost: ~$0.001-0.003 per page on Haiku 4.5, vs $0/page
// + uncatchable serverless crashes on Tesseract.
type OcrResult = {
  text: string;
  costUsd: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
};

async function ocrViaClaudeVision(
  binarizedPng: Buffer,
  tenantId: string,
): Promise<OcrResult> {
  // Startup assertion — if ANTHROPIC_API_KEY isn't set, runVisionAgent
  // would throw deep in the SDK and the caller's catch would silently
  // degrade to image-only PDFs forever. Log loudly so a misconfigured
  // claude_vision deployment is obvious in worker logs.
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      '[finalize-document] DOCKET_OCR_ENGINE=claude_vision but ANTHROPIC_API_KEY is missing; OCR will silently fall back to image-only PDFs',
    );
    throw new Error('ANTHROPIC_API_KEY not set');
  }
  const result = await runVisionAgent({
    tenantId: asTenantId(tenantId),
    // 'document-triage' is the canonical AgentId for OCR + classification
    // work (see packages/shared/src/index.ts AgentId enum).
    agentId: 'document-triage',
    systemPrompt: 'You are an OCR engine. Extract verbatim text from documents.',
    userPrompt: OCR_VISION_PROMPT,
    images: [
      {
        kind: 'base64',
        data: binarizedPng.toString('base64'),
        mediaType: 'image/png',
      },
    ],
    modelTier: 'haiku-4-5',
    maxTokens: 4000,
    // cachedSystem deliberately OMITTED — the system prompt is ~10
    // tokens, well below Anthropic's 1024-token cache minimum. Setting
    // the flag would be a no-op + misleading per codex review.
  });
  // Surface truncation. Dense W-2/1099 OCR can exceed 4k tokens; the
  // caller's try/catch swallows this and falls back to image-only PDF
  // so the searchable text isn't silently clipped. Future: bump
  // maxTokens or pre-segment the page for very-dense docs.
  if (result.outputTokens >= 4000) {
    console.warn(
      `[finalize-document] OCR output hit maxTokens=4000 (out=${result.outputTokens}); falling back to image-only PDF to avoid silent text truncation`,
    );
    throw new Error('OCR output truncated at maxTokens');
  }
  return {
    text: result.text,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    cachedTokens: result.cachedTokens,
  };
}

// ────────────────────────────────────────────────────────────────
// Slot-id → DL side. Drives DriversLicense → DriversLicenseFront/Back
// substitution in resolveFinalFilename.
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
// Build the canonical name prefix from intake.personal.fullName.
// "Minseo Kim" → "Minseo_Kim". Returns null when no usable name yet.
// ────────────────────────────────────────────────────────────────
function namePrefixFromAnswers(answers: Record<string, unknown> | null): string | null {
  if (!answers) return null;
  const personal = (answers.personal as Record<string, unknown> | undefined) ?? null;
  const fullName = personal?.fullName;
  if (typeof fullName !== 'string') return null;
  const trimmed = fullName.trim();
  if (!trimmed) return null;
  return (
    trimmed
      .replace(/\s+/g, '_')
      .replace(/[^A-Za-z0-9._-]+/g, '')
      .replace(/^_+|_+$/g, '') || null
  );
}

const VERIFIED_PHASES: ReadonlySet<string> = new Set([
  'accepted',
  'finalizing',
  'final',
]);

// Cap stored error_message so a megabyte-long stack trace doesn't
// pollute the documents row.
function truncateError(msg: string | undefined | null, max = 1000): string {
  if (!msg) return 'finalize failed (no message)';
  return msg.length > max ? msg.slice(0, max - 3) + '...' : msg;
}

// Persist parse_phase='failed' + error_message + console.error.
// Used by both onFailure (Inngest exhausted retries) and the
// defensive top-level catch. (Workers don't have @sentry/nextjs in
// scope — Vercel function logs are the observability surface here.)
async function persistFinalizeFailure(
  tenantId: string,
  documentId: string,
  error: unknown,
  context: 'onFailure' | 'top-level-catch',
): Promise<void> {
  const message = truncateError(error instanceof Error ? error.message : String(error));
  try {
    await withTenant(asTenantId(tenantId), async (db) => {
      await db
        .update(schema.documents)
        .set({ parsePhase: 'failed', errorMessage: message })
        .where(eq(schema.documents.id, documentId));
    });
  } catch (persistErr) {
    console.error(
      '[finalize-document] failed to persist failure state:',
      persistErr,
    );
  }
  console.error(
    `[finalize-document.${context}] documentId=${documentId} tenantId=${tenantId}`,
    error,
  );
}

export const finalizeDocumentFn = inngest.createFunction(
  {
    id: 'finalize-document',
    name: 'Finalize accepted document',
    concurrency: { key: 'event.data.documentId', limit: 1 },
    retries: 3,
    // Inngest fires onFailure when retries are exhausted. This is
    // the ONLY place that persists the terminal failure state. The
    // top-level try/catch in the main handler is defensive and only
    // fires if the worker body throws synchronously in a way Inngest
    // doesn't capture.
    onFailure: async ({ event, error }) => {
      // event.data carries the original event's data shape (per
      // Inngest v3 onFailure contract).
      const inner = (event as { data: { event?: { data?: unknown } } }).data;
      const original = (inner?.event?.data ?? inner) as {
        tenantId?: string;
        documentId?: string;
      };
      const tenantId = original.tenantId;
      const documentId = original.documentId;
      if (!tenantId || !documentId) {
        console.error(
          '[finalize-document.onFailure] missing tenantId/documentId in event payload',
        );
        return;
      }
      await persistFinalizeFailure(tenantId, documentId, error, 'onFailure');
    },
  },
  { event: 'document/accepted' },
  async ({ event, step }) => {
    const { tenantId, clientId, documentId } = event.data;
    const startedAt = Date.now();

    try {
      // ─── STEP 1. Fetch row + intake + mark finalizing ───
      // Returns ONLY metadata (no bytes).
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
            throw new Error(
              `finalize-document: documents row ${documentId} not found`,
            );
          }

          if (doc.mergedIntoDocumentId) {
            // Already merged — peer's finalize handled this. No-op.
            return { ...doc, alreadyMerged: true, intakeAnswers: null };
          }

          // Pull the intake answers blob — desc(taxYear) so we get the
          // MOST RECENT year's name, not the earliest. Earlier code
          // had ASC and silently picked stale names from prior years.
          // Pull taxYear too so the AAD builder below can bind to it
          // (intake writes by saveIntakeField are AAD-bound to
          // (tenantId, clientId, taxYear, path); the reader must
          // mirror that tuple).
          const [intake] = await db
            .select({
              answers: schema.intakeResponses.answers,
              taxYear: schema.intakeResponses.taxYear,
            })
            .from(schema.intakeResponses)
            .where(
              and(
                eq(schema.intakeResponses.tenantId, tenantId),
                eq(schema.intakeResponses.clientId, clientId),
              ),
            )
            .orderBy(desc(schema.intakeResponses.taxYear))
            .limit(1);

          let answers: Record<string, unknown> | null = null;
          if (intake?.answers) {
            try {
              const dek = await getTenantDek(db, asTenantId(tenantId));
              const intakeTaxYear = intake.taxYear;
              answers = decryptTreeWithAAD(
                intake.answers as Record<string, unknown>,
                dek,
                (leafPath) =>
                  deriveAAD({
                    tenantId,
                    clientId,
                    taxYear: intakeTaxYear,
                    path: leafPath,
                  }),
              ) as Record<string, unknown>;
            } catch (decryptErr) {
              // Don't fail finalization on decrypt — just skip the
              // name prefix. Logged for ops investigation.
              console.error(
                `[finalize-document] intake decrypt failed for documentId=${documentId}:`,
                decryptErr,
              );
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

      // ─── STEP 2. DL merge detection ───
      // Returns ONLY metadata (slot ids + storage keys, no bytes).
      const dlSide = dlSideForSlot(docRow.slotId);
      const mergeContext = await step.run('detect-merge', async () => {
        if (dlSide !== 'back' || !docRow.slotId) {
          return { merge: false as const };
        }
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
          if (!VERIFIED_PHASES.has(other.parsePhase)) {
            return { merge: false as const };
          }
          if (other.mergedIntoDocumentId) return { merge: false as const };

          return {
            merge: true as const,
            frontId: other.id,
            frontStorageKey: other.storageKey,
            frontMimeType: other.mimeType,
          };
        });
      });

      // ─── STEP 3. Process-and-upload (collapsed) ───
      //
      // CRITICAL: this entire step body runs inside ONE step.run so
      // the multi-MB Buffer (raw image bytes + processed PDF bytes)
      // never crosses the step boundary. Returns ONLY metadata.
      //
      // Inngest's per-step output cap (~4MB) was the cause of the
      // silent finalize hang — phone photos base64-encoded over the
      // wire blew the cap, the step result-write failed AFTER all
      // the work was done, retries replayed the same overflow, and
      // the function died with no error_message because nothing
      // captured it. Now: bytes stay local, only the final R2 key +
      // size cross step boundaries.
      const processed = await step.run('process-and-upload', async () => {
        // Fetch this row's raw bytes from R2.
        const ownBuf = await getObjectBytes({ storageKey: docRow.storageKey });

        // Run the processing pipeline (binarize → OCR → PDF, or
        // pass-through for PDF inputs; multi-page when merging DL).
        let processingResult;
        if (mergeContext.merge) {
          // Fetch the front side too. Both bytes stay inside this step.
          const frontBuf = await getObjectBytes({
            storageKey: mergeContext.frontStorageKey,
          });
          processingResult = await processMultiPage({
            pages: [
              {
                input: frontBuf,
                inputMimeType: mergeContext.frontMimeType,
              },
              {
                input: ownBuf,
                inputMimeType: docRow.mimeType,
              },
            ],
          });
        } else if (
          process.env.DOCKET_OCR_ENGINE === 'claude_vision' &&
          docRow.mimeType !== 'application/pdf'
        ) {
          // Claude Vision OCR path. Binarize the image ONCE and reuse
          // for both OCR + the searchable-PDF wrap. On Vision failure
          // (API down, key missing, output truncated, etc.) fall back
          // to image-only PDF built from the SAME binarized image —
          // NEVER re-enter processDocument here because its DOCKET_
          // ENABLE_OCR branch would route back to Tesseract (the
          // engine we're trying to avoid). Codex caught the re-entry
          // bug 2026-05-14.
          const binarized = await binarize(ownBuf);
          try {
            const ocr = await ocrViaClaudeVision(binarized, tenantId);
            const pdf = await wrapImageInSearchablePdf(binarized, 'image/png', ocr.text);
            processingResult = {
              pdf,
              sizeBytes: pdf.length,
              binarized: true,
            };
            // Cost telemetry — write an audit row capturing the OCR
            // Vision spend so /dashboard/cost can surface per-doc OCR
            // costs alongside the classify-document + triage agent
            // spend (matching the pattern in classify-document.ts
            // lines 148-173). Done as a fire-and-forget so a failed
            // audit write doesn't poison the PDF we already produced.
            // Codex flagged the missing telemetry 2026-05-14.
            //
            // RETRY-DUPLICATE RISK (tracked as known-deferred): this
            // INSERT runs inside the outer step.run('process-and-
            // upload', ...) that ALSO does the R2 putObject below. If
            // R2 upload fails after this audit row commits, Inngest
            // retries the entire step → Vision runs again, second
            // audit row written. Acceptable for v0 because OCR cost
            // is small (~$0.001-0.003 per page) and the retry path
            // is rare. Fix when we see it in telemetry: split the
            // audit write into its own step.run AFTER the upload step
            // succeeds (same pattern as the final-audit split at
            // line 620 of this file).
            //
            // PROVIDER BUCKETING: toolName uses the 'anthropic.' prefix
            // so the cost-rollups SQL at
            // apps/command-room/src/lib/cost-rollups.ts:123-128
            // ('tool_name LIKE 'anthropic.%') correctly buckets Vision
            // OCR spend as Anthropic, not 'other'. Codex caught this
            // 2026-05-14.
            try {
              await withTenant(asTenantId(tenantId), async (db) => {
                await db.insert(schema.actions).values({
                  tenantId,
                  clientId,
                  userId: null,
                  agentId: 'document-triage',
                  actionClass: 'read',
                  toolName: 'anthropic.ocrViaClaudeVision',
                  toolInput: {
                    documentId,
                    storageKey: docRow.storageKey,
                    mimeType: docRow.mimeType,
                    docKind: docRow.aiClassification ?? 'other',
                    inputBytes: binarized.length,
                  },
                  toolOutput: {
                    textLength: ocr.text.length,
                    inputTokens: ocr.inputTokens,
                    outputTokens: ocr.outputTokens,
                    cachedTokens: ocr.cachedTokens,
                    // `truncated` is structurally always false here —
                    // ocrViaClaudeVision throws when outputTokens >=
                    // maxTokens, so reaching this audit-write means
                    // we got clean (non-truncated) output. Kept as
                    // explicit `false` for telemetry-shape stability
                    // in case the caller branch ever changes.
                    truncated: false,
                  },
                  modelUsed: 'haiku-4-5',
                  inputTokens: ocr.inputTokens,
                  outputTokens: ocr.outputTokens,
                  cachedTokens: ocr.cachedTokens,
                  costUsd: ocr.costUsd,
                  latencyMs: ocr.latencyMs,
                  success: true,
                });
              });
            } catch (auditErr) {
              // Audit-row write failure doesn't fail the doc pipeline;
              // log + move on. Spend is still recoverable from the
              // Anthropic dashboard if needed.
              console.warn(
                `[finalize-document] OCR audit-row write failed for documentId=${documentId}:`,
                auditErr,
              );
            }
          } catch (err) {
            console.error(
              '[finalize-document] Claude Vision OCR failed; falling back to image-only PDF (Tesseract path deliberately skipped):',
              err,
            );
            const pdf = await wrapImageInPdf(binarized, 'image/png', true);
            processingResult = {
              pdf,
              sizeBytes: pdf.length,
              binarized: true,
            };
          }
        } else {
          processingResult = await processDocument({
            input: ownBuf,
            inputMimeType: docRow.mimeType,
            docKind: docRow.aiClassification ?? 'other',
          });
        }

        // Resolve filename.
        const namePrefix = namePrefixFromAnswers(docRow.intakeAnswers);
        const effectiveDlSide:
          | 'front'
          | 'back'
          | 'merged'
          | undefined = mergeContext.merge ? 'merged' : dlSide;
        const finalFilename = resolveFinalFilename({
          suggested: docRow.aiSuggestedFilename ?? '',
          namePrefix: namePrefix ?? undefined,
          dlSide: effectiveDlSide,
          fallback: docRow.originalFilename,
        });

        // Compute final storage key.
        //
        // CRITICAL — the documentId goes INTO the path, not just the
        // filename. Earlier we built the key as
        //   tenants/.../docs-final/<finalFilename>
        // but if the same client uploads two docs that the AI gives the
        // same suggested filename (e.g., the user uploads their DL into
        // the W-2 slot AND the 1099-R slot — both rows get filename
        // 'Minseo_DriversLicense_CA_2029exp.pdf'), the second R2 PUT
        // OVERWRITES the first. Both documents rows then point at the
        // same R2 object, and we've silently lost the first doc's
        // bytes. For the user's test case this didn't matter (same DL
        // photo both times), but with real data it's data loss.
        //
        // Now: tenants/.../docs-final/<documentId>/<finalFilename>.
        // documentId is a UUID so collisions can't happen across docs.
        // The user-facing filename in command-room still shows
        // <finalFilename> (it's read from documents.final_filename, not
        // the storage key); only the R2 key is unique-by-doc.
        const finalStorageKey = docRow.storageKey
          .replace('/docs/', '/docs-final/')
          .replace(/[^/]+$/, `${documentId}/${finalFilename}`);

        // Upload to R2. The PDF bytes stay local to this step.
        await putObject({
          storageKey: finalStorageKey,
          body: processingResult.pdf,
          mimeType: 'application/pdf',
        });

        // Return ONLY metadata. Fits well under Inngest's step cap.
        return {
          finalStorageKey,
          finalFilename,
          sizeBytes: processingResult.sizeBytes,
          binarized: processingResult.binarized,
          namePrefix: namePrefix ?? null,
          effectiveDlSide: effectiveDlSide ?? null,
          ownLength: ownBuf.length,
        };
      });

      // ─── STEP 4. Persist final state on documents (+ merge supersede) ───
      const persistResult = await step.run('persist-final', async () => {
        let mergeWon = false;
        await withTenant(asTenantId(tenantId), async (db) => {
          await db
            .update(schema.documents)
            .set({
              parsePhase: 'final',
              finalStorageKey: processed.finalStorageKey,
              finalFilename: processed.finalFilename,
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
        });
        return { mergeWon };
      });

      // ─── STEP 5. Audit row (separate step for idempotency) ───
      //
      // Split out so Inngest retries can't double-write. If the
      // persist-final step succeeded but its result failed to write,
      // a retry replays persist-final (idempotent UPDATE → no-op),
      // then runs write-audit fresh. Without splitting, a retry
      // would re-INSERT the audit row, polluting the audit trail.
      await step.run('write-audit', async () => {
        const totalLatencyMs = Date.now() - startedAt;
        await withTenant(asTenantId(tenantId), async (db) => {
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
              originalSizeBytes: processed.ownLength,
              inputMimeType: docRow.mimeType,
              docKind: docRow.aiClassification,
              slotId: docRow.slotId,
              namePrefix: processed.namePrefix,
              dlSide: processed.effectiveDlSide,
              mergedFrontDocumentId: mergeContext.merge
                ? mergeContext.frontId
                : null,
              mergeWon: persistResult.mergeWon,
            },
            toolOutput: {
              finalStorageKey: processed.finalStorageKey,
              finalFilename: processed.finalFilename,
              finalSizeBytes: processed.sizeBytes,
              binarized: processed.binarized,
              compressionRatio:
                processed.ownLength > 0
                  ? Math.round(
                      (processed.sizeBytes / processed.ownLength) * 100,
                    ) / 100
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
        finalStorageKey: processed.finalStorageKey,
        finalFilename: processed.finalFilename,
        binarized: processed.binarized,
        sizeBytes: processed.sizeBytes,
        merged: mergeContext.merge,
        mergeWon: persistResult.mergeWon,
        latencyMs: Date.now() - startedAt,
      };
    } catch (err) {
      // Defensive top-level catch. onFailure is the primary failure
      // surface (fires once after retries exhaust); this catches
      // anything Inngest doesn't reach via onFailure (rare). We
      // re-throw so Inngest still records the run as failed and
      // continues to retry per the function's retry policy.
      await persistFinalizeFailure(tenantId, documentId, err, 'top-level-catch');
      throw err;
    }
  },
);
