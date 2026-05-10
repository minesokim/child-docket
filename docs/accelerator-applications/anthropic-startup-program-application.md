# Anthropic Startup Program — Docket application draft

> *Anthropic Startup Program: API credits + Anthropic technical support + reference customer relationships. No equity. Rolling acceptance.*
> *Why this should be FIRST: lowest friction, biggest immediate technical leverage, no equity dilution.*

**Submission target:** rolling, the week of 2026-05-12.

---

## One-line

Docket is the AI-native operating system for a tax practice — built on Claude (Sonnet 4.6 default, Haiku 4.5 for triage, Opus 4.7 for hard reasoning) + ZDR + AWS Bedrock fallback, shipping a public API + MCP server in v1.

---

## What the company does

We're building the third layer of the AI-tax stack: not the data layer (K1x), not the autonomous return prep layer (Black Ore / Accrual / Basis target the top-100 firms), but the **practice + relationship + representation layer** for solo EAs through mid-market firms. The lane is empty because the funded competitors are economically forced up-market and the practice-management incumbents (TaxDome / Canopy / Karbon) lack return intelligence.

Top-tier preparer-grade Claude animates every surface; orchestrates the firm's existing tax stack via API + browser automation; surfaces decisions with cited authority; refuses below Reasonable Basis; generates the audit defense file as a side effect of normal work.

---

## Why we're a great Anthropic showcase

**Docket is built ON Claude, not just "uses Claude."**

1. **Model tiering at scale.** Haiku 4.5 default for extract/classify (triage classifier 258 LOC, inbox drafter 209 LOC, both shipping). Sonnet 4.6 for most agent runs. Opus 4.7 reserved for hard reasoning (multi-year planning, complex residency, controversy). 4-10× cost reduction vs Opus-everywhere; per-active-client cost target $1.39/mo.
2. **Aggressive prompt caching.** System prompts + knowledge bundles + playbooks all cache-marked. 80-90% cost drop on repeated calls. Wired into orchestrator from day 1.
3. **ZDR + Bedrock fallback.** Direct Anthropic API + ZDR for v0; Bedrock fallback at orchestrator (38/38 unit + 4/4 smoke) for vendor resilience. Tested in CI. Tested in production.
4. **MCP gateway path.** v1 ships public API + MCP server. The `claude-agent-sdk` is already a dependency; we migrate the orchestrator off direct SDK once the MCP gateway is the substrate.
5. **Compliance-first frame demonstrates Claude's defensive AI capability.** Every position carries a tier classification + cited authority + refusal floor. We DON'T let Claude do tax arithmetic on a return (rules layer outside the LLM); we DO let Claude reason across authority + facts + precedent and surface positions with confidence + citation. This is a regulated-industry case study for what Claude does well.

We can serve as Anthropic's go-to reference for "vertical AI in a regulated profession with a defensible compliance frame."

---

## Specific build leverage Anthropic can provide

### API credits

We're targeting $50/mo Anthropic API spend during v0 build (per `COSTS.md` discipline), but the real spend curve looks like this:

| Phase | Period | Spend estimate | Why |
|---|---|---|---|
| **v0 build** | Now → 5/30 | ~$50/mo | Haiku-first, mocked external integrations, Claude Code Max ($100/mo) absorbs ~80% of dev cost |
| **Antonio production** | 6/1 → 7/30 | ~$200/mo | Real client traffic on Antonio's 250 clients, agent fleet running on real artifacts |
| **v1 launch** | 8/1 → 10/31 | ~$2-5K/mo | First 5 paying firms × ~$278/mo infrastructure cost per firm |
| **v1.5 scale** | 11/1+ | $10-50K/mo | First 25-100 firms; per-active-client metering driving margin |

API credits at the Antonio production phase + v1 launch phase compound into customer ROI at the per-active-client cost target. **$25K-100K in API credits accelerates v1 by 3-6 months** by removing the monthly-cost-anxiety constraint on aggressive feature shipping.

