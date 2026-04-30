# Document capture pipeline

> Spec for the docs-upload flow. The 4-phase UX (empty → scanning → retake → parsed) ports against this contract. v0 ships with mocked phase progression; this spec is the wire-up target.

**Owner:** David
**Status:** spec, not yet wired
**5/15 ship target:** Stages 3 + 4 minimum (mock Stages 1–2 for v0 demo)

---

## 1. Architecture

Four stages, two boundaries (browser ↔ server):

```
[Browser]                         [Server]                          [Storage]
─────────────                     ──────────                        ─────────

Stage 1                Stage 2          Stage 3                  Stage 4
Capture ──────────►   Quality ──upl──►  Haiku 4.5 vision ──────► R2 + Postgres
overlay               gate              (JSON verdict)            (PDF wrap)
(jscanify)            (Laplacian +
                       brightness +
                       fill ratio)
```

| Stage | Where | Purpose | v0 (5/15) | v1+ |
|---|---|---|---|---|
| 1. Capture overlay | Browser | Live edge detection + auto-capture trigger | Vanilla `<input type="file" capture="environment">` | jscanify with auto-capture |
| 2. Quality gate | Browser | Reject blurry/dark/cropped before API spend | Skip (server rejects bad shots) | Laplacian variance + brightness mean + fill ratio |
| 3. Vision verdict | Next.js Server Action | Legibility + classification + filename in one call | **Required.** Haiku 4.5 vision. | Same. Threshold tuning over time. |
| 4. PDF wrap + store | Inngest job | Wrap image, upload to R2, insert document row | **Required.** pdf-lib + R2 + Postgres. | Multi-page append, Document AI fallback for hard W-2s. |

**Why not Document AI:** explicitly deferred (CLAUDE.md §6). Sonnet/Haiku vision handles tax forms well enough for v0. Adding a second vendor doubles auth/compliance/billing surface.

**Why not native:** v0 is web-only. React Native scanner is v2+ if a native shell ever ships.

---

## 2. Stage 3 — Haiku 4.5 vision call

**One call per document. Returns legibility verdict + classification + filename suggestion.**

### Endpoint

```
POST /api/intake/documents/classify
```

Server Action body:
```typescript
{
  imageBase64: string;     // JPEG/PNG, client-side capture
  intakeSessionId: string; // ties to client portal session
  documentSlot: string;    // 'w2-1' | '1099-misc-1' | 'prior-year-return' | etc.
}
```

### Haiku system prompt

```
You are processing a tax document for an enrolled agent's practice management system.
You will receive ONE image of a single document page.

Return STRICT JSON matching this schema. No prose, no markdown.
{
  "is_legible": boolean,
  "legibility_reason": "clear" | "blurry" | "glare" | "cropped" | "too_dark" | "wrong_orientation",
  "document_type": "W-2" | "1099-NEC" | "1099-MISC" | "1099-INT" | "1099-DIV" | "1099-K" | "1099-R" | "1098" | "1098-T" | "1098-E" | "1040" | "Schedule C" | "Schedule E" | "Schedule K-1" | "Bank Statement" | "Brokerage Statement" | "Receipt" | "ID" | "SSN Card" | "Other",
  "tax_year": "YYYY" | null,
  "payer_or_source": string | null,
  "recipient_name": string | null,
  "suggested_filename": string,
  "key_fields": {
    "field_name": "extracted_value"
  },
  "confidence": 0.0
}

Rules:
- If is_legible=false, set document_type/tax_year/payer/recipient/key_fields all to null. Filename can still be generic.
- suggested_filename format: "{tax_year}_{document_type}_{payer_or_source}_{recipient_name}.pdf" with spaces → underscores, no special chars except underscore and dash. If a field is null, omit it.
- key_fields: extract 3 most important fields for the document type. W-2: employer, wages_box1, fed_withheld_box2. 1099-NEC: payer, nonemployee_comp_box1. Etc.
- confidence: float 0.0–1.0. Below 0.7 should trigger preparer review even if is_legible=true.
- NEVER hallucinate. If you can't read a field, use null.
```

### Cost economics

Haiku 4.5: $0.80/M input tokens, $4.00/M output tokens.

Per call:
- Image at standard res ≈ 1500 input tokens = **$0.0012**
- JSON response ≈ 200 output tokens = **$0.0008**
- **Total: ~$0.002 per document**

10K docs/month per firm = $20/month. Rounding error.

With prompt caching on the system prompt (CLAUDE.md §6 default):
- Cached input: $0.08/M = ~$0.00012 per call
- **Total cached: ~$0.0009 per document**

### Failure modes

| Failure | Handling |
|---|---|
| Haiku returns invalid JSON | Retry once with stricter prompt. If still bad, surface generic "scanning failed" error to user. |
| Network timeout | Inngest retries with backoff. User sees "still processing". |
| Image too large (>5MB) | Resize client-side to 1024px max edge before upload. |
| `is_legible=false` | Show retake screen with `legibility_reason` mapped to user-facing copy. |
| `confidence < 0.7` | Flag for preparer review; user still sees parsed state. Preparer reviews in Command Room "Need You" queue. |

---

## 3. Stage 4 — PDF wrap + storage

### Postgres schema

Add to `packages/db/src/schema.ts`:

