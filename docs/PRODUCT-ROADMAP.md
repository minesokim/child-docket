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

**Path 2 commitment (locked 2026-05-09 per L1)**: Docket is the orchestration platform that runs the firm's AI tax stack. Public API + MCP server ship in v1, NOT v1.5. The category framing is "tax practice operating system," NOT "AI-native practice management." The verb is "Docket it." Path 2 is the swing-for-unicorn bet; Path 1 (vertical SaaS only) is the floor that funds the swing.

**Multi-year strategic arc** (locked 2026-05-09):

| Year | Posture | Revenue source | Strategic milestone |
|---|---|---|---|
| **2026 (v1)** | Forward-deployed services + foundation product. Antonio + mid-market partner #2. | Discovery Scan ($1-5K/book) + founder-tier subscription ($250/mo × first 50 firms). | v1 launch 7/30. SOC 2 controls in codebase per L8. Public API + MCP server live (Path 2). |
| **2027 (v1.5)** | Standard pricing tiers go live (post-founder-50). Tax franchise networks door open. State Compliance Engine + intake v2 ship. | Tiered subscription + per-event + Discovery Scan + Audit Defense subscription. | First franchise corporate licensee deal. SOC 2 Type II attestation begins. Mid-market reference customer in hand. |
| **2028 (v2)** | AI CPA play + memory marketplace + cross-firm anonymized aggregation. Voice agent in customer hands. | Subscription + memory marketplace + AI CPA white-label + per-firm fine-tuning. | Network-effect moat starts compounding. Practice-as-asset (transferable at 2x revenue). |
| **2029-2030** | Optionally: top-100 firm + F500 in-house tax department lane (deferred per CLAUDE.md §14 segment cuts; revisit when SOC 2 Type II + 2 enterprise references in hand). | + Enterprise tier ($150K-$1M ACV). | Path-1-floor ($25-50M ARR self-serve + mid-market) plus Path-2-orchestration upside (10-100x of Path 1 if it works). |

The 2026-2027 arc is committed. The 2028-2030 arc is plausible-not-locked; revisit annually based on what's true at the time.

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

**Memories as a first-class surface (locked 2026-05-13 after Slant.app research).** The substrate (`client_facts` shipped via migration 0021) gets a user-facing Memories tab on every client record — plain-English bullets like *"Daughter Lily starts UC Davis Aug 2026 (AOTC + 529 windowing)"* or *"Prefers SMS over email; never call between 9am-1pm — daycare hours."* Memory Curator agent (Phase 5) extracts these continuously from messages / meeting transcripts / intake answers / doc parses; preparer can pin / edit / delete. Pre-meeting brief auto-surfaces top 5 Memories.

Slant's architectural lift (their words, our application): *"Minimize usage of custom fields, maximize unstructured data via AI extraction."* The Memories surface is the user-facing manifestation of L4's memory architecture. Their financial-advice market validated this hard enough to raise $3.3M behind it (and it became their pricing-page-line-item differentiator vs Wealthbox/Redtail). Ours is the same primitive in tax.

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
- Schema migration 0031 (NEW — v3-IA integration): `tenant_ai_preferences`, `reminder_rules`, `notification_prefs`, `calendar_events`, `tenant_settings` (JSONB k/v store with `theme_pref`, `refund_policy_md`, `branding_*` keys). Drives the new Settings routes + Calendar surface.
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
- **`MetricStrip` UI primitive** (`packages/ui/src/components/MetricStrip.tsx`) — aggregate count/dollar/percentage strip that opens every command-room page. Hover-to-source on every metric. v3-IA primitive.
- **`ReasoningTrail` UI primitive** (`packages/ui/src/components/ReasoningTrail.tsx`) — collapsible per-step trace renderer used by every agent output. Locked as a contract per [`CLAUDE.md` §9 Agent contract](../CLAUDE.md). Agent JSON schemas extended to include `reasoning_trail: ReasoningStep[]` field.
- **Need You workflow primitive** — refactor `/` (command-room home) from generic dashboard to 4-lane sub-section view (New Intakes / Ready to Prep / Ready to File / Sign & File). Replaces "Pipeline" as the operational primitive; Pipeline becomes the 3rd view-toggle on /clients.
- **Client risk-tier pill** (`packages/ui/src/components/RiskTierPill.tsx`) — green/amber/red classifier rendered on every Client list row. Heuristic v0: compliance posture (open issues) + payment history (overdue invoices) + communication friction (un-responded thread count) → tier; future versions will be driven by AI Preferences thresholds.

### Antonio production sub-milestone (Phase 2, Wks 3-4, 5/16 → 5/30)

The 5/30 deadline: Antonio's full 200+ client base operational on production-grade substrate.

- Real bidirectional messages (Twilio SMS + Gmail email + portal chat, channel-aware via Inbox Drafter agent)
- **Channel-availability icons inline per conversation** (green / amber / gray dots indicating which channel the client uses) + **in-thread `Process / Ignore` action pair** on attached documents (v3-IA texture-win, antonio 5/9 ask)
- Square Checkout API integration (per-client payment links, webhook for paid status)
- **Refund policy display at checkout** — `tenant_settings.refund_policy_md` field rendered inline before the deposit-commit button on `/deposit` and command-room invoice pages. Markdown-authored once per firm in Settings → Practice → Billing → Refund Policy
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
- **Settings → Intelligence → AI Preferences page** (new route `/settings/ai-preferences`) — tone selector, 8 insight toggles, Docket Personality free-text, Quiet Hours range. Writes `tenant_ai_preferences` table. Drives every agent's system-prompt assembly. Per [`CLAUDE.md` §8 AI Preferences](../CLAUDE.md).
- **Settings → Practice → Automated Reminders page** (new route `/settings/reminders`) — 5 canonical reminder rules (missing docs / engagement letter / 8879 / outstanding balance / year-round Q-end touchpoint). Per-rule: enabled / cadence / channel / max attempts. Writes `reminder_rules`. Quiet Hours inherited from AI Preferences.
- **Settings → Practice → Notifications page** (new route `/settings/notifications`) — 4 categories (Deadlines / AI alerts / Client activity / System) × 3 channels (SMS / email / in-app). Writes `notification_prefs`. Inherits Quiet Hours.
- **Stage-specific portal status messages** on Home tab — 5 canonical states map to 5 copy + CTA combinations (per [`CLAUDE.md` §4 Client Portal](../CLAUDE.md)). State machine drives copy; firms cannot edit individual messages (consistency floor); only firm-name/owner tokens interpolate.
- **Audit Trail UI** — read-only view at `/clients/[id]/audit` showing all `actions` rows tied to client. Every AI action labeled with cited authority, confidence tier, cost. Substrate for the V1.5 Rewind primitive.
- **Documents tab split: Client docs vs Firm files** — `/documents` becomes faceted: "Client docs" (filed to a client record) vs "Firm files" (engagement letters, §7216 consents, audit-defense packets, internal SOPs, position library). MetricStrip at top.
- **Discovery agent output locked to canonical format** `{ClientName}'s {situation} · {quantified impact}` — alerts that can't quantify impact route to a secondary informational queue, not the dashboard primary. Locked as a contract.

