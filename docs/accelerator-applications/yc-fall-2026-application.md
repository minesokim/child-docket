# Y Combinator Fall 2026 — Docket application draft

> *YC Fall 2026 deadline ~early August 2026 per L15. Apply rolling alongside Forum / Mucker / Anthropic Startup Program / Pear / Neo.*
> *This is the YC-specific draft. Pull canonical answers from `master-narrative.md`; YC's question set + cadence is the customization here.*

**Submission target:** rolling, before early August 2026.
**Founders:** David Kim (CEO, legal: Minseo Kim, minseodavid@gmail.com) + Haokun Yang (CTO, technical co-founder, 5+ year partnership pre-Docket). On-platform tax advisor: Antonio Vazquez, EA (Vazant Consulting, CA, 1% equity).

---

## Company

**Company name**: Docket (working codename — public-launch name TBD; naming track paused per CLAUDE.md §21 #1)
**URL**: `docket-portal.vercel.app` (live demo) · GitHub `minesokim/child-docket` (private)
**Location**: Los Angeles area; company would be based here.

---

## Founders

**David Kim** (CEO, legal: Minseo Kim) + **Haokun Yang** (CTO, technical co-founder).

**David Kim, CEO**
- Email: `minseodavid@gmail.com`
- LinkedIn: [add]
- GitHub: `github.com/minesokim`
- Twitter / X: [add if active]
- Age: [add]
- Background: [add — CS, prior projects, tax-adjacent exposure if any]

**Haokun Yang, CTO**
- Technical co-founder. 5+ year working relationship with David pre-Docket. On the project from inception. Owns the codebase end-to-end: 13-table Drizzle schema with RLS, per-tenant DEK encryption with AAD binding to `(tenant_id, client_id, path)`, cryptographic audit chain with nightly tamper verifier, agent fleet substrate, two Next.js apps in production, /e2e PASS 8/8 at $0.012/run.
- LinkedIn: [add]
- GitHub: [add]
- UCR CS.

**Antonio Vazquez, EA — On-platform tax advisor** (1% equity)
- Vazant Consulting, Montclair, CA. 25-year EA practice. 200+ active clients on Docket. Defending two active 2026 IRS audits using Docket's audit defense workspace in real time. Every Position Library entry routes through Antonio's sign-off. **This is the structural answer to "where does your tax-domain depth come from" — it's not an open hire, it's a 25-year EA carrying equity in the company who reviews every tax-position claim we make.**

**Contracted backup tax advisors** (per `docs/CONTRACTED-EXPERT-OUTREACH.md`)
- $200-400/hr, 5-10 hrs/wk, sourced from AICPA + NAEA networks. Provide scale-validation for the Position Library when Antonio's bandwidth is constrained.

The team is two co-founders + advisor + contractor pipeline. Engineer #3 is the next-most-leveraged hire and the primary use of YC capital.

---

## ❓ What does your company do? (one sentence, 70 chars)

> **Docket is the AI defense layer for tax practices.**

(50 chars. Has room. Alternate versions if YC prefers the descriptive form: *"AI defense layer for tax practices — every position cited, every action audit-trailed."* — 90 chars; may need trim.)

---

## ❓ What does your company do? (paragraph)

Docket is the AI operating system for the US tax profession. The wedge is **2-10 preparer firms** (~40,000 firms, $300M-$700M wedge TAM at standard tier pricing) where personal PTIN risk is highest and incumbents offer no AI built for that side of the desk. Every tax position the AI surfaces carries cited authority + a confidence-tier classification (Settled / Substantial / Reasonable Basis with 8275 / More Likely Than Not) + a refusal floor below Reasonable Basis. Every action lands in a cryptographic audit chain. Every preparer-AI interaction is reversible. The agent fleet — Discovery, Position, Strategy, Notice, Inbox-Drafter, Review — operates on real client state with the preparer at the edge approving outcomes, not chatting with a bot. From the 2-10 preparer wedge, we expand both directions on the same product: solo EAs (founder + Solo tier) below and mid-market regional firms (Growing + Mid-market tier) above. The funded competitors at Black Ore / Accrual / Basis ($235M+ combined) are economically forced up-market by their unit economics and 18-month enterprise sales cycles — they cannot economically reach the wedge or below. Path 1 is vertical SaaS for the wedge + expansion ladder (the floor); Path 2 is a public API + MCP server that turns Docket into the compliance + audit substrate other AI tax tools run through (the swing).

---

## ❓ Where do you live now, and where would the company be based?

Los Angeles area. Company based here. Open to relocating temporarily for YC's 3-month batch in the Bay Area.

---

## ❓ How long have the founders known one another? How did you meet?

David Kim and Haokun Yang have known each other for 5+ years, working together long before Docket. Haokun has been on Docket from inception as technical co-founder + CTO. We met [add specifics — UCR, prior project, mutual friend, etc.]. Antonio Vazquez (on-platform tax advisor, 1% equity) joined as founding design partner after [add specifics — how the introduction happened, ~6 months pre-launch / how long ago].

---

## ❓ Why did you pick this idea to work on? Have you started? How much have you made?

The pattern that gets vertical-AI SaaS funded by YC has been Stripe, Toast, ServiceTitan, Gusto, Ramp — a category-defining primitive with the right-sized firm as the wedge, expansion ladder visible from day 1. None of them pitched "we sell to small businesses." They pitched the operating system for an industry, starting where the incumbents were structurally weakest. **Our equivalent: AI defense layer for the US tax profession (~700K EAs, CPAs, unenrolled preparers), starting with 2-10 preparer firms where compliance exposure is highest and incumbents offer no AI for the PTIN-carrying side of the desk.**

Picked this idea after watching the AI-tax stack split into three structural layers in late 2025 / early 2026:

1. **Data layer** (K1x, $175M Apr 2026) — gets data into the stack
2. **Return-prep agent layer** (Black Ore $60M, Accrual $75M, Basis $1.15B valuation, all Feb-Apr 2026) — autonomous prep for top-100 firms
3. **Practice + relationship layer** — empty for AI-native at the down + mid-market segment, served only by aging practice-management incumbents (TaxDome / Canopy / Karbon) shipping shallow AI features

Layer 3 is where the open lane is. The funded competitors can't serve it (economically forced up-market by their unit economics + 18-month enterprise sales cycles). The PM incumbents lack return intelligence and their substrates are aging. **The compliance-first frame (cited authority + refusal floor) is the structural moat at this segment because EAs at our segment cannot adopt a loophole-finder tool — their PTIN is on every return they sign.**

**Have started**: 14+ months of build. ~28 migrations live in PROD. Per-tenant DEK encryption with AAD binding. Cryptographic audit chain with nightly tamper verifier. 12-doc SOC 2 Type II policy set. /e2e PASS 8/8 at $0.012/run against real Anthropic + Bedrock + Neon + R2. Codebase knowledge graph: 1,038 nodes / 1,182 edges / 10 architectural layers.

**How much have we made**: **$1,000 / month MRR** as of 2026-05, with Antonio Vazquez (EA, Vazant Consulting, CA, 200+ active tax-prep clients). First reference Discovery Scan ($1-5K productized service) lands by 6/15. Realistic 12-month MRR projection: $5-15K/mo through partner #2 acquisition during the YC batch + first 50 founder-tier firms onboarding (per L6 pricing locked at $250/mo founder tier).

---

## ❓ How do or will you make money? How much could you make?

**Pricing locked per L6 (CLAUDE.md)**:

- **Founder tier (first 50 firms, year 1)**: $250/mo. All agents included. 30% lifetime discount on year-2 standard-tier reversion.
- **Standard tiers (year 2+)**: Solo $499 / Small $1,499 / Growing $4,499 / Mid-market $14,999, all with active-client overage metering.
- **Add-on agents** (Solo + Small): Discovery $199, Strategy/Planning $299, Audit Defense $99, Multi-Entity Optimization $199.
- **Per-event**: notice $50, rep engagement $99, incorporation $25 + state, BOI $15.
- **API tier (Path 2)**: Developer free (1K calls/mo) / Partner $999/mo (1M calls + $0.001 overage) / Platform custom.
- **Discovery Scan** (productized service, v1 wedge): $1-5K per book scan.

**Per-active-client cost target**: $1.39/mo (per L7). Drives 80%+ gross margin at peak tier.

**Pricing is itself part of the positioning.** Founder tier $250/mo is **less than half the §6695(g) IRS due-diligence penalty** ($650 per failure for 2026 returns, per Rev. Proc. 2025-32). The price signals the buyer's actual cost framework: EAs don't budget on subscription cost, they budget on PTIN risk. Existing AI tax tools price at $1,500-$5,000/mo because their buyers are firms with controllers and procurement processes. We priced for the firm owner whose personal liability is on the line. Full marketing math at `docs/MARKETING-FRAMES.md` (penalty-anchored pricing section).

**TAM math (Stripe / Toast / ServiceTitan pattern: wedge + expansion ladder)**:

- **The wedge (2-10 preparer firms with active audit exposure)**: ~40,000 firms × $499-$1,499/mo standard tier = **$300M-$700M wedge TAM**.
- **Down-ladder expansion (solo EAs, 1-preparer firms)**: ~50,000 firms × $499/mo Solo tier = ~$300M addressable.
- **Up-ladder expansion (Growing + Mid-market)**: ~15,000 firms × $4,499-$14,999/mo = ~$800M-$2.7B addressable.
- **Path 1 (vertical SaaS, all tiers combined)**: Total addressable ~$2.8-4.3B at full penetration. **At 5-15% penetration over 5 years, $140-650M ARR achievable.**
- **Path 2 (orchestration)**: TAM is the entire AI-tax stack. Year-3+ revenue $10M+ ARR plausible if Path 2 lands; Year-5+ potentially $50-200M ARR as orchestration becomes plumbing for the industry.

**Why this is unicorn-shaped**: Path 1 floor alone is a $25-50M ARR business (good outcome, not great). Path 2 is the swing — orchestration economics resemble Stripe-for-tax-AI rather than vertical SaaS. The combination — vertical SaaS funded by the floor, orchestration as the swing — is the Palantir/Foundry pattern (services-then-platform, see FluentOS as the productized template we're following).

---

## ❓ Which of the 13 YC startup ideas in the RFS are you working on, if any?

[Check current YC Requests for Startups before submission. Likely fits 2026 RFS categories: "AI agents that do real work," "vertical AI for regulated industries," "developer tools for AI," depending on YC's then-current list. If none match cleanly, leave blank.]

---

## ❓ Other companies in your space

**Three structural layers of the AI-tax stack:**

| Layer | Who's there | Docket's stance |
|---|---|---|
| Data layer (K-1, K-3, 1099 ingestion) | K1x ($175M growth Apr 2026; 44 of top-100 institutional investors) | Integrate, don't compete |
| Return-prep agent layer (autonomous prep + review for top-100 firms) | Accrual ($75M Feb 2026), Basis ($1.15B valuation Feb 2026), Black Ore Tax Autopilot ($60M GA Apr 2026), TaxGPT, Filed, Grove, StanfordTax, SmartRequestAI, Soraban, Juno ($12M seed) | Don't compete head-on. Orchestrate via browser automation (Path 2). |
| Practice + relationship layer (the day, the comms, the ledger, the rep loop) | **Empty for AI-native.** PM incumbents (TaxDome, Canopy, Karbon) ship shallow AI features. | **Docket's lane.** |

**Notable adjacencies (not direct competitors)**:
- Gelt (Series A Sep 2025, $13M) — year-round wealth optimization for HNW; consumer-side
- Deduction / Taylor CPAI ($2.8M pre-seed Nov 2025) — consumer agent
- Rally Tax (YC) — year-round HNW consumer subscription
- April ($38M Series B Jul 2025) — embedded B2B2C tax for wealth/payroll (different segment)
- Perplexity Computer for Taxes (Apr 2026) — $17/mo consumer
- Practiq — horizontal multi-vertical AI workspace (accounting, law, HR, consulting); no tax-vertical depth; no return intelligence; no portal; no rep work pillar — they're 12-18 months from reaching our depth

---

## ❓ Who are your competitors? Why are you better?

The competitive question splits two ways depending on segment.

**At the 2-10 preparer wedge** (with expansion ladder above to mid-market regional firms and below to solo EAs): **No AI-native competitor.** The funded autonomous-prep players target top-100 firms (Black Ore, Accrual, Basis = $235M+ combined, 18-month enterprise sales cycles, can't economically come down-market for at least 12-18 months). The PM incumbents (TaxDome, Canopy, Karbon) ship shallow AI bolt-ons on aging substrates that don't solve the position-framework + audit-defense workflow specifically. We're alone in the wedge — and the founder-50 cohort acceptance filter biases toward 2-10 preparer firms with active audit exposure, not the cheapest-to-acquire solo-seasonal preparers.

**Why we win at this segment**:

1. **The compliance-first frame (Position Framework + cited authority + refusal floor) is the structural moat.** EAs at our segment cannot adopt a loophole-finder tool — their PTIN is on every return. Big-4-targeted competitors sidestep this because in-house tax counsel handles the compliance line. We're the only company building compliance-first AI for the segment that needs it most.

2. **Path 2 (orchestration) is the upside.** Public API + MCP server in v1, NOT v1.5. Other AI tax tools embed Docket's compliance + audit substrate. This is what turns a $25-50M ARR vertical SaaS into a potentially unicorn-shaped orchestration play.

3. **Substrate already shipped.** 28 migrations live in PROD. SOC 2 Type II controls in codebase. /e2e validated end-to-end at $0.012/run. Most accelerator applications from our stage have slides, not running code.

4. **Real revenue from a real preparer.** Antonio is paying $1K/mo. His 200+ active clients onboard to production substrate 2026-05-30. The first reference Discovery Scan hits by 6/15. Sales cycle artifact in hand.

---

## ❓ Why are you the right team to do this?

**Two co-founders + on-platform tax advisor with equity + contracted backup advisor pipeline. Technical depth + customer development discipline + shipping cadence + tax-domain depth all structurally in place.**

- **Two co-founders shipping at codex-reviewed quality.** David (CEO) + Haokun (CTO), 5+ year partnership pre-Docket. Haokun owns the codebase end-to-end: 13-table Drizzle schema with RLS at `ENABLE + FORCE`, per-tenant DEK encryption with AAD binding, cryptographic audit chain with nightly tamper verifier, agent fleet substrate, two Next.js apps in production. 28 migrations live in PROD. Bedrock fallback CI-verified (38/38 unit + 4/4 smoke). 12-doc SOC 2 Type II policy set. /e2e PASS 8/8 against real production stack at $0.012/run. Codebase knowledge graph: 1,038 nodes / 1,182 edges / 10 architectural layers (audited 2026-05-11). This is a year of substrate work most pre-revenue applicants don't have.
- **Shipping cadence under protocol-gate discipline.** Every feat/fix commit blocked locally + in CI without trailers for Edge-Cases, Score≥95, Align, Craft, Codex-Reviewed (via OpenAI Codex CLI), Compliance-Check. Two P0 bugs from Antonio's 5/9 call shipped within 48 hours (faaa579 entity-filing W2 skip + 9975978 portal/docs Take-photo wire-up). That's the operating tempo against real customer pressure.
- **Tax-domain depth via Antonio Vazquez, EA** (Vazant Consulting, 25-year practice, 1% equity, on-platform). Every Position Library entry routes through Antonio's sign-off — that's the structural answer to "your AI tool is making tax claims, who verifies them?" The verifier is a 25-year EA with equity in the company. Contracted backup advisor pipeline ($200-400/hr from AICPA + NAEA networks per published doc) handles scale-validation. **This is not an open tax co-founder seat — it's a deliberate structural choice.**
- **Customer development through Antonio.** 14+ months of field work with a real CA EA running both prep + representation. Antonio's pain (mental load > research depth) drove the L9 lock (no AI-as-chat-character) + the entire ambient-operator architecture. Antonio is currently defending two IRS audits using Docket's audit defense workspace in real time.
- **What I'd add with YC**: engineer #3 hire (additional capacity beyond David + Haokun), partner #2 sales-cycle iteration with YC's network (regional CPA firm, off-Antonio's network per L14), Path 2 customer surface (other YC AI tax + accounting companies that could integrate via Docket's public API + MCP server).

---

## ❓ Have you incorporated? Where? When?

[Add: yes/no, state of incorporation, date. Standard Delaware C-Corp recommended pre-Series-A.]

---

## ❓ If you've raised money, how much, and what's the post-money valuation?

[Add. Likely bootstrapped to date. SAFE round may be in flight by YC application time depending on close timing on Forum / Mucker / Neo conversations.]

---

## ❓ Have you applied to YC before?

[Add. If yes, with what idea, when, and what's changed since.]

---

## ❓ Tell us about an interesting problem you've solved that wasn't your job.

[Add. YC pattern: technical-founder anecdote that demonstrates problem-solving + scope-finding. Examples that would land for this profile:
- "Built X open-source tool that Y people now use" (if applicable)
- "Reverse-engineered the OLT browser-automation interface to prove the integration was technically feasible before committing to the build"
- "Investigated and fixed a multi-hour outage in [previous role's system] that the on-call team hadn't been able to root-cause"
- Any technical-craft story that shows curiosity + persistence + judgment
]

---

## ❓ Anything else we should know?

A few things YC's standard questions don't capture cleanly:

1. **Codebase is auditable.** We ran an automated codebase analysis (`/understand` via the open-source Understand-Anything plugin) and produced a 1,038-node / 1,182-edge knowledge graph across 10 architectural layers, validated 2026-05-11. You can explore the substrate independently — we'll grant batch-time read access to YC partners if useful.

2. **The cyber insurance work is in flight.** Tech E&O + Cyber bundle with AI-affirmative rider, $1M aggregate, targeting Vouch primary / Embroker backup, $2,500-3,500/yr expected premium per `docs/CYBER-INSURANCE-RECOMMENDATION.md`. Binding before 2026-05-30 (Antonio production-substrate sub-milestone). Most early-stage AI SaaS founders don't have this scoped before YC; we do.

3. **Marketing positioning is locked**, not still being figured out. `docs/MARKETING-FRAMES.md` codifies the audience-segmented positioning hierarchy: "operating system" for category language (investor/press/YC), "AI defense layer" for cold-outreach hook (the emotional adjective), "the only AI built for the tax pro's side of the desk" for homepage hero, "closed-loop AI" for technical/product description. Use/never-say lists locked. Pricing is itself a positioning lever (the $250/mo founder tier is < half the $650 §6695(g) penalty). This is sales-cycle ready.

3a. **Coverage is published transparently** at `docs/COVERAGE-MAP.md`. Every other AI tax tool markets "find every deduction" without ever telling buyers what their AI catches or doesn't. We publish it: 5-layer Minimum-Viable Shield, 4-tier coverage classification (Algorithmic 100% / Pattern Industry-Best / Judgment Cited-Support / External Honest-About-Limits), 20-position v1 Position Library list, every compliance surface tagged Live / Pending / Out-of-Scope. This is the category-defining liability-boundary move — no tax software has ever done it.

4. **We have an explicit, written list of things we WON'T do.** CLAUDE.md §14 (Explicit NOs): no consumer tax filer, no fighting Black Ore / Accrual / Basis at top-100 firms for 18-24 months, no F500 in-house tax department for 18-24 months, no Python backend, no Bloomberg/CCH editorial year 1, no shadcn aesthetic, no AI-as-chat-character (L9 lock). The discipline is the moat as much as the product is.

5. **Antonio's mentor commands ~1000 EAs** in her professional network. She's the distribution unlock for partners #2 through #10 once we have a reference Discovery Scan in hand from Antonio (target 6/15).

---

## Specific ask of YC

| | |
|---|---|
| **Capital** | $500K SAFE on standard YC terms |
| **YC batch (3 months)** | Full participation — relocate temporarily for batch; partner network leverage for engineer #3 hire + partner #2 sales cycle |
| **Demo Day** | Tax-vertical positioning + Path 2 orchestration thesis presented to the YC investor audience |
| **Post-batch network** | YC's enterprise-sales network for mid-market partner #2 acquisition + the YC AI portfolio for Path 2 API integration partners |

---

*Created 2026-05-11. Voice + tone: this draft reads as a YC application, not a marketing brief — favor concrete numbers + customer evidence + honest gap-naming over hype. David's voice pass before submission should keep it that way.*

---

## 2026-05-11 evening update — current operational state for submission

Updates since initial draft (same-day; reflect 5/11 evening posture):

**Strategic anchor (L16 locked CLAUDE.md)**: **100 paying customers by 2026-08-01** — the 12-week sprint from 5/11. ~$31-67K/mo MRR / $370-810K ARR target depending on tiered-scarcity pricing strategy. Full operational plan at `docs/DESIGN-PARTNER-ACQUISITION-PLAN.md` (250 lines) with 5 distribution channels, funnel math, weekly milestones, risk + mitigation table.

**Product substrate locked**:
- **Position Library v0: 20 of 20 entries drafted, Antonio-validated by 5/30** (`content/position-library/v0/`). Every entry: 4-tier confidence + cited primary authority + draft Form 8275 (Tier 3) + audit-defense framing + REFUSED-floor reasoning. The substrate the Discovery agent retrieves from.
- **Discovery Scan operational spec complete** (`docs/DISCOVERY-SCAN-OPERATIONAL.md`); Discovery agent target ship 6/8/2026. Per-scan cost ~$0.22. First Antonio reference scan target 6/15 (the headline marketing artifact).
- **Discovery Scan sample PDF** (`docs/discovery-scan-sample-output.md`) — 12-page gold-standard reference showing 8 surfaced positions + 3 explicit refusals on a hypothetical S-Corp construction client.
- **Antonio audit case studies pre-baked** (`docs/antonio-case-study-template-pre-baked.md`); Antonio interview returns ~5/16; published versions ship across all surfaces 5/20.
- **WISP** (`docs/security/WISP.md`) compliant with IRS Pub 4557 + FTC Safeguards Rule (16 CFR Part 314) + MA 201 CMR 17.00 + NY SHIELD Act + CCPA. SOC 2 Type I attestation Q4 2026 (Drata or Vanta engagement targeted by 6/15); SOC 2 Type II mid-2027.
- **Codex review framework** (`docs/CODEX-REVIEW-FRAMEWORK.md`) — every `feat(`/`fix(` commit through full protocol-gate (edge-cases → code-quality → codex review → /score ≥ 95 → /align → /craft → /smoke-test → /decisions-log). User-codified discipline.

**Distribution motion**:
- **Boney-Henderson network presentation** locked Week 4 (~6/1) — ~1000 EA + small-CPA audience hosted by Antonio's 25-year mentor. Antonio leads; David sidekicks. Deck complete at `docs/pitch-decks/boney-henderson-presentation-deck.md` (12 main + 5 backup slides). Expected output: 15-25 customers from this single event (per acquisition plan Channel 1).
- **20-EA validation sprint with WEDGE filter** (2-10 preparer firms, audit-exposed, EA/CPA-led) running 5/12-5/18.
- **4-week founder voice cadence** pre-written (Tax Twitter + r/taxpros + LinkedIn): `docs/social-content/founder-voice-posts-2026-05-{12,19,26,06-02}.md`.

**Posture deferrals (2026-05-11 call)**:
- Cyber insurance applications deferred until product closer to complete (~6/15). No premium burn pre-revenue + pre-customer.
- Landing page / website build deferred. Cold outreach runs through David's inbox + DM channel.
- Sales VA hire deferred until Discovery agent + landing page ship.

**Honest gap update**:
- Customer count today: 1 ($1K/mo MRR — Antonio at Vazant Consulting). Plan: 100 by 8/1, YC application submitted ~7/15 with ~60-70 customers on the platform.
- Antonio production sub-milestone (5/30): ~250 active clients live on full production substrate.
- Partner #2 (mid-market regional firm, 20-100 staff): targeted Phase 6 of v1 build (7/30 launch). Sourced via Boney-Henderson + Mucker network if accepted.

*Updated 2026-05-11 evening, Claude autopilot. Re-verify all numbers + dates before YC submission deadline (~early August). Voice-pass with David before submit.*
