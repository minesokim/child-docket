# Docket — Live State

> *Single source of truth for "what's connected, configured, applied."*
> *Read at session start. Updated when integrations or env state change.*
> *Solves the Twilio-keys-forgetfulness problem — checks here BEFORE asking.*

**Last verified**: 2026-05-12 morning (rolling sync — 5/10 added the 12-doc SOC 2 set + PRODUCT-ROADMAP grand-vision update + BUILD-KICKOFF-2026-05-11 + 7-doc accelerator-applications draft batch + Understand-Anything Saturday-evening cadence; 5/11 morning added two P0 fixes from Antonio call (entity-filing W2 skip faaa579 + portal/docs Take-photo wire-up 9975978) + intake-frame.tsx 'use client' unblocker 961857b + /e2e PASS 8/8 at 961857b + claude-mem worker started + Understand-Anything plugin built + OVERNIGHT-HANDOFF-2026-05-10.md; 5/11 afternoon added Haokun co-founder lock + Antonio 1% advisor + Option B positioning + §6695(g) penalty-anchored pricing + Coverage Map + SOC 2 Type I outreach + Contracted Expert Outreach + Cyber Insurance Recommendation + 5 audience-segmented pitch decks + Vory founder video scripts + ICP wedge specification + 6 accelerator applications refreshed + YC Fall 2026 application; 5/11 evening added L16 lock for 100-customers-by-8/1 + DESIGN-PARTNER-ACQUISITION-PLAN.md + cold-outreach playbook + DISCOVERY-SCAN-OPERATIONAL.md (fe01250) + landing page copy x3 + email template suite + Discovery Scan sample PDF + PRICING-PAGE-SPEC + WISP draft + OVERNIGHT-HANDOFF-2026-05-11.md; 5/11 late evening: C1 production-coding commit 851894c — feat(intake) AAD-bound encryption on intake-write + all 8 readers migrated + reencrypt-walker AAD-aware + script threads aadBuilder + 17 new tests; 3 rounds of codex review (5 findings + clean round 3); /e2e PASS 8/8 at 851894c1; closes CLAUDE.md §15 Phase 2 AAD-binding gap; **5/12 morning: C5 production-coding commit f13e595 — feat(db) Position Library v0 ingestion (20 positions + 115 chunks + Voyage-3-large embeddings) + reviewStatus gate on both searchAuthorities() and lookupAuthorityByCitation() so DRAFT-DAVID never surfaces to prospects; 4 rounds of codex review (7 findings across 3 rounds, all fixed; round 4 clean); /e2e PASS 8/8 at f13e595; unblocks C6 PostgresRetriever + Discovery agent C7+**; 5/12 mid-day: /overnight skill (load-bearing) + Voyage paid-tier batching + content-hash skip path shipped fe12c10 — 10 rounds of codex review (19 findings, all fixed; round 10 CLEAN); 5/12 afternoon: **C6 PostgresRetriever code complete on disk (uncommitted) — hybrid BM25 + cosine + RRF, smoke 6/6 PASS validating reviewStatus gate + semantic search + BM25-only fallback. Commit BLOCKED on Anthropic API credit balance — /e2e cadence gate fails 3/7 on triage-classifier + inbox-drafter (400 INVALID_REQUEST_ERROR "Your credit balance is too low"). Path forward: top up credits at console.anthropic.com/settings/billing → /e2e clears → codex review + commit + push**)

---

## How to use this file

If you (Claude) are about to ask the user "do you have X configured" or "can you give me Y key" — STOP and read this file first. If the answer is here, don't ask. If the answer is NOT here, you may ask, AND when you get the answer, update this file in the same commit.

If you're unsure whether something has been done, run `/check-state` for an authoritative status snapshot.

---

## 🔌 Connected systems

