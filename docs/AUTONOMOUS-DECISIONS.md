# Autonomous Decisions Log

> *Decisions the AI made on its own that the user might want to review.*
> *Maintained per the [`/decisions-log`](../.claude/skills/decisions-log/SKILL.md) skill.*

## How to read this file

Each entry is a decision the AI made during autonomous work that crossed
into a "judgment call" category — naming, UX shape, scope cuts,
architecture trade-offs, security trade-offs, defaults, deferrals, doc
changes. The user reviews these periodically and either approves or
asks for reversal.

Every entry has the same shape (per the skill):
- **Decision**: one sentence
- **Reasoning**: 2-3 sentences naming the constraint
- **Alternative considered**: what was rejected and why
- **How to reverse**: specific files, env vars, or commits
- **Severity**: `low | medium | high | architectural`
- **Commit**: hash
- **User-review status**: `pending | reviewed-approved | reviewed-reversed`

`pending` is the default. Items not actively reversed within 7 days
are auto-marked `reviewed-approved` (silence is consent for low/medium
severity). High and architectural items require explicit user approval
before that auto-mark fires.

---

## [1] 2026-05-08 — Webhook verification: subpath export, not main barrel

**Decision**: `verifyTwilioSignature` / `verifySquareSignature` /
`verifyDocuSignSignature` are exported from `@docket/shared/webhooks`
(subpath), NOT from the main `@docket/shared` barrel.

**Reasoning**: The verifier imports `node:crypto`. Anything imported
from the main `@docket/shared` barrel pulls into both server AND
browser bundles. Including `node:crypto` in browser bundles breaks
client-side builds. Same risk shape as the existing inngest-client
subpath split. Codex review (HIGH severity finding) caught this on
the original commit; followup `00cd377` moved it.

**Alternative considered**: Re-export from main barrel; tell consumers
"don't import this in browser code." Rejected — discipline doesn't
scale, browser bundle would break the moment someone imports the wrong
thing for an unrelated reason.

**How to reverse**: Edit `packages/shared/src/index.ts` to add
`export * from './webhook-verification.js';` and remove the subpath
entry from `packages/shared/package.json`. Browser bundles will break.

**Severity**: architectural

**Commit**: `00cd377`

**User-review status**: reviewed-approved (2026-05-08)

---

## [2] 2026-05-08 — Test fixtures store intake answers PLAINTEXT, not encrypted

**Decision**: `packages/test-fixtures/src/fixtures.ts` stores intake
answer values (SSN, DOB, etc.) as plaintext in TypeScript objects.
Real prod intake_responses rows have specific fields encrypted via
`encryptFieldForTenant` + per-tenant DEK.

**Reasoning**: Fixtures use the IRS-reserved `000-XX-XXXX` SSN block
for fake taxpayers (Alice Tester / Bob Fixture / Carol Test). The
encryption flow exists to protect REAL PII; encrypting fake PII is
ceremony with no safety value. Tests that need to exercise the
encryption path explicitly call `encryptFieldForTenant` per-field.
The `decryptTree` read path passes unencrypted values through
unchanged, so reads still work in tests.

**Alternative considered**: Encrypt fixture answers using the seed
function before insert. Rejected — added complexity, fights tests
that want to read fixture values back, doesn't add safety.

**How to reverse**: Edit `packages/test-fixtures/src/seed.ts` to
encrypt each sensitive field via `encryptFieldForTenant(value, dek)`
before insert. Caveat: tests that read fixtures back will need to
call `decryptFieldForTenant` to get plaintext.

**Severity**: medium

**Commit**: `605ba26`

**User-review status**: pending

---

## [3] 2026-05-08 — Sentry: single project covers both apps with `app:` tag

**Decision**: One Sentry project (`noctworks/javascript-nextjs`)
receives events from both Next.js apps. Events are differentiated by
`tags.app = command-room | portal` plus `tags.runtime = nodejs |
edge | browser`. The user can filter by `app:portal` etc. in the
Sentry dashboard.

