# Reconciliation: Petal v2 brief vs. shipped reality

> *For the sister Claude session that authored the Petal practice-agent implementation brief on 2026-05-22.*
> *Author: the Claude session building Petal (codename Docket → Petal rebrand in flight) in `child-docket` since 2026-04, in close partnership with David Kim (CEO) + Antonio Vazquez EA (founding design partner, CA).*
> *Status: reconciliation accepted by David 2026-05-23.*

---

## What this doc is

The brief you wrote is strategically sharper than the existing `CLAUDE.md` in several specific ways. David read it and asked me to reconcile it with what's actually shipped in this repo. This doc is the result.

You won't see this conversation in your context. Read this in full before proposing further structural changes.

---

## Repo ground truth (what's shipped as of 2026-05-23)

Branch: `main`. Last commit before this reconciliation: `0fda30a` (intake email/state mirror-back fix).

### Apps (production-deployed on Vercel)

- `apps/command-room` → `docket-command-room.vercel.app`. Practitioner surface. Routes: `/` home (Need You queue + nudges feed + stats), `/clients` (table with freshness lens — NO Cards/Pipeline toggle yet despite §4 spec), `/clients/[id]`, `/clients/new`, `/prospects` (sales funnel for /scan leads), `/calendar` (empty-state placeholder), `/messages`, `/documents`, `/nudges`, `/projects`, `/settings/{ai-preferences,reminders,notifications,branding,system}`.
- `apps/client-portal` → `docket-portal.vercel.app`. Taxpayer surface. 38-route intake flow (declarative `intake-flow.ts` with 25 steps + `isApplicable/isComplete/next` per step) + 5-tab returning portal (Home / Docs / Messages / Signatures / Profile) + Discovery Scan landing (`/scan`).

### Services

- `services/orchestrator` (109 LOC). Wraps `@anthropic-ai/sdk` with cost telemetry + prompt caching + audit hook + model tiering + Bedrock fallover via `callClaudeWithFallover`. The runtime substrate every agent uses.
- `services/workers`. Inngest functions + agent code. **7 agents shipped today**: triage-classifier, inbox-drafter, doc-classifier (Haiku Vision OCR), discovery-agent (Sonnet 4.6 + PostgresRetriever + trust-gate), memory-curator (STUBBED — types only, returns empty), nudge-agent, notice-drafter, notice-triage. **9 Inngest functions**: gmail-poll (10min cadence), classify-gmail-message, classify-document, finalize-document, classify-notice, cost-{outlier,runaway,spike}-alert, verify-actions-chain (nightly cryptographic chain verification), send-8879-reminders (hourly cadence per `reminder_rules` table).

### Packages (workspace)

- `packages/db` — Drizzle schema (40+ tables), **38 migrations applied** on Neon dev branch. RLS policies (ENABLE + FORCE) per-tenant. Per-tenant DEK envelope encryption (AES-256-GCM with AAD binding to tenantId/clientId/taxYear/path). Cryptographic audit chain (migration 0022, SHA-256 chained per tenant, INSERT-only via PG trigger). Webhook replay dedup (migration 0037 + `tryRecordWebhookEvent` helper). RLS bypass policies for operator paths (migration 0038).
- `packages/shared` — branded types, intake schemas (Zod), `assertTrustGate` (67 tests), pii-scrubber, webhook-verification (HMAC for Twilio/Square/DocuSign/Inngest), sentry-scrubber. **317 tests pass**.
- `packages/ui` — design tokens (editorial-warm for portal, operational-modern for command-room), 30+ primitives, `TenantDisplayProvider` for cross-package firm-owner display.
- `packages/tax-graph` — `KnowledgeRetriever` interface, `NullRetriever`, `PostgresRetriever` (BM25 + Voyage-3-Large cosine + Cohere Rerank v3.5 + RRF fusion, in-effect date filter, authority-tier weighting per L4 + §8.1 of your brief).
- `packages/prompts` — versioned agent prompt registry with content-hash drift detection on every `runDocketAgent` call.
- `packages/mcp-gateway` — multi-tenant MCP gateway with trust-gate + audit chain integration (992 LOC).
- `packages/storage`, `packages/document-processing`, `packages/discovery-pdf`, `packages/auth` (Clerk wrappers), `packages/crypto`.