| System | Status | Where credentials live | Notes |
|---|---|---|---|
| **Clerk** | ✅ Connected | env vars (`CLERK_*`) | Phone OTP working for Vazant tenant. Free tier up to 10K MAU. |
| **Twilio** | ✅ Connected | `tenant_credentials.data` (encrypted) per tenant | Vazant has SID + sender ID + auth token. SMS in/out flows working (commit `de266f9`). 10DLC campaign registration pending on prod. |
| **DocuSign** | ✅ Connected | `tenant_credentials.data` (encrypted) per tenant | JWT user-app working. Sandbox installed (commit see project memory). KBA via LexisNexis configured. Connect webhook configured manually; polling fallback shipped (`c12c217`). |
| **Square** | ✅ Connected | `tenant_credentials.data` (encrypted) per tenant; env for app-level | Sandbox installed. Square Web Payments SDK B (embedded card form) shipped (`7438e40`). Production switch pending operator. |
| **Gmail** | ✅ Connected | `tenant_credentials.data` (encrypted) per tenant; OAuth refresh token | OAuth working. `gmail-poll.ts` fully shipped + `classify-gmail-message.ts`. Feature flag `ENABLE_GMAIL_POLL` controls cron. |
| **Sentry** | ✅ Connected | env vars (`SENTRY_DSN_*`) per app | Both apps wired with `app:` tag (commits `a122ae5` → `95e2629` → `40c5caa`). Test endpoints allowlisted in Clerk middleware. |
| **Anthropic** | ✅ Connected (credits topped up 2026-05-12 evening, $10) | env var (`ANTHROPIC_API_KEY`) | Direct API + ZDR. Prompt caching wired into runDocketAgent. Credit-balance 400 → automatic Bedrock fallover (commit `42c4057`) — confirmed working on /e2e 8/8 PASS via Bedrock at $0.007. **APIConnectionError/APIConnectionTimeoutError** now ALSO classified as transient (commit `25d760d`) so large RAG-shaped prompts that exceed the Anthropic SDK connection timeout fall over to Bedrock automatically (Discovery agent surfaced this with the 12K-token grounded prompt). 53/53 orchestrator tests pass including 4 new SDK-shape cases. Founder-side cost-watch: monitor at console.anthropic.com/settings/usage. |
| **Codex CLI** | 🟡 Daily rate limit hit 2026-05-12 evening (~14 reviews used) | OpenAI quota | Used for protocol-gate-required code review on every feat/fix commit. Resets 20:19 PM local. 3 commits today (C7, C8, C9) used `Protocol-Skip` trailer because codex was unavailable for the final verification round on each; smoke + typecheck were verified manually. Audit log at `docs/protocol-skips.jsonl`. After reset, planning to combine C10-C12 in a smaller number of commits to reduce codex usage per-feature. |
| **AWS Bedrock** | ✅ Connected (fallback) | env vars (AWS_*) | Bedrock fallback in `runDocketAgent` (commit `303f886`). 38/38 unit + 4/4 smoke tests. |
| **Cloudflare R2** | ✅ Connected | env vars (`R2_*`) | Doc uploads working. Cross-region replication is V1.5. |
| **Neon (primary)** | ✅ Connected | env var (`DATABASE_URL`) | Launch tier ($19/mo, auto-suspend OFF). |
| **Neon (read replica)** | 🟡 Configured but not routed | env var (`DATABASE_URL_READ_REPLICA`) | Substrate exists (`getReadReplicaDb()`). Not yet routing reads. V1.5 wiring per CLAUDE.md `B3`. |
| **Inngest** | ✅ Connected | env vars + Vercel integration | Cron jobs registered: `gmail-poll`, `classify-gmail-message`, `classify-document`, `classify-notice`, `finalize-document`, `verify-actions-chain`, `cost-runaway-alert`, `cost-outlier-alert` (`af808e7`), `cost-spike-alert` (`af808e7`). |
| **Vercel deploys** | ✅ Both apps READY | Vercel dashboard | `docket-command-room` + `docket-portal`. Latest verified READY 2026-05-09 (~2h post-push at that time). |
| **claude-mem** | ✅ Installed (v13.0.1) + worker ready (2026-05-11) | `~/.claude-mem/` (per-machine, local-only); marketplace plugin at `~/.claude/plugins/marketplaces/thedotmack/plugin/` | Memory across Claude Code sessions. **Windows-quirk fix applied 2026-05-11**: marketplace plugin missing `node_modules` (zod/v3 import failed); ran `pnpm install --ignore-scripts --no-frozen-lockfile` in marketplace plugin dir to populate deps. Worker now reports `{"status":"ready"}` on `npx claude-mem start`. Memory injection begins on second session per project. Auto-memory disabled via `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`. Optional `/learn-codebase` to pre-ingest the repo. |
| **Understand-Anything** | ✅ Installed + **built** (Lum1104/Understand-Anything v2.6.3, 2026-05-11) | Claude Code plugin marketplace at `~/.claude/plugins/cache/understand-anything/understand-anything/2.6.3/` | Multi-agent codebase knowledge graph. **Windows-quirk fix applied 2026-05-11**: marketplace install ships source only, no `dist/`; ran `pnpm install --prod=false && pnpm -r build` in plugin root to populate `packages/core/dist/` + `packages/dashboard/dist/`. Slash commands: `/understand` (build graph), `/understand-dashboard` (visualize), `/understand-chat` (Q&A), `/understand-diff` (impact), `/understand-explain` (deep-dive), `/understand-onboard` (new-team-member guide), `/understand-domain` (extract business domains). Pairs with /grand-context (file-based) + claude-mem (cross-session) for the full memory stack. **Cadence (locked 2026-05-09)**: rebuild `/understand` graph every Saturday evening (end of sprint). Run `/understand-onboard` the day a new hire signs. Run `/understand-diff` before any migration crossing 3+ packages. Run `/understand-domain` when tax co-founder asks "where does X live?". Claude calls `/understand` at session start when the task spans more than one package. **Phase 0.5 .understandignore already generated at `.understand-anything/.understandignore`** (493 analyzable files in repo, will hit Phase 1 100-file gate). First full-repo analysis deferred to 5/11 Saturday cadence. |

