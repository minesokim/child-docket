# Anthropic Startup Program — Docket application draft

> *Anthropic Startup Program: API credits + Anthropic technical support + reference customer relationships. No equity. Rolling acceptance.*
> *Why this should be FIRST: lowest friction, biggest immediate technical leverage, no equity dilution.*

**Submission target:** rolling, the week of 2026-05-12.

---

## One-line

**Docket is the AI defense layer for tax practices** — built on Claude (Sonnet 4.6 default, Haiku 4.5 for triage, Opus 4.7 for hard reasoning) + ZDR + AWS Bedrock fallback. Every position cited, every action audit-trailed, every output above Reasonable Basis refused by default. First revenue closed 2026-05 ($1K/mo MRR with Antonio at Vazant Consulting, CA EA, 200+ active clients). Public API + MCP server ship in v1.

---

## What the company does

We're building the third layer of the AI-tax stack: not the data layer (K1x), not the autonomous return prep layer (Black Ore / Accrual / Basis target the top-100 firms), but the **practice + relationship + representation layer** for the US tax profession (~700K EAs + CPAs). **Wedge: 2-10 preparer firms with active audit exposure** (~40K firms, $300-700M wedge TAM). Solo EAs are the expansion ladder below; mid-market regional firms above. The lane is empty because the funded competitors are economically forced up-market and the practice-management incumbents (TaxDome / Canopy / Karbon) lack return intelligence + AI-native substrate.

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

- **28 migrations live in PROD** (0026 + 0027 confirmed 2026-05-11); RLS at `ENABLE + FORCE`, per-tenant DEK + AAD-bound encryption, cryptographic audit chain with nightly tamper verifier, KEK rotation runbook + script all live.
- 2 production agents shipping (triage-classifier on Haiku 4.5, inbox-drafter on Sonnet 4.6); 6 more specialist agents in design.
- **Bedrock fallback verified end-to-end in CI** (38/38 unit + 4/4 smoke); orchestrator is provider-agnostic.
- **/e2e PASS 8/8** against real Anthropic + Bedrock + Neon + R2 at $0.012/run, 16s wall-clock. Cadence-enforced via protocol-gate hook.
- **Codebase knowledge graph**: 1,038 nodes / 1,182 edges / 10 architectural layers across 487 analyzed source files (via Understand-Anything 2026-05-11).
- **First revenue closed**: $1K/mo MRR with Antonio at Vazant Consulting (CA EA, 200+ active clients on platform); full client base onboarding to production substrate 2026-05-30.
- Two P0 bugs surfaced in 5/9 Antonio call, both fixed + shipped within 48h (faaa579 entity-filing W2 skip + 9975978 portal/docs Take-photo wire-up).
- v1 launch 7/30/2026 (12-week phased plan; Antonio sub-milestone 5/30).
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

**David Kim** (CEO, legal: Minseo Kim) + **Haokun Yang** (CTO, technical co-founder). 5+ year partnership pre-Docket. Haokun owns the codebase end-to-end; David runs CEO + product + Antonio relationship + customer development. Both UCR CS. Operating from Los Angeles area. **Tax-domain depth via Antonio Vazquez, EA (Vazant Consulting, CA)** — paying design partner + on-platform tax advisor (1% equity) + 25 years EA practice. Contracted backup advisor pipeline specified at `docs/CONTRACTED-EXPERT-OUTREACH.md`. Email: minseodavid@gmail.com. Repo (private): github.com/minesokim/child-docket.

---

## Honest gaps

- **Tax-domain coverage via Antonio + contracted expert** (not a tax co-founder). Tax co-founder hire deferred per 2026-05-11 posture decision — Antonio (on-platform CA EA) reviews Position Library content; contracted tax expert engaged for scale-validation when bandwidth requires. Revisit at v1.5+ scale.
- **Revenue: $1K/mo MRR**, single paying customer (Antonio). Path to $5-10K/mo MRR runs through partner #2 acquisition during the Anthropic Startup Program window.
- **One design partner currently** (Antonio); partner #2 (mid-market regional CPA firm, 20-100 staff) targeted Phase 4 of v1, ideally surfaced via accelerator network.

We're not hiding any of these. The Anthropic Startup Program's value at this stage is exactly to fund the substrate ramp + technical advisory during the Antonio production push + partner #2 onboarding.

---

*Last updated: 2026-05-09 (initial draft, Claude autopilot).*
