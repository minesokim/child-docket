# Product Roadmap

> *Every feature, every phase, every defer.*
> *Master reference. Updated as decisions land.*

This doc is the canonical source for what Docket is building, when, and why. It supersedes the v1 phase plan that lived inline in [`CLAUDE.md` §15](../CLAUDE.md). For deeper detail on any specific area, follow the links to companion docs.

---

## 1. Vision (locked 2026-05-08)

**Docket is the closed-loop AI-native operating system for a tax practice.**

Every artifact — every doc, message, transaction, signature, notice, action — gets captured and made queryable. An intelligence layer drafts work continuously: deductions surfaced with cited authority, replies drafted in the EA's voice, positions defended or refused based on confidence tiers, anomalies flagged across the client book. The EA sits at the edge approving outcomes, not routing information. The user composes their own ambient agents (AI Tasks) by typing what they want watched. Every number on every screen hovers to its source artifact. Two channels for clients (portal + text, same data model). Three modes for finding money (Discovery scans the book continuously, Strategy models multi-year scenarios on demand, Position defends or refuses aggressive client requests). Compliance-first: AI never auto-executes a return position above Tier 1, refuses anything below Reasonable Basis, generates the audit defense file as a side effect.

**The marketing handle**: "The closed-loop AI for tax practices. Catches every defensible deduction your team would have caught with unlimited time. Audit trail built in. Every action reversible."

**The framing principle** (from YC AI-native company guidance): AI is not a tool the company uses; it is the substrate the company runs on. Antonio is at the edge guiding outcomes. The intelligence layer is the routing, not human middleware.

---

## 2. The five product pillars

Each pillar is a body of work, not a feature. Ranked by structural moat strength.

### Pillar 1 — Compliance-first deduction surfacing

The position framework. Every deduction or position the AI surfaces is classified into one of four confidence tiers (Settled / Substantial / Reasonable Basis with 8275 / More Likely Than Not), plus a refusal floor below Reasonable Basis. Each surfaces as a structured `TaxPosition` object with cited authority captured at decision time. Three modes: Discovery (continuous, the wedge), Strategy (EA-initiated multi-year modeling), Position (aggressive request → defense or refusal). EA always decides; AI never auto-files above Tier 1. Refusal is a feature.

**Detail**: [`docs/POSITION-FRAMEWORK.md`](POSITION-FRAMEWORK.md)
**Why this is pillar 1**: at the down/mid-market segment, EAs cannot adopt a tool that risks their PTIN. Big-4-targeted competitors sidestep this because in-house tax counsel handles compliance. Nobody at Antonio's segment is building the compliance-first frame.

### Pillar 2 — Ambient operator (closed-loop OS)

The agents act on real client state without a chat surface. Antonio sees a dashboard of "things AI did" + "things needing approval" + "things AI couldn't decide" — never a conversation with a bot. Specialist agents (classify, discovery, inbox-drafter, etc.) are atoms. Users compose molecules via AI Tasks — type a sentence, schedule it, get cited briefs forever.

**Why this is pillar 2**: every other AI-native tax tool ships a chat surface. Yours doesn't. The "OpenClaw, baked in" framing is the design constraint nobody else honors.

### Pillar 3 — AI-native CRM (memory scoped to client + firm)

Every action / doc / message lives on the client record. Six-layer memory model (working, episodic, semantic, procedural, relational, pattern). Cost-optimized via aggressive Anthropic prompt caching. Institutional memory (procedural + pattern layers) becomes a queryable firm asset that compounds over years.

**Detail**: [`docs/MEMORY-ARCHITECTURE.md`](MEMORY-ARCHITECTURE.md)
**Why this is pillar 3**: the EA's 20 years of accumulated wisdom dies when they retire. Docket captures and surfaces it. Switching cost = the EA's career.

### Pillar 4 — Review automation + form filling

Workpapers assembled, positions drafted, multi-state flagged, e-file orchestrated via OLT/ProConnect/UltraTax browser automation. Same lane as Accrual/Black Ore/Basis but Antonio-down-market where they can't afford to play. OLT integration is a structural moat (zero competitors target it).

