# Path 2 Partner Deck

> *For other AI tax tool companies integrating via Petal's public API + MCP server.*
> *Lead framing per Option B: **the compliance + audit substrate for the AI tax stack**. Technical, infrastructure-language audience.*
> *Target: 10 slides, 15-min technical conversation. Developer-to-developer, not sales-to-buyer.*

---

## Slide 1 — Title

**Headline:**
> **Petal**
> **The compliance + audit substrate for the AI tax stack.**

**Sub-headline:**
> Public API + MCP server. Embed Position Framework + cited authority + audit chain into your AI tax product.

**Footer:**
- David Kim, CEO · minseodavid@gmail.com
- Haokun Yang, CTO
- Developer docs: docs.petal.tax (when public)
- MCP server: mcp.petal.tax (when public)

**Visual:** technical-architecture diagram-style background. Forest green primary. Minimal text. Developer audience.

**Speaker notes:**
> "Petal is the compliance and audit substrate for the AI tax stack. We ship a public API and an MCP server. The bet: other AI tax tools embed our compliance reasoning into their workflows. Tax software vendors integrate at scale. Petal becomes the layer of plumbing the entire AI tax stack runs through."

---

## Slide 2 — Why you need this

**Headline:**
> Your AI tax tool ships "find every deduction." Your buyers' PTIN carries the risk.

**Three-bullet problem statement:**

1. **Your buyers are EAs and small-firm CPAs.** Every position your AI surfaces lands on a return their personal PTIN signs. The §6695(g) due-diligence penalty is **$650 per failure** for 2026 returns (per Rev. Proc. 2025-32). The §6694 understatement penalty is $1,000-$5,000.
2. **Your AI doesn't carry the compliance layer.** Even if your AI is technically accurate, your buyers' professional responsibility means every position needs cited authority + tier classification + 8275 disclosure trigger + audit defense file. You don't have that. We do.
3. **Your agent E&O insurance carrier explicitly disclaims coverage on positions surfaced via licensed or embedded tech-vendor tools.** When your AI surfaces a position that causes a customer audit, the agent E&O carrier argues "tech vendor, not preparer judgment." Your customer is in a coverage gap.

**Sub-line:**
> *Petal is the layer that closes the gap. Embed Position Framework + cited authority + audit chain via our public API or MCP server. Your customers' PTIN risk is contractually bounded.*

**Speaker notes:**
> "Three things your AI tax tool is missing. One: your buyers' PTIN carries the penalty risk. Two: your AI doesn't carry the compliance layer — every position needs cited authority and tier classification and 8275 trigger. Three: your customer's E&O carrier disclaims coverage on tech-vendor tools. You're in a coverage gap. Petal closes it."

---

## Slide 3 — What Petal exposes via API

**Headline:**
> Five primitives via public API + MCP server.

**Table:**

| API surface | What it does | Endpoint / Tool |
|---|---|---|
| **Position classification** | Submit a position + facts. Returns tier (Settled / Substantial Authority / Reasonable Basis with 8275 / More Likely Than Not) + IRC + Treas Reg + controlling case + 8275 trigger flag. | `POST /v1/positions/classify` · MCP tool `classify_position` |
| **Cited authority lookup** | Submit an IRC section or tax concept. Returns primary-authority chain + effective-date versioning + override history. | `GET /v1/authority/{ref}` · MCP tool `lookup_authority` |
| **Audit chain write** | Submit an action (position taken, document filed, position refused). Returns cryptographic-chain entry with prev_hash + row_hash + chain_seq. | `POST /v1/actions` · MCP tool `record_action` |
| **Coverage Map query** | Submit a tax surface (form, IRC section, state). Returns Petal's coverage status (Live / Pending / Out-of-Scope) + tier + reviewer. | `GET /v1/coverage/{surface}` · MCP tool `query_coverage` |
| **8275 disclosure draft** | Submit a Tier-3 position. Returns draft 8275 / 8275-R disclosure language + attachment-ready format. | `POST /v1/disclosures/8275/draft` · MCP tool `draft_8275` |

