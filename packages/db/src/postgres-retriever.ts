// PostgresRetriever — production implementation of the
// KnowledgeRetriever interface (defined in @docket/tax-graph).
//
// STRATEGY
//   Hybrid BM25 + cosine-similarity over `authority_chunks`, fused
//   with reciprocal-rank-fusion (RRF). Locked by CLAUDE.md L4:
//   - Postgres tsvector for keyword scoring (the BM25 stand-in;
//     Postgres' ts_rank_cd is BM25-spirited, not literal BM25)
//   - Voyage-3-Large embeddings (1024 dims) for semantic scoring
//   - RRF blend on rank position — no calibration headaches when
//     score ranges differ across legs
//
//   Future: Cohere Rerank v3.5 as an optional 3rd stage on the
//   top-K candidates. Not in v0; the discovery agent ships against
//   2-leg fusion and we measure quality before adding the rerank
//   network call cost.
//
// SAFETY CONTRACT
//   - Tenant scoping: every SQL query runs inside `withTenant(...)`
//     so RLS enforces "you only see your tenant's data + globals."
//     Cross-tenant leakage is structurally impossible.
//   - Review-status gate: `firm_memo` rows are filtered by
//     `metadata->>'reviewStatus' IN (ANTONIO-VALIDATED, BACKUP-VALIDATED)`
//     unless the caller explicitly passes `includeDrafts: true` to
//     the retriever constructor. The Position Library v0 (all 20
//     entries DRAFT-DAVID) STAYS INVISIBLE to prospect-facing
//     callers per POSITION-FRAMEWORK §6 + L4. Default-deny.
//   - Voyage fallback: if Voyage is unreachable / 429-exhausted /
//     missing API key, the retriever degrades to BM25-only with a
//     console.warn. Returning [] would silently break agent output;
//     graceful degradation surfaces hits ranked by keyword alone.
//
// COST
//   Per `retrieve(query, opts)` call:
//   - 1 Voyage embed call for the query (~10-20 tokens, < $0.0001)
//   - 2 SQL queries (BM25 + cosine), both index-served
//   - 0 LLM calls (RRF + dedupe is pure compute)
//   Total: ~$0.0001 per retrieve when Voyage is reachable; $0 on
//   BM25 fallback.

import { sql as dsql, type SQL } from 'drizzle-orm';
import { withTenant } from './client.js';
import { searchAuthorities, type AuthoritySearchHit } from './authority-search.js';
import type { TenantId } from '@docket/shared';
import type {
  Authority,
  AuthorityChunk,
  AuthorityJurisdiction,
  AuthorityKind,
  KnowledgeRetriever,
  RetrievalHit,
  RetrievalOpts,
} from '@docket/tax-graph';

// ────────────────────────────────────────────────────────────────
// Voyage embedding client — minimal HTTP wrapper for the query
// embed call. The ingest script's voyageEmbed() handles batching +
// retry-on-429 because it sends 115 chunks; here we send ONE input
// per call so the simpler client suffices. Reuses the same model +
// dims contract per L4.
// ────────────────────────────────────────────────────────────────

const VOYAGE_API = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3-large';
const VOYAGE_EMBED_DIM = 1024;
const VOYAGE_QUERY_TIMEOUT_MS = 10_000;
const VOYAGE_MAX_RETRIES = 2; // tighter than ingest — we don't want
// retrievers to block agent latency on Voyage trouble. 2 retries
// (initial + 1) + then fall back to BM25.

type VoyageEmbedResponse = {
  data: Array<{ embedding: number[]; index: number }>;
  usage: { total_tokens: number };
};

