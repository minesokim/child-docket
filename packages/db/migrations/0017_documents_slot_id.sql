-- documents.slot_id — bind an upload to the expected-doc slot it
-- fills (e.g., 'identity-dl-front', 'income-w2', 'dependent-ssn-0').
--
-- Why this exists:
--   The upload UX drives users from a per-slot focused page. When the
--   browser triggers confirmUpload, the slot is known. Persisting it
--   on the row lets the finalize worker pick a slot-aware filename
--   (e.g., DriversLicenseFront vs DriversLicenseBack) and lets the
--   docs overview render the right state without guessing via
--   matchUploadToSlot heuristics.
--
--   slot_id is OPTIONAL — uploads from the "Other" surface (no slot)
--   leave it NULL, and the existing kind-based matchUploadToSlot
--   fallback still places them into the first matching slot.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS slot_id text;

-- Index for slot-fill lookups: "show me the doc filling identity-dl-front
-- for this client." Composite (tenant, client, slot) keeps the index
-- selective even when one tenant has many clients.
CREATE INDEX IF NOT EXISTS documents_slot_idx
  ON documents (tenant_id, client_id, slot_id)
  WHERE slot_id IS NOT NULL;
