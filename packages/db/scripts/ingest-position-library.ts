// scripts/ingest-position-library.ts
//
// Ingests the v0 Position Library (`content/position-library/v0/positions/
// p001..p020-*.md`) into authorities + authority_chunks. Each position
// becomes ONE authority row (kind=firm_memo, jurisdiction=firm,
// tenant_id=NULL = global = visible to every tenant) + N chunk rows with
// Voyage-3-Large 1024-dim embeddings populated.
//
// USAGE
//   bun run packages/db/scripts/ingest-position-library.ts                # full ingest
//   bun run packages/db/scripts/ingest-position-library.ts --dry-run      # parse only, no DB / API
//   bun run packages/db/scripts/ingest-position-library.ts --no-embeddings # DB writes only, NULL embeddings (Voyage offline path)
//
// IDEMPOTENCY
//   Re-running deletes existing global firm_memo Position Library rows
//   (filtered by `metadata->>'positionId'` having the p### prefix) and
//   re-inserts. Safe to run repeatedly as position drafts iterate.
//
// EMBEDDING MODEL
//   voyage-3-large @ 1024 dims per CLAUDE.md L4 + the C4 schema we shipped
//   at ab46c05. Free tier: 200M tokens/month. At ~50-100K tokens for the
//   full library, ingestion cost is ~$0.01. Re-running is essentially free.
//
// REVIEW-STATUS PRESERVATION
//   The metadata jsonb on each authority row carries:
//     { positionId, reviewStatus, tierClassification, penaltyExposure,
//       lastReviewed, nextRefresh, citedAuthority: [...] }
//   Discovery agent (C6+) filters on `metadata->>'reviewStatus'` to keep
//   DRAFT-DAVID entries out of prospect-facing scans until Antonio signs
//   off.
//
// FRESH-ENV BOOTSTRAP
//   Run AFTER `pnpm --filter @docket/db bootstrap` (which applies migration
//   0028). The script requires the embedding column from C4.

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env.local'), override: true });

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

const DRY_RUN = process.argv.includes('--dry-run');
const NO_EMBEDDINGS = process.argv.includes('--no-embeddings');

// Chunk at ~512 tokens. Voyage docs say 1 token ≈ 4 chars for English; pad
// to 2000 chars for safety. Paragraph-aware split — never break mid-paragraph
// unless a single paragraph exceeds the cap (then split on sentences).
const CHUNK_TARGET_CHARS = 1800;
const CHUNK_HARD_MAX_CHARS = 2400;

const VOYAGE_API = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3-large';
// Rate-limit profile. Switchable via `VOYAGE_RATE_TIER` env var so a
// fresh dev clone without paid billing still works without code change.
//
//   VOYAGE_RATE_TIER=free  : 3 RPM / 10K TPM  → batch=10, sleep=21s
//   VOYAGE_RATE_TIER=paid  : 2000 RPM / 1M TPM → batch=128 (Voyage max),
//                                                sleep=500ms (polite),
//                                                effectively single-call
//                                                for our 115-chunk library
//
// Cost ceiling: a full re-ingest is $0.006. Even 1000 re-ingests/month
// is $6, well under the user's "don't let it cost so much" mandate.
// Idempotent path: if every position's source-file sha256 matches what's
// stored in `authorities.metadata.sourceHash` AND no chunk under that
// position has NULL embedding, we skip the Voyage call AND the DB
// transaction entirely. Implemented inline at step 1.5 of main(); see
// the "Skip-if-unchanged check" block before the Voyage embed call.
//
// DEFAULT IS `free` (codex C5-overnight P2). A fresh dev clone or fork
// without paid billing must work out-of-the-box; the free-tier 10K TPM
// cap would 429 on the first batch of 128 inputs (~75K tokens for the
// current library). Operators with paid billing opt in via env var:
//
//   echo 'VOYAGE_RATE_TIER=paid' >> .env.local
//
// The Docket production env has VOYAGE_RATE_TIER=paid set; this default
// only affects fresh clones and CI environments that haven't been
// reconfigured.
const VOYAGE_RATE_TIER: 'free' | 'paid' = (() => {
  const env = (process.env.VOYAGE_RATE_TIER || '').toLowerCase();
  if (env === 'paid') return 'paid';
  return 'free';
})();
const VOYAGE_BATCH_SIZE = VOYAGE_RATE_TIER === 'paid' ? 128 : 10;
const VOYAGE_INTER_BATCH_MS = VOYAGE_RATE_TIER === 'paid' ? 500 : 21_000;
const VOYAGE_TIMEOUT_MS = 30_000;
const VOYAGE_MAX_RETRIES = 3;
// 429 retry backoff is DECOUPLED from inter-batch pacing (codex
// C5-overnight round 4 P2 #2). Reusing VOYAGE_INTER_BATCH_MS as the
// fallback worked on free tier (21s base) but breaks on paid tier
// (500ms × 2^attempt = 0.5/1/2s → exhausts retries before a
// minute-bucket throttle resets). Use a fixed 15s base regardless of
// tier; Voyage's Retry-After header still takes precedence when
// present.
const VOYAGE_429_FALLBACK_BACKOFF_MS = 15_000;

// ────────────────────────────────────────────────────────────────
// Markdown parsing — extract structured fields from each position file.
// ────────────────────────────────────────────────────────────────

type PositionMeta = {
  positionId: string;            // "p001"
  filename: string;              // "p001-section-199a-qbi.md"
  title: string;                 // "Section 199A Qualified Business Income (QBI) deduction"
  slug: string;                  // "p001-section-199a-qbi"
  tierClassification: string;
  reviewStatus: string;
  lastReviewed: string | null;
  effectiveDateRange: string | null;
  nextRefresh: string | null;
  penaltyExposure: string | null;
  effectiveStartDate: string;    // ISO date for the authorities row's effective_date
};