```typescript
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  clientId: uuid('client_id').notNull(),
  intakeSessionId: uuid('intake_session_id'), // null after returning portal upload
  documentSlot: text('document_slot').notNull(), // 'w2-1', '1099-misc-1', etc.

  // Vision verdict
  isLegible: boolean('is_legible').notNull(),
  legibilityReason: text('legibility_reason'),
  documentType: text('document_type'),
  taxYear: text('tax_year'),
  payerOrSource: text('payer_or_source'),
  recipientName: text('recipient_name'),
  suggestedFilename: text('suggested_filename'),
  confirmedFilename: text('confirmed_filename'), // null until preparer approves
  keyFields: jsonb('key_fields'),
  confidence: numeric('confidence', { precision: 3, scale: 2 }),

  // Storage
  r2ObjectKey: text('r2_object_key').notNull(), // path in R2
  pdfPageCount: integer('pdf_page_count').default(1).notNull(),

  // Lifecycle
  status: text('status').notNull(), // 'awaiting_review' | 'approved' | 'rejected' | 'replaced'
  reviewerId: uuid('reviewer_id'),
  reviewedAt: timestamp('reviewed_at'),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

RLS policy: same pattern as other tenant-scoped tables (see `packages/db/migrations/0001_rls_policies.sql`).

### R2 object key format

```
documents/{tenantId}/{clientId}/{intakeSessionId}/{documentSlot}-{timestamp}.pdf
```

### PDF wrap (pdf-lib in Inngest job)

```typescript
import { PDFDocument } from 'pdf-lib';

async function wrapImageAsPdf(jpegBytes: Uint8Array): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const image = await pdf.embedJpg(jpegBytes);
  const page = pdf.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  return pdf.save();
}
```

For multi-page (1099-B can be 12 pages), append subsequent pages to same PDF object. Classify only page 1.

---

## 4. Trust gate — filename approval

**Filename hallucination is real.** Haiku will confidently invent a wrong tax year or misread a payer name on a smudged W-2. Same trust pattern as Inbox Drafter:

- AI **suggests** `suggested_filename`.
- Document row enters with `status='awaiting_review'`.
- Preparer reviews in Command Room "Need You" queue.
- One-tap **Approve** copies suggested → `confirmedFilename` and sets `status='approved'`.
- One-tap **Edit** opens an inline rename, then saves to `confirmedFilename`.

**Never auto-commit.** Even at confidence 0.99.

This matches CLAUDE.md §8 trust escalation Level 1 (suggest + verbose reasoning, every action approved). After Antonio's first month of usage data, threshold may relax to auto-approve at confidence ≥ 0.95 (Level 2).

---

## 5. Threshold tuning

Ship permissive in v0. Tighten via real signal in Month 1.

| Threshold | v0 default | Tightening trigger |
|---|---|---|
| `is_legible=true` minimum confidence | 0.5 | Antonio rejection rate > 15% |
| Auto-approve filename | Never (Level 1) | Antonio approval rate > 95% on classification AND confidence ≥ 0.95 |
| Server-side blur check (Stage 2) | Off (rely on Haiku verdict) | Cost per uploaded doc > $0.005 |

### Telemetry events

Every doc upload writes to the `actions` audit ledger:

```typescript
{
  type: 'document.uploaded',
  meta: {
    documentSlot, documentType, taxYear,
    isLegible, legibilityReason, confidence,
    suggestedFilename, costUsd
  }
}
```

```typescript
{
  type: 'document.reviewed',
  meta: {
    documentId, action: 'approve' | 'edit' | 'reject',
    suggestedFilename, confirmedFilename,
    secondsToReview
  }
}
```

These power the threshold tuning analysis at end of Month 1.

---

## 6. v0 (5/15) implementation order

**Day 1.** Postgres schema + migration. R2 bucket + presigned URL helper. Empty Inngest job stub.

**Day 2.** Server Action calling Haiku with the system prompt above. JSON schema validation (Zod). Error handling for malformed JSON.

**Day 3.** Inngest job: receive image → call Server Action → pdf-lib wrap → upload to R2 → insert document row. Tenant-scoped via `withTenant()`.

**Day 4.** Wire `/docs` page: replace mocked `setTimeout` with real Server Action call. Phase machine driven by API response (`is_legible`, `confidence`).

**Day 5.** Preparer review UI in Command Room "Need You" queue. Approve/Edit buttons writing back to `confirmedFilename`.

**Total: 5 days.** Cuts in half if we keep mocked phases for the demo and only ship Stages 3+4 server-side without UI rewire.

---

## 7. Explicit NOs for v0

- **No jscanify.** Vanilla file input with `capture="environment"` is enough.
- **No client-side blur detection (Stage 2).** Skip until cost data justifies it.
- **No Document AI.** Haiku vision only.
- **No multi-page upload UI.** Single-page-at-a-time. Multi-page (1099-B) handled in v1.
- **No auto-approval of filenames.** Preparer reviews every classification. Trust escalation Level 1 only.

---

## 8. References

- CLAUDE.md §6 — Tech foundation (Anthropic direct + ZDR, R2, Inngest, Drizzle)
- CLAUDE.md §7 — Cost discipline ($50/mo Anthropic target, Haiku-first)
- CLAUDE.md §8 — Six intelligence layers + trust escalation
- CLAUDE.md §10 — MCP server roster (`documents` MCP server, post-v0)
- POST-5-15.md — jscanify and native scanner deferred