### Antonio call feedback (2026-05-09)

Live demo of intake + dashboard with Antonio (design partner). Feedback distilled into prioritized fixes / features / strategic context. **VC application deadline 8/1 means 84-day clock; Antonio explicitly offered to introduce us to his network once the product looks pitch-ready. So shipping speed beats ambition.**

Antonio's macro reaction: positive. *"I like the way it looks. I like the way it feels. It doesn't feel clunky. It goes smooth on it."* Dashboard avatar fallback to Gmail profile picture worked correctly.

#### P0 BUGS (this week)

- **Intake "Take photo" + upload-arrow buttons are dead links** — clicking does nothing, no file picker opens. Antonio hit this on the docs step. Located at the document-upload phase of `apps/client-portal/src/app/(intake)/...` (likely the camera/upload component). Until fixed, every intake stalls at docs upload.
- **Business-type branching is wrong** — when user selects "Corp" entity type, the intake still surfaces W2 income questions (which are individual-only). Need to branch the income/deductions questions by entity type (individual/sole-prop vs. LLC vs. S-corp/C-corp/partnership) so Corp clients see corp-relevant fields only.

#### P1 FEATURES — Antonio explicitly demoed his workflow (this + next week)

- **California Secretary of State entity lookup** (~2-3d). Antonio's competitive moat: during sales calls he live-checks every prospect's corp/LLC against `bizfileonline.sos.ca.gov` to verify standing, entity type, FTB compliance, statement-of-information dates. *"They go, oh, like, this guy knows what he's doing because I pulled them."* Public API; no auth. When user enters business name + entity number on intake, validate against CA SoS and surface: active/suspended status, FTB standing, entity-type-correctness check (LLCs taxed as S-corp have corp numbers; flag the mismatch), statement-of-information status, agent for service, formation date, addresses. Expose to the preparer dashboard as "live entity check" alongside intake.
- **Routing number → bank name lookup** (~0.5d). On the deposit/refund-method step, when a routing number is entered, surface "JP Morgan Chase" / "Wells Fargo" etc at the bottom in real time. Antonio: *"It's a nice little touch."* OLT does this. Free APIs available.
- **State auto-fill** (~30 min). When user types "CA" in state field, auto-complete to "California". Antonio: *"thinking in the ways of lazy people, like I already know."*
- **Mask/unmask sensitive fields on outbound documents** (~1d). When sending docs to clients (the existing 8879 + signature flow), per-document setting to mask SSN/EIN/bank/address vs. full reveal. IRS does this on transcripts. Antonio said "do unmask, unmask" toggle is the model.
- **Document upload → PDF, not JPG** (~1d, partially shipped). Photos taken via intake should convert to PDF (not `image1.jpg image2.jpg`). Auto-rename based on context: `Mary_Jane_W2_2026.pdf`. Antonio: *"That's what I'm thinking about."*
- **Filing-status deeper qualifying questions** (~2d). HoH and MFS need specific follow-up question flows:
  - **HoH**: IRS-compliant qualifying questions (relationship, residency, support test, custodial parent rules). Antonio: *"someone doesn't claim it just because they say their head of household. My job as a tax professional, I qualify you."* Without IRS-correct questions, the firm carries the disqualification risk.
  - **MFS**: spouse income allocation. If MFS taxpayer's spouse files with a DIFFERENT firm, the prep firm needs the spouse's tax return + Form 8958 (community property states like CA). Branch: "is your spouse filing with Vazant?" If yes, auto-link to the spouse's intake. If no, prompt for spouse return upload OR spouse income breakdown.

#### P2 FEATURES — Antonio's wishlist (next 2-4 weeks)

- **Email/SMS reply-tracking ("forgot to answer one")** — already on roadmap as inbox-drafter; Antonio confirmed this is critical. *"I get so many emails that you forget to answer one. And all of a sudden they're like, hey, so I emailed you, you never got back to me."* AI drafter watches inbox + portal + SMS for unanswered messages, surfaces them. (= Phase 3 inbox-drafter feature; already shipped substrate.)
- **AI tasks layer (natural language workflows)** — already on roadmap as Phase 4. Antonio described the vision: *"every morning at 8 o'clock, can you do a briefing? Can you scan the IRS headline news? Can you check if my clients need anything?"* Natural-language → AI agent workflow, vs. TaxDome's complex if-this-then-that automation.
- **Mom-and-pop incorporation flow** (~3d). Antonio sells incorporation as a service: customer asks "I want to be an LLC", he checks name availability on CA SoS, files articles, manages first-year compliance. Add a "I want to incorporate" intake variant that drives that workflow + uses CA SoS API.

#### Strategic context (locked from this call)

