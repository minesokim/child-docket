-- Knowledge layer foundation — authorities + authority_chunks.
--
-- This is the substrate that grounds every agent answer. The IRC,
-- Treasury Regs, IRS Pubs, FTB pubs, firm playbooks all land here.
-- Per CEO plan D14 — `authorities` is the core knowledge-layer table
-- with effective-date versioning + supersession.
--
-- D12 retrieval architecture (decided 2026-05-02):
--   - chunk-level retrieval (~512 tokens) with hierarchical metadata
--   - hybrid search: BM25 (Postgres tsvector) + cosine (pgvector) +
--     reranker step
--   - Voyage AI `voyage-3-lite` embeddings (1024 dims)
--   - <500ms latency target at p95
--
-- This migration lays the table foundation. Embedding column +
-- HNSW index ship in a follow-up migration once Voyage is wired
-- (separate workstream — content ingestion).
--
-- TENANT SCOPING
--   tenant_id IS NULL  → global authority (IRS Pub 17, IRC §61, etc.)
--   tenant_id NOT NULL → firm-internal (playbook, memo, template)
--
-- RLS allows reading globals + own-tenant rows; writes require explicit
-- tenant scope (no cross-tenant overrides). The chunks table mirrors
-- its parent's tenant_id via trigger so RLS predicates don't pay a
-- join-cost on every retrieval query.

-- ──────────────────────────────────────────────────────────────
-- pgvector extension. Reserved for the embedding column added in
-- a later migration. Idempotent. Neon supports pgvector natively;
-- if this CREATE EXTENSION fails, enable it via Neon console under
-- the project's Extensions tab and re-run.
-- ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ──────────────────────────────────────────────────────────────
-- Enums.
-- ──────────────────────────────────────────────────────────────

-- The TYPE of source. Not the jurisdiction — that's a separate axis.
-- Coverage spans federal IRS + CA-state authorities + firm-internal
-- playbooks + tax court opinions. Add more as the knowledge layer
-- expands; new enum values are an ALTER TYPE migration.
CREATE TYPE authority_kind AS ENUM (
  'irc',                -- Internal Revenue Code section
  'treas_reg',          -- Treasury Regulation
  'irs_pub',            -- IRS Publication (Pub 17, Pub 535, ...)
  'irs_form',           -- IRS Form / Instructions
  'irs_irm',            -- Internal Revenue Manual
  'irs_irb',            -- Internal Revenue Bulletin
  'irs_notice',         -- IRS Notice
  'irs_revrul',         -- Revenue Ruling
  'irs_revproc',        -- Revenue Procedure
  'tax_court',          -- Tax Court opinion
  'ca_ftb_pub',         -- CA Franchise Tax Board publication
  'ca_ftb_legal',       -- CA FTB Legal Ruling
  'ca_ftb_form',        -- CA FTB Form / Instructions
  'cdtfa',              -- CA Dept of Tax & Fee Admin (sales/use)
  'edd',                -- CA Employment Development Dept (payroll)
  'firm_playbook',      -- Firm-internal playbook
  'firm_memo',          -- Firm-internal memo
  'firm_template'       -- Firm-internal template (engagement letter ...)
);

-- Where does this authority apply? "firm" is for firm-internal
-- documents (playbooks scoped to a tenant). Add more states as we
-- expand beyond CA.
CREATE TYPE authority_jurisdiction AS ENUM (
  'federal',
  'CA',
  'firm'
);

-- ──────────────────────────────────────────────────────────────
-- authorities — the unit of citation.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS authorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NULL = global (every tenant sees it). Tenant-scoped for firm
  -- internal docs.
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,

  kind authority_kind NOT NULL,
  jurisdiction authority_jurisdiction NOT NULL,

  -- The form most preparers recognize. Drives display + citation
  -- string formatting. Examples:
  --   "IRS Pub 17 (2024)"
  --   "IRC §61(a)(1)"
  --   "Treas. Reg. §1.61-2(a)(1)"
  --   "FTB Pub 1031 (2024)"
  --   "Vazant playbook: §83(b) elections"
  citation_label text NOT NULL,

  -- Full title for detail panels.
  title text NOT NULL,

  -- Stable URL slug for routing inside Docket. Globally unique
  -- among global authorities; tenant-scoped uniqueness for firm
  -- authorities (see partial indexes below).
  slug text NOT NULL,

  -- Canonical external URL (irs.gov, ftb.ca.gov, ...). NULL for
  -- firm authorities.
  external_url text,

  -- Where we ingested from (could be the same as external_url,
  -- could be R2 key for archived PDFs).
  source_uri text,

  -- ─── Effective-date model ───
  -- Required: when this authority TAKES effect. For year-versioned
  -- pubs (Pub 17 (2024)), use the start of that tax year.
  effective_date date NOT NULL,

  -- When this authority was retired / replaced. NULL = still in
  -- effect.
  superseded_date date,

  -- FK to the replacement authority (Pub 17 (2024) supersedes
  -- Pub 17 (2023)). NULL if no replacement exists yet.
  superseded_by_id uuid REFERENCES authorities(id) ON DELETE SET NULL,

  -- Tax year(s) this authority applies to. For Pub 17 (2024), [2024].
  -- For evergreen authorities (the IRC), [] (empty).
  applicable_tax_years int[] NOT NULL DEFAULT '{}',

  -- ─── Change detection ───
  -- Sha256 of normalized full text. On re-ingestion, a hash mismatch
  -- triggers re-chunking + re-embedding.
  content_hash text,

  -- Free-form metadata (publication date, IRC section number,
  -- pinned IRS publication number, ...).
  metadata jsonb NOT NULL DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A NULL tenant_id means the authority is global. We want unique