async function voyageEmbedQuery(
  query: string,
  apiKey: string,
): Promise<{ embedding: number[]; tokens: number }> {
  for (let attempt = 0; attempt <= VOYAGE_MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), VOYAGE_QUERY_TIMEOUT_MS);
    try {
      const response = await fetch(VOYAGE_API, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: [query],
          model: VOYAGE_MODEL,
          input_type: 'query', // NOT 'document' — Voyage docs say
          // input_type=query for retrieval queries; matches document
          // ingest's input_type='document' for asymmetric retrieval.
        }),
        signal: controller.signal,
      });

      if (response.status === 429) {
        if (attempt >= VOYAGE_MAX_RETRIES) {
          throw new Error(`Voyage API 429 after ${VOYAGE_MAX_RETRIES} retries`);
        }
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter
          ? Math.max(500, Number.parseInt(retryAfter, 10) * 1000)
          : 1000 * Math.pow(2, attempt);
        clearTimeout(timer);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => '<unreadable>');
        throw new Error(
          `Voyage API ${response.status} ${response.statusText}: ${body.slice(0, 300)}`,
        );
      }

      const json = (await response.json()) as VoyageEmbedResponse;
      const embedding = json.data[0]?.embedding;
      if (!embedding) {
        throw new Error('Voyage response missing embedding');
      }
      if (embedding.length !== VOYAGE_EMBED_DIM) {
        throw new Error(
          `Voyage returned wrong dim: ${embedding.length} (expected ${VOYAGE_EMBED_DIM})`,
        );
      }
      return { embedding, tokens: json.usage.total_tokens };
    } finally {
      clearTimeout(timer);
    }
  }
  // Unreachable per loop semantics but TS doesn't know that.
  throw new Error('voyageEmbedQuery: exhausted retries');
}

// ────────────────────────────────────────────────────────────────
// PostgresRetriever — the production retriever.
// ────────────────────────────────────────────────────────────────

export type PostgresRetrieverOpts = {
  /**
   * Voyage API key. Defaults to `process.env.VOYAGE_API_KEY`. If
   * absent at construction AND no `apiKey` passed, the retriever
   * operates in BM25-only mode (degraded; logs a warn on first
   * retrieve() call).
   */
  apiKey?: string;
  /**
   * Include unreviewed `firm_memo` drafts (default false). Mirrors
   * `searchAuthorities.includeDrafts`. Only set true in dev / admin
   * tooling. Production callers (Discovery agent, audit-defense
   * compositions) MUST leave this false so DRAFT-DAVID position
   * memos never reach a prospect.
   */
  includeDrafts?: boolean;
  /**
   * Over-fetch multiplier on each leg before fusion. Default 3.
   * Rationale: the RRF blend benefits from seeing the top-3×topK
   * from each leg so dedupe + fusion has room to discriminate.
   * Higher = better fusion quality but more network bytes. 3 is the
   * common-practice default in hybrid-retrieval literature.
   */
  fusionOverFetch?: number;
  /**
   * RRF rank constant. Higher = flatter score curve. 60 is the
   * Microsoft / Google standard. Lower (~10) sharpens top-rank
   * influence; higher (~120) flattens. Don't change unless eval
   * data warrants.
   */
  rrfK?: number;
  /**
   * If true, fall back to BM25-only when Voyage is unreachable
   * (timeout / non-2xx / 429-exhausted / missing key). Default
   * true. Set false to make retriever fail-fast (preferred for
   * eval / debugging — masks real Voyage outages otherwise).
   */
  fallbackToBM25?: boolean;
};

/**
 * Hybrid BM25 + cosine retriever over `authority_chunks`.
 *
 * Per-tenant via RLS. Default-denies DRAFT firm_memo rows. Falls
 * back to BM25-only on Voyage outage.
 *
 * Construction:
 *   const retriever = new PostgresRetriever(tenantId);
 *   const hits = await retriever.retrieve('§199A QBI deduction', { taxYear: 2024, topK: 8 });
 *
 * Wiring (recommended): per-tenant retriever, constructed when the
 * agent run starts. The module-level `setRetriever()` singleton from
 * @docket/tax-graph is fine for a single-tenant test app but the
 * agent fleet should construct a fresh retriever bound to the
 * request's tenantId.
 */
export class PostgresRetriever implements KnowledgeRetriever {
  private readonly tenantId: TenantId;
  private readonly apiKey: string | null;
  private readonly includeDrafts: boolean;
  private readonly fusionOverFetch: number;
  private readonly rrfK: number;
  private readonly fallbackToBM25: boolean;
  private warnedNoKey = false;

