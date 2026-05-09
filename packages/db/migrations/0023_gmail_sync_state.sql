-- gmail_sync_state — per-tenant Gmail polling cursor.
--
-- Stores the historyId we've consumed up through for each tenant. The
-- gmail-poll Inngest cron reads this to know where to resume; updates
-- it after a successful fetch + event-fan-out cycle.
--
-- Per-tenant single row. Tenant deletion cascades. RLS-bound.
--
-- Why a dedicated table (vs adding columns to tenant_credentials):
--   1. Sync state is not a secret; tenant_credentials.data is encrypted
--      blob and we don't want to mix sync metadata with rotation
--      metadata.
--   2. Sync state changes every poll cycle (every 10 min); credentials
--      change rarely (manual rotation). Decoupling avoids fighting the
--      tenant_credentials.rotated_at semantic.
--   3. Future integrations (Outlook, Dropbox webhooks, etc.) get the
--      same sync-state pattern as a separate table per provider.

CREATE TABLE IF NOT EXISTS gmail_sync_state (
  tenant_id            uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  -- Gmail's history cursor. Per Gmail API docs, history records have
  -- ~7-day TTL — if our cursor falls outside that window the next
  -- history.list returns 404 and we have to bootstrap from the current
  -- historyId via getProfile (see gmail.ts gmailHistoryListSafe).
  last_history_id      text,
  -- The wall-clock time of the last successful poll. Used by the
  -- /api/health probe + cost dashboard to surface stale tenants.
  last_polled_at       timestamptz,
  -- The wall-clock time the cursor itself was last advanced (i.e.
  -- new messages were observed). Distinct from last_polled_at
  -- because most polls return zero new messages.
  last_advanced_at     timestamptz,
  -- Count of messages classified to date. Cheap counter for the
  -- dashboard. Not a source of truth (gmail_threads is); just a
  -- summary for Antonio.
  total_classified     integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gmail_sync_state_polled_idx
  ON gmail_sync_state (last_polled_at);

-- RLS: app-side reads through withTenant set app.current_tenant_id;
-- ENABLE + FORCE so even table-owner queries route through the policy.
ALTER TABLE gmail_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_sync_state FORCE ROW LEVEL SECURITY;

CREATE POLICY gmail_sync_state_tenant_isolation
  ON gmail_sync_state
  USING (tenant_id::text = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id::text = current_setting('app.current_tenant_id', true));

-- Bypass policy for admin scripts (smokes, install-*) that use
-- app.bypass_rls = on. Same pattern as other tenant-scoped tables.
CREATE POLICY gmail_sync_state_bypass
  ON gmail_sync_state
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

-- updated_at auto-bump. Same pattern other tables use.
CREATE OR REPLACE FUNCTION gmail_sync_state_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER gmail_sync_state_touch_updated_at
  BEFORE UPDATE ON gmail_sync_state
  FOR EACH ROW
  EXECUTE FUNCTION gmail_sync_state_touch_updated_at();
