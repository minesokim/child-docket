# Docket — Project Brief

*Strategic anchor. Snapshot as of April 30, 2026. Boot up here to re-orient on what Docket is and how we're building it.*

---

## One-line vision

**Docket is the agentic operator for a tax practice — a top-tier preparer-grade AI that animates every surface of the day, drives the existing tax stack via browser automation, and gives every solo EA and small CPA firm the leverage of a 10-person team.**

Short pitch: *"Your practice. Every tool. One operator."*

---

## What we're actually building

A two-surface product, run by one unified AI engine, operating across whatever tax stack the practice already uses.

```
┌─ Surfaces ─────────────────────────────────────────────┐
│  Command Room (preparer's main pane, web + mobile)      │
│  Client Portal (taxpayer-facing, AI drafts, EA approves)│
├─ Engine: One preparer-grade AI, six layers ────────────┤
│  Comms · Documents · Pipeline · Financial ·            │
│  Prep/Return · Practice-level                           │
│  + Outcome Prediction service (Blue J → native moat)    │
├─ Knowledge + rules + practice ledger (THE MOAT) ───────┤
│  Versioned authority · ontology · case memory ·         │
│  deterministic calculators · audit ledger              │
├─ Tool layer (the OS substrate) ────────────────────────┤
│  ┌─ Browser automation ────────────────────────────┐   │
│  │  OLT · Drake · Lacerte · ProConnect · UltraTax · │   │
│  │  IRS Solutions · IRS portal · EFTPS · CA FTB ·   │   │
│  │  state portals · Canopy · TaxDome (when needed)  │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌─ API-first MCP integrations ────────────────────┐   │
│  │  Gmail · Drive · Stripe · Plaid · Xero · QBO ·   │   │
│  │  Twilio · DocuSign · Calendar · Slack            │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## The persona — Maria

58-year-old EA running a small CA practice. 240 clients, mostly small business owners and self-employed contractors. Husband answers the phone, daughter helps in busy season. Uses OLT for returns, IRS Solutions for rep work, Xero for books. Charges $300–$800 per return. 70 hours/week Feb–Apr, 30 hours/week the rest. Drowns in inbox/phone calls. Loses promises she made to clients. Knows in her bones that 5–10 nightmare clients are eating 30% of her time for 5% of revenue but can't quantify it.

**Her currency is mental load, not research speed.** Docket is what she opens first thing in the morning to find out what today is. She never invokes the AI. The AI is just there, animating every surface she already touches.

---

## Strategic posture — the Palantir / Foundry route

**Dual business model. Both flywheels feed each other.**

### Today: AI engineering for tax practices (services)
- Forward-deployed embed with design partner firms
- Custom builds shipped in weeks, not months
- Each engagement produces platform IP
- Pricing band: $10k–$25k Foundation build, $2k–$5k/mo retainer for expansion
- Reference template: [FluentOS](https://www.fluentaiconsulting.com/fluentOS) — productized consulting at 3-day Foundation + monthly retainer

### Tomorrow: Docket — the tax practice OS (platform)
- Same substrate every custom build runs on
- After 5–15 engagements, ~70% of new builds reuse existing modules → SaaS unlocks
- Self-serve tier for solo EAs ($99–$299/mo + usage), retainer tier for small firms

**Why this beats "raise money, build platform, then sell":**
- Revenue from week 2, not month 18
- Each install is real product validation
- Vertical specialization is the moat — generic AI consultants cannot go this deep on tax
- Investor narrative: "consulting that becomes a platform" (Palantir/Foundry pattern)

---

## Locked tech decisions

| Decision | Choice | Why |
|---|---|---|
| Reasoning + tool orchestration substrate | **Claude Agent SDK** | MCP-native, deepest tool integration, lifecycle hooks map to trust escalation, same tech FluentOS uses, pairs cleanly with Computer Use for browser automation |
| Integration substrate | **MCP gateway** as only abstraction layer | Browser automation + API integrations both wrapped as MCP tools — agent doesn't know or care which path |
| Primary integration mechanism | **Browser automation** (Computer Use / Playwright) | Works against any system, vendor-neutral, design partner already operates this way, TaxGPT/Filed/Grove validate the pattern |
| Where rules live | **Outside the LLM** — deterministic calculators, threshold/phaseout engine | LLM reasons, graph knows, rules calculate, tools act. Never let Claude do tax arithmetic. |
| Knowledge layer | **Versioned tax graph** (Postgres + pgvector + graph metadata) | Authority/concept/workflow/fact-pattern/decision-rule/strategy entities. Effective-date versioning from day one. |
| Tenancy | **Multi-tenant from day 1** | Even the consulting builds live on multi-tenant infra so they collapse into the platform later |
| Audit trail | **First-class, every tool call logged** with who/what/when/citation | This IS the product (armor against clients, regulatory hardening) |
| Knowledge base sources | **Tier 1: IRS, FTB, CDTFA, EDD primary** + **Tier 2: editorial deferred** until usage gaps demand it | No Bloomberg/CCH/Checkpoint license year 1. Internal playbooks are tier 3, the real moat. |
| Outcome prediction | **Partner Blue J via API for v1** → native model trained on practice ledger by year 2 | Don't rebuild what Blue J has years of judicial-reasoning data on |
| Geographic focus | **California-first** | Design partner is CA. FTB Residency & Sourcing Technical Manual is rich. Then expand. |

---

## The two surfaces, in detail

### Command Room (preparer surface)

Single pane that shows **today** and lets Maria act on it.

- **Morning brief** — "3 deadlines, 2 e-file rejects, 5 stuck pickups, 1 high-risk position, 1 client at risk of churn"
- **Pipeline** — 240 cards across Intake → Docs → Prep → Review → Sign → File → Pay, with AI commentary on every one
- **Unified Inbox** — SMS, email, portal chat, voicemail, uploads. AI drafts, Maria approves.
- **Practice Intelligence** — margin per client, friction score, capacity, pricing inconsistency, churn risk, "fire the bad client" insights
- **Outcome Prediction** — position-level audit/controversy risk modeling on demand
- **Command Palette** — fuzzy-search any action across any tool. Pull IRS transcript · file 2848 · post invoice · generate workpaper · draft notice response · sync return to OLT · request docs · run YoY diff. Every action invokes an MCP tool.

### Client Portal (taxpayer surface)

**Mediated by AI, gated by Maria.** The taxpayer never interacts with an autonomous AI. Every AI action is preparer-approved.

- Document upload (with AI-driven completeness scoring + auto-classification)
- Chat-with-preparer thread (AI drafts replies in Maria's voice, Maria approves before sending)
- Status updates (auto-synced from return state)
- YoY change explainer (auto-generated, "what changed and why," in plain language)
- Receipt of every document and approval (the audit-trail-as-armor surface)
- Bilingual support as configuration (Spanish, Mandarin, Vietnamese, Tagalog) — not a separate product

---

## The seven white-space bets, ranked by signal strength

Concrete edges where the funded competitors are NOT building:

1. **Practice management × return intelligence union.** Accrual/Black Ore/Basis/TaxGPT automate the return; TaxDome/Canopy/Karbon automate the practice with shallow AI. **Nobody owns both.** Docket's structural lane.
2. **Mediated taxpayer client portal.** Every PM incumbent treats portal as passive doc-drop. Make it a continuous bilingual conversation thread with AI drafts gated by the preparer.
3. **EA representation rights as a second pillar.** The 2848/8821 + transcript pull + notice triage + drafted response loop. Off-season recurring revenue. $2k–$10k per engagement. Design partner already on IRS Solutions — perfect fit.
4. **Bilingual + voice-aware practice OS.** No funded AI-native is built for this. Spanish, Mandarin, Vietnamese, Tagalog. Voicemail transcription as a default substrate.
5. **Practice intelligence as a paid module.** Margin/friction/scope-creep/pricing inconsistency across the book. $99–$299/mo standalone. Data exists in the ledger by definition; nobody else can compute it.
6. **YoY change explainer + source-to-return traceability for the taxpayer portal.** Highest-leverage retention artifact. Currently 100% hand-written everywhere.
7. **OLT integration as a moat.** Every funded AI-native targets Drake/ProConnect/UltraTax/Lacerte/CCH. **Zero target OLT.** First mover earns the bottom of the EA market for free. Design partner is on OLT — the wedge integration is forced by reality.

**Pricing edge:** per-return / per-notice usage on top of a low monthly base. Storefront and small-firm EAs can't pay $1.5k–$3k/seat/yr that competitors charge. $99–$299/mo + $5–$15/return + $200–$500/notice handled.

---

## What we are NOT doing

- **Not fighting Black Ore / Accrual / Basis on autonomous return prep for big firms.** $235M+ in, two-year head starts, top-25 distribution. We'd be the fifth entrant building backward.
- **Not building a consumer tax filer.** Deduction, Taylor CPAI, Perplexity Computer, Rally are crowding it. Wrong product anyway.
- **Not leading positioning with "deeper than any CPA."** Table stakes by 2027. Depth is the engine that makes our surfaces correct, not the headline.
- **Not WhatsApp** in v1. SMS + email + voice + portal chat is enough.
- **Not building a return calculation engine.** OLT/Drake/UltraTax do that. Be the orchestrator, not the calculator.
- **Not doing per-customer snowflake builds.** Every consulting engagement runs on the same multi-tenant substrate. If it doesn't fit the platform thesis, refuse the work.
- **Not anchoring to Bloomberg/CCH/Checkpoint** year 1. Tier 1 (IRS/FTB primary) + tier 3 (internal playbooks) is enough until real gaps surface.
- **Not using OpenClaw or Hermes as a base** — they're for personal AI, not multi-tenant B2B vertical SaaS. Adopt their patterns (skills loop, messaging-as-UI), not their codebases.

---

## Productization discipline

The rules that prevent services-revenue from killing the platform:

1. **Time-box engagements.** 1–2 week Foundation (productized, fixed price). 6–8 week Phase 1 build. Anything longer requires explicit "this becomes a platform module" justification.
2. **Charge for outcomes, not hours.** Fixed-price Foundation. Retainer for expansion. Never hourly.
3. **Every engagement must produce platform IP.** New MCP integration, new playbook, new agent, or new UX module that ships to all customers. If a build doesn't, refuse it.
4. **Refuse out-of-thesis work.** No "build us a chatbot for our marketing site." Tax practice ops only.
5. **Pick wedge clients deliberately.** 3–5 design partners across distinct segments: bilingual storefront EA, small CPA firm, EA specializing in rep work, multi-state practice. Not ten partners.
6. **Track platform readiness as a KPI.** "% of new engagement built from existing platform modules." Goal: rises every quarter. When it hits 70%, SaaS unlocks.

---

## Design partner — California, OLT + IRS Solutions + Xero

**The partner is an EA who does both prep AND representation work.** Their current stack:

- **OLT (OnLine Taxes)** — tax preparation for individuals + small business returns. No public API. Browser automation only path.
- **IRS Solutions** — tax resolution platform. Auto-fills and e-signs 2848 / 8821. Pulls IRS transcripts. IRS Advance Notice (IAN) monitors client transcripts for liens, audits, OIC activity, installment changes. OIC calculator trained on IRM. ([IRS Solutions](https://www.irssolutions.com/))
- **Xero** — bookkeeping. API-first, mature MCP wrapper available.
- **Browser automation already in use** by partner for current workflows — validates the technical bet from day one.

**What this stack tells us about the first build:**
- The partner does the full lifecycle (prep → represent → defend), so Docket needs to span both prep workflow AND notice/rep workflow from the start
- OLT browser automation is the must-build integration — every other AI-native tool skips OLT, and this partner can't migrate
- IRS Solutions integration via browser automation gives us the rep-pillar without building it ourselves (we orchestrate IRS Solutions; we don't replace it)
- Xero for the financial layer of practice intelligence (revenue, AR, margin per client)
- California means our tax knowledge layer is FTB-anchored, plus CDTFA and EDD where rep work touches them

---

## Foundation package — what we ship in the first 1–2 weeks

The productized "v0" build. Becomes the template for every future engagement.

1. **Morning Brief** — Daily AI summary of what needs attention. Pulled from OLT (return states), IRS Solutions (transcript changes, notice arrivals), Gmail (client comms backlog), Xero (AR aging, invoicing).
2. **Unified Inbox + Drafts** — SMS, email, voicemail unified. AI drafts responses pulled from real client state. Maria approves.
3. **One specific automation flow** — driven by what hurts the partner most. Three candidates ranked by likely value:
    - **Notice triage + draft response** (highest value if partner does volume rep work)
    - **Doc-chase across 240 active clients** (highest value during prep season)
    - **Return-prep handoff into OLT via browser automation** (most demoable; biggest "holy shit" moment)
    
    *Pick one based on what the partner says during week 1 discovery.*

4. **Practice ledger + audit trail** — every action logged from day one (must-have, even if invisible to user)
5. **California knowledge layer v0** — IRS forms/instructions/pubs + FTB forms/pubs/Legal Rulings + Residency & Sourcing Technical Manual ingested, versioned, retrievable. Internal playbooks for the partner's most common fact patterns.

**Engineering team for Foundation:** AI/ML lead + tax co-founder (CPA/EA/attorney) authoring playbooks + workflow engineer for browser automation harness + data engineer for tax content pipeline. Tax co-founder is the non-negotiable hire.

---

## Architecture decisions — the lock-in list

Things that should NOT change as we build:

- Multi-tenant from day one (even for consulting builds)
- Audit trail on every tool call, no exceptions
- LLM reasons, rules calculate (deterministic engine never inside the model)
- MCP gateway as the only integration abstraction
- Effective-date versioning on every authority chunk
- Trust escalation model (Level 1 suggest → Level 4 autopilot) per practice, per agent, per action class
- Spanish/Mandarin/Vietnamese as configuration, not a separate product
- The practice ledger is sacred — Docket owns it, even when tools live in Drake/OLT/Xero

---

## Open questions to answer next

1. **Brand structure.** One name with two postures (Docket the platform / Docket consulting), or two names (Docket + parent brand)?
2. **Wedge demo.** What's the 30-second moment that makes a preparer say "holy shit"? Hypothesis: a return getting prepped through OLT via browser automation while the preparer watches.
3. **Second design partner.** First partner is a CA EA on OLT/IRS Solutions/Xero. Who's #2 — a small CPA firm? A bilingual storefront? A rep-specialist? Pick to maximize coverage of future segments.
4. **Tax co-founder situation.** Recruiting target or existing relationship? This is the most important hire and gates everything.
5. **Repo + scaffold.** Set up the monorepo with Claude Agent SDK substrate + MCP gateway + Postgres + pgvector + multi-tenant orchestrator. 1-day setup task.

---

## The competitive map (April 2026)

**Three layers of the AI-tax stack are forming. Docket is the third layer.**

| Layer | Who's there | Docket's stance |
|---|---|---|
| **Data layer** (K-1, K-3, 1099 ingestion) | K1x ($175M growth round) | Integrate, don't compete |
| **Return-prep agent layer** (autonomous prep + review) | Accrual ($75M), Basis ($1.15B), Black Ore ($60M GA), TaxGPT (Agent Andrew + Tax Prep Agent), Juno ($12M), Filed, Grove | **Don't compete head-on. Orchestrate them via browser automation.** |
| **Practice + relationship layer** (the day, the comms, the ledger, the rep loop) | **Empty for AI-native. PM incumbents (TaxDome, Canopy, Karbon) shipping shallow AI features.** | **This is Docket's lane.** |

The well-funded competitors above us are economically forced up-market (their $235M+ war chest demands enterprise ACVs). They cannot serve Maria. We can.

---

## Reference docs and inspirations

- [FluentOS](https://www.fluentaiconsulting.com/fluentOS) — the structural template for productized AI consulting (3-day Foundation + retainer + ownership path). Built on Claude Code.
- [TaxGPT — Agent Andrew + Tax Prep Agent](https://www.taxgpt.com/blog/taxgpt-launches-agent-andrew) — proves browser automation against tax software at scale.
- [Black Ore Tax Autopilot (GA Apr 29, 2026)](https://www.globenewswire.com/news-release/2026/04/29/3283985/0/en/Black-Ore-Launches-Tax-Autopilot-for-Broad-Availability.html) — top-25 firm reference for autonomous prep.
- [Basis $100M Series B](https://www.businesswire.com/news/home/20260224020999/en/Basis-Raises-$100M-at-a-$1.15B-Valuation-as-Accounting-Firms-Adopt-End-to-End-Agents-Across-Accounting-Tax-and-Audit) — long-horizon agents, autonomous 1065.
- [Accrual launch ($75M)](https://www.businesswire.com/news/home/20260205968515/en/Accrual-Launches-with-$75-Million-to-Bring-AI-Native-Automation-to-Accounting) — every fed/state form, prep + review.
- [Blue J](https://www.bluej.com/) — judicial-precedent-based outcome prediction, our partnership target for v1 outcome service.
- [IRS Solutions](https://www.irssolutions.com/) — design partner's rep platform; we orchestrate, don't replace.
- [Anthropic Model Context Protocol (MCP)](https://modelcontextprotocol.io/) — our integration substrate.
- [Claude Agent SDK comparison vs alternatives](https://qubittool.com/blog/ai-agent-framework-comparison-2026) — why we chose Claude Agent SDK.

---

## Boot-up checklist for next session

When loading this project cold:

1. Read this brief
2. Read auto-memory pointers in `MEMORY.md` (look for `project_docket_*` entries)
3. Check the existing Docket session handoffs (Apr 8 / Apr 9) for tactical context if continuing prior work
4. Confirm with David: any new slices to add since last session? Any decisions reversed?

---

*Last updated: April 30, 2026. Snapshot of strategic synthesis as of session 02:28.*
