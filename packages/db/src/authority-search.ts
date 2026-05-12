// Authority search — full-text retrieval over the authorities +
// authority_chunks tables.
//
// v0: Postgres tsvector (BM25-ish) only. The chunks table has a
// GENERATED ALWAYS AS tsv tsvector('english') column; we rank with
// ts_rank_cd against websearch_to_tsquery for natural-language
// queries.
//
// v1+ adds:
//   - voyage-3-lite embedding column on authority_chunks (1024 dims)
//   - hybrid search: BM25 score + cosine similarity, blended via
//     reciprocal-rank-fusion or weighted sum
//   - reranker pass on the top-K via voyage-rerank-2-lite
//
// SCOPING
//   Authorities have tenant_id NULL for globals (IRS / FTB) AND
//   tenant_id NOT NULL for firm-internal playbooks/memos. The
//   search returns BOTH globals AND the requesting tenant's
//   private authorities (RLS handles the filter). Cross-tenant
//   leakage blocked by RLS.

import { sql } from 'drizzle-orm';
import { withTenant } from './client.js';
import type { TenantId } from '@docket/shared';

export interface AuthoritySearchHit {
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
  rank: number;
  [key: string]: unknown;
}

export interface AuthoritySearchOptions {
  /** Limit the number of hits returned. Default 10. */
  limit?: number;
  /**
   * Restrict to specific authority kinds (e.g., only IRC + Treas Reg).
   * Empty array = no filter. Default no filter.
   */
  kinds?: Array<
    | 'irc'
    | 'treas_reg'
    | 'irs_pub'
    | 'irs_form'
    | 'irs_irm'
    | 'irs_irb'
    | 'irs_notice'
    | 'irs_revrul'
    | 'irs_revproc'
    | 'tax_court'
    | 'ca_ftb_pub'
    | 'ca_ftb_legal'
    | 'ca_ftb_form'
    | 'cdtfa'
    | 'edd'
    | 'firm_playbook'
    | 'firm_memo'
    | 'firm_template'
  >;
  /**
   * Restrict to a single jurisdiction. 'federal' / 'CA' / 'firm'.
   * Undefined = no filter.
   */
  jurisdiction?: 'federal' | 'CA' | 'firm';
  /**
   * Filter by applicable_tax_years overlap. If the authority's
   * applicable_tax_years is empty (evergreen), it's always
   * included. If it's populated, the year must be in the array.
   */
  taxYear?: number;
  /**
   * Exclude superseded authorities (default true). Set false to
   * include superseded for historical lookups.
   */
  excludeSuperseded?: boolean;
  /**
   * Include unreviewed `firm_memo` drafts in search results. Default
   * `false` — only `firm_memo` authorities whose
   * `metadata->>'reviewStatus'` is `'ANTONIO-VALIDATED'` or
   * `'BACKUP-VALIDATED'` surface to callers. Non-`firm_memo`
   * authorities (IRS / FTB / Treas Regs / etc.) are unaffected because
   * their authority comes from the issuing body, not internal review.
   *
   * Set `true` ONLY in dev / test / admin tooling where surfacing
   * `DRAFT-DAVID` (or any non-validated) entries is intentional.
   *
   * Safety rationale: the Position Library v0 ingest writes every
   * markdown draft as a globally visible `firm_memo` row (tenant_id
   * NULL). Without this gate, an unreviewed position would appear in
   * Discovery / chat / audit-defense output for any tenant. The gate
   * defaults to safe-mode so a forgotten reviewStatus check at the
   * caller can't leak draft guidance to a prospect.
   */
  includeDrafts?: boolean;
}

/**
 * Search authorities + chunks. Returns hits ranked by ts_rank_cd
 * with the most-relevant chunks first. Tenant-scoped via withTenant
 * so globals + the requesting tenant's firm authorities both come
 * back; other tenants' firm authorities are filtered by RLS.
 */
