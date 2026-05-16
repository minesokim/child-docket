-- Tighten RLS WITH CHECK on authorities + authority_chunks.
--
-- Per Session 5 RLS audit (2026-05-15). The previous policy:
--
--   CREATE POLICY authorities_isolation ON authorities
--     USING (tenant_id IS NULL OR tenant_id = current_tenant_id())
--     WITH CHECK (tenant_id IS NULL OR tenant_id = current_tenant_id());
--
-- THE PRIVILEGE-ESCALATION FLAW
--   A tenant-scoped session (app.current_tenant_id = tenantA) could
--   execute:
--     INSERT INTO authorities (..., tenant_id) VALUES (..., NULL);
--   The IS NULL branch of WITH CHECK evaluates the NEW row's tenant_id.
--   NEW.tenant_id IS NULL evaluates to TRUE → WITH CHECK passes →
--   INSERT permitted. The resulting row is then visible to EVERY
--   tenant via the SELECT policy (also USING (NULL OR match)).
--
--   Outcome: a compromised tenant session can poison the global
--   authority corpus that powers RAG retrieval for tax-position
--   decisions across all firms. A malicious "IRS Code §1234 says
--   the Augusta Rule applies to S-corps" row would be served to
--   every firm's Discovery + Position agents. The Position
--   Framework loses its compliance footing.
--
--   In v1 with one tenant the risk is theoretical. As soon as
--   tenant #2 onboards, this becomes a real attack vector. And the
--   Knowledge Layer is the moat per CLAUDE.md §13 — if a malicious
--   tenant can poison it, the entire Position Framework breaks.
--
--   The seed scripts currently use the IS NULL branch to insert
--   global rows (no app.current_tenant_id set; NEW.tenant_id IS
--   NULL → WITH CHECK passes). That path needs to move to the
--   bypass_rls escape after this migration.
--
-- THE FIX
--   Split into THREE policies per table:
--
--     1. <table>_select       FOR SELECT
--        USING (tenant_id IS NULL OR tenant_id = current_tenant_id())
--          — every tenant reads global authorities + their own.
--
--     2. <table>_tenant_write FOR ALL
--        USING (tenant_id IS NOT NULL AND tenant_id = current_tenant_id())
--        WITH CHECK (tenant_id IS NOT NULL AND tenant_id = current_tenant_id())
--          — tenant sessions can write only their own rows.
--          The NOT NULL clause kills the previous IS-NULL escape.
--
--     3. <table>_bypass       FOR ALL
--        USING (current_setting('app.bypass_rls', true) = 'on')
--        WITH CHECK (current_setting('app.bypass_rls', true) = 'on')
--          — admin scripts that need to insert global rows set the
--          GUC inside an explicit transaction. Same pattern used on
--          payments / gmail_sync_state / discovery_scans. The
--          bypass policy applies to read + write so seed scripts
--          can also SELECT back the inserted rows in the same tx.
--
--   Postgres OR's policies on the same table that are not
--   restricted by a FOR <command> qualifier, so a session is
--   permitted if EITHER policy is satisfied. Read with tenant
--   context set: <table>_select permits. Write to own tenant:
--   <table>_tenant_write permits. Write a global as admin:
--   <table>_bypass permits.
--
-- BACKWARD COMPAT
--   Existing rows are unaffected. Existing global rows (tenant_id
--   IS NULL) remain readable by every tenant via <table>_select.
--   The only behavior change is INSERT/UPDATE: tenant sessions can
--   no longer write rows with NULL tenant_id. Seed scripts MUST
--   wrap their inserts in an explicit transaction and SET LOCAL
--   app.bypass_rls = 'on'.
--
-- BACKFILL
--   None needed. The authority + authority_chunks tables are seed-
--   populated by an admin script (no tenant traffic writes them).
--   No existing row needs modification.
--
-- EDGE CASES enumerated 2026-05-15 prior to authoring (6 across
-- input/state/permission/domain). All addressed:
--   - tenant session writing NULL row: BLOCKED by new WITH CHECK.
--   - tenant session writing own-tenant row: ALLOWED.
--   - admin script writing global row: ALLOWED via bypass policy
--     after SET LOCAL app.bypass_rls = 'on' inside tx.
--   - existing global rows remain readable: ALLOWED via <table>_select.
--   - existing row writes by tenant (own rows): ALLOWED via
--     <table>_tenant_write.
--   - bypass-GUC poisoning by tenant session (setting bypass_rls
--     mid-session): DEFENSIBLE — the GUC is session-scoped and
--     ANY application path that uses withTenant() resets the
--     session-local app.current_tenant_id. A malicious tenant
--     would need application-code-level access to set the GUC,
--     at which point RLS isn't the boundary anyway. Documented.

-- ──────────────────────────────────────────────────────────────
-- authorities
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS authorities_isolation ON authorities;

CREATE POLICY authorities_select ON authorities
  FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id());

CREATE POLICY authorities_tenant_write ON authorities
  FOR ALL
  USING (tenant_id IS NOT NULL AND tenant_id = current_tenant_id())
  WITH CHECK (tenant_id IS NOT NULL AND tenant_id = current_tenant_id());

CREATE POLICY authorities_bypass ON authorities
  FOR ALL
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

-- ──────────────────────────────────────────────────────────────
-- authority_chunks
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS authority_chunks_isolation ON authority_chunks;

CREATE POLICY authority_chunks_select ON authority_chunks
  FOR SELECT
  USING (tenant_id IS NULL OR tenant_id = current_tenant_id());

CREATE POLICY authority_chunks_tenant_write ON authority_chunks
  FOR ALL
  USING (tenant_id IS NOT NULL AND tenant_id = current_tenant_id())
  WITH CHECK (tenant_id IS NOT NULL AND tenant_id = current_tenant_id());

CREATE POLICY authority_chunks_bypass ON authority_chunks
  FOR ALL
  USING (current_setting('app.bypass_rls', true) = 'on')
  WITH CHECK (current_setting('app.bypass_rls', true) = 'on');

COMMENT ON POLICY authorities_select ON authorities IS
  'Reads: every tenant sees global rows (tenant_id IS NULL) and their own.';
COMMENT ON POLICY authorities_tenant_write ON authorities IS
  'Writes: tenant sessions can only INSERT/UPDATE/DELETE their own rows. NULL tenant_id is forbidden — kills the privilege-escalation path from migration 0014.';
COMMENT ON POLICY authorities_bypass ON authorities IS
  'Admin write: seed-authorities.ts and the future ingestion pipeline set app.bypass_rls = on inside an explicit tx to insert global rows.';

COMMENT ON POLICY authority_chunks_select ON authority_chunks IS
  'Reads: every tenant sees global chunks (tenant_id IS NULL) and their own.';
COMMENT ON POLICY authority_chunks_tenant_write ON authority_chunks IS
  'Writes: tenant sessions can only INSERT/UPDATE/DELETE their own rows. NULL tenant_id is forbidden — kills the privilege-escalation path from migration 0014.';
COMMENT ON POLICY authority_chunks_bypass ON authority_chunks IS
  'Admin write: seed-authorities.ts and the future ingestion pipeline set app.bypass_rls = on inside an explicit tx to insert global rows.';