  constructor(tenantId: TenantId, opts: PostgresRetrieverOpts = {}) {
    this.tenantId = tenantId;
    this.apiKey = opts.apiKey ?? process.env.VOYAGE_API_KEY ?? null;
    this.includeDrafts = opts.includeDrafts === true;
    this.fusionOverFetch = opts.fusionOverFetch ?? 3;
    this.rrfK = opts.rrfK ?? 60;
    this.fallbackToBM25 = opts.fallbackToBM25 !== false;
  }

  async retrieve(query: string, opts: RetrievalOpts = {}): Promise<RetrievalHit[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];
    const topK = opts.topK ?? 8;
    if (topK <= 0) return [];

    const candidatesPerLeg = Math.max(topK, topK * this.fusionOverFetch);

    // Run BM25 + cosine in parallel. Cosine arm may degrade to
    // null hits on Voyage outage; BM25 arm uses the already-tested
    // searchAuthorities() path so it inherits the reviewStatus
    // gate + jurisdiction + taxYear + supersession filters.
    const [bm25Hits, cosineHits] = await Promise.all([
      this.runBM25(trimmed, opts, candidatesPerLeg),
      this.runCosine(trimmed, opts, candidatesPerLeg),
    ]);

    // RRF fusion. Each hit gets a score from each leg of
    // `1 / (rrfK + rank)` where `rank` is the 1-indexed position
    // in that leg's sorted list. Final score = sum across legs.
    // Chunks present in both legs get higher scores than chunks
    // present in only one. Dedupe by chunk_id.
    const fused = new Map<
      string,
      {
        hit: AuthoritySearchHit;
        bm25Rank: number | null;
        bm25Score: number | null;
        cosineRank: number | null;
        cosineScore: number | null;
        fusedScore: number;
      }
    >();

    bm25Hits.forEach((hit, i) => {
      const rank = i + 1;
      fused.set(hit.chunk_id, {
        hit,
        bm25Rank: rank,
        bm25Score: hit.rank,
        cosineRank: null,
        cosineScore: null,
        fusedScore: 1 / (this.rrfK + rank),
      });
    });

    cosineHits.forEach((hit, i) => {
      const rank = i + 1;
      const existing = fused.get(hit.chunk_id);
      const contribution = 1 / (this.rrfK + rank);
      if (existing) {
        existing.cosineRank = rank;
        existing.cosineScore = hit.cosine_distance ?? null;
        existing.fusedScore += contribution;
      } else {
        fused.set(hit.chunk_id, {
          hit,
          bm25Rank: null,
          bm25Score: null,
          cosineRank: rank,
          cosineScore: hit.cosine_distance ?? null,
          fusedScore: contribution,
        });
      }
    });

    // Sort by fused score desc, then hydrate top-K into RetrievalHit[].
    const ranked = [...fused.values()]
      .sort((a, b) => b.fusedScore - a.fusedScore)
      .slice(0, topK);

    if (ranked.length === 0) return [];

    // Hydrate with REAL lifecycle dates + slug + applicable_tax_years
    // + section_path + char_start/end (codex C6 round 2 P2). One bulk
    // query for the top-K chunk_ids. Without this, callers that use
    // `formatCitationWithStatus` see future-dated authorities as live
    // and superseded ones as never-flagged.
    const chunkIds = ranked.map((e) => e.hit.chunk_id);
    const fullRows = await this.hydrateFullRows(chunkIds);
    const fullByChunkId = new Map(fullRows.map((r) => [r.chunk_id, r]));

