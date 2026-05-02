# @docket/db

Database schema, migrations, and seed data for Docket.

**Stack:** Postgres 16 + Drizzle ORM + pgvector + multi-tenant Row-Level Security (RLS).

## Migrations

Migrations live in `migrations/`. Drizzle generates them from `src/schema.ts`; RLS policies are written manually as numbered SQL files.

| # | Tag | Type | What it does |
|---|---|---|---|
| 0000 | `0000_fancy_vampiro` | Drizzle-generated | Creates 13 tables + 12 enums + 27 indexes + foreign keys |
| 0001 | `0001_rls_policies` | Manual | Enables + FORCEs RLS on all 12 tenant-scoped tables, adds `current_tenant_id()` helper, creates `tenant_isolation_*` policies |
| 0002 | `0002_safe_shaman` | Drizzle-generated | Adds `clients.clerk_user_id` (unique) so Clerk-authed clients map to a row |
| 0003 | `0003_ordinary_captain_midlands` | Drizzle-generated | Drops the old `(client_id, tax_year)` index in favor of `(tenant_id, client_id, tax_year)` unique; adds `intake_responses.updated_at` |
| 0004 | `0004_fast_the_executioner` | Drizzle-generated | Adds `mutate-intake` value to the `action_class` enum |
| 0005 | `0005_concerned_stellaris` | Drizzle-generated | Adds `tenants.dek_encrypted` (per-tenant data-encryption key, AES-GCM-wrapped) |
| 0006 | `0006_stormy_skreet` | Drizzle-generated | Drops `clients.stripe_identity_session_id` (Stripe Identity replaced by DocuSign + KBA path) |
| 0007 | `0007_actions_append_only` | Manual | Installs `BEFORE UPDATE/DELETE/TRUNCATE` triggers on `actions` that raise `insufficient_privilege` — SOC 2 append-only evidence trail |

### Workflow

```bash
# Generate a new migration after editing src/schema.ts
pnpm --filter @docket/db generate

# Apply pending migrations to DATABASE_URL (set in repo root .env.local)
pnpm --filter @docket/db migrate

# Open Drizzle Studio (visual schema browser)
pnpm --filter @docket/db studio

# Seed Antonio + 10 mock clients with realistic Triage data
pnpm --filter @docket/db seed

# Truncate everything first, then reseed
pnpm --filter @docket/db seed:reset
```

## Multi-tenant isolation pattern

Every tenant-scoped table has `tenant_id NOT NULL`. The application sets a session-local Postgres setting per request:

```sql
SET LOCAL app.current_tenant_id = '<tenant-uuid>';
```

RLS policies (in `0001_rls_policies.sql`) filter all SELECT/INSERT/UPDATE/DELETE by `tenant_id = current_tenant_id()`. Cross-tenant queries return zero rows — physically prevented at the database level.

**Code rules:**
- The orchestrator (`@docket/orchestrator`) is the only place that sets `app.current_tenant_id`. It does so once per request, before any query runs.
- Background workers (`@docket/workers`) set it before each job step.
- Migrations + admin scripts run as `docket_admin` role with RLS bypassed. **No application code should ever connect as `docket_admin`.**
- The `tenants` table is NOT tenant-scoped (it IS the tenant list). It's gated at the application layer — only platform-admin code paths can read it.

This is the SOC 2 audit evidence trail. The tenant-isolation regression suite lives at [`test/rls.test.ts`](./test/rls.test.ts) and proves:

- Setting tenant A returns only A's rows from every tenant-scoped table
- Switching to tenant B returns only B's rows
- No tenant context → zero rows (fail-closed)
- Cross-tenant INSERT (lying about `tenant_id`) is rejected by `WITH CHECK`
- Cross-tenant UPDATE silently no-ops (RLS hides the target row)
- `intake_responses` (the SSN-bearing table) is isolated end-to-end

Run with a real DB pointed via `DATABASE_URL_RLS_TEST` (separate name from `DATABASE_URL` so dev/prod can't be hit accidentally):

```bash
DATABASE_URL_RLS_TEST=postgres://... pnpm --filter @docket/db test:rls
```

Skipped automatically when the env var is unset, so unit-test loops stay fast.

### Audit immutability test (mig 0007)

`test/audit-immutability.test.ts` proves the `actions` table is append-only end-to-end: UPDATE / DELETE / TRUNCATE attempts all raise `insufficient_privilege`, and INSERT still works (we can write new audit entries, we just can't rewrite history). Run with the same `DATABASE_URL_RLS_TEST` env var.

## Re-encrypt legacy master-KEK blobs

`scripts/reencrypt-legacy.ts` walks every encrypted leaf in `intake_responses.answers`, detects ones encrypted with the master KEK (pre-batch-9 legacy data), decrypts them, and re-encrypts with the per-tenant DEK. Run before removing the master-KEK fallback in `decryptIfMarkedForTenant`.

```bash
# Scan only — reports how many legacy blobs exist, makes no changes:
DATABASE_URL=postgres://... PII_ENCRYPTION_KEY=... \
  pnpm --filter @docket/db reencrypt-legacy --dry-run

# Rewrite — idempotent. Re-run --dry-run after to confirm legacy=0:
DATABASE_URL=postgres://... PII_ENCRYPTION_KEY=... \
  pnpm --filter @docket/db reencrypt-legacy
```

Once `--dry-run` reports zero legacy blobs across the entire DB, the master-KEK fallback path in `encryption.ts` is safe to delete. See the procedure block in `decryptIfMarkedForTenant`.

## Schema overview (v0)

```
tenants                    Firms. Antonio's firm = Vazant Consulting (tenant 0).
users                      Preparers + staff. Maps to Clerk user IDs.
clients                    Taxpayers. One row per taxpayer per tenant.
engagements                A typed unit of work — return prep, rep, advisory.
issues                     THE TRIAGE QUEUE. The product. 11 issue types.
documents                  Files uploaded by clients. AI-classified on upload.
messages                   Every comm in every channel.
actions                    THE MOAT. Every tool call, every AI inference.
approvals                  Every preparer accept/reject of an AI suggestion.
signatures                 Engagement letter, §7216, 8879, 2848, 8821.
gmail_threads              Raw Gmail messages we've ingested for classification.
intake_responses           Answers from the 36-screen client portal flow.
notice_responses           IRS notices and their drafted/sent responses.
```

## Connection setup (when Neon is provisioned)

```bash
# 1. Create the Neon project on Launch tier (auto-suspend OFF)
# 2. Enable pgvector extension via Neon UI
# 3. Set DATABASE_URL in repo root .env.local:
#    DATABASE_URL=postgres://docket_admin:...@ep-xxx.us-west-2.aws.neon.tech/docket?sslmode=require

# 4. Apply migrations
pnpm --filter @docket/db migrate

# 5. Seed
pnpm --filter @docket/db seed
```

After seeding, Antonio + 10 mock clients exist in the DB. The Triage view in `apps/command-room` (when built) will render their issues directly.
