# Master Narrative — canonical answers for accelerator applications

> *Use this file as the source of truth. Customize per program; never re-invent.*

---

## One-line description

**Docket is the AI defense layer for tax practices.** Every position cited, every action audit-trailed, every output above Reasonable Basis refused by default. Vertical SaaS for solo EAs through mid-market firms is the floor; public orchestration platform with API + MCP server for the entire AI tax stack is the swing.

## What does your company do?

We replace the messy combination of practice management software + return-prep tool + email + SMS + spreadsheets that runs a typical tax firm with a single intelligence layer that captures every artifact (doc, message, signature, transaction, notice, action) and surfaces decisions: deductions with cited authority, replies in the EA's voice, positions defended or refused based on confidence tiers, anomalies flagged across the client book.

The EA sits at the edge approving outcomes, not routing information. The agent fleet does the routing. Compliance-first: AI never auto-files a return position above the most defensible tier; refuses anything below Reasonable Basis (IRC standard); generates the audit defense file as a side effect of normal work.

We sell to tax firms (~150K firms in US, ~80K of them solo or 1-3 staff). We're not a consumer tax product.

## Why now?

Three forces converged in the last 12 months:

1. **Claude + GPT-5 class models** can finally read tax authority + draft positions with citations at preparer-grade quality. The compliance-first frame becomes possible because the AI can show its work.
2. **A funding wave hit return prep automation up-market.** Black Ore ($60M, Apr 2026), Accrual ($75M, Feb 2026), Basis ($100M Series B at $1.15B valuation, Feb 2026) all shipping for top-100 firms. **They cannot serve the down/mid-market** — economically forced up-market by their unit economics. The lane below them is empty.
3. **Tax practice management incumbents** (TaxDome, Canopy, Karbon) are shipping shallow AI features but lack return intelligence. The third layer — practice + relationship + rep — is open. Nobody is building "AI-native operating system" at our segment.

## Problem statement

Solo and small-firm EAs handle 100-300 active clients each. They run on:
- A practice management tool (TaxDome / Canopy / Karbon) that ages every year
- A return-prep tool (OLT / Drake / ProConnect / UltraTax) with no AI surface
- Email + SMS + voicemail + WhatsApp + portal-chat scattered across 5 inboxes
- A bookkeeping tool (Xero / QuickBooks)
- A signature tool (DocuSign)
- A representation platform (IRS Solutions) for rep work
- Excel + Notion + Google Docs as glue

The result: 70-hour weeks January-April, mental load is the binding constraint, $200K-1M in defensible deductions go uncaught per firm per year because nobody has time to scan the entire book for them. Notice deadlines slip. Year-round planning doesn't happen. The EA's institutional memory dies when they retire.

## Your solution

The 5 capability pillars:

1. **Compliance-first deduction surfacing (the Position Framework)** — every deduction the AI surfaces carries an IRC cite + tier classification (Settled / Substantial / Reasonable Basis with 8275 / More Likely Than Not) + audit risk + draft 8275 when needed. EAs cannot adopt a tool that risks their PTIN; this is the structural moat.
2. **Ambient operator (closed-loop OS)** — agents act on real client state without a chat surface. The EA sees a dashboard of "things AI did" + "things needing approval" + "things AI couldn't decide." Never a conversation with a bot.
3. **AI-native CRM (memory scoped to client + firm)** — every action / doc / message lives on the client record. Six-layer memory model with tiered retention (hot/warm/cold). Institutional memory becomes a queryable firm asset that compounds.
4. **Review automation + form filling** — workpapers assembled, positions drafted, multi-state flagged, e-file orchestrated via OLT/ProConnect/UltraTax browser automation. Same lane as Accrual/Black Ore/Basis but down-market where they can't afford to play.
5. **Multi-channel reachability** — Portal + Text for clients, Telegram/WhatsApp for the EA. Same data model across channels.

**Path 2 (the swing)**: public API + MCP server in v1. Other AI tax tools embed Docket capabilities. Tax software vendors integrate at scale. The orchestration play turns Docket from "vertical SaaS for tax" into "the OS the entire AI tax stack runs through."

## How big is the market?

- **US tax software + practice management market**: ~$15B (2025). Growth ~8% CAGR.
- **Down + mid-market segment** (solo to 100-staff firms): ~80-100K firms. Average ACV in our pricing model is $3-15K/yr. TAM at full penetration: $400M-1.5B/yr.
- **Path 2 (orchestration / API)**: TAM is the entire AI-tax stack; partners include other tax tools that license Docket capabilities. Year-1 revenue de-minimis; year-3+ potentially $10M+ ARR if Path 2 lands.
- **Path 1 (vertical SaaS) floor**: $25-50M ARR achievable on penetration of solo + small-firm segment alone.