- **Pricing posture (CONFIRMED, supersedes earlier $99-299 range)**: $250/mo base + tiered add-ons. Antonio: *"have that available there. don't try to be like, oh, I'm gonna save you 50 bucks because they don't want to hear that shift. They're gonna be like, no, we just need to get this going."* Sell from the customer's pocket, not ours. **Action**: build pricing page with menu-of-add-ons (8879 KBA, AI features, doc storage tiers, Twilio SMS allowance, etc.).
- **Target persona narrowed**: NOT $150-tax-prep mills. Target EAs / CPAs / mid-market who do prep + advisory. *"You're not going to sell this to people who are charging $150 for a tax."* Filters out the bottom segment we'd been hesitant about.
- **Antonio's offer**: he'll be the "guinea pig" + intro to his network of EAs + present the product on a group call once it's pitch-ready. Distribution unlock for partners #2–#10. **Action**: get a polished demo by Wks 3-4; Antonio runs a group session with his peer network in Wks 4-5.
- **Vazant Consulting website refresh** (deferred, ~5d). Antonio asked Docket team to rebuild his site. Defer until v1 ships; queue for late June.
- **Twilio TCPA opt-in** — already shipped 2026-05-09 (`73ee0db`). Antonio's flow needs 10DLC campaign registration on his prod Twilio (operator step).
- **App vs. web**: Antonio confirmed web-only for v0. iOS app deferred until he scales beyond solo (when he hires staff for the W2-only client tier). *"I don't want to have an app for tax stuff for people who have a W2."*
- **Marketing positioning**: *"I'm the example. He's an old agent and he's doing it. He's not scared of it? Okay, cool, then I'll try it."* Antonio as case study lead in the network outreach.

#### Defer beyond v1 unless asked

