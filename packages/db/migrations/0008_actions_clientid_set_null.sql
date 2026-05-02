-- Hand-written migration generated from the May 2026 security audit.
--
-- Problem: actions.clientId references clients(id) ON DELETE CASCADE.
-- The actions table is the audit moat (append-only via triggers in
-- migration 0007). But ON DELETE CASCADE on clients creates a side
-- door: a single DELETE on clients silently removes the corresponding
-- audit rows without firing the BEFORE DELETE trigger on actions
-- (because the FK cascade does the row-level delete at constraint-
-- check time, not via row trigger).
--
-- This is the SOC 2 evidence vs CCPA right-to-delete tension. Resolution:
--   - clients.id deleted → actions.clientId becomes NULL
--   - actions row itself stays, with action_class + tool_name + timestamp
--   - PII linkage to the deleted subject is broken; audit chain is preserved
--
-- See packages/db/src/schema.ts for the matching FK declaration.

ALTER TABLE actions
  DROP CONSTRAINT IF EXISTS actions_client_id_clients_id_fk;

ALTER TABLE actions
  ADD CONSTRAINT actions_client_id_clients_id_fk
  FOREIGN KEY (client_id)
  REFERENCES clients(id)
  ON DELETE SET NULL;
