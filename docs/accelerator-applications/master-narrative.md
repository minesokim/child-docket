# Master Narrative — canonical answers for accelerator applications

> *Use this file as the source of truth. Customize per program; never re-invent.*

---

## One-line description

Docket is the AI-native operating system for a tax practice. Top-tier preparer-grade AI animates every surface; orchestrates the firm's existing tax stack via API + browser automation. Two business models: vertical SaaS for solo EAs through mid-market firms (the floor) + public orchestration platform with API + MCP server for the entire AI tax stack (the swing).

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

David Kim (legal: Minseo Kim) — solo founder, software engineer, builder. Has the substrate built (12 migrations, RLS, per-tenant DEK encryption, audit chain, agent fleet substrate, 2 production agents shipping). Operates the SDLC at codex-reviewed protocol-gate quality. Has Antonio (CA EA running OLT + IRS Solutions + Xero) as design partner #1 — a real preparer working on real clients with the substrate.

**Open**: tax co-founder hire (CLAUDE.md §21 open question #4). Currently the most important hire. The 50 seeded positions in the Position Library will be expert-validated before v1 launch.

**Honest representation**: technical depth is in place; tax-domain depth is the open hire that the accelerator's network could accelerate.

## Traction

**Substrate (built + tested)**:
- 12 migrations applied; RLS at `ENABLE + FORCE` on every tenant-scoped table.
- Per-tenant DEK encryption (AES-256-GCM, AAD-bound per `(tenant_id, client_id, path)`); 34/34 encryption tests + KEK rotation runbook.
- Cryptographic audit chain (chain_seq + prev_hash + row_hash); nightly verifier cron.
- Webhook signature verification helper (32/32 tests).
- PII regex scrubber (32 tests).
- Bedrock fallback at orchestrator (38/38 unit + 4/4 smoke tests).
- 2 production agents shipping: triage classifier (Haiku) + inbox drafter (Sonnet).
- Both apps deployed to Vercel READY.

**Customer development**:
- Antonio at Vazant Consulting (CA EA, ~250 active clients) committed as design partner #1. Onboarding to production by 5/30/2026.
- Antonio's mentor commands ~1000 EAs in her network — distribution unlock for partners #2-#10.
- Field research with 5 EAs (CA, FL, TX) validated mental-load-first design constraint.

**Product**:
- v0 demo (38-route walk-through) live at `docket-portal.vercel.app` — Marketing/Loom artifact.
- v1 launch 7/30/2026 (12-week phased plan; Antonio sub-milestone 5/30).
- 5 capability pillars specified with specific implementation paths.

**Compliance-readiness**:
- SOC 2 Type II controls live in codebase (per-tenant DEK + audit chain + RLS + MFA + encryption + webhook verification + PII scrubbing + change management).
- 12-doc SOC 2 policy + procedure set in `docs/security/`. Drata or Vanta attestation when capital lands.

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

- **Capital** to fund hire-1 (tax co-founder) + hire-2 (engineer #2) + 12 months of runway.
- **Distribution access**: program-specific networks (Forum's B2B GTM playbook, Mucker's industry network, Pear's Bay Area network, Neo's Ali Partovi access).
- **Reference customers**: program portfolios that include accounting/legal/financial-services firms that could become design partners #2-#5.
- **Technical support**: API credits, vendor relationships, advisory.

Customize per program below.

---

*Last updated: 2026-05-09.*
