-- Final / processed document storage columns.
--
-- After the user accepts the AI classification, the document goes
-- through a finalization pipeline:
--   1. Binarize the image (Otsu threshold) — tax docs only
--   2. Wrap in a single-page PDF (or multi-page for PDF input)
--   3. Rename per the AI's suggested convention (or the user's edit)
--   4. Upload to a NEW R2 key (final_storage_key)
--   5. Update the documents row with the final-side metadata
--
-- The original raw upload stays at storage_key for audit + recovery.
-- The final processed PDF lives at final_storage_key — that's what
-- preparers actually see in command-room and what gets sent to OLT.
--
-- parse_phase transitions extended:
--   accepted   user confirmed classification, finalize event fired
--   finalizing Inngest worker is running binarize + PDF + upload
--   final      processing complete; final_storage_key is populated
--   failed     finalization errored (worker retries 3x then surrenders)

ALTER TABLE documents ADD COLUMN IF NOT EXISTS final_storage_key text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS final_filename text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS final_size_bytes integer;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS final_mime_type text;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS finalized_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS binarized boolean NOT NULL DEFAULT false;
