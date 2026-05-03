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
| Stage | v0 scaffold complete (Apr 30, 2026). **Hard ship date: May 15, 2026** for child-product demo (15 days). Pre-revenue. Forward-deployed build for first design partner. |
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
1. **Intake (31 screens, 13-step flow)** — Login → SMS OTP → Welcome → Tutorial → Service path → Personal → State + prior year → Filing status → Spouse → Dependents → Income → Rental/SE detail → Tax questions → Deductions → Life events → Refund pref → Document upload (4 phases: empty → AI scanning → retake prompt → AI parsed → saved) → Engagement letter → §7216 consent → Schedule appt → $50 deposit → Done
2. **Returning portal (5 tabs)** — Home · Docs · Messages · Signatures (with 8879 sign flow) · Profile, plus an AskAntonioChat overlay

Bilingual support as configuration (Spanish, Mandarin, Vietnamese, Tagalog) — not a separate product.

### Design source files (already authored)
Location: `C:\Users\minse\Downloads\docket-portal-design\`

- `Docket Client Portal - Standalone.html` — full standalone prototype (2.6MB)
- `components/*.jsx` — 23 React components covering all 36 screens
- `components/tokens.jsx` — design tokens (Fraunces, DM Sans, oklch greens, editorial/minimal/magazine)
- `components/app-shell.jsx` — top-level routing + PhoneShell + canvas overview
- `assets/antonio.webp` — Antonio's headshot for AvatarSlot

Tokens already ported to `packages/ui/src/tokens.ts` and `packages/ui/src/styles.css`. Components ported into `packages/ui/` in subsequent commits.

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
│  Claude Agent SDK substrate                           │
│  + Docket layer (multi-tenant, audit trail,           │
│    trust escalation, agent fleet, skill registry)     │
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
| Substrate | **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) | MCP-native, deepest tool integration, lifecycle hooks, same tech FluentOS uses. |
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

### Trust escalation model
- **Level 1 (Week 1–2):** Suggest and explain, verbose reasoning, every action requires approval
- **Level 2 (Week 3–4):** Suggest with shorthand, compressed commentary
- **Level 3 (Month 2+):** Auto-execute low-risk with notification, preparer reviews logs
- **Level 4 (Season 2):** Full autopilot for known patterns, exception-based only

### Insight severity
- **Green** (informational) · **Amber** (needs attention) · **Red** (critical / deadline risk)

### When to show insights
Always show when AI has concern/recommendation/action. One-liner when progressing normally but something notable. Show nothing when truly on track — **silence IS the signal.**

### Why this matters
The core product differentiator. Competitors show dashboards you read. Docket shows recommendations you act on. Every UI component asks "what would the AI say here?" Cards have space for commentary. Group by action type, not just pipeline stage.

---

## 9. Agent fleet

### v0 (12-week build)
| Agent | Trigger | Inputs | Output | MCP tools used |
|---|---|---|---|---|
| **Morning Brief** | Cron 6am tenant TZ | Ledger state, OLT return states, IRS Solutions notices, Gmail unread, Xero AR | Structured brief: deadlines, e-file rejects, stuck pickups, position risks, churn signals | ledger · olt · irs-solutions · gmail · xero · knowledge |
| **Inbox Drafter** | New message in any channel | Message, client context, return state, prior threads, playbooks | Drafted reply (English or Spanish), confidence score, citations | gmail · ledger · portal · knowledge |
| **OLT Prep Handoff** *(or Notice Triage — chosen week 1 by Antonio)* | Preparer-invoked or doc-complete trigger | Workpapers, prior-year return, intake form, client facts | Return prefilled in OLT (browser automation), workpaper trail, flagged judgment items | olt · ledger · documents · knowledge |

### v1+ (post-Foundation)
- **Document Triage** — classifies + extracts + matches uploads to client (powers the 4-phase doc upload UX)
- **Notice Response** — IRS notice triage, drafted CP2000/etc. response with cited authority
- **Practice Pattern** — margin/friction/scope-creep across the book ("fire the bad client" therapist)
- **Promise Keeper** — every commitment in any channel becomes a timestamped, searchable receipt
- **Outcome Prediction** — Blue J-style position-level audit/controversy risk modeling
- **Phone Agent** — voicemail transcribe → summarize → draft → send

### Each agent has a strict contract
- System prompt + scoped toolset + trust-level config + playbook bundle
- Audit-trail hook on every tool call (who/what/when/citation)
- Trust gate before any external action
- Cost telemetry tagged with tenant + agent + action class

---

## 10. MCP server roster

**Build effort estimates in parens.** Each independently deployable.

### v0 servers (build in this order)

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

### Primitives ported from designer's `tokens.jsx`
`Screen`, `Stack`, `Row`, `Card`, `Button`, `Eyebrow`, `H1`, `H2`, `Body`, `ProgressBar`, `Placeholder`, `AvatarSlot`. All inline-style based for design fidelity.

### Inline styles vs Tailwind
- **Design-locked components (intake, portal):** preserve inline styles exactly as the designer authored them. Zero design drift.
- **New components (command room layouts, dashboards):** Tailwind v4 utility classes for layout/spacing/responsive, custom tokens for color/typography.
- Both can coexist in the same app.

### Auth styling note
The user identity in flows is real: **Antonio Vazquez**, EA (firm: Vazant Consulting, avatar in `assets/antonio.webp`).

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

### Schema (in `packages/db/src/schema.ts` and to expand in `tax-graph` package)
- `Authority` — source, citation, jurisdiction, date issued, effective date, superseded date
- `TaxConcept` — residency, sourcing, basis, nexus, reasonable comp, QBI, PTET, etc.
- `WorkflowObject` — return type, form, schedule, notice, election, deadline
- `FactPattern` — taxpayer type, state, entity type, income types, transaction events
- `DecisionRule` — if/then logic, thresholds, exceptions, authority support
- `PlanningStrategy` — strategy name, prerequisites, risks, expected savings, documentation requirements

### Versioning
**Effective-date versioning on every authority chunk from day 1. No exceptions.**

---

## 13. The seven white-space bets (ranked)

Concrete edges where the funded competitors are NOT building. Ranked by signal strength.

1. **Practice management × return intelligence union.** Accrual/Black Ore/Basis/TaxGPT automate the return; TaxDome/Canopy/Karbon automate the practice with shallow AI. **Nobody owns both.** Docket's structural lane.
2. **Mediated taxpayer client portal.** Every PM incumbent treats portal as passive doc-drop. Make it a continuous bilingual conversation thread with AI drafts gated by the preparer.
3. **EA representation rights as a second pillar.** The 2848/8821 + transcript pull + notice triage + drafted response loop. Off-season recurring revenue. $2k–$10k per engagement. Antonio is already on IRS Solutions — perfect fit.
4. **Bilingual + voice-aware practice OS.** No funded AI-native is built for this. Spanish, Mandarin, Vietnamese, Tagalog. Voicemail transcription default substrate.
5. **Practice intelligence as a paid module.** Margin/friction/scope-creep/pricing inconsistency across the book. $99–$299/mo standalone. Data exists in the ledger by definition; nobody else can compute it.
6. **YoY change explainer + source-to-return traceability for the taxpayer portal.** Highest-leverage retention artifact. Currently 100% hand-written everywhere. Juno is alone pitching traceability, aiming up-market.
7. **OLT integration as a moat.** Every funded AI-native targets Drake/ProConnect/UltraTax/Lacerte/CCH. **Zero target OLT.** First mover earns the bottom of the EA market for free.

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

---

## 15. Build order — production rebuild for Antonio's first cohort by 5/15

> **Status flip (May 1, 2026):** Demo client portal is shipped + live on Vercel
> at `docket-client-portal.vercel.app`. 38 routes walking. Now building the
> ACTUAL production app. Antonio's real clients will type real SSNs and submit
> real returns through it. No more "v0 magic" — every shortcut becomes real.

### Demo state (preserved as the marketing surface)
- `apps/client-portal` — 38-route walk-through. sessionStorage forms, mocked
  AI, hardcoded everything. Stays live for pitch / Loom / Antonio walkthrough.

### Production rebuild — phased so Antonio gets value early

**Days 1–3 — Antonio's admin layer (Command Room MVP)**
- Clerk app (Google sign-in only for Antonio)
- New schema: `users`, `clients`, `messages` tables linked to Clerk userIds
- Seed Antonio's user + tenant + 10 mock clients into Neon
- `apps/command-room/` v0 pages: client list + per-client view + message thread
- Antonio signs in, sees something real
- ✅ Day 3: Antonio can log into a real admin dashboard

**Days 4–7 — Client auth + persistent intake**
- Clerk phone-OTP strategy enabled (Twilio for SMS delivery)
- Real `/login` → `/otp` → real session in `apps/client-portal`
- All intake forms migrated: `usePortalState` (sessionStorage) → Server Actions
  → Postgres writes via `withTenant()` (RLS-bound to client's tenant)
- Field-level encryption for SSN / EIN / bank account numbers (libsodium or pgcrypto)
- Resume mid-flow on any device
- ✅ Day 7: real client signs up, walks intake, data persists; Antonio sees the row

**Days 8–10 — Docs pipeline (per `docs/DOCS-CAPTURE-PIPELINE.md`)**
- Cloudflare R2 bucket + presigned URL helper
- Inngest job: image → Haiku 4.5 vision (legibility + classification + filename JSON)
  → pdf-lib wrap → R2 upload → `documents` row with `awaiting_review` status
- `/docs` page swaps mocked `setTimeout` for real fetch
- Command Room shows uploaded docs queued for Antonio's review (filename approve/edit)
- ✅ Day 10: real docs flowing through real AI

**Days 11–12 — Real messages + notifications**
- `messages` table with channel kind (sms / email / portal)
- Inbox Drafter wired to inbound client message → drafts queued in Command Room
- "Send as Antonio" approval flow (Sonnet generates, Antonio approves, sent via Twilio/Gmail)
- Email + SMS notifications for status changes
- ✅ Day 12: bidirectional real messaging working end-to-end

**Days 8–9 — Square deposit + hardening (rate limiting, refactor auth pages)**
- Square Checkout API integration (per-client payment links, webhook for paid status)
- Rate limiting (Upstash) on Twilio + Square + KBA hot routes
- Auth pages refactored — extract phone formatter / country picker / error mapper
- ✅ Day 9: Real $50 deposit collected via Antonio's Square account, mid-flow

**Day 13 — DocuSign + KBA wiring + hardening Phase 2**
- DocuSign embedded signing API for 8879 (white-label, KBA via DocuSign's LexisNexis path)
- Per-tenant encryption keys (HKDF DEK from master key + tenant_id)
- E2E intake flow tests (Bun + Playwright)
- Audit log review — every Server Action writes to actions table
- ✅ Day 13: Real 8879 signed with KBA in sandbox; per-tenant DEKs in place

**Days 14–15 — Onboard Antonio's full client base**
- **NOT** a friends-and-family pilot. Production-grade from day 1.
- Target: scale to Antonio's 200+ existing client roster on this platform
  for the next tax season.
- Pitch deck (5–10 slides), Loom demo
- Quality bar: every UX decision should hold up at 300+ clients across
  multiple firms, not "good enough for friends to test"
- ✅ Day 15: production app shipped, ready to handle Antonio's full book

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
- `services/orchestrator` wrapping Claude Agent SDK ✅
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

```
docket/
├── apps/
│   ├── client-portal/        # Next.js — port from design ZIP first
│   ├── command-room/         # Next.js — preparer surface
│   └── admin/                # later
├── services/
│   ├── orchestrator/         # Claude Agent SDK + Docket layer
│   ├── mcp-gateway/          # tool registry + tenant scoping
│   ├── browser-workers/      # Playwright runners (week 7+)
│   └── ingestion/            # tax-knowledge crawlers (week 5+)
├── mcp-servers/
│   ├── ledger/  knowledge/  gmail/  xero/  portal/  documents/
│   └── olt/  irs-solutions/  (week 7+)
├── packages/
│   ├── ui/                   # tokens + design primitives
│   ├── db/                   # Drizzle schema + migrations
│   ├── tax-graph/            # ontology types
│   ├── agents/               # agent definitions
│   ├── playbooks/            # versioned markdown
│   └── shared/               # types, errors, utils
├── content/
│   ├── authority/            # ingested IRS/FTB
│   └── strategy-library/
├── docs/
│   ├── STRATEGIC-BRIEF.md    # full strategic synthesis
│   └── PERSONA.md            # Antonio's reality
├── .claude/
│   ├── memory/               # mirrors of project memory anchors
│   ├── hooks/                # gstack enforcement
│   └── settings.json
├── COSTS.md                  # cost discipline rules
├── README.md
└── CLAUDE.md                 # this file
```

### Conventions
- `@docket/*` workspace package names
- Inline styles preserved for design-locked components
- All branded types from `@docket/shared` (TenantId, ClientId, AgentId, etc.)
- Every API call goes through the orchestrator (`runDocketAgent`) — telemetry on every call
- Drizzle schema is the source of truth for DB; migrations in `packages/db/migrations/`
- Multi-tenant isolation via Postgres RLS; orchestrator sets `app.current_tenant_id` per request
- Audit trail (`actions` table) on every tool call. No exceptions.
- All env vars in `.env.local` (gitignored). `.env.example` documents required keys.

### Verified working
- `pnpm install` clean
- Both Next.js apps build (105 kB first-load JS, 137 B per route)
- Hello-world Claude SDK verified: Sonnet 4.6, $0.0005, 1.8s latency

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

When loading this project cold:

1. **Read this CLAUDE.md** (you are here).
2. **Then read the most recent session handoff** in `docs/SESSION-HANDOFF-*.md`
   — the latest one captures what's actually in the codebase right now (CLAUDE.md
   is partially aspirational; the audit reports + recent shipped work live in the
   handoff doc). When CLAUDE.md and the handoff disagree, the handoff wins.
3. **Strategic detail:** [`docs/STRATEGIC-BRIEF.md`](docs/STRATEGIC-BRIEF.md) — the full Desktop brief mirrored into the repo.
4. **The journey, not just the destination:** [`docs/DECISION-JOURNEY.md`](docs/DECISION-JOURNEY.md) — chronological narrative of how we got here, what we considered, what we rejected, when to revisit each lock-in.
5. **User's verbatim framings:** [`docs/SLICES.md`](docs/SLICES.md) — the actual passages the user wrote at each decision point. Preserved because the framings ARE the product. When in doubt about voice, re-read.
6. **Persona:** [`docs/PERSONA.md`](docs/PERSONA.md) — Antonio at Vazant.
7. **Memory mirrors:** [`.claude/memory/`](.claude/memory/) — anchored copies of the project memory files.
8. **Cost rules:** [`COSTS.md`](COSTS.md) — $50/mo discipline.
9. **Design source:** `C:\Users\minse\Downloads\docket-portal-design\` — the 36-screen prototype we port from.
10. **Verify gstack:** `test -d ~/.claude/skills/gstack/bin && echo OK`
11. **Confirm with David:** any new slices to add since last session? Any decisions reversed?

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

*Last updated: April 30, 2026. Boot up here.*
