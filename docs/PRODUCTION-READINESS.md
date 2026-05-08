# Production Readiness

> *Tonight Neon went down for 30 minutes and both apps 500'd.*
> *Tax season is 9 months away.*
> *This document is the punch list.*

This file lives between aspirational ("our architecture is bulletproof") and actual ("an IG ad just told the world that AI cost a CPA's client $2M"). It's the gap. Each item has a priority, an effort estimate, an owner placeholder, and a clear test for "done."

Re-read this when shipping any change near production. Knock items off in priority order.

---

## Priority tiers

- **V1 must-have** — fix in next 12 weeks (by 7/30/2026 launch). These are the ones whose absence got us 500ing tonight or whose absence would 500 us in the next 90 days.
- **V1.5 must-have** — fix before Antonio's full client base hits production volume + before Feb 2027 tax season.
- **Pre-tax-season runbook** — January 2027 hardening sprint.
- **Deferred** — known gap, not yet load-bearing.

Each item: `[priority] description (effort) → done criterion`

---

## A. Resilience (vendor-outage defense)

The 9-month plan to not get caught by tax-season vendor failures.

### V1 must-have

- `[V1]` **Anthropic + Bedrock fallback in `runDocketAgent`** (2d) → All agent calls complete via Bedrock when Anthropic returns 5xx/429. Test: set ANTHROPIC_API_KEY=invalid in staging, verify smoke tests pass via Bedrock. Bedrock supports prompt caching natively, no cost penalty.
- `[V1]` **Neon read replica in us-east-2** (1d) → Drizzle reads route to replica via separate connection string; writes route to primary. Tonight's Cell 6 outage would have continued serving reads. ~$10/mo extra.
- `[V1]` **Status-aware UX banner** (1d) → `/api/health` returns per-service status. UI banner subscribes. Per-service degradation messages: "AI is recovering, your draft will be ready in a moment" — never silent failure.
- `[V1]` **Async-first audit on every server action** (2d) → Walk every `'use server'` action. Refactor synchronous Anthropic calls to fire Inngest events + return optimistic response. Only pre-signature checklist remains synchronous (intentional UX block).
- `[V1]` **DB write-failure → read-only mode** (1d) → Three consecutive write failures → flip flag → UI banner "Saving paused, viewing only" → all write actions disabled in UI. Antonio can still review existing data.

### V1.5 must-have

- `[V1.5]` **R2 cross-region replication** (1d + $20/mo) → Either R2's built-in cross-region replication OR nightly R2 → S3 cold storage. Restorable within 1hr. (Was deferred earlier as #12; reverting that decision after tonight's Neon outage proved infra outages are routine.)
- `[V1.5]` **Multi-cloud DB hot standby** (5d + $80/mo) → AWS RDS Postgres as warm standby behind Neon. Logical replication via WAL. Failover via DNS swap if Neon outage exceeds 1hr. Recovery objective: <30min from decision to flip.
- `[V1.5]` **Inngest event durability** (2d) → Server actions write to local `pending_events` table BEFORE pushing to Inngest. Background sweeper retries failed pushes. Events never lost during Inngest outage.
- `[V1.5]` **Twilio fallback (AWS SNS or MessageBird)** (1d) → SMS OTP + magic-link delivery still works during Twilio outage.
- `[V1.5]` **Clerk → email-OTP fallback** (1d) → If Twilio is down, auth falls back to email-only OTP through Clerk's existing email channel. (If Clerk itself is down, no easy fix; rely on Clerk's 99.99% SLA.)
- `[V1.5]` **Local IndexedDB cache for active engagements** (3d) → Active client's data cached client-side. <1hr backend outage doesn't kill Antonio's current work; actions queue locally, replay on recovery.

### Pre-tax-season runbook (Jan 2027)

- **Failover dry runs**: deliberately disable each vendor in staging, time the recovery, document gaps.
- **War-room runbook**: 1-3 pages per vendor. "Anthropic 503 → check status page → if confirmed, flip env flag → monitor recovery."
- **Feature pause**: aggressive features off Feb 1 - April 16 (multi-step automations, voice if shipped, experimental anything).
- **Vercel pre-season scaling**: pre-warm functions, increase memory allocation on doc-pipeline routes, set ISR where applicable.
- **Rolling backup verification**: weekly during tax season, restore prior week's backup to staging, smoke-test.

---

## B. Observability + cost control

The stuff that lets you sleep during tax season.

### V1 must-have