**Why this is pillar 4**: this is the deliverable that makes Antonio's work-day shorter. Pillars 1-3 surface intelligence; pillar 4 is the action layer.

### Pillar 5 — Multi-channel reachability

Portal mode + Text mode for clients. Telegram/WhatsApp for Antonio's pocket. Same data model across all channels. The operator is reachable from anywhere; the practice runs even when Antonio's not at his desk.

**Why this is pillar 5**: every other tool is desktop-bound. Storefront EAs live on their phones already. Docket meets them where they work, not where the software was built for.

---

## 3. V1 build (now → 7/30/2026, 12 weeks)

**Theme**: prove the closed loop generates revenue.

The wedge: Discovery Scan as the demo artifact. "We found Antonio $X in missed deductions across his book in 24 hours." That number closes deals.

### Foundation (Phase 1, Wks 1-2, 5/2 → 5/16)

✅ Already shipped:
- Doc upload pipeline (working as of 2026-05-08)
- Position framework specification ([`docs/POSITION-FRAMEWORK.md`](POSITION-FRAMEWORK.md))
- Memory architecture specification ([`docs/MEMORY-ARCHITECTURE.md`](MEMORY-ARCHITECTURE.md))
- Production readiness checklist ([`docs/PRODUCTION-READINESS.md`](PRODUCTION-READINESS.md))
- `/smoke-test` skill ([`.claude/skills/smoke-test/SKILL.md`](../.claude/skills/smoke-test/SKILL.md))
- Smoke test framework ([`services/workers/scripts/smoke-finalize.ts`](../services/workers/scripts/smoke-finalize.ts))
- Tonight's audit fixes (P0-P3, finalize pipeline, R2 collision fix, iframe sandbox, OCR bypass)

To ship in Wks 1-2:
- Schema migrations 0019-0021: `firm_profile`, `firm_patterns`, `client_facts`
- Schema migration: `tax_positions`, `disclosure_filings`, `authority_chunks` (pgvector for retrieval)
- Authority library v0: IRC + Treas Regs + IRS Pubs (current + 3 prior years) + CA FTB pubs + Legal Rulings + Residency Manual
- Position library seed: 50 highest-leverage positions hand-curated, classified, with authority links
- Bedrock fallback in `runDocketAgent` (vendor resilience)
- Sentry DSN configured
- Webhook signature verification helper (DocuSign / Square / Twilio / Inngest)
- Staging environment (Neon branch + R2 bucket + Vercel preview)
- Test fixtures package (`packages/test-fixtures/`)
- Preparer-side SSN/EIN reveal (the highest-leverage gap on command-room today)
- Twilio "Send via SMS" invite flow
- Sidebar dead links resolved (`/messages`, `/documents`, `/settings` placeholder routes)
- Citation hover infrastructure (tooltip on every dollar value, sourced from artifact)

### Antonio production sub-milestone (Phase 2, Wks 3-4, 5/16 → 5/30)

The 5/30 deadline: Antonio's full 200+ client base operational on production-grade substrate.

- Real bidirectional messages (Twilio SMS + Gmail email + portal chat, channel-aware via Inbox Drafter agent)
- Square Checkout API integration (per-client payment links, webhook for paid status)
- DocuSign embedded signing for Form 8879 with LexisNexis KBA (NIST IAL2)
- Cross-channel artifact capture (every channel writes to `actions` rows tied to clients)
- Context assembler with 5 agent recipes (inbox-drafter, discovery, position, pre-signature, strategy)
- Aggressive prompt caching wired (cache markers at static/dynamic boundary in every agent call)
- Fact extraction on artifact write (background Inngest job → `client_facts` rows)
- AAD on AES-GCM bound to (tenant_id, client_id, path)
- KEK rotation procedure documented + master-KEK fallback removed
- Sentry signup + DSN configured
- Status-aware UX banner subscribed to `/api/health`
- Async-first audit on every server action (no synchronous Anthropic calls except pre-signature checklist)
- Trust gate enforcement code at the position-tier level
- DB write-failure → read-only mode