type ParsedPosition = {
  meta: PositionMeta;
  bodyChunks: string[];          // Pre-chunked body text
  fullText: string;              // For metadata reference
};

// INGEST_VERSION — bumped manually whenever the script's parsing,
// chunking, embedding, or metadata-shaping logic changes in a way that
// would produce different DB rows from the same source markdown. The
// skip-check folds this into the source hash so an upgrade automatically
// invalidates all prior sourceHash values and forces a full refresh
// (codex C5-overnight round 3 P2 #1).
//
// Bump triggers (non-exhaustive):
//   - parseApplicableTaxYears semantics change
//   - parseEffectiveStartDate semantics change
//   - chunkBody algorithm or CHUNK_TARGET_CHARS / CHUNK_HARD_MAX_CHARS
//   - Voyage model swap (voyage-3-large → voyage-3.5 etc.)
//   - INSERT shape changes (new metadata field, new column)
//   - computeSourceHash() hash-input changes (always bump on edit)
//
// Format: vN-YYYY-MM-DD. Increment N on logic change; the date is
// informational and helps `git log -S 'INGEST_VERSION'` archaeology.
const INGEST_VERSION = 'v3-2026-05-12';

// computeSourceHash — stable per-position content hash used by both
// the INSERT path (stored as metadata.sourceHash) and the skip-check
// (compared against stored sourceHash). Must be called from both
// places via this single helper so the two hashes can never drift.
//
// HASH ONLY PERSISTED FIELDS (codex C5-overnight round 4 P2 #1).
// Earlier versions hashed the raw `fullText`, which over-triggered:
// `chunkBody()` drops the "Pending Antonio review" footer and
// normalizes some formatting before any DB write, so a footer-only
// edit changed the raw-text hash even though the stored rows would
// be identical. The correct semantics: hash exactly what the INSERT
// statement persists.
//
// Inputs to the hash (canonical JSON over):
//   - INGEST_VERSION             (parser/chunker/model version gate)
//   - meta.positionId            (p###)
//   - meta.filename              (rename detection)
//   - meta.title                 (authorities.title)
//   - meta.slug                  (authorities.slug)
//   - meta.tierClassification    (metadata.tierClassification)
//   - meta.reviewStatus          (metadata.reviewStatus — the gate)
//   - meta.lastReviewed          (metadata.lastReviewed)
//   - meta.nextRefresh           (metadata.nextRefresh)
//   - meta.effectiveDateRange    (metadata.effectiveDateRange)
//   - meta.penaltyExposure       (metadata.penaltyExposure)
//   - meta.effectiveStartDate    (authorities.effective_date)
//   - bodyChunks with CRLF→LF    (authority_chunks.text per ordinal)
//
// The bodyChunks come from `chunkBody()`, which already strips the
// version-history block and footer. Cross-OS line-ending stability
// preserved by `.replace(/\r\n/g, '\n')` per chunk.
function computeSourceHash(meta: PositionMeta, bodyChunks: string[]): string {
  const payload = JSON.stringify({
    INGEST_VERSION,
    positionId: meta.positionId,
    filename: meta.filename,
    title: meta.title,
    slug: meta.slug,
    tierClassification: meta.tierClassification,
    reviewStatus: meta.reviewStatus,
    lastReviewed: meta.lastReviewed,
    nextRefresh: meta.nextRefresh,
    effectiveDateRange: meta.effectiveDateRange,
    penaltyExposure: meta.penaltyExposure,
    effectiveStartDate: meta.effectiveStartDate,
    bodyChunks: bodyChunks.map((c) => c.replace(/\r\n/g, '\n')),
  });
  return createHash('sha256').update(payload).digest('hex');
}

function extractPositionId(filename: string): string {
  const m = filename.match(/^(p\d{3})-/);
  if (!m) throw new Error(`Filename ${filename} doesn't match p###- prefix`);
  return m[1]!;
}

function parseStatusBlock(body: string): {
  tierClassification: string;
  reviewStatus: string;
  lastReviewed: string | null;
  effectiveDateRange: string | null;
  nextRefresh: string | null;
  penaltyExposure: string | null;
} {
  // The ## Status block has bullet entries like:
  //   - **Tier classification**: Tier 1 (Settled law)
  //   - **Review status**: `DRAFT-DAVID`
  // We extract by regex against the bold-label prefix.
  const get = (label: string): string | null => {
    const re = new RegExp(`-\\s+\\*\\*${label}\\*\\*:\\s*([^\\n]+)`);
    const m = body.match(re);
    if (!m) return null;
    // Strip backticks (e.g., `DRAFT-DAVID` → DRAFT-DAVID).
    return m[1]!.replace(/^`|`$/g, '').trim();
  };
  return {
    tierClassification: get('Tier classification') ?? 'unknown',
    reviewStatus: get('Review status') ?? 'unknown',
    lastReviewed: get('Last reviewed'),
    effectiveDateRange: get('Effective date range'),
    nextRefresh: get('Next mandatory refresh'),
    penaltyExposure: get('Penalty exposure if mis-applied'),
  };
}

function parseEffectiveStartDate(effectiveDateRange: string | null): string {
  // Examples we need to handle:
  //   "Tax years 2018-2025 (Settled). The §199A deduction is..."
  //   "Tax years 1986-present (§469 enacted 1986; ...)"
  //   "All tax years (this refusal is structural...)"
  //   "Tax years 1958-present (continuously available)..."
  //   "Tax years 1973-present (Rev. Rul. 73-361 + ...)"
  //   "All tax years (refusal is structural)"
  if (!effectiveDateRange) return '1986-01-01'; // TRA86 default
  const m = effectiveDateRange.match(/(?:Tax years?\s+)?(\d{4})/);
  if (m) return `${m[1]!}-01-01`;
  // "All tax years" — use historical default
  return '1986-01-01';
}

