# YC Interview Deck

> *For YC interview (if invited post-application). Format: 10-min interview is mostly Q&A with partners; this deck is reference material partners can flip through during prep.*
> *Lead framing per Option B: **operating system that runs the tax practice**. Platform potential signals dominate.*
> *Target: 12 slides + appendix. Density-high; partners scan, not read.*

---

## Slide 1 — Title / one-liner

**Headline:**
> **Docket**
> **The AI operating system that runs the tax practice.**

**Sub-headline:**
> 70,000 enrolled agents + 670,000 CPAs in the US file returns under their personal PTIN. Docket is the only AI safe for them to use.

**Visual notes:**
- Editorial cream background. Fraunces serif. Forest green primary.
- David Kim (CEO) + Haokun Yang (CTO) names on slide 1 itself — partners need both founders visible upfront.

**Speaker notes (if delivered live):**
> "Docket is the AI operating system that runs the tax practice. We're the only AI tax tool built for the side of the desk where the personal PTIN risk lives — 70,000 EAs and 670,000 CPAs that the $235M+ of funded AI tax companies can't serve."

---

## Slide 2 — The structural lane (the wedge)

**Headline:**
> Three layers of the AI tax stack. We're the third.

**Three-column visual:**

| Layer | Who's there | What they do |
|---|---|---|
| **Data layer** | K1x ($175M, Apr 2026) | K-1/1099 ingestion. Sells to top-100 firms. We integrate. |
| **Return-prep agent layer** | Accrual ($75M), Black Ore ($60M), Basis ($1.15B valuation), TaxGPT, Soraban | Autonomous return prep. Sells to Big-4 + top-100 with in-house counsel. We orchestrate (Path 2). |
| **Practice + relationship layer** | **Empty for AI-native.** PM incumbents ship shallow AI bolt-ons (TaxDome, Canopy, Karbon). | **Docket's structural lane.** |

**Sub-line:**
> *The funded competitors are economically forced up-market by their unit economics + 18-month enterprise sales cycles. The third layer at the down + mid-market segment is open. ~80K firms in segment. Zero AI-native competitors.*

**Speaker notes:**
> "Three structural layers of the AI tax stack are forming. Data layer is K1x — they integrate, we don't compete. Return-prep agent layer is where $235M+ in funding went — they target top-100 firms whose in-house counsel handles compliance. We can't compete head-on. But the third layer — practice and relationship — is empty for AI-native, and the PM incumbents ship shallow features on aging substrates. That's our lane. And the funded competitors can't reach into it for at least 12-18 months without breaking their unit economics."

---

## Slide 3 — Why now (the three forces)

**Headline:**
> Three forces converged in the last 12 months.

**Three-row visual:**

1. **Claude / GPT-5 class models** can finally read tax authority + draft positions with citations at preparer-grade quality. The compliance-first frame becomes possible because the AI can show its work.
2. **IRS AI audit infrastructure rolled out in 2025-2026.** Small-firm audits accelerated. Knock-and-Talk preparer-due-diligence enforcement is now real.
3. **ChatGPT-armed clients** walk into every EA's office with confidently wrong tax answers. The EA's job changed in 18 months.

**Sub-line:**
> *Result: 700,000+ EAs and CPAs in the down + mid-market are squeezed by AI-armed clients + AI-armed regulators + unservable by funded competitors. Docket is the only AI built for them.*

**Speaker notes:**
> "Three forces. AI models got good enough to cite authority. The IRS started auditing with AI. And every EA's clients walk in with ChatGPT in hand quoting wrong answers. The EA's job changed in 18 months, and the AI tools that took the funding are all serving someone else. We're the only AI built for the squeezed middle."

---

## Slide 4 — Founders

**Headline:**
> Two co-founders + on-platform tax advisor with equity + contracted backup pipeline.

**Three-column layout:**

**David Kim, CEO**
- Legal: Minseo Kim
- UCR CS
- Prior: [add specifics]
- Runs CEO + product + customer development + Antonio relationship
- [LinkedIn URL]

