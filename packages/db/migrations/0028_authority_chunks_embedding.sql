-- 0028_authority_chunks_embedding.sql
--
-- Add the embedding column to authority_chunks reserved in migration
-- 0014. Voyage `voyage-3-lite` is 1024 dims per CLAUDE.md L4 (memory
-- architecture lock). Until ingestion + embed-on-insert ship (C5 + C6),
-- embedding stays NULL on every row and retrieval falls back to
-- BM25-only via the tsv index from 0014. After C5 + C6 land, the
-- ingestion script back-fills embeddings and the retriever uses
-- hybrid BM25 + cosine score fusion per L4.
--
-- IDEMPOTENT
--   ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS. Re-running
--   this migration is a no-op against a DB that already has the column.
--
-- WHY HNSW (not IVFFlat)
--   1. Read-heavy workload. Discovery agent retrieves 8-12 chunks per
--      scan; writes happen once at ingest time per authority. HNSW
--      wins on query latency at our scale.
--   2. HNSW indexes don't need rebuilds at scale (IVFFlat does).
--   3. The reservation comment in 0014 already specifies HNSW.
--   4. pgvector >= 0.5 supports HNSW; Neon ships pgvector 0.7+.
--
-- INDEX PARAMS
--   m=16 (neighbors per layer) and ef_construction=64 (build-time
--   accuracy) are pgvector defaults and the right starting point for
--   our scale (~5K chunks for IRS Pub 17 + FTB residency manual +
--   internal Position Library). Re-tune if recall analysis after
--   first full ingest shows gaps.
--
-- STORAGE COST
--   1024 floats × 4 bytes = ~4KB per row. At ~5K chunks: ~20MB total.
--   Acceptable. Compression via half-precision deferred to v1.5+ if
--   retrieval latency or storage become concerns.

ALTER TABLE authority_chunks
  ADD COLUMN IF NOT EXISTS embedding vector(1024);

CREATE INDEX IF NOT EXISTS authority_chunks_embedding_hnsw_idx
  ON authority_chunks USING hnsw (embedding vector_cosine_ops);
