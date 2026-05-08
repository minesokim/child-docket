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

## 1. Project identity

| | |
|---|---|
| Vision | The agentic operator for a tax practice. Top-tier preparer-grade AI animates every surface; drives the existing tax stack via API-first integrations + browser automation as fallback. |
| Pitch | "Your practice. Every tool. One operator." |
| Memory architecture (stolen from Practiq) | **"Memory scoped to the client."** Every action, doc, message lives on the client record — not in a chat thread. The practice ledger enforces this. |
| Codename | Docket (final brand TBD; repo named `child-docket` to mark this as the consulting/services flywheel that becomes the platform) |
| Founder | David Kim (legal: Minseo Kim) — `minseodavid@gmail.com` |
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

### Segment posture (decided 5/2/2026 CEO review)

- **v1 (7/30):** Mid-market and down-market only.
  - **Down-market** = solo EAs, storefront tax shops, 1-10 staff firms (Antonio's segment). Zero AI-native competitors here.
  - **Mid-market** = 20-100 staff regional firms. Only PM incumbents (TaxDome, Canopy, Karbon) ship shallow AI here. AI-native players are economically forced up-market by their funding rounds.
- **v1.5 door open:** Tax franchise networks (Liberty Tax, Jackson Hewitt, JTH-aligned, smaller franchise networks). Storefront workflow is identical to the current mid+down product. Corporate licensee model = single deal could yield $1-5M ARR. Activate once mid-market reference customer is in hand to point at.
- **NOT pursuing for 18-24 months:** Big 4 / top-100 firms. F500 in-house tax departments. See §14 NOs above for reasoning.
- **Architecture posture:** Five-layer + RLS + per-tenant DEK + audit-trail + governance is enterprise-compatible by accident-of-good-decisions. No special enterprise-readiness work needed in v1. Door stays open for later segments without rework.

---

## 15. Build order — Docket OS v1 by 7/30 (Antonio sub-milestone 5/30)

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

**Phase 1 (Weeks 1–2, 5/2 → 5/16) — Foundation + Antonio Production Essentials**
- Preparer-side SSN/EIN reveal flow on command-room (highest-leverage gap)
- Twilio "Send via SMS" for client invites (per-tenant credentials)
- Knowledge layer schema in DB + ingestion infrastructure scaffolded
- `packages/tax-graph` package created (Authority, TaxConcept, WorkflowObject, FactPattern, DecisionRule, PlanningStrategy)
- Citation rendering scaffolding in agent output
- Trust gate scaffolding (per-tenant × agent × action-class)
- Docs pipeline started: Cloudflare R2 bucket + presigned URL helper
- Continue down-market production essentials (rate limiting, auth refactor)
- Sidebar dead links resolved (placeholder routes for /messages, /documents, /settings)

**Phase 2 (Weeks 3–4, 5/16 → 5/30) — Antonio Production Sub-Milestone**
- Real bidirectional messages (Twilio SMS + Gmail email + portal chat, channel-aware via Inbox Drafter)
- Square Checkout API integration (per-client payment links, webhook for paid status)
- DocuSign embedded signing for Form 8879 with LexisNexis KBA (NIST IAL2)
- IRS Pub 17 + FTB residency manual ingested with effective-date versioning
- AAD on AES-GCM bound to (tenant_id, client_id, path)
- KEK rotation procedure documented + master-KEK fallback removed
- Webhook signature verification helper (shared across Square / DocuSign / Twilio / Inngest)
- Sentry signup + DSN configured
- **✅ Sub-milestone 5/30: Antonio's full 200+ client base operational on production-grade substrate**

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

1. **Brand structure.** One name with two postures (Docket platform / Docket consulting), or two names (Docket + parent brand)? Decide before public launch.
2. **The 30-second wedge demo.** What's the "holy shit" moment for Antonio prospects? Hypothesis: a return getting prepped through OLT via browser automation while the preparer watches.
3. **Second design partner.** First is Antonio (CA EA, OLT/IRS Solutions/Xero). Who's #2 — small CPA firm, bilingual storefront, rep specialist?
4. **Tax co-founder situation.** Recruiting target or existing relationship? Most important hire — gates the playbooks/ontology/review policies that make agents non-stupid.
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
15. **Confirm with David:** any decisions reversed since last session? Any new slices to capture?

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

### Project-local skills

Beyond gstack, this repo ships four project skills that together form the autonomous build cycle:

- [`/edge-cases`](.claude/skills/edge-cases/SKILL.md) — runs BEFORE implementation. Forces explicit enumeration of 8-15 edge cases (input / state / failure-mode / time / permission / domain-specific) with handle-vs-document-vs-out-of-scope status. Catches "shipping happy path, finding edge cases in prod" drift.
- [`/code-quality`](.claude/skills/code-quality/SKILL.md) — runs BEFORE commit. Pre-commit gate that BLOCKS AI-sloppenheimer. Forces structural checks (typecheck, tests, no console.log, no undocumented `any`, lockfile-package.json sync) + substantive checks (pattern adherence, error handling, comment quality, atomicity) + post-push deploy verification (curl + Vercel state must be READY before next item). Reference exemplar: `packages/shared/src/webhook-verification.ts`.
- [`/smoke-test`](.claude/skills/smoke-test/SKILL.md) — runs AFTER implementation. Required after any change touching Inngest workers, document processing, storage helpers, server actions firing events, encryption, or new /api/* routes. Reference template: [`services/workers/scripts/smoke-finalize.ts`](services/workers/scripts/smoke-finalize.ts).
- [`/decisions-log`](.claude/skills/decisions-log/SKILL.md) — runs ALONGSIDE every commit + AT SESSION END. Tracks autonomous judgment calls (naming / UX / scope cuts / architecture trade-offs / defaults / deferrals) in [`docs/AUTONOMOUS-DECISIONS.md`](docs/AUTONOMOUS-DECISIONS.md). User reviews periodically; pending entries get auto-marked reviewed-approved after 7 days for low/medium severity.

The full cycle: plan → /edge-cases → implement → typecheck → test → /code-quality (lockfile, anti-patterns, codex if substantial) → commit (with /decisions-log entry if applicable) → push → verify deploy READY (curl test endpoint if applicable) → /smoke-test if applicable → next item.

### Canonical reference docs (re-read at session start)

Beyond this CLAUDE.md, six docs anchor product + ops decisions and SHOULD NOT be duplicated inline:

- [`docs/AUTONOMOUS-PROTOCOL.md`](docs/AUTONOMOUS-PROTOCOL.md) — **bootloader for any AI working autonomously**. Read FIRST on session start, especially after context refreshes. Defines the four-skill build cycle (edge-cases → code-quality → smoke-test → decisions-log), session-start ritual, communication protocol, anti-patterns blocked, and the recovery sequence after window-fill resets. The user-facing rule: "the skills work every time. every time. every time."
- [`docs/PRODUCT-ROADMAP.md`](docs/PRODUCT-ROADMAP.md) — master product reference. Every feature, every phase, every defer. The five product pillars. V1 / V1.5 / V2 timeline. Marketing positioning lock. Distribution + GTM. Pricing. Open questions + risks. Explicit NOs. Supersedes the v1 phase plan that previously lived inline in §15 below.
- [`docs/POSITION-FRAMEWORK.md`](docs/POSITION-FRAMEWORK.md) — compliance-first deduction surfacing. Four-tier confidence framework + refusal floor. The marketing differentiator. Re-read before changing any agent that emits a tax position.
- [`docs/MEMORY-ARCHITECTURE.md`](docs/MEMORY-ARCHITECTURE.md) — six-layer memory model + cost-optimized prompt caching strategy. Re-read before changing prompt assembly order or the agent fleet's context-loading pattern.
- [`docs/PRODUCTION-READINESS.md`](docs/PRODUCTION-READINESS.md) — punch list of resilience / observability / security / dev-process gaps with priority tiers. Re-read every Friday during v1 build. Items get crossed out, not deleted.
- [`docs/POST-5-15.md`](docs/POST-5-15.md) — what's deferred. (Earlier-version "what's not in the demo cohort" doc; see PRODUCTION-READINESS for current deferred list.)

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
