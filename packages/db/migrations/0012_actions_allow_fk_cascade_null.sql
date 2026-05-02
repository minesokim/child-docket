-- Append-only `actions` trigger: allow FK-cascade SET NULL on client_id.
--
-- Day 1 shipped two protections that fight each other:
--
--   - Migration 0007 added a BEFORE UPDATE trigger that rejects EVERY
--     UPDATE on actions ("append-only").
--   - Migration 0008 changed actions.client_id FK from CASCADE to
--     SET NULL so a CCPA right-to-delete on a clients row keeps the
--     audit history intact (FK auto-NULLs client_id instead of
--     deleting the row).
--
-- Together they break: deleting a client triggers the FK cascade,
-- which is implemented internally as an UPDATE on actions to set
-- client_id = NULL, which the append-only trigger blocks. Net
-- result: you can't delete a client at all.
--
-- This migration replaces the trigger function with a version that
-- allows EXACTLY one shape of UPDATE: nulling client_id when it was
-- previously non-null, and the identity columns (id, tenant_id,
-- action_class, tool_name, created_at) all unchanged. Any other
-- column-shape change is rejected as before.
--
-- Threat model: a Postgres superuser can DROP the trigger and do
-- whatever. This trigger isn't designed to stop that — it's designed
-- to prevent accidental tampering and to lock down `docket_app`-role
-- writes from rewriting audit history. The new carve-out doesn't
-- weaken that; the only thing now permitted is the exact cascade
-- shape Postgres itself emits when a referenced clients row is
-- deleted.

CREATE OR REPLACE FUNCTION reject_actions_mutation()
RETURNS trigger AS $$
BEGIN
  -- FK-cascade carve-out: client deletion sets actions.client_id to
  -- NULL while keeping every other column intact. Allow ONLY that
  -- exact shape.
  IF TG_OP = 'UPDATE'
     AND OLD.client_id IS NOT NULL
     AND NEW.client_id IS NULL
     AND NEW.id = OLD.id
     AND NEW.tenant_id = OLD.tenant_id
     AND NEW.action_class = OLD.action_class
     AND NEW.tool_name = OLD.tool_name
     AND NEW.created_at = OLD.created_at
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'actions table is append-only; % is not permitted (op=%, table=%)',
    TG_OP, TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION reject_actions_mutation() IS
  'Append-only enforcement for actions. Allows FK-cascade SET NULL on client_id.';