/**
 * Parse the applicable tax-year window from the position's effective-date
 * range string. Returns an int[] suitable for authorities.applicable_tax_years.
 *
 * Empty array means evergreen (no upper bound) — retriever treats this
 * as "applies to any tax year." For bounded positions (e.g. §199A 2018-
 * 2025), materialize the full year list so a 2026 retrieval query
 * filtering on `applicable_tax_years && ARRAY[2026]` correctly EXCLUDES
 * the sunset position. Codex C5 P2 fix.
 */
function parseApplicableTaxYears(effectiveDateRange: string | null): number[] {
  if (!effectiveDateRange) return [];
  // Bounded range: "Tax years YYYY-YYYY"
  const bounded = effectiveDateRange.match(/Tax years?\s+(\d{4})\s*[-–]\s*(\d{4})\b/);
  if (bounded) {
    const start = Number.parseInt(bounded[1]!, 10);
    const end = Number.parseInt(bounded[2]!, 10);
    if (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      start <= end &&
      end - start < 100 // sanity bound — refuse absurd ranges
    ) {
      const years: number[] = [];
      for (let y = start; y <= end; y++) years.push(y);
      return years;
    }
  }
  // Lower-bounded open range: "Tax years YYYY-present"
  // The position applies from YYYY onward indefinitely. Codex C5 round 2 P2
  // flagged the prior `return []` here: that semantics meant the retriever's
  // `applicable_tax_years && ARRAY[$queryYear]` filter returned false (empty
  // && anything = false) — i.e. the position never matched — OR with a
  // skip-on-empty retriever rule the lower bound was silently lost (a TY1995
  // query would match a "1986-present" position even if it shouldn't). The
  // fix materializes the range with a generous sentinel upper bound (2099)
  // so the retriever has a single, correct overlap semantics. Re-ingest is
  // free (~$0.006 per Voyage hit), and 2099 is well past the planning
  // horizon for v1.
  const lowerBounded = effectiveDateRange.match(/Tax years?\s+(\d{4})\s*[-–]\s*present/i);
  if (lowerBounded) {
    const start = Number.parseInt(lowerBounded[1]!, 10);
    if (Number.isFinite(start) && start >= 1900 && start < 2100) {
      const years: number[] = [];
      for (let y = start; y <= 2099; y++) years.push(y);
      return years;
    }
  }
  // True evergreen: "All tax years" — the retriever's filter must skip on
  // empty `applicable_tax_years` (see authority-search.ts) so these match
  // every taxYear query. This is the only legitimate empty-array case.
  if (/All tax years/i.test(effectiveDateRange)) return [];
  // Single tax year: "Tax years YYYY"
  const single = effectiveDateRange.match(/Tax years?\s+(\d{4})\b/);
  if (single) return [Number.parseInt(single[1]!, 10)];
  return [];
}

function deriveSlug(filename: string): string {
  return filename.replace(/\.md$/, '');
}