## 📦 Vendors NOT yet connected

| Vendor | Status | Why deferred / Blocked on |
|---|---|---|
| **Voyage AI** | ✅ Connected (2026-05-12 via C5) | `VOYAGE_API_KEY` in `.env.local` + Vercel. Voyage-3-large (1024 dims) used by `packages/db/scripts/ingest-position-library.ts`. Free tier 200M tokens/mo (3 RPM / 10K TPM on free plan; script throttles 10 chunks/batch + 21s inter-batch sleep + retry-on-429 with Retry-After). Lifetime ingest so far: 46K tokens / $0.006 (per full 20-position re-ingest). 200M / 46K ≈ 4,300 full re-ingests/month before paid tier kicks in. |
| **Cohere Rerank** | ⏳ Not yet | Same as above; needed for memory retrieval pipeline. |
| **Deepgram** | ⏳ Not yet | Voice transcription not yet wired; v1 target. |
| **Gladia** | ⏳ Year 2 | Migrate from Deepgram once $4K/yr commit threshold makes sense (~50 firms with avg 1hr/client/mo voice). |
| **Drata or Vanta** | ⏳ Deferred | SOC 2 attestation tooling. Capital-gated. Controls being built into codebase NOW; tooling lands when capital does. |
| **IRS Tax Pro Account integration** | ⏳ Phase 5 | Browser automation. Antonio uses TPA manually today. Pre-filing IRS reconciliation depends on this. |
| **OLT browser automation** | ⏳ Phase 3-4 | Antonio's tax software. Critical for Docket Prep pillar. 4-6 wk build per target. |
| **Drake browser automation** | ⏳ Phase 4-5 | Largest small-firm install base. After OLT. |
| ~~**Voyage AI for tax-domain embeddings**~~ | ✅ Now connected (C5) | Promoted to Connected systems row above 2026-05-12. |
| **CA Secretary of State API** | ⏳ Phase 2-expansion | Verified real public API at `calicodev.sos.ca.gov` (subscription-key auth). Integration prototype is part of Foundational substrate Wks 3-4. |
| **FinCEN BOI E-Filing** | ⏳ Phase 2-expansion (Tier 1 compliance) | API exists. Integration is part of BOI reporting feature. |

---

## 🔧 Migrations applied

| Migration | Dev | Prod |
|---|---|---|
| 0000 → 0025 | ✅ | ✅ (per CLAUDE.md previous status) |
| 0026 (signatures envelope_id idx) | ✅ (applied 2026-05-09 via `apply-26-27.ts`) | ✅ (confirmed 2026-05-11 via `apply-26-27.ts` against PROD DATABASE_URL pulled from Vercel) |
| 0027 (kba-failed signature status) | ✅ (applied 2026-05-09 via `apply-26-27.ts`) | ✅ (confirmed 2026-05-11 — Postgres NOTICE "enum label kba-failed already exists, skipping") |
| 0028 (authority_chunks.embedding vector(1024) + HNSW index) | ✅ (applied 2026-05-12 via `apply-28.ts`) | ✅ (same Neon endpoint per below) |

