# Docket

> *The agentic operator for a tax practice.*
> *Your practice. Every tool. One operator.*

This file is the canonical context for any Claude Code session in this repo. Read it cold and you should be able to ship without asking what the project is.

For deeper detail, see [`docs/STRATEGIC-BRIEF.md`](docs/STRATEGIC-BRIEF.md) and the memory mirrors in [`.claude/memory/`](.claude/memory/).

---

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

**Using gstack skills:** /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /open-gstack-browser, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /setup-gbrain, /retro, /investigate, /document-release, /codex, /cso, /autoplan, /pair-agent, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn.

Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

---

## 🔒 LOCKED DECISIONS — DO NOT RE-LITIGATE

These are decisions the founder + AI locked in deliberate sessions. They are NOT subject to re-debate without a written counter-case. If you (Claude) read this on session start, treat these as fixed.

| # | Decision | Locked | Why |
|---|---|---|---|
| L1 | **Path 2 commitment**: Docket is the orchestration platform that runs the firm's AI tax stack. Public API + MCP server ship in v1 as **deployable artifacts** (live endpoints, documented, partner-onboarded by direct intro). Self-serve API tier with billing infrastructure ships v1.5 — that's not a retreat from L1, it's an honest scope distinction (clarified 2026-05-11 after `/understand` audit). NOT just "AI-native PM with Path 2 hooks." | 2026-05-09 (clarified 2026-05-11) | Path 2 is the swing-for-unicorn bet; Path 1 is the floor. Hybrid is worst-of-both. v1 = MCP + API exist + first partner integrates; v1.5 = self-serve developers can swipe a card. |
| L2 | **Category positioning**: "Tax practice operating system" / "the AI-native operating system that runs the entire tax practice and orchestrates every AI tool the firm uses." NEVER call Docket "practice management" externally. The verb is "Docket it." | 2026-05-09 | Category creation requires consistency. PM-language reinforces the wrong category. |
| L3 | **5 capability pillars**: OmniContext Intelligence + Compliance-First Position Framework + Docket Prep + Strategy/Planning Engine + Year-Round Representation/Monitoring. Headline differentiator is the Position Framework with cited authority + refusal floor. Everything else is supporting cast. | 2026-05-09 | Be undeniably best at ONE thing. Buyer comparison is "60% on every dimension" loses to "100% on Position Framework." |
| L4 | **Memory architecture**: pgvector on Neon (NOT Pinecone — 220x cost difference at scale). Voyage-3-Large embeddings (legal/tax domain specialist, 4-6 pp accuracy advantage). Cohere Rerank v3.5 ($0.002/query). Tiered retention (Hot=current+last year in pgvector full / Warm=years 3-5 quantized / Cold=5+ in R2 metadata-only). Hybrid BM25 + vector with score fusion. Bidirectional client-scoped graph (every chunk has client_id MANDATORY; every retrieval logged to memory_references). Sliding-window summarization for long chat sessions. **8K context for batch agent calls; 50-200K context for interactive chat / Discovery / audit defense.** | 2026-05-09 | Performance-first; ambient feel non-negotiable. Cost optimization happens AROUND that, not instead. |
| L5 | **Voice transcription**: Deepgram Nova-3 + diarization in v1 ($0.378/hr). Migrate to Gladia Solaria-1 Growth tier in v2 ($0.20/hr with diarization bundled, ~47% cheaper at scale). Real-time streaming uses Gladia from day 1 ($0.144-0.25/hr). | 2026-05-09 | Verified pricing 2026; Deepgram cheapest batch with diarization, Gladia cheapest at $4K/yr commit. |
| L6 | **Pricing model**: tiered base + active-client metering, NOT per-seat. **Founder tier (first 50 firms only, year 1)**: $250/mo, ≤100 active clients, ALL agents included, 30% lifetime discount on year 2 reversion to standard. **Standard tiers**: Solo $499 (50 included, +$5/active, max $749) / Small $1,499 (150 + $5, max $1,999) / Growing $4,499 (500 + $4, max $5,499) / Mid-market $14,999 (2,000 + $3, max $23,999). **Add-on agents** (Solo + Small): Discovery $199, Strategy/Planning $299, Audit Defense $99, Multi-Entity Optimization $199. **Per-event**: notice $50, rep engagement $99, incorporation $25 + state, BOI $15, SOI $10. **API tier (Path 2)**: Developer free (1K calls/mo), Partner $999 (1M + $0.001 overage), Platform custom. NO per-return fees. Public, transparent pricing. | 2026-05-09 | Per-active-client metering aligns cost with value; per-seat punishes growth. Founder tier honors Antonio's $250 floor while protecting unit economics. |
| L7 | **Per-active-client infrastructure cost target**: $1.39/client/month average (heavy $4.30, medium $1.35, light $0.22; weighted by tax-season seasonality). At 200 clients per firm: ~$278/mo. Drives 80%+ gross margin at peak tier usage. | 2026-05-09 | Without this target, the business model breaks. Aggressive caching + tiered retention + smart agent gating make it real. |
| L8 | **SOC 2 Type II posture**: build all controls into the codebase NOW (audit chain, RLS, per-tenant DEK, MFA, encryption-at-rest/transit, change management, incident response, vendor management, BCP). Document policies in `docs/security/`. Defer Drata/Vanta tooling until capital lands. When tooling lands, the auditor reads existing posture; we pay for attestation, not for re-architecture. | 2026-05-09 | Without SOC 2, no upmarket sales after 25-staff threshold. Architecture is 70%+ there; documentation is the gap. |
| L9 | **NO hybrid form+AI intake. NO AI-as-chat-character.** The portal is already designed pro-human. AI is invisible infrastructure. Conversation is between client and preparer. AI is around the conversation, never in it. Single design test: can the client tell whether the preparer is here vs AI doing it? If yes, redesign. | 2026-05-09 | Pro-human-connection is the moat against TurboTax-style commoditization. AI-as-character breaks that moat. |
| L10 | **Email-in via firm's OWN Gmail (OAuth), NOT @docket.com aliases.** Inbound to firm@vazantconsulting.com (or whatever the firm's domain) → parse → file to client. Each firm links their Gmail. | 2026-05-09 | The firm's brand is on the address; @docket.com would dilute. Already shipped 80% (gmail-poll.ts). |
| L11 | **Memos as first-class objects.** Independent records (not just notes), versioned, append-only, typed (position/advice/audit-defense/planning/engagement), AI-referenceable, full-text + vector searchable, audit-trailed (chain hash), bidirectionally linked to docs/threads/positions/other-memos, surface-aware (one source of truth across UI), templated per firm. | 2026-05-09 | Memos = the firm's IP. First-class memos make a firm switching from TaxDome to Docket a one-way door. |
| L12 | **Multi-entity workspace = typed graph data model.** Person, S-Corp, C-Corp, Partnership, LLC, Trust, Estate, Sole Prop, Disregarded, Foreign Entity. Typed relationships (owns, operates, files-jointly-with, is-beneficiary-of, is-trustee-of) with percentage + effective dates + basis tracking. Cross-entity flow calculations automatic. Entity lifecycle (incorporation, dissolution, conversions, mergers, ownership changes) handled. | 2026-05-09 | Multi-entity is contested but not yet won. Instead is leading; we have a 12-18 month window to build a better model. |
| L13 | **Knowledge layer corpus**: Tier 1 federal (IRC, Treasury Regs, IRS Pubs, IRB, IRM, Tax Court, district/circuit/SCOTUS, CCAs, PLRs, TAMs) + Tier 1 state (CA first; FTB Residency Manual; CDTFA; EDD; OTA decisions). Effective-date versioning. ~100K documents, ~5-10M chunks. 4-week one-engineer ingestion project. NOT building Bloomberg Tax / Checkpoint / CCH editorial layer in year 1. | 2026-05-09 | Be the position-framework specialist, not a generic Accordance competitor. |
| L14 | **Antonio dependency mitigation**: land partner #2 within 90 days, ideally from a different segment AND different network than Antonio. | 2026-05-09 | Concentrated risk. JBH non-conversion is a real failure mode. |
| L15 | **YC target = Fall 2026** (deadline ~early August). NOT Summer 2026 (which has already passed). Apply Forum Ventures + Mucker + Anthropic Startup Program rolling this week alongside. | 2026-05-09 | Earlier session corrected Summer-vs-Fall confusion. |
| L16 | **100 paying customers by 2026-08-01** is the strategic anchor for the 12 weeks from 2026-05-11. From 1 (Antonio) today to 100 by the YC application week. Target MRR ~$31-67K depending on pricing-strategy choice (see Option C tiered scarcity recommendation in `docs/DESIGN-PARTNER-ACQUISITION-PLAN.md`). Five distribution channels (Boney-Henderson warm intro, Discovery Scan cold outreach, NAEA events, earned media, referrals) running in parallel. Five must-ship operational items gate the goal: Discovery Scan landing page (5/25), cold outreach automation (5/18), sales VA hired (5/31), CRM tracking (5/18), Boney-Henderson presentation (5/30). | 2026-05-11 | The traction story for YC + pre-seed SAFE round + mid-market partner #2 procurement signal. Aggressive but realistic; 65% confidence band on hitting 100 specifically, 90% confidence on hitting 80+. |

If you need to ADD to this list, do it via a /decisions-log entry first, then mirror the lock here. Don't lock things in this section without going through the decisions log.

---

## 1. Project identity

