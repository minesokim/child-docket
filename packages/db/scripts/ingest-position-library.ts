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
// Default batch size: 10 inputs/request to stay under free-tier 10K TPM
// (10 chunks × ~600 tokens average = ~6K tokens/request). Standard
// (paid-account) limits are 2000 RPM / 3M TPM, so this number is
// conservative. Override per-call when known-safe.
const VOYAGE_BATCH_SIZE = 10;
const VOYAGE_TIMEOUT_MS = 30_000;
// Free-tier RPM = 3, so ~21s between batches. Paid accounts hit higher
// rate limits well above what we send; the sleep is harmless when not
// rate-limited.
const VOYAGE_INTER_BATCH_MS = 21_000;
const VOYAGE_MAX_RETRIES = 3;

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
  const text = await fs.readFile(fullPath, 'utf8');
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
          : VOYAGE_INTER_BATCH_MS * Math.pow(2, attempt);
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
    console.log(
      `${DIM}Embedding ${allChunks.length} chunks via voyage-3-large (${batches} batches, ~${Math.round((batches * VOYAGE_INTER_BATCH_MS) / 1000)}s on free-tier RPM)...${RESET}`,
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
        const metadata = {
          positionId: p.meta.positionId,
          reviewStatus: p.meta.reviewStatus,
          tierClassification: p.meta.tierClassification,
          penaltyExposure: p.meta.penaltyExposure,
          lastReviewed: p.meta.lastReviewed,
          nextRefresh: p.meta.nextRefresh,
          effectiveDateRange: p.meta.effectiveDateRange,
          sourceFile: p.meta.filename,
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
    console.log(`${DIM}Smoke: BM25 + cosine queries against ingested content...${RESET}`);

    const bm25Hits = await sql<{ citation_label: string; rank: number }[]>`
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

    if (!NO_EMBEDDINGS && chunkEmbeddings.size > 0) {
      // Cosine smoke: embed a query phrase, query top-K.
      const apiKey = process.env.VOYAGE_API_KEY!;
      const { embeddings: queryEmbedArr } = await voyageEmbed(
        ['What is the Section 199A QBI deduction?'],
        apiKey,
      );
      const queryVec = `[${queryEmbedArr[0]!.join(',')}]`;
      const cosineHits = await sql<{ citation_label: string; distance: number }[]>`
        SELECT a.citation_label,
               (c.embedding <=> ${sql.unsafe(`'${queryVec}'::vector`)}) AS distance
          FROM authorities a
          JOIN authority_chunks c ON c.authority_id = a.id
         WHERE a.tenant_id IS NULL
           AND a.kind = 'firm_memo'
           AND c.embedding IS NOT NULL
         ORDER BY c.embedding <=> ${sql.unsafe(`'${queryVec}'::vector`)}
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
