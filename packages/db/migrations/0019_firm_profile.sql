-- Procedural memory — how this firm/EA works.
--
-- Per docs/MEMORY-ARCHITECTURE.md §2 + §4. ONE row per tenant. Captures
-- the slow-changing patterns that distinguish Antonio's firm from any
-- other: voice profile, position-tier preferences, response cadence by
-- channel + topic.
--
-- WHY THIS TABLE EXISTS
--   The context assembler (MEMORY-ARCHITECTURE §3) renders this table
--   into the STATIC PREFIX of every prompt — the cache-eligible
--   section. Anthropic prompt cache discount is 90%; without procedural
--   memory in the cache prefix, every call pays full token cost on
--   tokens that never change call-to-call. With it cached, the same
--   call drops from $0.30 to $0.05.
--
-- WRITE CADENCE
--   Background extraction job (weekly v1) updates the row from the past
--   week's sent comms + accepted/rejected positions. version monotonically
--   increments; prior_versions retains the last 5 jsonb snapshots for
--   rollback. App enforces the 5-row cap; schema can't cleanly bound
--   array length.
--
-- TENANT SCOPE
--   tenantId IS the PRIMARY KEY. Exactly one row per tenant. UPSERT
--   pattern: ON CONFLICT (tenant_id) DO UPDATE.
--
-- RLS — same shape as the rest of the schema. ENABLE + FORCE so even
-- table-owner roles get filtered. Service-role bypass requires
-- explicit `app.bypass_rls = on` per the existing pattern (admin/
-- migration code paths only).
--
-- Edge cases enumerated 2026-05-08 prior to authoring (per the
-- /edge-cases skill). Selected handling decisions captured below;
-- the full list lives in the commit message + AUTONOMOUS-DECISIONS.

-- ──────────────────────────────────────────────────────────────
-- firm_profile — one row per tenant.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS firm_profile (
  -- tenantId IS the PK. Exactly one row per tenant by construction.
  -- Cascades on tenant deletion (matches existing schema convention).
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,

  -- Voice profile. Tone descriptor is human-readable shorthand for
  -- prompt rendering ("warm-direct, prefers short sentences, uses
  -- 'I show' instead of 'you owe'"). Examples are 5-10 representative
  -- snippets of sent comms — fed to the inbox-drafter so output
  -- lands in firm voice.
  tone_descriptor text,
  voice_examples jsonb NOT NULL DEFAULT '[]',

  -- Per-position-type tier preferences. Map from position_key
  -- (e.g., 'augusta_rule', 'qbi_aggregation') to:
  --   { default_tier: 'reasonable_basis' | 'substantial' | ...,
  --     acceptance_rate: 0.0..1.0,
  --     last_observed_at: ISO8601 }
  -- Updated by the position-acceptance learning loop (§7.B in
  -- MEMORY-ARCHITECTURE).
  position_tier_preferences jsonb NOT NULL DEFAULT '{}',

  -- Channel + topic response cadence. Map from
  --   "{channel}.{topic}" -> { median_response_minutes, p90_minutes }
  -- Used by the inbox-drafter to queue sends matching the firm's
  -- natural rhythm rather than firing instantly (which reads as bot).
  response_cadence jsonb NOT NULL DEFAULT '{}',

  -- Monotonic version. Bumps each time the weekly extraction job
  -- writes a meaningful delta. App reads `version` for cache-key
  -- invalidation when assembling the static prefix.
  version integer NOT NULL DEFAULT 1,

  -- Last 5 snapshots, [{ version, snapshot, replaced_at }]. App
  -- trims to 5 on write. Enables rollback when an extraction job
  -- mis-learns ("Antonio doesn't actually want that softer phrasing").
  prior_versions jsonb NOT NULL DEFAULT '[]',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS firm_profile_updated_idx
  ON firm_profile(updated_at);

-- RLS — single tenant per row, hard isolation.
ALTER TABLE firm_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_profile FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_firm_profile ON firm_profile
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