-- slugs in the global namespace, but firm-scoped slugs only need to
-- be unique per firm. Two partial indexes get us both.
CREATE UNIQUE INDEX IF NOT EXISTS authorities_global_slug_uniq
  ON authorities(slug) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS authorities_tenant_slug_uniq
  ON authorities(tenant_id, slug) WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS authorities_tenant_idx
  ON authorities(tenant_id);
CREATE INDEX IF NOT EXISTS authorities_kind_idx
  ON authorities(kind);
CREATE INDEX IF NOT EXISTS authorities_jurisdiction_idx
  ON authorities(jurisdiction);
CREATE INDEX IF NOT EXISTS authorities_effective_date_idx
  ON authorities(effective_date);
-- GIN on the int[] tax-year array — lets retrieval queries filter
-- by "applicable to tax year 2024" using the && operator efficiently.
CREATE INDEX IF NOT EXISTS authorities_tax_years_gin_idx
  ON authorities USING GIN(applicable_tax_years);

-- RLS. Globals (tenant_id IS NULL) are visible to every tenant.
-- Firm authorities are scoped to current_tenant_id. Same shape on
-- USING + WITH CHECK so writes can't escape the tenant scope.
ALTER TABLE authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorities FORCE ROW LEVEL SECURITY;
CREATE POLICY authorities_isolation ON authorities
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = current_tenant_id());

-- ──────────────────────────────────────────────────────────────
-- authority_chunks — chunked content for retrieval.
--
-- One row per ~512-token chunk. The chunk is what an agent retrieves
-- and cites; the parent authority gives the legal weight + effective
-- dates.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS authority_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  authority_id uuid NOT NULL REFERENCES authorities(id) ON DELETE CASCADE,

  -- Mirror of authorities.tenant_id. Denormalized so RLS predicates
  -- avoid a join on every retrieval query. Set by the BEFORE INSERT
  -- trigger below — application code does not write to this column.
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,

  -- Position within the parent authority. 0-indexed.
  ordinal int NOT NULL,

  -- Hierarchical breadcrumb: ["Part 2", "Chapter 5", "§5.1"] for
  -- IRS pubs, ["§61", "(a)", "(1)"] for IRC. Preserves the
  -- citation depth so we can render "§61(a)(1)" from the path.
  section_path text[] NOT NULL DEFAULT '{}',

  -- Display-friendly anchor ("§5.1: Earned income"). Optional —
  -- ingestion code derives it from section_path when set.
  heading text,

  -- The chunk text itself. Stored verbatim — no whitespace
  -- normalization, no preprocessing — so highlighting maps cleanly
  -- to the source document.
  text text NOT NULL,

  -- Char positions in the original source for highlight rendering
  -- (when source_uri points at a PDF or HTML doc Antonio can open).
  char_start int,
  char_end int,

  -- Sha256 of `text` for dedup + change detection during re-ingestion.
  content_hash text NOT NULL,

  -- Generated full-text search vector. STORED so reads don't recompute.
  -- Used as the BM25 substrate via to_tsquery + ts_rank in the
  -- retrieval layer.
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,

  -- ─── Embedding column reserved for follow-up migration ───
  -- Voyage `voyage-3-lite` is 1024 dims per D12. Add the column +
  -- HNSW index when the ingestion pipeline + embed-on-insert hook
  -- are in place. Until then, retrieval falls back to BM25-only.
  -- embedding vector(1024),

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS authority_chunks_authority_idx
  ON authority_chunks(authority_id);
CREATE UNIQUE INDEX IF NOT EXISTS authority_chunks_authority_ordinal_uniq
  ON authority_chunks(authority_id, ordinal);
CREATE INDEX IF NOT EXISTS authority_chunks_tenant_idx
  ON authority_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS authority_chunks_tsv_idx
  ON authority_chunks USING GIN(tsv);

-- Mirror parent's tenant_id at insert time. Catches application bugs
-- where the chunk's tenant_id wouldn't match its authority. Triggers
-- on BEFORE INSERT so the tenant_id on the row is always the authoritative
-- copy from `authorities`.
CREATE OR REPLACE FUNCTION enforce_authority_chunks_tenant()
RETURNS TRIGGER AS $$
BEGIN
  SELECT tenant_id INTO NEW.tenant_id
    FROM authorities
   WHERE id = NEW.authority_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS authority_chunks_set_tenant ON authority_chunks;
CREATE TRIGGER authority_chunks_set_tenant
  BEFORE INSERT ON authority_chunks
  FOR EACH ROW EXECUTE FUNCTION enforce_authority_chunks_tenant();

-- RLS — same global-or-own-tenant pattern as authorities.
ALTER TABLE authority_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE authority_chunks FORCE ROW LEVEL SECURITY;
CREATE POLICY authority_chunks_isolation ON authority_chunks
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id())
  WITH CHECK (tenant_id IS NULL OR tenant_id = current_tenant_id());