**Haokun Yang, CTO**
- Technical co-founder, 5+ year partnership with David pre-Docket
- UCR CS
- Owns codebase end-to-end: 13-table Drizzle schema with RLS, per-tenant DEK encryption with AAD binding, cryptographic audit chain with nightly tamper verifier, agent fleet, two Next.js apps in production
- [LinkedIn URL]

**Antonio Vazquez, EA** — On-platform tax advisor (1% equity)
- Vazant Consulting, Montclair CA
- 25-year EA practice, 200+ active clients
- Defending two active 2026 IRS audits using Docket's audit defense workspace
- Every Position Library entry routes through Antonio's sign-off
- Latino Tax Pro segment; bilingual

**Speaker notes:**
> "We're a real team. David on CEO + product. Haokun on CTO + codebase — 5-year working relationship before Docket, partner since inception, owns the substrate end-to-end. And critically: Antonio Vazquez, EA, our on-platform tax advisor — 25 years in practice, 200+ active clients, holds 1% equity. Every position our AI surfaces routes through Antonio's sign-off. That's the structural answer to 'who validates the tax claims your AI makes.' It's not an open co-founder seat — it's a 25-year EA with equity in the company."

---

## Slide 5 — Substrate (the year of work already done)

**Headline:**
> A year of substrate work most pre-revenue applicants don't have.

**Two-column layout:**

**Left — "What's live in PROD"**
- **28 migrations applied to PROD** (0026 + 0027 confirmed via Vercel-pulled `DATABASE_URL` 2026-05-11)
- **RLS at `ENABLE + FORCE`** on every tenant-scoped table
- **Per-tenant DEK encryption** (AES-256-GCM, AAD-bound to `(tenant_id, client_id, path)`); 34/34 tests
- **Cryptographic audit chain** (chain_seq + prev_hash + row_hash); nightly tamper verifier
- **Bedrock fallback at orchestrator** (38/38 unit + 4/4 smoke); CI-verified
- **Webhook signature verification** (32/32 tests)
- **PII regex scrubber** (32 tests)
- **/e2e PASS 8/8** at $0.012/run, 16s wall-clock, against real Anthropic + Bedrock + Neon + R2

**Right — "Operational discipline"**
- **Codex review enforced** on every feat/fix commit (no `Codex-Reviewed: N/A` escape)
- **/score ≥95** + **/align ALIGNED** + **/craft PASS** trailers required at commit time
- **Compliance-Check trailer** ≥80 chars per commit ("did I do what I was supposed to do?")
- **Protocol-Skip mechanism** auditable forever via `docs/protocol-skips.jsonl`
- **/e2e cadence enforcement** (WARN ≥3 commits, BLOCK ≥6 commits since last pass)
- **Codebase knowledge graph audit 2026-05-11**: 1,038 nodes / 1,182 edges / 10 architectural layers
- **12-doc SOC 2 Type II policy set** in codebase (Drata/Vanta attestation deferred until capital — controls already built)

**Speaker notes:**
> "What we've shipped. 28 production migrations. Full encryption stack with AAD binding. Cryptographic audit chain with nightly tamper verification. Bedrock fallback CI-tested. End-to-end PASS 8 of 8 at one cent per run. That's not slideware. That's the codebase. We audited it ourselves last week — 1,038 nodes, 1,182 edges, 10 architectural layers. The 12-doc SOC 2 policy set is already in `docs/security/`. We didn't build the marketing first — we built the substrate first."

---

## Slide 6 — Antonio (the customer evidence)

**Headline:**
> $1K/mo MRR. Real customer. Real audits. Real-time validation.

**Two-column layout:**

**Left:**
- **Founding design partner**: Antonio Vazquez, EA. Vazant Consulting, Montclair CA. 25-year practice. 200+ active clients.
- **Paying customer**: $1K/mo MRR (founder tier with add-ons). Equity advisor (1%).
- **Real-time pressure test**: Antonio is currently defending **two active 2026 IRS audits** using Docket's audit defense workspace. Every position on those returns lives in a file with IRC cite + Treas Reg + controlling case + 8275 if needed.
- **Two P0 bugs from 5/9 Antonio call shipped within 48 hours** (`faaa579` entity-filing W2 skip + `9975978` portal/docs Take-photo wire-up + `961857b` dev-server unblocker). That's the operating tempo against real customer pressure.

