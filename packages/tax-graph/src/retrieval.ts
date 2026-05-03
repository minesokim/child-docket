// KnowledgeRetriever — the contract every retrieval implementation
// honors. Agent code calls retriever.retrieve(query, opts) and gets
// back a ranked list of RetrievalHit. Implementation strategy is
// hidden behind the interface so we can swap NullRetriever (today) →
// PostgresRetriever (BM25 + cosine + reranker per D12) → distant-future
// alternatives without touching agent code.
//
// FILTERING CONTRACT
//   retrieve(query, opts) is responsible for:
//   - tenant scoping (RLS handles this when going through withTenant,
//     but interface still accepts an optional tenantId for clarity)
//   - effective-date filtering (only authorities in effect on the
//     requested taxYear)
//   - jurisdiction filtering (federal-only vs federal+CA)
//   - top-K selection
//
// CALLER CONTRACT
//   Callers MUST pass a taxYear when the answer is tax-year-sensitive
//   (which is most agent queries). Without taxYear, retrieval falls
//   back to "in effect today" which is safe for general questions but
//   wrong for return-prep questions about prior years.

import type { RetrievalHit } from './types.js';

export type RetrievalOpts = {
  /**
   * Tax year to treat as the reference for "in effect" filtering.
   * Recommended for any tax-year-sensitive question.
   */
  taxYear?: number;
  /**
   * Limit jurisdictions. Default: all (federal + CA + firm). For
   * federal-only questions pass `['federal']`; for CA-residency
   * questions pass `['federal', 'CA']`.
   */
  jurisdictions?: ReadonlyArray<'federal' | 'CA' | 'firm'>;
  /**
   * Top-K. Default 8 — calibrated for "agent puts 4-8 chunks in its
   * context window."
   */
  topK?: number;
  /**
   * If true, allow superseded authorities in the result set. Default
   * false. Only set this for diff queries (the tax-law diff agent
   * comparing past vs current).
   */
  includeSuperseded?: boolean;
};

export interface KnowledgeRetriever {
  /**
   * Retrieve relevant authority chunks for `query`.
   *
   * Returns up to `opts.topK` hits sorted by descending score. Empty
   * array if nothing matches.
   *
   * MUST honor tenant boundaries — implementations that read directly
   * from Postgres should run inside `withTenant(tenantId, ...)` so
   * RLS does the filtering. Implementations that read from a remote
   * vector store (future) must enforce tenant scoping at the API
   * boundary.
   */
  retrieve(query: string, opts?: RetrievalOpts): Promise<RetrievalHit[]>;
}

/**
 * The no-op implementation. Returns [] for every query.
 *
 * Lets agent code be written + tested end-to-end before the real
 * retrieval ships. Once `PostgresRetriever` (BM25 + cosine + reranker)
 * lands, swap NullRetriever for that.
 *
 * Detection: agents that depend on retrieval should fail OPEN when
 * NullRetriever is in place — render an "I don't have authority data
 * to ground this answer" disclaimer rather than confabulating. The
 * agent prompt construction is the right place to enforce that.
 */
export class NullRetriever implements KnowledgeRetriever {
  async retrieve(_query: string, _opts: RetrievalOpts = {}): Promise<RetrievalHit[]> {
    return [];
  }
}

/**
 * Module-level singleton — most callers want "the retriever" without
 * threading it through every function. Update via `setRetriever`
 * during app boot when the real implementation lands.
 *
 * Default: NullRetriever. Production boot should swap this in
 * `services/orchestrator` setup before any agent runs.
 */
let _activeRetriever: KnowledgeRetriever = new NullRetriever();

export function getRetriever(): KnowledgeRetriever {
  return _activeRetriever;
}

export function setRetriever(retriever: KnowledgeRetriever): void {
  _activeRetriever = retriever;
}