    return ranked.map((entry) =>
      hydrateRetrievalHit(entry, fullByChunkId.get(entry.hit.chunk_id) ?? null),
    );
  }

  /**
   * Hydration query — for the final top-K chunks, fetch full
   * Authority + AuthorityChunk fields. Tenant-scoped via withTenant
   * so RLS enforces the same boundary as the BM25 / cosine legs.
   */
  private async hydrateFullRows(chunkIds: string[]): Promise<FullHydrationRow[]> {
    if (chunkIds.length === 0) return [];
    const idsLiteral = `{${chunkIds.map((id) => `"${id}"`).join(',')}}`;
    return await withTenant(this.tenantId, async (db) => {
      const rows = await db.execute<FullHydrationRow>(dsql`
        SELECT
          ac.id::text AS chunk_id,
          ac.authority_id::text AS authority_id,
          a.tenant_id::text AS auth_tenant_id,
          a.kind::text AS kind,
          a.jurisdiction::text AS jurisdiction,
          a.citation_label,
          a.title,
          a.slug,
          a.external_url,
          a.source_uri,
          a.effective_date,
          a.superseded_date,
          a.superseded_by_id::text AS superseded_by_id,
          a.applicable_tax_years,
          a.content_hash AS auth_content_hash,
          a.metadata,
          a.created_at AS auth_created_at,
          a.updated_at AS auth_updated_at,
          ac.tenant_id::text AS chunk_tenant_id,
          ac.ordinal,
          ac.section_path,
          ac.heading,
          ac.text,
          ac.char_start,
          ac.char_end,
          ac.content_hash AS chunk_content_hash,
          ac.created_at AS chunk_created_at
        FROM authority_chunks ac
        JOIN authorities a ON a.id = ac.authority_id
        WHERE ac.id = ANY(${idsLiteral}::uuid[])
      `);
      return rows as unknown as FullHydrationRow[];
    });
  }

  /**
   * BM25 leg — delegates to the existing `searchAuthorities()`
   * helper so we inherit the reviewStatus gate, taxYear filter,
   * jurisdiction filter, and supersession filter for free. Returns
   * up to `limit` hits ranked by `ts_rank_cd`.
   */
  private async runBM25(
    query: string,
    opts: RetrievalOpts,
    limit: number,
  ): Promise<AuthoritySearchHit[]> {
    return await searchAuthorities(this.tenantId, query, {
      limit,
      // Multi-jurisdiction path (codex C6 round 1 P2). The legacy
      // single-jurisdiction `jurisdiction` option still exists on
      // AuthoritySearchOptions but `jurisdictions` wins when both
      // are passed; we always pass `jurisdictions` here.
      jurisdictions: opts.jurisdictions,
      taxYear: opts.taxYear,
      excludeSuperseded: opts.includeSuperseded !== true,
      includeDrafts: this.includeDrafts,
    });
  }

  /**
   * Cosine leg — embeds the query via Voyage, runs a pgvector
   * `<=>` ORDER BY against authority_chunks.embedding (the HNSW
   * index from migration 0028 serves this). Applies the same set
   * of filters as the BM25 leg so the two legs see the same
   * candidate pool minus their scoring strategy.
   *
   * Voyage failures (timeout / 429-exhausted / no key) return [] so
   * fusion falls back to BM25-only ranking. The first such failure
   * per retriever lifetime logs a console.warn.
   */
  private async runCosine(
    query: string,
    opts: RetrievalOpts,
    limit: number,
  ): Promise<AuthoritySearchHit[]> {
    if (!this.apiKey) {
      // Codex round 1 P2: fail-fast mode must surface the missing
      // key, not silently disable the cosine arm. The documented
      // contract for `fallbackToBM25: false` is "eval / debug —
      // BM25-only masking is the bug, not the feature."
      if (!this.fallbackToBM25) {
        throw new Error(
          'PostgresRetriever: VOYAGE_API_KEY missing AND fallbackToBM25=false. Set the key (apiKey constructor option or VOYAGE_API_KEY env) or set fallbackToBM25:true to operate BM25-only.',
        );
      }
      if (!this.warnedNoKey) {
        this.warnedNoKey = true;
        console.warn(
          '[PostgresRetriever] VOYAGE_API_KEY missing — cosine arm disabled; retrieval degraded to BM25-only.',
        );
      }
      return [];
    }

    let embedding: number[];
    try {
      const result = await voyageEmbedQuery(query, this.apiKey);
      embedding = result.embedding;
    } catch (err) {
      if (this.fallbackToBM25) {
        console.warn(
          `[PostgresRetriever] Voyage embed failed (${err instanceof Error ? err.message : err}); falling back to BM25-only.`,
        );
        return [];
      }
      throw err;
    }

    const queryVec = `[${embedding.join(',')}]`;

    // SQL filters mirror searchAuthorities so the cosine leg sees
    // the same scope as the BM25 leg. Hand-written here because the
    // existing searchAuthorities is tsvector-shaped; this is the
    // vector-shaped sibling.
    //
    // Multi-jurisdiction: format as a Postgres text[] literal so the
    // SQL filter uses `= ANY(...)`. Single-element and multi-element
    // arrays both work. Codex round 1 P2: dropping multi-jurisdiction
    // to "no filter" let firm rows leak into federal+CA queries.
    const jurisdictionsLiteral = formatJurisdictionsForSQL(opts.jurisdictions);
    const taxYear = opts.taxYear ?? null;
    const excludeSuperseded = opts.includeSuperseded !== true;
    const includeDrafts = this.includeDrafts;
    // Hoist conditional supersession filters — see authority-search.ts
    // for the full semantics rationale (codex C6 round 3 P1+P2):
    //   - With taxYear: outdated if superseded on or before 12/31/N.
    //   - Without taxYear: outdated if superseded at all.
    //   - includeSuperseded:true disables both filters (historical mode).
    const taxYearSupersededFilter = !excludeSuperseded
      ? dsql`TRUE`
      : dsql`(${taxYear}::int IS NULL
             OR a.superseded_date IS NULL
             OR a.superseded_date > make_date(${taxYear}::int, 12, 31))`;
    const noTaxYearSupersededFilter = excludeSuperseded
      ? dsql`(${taxYear}::int IS NOT NULL OR a.superseded_date IS NULL)`
      : dsql`TRUE`;

    return await withTenant(this.tenantId, async (db) => {
      const rows = await db.execute<CosineHitRow>(dsql`
        SELECT
          ac.id::text AS chunk_id,
          ac.authority_id::text AS authority_id,
          a.citation_label,
          a.title,
          a.kind::text AS kind,
          a.jurisdiction::text AS jurisdiction,
          a.external_url,
          ac.ordinal,
          ac.heading,
          ac.text,
          (ac.embedding <=> ${dsql.raw(`'${queryVec}'::vector`)})::float8 AS cosine_distance
        FROM authority_chunks ac
        JOIN authorities a ON a.id = ac.authority_id
        WHERE ac.embedding IS NOT NULL
          AND (${jurisdictionsLiteral}::text[] IS NULL
               OR a.jurisdiction::text = ANY(${jurisdictionsLiteral}::text[]))
          -- taxYear "in-effect" filter — see authority-search.ts for
          -- the full rationale. Mirror the BM25 leg exactly so both
          -- legs see the same candidate pool.
          --
          -- Year-versioned rows (applicable_tax_years populated):
          -- trust applicable_tax_years as the WHICH-year signal; do
          -- NOT also gate on effective_date. Year pubs publish at
          -- the start of N+1 with effective_date ~Jan-1-N+1 even
          -- though they apply to TY N (codex C6 round 5 P1).
          --
          -- Evergreen rows (applicable_tax_years empty): require
          -- effective_date <= 12/31/N (IRC, regs, opinions).
          AND (${taxYear}::int IS NULL
               OR cardinality(a.applicable_tax_years) = 0
               OR ${taxYear}::int = ANY(a.applicable_tax_years))
          AND (${taxYear}::int IS NULL
               OR cardinality(a.applicable_tax_years) > 0
               OR a.effective_date <= make_date(${taxYear}::int, 12, 31))
          -- Tax-year-less retrieval defaults to "in effect today"
          -- per the KnowledgeRetriever contract. Always applies when
          -- no taxYear — independent of includeSuperseded, which
          -- widens the SUPERSEDED set, not the FUTURE-DATED set
          -- (codex C6 round 5 P2).
          AND (${taxYear}::int IS NOT NULL
               OR a.effective_date <= CURRENT_DATE)
          AND ${taxYearSupersededFilter}
          AND ${noTaxYearSupersededFilter}
          AND (
            ${includeDrafts}::boolean = true
            OR a.kind::text != 'firm_memo'
            OR (a.metadata->>'reviewStatus') IN ('ANTONIO-VALIDATED', 'BACKUP-VALIDATED')
          )
        ORDER BY ac.embedding <=> ${dsql.raw(`'${queryVec}'::vector`)}
        LIMIT ${limit}
      `);

      // Map cosine_distance into the AuthoritySearchHit shape so
      // the fusion code treats both arms uniformly. `rank` here is
      // a normalized cosine similarity in [0, 1] (lower distance =
      // higher rank); the actual fusion uses rank position, not
      // raw scores, so this number is informational only.
      const rowsArr = rows as unknown as Array<CosineHitRow>;
      return rowsArr.map(
        (r): AuthoritySearchHit => ({
          chunk_id: r.chunk_id,
          authority_id: r.authority_id,
          citation_label: r.citation_label,
          title: r.title,
          kind: r.kind,
          jurisdiction: r.jurisdiction,
          external_url: r.external_url,
          ordinal: r.ordinal,
          heading: r.heading,
          text: r.text,
          rank: 1 - Math.min(1, Math.max(0, r.cosine_distance / 2)), // cosine_distance in [0,2]
          cosine_distance: r.cosine_distance,
        }),
      );
    });
  }

}

