-- Cryptographic chaining on the actions audit log.
--
-- Per docs/PRODUCTION-READINESS.md §B (V1) — "Audit trail with
-- cryptographic chaining."
--
-- WHY THIS EXISTS
--   Migration 0007 already enforces append-only at the trigger level
--   (UPDATE, DELETE, TRUNCATE all blocked, with one carve-out from
--   migration 0012 for FK-cascade SET NULL on client_id). That defends
--   against the `docket_app` role tampering with history.
--
--   This migration adds the SECOND layer: even a Postgres superuser
--   who drops the no-update trigger and modifies a row gets caught,
--   because every row's hash binds it to the prior row's hash. A
--   single byte changed anywhere in the chain breaks every subsequent
--   row's hash, and the verification function returns the first
--   tampered row.
--
--   Marketing handle in PRODUCTION-READINESS §I:
--     "Docket is the tax AI where every action is reversible and
--      audit-defensible. The only one."
--
-- DESIGN
--   chain_seq bigint — monotonic per-tenant sequence assigned by the
--     trigger under the per-tenant advisory lock. Defines chain order
--     unambiguously regardless of clock skew or transaction commit
--     order. This replaces the (created_at, id) sort that the first
--     draft of this migration used; codex review HIGH on the first
--     pass surfaced that two same-tenant transactions can produce
--     out-of-order created_at values even under the advisory lock.
--   prev_hash bytea — row_hash of the previous chain_seq for this
--     tenant. NULL for the chain root and for legacy pre-migration
--     rows.
--   row_hash bytea — sha256 of canonical jsonb representation
--     concatenated with prev_hash. NULL for legacy pre-migration
--     rows; trigger fills for every new INSERT.
--
--   Chain is PER-TENANT, not global. Every tenant gets its own chain.
--   Per-tenant is simpler to verify and avoids privacy leakage where
--   one tenant's hash depends on another's content.
--
-- CANONICALIZATION
--   Uses jsonb_build_array(...)::text. jsonb's text output is canonical
--   within a Postgres cluster (no whitespace, NULL distinct from empty
--   string, array order preserved). Postgres does not contractually
--   guarantee jsonb_out byte-stability across major PG versions; if
--   we upgrade Postgres major versions, we re-verify the chain on the
--   first nightly run post-upgrade and re-anchor if the format drifted.
--
--   Timestamps are pre-formatted to UTC with explicit format string so
--   the canonical form does not depend on the session's TimeZone GUC.
--   real/float columns are cast to numeric with explicit format string
--   so the canonical form does not depend on float text-formatting
--   behavior. cost_usd uses 6 fractional digits (microdollars); two
--   real-storage values that round identically at 6 decimals hash
--   identically. That precision is plenty for docket call costs
--   (typical: $0.0001 to $0.10 per call); if costs ever exceed $10k
--   per call we tighten the format string.
--
--   client_id is INTENTIONALLY EXCLUDED from the canonical hash.
--   Migration 0012 carved out an exception in the append-only trigger
--   to allow CCPA-compliant client deletions to NULL actions.client_id.
--   Including client_id in the hash would mean every legitimate client
--   delete invalidates the chain. Trade-off: an attacker could change
--   client_id without detection, but the only legal mutation is
--   non-NULL → NULL, and that mutation is logged at the application
--   layer (the action that NULL'd it gets its own chain entry).
--
-- CONCURRENCY
--   Two parallel INSERTs for the same tenant want the same prev_hash
--   and the same chain_seq + 1. Resolved via a transaction-scoped
--   advisory lock keyed by hashtext('actions_chain:' || tenant_id).
--   Inserts to different tenants don't contend.
--
-- LEGACY ROWS
--   Rows inserted before this migration have chain_seq + prev_hash +
--   row_hash all NULL. The chain starts from the first INSERT after
--   this migration applies. Verification function skips NULL-hash
--   rows.
--
-- VERIFICATION
--   verify_actions_chain(p_tenant_id uuid) walks the chain in
--   chain_seq order and returns the row id of the first mismatch
--   (NULL if intact). Run nightly via Inngest cron (services/workers/,
--   follow-up). Caller must have read access; admin verification
--   across tenants requires `app.bypass_rls = on`.
--
--   KNOWN GAP (suffix deletion): if the most recent rows are deleted,
--   the remaining prefix verifies cleanly. Detecting tail truncation
--   requires an external checkpoint of expected head hash + row count.
--   Tracked as v1.5 work — publish head hash + row count to R2
--   object-locked storage; verification compares.
--
-- EDGE CASES enumerated 2026-05-08 prior to authoring (15 across
-- input/state/failure/time/permission/domain). Codex review surfaced
-- three HIGH and two MEDIUM on the first pass; all addressed in this
-- final shape.

-- ──────────────────────────────────────────────────────────────
-- pgcrypto: needed for digest(text, 'sha256').
--
-- Idempotent. Neon supports pgcrypto natively; if this CREATE
-- EXTENSION fails, enable it via the Neon console under the
-- project's Extensions tab and re-run.
-- ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ──────────────────────────────────────────────────────────────
-- Chain columns. NULL on legacy rows; trigger fills for new rows.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE actions
  ADD COLUMN IF NOT EXISTS chain_seq bigint,
  ADD COLUMN IF NOT EXISTS prev_hash bytea,
  ADD COLUMN IF NOT EXISTS row_hash bytea;

-- One per tenant. Used by the trigger ("most recent prior chain_seq")
-- and by verify_actions_chain (ORDER BY chain_seq).
CREATE UNIQUE INDEX IF NOT EXISTS actions_tenant_chain_seq_uniq
  ON actions(tenant_id, chain_seq)
  WHERE chain_seq IS NOT NULL;

-- ──────────────────────────────────────────────────────────────
-- Canonical-form helper.
--
-- jsonb_build_array gives a deterministic text representation:
--   - NULL serializes as JSON null (distinct from "")
--   - whitespace is suppressed
--   - element order is preserved
--
-- Pre-formatting on the caller side handles session-dependent
-- conversions:
--   - timestamps: explicit UTC + format string
--   - real/float: cast to numeric with explicit format string
--
-- jsonb output format is stable within a Postgres cluster for the
-- shapes we use (no objects with conflicting key orderings; only
-- arrays of primitives + nested jsonb that are already canonical).
-- Cross-major-version guarantees are not contractual; verify on
-- first nightly run after a Postgres upgrade.
--
-- IMPORTANT: changing this function invalidates every existing chain.
-- New columns added to actions don't auto-flow into the hash; if a
-- new column should be chained, append it to the END of the array
-- (and run the same drop-trigger / backfill / recreate-trigger
-- migration pattern).
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION actions_canonical_for_hash(
  p_id uuid,
  p_tenant_id uuid,
  p_user_id uuid,
  p_agent_id text,
  p_action_class text,
  p_tool_name text,
  p_tool_input jsonb,
  p_tool_output jsonb,
  p_model_used text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cached_tokens integer,
  p_cost_usd real,
  p_latency_ms integer,
  p_success boolean,
  p_error_message text,
  p_created_at timestamptz,
  p_chain_seq bigint,
  p_prev_hash bytea
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_array(
    p_id::text,
    p_tenant_id::text,
    p_user_id::text,
    p_agent_id,
    p_action_class,
    p_tool_name,
    p_tool_input,
    p_tool_output,
    p_model_used,
    p_input_tokens,
    p_output_tokens,
    p_cached_tokens,
    -- to_char on numeric with explicit format. NULL stays NULL.
    CASE WHEN p_cost_usd IS NULL THEN NULL
         ELSE to_char(p_cost_usd::numeric, 'FM999999999990.000000') END,
    p_latency_ms,
    p_success,
    p_error_message,
    -- Explicit UTC + ISO-8601-ish format. Microsecond precision.
    -- TZ does not appear in the format string because we already
    -- converted to UTC.
    CASE WHEN p_created_at IS NULL THEN NULL
         ELSE to_char(p_created_at AT TIME ZONE 'UTC',
                      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') END,
    p_chain_seq,
    encode(p_prev_hash, 'hex')
  )::text;
$$;

-- ──────────────────────────────────────────────────────────────
-- BEFORE INSERT trigger: assign chain_seq + fill prev_hash + row_hash.
--
-- Steps:
--   1. Acquire per-tenant advisory lock (txn-scoped).
--   2. SELECT max(chain_seq), prev row's row_hash for this tenant.
--   3. NEW.chain_seq = max + 1 (or 1 for first row of tenant).
--   4. NEW.prev_hash = prev row's row_hash (or NULL for chain root).
--   5. NEW.row_hash = sha256(canonical(NEW.* including NEW.chain_seq +
--      NEW.prev_hash)).
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_actions_chain()
RETURNS trigger AS $$
DECLARE
  v_lock_key bigint;
  v_prev_seq bigint;
  v_prev_hash bytea;
  v_canon text;
BEGIN
  v_lock_key := hashtext('actions_chain:' || NEW.tenant_id::text)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Most recent chain_seq + row_hash for this tenant. Skips legacy
  -- rows where chain_seq IS NULL.
  SELECT chain_seq, row_hash
    INTO v_prev_seq, v_prev_hash
    FROM actions
   WHERE tenant_id = NEW.tenant_id
     AND chain_seq IS NOT NULL
   ORDER BY chain_seq DESC
   LIMIT 1;

  NEW.chain_seq := COALESCE(v_prev_seq, 0) + 1;
  NEW.prev_hash := v_prev_hash;

  v_canon := actions_canonical_for_hash(
    NEW.id, NEW.tenant_id, NEW.user_id,
    NEW.agent_id, NEW.action_class::text, NEW.tool_name,
    NEW.tool_input, NEW.tool_output, NEW.model_used::text,
    NEW.input_tokens, NEW.output_tokens, NEW.cached_tokens,
    NEW.cost_usd, NEW.latency_ms, NEW.success, NEW.error_message,
    NEW.created_at, NEW.chain_seq, v_prev_hash
  );

  NEW.row_hash := digest(v_canon, 'sha256');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS actions_set_chain ON actions;
CREATE TRIGGER actions_set_chain
  BEFORE INSERT ON actions
  FOR EACH ROW EXECUTE FUNCTION enforce_actions_chain();

COMMENT ON FUNCTION enforce_actions_chain() IS
  'Per-tenant cryptographic chain on actions. Pairs with migration 0007 append-only triggers.';

-- ──────────────────────────────────────────────────────────────
-- Verification function.
--
-- Walks the chain for one tenant in chain_seq order, recomputes
-- each row's row_hash, returns the id of the first row whose stored
-- row_hash does NOT match the recomputation. Returns NULL if the
-- chain is intact (or if the tenant has zero chained rows).
--
-- Skips legacy rows (chain_seq IS NULL).
--
-- KNOWN GAP: suffix deletion. If the most recent rows are deleted,
-- the remaining prefix verifies cleanly. v1.5 publishes head hash +
-- row count to an external append-only store; verification compares.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION verify_actions_chain(p_tenant_id uuid)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_row record;
  v_expected_prev bytea := NULL;
  v_expected_seq bigint := 0;
  v_recomputed bytea;
  v_canon text;
BEGIN
  FOR v_row IN
    SELECT id, tenant_id, user_id, agent_id,
           action_class::text AS action_class,
           tool_name, tool_input, tool_output,
           model_used::text AS model_used,
           input_tokens, output_tokens, cached_tokens,
           cost_usd, latency_ms, success, error_message,
           created_at, chain_seq, prev_hash, row_hash
      FROM actions
     WHERE tenant_id = p_tenant_id
       AND chain_seq IS NOT NULL
     ORDER BY chain_seq ASC
  LOOP
    v_expected_seq := v_expected_seq + 1;

    -- chain_seq must be contiguous starting from 1.
    IF v_row.chain_seq <> v_expected_seq THEN
      RETURN v_row.id;
    END IF;

    -- prev_hash must equal previous iteration's row_hash (NULL at root).
    IF v_row.prev_hash IS DISTINCT FROM v_expected_prev THEN
      RETURN v_row.id;
    END IF;

    v_canon := actions_canonical_for_hash(
      v_row.id, v_row.tenant_id, v_row.user_id,
      v_row.agent_id, v_row.action_class, v_row.tool_name,
      v_row.tool_input, v_row.tool_output, v_row.model_used,
      v_row.input_tokens, v_row.output_tokens, v_row.cached_tokens,
      v_row.cost_usd, v_row.latency_ms, v_row.success,
      v_row.error_message, v_row.created_at,
      v_row.chain_seq, v_row.prev_hash
    );

    v_recomputed := digest(v_canon, 'sha256');

    IF v_recomputed IS DISTINCT FROM v_row.row_hash THEN
      RETURN v_row.id;
    END IF;

    v_expected_prev := v_row.row_hash;
  END LOOP;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION verify_actions_chain(uuid) IS
  'Walks one tenant''s actions chain; returns id of first mismatched row, or NULL if intact. Run nightly.';
