-- Row-Level Security (RLS) policies for multi-tenant isolation.
--
-- Pattern: every tenant-scoped table has tenant_id NOT NULL. The orchestrator
-- sets `app.current_tenant_id` as a session-local setting per request via
-- `SET LOCAL app.current_tenant_id = '...';`. RLS policies filter all reads
-- + writes by that setting, so cross-tenant data leaks are physically prevented
-- at the database level.
--
-- This is the SOC 2 evidence trail. Auditors expect Postgres RLS for multi-tenant
-- compliance products. Don't bypass with the service role except for migrations
-- and admin scripts (codified as a code review checkpoint).
--
-- The `tenants` table itself is NOT tenant-scoped (it IS the tenants). Access to
-- it is controlled at the application layer (only platform admins read all rows).

-- ────────────────────────────────────────────────────────────────
-- Helper: read the current tenant from session-local config.
-- Returns NULL if no tenant is set (which makes all RLS policies fail-closed).
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
DECLARE
  v_tenant_id text;
BEGIN
  v_tenant_id := current_setting('app.current_tenant_id', true);
  IF v_tenant_id IS NULL OR v_tenant_id = '' THEN
    RETURN NULL;
  END IF;
  RETURN v_tenant_id::uuid;
END;
$$ LANGUAGE plpgsql STABLE;

-- ────────────────────────────────────────────────────────────────
-- Enable + FORCE RLS on every tenant-scoped table.
-- FORCE ensures even table-owner roles (which we shouldn't be using for
-- application traffic) are filtered. Service-role bypass requires explicitly
-- setting `app.bypass_rls = on` AND only for admin/migration code paths.
-- ────────────────────────────────────────────────────────────────
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           FORCE  ROW LEVEL SECURITY;
ALTER TABLE clients         ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients         FORCE  ROW LEVEL SECURITY;
ALTER TABLE engagements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagements     FORCE  ROW LEVEL SECURITY;
ALTER TABLE issues          ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues          FORCE  ROW LEVEL SECURITY;
ALTER TABLE documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents       FORCE  ROW LEVEL SECURITY;
ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages        FORCE  ROW LEVEL SECURITY;
ALTER TABLE actions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions         FORCE  ROW LEVEL SECURITY;
ALTER TABLE approvals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals       FORCE  ROW LEVEL SECURITY;
ALTER TABLE signatures      ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures      FORCE  ROW LEVEL SECURITY;
ALTER TABLE gmail_threads   ENABLE ROW LEVEL SECURITY;
ALTER TABLE gmail_threads   FORCE  ROW LEVEL SECURITY;
ALTER TABLE intake_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_responses FORCE  ROW LEVEL SECURITY;
ALTER TABLE notice_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notice_responses FORCE  ROW LEVEL SECURITY;

-- ────────────────────────────────────────────────────────────────
-- Tenant-scoped tables — single policy per table that requires
-- tenant_id = current_tenant_id().
--
-- Using "FOR ALL" (SELECT, INSERT, UPDATE, DELETE) with USING + WITH CHECK
-- ensures both read and write paths are filtered.
-- ────────────────────────────────────────────────────────────────
CREATE POLICY tenant_isolation_users ON users
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_clients ON clients
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_engagements ON engagements
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_issues ON issues
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_documents ON documents
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_messages ON messages
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_actions ON actions
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_approvals ON approvals
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_signatures ON signatures
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_gmail_threads ON gmail_threads
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_intake_responses ON intake_responses
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_notice_responses ON notice_responses
  FOR ALL
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ────────────────────────────────────────────────────────────────
-- Tenants table itself — readable only by platform admin role.
-- We don't enable RLS on `tenants` because the orchestrator needs to look up
-- a tenant BEFORE it knows which tenant context to set. Access is gated at
-- the application layer.
--
-- However, we DO add a check: any application role connecting to the DB
-- (the role used by Vercel + the orchestrator + Inngest workers) should NOT
-- have permission to write to tenants except via explicit admin scripts.
--
-- For Neon, this is enforced by using two roles:
--   docket_app  — read-only on tenants, full RLS-bound on everything else
--   docket_admin — used by migration scripts + tenant-onboarding code only
--
-- Role creation lives in 0002_roles.sql when we provision Neon (post-signup).
-- ────────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────────
-- Verification queries (commented; run manually to validate):
--
--   SET LOCAL app.current_tenant_id = '<tenant-uuid>';
--   SELECT count(*) FROM clients;  -- only that tenant's rows
--
--   SET LOCAL app.current_tenant_id = '<other-tenant-uuid>';
--   SELECT count(*) FROM clients;  -- only the other tenant's rows
--
--   RESET app.current_tenant_id;
--   SELECT count(*) FROM clients;  -- 0 rows (fail-closed)
-- ────────────────────────────────────────────────────────────────