### Agent fleet build-out (Phase 3, Wks 5-6, 5/30 → 6/13)

The five core specialist agents in production:

1. **Triage Classifier** (Haiku) — already built ✅
2. **Inbox Drafter** (Sonnet) — already built ✅, now reads procedural memory
3. **Discovery Agent** (Sonnet) — the v1 wedge. Reads client facts + bank/email/doc artifacts + authority library. Surfaces TaxPositions to a Discovered queue. Runs continuously.
4. **Pre-signature Checklist Agent** (Sonnet) — the anxiety reducer. Runs at engagement state-change-to-ready-for-sign. Outputs the "you can sleep tonight" report. The marquee feature.
5. **Missing-Information Agent** (Haiku) — reads engagement state, surfaces what's missing for return prep, drafts client request via Inbox Drafter.

Plus:
- Confidence scoring + citation rendering on every agent output
- Tier indicator UI (color-coded pill on every TaxPosition: green/amber/orange/red/gray)
- Authority hover (cite expands to full authority text + `effective_from` date)
- Audit trail with cryptographic chaining

### AI Tasks layer (Phase 4, Wks 7-8, 6/13 → 6/27)

The user-composed agent orchestration that replaces "automations" entirely.

- `scheduled_tasks` schema (user_id, prompt, schedule, last_run_at, output_format)
- Natural-language → structured-task converter (LLM call extracts cron + underlying query)
- Inngest cron trigger execution
- Output renderer (markdown brief, email, push)
- Library of starter templates ("scan Schedule C clients quarterly," "monthly Roth conversion check")
- UI surface in command-room: "Type what you want watched"
- AI Tasks marketing line: *"Type what you want watched. Watch it forever."*

Plus the natural-language client-book screening:
- LLM converts user query → SQL against schema
- Sortable table renderer
- Drill-down to client detail
- Full-text + structured-field hybrid search

### Discovery agent + wedge demo (Phase 5, Wks 9-10, 6/27 → 7/11)

Discovery agent runs end-to-end against Antonio's actual book. The output is the demo artifact that closes deals.

- OLT export parsing (CSV + PDF → structured client+return data)
- Discovery agent reads 3 prior years of returns + Gmail + portal artifacts
- Generates the structured report:
  - "Scanned 217 clients across tax years 2023-2025"
  - "Found 89 missed deductions across 47 clients"
  - "Total estimated savings: $341,000"
  - "Top 5 to call this week" with citations
  - "Coverage gaps that look like compliance risk"
  - "Authority log attached" — every finding cites IRC §, Treasury Reg, controlling case
- Antonio runs it. Calibration round (he tells which findings were good/noise).
- The number becomes the sales artifact.
- Pre-signature checklist live on his actual returns

### Partner #2 + harden + launch (Phase 6, Wks 11-12, 7/11 → 7/30)

- Mid-market partner #2 (regional firm, 20-100 staff) onboarded with full v1 OS
- Both partners running on multi-tenant substrate (no snowflakes)
- E2E tests (Bun + Playwright) across intake → docs → messaging → e-sign → onboarding
- Audit-trail review on every server action
- Approval policy enforcement (filing authority, signed advice, material positions)
- Evidence trail UI
- Retention policy (7-year tax-document retention default, configurable per tenant)
- Pitch deck (5-10 slides), Loom demo, marketing surface
- Discovery Scan productized as paid offering ($1-5K per book)
- Eval harness for all agents (`services/workers/scripts/eval-*.ts`)
- Load test at 1000+ concurrent uploads
- Pre-launch security review

✅ **V1 launch 2026-07-30**

---

## 4. V1.5 (8/1/2026 → 12/31/2026)

**Theme**: the closed loop becomes irreplaceable.

### Sticky/killer features

The features that, once Antonio uses them, he can't go back to working without them.

