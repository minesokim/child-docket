-- documents.merged_into_document_id — when set, this document row was
-- consumed into a multi-page composite (today: driver's license front
-- merged into the back's 2-page PDF). The composite row carries the
-- final_storage_key + final_filename of the merged PDF. The merged-in
-- row is hidden from listings (command-room + client portal) but kept
-- on disk so the original raw is still available for "view raw" debug.
--
-- Why a separate column rather than parse_phase = 'merged':
--   - parse_phase tracks pipeline progress; this is a distinct
--     "superseded by another row" relationship that's orthogonal.
--   - FK gives us cascade semantics: if the composite row is deleted,
--     the merged_into rows fall back to standalone (NULL).

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS merged_into_document_id uuid
    REFERENCES documents(id) ON DELETE SET NULL;

-- Index for the listing filter "WHERE merged_into_document_id IS NULL".
-- Partial index keeps it tiny — only indexes the merged rows, the
-- common-case filter (NULL) uses a sequential scan with the existing
-- (tenant_id, client_id) covering index.
CREATE INDEX IF NOT EXISTS documents_merged_into_idx
  ON documents (merged_into_document_id)
  WHERE merged_into_document_id IS NOT NULL;