// formatJurisdictionsForSQL — Postgres text[] literal for use in
// `a.jurisdiction = ANY($1::text[])` filters. Codex C6 round 1 P2:
// the cosine leg used to drop multi-jurisdiction down to "no filter"
// via deriveSingleJurisdiction(), letting `firm` rows leak into
// `['federal', 'CA']` queries. Now both legs pass an array literal
// straight through to SQL.
//
// Returns `null` for `undefined` / `[]` (no filter); returns
// `'{"federal","CA"}'` for `['federal', 'CA']`. Caller passes this
// as a `::text[]` cast in the SQL template.
function formatJurisdictionsForSQL(
  jurisdictions: ReadonlyArray<AuthorityJurisdiction> | undefined,
): string | null {
  if (!jurisdictions || jurisdictions.length === 0) return null;
  return `{${jurisdictions.map((j) => `"${j}"`).join(',')}}`;
}

// ────────────────────────────────────────────────────────────────
// Internal — cosine row shape + hydration into RetrievalHit.
// ────────────────────────────────────────────────────────────────

type CosineHitRow = {
  chunk_id: string;
  authority_id: string;
  citation_label: string;
  title: string;
  kind: string;
  jurisdiction: string;
  external_url: string | null;
  ordinal: number;
  heading: string | null;
  text: string;
  cosine_distance: number;
};

