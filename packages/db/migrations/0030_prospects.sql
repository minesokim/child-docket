-- Migration 0030 — prospects table.
--
-- Captures inbound Discovery Scan form submissions from the public
-- /scan landing page. Prospects are PRE-TENANT — they exist before
-- they have a Docket account or any tenant_id binding. Once a
-- prospect signs up, their record gets linked to the new tenant
-- via `converted_tenant_id` (lifecycle handled by an admin action
-- later; this migration just installs the storage).
--
-- WHY A SEPARATE TABLE (not just stuff into Sentry)?
--   The Sentry beforeSend scrubber redacts email/phone from
--   event.extra (per PII discipline). Manual follow-up requires the
--   actual contact info, so Sentry alone is unusable for lead
--   capture. Codex C12 R3 P1 surfaced this. The prospects table is
--   the structured persistence layer the /scan flow writes to;
--   Sentry breadcrumbs still fire for observability.
--
-- NO RLS
--   Prospects are PRE-TENANT — there's no current_tenant_id to scope
--   by. Reads come from admin tooling David runs locally with the
--   raw DB connection. Inserts come from the public /api/scan-intake
--   endpoint (allowlisted in middleware; rate-limited 10/5min/IP).
--   No cross-prospect leakage risk because no auth context expects
--   to query "their prospects" — there is no "their."

CREATE TABLE IF NOT EXISTS prospects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Form fields
  first_name text NOT NULL,
  last_name text NOT NULL,
  firm_name text NOT NULL,
  designation text NOT NULL,
  firm_size text NOT NULL,
  tax_software text NOT NULL,
  email text NOT NULL,
  phone text,
  linkedin_url text,
  source text NOT NULL,
  redacted_confirmed boolean NOT NULL,

  -- Audit signal (for fraud detection + analytics).
  -- IP address is privacy-sensitive but justified here: form-spam
  -- detection + analytics on outreach channels. NOT linked to a
  -- specific identity except by the prospect's own contact info.
  ip_address text,
  user_agent text,

  -- Lifecycle.
  -- submitted    — fresh form submission
  -- contacted    — David followed up by email
  -- scan_sent    — Discovery Scan PDF delivered (links to discovery_scans.id)
  -- converted    — signed up for founder tier (links to converted_tenant_id)
  -- rejected     — opt-out / not a fit / no follow-up
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'contacted', 'scan_sent', 'converted', 'rejected')),

  -- Optional linkage when the prospect converts. NOT a FK because
  -- tenants might be deleted (e.g., trial cleanup) without losing
  -- the conversion data here. Stored as text to avoid orphaning.
  converted_tenant_id uuid,

  -- Optional linkage to the Discovery Scan delivery (when status
  -- = scan_sent). FK with SET NULL on delete — scan row may be
  -- pruned without losing the prospect record.
  scan_id uuid REFERENCES discovery_scans(id) ON DELETE SET NULL,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  submitted_at timestamptz NOT NULL DEFAULT now(),
  contacted_at timestamptz,
  scan_sent_at timestamptz,
  converted_at timestamptz,
  rejected_at timestamptz,

  -- Audit
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Lookups
CREATE INDEX IF NOT EXISTS prospects_status_idx ON prospects(status);
CREATE INDEX IF NOT EXISTS prospects_submitted_at_idx
  ON prospects(submitted_at DESC);
-- Email lookup for dedup on resubmissions. Not UNIQUE — a prospect
-- might legitimately submit twice (e.g., from different IPs after
-- losing their first scan link).
CREATE INDEX IF NOT EXISTS prospects_email_idx ON prospects(lower(email));
CREATE INDEX IF NOT EXISTS prospects_firm_name_idx
  ON prospects(lower(firm_name));

-- updated_at trigger
CREATE OR REPLACE FUNCTION prospects_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prospects_updated_at ON prospects;
CREATE TRIGGER prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW
  EXECUTE FUNCTION prospects_set_updated_at();