### Production integrations live today

- Clerk auth + phone OTP via Twilio
- DocuSign Connect webhook + KBA (LexisNexis InstantID Q&A) + embedded signing for Form 8879
- Twilio SMS (inbound + outbound) with per-tenant credentials in `tenant_credentials` (encrypted)
- Square Checkout for $50 deposit + webhook for completion
- Gmail OAuth + 10-min poll per tenant
- Sentry with PII scrubber + per-app tags
- Inngest cloud cron jobs (verify-actions-chain nightly, send-8879-reminders hourly, gmail-poll every 10min)

### Posture / decisions already locked (CLAUDE.md L1-L16)

These were locked deliberately with written rationale in the existing `CLAUDE.md`. Where your brief silently drops one, I've re-litigated below.

| Lock | Substance | Date |
|---|---|---|
| L1 | Path 2: public API + MCP server ship in v1 as deployable artifacts; self-serve dev tier in v2 | 2026-05-09 (clarified 2026-05-11) |
| L2 | Category position "tax practice operating system" | 2026-05-09 |
| L3 | (Was: 5 capability pillars. NOW: 4 moats per §26 of CLAUDE.md, swapped 2026-05-23 by this reconciliation) | 2026-05-23 |
| L4 | Memory architecture: pgvector + Voyage-3-Large + Cohere Rerank v3.5 + tiered retention + bidirectional client-scoped graph | 2026-05-09 |
| L5 | Voice transcription: Deepgram v1, Gladia v2 | 2026-05-09 |
| L6 | Pricing: tiered + per-active-client metering + founder tier $250/mo | 2026-05-09 |
| L7 | $1.39/client/month infrastructure cost target | 2026-05-09 |
| L8 | SOC 2 Type II posture built-in, attestation deferred until capital | 2026-05-09 |
| L9 | AI-as-character is forbidden; AI is invisible infrastructure around the preparer-client conversation | 2026-05-09 |
| L10 | Email-in via firm's own Gmail OAuth, NOT @docket.com aliases | 2026-05-09 |
| L11 | Memos as first-class objects with chain hash + bidirectional links | 2026-05-09 |
| L12 | Multi-entity workspace as typed graph (10 entity types, 5 relationship types with %+effective dates) | 2026-05-09 |
| L13 | Knowledge corpus Tier 1 federal + Tier 1 state (CA first; NY/TX/FL expansion later) | 2026-05-09 |
| L14 | Antonio dependency mitigation: partner #2 within 90 days, different segment + network | 2026-05-09 |
| L15 | YC Fall 2026 target (deadline ~early August) | 2026-05-09 |
| L16 | 100 paying customers by 2026-08-01 | 2026-05-11 |

---

## What we adopt from your brief, verbatim

### A1. The four moats (replaces old L3)

- **Defense-by-construction**: defense package built at position-time, not lazily
- **Compliance-by-construction**: SSTS, Circular 230, IRC §6694/§6695, Form 8867 checks run BEFORE practitioner review
- **Deterministic computation with replay traces**: all tax math in TypeScript, never LLM-synthesized
- **Multi-year live ledgers**: basis / NOL / carryforwards / positions / elections as append-only per-client ledgers

This is sharper than the older "5 capability pillars" framing. L3 is swapped in CLAUDE.md, §26 added.

### A2. Six-agent architecture

Planner / Researcher / Computer / Verifier / Adversary / Drafter. Mapping to today's fleet:

| Your agent | Today's reality |
|---|---|
| Planner | Partial. Inngest orchestration + state-aware code in some agents. No discrete Planner module. |
| Researcher | Shipped as `discovery-agent` (Sonnet 4.6 + PostgresRetriever + trust-gate). |
| **Computer** | **Doesn't exist. NEW Phase 0.5 priority work.** |
| **Verifier** | **Doesn't exist. NEW Phase 0.5 priority work.** |
| **Adversary** | **Doesn't exist. NEW Phase 0.5 priority work. This is the moat.** |
| Drafter | Partial. `inbox-drafter` + `notice-drafter` shipped. Template-driven artifact assembly doesn't exist. |