- IRS Tax Pro Account browser automation (Antonio uses it manually; integration is V1.5)
- App Store iOS app (Antonio is single-practitioner v0)
- Bookkeeping intake variant (intake currently focuses on individual + business returns; bookkeeping is a separate flow Antonio hinted at but didn't push for v0)

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

### Intake Flow v2 + State Compliance Engine (Phase 2-expansion, Wks 3-8, 5/16 → 6/27)

The 5/9 Antonio call surfaced a substantial expansion of Phase 2. Round-2 deep analysis added Tier 1/2/3 items that revise the timeline. **Substrate ships first, then content per-entity progressively** (the only honest path to Aug 1 with a pitch-ready product).

#### Foundational substrate (Wks 3-4, 5/16 → 5/30)

- **Filing-status-drives-downstream refactor** (~2d). Currently `intake-flow.ts` has the filing-status step but downstream doesn't condition on it. MFJ → spouse info next; MFS → community-property branch; HoH → qualifying-person sub-flow; Single → no spouse anything; QW → MFJ-shape with date-of-spouse-death.
- **Entity-type intake substrate** (~3d). Per-entity Zod schemas + component registry + branched routing. Top-level "what brought you here?" fork: (1) get my taxes done; (2) help with IRS notice/audit; (3) incorporate a business; (4) bookkeeping setup; (5) tax planning/advisory. Each fork drives a distinct downstream flow.
- **Generalized auto-fill substrate** (~2d). Not just state. ZIP → city + state. Routing number → bank name (free public APIs). EIN → expected entity name (IRS Pub via lookup). Address → USPS standardize. Antonio: *"thinking in the ways of lazy people."*
- **CA SoS API integration prototype** (~2d). Real public API at `calicodev.sos.ca.gov` (verified 5/9 deep analysis). Subscription-key auth. Four products: Business Entity Search, UCC Filing Access, Document Retrieval, Status Verification. Returns entity name + B-prefix entity number + formation date + entity type + status (Active/Suspended/Dissolved/Forfeited/Surrendered) + registered agent + principal address + filing history. **FTB suspension surfaces in the Suspended status** (not directly via FTB, but reflected in CA SoS).

#### Tier 1 must-haves — Intake side (Wks 4-6, 5/30 → 6/13)

- **HoH qualification sub-flow + Form 8867 due diligence + Form 8332 release** (~5d). The compliance feature isn't "get HoH right"; it's **Form 8867** ($580/failure penalty for paid preparer due diligence). Sub-flow captures the four IRS tests (relationship, residency >6 months, support >50%, gross income test for qualifying relatives) + Form 8332 release-of-claim if non-custodial parent + actual cost-of-home expense breakdown (rent/mortgage + utilities + property tax + insurance + food eaten in home). Conservative routing: ambiguous answers route to "preparer review" not auto-qualify (auto-qualifying borderline cases creates MORE PTIN exposure than the generic intake).
- **MFS spouse capture + Form 8958 community-property allocation** (~5-7d). Branch by state of residence:
  - Non-community states → spouse name + SSN only (~0.5d).
  - Community-property states (CA, AZ, ID, LA, NV, NM, TX, WA, WI; Wisconsin uses "marital property" terminology, federal-treats-as-community; Alaska is opt-in via marital agreement): full Form 8958 sub-flow. ~30 fields per spouse (W-2 split community/separate, 1099 split, deductions split). If spouse is a Vazant client too, auto-link both intakes. If not, branch: "upload spouse's tax return" + OCR + parse, OR detailed spouse-income data entry. Without it, IRS auto-flags via the matching system.
- **Entity intake routing + S-corp 1120-S content** (~7-10d for content depth). Antonio: "we are doing routing entity specific question set for sure. we need to capture everything." S-corp 1120-S intake captures: officer comp + reasonable comp test + distributions + AAA + retained earnings + fixed assets register + Schedule L (if rev > $250K) + M-1/M-2/M-3 + state minimum tax (CA $800) + multi-state apportionment + BOI. Antonio's most common business type ships first; partnership 1065 + C-corp 1120 in V1.5 (per the substrate-first/content-progressive approach the user accepted).

#### Tier 1 must-haves — Compliance Engine side (Wks 4-6, 5/30 → 6/13)

- **Compliance Snapshot UI** (~3d). Red/yellow/green status pill in client workspace. Status mapping: 🟢 Active + SOI current + no FTB suspension; 🟡 SOI overdue OR within 90d of deadline OR minor data discrepancy; 🔴 Suspended/Forfeited/Dissolved OR > 1y SOI overdue. Conservative defaults: when data is uncertain, default to yellow ("verify manually") not red. False-positive red destroys credibility on a sales call.
- **Action items with per-tenant pricing menu** (~2-3d). Compliance Snapshot becomes a SALES SURFACE for the firm's services. Build `firm_services` table per tenant: service offerings + prices + descriptions, surfaced as configurable add-ons. Snapshot links each action item to the firm's service. "Request this service" button creates a task on the firm's queue + sends notification.
- **BOI reporting status surfaced** (~3d). All corps + LLCs MUST file BOI to FinCEN within 90 days of formation, 30 days of any beneficial-ownership change. $500/day penalty. Antonio sells this at ~$50-100/filing (recurring revenue stream). Compliance Snapshot must surface BOI status alongside SOI. FinCEN BOI E-Filing system has an API; intake of beneficial owners + auto-file.
- **Hard deadline tracking layer** (~5d). Per-engagement filing deadlines per filing type per client per year. March 15 (1120-S, 1065), April 15 (1040, 1120, FBAR), May 15 (990), Sept 15 (extended S-corp/1065), Oct 15 (extended 1040/1120). State deadlines often differ (CA Form 568 quarterly LLC fee). BOI: 90 days new, 30 days for changes. Compliance Snapshot surfaces "next deadline + days remaining" per client. **Antonio's daily pain.**
- **Name availability check** (~1d). For incorporation flow. Likely separate from CA SoS API per the third-party guide; may be in-API or a separate scrape path. Verify during prototype.

#### Tier 1 must-haves — Adoption + revenue (Wks 6-8, 6/13 → 6/27)

- **Existing client migration** (~3-5d). **Adoption blocker for Antonio.** ~200 clients in his current system; without bulk import, he doesn't switch. Need: CSV import + OLT export parser + (eventually) TaxDome API. Mapping: name + SSN/EIN + email + phone + prior-year return + engagement history.
- **Prior-year return upload + parser** (~5d). P0 for any new client onboarding. OCR + extract: filing status, deductions, credits, AGI, prior-year tax, dependents. Roll-forward into current year saves 1-2 hours per client. Already partially in intake design (last-year tax return is one of the doc upload items) but no parser yet.
- **White-label / firm branding** (~5d). Distribution unlock for Antonio's mentor's network (1000s+ preparers per project memory). Per-firm: logo, colors, custom domain (CNAME), client-facing copy ("powered by Vazant"), Twilio sender ID, DocuSign account, Square account, Gmail. Tenant_credentials substrate exists; needs UI + per-firm onboarding flow.
- **Audit defense workspace** (~5-7d). **Antonio has TWO active audits THIS WEEK.** Per-audit workspace: timeline, IRS auditor contacts, requests, responses, deadlines, evidence collected. Auto-draft response packets via the notice-drafter agent (already built; extend to audit-letter-drafter). Pull/track transcripts as evidence. Track every interaction via the actions audit trail. **Tier 1 because Antonio needs it NOW** — not v1.5.
- **Pre-filing IRS reconciliation substrate** (~5d substrate, then ~5d once Tax Pro Account integration lands). IRS Wage & Income (W&I) transcripts list every W-2/1099/1098 the IRS already knows about. Docket pulls W&I via Tax Pro Account, compares to client-uploaded docs, **flags missing forms BEFORE the IRS auto-letter fires**. Marquee invisible value-add. Substrate ships now (data model + UI surface for "missing forms"); full integration depends on Tax Pro Account browser-automation landing per CLAUDE.md M2+ build order — accelerate that work.
- **Mask/unmask sensitive fields on outbound documents** (~1d). Per-document toggle. SSN/EIN/bank/address masked vs full reveal. IRS does this on transcripts; Antonio: "do unmask, unmask."
- **Routing number → bank lookup** (~0.5d). On deposit/refund-method step.
- **Photo upload → PDF + auto-rename** (~1d, partially shipped). `Mary_Jane_W2_2026.pdf`.

#### Tier 2 candidates — schedule per Antonio's network demand (Wks 8-10, 6/27 → 7/11)

- **Practitioner compliance tracking** (~3d). The firm itself: PTIN renewal, EA continuing education, $5K EA bond, state registration. Different rules per practitioner type (CPA / EA / attorney / unenrolled). Track deadlines + renewal docs + CE hours.
- **Document template library** (~5-7d). Beyond engagement letter + §7216: Form 2848 (POA), Form 8821 (TIA), Form 8332 (release of claim), Form 8275 (disclosure), Form 8867 (due diligence), BOI report, Articles of Incorporation, Operating Agreement. Each templated with merge fields, sent via DocuSign with KBA where required.
- **Multi-state income allocation for individuals** (~3d). Client moved CA → TX in October. Income earned before move = CA-source; after = TX-source. Federal is one return; CA Form 540NR is part-year resident. Currently intake doesn't ask "did you move during the year." Add the branch.
- **K-1 income capture** (~3-5d). Client receives K-1 from passive partnership investment / family S-corp. 30+ line items each with tax treatment. Per-K-1 sub-flow.
- **Quarterly estimated tax tracking** (~3d). 1040-ES (4x/year). Most clients miss these. Auto-calculate from prior-year + current-year income. Compliance Snapshot surfaces "Q3 due Sept 15." Recurring touch-point that justifies subscription pricing.
- **Refund tracking** (~2d). After return filed, scrape IRS Where's-My-Refund (no public API). Surface refund status in client portal: "Refund $3,200 processing; expected July 15." Reduces support load.
- **Year-round planning prompts** (~5d). Quarterly check-ins triggered by life events (marriage, kid, house, business). AI-driven: "You said you started an LLC last quarter; S-corp election by March 15?" Year-round wedge that justifies non-tax-season subscription.

#### Tier 3 — positioning + polish (Wks 10-12, 7/11 → 8/1)

- **Demo mode for Antonio's group-call presentation** (~3d). Mock data that looks impressive (many clients, varied work, AI insights surfacing). Hide developer metadata (action_class, JSONB blobs, debug fields). Pitch-ready smoke-tested flow. Defer until ~1 week before group call.
- **Sales-shareable Compliance Snapshot link** (~2d). During sales call, Antonio opens prospect's Snapshot → shares ephemeral link. Login-free, expires in 24h, shows snapshot only. AHA-moment lead-magnet that converts on the call.
- **Trust-building UX for older preparers** (cross-cutting, ~ongoing). Every AI suggestion shown as "proposed" not "applied." One-click reject/approve. Audit trail of AI accuracy ("AI was right 87% of the time over your last 30 days"). Bake in across all agent UI surfaces. NOT a feature; a principle.
- **Junior-work-replacement marketing framing** (positioning copy, ~1d). "Save $36K/yr on junior staff per practitioner with $250/mo subscription." Junior preparer salary $40-60K. Docket replaces doc-chase + form-fill + workpaper-assembly + reconciliation + routine comms. Position THIS as the v1 sales pitch on the pricing/value page.
- **Bookkeeping integration via Xero/QuickBooks** (~5d). On roadmap as Xero MCP server (deferred). Once integrated: P&L + BS auto-prefill into business intake. Antonio mentioned bookkeeping in passing — schedule per demand from his peer network.

#### Intentionally deferred to V1.5 (post Aug 1)

- Partnership 1065 intake content (capital accounts + distributive shares + guaranteed payments + K-1 generation per partner). Substrate ships in v1; content fills V1.5.
- C-corp 1120 intake content (similar to S-corp + dividends complexity). Substrate ships in v1; content fills V1.5.
- **Multi-state expansion of Compliance Engine**: TX (Comptroller HTML scrape), FL (sunbiz.org clean search), NY (DOS Search, no franchise visibility), NJ, IL. Each state takes 3-5d. Add states one at a time as Antonio's clients have entities there. Don't speculatively build provider for unused states.
- Multi-state apportionment for businesses (sales-factor allocation across states for LLC/Corp operating in multiple jurisdictions).
- Estate / trust intake (Form 1041, Form 706). Different sub-product.
- Annual minutes / corporate compliance (board resolutions + ownership ledger for corporate liability shield). Antonio sells this; surfaces in extended Compliance Snapshot.
- Notice-drafter expansion to audit-letter-drafter (the audit defense workspace ships v1; the AI auto-draft part lands V1.5 once notice-drafter pattern proves out at scale).
- Insurance integration (affiliate revenue from liability/E&O insurance partners).
- Voice-input intake mode (Whisper API + GPT extraction for "tell me about your year" → form fields). Especially powerful for older clients.

#### Honest timeline check (8/1 VC application deadline)

84 days. ~12 weeks. Phase 2-expansion above lands ~Wks 3-12 (May 16 → Aug 1). Layered on top of the existing Phase 2 production wiring (Twilio + DocuSign + Square real wiring + Gmail polling enable + Pub 17 ingestion + AAD-binding ✅ + KEK rotation ✅).

Realistic ship cadence: ~1 substantive feature per 2-3 days at current velocity (with codex-review enforcement now baked in per [25]). 12 weeks × 5 days = 60 days of build × 2-3d/feature = 20-30 features. Phase 2-expansion lists ~25 substantive items. **Tight but achievable** if the substrate-first/content-progressive approach holds for entity intakes (= S-corp v1; partnership + C-corp V1.5).

Items NOT in this section (already covered elsewhere or already shipped):
- Cost outlier + spike alerts ✅ shipped af808e7
- KEK rotation ✅ shipped 2d63206 + 3bd42b1
- AAD-bound encryption ✅ shipped 2c5db11
- DocuSign void-envelope + kba-failed enum + envelope idx ✅ shipped 6ecb672 + 78aa4f9 + 2b9949a
- TCPA SMS consent ✅ shipped 73ee0db
- Codex review + e2e cadence enforcement ✅ shipped 1386750 + 09d3f49 + 1d72f96
- Gmail polling code ✅ already shipped (just needs ENABLE_GMAIL_POLL env on prod)
- Documenso self-host migration (V1.5+ per existing roadmap)
- IRS Tax Pro Account browser automation (M2+ per CLAUDE.md; Pre-filing IRS reconciliation accelerates this)
- "Ask Antonio" feature (already in product per user direction)
- "Humanizing everything" (already the design ethos per user direction)

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

### Projects surface (Phase 4, Wks 7-8, 6/13 → 6/27)

Third organizing primitive in command-room (alongside per-client and per-status / Need You queue). Locked 2026-05-13 after Slant.app research.

- `projects` table (new migration): one row per project type per tenant. Default template rows seeded per tenant on signup.
- `engagement_projects` join table: each engagement belongs to 1+ projects.
- `/projects` route in command-room — top-level nav alongside Calendar. Lists active projects with counts. Click into a project → all engagements in that project + their current stage + filter / sort / search.
- Canonical v1 templates seeded out-of-the-box (firms customize):
  - Annual Return Prep (per tax year, branched by form type)
  - Discovery Scan (book-wide deduction surfacing, the wedge offering)
  - Audit Defense Engagement (per active audit)
  - Notice Response Workflow (CP2000 / CP504 / LT11 et al.)
  - Quarterly Estimated Payments Cycle
  - Incorporation (CA SoS + BOI + Form 8832)
  - BOI Annual Filing
  - Year-Round Planning Touchpoints (Q2 extension / Q3 estimates / Q4 Roth conversion)
  - Statement of Information Renewal
  - Pre-Filing IRS Reconciliation
  - 8821 Transcript Pull Cycle
  - Client Onboarding
- Pre-built Project Templates marketplace: starter library + firm-authored. Slant has a "workflow marketplace" concept for AI Automations — we adopt the pattern for Projects.

The unlock: instead of asking "look at clients" (per-client) or "look at lanes" (Need You queue), Antonio can ask "show me everyone in Annual Return Prep at the Review stage" or "show me everyone in Audit Defense by deadline distance." Different lens; same underlying engagement state machine.

### Calendar surface + google-calendar MCP (Phase 4, Wks 7-8, 6/13 → 6/27)

Calendar as first-class top-level command-room nav (not buried in settings). Per [`CLAUDE.md` §4 Calendar](../CLAUDE.md).

- `google-calendar` MCP server (§10 — slot 4 in v0 roster). Tools: `list_events`, `create_event`, `update_event`, `delete_event`, `find_free_slots`. Per-tenant Google OAuth via the existing `tenant_credentials` substrate.
- `calendar_events` table (migration 0031) — mirrors Google Calendar events, scoped per-tenant via RLS, with `client_id` + `engagement_id` foreign keys so calendar entries are first-class client artifacts (queryable in Discovery + Strategy agents).
- `/calendar` route in command-room — weekly view default, day/month toggles. Event types: client meetings (linked to client record), filing deadlines (per engagement, color-coded by tax form type), internal reviews, audit milestones, year-round planning touchpoints.
- Two-way sync. Webhook on Google Calendar changes → mirror into `calendar_events`. Writes from command-room → Google Calendar API.
- Click any event → opens client/engagement workspace.
- **Aggregate MetricStrip** at top: "This week: 8 meetings · 3 filing deadlines · 1 audit milestone."

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

- **Memories surface + Memory Curator agent (V1.5 — Slant-validated)** — `client_facts` already shipped (migration 0021). What lands V1.5: (1) Memory Curator background agent that extracts plain-English memories from every inbound message, meeting transcript, doc parse, and intake answer; (2) per-client Memories tab in command-room showing curated bullets, sorted by relevance + recency; (3) pre-meeting briefing that auto-surfaces top 5 memories for attendees; (4) the same memories made retrievable inside Ask Docket (client-scope) and Notetaker. The unlock: Antonio walks into every client meeting with the right detail at the right time, without ever opening a custom-fields page. Slant validated the demand for this at $3.3M of seed.
- **Notetaker agent (V1.5 — Slant-validated)** — Records meetings (Zoom / Google Meet / phone), transcribes via Deepgram (then Gladia per L5), routes through Memory Curator. Output: meeting summary + extracted memories + action items + sentiment + follow-up commitments. Each tied to the right client record. Action items create Tasks in the active engagement; follow-up commitments create Promise-Keeper-agent entries. This is the table-stakes feature financial-services-adjacent buyers expect; tax buyers will start asking for it within 6 months as Jump.ai-style notetakers cross over.
- **Nudges agent (V1.5 — Slant-validated; sibling to Discovery)** — Daily cron walks `client_facts` + `engagement` state + `calendar_events` against `nudge_rules`. Drafts approved-pending preparer-to-client outreach for life events (child starts college, business hits milestone, state move), time windows (Q3 estimates, Roth conversion window, BOI deadline cohort), drift (W-2 jumped 40%, charitable giving doubled), milestones (business crosses $250K rev → S-corp election conversation). Output = pre-drafted outreach + planning prompt, surfaced to Antonio for approve / edit / dismiss. Slant prices this as a distinct line-item differentiator vs Wealthbox/Redtail; we should expect prospects to ask for it by name within a quarter of launch.
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

### White-label / firm branding (V1.5 distribution unlock)

The migration from "Antonio's tool" to "the OS Antonio's mentor's network of 1000s of preparers all run on." Substrate already exists in `tenant_credentials`; the gap is UI + per-firm onboarding flow + DNS provisioning.

- **Custom client-portal subdomain** — per-firm CNAME (e.g. `clients.vazantconsulting.com`) maps to Docket's portal infrastructure. DNS instructions in command-room Settings → System → Custom Domain. Vercel multi-domain config + automatic SSL.
- **Firm logo + color overrides** — within Docket's tone constraints (editorial-warm-only, no shadcn drift). `tenant_settings.branding_*` keys hold logo URL + accent-hue offset (within 130-165 oklch range only). Forest-green primary stays locked across all firms — the brand-aware design is *texture*, not full reskin.
- **Welcome message customization** — per-firm Welcome screen copy + intro paragraph. Lives in command-room **Settings → Client Experience → Portal Branding** (per [`CLAUDE.md` §4 Client Portal](../CLAUDE.md)).
- **5 video portal touchpoints** — stage-aware video slot on portal Home tab (First-Time / Returning / Docs Received / Review-Ready / Post-Filing). Recording UI in command-room Settings → Client Experience → Portal Videos. Falls back to firm-name-only typography card if firm hasn't recorded a video for that stage.
- **Per-firm Twilio sender ID, DocuSign account, Square account, Gmail OAuth** — already supported in `tenant_credentials`; gap is the per-firm onboarding flow that walks new firm owners through linking each.
- **Light / Dark / System theme** — per-user preference stored in `users.theme_pref`. Single `data-theme` attribute on `<html>` flips the CSS-custom-property variables; inline-style intake/portal components don't need a per-component rewrite. Lives in command-room **Settings → System → Appearance**, mirrored in portal Profile tab. (Per [`CLAUDE.md` §11 Design Tokens](../CLAUDE.md).)

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

### The opening line (locked 2026-05-13 after Slant.app research)

**"Double a tax preparer's capacity."**

Slant.app uses the same opener for financial advice and raised $3.3M behind it. Buyer behavior is identical in tax. The unpack:

- Solo EAs serve 150-200 clients per season at high friction today. With Docket: 400-500 with the same quality.
- $36K/yr saved per practitioner at $250/mo. Junior preparer salary $40-60K/yr is the cost Docket displaces.
- Antonio is the case study. He's not scared of it. If he can do it, so can you.

**Position Framework + compliance-first + cited authority is the second sentence, not the first.** The first sentence is the capacity claim. The second sentence is the moat (why an EA can adopt us where they can't adopt a deduction-finder). Same shape as Slant: their position-framework-equivalent (SOC 2 + fiduciary alignment) is also their second sentence.

### The tool-consolidation narrative (locked 2026-05-13)

Docket replaces 6+ tools at once:
- **TaxDome / Canopy / Karbon** (practice management — clients, tasks, billing, portal)
- **Black Ore / Accrual / Basis** (return-prep AI — workpapers, position drafting)
- **DocuSign / HelloSign** (8879 signing)
- **Square / Stripe** (deposits, invoicing)
- **Zoom / Otter / Fathom** (meeting + transcription)
- **Generic CRM** (contact + comms log)
- **Excel / Notion / Google Sheets** (everywhere a firm tracks anything internal)

This is how we close mid-market firms (20-100 staff) who are paying for 3-5 of those tools today. Pitch: *"What if every one of those tools collapsed into a single, AI-native operating system that knows your firm's voice?"*

### The pivot-pattern narrative (YC application; locked 2026-05-13)

Pageport → Slant is our reference shape. They started as a video landing page + marketing automation tool for advisors (2023). Users started manually using Pageport as a CRM. Two users in one week asked to add Social Security numbers. They pivoted to full CRM. By Aug 2025: 1,200+ advisors, $1M ARR, $3.3M seed.

Our analog: Discovery Scan is our point-solution wedge (a productized $1-5K service we sell to ~100 firms by 8/1 per L16). Antonio's 5/9 call surfaced 25+ feature requests that became Phase 2-expansion — *that's the customer-pull pivot signal.* By the time we pitch YC Fall 2026, the narrative is: "we sold a wedge service to N firms; they pulled us into building the platform; we're now selling the platform back to them."

### For EA-side acquisition (firm-facing)

✅ **Use**:
- **"Double a tax preparer's capacity."** (lead with this)
- "Six tools collapsed into one OS."
- "The closed-loop AI for tax practices."
- "Catches every defensible deduction your team would have caught with unlimited time."
- "Audit trail built in for every position taken."
- "Compliance-first AI that won't put your PTIN at risk."
- "The only tax AI where every action is reversible and audit-defensible."
- "Memory scoped to the client. Memories surfaced where you work."
- "Type what you want watched. Watch it forever." (AI Tasks)
- "Your practice. Every tool. One operator."
- *"I want their job to be easier. Come to work with 18 things to do, not 80."* (Thomas Clawson voice, applied to tax)

❌ **Never**:
- "Maximize your client's refund." (Wrong audience signal — repels EAs.)
- "Find loopholes." (Attracts the worst clients; repels sophisticated EAs.)
- "AI does your taxes." (Black-box framing — opposite of what we sell.)
- "Deeper than any CPA." (Table stakes by 2027.)
- "Bloomberg Terminal alternative" energy. (Perplexity Finance can do this; tax cannot.)
- Any borrowed swagger from generic AI marketing language.

### Sales artifact: competitor matrix (build before 6/15 Antonio demo)

Slant's pricing page hosts a Slant-vs-Wealthbox-vs-Redtail matrix that ships ✓ across every Slant feature and "Limited" or "-" everywhere else. Customers can screenshot it and forward to their procurement team. We need the equivalent.

**Build:** `docs/pitch-decks/competitor-matrix.md` + a page on the marketing site that renders the matrix interactively.

**Rows (the features we ship that incumbents don't):**

| Capability | Docket | TaxDome | Canopy | Karbon |
|---|---|---|---|---|
| Position Framework with cited authority (Tier 1-4 + refusal floor) | ✓ | — | — | — |
| Discovery agent (continuous deduction surfacing across book) | ✓ | — | — | — |
| Audit chain with cryptographic verification | ✓ | — | — | — |
| Memories surface (AI-curated, plain-English, per-client) | ✓ | — | — | — |
| Nudges agent (life-event + drift + milestone outreach) | ✓ | — | — | — |
| Need You workflow primitive (4-lane: New Intakes / Ready to Prep / Ready to File / Sign & File) | ✓ | Limited | Limited | — |
| Reasoning trail on every agent output | ✓ | — | — | — |
| OLT browser automation (tax software where competitors won't go) | ✓ | — | — | — |
| Cited-authority position library (IRC + Treas Regs + FTB) | ✓ | — | — | — |
| Per-active-client pricing (no per-seat penalty for growth) | ✓ | — | — | — |
| Pre-filing IRS reconciliation (W&I transcripts vs uploaded docs) | ✓ (V1.5) | — | — | — |
| Refund policy display + KBA-compliant 8879 e-sign | ✓ | Limited | Limited | — |
| AI Tasks (natural-language workflow authoring) | ✓ | Rules-based | Rules-based | Rules-based |
| Audit Defense subscription module | ✓ | — | — | — |
| Bilingual portal (Spanish v1.5, Mandarin/Vietnamese/Tagalog v2) | ✓ (V1.5) | — | — | — |
| White-label / firm-custom subdomain | ✓ (V1.5) | ✓ | Limited | — |
| Client + meeting + book chat (three-scope Ask Docket) | ✓ | — | — | — |
| Project templates (Return Prep / Audit Defense / Notice Response / etc.) | ✓ | Limited | Limited | Limited |

**Update cadence:** every 6 weeks during v1 build, monthly post-launch. When a competitor adds a feature we listed, mark "Limited" and add a footnote of the gap.

### Content marketing assets (locked 2026-05-13)

Slant ships content marketing through their Resource Center. Copy the shape:

- **Ebook 1: "10 ways Docket saves a tax preparer 10+ hours a week"** — concrete time-savings math per agent (Discovery surfacing, Inbox Drafter, Notice Drafter, Triage Classifier, Document Triage, Need You queue, Pre-Signature Checklist, etc.). Target: launch with the v1 pitch deck.
- **Ebook 2: "Tax practice in the age of AI"** — strategic framing for EAs. Why now. What the AI revolution does + doesn't change. How to choose tools that don't put your PTIN at risk. Mirrors Slant's "Financial advice in the age of AI" ebook.
- **Blog post 1: "RIP traditional tax practice management software"** — borrows Slant's wealthmanagement.com framing. Why TaxDome / Canopy / Karbon are last-generation. Why AI-native matters. Calls out the structural gap.
- **Customer story: Antonio at Vazant** — 90-second Loom + written long-form. Same shape as Slant's Alex Stoehr / Northstar testimonial. Quote: *"With Docket, I'm actually able to focus on the client and the position, not the busywork."*
- **Pricing-page-as-marketing**: matrix above, plus public transparent pricing per L6 lock. No "request a quote" gates on standard tiers.

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

## 8. Pricing (locked 2026-05-09 per L6)

**Posture**: tiered base + active-client metering, NOT per-seat. Per-active-client cost target $1.39/mo (heavy $4.30, medium $1.35, light $0.22; weighted by tax-season seasonality). At 200 clients per firm: ~$278/mo infrastructure cost. Drives 80%+ gross margin at peak tier usage (per L7).

Antonio's actual call price ($250/mo) honored as the **founder tier**. Standard tiers go live for firm 51 onward.

### Founder tier (first 50 firms only, year 1)

**$250/mo** — locked 2026-05-09 with Antonio.
- ≤100 active clients
- ALL agents included (Discovery, Strategy/Planning, Audit Defense, Multi-Entity Optimization)
- 30% lifetime discount when reverting to standard tier in year 2
- Selection criteria: design-partner-shape + willingness to onboard before v1 launch + commitment to provide feedback monthly

### Standard tiers (post-50-firms, year 2+)

| Tier | Base | Included clients | Overage | Max | Best for |
|---|---|---|---|---|---|
| **Solo** | $499/mo | 50 | $5/active | $749/mo | Solo EAs, 50-100 clients |
| **Small** | $1,499/mo | 150 | $5/active | $1,999/mo | 1-3 staff firms |
| **Growing** | $4,499/mo | 500 | $4/active | $5,499/mo | 5-10 staff firms |
| **Mid-market** | $14,999/mo | 2,000 | $3/active | $23,999/mo | 20-100 staff regional firms |

### Add-on agents (Solo + Small only; Growing + Mid include all)

| Agent | Add-on price | Why opt-in |
|---|---|---|
| Discovery | +$199/mo | Continuous deduction surfacing across the book |
| Strategy / Planning | +$299/mo | Multi-year scenario modeling on demand |
| Audit Defense | +$99/mo | Year-round monitoring + pre-built defense file |
| Multi-Entity Optimization | +$199/mo | Typed-graph entity workspace |

### Per-event pricing (any tier)

| Event | Price | Notes |
|---|---|---|
| Notice handled | $50 | CP2000/CP504/LT11 triage + drafted response |
| Representation engagement | $99 | Full 2848 + transcript pull + initial response |
| Incorporation | $25 + state filing fee | Form prep + filing assistance |
| BOI report | $15 | FinCEN BOI E-Filing |
| Statement of Information | $10 | CA SoS + state equivalents |
| Form 8879 envelope (DocuSign + KBA) | ~$8 passthrough | $3 KBA + $5 markup; included in tiers above 100 envelopes/mo |

### API tier (Path 2, per L1)

The orchestration platform play. Public API + MCP server ship in v1, NOT v1.5.

| Tier | Price | Calls/mo | Overage | Best for |
|---|---|---|---|---|
| **Developer** | Free | 1K | $0.005/call | Hobbyists + evaluators |
| **Partner** | $999/mo | 1M | $0.001/call | Other AI tax tools embedding Docket capabilities |
| **Platform** | Custom | Custom | Custom | Tax software vendors integrating at scale |

### Discovery Scan (productized service, V1 wedge)

**$1-5K per book scan.** The wedge demo. Antonio uploads OLT export → PDF report 24 hours later listing every defensible deduction missed on prior-year returns. Closes deals.

### V1.5 add-ons (post-7/30 launch)

- **Audit Defense subscription** (already in tiers as add-on for Solo/Small): $99/mo per firm; included for Growing + Mid.
- **Practice Intelligence module**: $99-299/mo separate (margin per client, friction score, capacity, pricing inconsistency, churn risk).
- **State compliance modules**: $49/mo per state beyond CA (TX, NY, FL launch sequence).

### V2 (2028+)

- **Memory marketplace** (anonymized examiner intelligence): $TBD; differential-privacy-protected (k-anonymity ≥10).
- **AI CPA white-label**: $TBD; firms license Docket-as-firm-brand.
- **Franchise corporate licensee deals**: $1-5M ARR potential per (Liberty Tax, Jackson Hewitt, JTH-aligned). Activate after mid-market reference customer.
- **Per-firm fine-tuning / LoRA distillation**: included in Mid-market tier; add-on for Growing.

### Pricing principles (locked)

- **Public + transparent.** No "request a quote" pages on standard tiers; the table above is the public price. Mid-market may be quote-driven for >2,000 active clients.
- **No per-return fees** on subscription tiers. Per-return is per-event-pricing-only territory.
- **No per-seat pricing.** Per-active-client metering aligns cost with value; per-seat punishes growth.
- **Annual discount: 15%** if customer pre-pays.
- **Founder-tier protection.** First 50 firms get 30% lifetime discount on year-2 standard pricing as gratitude for being design partners.
- **Active client = client with at least one of: filed return in last 12 months, active engagement letter, billable activity in last 90 days.** Inactive clients in storage don't count.

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
- [`docs/STATE.md`](STATE.md) — live state of connected systems, migrations, deployed surfaces (single source of truth for "what's connected, configured, applied")
- [`docs/security/`](security/) — SOC 2 Type II policy + procedure set per L8 lock (12-doc set: info security, access control, change management, incident response, vendor management, BCP, data classification, logging + monitoring, training, risk register, controls matrix)
- [`docs/STRATEGIC-BRIEF.md`](STRATEGIC-BRIEF.md) — full strategic synthesis (2026-05-02)
- [`docs/PERSONA.md`](PERSONA.md) — Antonio at Vazant
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) — data model, RLS, encryption boundary
- [`docs/DOCS-CAPTURE-PIPELINE.md`](DOCS-CAPTURE-PIPELINE.md) — 4-phase doc upload pipeline
- [`docs/DECISION-JOURNEY.md`](DECISION-JOURNEY.md) — chronological narrative of decisions
- [`docs/AUTONOMOUS-DECISIONS.md`](AUTONOMOUS-DECISIONS.md) — autonomous judgment-call ledger
- [`docs/SLICES.md`](SLICES.md) — user's verbatim framings
- [`COSTS.md`](../COSTS.md) — $50/mo discipline rules
- [`CLAUDE.md`](../CLAUDE.md) — canonical project context (start here on every session, especially §🔒 LOCKED DECISIONS)

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

*Last updated: 2026-05-09. Updated after the strategic Path 2 commitment locked (L1), after pricing tiers + founder-tier locked (L6 + L7), after memory architecture locked (L4), after voice transcription locked (L5), after SOC 2 Type II posture locked (L8), and after the docs/security/ doc set landed. Multi-year strategic arc added to §1. Pricing fully replaced per L6 (founder tier $250/mo for first 50 firms; standard tiers Solo/Small/Growing/Mid; add-on agents; per-event; API tier for Path 2). Companion docs updated to reference docs/security/ + docs/STATE.md. Re-read at every session start. Items get crossed out, not deleted (audit trail of decisions).*