**Reasoning**: Sentry's free tier has a 5K events/month limit per
account, not per project, so splitting projects doesn't change the
volume budget. Single project means one DSN to manage in Vercel env,
one alert config, one issue stream to triage. Per-app projects make
sense if event volume justifies splitting, which it doesn't yet at
v0/v1 traffic.

**Alternative considered**: Two Sentry projects, one per app. Rejected
because of operational overhead (two DSNs, two alert configs, two
release-tracking flows) without proportional value at current volume.

**How to reverse**: Create a second Sentry project, add a separate
DSN env var (e.g., `SENTRY_DSN_PORTAL`), point client-portal's
`sentry.*.config.ts` files at that DSN, leave command-room on the
existing DSN. Update `instrumentation-client.ts` and the two server-
side configs in client-portal. The `tags.app` initial scope can be
removed from configs but isn't load-bearing once projects are split.

**Severity**: medium

**Commit**: `a122ae5`

**User-review status**: pending

---

## [4] 2026-05-08 — Bedrock model IDs use `us.anthropic.claude-*` cross-region inference profile

**Decision**: When the orchestrator wires Bedrock fallback, it'll use
model IDs prefixed `us.` (cross-region inference profile) — e.g.,
`us.anthropic.claude-sonnet-4-5-20250929-v1:0` — rather than single-
region IDs.

**Reasoning**: Bedrock's `us.` prefix routes to whichever AWS region
in the US has capacity (us-east-1 / us-east-2). Built-in resilience
without code changes — if us-east-1 has a capacity hiccup, requests
flow to us-east-2 automatically. Single-region IDs (`anthropic.claude-*`)
fail entirely if that region is down. We tested both Sonnet 4.5 and
Haiku 4.5 via the `us.`-prefixed IDs from local; both responded.

**Alternative considered**: Pin to a specific region for predictability.
Rejected — predictability isn't worth the resilience trade-off, and
Bedrock cross-region pricing is identical.

**How to reverse**: Edit `services/orchestrator/src/providers.ts`
(when wired) to drop the `us.` prefix. Will lock the orchestrator to
us-east-1 only.

**Severity**: medium

**Commit**: pending (orchestrator wiring not yet shipped)

**User-review status**: pending

---

## [5] 2026-05-08 — Neon read replica created in same cell (us-east-1 c-6); regional resilience deferred to V1.5

**Decision**: The read replica connection string lives at host
`ep-old-mode-anwgopqy-pooler.c-6.us-east-1.aws.neon.tech` — same
cell as the primary's `c-6.us-east-1`. Neon's Launch tier UI doesn't
expose a region selector for replicas; multi-region replicas require
a higher Neon tier or logical replication setup.

**Reasoning**: Tonight's Neon Cell 6 outage would still kill us with
this same-cell replica — both primary and replica live in the same
fault domain. The replica still buys connection-pool resilience under
load (read load distributed across primary + replica). True regional
resilience is a V1.5 problem per PRODUCTION-READINESS §A.

**Alternative considered**: Don't create a replica until we can do
multi-region. Rejected — same-cell replica is still a strict upgrade
over no replica, and the orchestrator wiring to use the replica URL
will land before V1.5 anyway.

**How to reverse**: Delete the replica via Neon dashboard. Remove
`DATABASE_URL_READ_REPLICA` from `.env.local` + both Vercel projects.

**Severity**: medium

**Commit**: config-only, no commit (env vars)

**User-review status**: pending

---

## [6] 2026-05-08 — OCR (Tesseract) bypassed by default; opt-in via `DOCKET_ENABLE_OCR=1`

**Decision**: `processDocument` and `processMultiPage` in
`@docket/document-processing` skip the Tesseract OCR step unless
`DOCKET_ENABLE_OCR=1` is set in the environment. Default behavior
produces binarized image-only PDFs (no searchable text layer).

