-- Document classification fields.
--
-- Adds the columns the doc-classifier agent populates + the columns
-- the 4-phase upload UX needs to render the "AI parsed → user accepts"
-- flow.
--
-- parse_phase value transitions (app-controlled):
--   uploaded     — bytes are in R2, documents row exists, classify event fired
--   classifying  — Inngest worker has picked up the event, Haiku call in flight
--   parsed       — classification complete, awaiting user verification
--   accepted     — user confirmed the classification (or edited it)
--   failed       — classification failed (Haiku error / corrupt image / illegible)
--
-- The transitions are linear except `failed` which is a terminal state
-- the user can recover from by re-uploading.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_legibility real;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_suggested_filename text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_retake_hint text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_classified_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS accepted_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message text;

-- Index for the classifying-pending lookup (Inngest worker queries
-- "any docs stuck in classifying for > 60s?" to retry).
CREATE INDEX IF NOT EXISTS documents_parse_phase_idx
  ON documents(tenant_id, parse_phase);