- `[V1]` **Sentry DSN configured** (0.5d) → CLAUDE.md flagged Sentry installed but no DSN. Errors silently disappear after Vercel runtime log roll-off. Configure DSN, sourcemap upload, release tagging.
- `[V1]` **Cost dashboard + outlier alerts** (2d) → Daily cost summary email. Alert on any single call >$0.50. Alert on day-over-day cost spike >50%. Use existing `cost_telemetry` rows from `runDocketAgent`.
- `[V1]` **Audit trail with cryptographic chaining** (1d) → Each `actions` row stores `prev_hash` (hash of prior row) + `row_hash` (hash of self + prev). Verification job runs nightly. Tampering becomes detectable. Defends against the IG-ad-scenario "AI silently destroyed 7 years of data."

### V1.5 must-have

- `[V1.5]` **Per-tenant cost analytics in command-room** (2d) → Antonio sees his per-month AI spend, per-agent breakdown, per-client cost. Useful for billing and for cost discipline.
- `[V1.5]` **Inngest run dashboard** (1d) → Show stuck/failed runs in command-room admin. Click-to-retry button (calls `reset-orphan-finalize` semantics).

---

## C. Testing infrastructure

How we know things actually work before users find out they don't.

### V1 must-have

- `[V1]` **Staging environment** (1d) → Neon branch + R2 staging bucket + Vercel preview that mirrors prod schema with fixture data. All risky changes test here first. Massive risk reduction.
- `[V1]` **Test fixtures package** (1d) → `packages/test-fixtures/`: 5 sample docs (DL, W-2, 1099-NEC, 1099-INT, 1098-T), 2-3 mock clients, 1 mock tenant. Smoke tests seed these into staging.
- `[V1]` **Agent eval harness** (3d) → `services/workers/scripts/eval-classify.ts`, `eval-discovery.ts`, etc. Each runs 50 fixture docs through the agent, scores against expected outputs (LLM-as-judge or manual gold), reports F1. Run on every PR via GitHub Action. Without this, prompt regressions go undetected for weeks.
- `[V1]` **Smoke test coverage extension** (2d) → Beyond finalize: smoke tests for intake completion, e-sign flow, payment flow, doc upload flow, classify flow. Each ~half day.
- `[V1]` **Load testing** (0.5d) → Antonio's full book = 200 clients × 12 months × ~5 docs = ~12K docs. Test pipeline at 1000+ concurrent uploads before pointing his real volume at it.

### V1.5

- `[V1.5]` **Visual regression testing** (2d) → Playwright snapshots of key UI surfaces. Catches CSS regressions that typecheck doesn't.
- `[V1.5]` **Per-tenant fuzz testing** (2d) → Generate adversarial inputs against intake/upload/RLS. Verify zero cross-tenant leakage even under malicious payloads.

---

## D. Security + compliance

The stuff that keeps the PTIN safe.

### V1 must-have

- `[V1]` **Webhook signature verification helper** (1d total) → DocuSign, Square, Twilio, Inngest webhooks accept any POST today. Anyone with the URL can spoof events. Wrote helper, wire across endpoints.
- `[V1]` **Trust gate enforcement code** (3d) → CLAUDE.md mentions "trust gate scaffolding" but no enforcement. Code that gates auto-execution at the position-tier level. Without this, future deploy could ship aggressive auto-actions accidentally. Spec in [POSITION-FRAMEWORK.md §6](POSITION-FRAMEWORK.md).
- `[V1]` **PII regex scrubbing on inbound text** (1d) → SMS/email ingest scans for SSN/EIN/bank-account/DL-number patterns. Matched tokens replaced with `[REDACTED-SSN]` markers BEFORE artifact gets fact-extracted or vector-indexed. Original encrypted via per-tenant DEK in `actions`.
- `[V1]` **§7216 consent UI add-on** (0.5d) → Existing consent screen adds "consent to SMS communication" checkbox. Wording approved by tax co-founder once hired. Required before text-mode launch.

### V1.5 must-have

- `[V1.5]` **Encryption KEK rotation procedure** (2d) → Per-tenant DEK exists. KEK rotation is TODO in CLAUDE.md. If KEK leaks, every tenant DEK compromised. Document zero-downtime rotation: write new KEK → re-wrap DEKs → retire old KEK. Test against staging.
- `[V1.5]` **Data export endpoint per CCPA/GDPR** (2d) → `/api/client/export` bundles a client's artifacts into ZIP. CA residents have right to data export within 45 days. Test against fixture client.
- `[V1.5]` **Soft-delete in production** (1d, currently DEFERRED for dev) → All delete server actions UPDATE `deleted_at = now()` and queries `WHERE deleted_at IS NULL`. Single SQL helper handles split. Dev/test continues to use hard `DELETE` until v1.5.
- `[V1.5]` **Rewind primitive** (3d) → UI surface where Antonio sees "AI did X at time Y. Reverse?" Walks `actions` chain to undo. The IG-ad-scenario defense, made user-facing. Sticky feature + bulletproofness combined.