## How will you make money?

Tiered base + active-client metering. Founder tier (first 50 firms) $250/mo + 30% lifetime discount on year-2 reversion. Standard tiers Solo $499 / Small $1,499 / Growing $4,499 / Mid-market $14,999 with active-client overage pricing.

Add-on agents (Discovery $199, Strategy $299, Audit Defense $99, Multi-Entity $199) for Solo + Small.

Per-event pricing: notice $50, rep engagement $99, incorporation $25 + state, BOI $15.

API tier (Path 2): Developer free / Partner $999/mo / Platform custom.

Per-active-client cost target $1.39/mo → 80%+ gross margin at peak tier.

## Why are you the right team?

**David Kim** (CEO, legal: Minseo Kim) + **Haokun Yang** (CTO, technical co-founder). 5+ year working relationship pre-Docket; Haokun has been on the project from inception. Haokun owns the codebase end-to-end — 13-table Drizzle schema with RLS at `ENABLE + FORCE`, per-tenant DEK encryption with AAD binding to `(tenant_id, client_id, path)`, cryptographic audit chain with nightly tamper verifier, agent fleet substrate, both Next.js apps deployed to production. David runs CEO + product + customer development + Antonio relationship. Both UCR CS background.

**Substrate built**: 28 migrations live in PROD (0026 + 0027 confirmed via Vercel-pulled URL 2026-05-11). 12-doc SOC 2 Type II policy set. Bedrock fallback at orchestrator with 38/38 unit + 4/4 smoke tests. /e2e PASS 8/8 against real Anthropic + Bedrock + Neon + R2 at $0.012/run. Codebase knowledge graph: 1,038 nodes / 1,182 edges / 10 architectural layers. Operates the SDLC at codex-reviewed protocol-gate quality — every feat/fix commit blocked locally + in CI without trailers for Edge-Cases, Score≥95, Align, Craft, Codex-Reviewed, Compliance-Check. Two P0 Antonio-call bugs shipped within 48h (faaa579 entity-filing W2 skip + 9975978 portal/docs Take-photo wire-up).

**Tax-domain coverage runs through Antonio Vazquez, EA** (Vazant Consulting, CA). Founding design partner + paying customer ($1K/mo MRR) + **on-platform tax advisor (1% equity)**. Every Position Library entry, every cited-authority decision, every tier classification routes through Antonio's sign-off. **Contracted backup advisors** ($200-400/hr, 5-10 hrs/week, sourced from AICPA + NAEA networks per `docs/CONTRACTED-EXPERT-OUTREACH.md`) provide scale-validation when Antonio's bandwidth is constrained (e.g., during his two active 2026 IRS audits). This is the structural answer to "where does the tax-domain depth come from" — it's not an open tax co-founder seat, it's Antonio + a budgeted advisor pipeline.

**Honest representation**: two co-founders shipping substrate at codex-reviewed quality; on-platform tax advisor with 25 years of EA practice; contracted backup advisor pipeline already specified for scale-validation; partner #2 (regional CPA firm, off-Antonio's network per L14) is the next leverage point accelerator networks can accelerate.

## Traction

**Revenue**:
- **$1K/mo MRR** from design partner #1 (Antonio at Vazant Consulting, CA EA, 200+ active clients on platform). First revenue closed 2026-05.
- Discovery Scan productized at $1-5K/book (the wedge); first reference scan generates the v1 sales artifact for partners #2-#10.

**Substrate (built + tested + audited)**:
- **28 migrations live in PROD** (0026 signatures envelope_id index + 0027 kba-failed signature status confirmed via Vercel-pulled PROD `DATABASE_URL` 2026-05-11).
- RLS at `ENABLE + FORCE` on every tenant-scoped table.
- Per-tenant DEK encryption (AES-256-GCM, AAD-bound per `(tenant_id, client_id, path)`); 34/34 encryption tests + KEK rotation runbook + rotation script shipped.
- Cryptographic audit chain (chain_seq + prev_hash + row_hash); nightly tamper verifier cron.
- Webhook signature verification helper (32/32 tests).
- PII regex scrubber (32 tests).
- Bedrock fallback at orchestrator (38/38 unit + 4/4 smoke tests) — tested in CI.
- 2 production agents in `services/workers/src/agents/` (triage-classifier on Haiku 4.5, inbox-drafter on Sonnet 4.6); 6 specialist agents in design (discovery, notice-drafter, doc-classifier, planning, return-drafting, review-agent).
- **/e2e end-to-end PASS 8/8** against real Anthropic + Bedrock + Neon + R2 at $0.012/run, 16s wall-clock — cadence-enforced via protocol-gate hook (BLOCK at 6 commits since last pass).
- Both Next.js apps deployed READY to Vercel Pro.
- **Codebase knowledge graph** (`/understand` analysis 2026-05-11): **1,038 nodes / 1,182 edges / 10 architectural layers** across 487 analyzed source files. Graph file at `.understand-anything/knowledge-graph.json`.

