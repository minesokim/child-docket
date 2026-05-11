# Pear PearX — Docket application draft

> *Pear PearX: $250K-$2M, 14-week, Bay Area, sector-agnostic but bias toward technical founders + deep-tech.*
> *Best fit: Pear values technical depth + ambitious-vision founders; both apply.*

**Submission target:** check current cohort deadline (cohort-based, not rolling).

---

## One-line

**Docket is the AI defense layer for tax practices.** Five-layer architecture (Knowledge / Data / Agent / Orchestration / Governance) with a public API + MCP server orchestration play (Path 2). **$1K/mo MRR** with design partner #1 (Antonio at Vazant Consulting, CA EA, 200+ active clients); full client base onboarding to production substrate 2026-05-30.

---

## Why Pear PearX

Pear's portfolio has consistently funded technical-depth + ambitious-vision founders in vertical AI. Three reasons we're a fit:

1. **Technical depth.** The substrate we've built is non-trivial: 12 migrations applied with row-level security at `ENABLE + FORCE`, per-tenant DEK encryption with AAD binding to (tenant_id, client_id, path), cryptographic audit chain (chain_seq + prev_hash + row_hash) with nightly tamper verifier, KEK rotation runbook + script, Bedrock fallback at orchestrator (38/38 unit + 4/4 smoke tests), webhook signature verification, PII regex scrubber. Five-layer architecture (Knowledge / Data / Agent / Orchestration / Governance). Pear's technical bar matches what we've actually built.
2. **Ambitious vision via Path 2.** The vertical SaaS floor stands alone economically ($25-50M ARR achievable). The orchestration platform play (public API + MCP server in v1) is the unicorn upside — it positions Docket as the substrate the entire AI tax stack runs through. This is the dual-business-model framing Pear has historically valued (the Palantir/Foundry pattern, structurally identical to FluentOS as our productized template).
3. **Bay Area network.** Pear's network is uniquely concentrated in (a) deep-tech founders + (b) the venture ecosystem that funds priced rounds. Both matter post-cohort. Anthropic + AWS proximity matters for v2 inference work (Gladia migration, voice agent infrastructure, MCP gateway architecture review).

---

## What Docket does

### The five capability pillars

1. **Compliance-first deduction surfacing (Position Framework).** Every deduction the AI surfaces carries an IRC cite + tier classification (Settled / Substantial / Reasonable Basis with 8275 / More Likely Than Not) + audit risk + draft 8275 when needed. EAs at our segment cannot adopt a tool that risks their PTIN; this is the structural moat.
2. **Ambient operator (closed-loop OS).** Agents act on real client state without a chat surface. The EA sees a dashboard of "things AI did" + "things needing approval" + "things AI couldn't decide." Never a conversation with a bot.
3. **AI-native CRM (memory scoped to client + firm).** Every action / doc / message lives on the client record. Six-layer memory model (working, episodic, semantic, procedural, relational, pattern). Tiered retention (hot in pgvector, warm in pgvector quantized, cold in R2 metadata-only). Bidirectional client-scoped graph; every retrieval logged to `memory_references`.
4. **Review automation + form filling.** Workpapers assembled, positions drafted, multi-state flagged, e-file orchestrated via OLT/ProConnect/UltraTax browser automation.
5. **Multi-channel reachability.** Portal + Text for clients, Telegram/WhatsApp for the EA. Same data model across channels.

### The architecture

```
┌─ Knowledge layer ─────────────────────────────────────┐
│  Versioned tax graph: Authority · TaxConcept ·        │
│  WorkflowObject · FactPattern · DecisionRule ·        │
│  PlanningStrategy. IRS + CA FTB primary sources.      │
│  pgvector on Neon. Voyage-3-Large embeddings (legal/  │
│  tax domain specialist; 4-6pp accuracy advantage).    │
│  Cohere Rerank v3.5. Hybrid BM25 + vector.            │
├─ Orchestration layer ─────────────────────────────────┤
│  Today: direct @anthropic-ai/sdk + 109-LOC wrapper    │
│  (cost telemetry, prompt caching, audit hook, model   │
│  tiering: Haiku 4.5 / Sonnet 4.6 / Opus 4.7).         │
│  Tomorrow: @anthropic-ai/claude-agent-sdk + MCP       │
│  gateway (already a dependency, migration planned).   │
├─ Rules layer ─────────────────────────────────────────┤
│  Deterministic calculators OUTSIDE the LLM.           │
│  Tax math, threshold/phaseout logic, form mappings.   │
├─ Trust layer ─────────────────────────────────────────┤
│  Citations + confidence scores + red-flag triggers.   │
│  Per-tenant × agent × action-class trust gates.       │
└────────────────────────────────────────────────────────┘
```

LLM reasons, graph knows, rules calculate, tools act.

### Path 2 (orchestration platform)

Public API + MCP server ship in v1, NOT v1.5. Pricing: Developer free (1K calls/mo) / Partner $999/mo (1M calls + $0.001 overage) / Platform custom. The bet: other AI tax tools (TaxGPT, Soraban, TruePrep, future entrants) embed Docket capabilities; tax software vendors integrate at scale; Docket becomes the substrate.