### Pre-tax-season

- **Secret rotation procedures**: 1-page runbook per secret (Anthropic key, Bedrock key, Twilio key, R2 keys, INNGEST_SIGNING_KEY, INNGEST_EVENT_KEY, Clerk keys, DocuSign key, Square key, AWS keys for backup). Annual rotation cadence + ad-hoc rotation if leaked.

### Pre-public-launch removal checklist

Items to delete / disable before any unauthenticated traffic hits the
deployed apps. Each is intentionally a v1-build-time backdoor or
debugging affordance; each becomes a security liability the moment
the product ships to non-design-partner users.

- **`/api/sentry-test` (both apps)** → Delete the route handlers + the `/api/sentry-test(.*)` allowlist line in each app's `src/middleware.ts`. The endpoints deliberately throw 500s + write to Sentry; leaving them in prod creates a free DoS amplifier + dashboard pollution.

- **`/api/e2e-bypass` (client-portal)** → Delete `apps/client-portal/src/app/api/e2e-bypass/route.ts`, the `/api/e2e-bypass` allowlist line in `apps/client-portal/src/middleware.ts`, and the ticket-consumption useEffect in `apps/client-portal/src/app/(auth)/login/page.tsx`. Also unset `E2E_BYPASS_ENABLED`, `E2E_TEST_PHONE`, `E2E_TEST_OTP`, `E2E_ALLOW_PROD_BYPASS` from Vercel env. The four-gate design means the code is dormant without all envs set, but ripping the code is the SOC-2-compliant move.

- **Mock 8879 route** (`apps/client-portal/src/app/portal/sign-8879/page.tsx`) → DocuSign + LexisNexis KBA replaces this in the v1 build. The mock is gated behind `NEXT_PUBLIC_ENABLE_MOCK_8879=true` (dev only) but the file should go.

- **Trial fonts** in `apps/client-portal/public/fonts/trial/` → License forbids commercial use; trial expires 5/14/2026. License OR revert before launch.

- **Hardcoded "Vazant Consulting" / "Antonio Vazquez" copy** in `apps/client-portal/src/app/(intake)/welcome/content.tsx`, `apps/client-portal/src/app/page.tsx`, `apps/client-portal/src/app/(intake)/deposit/page.tsx`. Marked TODO(multi-firm); load-bearing once tenant #2 onboards.

Each removal should be its own commit so the diff is reviewable; the four together are the launch-day cleanup.

---

## E. Developer process

The stuff that makes shipping safe.

### V1 must-have

- `[V1]` **Migration coordination runbook** (1d) → Migrations run manually since the Neon CONNECT_TIMEOUT removed migration from vercel-build. Need: idempotent migration runner + rollback procedure + staging-first discipline.
- `[V1]` **Prompt version control** (2d) → System prompts in TS files have no history. Move to `prompts/` registry with versioned Markdown files + wrapper that loads by version. A/B testing supported.
- `[V1]` **Inngest deploy drain procedure** (0.5d) → Mid-finalize deploy loses in-flight runs. Document procedure: pause new dispatches → drain queue → deploy → resume.
- `[V1]` **`/smoke-test` skill enforced** (already shipped, 0d) → Every change to Inngest workers / document processing / storage helpers / encryption / multi-step flows / new API routes runs `/smoke-test` before commit. The skill already exists at `.claude/skills/smoke-test/`.

### V1.5

- `[V1.5]` **Race-condition tests for concurrent finalize** (1d) → Per-doc concurrency lock works. Per-tenant DB connection pool exhaustion under burst load doesn't. Test 30 simultaneous finalize requests; measure pool utilization.

---

## F. Memory + ambient AI substrate

Cross-references with [`docs/MEMORY-ARCHITECTURE.md`](MEMORY-ARCHITECTURE.md).

### V1 must-have

- `[V1]` **Schema migrations 0019-0021** (1d) → `firm_profile`, `firm_patterns`, `client_facts` tables. Bedrock for AI memory layers 4 + 6.
- `[V1]` **Context assembler with 5 agent recipes** (3d) → Single `assembleContext()` function. All agents call it. Per-agent memory recipes documented.
- `[V1]` **Aggressive prompt caching wired into `runDocketAgent`** (1d) → Cache markers placed at static/dynamic boundary. Cache-hit rate logged in cost telemetry. Cache TTL rolling 5min.
- `[V1]` **Fact extraction on artifact write** (3d) → Background Inngest job extracts atomic facts from new artifacts. Writes to `client_facts` with confidence + source. Discovery agent queries facts directly instead of re-parsing artifacts.