**Sub-line:**
> *Authentication: Bearer JWT tied to Partner-tier subscription. Rate-limit at 1,000 calls/sec per partner. Latency target: 95th percentile < 500ms for all endpoints.*

**Speaker notes:**
> "Five primitives via REST API and MCP server. Position classification — you submit position + facts, we return tier + cited authority + 8275 trigger. Cited authority lookup. Audit chain write — your AI's actions land in our cryptographic chain. Coverage Map query — programmatic access to what we cover. 8275 draft. Authentication is bearer JWT tied to Partner-tier subscription. Rate-limit 1,000 calls per second per partner. Latency 95th percentile under 500ms."

---

## Slide 4 — Integration patterns (how partners use this)

**Headline:**
> Three integration patterns. Each ships in a sprint.

**Three-column layout:**

**Pattern A: Behind-the-scenes compliance layer**
- Your AI surfaces a position to a customer
- Before showing it, call `POST /v1/positions/classify` with the position + facts
- Display tier + cited authority in your UI
- Refuse position if it falls below Reasonable Basis (we return `403 BELOW_REASONABLE_BASIS`)
- Audit-chain the decision via `POST /v1/actions`
- **Build time: ~1 sprint (2 weeks).** Your customer's PTIN is contractually defended.

**Pattern B: White-label Position Framework**
- License the Position Library as a content layer behind your UI
- Display tier classifications + cited authority directly in your product
- Your AI surfaces positions; we provide the classification + authority + 8275 trigger
- White-label terms: revenue share or flat-rate license
- **Build time: ~2-3 sprints.** Your product becomes compliance-first overnight.

**Pattern C: Full audit-defense workspace**
- Embed our audit defense workspace as a tab in your UI (via iframe or whitelabeled component)
- When your customer is in an IRS audit, the workspace populates with every action they took in your product (via audit-chain API)
- We provide the workpaper format + IRC cite + 8275 retrieval
- **Build time: ~3-4 sprints.** Your customer has an audit defense file populated by their work in your product.

**Speaker notes:**
> "Three integration patterns. Pattern A is behind-the-scenes — your AI calls our classification API before surfacing a position, displays the tier and authority, refuses below Reasonable Basis. One sprint. Pattern B is white-label — license our Position Library as a content layer in your UI. Two to three sprints. Pattern C is full audit defense — embed our workspace as a tab in your product, populates from your customer's actions via our audit-chain API. Three to four sprints. Each pattern is a separate level of depth."

---

## Slide 5 — Architecture (technical credibility)

**Headline:**
> The substrate behind the API.

**Architecture diagram:**

```
┌─ Knowledge layer ─────────────────────────────────────────┐
│  Position Library: 20 v1 positions + cited authority +    │
│  tier classification + Antonio's sign-off chain           │
│  Coverage Map: 4-tier classification + 5-layer Shield     │
├─ Orchestration layer ─────────────────────────────────────┤
│  Anthropic + AWS Bedrock fallback (CI-tested 38/38 unit + │
│  4/4 smoke) · prompt caching · cost telemetry · audit hook│
├─ Rules layer ─────────────────────────────────────────────┤
│  Deterministic calculators OUTSIDE the LLM:               │
│  tax math, threshold/phaseout, form mapping               │
├─ Trust layer ─────────────────────────────────────────────┤
│  Position Framework refusal floor below Reasonable Basis  │
│  Per-tenant × agent × action-class trust gates            │
├─ Data layer ──────────────────────────────────────────────┤
│  Postgres + pgvector + per-tenant DEK encryption          │
│  Cryptographic audit chain + nightly tamper verifier      │
│  RLS at ENABLE+FORCE; tenant data cannot cross           │
└────────────────────────────────────────────────────────────┘
```

**Sub-line:**
> *Codebase knowledge graph (audit 2026-05-11): **1,038 nodes / 1,182 edges / 10 architectural layers** across 487 analyzed source files. /e2e PASS 8/8 at $0.012/run. 28 migrations live in PROD. 12-doc SOC 2 Type II policy set in `docs/security/`.*

