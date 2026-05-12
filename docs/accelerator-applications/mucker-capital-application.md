# Mucker Capital — Docket application draft

> *Mucker Capital: $175-200K, LA-based, B2B in less-tech-savvy industries.*
> *ICP fit is unusually strong: tax practices ARE the less-tech-savvy industry Mucker invests in.*

**Submission target:** rolling, the week of 2026-05-12.

---

## One-line

**Docket is the AI defense layer for tax practices.** Every position cited, every action audit-trailed, every output above Reasonable Basis refused by default. **$1K/mo MRR** with design partner #1 (Antonio at Vazant Consulting, CA EA, 200+ active clients). Forward-deployed embed model, services-then-platform path (Palantir/Foundry pattern via FluentOS template).

---

## Why Mucker specifically

Mucker invests in B2B for less-tech-savvy industries. **Tax practices ARE the less-tech-savvy industry.**

- **Solo EAs run on:** TaxDome (or Canopy / Karbon) + OLT (or Drake / ProConnect / UltraTax) + Gmail + WhatsApp + Excel + Notion + DocuSign + Square + IRS Solutions for rep work. None of these talk to each other.
- **Mental load is the binding constraint.** Antonio (our design partner #1) handles ~250 active clients and runs 70-hour weeks January-April. Research depth is not the constraint; the constraint is a single intelligence layer that captures every artifact and surfaces decisions.
- **The funded AI-native competitors target Big-4 and top-100 firms** because that's where the $235M+ has gone. **Antonio's segment is structurally underserved.** Mucker's thesis on B2B for less-tech-savvy industries is exactly Docket's thesis on AI-native operating system for tax practices.

The LA office presence matters too: Antonio is in California, our second design partner candidate (mid-market regional firm) is targeting CA + Pacific Northwest, and our distribution path through Latino Tax Pro is California-anchored. Mucker's LA network compounds.

---

## What we sell

Forward-deployed services + platform (the Palantir/Foundry pattern, structurally identical to FluentOS — productized AI consulting at 3-day Foundation + monthly retainer + ownership path).

### Today: forward-deployed AI engineering

- **Foundation build**: $10-25K, 1-2 week productized engagement. Antonio's setup is the reference build.
- **Retainer**: $2-5K/mo for expansion + customization on the platform substrate.
- **Discovery Scan productized service**: $1-5K per book scan. Wedge product. EA uploads tax-software export → PDF report 24 hours later listing every defensible deduction missed on prior-year returns.

### Tomorrow: platform (subscription)

- **Founder tier (first 50 firms)**: $250/mo (Antonio's call price). All agents included.
- **Standard tiers**: Solo $499 / Small $1,499 / Growing $4,499 / Mid $14,999 + active-client metering.
- **API tier (Path 2 orchestration)**: Developer free / Partner $999 / Platform custom. Public API + MCP server in v1.

### The non-snowflake discipline

Every consulting engagement runs on the same multi-tenant substrate (per CLAUDE.md §16 productization discipline). If a build doesn't fit the substrate, we refuse the work. This is the rule that prevents services revenue from killing the platform — it's the lesson from Palantir/Foundry's pivot we're building in from day 1.

---

## Why now (and why not sooner)

Three forces:

1. **Claude / GPT-5 / Gemini 2 class models** can finally read tax authority + draft positions with citations at preparer-grade quality. The compliance-first frame becomes possible because the AI can show its work.
2. **A funding wave hit return prep automation up-market.** Black Ore ($60M Apr 2026), Accrual ($75M Feb 2026), Basis ($100M Series B at $1.15B valuation Feb 2026) are all targeting top-100 firms. **They cannot serve the segment we target.** Their unit economics force them up-market; their sales cycles run 12-18 months. Solo + small + mid-market is open.
3. **Practice management incumbents** (TaxDome, Canopy, Karbon) are shipping shallow AI features but lack return intelligence. Their substrates are aging. The third layer is open.

The window: 12-18 months before either (a) a funded competitor figures out how to come down-market, or (b) a PM incumbent ships AI of comparable depth.

---

## Traction

- **Substrate**: **28 migrations live in PROD** (0026 + 0027 confirmed via Vercel-pulled URL 2026-05-11); RLS at `ENABLE + FORCE`; per-tenant DEK + AAD-bound encryption; cryptographic audit chain (chain_seq + prev_hash + row_hash) + nightly tamper verifier; KEK rotation runbook + script; Bedrock fallback (38/38 unit + 4/4 smoke); webhook signature verification (32/32); PII regex scrubber (32 tests). **/e2e PASS 8/8 at $0.012/run** end-to-end against real Anthropic + Bedrock + Neon + R2. Codebase knowledge graph: 1,038 nodes / 1,182 edges / 10 architectural layers.
- **Revenue**: $1K/mo MRR from Antonio (paying design partner #1). Full client base (200+) onboarding to production substrate 2026-05-30.
- **Production agents**: triage classifier (Haiku) + inbox drafter (Sonnet), both calling orchestrator with cost telemetry + audit hook.
- **Both apps deployed READY** to Vercel Pro.
- **Design partner #1**: Antonio at Vazant Consulting (CA EA, ~250 active clients), production onboarding 5/30/2026.
- **v1 launch**: 7/30/2026.
- **SOC 2 Type II posture in codebase NOW** (per CLAUDE.md L8). 12-doc policy + procedure set in `docs/security/`. Drata or Vanta attestation when capital lands.

---

## Specific differentiation

| Competitor | Their lane | Why we win at our segment |
|---|---|---|
| Black Ore Tax Autopilot | Top-25 firm autonomous prep | $60M raised, top-100 firms only, can't serve solo EAs |
| Accrual | Federal + state prep automation | $75M raised, larger firms |
| Basis | Long-horizon prep agents | $1.15B valuation, very large firms |
| TaxGPT (Andrew) | Browser automation against tax software | Generalist; we're vertical-specialist with knowledge layer |
| TaxDome / Canopy / Karbon | Practice management + shallow AI | Aging substrate; we're AI-native from substrate up |
| Practiq | Multi-vertical AI workspace | Generic; we're tax-vertical specialist |

**The structural moat at our segment:**
1. Compliance-first frame (Position Framework with cited authority + refusal floor) is the only frame that works for EAs whose PTIN is on every return.
2. Path 2 orchestration (public API + MCP server in v1) creates a separate revenue stream + network-effect moat.
3. SOC 2 Type II controls in codebase NOW = enterprise-readable from day 1, no retrofit cost.
4. Forward-deployed embed model = real product validation from week 2, not month 18.

---

## What we'd do with $175-200K + Mucker

**The capital deployment:**

- **Engineer #2 hire** (~$50K signing + first 3 months partial). The most-leveraged hire given tax-domain coverage is in place via Antonio + contracted expert pipeline (tax co-founder hire deferred per 2026-05-11 posture decision, revisit at v1.5+ scale).
- **Engineer #3 first-6-months runway** (~$60K). Adds capacity beyond the existing David (CEO) + Haokun (CTO) team. Phase 4 of v1 build benefits most.
- **Antonio + partner #2 production infrastructure** (~$15K). 12 months of Vercel Pro + Neon Launch + R2 + Inngest + Sentry + Twilio + Anthropic + AWS Bedrock + DocuSign + Square. Per-active-client target $1.39/mo at full tier.
- **Sales + marketing** (~$50K): Discovery Scan landing page, NAEA chapter sponsorships ($3-8K × 3 events), Latino Tax Pro partnership activation, r/taxpros earned-media work, Sales Navigator + outreach.
- **Legal + insurance** (~$25K): cyber-insurance, E&O, ToS + DPA + AUP from a tax-law-aware attorney; first SOC 2 attestation prep cost.

**The Mucker-specific value beyond capital:**

- **LA-based portfolio CEOs** in B2B for less-tech-savvy industries — Mucker's network has tested the GTM motion we'd run.
- **Mucker's industry contacts** at regional CPA firms across CA + PNW (mid-market partner #2 candidate identification).
- **Operational mentorship** from the Mucker team. Ride-along on the GTM cycle is more valuable than a $25K/mo retainer with a generic SaaS coach.
- **Post-program priced-round support**.

---

## What's specifically NOT a Mucker fit (and why we're applying anyway)

- **Mucker has historically focused on consumer + horizontal B2B.** Our vertical depth is unusual for the portfolio. Counter: tax practices are the canonical "less-tech-savvy industry" Mucker invests in; the vertical depth is the moat.
- **Single paying customer.** Counter: Antonio is at $1K/mo MRR with full client base (200+) onboarding to prod substrate 2026-05-30. First Discovery Scan revenue by 6/15. Mucker's check size bridges to partner #2 acquisition.
- **We have a Path 2 platform play.** Mucker may underweight platform-upside narratives. Counter: Path 1 (vertical SaaS floor) stands alone economically; Path 2 is upside, not the headline.

---

## Founder

**David Kim** (CEO, legal: Minseo Kim) + **Haokun Yang** (CTO, technical co-founder, 5+ year partnership). Tax-domain via **Antonio Vazquez, EA** (on-platform advisor, 1% equity) + contracted backup advisor pipeline. Located Los Angeles area (Mucker-adjacent geography). Email: minseodavid@gmail.com. Repo (private): github.com/minesokim/child-docket.

**Honest gaps**: tax-domain coverage via Antonio + contracted expert (tax co-founder hire deferred per 2026-05-11 posture decision); $1K/mo MRR from Antonio (paying); partner #2 targeted Phase 4 of v1, ideally surfaced via Mucker network.

---

## Specific ask

| | |
|---|---|
| **Capital** | $175-200K (Mucker's standard check size) |
| **Equity** | Mucker's standard terms |
| **Operational mentorship** | Embed with Mucker portfolio team for 12-week GTM cycle iteration |
| **LA + CA network** | CPA + EA firm contacts for partner #2 candidate identification; Latino Tax Pro warm intro if Mucker has the relationship |
| **Post-program** | Investor introductions for priced round following Mucker |

---

*Last updated: 2026-05-09 (initial draft, Claude autopilot).*
