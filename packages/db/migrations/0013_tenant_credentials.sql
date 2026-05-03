-- Per-tenant credential vault.
--
-- One row per (tenant, integration kind). Each integration's secrets
-- live in a JSONB column encrypted with the tenant's DEK (the same
-- per-tenant key that protects SSN/EIN/bank in intake_responses). Master
-- KEK is in PII_ENCRYPTION_KEY env; the DEK is in tenants.dek_encrypted.
-- Defense in depth: a Postgres dump alone yields encrypted blobs that
-- can't be decrypted without the master KEK; a master KEK leak alone
-- yields ciphertext that can't be decrypted without the DEK row.
--
-- Why per-tenant + DEK-encrypted instead of env vars?
--   - Vercel env vars are global per deploy. With env vars we'd need
--     TWILIO_AUTH_TOKEN_VAZANT, TWILIO_AUTH_TOKEN_SMITH, ... and
--     branching code per tenant. That's the no-snowflakes rule violation
--     CLAUDE.md §16 explicitly forbids.
--   - DEK encryption means even cross-tenant access at the database
--     layer can't decrypt another firm's secrets. Vazant's DEK can't
--     decrypt Smith CPA's twilio.data, even with full DB access.
--
-- The same table holds Twilio + Square + DocuSign + Gmail creds going
-- forward; the `kind` column discriminates. One row per integration per
-- tenant (UNIQUE constraint).
--
-- Migration to a real secrets manager (Infisical, AWS Secrets Manager)
-- in v1.5: the read/write helpers in @docket/db/tenant-credentials swap
-- their backend; the table can stay or be dropped. The application call
-- sites don't change.

CREATE TABLE IF NOT EXISTS tenant_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Integration id. Free-text on purpose (no enum) so we don't need a
  -- migration to add the next integration. App-side validation in
  -- @docket/db/tenant-credentials enforces the known set.
  kind text NOT NULL,
  -- Encrypted JSON blob. Shape varies per kind:
  --   twilio:   { accountSid: string, authToken: string, fromNumber: string }
  --   square:   { accessToken: string, locationId: string }
  --   docusign: { integrationKey: string, userId: string, accountId: string, privateKey: string }
  --   gmail:    { refreshToken: string, accessToken?: string, scope: string }
  -- Always stored as { __enc: <base64> } per the encryption.ts marker
  -- format. Never a plaintext jsonb in this column.
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Set on every update for rotation tracking. Independent of updated_at
  -- because metadata-only writes (e.g., disabling) shouldn't reset the
  -- rotation clock.
  rotated_at timestamptz NOT NULL DEFAULT now(),
  -- One credential row per (tenant, kind). Updates are upserts.
  CONSTRAINT tenant_credentials_tenant_kind_uniq UNIQUE (tenant_id, kind)
);

CREATE INDEX IF NOT EXISTS tenant_credentials_tenant_idx
  ON tenant_credentials(tenant_id);

-- RLS — same pattern as the rest of the schema. Forced so the firm
-- boundary holds even against superuser-equivalent app roles.
ALTER TABLE tenant_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_credentials FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_credentials_isolation ON tenant_credentials
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