**Speaker notes:**
> "The substrate behind the API. Five layers — Knowledge, Orchestration, Rules, Trust, Data. The Knowledge layer has the Position Library and Coverage Map; the Orchestration layer wraps Anthropic with Bedrock fallback for vendor resilience; the Rules layer keeps deterministic tax math outside the LLM; the Trust layer enforces the refusal floor; the Data layer has per-tenant encryption and the audit chain. We audited the codebase last week — 1,038 nodes, 1,182 edges, 10 layers. End-to-end PASS 8 of 8 at a cent per run. 12-doc SOC 2 Type II policy set already documented."

---

## Slide 6 — Compliance + audit posture (your customers' due-diligence-ready)

**Headline:**
> SOC 2 Type II controls in codebase. Type I attestation Q4 2026, Type II mid-2027.

**Top half — the security posture:**

| Control | Status |
|---|---|
| Per-tenant data encryption (AES-256-GCM with AAD binding) | ✅ Live |
| RLS at `ENABLE + FORCE` on every tenant-scoped table | ✅ Live |
| Cryptographic audit chain + nightly tamper verifier | ✅ Live |
| MFA via Clerk | ✅ Live |
| HTTPS everywhere + TLS 1.3 | ✅ Live |
| Webhook signature verification | ✅ Live |
| PII regex scrubber | ✅ Live |
| 12-doc SOC 2 Type II policy set | ✅ Live in `docs/security/` |
| **SOC 2 Type I attestation** | 🚧 Q4 2026 |
| **SOC 2 Type II attestation** | 🚧 Mid-2027 |
| Cyber + Tech E&O + AI-affirmative insurance | 🚧 Binding before 2026-05-30 |

**Bottom half — what partners get:**

- **Partner-level data isolation**: your customers' positions, classifications, and audit-chain entries live in tenant-scoped storage with per-tenant DEK encryption. Your data cannot cross to another partner's data, ever.
- **Audit-chain transparency**: every position classification + every authority lookup + every 8275 draft you request via our API is itself audit-chained. You have access to the chain entries for your account.
- **Coverage Map transparency**: published at `docs/COVERAGE-MAP.md`. Your engineering team can read it today; your legal team can use it to bound liability claims in your contracts.

**Speaker notes:**
> "Security posture you can read today. Per-tenant data encryption with AAD binding. RLS forced at the database level. Cryptographic audit chain. MFA. 12-doc SOC 2 policy set already in the codebase. Type I attestation Q4 2026 bridges to Type II mid-2027. Cyber and Tech E&O insurance binding before 5/30. Partner-level data isolation — your customers' positions live in tenant-scoped storage with per-tenant encryption keys; data cannot cross to another partner. Audit-chain transparency — every API call you make is itself audit-chained and accessible to you. Coverage Map published transparently — your engineering team reads it today, your legal team uses it to bound liability."

---

## Slide 7 — Pricing

**Headline:**
> Three Partner tiers. Developer free. Production starts at $999/mo.

**Pricing table:**

| Tier | Price | Calls/mo | Overage | Best for |
|---|---|---|---|---|
| **Developer** | Free | 1,000 calls/mo | $0.005/call over | Hobbyists + evaluators + integration testing |
| **Partner** | $999/mo | 1,000,000 calls/mo | $0.001/call over | Production AI tax tools embedding via API or MCP |
| **Platform** | Custom | Custom | Custom | Tax software vendors integrating at scale (50M+ calls/mo) |

**Per-call cost economics for partners:**

- Partner tier base: $999/mo for 1M calls = **$0.001 per call**
- Overage: $0.001 per call
- At 1M calls/mo, that's roughly 30K-50K positions classified, 50K-100K authority lookups, 100K-200K audit-chain writes

**Sub-line:**
> *Self-serve billing ships v1.5 (8/1/2026 → 12/31/2026). v1 partner onboarding is direct-intro only. Volume discounts at Platform tier negotiated case-by-case.*

