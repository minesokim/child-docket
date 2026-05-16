-- Bypass-RLS policies on the 12 original tables from migration 0001.
--
-- Per Session 11 audit (2026-05-16). Closes the deferred-security
-- finding documented across:
--   - Session 4: verify-actions-chain cron's SET LOCAL bypass_rls
--     is dead code in two ways — outside a transaction it's a no-op,
--     AND the actions RLS policy has no bypass clause to read the
--     GUC anyway. The cron only works in production because Neon's
--     default `neondb_owner` role carries the BYPASSRLS attribute.
--   - Session 5: documented the same posture gap across all 12
--     tables from migration 0001 (users, clients, engagements,
--     issues, documents, messages, actions, approvals, signatures,
--     gmail_threads, intake_responses, notice_responses).
--
-- THE PATTERN
--
-- Each table gets a NEW policy `<table>_bypass` with USING + WITH
-- CHECK both keyed on `current_setting('app.bypass_rls', true) = 'on'`.
-- The existing `tenant_isolation_<table>` policy stays as the
-- default tenant-scoped path. Postgres OR's policies on the same
-- table, so a session is permitted if EITHER policy is satisfied.
--
-- Effect:
--   - Application traffic via withTenant() continues unchanged —
--     SET LOCAL app.current_tenant_id is set, tenant_isolation
--     policy fires, rows scoped per tenant.
--   - Admin/cron paths (verify-actions-chain, future audit
--     reports, cross-tenant analytics) explicitly set
--     SET LOCAL app.bypass_rls = 'on' INSIDE a transaction, the
--     <table>_bypass policy fires, all rows visible.
--
-- WHY THIS MATTERS
--
-- Pre-Session-11 the cron's RLS bypass relied on the connecting
-- role having BYPASSRLS attribute (true for Neon's neondb_owner
-- by default). If we ever migrate to the design-intent two-role
-- architecture (docket_app read-only / docket_admin full per
-- migration 0001 lines 130-144 — never shipped as 0002_roles.sql),
-- the cron would silently report "all tenants intact" with zero
-- rows scanned because no policy reads the bypass_rls GUC.
--
-- This migration removes the silent-failure mode. Admin queries
-- that set the GUC inside a tx work regardless of the connecting
-- role's BYPASSRLS attribute.
--
-- COVERAGE
--
-- The post-0001 migrations (0013 tenant_credentials, 0019 firm_
-- profile, 0020 firm_patterns, 0021 client_facts, 0031 settings
-- + calendar, 0032 client_memories, 0033 nudges, 0034 projects,
-- 0036 authorities) ALREADY include their own bypass policies OR
-- don't need one. This migration backfills the 12 0001-era tables
-- to bring them into parity.
--
-- IDEMPOTENT
--
-- Uses CREATE POLICY without IF NOT EXISTS (Postgres 15+ adds
-- IF NOT EXISTS, but we target Postgres 16+; the DROP POLICY IF
-- EXISTS guard makes the migration re-applyable in dev). Same
-- pattern as migration 0036.
--
-- EDGE CASES enumerated 2026-05-16 prior to authoring:
--
--   - Existing tenant traffic via withTenant(): unchanged.
--     tenant_isolation policy still permits owned rows; bypass
--     policy returns NULL when bypass_rls isn't set.
--   - Admin script that forgets to wrap in tx + set GUC: same
--     failure as today (returns 0 rows under non-BYPASSRLS role).
--     The migration makes the BYPASS path work; it doesn't paper
--     over usage mistakes.
--   - Concurrent INSERT under bypass + concurrent INSERT under
--     tenant scope: serialize via row-level locks. Bypass policy
--     permits the admin INSERT; tenant policy permits the tenant
--     INSERT. Both succeed.
--   - bypass_rls GUC poisoning by tenant session (setting bypass
--     mid-session): the GUC is session-local; ANY application path
--     that uses withTenant() resets app.current_tenant_id but does
--     NOT reset bypass_rls. Documented risk: a malicious tenant-
--     scoped path that explicitly set bypass_rls could read other
--     tenants' rows. Mitigation: bypass_rls is set ONLY by admin
--     scripts; tenant paths use withTenant() which doesn't touch
--     it. A code-review gate catches direct `SET LOCAL app.bypass_
--     rls` calls outside admin paths (check-bypass-rls-callers.ts
--     is V1.5 follow-up).

-- ──────────────────────────────────────────────────────────────
-- users
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS users_bypass ON users;
CREATE POLICY users_bypass ON users
  FOR ALL
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

-- ──────────────────────────────────────────────────────────────
-- clients
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS clients_bypass ON clients;
CREATE POLICY clients_bypass ON clients
  FOR ALL
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

-- ──────────────────────────────────────────────────────────────
-- engagements
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS engagements_bypass ON engagements;
CREATE POLICY engagements_bypass ON engagements
  FOR ALL
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

-- ──────────────────────────────────────────────────────────────
-- issues
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS issues_bypass ON issues;
CREATE POLICY issues_bypass ON issues
  FOR ALL
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

-- ──────────────────────────────────────────────────────────────
-- documents
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS documents_bypass ON documents;
CREATE POLICY documents_bypass ON documents
  FOR ALL
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

-- ──────────────────────────────────────────────────────────────
-- messages
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS messages_bypass ON messages;
CREATE POLICY messages_bypass ON messages
  FOR ALL
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

-- ──────────────────────────────────────────────────────────────
-- actions (the audit chain — most important for verify-actions-chain)
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS actions_bypass ON actions;
CREATE POLICY actions_bypass ON actions
  FOR ALL
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

-- ──────────────────────────────────────────────────────────────
-- approvals
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS approvals_bypass ON approvals;
CREATE POLICY approvals_bypass ON approvals
  FOR ALL
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

-- ──────────────────────────────────────────────────────────────
-- signatures
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS signatures_bypass ON signatures;
CREATE POLICY signatures_bypass ON signatures
  FOR ALL
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

-- ──────────────────────────────────────────────────────────────
-- gmail_threads
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS gmail_threads_bypass ON gmail_threads;
CREATE POLICY gmail_threads_bypass ON gmail_threads
  FOR ALL
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

-- ──────────────────────────────────────────────────────────────
-- intake_responses
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS intake_responses_bypass ON intake_responses;
CREATE POLICY intake_responses_bypass ON intake_responses
  FOR ALL
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

-- ──────────────────────────────────────────────────────────────
-- notice_responses
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS notice_responses_bypass ON notice_responses;
CREATE POLICY notice_responses_bypass ON notice_responses
  FOR ALL
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

COMMENT ON POLICY actions_bypass ON actions IS
  'Admin/cron bypass for cross-tenant queries (verify-actions-chain). MUST set SET LOCAL app.bypass_rls = ''on'' inside an explicit transaction.';
