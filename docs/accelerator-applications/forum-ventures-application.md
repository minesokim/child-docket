# Forum Ventures — Docket application draft

> *Forum Ventures: $100K for 10%, 12-week B2B SaaS focused program. NYC + Toronto. Strong on enterprise-readiness + B2B GTM.*

**Submission target:** rolling, the week of 2026-05-12.

---

## One-line

**Docket is the AI defense layer for tax practices.** Every position cited, every action audit-trailed, every output above Reasonable Basis refused by default. **$1K/mo MRR** from design partner #1 (Antonio at Vazant Consulting, CA EA, 200+ active clients). Vertical SaaS for solo EAs through mid-market firms is the floor; public API + MCP server orchestration is the swing.

---

## What does Docket do?

The third layer of the AI-tax stack:
- **Not** the data layer (K1x raised $175M Apr 2026; we integrate, don't compete).
- **Not** the autonomous return prep layer for top-100 firms (Black Ore $60M, Accrual $75M, Basis $1.15B valuation; they're economically forced up-market).
- **Yes** the practice + relationship + representation layer for solo + small + mid-market tax firms — the lane the funded competitors cannot serve and the practice management incumbents (TaxDome / Canopy / Karbon) lack the AI substrate to dominate.

The 5 capability pillars: compliance-first deduction surfacing (Position Framework with 4-tier confidence + cited authority + refusal floor), ambient operator (closed-loop OS, not chat surface), AI-native CRM (memory scoped to client + firm), review automation + form filling, multi-channel reachability (portal + text + voice).

---

## Why Forum Ventures specifically

Forum's portfolio + program structure are uniquely aligned with Docket:

1. **B2B SaaS focus.** We sell to firms, not consumers. Tax firms have predictable budgets, sticky retention, multi-year contracts available.
2. **Enterprise-readability is the SOC 2 Type II posture in codebase NOW.** Per-tenant DEK encryption, audit chain, RLS, MFA, encryption-at-rest + in-transit, webhook signature verification, PII scrubber. 12-doc policy set in `docs/security/`. We're not retrofitting compliance; we built it in. Forum portfolio companies that ship to mid-market and enterprise will recognize the discipline.
3. **The 12-week structured program** lands at the ideal moment — between Antonio's 5/30 production sub-milestone and v1 launch 7/30/2026. We could ship multiple sales-process iterations during the program.
4. **NYC + Toronto network.** NYC-area tax firms (mid-market) + Forum's enterprise-buyer network = warm intros to mid-market partner #2 (CLAUDE.md §15 Phase 6 of v1).
5. **B2B GTM playbook.** Forum's expertise in pricing, sales motion, ICP refinement compounds with our locked pricing model (founder tier $250 + tiered base + active-client metering). We have the pricing locked; we need the motion.

---

## Why this is structurally different from "AI for tax" applications Forum has seen

Forum has likely seen pitches in the "AI for [vertical]" pattern. Three things make Docket different:

1. **The compliance-first frame is the moat.** Every other AI-tax tool either targets unregulated consumers or in-house tax counsel. EAs at our segment cannot adopt a loophole-finder tool — their PTIN is on every return. The Position Framework (4 confidence tiers + Reasonable Basis floor + cited authority on every position) is the only frame that solves the EA's risk equation. **Nobody at Antonio's segment is building this.**
2. **Path 2 orchestration is the upside, not the headline.** The vertical SaaS floor stands alone. The API + MCP server creates a separate revenue stream + a network-effect moat as third-party AI tools build on Docket. Most "AI for [vertical]" apps don't have a Path 2.
3. **The substrate is real.** 28 migrations live in PROD. RLS at `ENABLE + FORCE`. Per-tenant DEK + AAD-bound encryption. Cryptographic audit chain with nightly tamper verifier. KEK rotation runbook + script. Bedrock fallback verified end-to-end in CI. 2 production agents shipping. **/e2e PASS 8/8 at $0.012/run** against real production stack. 12-doc SOC 2 Type II policy set. Codebase knowledge graph (1,038 nodes / 1,182 edges / 10 layers) audited 2026-05-11. **This is a year of substrate work already done.** Forum's program time goes to GTM iteration, not engineering catch-up.

---

## Traction

| Dimension | Status |
|---|---|
| Substrate | **28 migrations live in PROD** (0026 + 0027 confirmed 2026-05-11); RLS, per-tenant DEK + AAD-bound encryption, audit chain (chain_seq + prev_hash + row_hash) + nightly tamper verifier, KEK rotation runbook + script, Bedrock fallback (38/38 unit + 4/4 smoke), webhook signature verification (32/32), PII scrubber (32 tests). **/e2e PASS 8/8 at $0.012/run.** Codebase knowledge graph: 1,038 nodes / 1,182 edges / 10 architectural layers. |
| Revenue | **$1K/mo MRR** with Antonio (first design partner, paying). Path to $5-10K/mo MRR runs through partner #2 acquisition during Forum cohort. |
| Production deploys | Both apps READY on Vercel Pro (`docket-portal.vercel.app` for client portal; command-room on Vercel-assigned hostname). |
| Agents | 2 in production: triage classifier (Haiku) + inbox drafter (Sonnet). Both call orchestrator with cost telemetry + audit hook. |
| Inngest | Workers running 8 cron functions: gmail-poll, classify-gmail-message, classify-document, classify-notice, finalize-document, verify-actions-chain, cost-outlier-alert, cost-spike-alert. |
| Design partner #1 | Antonio at Vazant Consulting (CA EA, ~250 active clients) committed; production onboarding 5/30/2026. |
| Distribution | Antonio's mentor commands ~1000 EAs in network; Latino Tax Pro partnership scoping; r/taxpros (16K members) earned-media path; NAEA chapter dinner sponsorship strategy. |
| Compliance | 12-doc SOC 2 Type II policy + procedure set in `docs/security/`. Drata/Vanta attestation when capital lands. |
| Pricing | Locked tiers: founder $250/mo (first 50 firms) → Solo $499 → Small $1,499 → Growing $4,499 → Mid $14,999 + active-client metering. Add-on agents. Per-event. API tier (Path 2) Developer $0 / Partner $999 / Platform custom. |
| Revenue | Pre-revenue. Discovery Scan ($1-5K/book) is the V1 wedge productized at Antonio's reference scan. |

---

## What we'd do with $100K + 12 weeks

**The 12 weeks (Forum cohort May 12 → August 11)**:
- **Weeks 1-4 (now → 6/8)**: Antonio production sub-milestone. Onboard Antonio's 250 clients to production-grade substrate. First reference Discovery Scan generated. Launch the v1 product to Antonio's actual book.
- **Weeks 5-8 (6/8 → 7/6)**: Sales motion iteration with Forum's GTM coaches. Refine ICP language. Test the Discovery Scan offer at scale. Identify mid-market partner #2 candidate from Forum's NYC network.
- **Weeks 9-12 (7/6 → 8/3)**: Ship v1 launch (7/30 per CLAUDE.md §15 Phase 6). Onboard mid-market partner #2 in Phase 6. Hardening + smoke + load tests.

**The $100K**:
- Engineer #2 first-6-months runway (~$60K) — frees David from solo-founder bandwidth ceiling; the most-leveraged hire given tax-domain coverage is already in place via Antonio + contracted expert (tax co-founder hire deferred per 2026-05-11 posture decision).
- Antonio + partner #2 production infrastructure ($10K, 12 months: Vercel Pro + Neon Launch + R2 + Inngest + Sentry + Twilio + Anthropic + AWS Bedrock).
- Sales + marketing (~$20K): Discovery Scan landing page, NAEA sponsor fees, LinkedIn Sales Navigator + outreach, r/taxpros earned-media campaign, Tax Twitter presence.
- Legal + insurance (~$10K): cyber-insurance Tech E&O + Cyber bundle (Vouch primary at ~$2,500-3,500/yr per `docs/CYBER-INSURANCE-RECOMMENDATION.md`), ToS + DPA + AUP from a tax-law-aware attorney.

---

## Why we're a 10% deal that pays Forum back

- **Bootstrap is impossible at our v1 ambition.** We've been clear-eyed: $235M+ raised by competitors at the top-100 segment. Bootstrap option for Big-4-targeting AI-native return prep is dead. **At our segment**, bootstrap is feasible but slow. $100K + Forum's structured program is the highest-leverage capital + de-risking mechanism for a 12-week sprint.
- **Pricing economics support Forum's portfolio thesis.** Founder tier at $250/mo × 50 firms = $150K ARR. Standard tiers Solo $499 + Small $1,499 + Growing $4,499 + Mid $14,999 produce $25-50M ARR at modest segment penetration. Path 2 (orchestration) adds upside multiple.
- **Network compounds.** Forum's portfolio + Forum's NYC network + Antonio's mentor + Latino Tax Pro + r/taxpros = real distribution paths. We're not relying on cold outbound only.

---

## Why now (specifically)

The funding window for vertical AI in regulated industries closes when the platform consolidation begins. Top-100 firm autonomous prep is already consolidating ($235M+ committed across Black Ore + Accrual + Basis). Down + mid-market is the lane that's still wide open and will be wide open for ~12-18 months. After that, either (a) one of the funded competitors economically figures out how to come down-market, or (b) a PM incumbent (Canopy, Karbon, TaxDome) ships AI of comparable depth. **The 12-month window is the bet.**

---

## Founder

**David Kim (legal: Minseo Kim)** — solo founder, software engineer. Email: minseodavid@gmail.com. Repo (private): github.com/minesokim/child-docket.

**Honest gaps**: tax-domain coverage via Antonio + contracted expert (tax co-founder hire deferred per 2026-05-11 posture decision); $1K/mo MRR from one paying design partner; partner #2 targeted Phase 4 of v1. The Forum program is exactly when we'd close partner #2.

---

## Specific ask

| | |
|---|---|
| **Capital** | $100K for 10% (standard Forum terms) |
| **Program access** | Full 12-week B2B SaaS GTM coaching cohort |
| **Network access** | NYC + Toronto B2B buyer network; Forum portfolio CEOs in adjacent verticals (legal-tech, fintech) for advisory; Forum's mid-market firm contacts for partner #2 candidate identification |
| **Sales coach + introductions** | Forum's GTM partners running pricing, ICP, sales-cycle playbooks |
| **Post-program access** | Investor + LP introductions for the priced round following Forum |

---

*Last updated: 2026-05-09 (initial draft, Claude autopilot).*