### V1.5

- `[V1.5]` **Cascade summarization (Hot → Warm → Cold)** (3d) → Nightly job demotes 30+ day artifacts to Warm tier (structured + summary), 1+ year to Cold (structured only, raw archived to R2).
- `[V1.5]` **Hierarchical summary index** (2d) → Daily/weekly/monthly/quarterly/yearly summary chains.
- `[V1.5]` **Active curation surface** (3d) → Weekly digest "confirm these patterns, drop these stale facts" in command-room.
- `[V1.5]` **Edit-diff feedback loop** (2d) → Track AI-draft vs human-sent diffs. Background extracts patterns into procedural memory.

---

## G. Deferred (known gaps, not yet load-bearing)

These are real but defensibly deferrable. Track here so they don't get forgotten.

- **Multi-region Vercel deployment**. Vercel SLA is 99.99%; the tail risk is small. Revisit if we hit Vercel-specific outages.
- **Self-hosted Inngest**. Inngest.dev open-source exists. Adds ops burden. Wait until our scale requires it (probably 1000+ daily runs).
- **Cross-firm anonymized aggregation infrastructure** (network effects). Build for v2; design data structures now per [MEMORY-ARCHITECTURE.md §8](MEMORY-ARCHITECTURE.md).
- **Differential-privacy on cross-firm patterns**. V2 problem.
- **SOC 2 Type II audit**. ~6+ months of work, not in v1 scope. Defer until first compliance customer asks.

---

## H. Open questions / gaps with no clear owner

These need decisions before they have line items:

- **Tax co-founder hire.** [CLAUDE.md §21](../CLAUDE.md) flags this as the most important hire — gates the playbooks/ontology/review policies. No timeline yet. Without this, position-framework's tier classifications + 50 seeded positions are AI-generated, not expert-validated. Risk: shipping a tier-2 position that should have been tier-3.
- **Insurance**. Does Docket carry E&O / Cyber / Tech-pro liability? Recommended before Antonio's real client data lands. Needed before v1.5 mid-market partner #2 onboarding. Estimate: $10-30k/yr depending on coverage.
- **Terms of Service + DPA**. Multi-tenant B2B SaaS needs a Master Services Agreement, Data Processing Addendum, AUP. Standard YC template gets us 80% there.
- **HIPAA-eligible Twilio account**. Tax data isn't strictly PHI but adopting HIPAA-eligible posture is good defensive shape. Adds ~$20/mo.

---

## I. The IG-ad-scenario defense (specific)

The user reported an Instagram ad: "AI almost cost my client $2M because it stripped 7 years of data classification." The structural defense:

1. **Audit trail INSERT-only with cryptographic chaining** (V1) — destructive operations are detectable.
2. **AI never auto-executes destructive operations above Tier 1** — position framework refusal floor (V1).
3. **Pre-signature checklist** — human review before irreversible actions (V1).
4. **Rewind primitive** — every AI write reversible from audit log (V1.5).
5. **Position framework refusal floor** — AI refuses below Reasonable Basis (V1, in framework doc).
6. **Soft-delete in production** — destructive UI actions are recoverable (V1.5).
7. **Backups + R2 cross-region replication** — even total infra failure is recoverable (V1.5).

The marketing handle: **"Docket is the tax AI where every action is reversible and audit-defensible. The only one."**

---

## J. Status (as of 2026-05-08)

Tonight shipped tonight: doc pipeline, position framework doc, smoke-test skill + framework, R2 collision fix, Bedrock-fallback decision, this doc.

**Next priorities by week**:
- Wk 1 (now): Bedrock fallback, staging environment, fixture package, Sentry DSN, webhook verification
- Wk 2: Eval harness, schema migrations 0019-0021, context assembler, aggressive prompt caching
- Wk 3: Fact extraction, status-aware UX, async-first audit, audit trail crypto chaining
- Wk 4-5: Trust gate enforcement, PII scrubbing, prompt versioning
- Wk 6: Discovery agent end-to-end + run on Antonio's book (the v1 wedge)

---

*Last updated: 2026-05-08. Reviewed alongside the post-bug-parade hardening session, after the Neon Cell 6 outage made vendor-resilience real, and after the IG-ad-scenario forced bulletproofness to be made specific. Re-read this doc on every Friday afternoon during v1 build. Items missed get folded into next week's plan. Items closed get crossed out, not deleted (audit trail of progress).*