---

## Traction

- **Substrate**: **28 migrations live in PROD** (0026 + 0027 confirmed 2026-05-11); full RLS + per-tenant DEK + audit chain + KEK rotation + Bedrock fallback + webhook verification + PII scrubber. **/e2e PASS 8/8 at $0.012/run.** Codebase knowledge graph: 1,038 nodes / 1,182 edges / 10 architectural layers (`/understand` audit 2026-05-11). 2 production agents shipping + 6 specialist agents in design.
- **Revenue**: $1K/mo MRR with Antonio (paying); first Discovery Scan revenue by 6/15.
- **Production deploys**: Both apps READY on Vercel Pro.
- **Design partner #1**: Antonio at Vazant Consulting (CA EA, ~250 active clients), production onboarding 5/30/2026.
- **v1 launch**: 7/30/2026 (12-week phased plan; Antonio sub-milestone 5/30; mid-market partner #2 onboarding Phase 6).
- **Compliance posture**: SOC 2 Type II controls in codebase NOW; 12-doc policy set in `docs/security/`. Drata/Vanta attestation when capital lands.
- **Pricing**: locked tiers. Founder $250 → Solo $499 → Small $1,499 → Growing $4,499 → Mid $14,999 + active-client metering. API tier (Path 2) Developer $0 / Partner $999 / Platform custom.
- **Per-active-client cost target**: $1.39/mo → 80%+ gross margin at peak tier (per L7 lock).

---

## Why this is unicorn-shaped

**Path 1 (vertical SaaS floor)**: $25-50M ARR achievable on penetration of solo + small-firm tax practices alone. ~80K firms in segment. Standard tier pricing × 5-15% segment penetration produces this floor. Funds the swing.

**Path 2 (orchestration)**: TAM is the entire AI-tax stack. Year-1 revenue de minimis (most calls Developer-free). Year-3+ potentially $10M+ ARR if Path 2 lands; Year-5+ potentially $50-200M ARR as the orchestration layer becomes plumbing for an industry. Path 2 economics resemble Stripe-for-tax-AI more than vertical-SaaS.

**Compound**: Network effects from cross-firm anonymized aggregation (V2 feature, differential-privacy-protected, k-anonymity ≥10). New firms benefit from existing firms' history. The compounding moat over 3-5 years.

**Why this is bigger than "yet another vertical SaaS for tax"**: most vertical SaaS companies are floors without swings. Docket has both, and the swing is structurally a different business (orchestration / API economy) that the vertical SaaS company cannot pivot into without the substrate we're building NOW.

---

## What we'd do with $250K-$2M + 14 weeks

### The 14 weeks

PearX cohorts run during summer + fall. The closest fit: a summer cohort 2026 mapping cleanly onto v1 launch (7/30/2026) + first 50 founder-tier firms onboarding (Aug-Oct 2026).

- **Weeks 1-4**: Antonio production sub-milestone in flight; first Discovery Scan reference; founder-tier firms #2-#5 onboarded.
- **Weeks 5-8**: v1 launch hardening + onboarding ramp. Sales motion iteration with Pear's GTM coaches. Engineer #2 hire confirmed (tax-domain coverage via Antonio + contracted expert; tax co-founder hire deferred per 2026-05-11 posture decision).
- **Weeks 9-12**: Founder-tier firms #6-#15 onboarded. Mid-market partner #2 closes. Path 2 (API + MCP server) external partners identified.
- **Weeks 13-14**: Demo Day prep. Pitch + raise the priced round following PearX.

### The capital ($250K-$2M)

At $250K minimum: engineer #2 + 12 months runway + cyber insurance + ToS attorney. Bridges to partner #2 + priced round.

At $2M maximum: full team (engineer #2 + sales lead + customer success + contracted tax-domain advisory pipeline) + 18 months runway. Self-funds to v1.5 + Path 2 partner activation + SOC 2 Type II attestation. Priced round becomes optional, not mandatory.

We're flexible on check size; we're inflexible on the milestones. Either size of check funds the same plan; the $2M version closes a Series A faster.

---

## Founder

**David Kim (legal: Minseo Kim)** — solo founder, software engineer. Built the substrate. Location: Los Angeles area. Email: minseodavid@gmail.com. Repo (private): github.com/minesokim/child-docket.

**Honest gaps**: tax-domain coverage via Antonio + contracted expert (tax co-founder hire deferred per 2026-05-11 posture decision); $1K/mo MRR from Antonio (paying); partner #2 targeted Phase 4 of v1.

---

## Specific ask

| | |
|---|---|
| **Capital** | $250K-$2M (PearX standard range) |
| **Equity** | Pear's standard terms |
| **Bay Area access** | Pear's deep-tech network; introductions to engineering hires; technical advisors for the MCP gateway architecture review |
| **Investor introductions** | Post-PearX Series A path; LP relationships |
| **Demo Day platform** | Showcase Docket to PearX investor community |

---

*Last updated: 2026-05-09 (initial draft, Claude autopilot).*
