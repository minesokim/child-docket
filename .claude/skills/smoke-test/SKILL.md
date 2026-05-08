---
name: smoke-test
version: 1.0.0
description: |
  Write and run an end-to-end smoke test for a feature or pipeline. Use after
  shipping any change that crosses ≥2 of: server action, DB write, Inngest
  event, R2 read/write, external API, browser preview, encryption boundary.
  The test must run against a real environment (prod or staging) and exit 0
  only when every boundary in the data path passes a labeled check.

  Triggered by: "smoke test this", "make sure this works end to end", "verify
  the [feature] pipeline works", or proactively after any non-trivial change
  to upload, classify, finalize, OCR, intake-write, billing, signature, or
  Inngest worker code.
voice-triggers:
  - smoke test
  - end to end test
  - verify the pipeline
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - Grep
---

# smoke-test

> One purpose: stop "I claimed it works, user found a bug 30 seconds later."

The Docket pipeline crosses 9+ boundaries between browser and viewer. Every
silent-failure layer this evening (Inngest step output cap, 1-bit PNG, Tesseract
worker crash, 10s lambda, iframe sandbox, R2 key collision) manifested as the
same surface symptom — "user clicks doc, sees nothing." None surfaced until a
human ran the loop in production. This skill collapses that loop into a CLI
script you run before declaring ship-ready.

## When to invoke

**Required after** any change that touches:

- Inngest worker function bodies (`services/workers/src/functions/*`)
- Document processing (`packages/document-processing/*`)
- Storage helpers (`packages/storage/*`)
- Server actions that fire Inngest events (`*/lib/docs/upload.ts`, retry
  actions, etc.)
- Encryption/decryption (`packages/db/src/encryption.ts`,
  `packages/db/src/dek.ts`)