export async function searchAuthorities(
  tenantId: string,
  query: string,
  opts: AuthoritySearchOptions = {},
): Promise<AuthoritySearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const limit = opts.limit ?? 10;
  const excludeSuperseded = opts.excludeSuperseded !== false;
  const includeDrafts = opts.includeDrafts === true;

  const kindsLiteral =
    opts.kinds && opts.kinds.length > 0
      ? `{${opts.kinds.map((k) => `"${k}"`).join(',')}}`
      : null;
  const jurisdiction = opts.jurisdiction ?? null;
  const taxYear = opts.taxYear ?? null;

  return await withTenant(tenantId as TenantId, async (db) => {
    const rows = await db.execute<AuthoritySearchHit>(sql`
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
        ts_rank_cd(ac.tsv, websearch_to_tsquery('english', ${trimmed}))::float8 AS rank
      FROM authority_chunks ac
      JOIN authorities a ON a.id = ac.authority_id
      WHERE ac.tsv @@ websearch_to_tsquery('english', ${trimmed})
        AND (${kindsLiteral}::text[] IS NULL OR a.kind::text = ANY(${kindsLiteral}::text[]))
        AND (${jurisdiction}::text IS NULL OR a.jurisdiction::text = ${jurisdiction}::text)
        AND (${taxYear}::int IS NULL
             OR cardinality(a.applicable_tax_years) = 0
             OR ${taxYear}::int = ANY(a.applicable_tax_years))
        AND (${excludeSuperseded ? sql`a.superseded_date IS NULL` : sql`TRUE`})
        AND (
          ${includeDrafts}::boolean = true
          OR a.kind::text != 'firm_memo'
          OR (a.metadata->>'reviewStatus') IN ('ANTONIO-VALIDATED', 'BACKUP-VALIDATED')
        )
      ORDER BY rank DESC, ac.ordinal ASC
      LIMIT ${limit}
    `);

    return rows as unknown as AuthoritySearchHit[];
  });
}

/**
 * Lookup an authority by its citation label (exact or fuzzy match).
 * Used by the citation-verifier loop to confirm a model-emitted
 * citation resolves to a real authority. Returns null if no match.
 *
 * Match strategy:
 *   1. Exact citation_label match (case-insensitive)
 *   2. Slug match (case-insensitive)
 *   3. NULL (caller decides whether to surface as hallucination)
 *
 * Review-status gate: identical to `searchAuthorities()`. A draft
 * `firm_memo` row resolves to NULL unless `includeDrafts: true` is
 * passed. Earlier reasoning treated this lookup as hallucination
 * detection only — but `services/workers/src/agents/discovery-agent.ts`
 * and `services/workers/src/agents/notice-drafter.ts` both treat ANY
 * resolved citation as "verified" and promote it past the citation
 * gate. A draft cite injected via prior context (RAG snippet outside
 * `searchAuthorities`, hand-typed by a tester, leaked from a prior
 * chat) would otherwise smuggle unreviewed guidance into agent
 * output. Defense-in-depth: both lookup paths gate by default;
 * dev/test callers pass `{ includeDrafts: true }` explicitly.
 */
export interface LookupAuthorityByCitationOptions {
  /**
   * Include unreviewed `firm_memo` drafts. Default `false`.
   * See `AuthoritySearchOptions.includeDrafts` for the full safety
   * rationale — same posture, same default-deny semantics.
   */
  includeDrafts?: boolean;
}

export async function lookupAuthorityByCitation(
  tenantId: string,
  citation: string,
  opts: LookupAuthorityByCitationOptions = {},
): Promise<{
  id: string;
  citation_label: string;
  title: string;
  external_url: string | null;
  kind: string;
} | null> {
  const trimmed = citation.trim();
  if (trimmed.length < 2) return null;
  const includeDrafts = opts.includeDrafts === true;
  return await withTenant(tenantId as TenantId, async (db) => {
    const rows = await db.execute<{
      id: string;
      citation_label: string;
      title: string;
      external_url: string | null;
      kind: string;
    }>(sql`
      SELECT
        id::text AS id,
        citation_label,
        title,
        external_url,
        kind::text AS kind
      FROM authorities
      WHERE (LOWER(citation_label) = LOWER(${trimmed})
             OR LOWER(slug) = LOWER(${trimmed}))
        AND (
          ${includeDrafts}::boolean = true
          OR kind::text != 'firm_memo'
          OR (metadata->>'reviewStatus') IN ('ANTONIO-VALIDATED', 'BACKUP-VALIDATED')
        )
      LIMIT 1
    `);
    return (rows as unknown as Array<{
      id: string;
      citation_label: string;
      title: string;
      external_url: string | null;
      kind: string;
    }>)[0] ?? null;
  });
}