**Right:**
- **Distribution unlock**: Antonio's mentor, **Dr. Jasmine Boney-Henderson**, runs a 1000+ preparer reseller network. Group presentation scheduled to that network.
- **Field research**: 5 EAs (CA, FL, TX) validated mental-load-first design constraint. The L9 lock (NO AI-as-chat-character) came directly from this work.
- **20-EA/CPA validation sprint in flight** (next 2 weeks): paid Discovery Scan offers. Best 3 quotes feed the YC application + the EA-CPA sales deck.

**Speaker notes:**
> "Antonio is real. Paying $1,000 a month. 200-plus clients on the platform. Defending two IRS audits using our audit defense workspace right now. When the 5/9 audit-prep call surfaced two P0 bugs in the intake flow and the docs upload — we shipped both fixes within 48 hours plus an unrelated dev-server unblocker. That's the operating tempo. The mentor network gives us 1,000+ preparer distribution. The 20-EA validation sprint runs over the next two weeks."

---

## Slide 7 — The compliance moat (the defensible structural advantage)

**Headline:**
> The only AI built for the side of the desk where personal PTIN risk lives.

**Top half — the problem the funded competitors can't solve:**

EAs and small-firm CPAs **personally carry every preparer penalty** that lives on a return they sign. The funded AI tax tools (Accrual $75M, Black Ore $60M, Basis $1.15B valuation) targeted Big-4 firms where in-house counsel handles compliance. **They can market "find every deduction" because someone else carries the PTIN.** EAs cannot adopt those tools.

**Bottom half — what Docket ships:**

1. **Position Framework**: every position surfaced carries an IRC cite + tier classification (Settled / Substantial Authority / Reasonable Basis with 8275 / More Likely Than Not) + a refusal floor below Reasonable Basis. Captured at decision time.
2. **Coverage Map published transparently** at `docs/COVERAGE-MAP.md`: 5-layer Minimum-Viable Shield + 4-tier classification (Algorithmic 100% / Pattern Industry-Best / Judgment Cited-Support / External Honest-About-Limits) + explicit out-of-scope disclosure. The honest-by-design positioning move.
3. **Audit defense file** generated as a side effect of normal use. Workpaper exists before the auditor asks for it.
4. **The Antonio + contracted-advisor sign-off chain** behind every Position Library entry. AI doesn't ship a position to a return; a 25-year EA with equity does.

**Sub-line:**
> *Pricing math: §6695(g) is $650/failure for 2026 returns. Docket founder tier is $250/mo. Less than half of one penalty.*

**Speaker notes:**
> "This is the structural moat. Big-4-targeted tools can market 'find every deduction' because someone else carries the PTIN. We can't market that — and that's why we're the only tool buyable for the down + mid-market. Every position cites primary authority. Every position has a confidence tier. Every position above Reasonable Basis goes through; everything below refuses. Coverage Map is published — we tell buyers exactly what we catch and what we don't. The audit defense file generates as a side effect. And every Position Library entry routes through Antonio's sign-off before it ships."

---

## Slide 8 — Pricing math + unit economics

**Headline:**
> Priced below the penalty surface. Margin path is the L7 lock.

**Top half — pricing tiers (locked per L6):**

| Tier | Price | Included | Notes |
|---|---|---|---|
| **Founder** (first 50 firms, year 1 only) | $250/mo | All agents included | 30% lifetime discount on year-2 standard reversion |
| **Solo** | $499/mo | 50 active clients (+$5/active over) | Cap $749/mo |
| **Small** | $1,499/mo | 150 + $5/active | Cap $1,999/mo |
| **Growing** | $4,499/mo | 500 + $4/active | Cap $5,499/mo |
| **Mid-market** | $14,999/mo | 2,000 + $3/active | Cap $23,999/mo |
| **API tier (Path 2)** | Dev free / Partner $999 / Platform custom | | Public API + MCP in v1 |