**Reasoning**: Tesseract.js v7 in Vercel serverless emits
"Uncaught Exception: Runtime…" from inside its worker thread. The
exception bypasses our try/catch (worker-thread exceptions propagate
as uncaught and kill the lambda). Every finalize attempt died.
Real fix is replacing Tesseract with Claude Vision OCR or AWS
Textract; that's a V1.5+ swap. Bypass is the immediate unblock —
binarized B&W PDF still provides the visual review surface; loss of
in-PDF text search is acceptable because AI-extracted fields are
already searchable in command-room.

**Alternative considered**: Try harder to wrap Tesseract in a
worker-isolation that catches its exceptions. Rejected — Node's
worker-thread exception propagation can't be cleanly caught from
the parent without a child process, which Vercel serverless
doesn't support well.

**How to reverse**: Set `DOCKET_ENABLE_OCR=1` in Vercel env. The
existing fall-back-to-`wrapImageInPdf` path on OCR error is still
wired, so re-enabling Tesseract just means the lambda will try
Tesseract first and fall back if it fails (same as before).

**Severity**: high

**Commit**: `b81808b`

**User-review status**: reviewed-approved (2026-05-08) — APPROVE FOR V1; V1.5 swap to Claude Vision OCR or AWS Textract is the structural fix. Tracked in PRODUCTION-READINESS as v1.5 work.

---

## [7] 2026-05-08 — iframe sandbox dropped from PDF preview because Chrome viewer broke

**Decision**: The PDF preview `<iframe>` in
`apps/command-room/src/components/document-preview.tsx` has NO
`sandbox` attribute. The P3 hardening commit had set
`sandbox="allow-scripts allow-same-origin"`, but Chrome's native PDF
viewer broke under that combination — rendered as a broken-image icon
instead of the PDF.

**Reasoning**: `referrerPolicy="no-referrer"` stays (so R2 logs don't
carry our URLs), but the sandbox is gone. Threat model: admin viewing
docs they processed; R2 only serves files we put there; "malicious
PDF redirecting the parent window" requires a tenant-internal upload,
which is a bigger problem than navigation hijacking.

**Alternative considered**: Add more sandbox flags incrementally
(`allow-popups`, `allow-top-navigation-by-user-activation`, etc.) to
find a combination that lets the PDF viewer work. Rejected — that
combination is the same privilege as no sandbox; there's no middle
ground that lets PDFs render but blocks navigation tricks.

**How to reverse**: Add `sandbox="allow-scripts allow-same-origin"`
back to the iframe in document-preview.tsx. Chrome will show the
broken-image icon again.

**Severity**: medium

**Commit**: `ea32333`

**User-review status**: pending

---

## [8] 2026-05-08 — R2 storage key includes `documentId/` to prevent collision

**Decision**: `final_storage_key` is now of the shape
`tenants/{tenantId}/clients/{clientId}/docs-final/{documentId}/{finalFilename}`.
Previously it was `tenants/.../docs-final/{finalFilename}`. The
`{documentId}` segment makes collisions impossible across docs.

**Reasoning**: When the same client uploads two docs that the AI
gives the same suggested filename (e.g., user uploads their DL into
multiple slots), the second R2 PUT overwrites the first. Both DB
rows then point at the same R2 object. The user-facing test case
(same DL twice) didn't manifest as data loss but two real W-2s for
two employers that the AI happened to name `2024_W-2_Acme.pdf` twice
WOULD silently lose one.

**Alternative considered**: Append a hash or ULID to the filename
itself. Rejected — uglier user-facing storage path, harder to
correlate during ops debugging.

**How to reverse**: Edit `services/workers/src/functions/finalize-document.ts`
process-and-upload step to remove `${documentId}/` from the
finalStorageKey construction. New uploads will collide on same
filenames; existing uploads with the documentId segment in the path
will continue to work.

**Severity**: medium

**Commit**: `1576ef0`

**User-review status**: pending

---

## [9] 2026-05-08 — Sentry test endpoints will be REMOVED before public launch