function deriveTitle(filename: string, h1Line: string): string {
  // # Position p001: Section 199A Qualified Business Income (QBI) deduction
  // → "Section 199A Qualified Business Income (QBI) deduction"
  const m = h1Line.match(/^#\s+Position\s+p\d{3}:\s+(.+)$/);
  if (m) return m[1]!.trim();
  // Fallback: from filename
  return filename
    .replace(/^p\d{3}-/, '')
    .replace(/\.md$/, '')
    .replace(/-/g, ' ');
}

// ────────────────────────────────────────────────────────────────
// Paragraph-aware chunking — preserves semantic boundaries.
// ────────────────────────────────────────────────────────────────

function chunkBody(body: string): string[] {
  // Strip the front-matter (## Status block) and footer marker if present.
  // Everything between is the substantive body that goes into chunks.
  const afterStatus = body.replace(/^[\s\S]*?\n## Status[\s\S]*?(?=\n## )/m, '');
  const beforeFooter = afterStatus.replace(/\n---\s*\n\*Pending Antonio review[\s\S]*$/m, '\n');
  const cleaned = beforeFooter.trim();

  // Split on blank lines (paragraph boundaries) but keep section headers
  // attached to their following paragraph for context.
  const paragraphs = cleaned.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 0);

  const chunks: string[] = [];
  let buf = '';
  for (const para of paragraphs) {
    // If adding this paragraph would exceed the target, flush.
    if (buf.length > 0 && buf.length + para.length + 2 > CHUNK_TARGET_CHARS) {
      chunks.push(buf);
      buf = para;
      continue;
    }
    // If a single paragraph exceeds the hard max, split on sentences.
    if (para.length > CHUNK_HARD_MAX_CHARS) {
      if (buf.length > 0) {
        chunks.push(buf);
        buf = '';
      }
      const sentences = para.split(/(?<=[.!?])\s+/);
      let sbuf = '';
      for (const s of sentences) {
        if (sbuf.length + s.length + 1 > CHUNK_TARGET_CHARS && sbuf.length > 0) {
          chunks.push(sbuf);
          sbuf = s;
        } else {
          sbuf = sbuf.length === 0 ? s : sbuf + ' ' + s;
        }
      }
      if (sbuf.length > 0) chunks.push(sbuf);
      continue;
    }
    buf = buf.length === 0 ? para : buf + '\n\n' + para;
  }
  if (buf.length > 0) chunks.push(buf);
  return chunks;
}

async function parsePositionFile(filename: string, fullPath: string): Promise<ParsedPosition> {
  // CRLF→LF normalization at parse time (codex C5-overnight round 9
  // P2). All downstream consumers — chunker, sourceHash, INSERT into
  // authority_chunks.text, content_hash — see the same canonical
  // bytes. Previously the hash was normalized but INSERT wrote raw
  // bytes, so an LF→CRLF worktree switch would skip incorrectly
  // (hash matches, persisted bytes don't).
  const rawText = await fs.readFile(fullPath, 'utf8');
  const text = rawText.replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  const h1 = lines.find((l) => l.startsWith('# ')) ?? '';

  const positionId = extractPositionId(filename);
  const status = parseStatusBlock(text);
  const meta: PositionMeta = {
    positionId,
    filename,
    title: deriveTitle(filename, h1),
    slug: deriveSlug(filename),
    tierClassification: status.tierClassification,
    reviewStatus: status.reviewStatus,
    lastReviewed: status.lastReviewed,
    effectiveDateRange: status.effectiveDateRange,
    nextRefresh: status.nextRefresh,
    penaltyExposure: status.penaltyExposure,
    effectiveStartDate: parseEffectiveStartDate(status.effectiveDateRange),
  };

  const bodyChunks = chunkBody(text);

  return { meta, bodyChunks, fullText: text };
}

// ────────────────────────────────────────────────────────────────
// Voyage AI client — minimal, batched, retried.
// ────────────────────────────────────────────────────────────────

type VoyageEmbeddingResponse = {
  object: 'list';
  data: { embedding: number[]; index: number; object: 'embedding' }[];
  model: string;
  usage: { total_tokens: number };
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function voyageEmbed(
  inputs: string[],
  apiKey: string,
  opts?: { onProgress?: (sent: number, total: number) => void },
): Promise<{ embeddings: number[][]; totalTokens: number }> {
  if (inputs.length === 0) return { embeddings: [], totalTokens: 0 };
  if (inputs.length > VOYAGE_BATCH_SIZE) {
    // Multi-batch path with inter-batch throttling (free tier: 3 RPM).
    const all: number[][] = [];
    let tokens = 0;
    const batches = Math.ceil(inputs.length / VOYAGE_BATCH_SIZE);
    for (let b = 0; b < batches; b++) {
      const slice = inputs.slice(b * VOYAGE_BATCH_SIZE, (b + 1) * VOYAGE_BATCH_SIZE);
      const sub = await voyageEmbedOne(slice, apiKey);
      all.push(...sub.embeddings);
      tokens += sub.totalTokens;
      opts?.onProgress?.(all.length, inputs.length);
      // Respect inter-batch sleep unless this is the last batch.
      if (b < batches - 1) {
        await sleep(VOYAGE_INTER_BATCH_MS);
      }
    }
    return { embeddings: all, totalTokens: tokens };
  }
  return voyageEmbedOne(inputs, apiKey);
}

async function voyageEmbedOne(
  inputs: string[],
  apiKey: string,
): Promise<{ embeddings: number[][]; totalTokens: number }> {
  // Retry loop for 429 (rate-limit) responses. Respects Retry-After
  // header when present; otherwise exponential backoff.
  let attempt = 0;
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VOYAGE_TIMEOUT_MS);
    try {
      const response = await fetch(VOYAGE_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: inputs,
          model: VOYAGE_MODEL,
          input_type: 'document',
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        if (attempt >= VOYAGE_MAX_RETRIES) {
          const body = await response.text().catch(() => '<unreadable>');
          throw new Error(`Voyage API 429 after ${VOYAGE_MAX_RETRIES} retries: ${body.slice(0, 300)}`);
        }
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter
          ? Math.max(1000, Number.parseInt(retryAfter, 10) * 1000)
          : VOYAGE_429_FALLBACK_BACKOFF_MS * Math.pow(2, attempt);
        console.log(
          `  ${YELLOW}RETRY${RESET}  Voyage 429 — sleeping ${Math.round(waitMs / 1000)}s (attempt ${attempt + 1}/${VOYAGE_MAX_RETRIES})`,
        );
        clearTimeout(timer);
        await sleep(waitMs);
        attempt += 1;
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '<unreadable>');
        throw new Error(`Voyage API ${response.status}: ${body.slice(0, 500)}`);
      }

      const payload = (await response.json()) as VoyageEmbeddingResponse;
      if (!Array.isArray(payload.data) || payload.data.length !== inputs.length) {
        throw new Error(
          `Voyage returned ${payload.data?.length ?? '?'} embeddings for ${inputs.length} inputs`,
        );
      }
      // Voyage guarantees data[i].index === i but be defensive.
      const ordered = inputs.map((_, i) => {
        const found = payload.data.find((d) => d.index === i);
        if (!found) throw new Error(`Missing embedding for index ${i}`);
        if (found.embedding.length !== 1024) {
          throw new Error(
            `Voyage returned ${found.embedding.length}-dim vector (expected 1024)`,
          );
        }
        return found.embedding;
      });
      return { embeddings: ordered, totalTokens: payload.usage.total_tokens };
    } finally {
      clearTimeout(timer);
    }
  }
}

// ────────────────────────────────────────────────────────────────
// DB ingest — delete existing global Position Library rows, then insert
// the freshly-parsed batch.
// ────────────────────────────────────────────────────────────────

const POSITIONS_DIR = path.resolve(
  __dirname,
  '../../../content/position-library/v0/positions',
);

type IngestStats = {
  positionsParsed: number;
  positionsInserted: number;
  chunksInserted: number;
  embeddingsGenerated: number;
  voyageTokens: number;
  errors: number;
};

