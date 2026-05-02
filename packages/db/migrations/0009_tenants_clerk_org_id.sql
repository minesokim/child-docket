-- Multi-firm wiring (Day 2 of post-audit hardening).
--
-- 1. tenants.clerkOrgId — one Clerk Organization = one tenant. Firm
--    staff are Clerk org members; clients (taxpayers) auth via phone
--    OTP and never join the Clerk org.
--
-- 2. clients.phoneGlobalIdx — non-tenant-scoped index on phone, for
--    the first-sign-in binding lookup. We don't yet know the tenant
--    when a client completes phone OTP; the existing (tenantId, phone)
--    composite is leading-key tenantId and can't serve a phone-only
--    predicate efficiently.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS clerk_org_id text;

ALTER TABLE tenants
  ADD CONSTRAINT tenants_clerk_org_id_unique UNIQUE (clerk_org_id);

CREATE INDEX IF NOT EXISTS clients_phone_global_idx ON clients (phone);