**Speaker notes:**
> "Three tiers. Developer is free up to a thousand calls a month — that's for hobbyists, evaluators, integration testing. Partner is $999 a month for a million calls — that's $0.001 per call at base, $0.001 per call over. Platform is custom for tax software vendors integrating at scale, 50 million plus calls a month. v1 partner onboarding is by direct intro; self-serve billing ships v1.5 in late 2026."

---

## Slide 8 — Use cases (concrete partner examples)

**Headline:**
> Three real partner scenarios.

**Three-column layout:**

**Use case A: TaxGPT or generalist AI tax tool**
- Your AI surfaces a position to a customer EA
- Before display, call `POST /v1/positions/classify`
- Display the tier + cited authority directly in your product UI
- If the position is below Reasonable Basis, refuse + suggest the next-tier alternative
- Audit-chain the customer's action via `POST /v1/actions`
- **Result**: your customer's PTIN risk drops; your product becomes compliance-first; your competitors can't match this without rebuilding the compliance layer.

**Use case B: Soraban or vertical-AI accounting workflow tool**
- Embed `query_coverage` MCP tool in your AI's workflow
- Before your AI takes an action, query whether the action falls in Petal's covered scope
- If covered, route through Petal's classify + record APIs
- If not covered, your AI proceeds with explicit "out of Petal scope, professional judgment required" disclosure
- **Result**: bounded liability for the partner; AI safely confined to Petal's covered territory.

**Use case C: Bloomberg Tax / Checkpoint / CCH AnswerConnect**
- License Petal's Position Library as embedded content
- Display Petal's tier classifications next to your traditional research content
- Your subscribers get the AI defense layer + your editorial depth
- **Result**: incumbent research products stay relevant in an AI world; Petal gets distribution at scale.

**Speaker notes:**
> "Three real scenarios. TaxGPT or any generalist AI tax tool — your AI calls our classification API before surfacing a position, refuses below Reasonable Basis, audit-chains the customer's action. Your customer's PTIN risk drops; your product becomes compliance-first; your competitors can't match without rebuilding the compliance layer. Soraban or vertical-AI tools — query our Coverage Map before your AI takes an action, route through our APIs when in scope, disclose when out of scope. Bounded partner liability. Bloomberg Tax / CCH / Checkpoint — license our Position Library as embedded content alongside your editorial. Incumbent research products stay relevant in an AI world; we get distribution at scale."

---

## Slide 9 — The ask

**Headline:**
> Sign up for Developer tier today. Bridge to Partner by end of integration sprint.

**Three-step onboarding path:**

1. **Today (Developer tier, free)**: register at developer.petal.tax (when public). Get API keys. Hit `POST /v1/positions/classify` with a test position. Confirm latency + response shape match your integration spec.
2. **Week 2-3 (integration sprint)**: pick a pattern (A / B / C from Slide 4). Build the integration against Developer tier with rate-limit headroom for testing.
3. **Production launch (Partner tier, $999/mo)**: upgrade to Partner tier with billing. SLA + support + uptime guarantees activate. Production traffic flows.

**Beyond the API:**

- **Joint marketing**: your product + "Powered by Petal Compliance" badge. Your customers see the trust signal.
- **Co-marketing opportunities**: case studies, joint blog posts, conference panels (AICPA ENGAGE, NAEA Tax Pro Forum).
- **Strategic engagement**: at scale ($25K+/mo API spend), we offer dedicated technical-success engagement + early access to v1.5 features (self-serve billing UI, expanded MCP tools, additional Position Library coverage).

**Speaker notes:**
> "Three steps. Today: sign up for the Developer tier — free up to a thousand calls a month. Get API keys, test the classification endpoint, confirm the response shape works for your integration. Weeks 2-3: integration sprint against one of the three patterns. Production launch: upgrade to Partner tier at $999 a month. Beyond the API: joint marketing with 'Powered by Petal Compliance' badge. Co-marketing case studies. Strategic engagement at $25K+/mo API spend with dedicated technical-success engagement."

---

## Slide 10 — Close + contact

**Headline:**
> Petal. The compliance + audit substrate for the AI tax stack.