- **Bank-feed deduction harvester** — Plaid + Xero/QBO integration. Continuous categorization of business bank feeds. AI flags "$4,500 charge to coworking space → home office?" with context from email and prior years. Antonio reviews 5 per week, approves/rejects, agent learns. Pattern-recognition dividend: by month 3, agent knows the client's business better than the client.
- **Audit defense subscription** — $20/return/mo recurring revenue. If client gets audited, Docket auto-generates the defense package: every position taken + cited authority + contemporaneous documentation + drafted response + timeline of EA's decision points + third-party attestation contacts. Aligned incentives.
- **Cross-client pattern recognition** — weekly digest. "8 of your Schedule C clients have W-2 wages from same employer (Acme Corp). One was reclassified to W-2-only via §3509. The other 7 likely still misclassified — high audit risk." Practice-intelligence pillar made proactive.
- **Prior-preparer onboarding scan** — 8821 → Tax Pro Account → 3 years of transcripts → reconciled against prior returns → "your previous preparer reported $87K wages, IRS shows $94K W-2 + $7K 1099-NEC missed." Conversion magnet for new-client wins.
- **Examiner intelligence surface** — the data captured starting v1 becomes visible. "Examiner Mike Chen at Glendale (district 06): you've negotiated 4 times, he typically accepts structured installments under $10K, pushes back on §6651 reasonable cause. Drafting your response with these in mind…" Nobody else has this data.
- **Conversational return walkthrough for clients** — instead of "here's a 47-page PDF, sign at the bottom," the client gets "your refund is $3,247, that's $812 more than last year because A and B." Tap any line of the return to see why it changed. Source-to-return traceability for the taxpayer.
- **Institutional memory queries** — Antonio's queryable career: "show me every Augusta rule position I've taken and how the IRS responded," "what's my first-time-abatement success rate vs last year," "compared to peers, am I disclosing too aggressively." Practice Intelligence as a paid module ($99-299/mo separately).
- **Rewind primitive** — UI surface where Antonio sees "AI did X at time Y. Reverse?" Walks `actions` chain to undo. The IG-ad-scenario defense made user-facing. The marketing handle: *"the only tax AI where every action is reversible."*

### Year-round + IRS-facing layer

- **Year-round portal** — bilateral. AskAntonioChat as persistent surface. Year-round tax position summary. Q4 planning prompts proactive. Document collection rolling.
- **2848 / 8821 e-signing in portal** — DocuSign + LexisNexis KBA (NIST IAL2)
- **2848 / 8821 filing to IRS** — Tax Pro Account browser automation (the official IRS web portal; 2-5 day CAF posting)
- **CAF state visualization** — read-only, scraped from Tax Pro Account business-firm view
- **Notice triage agent on uploaded notices** — PDF/image upload by client or Antonio. Classifies, drafts response, surfaces deadline.
- **Notice response drafting with cited authority** — firm-approved before send. Off-season recurring revenue ($200-500/notice handled).
- **Tax-software orchestration for e-file** — browser automation against OLT for Antonio + ProConnect/UltraTax for partner #2.
- **Per-client encrypted IRS credentials** — `tenant_credentials` table.

### Manager mission control

- Portfolio view across all clients
- Exception monitoring (deadlines, SLA breaches, stuck items)
- Margin leakage analytics (per-client revenue vs effort)
- Capacity planning (per-staff workload, projected throughput, bottleneck detection)
- Workload-aware prioritization (high-confidence cases auto-routed to accelerated prep, position-risk cases to senior reviewers)
- Reallocation + escalation flows
- Advisory-opportunity surface (which clients should be upsold to advisory)

### Multi-channel client surfaces

- **Text mode for clients** — full SMS conversational onboarding. Magic-link pattern for sensitive ops. §7216 consent at onboarding. Inbound PII regex scrubbing.
- **WhatsApp parity** — port the text-mode work (~2 days). Twilio WhatsApp Business API.
- **Spanish translation** — bilingual UI strings. Antonio's first cohort already includes Spanish-speaking clients.

### Tax-law diff agent

The 10th specialist agent. IRS/FTB monitoring (Federal Register, IRS Notices, Rev Procs). Position-level affected-return surface ("8 of your clients took position X last year; the underlying authority just got superseded — recommend reviewing"). Drives the "stale cite" warning on returns referencing changed authority.

### BOI reporting (FinCEN)

