# @docket/db

Database schema, migrations, and seed data for Docket.

**Stack:** Postgres 16 + Drizzle ORM + pgvector + multi-tenant Row-Level Security (RLS).

## Migrations

Migrations live in `migrations/`. Drizzle generates them from `src/schema.ts`; RLS policies are written manually as numbered SQL files.

| # | Tag | Type | What it does |
|---|---|---|---|
| 0000 | `0000_fancy_vampiro` | Drizzle-generated | Creates 13 tables + 12 enums + 27 indexes + foreign keys |
| 0001 | `0001_rls_policies` | Manual | Enables + FORCEs RLS on all 12 tenant-scoped tables, adds `current_tenant_id()` helper, creates `tenant_isolation_*` policies |

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

This is the SOC 2 audit evidence trail. A tenant-isolation regression test runs in CI:

```ts
// packages/db/test/rls.test.ts (TODO when first paying customer signs)
// Verify: setting tenant A, querying clients, returns only A's rows.
// Verify: switching to tenant B, queries return only B's rows.
// Verify: no setting → zero rows everywhere (fail-closed).
```

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
