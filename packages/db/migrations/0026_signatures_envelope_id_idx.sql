-- 0026_signatures_envelope_id_idx.sql
--
-- Partial expression index on signatures.audit_payload->>'envelopeId'.
--
-- Why this matters: the DocuSign Connect webhook handler at
-- apps/command-room/src/app/api/webhooks/docusign/connect/route.ts
-- (line 259-264) looks up signatures rows by envelopeId via:
--
--   SELECT id, tenant_id, audit_payload
--   FROM signatures
--   WHERE audit_payload->>'envelopeId' = $1
--   LIMIT 1
--
-- Without an index on the JSONB key extraction, every webhook hit
-- triggers a sequential scan over the full signatures table. Today
-- that's fine (small table). Once Vazant has 200+ engagement letters
-- + 200+ 8879s + 50+ §7216 consents (a normal pre-season state), the
-- scan starts costing real ms per webhook — and DocuSign retries with
-- backoff if the handler is slow, multiplying the load.
--
-- The index is PARTIAL — only rows with an envelopeId key in the
-- JSONB payload are indexed. engagement_letter and consent_7216 rows
-- (in v0 these are wet-signature placeholders that don't go through
-- DocuSign) don't have envelopeId, so they don't bloat the index.
-- form_2848 and form_8821 will use envelopeId once V1.5's IRS Tax
-- Pro Account browser-automation flow lands; the index already
-- covers them.
--
-- ANALYZE after creation isn't strictly required (Postgres updates
-- stats on its own), but it doesn't hurt and helps cold-start query
-- planners pick the index immediately.

CREATE INDEX IF NOT EXISTS signatures_envelope_id_idx
  ON signatures ((audit_payload->>'envelopeId'))
  WHERE audit_payload ? 'envelopeId';

ANALYZE signatures;