Required since Jan 2024 for ALL US businesses. ~30M businesses need to file Beneficial Ownership Information. Most software handles it badly. Standalone module, $50-100 per filing.

### Production hardening

- R2 cross-region replication (was deferred earlier; reverted that decision after Neon Cell 6 outage)
- Multi-cloud DB hot standby (Neon → AWS RDS)
- Inngest event durability (local `pending_events` queue → replay)
- Twilio fallback (AWS SNS or MessageBird)
- Clerk → email-OTP fallback
- Local IndexedDB cache for active engagements
- Cascade summarization (Hot → Warm → Cold tiers)
- Hierarchical summary index (daily / weekly / monthly / quarterly / yearly)
- Active curation surface ("confirm these patterns, drop these stale facts")
- Edit-diff feedback loop (track AI-draft vs human-sent diffs)
- Encryption KEK rotation
- Data export endpoint per CCPA/GDPR
- Soft-delete in production
- Per-tenant cost analytics in command-room
- Inngest run dashboard (stuck/failed runs visible to admin)
- Visual regression testing
- Per-tenant fuzz testing

### Pre-tax-season runbook (Jan 2027)

- Failover dry runs (deliberately disable each vendor in staging, time recovery)
- War-room runbook (1-3 pages per vendor)
- Feature pause (aggressive features off Feb 1 - April 16)
- Vercel pre-season scaling (pre-warm, increase memory, ISR)
- Rolling backup verification
- Insurance in place (E&O / Cyber / Tech-pro)

---

## 5. V2 (2027+)

**Theme**: the AI CPA + the network-effect moat.

### The marquee features that aren't yet timed

- **Voice agent ("Antonio in your pocket")** — ElevenLabs voice clone + Twilio Voice + existing intake/inbox-drafter agents. Routine 70% of calls handled in Antonio's voice. Captures notes, drafts responses, files audio + transcript to client record. Cherry-on-top launch feature.
- **AI CPA play** — tax practice as a queryable brand asset. Voice profile + tone/style profile + positioning statements + domain expertise tags + communication preferences. Docket IS the EA when they're not there. Practice transferable as an asset (sells at 2x revenue instead of 1x).
- **Cross-firm anonymized aggregation** — network effects through shared examiner intelligence + position library. Differential-privacy-protected (k-anonymity ≥10). New firms benefit from existing firms' history. The compounding moat.
- **OLT browser automation (form filling)** — full e-file pipeline. Browser worker fills returns directly from Docket's structured engagement data. Saves Antonio hours per return.
- **Tax planning calendar (proactive)** — runs continuously. "John's W-2 jumped 40%. Roth conversion window closes Dec 31." "Maria's Q3 estimated payment due Sept 15, recommend $X." "Property tax due Dec 1 in CA — bunch with Q4 charitable for itemize."
- **Live human EA backstop subscription** — Docket subscription includes some hours of live EA time per quarter. Hybrid AI + human service tier.
- **Outcome Prediction (Blue J integration)** — judicial-precedent-based outcome prediction. Position-level audit/controversy risk modeling on demand. v1 partnership target.
- **Practice Pattern Agent** — analyzes the firm's own practice patterns. "Your average billable hour by client segment is X." "Your profit margin per service line is Y."
- **Promise Keeper Agent** — tracks every commitment Antonio makes ("I'll send by Friday"), surfaces ones at risk, drafts follow-up.
- **Phone Agent** — voicemail transcription, intent extraction, drafted callback.
- **Multi-language full coverage** — Mandarin, Vietnamese, Tagalog (after Spanish in v1.5).
- **Knowledge layer expansion** — Bloomberg / CCH / Checkpoint editorial commentary added if usage data shows specific gaps.
- **Tax franchise network play** — Liberty Tax / Jackson Hewitt / smaller franchise networks. Corporate licensee model. Single deal could yield $1-5M ARR. Activate after mid-market reference customer in hand.
- **Per-firm fine-tuning / LoRA distillation** — distill Antonio's patterns into a Sonnet/Opus fine-tune. Cheaper inference, better matches Antonio's voice. Quarterly retrain or on material drift.
- **Memory marketplace** — anonymized examiner intelligence aggregated from 1000+ firms as a paid module.
- **Property tax / sales tax / business license tracking** — small-business compliance calendar.
- **State residency + nomad tax module** — multi-state attribution for tech workers / digital nomads.
- **Crypto + RSU + ISO complexity module** — W-2 income with RSUs from multiple grants, AMT calculations, ESPP qualified vs disqualified.
- **R&D credit calculator** — small businesses miss §41 R&D credit constantly. Calculator + supporting documentation.
- **Engagement letter + scope automation** — based on prior-year scope.
- **Defensible vs aggressive auto-routing** — clients self-select posture; AI tone changes.