**Bottom half — unit economics (locked per L7):**
- **Per-active-client cost target**: $1.39/mo (heavy $4.30 / medium $1.35 / light $0.22)
- **At 200 clients per firm**: ~$278/mo infrastructure cost
- **Drives 80%+ gross margin at peak tier usage**
- **TAM Path 1 floor**: $25-50M ARR at 5-15% segment penetration of ~80K-firm segment
- **TAM Path 2 swing**: orchestration economics resemble Stripe-for-tax-AI; $10M+ ARR Year-3, $50-200M ARR Year-5 if Path 2 lands

**Speaker notes:**
> "Founder tier is $250 a month — less than half the $650 §6695(g) penalty per failure for 2026 returns. The price isn't aggressive; it's the only honest price for a system whose job is preventing that penalty surface continuously. Per-active-client cost target is $1.39 a month — that's the L7 lock. Gross margin lands at 80-plus percent at peak tier. Path 1 vertical SaaS floor alone is $25-50M ARR. Path 2 orchestration is the swing — Stripe-for-tax-AI economics — and that's the unicorn case."

---

## Slide 9 — Path 2 (the swing)

**Headline:**
> Public API + MCP server ship in v1. Not v1.5.

**Visual: architecture diagram of layers**

```
┌─ Path 1 (the floor): vertical SaaS for solo + small + mid-market firms ─┐
│                                                                          │
│  ↑ Path 2 (the swing): public API + MCP server                          │
│                                                                          │
│  Other AI tax tools integrate via Docket's compliance + audit substrate │
│  Tax software vendors plug in at scale                                  │
│  Docket becomes the substrate the entire AI tax stack runs through      │
└──────────────────────────────────────────────────────────────────────────┘
```

**Right column — the L1 lock language (per CLAUDE.md):**

- v1 (now → 7/30): MCP server live as deployable artifact; public API documented + reachable; partner onboarding by direct intro
- v1.5 (8/1 → 12/31): self-serve API tier with billing infrastructure
- Year 3: 5-15 Partner-tier customers paying $999/mo or Platform-tier custom contracts
- Year 5: orchestration revenue $50M+ ARR if Path 2 lands as expected

**Sub-line:**
> *L1 commits to API + MCP as DEPLOYABLE in v1. Self-serve billing is v1.5. Honest scope distinction — not over-claimed during application.*

**Speaker notes:**
> "Path 2 is the unicorn case. Public API + MCP server in v1. We split the scope honestly: v1 means the API exists and partners can integrate by direct intro; v1.5 adds self-serve billing. The bet: other AI tax tools embed Docket's compliance reasoning into their workflows. Tax software vendors plug in. Docket becomes the substrate the entire AI tax stack runs through. Vertical SaaS is the floor — $25-50M ARR. Path 2 is the swing — orchestration economics resemble Stripe-for-tax-AI."

---

## Slide 10 — Distribution + go-to-market

**Headline:**
> Three channels. All inbound or warm.

**Three-column visual:**

**Channel 1: Antonio's network → Dr. Boney-Henderson's network**
- 1000+ preparer reseller network
- Group presentation scheduled
- Warm-intro at scale; existing relationships drive purchases

**Channel 2: NAEA + Tax Pro Forum + r/taxpros**
- NAEA chapter dinners (50-150 EAs per touch, $3-8K sponsor fee per event)
- Tax Pro Forum (NATP) annual conference
- r/taxpros (16K members) earned-media via high-signal content

**Channel 3: Free Discovery Scan as cold lead magnet**
- Send last 3 years' tax-software export
- Get back PDF report listing missed deductions with cited authority + estimated $ value
- 24-hour turnaround
- Converts on the dollar figure it produces (Hormozi-style anchor)

**Sub-line:**
> *Year 2: AICPA Startup Accelerator 2027 cohort (Q1 2027) + AICPA ENGAGE (Jun 2027) for mid-market firm visibility.*

**Speaker notes:**
> "Three channels. Antonio's mentor commands a 1,000-preparer network — that's the warm-intro at scale. NAEA chapter dinners and Tax Pro Forum are the in-person trust-building channels. Free Discovery Scan is the cold lead magnet — we run a 24-hour scan on someone's last 3 years of returns, give them a PDF with cited dollar amounts they missed. The dollar figure closes the call. AICPA ENGAGE in June 2027 unlocks mid-market visibility for partner #3 onward."