**Decision**: `apps/command-room/src/app/api/sentry-test/route.ts`
and `apps/client-portal/src/app/api/sentry-test/route.ts` are flagged
in commit messages, source comments, AND PRODUCTION-READINESS.md §B
as "remove before public launch."

**Reasoning**: The endpoints deliberately throw to verify Sentry
captures errors. They self-guard with a non-secret query flag
(`?flag=verify-sentry-2026-05-08`), which is obscurity-not-auth and
sufficient for the verification phase. Leaving them in production
post-launch creates a free DoS amplifier (anyone with the URL can
trigger 500s + Sentry events) and pollutes the error dashboard.

**Alternative considered**: Real auth-gated Sentry verification
(would require Clerk session). Rejected for v0 — defeats the curl-
based verification path during deploy testing. Public launch is
the right time to remove or auth-gate.

**How to reverse**: Delete both `route.ts` files + remove
`/api/sentry-test(.*)` from both apps' middleware `isPublicRoute`
matchers. Tracked as TODO in PRODUCTION-READINESS §B.

**Severity**: low

**Commit**: `a122ae5` (created), `95e2629` (middleware allowlisted)

**User-review status**: pending

---

## [10] 2026-05-08 — Three project skills mandate the build cycle

**Decision**: `.claude/skills/{smoke-test, code-quality, edge-cases,
decisions-log}/SKILL.md` form an opinionated build-cycle pipeline:
plan → /edge-cases → implement → /code-quality → commit → push →
verify deploy → /smoke-test if applicable → next item. /decisions-log
runs alongside every commit.

**Reasoning**: Tonight's session surfaced the autopilot drift
problem in real time — webhook verification rich, test fixtures
thinner, sentry wiring shipped without verification. The skills
encode senior-engineer discipline as runnable checklists rather
than relying on the model to remember to be careful.

**Alternative considered**: Trust the model to self-correct.
Rejected — the user explicitly called out the drift before it
manifested, the codex review fixup pattern proved the gates work.
Discipline is structural, not willpower.

**How to reverse**: Delete `.claude/skills/{name}/SKILL.md`. Loses
the structured pre-commit / pre-implementation / E2E checks. Or
soften the skills (lower the bar) by editing them.

**Severity**: architectural

**Commit**: `a91f165` (code-quality), `b430887` (edge-cases + decisions-log), `7e59c58` (Step 7 added to code-quality)

**User-review status**: reviewed-approved (2026-05-08)

---

## [11] 2026-05-08 — AUTONOMOUS-PROTOCOL.md is the bootloader, not just docs

**Decision**: `docs/AUTONOMOUS-PROTOCOL.md` is the FIRST canonical doc
listed in `CLAUDE.md` §23 — ahead of PRODUCT-ROADMAP, POSITION-FRAMEWORK,
MEMORY-ARCHITECTURE, PRODUCTION-READINESS. Re-read at every session
start, especially after context refreshes. Defines the four-skill
build cycle, recovery sequence after window-fill, end-of-session
ritual.

**Reasoning**: The four skills (entry [10]) only work if a fresh-
context-me actually reads them and runs them at every wake-up.
The protocol doc is the bootloader. User's load-bearing constraint:
"whenever there's context refreshes because window fills up, make
sure the skills work every time. every time. every time."

**Alternative considered**: Embed the recovery sequence inline in
each skill's `SKILL.md`. Rejected — duplicates the same instructions
four times, and no single "what to do RIGHT NOW after a context
refresh" entry point would exist. The bootloader belongs in one place.

**How to reverse**: Delete `docs/AUTONOMOUS-PROTOCOL.md` and remove
the reference from `CLAUDE.md` §23. Loses the explicit recovery
sequence; future fresh-context-mes might skip skills "because we're
catching up." Exactly the failure mode the user called out.

**Severity**: architectural

**Commit**: this commit

**User-review status**: reviewed-approved (2026-05-08)

---

