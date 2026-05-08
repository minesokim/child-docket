-- Client facts — atomic facts extracted from narratives.
--
-- Per docs/MEMORY-ARCHITECTURE.md §2 + §5.C. The fact-extraction
-- mechanism that turns "Maria mentioned in March that her home
-- office is approximately 12% of her home..." into queryable
-- structured rows: { fact_key='home_office_pct', fact_value=12,
-- tier='client_assertion', confidence=0.9 }. Discovery agent reads
-- these instead of re-parsing the source narrative on every call —
-- 100x faster, 50x cheaper, more accurate (explicit confidence +
-- source).
--
-- TEMPORAL LOG, NOT MUTATION
--   Facts are append-mostly. Maria's primary_residence_state was 'CA'
--   in 2024, then 'TX' in 2025. Both rows exist. The 2024 row's
--   superseded_by points at the 2025 row. Year-tagged retrieval gives
--   correct year context; the chain shows the life-event timeline.
--
--   Two unsuperseded rows for the same (client, fact_key, tax_year)
--   represents an UNRESOLVED CONFLICT. Per MEMORY-ARCHITECTURE §8
--   ("Conflict detection"), the Discovery agent surfaces this to
--   Antonio for resolution rather than silently picking one. The
--   schema represents this; the resolution is application-layer.
--
-- CROSS-TENANT FK GUARANTEE (codex HIGH on initial review, fixed here)
--   The naive shape (tenant_id + client_id as independent FKs to
--   tenants + clients) leaks across tenants when an app bug writes
--   tenant_A's tenant_id with tenant_B's client_id. RLS on
--   client_facts.tenant_id alone won't catch it; FK validation runs
--   RLS-bypass.
--
--   Fixed via composite FK: (tenant_id, client_id) REFERENCES
--   clients(tenant_id, id). Requires UNIQUE(tenant_id, id) on the
--   parent. Same approach for source_action_id via a tenant-validation
--   trigger (composite FK can't express ON DELETE SET NULL on a
--   single column without nulling the rest). Same for the supersession
--   chain via the same trigger (must match tenant + client + fact_key).
--
-- DELETION SEMANTICS
--   (tenant_id, client_id) → clients(tenant_id, id) ON DELETE CASCADE.
--     Facts are derived data — they ARE client PII (or PII-adjacent),
--     not audit trail. CCPA right-to-delete must remove them. The
--     audit trail of WHAT THE AI DID with those facts lives in
--     `actions` (append-only via trigger; tenant_id retained even
--     after client_id is null'd via migration 0008).
--   Tenant deletion still cascades transitively: tenants → clients
--     → client_facts.
--   source_action_id is single-column FK ON DELETE SET NULL. Defensive
--     — actions is append-only by trigger (migration 0007), so this
--     should never fire. Tenant integrity is enforced by the trigger
--     below.
--   superseded_by is single-column self-FK ON DELETE SET NULL. Chain-
--     integrity (same tenant + client + fact_key) is enforced by the
--     trigger below.
--
-- WHY NOT ENUM ON source_tier?
--   Free-form text matches the messages.channel + messages.direction
--   convention used elsewhere. Adding an enum locks in a value set
--   that may need to grow (computed-from-bookkeeping is a likely
--   next addition). Documented values:
--     'client_assertion'  — taxpayer said it (highest velocity, lower fidelity)
--     'third_party_doc'   — W-2, 1099, K-1, brokerage statement
--     'irs_transcript'    — pulled from IRS Solutions / transcripts
--     'computed'          — derived from other facts (e.g., AGI from W-2 + 1099)
--     'firm_correction'   — Antonio overrode an extracted fact

-- ──────────────────────────────────────────────────────────────
-- Prerequisite: composite FK targets on parent tables.
--
-- A composite FK like (tenant_id, client_id) -> clients(tenant_id, id)
-- requires a UNIQUE constraint on the target columns. clients.id is
-- already PK (unique), so adding (tenant_id, id) UNIQUE is redundant
-- but explicit. Same for actions.
--
-- Idempotent via DO-block guards because Postgres ADD CONSTRAINT does
-- not support IF NOT EXISTS.
-- ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clients_tenant_id_id_uniq'
  ) THEN
    ALTER TABLE clients
      ADD CONSTRAINT clients_tenant_id_id_uniq UNIQUE (tenant_id, id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'actions_tenant_id_id_uniq'
  ) THEN
    ALTER TABLE actions
      ADD CONSTRAINT actions_tenant_id_id_uniq UNIQUE (tenant_id, id);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────