// Row shape from the hydration query — full authorities + chunks
// columns needed to build complete Authority + AuthorityChunk
// objects in RetrievalHit. Codex C6 round 2 P2: callers that use
// formatCitationWithStatus need real effectiveDate / supersededDate
// not placeholders.
type FullHydrationRow = {
  chunk_id: string;
  authority_id: string;
  auth_tenant_id: string | null;
  kind: string;
  jurisdiction: string;
  citation_label: string;
  title: string;
  slug: string;
  external_url: string | null;
  source_uri: string | null;
  effective_date: Date | string;
  superseded_date: Date | string | null;
  superseded_by_id: string | null;
  applicable_tax_years: number[];
  auth_content_hash: string | null;
  metadata: Record<string, unknown>;
  auth_created_at: Date | string;
  auth_updated_at: Date | string;
  chunk_tenant_id: string | null;
  ordinal: number;
  section_path: string[];
  heading: string | null;
  text: string;
  char_start: number | null;
  char_end: number | null;
  chunk_content_hash: string;
  chunk_created_at: Date | string;
};

type FusedEntry = {
  hit: AuthoritySearchHit;
  bm25Rank: number | null;
  bm25Score: number | null;
  cosineRank: number | null;
  cosineScore: number | null;
  fusedScore: number;
};

