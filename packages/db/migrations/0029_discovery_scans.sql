-- Migration 0029 — discovery_scans table.
--
-- One row per Discovery Scan deliverable (the marketing artifact
-- shipped to a firm via the C9 composeDiscoveryScan flow + C10
-- @docket/email delivery). Tracks the full lifecycle from rendered
-- → delivered → opened → downloaded so Antonio's outreach has an
-- audit trail of what was sent, to whom, and what happened after.
--
-- This is NOT the cryptographic actions audit chain (that's the
-- `actions` table). discovery_scans tracks DELIVERABLE state, not
-- agent-action state. The agent run that produced the scan is
-- already audited via actions; this row links the delivery layer
-- to that audit chain via `actions_row_id` (the Discovery agent
-- action that produced the underlying DiscoveryOutput).
--
-- SCHEMA
--   id                 — primary key (ulid-shaped uuid)
--   tenant_id          — RLS scope
--   client_id          — optional. NULL for prospect-only scans
--                        delivered before a client record exists
--                        (the common case for cold-outreach Discovery
--                        Scans per DESIGN-PARTNER-ACQUISITION-PLAN)
--   actions_row_id     — FK to the actions row that produced the
--                        agent output (or NULL if the scan ran
--                        outside the audit chain, e.g. evals)
--   storage_key        — R2 key for the PDF (discovery-scans/<tenant>/<ulid>.pdf)
--   pdf_bytes          — size in bytes for cost telemetry
--   recipient_email    — where it shipped
--   firm_name          — denormalized for retention/reporting
--                        (firms can churn; this preserves the name
--                         at delivery time)
--   tax_year           — TY scanned
--   total_surfaced_dollars — total deductions from the DiscoveryOutput
--   positions_count    — count of Tier 1-4 positions
--   refused_count      — count of below-Reasonable-Basis refusals
--   highest_tier       — 1-4; drives the trust-gate verdict
--   trust_gate_allowed — boolean from the trust-gate verdict
--   email_id           — Resend email ID (FK for webhook lookup)
--   status             — rendered | delivered | opened | downloaded
--                      | bounced | failed
--   sent_at            — when Resend acked the message
--   delivered_at       — when Resend webhook fired delivery
--   opened_at          — when Resend webhook fired open (if tracking)
--   downloaded_at      — when the signed-URL was first hit (set by
--                        a fetch handler we add later; NULL for now)
--   url_expires_at     — signed-URL TTL boundary
--   metadata           — jsonb scratch for future fields without
--                        another migration
--   created_at, updated_at