-- client_facts — one row per fact observation.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- tenant_id has its own FK to tenants for join-friendliness; the
  -- composite FK below also enforces tenant existence transitively
  -- through clients. Both are correct; both are kept.
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,

  -- Composite FK: (tenant_id, client_id) MUST exist as a row in
  -- clients. Cross-tenant client binding is impossible at the DB
  -- layer.
  CONSTRAINT client_facts_tenant_client_fk
    FOREIGN KEY (tenant_id, client_id)
    REFERENCES clients(tenant_id, id)
    ON DELETE CASCADE,

  -- Snake_case fact key. Examples:
  --   'home_office_pct', 'primary_residence_state', 'filing_status',
  --   'spouse_employer_ein', 'dependent_count', 'business_entity_type'
  -- Free-form by design; the universe of fact types grows over time.
  -- Application code maintains the canonical fact-key registry +
  -- value schema.
  fact_key text NOT NULL,

  -- The value itself. Shape varies by fact_key:
  --   home_office_pct        → number  (12)
  --   primary_residence      → string  ("CA")
  --   filing_status          → string  ("MFJ")
  --   dependent_count        → number  (2)
  -- App-side validation per fact_key.
  fact_value jsonb NOT NULL,

  -- Year-tagged. CA-resident in tax year 2024 vs TX-resident in 2025
  -- are distinct facts, both kept. CHECK keeps it sane (post-1999,
  -- pre-2100). Tightens if obvious junk gets in.
  tax_year integer NOT NULL,
  CONSTRAINT client_facts_tax_year_range
    CHECK (tax_year >= 2000 AND tax_year <= 2100),

  -- Where this fact came from. SET NULL on delete (defensive — actions
  -- is append-only by trigger).
  source_action_id uuid REFERENCES actions(id) ON DELETE SET NULL,

  -- Source authority. Docstring above on why this isn't an enum.
  source_tier text NOT NULL,

  -- 0..1 confidence at extraction time. Aggregated from extraction
  -- model logprobs + source-tier weight + cross-source corroboration.
  confidence real NOT NULL DEFAULT 0.0,
  CONSTRAINT client_facts_confidence_range
    CHECK (confidence >= 0.0 AND confidence <= 1.0),

  observed_at timestamptz NOT NULL DEFAULT now(),

  -- Self-reference for the supersession chain. NULL = current fact;
  -- non-NULL = points at the row that replaced this one. Cycles are
  -- prevented by the application layer (no DB-level CHECK can cleanly
  -- prevent self-reference cycles).
  superseded_by uuid REFERENCES client_facts(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

-- Primary retrieval pattern: "give me the current value of fact_key
-- for client X, tax year Y." Index covers it.
CREATE INDEX IF NOT EXISTS client_facts_client_key_year_idx
  ON client_facts(tenant_id, client_id, fact_key, tax_year);

-- Find currently-active facts for a client at a given year (where
-- superseded_by IS NULL). Partial index includes tax_year so the
-- "current value of fact_key for client X tax year Y" predicate
-- hits a tight index lookup.
CREATE INDEX IF NOT EXISTS client_facts_active_idx
  ON client_facts(tenant_id, client_id, fact_key, tax_year)
  WHERE superseded_by IS NULL;

CREATE INDEX IF NOT EXISTS client_facts_observed_idx
  ON client_facts(tenant_id, observed_at);

-- ──────────────────────────────────────────────────────────────
-- Trigger: enforce same-tenant binding on source_action_id, and
-- same-(tenant, client, fact_key) chain on superseded_by.
--
-- Both invariants need a trigger because:
--   - source_action_id wants ON DELETE SET NULL; multi-column FK with
--     SET NULL would null the entire FK tuple including tenant_id /
--     client_id, which are NOT NULL.
--   - superseded_by chain integrity is across 4 columns (tenant,
--     client, fact_key, id); a multi-col FK with ON DELETE SET NULL
--     has the same problem.
--
-- Fires BEFORE INSERT OR UPDATE so bad rows never land. Tested
-- against codex HIGH severity finding on the initial 0021 review.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_client_facts_bindings()
RETURNS TRIGGER AS $$
DECLARE
  v_action_tenant uuid;
  v_super_tenant  uuid;
  v_super_client  uuid;
  v_super_factkey text;
BEGIN
  -- source_action_id must reference an action in the same tenant.
  IF NEW.source_action_id IS NOT NULL THEN
    SELECT tenant_id INTO v_action_tenant
      FROM actions
     WHERE id = NEW.source_action_id;

    IF v_action_tenant IS NULL THEN
      RAISE EXCEPTION
        'client_facts.source_action_id % does not exist',
        NEW.source_action_id;
    END IF;

    IF v_action_tenant <> NEW.tenant_id THEN
      RAISE EXCEPTION
        'client_facts.source_action_id % belongs to tenant %, not %',
        NEW.source_action_id, v_action_tenant, NEW.tenant_id;
    END IF;
  END IF;

  -- superseded_by must point at a fact in the same (tenant, client, fact_key).
  IF NEW.superseded_by IS NOT NULL THEN
    SELECT tenant_id, client_id, fact_key
      INTO v_super_tenant, v_super_client, v_super_factkey
      FROM client_facts
     WHERE id = NEW.superseded_by;

    IF v_super_tenant IS NULL THEN
      RAISE EXCEPTION
        'client_facts.superseded_by % does not exist',
        NEW.superseded_by;
    END IF;

    IF v_super_tenant <> NEW.tenant_id
       OR v_super_client <> NEW.client_id
       OR v_super_factkey <> NEW.fact_key THEN
      RAISE EXCEPTION
        'client_facts.superseded_by % is for (% / % / %) not (% / % / %)',
        NEW.superseded_by,
        v_super_tenant, v_super_client, v_super_factkey,
        NEW.tenant_id, NEW.client_id, NEW.fact_key;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_facts_enforce_bindings ON client_facts;
CREATE TRIGGER client_facts_enforce_bindings
  BEFORE INSERT OR UPDATE ON client_facts
  FOR EACH ROW EXECUTE FUNCTION enforce_client_facts_bindings();

-- RLS — strict tenant isolation. No global facts. Composite FK above
-- is the second layer (cross-tenant client binding is FK-impossible).
ALTER TABLE client_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_facts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_client_facts ON client_facts
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