---

## Slide 11 — Risks + mitigations

**Headline:**
> Honest about what could break.

**Three-row table:**

| Risk | Mitigation | Status |
|---|---|---|
| **Antonio dependency** (single design partner, currently in 2 IRS audits) | L14 lock: partner #2 within 90 days from different segment + different network. 20-EA sprint surfaces candidates. AICPA + Boney-Henderson networks. | In flight |
| **Position Library validation at scale** (one EA can't review thousands of positions alone) | Contracted backup advisor pipeline ($200-400/hr from AICPA + NAEA per `docs/CONTRACTED-EXPERT-OUTREACH.md`). Antonio + advisors sign every position. Coverage Map publishes scope. | Outreach this week |
| **Mid-market sales gated by SOC 2 Type II** (12-month audit period; can't land mid-market 2027 without bridge) | SOC 2 Type I attestation Q4 2026 ($15-25K Drata or Vanta engagement per `docs/SOC2-TYPE-I-OUTREACH.md`). Bridges to Type II mid-2027. | Outreach this week |
| **Solo founder bandwidth ceiling** (two-co-founder team + advisor pipeline; Engineer #3 is the next leverage point) | YC capital funds Engineer #3 hire + 12 months runway. Phase 4-6 v1 build benefits most. | YC capital primary use |

**Speaker notes:**
> "Four risks we're tracking. Antonio's a single design partner — L14 commits us to partner #2 within 90 days, off his network. The Position Library validation can't run on one EA forever — contracted backup advisors at $200-400 per hour from AICPA and NAEA networks; outreach starts this week. Mid-market 2027 sales gates on SOC 2 — we're scoping Drata for a Type I attestation Q4 2026 to bridge to Type II mid-2027. And we're a two-founder team — Engineer #3 is the most-leveraged use of YC capital, frees David and Haokun from solo-founder bandwidth on Phase 4-6 of v1."

---

## Slide 12 — The ask

**Headline:**
> $500K SAFE on standard YC terms.

**Use of funds breakdown:**

| Use | $ | What |
|---|---|---|
| Engineer #3 hire | $150K | First-12-months loaded comp; frees David + Haokun from bandwidth ceiling on Phase 4-6 v1 |
| Contracted tax-advisor pipeline | $25K | Year-1 backup advisor budget ($200-400/hr × 5-10 hrs/wk) for Position Library scale-validation |
| Cyber + Tech E&O insurance | $4K | Tech E&O + Cyber bundle with AI-affirmative rider, $1M aggregate (Vouch or Embroker per `docs/CYBER-INSURANCE-RECOMMENDATION.md`) |
| SOC 2 Type I bridge engagement | $25K | Q4 2026 Drata + audit-firm engagement per `docs/SOC2-TYPE-I-OUTREACH.md` |
| Antonio + partner #2 production infrastructure | $40K | 12-month Vercel Pro + Neon Launch + R2 + Inngest + Sentry + Twilio + Anthropic + AWS Bedrock |
| Sales + marketing | $50K | Discovery Scan landing + NAEA chapter sponsorships + LinkedIn Sales Navigator + r/taxpros earned media |
| Legal + ToS + DPA + tax-attorney advisory | $25K | ToS + DPA + AUP draft + tax-law-aware attorney for marketing-claim review |
| Runway + reserve | $181K | 6-month buffer + partner #2 sales-cycle variability |

**What we'd specifically use YC for beyond capital:**
- **YC partner network** for Engineer #3 hire + partner #2 (regional CPA firm) sales-cycle iteration
- **YC AI portfolio companies** as Path 2 integration partner-tier candidates
- **Demo Day** to present the operating-system framing + Path 2 thesis to YC investor audience
- **Post-batch network** for Series A path

**Speaker notes:**
> "Five hundred thousand on standard YC terms. Engineer #3 hire is the biggest line item — frees David and Haokun from bandwidth on the Phase 4-6 v1 build. Contracted tax advisor pipeline funds Position Library scale-validation. Cyber insurance and SOC 2 Type I bridge get the compliance posture ready for mid-market 2027 sales. Beyond capital: YC partner network for engineer hire and partner #2 sales cycle. YC AI portfolio companies as Path 2 integration partners. Demo Day for investor visibility. Series A path post-batch."

---

## Appendix slides (have ready, don't show unless asked)

### A1 — Competitive map

| Competitor | Funding | Target | Where they hurt |
|---|---|---|---|
| Black Ore Tax Autopilot | $60M (Apr 2026 GA) | Top-25 firms with in-house counsel | Can't market loophole-finder to PTIN-carrying preparers |
| Accrual | $75M (Feb 2026) | Larger firms federal + state prep | No orchestration play; no compliance-first frame |
| Basis | $1.15B valuation (Feb 2026) | Very large firms long-horizon agents | Way upmarket; no down-market reach |
| TaxGPT (Andrew) | Public | Browser automation against tax software | Generalist; no Position Framework depth |
| Instead | Series A | AI tax planning + filing for HNW consumers | Consumer-side; we're firm-side |
| TaxDome / Canopy / Karbon | PM incumbents | Practice management with shallow AI | Aging substrate; AI is bolt-on, not native |
| Practiq | Multi-vertical | Boutique professional services workspace | Generic; we're tax-vertical specialist |

### A2 — Coverage Map (link to `docs/COVERAGE-MAP.md`)

20-position v1 Position Library list + full surface matrix + 4-tier classification. The honest-by-design positioning move that no competitor does.

### A3 — Operating system architecture

```
┌─ Knowledge layer ──────────────────────────────────────┐
│  Tax authority graph + position library + Antonio +    │
│  contracted advisor sign-off chain                     │
├─ Orchestration layer ───────────────────────────────────┤
│  runDocketAgent: Anthropic + Bedrock fallback +        │
│  cost telemetry + audit hook + model tiering           │
├─ Rules layer ───────────────────────────────────────────┤
│  Deterministic calculators OUTSIDE the LLM             │
├─ Trust layer ───────────────────────────────────────────┤
│  Position Framework: cite + tier + 8275 + refusal floor│
├─ Data layer ────────────────────────────────────────────┤
│  Neon Postgres + RLS + per-tenant DEK + audit chain   │
└──────────────────────────────────────────────────────────┘
```

### A4 — Production deployments

- `apps/client-portal` → `https://docket-portal.vercel.app` (mobile-first taxpayer portal, 38-route intake flow)
- `apps/command-room` → Vercel-assigned hostname (preparer pane, operational-modern visual language)
- 12-doc SOC 2 Type II policy set at `docs/security/`

### A5 — Why this is unicorn-shaped

| Path | Year-3 ARR | Year-5 ARR | What it is |
|---|---|---|---|
| Path 1 (vertical SaaS floor) | $10-15M | $25-50M | 5-15% penetration of ~80K-firm segment with tiered pricing |
| Path 2 (orchestration platform) | $5-10M | $50-200M | Other AI tax tools embed Docket's compliance + audit substrate |
| **Combined upside** | $15-25M | $75-250M | Vertical SaaS funded by floor; orchestration as the swing |

---

## Discipline notes for David before any YC interview

- **Practice partners' likely questions**: "What if Antonio churns?" "Why is your tax-domain depth not a co-founder?" "Why $250/mo and not $999/mo?" "What's the YC competitor risk?" Rehearse cold answers.
- **Numbers must be precise**: $1K/mo MRR (not "low thousands"). $650/failure (not "around $600"). 1,038 nodes (not "around a thousand"). YC partners catch sloppy numbers.
- **Antonio is real, on platform, with two audits in flight** — repeat that 3x during 10-min interview. It's the proof point.
- **Path 2 distinction**: deployable in v1, self-serve billing in v1.5. If a partner challenges scope, this is the honest answer — don't oversell.
- **Speaking pace**: 10-min interview means you talk for ~7 minutes total. Practice each slide spoken in <45 sec.

---

*Created 2026-05-11. Use only if invited to YC interview. Update with Antonio's 6/15 first-Discovery-Scan output (real $ figure of missed deductions on his book) when available — that's the headline traction number for the interview.*