| | |
|---|---|
| Vision | The agentic operator for a tax practice. Top-tier preparer-grade AI animates every surface; drives the existing tax stack via API-first integrations + browser automation as fallback. |
| Pitch | "Your practice. Every tool. One operator." |
| Memory architecture (stolen from Practiq) | **"Memory scoped to the client."** Every action, doc, message lives on the client record — not in a chat thread. The practice ledger enforces this. |
| Codename | Docket (final brand TBD; repo named `child-docket` to mark this as the consulting/services flywheel that becomes the platform) |
| Founders | **David Kim** (legal: Minseo Kim) — CEO, `minseodavid@gmail.com`. **Haokun Yang** — technical co-founder + CTO. Partners since day one (5+ year working relationship before Docket; on the project from inception). Haokun owns the codebase end-to-end — 13-table Drizzle schema with RLS, per-tenant DEK encryption, cryptographic audit chain, agent fleet, both Next.js apps in production. UCR CS background. |
| Advisory | **Antonio Vazquez, EA** — Vazant Consulting (CA). Founding design partner + **on-platform tax advisor**. All tax-domain knowledge, position validation, and Position Library content sign-off runs through Antonio (and contracted backup advisors for scale-validation when Antonio's bandwidth is constrained, e.g., during his audits). Equity advisor (1%). This is the structural answer to "where does the tax-domain depth come from"; the tax co-founder hire is explicitly closed (CLAUDE.md §21 #4) because the substrate IS Antonio + scale-validation pipeline, not an open seat. |
| Stage | Production OS build in flight (post-CEO-review 5/2/2026). Two apps deployed; 12 migrations applied; phone-OTP auth + RLS + per-tenant DEK encryption + multi-role + audit trail all live. **v1 launch: 7/30/2026 (12 weeks).** Antonio down-market sub-milestone: 5/30/2026 (4 weeks). Pre-revenue. Forward-deployed build for Antonio + mid-market partner #2. |
| Repo | `C:\Users\minse\projects\docket\` (local) ↔ [github.com/minesokim/child-docket](https://github.com/minesokim/child-docket) (private) |
| Distribution unlock | Antonio's mentor commands 1000s+ tax preparers. Get her a Docket walk-through before 5/15 demo. |

---

## 2. Strategic posture — the Palantir/Foundry route

**Dual business model. Both flywheels feed each other.**

### Today: AI engineering for tax practices (services)
- Forward-deployed embed with design partner firms
- Custom builds shipped in weeks, not months
- Each engagement produces platform IP
- Pricing band: **$10k–$25k Foundation build, $2k–$5k/mo retainer** for expansion
- Reference template: [FluentOS](https://www.fluentaiconsulting.com/fluentOS) — productized AI consulting at 3-day Foundation + monthly retainer + ownership path. They explicitly say "built on Claude Code." We follow the same pattern.

### Tomorrow: Docket — the tax practice OS (platform)
- Same multi-tenant substrate every custom build runs on
- After 5–15 engagements, ~70% of new builds reuse existing modules → SaaS unlocks
- Self-serve tier for solo EAs ($99–$299/mo + usage), retainer tier for small firms

**Why this beats "raise money, build platform, then sell":**
- Revenue from week 2, not month 18
- Each install is real product validation
- Vertical specialization is the moat — generic AI consultants cannot go this deep on tax
- Investor narrative: "consulting that becomes a platform" (Palantir/Foundry pattern)

### Not negotiable: never build snowflakes
Every consulting engagement runs on the same multi-tenant substrate. If a build can't fit, refuse the work.

---

## 3. Persona — Antonio at Vazant Consulting

The first design partner is **Antonio**, a California EA running both prep AND representation work (the full lifecycle: prep → represent → defend).

**His stack:**
- **OLT (OnLine Taxes)** — primary tax prep software. No public API. Browser automation is the only integration path. **Critical: zero AI-native competitors integrate with OLT** — this is a forced moat for Docket. **Defer to M2+; not in 5/15 v0.**
- **IRS Solutions** ([irssolutions.com](https://www.irssolutions.com/)) — tax resolution platform. **TOS forbids browser automation.** They have a **private API** Antonio can request via email. The API is the integration path. **Antonio emails them ASAP; v0 demo (5/15) ships without live integration.**
- **Xero** — bookkeeping. API-first, mature MCP wrapper available.

**Antonio's mentor:** Commands 1000s+ tax preparers in her network. The distribution unlock for partners #2–#10. Get her a Docket walk-through before 5/15. Decide before pitching: introducer? co-promoter? equity advisor? affiliate?

### Why this stack matters for build order
- Partner does both prep + rep, so Docket spans both pillars from v1 (not "prep first, rep later")
- OLT browser automation = forced integration moat
- IRS Solutions integration via browser automation gives rep-pillar capability without us building 2848/transcript/OIC plumbing ourselves
- Xero feeds practice intelligence (revenue, AR, margin per client)

### Earlier "Maria" framing
Earlier in conversation we used a hypothetical persona named "Maria" (58-year-old EA in Riverside, 240 clients, mostly Latino small business owners, 70 hr/week busy season, runs practice on WhatsApp). **That was a hypothetical illustration.** The real first partner is Antonio at Vazant. Antonio's needs override Maria's anywhere they conflict, but the underlying truth — solo/small-firm EAs are mental-load-bound, not research-bound — still anchors the product.

### Antonio's pain (validated)
- Mental load across many simultaneous engagements
- Inbox/phone tax (replies pulled from real client status)
- Doc chasing (knowing who's missing what, batching reminders)
- Margin/friction blindness across the book
- Audit-trail-as-armor (timestamped receipts of every promise)
- Notice-response volume (off-season recurring revenue)

---

## 4. The two surfaces

### Command Room (preparer surface, web + mobile)
Single pane that shows **today** and lets the preparer act on it.

- **Morning brief** — "3 deadlines, 2 e-file rejects, 5 stuck pickups, 1 high-risk position, 1 client at risk of churn"
- **Pipeline** — every client across Intake → Docs → Prep → Review → Sign → File → Pay, with AI commentary on every card
- **Unified inbox** — SMS, email, portal chat, voicemail. AI drafts replies pulled from real client state. Preparer approves.
- **Practice intelligence** — margin per client, friction score, capacity, pricing inconsistency, churn risk, "fire the bad client" insights
- **Outcome prediction** — position-level audit/controversy risk modeling on demand (Blue J integration)
- **Command palette** — fuzzy-search any action across any tool. Pull IRS transcript · file 2848 · post invoice · generate workpaper · draft notice response · sync return to OLT · request docs · run YoY diff. Every action invokes an MCP tool.

### Client Portal (taxpayer surface, mobile-first 390×780 iOS)
**Mediated by AI, gated by Antonio.** The taxpayer never interacts with an autonomous AI. Every AI action is preparer-approved.

Two surfaces inside the portal:
1. **Intake (38 routes, 25-step declarative flow)** — Login → SMS OTP → Welcome → Quick-start (name/DOB/email) → Tutorial → Service path → Personal → State → Filing status → Spouse → Dependents (count + per-dep detail) → Income (incl. self-employment, rental detail) → Tax questions → Deductions → Life events → Refund pref → Document upload (4 phases: empty → AI scanning → retake prompt → AI parsed → saved) → Engagement letter → §7216 consent → Schedule appt → $50 deposit → Done. Single source of truth: `apps/client-portal/src/lib/intake-flow.ts` — 25 steps with `isApplicable()`, `isComplete()`, `next()` per step. Continue button gated by `canAdvanceFromStep` per step (with `STEPS_WITHOUT_GATE = ['docs']` exemption).
2. **Returning portal (5 tabs)** — Home · Docs · Messages · Signatures (with 8879 sign flow) · Profile, plus an AskAntonioChat overlay. **Reality:** layout exists; the five tab pages are placeholders pending production data flows.

Bilingual support as configuration (Spanish, Mandarin, Vietnamese, Tagalog) — not a separate product. Not yet implemented; English-only for first cohort.

### Design source files (legacy, mostly historical)
Original location: `C:\Users\minse\Downloads\docket-portal-design\`

- `Docket Client Portal - Standalone.html` — original standalone prototype (2.6MB)
- `components/*.jsx` — 23 React components, ported into `packages/ui/src/components/`
- `components/tokens.jsx` — ported into `packages/ui/src/tokens.ts` and `packages/ui/src/styles.css`
- `assets/antonio.webp` — Antonio's headshot for AvatarSlot, lives in `apps/client-portal/public/antonio.webp` today

The repo is now the source of truth for design. The Downloads folder is preserved for historical reference only; do not edit it.

---

## 5. Engine architecture — the four layers

The product is **practice management surface + agentic engine** built as four layers:

```
┌─ 1. Knowledge layer ──────────────────────────────────┐
│  Versioned tax graph                                  │
│  Authority · TaxConcept · WorkflowObject ·            │
│  FactPattern · DecisionRule · PlanningStrategy        │
│  IRS + CA FTB + CDTFA + EDD primary sources           │
│  Internal playbooks (the real moat)                   │
├─ 2. Orchestration layer ──────────────────────────────┤
│  Today: Direct Anthropic SDK + thin Docket wrapper    │
│  (cost telemetry, prompt caching, audit hook,         │
│   model tiering). 109 LOC in services/orchestrator.   │
│  Tomorrow: migrate to Claude Agent SDK once MCP       │
│   gateway lands. Dependency already installed.        │
│  Multi-tenant + RLS + audit trail are real today.     │
│  Trust escalation, agent fleet routing, skill         │
│  registry are paper specs (NOT built yet).            │
├─ 3. Rules layer ──────────────────────────────────────┤
│  Deterministic calculators OUTSIDE the LLM            │
│  Tax math, threshold/phaseout logic, form mappings    │
│  TypeScript rules engine. Never let Claude do tax     │
│  arithmetic on a return.                              │
├─ 4. Trust layer ──────────────────────────────────────┤
│  Citations + confidence scores + red-flag triggers    │
│  Mandatory human signoff for material-risk areas      │
│  Per-tenant × agent × action-class trust gates        │
└────────────────────────────────────────────────────────┘
```

**Core principle:** LLM reasons, graph knows, rules calculate, tools act.

---

## 6. Tech foundation — locked decisions

**These should NOT change as we build:**

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript end-to-end** | Frontend-backend cohesion. SDK is TS-first. Inngest is TS-native. Single language across the team. Python rejected (junior dev's instinct) because we're B2B SaaS-with-Claude, not ML-first. |
| Substrate (today) | **Direct `@anthropic-ai/sdk`** wrapped in `services/orchestrator/runDocketAgent` | 109 LOC. Cost telemetry + prompt caching + audit hook + model tiering. Used by `services/workers` agents (triage-classifier, inbox-drafter). |
| Substrate (next) | **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) | Already a dependency, not yet imported. Migrate once `mcp-gateway` exists and we want MCP-native tool routing + lifecycle hooks. |
| Inference | **Direct Anthropic API + ZDR** for v0 | Bedrock as per-tenant flag for compliance customers later. Orchestrator is provider-agnostic. |
| Model tiering | **Haiku 4.5 for extract/classify, Sonnet 4.6 for most agent runs, Opus 4.7 only for hard reasoning** | 4×–10× cost reduction vs Opus-everywhere. Haiku is the dev default. |
| Caching | **Prompt caching aggressive** on system prompts, knowledge bundles, playbooks | 80–90% cost drop on repeated calls. Wired into orchestrator from day 1. |
| Integration | **MCP gateway** as only abstraction layer | Browser automation + APIs both wrapped as MCP tools. Agent doesn't know which path. |
| Primary integration | **Browser automation** (Playwright + Computer Use) | Vendor-neutral, works against any system. TaxGPT/Filed/Grove validate the pattern. Antonio already operates this way. |
| Frontend | **Next.js 15 App Router** + Tailwind v4 (layout only) + custom Docket tokens | NO default shadcn aesthetic. Editorial cream + forest green oklch. |
| ORM | **Drizzle** | Type-safe, RLS-friendly, lighter than Prisma |
| DB | **Postgres 16** (Neon free tier dev, hosted prod TBD) + **pgvector** | Multi-tenant via RLS. Vector embeddings in same DB. |
| Auth | **Clerk** | Phone-based magic auth + SMS OTP via Twilio. Organizations primitive. Free up to 10k MAU. |
| SMS | **Twilio** | OTP + future unified inbox |
| Payments | **Square API** (deposit + future invoicing) | Antonio already uses Square day-to-day. Checkout link + webhook for deposit collection. 2.9% + $0.30 / txn. |
| 8879 e-signature + KBA | **DocuSign embedded signing API** (v0) → **Documenso self-hosted + LexisNexis InstantID Q&A** (v1+) | IRS Pub 1345 requires credit-bureau KBA on every remote 8879 signing — NIST IAL2 standard. Stripe Identity does NOT satisfy this (it's selfie+ID, not credit-bureau-sourced). DocuSign's KBA add-on uses LexisNexis under the hood. ~$3/KBA via DocuSign, ~$1.50/KBA wholesale via direct integration. |
| Storage | **Cloudflare R2** | S3-compatible, no egress fees |
| Background jobs | **Inngest** | Durable execution. Critical for multi-minute browser automation runs. |
| Vector | pgvector in same Postgres | No separate vector DB at v0. |
| Observability | **OpenTelemetry → Honeycomb** (or Datadog) | Every tool call is a span. |
| Hosting | **Vercel Pro** (Next.js apps, $20/mo — NOT Hobby) + **Fly.io** for Playwright workers when browser automation lands (M2+) | Hobby is forbidden by Vercel for commercial use. See `docs/HOSTING.md`. |
| Database | **Neon Launch** ($19/mo, auto-suspend OFF) | Was: Neon Free. Free tier auto-suspends after 5 min and adds cold-start latency that breaks the 10-min Gmail poll. |
| Secrets | `.env.local` for dev → **Infisical** for prod | Per-tenant credential vault for browser automation. |

### What we explicitly REJECTED as base
- **OpenClaw** — personal AI, single-tenant, full-trust permission model. Adopt patterns (local gateway, messaging-as-UI), not codebase.
- **Hermes Agent** — same problem. Adopt the skills/learning loop concept (write reusable skill docs, search past), not the framework.
- **LangGraph** — overkill for v0; revisit if checkpoint/time-travel becomes critical.
- **CrewAI** — nice prototyping DSL, you'll outgrow it.
- **Mastra** — option B if we go TS-only and need serverless first.
- **Claude Code CLI subscription** as production inference — against ToS, can't multi-tenant, no SLA. (Use it for DEV only, which we do.)
- **Python/FastAPI backend** — junior dev's instinct, rejected. We're B2B SaaS, not ML-first.
- **AWS Bedrock from day 1** — defer until first compliance customer asks. Direct Anthropic + ZDR is the v0 default.
- **Bloomberg/CCH/Checkpoint editorial year 1** — primary sources (IRS/FTB) + internal playbooks are the moat.
- **WhatsApp v1** — SMS + email + voice + portal chat is enough.

---

## 7. Cost discipline — $50/mo target

**Target: $50/mo Anthropic API spend** during the v0 build (plus existing Claude Code Max $100/mo subscription).

See [`COSTS.md`](COSTS.md) for the full rules. Summary:

1. **Claude Code Max ($100/mo, already paid)** is the primary dev tool. All code-writing, debugging, file editing routes through it. Absorbs ~80% of build cost.
2. **Default test model: Haiku 4.5.** Every prompt iteration runs on Haiku first. Promote to Sonnet only for end-of-week integration tests.
3. **Prompt caching, always.** Pass `cachedSystem: true` whenever the system prompt is reused.
4. **Computer Use deferred to week 7+.** Mock the OLT/IRS Solutions UI during phase 1–2.
5. **External integrations mocked during dev** via VCR cassettes / fixtures.
6. **Free-tier infrastructure** until first paying customer: Neon, Vercel, Clerk, R2.

### Reference numbers (April 2026)

| Model | Input ($/M) | Output ($/M) | Cached input ($/M) |
|---|---|---|---|
| Haiku 4.5 | $0.80 | $4.00 | $0.08 |
| Sonnet 4.6 | $3.00 | $15.00 | $0.30 |
| Opus 4.7 | $15.00 | $75.00 | $1.50 |

Hello-world (32 in / 28 out, no cache) on Sonnet = **$0.0005** (verified). On Haiku = **$0.0001**.

### Discipline questions before any new test/iteration
1. Can this run on Haiku?
2. Is the system prompt cached?
3. Is the external API mocked?
4. Am I about to run Computer Use without a real demo reason? — if yes, **stop**.

---

## 8. The six intelligence layers + trust escalation

### Six intelligence layers (every UI surface inherits one)
1. **Client Communication Intelligence** — escalating context, tone calibration, silence detection, channel awareness
2. **Document Intelligence** — completeness scoring, anomaly detection, quality checking, cross-doc validation, duplicate detection
3. **Pipeline & Workflow Intelligence** — stage advancement recommendations, priority sequencing, bottleneck detection
4. **Financial & Billing Intelligence** — invoice timing, revenue forecasting, payment follow-up
5. **Prep & Return Intelligence** — pre-prep summaries, post-prep review, YoY client intelligence
6. **Practice-Level Intelligence** — seasonal pacing, client acquisition patterns, pricing optimization

### Position framework (the deduction / gray-area surface)

**See [`docs/POSITION-FRAMEWORK.md`](docs/POSITION-FRAMEWORK.md) — canonical, do not duplicate here.**

Summary: every deduction or position the AI surfaces is classified into one of four confidence tiers (Settled law / Substantial authority / Reasonable basis + 8275 / More likely than not), plus a hard refusal floor below Reasonable Basis. Each surfaces as a structured `TaxPosition` object with cited authority captured at decision time. EA always decides; AI never auto-files a position above Tier 1. Three modes: Discovery (continuous, the wedge), Strategy (EA-initiated multi-year modeling), Position (aggressive client request → strongest defense or refusal).

Marketing locked: never "AI maximizes deductions" or "loophole finder." Always "catches every defensible deduction your team would have caught with unlimited time" + "audit trail built in." The framework IS the differentiator vs Big-4-targeted competitors who don't carry an Antonio-equivalent EA's PTIN risk.

### Trust escalation model

Generic levels (legacy framing — read for context, but enforcement maps to position tiers per POSITION-FRAMEWORK §6):
- **Level 1 (Week 1–2):** Suggest and explain, verbose reasoning, every action requires approval
- **Level 2 (Week 3–4):** Suggest with shorthand, compressed commentary
- **Level 3 (Month 2+):** Auto-execute low-risk with notification, preparer reviews logs
- **Level 4 (Season 2):** Full autopilot for known patterns, exception-based only

For deduction / return positions specifically, the levels gate which tier auto-accepts:
- **L1 firm**: AI proposes, EA decides every Tier 1-4 position. Antonio's starting state.
- **L2 firm**: Tier 1 auto-accepted; Tier 2-4 EA decides. Logged.
- **L3 firm**: Tier 1-2 auto-accepted; Tier 3-4 EA decides. Weekly L1-2 audit review.
- **L4 firm**: Tier 1-2 auto-accepted; Tier 3 auto-flags + default disclosure; Tier 4 EA decides.

Tier 4 always requires human attestation. Below Reasonable Basis always refuses. These never escalate.

### Insight severity
- **Green** (informational) · **Amber** (needs attention) · **Red** (critical / deadline risk)

### When to show insights
Always show when AI has concern/recommendation/action. One-liner when progressing normally but something notable. Show nothing when truly on track — **silence IS the signal.**

### Why this matters
The core product differentiator. Competitors show dashboards you read. Docket shows recommendations you act on. Every UI component asks "what would the AI say here?" Cards have space for commentary. Group by action type, not just pipeline stage.

---

## 9. Agent fleet

### Actually built and tested (as of 5/2/2026)
Both live in `services/workers/src/agents/`. Both call `runDocketAgent` for cost telemetry + audit hook. Both have unit tests under `services/workers/src/test/`.

| Agent | Model | Status | Notes |
|---|---|---|---|
| **Triage Classifier** | Haiku 4.5 | ✅ Built + tested | Classifies an inbound signal (Gmail message, doc upload, etc.) into one of 11 `issue_type` enum values with confidence + reasoning. JSON-schema-validated output. 258 LOC. |
| **Inbox Drafter** | Sonnet 4.6 | ✅ Built + tested | Drafts a reply in Antonio's voice (bilingual, channel-aware) with confidence + reasoning. 209 LOC, 140-line system prompt. |

### Inngest functions (paper plumbing)
Two functions are registered in `services/workers/src/functions/` but the integration points are stubbed (8× `TODO(week-1)` markers). They will not fire usefully until the Gmail OAuth path + tenants/integrations table queries land.

- `gmail-poll.ts` — cron every 10 min, **feature-flagged OFF**. Real `tenants` query stubbed.
- `classify-gmail-message.ts` — event-driven. Real Gmail fetch + client matching + issue persistence + draft persistence all stubbed.

### Designed but NOT built
| Agent | Status | Why deferred |
|---|---|---|
| **Morning Brief** | Paper spec only | Needs `ledger`, `knowledge`, `xero` MCP servers (none built); Gmail integration not flowing yet |
| **OLT Prep Handoff** *(or Notice Triage — Antonio's choice week 1)* | Paper spec only | Needs `olt` browser automation MCP server (not built; M2+ per build order) |
| **Document Triage** | Paper spec only | Needs `documents` MCP server + Cloudflare R2 + Haiku vision pipeline (per `docs/DOCS-CAPTURE-PIPELINE.md`) |
| **Notice Response** | Paper spec only | Needs `irs-solutions` MCP + knowledge graph |
| **Discovery Agent** *(deduction surfacing — the wedge)* | Paper spec only | Needs authority library + position-library seed + cross-channel artifact capture. See [`docs/POSITION-FRAMEWORK.md`](docs/POSITION-FRAMEWORK.md) §4. Phase-3 work. |
| **Strategy Agent** *(EA-initiated multi-year modeling)* | Paper spec only | Same dependencies as Discovery + entity/retirement/depreciation rule encoding. POSITION-FRAMEWORK §4. |
| **Position Agent** *(aggressive territory: defend or refuse)* | Paper spec only | Same dependencies. The refusal-floor logic is the load-bearing piece. POSITION-FRAMEWORK §2. |
| **Practice Pattern, Promise Keeper, Outcome Prediction, Phone Agent** | Paper spec only | v1+, post-5/15 |

### Agent contract — what's enforced today
- System prompt + scoped model tier (Haiku/Sonnet/Opus): ✅ in `runDocketAgent`
- Cost telemetry tagged with tenant + agent + action class: ✅ via `onAction` hook
- Audit-trail hook on every call: ✅ at orchestrator level (caller wires it to the `actions` table)
- Trust gate before external action: ❌ not built (placeholder field on tenant; no enforcement code yet)
- Per-agent playbook bundle: ❌ not built (`packages/playbooks/` doesn't exist)

---

## 10. MCP server roster

> **Reality check (5/2/2026):** `mcp-servers/` directory exists but is **empty**.
> Zero MCP servers have been built. The orchestrator does not currently route
> through MCP — agents talk to `runDocketAgent` directly and DB writes go through
> Drizzle. The `mcp-gateway` service in CLAUDE.md's earlier draft does not exist.
>
> The roster below is the planned build order for **post-5/15** once we migrate
> the orchestrator to Claude Agent SDK. Until then, agents do their work in
> straight TypeScript against the DB and Anthropic API.

**Build effort estimates in parens.** Each independently deployable.

### v0 servers (build in this order — POST-5/15)

| # | Server | Type | Tools | Effort |
|---|---|---|---|---|
| 1 | **`ledger`** | internal | `log_action`, `query_actions`, `get_audit_trail`, `get_client_state` | 3d |
| 2 | **`knowledge`** | internal | `search_authority`, `get_form_instructions`, `get_concept`, `get_playbook` | 5d (+ 5d ingestion) |
| 3 | **`gmail`** | API wrapper | adopt official, thin tenant scoping | 2d |
| 4 | **`xero`** | API wrapper | adopt community or thin wrapper | 2d |
| 5 | **`portal`** | internal | `post_message`, `request_document`, `update_status` | 3d |
| 6 | **`olt`** | browser automation | `list_returns`, `get_return_state`, `prefill_return`, `push_field`, `run_diagnostics` | 10–14d |
| 7 | **`irs-solutions`** | browser automation | `pull_transcripts`, `list_notices`, `classify_notice`, `get_ian_alerts`, `prefill_2848` | 8–10d |

### Build-vs-adopt rules
| Situation | Decision |
|---|---|
| Vendor has open API + incentive to expose (Stripe, Gmail, Drive, Xero, QBO, Plaid, Twilio, DocuSign, Notion, Slack, Calendar) | **Adopt** community/official MCP server |
| Vendor has API but no MCP server yet, friendly to integrators | **Adopt or build thin wrapper** in a weekend |
| Vendor has API but hostile/competitive (TaxDome, Canopy, Karbon — PM competitors) | **Don't bet on them.** Design around. |
| Vendor has no API (Drake, OLT, parts of Lacerte) | **You build.** Browser automation as MCP server. Moat. |
| Custom abstraction over multiple sources ("client tax timeline" merging Drake + IRS transcript + ledger) | **Always build.** This is your product. |

---

## 11. Design system

**Codename:** Docket v4 — Vazant client-facing mobile.

### Philosophy
- **Editorial warmth.** Cream backgrounds, ink text, forest green primary. Not vibe-coded.
- **NO default shadcn aesthetic.** Tailwind v4 used for layout utilities only; visual style is the custom Docket tokens.
- **Mobile-first.** 390×780 iOS viewport for portal. Responsive desktop for command room.
- **Anti-AI-slop** (see feedback section). No decorative highlights, no left-border accents, no emoji, no vibe-coded look. Intentional design only.
- **Editorial typography.** Fraunces serif for display + DM Sans body. Three tone variants: editorial (cream), minimal (off-white), magazine (bold/inky).

### Tokens (in `packages/ui/src/tokens.ts`)
- Three tones: `editorial` (lead) / `minimal` / `magazine`
- Forest green primary: `oklch(42% 0.09 150)` (hue tweakable 130–165)
- Fraunces / DM Sans / DM Sans (mono fallback)
- Density: comfortable / cozy
- Radius: 14px / 20px (lg)

### Primitives in `packages/ui/src/components/`
Layout: `Screen`, `Stack`, `Row`. Text: `Eyebrow`, `H1`, `H2`, `Body`. Buttons: `Button`, `BackButton`, `IntakeBackButton`. Indicators: `ProgressBar`, `Placeholder`, `TrustPill`. Media: `AvatarSlot`, `VideoPlaceholder`. Cards: `Card`, `ToggleCard`, `RadioRowCard`, `DependentCountCard`. Fields: `FieldLabel`, `TextField`, `SSNField`, `EncryptedTextField`. Antonio: `AskAntonioBar`, `AskAntonioChat`, `AntonioNote`. Frame: `SignOutProvider`, `IntakeRouteFrame`, `IntakeHeader`, `BottomBar`, `IntakeBottomBar`, `Footer`. Icons: `IncomeIcon`, `HandCheckmark`, `Wordmark`. Signature: `LegalDoc`, `SignaturePad`. Portal: `PortalTabBar`. All inline-style based for design fidelity.

### Cross-package context (firm-owner display)
- `TenantDisplayProvider` from `@docket/ui` wraps each (intake) / (portal) layout server-side after `resolveClient()` resolves tenant + firm-owner.
- Components consume via `useFirmOwner()` / `useTenantName()` / `initialsOf()` instead of hardcoded strings.
- A handful of pages still hardcode "Vazant Consulting" / "Antonio Vazquez" — see `Section 18 → Known stubs and mocks`. Marked TODO(multi-firm); not load-bearing until tenant #2.

### Solar icons — known liability
`packages/ui/src/icons/solar.tsx` is **7,848 lines** in a single file. Blocks tree-shaking. Audit flagged AMBER. ~30 min one-shot transform via the existing generator script when convenient.

### Inline styles vs Tailwind
- **Design-locked components (intake, portal):** preserve inline styles exactly as the designer authored them. Zero design drift.
- **New components (command room layouts, dashboards):** Tailwind v4 utility classes for layout/spacing/responsive, custom tokens for color/typography.
- Both can coexist in the same app.

### Two visual languages (locked 2026-05-08)

After the user-shared "Nexus Tax OS / Courtney Henry" dashboard reference frames, command-room moves off the editorial-warm portal language. The product now ships TWO visual languages, each crafted for its job:

| Surface | Visual language | Why |
|---|---|---|
| **Client portal + intake** (`apps/client-portal/(intake)`, `apps/client-portal/portal`) | **Editorial-warm** — Fraunces serif display + DM Sans body + cream canvas `oklch(98% 0.01 85)` + forest green primary `oklch(42% 0.09 150)`. Inline-style based for design fidelity. | Taxpayer-facing. Antonio's clients sit in an emotional-trust transaction. The portal feels like a thoughtful welcome from a real practice, not a SaaS dashboard. Hand-crafted-feel. |
| **Command room** (`apps/command-room`) | **Operational-modern** — geometric sans (Inter / Geist) for both display and body, line-glyph icons (Lucide), white-or-near-white card on faint warm-gray canvas `oklch(96% 0.008 85)`, soft 1px borders, small radius (10-12px), dark warm-gray sidebar spine `oklch(18% 0.01 85)`, tab-bar-under-title composition. Forest green stays as the primary accent. | Antonio-facing operational pane scanned 100x/day. Density and clarity beat warmth. Same craft level as the portal, different job. |

**Both surfaces share:** forest green primary `oklch(42% 0.09 150)`, the same Antonio-voice copy rules, the same anti-AI-slop discipline, the same restraint. Different fonts and densities; same product.

**Reference frames:** see `docs/visual-reference/dashboard-2026-05-08/` for the user-shared composition reference. Detailed translation rules + adopted patterns + anti-patterns: [`.claude/skills/craft/SKILL.md`](.claude/skills/craft/SKILL.md) — re-read whenever opening a new command-room route.

### Auth styling note
The user identity in flows is real: **Antonio Vazquez**, EA (firm: Vazant Consulting). Avatar in `apps/client-portal/public/antonio.webp` is the static fallback; live `users.avatar_url` (Clerk `imageUrl`, lazy-backfilled) is preferred when present.

---

## 12. Knowledge layer

### Tier 1 — Primary sources (build first)
- **IRS:** Title 26, Treas. Regs, IRS forms/instructions/pubs (current + 3 prior years), IRB, IRM, Tax Court opinions
- **California FTB:** forms/pubs/Legal Rulings, Residency & Sourcing Technical Manual, FTB procedure manuals
- **CDTFA** (sales/use tax) and **EDD** (payroll/worker classification) where rep work touches

### Tier 2 — Editorial (deferred until usage gaps demand)
- Bloomberg Tax / Thomson Reuters Checkpoint / CCH AnswerConnect — defer, expensive ($15–40k/seat/yr)

### Tier 3 — Internal (the real moat)
- Issue memos, checklists, fact-pattern playbooks, SOPs, client letter templates, audit-response trees, form-line mapping rules, planning strategy libraries
- Authored by tax co-founder + accumulated from Antonio's actual cases

### Tier 4 — Consumer translation
- Plain-English explainers in client portal sourced from official forms/instructions/pubs
- Same answer, different reading level

### Schema (designed; NOT YET implemented)
The current `packages/db/src/schema.ts` covers operational tables (tenants, users, clients, intake, documents, signatures, messages, engagements, issues, actions, etc.). The knowledge ontology below is a v1+ design — the planned `packages/tax-graph` package does NOT exist yet, and `content/authority/` + `content/strategy-library/` are empty directories.

- `Authority` — source, citation, jurisdiction, date issued, effective date, superseded date
- `TaxConcept` — residency, sourcing, basis, nexus, reasonable comp, QBI, PTET, etc.
- `WorkflowObject` — return type, form, schedule, notice, election, deadline
- `FactPattern` — taxpayer type, state, entity type, income types, transaction events
- `DecisionRule` — if/then logic, thresholds, exceptions, authority support
- `PlanningStrategy` — strategy name, prerequisites, risks, expected savings, documentation requirements

### Versioning
**Effective-date versioning on every authority chunk from day 1. No exceptions.** When the knowledge layer ships, this is non-negotiable.

---

## 13. The eight white-space bets (ranked)

Concrete edges where the funded competitors are NOT building. Ranked by signal strength.

1. **Compliance-first deduction surfacing — the position framework.** See [`docs/POSITION-FRAMEWORK.md`](docs/POSITION-FRAMEWORK.md). The mechanism: every deduction the AI flags carries an IRC cite + tier classification + audit risk + draft 8275 (when needed). EAs at the down/mid-market segment cannot adopt loophole-finder tools — their PTIN is on every return. Big-4-targeted competitors (Accrual / Black Ore / Basis) sidestep this because in-house tax counsel handles the compliance line. **Nobody at Antonio's segment is building the compliance-first frame.** Marketing handle: "catches every defensible deduction your team would have caught with unlimited time + audit trail built in."
2. **Practice management × return intelligence union.** Accrual/Black Ore/Basis/TaxGPT automate the return; TaxDome/Canopy/Karbon automate the practice with shallow AI. **Nobody owns both.** Docket's structural lane.
3. **Mediated taxpayer client portal.** Every PM incumbent treats portal as passive doc-drop. Make it a continuous bilingual conversation thread with AI drafts gated by the preparer.
4. **EA representation rights as a second pillar.** The 2848/8821 + transcript pull + notice triage + drafted response loop. Off-season recurring revenue. $2k–$10k per engagement. Antonio is already on IRS Solutions — perfect fit.
5. **Bilingual + voice-aware practice OS.** No funded AI-native is built for this. Spanish, Mandarin, Vietnamese, Tagalog. Voicemail transcription default substrate.
6. **Practice intelligence as a paid module.** Margin/friction/scope-creep/pricing inconsistency across the book. $99–$299/mo standalone. Data exists in the ledger by definition; nobody else can compute it.
7. **YoY change explainer + source-to-return traceability for the taxpayer portal.** Highest-leverage retention artifact. Currently 100% hand-written everywhere. Juno is alone pitching traceability, aiming up-market.
8. **OLT integration as a moat.** Every funded AI-native targets Drake/ProConnect/UltraTax/Lacerte/CCH. **Zero target OLT.** First mover earns the bottom of the EA market for free.

### Pricing edge
Per-return / per-notice usage on top of a low monthly base. Storefront and small-firm EAs can't pay $1.5k–$3k/seat/yr that competitors charge.
- **$99–$299/mo** base + **$5–$15/return** + **$200–$500/notice handled**

---

## 14. Explicit NOs

| What | Why |
|---|---|
| **Don't fight Black Ore / Accrual / Basis** on autonomous return prep for big firms | $235M+ raised combined, 2-year head starts, top-25 firm distribution. Don't be the fifth entrant building backward. |
| **Don't build a consumer tax filer** | Deduction (Taylor CPAI) / Perplexity Computer / Rally / Gelt are crowding it. Wrong product anyway. |
| **Don't lead positioning with "deeper than any CPA"** | Table stakes by 2027. Depth is the engine that makes our surfaces correct, not the headline. |
| **No WhatsApp in v1** | SMS + email + voice + portal chat is enough. WhatsApp Business API has compliance friction. |
| **Don't build a return calculation engine** | OLT/Drake/UltraTax do that. Be the orchestrator, not the calculator. |
| **No per-customer snowflakes** | Every consulting engagement runs on the same multi-tenant substrate. Refuse out-of-thesis work. |
| **No Bloomberg/CCH/Checkpoint year 1** | Tier 1 (IRS/FTB primary) + tier 3 (internal playbooks) is enough. |
| **No OpenClaw / Hermes as base** | Personal AI, not multi-tenant B2B. Adopt patterns, not codebases. |
| **No default shadcn aesthetic** | Design fidelity is non-negotiable. Custom Docket tokens. |
| **No Claude Code CLI subscription as production inference** | Against ToS, can't multi-tenant, no SLA. Dev tool only. |
| **No Python backend** | TS end-to-end. Junior dev's instinct rejected. |
| **No AWS Bedrock from day 1** | Defer until first compliance customer asks. Direct Anthropic + ZDR is v0 default. |
| **No Big 4 / top-100 firm pivot for 18-24 months** | Decided 5/2/2026 CEO review. Fortress market with $235M+ funded competitors holding 2-year head starts. Brand maturity gap that 12 weeks of building cannot close. 18-month sales cycles. Bootstrap option dies. Mid+down lane is the structurally open one. |
| **No F500 in-house tax department pivot for 18-24 months** | Same compliance + ERP integration timelines as Big 4 without the partner-network distribution upside. Underexplored but not by accident. |

### Segment posture (decided 5/2/2026 CEO review, **wedge clarified 2026-05-11**)

- **The wedge (2026-05-11 specification — the YC-legible frame)**: **2-10 preparer firms with active audit exposure, EA/CPA-led, $300K-$3M revenue.** ~40,000 firms in segment. **$300M-$700M wedge TAM** at standard tier pricing ($499-$1,499/mo). This is the *narrative frame for the YC application + investor decks + founder-50 cohort acceptance filter*, not a roadmap change.
  - Why the wedge isn't solo EAs alone: solo seasonal preparers are price-sensitive, part-time, high-churn, gettable by any incumbent that bolts on AI. Pitching "we sell $250/mo to solo seasonals" pattern-matches to feature-not-company for a YC reviewer. The 2-10 preparer firms have audit exposure pain that single-preparer solos don't carry at the same scale, growing-firm dynamics that compound ACV, and resistance to PM-tool feature-additions because they actually pay the §6694 penalty themselves. Same outreach motion, **4-6x Year-2 ARR** at the same cohort headcount.
  - **Antonio is the founding firm + 1% advisor**, not the ICP avatar. His two active 2026 IRS audits are the validation story regardless of his preparer count.
  - Solo EAs remain part of the **expansion ladder** (founder tier $250 / Solo $499) — addressable, not the wedge. The standard tier rollout post-founder-50 surfaces solo demand naturally.
  - **Stripe / Toast / ServiceTitan / Gusto / Ramp pattern**: category-defining primitive with the right-sized firm as wedge, expansion ladder visible. Toast didn't pitch "Boston restaurants" — they pitched "operating system for the $900B restaurant industry, starting with underserved independents." Same product, different framing.

- **v1 (7/30):** Mid-market and down-market only.
  - **Wedge (down-market within v1)** = 2-10 preparer firms (per above). Antonio's segment.
  - **Down-market expansion** = solo EAs, storefront tax shops, 1-preparer firms. Part of addressable; come in post-founder-50 via standard-tier rollout.
  - **Mid-market** = 20-100 staff regional firms. Phase 6 partner #2 onboarding territory; arrives via warm intros + AICPA ENGAGE 6/2027. Only PM incumbents (TaxDome, Canopy, Karbon) ship shallow AI here. AI-native players are economically forced up-market by their funding rounds.
- **v1.5 door open:** Tax franchise networks (Liberty Tax, Jackson Hewitt, JTH-aligned, smaller franchise networks). Storefront workflow is identical to the current mid+down product. Corporate licensee model = single deal could yield $1-5M ARR. Activate once mid-market reference customer is in hand to point at.
- **NOT pursuing for 18-24 months:** Big 4 / top-100 firms. F500 in-house tax departments. See §14 NOs above for reasoning.
- **Architecture posture:** Five-layer + RLS + per-tenant DEK + audit-trail + governance is enterprise-compatible by accident-of-good-decisions. No special enterprise-readiness work needed in v1. Door stays open for later segments without rework.

**Operational filter (founder-50 cohort acceptance, 2026-05-11)**: bias acceptance toward 2-10 preparer firms that are actively growing or carry active audit exposure. Don't reject solos who fit founder-tier criteria — but don't preferentially accept them either. The 20-EA validation sprint targeting criteria gets the same filter applied at funnel-top.

---

## 15. Build order — Docket OS v1 by 7/30 (Antonio sub-milestone 5/30)

> **Acquisition anchor (locked 2026-05-11):** alongside the v1 product build below,
> the company is running a parallel 12-week acquisition sprint targeting
> **100 paying customers by 2026-08-01**. Strategy + funnel math + channels +
> pricing + weekly milestones in
> [`docs/DESIGN-PARTNER-ACQUISITION-PLAN.md`](docs/DESIGN-PARTNER-ACQUISITION-PLAN.md).
> Operational kits in [`docs/pitch-decks/cold-outreach-templates.md`](docs/pitch-decks/cold-outreach-templates.md)
> and [`docs/DISCOVERY-SCAN-OPERATIONAL.md`](docs/DISCOVERY-SCAN-OPERATIONAL.md). The acquisition sprint and the product
> phased plan are tightly coupled: Phase 5 work (Discovery agent) gets pulled
> forward to support 6/15 Antonio reference scan; Phase 6 onboarding of mid-market
> partner #2 stays on track. The 100-customer goal IS the YC traction story.

> **CEO review 5/2/2026:** Original 5/15 plan was production scaffolding for
> down-market only. Real goal is the tax-native OS for mid-market AND
> down-market: 5 layers (Knowledge, Data, Agent, Orchestration, Governance),
> 10 specialized agents, 3 audiences (preparer, manager/partner, client),
> citations + confidence + audit on every output. Mode: SCOPE EXPANSION.
>
> Four expansions accepted on top of the original baseline: bilateral
> year-round client portal (D3), tax-law diff agent as 10th specialist (D4),
> manager mission-control with capacity planning + exception monitoring +
> advisory surface (D5), IRS-facing control plane via IRS Solutions API +
> 2848/transcripts/CAF/e-file (D6). Total scope = ~70 calendar days of work
> with CC compression. Timeline extended from 5/15 to **7/30** (12 weeks)
> with 19 days of buffer.
>
> Full plan + scope decisions + risks + success criteria:
> [`~/.gstack/projects/minesokim-child-docket/ceo-plans/2026-05-02-docket-os-v1.md`](file:///C:/Users/minse/.gstack/projects/minesokim-child-docket/ceo-plans/2026-05-02-docket-os-v1.md).

### Demo state (preserved as the marketing surface)
- `apps/client-portal` — 38-route walk-through. sessionStorage forms, mocked
  AI, hardcoded everything. Stays live at `docket-client-portal.vercel.app`
  for pitch / Loom / Antonio walkthrough.

### v1 production phased plan — 12 weeks, 6 phases

> **⚠ STALENESS WARNING — read this first.** This phased plan was authored
> 5/2/2026. Items below are listed in the order they were originally
> intended to ship. The actual current state is in
> [`docs/AUTONOMOUS-QUEUE.md`](docs/AUTONOMOUS-QUEUE.md) and the latest
> [`docs/OVERNIGHT-HANDOFF-*.md`](docs/) — those are the source of truth for
> "what shipped, what's queued." Items below are tagged ✅ done /
> 🟡 partial / ⬜ open as of 5/9/2026, but the queue file is canonical.
> Whenever you ask "what's next," read AUTONOMOUS-QUEUE.md FIRST, not this
> phased plan.

**Phase 1 (Weeks 1–2, 5/2 → 5/16) — Foundation + Antonio Production Essentials**
- ✅ Preparer-side SSN/EIN reveal flow on command-room — shipped as per-session unlock with 15-min TTL, role gate (firm_owner/preparer/reviewer), 6/min rate limit, audit row per unlock. See `apps/command-room/src/lib/intake/unlock.ts` + `pii-unlock-button.tsx`.
- ✅ Twilio "Send via SMS" for client invites (per-tenant credentials) — Twilio inbound webhook + outbound via /messages/[id] approve. Credentials installed for Vazant + rotatable via /settings/credentials.
- ✅ Knowledge layer schema in DB + ingestion infrastructure scaffolded — migrations 0019-0021 (firm_profile, firm_patterns, client_facts) + 7 starter authorities seeded + authority full-text search + citation verifier.
- ✅ `packages/tax-graph` package created — exists at `packages/tax-graph/`.
- ✅ Citation rendering scaffolding in agent output — citation-verifier loop in notice-drafter + discovery agent (commit `a58f05d`).
- ✅ Trust gate scaffolding (per-tenant × agent × action-class) — `assertTrustGate` enforcement helper (15 tests, commit `3929fef`). Substrate-without-current-consumer; consumer wiring is Phase 3.
- 🟡 Docs pipeline started: Cloudflare R2 bucket + presigned URL helper — verify state via /smoke-test.
- ✅ Sidebar dead links resolved — /messages (`de266f9`), /documents (`95d1fed`), /settings (`b623ce4`), /settings/credentials (`7e03e7a`).
- ✅ + (added later) Cost dashboard at /dashboard/cost (commit `f170c03` + `86e7e0a`).
- ✅ + (added later) Home dashboard at / (commit `8cc55eb`).
- ✅ + (added later) `@docket/prompts` registry with hash-drift detection (commit `fbae613`).
- ✅ + (added later) PII regex scrubber (commit `8f0c2d5`, 32 tests).
- ✅ + (added later) Audit-trail cryptographic chain — `chain_seq` + `prev_hash` + `row_hash` + nightly `verify_actions_chain` cron (commits `0680874` + `5b4ef92`).

**Phase 2 (Weeks 3–4, 5/16 → 5/30) — Antonio Production Sub-Milestone**
- 🟡 Real bidirectional messages — Twilio inbound webhook ✅ + outbound approval flow ✅; Gmail polling has 8 `TODO(week-1)` stubs in `services/workers/src/functions/gmail-poll.ts` + `classify-gmail-message.ts`.
- 🟡 Square Checkout API integration — scaffold shipped (`cc8edd1`); needs production wiring (real Checkout API call, webhook for paid status, link tied to engagement).
- 🟡 DocuSign embedded signing for Form 8879 with LexisNexis KBA (NIST IAL2) — scaffold shipped (`7d330fd`); needs production wiring (LexisNexis KBA add-on, real envelope creation, webhook for completion).
- ⬜ IRS Pub 17 + FTB residency manual ingested with effective-date versioning — 7 starter authorities seeded; bulk ingestion + effective-date versioning still open.
- ⬜ AAD on AES-GCM bound to (tenant_id, client_id, path).
- ⬜ KEK rotation procedure documented + master-KEK fallback removed.
- ✅ Webhook signature verification helper — shipped at `@docket/shared/webhooks` subpath (commit `b31e91f` + codex-fixup `00cd377`). 32/32 tests, timing-safe.
- ✅ Sentry signup + DSN configured — both apps wired with `app:` tag (commit chain `a122ae5` → `95e2629` → `40c5caa`).
- ✅ + (added later) Bedrock fallback in orchestrator (`callClaudeWithFallover`, commit `303f886`). 38/38 unit tests + 4/4 smoke.
- ✅ + (added later) `/api/health` + `HealthStatusGate` + `assertWritable` server-side gate (commit `c72ba1b`).
- ✅ + (added later) Status banners + ReadOnlyProvider + WriteAction (commit `0521701`).
- ⬜ Neon read replica wiring (B3 in queue file) — `DATABASE_URL_READ_REPLICA` provided; pairs with status-banners; ~1d.
- **🟡 Sub-milestone 5/30: Antonio's full 200+ client base operational on production-grade substrate** — substrate is ~70% there; Square + DocuSign production-real wiring + Gmail polling + AAD-binding + KEK rotation are the remaining must-haves before pointing real client volume at it.

**Phase 3 (Weeks 5–6, 5/30 → 6/13) — Agent Fleet Build-Out**
- Wire intake agent (intake completeness scoring, missing-data prompts)
- Wire doc classification agent (4-phase doc upload pipeline driver)
- Wire missing information agent (cross-doc validation, gap detection)
- Wire planning agent (year-round scenarios, QBI/PTET/entity-choice modeling)
- Wire return drafting agent (workpaper assembly, position drafting, multi-state flagging)
- Wire review agent (junior-staff drafting + senior-prep flagging)
- Wire notice response agent (CP2000/CP504/LT11 triage + drafted response)
- Tax-law diff agent (10th, D4) bones — IRS/FTB monitoring, position-level affected-return surface
- Trust gate enforcement live across all 10 agents
- Confidence scoring + citation rendering on every agent output

**Phase 4 (Weeks 7–8, 6/13 → 6/27) — Orchestration + Manager Mission-Control (D5)**
- Event-driven task routing on Inngest substrate
- Dependency graph (return → workpaper → source doc → intake response)
- SLA tracking (engagement deadlines, review SLAs, response-time SLAs per channel)
- Capacity planning (per-staff-member load, projected throughput, bottleneck detection)
- Workload-aware prioritization (high-confidence cases auto-routed to accelerated prep, position-risk cases to senior reviewers)
- Manager mission-control surface: portfolio view, exception monitoring, margin leakage analytics, advisory-opportunity surface
- Reallocation + escalation flows
- Mid-market partner #2 identification + initial pitching begins

**Phase 5 (Weeks 9–10, 6/27 → 7/11) — Year-Round Portal (D3) + IRS-Facing Layer (D6, DESCOPED)**
- Bilateral year-round portal: AskAntonioChat as persistent surface, year-round tax position summary, planning prompts proactive in Q4, document collection rolling
- 2848 / 8821 e-signing in portal (DocuSign + LexisNexis KBA, NIST IAL2)
- 2848 / 8821 **filing to IRS via Tax Pro Account browser automation** (the official IRS web portal; 2-5 day CAF posting)
- CAF state visualization (read-only, scraped from Tax Pro Account business-firm view per Feb 9, 2026 expansion)
- Notice triage agent on **uploaded** notices (PDF/image upload by client or Antonio; no live-feed dependency)
- Notice response drafting with cited authority (firm-approved before send)
- Tax-software orchestration for e-file (browser automation against OLT for Antonio + ProConnect/UltraTax for partner #2)
- Per-client encrypted IRS credentials in `tenant_credentials` table

> **D6 was descoped 5/2/2026 after IRS API research** (full findings in CEO plan).
> Original D6 included programmatic transcript pulls + direct MeF + live IRS Solutions API.
> Reasons for descope:
> - IRS Transcripts API is invitation-only partner program (Canopy is in; no public path; 12-24 month relationship horizon)
> - Legacy third-party transcript scraping is being shut down (May 23 deadline)
> - e-Services APIs require a user session (breaks autonomous overnight-pull pattern)
> - Bridge providers (TaxStatus, Compliancely) are sales-led pricing with dual-8821 consent conflict + 20-85% margin compression on v1 partners
> - IRS cybersecurity bar (FIPS 140-3, Pub 1075, NIST SP 800-53, PCI DSS-derived practices) is multi-month work; not in v1 scope
>
> **Deferred to v1.5:** programmatic transcript API (path C bridge or direct IRS partner program), EFIN + Software Developer authorization, direct MeF, live IRS Solutions API at depth, full IRS partner program application.
>
> **Net impact:** D6 reversibility 1/5 → 3/5; v1 risk register goes from 5 critical risks to 2 critical (compliance liability on filed forms + agent-prompt-error remain critical). Mid-market partner #2 onboarding no longer blocked on IRS Solutions API access.

**Phase 6 (Weeks 11–12, 7/11 → 7/30) — Partner #2 Onboarding + Hardening + Launch**
- Mid-market partner #2 (regional firm, 20-100 staff) onboarded with full v1 OS
- Both partners running on multi-tenant substrate (no snowflakes per §16)
- E2E tests (Bun + Playwright) across intake → docs → messaging → e-sign → onboarding
- Audit-trail review on every server action
- Approval policy enforcement (filing authority, signed advice, material positions)
- Evidence trail UI
- Retention policy (7-year tax-document retention default, configurable per tenant)
- Pitch deck (5–10 slides), Loom demo, marketing surface
- **✅ v1 launch 7/30**

### Top 5 risks (from CEO plan, post-D6-descope)

1. **Compliance liability on filed forms** — incorrect 2848 filing or missed notice deadline causes legal exposure (sanctions + malpractice). Defense: agent prompt construction is unit-tested + integration-tested + run through eval suite before production; 2848 filings always require human approval (trust gate locked at level 1 for `file` action class); audit trail captures every filed form with the prompt + reasoning that drove it.
2. **Agent prompt error sends wrong filing for wrong client** — single bug in prompt construction could file fake 2848 to IRS for wrong client. Defense: structured prompt construction with client_id binding at every layer; pre-flight verification that the form data matches the client_id before any submit action; mandatory human approval before any IRS-facing submit.
3. **Knowledge layer ingestion brittleness** — start with hand-curated subset (Pub 17 + FTB residency) before automated ingestion; spot-check citations manually before agent output reaches users.
4. **Mid-market partner #2 acquisition timing** — start partner identification Phase 4; warm intros via Antonio's mentor network; pre-build partner-onboarding playbook so engagement-to-production cycle is <2 weeks.
5. **Cathedral-mode scope creep** — explicit no-more-expansions rule for v1 once 5/30 sub-milestone hits. New ideas go to TODOs.md. Schedule "expansion appetite check" at 6/13 and 7/11.

(Risks previously in this list — IRS Solutions API access timing, trust gate calibration on D4 — were either resolved by the D6 descope or absorbed into the must-build list in the CEO plan tactical decisions section.)

### Status of the original 5/15 DEFERS list (revised for production)

**Still deferred (out of scope for first cohort):**
- IRS Solutions live integration (no API access yet — Antonio emails them)
- OLT browser automation (Antonio uses OLT directly for first month)
- Bilingual UI strings (English-only first cohort, translate Spanish in week 3)
- Outcome Prediction (Blue J) integration
- Practice Intelligence module
- Voice agent (voicemail → AI transcribe → drafted reply)
- Auto Doc-chase
- SOC 2 Type II (~6+ months of work, not a 14-day item)
- Multi-state knowledge ingestion beyond CA

**MOVED INTO SCOPE (was deferred, now required for IRS-compliant production):**
- KBA-compliant 8879 e-signature — required by IRS Pub 1345 (NIST IAL2)
  → Wired Day 13 via DocuSign embedded signing (LexisNexis under the hood, $3/KBA)
  → v1+ migration: self-host Documenso + direct LexisNexis InstantID Q&A integration ($1.50/KBA wholesale)

**CORRECTED (was wrong in earlier version):**
- ❌ "Stripe Identity for KYC for 8879" — Stripe Identity is selfie+ID document verification.
  IRS Pub 1345 requires credit-bureau-sourced KBA (NIST IAL2). Stripe Identity does NOT satisfy this.
- ✅ Use DocuSign + KBA (LexisNexis) for 8879. Use Square (Antonio's existing tool) for payments.
- ✅ No Stripe products needed in v0. Drop STRIPE_* env vars until/unless they earn a job.

### Surface ancestry to merge
- **v3 Vazant Dashboard** (`vazant-dashboard-v3.vercel.app`) → Command Room information architecture
- **v4 Vazant Client Portal** (`C:\Users\minse\Downloads\docket-portal-design\`) → editorial-warm design language
- v0 = v3's IA in v4's design (already shipped in demo)
- production = real backend behind same UI

### Post-5/15 — 12 weeks to paying customer (Antonio onboarded)



### Phase 1 (Weeks 1–3) — Foundation infra + Client Portal port
Port the design while the orchestrator is being built in parallel.

- Repo scaffolding (Turborepo + pnpm + TS) ✅
- Postgres + Drizzle schema + RLS policies
- Clerk auth (phone-based) + Square Checkout ($50 deposit) + DocuSign+KBA (8879 e-sign)
- Twilio for SMS OTP
- Two Next.js app shells ✅
- Practice ledger schema + audit middleware
- Port `apps/client-portal/` from JSX prototype:
  - Move components into Next.js app router structure
  - Replace localStorage with real Postgres-backed state
  - Wire SMS OTP, document upload (R2 + presigned URLs), engagement-letter and 8879 signing
  - Bring `tokens.jsx` into `packages/ui/` (already done) + the design primitives

### Phase 2 (Weeks 4–6) — Orchestrator + first MCP servers + Morning Brief
- `services/orchestrator` wrapping direct Anthropic SDK with cost telemetry + audit hook + caching ✅
  (migration to Claude Agent SDK deferred until MCP gateway is the substrate)
- MCP gateway with tenant scoping
- `ledger` and `knowledge` MCP servers
- Trust escalation gate (level 1 only — every action approved)
- Knowledge ingestion for IRS forms/instructions/pubs (current + 3 prior years)
- Knowledge ingestion for FTB pubs + Legal Rulings + Residency manual
- Versioning by effective date
- `gmail` and `xero` MCP servers
- **Morning Brief agent** end-to-end with mock data
- **First demo to Antonio:** real morning brief from real data

### Phase 3 (Weeks 7–9) — Browser automation harness + OLT v0
- Playwright workers + queue (Inngest)
- Encrypted credential vault per tenant (Infisical)
- `olt` MCP server (read-only first: list returns, get state)
- `irs-solutions` MCP server (read-only: pull transcripts, list notices)
- Inngest jobs for async automation
- Mock e2e: trigger an OLT pull from the orchestrator

### Phase 4 (Weeks 10–12) — Wedge automation + Inbox Drafter + Portal MVP
- `olt` write actions (prefill, push fields)
- **OLT Prep Handoff agent** (or Notice Triage — Antonio's choice in week 1)
- **Inbox Drafter agent**
- Approval queue UI in Command Room
- Client Portal v0 (upload, chat, status)
- **Second demo to Antonio:** end-to-end prep handoff or notice triage

### After week 12
Foundation package is real. Onboard tenant 0. Start week 13 = expansion engagement.

---

## 16. Productization discipline

The rules that prevent services-revenue from killing the platform:

1. **Time-box engagements.** 1–2 week Foundation (productized, fixed price). 6–8 week Phase 1 build. Anything longer requires "this becomes a platform module" justification.
2. **Charge for outcomes, not hours.** Fixed-price Foundation. Retainer for expansion. Never hourly.
3. **Every engagement must produce platform IP.** New MCP integration, new playbook, new agent, or new UX module that ships to all customers.
4. **Refuse out-of-thesis work.** No "build us a chatbot for our marketing site." Tax practice ops only.
5. **Pick wedge clients deliberately.** 3–5 design partners across distinct segments: bilingual storefront EA, small CPA firm, EA specializing in rep work, multi-state practice. Not ten partners.
6. **Track platform readiness as a KPI.** "% of new engagement built from existing platform modules." Goal: rises every quarter. When it hits 70%, SaaS unlocks.

---

## 17. Competitive landscape (April 2026)

**Three layers of the AI-tax stack are forming. Docket is the third layer.**

| Layer | Who's there | Docket's stance |
|---|---|---|
| **Data layer** (K-1, K-3, 1099 ingestion) | K1x ($175M growth, Apr 2026) — 44 of top-100 institutional investors | Integrate, don't compete |
| **Return-prep agent layer** (autonomous prep + review) | Accrual ($75M, Feb 2026) · Basis ($1B+, Feb 2026) · Black Ore Tax Autopilot ($60M, GA Apr 2026) · TaxGPT (Tax Prep Agent + Agent Andrew, Mar 2026) · Juno ($12M seed, Apr 2026) · Filed · Grove · StanfordTax · SmartRequestAI · Soraban · Taxlytic | **Don't compete head-on. Orchestrate them via browser automation.** |
| **Practice + relationship layer** (the day, the comms, the ledger, the rep loop) | **Empty for AI-native.** PM incumbents (TaxDome, Canopy, Karbon) shipping shallow AI features. Canopy released triage, beat us to it. | **This is Docket's lane.** |

### Notable secondary entrants
- **Gelt** (Series A Sep 2025, $13M) — year-round wealth optimization, HNW
- **Deduction / Taylor CPAI** ($2.8M pre-seed Nov 2025) — consumer agent
- **Rally Tax** (YC) — year-round HNW subscription
- **April** ($38M Series B Jul 2025) — embedded B2B2C tax for wealth/payroll
- **Perplexity Computer for Taxes** (Apr 2026) — $17/mo consumer-side, drafts federal returns
- **Instead** — tax planning + IRS notice monitoring
- **CPA Pilot** — IRS notice triage

### Practice management incumbents shipping AI
- **TaxDome AI** — file detection, NL reporting, bundled
- **Canopy** — direct IRS integration, transcript pulls; AI is shallow but shipping
- **Karbon** — strongest email AI among PM incumbents

### Practiq — horizontal-shallow adjacency (not direct competitor)
[practiq.dev](https://practiq.dev/) — AI workspace for boutique professional services firms (multi-vertical: accounting, law, HR, consulting, marketing). Tagline: *"AI built around your clients, not your chats."* Client-scoped memory, autonomous overnight scanning, AI-generated deliverables in firm voice, anomaly detection. **Explicitly admit they have no client portal** — pair with TaxDome/Canopy. Owned by Grindworks/Cliwant (DE).

**They have to build 12–18 months to reach our tax-vertical depth:** no IRS knowledge layer, no rep work pillar, no portal, no tax-software integration. Watch but don't react. Steal: "memory scoped to the client" framing (locked into Docket positioning), autonomous overnight scanning marketing pillar, "in firm voice + client preferred format" phrasing.

### Strategic read
The well-funded AI-native competitors ($235M+ combined) are economically forced up-market. They cannot serve Antonio's segment. The PM incumbents ship shallow AI features but lack return intelligence. **The third layer — practice + relationship + rep — is open.** Docket's structural lane.

### Outcome prediction — Blue J
[Blue J](https://www.bluej.com/) does ML on tax cases for outcome prediction. Plan: partner via API for v1 outcome prediction service. Long-term, build native predictive model trained on practice ledger (the unique dataset only Docket can build).

---

## 18. Repo structure & conventions

### Actual structure (5/2/2026)

```
docket/
├── apps/
│   ├── client-portal/        # Next.js 15, port 3001. 38 routes shipped.
│   └── command-room/         # Next.js 15, port 3000. 4 working routes
│                             #   (sign-in, /clients, /clients/new, /clients/[id]).
│                             #   /messages /documents /settings = sidebar links → 404.
│                             # NO admin/ app — command-room subsumes it.
├── services/
│   ├── orchestrator/         # 109 LOC. Direct @anthropic-ai/sdk wrapper:
│   │                         #   cost telemetry, prompt caching, audit hook,
│   │                         #   model tiering. NO MCP routing yet.
│   └── workers/              # Inngest jobs. 2 built agents
│                             #   (triage-classifier, inbox-drafter) +
│                             #   2 Inngest functions (gmail-poll,
│                             #   classify-gmail-message — 8× TODO(week-1)
│                             #   stubs for Gmail/DB plumbing).
│   #                           NO mcp-gateway/, browser-workers/, ingestion/ yet.
├── mcp-servers/              # EMPTY — directory exists, zero servers built.
│                             # Build order is paper spec. Defer post-5/15.
├── packages/
│   ├── db/                   # Drizzle schema (13 tables, 8 enums) +
│   │                         #   12 migrations (0000–0012) + RLS policies +
│   │                         #   encryption (master KEK + per-tenant DEK
│   │                         #   AES-256-GCM, in-process LRU cache) + seed
│   │                         #   (tenant + DEK + 1 user; NO mock clients).
│   ├── shared/               # IntakeState, intake-schemas (Zod), branded
│   │                         #   types, role helpers, in-process rate limit,
│   │                         #   masking (lives in intake.ts, NOT a separate
│   │                         #   masking.ts), formatters, sentry scrubber,
│   │                         #   tax-year. 7 test files, 112 tests pass.
│   └── ui/                   # tokens.ts (editorial/minimal/magazine tones,
│                             #   forest green oklch, Fraunces + DM Sans),
│                             #   TenantDisplayProvider, 30+ design primitives,
│                             #   intake-icons, services-catalog. Solar icon
│                             #   set is one 7,848-line file (tree-shaking
│                             #   liability flagged in audit).
│   #                           NO tax-graph/, agents/, playbooks/ yet.
├── content/
│   ├── authority/            # EMPTY — IRS/FTB ingestion deferred post-5/15
│   └── strategy-library/     # EMPTY — internal playbooks deferred post-5/15
├── docs/
│   ├── STRATEGIC-BRIEF.md      # full strategic synthesis
│   ├── PERSONA.md              # Antonio's reality
│   ├── ARCHITECTURE.md         # data model + RLS + encryption boundary
│   ├── BACKUPS.md              # backup/restore plan
│   ├── DECISION-JOURNEY.md     # how we got here
│   ├── DESIGN-NOTICE-TRIAGE-V0.md
│   ├── DOCS-CAPTURE-PIPELINE.md  # the 4-phase doc upload pipeline
│   ├── HOSTING.md / HOSTING-RESEARCH.md
│   ├── POST-5-15.md            # what's NOT in the demo cohort
│   ├── SLICES.md               # founder's verbatim framings
│   └── SESSION-HANDOFF-*.md    # per-session deltas (latest wins)
├── .claude/
│   ├── memory/               # 11 .md files mirroring user-level memory
│   ├── hooks/                # check-gstack.sh
│   └── settings.json
├── COSTS.md                  # cost discipline rules
├── README.md
└── CLAUDE.md                 # this file
```

### Conventions
- `@docket/*` workspace package names (`@docket/db`, `@docket/shared`, `@docket/ui`, `@docket/client-portal`, `@docket/command-room`, `@docket/orchestrator`, `@docket/workers`).
- Inline styles preserved for design-locked components (intake, portal). Tailwind v4 utility classes for new command-room layouts only.
- All branded types from `@docket/shared`.
- Drizzle schema in `packages/db/src/schema.ts` is the source of truth. Migrations in `packages/db/migrations/`.
- Multi-tenant isolation via Postgres RLS (`ENABLE + FORCE`). App reads/writes wrap in `withTenant(tenantId, async (db) => ...)` which `SET LOCAL app.current_tenant_id` for the transaction.
- `getAdminDb()` BYPASSES RLS — used ONLY in `apps/client-portal/src/lib/intake/auth.ts` (phone → tenant chicken-and-egg) and `apps/command-room/src/lib/current-user.ts` (Clerk session → user/tenant). Don't add a third caller without a SECURITY.md justification.
- Audit trail (`actions` table) on every tool call + every state-changing server action. INSERT-only via trigger, with one exception (migration 0012: FK-cascade SET NULL on `client_id`).
- All env vars in `.env.local` (gitignored, never committed). `.env.example` documents required keys.

### Cross-package context pattern (firm-owner display)
1. Layout (`(intake)/layout.tsx`, `portal/layout.tsx`) calls `resolveClient()` server-side.
2. Wraps children in `<TenantDisplayProvider tenantName={...} firmOwner={...}>` (from `@docket/ui`).
3. Components consume via `useFirmOwner()` / `useTenantName()` / `initialsOf()`.
4. Avoids prop-drilling firm-owner data through 27+ pages.

### Verified working (5/2/2026)
- `pnpm install` clean
- Both Next.js apps deployed to Vercel and serving real traffic:
  - `apps/client-portal` → `https://docket-portal.vercel.app` (production rebuild)
  - `apps/client-portal` legacy demo → `https://docket-client-portal.vercel.app` (mocks; do NOT point real flows here — kept alive for marketing/Loom)
  - `apps/command-room` → Vercel host configured this session; check Vercel dashboard
- 12 migrations applied against Neon dev branch. Database state post-`0012_actions_allow_fk_cascade_null.sql`.
- 112 tests pass: `cd packages/shared && bun test src` (the `pnpm test` glob doesn't expand on Windows; run from package dir).
- Hello-world Claude SDK verified: Sonnet 4.6, $0.0005, 1.8s latency. Haiku 4.5 verified: $0.0001 per Priya doc-mismatch classification, <1s.
- Both agents (triage-classifier, inbox-drafter) call `runDocketAgent` cleanly with cost telemetry and audit hooks firing.
- Phone-OTP auth works end-to-end against Clerk + Twilio. Phone-binding gate redirects unbound phones to `/no-access`.
- 28 intake pages persist field writes via `useIntakeField` → `saveIntakeField` server action → Postgres (encrypted for SSN/EIN/bank, RLS-scoped per tenant).

### Known stubs and mocks (must not be claimed as "done")
- **Form 8879 mock route** at `/portal/sign-8879` — gated behind `NEXT_PUBLIC_ENABLE_MOCK_8879=true`. Hard-disabled in prod by default. Real DocuSign + LexisNexis KBA path is Day 13 of build order.
- **Stripe placeholder copy** still on `/deposit` page despite `STRIPE_*` env vars being dropped. Square Checkout integration is Day 8–9.
- **Twilio "Send via SMS"** button on `/clients/new` — currently greyed out with "Coming soon" hint. Per-tenant Twilio creds + server action not built.
- **Preparer-side SSN/EIN reveal** — masked-only on command-room today. Mirror of `client-portal/src/lib/intake/reveal.ts` not yet built; gated read by `firm_owner | preparer | reviewer` is the planned shape.
- **Sidebar dead links** in command-room: `/messages`, `/documents`, `/settings` 404. Need at least placeholder routes.
- **Trust escalation gate** — placeholder enum on tenant; no enforcement code.
- **MCP gateway** — does not exist (orchestrator is pre-MCP).
- **`tenants.clerk_org_id` is NULL** in dev — Antonio hasn't created the Clerk Organization yet, so the email-claim fallback path in `current-user.ts` is the active one.
- **Hardcoded "Vazant Consulting" / "Antonio Vazquez" copy** in `apps/client-portal/src/app/(intake)/welcome/content.tsx`, `apps/client-portal/src/app/page.tsx`, `apps/client-portal/src/app/(intake)/deposit/page.tsx`, `apps/client-portal/src/app/portal/sign-8879/page.tsx` (mock only). Marked with TODO(multi-firm). Not load-bearing until tenant #2.
- **Trial fonts** in `public/fonts/trial/` (Suisse Int'l + FAIRE Octave). License forbids commercial use; trial expires 5/14/2026. License OR revert before that date.
- **Sentry SDK installed**, no DSN set yet → `Sentry.captureException` is a no-op. Founder will sign up before real client onboards.
- **Rate limiter is in-process** (per-Vercel-lambda Map). Upstash Redis swap is Day 9.
- **Webhook signature verification helper** not built — needed before Square / DocuSign / Twilio / Inngest webhooks land.
- **AAD on AES-GCM** not bound to `(tenant_id, client_id, path)`. Master-KEK fallback path in `encryption.ts:194-215` is still live; run `pnpm --filter @docket/db reencrypt-legacy --dry-run` before any real client onboards.

---

## 19. Feedback — the small things (ported from memory)

These are user preferences and rules that came from prior conversations. Honor them on every change.

### Anti-AI-slop design (load-bearing)
- No vibe-coded look
- No decorative highlights
- No left-border accent lines on cards
- No decorative icons
- Use real brand logos (not generic icons)
- Intentional design only — every element earns its place
- Editorial warmth, not "AI dashboard"
- **Why:** the look will get judged. Slop disqualifies.

### Sync popup ↔ full page
When updating the client detail dialog, ALWAYS update both the popup and the full page together. They share data — they should never drift.

### Popup billing tab
The client popup has its own billing tab. **Don't add BillingCard to popup overview** — it's redundant with the existing tab.

### Voice
- Don't summarize what you just did at the end of every response — the user reads the diff
- Be terse. State results and decisions directly.
- No emojis unless explicitly requested.
- Cite file paths as markdown links (`[file.ts:42](path/to/file.ts:42)`).

### Iteration discipline
- Verify in browser before declaring UI work done
- Type checking and tests verify code correctness, not feature correctness
- If you can't test the UI, say so explicitly rather than claiming success

---

## 20. References & inspirations

### Direct templates
- **[FluentOS](https://www.fluentaiconsulting.com/fluentOS)** — productized AI consulting structure (3-day Foundation + retainer + ownership path). Built on Claude Code. Pattern we follow.
- **[Garry Tan's gstack](https://github.com/garrytan/gstack)** — workflow framework we use. Installed globally. 23 specialist roles + 8 power tools.
- **[Anthropic MCP](https://modelcontextprotocol.io/)** — integration substrate.
- **[Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)** — reasoning + tool orchestration substrate.

### Competitive references
- **[TaxGPT — Tax Prep Agent + Agent Andrew](https://www.taxgpt.com/blog/taxgpt-launches-agent-andrew)** — proves browser automation against tax software at scale.
- **[Black Ore Tax Autopilot (GA Apr 29, 2026)](https://www.globenewswire.com/news-release/2026/04/29/3283985/0/en/Black-Ore-Launches-Tax-Autopilot-for-Broad-Availability.html)** — top-25 firm reference.
- **[Accrual ($75M, Feb 2026)](https://www.businesswire.com/news/home/20260205968515/en/Accrual-Launches-with-$75-Million-to-Bring-AI-Native-Automation-to-Accounting)** — every fed/state form, prep + review.
- **[Basis ($100M Series B, $1.15B valuation)](https://www.businesswire.com/news/home/20260224020999/en/Basis-Raises-$100M-at-a-$1.15B-Valuation-as-Accounting-Firms-Adopt-End-to-End-Agents-Across-Accounting-Tax-and-Audit)** — long-horizon agents, autonomous 1065.
- **[K1x ($175M, Apr 2026)](https://www.businesswire.com/news/home/20260416792552/en/K1x-Secures-$175-Million-Growth-Investment-to-Scale-Digital-Infrastructure-for-Private-Market-Tax-Compliance)** — data layer, partnership target.

### Outcome prediction
- **[Blue J](https://www.bluej.com/)** — judicial-precedent-based outcome prediction. v1 partnership target.

### Design partner ecosystem
- **[IRS Solutions](https://www.irssolutions.com/)** — Antonio's rep platform; we orchestrate, don't replace.
- **[Latino Tax Pro](https://latinotaxpro.com/)** — bilingual EA training network (segment context).

### Pattern references (don't use as base, adopt patterns from)
- **[OpenClaw](https://github.com/openclaw/openclaw)** — local gateway pattern, messaging-as-UI
- **[Hermes Agent](https://hermes-agent.nousresearch.com/)** — skills/learning loop concept

---

## 21. Open questions

1. **Brand structure.** One name with two postures (Docket platform / Docket consulting), or two names (Docket + parent brand)? Decide before public launch. **Naming track open** — Linden, Linnea, June, Vera, Grace, Quill all rejected as of 2026-05-11. Currently paused; user will resume the search later. Until then, "Docket" remains the working codename.
2. **The 30-second wedge demo.** What's the "holy shit" moment for Antonio prospects? Hypothesis: a return getting prepped through OLT via browser automation while the preparer watches.
3. **Second design partner.** First is Antonio (CA EA, OLT/IRS Solutions/Xero). Who's #2 — small CPA firm, bilingual storefront, rep specialist?
4. **Tax co-founder situation.** ~~Recruiting target or existing relationship?~~ **CLOSED 2026-05-11**: this was never the right question — the company has two co-founders (David CEO + Haokun CTO, 5+ year relationship, on the project from inception per §1 Project identity), and the tax-domain depth runs through **Antonio Vazquez, EA** as the on-platform tax advisor (formalized 2026-05-11, equity 1%). All Position Library content, every tax-position classification, every cited-authority decision routes through Antonio. **Contracted backup advisors** ($200-400/hr, 5-10hrs/wk, sourced from AICPA + NAEA networks per `docs/CONTRACTED-EXPERT-OUTREACH.md`) provide scale-validation when Antonio's bandwidth is constrained (e.g., during his two active 2026 IRS audits). The 20-position Position Library v0 ships with explicit "reviewed by Antonio" sign-off per position, not "AI-classified." Earlier accelerator drafts (`docs/accelerator-applications/`) referenced this hire as open — refreshed 2026-05-11 to reflect the advisor-not-hire posture.
5. **The wedge agent.** OLT prep handoff vs notice triage. Decide week 1 with Antonio.

---

## 22. Boot-up pointers

When loading this project cold, in this order:

1. **Read this CLAUDE.md** (you are here). It now reflects reality as of 5/2/2026, not aspiration.
2. **Then read the most recent session handoff** in `docs/SESSION-HANDOFF-*.md` — the latest captures session-specific deltas (what shipped, what's open, what the founder decided). When this CLAUDE.md and a newer handoff disagree, **the handoff wins** until a docs-pass folds it back in.
3. **Verify the dev DB is caught up** before writing any code that touches schema:
   ```bash
   pnpm --filter @docket/db migrate
   ```
4. **Skim the live deployments** before assuming what works:
   - Open `https://docket-portal.vercel.app/login` → should show login UI
   - Open the command-room URL (in Vercel dashboard) → `/clients` should show the empty state
5. **Strategic detail:** [`docs/STRATEGIC-BRIEF.md`](docs/STRATEGIC-BRIEF.md) — full strategic synthesis.
6. **The journey, not the destination:** [`docs/DECISION-JOURNEY.md`](docs/DECISION-JOURNEY.md) — chronological narrative of how we got here, what we considered, what we rejected, when to revisit each lock-in.
7. **User's verbatim framings:** [`docs/SLICES.md`](docs/SLICES.md) — actual passages the user wrote at each decision point. The framings ARE the product. When in doubt about voice, re-read.
8. **Persona:** [`docs/PERSONA.md`](docs/PERSONA.md) — Antonio at Vazant.
9. **Architecture detail:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — data model, RLS, encryption boundary.
10. **Doc-capture pipeline detail:** [`docs/DOCS-CAPTURE-PIPELINE.md`](docs/DOCS-CAPTURE-PIPELINE.md) — the 4-phase doc upload pipeline.
11. **Memory mirrors:** [`.claude/memory/`](.claude/memory/) — anchored copies of project memory files.
12. **Cost rules:** [`COSTS.md`](COSTS.md) — $50/mo discipline.
13. **Design source (legacy):** `C:\Users\minse\Downloads\docket-portal-design\` — the 36-screen prototype we ported from. Mostly historical now; tokens + components live in `packages/ui/`.
14. **Verify gstack:** `test -d ~/.claude/skills/gstack/bin && echo OK`
15. **If user has invoked `/overnight`** (the hands-off autonomous mode — see §23 + [`.claude/skills/overnight/SKILL.md`](.claude/skills/overnight/SKILL.md)): **RE-READ the overnight skill at every task boundary**, not just session start. The skill is load-bearing per founder mandate 2026-05-12. Hard rules (NEVER `--no-verify` / `Protocol-Skip` on feat|fix / skip codex / mark `Craft: N/A` on UI / skip /e2e past cadence / commit with Score<95 / commit MISALIGNED) are immutable for the duration of overnight mode. If a rule cannot be satisfied on a given commit, STOP and surface to the user. Stopping is fine; skipping is not.
16. **Confirm with David:** any decisions reversed since last session? Any new slices to capture?

---

## 23. Skill routing (gstack)

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

| Request | Skill |
|---|---|
| Product ideas / brainstorming | `/office-hours` |
| Strategy / scope question | `/plan-ceo-review` |
| Architecture decision | `/plan-eng-review` |
| Design system / UI plan review | `/design-consultation` or `/plan-design-review` |
| Full review pipeline | `/autoplan` |
| Bug / error / "why is this broken" | `/investigate` |
| QA / test the site | `/qa` (with fixes) or `/qa-only` (report) |
| Code review / diff check | `/review` |
| Visual polish on live site | `/design-review` |
| Ship / deploy / PR | `/ship` then `/land-and-deploy` |
| Save progress mid-session | `/context-save` |
| Resume context | `/context-restore` |
| Independent code review | `/codex` |
| Security audit | `/cso` |
| End-to-end verify a feature | `/smoke-test` (project-local; see `.claude/skills/smoke-test/`) |
| **Hands-off autonomous overnight mode** | **`/overnight`** (project-local; load-bearing; see `.claude/skills/overnight/SKILL.md` — LOCKED 2026-05-12) |

### Project-local skills

Beyond gstack, this repo ships ten project skills that together form the autonomous build cycle:

- **[`/overnight`](.claude/skills/overnight/SKILL.md)** — **LOAD-BEARING.** The hands-off autonomous mode contract. Same protocol-gate cycle as face-to-face work, but with HARD rules around `--no-verify`, `Protocol-Skip`, codex skipping, `Craft: N/A` on UI, /e2e cadence, Score floor (95), and a $5-per-session cost ceiling. Picks the next task via a scored algorithm (unblocks-other-work + Antonio-demo-dependency + hard-deadline + substrate-low-risk minus PROD-credential-required / schema-migration-approval). Comprehensive stop conditions enumerated. User-codified 2026-05-12: *"if its overnight mode dont just make it a skill you glance over and forget. make it higher in power so that you actually listen."* Re-read at every task boundary, not just session start.
- [`/edge-cases`](.claude/skills/edge-cases/SKILL.md) — runs BEFORE implementation. Forces explicit enumeration of 8-15 edge cases (input / state / failure-mode / time / permission / domain-specific) with handle-vs-document-vs-out-of-scope status. Catches "shipping happy path, finding edge cases in prod" drift.
- [`/code-quality`](.claude/skills/code-quality/SKILL.md) — runs BEFORE commit. Pre-commit gate that BLOCKS AI-sloppenheimer. Forces structural checks (typecheck, tests, no console.log, no undocumented `any`, lockfile-package.json sync) + substantive checks (pattern adherence, error handling, comment quality, atomicity) + post-push deploy verification (curl + Vercel state must be READY before next item). Reference exemplar: `packages/shared/src/webhook-verification.ts`.
- [`/smoke-test`](.claude/skills/smoke-test/SKILL.md) — runs AFTER implementation. Required after any change touching Inngest workers, document processing, storage helpers, server actions firing events, encryption, or new /api/* routes. Reference template: [`services/workers/scripts/smoke-finalize.ts`](services/workers/scripts/smoke-finalize.ts).
- [`/decisions-log`](.claude/skills/decisions-log/SKILL.md) — runs ALONGSIDE every commit + AT SESSION END. Tracks autonomous judgment calls (naming / UX / scope cuts / architecture trade-offs / defaults / deferrals) in [`docs/AUTONOMOUS-DECISIONS.md`](docs/AUTONOMOUS-DECISIONS.md). User reviews periodically; pending entries get auto-marked reviewed-approved after 7 days for low/medium severity.
- [`/keep-going`](.claude/skills/keep-going/SKILL.md) — runs BETWEEN items. Kills the natural-pause-handoff anti-pattern. After a clean commit + deploy + verify cycle, pick the next item from queue → followups → PRODUCTION-READINESS automatically. Do NOT pause to ask "which direction next?" Stop only when a real stop condition fires. User-codified 5/8/2026: "i wanted it to keep going here. until the feature list is complete."
- [`/score`](.claude/skills/score/SKILL.md) — runs AFTER every feature ships. 12-dimension production-readiness scoring (0-100 weighted average). If < 95, identifies the lowest-scoring gap and loops the same item through another iteration until it passes. Floor and ceiling guardrails prevent both self-flagellation and inflation. /keep-going only advances to the next item AFTER /score >= 95 on the current one. User-codified 5/8/2026: "it should be a loop. each feature check/end to end coding should do a score assessment."
- [`/align`](.claude/skills/align/SKILL.md) — runs BETWEEN /score and /keep-going. Asks the harder question /score doesn't: does this feature actually serve the product mission, the goal, the segment posture? Six-question alignment check against the 12 product anchors + 7 explicit NOs. If misaligned, reshape OR kill before merging. User-codified 5/8/2026: "look at the grand plan of the product as a whole. the mission, the goal, and the alignment of the feature with our grand goal. if it doesn't align, fix."
- [`/craft`](.claude/skills/craft/SKILL.md) — runs AFTER /code-quality, BEFORE /score on any UI-touching commit. Apple-bar UX gate. Six-question check: would I screenshot it / does the eye land on the right thing / does hierarchy do the work without color-borders-icons / does the copy have voice / are empty-loading-error states designed / does every element earn its place. Anti-AI-slop discipline applied to UI specifically. Captures the two coexisting visual languages (editorial-warm portal vs operational-modern command-room, locked 5/8 from user-shared dashboard reference). User-codified 5/8/2026: "is this beautiful user experience? is this good ui? is this how apple would handle the user experience?" + clarification: "that doesn't mean make the ui look like apple" — Apple is the BAR (rigor of craft), not the visual reference. Docket's languages stay Docket's.
- [`/e2e`](.claude/skills/e2e/SKILL.md) — runs PERIODICALLY (every N feature commits OR before any release). App-level end-to-end smoke that exercises the whole stack — migrations, server actions, Inngest agent fleet, audit chain, cost telemetry — composing as a single user journey. Catches the "individual features pass; composition is broken" failure mode. User-codified 5/8/2026: "is it possible to do end to end testing every once in a while with the app as a whole?"

The full cycle: plan → /edge-cases → implement → typecheck → test → /code-quality (lockfile, anti-patterns, codex if substantial) → /craft (UI-touching commits only) → commit (with /decisions-log entry if applicable) → push → verify deploy READY (curl test endpoint if applicable) → /smoke-test if applicable → /score (loop until >= 95) → /align (reshape if misaligned) → periodically /e2e → /keep-going (pick next item) ⟲

### Protocol enforcement (HOOKS, not docs — locked 2026-05-08)

User mandate: *"never ever make this mistake again. you are jeopardizing me."* After an autonomous session shipped 11 commits while skipping `/score`, `/align`, `/edge-cases`, `/craft` entirely, the protocols moved from optional documentation into hard hooks.

**Setup (run once on fresh clone):**
```bash
pnpm hooks:install   # sets git core.hooksPath = .githooks/
```
The `prepare` script runs this automatically on `pnpm install`.

**Pre-commit hook** (`.githooks/pre-commit`):
- Runs `pnpm typecheck` across all workspaces.
- Runs `bun test src` in `packages/shared` (the validation-layer-of-record for branded types, scrubPII, trust-gate, webhook verification).
- Fails the commit if either fails.

**Commit-msg hook** (`.githooks/commit-msg`):
- Invokes `bun run scripts/protocol-gate.ts --commit-msg <file>`.
- For commits whose subject starts with `feat(` or `fix(`, REQUIRES these trailers in the body:
  ```
  Edge-Cases: <N> enumerated, <N> handled, <N> documented
  Score: <0-100>/100
  Align: ALIGNED | MISALIGNED | BORDERLINE
  Craft: PASS | FAIL | N/A — substrate-only
  Codex-Reviewed: PASS | PASS-with-fixes-applied
  Decisions: [<n>] | none
  Compliance-Check: <≥80-char answer to "did I do what I was supposed to do?">
  ```
- Substantive thresholds:
  - `Score < 95` → BLOCKED. The user codified the floor: *"it needs to be 95+. if it doesn't reach those metrics, do it until it does."*
  - `Align: MISALIGNED` → BLOCKED. Reshape or kill before committing.
  - `Craft: FAIL` → BLOCKED.
  - `Craft: N/A` on a commit that touches UI files (any `apps/*/src/app/**.{tsx,jsx,css}`, `apps/*/src/components/**.{tsx,jsx,css}`, `packages/ui/src/components/**.{tsx,jsx}`, `packages/ui/src/tokens.{ts,tsx}`, `packages/ui/src/styles.css`) → BLOCKED. Run `/craft` and report PASS/FAIL.
  - `Codex-Reviewed` missing → BLOCKED. Run codex via `bash scripts/codex-review-staged.sh` (wraps `codex review --uncommitted`); fix any findings; commit with `Codex-Reviewed: PASS` or `PASS-with-fixes-applied`. NO N/A escape — codex itself flagged on the gate's first commit that allowing N/A would let the AI bypass the enforcement by claiming "trivial." For genuine emergencies (codex CLI broken, infra outage), use `Protocol-Skip` with a >=10-char reason. User mandate 2026-05-09 escalation: *"you continually skip steps i tell you not to skip. continually. over and over. it is very frustrating. bake it in."*
  - `Compliance-Check < 80 chars` → BLOCKED. The trailer must be a real answer to "did I do what I was supposed to do?" — naming the specific user instructions verified, the protocols that ran, and any gaps not hidden. "yes" / "I think so" / single-word answers are not allowed.

**/e2e cadence enforcement** (added 2026-05-09):
- WARN at >= 3 feat|fix commits since last `/e2e` pass
- BLOCK at >= 6 feat|fix commits since last `/e2e` pass
- State file: `.gstack/last-e2e-sha` (gitignored, per-developer-machine)
- Recorded automatically by `pnpm --filter @docket/workers e2e` wrapper
- Manual record: `bun run scripts/protocol-gate.ts --record-e2e-pass`

### The compliance-check rule (locked 2026-05-08)

User mandate verbatim: *"write something into yourself that asks 'did i do what i was supposed to do?' that should be the most important thing after you think you are finished. you have to follow my rules. please."*

**The rule, baked in:** Before declaring any task complete (commit, deploy, summary, handoff, response to the user), the AI MUST answer the question *"did I do what I was supposed to do?"* in writing. The answer:
1. Names the specific user instructions in scope.
2. Lists which protocols ran (`/edge-cases`, `/score`, `/align`, `/craft`, `/decisions-log`, `/smoke-test`, `/e2e`).
3. Identifies any gap, shortcut, or deferred item, openly. Hidden gaps are the failure mode this rule blocks.

This trailer is enforced on every `feat(...)` / `fix(...)` commit by the protocol-gate. For non-commit completion moments (responses to the user, handoff docs, summaries), the AI must include the same self-check explicitly. CI surfaces every commit's Compliance-Check trailer in the protocol-gate job's output so the user can read them in one place.

**Escape hatch** — `Protocol-Skip: <≥10-char reason>` trailer. Bypasses validation but:
1. Logged to `docs/protocol-skips.jsonl` with timestamp + sha + reason.
2. CI surfaces every protocol-skip in the `protocol-gate` job's output.
3. The skip is auditable forever in the git log.

**CI gate** (`protocol-gate` job in `.github/workflows/ci.yml`):
- Runs `bun run scripts/protocol-gate.ts --range <base..head>` against every commit in a PR (or last commit on push to main).
- Re-validates server-side so `git commit --no-verify` locally doesn't get past review.

**Why hooks not skills:**
The user's own audit (2026-05-08): *"the protocols are written as gates another agent could enforce. Running them on myself means catching myself before commit, and 'just commit, come back later' beats 'stop and run /score' every time when nothing external blocks me."* The hooks ARE the external block.

### Canonical reference docs (re-read at session start)

Beyond this CLAUDE.md, six docs anchor product + ops decisions and SHOULD NOT be duplicated inline:

- [`docs/AUTONOMOUS-PROTOCOL.md`](docs/AUTONOMOUS-PROTOCOL.md) — **bootloader for any AI working autonomously**. Read FIRST on session start, especially after context refreshes. Defines the four-skill build cycle (edge-cases → code-quality → smoke-test → decisions-log), session-start ritual, communication protocol, anti-patterns blocked, and the recovery sequence after window-fill resets. The user-facing rule: "the skills work every time. every time. every time."
- [`docs/PRODUCT-ROADMAP.md`](docs/PRODUCT-ROADMAP.md) — master product reference. Every feature, every phase, every defer. The five product pillars. V1 / V1.5 / V2 timeline. Marketing positioning lock. Distribution + GTM. Pricing. Open questions + risks. Explicit NOs. Supersedes the v1 phase plan that previously lived inline in §15 below.
- [`docs/POSITION-FRAMEWORK.md`](docs/POSITION-FRAMEWORK.md) — compliance-first deduction surfacing. Four-tier confidence framework + refusal floor. The marketing differentiator. Re-read before changing any agent that emits a tax position.
- [`docs/MEMORY-ARCHITECTURE.md`](docs/MEMORY-ARCHITECTURE.md) — six-layer memory model + cost-optimized prompt caching strategy. Re-read before changing prompt assembly order or the agent fleet's context-loading pattern.
- [`docs/PRODUCTION-READINESS.md`](docs/PRODUCTION-READINESS.md) — punch list of resilience / observability / security / dev-process gaps with priority tiers. Re-read every Friday during v1 build. Items get crossed out, not deleted.
- [`docs/POST-5-15.md`](docs/POST-5-15.md) — what's deferred. (Earlier-version "what's not in the demo cohort" doc; see PRODUCTION-READINESS for current deferred list.)
- [`docs/DESIGN-PARTNER-ACQUISITION-PLAN.md`](docs/DESIGN-PARTNER-ACQUISITION-PLAN.md) — **100-customers-by-8/1 sprint** (per L16). Strategy + funnel math + 5 distribution channels + 3 pricing options + 5 must-ship operational items + weekly milestones. Re-read every Friday during the sprint. Drift between this plan and reality is the bug.
- [`docs/pitch-decks/cold-outreach-templates.md`](docs/pitch-decks/cold-outreach-templates.md) — operational outreach kit. 5 cold email variants + LinkedIn DMs + voicemail + qualifying scripts + CRM schema. Re-read on every Friday during the sprint.
- [`docs/DISCOVERY-SCAN-OPERATIONAL.md`](docs/DISCOVERY-SCAN-OPERATIONAL.md) — Discovery Scan landing page copy + onboarding email + PDF template + Discovery agent technical spec for Haokun's queue. Ship target: landing page 5/25, Antonio reference scan 6/15.
- [`docs/COVERAGE-MAP.md`](docs/COVERAGE-MAP.md) — published transparent compliance scope. 4-tier classification + 5-layer Minimum-Viable Shield + 20-position v1 Position Library list. Re-read every demo, every cold-outreach reply with "what does it cover" questions, every Coverage Map update commit.
- [`docs/MARKETING-FRAMES.md`](docs/MARKETING-FRAMES.md) — Option B audience-segmented hierarchy. Per-surface lead language + penalty-anchored pricing math + canonical copy variants. Re-read before writing any external surface copy (landing page, deck, email, video script, social post).

**Vendor resilience posture (locked 2026-05-08 after Neon Cell 6 outage)**: Anthropic + Bedrock fallback at orchestrator layer (V1). Neon read replica us-east-2 (V1). Status-aware UX everywhere (V1). R2 cross-region replication (V1.5, before Feb 2027 tax season). Multi-cloud DB hot standby (V1.5). Read-only mode for DB write failures (V1). Detailed plan in PRODUCTION-READINESS §A.

---

## 24. Project history & key decisions

This project converged through a series of conversations. Major decision points, in order:

1. **Initial framing:** Build an AI with the depth of Deduction (autonomous workflow) + Gelt (year-round strategy). Knowledge depth would be the moat. → **Reframed.**
2. **First reframe:** Practice management for solo EAs is the lane, not return prep. The persona is mental-load-bound, not research-bound. (Maria the EA — hypothetical, later replaced by Antonio at Vazant.)
3. **The Command Room frame:** Docket is the agentic operator that sits above the existing tax stack. Browser automation the technical enabler. **Locked.**
4. **Field research (April 2026):** Identified the three layers (data/return/practice). Practice + relationship layer is open. Locked Docket as the third layer.
5. **Strategic posture:** Palantir/Foundry route — services first, platform second. FluentOS as structural template. Dual business model.
6. **Tech foundation:** Claude Agent SDK + MCP + browser automation. TypeScript end-to-end. Direct Anthropic + ZDR. Next.js + custom Docket tokens (no default shadcn).
7. **Cost discipline:** $50/mo target. Claude Code Max subscription as primary dev tool. Haiku-first testing.
8. **Design:** 36-screen mobile-first portal already authored. Editorial cream + forest green oklch.
9. **gstack installed** as workflow framework (v0.x.x — see `~/.claude/skills/gstack`).

The full strategic synthesis lives in [`docs/STRATEGIC-BRIEF.md`](docs/STRATEGIC-BRIEF.md). When something feels under-specified here, that's where to look first.

---

*Last updated: May 2, 2026 — full reality-pass after the post-audit hardening session, then CEO review later that day shifted scope (5/15 demo path → 7/30 OS v1) and locked the segment posture (mid+down only, franchise networks v1.5 door open, Big 4/F500 deferred 18-24 months). Earlier drafts were partially aspirational; this version describes what's actually in the codebase plus the post-CEO-review forward plan. When a future session handoff disagrees with this doc, the handoff wins until a docs-pass folds it back in. CEO plan with full scope decisions, risks, and success criteria: `~/.gstack/projects/minesokim-child-docket/ceo-plans/2026-05-02-docket-os-v1.md`.*