DO $$ BEGIN
  CREATE TYPE discovery_scan_status AS ENUM (
    'rendered',
    'delivered',
    'opened',
    'downloaded',
    'bounced',
    'failed'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS discovery_scans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  client_id uuid,
  actions_row_id uuid,
  storage_key text NOT NULL,
  pdf_bytes integer NOT NULL,
  recipient_email text NOT NULL,
  firm_name text NOT NULL,
  tax_year integer NOT NULL,
  total_surfaced_dollars integer NOT NULL DEFAULT 0,
  positions_count integer NOT NULL DEFAULT 0,
  refused_count integer NOT NULL DEFAULT 0,
  -- highest_tier is NULL for zero-position scans (return already
  -- tight — a valid Discovery Scan outcome per
  -- docs/DISCOVERY-SCAN-OPERATIONAL.md and the C10 email zero-position
  -- branch). When positions_count > 0 the tier MUST be 1-4. Cross-
  -- column CHECK enforces the invariant. Codex C11 R4 P1.
  --
  -- Named explicitly so the Drizzle schema's check() declaration
  -- can reference the same name in any future drizzle-kit-generated
  -- migration that wants to alter the rule (codex C11 R5 P2).
  highest_tier integer
    CONSTRAINT discovery_scans_highest_tier_range CHECK (
      (highest_tier IS NULL AND positions_count = 0)
      OR (highest_tier BETWEEN 1 AND 4 AND positions_count > 0)
    ),
  trust_gate_allowed boolean NOT NULL,
  email_id text,
  status discovery_scan_status NOT NULL DEFAULT 'rendered',
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  downloaded_at timestamptz,
  url_expires_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Composite FK to clients — enforces tenant consistency. A scan row
-- in tenant A can ONLY reference a clients row whose tenant_id is
-- also A. Without this, plain `REFERENCES clients(id)` would allow
-- cross-tenant binding because FK checks bypass RLS. Same pattern as
-- client_facts (migration 0021). Codex C11 R1 P2.
--
-- `ON DELETE SET NULL (client_id)` — column-specific SET NULL action
-- (Postgres 15+) is required because tenant_id is NOT NULL. A bare
-- SET NULL would try to null both FK columns (tenant_id AND
-- client_id), and Postgres would block the delete on the NOT NULL
-- constraint. The column-specific form leaves tenant_id intact and
-- only nulls client_id — which is what we want: when a client is
-- pruned, the scan-delivery audit row should survive with the firm
-- and scan content preserved (codex C11 R2 P1).
DO $$ BEGIN
  ALTER TABLE discovery_scans
    ADD CONSTRAINT discovery_scans_tenant_client_fk
    FOREIGN KEY (tenant_id, client_id)
    REFERENCES clients(tenant_id, id)
    ON DELETE SET NULL (client_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Composite FK to actions — same-tenant audit-chain link. A scan
-- row pointing at an audit-chain action from a different tenant
-- would silently corrupt the chain on join. Requires the
-- UNIQUE(tenant_id, id) constraint on actions added by 0021.
-- Same column-specific SET NULL rationale as above.
DO $$ BEGIN
  ALTER TABLE discovery_scans
    ADD CONSTRAINT discovery_scans_tenant_actions_fk
    FOREIGN KEY (tenant_id, actions_row_id)
    REFERENCES actions(tenant_id, id)
    ON DELETE SET NULL (actions_row_id);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Lookups
CREATE INDEX IF NOT EXISTS discovery_scans_tenant_idx
  ON discovery_scans(tenant_id);
CREATE INDEX IF NOT EXISTS discovery_scans_tenant_status_idx
  ON discovery_scans(tenant_id, status);
CREATE INDEX IF NOT EXISTS discovery_scans_tenant_created_at_idx
  ON discovery_scans(tenant_id, created_at DESC);
-- Resend webhook lookup is `WHERE email_id = $1`. UNIQUE partial
-- index on non-NULL values enforces one-row-per-Resend-message-ID:
-- without it, two rows sharing an email_id would let a single
-- delivery/open/bounce webhook mutate multiple scans (codex C11 R4
-- P2). UNIQUE also serves as the lookup index — no separate plain
-- index needed. NULL values are excluded so multiple unsent
-- (still-rendered, no email_id yet) rows are allowed.
DROP INDEX IF EXISTS discovery_scans_email_id_idx;
CREATE UNIQUE INDEX IF NOT EXISTS discovery_scans_email_id_uniq
  ON discovery_scans(email_id) WHERE email_id IS NOT NULL;

-- Child-side indexes for the composite FKs. Without these, every
-- DELETE on clients or actions falls back to a full table scan of
-- discovery_scans to find rows whose FK columns need nulling under
-- ON DELETE SET NULL (client_id / actions_row_id). At scale that
-- becomes a noticeable lock/perf problem on routine pruning
-- (codex C11 R6 P2). Partial WHERE clauses keep the indexes tight
-- — the vast majority of scans are prospect-only (client_id NULL)
-- and many run outside the audit chain (actions_row_id NULL).
CREATE INDEX IF NOT EXISTS discovery_scans_tenant_client_idx
  ON discovery_scans(tenant_id, client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS discovery_scans_tenant_actions_idx
  ON discovery_scans(tenant_id, actions_row_id) WHERE actions_row_id IS NOT NULL;

-- RLS — tenant scoping. Same pattern as the other tenant-scoped
-- tables (set app.current_tenant_id via withTenant; SELECT/INSERT/
-- UPDATE/DELETE all gated).
ALTER TABLE discovery_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_scans FORCE ROW LEVEL SECURITY;

-- Drop + recreate for idempotency. CREATE POLICY isn't IF-NOT-EXISTS
-- aware until Postgres 16+; DROP IF EXISTS is universally safe.
DROP POLICY IF EXISTS discovery_scans_tenant_isolation ON discovery_scans;
CREATE POLICY discovery_scans_tenant_isolation ON discovery_scans
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Webhook bypass policy — Resend delivery/open/bounce/etc. webhooks
-- arrive WITHOUT a tenant context. They look up scans by email_id
-- (globally unique), then resolve tenant_id from the row, then
-- update status. Without an explicit bypass policy, FORCE RLS would
-- block both the SELECT and the UPDATE, and every scan would stay
-- stuck at 'rendered'. Webhook handlers MUST set
--   SET LOCAL app.bypass_rls = 'on'
-- inside their transaction and verify Resend's signature first.
-- Same pattern used on payments + gmail_sync_state. Codex C11 P2.
DROP POLICY IF EXISTS discovery_scans_webhook_bypass ON discovery_scans;
CREATE POLICY discovery_scans_webhook_bypass
  ON discovery_scans
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

-- updated_at maintenance (matches other tables that need it).
-- Trigger fires on every UPDATE to bump the timestamp.
CREATE OR REPLACE FUNCTION discovery_scans_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS discovery_scans_updated_at ON discovery_scans;
CREATE TRIGGER discovery_scans_updated_at
  BEFORE UPDATE ON discovery_scans
  FOR EACH ROW
  EXECUTE FUNCTION discovery_scans_set_updated_at();