**Three contact paths:**
1. **Technical conversation** (developer-to-developer): 30-min call with Haokun + David
2. **Architecture review**: we'll walk through your AI's integration surface + recommend pattern + estimate sprint scope
3. **Developer tier signup**: free, today, no commitment

**Contact:**
- David Kim, CEO · minseodavid@gmail.com
- Haokun Yang, CTO · [email]
- Developer docs: docs.petal.tax (when public)
- MCP server: mcp.petal.tax (when public)
- Repo (private, NDA-gated for serious partner conversations): github.com/minesokim/child-petal

**Speaker notes:**
> "Three ways to take this forward. Technical conversation — 30 minutes with me and Haokun. Architecture review — we'll walk through your AI's surface and recommend an integration pattern with sprint scope. Or just sign up for Developer tier today — free, no commitment. Contact info on the slide. Thank you."

---

## Q&A prep (the four objections that come up partner-side)

### Objection 1: "Why would I send my customers' tax data through your API?"

**Answer:**
> "Per-tenant DEK encryption with AAD binding to (tenant_id, client_id, path) means each of your customers' data lives in a tenant-scoped vault — your data cannot cross another partner's data, and your data is encrypted with a per-tenant key we don't share back. The audit chain entries we generate for your customers' actions are accessible only to you + that customer. We can sign a custom DPA covering your specific data-handling requirements. The model is the same one Stripe runs for payment data — vendor isolates tenant data with per-tenant keys, partner trusts the substrate."

### Objection 2: "What about latency? My AI needs 100ms response times."

**Answer:**
> "95th percentile target for all endpoints is 500ms; production median is 80-150ms for position classification, 50-100ms for authority lookup. If your AI needs sub-100ms, we can run the Position Framework client-side via SDK for cached Settled-tier positions, with falls-through to API for novel positions. Most AI tax tools don't need sub-100ms because the tax-AI workflow doesn't have human-perception latency requirements — but if yours does, talk to Haokun about the SDK approach."

### Objection 3: "What if Petal gets acquired? My integration becomes a liability."

**Answer:**
> "Standard SaaS API contracts have acquisition-continuity clauses — we'd commit to honoring Partner-tier contracts for at least 24 months post-acquisition with no rate increases. The Position Library is licensable separately under our white-label terms (Pattern B from Slide 4) so even if the API surface changes, you can continue using the content layer. We're not planning to be acquired — Path 2 orchestration is the primary path forward — but we're transparent about the option."

### Objection 4: "What if your Position Library is wrong on a position?"

**Answer:**
> "Every Position Library entry is reviewed and signed off by Antonio Vazquez, EA (25-year practice, 1% equity in Petal). Contracted backup advisors from AICPA + NAEA networks provide scale-validation. AI-classified positions live in a draft namespace and never surface through the public API. Every position entry has a `reviewedBy` field with the EA or CPA's name + license number + sign-off timestamp. If a Position Library entry is later overturned (Tax Court, appellate, or IRS guidance change), our contracted-advisor agreements require disclosure and we re-classify within 30 days. You can subscribe to position-change webhooks to get notified."

---

## Discipline notes for David before any Path 2 partner pitch

- **Bring Haokun** if at all possible. Path 2 conversations are developer-to-developer. Haokun's presence shortcuts most technical objections.
- **API documentation URL** (`docs.petal.tax`) needs to be live before any partner conversation. If it's not live, share the markdown source under NDA.
- **MCP server URL** (`mcp.petal.tax`) status: track in `docs/STATE.md`. Update slide deck when public.
- **Live demo**: have a working integration example for at least one of the three patterns (A / B / C from Slide 4) before the first partner pitch. Show it on screen during the call.
- **NDA template**: have a developer-friendly NDA ready to send before sharing repo access or detailed architecture diagrams.
- **Q&A discipline**: tax-domain questions defer to Antonio + 24-hour follow-up. Technical questions Haokun handles in real time. Pricing + contract questions David handles.

---

*Created 2026-05-11. Use for Path 2 partner-tier customer acquisition (other AI tax tools + tax software vendors). Update with first signed Partner-tier contract (target Q3 2026).*