---

## 6. Marketing positioning (locked)

### For EA-side acquisition (firm-facing)

✅ **Use**:
- "The closed-loop AI for tax practices."
- "Catches every defensible deduction your team would have caught with unlimited time."
- "Audit trail built in for every position taken."
- "Compliance-first AI that won't put your PTIN at risk."
- "The only tax AI where every action is reversible and audit-defensible."
- "Type what you want watched. Watch it forever." (AI Tasks)
- "Your practice. Every tool. One operator."
- "Memory scoped to the client."

❌ **Never**:
- "Maximize your client's refund." (Wrong audience signal — repels EAs.)
- "Find loopholes." (Attracts the worst clients; repels sophisticated EAs.)
- "AI does your taxes." (Black-box framing — opposite of what we sell.)
- "Deeper than any CPA." (Table stakes by 2027.)
- "Bloomberg Terminal alternative" energy. (Perplexity Finance can do this; tax cannot.)
- Any borrowed swagger from generic AI marketing language.

### For client-side marketing

Not Docket's job. Antonio's firm sets its own posture (conservative, balanced, aggressive within compliance). Docket gives every firm the *range*, not the *posture*.

---

## 7. Distribution + GTM

### V1 distribution (locked 2026-05-08 after BlackTaxPro reframe)

Antonio + Dr. Jasmine Boney Henderson are **case-study material**, not channels. Dr. Jasmine's BlackTaxPro community is segment-specific (different demographic norms, EITC-heavy, distinct regulatory exposure) and her white-label reseller arrangement carries liability that complicates direct partnership.

The realistic v1 distribution shortlist for solo-EA-Antonio-shape ICP:

| Channel | Cost | Volume potential | Time to first conversation |
|---|---|---|---|
| **NAEA (13K members) — state chapter dinners + national forum** | ~$3-8K sponsor fee per event | 50-150 EAs per touch | 2-4 weeks |
| **r/taxpros (16K members) — earned via shipping useful free tools** | ~$0 + reputation work | 100-500 reachable per high-quality post | 1 week |
| **LinkedIn cold outreach with Discovery Scan offer** | ~$200/mo Sales Navigator | 200-500 conversations / month at scale | days |
| **Latino Tax Pro** | Partnership terms TBD | High volume, segment-aligned with Antonio | 2-4 weeks |
| **Taxposium / NAEA Tax Forum / NATP Forum** | $5-15K booth | 1000s in-person | months ahead booking |
| **Tax Twitter (#taxtwitter)** | ~$0 | Influencer-tier reach to 5-15K EAs | 1-2 months building presence |

### V1.5 distribution

- Mid-market partner #2 onboarded (regional firm, 20-100 staff). Identified Phase 4, pitched in Phase 5, onboarded in Phase 6 of v1.
- Door open for tax franchise networks (Liberty Tax / Jackson Hewitt / smaller). Activate after mid-market reference customer in hand.
- BlackTaxPro re-engagement possible after closed-loop substrate proven reliable (white-label liability bar lowered).

---

## 8. Pricing

### V1

- **Discovery Scan (productized service)**: $1-5K per book scan. Wedge product. Antonio uploads OLT export, gets PDF report 24 hours later.
- **Subscription base**: $99-299/mo per practitioner seat
- **Per-return**: $5-15
- **Per-notice handled**: $200-500

### V1.5

- **Audit defense subscription**: $20/return/mo (recurring through return retention period)
- **Practice Intelligence module**: $99-299/mo separate
- **BOI reporting**: $50-100/filing

### V2

- **Memory marketplace** (anonymized examiner intelligence): $TBD
- **AI CPA white-label**: $TBD
- **Franchise corporate licensee deals**: $1-5M ARR potential per

---

## 9. Open questions + risks

These need decisions before they have line items. Tracked in [`PRODUCTION-READINESS.md` §H](PRODUCTION-READINESS.md):

### Critical unaddressed

- **Tax co-founder hire.** [CLAUDE.md §21](../CLAUDE.md) flags as the most important hire. Without this, position-framework's 50 seeded positions are AI-generated, not expert-validated. Risk: shipping a Tier-2 position that should have been Tier-3.
- **Insurance.** E&O / Cyber / Tech-pro liability. Recommended before Antonio's real client data lands. Required before V1.5 mid-market partner #2 onboarding. Estimate: $10-30k/yr depending on coverage.
- **Terms of Service + DPA + AUP.** Standard YC template gets us 80% there.
- **HIPAA-eligible Twilio account.** Tax data isn't strictly PHI but adopting HIPAA-eligible posture is good defensive shape. Adds ~$20/mo.

### Top 5 v1 risks (from CEO plan)

1. **Compliance liability on filed forms** — incorrect 2848 filing or missed notice deadline causes legal exposure (sanctions + malpractice). Defense: trust gate locks `file` action class at level 1 by default; agent prompts unit-tested + integration-tested + run through eval suite; audit trail captures every filed form with the prompt + reasoning.
2. **Agent prompt error sends wrong filing for wrong client** — single bug could file fake 2848 to IRS for wrong client. Defense: structured prompt construction with client_id binding at every layer; pre-flight verification before any submit action; mandatory human approval before any IRS-facing submit.
3. **Knowledge layer ingestion brittleness** — start with hand-curated subset (Pub 17 + FTB residency) before automated ingestion; spot-check citations manually before agent output reaches users.
4. **Mid-market partner #2 acquisition timing** — start partner identification Phase 4; warm intros via Antonio's mentor network; pre-build partner-onboarding playbook so engagement-to-production cycle is <2 weeks.
5. **Cathedral-mode scope creep** — explicit no-more-expansions rule for v1 once 5/30 sub-milestone hits. New ideas go to TODOs.md. Schedule "expansion appetite check" at 6/13 and 7/11.

### Vendor outage resilience risks (locked 2026-05-08)

After Neon Cell 6 outage proved vendor outages are quarterly events, the resilience tier was promoted. See [`PRODUCTION-READINESS.md` §A](PRODUCTION-READINESS.md). Locked posture:
- V1: Anthropic + Bedrock fallback. Neon read replica us-east-2. Status-aware UX. Async-first audit. DB read-only mode.
- V1.5: R2 cross-region replication. Multi-cloud DB hot standby. Inngest event durability. Twilio + Clerk fallbacks. Local IndexedDB cache.

---

## 10. Explicit NOs (cuts that stay cut)

Tracked at [`CLAUDE.md` §14](../CLAUDE.md). Re-listed here for completeness:

### Product cuts

- **No consumer tax filer.** Deduction (Taylor CPAI) / Perplexity Computer / Rally / Gelt are crowding it. Wrong product anyway.
- **No fighting Black Ore / Accrual / Basis on autonomous return prep for big firms.** $235M+ raised combined, 2-year head starts. Don't be fifth entrant building backward.
- **No leading with "deeper than any CPA."** Table stakes by 2027. Depth is engine, not headline.
- **No WhatsApp in v1.** SMS + email + voice + portal chat is enough. WhatsApp Business API has compliance friction. (V1.5 adds it after text-mode lands.)
- **No return calculation engine.** OLT/Drake/UltraTax do that. Be orchestrator, not calculator.
- **No per-customer snowflakes.** Every consulting engagement runs on multi-tenant substrate. Refuse out-of-thesis work.
- **No Bloomberg/CCH/Checkpoint year 1.** Tier 1 (IRS/FTB primary) + tier 3 (internal playbooks) is enough.
- **No default shadcn aesthetic.** Custom Docket tokens (editorial cream + forest green oklch).

### Tech cuts

- **No OpenClaw / Hermes as base.** Personal AI, not multi-tenant B2B. Adopt patterns, not codebases.
- **No Claude Code CLI subscription as production inference.** Against ToS, can't multi-tenant, no SLA. Dev tool only.
- **No Python backend.** TS end-to-end. Junior dev's instinct rejected.
- **No AWS Bedrock from day 1 as primary.** Defer until first compliance customer asks. Direct Anthropic + Bedrock fallback is v1 default.
- **No LLM Gateway right now.** Loses Anthropic prompt caching benefits, adds latency, adds dependency. Direct API + Bedrock fallback is the right architecture for v1. Reconsider when running 3+ providers.

### Segment cuts

- **No Big 4 / top-100 firm pivot for 18-24 months.** Decided 5/2/2026 CEO review. Fortress market with $235M+ funded competitors holding 2-year head starts. Brand maturity gap that 12 weeks of building cannot close. 18-month sales cycles. Bootstrap option dies.
- **No F500 in-house tax department pivot for 18-24 months.** Same compliance + ERP integration timelines as Big 4 without partner-network distribution upside.

### Compliance cuts (the marketing line that kills us)

- **No "AI maximizes deductions" framing.** Wrong audience.
- **No "loophole finder" framing.** Attracts evaders, repels professionals.
- **No "AI does your taxes" framing.** Black-box framing — opposite of what we sell.

---

## 11. Companion docs

- [`docs/POSITION-FRAMEWORK.md`](POSITION-FRAMEWORK.md) — compliance-first deduction framework, 4-tier structure, 3 modes
- [`docs/MEMORY-ARCHITECTURE.md`](MEMORY-ARCHITECTURE.md) — six-layer memory model, cost-optimized prompt caching, bloat solutions
- [`docs/PRODUCTION-READINESS.md`](PRODUCTION-READINESS.md) — punch list with priority tiers, vendor resilience, IG-ad defense
- [`docs/STRATEGIC-BRIEF.md`](STRATEGIC-BRIEF.md) — full strategic synthesis (2026-05-02)
- [`docs/PERSONA.md`](PERSONA.md) — Antonio at Vazant
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — data model, RLS, encryption boundary
- [`docs/DOCS-CAPTURE-PIPELINE.md`](DOCS-CAPTURE-PIPELINE.md) — 4-phase doc upload pipeline
- [`docs/DECISION-JOURNEY.md`](DECISION-JOURNEY.md) — chronological narrative of decisions
- [`docs/SLICES.md`](SLICES.md) — user's verbatim framings
- [`COSTS.md`](../COSTS.md) — $50/mo discipline rules
- [`CLAUDE.md`](../CLAUDE.md) — canonical project context

---

## 12. The wedge → product path (if uncertain about what to do next)

When in doubt about prioritization, return to this sequence:

1. **Wks 1-6**: Foundation + Discovery agent + Antonio's 5/30 sub-milestone. Antonio's full book operational on production.
2. **Wks 6-8**: Discovery agent runs against Antonio's actual book. Calibration round. Pre-signature checklist live.
3. **Wks 8-10**: AI Tasks + NL screening + citation hover everywhere ship. The marquee user-facing diff vs every competitor.
4. **Wks 10-12**: Partner #2 onboarded. Hardening + smoke tests + load tests. Pitch deck. Loom. Discovery Scan productized at $1-5K/book.
5. **Wk 12**: Launch. Sales motion = "free Discovery Scan of your book → conversion to monthly."

Revenue from week 8 (Antonio's amendments). Sales artifact from week 10. Distribution unlock from week 11+.

---

*Last updated: 2026-05-08. Reviewed alongside the post-doc-pipeline-debugging session, after the YC AI-native company framing locked in, after the position framework was made explicit, after the BlackTaxPro distribution reframe, after Perplexity Finance research, and after the Neon Cell 6 outage forced vendor resilience to be made specific. Re-read at every session start. Items get crossed out, not deleted (audit trail of decisions).*
