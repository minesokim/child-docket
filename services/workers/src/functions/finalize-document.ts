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

import { eq, and } from 'drizzle-orm';
import { inngest } from '../inngest-client.js';
import { schema, withTenant, decryptTree, getTenantDek } from '@docket/db';
import { asTenantId } from '@docket/shared';
import { getObjectBytes, putObject } from '@docket/storage';
import {
  processDocument,
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
  // Sanitize to filename-safe + collapse internal whitespace to one
  // underscore. resolveFinalFilename runs the same regex but applying
  // it here keeps the prefix predictable in logs/audit rows.
  return trimmed
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9._-]+/g, '')
    .replace(/^_+|_+$/g, '') || null;
}

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
    // The finalize step needs three things to compose the canonical
    // filename:
    //   - the AI's suggestion + classification (from documents)
    //   - the bound slot id (drives DL Front/Back substitution)
    //   - the taxpayer's name from intake.personal.fullName (drives
    //     the "Minseo_Kim_" prefix)
    //
    // We pull all of it in one transaction so a half-finished intake
    // (no name yet) gracefully falls back to the unprefixed filename
    // — never blocks finalization.
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
          })
          .from(schema.documents)
          .where(eq(schema.documents.id, documentId))
          .limit(1);

        if (!doc) {
          throw new Error(`finalize-document: documents row ${documentId} not found`);
        }

        // Pull the intake's encrypted answers blob — `personal.fullName`
        // is plaintext (not encrypted; encryption only covers SSN/EIN/
        // bank), but we run decryptTree anyway to no-op on plaintext
        // leaves and stay consistent with the read-side helpers.
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
            // Don't fail finalization on a decryption hiccup — just
            // skip the name prefix.
            console.error('[finalize-document] intake decrypt failed:', err);
          }
        }

        await db
          .update(schema.documents)
          .set({ parsePhase: 'finalizing' })
          .where(eq(schema.documents.id, documentId));

        return { ...doc, intakeAnswers: answers };
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
    // Server fully owns the filename — the user never edits or sees
    // it during upload. Composition: {NamePrefix}_{ProcessedAISuggestion}.pdf
    // where NamePrefix = sanitized intake.personal.fullName and the
    // suggestion has DriversLicense → DriversLicenseFront/Back applied
    // when the bound slot tells us which side.
    const namePrefix = namePrefixFromAnswers(docRow.intakeAnswers);
    const dlSide = dlSideForSlot(docRow.slotId);
    const finalFilename = resolveFinalFilename({
      suggested: docRow.aiSuggestedFilename ?? '',
      namePrefix: namePrefix ?? undefined,
      dlSide,
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
            slotId: docRow.slotId,
            namePrefix: namePrefix ?? null,
            dlSide: dlSide ?? null,
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