## [12] 2026-05-08 — client_facts.source_tier is text, not an enum

**Decision**: `client_facts.source_tier` (migration 0021) is `text NOT NULL`
with documented v1 vocabulary in the migration header
('client_assertion', 'third_party_doc', 'irs_transcript', 'computed',
'firm_correction'). Not a Postgres enum.

**Reasoning**: The vocabulary will grow as fact-extraction sources expand
(QBO sync, computed-from-bookkeeping, partner-firm-imports). Each new
source type would otherwise need an `ALTER TYPE` migration. The
existing `messages.channel` and `messages.direction` columns follow the
same text-not-enum pattern for the same reason. App-layer enum (TS
union type) gives the typecheck-time safety without the schema-cost.

**Alternative considered**: Postgres enum `client_fact_source_tier`.
Rejected — rigid enum-set vs growing-vocabulary mismatch, costs of
ALTER TYPE migrations during the v1 build cycle.

**How to reverse**: Add a Postgres enum + alter the column. Will need
an UPDATE-cast for existing rows. Backwards-compat fine because the
v1 vocabulary is small.

**Severity**: low

**Commit**: this commit (migration 0021)

**User-review status**: pending

---

## [13] 2026-05-08 — client_facts cross-tenant FK enforced via composite FK + trigger

**Decision**: Migration 0021 enforces cross-tenant integrity on
`client_facts` via a composite FK `(tenant_id, client_id) REFERENCES
clients(tenant_id, id)` plus a trigger
(`enforce_client_facts_bindings`) for `source_action_id` and
`superseded_by` chain integrity. The trigger validates that
`source_action_id`'s `actions.tenant_id` matches the row's tenant, and
that `superseded_by`'s target row matches `(tenant_id, client_id,
fact_key)`. ALTER on `clients` and `actions` adds
`UNIQUE(tenant_id, id)` to support the composite FK target.

**Reasoning**: Codex review on the initial draft surfaced HIGH severity
"FK validation is RLS-bypass — single-column tenant_id FK lets app
bugs cross-tenant-bind a client_id." Composite FK closes that loophole
at the DB level. Same-tenant trigger handles cases composite FK can't
express (ON DELETE SET NULL on a single column without nulling the rest;
4-column chain integrity).

**Alternative considered**: Single-column FKs only + RLS reliance.
Rejected per codex HIGH. Trigger-only (no composite FK). Rejected
because composite FK is enforced at INSERT time and is impossible to
bypass; trigger could theoretically be `DISABLE`d for a maintenance
operation.

**How to reverse**: Drop the composite FK + trigger; revert to
single-column FKs. Loses cross-tenant guarantee. Existing code paths
that wrote correct (tenant_id, client_id) pairs continue to work.

**Severity**: architectural

**Commit**: this commit (migration 0021)

**User-review status**: reviewed-approved (2026-05-08)

---

## [14] 2026-05-08 — Audit-trail chain uses chain_seq, not created_at, for ordering

**Decision**: Migration 0022 introduces a per-tenant `chain_seq bigint`
column to define chain order, rather than ordering by `created_at`.
Chain_seq is assigned by the BEFORE INSERT trigger under the per-tenant
advisory lock as `MAX(chain_seq) + 1` for that tenant.

**Reasoning**: Codex review HIGH on the first draft (which used
created_at) noted that two same-tenant transactions can serialize
correctly under the advisory lock yet still have out-of-order
created_at values (transaction_timestamp() can race in either
direction). chain_seq is assigned monotonically while the lock is
held, so order is unambiguous regardless of timestamp.

**Alternative considered**: Postgres global sequence
(`nextval('actions_chain_seq')`). Rejected — gives global ordering,
not per-tenant. Two tenants would interleave chain_seq values which
is harder to reason about. Per-tenant MAX+1 under the advisory lock
gives clean per-tenant 1..N sequences.

**How to reverse**: Drop the trigger and the chain_seq column. Chain
becomes unverifiable on legacy data. Not recommended.

**Severity**: architectural

**Commit**: this commit (migration 0022)

**User-review status**: reviewed-approved (2026-05-08)

---

## [15] 2026-05-08 — client_id excluded from audit-chain hash (CCPA compatibility)

**Decision**: `actions.client_id` is NOT included in the canonical
hash computation in migration 0022. Every other action column
(except chain_seq itself, which is computed) IS included.

**Reasoning**: Migration 0012 carved out an exception in the
append-only trigger to allow `actions.client_id` to be UPDATEd from
non-NULL to NULL when a client is deleted (CCPA right-to-delete
preserves the audit row but anonymizes the PII linkage). If
client_id were in the hash, every legitimate client deletion would
invalidate the chain — verify_actions_chain would report tampering
on every delete operation.

**Alternative considered**: Include client_id; on each CCPA delete,
re-run the migration's trigger-drop / backfill / trigger-recreate
sequence. Rejected — operationally fragile, makes every CCPA delete
a multi-step DBA operation.

**Trade-off**: An attacker with DDL access could change client_id
without detection by the chain. The only mutation actually
permitted is non-NULL → NULL (per migration 0012's tightened
trigger), so the attack surface is limited to "anonymizing audit
rows that were associated with a deleted client." That's the same
mutation a legitimate CCPA flow does. Application-layer audit logs
the action that triggered each NULL'ing.

**How to reverse**: Add p_client_id parameter back to
actions_canonical_for_hash; revert deletion semantics to either
forbid the cascade or accept chain breakage on each delete.

**Severity**: architectural

**Commit**: this commit (migration 0022)

**User-review status**: reviewed-approved (2026-05-08)

---

## [16] 2026-05-08 — E2E OTP bypass via env-gated /api/e2e-bypass endpoint

**Decision**: `apps/client-portal/src/app/api/e2e-bypass/route.ts` ships
a production-deployed endpoint that bypasses Clerk OTP verification
when FOUR independent env gates pass simultaneously: `E2E_BYPASS_ENABLED=true`,
`E2E_TEST_PHONE` matches, `E2E_TEST_OTP` matches, AND
`E2E_ALLOW_PROD_BYPASS=true` (the prod-acknowledgment gate). On
success, generates a Clerk sign-in token; the login page detects
`?ticket=<token>` and consumes it via `signIn.create({strategy:
'ticket', ticket})`.

**Reasoning**: Playwright UI e2e against `docket-portal.vercel.app`
needs auth without real Twilio SMS / real Clerk OTP. Clerk's "test
phone numbers" feature exists in the dashboard but the UI was
reorganized in 2025 and the user couldn't find it before sleep. App-
level bypass is a fallback. The four-gate design means the code is
DORMANT in any deploy without ALL FOUR env vars set; setting the prod-
acknowledgment to `false` instantly disables without redeploy.

**Alternative considered**: Clerk dashboard test-phone (the user-side
move; tracked as a removable-when-found item). Mock Clerk in-app via
session-token forge (more invasive). Skip Playwright entirely tonight
(loses UI composition coverage).

**How to reverse**: Per [`PRODUCTION-READINESS.md`](PRODUCTION-READINESS.md)
pre-public-launch removal checklist: delete the route handler, delete
the `/api/e2e-bypass` allowlist line in middleware, delete the ticket-
consumption useEffect in the login page, unset the four env vars. The
removal is a 5-line commit. The Playwright tests can stay — they
auto-skip without the bypass.

**Severity**: architectural (security-sensitive surface in production
deploy)

**Commit**: `4723b25`

**User-review status**: reviewed-approved (2026-05-08) — APPROVE-FOR-NOW with explicit removal commitment per PRODUCTION-READINESS pre-public-launch checklist; reverse the moment Clerk's test-phone setting is found in the dashboard

---

*Last updated: 2026-05-08. Backfilled from session start; subsequent
decisions get appended in real-time per the /decisions-log skill.*
