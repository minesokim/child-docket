# Neo Accelerator — Docket application draft

> *Neo Accelerator (Ali Partovi): $625K + Neo network access. Rolling acceptance.*
> *Best fit: Neo's bias toward ambitious-vision founders + less-conventional paths matches Docket's Path 2 + Palantir/Foundry framing.*

**Submission target:** rolling, the week of 2026-05-12.

---

## One-line

**Docket is the AI defense layer for tax practices.** Path 1 (vertical SaaS for solo + small + mid-market firms) + Path 2 (public orchestration platform with API + MCP server in v1). **$1K/mo MRR** from design partner #1 (Antonio at Vazant Consulting, CA EA, 200+ active clients); full client base onboarding to production substrate 2026-05-30. Bootstrap-feasible at our segment; capital accelerates the Path 2 swing.

---

## Why Neo specifically

Three reasons we're a fit:

1. **Ali Partovi backs ambitious-vision founders.** The Path 2 orchestration play (public API + MCP server in v1, not v1.5) is the swing-for-unicorn bet. Most vertical SaaS founders ship the SaaS and add an API later; we're committing to the API + the SaaS in parallel. This is the bet Ali has historically funded.
2. **Neo Network access compounds at three high-leverage points**: (a) **Partner #2 candidate surface** (regional CPA firm, 20-100 staff, ideally different segment + different network from Antonio per L14 dependency-mitigation lock) — operators in Neo's network adjacent to accounting / legal / financial-services can warm-intro qualified firms; (b) **Engineer #2 candidate surface** — Neo's technical-founder network is a 10x multiplier over cold recruiting for the most-leveraged hire; (c) **Path 2 partner-tier customer surface** — other AI tax tools that could integrate with Docket's compliance + audit substrate via the public API + MCP server.
3. **Less-conventional path.** Forward-deployed services + platform (Palantir/Foundry pattern, structurally identical to FluentOS' productized AI consulting template) is unusual for a vertical SaaS company. Most VCs see "consulting that becomes a platform" and either flinch (services revenue dilutes the platform thesis) or buy in (the Palantir comparison). Neo has historically been on the buy-in side. The non-snowflake discipline (every engagement runs on multi-tenant substrate; refuse out-of-thesis work) is what makes the model honest.

---

## What Docket does

We replace the messy combination of practice management software + return-prep tool + email + SMS + spreadsheets that runs a typical tax firm with a single intelligence layer that captures every artifact and surfaces decisions: deductions with cited authority (Position Framework), replies in the EA's voice, positions defended or refused based on confidence tiers, anomalies flagged across the client book.

The 5 capability pillars:
1. Compliance-first deduction surfacing (Position Framework with 4-tier confidence + cited authority + refusal floor).
2. Ambient operator (closed-loop OS, not chat surface).
3. AI-native CRM (memory scoped to client + firm).
4. Review automation + form filling.
5. Multi-channel reachability.

Plus Path 2: public API + MCP server in v1 — the orchestration play that turns Docket from "vertical SaaS for tax" into "the substrate the entire AI tax stack runs through."

---

## Why this is unicorn-shaped

The unicorn case is multi-stage:

**Stage 1 — vertical SaaS floor (2026-2027)**: $25-50M ARR achievable on penetration of solo + small + mid-market tax practices (~80K firms in US). Funds the swing. Pricing: founder tier $250 + tiered base ($499 / $1,499 / $4,499 / $14,999) + active-client metering. Per-active-client cost target $1.39/mo → 80%+ gross margin at peak tier.

**Stage 2 — orchestration platform (2027-2028)**: Path 2 lights up. Other AI tax tools (TaxGPT, Soraban, TruePrep, future entrants) embed Docket capabilities. Tax software vendors integrate at scale. API tier: Developer free / Partner $999 / Platform custom. TAM is the entire AI-tax stack; revenue economics resemble Stripe-for-tax-AI.

**Stage 3 — network-effect moat (2028+)**: Cross-firm anonymized aggregation (differential-privacy-protected, k-anonymity ≥10). New firms benefit from existing firms' history. Memory marketplace. AI CPA white-label (firms license Docket-as-firm-brand). Practice-as-asset (transferable at 2x revenue).

**The compound**: Stage 1 funds Stage 2 funds Stage 3. Each stage is independently economically viable; the compounding is the upside.

The down/mid-market tax practice segment is open for ~12-18 months before either (a) a funded competitor (Black Ore / Accrual / Basis at $235M+ combined) figures out how to come down-market, or (b) a PM incumbent (TaxDome / Canopy / Karbon) ships AI of comparable depth. The 12-month window is the bet.

---

## Why Docket vs the obvious alternative

The obvious alternative for a Y Combinator-shape ambitious founder in vertical AI is "sell to the top-100 firms." It's been tried — Black Ore, Accrual, Basis have raised $235M+ combined and are 18-24 months ahead in the up-market segment. **Bootstrap option for Big-4-targeting AI-native return prep is dead.**

What's NOT been tried: AI-native operating system for the down + mid-market with compliance-first frame + Path 2 orchestration play. Not because it's a bad bet — because it requires a founder willing to (1) reject the "raise $50M and target Big 4" path, (2) build forward-deployed services as the path to platform, (3) commit to Path 2 in v1 not v1.5, (4) accept the pre-IPO trajectory is a 5-7 year arc not a 2-3 year arc. We're that founder.

---

## Traction

- **Substrate (year of work already done)**: **28 migrations live in PROD** (0026 + 0027 confirmed 2026-05-11); RLS at `ENABLE + FORCE`; per-tenant DEK + AAD-bound encryption; cryptographic audit chain (chain_seq + prev_hash + row_hash) + nightly tamper verifier; KEK rotation runbook + script; Bedrock fallback (38/38 unit + 4/4 smoke) tested in CI; webhook signature verification (32/32); PII regex scrubber (32 tests); 2 production agents + 6 specialist agents in design; Inngest workers running 8 cron functions. **/e2e PASS 8/8 at $0.012/run** against real Anthropic + Bedrock + Neon + R2. Codebase knowledge graph: 1,038 nodes / 1,182 edges / 10 architectural layers (`/understand` audit 2026-05-11).
- **Revenue**: $1K/mo MRR with Antonio (paying design partner #1). Two P0 bugs from 5/9 Antonio call shipped same week (faaa579 + 9975978).
- **SOC 2 Type II posture**: 12-doc policy + procedure set in `docs/security/`. Drata or Vanta attestation when capital lands.
- **Production deploys**: Both apps READY on Vercel Pro.
- **Design partner #1**: Antonio at Vazant Consulting (CA EA, ~250 active clients), production onboarding 5/30/2026.
- **v1 launch**: 7/30/2026.
- **Path 2 commitment locked** (CLAUDE.md L1): public API + MCP server in v1.

---

## What we'd do with $625K + Neo network

**The capital deployment**:

- **Engineer #2 hire** (~$100K signing + first 6 months partial): the most-leveraged hire given tax-domain coverage is in place via Antonio + contracted expert pipeline. Tax co-founder hire deferred per 2026-05-11 posture decision (revisit at v1.5+ scale). The Neo Network surface accelerates engineer #2 from 6 months to 6 weeks.
- **Engineer #3 + first product hire** (~$200K, 12 months): adds capacity beyond the existing David (CEO) + Haokun (CTO) team. Phase 4-6 of v1 build benefits most.
- **Antonio + first 5 founder-tier firms production infrastructure** (~$50K, 12 months): per-active-client target $1.39/mo at full tier × 5 firms × 200 clients = sustainable.
- **Sales + marketing** (~$125K): Discovery Scan landing page + paid acquisition; NAEA chapter sponsorships; Latino Tax Pro partnership activation; r/taxpros + Tax Twitter earned-media work; Sales Navigator + outreach; first paid pilot conversion to subscription.
- **Legal + insurance** (~$50K): cyber-insurance, E&O, ToS + DPA + AUP; SOC 2 Type II first-year attestation prep.
- **Reserve** (~$100K): 6-month runway buffer for unexpected — partner #2 sales-cycle delays, knowledge-layer ingestion overrun, etc.

**The Neo network compounds at three points**:

1. **Mid-market partner #2 candidate surface** (the primary leverage). Phase 4 of v1 starts identifying mid-market partner #2 (regional CPA firm, 20-100 staff, ideally different segment + different network from Antonio per L14 dependency-mitigation lock). Neo's network of operators in adjacent verticals (legal-tech founders, fintech operators, accounting-firm-adjacent advisors) can warm-intro the right firms — 10x multiplier over cold outbound.
2. **Engineer #3 candidate surface.** Two-founder bandwidth (David CEO + Haokun CTO) is the binding constraint on Phase 4-6 v1 scope. Neo's technical-founder network surfaces engineers with the right vertical + stack instincts faster than YC/Triplebyte/cold.
3. **Path 2 partner surface.** The API + MCP server tier needs other AI tools as Partner-tier customers. Neo Network has the connectivity to surface those Partner-tier candidates faster than cold outbound.

---

## Honest gaps

- **Tax-domain coverage via Antonio + contracted expert** (tax co-founder hire deferred per 2026-05-11 posture decision; revisit at v1.5+ scale).
- **$1K/mo MRR**, single paying customer (Antonio). Discovery Scan ($1-5K/book) is the wedge; first reference scan from Antonio's 5/30 onboarding produces the artifact for first paid Scans by 6/15.
- **One design partner committed** (Antonio). Partner #2 (mid-market regional CPA firm) targeted Phase 4 of v1 — the primary value-add Neo's network unlocks.
- **Two-founder team currently** (David CEO + Haokun CTO). Engineer #3 is the most-leveraged next hire (the Neo Network leverage point).

We're not hiding any of these. Neo's value at this stage is exactly to bridge the runway gap + accelerate the hire surface during the 12-week sprint to v1.

---

## Founder

**David Kim** (CEO, legal: Minseo Kim) + **Haokun Yang** (CTO, technical co-founder, 5+ year partnership pre-Docket; Haokun owns the codebase end-to-end). Tax-domain via **Antonio Vazquez, EA** (on-platform advisor, 1% equity, 25-year practice) + contracted backup advisor pipeline. Email: minseodavid@gmail.com. Repo (private): github.com/minesokim/child-docket.

What I'd want a Neo conversation to surface: (1) partner #2 candidates in Neo Network (regional CPA firms, 20-100 staff, off-Antonio's-network per L14 dependency-mitigation lock); (2) the Path 2 orchestration thesis stress-tested by an Ali-shape investor (do we ship Path 2 in v1 or v1.5? Lock currently says v1, but a Neo conversation could move it); (3) the segment posture (down + mid-market only for 18-24 months) stress-tested; (4) the tax co-founder posture decision stress-tested — Antonio + contracted expert is the current frame; is that durable or does scale force the hire by v1.5?

---

## Specific ask

| | |
|---|---|
| **Capital** | $625K (Neo standard) |
| **Equity** | Neo's standard terms |
| **Neo Network access** | Mid-market regional CPA firm contacts for partner #2 candidates (primary value-add per L14); engineer #2 candidate surface from Neo's technical-founder network; Path 2 partner-tier customer introductions (other AI tax tools that could integrate via Docket's public API + MCP server) |
| **Ali Partovi office hours** | Stress-test on the Path 2 v1-vs-v1.5 lock + segment posture |
| **Post-program priced round** | Investor introductions + LP relationships |

---

*Last updated: 2026-05-09 (initial draft, Claude autopilot).*

---

## 2026-05-11 evening update — current operational state

Posture pivots + new artifacts shipped since initial draft:

**Strategic anchor (L16 locked CLAUDE.md)**: **100 paying customers by 2026-08-01** — the 12-week sprint from 5/11. ~$31-67K/mo MRR / $370-810K ARR target. Full plan at `docs/DESIGN-PARTNER-ACQUISITION-PLAN.md`.

**Product substrate locked**:
- Position Library v0: **20 of 20 entries drafted, Antonio-validated by 5/30** (`content/position-library/v0/`). The substrate the Discovery agent retrieves from.
- Discovery Scan operational spec complete; Discovery agent target ship 6/8/2026. First Antonio reference scan 6/15.
- Antonio audit case studies pre-baked; published versions ship 5/20 across all surfaces.
- WISP per IRS Pub 4557; SOC 2 Type I Q4 2026.
- Codex review framework integrated into every `feat(`/`fix(` commit per protocol-gate.

**Distribution motion**:
- Boney-Henderson presentation locked Week 4 — ~1000 EA audience.
- 20-EA validation sprint with WEDGE filter running 5/12-5/18.
- 4-week social cadence pre-written.

**Posture deferrals**: cyber insurance + landing page + sales VA deferred until product closer to complete.

**What Neo network can specifically unblock**:
- Mid-market regional CPA firm partner #2 candidates (primary value-add per L14)
- Engineer #2 candidate surface from Neo's technical-founder network
- Path 2 partner-tier customer introductions (other AI tax tools that could integrate via Docket's public API + MCP server)
- Ali Partovi office-hours: stress-test on the L1 v1-vs-v1.5 lock + segment posture + Path 2 swing timing

*Updated 2026-05-11 evening, Claude autopilot.*