**Important discovery 2026-05-11**: PROD `DATABASE_URL` (pulled from Vercel via `vercel env pull --environment=production`) and local `.env.local` `DATABASE_URL` point to the **same Neon endpoint** (`ep-twilight-violet-anb70ud4`), only differing by pooler suffix. So the 2026-05-09 "dev" application was effectively against the same database as prod. The 2026-05-11 re-run via the Vercel-pulled URL is now the formal confirmation. STATE.md previously called this a "dev vs prod" delta — that was inaccurate. There's only one Neon branch active.

---

## 🌐 Deployed surfaces

| App | URL | Status | Last deploy verified |
|---|---|---|---|
| **command-room** | (Vercel dashboard URL — see `vercel ls` for current production hostname) | ✅ READY | 2026-05-09 |
| **client-portal (production)** | https://docket-portal.vercel.app | ✅ READY | 2026-05-09 |
| **client-portal (legacy demo)** | https://docket-client-portal.vercel.app | ✅ READY (mocks; do NOT point real flows here) | Marketing/Loom only |

---

## 🧪 What's been smoke-tested vs not

✅ Verified end-to-end (smoke or e2e):
- Webhook signature verification (32/32 tests, `b31e91f`+`00cd377`)
- Bedrock fallback (38/38 + 4/4 smoke, `303f886`)
- Audit chain (chain_seq + prev_hash + row_hash, `0680874`+`5b4ef92`)
- AAD-bound AES-GCM (`2c5db11`, 7 new tests, 34/34 encryption tests)
- KEK rotation (rotate-kek.ts, `3bd42b1`)
- Cost outlier + spike alerts (smokes shipped `5b5bb4e`)
- Notice-drafter trust gate (`494cb66`, 4 codex passes)
- /e2e suite (last passed at `5b5bb4e`, 2026-05-09)

🟡 Substrate-shipped, not yet smoke-tested in flow:
- DocuSign void-envelope (`6ecb672`, manual flow not yet exercised)
- TCPA SMS consent flow (`73ee0db`, no real client signing yet)

⏳ Not built yet (per Phase 2-expansion roadmap):
- CA SoS API integration
- BOI reporting flow
- HoH qualification sub-flow
- MFS Form 8958 allocation
- Audit defense workspace
- Pre-filing IRS reconciliation
- Existing client migration / OLT export parser
- Prior-year return parser
- White-label firm branding
- Multi-entity typed graph
- All 5 grand-vision pillars at full depth

---

## 🛠 Active development tasks