- Multi-step user flows (intake → docs → e-sign → payment)
- New /api/* routes
- DB schema migrations that change column shape

**Skip** for:

- Pure CSS / typography / layout
- Component-internal state with no DB touch
- Renames that don't change behavior

## Workflow

### Step 0 — read the feature, don't guess

Before writing anything, read the code being tested. Identify:

1. **The data path.** What enters? What persists? What leaves? Every hop is a
   potential failure point.
2. **The trust boundaries.** Where does data cross a process / service /
   network boundary?
3. **The silent-failure modes.** Where does code catch an error and convert
   it to `ok: false`? Where does it `throw` to a caller that doesn't log?

Output of this step: a list of 5-15 atomic checks, written down before any
test code. If you can't list them concretely, you don't understand the
feature yet — read more.

### Step 1 — locate the canonical template

The reference implementation is
[`services/workers/scripts/smoke-finalize.ts`](../../services/workers/scripts/smoke-finalize.ts).
Match its shape exactly:

- ANSI color constants at the top (`RESET`, `RED`, `GREEN`, `YELLOW`, `DIM`)
- A `Step` type with `{ label, ok, detail? }`
- A `logStep(label, ok, detail)` helper that appends to `steps[]` and prints
  `PASS  <label>  <detail>` or `FAIL  <label>  <detail>`
- A `main()` that returns 0 (all pass) or 1 (any fail)
- A trailing `━━ all N checks passed ━━` or `━━ N of N failed ━━`
- `process.exit(code)` from a top-level `.then()` so CI / shell can detect it
- `--apply` / `--dry` flag pattern for any test that mutates state

Do NOT invent a new structure. If you think the template is wrong, propose a
change to it FIRST and bring everyone along.

### Step 2 — file location

Put the script at one of:

- `services/workers/scripts/smoke-<feature>.ts` for anything touching workers
- `apps/<app>/scripts/smoke-<feature>.ts` for app-specific flows
- `packages/<pkg>/scripts/smoke-<feature>.ts` for package-level helpers

Naming: `smoke-<noun>.ts` — `smoke-finalize`, `smoke-classify`, `smoke-intake`.
Not `test-thing.ts`, not `verify.ts`, not `e2e.ts`.

### Step 3 — environment loading

Bun on Windows does NOT auto-source `.env.local`. Load env vars explicitly
from the script invocation, not from inside the script:

```bash
DBURL=$(grep -E "^DATABASE_URL=" .env.local | head -1 | cut -d= -f2-)
R2A=$(grep -E "^R2_ACCOUNT_ID=" .env.local | head -1 | cut -d= -f2-)
# … one line per var …
DATABASE_URL="$DBURL" R2_ACCOUNT_ID="$R2A" \
  bun run services/workers/scripts/smoke-<feature>.ts
```

The script itself reads `process.env.*` and fails fast with a clear error if
a var is missing. Don't paper over missing env with defaults — that's how
"works on my machine" lives.

### Step 4 — write checks that prove behavior, not structure

Bad checks (don't add):

- `expect(rows.length).toBeGreaterThan(0)` — passes on stale data
- `expect(typeof url).toBe('string')` — passes on empty string
- `expect(result.ok).toBe(true)` — passes if upstream silently swallowed

Good checks (always add when applicable):

- DB row at expected `parse_phase` / `status` (not just non-null)
- All required columns populated (one PASS per column)
- R2 object exists + size matches DB record
- Presigned URL returns HTTP 2xx with `Content-Type: application/pdf` (not
  text/plain or HTML error page)
- File magic bytes match expected format (`%PDF`, `\x89PNG`, etc.)
- `withTenant()` re-read returns the same row (proves RLS context, not just
  admin DB)
- Encryption round-trip if any field is encrypted

Each check must have a one-line `detail` string showing the actual value
when it passes — not `"passed"`. Future-you reading the output should be
able to spot regressions without a debugger.

### Step 5 — run it manually before declaring done

Run the script. Read the output. If 14/14 pass, commit. If any fail, FIX
the bug — don't relax the assertion.

```bash
DATABASE_URL=... R2_*=... bun run services/workers/scripts/smoke-<feature>.ts
```

Expected output shape (from real run on 2026-05-08):

```
━━ smoke-<feature> ━━
Target: <db-host>

  PASS  documents row at parse_phase=final  actual=final
  PASS  final_storage_key set  tenants/.../docs-final/...
  …
━━ all N checks passed ━━
```

Commit the script in the same change as the feature. Reference it in the
commit message:

```
fix(finalize): include documentId in final_storage_key + add smoke-test

…explanation…

Verification:
  bun run services/workers/scripts/smoke-finalize.ts
  → 14/14 PASS against prod
```

### Step 6 — when smoke fails, read the WHOLE output

The script emits PASS/FAIL per check. The first FAIL is rarely the root
cause — it's the first observable downstream. Read every FAIL line. Read
the DETAIL on adjacent PASS lines (a PASS with `size=0` is suspicious).

If multiple unrelated failures, the environment is broken (Neon cell down,
R2 region issue, key rotated). Diagnose infra first, then re-run.

## Voice + style requirements

The skill output and any code it produces must match Docket's house style:

- **No emoji** anywhere in script or commit messages.
- **No "AI vocabulary"**: avoid `delve`, `crucial`, `robust`, `comprehensive`,
  `nuanced`, `multifaceted`, `furthermore`, `moreover`, `pivotal`, `landscape`,
  `tapestry`, `underscore`, `foster`, `showcase`, `intricate`, `vibrant`,
  `fundamental`, `significant`. If a word is in this list, rewrite the
  sentence.
- **No em dashes** in code comments. Use `—` only in markdown explanation
  text.
- **Lead with the point.** Comments explain *why this code exists* and
  *what it protects against*, not what the next 10 lines literally do.
- **Concrete details, never generic.** "Was failing silently because Inngest's
  per-step output cap (~4MB) was being blown by base64-encoded image bytes"
  is right; "was failing under certain conditions" is wrong.
- **No TypeScript `any`.** If you genuinely need to bridge to an external
  type, use a structural type alias and document why at the declaration.
- **Prefer existing helpers** over re-implementing: `withTenant`, `getAdminDb`,
  `statObject`, `getPresignedDownloadUrl`, `asTenantId` / `asClientId`. Read
  what's already there before writing a util.

## Anti-pattern: "slap a check on the end"

The wrong way to use this skill:

> "I'll just call `getDocumentStatus` and assert it's 'final'."

That tells you the row exists in one state. It doesn't tell you the bytes
are in R2, the URL works, the PDF is valid, the RLS context resolves, or the
filename composition produced the right name. Each is its own check.

The right shape: **walk the same path the user does**, and assert at every
boundary. The smoke test is a customer-shaped test, not a unit test.

## Decision: when this skill is overkill

If the change is genuinely just a typo or an obvious refactor, write a TODO
in the commit instead of a smoke test:

```
TODO(smoke): add smoke-<feature>.ts when next non-trivial change lands
```

Don't burn 20 minutes writing a smoke test for a 1-line label change. But
the bar is "1-line label change," not "I think this works." The default
should be writing the test.

## Reference

Canonical template: [`services/workers/scripts/smoke-finalize.ts`](../../services/workers/scripts/smoke-finalize.ts)

Companion script (for stuck-state recovery): [`services/workers/scripts/reset-orphan-finalize.ts`](../../services/workers/scripts/reset-orphan-finalize.ts)

Ship-readiness rule (from CLAUDE.md §19):
> Verify in browser before declaring UI work done. Type checking and tests
> verify code correctness, not feature correctness.

Smoke tests close that gap. They're the *feature-correctness* check that
runs without a human in the loop.