**Customer development**:
- Antonio at Vazant Consulting (CA EA, 200+ active clients) — paying $1K/mo, full client base onboarding to production-grade substrate 2026-05-30.
- Antonio's mentor commands ~1000 EAs in her network — distribution unlock for partners #2-#10.
- Field research with 5 EAs (CA, FL, TX) validated mental-load-first design constraint.
- Two P0 bugs surfaced in 5/9 Antonio call, both fixed + shipped same week (entity-filing W2 skip `faaa579`; portal/docs Take-photo wire-up `9975978`).

**Product**:
- v0 demo (38-route walk-through) live at `docket-portal.vercel.app` — Marketing/Loom artifact.
- v1 launch 7/30/2026 (12-week phased plan; Antonio sub-milestone 5/30).
- 5 capability pillars specified with implementation paths (Position Framework / Ambient Operator / AI-native CRM / Review Automation / Multi-channel).

**Compliance + operational readiness**:
- SOC 2 Type II controls live in codebase (per-tenant DEK + audit chain + RLS + MFA + encryption + webhook verification + PII scrubbing + change management + access reviews + incident response + business continuity + risk management + employee training + vendor management + controls matrix).
- **12-doc SOC 2 policy + procedure set** in `docs/security/`. Drata or Vanta attestation when capital lands; the policy work is already done.
- **Cyber insurance plan documented** (`docs/CYBER-INSURANCE-RECOMMENDATION.md`): Tech E&O + Cyber bundle with AI-affirmative rider, $1M aggregate, Vouch primary / Embroker backup, target ~$2,500–3,500/yr. Binding before 2026-05-30 prod cutover.
- **Marketing framework locked** (`docs/MARKETING-FRAMES.md`): one-liner + 3 audience frames (compliance-first / closed-loop OS / orchestration / Path 2).

## Specific differentiation vs known competitors

| Competitor | What they do | Why we win at our segment |
|---|---|---|
| **Black Ore Tax Autopilot** | Top-25 firm autonomous prep | $60M raised, top-100 firms only, can't serve solo EAs |
| **Accrual** | Federal + state prep automation | $75M raised, larger firms, no orchestration play |
| **Basis** | Long-horizon prep agents | $1.15B valuation, very large firms, no compliance-first frame |
| **TaxGPT (Andrew)** | Browser automation against tax software | Generalist AI; we're vertical-specialist with deeper position framework |
| **Instead** | AI tax planning + filing for HNW | Consumer-side; we're firm-side |
| **TaxDome / Canopy / Karbon** | Practice management + shallow AI | Aging substrate; we're AI-native from the substrate up |
| **Practiq** | Multi-vertical AI workspace for boutique firms | Generic; we're tax-vertical specialist with knowledge layer |

**The structural moat**: we are the only company building AI-native operating system + Path 2 orchestration play at the down + mid-market segment. The funded competitors are economically forced up-market; the PM incumbents lack return intelligence; we are alone in the lane.

## Generic ask

- **Capital** to fund engineer #3 hire (after David CEO + Haokun CTO) + 12-18 months of runway through partner #2 onboarding + v1.5 expansion + cyber insurance + SOC 2 Type I bridge engagement. Tax-domain coverage is structurally in place via Antonio (on-platform advisor, 1% equity) + contracted backup advisor pipeline (`docs/CONTRACTED-EXPERT-OUTREACH.md`); the next-most-leveraged hire is engineering capacity, not tax counsel.
- **Distribution access**: program-specific networks (Forum's B2B GTM playbook, Mucker's industry network for less-tech-savvy verticals, Pear's Bay Area network, Neo's Ali Partovi access). The primary leverage point is **partner #2 candidate surface** (regional CPA firm, 20-100 staff, ideally different segment + different network from Antonio per L14 dependency-mitigation lock).
- **Reference customers**: program portfolios that include accounting/legal/financial-services firms that could become design partners #2-#5 or Path 2 API integration partners.
- **Technical support**: API credits (especially for the Anthropic Startup Program path), vendor relationships, advisory.

Customize per program below.

---

*Last updated: 2026-05-11. Revenue + substrate + co-founder + marketing framing all reflect post-prep-batch state.*