/**
 * Hydrate the fused search result into the public RetrievalHit shape.
 *
 * Uses full data from the per-retrieve hydration query (lifecycle
 * dates, slug, applicable_tax_years, section_path, char positions,
 * content hashes) so RetrievalHit consumers — citation rendering,
 * audit defense, formatCitationWithStatus — see the real authority
 * state. Codex C6 round 2 P2: placeholder values broke supersession
 * status display.
 *
 * If the hydration row is missing (shouldn't happen — every fused
 * chunk_id came from a fresh SELECT moments ago — but be defensive),
 * fall back to the minimal data from the BM25/cosine hit. Better to
 * return an under-hydrated authority than to throw.
 */
function hydrateRetrievalHit(
  entry: FusedEntry,
  full: FullHydrationRow | null,
): RetrievalHit {
  const h = entry.hit;
  const authority: Authority = full
    ? {
        id: full.authority_id,
        tenantId: full.auth_tenant_id as TenantId | null,
        kind: full.kind as AuthorityKind,
        jurisdiction: full.jurisdiction as AuthorityJurisdiction,
        citationLabel: full.citation_label,
        title: full.title,
        slug: full.slug,
        externalUrl: full.external_url,
        sourceUri: full.source_uri,
        effectiveDate: coerceDate(full.effective_date),
        supersededDate: full.superseded_date ? coerceDate(full.superseded_date) : null,
        supersededById: full.superseded_by_id,
        applicableTaxYears: full.applicable_tax_years ?? [],
        contentHash: full.auth_content_hash,
        metadata: full.metadata ?? {},
        createdAt: coerceDate(full.auth_created_at),
        updatedAt: coerceDate(full.auth_updated_at),
      }
    : {
        id: h.authority_id,
        tenantId: null,
        kind: h.kind as AuthorityKind,
        jurisdiction: h.jurisdiction as AuthorityJurisdiction,
        citationLabel: h.citation_label,
        title: h.title,
        slug: '',
        externalUrl: h.external_url,
        sourceUri: null,
        effectiveDate: new Date(0),
        supersededDate: null,
        supersededById: null,
        applicableTaxYears: [],
        contentHash: null,
        metadata: {},
        createdAt: new Date(0),
        updatedAt: new Date(0),
      };
  const chunk: AuthorityChunk = full
    ? {
        id: full.chunk_id,
        authorityId: full.authority_id,
        tenantId: full.chunk_tenant_id as TenantId | null,
        ordinal: full.ordinal,
        sectionPath: full.section_path ?? [],
        heading: full.heading,
        text: full.text,
        charStart: full.char_start,
        charEnd: full.char_end,
        contentHash: full.chunk_content_hash,
        createdAt: coerceDate(full.chunk_created_at),
      }
    : {
        id: h.chunk_id,
        authorityId: h.authority_id,
        tenantId: null,
        ordinal: h.ordinal,
        sectionPath: [],
        heading: h.heading,
        text: h.text,
        charStart: null,
        charEnd: null,
        contentHash: '',
        createdAt: new Date(0),
      };
  const scores: NonNullable<RetrievalHit['scores']> = {};
  if (entry.bm25Score !== null) scores.bm25 = entry.bm25Score;
  if (entry.cosineScore !== null) scores.cosine = entry.cosineScore;
  return {
    authority,
    chunk,
    score: entry.fusedScore,
    scores,
  };
}

// Postgres driver returns date columns as Date objects in some
// configs and as ISO strings in others. Normalize so consumers
// always see a Date.
function coerceDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

// Allow the BM25 hit shape to carry an optional cosine_distance
// (set by runCosine + carried through fusion). Declared here so
// the public AuthoritySearchHit type doesn't grow a leaky retrieval-
// specific field; the cast is local to fusion.
declare module './authority-search.js' {
  interface AuthoritySearchHit {
    cosine_distance?: number;
  }
}