Verifier + Adversary + Computer are the priority Phase 0.5 additions.

### A3. "No LLM math" rule

Adopted as a hard rule. The Discovery agent currently emits `estimatedImpact.dollars` from Sonnet 4.6 with no deterministic backing — that's a §6694 exposure today. Migration plan: build `packages/tax-compute` first (5 tools), then refactor Discovery to delegate math to it, then add a Verifier check that flags any LLM-emitted dollar amount not backed by a `computation_traces` row.

### A4. Defense package shape (7 components)

`examinerCounter` / `highestRiskFacts` / `examinerLikelyAuthority` / `counterResponseDraft` / `form8275Language` / `settlementLeverage` / `forwardIdrAnticipation`. Adopted verbatim. New tables: `defense_packages`, `verification_results`.

### A5. Eval as render-blocking CI gate

The current eval scaffolds (`eval-classify`, `eval-draft`, `eval-discovery`, `eval-notice`, ~120 cases total across 4 agents) run on demand, not in CI. Adopting: eval runs in CI on every PR touching `packages/ai/*`, `packages/tax-graph/*`, `packages/tax-compute/*`, `packages/tax-defense/*`, `packages/tax-compliance/*`. >2% regression on any question type blocks merge. Any failure on settled-law subset blocks merge.

### A6. Append-only ledgers + reconstruction

Live ledgers (basis, NOL, capital loss, AMT credit, passive loss, charitable, FTC, §1031 deferred) as `ledger_entries` rows. Append-only. Running balance computed from sum-of-deltas-up-to-date. Reconstruction triggered on engagement open. Adopted verbatim.

### A7. The anti-patterns list

All twelve. Especially:

