// Smoke: PostgresRetriever against the dev DB.
//
// Exercises the full hybrid-retrieval path end-to-end:
//   - Construct retriever bound to the dev tenant
//   - Run a tax-domain query
//   - Validate BM25 + cosine + RRF fusion all fire
//   - Confirm reviewStatus gate keeps DRAFT-DAVID Position Library
//     entries OUT of default retrieval
//   - Confirm includeDrafts: true opt-in surfaces drafts
//   - Confirm graceful fallback when VOYAGE_API_KEY is missing
//
// Run via:
//   bun run packages/db/scripts/smoke-postgres-retriever.ts
//
// Cost: ~4 Voyage embed calls (~50 tokens / $0.000006) + a handful
// of cheap SQL queries. Safe to run in any environment with the
// Voyage paid tier (or the free tier — we're well under 10K TPM
// because each call sends only 1 input).

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env.local'), override: true });

import { getAdminDb, PostgresRetriever } from '../src/index.js';
import type { TenantId } from '@docket/shared';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';

async function main(): Promise<void> {
  console.log(`${YELLOW}━━ smoke-postgres-retriever ━━${RESET}`);

  const db = getAdminDb();
  const rows = await db.execute<{ id: string }>(
    sql`SELECT id::text AS id FROM tenants LIMIT 1`,
  );
  const tenants = rows as unknown as Array<{ id: string }>;
  if (tenants.length === 0) {
    console.log('No tenants on dev DB — exiting.');
    process.exit(0);
  }
  const tenantId = tenants[0]!.id as TenantId;
  console.log(`tenant: ${tenantId}\n`);

  // ───────────────────────────────────────────────────────────────
  // Case 1 — Default retriever (no includeDrafts) on §199A query.
  // Position Library v0 is all DRAFT-DAVID so position memos should
  // NOT surface. The seeded IRC §199A authority (kind='irc') is
  // NOT gated by reviewStatus → should appear at top of BM25.
  // Cosine returns 0 hits (the 7 seeded authorities have NO
  // embedding column populated; only the ingested position library
  // does). So fusion = BM25 only for the seeded path.
  // ───────────────────────────────────────────────────────────────
  console.log(`${DIM}--- Case 1: default retriever, "§199A QBI deduction" ---${RESET}`);
  const retrieverDefault = new PostgresRetriever(tenantId);
  const hits1 = await retrieverDefault.retrieve('§199A QBI deduction', {
    topK: 5,
  });
  console.log(`  hits: ${hits1.length}`);
  for (const h of hits1.slice(0, 5)) {
    console.log(
      `    ${h.authority.citationLabel.padEnd(40)} kind=${h.authority.kind.padEnd(15)} score=${h.score.toFixed(4)}` +
        (h.scores?.bm25 !== undefined ? ` bm25=${h.scores.bm25.toFixed(4)}` : '') +
        (h.scores?.cosine !== undefined ? ` cos_dist=${h.scores.cosine.toFixed(4)}` : ''),
    );
  }
  // Assertion: no DRAFT-DAVID position memo (citation_label starts
  // with "Position p###:") should appear in default retrieval.
  const draftMemos1 = hits1.filter((h) =>
    /^Position p\d{3}:/.test(h.authority.citationLabel),
  );
  if (draftMemos1.length > 0) {
    throw new Error(
      `Default retriever leaked DRAFT-DAVID position memos: ${draftMemos1.map((h) => h.authority.citationLabel).join('; ')}`,
    );
  }
  console.log(`  ${GREEN}PASS${RESET}  no DRAFT-DAVID memos in default retrieval`);

  // ───────────────────────────────────────────────────────────────
  // Case 2 — includeDrafts: true on §199A QBI deduction.
  // Now Position Library entries SHOULD surface. Cosine arm should
  // light up because position chunks have embeddings. Top-1 should
  // be p001 (the §199A position memo) under cosine, and the IRC
  // §199A under BM25 might rank similarly. RRF blends both.
  // ───────────────────────────────────────────────────────────────
  console.log(
    `\n${DIM}--- Case 2: includeDrafts:true, "§199A QBI deduction" ---${RESET}`,
  );
  const retrieverDraft = new PostgresRetriever(tenantId, { includeDrafts: true });
  const hits2 = await retrieverDraft.retrieve('§199A QBI deduction', { topK: 5 });
  console.log(`  hits: ${hits2.length}`);
  for (const h of hits2.slice(0, 5)) {
    console.log(
      `    ${h.authority.citationLabel.padEnd(40)} kind=${h.authority.kind.padEnd(15)} score=${h.score.toFixed(4)}` +
        (h.scores?.bm25 !== undefined ? ` bm25=${h.scores.bm25.toFixed(4)}` : '') +
        (h.scores?.cosine !== undefined ? ` cos_dist=${h.scores.cosine.toFixed(4)}` : ''),
    );
  }
  if (hits2.length === 0) {
    throw new Error('includeDrafts:true returned 0 hits — expected at least 1 position memo');
  }
  // Expect at least one position-library memo when drafts opt-in.
  const draftMemos2 = hits2.filter((h) =>
    /^Position p\d{3}:/.test(h.authority.citationLabel),
  );
  if (draftMemos2.length === 0) {
    throw new Error('includeDrafts:true did not surface any position memos');
  }
  console.log(
    `  ${GREEN}PASS${RESET}  ${draftMemos2.length} DRAFT-DAVID position memo(s) surfaced under opt-in`,
  );

  // ───────────────────────────────────────────────────────────────
  // Case 3 — Pure semantic query that BM25 should miss.
  // "what does pass-through deduction mean" has no §199A keyword
  // match in the seeded text but the position memos talk about it.
  // Cosine should rank position memos high.
  // ───────────────────────────────────────────────────────────────
  console.log(
    `\n${DIM}--- Case 3: semantic-only query, "pass-through deduction for small business owners" ---${RESET}`,
  );
  const hits3 = await retrieverDraft.retrieve(
    'pass-through deduction for small business owners',
    { topK: 5 },
  );
  console.log(`  hits: ${hits3.length}`);
  for (const h of hits3.slice(0, 5)) {
    console.log(
      `    ${h.authority.citationLabel.padEnd(40)} kind=${h.authority.kind.padEnd(15)} score=${h.score.toFixed(4)}` +
        (h.scores?.bm25 !== undefined ? ` bm25=${h.scores.bm25.toFixed(4)}` : '') +
        (h.scores?.cosine !== undefined ? ` cos_dist=${h.scores.cosine.toFixed(4)}` : ''),
    );
  }
  if (hits3.length === 0) {
    throw new Error('Semantic query returned 0 hits — cosine arm appears broken');
  }
  const cosineContributing = hits3.filter((h) => h.scores?.cosine !== undefined);
  if (cosineContributing.length === 0) {
    throw new Error(
      'No hits had cosine scores — fusion did not exercise the cosine leg',
    );
  }
  console.log(
    `  ${GREEN}PASS${RESET}  cosine arm contributed to ${cosineContributing.length}/${hits3.length} hits`,
  );

  // ───────────────────────────────────────────────────────────────
  // Case 4 — Graceful BM25-only fallback when Voyage is unavailable.
  // Simulate by constructing a retriever with no API key.
  // ───────────────────────────────────────────────────────────────
  console.log(
    `\n${DIM}--- Case 4: BM25-only fallback (no apiKey, fallbackToBM25:true) ---${RESET}`,
  );
  const retrieverNoVoyage = new PostgresRetriever(tenantId, {
    apiKey: '',
    includeDrafts: true,
    fallbackToBM25: true,
  });
  const hits4 = await retrieverNoVoyage.retrieve('§199A QBI deduction', { topK: 5 });
  console.log(`  hits: ${hits4.length}`);
  if (hits4.length === 0) {
    throw new Error('BM25-only fallback returned 0 hits');
  }
  const cosineInFallback = hits4.filter((h) => h.scores?.cosine !== undefined);
  if (cosineInFallback.length > 0) {
    throw new Error(
      `BM25-only mode leaked cosine scores: ${cosineInFallback.length} hits had cos_dist`,
    );
  }
  console.log(
    `  ${GREEN}PASS${RESET}  BM25-only fallback returned ${hits4.length} hits, no cosine scores`,
  );

  // ───────────────────────────────────────────────────────────────
  // Case 5 — Empty / too-short query returns [].
  // ───────────────────────────────────────────────────────────────
  console.log(`\n${DIM}--- Case 5: empty / too-short query → [] ---${RESET}`);
  const empty1 = await retrieverDefault.retrieve('', { topK: 5 });
  const empty2 = await retrieverDefault.retrieve('x', { topK: 5 });
  if (empty1.length !== 0 || empty2.length !== 0) {
    throw new Error(`Empty queries returned hits: '' → ${empty1.length}, 'x' → ${empty2.length}`);
  }
  console.log(`  ${GREEN}PASS${RESET}  empty/short queries return []`);

  // ───────────────────────────────────────────────────────────────
  // Case 6 — topK=0 returns [] without burning a Voyage call.
  // ───────────────────────────────────────────────────────────────
  console.log(`\n${DIM}--- Case 6: topK=0 → [] ---${RESET}`);
  const zeroK = await retrieverDefault.retrieve('§199A QBI deduction', { topK: 0 });
  if (zeroK.length !== 0) {
    throw new Error(`topK=0 returned ${zeroK.length} hits — expected 0`);
  }
  console.log(`  ${GREEN}PASS${RESET}  topK=0 returns []`);

  // ───────────────────────────────────────────────────────────────
  // Case 7 — taxYear in-effect filter (codex C6 round 1 P1).
  // §199A (p001) is bounded to 2018-2025. A query for taxYear=2017
  // (pre-§199A) should NOT return p001. A query for taxYear=2024
  // (mid-window) SHOULD return p001.
  // ───────────────────────────────────────────────────────────────
  console.log(
    `\n${DIM}--- Case 7: taxYear in-effect filter — TY2017 (pre-§199A) excludes p001 ---${RESET}`,
  );
  const ty2017 = await retrieverDraft.retrieve('§199A QBI deduction', {
    taxYear: 2017,
    topK: 10,
  });
  const p001In2017 = ty2017.filter((h) =>
    /^Position p001:/.test(h.authority.citationLabel),
  );
  if (p001In2017.length > 0) {
    throw new Error(
      `taxYear=2017 returned p001 §199A; it should be filtered out (§199A bounded to 2018-2025).`,
    );
  }
  console.log(
    `  ${GREEN}PASS${RESET}  TY2017 retrieval excludes p001 §199A (bounded 2018-2025): ${ty2017.length} other hit(s)`,
  );

  console.log(
    `\n${DIM}--- Case 7b: TY2024 (mid-§199A-window) includes p001 ---${RESET}`,
  );
  const ty2024 = await retrieverDraft.retrieve('§199A QBI deduction', {
    taxYear: 2024,
    topK: 10,
  });
  const p001In2024 = ty2024.filter((h) =>
    /^Position p001:/.test(h.authority.citationLabel),
  );
  if (p001In2024.length === 0) {
    throw new Error(
      `taxYear=2024 did NOT return p001 §199A; it should be in scope (§199A bounded 2018-2025).`,
    );
  }
  console.log(
    `  ${GREEN}PASS${RESET}  TY2024 retrieval includes p001 §199A (${p001In2024.length} chunk(s))`,
  );

  // ───────────────────────────────────────────────────────────────
  // Case 8 — multi-jurisdiction array (codex C6 round 1 P2).
  // Pass jurisdictions: ['federal', 'CA'] and confirm firm rows are
  // excluded. Pass jurisdictions: ['firm'] and confirm only firm
  // rows surface.
  // ───────────────────────────────────────────────────────────────
  console.log(
    `\n${DIM}--- Case 8: multi-jurisdiction ['federal','CA'] excludes firm rows ---${RESET}`,
  );
  const fedCAonly = await retrieverDraft.retrieve('§199A QBI deduction', {
    jurisdictions: ['federal', 'CA'],
    topK: 10,
  });
  const firmInFedCA = fedCAonly.filter((h) => h.authority.jurisdiction === 'firm');
  if (firmInFedCA.length > 0) {
    throw new Error(
      `jurisdictions:['federal','CA'] leaked ${firmInFedCA.length} firm-jurisdiction hits.`,
    );
  }
  console.log(
    `  ${GREEN}PASS${RESET}  ['federal','CA'] excluded firm rows (got ${fedCAonly.length} hits)`,
  );

  console.log(
    `\n${DIM}--- Case 8b: jurisdictions:['firm'] returns only firm rows ---${RESET}`,
  );
  const firmOnly = await retrieverDraft.retrieve('§199A QBI deduction', {
    jurisdictions: ['firm'],
    topK: 10,
  });
  const nonFirmInFirm = firmOnly.filter((h) => h.authority.jurisdiction !== 'firm');
  if (nonFirmInFirm.length > 0) {
    throw new Error(
      `jurisdictions:['firm'] leaked ${nonFirmInFirm.length} non-firm-jurisdiction hits.`,
    );
  }
  console.log(
    `  ${GREEN}PASS${RESET}  ['firm'] returned only firm rows (got ${firmOnly.length} hits)`,
  );

  // ───────────────────────────────────────────────────────────────
  // Case 8c — empty `jurisdictions: []` overrides legacy `jurisdiction`
  // (codex C6 round 6 P2). Tested at the searchAuthorities() layer
  // because that is the only surface that exposes both fields; the
  // PostgresRetriever public API only forwards `jurisdictions`.
  // The contract: `jurisdictions: []` is an explicit "no filter"
  // signal that wins over a still-set `jurisdiction`.
  // ───────────────────────────────────────────────────────────────
  console.log(
    `\n${DIM}--- Case 8c: jurisdictions:[] overrides legacy jurisdiction ---${RESET}`,
  );
  const { searchAuthorities } = await import('../src/authority-search.js');
  // Baseline: jurisdiction:'CA' alone restricts to CA-only. The query
  // is firm-aimed, so we expect zero CA hits — that is the "filter
  // is active" signal. If empty `jurisdictions:[]` overrides, we
  // get back the firm-jurisdiction rows that match the query.
  const caOnlyBaseline = await searchAuthorities(tenantId, '§199A QBI deduction', {
    jurisdiction: 'CA',
    includeDrafts: true,
    limit: 20,
  });
  const overrideClear = await searchAuthorities(tenantId, '§199A QBI deduction', {
    jurisdiction: 'CA',
    jurisdictions: [],
    includeDrafts: true,
    limit: 20,
  });
  // The contract: empty `jurisdictions: []` MUST clear the filter, so
  // the override path must return strictly more hits than the
  // CA-only baseline (which returns 0 for this firm-aimed query).
  if (overrideClear.length <= caOnlyBaseline.length) {
    throw new Error(
      `jurisdictions:[] did not override jurisdiction:'CA' — baseline=${caOnlyBaseline.length} override=${overrideClear.length} (expected override > baseline)`,
    );
  }
  console.log(
    `  ${GREEN}PASS${RESET}  jurisdictions:[] cleared filter (CA-only baseline=${caOnlyBaseline.length}, override=${overrideClear.length})`,
  );

  // ───────────────────────────────────────────────────────────────
  // Case 9 — fail-fast mode throws when key is missing (codex round 1 P2).
  // fallbackToBM25:false + no apiKey must throw, NOT silently disable
  // the cosine arm.
  // ───────────────────────────────────────────────────────────────
  console.log(`\n${DIM}--- Case 9: fail-fast on missing key throws ---${RESET}`);
  const retrieverFailFast = new PostgresRetriever(tenantId, {
    apiKey: '',
    fallbackToBM25: false,
  });
  let threw = false;
  try {
    await retrieverFailFast.retrieve('§199A QBI deduction', { topK: 5 });
  } catch (err) {
    threw = true;
    const msg = err instanceof Error ? err.message : String(err);
    if (!/VOYAGE_API_KEY missing.*fallbackToBM25=false/i.test(msg)) {
      throw new Error(`fail-fast threw but with wrong message: ${msg.slice(0, 200)}`);
    }
  }
  if (!threw) {
    throw new Error('fail-fast mode did NOT throw on missing apiKey');
  }
  console.log(
    `  ${GREEN}PASS${RESET}  fail-fast mode throws with expected message on missing key`,
  );

  console.log(`\n${GREEN}━━ all checks passed ━━${RESET}`);
}

main().catch((err) => {
  console.error(`${RED}FATAL${RESET}:`, err);
  process.exit(1);
});
