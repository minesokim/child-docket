-- Pattern memory — cross-client aggregates per firm.
--
-- Per docs/MEMORY-ARCHITECTURE.md §2 + §7.C. One row per
-- (tenant_id, pattern_type, pattern_key). The "examiner.glendale.
-- mike_chen accepts first-time-abatement 87% of the time" kind of
-- knowledge. Background nightly job populates these aggregates from
-- the actions table + signatures table + outcomes.
--
-- WHY THIS TABLE EXISTS
--   Pattern layer outputs FEED specialist agents:
--     - Discovery: "Coworking-charge classifies as home-office 87% of
--       Antonio's time; surface aggressively"
--     - Inbox drafter: "Antonio's median response on payment-q is
--       2 hours; queue draft to match cadence"
--     - Position: "Antonio's Tier-3 disclosure rate is 35%, within
--       firm-norm; no alert"
--   This is the difference between a generic AI assistant and one
--   that actually learned this firm's habits.
--
-- WRITE CADENCE
--   Nightly background job (replaces stale rows). UPSERT pattern via
--   the unique key (tenant_id, pattern_type, pattern_key). Caller
--   updates pattern_value + observation_count + last_observed_at +
--   confidence in one statement.
--
-- PRIVACY
--   This table is firm-aggregate only. Cross-firm aggregation is a
--   v2 feature (MEMORY-ARCHITECTURE §8) and will go through a
--   differential-privacy layer. At v1, every row stays inside the
--   firm via RLS.
--
--   When the UI surfaces pattern data ("8 of your clients have X
--   anomaly"), the application MUST anonymize client identity in
--   that surface. Schema can't enforce this — it's a code-review
--   discipline (POSITION-FRAMEWORK §6 calls out the same constraint).

-- ──────────────────────────────────────────────────────────────
-- firm_patterns — one row per (tenant, pattern_type, pattern_key).
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS firm_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Coarse type — drives which agent reads the row + how the value
  -- is interpreted. Free-form text by design; v1 set:
  --   'examiner_response'        e.g., per-IRS-examiner accept rate
  --   'deduction_hit_rate'       e.g., Antonio's accept rate per position
  --   'client_segment_metric'    e.g., margin per client segment
  --   'response_cadence_global'  firm-wide channel response medians
  -- New types are app-layer additions; no schema change.
  pattern_type text NOT NULL,

  -- Specific key inside the type. Examples:
  --   pattern_type='examiner_response', pattern_key='examiner.glendale.mike_chen'
  --   pattern_type='deduction_hit_rate', pattern_key='augusta_rule'
  pattern_key text NOT NULL,

  -- The aggregate itself. Shape varies by pattern_type. Documented
  -- in services/workers/src/agents/pattern-aggregator.ts (TBD).
  pattern_value jsonb NOT NULL DEFAULT '{}',

  -- How many data points support this aggregate. Used by the agent
  -- when deciding whether to trust the pattern. <10 → mention as
  -- weak signal; ≥30 → use confidently.
  observation_count integer NOT NULL DEFAULT 0,

  -- When the most recent observation was. Drives staleness checks
  -- ("haven't seen this examiner in 6 months — mark stale").
  last_observed_at timestamptz NOT NULL DEFAULT now(),

  -- 0..1 confidence assigned by the aggregator. CHECK enforced.
  confidence real NOT NULL DEFAULT 0.0,
  CONSTRAINT firm_patterns_confidence_range
    CHECK (confidence >= 0.0 AND confidence <= 1.0),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per (tenant, type, key). UPSERT target.
CREATE UNIQUE INDEX IF NOT EXISTS firm_patterns_tenant_type_key_uniq
  ON firm_patterns(tenant_id, pattern_type, pattern_key);

CREATE INDEX IF NOT EXISTS firm_patterns_tenant_type_idx
  ON firm_patterns(tenant_id, pattern_type);
CREATE INDEX IF NOT EXISTS firm_patterns_last_observed_idx
  ON firm_patterns(tenant_id, last_observed_at);

-- RLS — strict tenant isolation. No global rows here (unlike
-- authority_chunks); every pattern is firm-specific.
ALTER TABLE firm_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_patterns FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_firm_patterns ON firm_patterns
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
