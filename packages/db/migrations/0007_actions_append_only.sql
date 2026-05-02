-- Append-only audit log enforcement on the `actions` table.
--
-- The actions table is THE MOAT (per CLAUDE.md): every tool call, every AI
-- inference, every plaintext reveal, every mutation lands here. SOC 2 evidence
-- depends on this row being immutable once written:
--
--   - Auditors expect "who did what, when" to be tamper-evident
--   - A compromised application role should not be able to rewrite history
--   - Even a developer with `docket_app` credentials should not be able to
--     UPDATE a row to falsify costUsd / latencyMs / agentId after the fact
--
-- We enforce this at the database layer with a BEFORE UPDATE/DELETE trigger
-- that raises an exception. There is NO application-level bypass — the only
-- way to mutate the table is to log in as a Postgres superuser AND drop the
-- trigger first. Both events are observable in Neon's audit log.
--
-- TRUNCATE bypasses BEFORE DELETE triggers, so we add a separate STATEMENT
-- trigger for it. Combined, the table is fully append-only from any role
-- without superuser + DDL access.
--
-- Future: when we partition `actions` by month for query speed, the partition
-- DROP path needs a designed-in escape hatch. v0 isn't that big yet, so we
-- keep the simple absolute-immutability stance.

CREATE OR REPLACE FUNCTION reject_actions_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'actions table is append-only; % is not permitted (op=%, table=%)',
    TG_OP, TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER actions_no_update
  BEFORE UPDATE ON actions
  FOR EACH ROW
  EXECUTE FUNCTION reject_actions_mutation();

CREATE TRIGGER actions_no_delete
  BEFORE DELETE ON actions
  FOR EACH ROW
  EXECUTE FUNCTION reject_actions_mutation();

CREATE TRIGGER actions_no_truncate
  BEFORE TRUNCATE ON actions
  FOR EACH STATEMENT
  EXECUTE FUNCTION reject_actions_mutation();

COMMENT ON FUNCTION reject_actions_mutation() IS
  'Append-only enforcement for actions table. SOC 2 evidence trail.';

-- ────────────────────────────────────────────────────────────────
-- Verification queries (commented; run manually to validate):
--
--   -- Insert succeeds:
--   INSERT INTO actions (...) VALUES (...);
--
--   -- Update fails:
--   UPDATE actions SET cost_usd = 0 WHERE id = '...';
--   ERROR:  actions table is append-only; UPDATE is not permitted
--
--   -- Delete fails:
--   DELETE FROM actions WHERE id = '...';
--   ERROR:  actions table is append-only; DELETE is not permitted
--
--   -- Truncate fails:
--   TRUNCATE actions;
--   ERROR:  actions table is append-only; TRUNCATE is not permitted
-- ────────────────────────────────────────────────────────────────