// Retrieval smoke — BM25 + cosine queries against ingested Position
// Library content. Extracted from main() so both the full-ingest path
// AND the SKIP path can validate retrieval health (codex C5-overnight
// round 6 P3). Pass `apiKey === null` to skip the cosine arm (used
// by --no-embeddings).
//
// Returns the Voyage token count consumed by the smoke (0 if apiKey is
// null). Codex C5-overnight round 7 P3: the SKIP path was reporting
// `Voyage tokens: 0` while still spending ~10 tokens on the cosine
// probe — under-reports cost. Return the real number so the caller
// can surface it in the summary.
async function runRetrievalSmoke(
  sqlClient: postgres.Sql,
  apiKey: string | null,
): Promise<{ voyageTokensUsed: number }> {
  console.log(`${DIM}Smoke: BM25 + cosine queries against ingested content...${RESET}`);

  const bm25Hits = await sqlClient<{ citation_label: string; rank: number }[]>`
    SELECT a.citation_label, ts_rank(c.tsv, plainto_tsquery('english', '§199A QBI deduction')) AS rank
      FROM authorities a
      JOIN authority_chunks c ON c.authority_id = a.id
     WHERE a.tenant_id IS NULL
       AND a.kind = 'firm_memo'
       AND c.tsv @@ plainto_tsquery('english', '§199A QBI deduction')
     ORDER BY rank DESC
     LIMIT 3
  `;
  if (bm25Hits.length === 0) {
    throw new Error('BM25 smoke: no hits for §199A QBI deduction');
  }
  if (!bm25Hits[0]!.citation_label.includes('p001')) {
    console.warn(
      `  ${YELLOW}WARN${RESET}  BM25 top hit was ${bm25Hits[0]!.citation_label} (expected p001-prefixed)`,
    );
  } else {
    console.log(`  ${GREEN}PASS${RESET}  BM25 top hit: ${bm25Hits[0]!.citation_label}`);
  }

  let voyageTokensUsed = 0;
  if (apiKey) {
    // Cosine smoke: embed a query phrase, query top-K.
    const { embeddings: queryEmbedArr, totalTokens } = await voyageEmbed(
      ['What is the Section 199A QBI deduction?'],
      apiKey,
    );
    voyageTokensUsed = totalTokens;
    const queryVec = `[${queryEmbedArr[0]!.join(',')}]`;
    const cosineHits = await sqlClient<{ citation_label: string; distance: number }[]>`
      SELECT a.citation_label,
             (c.embedding <=> ${sqlClient.unsafe(`'${queryVec}'::vector`)}) AS distance
        FROM authorities a
        JOIN authority_chunks c ON c.authority_id = a.id
       WHERE a.tenant_id IS NULL
         AND a.kind = 'firm_memo'
         AND c.embedding IS NOT NULL
       ORDER BY c.embedding <=> ${sqlClient.unsafe(`'${queryVec}'::vector`)}
       LIMIT 3
    `;
    if (cosineHits.length === 0) {
      throw new Error('cosine smoke: no embedded chunks returned');
    }
    if (!cosineHits[0]!.citation_label.includes('p001')) {
      console.warn(
        `  ${YELLOW}WARN${RESET}  cosine top hit was ${cosineHits[0]!.citation_label} (expected p001-prefixed)`,
      );
    } else {
      console.log(
        `  ${GREEN}PASS${RESET}  cosine top hit: ${cosineHits[0]!.citation_label}  ${DIM}distance=${cosineHits[0]!.distance.toFixed(6)}${RESET}`,
      );
    }
  }
  return { voyageTokensUsed };
}