- "Do not compute numbers in an LLM call"
- "Do not retrieve without authority weighting" (already enforced via PostgresRetriever)
- "Do not skip the verifier" (the verifier doesn't exist yet; once built, this is mandatory)
- "Do not generate defense packages lazily" (built at position-time)
- "Do not mix the adversary corpus with the main corpus" (separate pgvector tables when adversary corpus ships)
- "Do not invent corpus content" (always retrieve via ingestion pipeline)

---

## What we modify from your brief

### M1. "Do not build a chat interface" is too broad

Your rule: *"The agent is task-driven. Tasks have explicit inputs, explicit outputs, explicit acceptance criteria. If you find yourself building a 'talk to the AI about tax' UI, stop and re-read this section."*

Our modification: **"All chat is scope-anchored (client / meeting / book per old §4) and retrieval-grounded against the corpus. Chat is the invocation surface for task-driven workflows, never a free-floating Q&A clone."**

A user asking "what did we promise Maria about Q3 estimates" inside the Maria client chat IS valid. A user asking "explain depreciation" to a global model is NOT.

Why: Slant.app validated the 3-scope chat pattern. It's how preparers naturally invoke workflows. The Ask Docket / command palette (Cmd+K) per old §4 is shipped substrate that's the connecting tissue between Discovery findings and action-taking. Killing chat entirely would forfeit the pattern. See decision RL2 below.

### M2. "Build for OLT first, Drake second" — yes, but defer Drake to v1.5

Your rule: *"Browser automation targets OLT first, Drake second, then modern apps via MCP."*

Our modification: OLT first (Antonio's primary). **Drake deferred to v1.5.** Modern-app MCP via Composio + native MCP servers (per existing architecture in old §10, locked 2026-05-14 after detailed research).

Why: Drake costs engineering time we don't have in Phase 0.5. No founder firm in the first 20 is on Drake.

### M3. Eval target 1000 questions with 200 from Antonio — re-scoped

Your acceptance criterion: *"Eval set has 1,000 vetted questions. 200 from Antonio's closed case files (highest priority, vetted in person)."*

Our modification for Phase 0.5:

- ~120 already shipped (4 scaffolds × ~30 cases each)
- +100 from Antonio (achievable: 1-2 per workday over 10 weeks)
- +200 scripted from EA SEE + CPA REG + IRS Pubs (auto-ingest pipeline + manual vetting pass)
- **Phase 0.5 ships at ~420 vetted questions**
- Phase 1 (post-launch) grows to 1000

Why: 200 from Antonio in 90 days is unrealistic. Antonio runs two active 2026 IRS audits + a 200-client book. The 100-question realistic ask is already aggressive. See decision RL4 below.

### M4. Repo structure: keep existing, evolve into target

Your brief: scaffold `packages/ai`, `packages/tax-compute`, `packages/tax-defense`, `packages/tax-compliance`, `packages/tax-ledgers`, `packages/tax-corpus` (currently `tax-graph`), with new `apps/web`.

Our modification: **keep existing `apps/command-room` + `apps/client-portal` + `services/workers` + `services/orchestrator` + existing package names.** Add new packages where genuinely missing:

- **ADD** `packages/tax-compute` (Computer toolkit, 5 tools for Phase 0.5)
- **ADD** `packages/tax-defense` (adversary corpus + agent + defense package types)
- **ADD** `packages/tax-compliance` (SSTS / Circ 230 / 6694 / 8867 rulesets + check engine)
- **ADD** `packages/tax-ledgers` (live ledger access)
- **RENAME** `packages/tax-graph` → `packages/tax-corpus`? **Defer.** Busywork rename. Current name is fine.
- The "agents" subdirectory under `packages/ai` doesn't exist in the brief's form; agents currently live in `services/workers/src/agents/`. **Defer** the agent move to `packages/ai/agents/` to a later pass; the orchestrator can call across service/package boundaries today.

Why: refactoring shipped code for naming alignment is busywork. The acceptance criteria you wrote target capabilities, not file layout.

### M5. CA in Phase 0.5, not deferred to Phase 1

Your brief: Phase 0.5 is "federal only, top 100 most-asked questions covered" + CA is Phase 1.

Our modification: **Federal + CA in Phase 0.5.** Other states + international starter pack in Phase 1.

Why: Antonio is in CA. Every engagement of his hits CA-specific positions (residency, source-of-income, PTET, SDI, CDTFA, EDD). Federal-only Phase 0.5 means Antonio cannot dogfood the product on his actual book. He'd only test it on hypothetical federal-only clients, which is none of his real engagements. The 9 other founder firms from JBH's network will also include CA preparers. **CA is the founding-cohort substrate.** See decision RL3 below.

---

## What we reject from your brief

### R1. "v3 prototype evolves here"

Your brief says "Practitioner-facing dashboard (v3 prototype evolves here)" under `apps/web`. **v3 already evolved into `apps/command-room`.** Reading the brief as written would mean re-evolving v3, which means rebuilding ~6 months of work. Rejected.

### R2. Silently dropping L1 (Path 2)

Your brief makes no mention of public API + MCP server as v1 deliverables. **L1 is the swing-for-unicorn bet that distinguishes Petal from "vertical SaaS" to "platform".** Without it, the company is smaller. **L1 stands.** Public API + MCP server ship in v1 as deployable artifacts; self-serve developer tier ships in v2 (per L1 clarification 2026-05-11). The architecture in your brief is compatible with this — packages/ai's agents can be invoked via API + MCP without changing their internals. See decision RL1 below.

### R3. Silently dropping L4 (memory architecture)

Your brief reduces L4 to "pgvector on Neon." The full L4 — **Voyage-3-Large embeddings** (4-6pp accuracy advantage on tax/legal corpora vs OpenAI text-embedding-3-large), **Cohere Rerank v3.5**, tiered retention (hot/warm/cold), bidirectional client-scoped graph with mandatory `client_id` per chunk — was a deliberate decision after benchmarking. **L4 stands.**

### R4. Silently dropping L6 (pricing model)

Pricing isn't in your brief at all. L6 (tiered base + per-active-client metering, founder tier $250/mo, full per-active-client unit economics targeting $1.39/client/month infrastructure cost per L7) was locked after detailed unit-economics work. **L6 + L7 stand.**

### R5. Silently dropping L14 (Antonio dependency mitigation)

L14 = land partner #2 within 90 days, ideally from a different segment and network. Your brief mentions "10 founder firms" (9 plus Antonio) but doesn't address the structural risk of Antonio being the only design partner. **L14 stands** — the 9 founder-firm count satisfies it provided #2-#10 come from at least 2 distinct networks (Antonio's mentor's, JBH, NAEA chapter, Latino Tax Pro).

### R6. "Do not build outcome prediction ML"

Your rule. We agree on the immediate decision (don't build it ourselves) — Blue J has a 10-year head start. But we keep the partnership path open (per old §13 strategic NO #6). API partnership with Blue J for v1 if a customer asks; native model is V2+ moat work.

---

## The four re-litigated decisions (David's calls)

These are decisions David authorized via approval of this reconciliation pass on 2026-05-23.

| # | Decision | Choice | Why |
|---|---|---|---|
| RL1 | Path 2 (public API + MCP server in v1)? | **KEEP L1 as-is.** v1.5 = deployable artifacts (live API endpoints + MCP server + first partner integrated). v2 = self-serve developer tier with billing. | Without L1 the company narrative collapses to vertical SaaS. The architecture in your brief is compatible. |
| RL2 | "No chat" rule? | **MODIFY.** Reject "no chat" as too broad. Adopt: all chat is scope-anchored (client / meeting / book) + retrieval-grounded. No free-floating Q&A. | Slant.app validated 3-scope chat. The command palette is the connecting tissue between findings and action. |
| RL3 | CA-first vs federal-first for Phase 0.5? | **CA + federal in parallel.** Phase 0.5 ships with both. Other states + international starter pack in Phase 1. | Antonio is in CA. His 200-client book hits CA-specific positions on every engagement. Federal-only Phase 0.5 means Antonio can't dogfood. |
| RL4 | Eval target 1000 with 200 from Antonio? | **MODIFY.** Phase 0.5 target: ~420 vetted (120 already + 100 from Antonio over 10wks + 200 scripted). Phase 1: grow to 1000. | 200 from Antonio in 90 days is unrealistic given his audit-defense + 200-client load. |

---

## The reconciled Phase 0.5 plan (revised week-by-week)

Different from your brief's Section 14 because that plan re-scaffolds work that's already shipped.

| Week | Work | Mapping to existing |
|---|---|---|
| **1-3** | Build `packages/tax-compute` (5 tools: MACRS depreciation, asset basis, individual AMT, NOL carryforward post-TCJA-OBBBA, §199A QBI). New `computation_traces` table (migration 0039). Refactor `discovery-agent` to delegate dollar synthesis to `packages/tax-compute`. | Migration + new package + Discovery refactor |
| **4-6** | Build Verifier agent in `services/workers/src/agents/verifier/` (six checks per brief §6.4: citation faithfulness, citation accuracy, authority tier compliance, stale law, computation reproducibility, compliance). Build `packages/tax-compliance` with SSTS / Circ 230 / 6694 / 8867 rulesets. New `verification_results` table (migration 0040). Wire Verifier as render-blocking gate in the existing orchestrator loop. | New agent + new package + migration + orchestrator extension |
| **7-9** | Build Adversary corpus ingestion (`packages/tax-defense`) with ATGs + TIGTA reports + IRM Part 4 + taxpayer-loss Tax Court cases as a SEPARATE pgvector table. Build Adversary agent. Build `defense_packages` table (migration 0041) + position→package linkage. Generate defense package at position-time for every Tier 1-3 position. UI surface in `apps/command-room/src/app/clients/[id]/` showing position library with defense-package status indicators. | New corpus + new agent + migration + UI |
| **10-12** | Build `packages/tax-ledgers` with the 8 ledger types. New `ledger_entries` table (migration 0042). Build reconstruction logic in Planner (whose discrete module also lands here). Build 3 more Drafter artifact types: research memo, Form 8275 statement, S-corp reasonable comp memo (the existing inbox-drafter + notice-drafter cover the others). CA-specific authority chunks ingested into `packages/tax-graph` (FTB Pubs + Residency Manual + CDTFA + EDD). | New package + Planner module + drafter templates + CA corpus |
| **13** | Eval expansion to ~420 questions. Onboard 9 more founder firms from JBH network + Antonio's mentor's network. Wire Verifier + Adversary into the CI eval-regression gate. Public Q4 2026 accuracy report draft. | Eval pass + onboarding playbook + report draft |

---

## What we're NOT doing in Phase 0.5

These items from your brief are explicitly deferred:

- Cross-form propagation graph (V2+)
- Outcome prediction ML (don't build; partner with Blue J if needed)
- Drake / Lacerte / ProConnect / UltraTax browser automation (post-launch)
- International tax forms (Phase 2)
- States beyond CA (Phase 1)
- Practitioner-network contribution UI (Phase 2; accept contributions manually for now)
- Cross-engagement analytics / "fire the bad client" insights (V1.5)

These items from old CLAUDE.md remain ahead:

- Calendar surface beyond empty state (Phase 4 per existing roadmap)
- Multi-entity typed graph (L12 — V1 commitment)
- Notetaker agent (V1.5)
- Pre-Meeting Brief agent (V1.5)
- Magic Buttons substrate (V1.5)
- Mid-market mission-control UI (V1.5)

---

## Working with David — patterns to remember

1. **He pushes back fast on aspirational-sounding language.** Lead with what's actually shipped today, not what's described in a spec. He'll catch the gap.
2. **He runs hands-on tests as a user**, not as an architect. Recent example: he found an intake → clients writeback gap (email + state) by trying to send a real 8879 envelope and getting "client missing legal name or email" despite a complete intake.
3. **Strict-protocol mode is default**: every feat/fix commit needs full trailer block (Edge-Cases / Score / Align / Craft / Codex-Reviewed / Decisions / Compliance-Check). Codex review on every feat/fix. Score floor 95. See CLAUDE.md §23.
4. **No flattery, no marketing copy** in responses or commit messages. Builder-to-builder.
5. **Cross-model agreement is a recommendation, not a decision.** If you and the building Claude agree on something, David still decides.

---

## File pointers

- **Master strategic doc**: [`CLAUDE.md`](../CLAUDE.md). §26 is the new four-moats + six-agents architecture (added by this reconciliation).
- **Per-week queue**: [`docs/MASTER-QUEUE.md`](MASTER-QUEUE.md). Re-sequenced 2026-05-23 around the Phase 0.5 plan above.
- **Assumptions in flight**: [`docs/ASSUMPTIONS-TO-TEST.md`](ASSUMPTIONS-TO-TEST.md). Every session's ASSUMED claims, tracked with verification paths.
- **Per-package READMEs**: each `packages/*/CLAUDE.md` documents single responsibility + public API + test coverage minimum + anti-patterns.
- **Existing strategic synthesis**: `docs/STRATEGIC-BRIEF.md`, `docs/PRODUCT-ROADMAP.md`, `docs/POSITION-FRAMEWORK.md`, `docs/AGENT-PLATFORM.md`.

---

## A note on tone

Your brief is genuinely strong on Sections 6 (six agents), 9 (computer toolkit), 10 (compliance), 16 (anti-patterns). If we'd had this framing six months ago, the build would be cleaner today. The reconciliation isn't a rejection of your work — it's adapting it to the substrate already in production.

Where I pushed back hardest: silently dropping L1, L4, L6, L13, L14. Locked decisions need explicit re-litigation, not omission. David has been burned before by decisions getting reversed without going through the decision-log process.

---

*End of reconciliation. Future Petal-build Claude sessions: read this doc on first invocation. Don't propose another fresh-start brief without checking against ground truth first.*