### Technical support

We'd benefit from:
- **Prompt-engineering review** on the position-framework agent (Discovery, Strategy, Position) — these are the agents where every output reaches an EA's PTIN, so the prompt construction matters a lot.
- **Architecture review** on the MCP gateway design before we migrate the orchestrator. Claude Agent SDK is already a dependency; we want the migration done well, not done twice.
- **Eval framework guidance** for the 50 seeded position-library entries. Eval-driven prompt iteration on cited-authority generation is the right paradigm; we'd value Anthropic's input on how the team running constitutional AI thinks about evaluation in regulated domains.

### Reference customer relationship

If Anthropic has portfolio companies in tax/legal/regulated-services, we'd be a natural fit as a vertical-specialist orchestration layer they could integrate into. Path 2 (the orchestration play) explicitly invites integrations.

---

## Traction (compressed)

- 12 migrations applied; RLS, per-tenant DEK + AAD-bound encryption, cryptographic audit chain, KEK rotation runbook all live.
- 2 production agents shipping (triage classifier on Haiku, inbox drafter on Sonnet).
- Bedrock fallback verified end-to-end.
- Antonio at Vazant Consulting (CA EA, ~250 clients) committed as design partner #1; production onboarding 5/30/2026.
- v1 launch 7/30/2026 (12-week phased plan).
- 12-doc SOC 2 Type II policy set in `docs/security/`.
- Path 2 commitment locked: public API + MCP server in v1, NOT v1.5.

---

## Specific ask

| | |
|---|---|
| **API credits** | $25-100K |
| **Anthropic technical support** | Prompt-engineering review on position-framework agents; architecture review on MCP gateway; eval framework guidance |
| **Reference customer access** | Anthropic portfolio companies in tax/legal/regulated services that could be Path 2 integration partners |
| **Featured case study** | Anthropic-hosted case study on "vertical AI in a regulated profession" once v1 launches |

Equity: none requested. We'd consider an Anthropic customer-success / advisor relationship outside of program structure.

---

## Why this is structurally different from the AI-revolution-in-tax pitches Anthropic has heard

Most "AI for tax" companies are:
- Consumer tax filers (Deduction / Perplexity Computer / Rally / Gelt) — wrong product, wrong segment.
- Top-100 firm autonomous prep (Black Ore / Accrual / Basis) — fortress market with $235M+ already raised by competitors holding 2-year head starts; bootstrap option dead.
- Generalist AI consultants — no vertical depth.

Docket is:
- Vertical specialist for solo + small-firm tax practices (~80K firms in segment, zero AI-native competitors).
- Compliance-first frame (Position Framework with cited authority + refusal floor) — the structural moat at our segment because EAs can't risk their PTIN on loophole-finder tools.
- Path 2 orchestration platform — the API + MCP server make Docket the substrate the entire AI tax stack runs through.
- SOC 2 Type II controls in codebase NOW (audited posture is enterprise-readable from day 1).

The differentiation is the combination, not any single piece.

---

## Founder

**David Kim (legal: Minseo Kim)** — solo founder, software engineer. Built the substrate that's currently in production. Pre-revenue. Operating from Los Angeles area. Email: minseodavid@gmail.com. Repo (private): github.com/minesokim/child-docket.

---

## Honest gaps

- **Tax co-founder open** (most important hire; CLAUDE.md §21 open question #4). 50 seeded positions in Position Library will be expert-validated before v1 launch.
- **No revenue yet** (pre-revenue; Discovery Scan productized at $1-5K/book is the wedge once Antonio's onboarding produces a reference scan).
- **One design partner currently** (Antonio); partner #2 (mid-market) targeted Phase 4 of v1.

We're not hiding any of these. The Anthropic Startup Program's value at this stage is exactly to bridge the runway gap during the Antonio production push.

---

*Last updated: 2026-05-09 (initial draft, Claude autopilot).*