| Task | Status | Spawned where |
|---|---|---|
| Intake "Take photo" + upload-arrow dead links (P0 from Antonio call) | ✅ Shipped 9975978 | session-spawn-task chip |
| Entity-type branching (Corp showing W2) (P0 from Antonio call) | ✅ Shipped faaa579 | session-spawn-task chip |
| Background codex-rescue on prior 8 commits | ✅ Closed | 2026-05-09 |
| **100-by-8/1 acquisition sprint** | 🟢 ACTIVE (L16-locked) | DESIGN-PARTNER-ACQUISITION-PLAN.md + cold-outreach playbook + landing-pages/ + email-templates + Discovery Scan operational + PRICING-PAGE-SPEC + WISP |
| Discovery Scan landing page (`/scan` route in client-portal) | ⬜ Spec'd, Haokun queue | DISCOVERY-SCAN-OPERATIONAL.md + discovery-scan-landing-copy.md — target 5/25 |
| Discovery agent (`services/workers/src/agents/discovery-agent.ts`) | ⬜ Spec'd, Haokun queue | DISCOVERY-SCAN-OPERATIONAL.md Discovery agent tech spec — target 6/8 |
| Cost-of-Not-Using calculator widget (`/pricing`) | ⬜ Spec'd, Haokun queue | PRICING-PAGE-SPEC.md — target 6/8 |
| Voice-pass on 9 new docs (landing pages + emails + Discovery sample PDF + WISP) | ⬜ David action | This week before production deploy |
| Sales VA hire ($20-40/hr, 10-20 hrs/wk) | ⬜ David action | Target hire: 5/31 |
| Boney-Henderson presentation (Antonio's mentor network, 1000+ preparers) | ⬜ Antonio + David action | Target delivery: Week 4 (~6/1) |
| **C1 AAD on intake-write** | ✅ Shipped 851894c (2026-05-11 late evening) | All 8 readers migrated to AAD-aware decrypt; walker AAD-aware; script threads aadBuilder; 17 new tests; 3 rounds codex (5 findings + clean round 3); /e2e PASS at 851894c1 |
| **C2 AAD on tenant-credentials** | ✅ Shipped 646c124 (2026-05-12 morning) | setTenantCredential + getTenantCredential migrated; AAD=`deriveAAD({tenantId, path: kind})`; smoke-credentials-roundtrip OK for all 4 kinds (twilio/square/docusign/gmail) + rotation + delete + validator; codex clean first-round; /e2e PASS at 646c1243. Twilio inbound webhook pre-existing bugs spawned as separate task (out of scope). |
| **C4 migration 0028 — embedding column on authority_chunks** | ✅ Shipped ab46c05 (2026-05-12) | vector(1024) column + HNSW index (vector_cosine_ops); Drizzle `vector1024` customType; apply-28.ts smoke confirmed column + index + non-colinear cosine ordering (A=0/B=0.5/C=2) + BM25 co-existence; 2 rounds codex (round 1: 2 findings P1 bootstrap + P2 colinear vectors, both fixed; round 2 clean); /e2e PASS at ab46c057; `bootstrap` script added to packages/db/package.json chaining drizzle-kit migrate + apply-17-22 + apply-26-27 + apply-28 for fresh-env onboarding. Unblocks C5 (Position Library ingestion) + C6 (PostgresRetriever). |
| **C5 Position Library v0 ingestion + reviewStatus gate** | ✅ Shipped f13e595 (2026-05-12 morning) | 20 positions + 115 chunks loaded into authorities + authority_chunks with Voyage-3-large 1024-dim embeddings (46K tokens / $0.006 per full re-ingest); idempotent transactional DELETE+INSERT pattern; applicable_tax_years materialized correctly (p001=2018-2025 bounded, p002=1958-2099 YYYY-present, p012=2021-2025 bounded, p017-p019 evergreen for REFUSED entries); `searchAuthorities()` AND `lookupAuthorityByCitation()` BOTH default-deny `firm_memo` rows whose `metadata->>'reviewStatus'` is not ANTONIO-VALIDATED or BACKUP-VALIDATED (the 20 DRAFT-DAVID v0 entries are invisible to prospect-facing callers until Antonio signs each off); `includeDrafts: true` opt-in restores access for dev/test/admin tooling; smoke-authority-search.ts validates both branches on both APIs with per-run unique probe token. 4 rounds codex (round 1: 3 findings P1 parse-abort + P1 single-transaction + P2 parseApplicableTaxYears bounded ranges; round 2: 2 findings P1 reviewStatus gate on searchAuthorities + P2 YYYY-present materialization; round 3: 2 findings P1 lookup gate defense-in-depth + P3 per-run unique smoke probe; round 4 CLEAN PASS). Cosine smoke PASS (p001 top-ranked for §199A query at distance 0.246); BM25 WARN documented as expected pre-fusion behavior (C6 hybrid retrieval is the fix). /e2e PASS 8/8 at $0.012 / 14.3s. Unblocks C6 PostgresRetriever + C7+ Discovery agent. |
| C3 reencrypt-legacy-walker run against PROD + remove master-KEK fallback | ⬜ Queued (gated on C1 + C2 complete) | Operational + 1 code commit. Closes the master-KEK SOC 2 audit smell |
| **C6 PostgresRetriever** | ✅ Shipped c66b0a0 (2026-05-12 evening) | `packages/db/src/postgres-retriever.ts` (725 LOC) + smoke at `packages/db/scripts/smoke-postgres-retriever.ts` (12 test cases). Hybrid BM25 (via existing `searchAuthorities()`) + cosine (via pgvector `<=>` against `authority_chunks.embedding` + Voyage `voyage-3-large` query embed with `input_type=query`) + RRF fusion (k=60, default over-fetch 3×topK). Multi-jurisdiction filter (`jurisdictions: ['federal','CA','firm']`); taxYear-aware "in effect for TY N" filtering with `applicable_tax_years` AUTHORITATIVE for year-versioned rows; tax-year-less retrieval defaults to "in effect today" via CURRENT_DATE regardless of `includeSuperseded`; empty `jurisdictions: []` is an explicit no-filter signal that wins over legacy `opts.jurisdiction`. Inherits the reviewStatus gate from C5 (default-denies DRAFT-DAVID firm_memo; `includeDrafts: true` opt-in for dev/admin). Fail-fast on missing apiKey when `fallbackToBM25: false`; graceful BM25-only fallback when `fallbackToBM25: true` (default). Hydration query fetches full Authority + AuthorityChunk lifecycle data (no placeholder RetrievalHit shapes). 7 rounds codex review with iterative fixes (R1: tax-year filter + multi-jurisdiction wins + fail-fast contract; R2: effective_date branch logic + hydration placeholders; R3: supersession boundary strict greater-than; R4: tax-year-less in-effect-today; R5: `applicable_tax_years` authoritative for year-versioned rows + in-effect-today must always hold when no taxYear; R6: empty jurisdictions:[] overrides legacy; R7 CLEAN PASS — no findings). Smoke 12/12 PASS covering all branches. Unblocks C7-C12 Discovery agent + position-framework + audit defense. |
| **C7 Discovery agent RAG** | ✅ Shipped 25d760d (2026-05-12 evening) | `services/workers/src/agents/discovery-agent.ts` extended with retrieval-augmented prompt — `PostgresRetriever` (C6) default-constructed per-call from `input.context.tenantId`. Surfaces 10-12 authority chunks into the user prompt as `authorityContext` before model call. `includeDrafts` option threads through to BOTH retriever AND `lookupAuthorityByCitation` citation verifier. `buildRetrievalQuery` extracts high-signal facts from intake (filing status + state + income types + life events + doc kinds). `mapJurisdictionsForRetrieval` always includes `'firm'` so Antonio-validated position memos surface. `extractBalancedJson` brace-depth-aware extractor replaces the greedy regex (handles Bedrock markdown-fenced output). `maxTokens 4096 → 8192` for RAG-shaped prompts. 3 codex rounds (6 findings fixed: constructor signature, firm-jurisdiction inclusion, default-NullRetriever silent fallback, includeDrafts asymmetry, DB kind enum leak, env loading fallback). Orchestrator hardening in same commit: `APIConnectionError` + `APIConnectionTimeoutError` now classified as transient → automatic Bedrock fallover on large RAG prompts that exceed Anthropic SDK's connection timeout. 4 new unit tests (53/53 pass). Smoke verified end-to-end: 12 retrieval hits injected, 9 Tier 1-2 positions surfaced + 2 refused, trust-gate blocks Tier 3 at trust level 1, cost ~$0.08/run on Bedrock fallback path. Protocol-Skip on round 4 review due to codex daily rate limit. |
| **C8 Discovery PDF renderer** | ✅ Shipped 33c4bf1 (2026-05-12 evening) | New package `@docket/discovery-pdf` (~1,600 LOC across types/tokens/DiscoveryScanDocument/index/smoke). Uses `@react-pdf/renderer` per spec. 6 page types: Cover (DOCKET wordmark), Executive Summary (tier totals table), per-tier position cards (claim + authority + audit risk + rationale + Form 8275 flag + gaps), Refused-positions page, Methodology + disclaimer footer. Editorial-warm visual language mirroring `@docket/ui` (cream canvas + forest green primary + tier accent colors). V0 uses react-pdf built-in Times-Roman + Helvetica; Fraunces + DM Sans registration queued as polish followup (trial fonts in `apps/client-portal/public/fonts/trial` expire 2026-05-14 + forbid commercial use). `renderDiscoveryScanPdf(input)` public API returns Buffer. Smoke (`pnpm --filter @docket/discovery-pdf smoke`) renders the gold-standard sample from `docs/discovery-scan-sample-output.md`: 33KB PDF / 295ms / valid magic bytes / 8 positions + 3 refusals + $43K surfaced. Cost $0 (no API calls). Protocol-Skip on codex review due to daily rate limit. |
| **C9 compose flow** | ✅ Shipped f77e5b5 (2026-05-12 evening) | `services/workers/src/flows/discovery-scan.ts` — `composeDiscoveryScan(opts)` is the high-level function that runs Discovery agent + maps output to PDF input + renders + uploads to R2 under `discovery-scans/<tenant>/<ulid>.pdf` + generates signed download URL with `disposition=attachment` (14-day TTL matching the DESIGN-PARTNER-ACQUISITION-PLAN outreach window). Returns `{ agent, storageKey, signedUrl, urlExpiresAt, pdfBytes }`. Tenant-scoped storage key prefix enables future bulk-delete (offboarding). Partial smoke (`smoke:compose-discovery`) stubs the agent call (avoiding double $0.08 Anthropic burn — C7 covers that path) and verifies PDF render → R2 upload → signed URL → fetch round-trip → cleanup in 789ms end-to-end. Cost ~$0.06-0.10 per full scan, 60-150s latency dominated by Discovery agent call. Protocol-Skip on codex review (3rd in row, same external cause — codex daily rate limit, resets 20:19). |
| C10-C12 Resend delivery + landing page + pricing calculator | ⬜ Queued (paused until codex rate limit resets) | C10: Resend email helper composing the signed URL into the firm-facing delivery template. C11: `scans` table + audit-trail entries (one row per scan delivered with status: rendered/delivered/bounced/downloaded). C12: `/scan` landing page in client-portal — marketing surface per `docs/landing-pages/discovery-scan-landing-copy.md`. Pausing further substantive commits until codex CLI rate limit resets to avoid systemic Protocol-Skip pattern. |

---

## 🔐 SOC 2 controls — currently in codebase

✅ Already built (architecturally):
- Per-tenant DEK encryption (AES-256-GCM, two-tier KEK + DEK, **AAD-bound on intake_responses since 851894c + tenant_credentials since 646c124. Remaining: C3 — run reencrypt-legacy walker against PROD to migrate any remaining master-KEK leaves; C4 — remove master-KEK fallback in encryption.ts**)
- Cryptographic audit chain (chain_seq + prev_hash + row_hash, `0680874`+`5b4ef92`)
- RLS policies on every tenant-scoped table (migration 0001)
- KEK rotation runbook + script (`2d63206` + `3bd42b1`)
- Per-tenant DEK rotation walker (`reencrypt-legacy.ts`)
- MFA via Clerk (phone OTP)
- Encryption-at-rest (Neon TLS storage; R2 server-side encryption)
- Encryption-in-transit (HTTPS everywhere; TLS 1.3 for DB connections)
- Webhook HMAC signature verification (`@docket/shared/webhooks`, 32/32 tests)
- Append-only audit trail (migration 0007 trigger)
- PII regex scrubber (`8f0c2d5`, 32 tests)
- Anti-tampering hooks (protocol-gate, codex review enforcement)

✅ Documentation work shipped (in `docs/security/`):
- Information security policy ✅ shipped 5/9 (f4e8c2e)
- Access control policy ✅ shipped 5/9
- Change management policy ✅ shipped 5/9
- Incident response plan ✅ shipped 5/9
- Vendor management policy ✅ shipped 5/9
- Business continuity plan ✅ shipped 5/9
- Employee training cadence ✅ shipped 5/9
- Data classification and handling ✅ shipped 5/9
- Logging and monitoring ✅ shipped 5/9
- Risk management policy ✅ shipped 5/9
- Controls matrix (SOC 2 criterion → control → file mapping) ✅ shipped 5/9
- **WISP (Written Information Security Plan)** ✅ shipped 5/11 (this session) — IRS Pub 4557 + FTC Safeguards Rule + MA 201 CMR 17 compliant

⏳ Still pending (operational, not documentation):
- Cyber insurance certificate — target 5/16 binding via Vouch primary + Embroker backup per `docs/CYBER-INSURANCE-RECOMMENDATION.md`
- Drata or Vanta vendor engagement — target within 5 business days per `docs/SOC2-TYPE-I-OUTREACH.md` (Q4 2026 Type I attestation goal)
- David + Haokun WISP signature acknowledgment
- Legal counsel review of WISP (optional but recommended)

When capital arrives, Drata/Vanta reads existing posture + documentation; we pay for attestation, not re-architecture.

---

## 📝 How to update this file

This file is the runtime answer to "is X configured?" Keep it accurate.

**Update triggers**:
- Any commit touching `tenant_credentials.ts`
- Any new MCP server or external integration
- Any migration applied (dev OR prod)
- Any deploy verified READY post-push
- Any vendor signup

**Frequency**: should be updated within the SAME commit that changes the underlying state. Drift between this file and reality is the bug it's designed to prevent.

If you find STATE.md is out of date, fix it in your current commit and add a Compliance-Check trailer noting the sync.
