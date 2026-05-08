# @docket/test-fixtures

Fixture data for smoke tests, agent eval harnesses, and staging environment seeding. **Never imported into production code paths.**

## What's here

| File | What it exports |
|---|---|
| `src/tenants.ts` | One mock tenant (Vazant-shaped, but with `is_test_fixture=true`). Used as the umbrella for all other fixtures. |
| `src/users.ts` | Firm-owner + preparer + assistant users. Bound to the mock tenant. Use for testing role-gated surfaces. |
| `src/clients.ts` | Three clients with varied complexity: simple W-2 employee, freelancer with Schedule C, family with multiple dependents. |
| `src/engagements.ts` | One engagement per client. Different types (`return_1040`, `return_1040`, `representation`). Different tax years. |
| `src/intake.ts` | Three sets of intake answers, matched to the three clients. Pre-encrypted-shape — caller wraps with the tenant DEK before persist. |
| `src/documents.ts` | Five sample doc metadata records (DL front, DL back, W-2, 1099-NEC, 1098-T). Each references a placeholder PNG in `src/binaries/`. |
| `src/binaries/` | Placeholder PNG files. **Not real tax documents** — 100×100 colored squares with valid PNG headers, just enough to pass MIME validation in tests. Real-image fixtures should be added when needed for AI classifier evals. |
| `src/seed.ts` | `seedFixtures(db, opts)` — populates a staging DB + R2 bucket with all fixtures. `cleanupFixtures(db, opts)` — removes them. |

## How to use

### In a smoke test

```typescript
import { fixtureTenant, fixtureClients } from '@docket/test-fixtures';

const tenantId = fixtureTenant.id;
const aliceId = fixtureClients.alice.id;
// … rest of test …
```

### To seed a staging environment

```bash
# From repo root, with staging env vars loaded:
DATABASE_URL=$STAGING_DB_URL R2_ACCOUNT_ID=... \
  bun run packages/test-fixtures/scripts/seed-staging.ts
```

### To clean up after a test (DEV ONLY — uses hard DELETE)

```typescript
import { cleanupFixtures } from '@docket/test-fixtures/seed';

await cleanupFixtures(adminDb, { hardDelete: true });
```

## Conventions

- **Every fixture row has `id` set explicitly** (using stable ULIDs) so tests can assert against known IDs.
- **Every fixture row has `is_test_fixture: true`** in metadata where the schema supports it (or we set it via a marker convention) so prod queries can `WHERE is_test_fixture IS NOT TRUE` to exclude.
- **Placeholder binaries are tiny** (~100 bytes each) so tests run fast.
- **No real PII anywhere.** All names are obviously-fake (Alice Tester, Bob Fixture, Carol Test). All SSNs are `000-00-0001` through `000-00-9999` (the IRS reserves the `000-` block for testing).
- **Fixture IDs are stable across runs.** ULIDs are hardcoded, not generated. Tests that depend on specific IDs can rely on them.

## When NOT to use

- **Don't import from prod app code.** This package is for tests + dev only. Importing from `apps/*/src/` (other than test files) is a code-review block.
- **Don't seed against production DB.** The seed function checks `process.env.DATABASE_URL` and refuses if it sees a known prod host pattern.
- **Don't use real PII.** Even "test" SSNs that look real (e.g., 123-45-6789) shouldn't appear here. Use the `000-XX-XXXX` reserved block.

## Adding a new fixture

1. Add the new TypeScript object to the appropriate file (`tenants.ts`, `clients.ts`, etc.)
2. Use a fresh hardcoded ULID — generate one via `bun -e "import { ulid } from '@docket/storage/ulid'; console.log(ulid())"`
3. Update `seed.ts` to insert the new row
4. Update the README table above
5. Run `pnpm typecheck` to verify the schema fits

## Real-image fixtures (TODO — V1.5)

Today this package ships placeholder PNGs. For the agent eval harness to test real classifier output, we need actual tax-document images. Plan:

- Generate 50+ synthetic tax docs via Sharp + PDF text overlay (W-2 templates, 1099 templates, DL templates with fake data)
- Hand-label each with expected `aiClassification` value
- Eval harness runs classifier against fixtures → asserts F1 score >= threshold

That's a v1.5 deliverable. Today's placeholder PNGs are sufficient for testing the upload→storage→DB-row pipeline; they're insufficient for testing AI classification accuracy.