async function main(): Promise<void> {
  console.log(`${YELLOW}━━ ingest-position-library ━━${RESET}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (parse only)' : NO_EMBEDDINGS ? 'NO-EMBEDDINGS (DB writes only)' : 'FULL (DB + embeddings)'}`);

  const stats: IngestStats = {
    positionsParsed: 0,
    positionsInserted: 0,
    chunksInserted: 0,
    embeddingsGenerated: 0,
    voyageTokens: 0,
    errors: 0,
  };

  // 1. Read + parse all position files.
  const allFiles = await fs.readdir(POSITIONS_DIR);
  const positionFiles = allFiles
    .filter((f) => /^p\d{3}-.*\.md$/.test(f))
    .sort();
  if (positionFiles.length === 0) {
    console.error(`${RED}FATAL${RESET}: no position files in ${POSITIONS_DIR}`);
    process.exit(2);
  }
  console.log(`${DIM}Found ${positionFiles.length} position files${RESET}`);

  const parsed: ParsedPosition[] = [];
  for (const filename of positionFiles) {
    try {
      const p = await parsePositionFile(filename, path.join(POSITIONS_DIR, filename));
      parsed.push(p);
      stats.positionsParsed += 1;
      console.log(
        `  ${GREEN}PARSE${RESET}  ${p.meta.positionId}  ${DIM}${p.bodyChunks.length} chunks · ${p.meta.reviewStatus} · ${p.meta.tierClassification}${RESET}`,
      );
    } catch (err) {
      stats.errors += 1;
      console.error(`  ${RED}FAIL${RESET}  ${filename}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (DRY_RUN) {
    console.log(`\n${GREEN}━━ dry run complete ━━${RESET}`);
    console.log(`Positions parsed: ${stats.positionsParsed}`);
    console.log(`Total chunks: ${parsed.reduce((s, p) => s + p.bodyChunks.length, 0)}`);
    console.log(`Errors: ${stats.errors}`);
    process.exit(stats.errors > 0 ? 1 : 0);
  }

  // ─── Parse-phase abort gate (codex C5 P1 #1) ─────────────────────
  // If ANY position failed to parse, refuse to touch the DB. The
  // ingest pipeline deletes existing Position Library rows and
  // re-inserts the freshly-parsed set; proceeding with a partial parse
  // would delete previously-good rows and replace them with the
  // smaller successful subset — net data loss for the failing
  // position. Fail loud, surface the failed file(s), let the
  // operator fix and re-run.
  if (stats.errors > 0) {
    console.error(
      `\n${RED}FATAL${RESET}: ${stats.errors} parse error${stats.errors === 1 ? '' : 's'} above — aborting BEFORE any DB write to avoid partial-refresh data loss. Fix the failing position file(s) and re-run.`,
    );
    process.exit(1);
  }

  // ─── 1.5 — Skip-if-unchanged check (overnight cost discipline) ────
  //
  // Hash each parsed position's FULL raw markdown (sha256 of fullText).
  // Query the DB for `authorities.metadata->>'sourceHash'` on every
  // existing global firm_memo row whose positionId matches p###. If
  // every incoming source hash matches its existing counterpart 1:1
  // AND no chunk under any matching position has a NULL embedding,
  // skip the entire pipeline — no Voyage calls, no DB writes.
  //
  // sourceHash (codex C5-overnight P1) covers EVERYTHING the ingest
  // writes: H1 title, slug, status block (reviewStatus, tier,
  // penalty exposure, effective date range), AND body chunks. The
  // previous version only hashed body chunks, so a position whose
  // reviewStatus flipped from DRAFT-DAVID to ANTONIO-VALIDATED while
  // the body stayed identical would skip — leaving stale reviewStatus
  // in the DB. That's exactly the gate C5 added; the skip-check has
  // to honor it.
  //
  // Why: overnight mode may pick this ingest as a queued task. The
  // founder's mandate is "don't let it cost so much." Re-running the
  // 115-chunk ingest is $0.006 + ~3-5s — cheap, but compounding over
  // 100 overnight loops = $0.60. The skip path costs 2 short queries
  // and 0 Voyage tokens.
  //
  // Idempotent semantics: identical content → no-op. Any drift on any
  // position → full refresh (DELETE + INSERT in transaction). Partial
  // overlap is NOT optimized because the transactional refresh is
  // atomic + cheap, and partial-embedding logic adds correctness risk
  // for marginal savings.
  if (!NO_EMBEDDINGS) {
    const dbUrlEarly = process.env.DATABASE_URL;
    if (dbUrlEarly) {
      const incomingSourceHashes = new Map<string, string>();
      for (const p of parsed) {
        const sourceHash = computeSourceHash(p.meta, p.bodyChunks);
        incomingSourceHashes.set(p.meta.positionId, sourceHash);
      }
      const checkSql = postgres(dbUrlEarly, { max: 1, prepare: false });
      try {
        const existing = await checkSql<{
          position_id: string;
          source_hash: string | null;
        }[]>`
          SELECT a.metadata->>'positionId' AS position_id,
                 a.metadata->>'sourceHash' AS source_hash
            FROM authorities a
           WHERE a.tenant_id IS NULL
             AND a.kind = 'firm_memo'::authority_kind
             AND a.metadata ? 'positionId'
             AND a.metadata->>'positionId' SIMILAR TO 'p[0-9]{3}'
        `;
        const existingSourceHashes = new Map(
          existing
            .filter((r) => r.source_hash !== null)
            .map((r) => [r.position_id, r.source_hash!] as const),
        );
        const allHashesMatch =
          incomingSourceHashes.size === existingSourceHashes.size &&
          incomingSourceHashes.size > 0 &&
          [...incomingSourceHashes.entries()].every(
            ([id, h]) => existingSourceHashes.get(id) === h,
          );
        if (allHashesMatch) {
          // Two safety checks before declaring the skip valid (codex
          // C5-overnight round 3 P2 #2). The hash match alone proves
          // the source agrees with what we ingested; we still have to
          // verify the DB state is COMPLETE for each matched position:
          //
          //   (a) No chunk on any matched position has a NULL
          //       embedding. Catches partial-Voyage-failure state.
          //   (b) Every matched position has the EXACT chunk count we
          //       just parsed from its markdown. Catches partial-delete
          //       / manual-repair state where rows disappeared.
          //
          // If either check fails for any matched position, fall through
          // to a full DELETE+INSERT refresh which restores the state
          // atomically inside the existing transaction.
          const nullCount = await checkSql<{ count: number }[]>`
            SELECT COUNT(*)::int AS count
              FROM authorities a
              JOIN authority_chunks c ON c.authority_id = a.id
             WHERE a.tenant_id IS NULL
               AND a.kind = 'firm_memo'::authority_kind
               AND a.metadata ? 'positionId'
               AND a.metadata->>'positionId' SIMILAR TO 'p[0-9]{3}'
               AND c.embedding IS NULL
          `;
          const nullEmbeddings = nullCount[0]?.count ?? 0;

          // Per-position chunk-count tally — must equal bodyChunks.length
          // from the just-parsed markdown for every position.
          const chunkCounts = await checkSql<{
            position_id: string;
            chunk_count: number;
          }[]>`
            SELECT a.metadata->>'positionId' AS position_id,
                   COUNT(c.id)::int AS chunk_count
              FROM authorities a
              LEFT JOIN authority_chunks c ON c.authority_id = a.id
             WHERE a.tenant_id IS NULL
               AND a.kind = 'firm_memo'::authority_kind
               AND a.metadata ? 'positionId'
               AND a.metadata->>'positionId' SIMILAR TO 'p[0-9]{3}'
             GROUP BY a.metadata->>'positionId'
          `;
          const dbChunkCounts = new Map(
            chunkCounts.map((r) => [r.position_id, r.chunk_count] as const),
          );
          const mismatchedPositions: string[] = [];
          for (const p of parsed) {
            const expected = p.bodyChunks.length;
            const actual = dbChunkCounts.get(p.meta.positionId) ?? 0;
            if (expected !== actual) {
              mismatchedPositions.push(
                `${p.meta.positionId}: expected ${expected} chunks, found ${actual}`,
              );
            }
          }

          if (nullEmbeddings === 0 && mismatchedPositions.length === 0) {
            console.log(
              `\n${GREEN}━━ SKIP ━━${RESET} Position Library content unchanged since last ingest`,
            );
            console.log(
              `  ${DIM}${incomingSourceHashes.size} positions match by sourceHash; chunk counts match parse; no NULL embeddings.${RESET}`,
            );
            // Codex C5-overnight round 6 P3: run smoke even on SKIP.
            // Costs ~1 Voyage embed call for the cosine probe and 2
            // cheap DB queries. Catches the case where the source
            // hashes match (DB looks healthy) but the retrieval path
            // is broken for unrelated reasons (HNSW index dropped,
            // tsv config swapped, vector dim drift). Without this,
            // a no-op re-run reports success while retrieval is dead.
            //
            // Codex round 7 P3: capture actual smoke token cost and
            // report it (was hardcoded 0 before; under-reported by
            // ~10 tokens / $0.000001 per skip).
            //
            // Codex round 8 P2: REQUIRE VOYAGE_API_KEY in full mode
            // (i.e., when --no-embeddings is NOT set). The full ingest
            // path fails fast on missing key; the SKIP path must match
            // that contract or a broken embedding/index path can hide
            // until the next forced re-ingest. Only --no-embeddings
            // mode permits a null apiKey (then the cosine arm of the
            // smoke is intentionally skipped).
            if (!NO_EMBEDDINGS && !process.env.VOYAGE_API_KEY) {
              console.error(
                `${RED}FATAL${RESET}: VOYAGE_API_KEY not set in .env.local. SKIP path still requires it to validate cosine retrieval (use --no-embeddings to bypass).`,
              );
              await checkSql.end();
              process.exit(2);
            }
            const apiKeyForSmoke = NO_EMBEDDINGS ? null : process.env.VOYAGE_API_KEY!;
            const smokeResult = await runRetrievalSmoke(checkSql, apiKeyForSmoke);
            const smokeCost = (smokeResult.voyageTokensUsed * 0.12) / 1_000_000;
            console.log(`  Positions parsed:   ${parsed.length}`);
            console.log(
              `  Voyage tokens:      ${smokeResult.voyageTokensUsed}  ${DIM}(skipped ingest — only smoke cosine probe, ~$${smokeCost.toFixed(6)})${RESET}`,
            );
            console.log(`  Errors:             0`);
            await checkSql.end();
            process.exit(0);
          }
          if (nullEmbeddings > 0) {
            console.log(
              `${DIM}sourceHash match but ${nullEmbeddings} chunk(s) have NULL embedding — proceeding with full refresh to fix partial state${RESET}`,
            );
          }
          if (mismatchedPositions.length > 0) {
            console.log(
              `${DIM}sourceHash match but chunk counts drift on ${mismatchedPositions.length} position(s): ${mismatchedPositions.join('; ')} — proceeding with full refresh${RESET}`,
            );
          }
        } else {
          console.log(
            `${DIM}sourceHash skip check: ${existingSourceHashes.size} existing positions hashed, ${incomingSourceHashes.size} incoming — drift detected, proceeding with full refresh${RESET}`,
          );
        }
      } finally {
        await checkSql.end();
      }
    }
  }

  // 2. Embed (unless --no-embeddings).
  const chunkEmbeddings: Map<string, number[]> = new Map(); // key: positionId|ordinal
  if (!NO_EMBEDDINGS) {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      console.error(`${RED}FATAL${RESET}: VOYAGE_API_KEY not set in .env.local`);
      process.exit(2);
    }

    // Flatten all chunks across all positions for batched embedding.
    type ChunkRef = { positionId: string; ordinal: number; text: string };
    const allChunks: ChunkRef[] = [];
    for (const p of parsed) {
      p.bodyChunks.forEach((text, ordinal) => {
        allChunks.push({ positionId: p.meta.positionId, ordinal, text });
      });
    }
    const batches = Math.ceil(allChunks.length / VOYAGE_BATCH_SIZE);
    const tierLabel = VOYAGE_RATE_TIER === 'paid' ? 'paid tier' : 'free-tier RPM';
    console.log(
      `${DIM}Embedding ${allChunks.length} chunks via voyage-3-large (${batches} batch${batches === 1 ? '' : 'es'}, batch_size=${VOYAGE_BATCH_SIZE}, sleep=${VOYAGE_INTER_BATCH_MS}ms, ~${Math.max(3, Math.round((batches * VOYAGE_INTER_BATCH_MS) / 1000))}s on ${tierLabel})...${RESET}`,
    );

    try {
      const { embeddings, totalTokens } = await voyageEmbed(
        allChunks.map((c) => c.text),
        apiKey,
        {
          onProgress: (sent, total) => {
            console.log(`  ${DIM}embed progress: ${sent}/${total}${RESET}`);
          },
        },
      );
      allChunks.forEach((c, i) => {
        chunkEmbeddings.set(`${c.positionId}|${c.ordinal}`, embeddings[i]!);
      });
      stats.embeddingsGenerated = embeddings.length;
      stats.voyageTokens = totalTokens;
      console.log(
        `  ${GREEN}EMBED${RESET}  ${embeddings.length} vectors  ${DIM}${totalTokens} tokens${RESET}`,
      );
    } catch (err) {
      console.error(`  ${RED}FAIL${RESET}  Voyage embed: ${err instanceof Error ? err.message : err}`);
      console.error(
        `  ${YELLOW}HINT${RESET}: re-run with --no-embeddings to insert chunks with NULL embeddings; backfill later.`,
      );
      process.exit(1);
    }
  }

  // 3. DB write — delete existing global Position Library rows, then insert.
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(`${RED}FATAL${RESET}: DATABASE_URL not set`);
    process.exit(2);
  }
  const sql = postgres(dbUrl, { max: 1, prepare: false });

  try {
    // ─── Transactional refresh (codex C5 P1 #2) ─────────────────────
    // The DELETE-then-INSERT pattern is destructive on shared data.
    // Wrap everything in sql.begin so any failure (insert error,
    // network hiccup, process crash mid-loop) rolls the table back to
    // its prior state. postgres.js's sql.begin starts a transaction,
    // passes a tx-scoped client to the callback, commits on resolve,
    // rolls back on throw. No per-position try/catch inside — let
    // any failure throw and abort the whole refresh atomically.
    console.log(
      `${DIM}Refreshing Position Library (1 transaction: DELETE existing + INSERT 20 + 115 chunks)...${RESET}`,
    );
    await sql.begin(async (tx) => {
      // Delete existing global firm_memo Position Library rows.
      const deleted = await tx`
        DELETE FROM authorities
         WHERE tenant_id IS NULL
           AND kind = 'firm_memo'
           AND metadata ? 'positionId'
           AND metadata->>'positionId' SIMILAR TO 'p[0-9]{3}'
        RETURNING id
      `;
      console.log(`  ${GREEN}DELETE${RESET} ${deleted.length} prior rows (cascade to chunks)`);

      // Insert authority + chunk rows. No try/catch — let any error
      // throw and the transaction rolls back.
      for (const p of parsed) {
        const applicableTaxYears = parseApplicableTaxYears(p.meta.effectiveDateRange);
        // sourceHash via computeSourceHash() helper — see the helper's
        // doc-block at the top of this file for the full rationale.
        // INSERT and skip-check MUST use the same helper to stay in
        // sync; codex caught two earlier versions where they drifted.
        const sourceHash = computeSourceHash(p.meta, p.bodyChunks);
        const metadata = {
          positionId: p.meta.positionId,
          reviewStatus: p.meta.reviewStatus,
          tierClassification: p.meta.tierClassification,
          penaltyExposure: p.meta.penaltyExposure,
          lastReviewed: p.meta.lastReviewed,
          nextRefresh: p.meta.nextRefresh,
          effectiveDateRange: p.meta.effectiveDateRange,
          sourceFile: p.meta.filename,
          sourceHash,
        };

        const citationLabel = `Position ${p.meta.positionId}: ${p.meta.title}`;

        const [authority] = await tx<{ id: string }[]>`
          INSERT INTO authorities (
            tenant_id, kind, jurisdiction,
            citation_label, title, slug,
            effective_date, applicable_tax_years, metadata
          ) VALUES (
            NULL,
            'firm_memo'::authority_kind,
            'firm'::authority_jurisdiction,
            ${citationLabel},
            ${p.meta.title},
            ${p.meta.slug},
            ${p.meta.effectiveStartDate}::date,
            ${applicableTaxYears.length > 0
              ? tx.unsafe(`ARRAY[${applicableTaxYears.join(',')}]::int[]`)
              : tx.unsafe(`'{}'::int[]`)},
            ${tx.json(metadata)}
          )
          RETURNING id
        `;
        if (!authority) {
          throw new Error(`authority insert for ${p.meta.positionId} returned no row`);
        }
        const authId = authority.id;
        stats.positionsInserted += 1;

        // Chunks.
        for (let ordinal = 0; ordinal < p.bodyChunks.length; ordinal++) {
          const chunkText = p.bodyChunks[ordinal]!;
          const hash = createHash('sha256').update(chunkText).digest('hex');
          const chunkEmbedding = chunkEmbeddings.get(`${p.meta.positionId}|${ordinal}`);

          if (chunkEmbedding) {
            const vecLit = `[${chunkEmbedding.join(',')}]`;
            await tx`
              INSERT INTO authority_chunks (
                authority_id, ordinal, text, content_hash, embedding
              ) VALUES (
                ${authId}, ${ordinal}, ${chunkText}, ${hash},
                ${tx.unsafe(`'${vecLit}'::vector`)}
              )
            `;
          } else {
            await tx`
              INSERT INTO authority_chunks (
                authority_id, ordinal, text, content_hash
              ) VALUES (
                ${authId}, ${ordinal}, ${chunkText}, ${hash}
              )
            `;
          }
          stats.chunksInserted += 1;
        }

        const yearsLabel =
          applicableTaxYears.length === 0
            ? 'evergreen'
            : `${applicableTaxYears[0]}-${applicableTaxYears[applicableTaxYears.length - 1]}`;
        console.log(
          `  ${GREEN}INSERT${RESET} ${p.meta.positionId}  ${DIM}${p.bodyChunks.length} chunks · ${embedding(p.bodyChunks.length, chunkEmbeddings, p.meta.positionId)} · tax years ${yearsLabel}${RESET}`,
        );
      }
    });
    // Transaction committed by here.

    // 4. Smoke verification — query for §199A and confirm we get p001 back first.
    //    Extracted into runRetrievalSmoke() so the SKIP path can run
    //    the same checks (codex C5-overnight round 6 P3). Smoke
    //    Voyage tokens fold into stats so the summary reflects total
    //    spend (codex round 7 P3).
    const smokeResult = await runRetrievalSmoke(
      sql,
      NO_EMBEDDINGS ? null : process.env.VOYAGE_API_KEY!,
    );
    stats.voyageTokens += smokeResult.voyageTokensUsed;

    console.log(`\n${GREEN}━━ ingest complete ━━${RESET}`);
    console.log(`Positions parsed:   ${stats.positionsParsed}`);
    console.log(`Positions inserted: ${stats.positionsInserted}`);
    console.log(`Chunks inserted:    ${stats.chunksInserted}`);
    if (!NO_EMBEDDINGS) {
      console.log(`Embeddings:         ${stats.embeddingsGenerated}`);
      console.log(`Voyage tokens:      ${stats.voyageTokens}  ${DIM}(~$${(stats.voyageTokens * 0.12 / 1_000_000).toFixed(4)} at voyage-3-large pricing)${RESET}`);
    }
    console.log(`Errors:             ${stats.errors}`);
    process.exit(stats.errors > 0 ? 1 : 0);
  } finally {
    await sql.end();
  }
}

// Helper used only in the per-position log line — kept inline to avoid hoist
// distance from the call site.
function embedding(
  chunkCount: number,
  embeddings: Map<string, number[]>,
  positionId: string,
): string {
  if (embeddings.size === 0) return 'no embeddings';
  let withEmb = 0;
  for (let i = 0; i < chunkCount; i++) {
    if (embeddings.has(`${positionId}|${i}`)) withEmb += 1;
  }
  return withEmb === chunkCount ? 'all embedded' : `${withEmb}/${chunkCount} embedded`;
}

main().catch((err) => {
  console.error(`${RED}FATAL${RESET}:`, err);
  process.exit(1);
});
