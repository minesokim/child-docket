# Docket

> *The agentic operator for a tax practice.*
> *Your practice. Every tool. One operator.*

This file is the canonical context for any Claude Code session in this repo. Read it cold and you should be able to ship without asking what the project is.

For deeper detail, see [`docs/STRATEGIC-BRIEF.md`](docs/STRATEGIC-BRIEF.md) and the memory mirrors in [`.claude/memory/`](.claude/memory/).

---

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

**Using gstack skills:** /office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review, /design-consultation, /design-shotgun, /design-html, /review, /ship, /land-and-deploy, /canary, /benchmark, /browse, /open-gstack-browser, /qa, /qa-only, /design-review, /setup-browser-cookies, /setup-deploy, /setup-gbrain, /retro, /investigate, /document-release, /codex, /cso, /autoplan, /pair-agent, /careful, /freeze, /guard, /unfreeze, /gstack-upgrade, /learn.

Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.

---

## 🔒 LOCKED DECISIONS — DO NOT RE-LITIGATE

These are decisions the founder + AI locked in deliberate sessions. They are NOT subject to re-debate without a written counter-case. If you (Claude) read this on session start, treat these as fixed.

| # | Decision | Locked | Why |
|---|---|---|---|
| L1 | **Path 2 commitment**: Docket is the orchestration platform that runs the firm's AI tax stack. Public API + MCP server ship in v1 as **deployable artifacts** (live endpoints, documented, partner-onboarded by direct intro). Self-serve API tier with billing infrastructure ships v1.5 — that's not a retreat from L1, it's an honest scope distinction (clarified 2026-05-11 after `/understand` audit). NOT just "AI-native PM with Path 2 hooks." | 2026-05-09 (clarified 2026-05-11) | Path 2 is the swing-for-unicorn bet; Path 1 is the floor. Hybrid is worst-of-both. v1 = MCP + API exist + first partner integrates; v1.5 = self-serve developers can swipe a card. |
| L2 | **Category positioning**: "Tax practice operating system" / "the AI-native operating system that runs the entire tax practice and orchestrates every AI tool the firm uses." NEVER call Docket "practice management" externally. The verb is "Docket it." | 2026-05-09 | Category creation requires consistency. PM-language reinforces the wrong category. |
| L3 | **5 capability pillars**: OmniContext Intelligence + Compliance-First Position Framework + Docket Prep + Strategy/Planning Engine + Year-Round Representation/Monitoring. Headline differentiator is the Position Framework with cited authority + refusal floor. Everything else is supporting cast. | 2026-05-09 | Be undeniably best at ONE thing. Buyer comparison is "60% on every dimension" loses to "100% on Position Framework." |
| L4 | **Memory architecture**: pgvector on Neon (NOT Pinecone — 220x cost difference at scale). Voyage-3-Large embeddings (legal/tax domain specialist, 4-6 pp accuracy advantage). Cohere Rerank v3.5 ($0.002/query). Tiered retention (Hot=current+last year in pgvector full / Warm=years 3-5 quantized / Cold=5+ in R2 metadata-only). Hybrid BM25 + vector with score fusion. Bidirectional client-scoped graph (every chunk has client_id MANDATORY; every retrieval logged to memory_references). Sliding-window summarization for long chat sessions. **8K context for batch agent calls; 50-200K context for interactive chat / Discovery / audit defense.** | 2026-05-09 | Performance-first; ambient feel non-negotiable. Cost optimization happens AROUND that, not instead. |
| L5 | **Voice transcription**: Deepgram Nova-3 + diarization in v1 ($0.378/hr). Migrate to Gladia Solaria-1 Growth tier in v2 ($0.20/hr with diarization bundled, ~47% cheaper at scale). Real-time streaming uses Gladia from day 1 ($0.144-0.25/hr). | 2026-05-09 | Verified pricing 2026; Deepgram cheapest batch with diarization, Gladia cheapest at $4K/yr commit. |
| L6 | **Pricing model**: tiered base + active-client metering, NOT per-seat. **Founder tier (first 50 firms only, year 1)**: $250/mo, ≤100 active clients, ALL agents included, 30% lifetime discount on year 2 reversion to standard. **Standard tiers**: Solo $499 (50 included, +$5/active, max $749) / Small $1,499 (150 + $5, max $1,999) / Growing $4,499 (500 + $4, max $5,499) / Mid-market $14,999 (2,000 + $3, max $23,999). **Add-on agents** (Solo + Small): Discovery $199, Strategy/Planning $299, Audit Defense $99, Multi-Entity Optimization $199. **Per-event**: notice $50, rep engagement $99, incorporation $25 + state, BOI $15, SOI $10. **API tier (Path 2)**: Developer free (1K calls/mo), Partner $999 (1M + $0.001 overage), Platform custom. NO per-return fees. Public, transparent pricing. | 2026-05-09 | Per-active-client metering aligns cost with value; per-seat punishes growth. Founder tier honors Antonio's $250 floor while protecting unit economics. |
| L7 | **Per-active-client infrastructure cost target**: $1.39/client/month average (heavy $4.30, medium $1.35, light $0.22; weighted by tax-season seasonality). At 200 clients per firm: ~$278/mo. Drives 80%+ gross margin at peak tier usage. | 2026-05-09 | Without this target, the business model breaks. Aggressive caching + tiered retention + smart agent gating make it real. |
| L8 | **SOC 2 Type II posture**: build all controls into the codebase NOW (audit chain, RLS, per-tenant DEK, MFA, encryption-at-rest/transit, change management, incident response, vendor management, BCP). Document policies in `docs/security/`. Defer Drata/Vanta tooling until capital lands. When tooling lands, the auditor reads existing posture; we pay for attestation, not for re-architecture. | 2026-05-09 | Without SOC 2, no upmarket sales after 25-staff threshold. Architecture is 70%+ there; documentation is the gap. |
| L9 | **NO hybrid form+AI intake. NO AI-as-chat-character.** The portal is already designed pro-human. AI is invisible infrastructure. Conversation is between client and preparer. AI is around the conversation, never in it. Single design test: can the client tell whether the preparer is here vs AI doing it? If yes, redesign. | 2026-05-09 | Pro-human-connection is the moat against TurboTax-style commoditization. AI-as-character breaks that moat. |
| L10 | **Email-in via firm's OWN Gmail (OAuth), NOT @docket.com aliases.** Inbound to firm@vazantconsulting.com (or whatever the firm's domain) → parse → file to client. Each firm links their Gmail. | 2026-05-09 | The firm's brand is on the address; @docket.com would dilute. Already shipped 80% (gmail-poll.ts). |
| L11 | **Memos as first-class objects.** Independent records (not just notes), versioned, append-only, typed (position/advice/audit-defense/planning/engagement), AI-referenceable, full-text + vector searchable, audit-trailed (chain hash), bidirectionally linked to docs/threads/positions/other-memos, surface-aware (one source of truth across UI), templated per firm. | 2026-05-09 | Memos = the firm's IP. First-class memos make a firm switching from TaxDome to Docket a one-way door. |
| L12 | **Multi-entity workspace = typed graph data model.** Person, S-Corp, C-Corp, Partnership, LLC, Trust, Estate, Sole Prop, Disregarded, Foreign Entity. Typed relationships (owns, operates, files-jointly-with, is-beneficiary-of, is-trustee-of) with percentage + effective dates + basis tracking. Cross-entity flow calculations automatic. Entity lifecycle (incorporation, dissolution, conversions, mergers, ownership changes) handled. | 2026-05-09 | Multi-entity is contested but not yet won. Instead is leading; we have a 12-18 month window to build a better model. |
| L13 | **Knowledge layer corpus**: Tier 1 federal (IRC, Treasury Regs, IRS Pubs, IRB, IRM, Tax Court, district/circuit/SCOTUS, CCAs, PLRs, TAMs) + Tier 1 state (CA first; FTB Residency Manual; CDTFA; EDD; OTA decisions). Effective-date versioning. ~100K documents, ~5-10M chunks. 4-week one-engineer ingestion project. NOT building Bloomberg Tax / Checkpoint / CCH editorial layer in year 1. | 2026-05-09 | Be the position-framework specialist, not a generic Accordance competitor. |
| L14 | **Antonio dependency mitigation**: land partner #2 within 90 days, ideally from a different segment AND different network than Antonio. | 2026-05-09 | Concentrated risk. JBH non-conversion is a real failure mode. |
| L15 | **YC target = Fall 2026** (deadline ~early August). NOT Summer 2026 (which has already passed). Apply Forum Ventures + Mucker + Anthropic Startup Program rolling this week alongside. | 2026-05-09 | Earlier session corrected Summer-vs-Fall confusion. |
| L16 | **100 paying customers by 2026-08-01** is the strategic anchor for the 12 weeks from 2026-05-11. From 1 (Antonio) today to 100 by the YC application week. Target MRR ~$31-67K depending on pricing-strategy choice (see Option C tiered scarcity recommendation in `docs/DESIGN-PARTNER-ACQUISITION-PLAN.md`). Five distribution channels (Boney-Henderson warm intro, Discovery Scan cold outreach, NAEA events, earned media, referrals) running in parallel. Five must-ship operational items gate the goal: Discovery Scan landing page (5/25), cold outreach automation (5/18), sales VA hired (5/31), CRM tracking (5/18), Boney-Henderson presentation (5/30). | 2026-05-11 | The traction story for YC + pre-seed SAFE round + mid-market partner #2 procurement signal. Aggressive but realistic; 65% confidence band on hitting 100 specifically, 90% confidence on hitting 80+. |

If you need to ADD to this list, do it via a /decisions-log entry first, then mirror the lock here. Don't lock things in this section without going through the decisions log.

---

## 1. Project identity

| | |
|---|---|
| Vision | The agentic operator for a tax practice. Top-tier preparer-grade AI animates every surface; drives the existing tax stack via API-first integrations + browser automation as fallback. |
| Pitch | "Your practice. Every tool. One operator." |
| Capacity claim (closes deals) | **Double a tax preparer's capacity.** Solo EAs serve ~150-200 clients per season at high friction today. With Docket: 400-500 with the same quality. Junior preparer salary $40-60K/yr is the cost Docket displaces. **$36K/yr saved per practitioner at $250/mo** is the closing math. Slant.app proved this works in financial advice (advisors going from 70-90 clients to 200-250+); the dynamics are identical in tax. |
| Memory architecture (stolen from Practiq + reinforced by Slant) | **"Memory scoped to the client."** Every action, doc, message lives on the client record — not in a chat thread. The practice ledger enforces this. **Memories surfaced as first-class objects** (per §8) — plain-English bullets the preparer sees on each client card, AI-curated from `client_facts` + `firm_patterns`, surfaced pre-meeting + during chat. The bet (validated by Slant): minimize custom fields, maximize AI-extracted Memories from unstructured artifacts. |
| Codename | Docket (final brand TBD; repo named `child-docket` to mark this as the consulting/services flywheel that becomes the platform) |
| Founders | **David Kim** (legal: Minseo Kim) — CEO, `minseodavid@gmail.com`. **Haokun Yang** — technical co-founder + CTO. Partners since day one (5+ year working relationship before Docket; on the project from inception). Haokun owns the codebase end-to-end — 13-table Drizzle schema with RLS, per-tenant DEK encryption, cryptographic audit chain, agent fleet, both Next.js apps in production. UCR CS background. |
| Advisory | **Antonio Vazquez, EA** — Vazant Consulting (CA). Founding design partner + **on-platform tax advisor**. All tax-domain knowledge, position validation, and Position Library content sign-off runs through Antonio (and contracted backup advisors for scale-validation when Antonio's bandwidth is constrained, e.g., during his audits). Equity advisor (1%). This is the structural answer to "where does the tax-domain depth come from"; the tax co-founder hire is explicitly closed (CLAUDE.md §21 #4) because the substrate IS Antonio + scale-validation pipeline, not an open seat. |
| Stage | Production OS build in flight (post-CEO-review 5/2/2026). Two apps deployed; 12 migrations applied; phone-OTP auth + RLS + per-tenant DEK encryption + multi-role + audit trail all live. **v1 launch: 7/30/2026 (12 weeks).** Antonio down-market sub-milestone: 5/30/2026 (4 weeks). Pre-revenue. Forward-deployed build for Antonio + mid-market partner #2. |
| Repo | `C:\Users\minse\projects\docket\` (local) ↔ [github.com/minesokim/child-docket](https://github.com/minesokim/child-docket) (private) |
| Distribution unlock | Antonio's mentor commands 1000s+ tax preparers. Get her a Docket walk-through before 5/15 demo. |

---

## 2. Strategic posture — the Palantir/Foundry route

**Dual business model. Both flywheels feed each other.**

### Today: AI engineering for tax practices (services)
- Forward-deployed embed with design partner firms
- Custom builds shipped in weeks, not months
- Each engagement produces platform IP
- Pricing band: **$10k–$25k Foundation build, $2k–$5k/mo retainer** for expansion
- Reference template: [FluentOS](https://www.fluentaiconsulting.com/fluentOS) — productized AI consulting at 3-day Foundation + monthly retainer + ownership path. They explicitly say "built on Claude Code." We follow the same pattern.

### Tomorrow: Docket — the tax practice OS (platform)
- Same multi-tenant substrate every custom build runs on
- After 5–15 engagements, ~70% of new builds reuse existing modules → SaaS unlocks
- Self-serve tier for solo EAs ($99–$299/mo + usage), retainer tier for small firms

**Why this beats "raise money, build platform, then sell":**
- Revenue from week 2, not month 18
- Each install is real product validation
- Vertical specialization is the moat — generic AI consultants cannot go this deep on tax
- Investor narrative: "consulting that becomes a platform" (Palantir/Foundry pattern)

### Not negotiable: never build snowflakes
Every consulting engagement runs on the same multi-tenant substrate. If a build can't fit, refuse the work.

---

## 3. Persona — Antonio at Vazant Consulting

The first design partner is **Antonio**, a California EA running both prep AND representation work (the full lifecycle: prep → represent → defend).

**His stack:**
- **OLT (OnLine Taxes)** — primary tax prep software. No public API. Browser automation is the only integration path. **Critical: zero AI-native competitors integrate with OLT** — this is a forced moat for Docket. **Defer to M2+; not in 5/15 v0.**
- **IRS Solutions** ([irssolutions.com](https://www.irssolutions.com/)) — tax resolution platform. **TOS forbids browser automation.** They have a **private API** Antonio can request via email. The API is the integration path. **Antonio emails them ASAP; v0 demo (5/15) ships without live integration.**
- **Xero** — bookkeeping. API-first, mature MCP wrapper available.

**Antonio's mentor:** Commands 1000s+ tax preparers in her network. The distribution unlock for partners #2–#10. Get her a Docket walk-through before 5/15. Decide before pitching: introducer? co-promoter? equity advisor? affiliate?

### Why this stack matters for build order
- Partner does both prep + rep, so Docket spans both pillars from v1 (not "prep first, rep later")
- OLT browser automation = forced integration moat
- IRS Solutions integration via browser automation gives rep-pillar capability without us building 2848/transcript/OIC plumbing ourselves
- Xero feeds practice intelligence (revenue, AR, margin per client)

### Earlier "Maria" framing
Earlier in conversation we used a hypothetical persona named "Maria" (58-year-old EA in Riverside, 240 clients, mostly Latino small business owners, 70 hr/week busy season, runs practice on WhatsApp). **That was a hypothetical illustration.** The real first partner is Antonio at Vazant. Antonio's needs override Maria's anywhere they conflict, but the underlying truth — solo/small-firm EAs are mental-load-bound, not research-bound — still anchors the product.

### Antonio's pain (validated)
- Mental load across many simultaneous engagements
- Inbox/phone tax (replies pulled from real client status)
- Doc chasing (knowing who's missing what, batching reminders)
- Margin/friction blindness across the book
- Audit-trail-as-armor (timestamped receipts of every promise)
- Notice-response volume (off-season recurring revenue)

---

## 4. The two surfaces

### Command Room (preparer surface, web + mobile)
Single pane that shows **today** and lets the preparer act on it.

- **Morning brief** — "3 deadlines, 2 e-file rejects, 5 stuck pickups, 1 high-risk position, 1 client at risk of churn". Every page in the command room opens with an **aggregate metric strip** at the top — counts, totals, dollar amounts — so the preparer's eye lands on the number first, then the list. The strips themselves hover to their source artifacts (clients, returns, dollars).
- **Need You queue** — the operational primitive that replaces "generic dashboard." Four workflow sub-sections, each its own swim-lane with its own metric:
  - **New Intakes** — clients who completed intake but haven't been routed to a preparer yet
  - **Ready to Prep** — docs gathered, intake complete, awaiting workpaper assembly
  - **Ready to File** — return drafted, awaiting review and 8879 sign
  - **Sign & File** — 8879 signed, awaiting e-file transmission
  Sub-sections are the **structural primitive**; Pipeline is the *visualization* of how clients flow between them. AI commentary on every card. The reason this beats "generic pipeline": it gives the preparer a verb ("what do I do next?") instead of a noun ("look at the board"). Inherited from v3 Vazant dashboard IA.
- **Clients page (three view toggles + freshness lens)** — Cards (default, scannable, AI commentary per card), Table (dense, sortable, filterable, exportable), **Pipeline (kanban-style across the four Need You sub-sections plus Filed and Paid)**. Same data; three lenses for different cognitive modes. Each row carries a **risk-tier pill** (green/amber/red) the firm's AI Preferences settings drive. Default sort: most-recent-activity desc; switch to touchpoint freshness lens (above) to flip into staleness-sort mode for relationship audit.
- **Prospects vs Clients vs Former Clients** — distinct entity-status states so the sales-funnel surface stays separate from the active book. **Prospects** = leads who completed a Discovery Scan or `/scan` form but haven't signed an engagement letter. **Clients** = active engagement letter signed within 12 months OR ongoing year-round arrangement. **Former Clients** = no engagement in 12+ months. Database: `client_status` enum on the existing `clients` table (no separate table — same identity primitive, different lifecycle stage). Filtering throughout command-room respects this distinction so Antonio can scope a query to "Prospects only" (sales motion) vs "Clients only" (active book) vs "Former — for win-back outreach." Discovery Scan flow auto-creates a Prospect; engagement-letter signature transitions Prospect → Client. Slant validates the distinction matters (their CRM page lists "clients, prospects, accounts" as separate concepts).
- **Calendar** — first-class top-level nav surface, not buried inside settings. Weekly view default, day/month toggles. Event types: client meetings (linked to client record), filing deadlines (per engagement, color-coded by tax form type), internal reviews, audit milestones, year-round planning touchpoints. Two-way sync with Google Calendar via the `google-calendar` MCP server (§10). Click any event → opens client/engagement workspace.
- **Unified inbox** — SMS, email, portal chat, voicemail. AI drafts replies pulled from real client state. Preparer approves. **Channel-availability icons render inline per conversation** (green = portal logged in within 24h, amber = SMS only, gray = email-only fallback) so the preparer picks the channel the client actually reads. **In-thread document handling**: when a client uploads a doc to a conversation, a `Process / Ignore` action pair appears inline next to the attachment — Process routes it through the doc-classification agent + files to the client record; Ignore archives without indexing (for off-topic forwards). Antonio's most-requested texture-win on 5/9 call.
- **Documents** — two tabs: **Client docs** (everything filed to a client record, faceted by year/type/status) and **Firm files** (engagement letters, §7216 consents, audit-defense packets, internal SOPs, position library). Aggregate metric strip at top: "47 needs review · 12 missing · $2.4M total income across 1099s YTD."
- **Touchpoint freshness view** — `/clients?view=freshness` shows every client sorted by days-since-last-meaningful-touch across all channels (email, SMS, portal chat, meeting, phone call, doc receipt). Per-engagement overdue thresholds: active engagement ≤14d / off-season ≤90d / year-round planning ≤quarterly. Red-flag column for clients who've been silent across ALL channels longer than threshold. Distinct from Need You queue (which shows clients in active workflow) — this surface catches the *off-workflow* relationship drift Slant proved is the silent churn driver in adjacent verticals. Bulk-action affordance: select N stale clients → "Draft 'just checking in' outreach" via Nudges Agent.
- **Done-for-you tasks** — every task in an engagement carries a pre-drafted action artifact when the AI can prepare one. Examples: task "Get last year's W-2 from John" auto-attaches a draft email Antonio can send with one click; task "Verify CA SoS standing for Patel LLC" auto-runs the SoS API + attaches the result; task "Draft 2024 amended return for missed §179" auto-fires the Discovery agent on John's 2024 facts + drafts the position memo. The pattern: every task is a *one-click-to-complete* affordance, not a checkbox + manual labor. Slant's framing: *"Whenever Slant recognizes that an email could help complete a task, the email will be pre-written."* For tax: emails + API calls + draft memos + 8821 prefills + Tax Pro Account form starters all qualify.
- **Pre-meeting brief automation** — N hours before any `calendar_events` entry tagged as a client meeting, the Pre-Meeting Brief Agent fires: pulls top 5 Memories for attendees, summarizes their last 3 messages, surfaces any pending TaxPositions awaiting client decision, lists open issues in their engagement, surfaces overdue payments. Output renders as a 1-page brief on the meeting card in Calendar AND drops into Antonio's inbox 1hr before the meeting. Antonio walks in with the right context every time. Distinct from the existing Pre-Signature Checklist (one specific case for 8879 sign meetings); this generalizes.
- **Magic buttons** — clickable chat commands that run a firm-authored AI workflow on the current context. Pattern: in Maria's client chat (3-scope, above), Antonio clicks "Draft Q4 planning email" → runs the firm's pre-approved planning template scoped to Maria's facts + outputs a draft for approval. Different motion than AI Tasks (which are *scheduled* + *natural-language-authored*); Magic Buttons are *on-demand* + *pre-authored*. Firms compose their own button library; templates ship with the AI Task starter gallery. The shortcut surface that closes the loop between chat questions and chat actions.
- **Memories** (per-client tab) — plain-English bullets of "what we know about this client" surfaced as a first-class object, not hidden in extension fields. Examples: *"Daughter Lily starts UC Davis Aug 2026 (AOTC + 529 windowing relevant)"* / *"Owns rental at 1244 Olive — depreciation Schedule E"* / *"Took Augusta Rule position 2024, $14K saved"* / *"Prefers SMS over email; never call between 9am-1pm — daycare hours"* / *"Spouse files MFS; works at different CPA — request Form 8958 by 2/15."*

  Memories live in `client_facts` (already shipped via migration 0021). What's NEW is the **UI surface**: a Memories tab on the client page showing curated bullets, sorted by relevance + recency. AI extracts memories continuously from messages, meeting transcripts, intake answers, and document parses. Preparer can pin, edit, delete. Pre-meeting brief auto-surfaces the top 5 Memories for the client. Slant's framing locked verbatim (per founder Thomas Clawson): *"Minimize usage of custom fields"* — Memories replace the "let me add 47 custom fields to the client schema" anti-pattern that bloats every CRM. Memory architecture L4 is the substrate; Memories is the surface.
- **Audit Trail UI** — read-only view on `actions` table per client.

  **Three-lane attribution.** Every row tinted by actor lane — AI rows on faint blue-gray tint, human rows on cream (default), integration rows on faint warm-gray. The AI/human distinction is structurally required for audit defense (§6694 needs to show *who* did *what* under *whose* authority). Deliberate divergence from Ping which conflates AI/human actions.

  **Per-row content:** Actor icon (AI glyph / user avatar / vendor logo) · timestamp · action title · 1-2 line snippet · **Tier pill** for tax-position rows (Tier 1 green / Tier 2 amber / Tier 3 orange / Tier 4 red / Refused gray) · **Cited authority** with hover-expanded text + effective-from/superseded-on dates · **Confidence** badge (H/M/L) for non-position AI · **Status pill** (open/completed/reversed/superseded) · **Cost telemetry** (Anthropic API $ per row) · **Reasoning trail** (collapsible) · **Rewind affordance** ("Reverse this action?" — gated by role + reversibility flag).

  **Rewind mechanics (critical clarification):** the audit chain is NEVER rewound. It only grows. The `actions` table is INSERT-only via Postgres trigger; nothing edits or deletes a row. "Reverse this action" appends a new audit row that says *"Reversal of action #X — reason: ..."* + executes a compensating real-world action. Both rows remain forever. Like a banking ledger — you don't erase a charge, you post a reversal. Filed IRS forms, payments via Square, third-party webhooks cannot be undone at the external system — Rewind applies to Docket-internal state only, with compensating action logged for the external case.

  **Four AI-action-attribution states:** (1) *AI took action under human authority* — AI lane tint, approving human's avatar, approval timestamp. (2) *AI surfaced a recommendation* — AI lane tint, awaiting-review pill + Tier + cited authority. (3) *Human acted on AI suggestion* — human lane tint, "AI-assisted" sub-glyph for provenance. (4) *AI auto-executed under L2-L4 trust tier* — AI lane tint with "auto-accepted" pill + link to firm's AI Preferences config that authorized it (chain-of-authorization audit).

  **Filtering:** date range / actor lane / action category / Tier / cited authority / client / preparer / cost threshold. Persistent across visits via query-params (Ping pattern). **Search:** hybrid full-text + vector across `actions.reasoning_trail` + linked artifacts.

  **Aggregate metric strip above the feed:** actions today/week/month with breakdown by actor lane · Tier classifications surfaced ("34 Tier 1 auto-accepted, 12 Tier 2 reviewed, 3 Tier 3 flagged") · dollar impact ($ tax savings YTD) · reversals YTD · authority citations used YTD. Ping does NOT surface aggregate metrics — Docket's strategic divergence.

  **IRS-defensible PDF export per engagement:** one click → 30-90 page packet with cover page (firm PTIN + tenant ID + date range) · chronological action log · per-position cite + tier + decision + human approver · chain-hash audit verification · Form 8275 attachments · engagement letter + §7216 consent + 8879 signatures · all sync events (Square deposits, DocuSign signatures, Gmail sends, Twilio SMS sends). **The packet IS the §6694 defense.** Antonio's two active 2026 IRS audits are the structural validation. Ping has zero competitor surface here.

  **Client-facing year-end PDF.** Lighter version of audit packet, same substrate — *"here's what we did for you this year"*. Retention move per Slant lessons.

  **Mobile rendering:** single-column vertical list, sticky filter chips, tap row → reasoning trail in bottom-sheet. Rewind affordance intentionally NOT shown on mobile (one-tap reversibility too risky on a phone; force desktop interaction for reversals).

  Marketing handle: *"the only tax AI where every action is reversible."*
- **Practice intelligence** — margin per client, friction score, capacity, pricing inconsistency, churn risk, "fire the bad client" insights. **Per-client risk tier** (green/amber/red) summarizes the AI's confidence in the firm-client fit (compliance posture, payment history, communication friction, scope drift). AI Preferences (§8) drive the tier thresholds; firms with conservative posture get more amber/red flags, aggressive firms get more green.
- **Outcome prediction** — position-level audit/controversy risk modeling on demand (Blue J integration, V2).
- **Command palette (Ask Docket, Cmd+K)** — fuzzy-search any action across any tool. Pull IRS transcript · file 2848 · post invoice · generate workpaper · draft notice response · sync return to OLT · request docs · run YoY diff. Every action invokes an MCP tool. Also handles **questions** (not just commands): "what's John Doe's missing docs status," "which clients haven't paid Q3 estimates." The agent shows a **multi-step reasoning trail** as it works — each sub-step (looked up client, queried engagement, checked deadlines) renders as a collapsible row so the preparer can audit *why* the answer landed where it did. Per §9, reasoning visualization is a contract on every agent output, not just Cmd+K.

  **Three-scope chat split** (locked 2026-05-13 after Slant.app research): the same Ask Docket surface auto-scopes to *where the preparer invoked it*, not one global chat. Three scopes:
  - **Client chat** — invoked from a client page (or `Cmd+K → @ClientName`). Scoped to that client's facts, engagements, prior returns, memos, signatures, messages. Answers like "what did we promise Maria about Q3 estimates" stay tight.
  - **Meeting chat** — invoked from a meeting transcript (when Notetaker lands, V1.5). Scoped to that meeting's transcript + linked client record. Answers like "what did Antonio commit to in this call" + auto-extracts action items.
  - **Book chat** — invoked from the global palette with no client context. Scoped to the entire firm's clients, engagements, calendar, position library. Answers like "which Schedule C clients haven't paid Q3 estimates" or "show me everyone whose business hit $250K rev this year."

  Same model, same retrieval substrate (PostgresRetriever + Voyage + Cohere Rerank). Scope is a system-prompt parameter + retrieval filter, not three separate agents. Slant has client / meeting / book chat as three distinct UI surfaces — we adopt the pattern.

- **Projects** — a third organizing primitive alongside per-client view and per-status view (Need You queue). Each project is a recurring workflow type the firm runs many clients through. Templates ship out-of-the-box and firms customize. Canonical v1 templates:
  - **Annual Return Prep** (per tax year, branched by form type — 1040/1120-S/1120/1065)
  - **Discovery Scan** (book-wide deduction surfacing, the wedge offering)
  - **Audit Defense Engagement** (per active audit)
  - **Notice Response Workflow** (CP2000 / CP504 / LT11 et al.)
  - **Quarterly Estimated Payments Cycle** (4 per client per year)
  - **Incorporation** (new entity creation, CA SoS + BOI + Form 8832 election)
  - **BOI Annual Filing**
  - **Year-Round Planning Touchpoints** (Q2 extension / Q3 estimates / Q4 Roth conversion windows)
  - **Statement of Information Renewal**
  - **Pre-Filing IRS Reconciliation** (W&I transcript pull → compare to client-uploaded docs → flag missing forms before IRS auto-letter)
  - **8821 Transcript Pull Cycle** (per quarter for monitored clients)
  - **Client Onboarding** (intake → docs → engagement letter → §7216 → deposit)

  Different lens than per-status (Need You): a Project view shows "all 47 clients currently in Annual Return Prep + their stage." A Need You lane shows "all 12 clients in Ready to File regardless of which project." Both lenses operate on the same engagement state machine. Engagement is the noun; lane + project are two lenses on the same noun. Inherited from v3 Vazant IA (project_management module concept) + Slant.app validates with their templates (Onboarding / RMDs / Money Movement / Annual Review).

### Client Portal (taxpayer surface, mobile-first 390×780 iOS)
**Mediated by AI, gated by Antonio.** The taxpayer never interacts with an autonomous AI. Every AI action is preparer-approved.

**Critical: every client-facing message is preparer-reviewed and signed under the preparer's name.** AI drafts; preparer reviews; preparer sends. The text that lands on Maria's phone has Antonio's name signed at the bottom, written in Antonio's voice (learned from past sent messages). Antonio can edit before sending. Per L9: AI is invisible infrastructure; the conversation is between client and preparer; the client should never know AI noticed something, only that their preparer is on top of things.

The single design test: if a Memory-triggered outreach (e.g., the AOTC reminder when a client's kid starts college) would feel "creepy" or "surveillance-like" to the client, the framing is wrong. Always lead with the relationship moment, not the data point. *"Congrats to Lily on UC Davis!"* not *"Your daughter Lily starts UC Davis this fall."* The preparer's review pass catches creepiness.

Two surfaces inside the portal:
1. **Intake (38 routes, 25-step declarative flow)** — Login → SMS OTP → Welcome → Quick-start (name/DOB/email) → Tutorial → Service path → Personal → State → Filing status → Spouse → Dependents (count + per-dep detail) → Income (incl. self-employment, rental detail) → Tax questions → Deductions → Life events → Refund pref → Document upload (4 phases: empty → AI scanning → retake prompt → AI parsed → saved) → Engagement letter → §7216 consent → Schedule appt → $50 deposit → Done. Single source of truth: `apps/client-portal/src/lib/intake-flow.ts` — 25 steps with `isApplicable()`, `isComplete()`, `next()` per step. Continue button gated by `canAdvanceFromStep` per step (with `STEPS_WITHOUT_GATE = ['docs']` exemption).
2. **Returning portal (5 tabs)** — Home · Docs · Messages · Signatures (with 8879 sign flow) · Profile, plus an AskAntonioChat overlay. **Reality:** layout exists; the five tab pages are placeholders pending production data flows.

**Stage-specific portal status messages.** The Home tab renders a single primary card whose copy is driven by the client's current engagement state. Five canonical states map to five distinct copy + CTA combinations:

| Stage | Status copy | Primary CTA |
|---|---|---|
| **First-time intake incomplete** | "Welcome — let's get to know you. ~12 minutes." | Resume intake |
| **Docs received, awaiting prep** | "We have your docs. Antonio is preparing your return." | View checklist |
| **Review-ready (8879 pending)** | "Your return is ready. Sign by [deadline]." | Sign 8879 |
| **Filed, refund expected** | "Filed [date]. Refund $X expected [window]." | Track refund |
| **Off-season, year-round mode** | "Tax year [yr] done. Anything change? Let Antonio know." | Plan ahead |

State machine drives copy; firms cannot edit individual messages, but the firm-owner-display token (firm name, owner name) is interpolated at render time.

**Five video portal touchpoints.** Stage-aware video slot on the Home tab. Same five states above map to five firm-recorded clips (or fallback Antonio template if firm hasn't recorded their own). The video plays inline on first arrival per stage; subsequent visits show a thumbnail with a "Watch again" affordance.
- *First-Time* — firm intro, what to expect, doc list overview
- *Returning* — "good to see you again, here's what's new this year"
- *Docs Received* — "we got everything, here's the timeline"
- *Review-Ready* — walks the client through their return before they sign
- *Post-Filing* — "filed, here's what happens next, here's what to keep an eye on Q3-Q4"

Recording UI is in command-room **Settings → Client Experience → Portal Videos**.

**Welcome message customization (per-firm).** Firm sets the Welcome screen copy + intro paragraph + optional logo upload (otherwise defaults to firm-name typography). Lives in command-room **Settings → Client Experience → Portal Branding**.

**Custom client-portal subdomain.** Per-firm CNAME (e.g. `clients.vazantconsulting.com`) maps to Docket's portal infrastructure. Firm logo, color tokens (within Docket's tone constraints — editorial-warm-only, no shadcn drift), Twilio sender ID, Square account, Gmail OAuth, DocuSign account all unified under the firm brand. V1.5 (post-7/30; tenant #2 onboarding gate). Substrate exists in `tenant_credentials`; UI + CNAME provisioning is the gap.

Bilingual support as configuration (Spanish, Mandarin, Vietnamese, Tagalog) — not a separate product. Not yet implemented; English-only for first cohort.

### Design source files (legacy, mostly historical)
Original location: `C:\Users\minse\Downloads\docket-portal-design\`

- `Docket Client Portal - Standalone.html` — original standalone prototype (2.6MB)
- `components/*.jsx` — 23 React components, ported into `packages/ui/src/components/`
- `components/tokens.jsx` — ported into `packages/ui/src/tokens.ts` and `packages/ui/src/styles.css`
- `assets/antonio.webp` — Antonio's headshot for AvatarSlot, lives in `apps/client-portal/public/antonio.webp` today

The repo is now the source of truth for design. The Downloads folder is preserved for historical reference only; do not edit it.

---

## 5. Engine architecture — the four layers

The product is **practice management surface + agentic engine** built as four layers:

```
┌─ 1. Knowledge layer ──────────────────────────────────┐
│  Versioned tax graph                                  │
│  Authority · TaxConcept · WorkflowObject ·            │
│  FactPattern · DecisionRule · PlanningStrategy        │
│  IRS + CA FTB + CDTFA + EDD primary sources           │
│  Internal playbooks (the real moat)                   │
├─ 2. Orchestration layer ──────────────────────────────┤
│  Today: Direct Anthropic SDK + thin Docket wrapper    │
│  (cost telemetry, prompt caching, audit hook,         │
│   model tiering). 109 LOC in services/orchestrator.   │
│  Tomorrow: migrate to Claude Agent SDK once MCP       │
│   gateway lands. Dependency already installed.        │
│  Multi-tenant + RLS + audit trail are real today.     │
│  Trust escalation, agent fleet routing, skill         │
│  registry are paper specs (NOT built yet).            │
├─ 3. Rules layer ──────────────────────────────────────┤
│  Deterministic calculators OUTSIDE the LLM            │
│  Tax math, threshold/phaseout logic, form mappings    │
│  TypeScript rules engine. Never let Claude do tax     │
│  arithmetic on a return.                              │
├─ 4. Trust layer ──────────────────────────────────────┤
│  Citations + confidence scores + red-flag triggers    │
│  Mandatory human signoff for material-risk areas      │
│  Per-tenant × agent × action-class trust gates        │
└────────────────────────────────────────────────────────┘
```

**Core principle:** LLM reasons, graph knows, rules calculate, tools act.

---

## 6. Tech foundation — locked decisions

**These should NOT change as we build:**

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript end-to-end** | Frontend-backend cohesion. SDK is TS-first. Inngest is TS-native. Single language across the team. Python rejected (junior dev's instinct) because we're B2B SaaS-with-Claude, not ML-first. |
| Substrate (today) | **Direct `@anthropic-ai/sdk`** wrapped in `services/orchestrator/runDocketAgent` | 109 LOC. Cost telemetry + prompt caching + audit hook + model tiering. Used by `services/workers` agents (triage-classifier, inbox-drafter). |
| Substrate (next) | **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) | Already a dependency, not yet imported. Migrate once `mcp-gateway` exists and we want MCP-native tool routing + lifecycle hooks. |
| Inference | **Direct Anthropic Claude + ZDR + Bedrock fallback** | Bedrock as automatic per-tenant fallover (`callClaudeWithFallover`, shipped). Orchestrator is provider-agnostic at the interface, Anthropic-native at the policy layer (see Anthropic-vs-OpenAI rationale block below). |
| Model tiering | **Haiku 4.5 for extract/classify, Sonnet 4.6 for most agent runs, Opus 4.7 only for hard reasoning** | 4×–10× cost reduction vs Opus-everywhere. Haiku is the dev default. |
| Caching | **Prompt caching aggressive** on system prompts, knowledge bundles, playbooks | 80–90% cost drop on repeated calls. Wired into orchestrator from day 1. |
| Integration | **MCP gateway** as only abstraction layer | Browser automation + APIs both wrapped as MCP tools. Agent doesn't know which path. |
| Primary integration | **Browser automation** (Playwright + Computer Use) | Vendor-neutral, works against any system. TaxGPT/Filed/Grove validate the pattern. Antonio already operates this way. |
| Frontend | **Next.js 15 App Router** + Tailwind v4 (layout only) + custom Docket tokens | NO default shadcn aesthetic. Editorial cream + forest green oklch. |
| ORM | **Drizzle** | Type-safe, RLS-friendly, lighter than Prisma |
| DB | **Postgres 16** (Neon free tier dev, hosted prod TBD) + **pgvector** | Multi-tenant via RLS. Vector embeddings in same DB. |
| Auth | **Clerk** | Phone-based magic auth + SMS OTP via Twilio. Organizations primitive. Free up to 10k MAU. |
| SMS | **Twilio** | OTP + future unified inbox |
| Payments | **Square API** (deposit + future invoicing) | Antonio already uses Square day-to-day. Checkout link + webhook for deposit collection. 2.9% + $0.30 / txn. |
| 8879 e-signature + KBA | **DocuSign embedded signing API** (v0) → **Documenso self-hosted + LexisNexis InstantID Q&A** (v1+) | IRS Pub 1345 requires credit-bureau KBA on every remote 8879 signing — NIST IAL2 standard. Stripe Identity does NOT satisfy this (it's selfie+ID, not credit-bureau-sourced). DocuSign's KBA add-on uses LexisNexis under the hood. ~$3/KBA via DocuSign, ~$1.50/KBA wholesale via direct integration. |
| Storage | **Cloudflare R2** | S3-compatible, no egress fees |
| Background jobs | **Inngest** | Durable execution. Critical for multi-minute browser automation runs. |
| Vector | pgvector in same Postgres | No separate vector DB at v0. |
| Observability | **OpenTelemetry → Honeycomb** (or Datadog) | Every tool call is a span. |
| Hosting | **Vercel Pro** (Next.js apps, $20/mo — NOT Hobby) + **Fly.io** for Playwright workers when browser automation lands (M2+) | Hobby is forbidden by Vercel for commercial use. See `docs/HOSTING.md`. |
| Database | **Neon Launch** ($19/mo, auto-suspend OFF) | Was: Neon Free. Free tier auto-suspends after 5 min and adds cold-start latency that breaks the 10-min Gmail poll. |
| Secrets | `.env.local` for dev → **Infisical** for prod | Per-tenant credential vault for browser automation. |

### Anthropic-native vs OpenAI rationale (locked 2026-05-13 after Slant.app benchmarking)

Slant.app publicly built their AI-first CRM on **OpenAI GPT-5**. We're on **Anthropic Claude (Sonnet 4.6 / Opus 4.7 / Haiku 4.5) + AWS Bedrock fallover**. Different choice, deliberate. The case for Anthropic in tax specifically:

1. **Hallucination calibration matters more in tax than in advice.** A wrong tax position carries a $580 Form 8867 penalty per occurrence + §6694 preparer penalty exposure. Anthropic's Constitutional AI training + RLHF prioritize "I don't know" over confident-wrong. Calibration audits across 2024-2026 consistently show Claude refuses more aggressively when the model lacks certainty. For wealth-advisor-style outputs (which Slant ships), GPT's "always answer something" posture is fine. For PTIN-on-the-line outputs (which we ship), Claude's posture is structurally safer.

2. **Zero Data Retention by default.** Anthropic's enterprise tier (which our `@anthropic-ai/sdk` direct API surfaces) supports ZDR — prompts + completions are not stored for training. OpenAI's enterprise tier also offers this, but the configuration story is sharper at Anthropic (single flag vs multi-step opt-out). For SOC 2 Type II posture (L8) + downstream regulated-data buyers, the simpler ZDR story is the right pick.

3. **Prompt caching discount is more aggressive.** Anthropic caches at 90% discount on cached input tokens vs OpenAI's 75% discount. For our usage pattern (5K-token system prompts on every Discovery / Position / Inbox-Drafter run), this compounds. Cost discipline per §7 + COSTS.md depends on this discount.

4. **Tool-use + Computer Use are first-class.** Claude's tool-use API + Computer Use beta are the substrate for the Browser-automation MCP servers we'll build for OLT + IRS Solutions + IRS Tax Pro Account. OpenAI has function-calling but lacks the Computer Use equivalent today (May 2026); this matters for our integration moat.

5. **AWS Bedrock fallover already shipped.** When primary Anthropic API has a capacity issue (verified 2026-05-12 during overnight build), our orchestrator transparently fails over to Bedrock-hosted Claude in us-east-1. Same model, different infrastructure path, zero downstream-call code changes. This is a resilience capability OpenAI doesn't expose at parity (Azure OpenAI is the closest equivalent but governance + region selection is tighter on Bedrock).

6. **Voyage-3-Large embeddings** (L4) are tax/legal-domain-specialized — Voyage's training corpus over-indexes on legal + financial + regulatory documents. OpenAI's `text-embedding-3-large` is general-purpose. For our authority-grounded retrieval (Discovery + Position + audit-defense), Voyage's 4-6 percentage point accuracy advantage on tax-position retrieval is material. **This is a deliberate non-OpenAI stack choice that compounds with the Anthropic decision.**

**As a marketing signal:** Slant pitches "AI-first" but the *quality* of the AI matters less in wealth advice (the human still decides). In tax, the AI's quality is the moat — Antonio's PTIN trusts the cited authority. We should publicly explain our Anthropic + Voyage + Cohere stack as a deliberate compliance-first choice, not an implementation detail. Talking point: *"We chose Anthropic because their model refuses more honestly when it's uncertain. For your PTIN, that matters."*

### What we explicitly REJECTED as base
- **OpenClaw** — personal AI, single-tenant, full-trust permission model. Adopt patterns (local gateway, messaging-as-UI), not codebase.
- **Hermes Agent** — same problem. Adopt the skills/learning loop concept (write reusable skill docs, search past), not the framework.
- **LangGraph** — overkill for v0; revisit if checkpoint/time-travel becomes critical.
- **CrewAI** — nice prototyping DSL, you'll outgrow it.
- **Mastra** — option B if we go TS-only and need serverless first.
- **Claude Code CLI subscription** as production inference — against ToS, can't multi-tenant, no SLA. (Use it for DEV only, which we do.)
- **Python/FastAPI backend** — junior dev's instinct, rejected. We're B2B SaaS, not ML-first.
- **AWS Bedrock from day 1** — defer until first compliance customer asks. Direct Anthropic + ZDR is the v0 default.
- **Bloomberg/CCH/Checkpoint editorial year 1** — primary sources (IRS/FTB) + internal playbooks are the moat.
- **WhatsApp v1** — SMS + email + voice + portal chat is enough.

---

## 7. Cost discipline — $50/mo target

**Target: $50/mo Anthropic API spend** during the v0 build (plus existing Claude Code Max $100/mo subscription).

See [`COSTS.md`](COSTS.md) for the full rules. Summary:

1. **Claude Code Max ($100/mo, already paid)** is the primary dev tool. All code-writing, debugging, file editing routes through it. Absorbs ~80% of build cost.
2. **Default test model: Haiku 4.5.** Every prompt iteration runs on Haiku first. Promote to Sonnet only for end-of-week integration tests.
3. **Prompt caching, always.** Pass `cachedSystem: true` whenever the system prompt is reused.
4. **Computer Use deferred to week 7+.** Mock the OLT/IRS Solutions UI during phase 1–2.
5. **External integrations mocked during dev** via VCR cassettes / fixtures.
6. **Free-tier infrastructure** until first paying customer: Neon, Vercel, Clerk, R2.

### Reference numbers (April 2026)

| Model | Input ($/M) | Output ($/M) | Cached input ($/M) |
|---|---|---|---|
| Haiku 4.5 | $0.80 | $4.00 | $0.08 |
| Sonnet 4.6 | $3.00 | $15.00 | $0.30 |
| Opus 4.7 | $15.00 | $75.00 | $1.50 |

Hello-world (32 in / 28 out, no cache) on Sonnet = **$0.0005** (verified). On Haiku = **$0.0001**.

### Discipline questions before any new test/iteration
1. Can this run on Haiku?
2. Is the system prompt cached?
3. Is the external API mocked?
4. Am I about to run Computer Use without a real demo reason? — if yes, **stop**.

---

## 8. The six intelligence layers + trust escalation

### Six intelligence layers (every UI surface inherits one)
1. **Client Communication Intelligence** — escalating context, tone calibration, silence detection, channel awareness
2. **Document Intelligence** — completeness scoring, anomaly detection, quality checking, cross-doc validation, duplicate detection
3. **Pipeline & Workflow Intelligence** — stage advancement recommendations, priority sequencing, bottleneck detection
4. **Financial & Billing Intelligence** — invoice timing, revenue forecasting, payment follow-up
5. **Prep & Return Intelligence** — pre-prep summaries, post-prep review, YoY client intelligence
6. **Practice-Level Intelligence** — seasonal pacing, client acquisition patterns, pricing optimization

### Position framework (the deduction / gray-area surface)

**See [`docs/POSITION-FRAMEWORK.md`](docs/POSITION-FRAMEWORK.md) — canonical, do not duplicate here.**

Summary: every deduction or position the AI surfaces is classified into one of four confidence tiers (Settled law / Substantial authority / Reasonable basis + 8275 / More likely than not), plus a hard refusal floor below Reasonable Basis. Each surfaces as a structured `TaxPosition` object with cited authority captured at decision time. EA always decides; AI never auto-files a position above Tier 1. Three modes: Discovery (continuous, the wedge), Strategy (EA-initiated multi-year modeling), Position (aggressive client request → strongest defense or refusal).

Marketing locked: never "AI maximizes deductions" or "loophole finder." Always "catches every defensible deduction your team would have caught with unlimited time" + "audit trail built in." The framework IS the differentiator vs Big-4-targeted competitors who don't carry an Antonio-equivalent EA's PTIN risk.

### Trust escalation model

Generic levels (legacy framing — read for context, but enforcement maps to position tiers per POSITION-FRAMEWORK §6):
- **Level 1 (Week 1–2):** Suggest and explain, verbose reasoning, every action requires approval
- **Level 2 (Week 3–4):** Suggest with shorthand, compressed commentary
- **Level 3 (Month 2+):** Auto-execute low-risk with notification, preparer reviews logs
- **Level 4 (Season 2):** Full autopilot for known patterns, exception-based only

For deduction / return positions specifically, the levels gate which tier auto-accepts:
- **L1 firm**: AI proposes, EA decides every Tier 1-4 position. Antonio's starting state.
- **L2 firm**: Tier 1 auto-accepted; Tier 2-4 EA decides. Logged.
- **L3 firm**: Tier 1-2 auto-accepted; Tier 3-4 EA decides. Weekly L1-2 audit review.
- **L4 firm**: Tier 1-2 auto-accepted; Tier 3 auto-flags + default disclosure; Tier 4 EA decides.

Tier 4 always requires human attestation. Below Reasonable Basis always refuses. These never escalate.

### AI Preferences (per-tenant configuration surface)

Firm-level configuration of how the AI talks, what it surfaces, what it suppresses. Lives in command-room **Settings → Intelligence → AI Preferences**. Maps to a new `tenant_ai_preferences` table (one row per tenant, JSONB-extensible). Drives every agent's system-prompt assembly + insight-suppression filter.

| Setting | Type | Default | Effect |
|---|---|---|---|
| **Tone** | enum (`professional` / `warm` / `direct`) | `warm` | System-prompt injection on every Inbox Drafter + portal-message agent call |
| **Discovery insights** | toggle | on | Whether Discovery Agent surfaces deduction opportunities on dashboard |
| **Compliance flags** | toggle | on | Whether the system surfaces Tier 3/4 positions for review |
| **Risk-tier classification** | toggle | on | Whether client-risk pills (green/amber/red) render anywhere |
| **Deadline alerts** | toggle | on | Whether the Morning Brief surfaces deadline risk |
| **Pricing inconsistency alerts** | toggle | on | Practice-intelligence pillar; firm may turn off if scope-creep tracking feels intrusive |
| **Churn risk alerts** | toggle | on | Practice-intelligence pillar |
| **Capacity warnings** | toggle | on | Manager mission-control surface (V1.5) |
| **Docket Personality** | free-text (≤500 chars) | empty | Optional firm-specific tone tweak appended to every agent's system prompt ("we always close emails with 'Stay well —' instead of 'Best,'"). Stored in plaintext. Visible to firm-owner only. |
| **Quiet Hours** | time range (default 7pm-7am local) | on | Suppresses non-critical agent-initiated comms (drafts queue up; nothing sends to clients during quiet hours). Reminders + Notifications honor this same setting. |

Trust-tier level (L1-L4 above) is also surfaced here as a single dropdown, but changes write to `tenants.trust_tier` and route through the same trust-gate enforcement code paths. AI Preferences settings do NOT bypass the position-tier gates — they shape how the AI *talks*, not what it's allowed to *do*.

### Insight severity
- **Green** (informational) · **Amber** (needs attention) · **Red** (critical / deadline risk)

### When to show insights
Always show when AI has concern/recommendation/action. One-liner when progressing normally but something notable. Show nothing when truly on track — **silence IS the signal.**

### Canonical insight format

Every AI-surfaced alert renders in the canonical form: **`{ClientName}'s {situation} · {quantified impact}`**.

Examples (locked from v3 Vazant dashboard, refined for compliance-first frame):
- *Maria Ortega's Q3 estimated payment due Sept 15 · est. $4,200 underpayment penalty if skipped*
- *John Doe's 1099-NEC from Acme missing · $87K reportable, IRS auto-letter risk*
- *Boney-Henderson LLC's Statement of Information overdue · CA SoS suspension risk in 23 days*
- *Patel Family's Augusta-rule deduction (Tier 2, Substantial Authority) · est. $14K savings*

The quantified-impact half is what makes the alert *legible* — preparers triage by dollar amount + deadline distance, not by alert title. Agents that can't quantify impact don't surface as alerts; they go to the secondary "informational" queue.

### Nudges (life-event + drift + milestone surface)

Locked 2026-05-13 after Slant.app research. **Nudges** are the proactive outreach surface — different from Discovery (which surfaces tax positions across the book), Strategy (EA-initiated multi-year modeling), and Position (aggressive client request → defense/refusal). Nudges fire on **life events, time-window drift, and client-fact milestones** that suggest the preparer should reach out *before the client knows they need to*.

**The Slant frame** (lifted verbatim from their pitch): *"Slant scans your entire book of business daily to spot the moments that matter most, like when a client's child starts college, their business hits a new milestone, or their portfolio just out of alignment, so you can reach out with perfect timing."* — same primitive, tax-specific triggers.

**Trigger taxonomy** (`nudge_rules` table — paper spec; ships V1.5 alongside Reminders/Notifications substrate):

| Trigger class | Example triggers | Outreach pattern |
|---|---|---|
| **Life event** | Child turns 18 (no longer dependent) · child starts college (AOTC eligibility) · marriage · divorce · spouse death · birth · property purchase · home sale · inheritance · job change | Pre-drafted email + suggested talking points |
| **Time window** | Q2 estimated payment due (June 15) · Q3 estimated (Sept 15) · Q4 Roth conversion window (Oct-Dec) · open enrollment season (Nov) · BOI deadline cohort · Statement of Information annual · RMD age 73 turnover | Pre-drafted reminder + planning conversation |
| **Drift** | W-2 jumped 40% YoY (Roth conversion conversation) · 1099 income tripled (S-corp election timing) · new business income on bank feeds (entity choice review) · state residency change (multi-state apportionment) · charitable giving doubled (bunching strategy) | Pre-drafted strategy memo + scenarios |
| **Milestone** | Business hits $250K rev (S-corp election threshold) · **business hits §199A phaseout edge** (planning conversation locked from pitch script — Nudges flagship example) · LLC formed (BOI deadline starts) · client crosses $1M net worth (estate planning conversation) · home value crosses $500K (cap gains exclusion planning) · **client's entity falls out of state standing** (CA SoS / FTB suspension risk — locked from pitch script) | Pre-drafted "here's what changes for you" |
| **Drift-from-prior-year** | Refund dropped 60% YoY · withholding pattern changed · new state tax return needed · deduction posture flipped (itemized → standard or reverse) | Pre-drafted YoY explainer for portal |
| **Compliance / risk** | Statement of Information overdue · BOI not filed within 90d of formation · CA SoS suspension risk · payment past due | Pre-drafted action item with deadline |

**How Nudges differ from Discovery + Reminders:**

- **Discovery** surfaces tax positions (deductions/credits/elections) across the book continuously. Output = `TaxPosition` objects, surfaced to a Discovered queue.
- **Reminders** chase clients who owe us something (missing docs, unsigned 8879). Output = scheduled outbound to the *client*. Rules in `reminder_rules` (shipped C13).
- **Nudges** push the *preparer* to reach out to clients before clients know they need to. Output = pre-drafted preparer-to-client outreach + planning prompt. Daily-firing on a `nudge_rules` table.

A Nudge is a *moment-that-matters* surfaced for human approval. Antonio sees: *"Maria Ortega's daughter Lily starts UC Davis Aug 25 — AOTC + 529 conversation. Draft ready."* He clicks Approve, the email goes; or Edit, then send; or Dismiss with a reason that trains the model.

**Implementation:** the v1 Nudges agent reads `client_facts` (life events, current-year income vs prior, business state) + `engagement` state + `calendar_events`. Each rule is a SQL query + a Sonnet prompt that drafts the outreach. The daily Inngest cron walks the rule set and queues approved-pending drafts. Pre-meeting briefing automatically surfaces pending nudges for that meeting's attendees.

**Why this matters strategically:** Slant prices Nudges as a distinct line item on their pricing page (✓ Slant only / – Wealthbox / – Redtail). It's a category-creation differentiator. Our analog: nobody at the tax-vertical PM tier (TaxDome/Canopy/Karbon) does life-event-driven proactive outreach; nobody at the return-prep AI tier (Black Ore/Accrual/Basis) does outreach at all. Nudges is structurally open white space.

### Automated Reminders (per-tenant configuration)

Firm-level rules for how the AI nudges clients. Lives in command-room **Settings → Practice → Automated Reminders**. Maps to a new `reminder_rules` table (one row per (tenant, trigger) pair). The five canonical triggers:

| Trigger | Default cadence | Channel | Default state |
|---|---|---|---|
| **Missing documents** | every 3 days, max 5 attempts | SMS → email fallback | on |
| **Engagement letter unsigned** | every 2 days, max 4 attempts | email + portal | on |
| **8879 awaiting signature** | every 24h, max 3 attempts | SMS + email | on |
| **Outstanding balance** | weekly | email | on |
| **Year-round planning touchpoint** | quarterly (Q1: extension; Q2: estimates; Q3: estimates; Q4: planning + Roth conversion window) | email | off (opt-in per firm) |

Each rule carries: enabled flag, cadence (interval + max attempts), channel preference (SMS/email/portal/all), Quiet Hours respect (always on, inherited from AI Preferences), per-client opt-out (so a known-difficult client can be excluded). Antonio's most-pained-by item from the 5/9 call ("I get so many emails that you forget to answer one") — but the rule applies to *clients forgetting us*, not vice versa.

### Notifications (per-tenant configuration)

Firm-level rules for how Docket nudges *Antonio* (the preparer). Lives in command-room **Settings → Practice → Notifications**. Maps to a new `notification_prefs` table. Four event categories × three channels:

| Category | Description | SMS | Email | In-app |
|---|---|---|---|---|
| **Deadlines** | engagement deadlines crossing threshold (default 7d) | on | on | on |
| **AI alerts** | Discovery findings + Tier 3/4 position flags | off | on | on |
| **Client activity** | new portal logins, message replies, doc uploads | off | off | on |
| **System** | billing, integration failures, vendor outage | off | on | on |

Per-category × per-channel toggle. Plus a **Threshold** slider per category (deadline distance, AI-alert severity floor, etc.). Quiet Hours inherited from AI Preferences (suppresses all SMS/in-app; email queues for 7am delivery).

### Refund / Payment policy display

The deposit + payment surfaces (portal `/deposit` step, command-room invoice pages) carry a **per-firm refund policy** block sourced from `tenant_settings.refund_policy_md`. Firms author once in Settings → Practice → Billing → Refund Policy. Renders inline at checkout *before* the client commits the deposit. Prevents the "I didn't know about your refund policy" dispute that escalates to chargeback.

### Why this matters
The core product differentiator. Competitors show dashboards you read. Docket shows recommendations you act on. Every UI component asks "what would the AI say here?" Cards have space for commentary. Group by action type, not just pipeline stage.

---

## 9. Agent fleet

### Actually built and tested (as of 2026-05-15)
All live in `services/workers/src/agents/`. All call `runDocketAgent` for cost telemetry + audit hook. Test coverage varies; the four newest have dedicated test files at `services/workers/src/agents/*.test.ts`.

| Agent | Model | Status | Notes |
|---|---|---|---|
| **Triage Classifier** | Haiku 4.5 | ✅ Built + tested | Classifies an inbound signal (Gmail message, doc upload, etc.) into one of 11 `issue_type` enum values with confidence + reasoning. JSON-schema-validated output. ~165 LOC. |
| **Inbox Drafter** | Sonnet 4.6 | ✅ Built + tested | Drafts a reply in Antonio's voice (bilingual, channel-aware) with confidence + reasoning. ~295 LOC. Voice rules anchored at `packages/prompts/src/inbox-drafter.ts`. |
| **Doc Classifier** | Haiku 4.5 (vision) | ✅ Built (Claude Vision OCR) | Classifies uploaded documents (W-2 / 1099-NEC / 1099-K / 1099-INT / 1099-DIV / K-1 / driver's license / etc.) post-OCR. ~170 LOC. Per the multi-page DL routing + Tesseract→Claude Vision engine swap. |
| **Discovery Agent** | Sonnet 4.6 | ✅ Built + RAG-grounded + tested | The wedge agent. Position Framework run over IntakeState + doc summaries. RAG via `PostgresRetriever` (BM25 + Voyage-3-Large cosine + RRF fusion). ~728 LOC. Trust-gate enforced on output. Test coverage at `discovery-agent.test.ts` + `discovery-agent.format.test.ts`. |
| **Memory Curator** | Haiku 4.5 | ✅ Built + tested | Extracts Memories from inbound messages + doc parses + intake answers → writes `client_facts` rows. ~210 LOC. Test at `memory-curator.test.ts`. |
| **Nudge Agent** | Sonnet 4.6 | ✅ Built + tested | Life-event + drift + milestone surface (Slant marquee feature, locked 2026-05-13). Daily Inngest cron walks `client_facts` + `engagement` state + `nudge_rules`. ~250 LOC. Test at `nudge-agent.test.ts`. |
| **Notice Triage** | Haiku 4.5 | ✅ Built | IRS-notice classifier (CP2000 / CP504 / LT11 et al.). ~225 LOC. |
| **Notice Drafter** | Sonnet 4.6 | ✅ Built | Drafts notice-response cover letter + redacted-return references. ~305 LOC. |

### Inngest functions (mostly shipped)
Nine functions are registered in `services/workers/src/functions/`. Most are wired end-to-end; the original "8× `TODO(week-1)` markers" caveat from the 5/2 revision is now stale — current count is 1 remaining `TODO(week-1)` (Twilio inbound → downstream classification).

- `gmail-poll.ts` — Gmail OAuth + tenant scan every 10 min. **Shipped.** Feature-flagged `ENABLE_GMAIL_POLL`.
- `classify-gmail-message.ts` — event-driven Gmail → triage-classifier → issue + draft persistence. **Shipped.**
- `classify-document.ts` + `finalize-document.ts` — full doc-classification pipeline. **Shipped.**
- `classify-notice.ts` — IRS-notice classification. **Shipped.**
- `cost-outlier-alert.ts` + `cost-runaway-alert.ts` + `cost-spike-alert.ts` — cost-telemetry alarms.
- `verify-actions-chain.ts` — nightly cryptographic audit-chain verification (per migration 0022).

### Designed but NOT built
| Agent | Status | Why deferred |
|---|---|---|
| **Morning Brief** | Paper spec only | Needs `ledger`, `knowledge`, `xero` MCP servers (none built); Gmail integration is flowing now but downstream brief composition isn't wired. |
| **OLT Prep Handoff** | Paper spec only | Needs `olt` browser automation MCP server (not built; M2+ per build order). |
| **Tax Reviewer Agent** *(filing-time gate)* | Paper spec only | Triggered when preparer clicks "Review before file" on a return. Looks at completed return + source docs + math + form structure. Outputs: errors blocking file, errors needing disclosure, cosmetic auto-fixes. Discovery findings can become Tax Reviewer blockers. Different mental model — Discovery is proactive scanner; Tax Reviewer is gate before filing. Both needed. |
| **Strategy Agent** *(EA-initiated multi-year modeling)* | Paper spec only | Builds on Discovery's RAG substrate + entity/retirement/depreciation rule encoding. POSITION-FRAMEWORK §4. |
| **Position Agent** *(aggressive territory: defend or refuse)* | Paper spec only | Same dependencies. The refusal-floor logic is the load-bearing piece. POSITION-FRAMEWORK §2. Note: `refusalIf` evaluation against `IntakeState` is unimplemented today — the v0 catalog scanner emits zero genuine refusals because of this, audit-flagged 2026-05-15. |
| **Notetaker Agent** *(meeting transcript → action items)* | Paper spec only | Records meeting (Zoom / Google Meet / phone), transcribes via Deepgram/Gladia (L5), routes through Memory Curator. V1.5 ship. |
| **Pre-Meeting Brief Agent** *(N-hour-ahead client meeting prep)* | Paper spec only | Fires N hours before any `calendar_events` row tagged as a client meeting. Generalizes the existing Pre-Signature Checklist. V1.5 ship. |
| **Action-Item Extractor** *(Notetaker → Tasks in engagement)* | Paper spec only | Runs on every Notetaker transcript post-meeting. V1.5 ship. |
| **Practice Pattern, Promise Keeper, Outcome Prediction, Phone Agent** | Paper spec only | v1+, post-7/30. |

### Agent contract — what's enforced today
- System prompt + scoped model tier (Haiku/Sonnet/Opus): ✅ in `runDocketAgent`
- Cost telemetry tagged with tenant + agent + action class: ✅ via `onAction` hook
- Audit-trail hook on every call: ✅ at orchestrator level (caller wires it to the `actions` table)
- Trust gate before external action: 🟡 **partially shipped.** `assertTrustGate` helper at `packages/shared/src/trust-gate.ts` (67 tests pass). Called from 5 agents (discovery-agent, inbox-drafter, notice-drafter, flows/discovery-scan, mcp-gateway). NOT centrally enforced inside `runDocketAgent` — any future agent that forgets to opt in silently bypasses the L1-L4 trust ladder. Audit punch list flags centralization as a follow-up.
- Per-agent playbook bundle: ❌ not built (`packages/playbooks/` doesn't exist).

### Critical authorization boundary (non-negotiable)

**Docket NEVER:**
- Auto-files a return with the IRS or any state agency
- Auto-submits 8879 e-signature transmission
- Auto-pushes return data to OLT / Drake / Lacerte / ProConnect / CCH Axcess / ProSeries / any tax prep software
- Auto-files 2848 / 8821 / 8275 with the IRS
- Auto-sends client-facing communications (email / SMS / portal message)
- Auto-charges deposits or processes payments
- Auto-executes ANY action that touches an external system or sends to a client

**What Docket DOES autonomously:**
- Reads source documents
- Builds the workpaper (proposed, in Docket's internal database)
- Drafts return data in Docket's staging area (NOT pushed to tax software)
- Surfaces Discovery findings + Position classifications + draft 8275 disclosures
- Generates pre-meeting briefs
- Curates Memories from interactions

**Per-action gating via trust escalation L1-L4** (per §8):
- L1 firm (Antonio's starting state): every external action requires explicit preparer approval click. No auto-execute.
- L2: Tier-1 positions auto-accepted into workpaper, but pushing to OLT still requires approval. Logged.
- L3: Tier-1-2 positions auto-accepted, pushing to OLT auto-approved IF return below configurable complexity threshold. Weekly L1-2 audit review.
- L4: most autonomy — only Tier-3+ positions or unusual returns require human attestation.

Trust escalation is **per-firm + per-action-class**, not all-or-nothing. Antonio can be L4 on "auto-classify documents" (low risk) while staying L1 on "push to OLT" (high risk) — same firm, different gates per action class. This is the line that makes Docket adoptable where Claude Cowork isn't.

### Agent contract — what every output must carry (UI rendering)

Every agent output that surfaces to a preparer renders these four artifacts inline:

1. **The answer** — what the agent decided / drafted / recommended.
2. **Confidence + tier** — Tier 1-4 for tax positions; H/M/L confidence for everything else. Color-coded pill (green/amber/orange/red/gray).
3. **Multi-step reasoning trail** — collapsible per-step view of what the agent did: which client facts it queried, which authorities it looked up, which intermediate decisions it made, what it considered and discarded. NOT a thinking-mode raw dump; a *curated* trail emitted alongside the answer so the preparer can audit "why this answer landed here." Required on Discovery, Strategy, Position, Pre-signature checklist, Notice Response, Ask Docket (command palette), and any future agent that emits a recommendation. Optional on Triage Classifier + Inbox Drafter (trivial cases — show only on `confidence < high`).
4. **Cited authority** — when the answer touches a tax position, every claim carries an IRC §/Treas Reg/case cite with `effective_from` date. Hover expands to full authority text.

Reasoning-trail rendering is a `<ReasoningTrail>` primitive in `packages/ui/src/components/`. Agents emit a `reasoning_trail: ReasoningStep[]` field in their JSON output schema; UI renders it as collapsible rows under the primary answer. This is the user-facing texture-win v3 surfaced and we're locking as a contract — *every* agent output, not just Cmd+K queries.

### Magic Buttons (chat-bound custom workflows; locked 2026-05-13 after Slant.app research)

**Pattern.** A click in Ask Docket (3-scope chat) that runs a firm-authored AI workflow on the current context. Different motion than AI Tasks (scheduled + natural-language-authored): Magic Buttons are on-demand + pre-authored.

**Example.** In Maria Ortega's client chat, Antonio sees button "Draft Q4 planning email." Click → runs the firm's `q4_planning` template scoped to Maria's facts → renders a draft for approval inline. No typing, no scheduling, no prompt engineering at click time.

**Composition.** Each Magic Button = {label, scope (client/meeting/book), template_id, trust-gate-class}. Firms compose their own buttons in command-room **Settings → AI → Magic Buttons**. Template library ships with starter buttons (Q4 Planning Email · Year-End Review Memo · Audit Defense Draft · Engagement Letter Renewal · Bad-Client Fire Letter · BOI Reminder · Statement of Information Renewal · 8821 Filing). Each template is a system-prompt + agent + JSON schema spec — runs through the same `runDocketAgent` + audit chain as any other agent call.

**Shared with the Workflow Marketplace.** Magic Button templates published from one firm become installable by others (per CLAUDE.md §8 Workflow Marketplace concept). Lock-in compounds as firms author firm-specific buttons; differentiation across firms compounds as the marketplace fills.

**Why this matters.** Slant cross-mentions Magic Buttons on both their AI Agents and AI Automation product pages — it's not an afterthought, it's *the* connecting tissue between question-asking (chat) and action-taking (workflows). For tax: the chat-question-to-action bridge is what makes Discovery findings + Position decisions + Notice triage feel *operational* instead of *suggestive*.

---

## 10. MCP server roster + integration architecture

> **Architecture locked 2026-05-14** after Composio detailed mechanics + Ping audit-trail UX + Anthropic Citations API + Twilio Conference + DocuSign KBA + IRS Systems + CA State Agencies + §7216 research. Full detail in `docs/architecture-research/` and `docs/competitor-research/`.

### The three-specialist hybrid architecture

`@docket/mcp-gateway` (shipped C28) stays on top. It owns trust gates, audit chain, §7216 consent gating, multi-tenant routing. **Three downstream specialists route through it:**

1. **Composio** (rented managed service) — commodity OAuth long-tail. Cannot host self-hosted MCP servers — Composio's gateway only proxies to Composio-hosted MCP servers.
2. **Browser-automation workers** (Docket-owned, Fly.io sandboxed Playwright) — legacy tax software + IRS/state browser automation. Composio's request-response model cannot host long-running browser sessions.
3. **Docket-native MCP servers** (Docket-owned, multi-tenant) — tax-vertical APIs + internal services + research corpus. The moat.

### Composio — the OAuth long-tail specialist

**Pricing:** Free tier (20K calls/mo) for dev. **Starter $29/mo** (200K calls) when first customer onboards. Pro $229/mo at ~10-15 customer firms. Enterprise (custom + VPC + BAA + DPA) from 200+ firms. All ~1,000 toolkits available at every tier; metered on calls.

**Acquisition risk:** ~40-55% probability within 18 months (Pipedream → Workday Nov 2025; n8n SAP $5.2B May 2026). 6-month wean-off plan: swap `ComposioConnectorProvider` → `NangoConnectorProvider` per-connector via the `IntegrationProvider` boundary.

**§7216 posture:** Requires contractual DPA carve-out before 1040 data flows — explicit no-training-on-tool-call-payloads. Per §301.7216-2(d)(2) carve-out for contractor / equipment & software, most processors covered IF pinned to US regions. Cohere has Canadian regions — offshore consent required.

**Day-1 Composio connectors (~12, ship for founder-50 cohort):** Gmail · Outlook · Google Calendar · Outlook Calendar · Zoom · Google Drive · Dropbox · OneDrive · Plaid · Calendly · Karbon · Xero.

**Day-1 DIRECT vendor OAuth (NOT Composio):**
- **QuickBooks Online** (Direct Intuit OAuth) — load-bearing for trial-balance work
- **Square** + **Stripe** — already direct in stack
- **Twilio** — Conference API for handset-merge call recording (Antonio merges Docket into in-progress cell calls via Add Call + Merge; Twilio sees inbound PSTN call)
- **DocuSign 8879 KBA flow** — IRS Pub 1345 has TWO options: (1) credit-bureau KBA (~$3/attempt via DocuSign Identify, ~$1.50 wholesale via LexisNexis) for NEW clients; **(2) 2FA + ERO-known information** (prior-year AGI + 6-digit code) for REPEAT clients — no KBA charge. Option 2 covers ~80% of Antonio's book.
- **DocuSign (general)** — can route through Composio for non-8879 docs

**V1 expansion (~17 more):** Microsoft Teams · Google Meet · Slack · Financial Cents · Anchor · Double · HubSpot · SharePoint · Mailchimp · Asana · Monday · ClickUp · Fathom · Granola · Otter · RingCentral · Dialpad.

**V1.5/V2 niche (~13):** NetSuite · Sage Intacct · Salesforce · Box · Brex/Ramp/Mercury/Relay · PayPal/Wave/FreshBooks · Notion/Coda/Airtable · Avalara/TaxJar · CoinTracker/Koinly · Bill.com/Melio.

### Browser-automation workers — the legacy tax software specialist

Long-running Playwright sessions in Fly.io sandboxed containers. Cannot fit Composio's request-response model.

- **Tax software**: OLT (Antonio's primary) · Drake · Lacerte · ProConnect · CCH Axcess · ProSeries · ATX · TaxWise · TaxSlayer Pro · UltraTax CS · GoSystem Tax RS
- **IRS systems**: Tax Pro Account (pre-fill + click-to-submit in preparer's authenticated session — ID.me automation is a hard no; ship as browser extension or deep-link handoff) · e-Services TDS (gated by EFIN + Client ID + X.509 cert + ~45-day suitability review; apply at V1 launch, 6 months to production)
- **State agencies**: CA FTB (MyFTB with mandatory MFA, no transcript API — Playwright + cached storageState) · CDTFA · EDD (bulk file upload of DE 8300-spec XML/CSV; DE 48 verification required) · CA SoS BizFile API (FREE no-auth public records — daily heartbeat for entity standing checks; mirrors FTB suspensions within ~30 days)
- **BOI / FinCEN** — direct partner program when granted; browser auto V1

**TaxStatus** (developer.taxstatus.com) is the V1 primary aggregator for IRS transcripts (REST API, public dev docs, advisor-leaning). TaxNow + Compliancely are alternatives. **IRS Solutions + Canopy are competitors, NOT partners** — Antonio continues personal IRS Solutions use; Docket replaces at practice-OS level.

**Direct File partner program:** IRS formally cancelled FS2026 launch (Nov 2025). Reclassified V1.5 → V2+ contingent on Treasury PPP study outcome.

All Docket-native browser-automation runs under `@docket/mcp-gateway` trust gates + audit chain. **Critical authorization boundary (per §9):** NEVER auto-files / auto-pushes / auto-submits to external systems without explicit preparer authorization per trust escalation L1-L4.

### Docket-native MCP servers — the tax-vertical specialist

Internal MCP servers for tax-vertical capabilities + research corpus. No vendor risk.

| Server | Tools | Effort |
|---|---|---|
| **`ledger`** | `log_action`, `query_actions`, `get_audit_trail`, `get_client_state` | 3d |
| **`knowledge`** | `search_authority`, `get_form_instructions`, `get_concept`, `get_playbook`. Backed by tax-graph corpus (Tier 1 federal: IRC + Treas Regs + Pubs + Tax Court + IRM + IRB + CCAs/PLRs/TAMs; Tier 1 state: CA first, NY/TX/FL expansion). | 5d server + 4w ingestion |
| **`documents`** | `parse`, `classify`, `link`, `generate_workpaper`. Auto-classify W-2/1099/K-1/brokerage; auto-rename per firm convention; auto-PDF (image→PDF); OCR-searchable binarization; mask/unmask for sharing. | 5d |
| **`portal`** | `post_message`, `request_document`, `update_status` | 3d |
| **`skills`** | `list`, `invoke`, `get_definition`. Uses `@docket/skills` registry (shipped C29). | 2d |
| **`memos`** | `create`, `version`, `link`, `export`. Memos as first-class per §11. | 4d |
| **`positions`** | `propose`, `classify_tier`, `accept`, `reject`, `superseded`. Position Framework Tier 1-4 classifier. | 5d |
| **`rules`** | Deterministic calculators (Schedule C, §199A, AOTC, bonus depreciation). Per §5 Rules layer. | 6d |

### The IntegrationProvider boundary (vendor-swap insurance)

`@docket/mcp-gateway` exposes a single interface:

```typescript
interface ConnectorProvider {
  invoke(toolName: string, input: unknown): Promise<ConnectorResult>;
  oauth(firmId: TenantId, ...): Promise<OAuthFlow>;
  webhook(event: WebhookEvent): Promise<void>;
}
```

Four implementations: `ComposioConnectorProvider` · `BrowserAutomationProvider` · `NativeMcpProvider` · `DirectVendorProvider`.

**Migration scenarios:** Composio 5x price hike → swap to Nango self-hosted, per-connector ~2 days. Composio acquired → execute 6-month wean-off plan in `docs/competitor-research/COMPOSIO-DETAILED-2026-05-14.md` §11.

### Build-vs-adopt rules (refined)

| Situation | Decision |
|---|---|
| Commodity OAuth (Gmail, Drive, Slack, Calendar, etc.) | **Composio** |
| Load-bearing vendor with direct partnership (QBO, Stripe, DocuSign-KBA, Twilio) | **Direct vendor OAuth** |
| Legacy tax software (Drake, Lacerte, OLT, etc.) | **Docket-native browser automation in Fly.io** |
| IRS / state agency / BOI / 1099 filing | **Docket-native browser automation OR direct partner API** |
| Tax research / corpus / memos / position library | **Docket-native MCP server** |
| Tax-vertical competitor PM (TaxDome, Canopy, Liscio, IRS Solutions) | **NOT integrated — Docket replaces** |
| Advisory-leaning PM (Karbon, Financial Cents, Anchor, Double) | **Composio integration** — firms keep these, Docket runs AI on top |
| Custom abstraction over multiple sources | **Always build native.** This is the product. |

---

## 11. Design system

**Codename:** Docket v4 — Vazant client-facing mobile.

### Philosophy
- **Editorial warmth.** Cream backgrounds, ink text, forest green primary. Not vibe-coded.
- **NO default shadcn aesthetic.** Tailwind v4 used for layout utilities only; visual style is the custom Docket tokens.
- **Mobile-first.** 390×780 iOS viewport for portal. Responsive desktop for command room.
- **Anti-AI-slop** (see feedback section). No decorative highlights, no left-border accents, no emoji, no vibe-coded look. Intentional design only.
- **Editorial typography.** Fraunces serif for display + DM Sans body. Three tone variants: editorial (cream), minimal (off-white), magazine (bold/inky).

### Tokens (in `packages/ui/src/tokens.ts`)
- Three tones: `editorial` (lead) / `minimal` / `magazine`
- Forest green primary: `oklch(42% 0.09 150)` (hue tweakable 130–165)
- Fraunces / DM Sans / DM Sans (mono fallback)
- Density: comfortable / cozy
- Radius: 14px / 20px (lg)
- **Theme: Light (default) / Dark / System.** Per-user preference stored in `users.theme_pref`. Light mode is the canonical editorial-warm + operational-modern surfaces above. Dark mode is the editorial-warm tokens *inverted* (ink canvas, cream text, forest-green hue brightened 8-12% for legibility against dark backgrounds) and the operational-modern tokens inverted (warm near-black canvas, cream-white cards, soft 1px borders inverted). System mode follows `prefers-color-scheme`. Lives in command-room **Settings → System → Appearance**, mirrored in portal Profile tab. Render via CSS custom properties so the inline-style intake/portal components don't need a per-component rewrite — a single `data-theme` attribute on `<html>` flips the variables. V1.5 ship (no demand for it on tonight's first cohort).

### Primitives in `packages/ui/src/components/`
Layout: `Screen`, `Stack`, `Row`. Text: `Eyebrow`, `H1`, `H2`, `Body`. Buttons: `Button`, `BackButton`, `IntakeBackButton`. Indicators: `ProgressBar`, `Placeholder`, `TrustPill`. Media: `AvatarSlot`, `VideoPlaceholder`. Cards: `Card`, `ToggleCard`, `RadioRowCard`, `DependentCountCard`. Fields: `FieldLabel`, `TextField`, `SSNField`, `EncryptedTextField`. Antonio: `AskAntonioBar`, `AskAntonioChat`, `AntonioNote`. Frame: `SignOutProvider`, `IntakeRouteFrame`, `IntakeHeader`, `BottomBar`, `IntakeBottomBar`, `Footer`. Icons: `IncomeIcon`, `HandCheckmark`, `Wordmark`. Signature: `LegalDoc`, `SignaturePad`. Portal: `PortalTabBar`. All inline-style based for design fidelity.

### Cross-package context (firm-owner display)
- `TenantDisplayProvider` from `@docket/ui` wraps each (intake) / (portal) layout server-side after `resolveClient()` resolves tenant + firm-owner.
- Components consume via `useFirmOwner()` / `useTenantName()` / `initialsOf()` instead of hardcoded strings.
- A handful of pages still hardcode "Vazant Consulting" / "Antonio Vazquez" — see `Section 18 → Known stubs and mocks`. Marked TODO(multi-firm); not load-bearing until tenant #2.

### Solar icons — known liability
`packages/ui/src/icons/solar.tsx` is **7,848 lines** in a single file. Blocks tree-shaking. Audit flagged AMBER. ~30 min one-shot transform via the existing generator script when convenient.

### Inline styles vs Tailwind
- **Design-locked components (intake, portal):** preserve inline styles exactly as the designer authored them. Zero design drift.
- **New components (command room layouts, dashboards):** Tailwind v4 utility classes for layout/spacing/responsive, custom tokens for color/typography.
- Both can coexist in the same app.

### Two visual languages (locked 2026-05-08)

After the user-shared "Nexus Tax OS / Courtney Henry" dashboard reference frames, command-room moves off the editorial-warm portal language. The product now ships TWO visual languages, each crafted for its job:

| Surface | Visual language | Why |
|---|---|---|
| **Client portal + intake** (`apps/client-portal/(intake)`, `apps/client-portal/portal`) | **Editorial-warm** — Fraunces serif display + DM Sans body + cream canvas `oklch(98% 0.01 85)` + forest green primary `oklch(42% 0.09 150)`. Inline-style based for design fidelity. | Taxpayer-facing. Antonio's clients sit in an emotional-trust transaction. The portal feels like a thoughtful welcome from a real practice, not a SaaS dashboard. Hand-crafted-feel. |
| **Command room** (`apps/command-room`) | **Operational-modern** — geometric sans (Inter / Geist) for both display and body, line-glyph icons (Lucide), white-or-near-white card on faint warm-gray canvas `oklch(96% 0.008 85)`, soft 1px borders, small radius (10-12px), dark warm-gray sidebar spine `oklch(18% 0.01 85)`, tab-bar-under-title composition. Forest green stays as the primary accent. | Antonio-facing operational pane scanned 100x/day. Density and clarity beat warmth. Same craft level as the portal, different job. |

**Both surfaces share:** forest green primary `oklch(42% 0.09 150)`, the same Antonio-voice copy rules, the same anti-AI-slop discipline, the same restraint. Different fonts and densities; same product.

**Reference frames:** see `docs/visual-reference/dashboard-2026-05-08/` for the user-shared composition reference. Detailed translation rules + adopted patterns + anti-patterns: [`.claude/skills/craft/SKILL.md`](.claude/skills/craft/SKILL.md) — re-read whenever opening a new command-room route.

### Adaptive UI principle (locked 2026-05-13 after Slant.app research)

**The home page composition should change based on what the firm is doing this week, not just sit in a static layout.** Slant's Thomas Clawson articulated this as their north-star UX vision: *"Logging in could auto-prioritize frequently-used workflows without manual setup."*

For tax, the signal is stronger because the calendar dictates the workflow:

| Time window | Home prioritizes | De-prioritizes |
|---|---|---|
| **Tax season peak (Mar-Apr 15)** | Need You queue front-and-center · 8879 pending · e-file rejects · deadline alerts | Year-round planning · Discovery findings · Memories tab |
| **Extension season (Apr 16 - Oct 15)** | Extended-return Need You lane · Q2 + Q3 estimated payment cohort · audit defense workspace | Annual review cycle |
| **Off-season (Oct 16 - Feb)** | Year-round planning Nudges · Discovery findings · annual review touchpoints · prospecting + new-client onboarding | Need You queue (collapsed) |
| **Pre-season (Feb)** | Engagement letter renewal queue · prior-year reconciliation · intake-flow restart prompts | Audit defense (unless active) |

**Implementation.** Calendar-driven layout switch + a per-user pinning override. Stored in `tenant_settings.ui_layout_mode` enum (`peak` / `extension` / `offseason` / `preseason` / `custom`). Auto-set by date or manually toggleable by firm owner. Each mode is a *composition* of which sections render in which prominence on `/` (home) — same components, different stacking + sizing.

**Why not full ML-personalized UI?** Tax has hard seasonality; the time-window driver is more legible than usage-frequency driver. The user experience is also more predictable: Antonio knows what April looks like vs August. Behavioral personalization layers on top (V2+) — for v1.5, time-window switching is the right floor.

This is craft principle, not a separate feature. Every new command-room page should ask: *"How does this page change shape when the firm enters extension season vs off-season?"*

### Auth styling note
The user identity in flows is real: **Antonio Vazquez**, EA (firm: Vazant Consulting). Avatar in `apps/client-portal/public/antonio.webp` is the static fallback; live `users.avatar_url` (Clerk `imageUrl`, lazy-backfilled) is preferred when present.

---

## 12. Knowledge layer

### Tier 1 — Primary sources (build first)
- **IRS:** Title 26, Treas. Regs, IRS forms/instructions/pubs (current + 3 prior years), IRB, IRM, Tax Court opinions
- **California FTB:** forms/pubs/Legal Rulings, Residency & Sourcing Technical Manual, FTB procedure manuals
- **CDTFA** (sales/use tax) and **EDD** (payroll/worker classification) where rep work touches

### Tier 2 — Editorial (deferred until usage gaps demand)
- Bloomberg Tax / Thomson Reuters Checkpoint / CCH AnswerConnect — defer, expensive ($15–40k/seat/yr)

### Tier 3 — Internal (the real moat)
- Issue memos, checklists, fact-pattern playbooks, SOPs, client letter templates, audit-response trees, form-line mapping rules, planning strategy libraries
- Authored by tax co-founder + accumulated from Antonio's actual cases

### Tier 4 — Consumer translation
- Plain-English explainers in client portal sourced from official forms/instructions/pubs
- Same answer, different reading level

### Schema (designed; NOT YET implemented)
The current `packages/db/src/schema.ts` covers operational tables (tenants, users, clients, intake, documents, signatures, messages, engagements, issues, actions, etc.). The knowledge ontology below is a v1+ design — the planned `packages/tax-graph` package does NOT exist yet, and `content/authority/` + `content/strategy-library/` are empty directories.

- `Authority` — source, citation, jurisdiction, date issued, effective date, superseded date
- `TaxConcept` — residency, sourcing, basis, nexus, reasonable comp, QBI, PTET, etc.
- `WorkflowObject` — return type, form, schedule, notice, election, deadline
- `FactPattern` — taxpayer type, state, entity type, income types, transaction events
- `DecisionRule` — if/then logic, thresholds, exceptions, authority support
- `PlanningStrategy` — strategy name, prerequisites, risks, expected savings, documentation requirements

### Versioning
**Effective-date versioning on every authority chunk from day 1. No exceptions.** When the knowledge layer ships, this is non-negotiable.

---

## 13. The eight white-space bets (ranked)

Concrete edges where the funded competitors are NOT building. Ranked by signal strength.

1. **Compliance-first deduction surfacing — the position framework.** See [`docs/POSITION-FRAMEWORK.md`](docs/POSITION-FRAMEWORK.md). The mechanism: every deduction the AI flags carries an IRC cite + tier classification + audit risk + draft 8275 (when needed). EAs at the down/mid-market segment cannot adopt loophole-finder tools — their PTIN is on every return. Big-4-targeted competitors (Accrual / Black Ore / Basis) sidestep this because in-house tax counsel handles the compliance line. **Nobody at Antonio's segment is building the compliance-first frame.** Marketing handle: "catches every defensible deduction your team would have caught with unlimited time + audit trail built in."
2. **Practice management × return intelligence union.** Accrual/Black Ore/Basis/TaxGPT automate the return; TaxDome/Canopy/Karbon automate the practice with shallow AI. **Nobody owns both.** Docket's structural lane.
3. **Mediated taxpayer client portal.** Every PM incumbent treats portal as passive doc-drop. Make it a continuous bilingual conversation thread with AI drafts gated by the preparer.
4. **EA representation rights as a second pillar.** The 2848/8821 + transcript pull + notice triage + drafted response loop. Off-season recurring revenue. $2k–$10k per engagement. Antonio is already on IRS Solutions — perfect fit.
5. **Bilingual + voice-aware practice OS.** No funded AI-native is built for this. Spanish, Mandarin, Vietnamese, Tagalog. Voicemail transcription default substrate.
6. **Practice intelligence as a paid module.** Margin/friction/scope-creep/pricing inconsistency across the book. $99–$299/mo standalone. Data exists in the ledger by definition; nobody else can compute it.
7. **YoY change explainer + source-to-return traceability for the taxpayer portal.** Highest-leverage retention artifact. Currently 100% hand-written everywhere. Juno is alone pitching traceability, aiming up-market.
8. **OLT integration as a moat.** Every funded AI-native targets Drake/ProConnect/UltraTax/Lacerte/CCH. **Zero target OLT.** First mover earns the bottom of the EA market for free.

### Pricing edge
Per-return / per-notice usage on top of a low monthly base. Storefront and small-firm EAs can't pay $1.5k–$3k/seat/yr that competitors charge.
- **$99–$299/mo** base + **$5–$15/return** + **$200–$500/notice handled**

### Marketing lead (locked 2026-05-13 after Slant.app research)

The opening line that closes deals is **"Double a tax preparer's capacity."** Slant.app uses the exact same opener in financial advice and raised $3.3M behind it; the buyer behavior is the same in tax.

The unpack:
- *Solo EAs serve 150-200 clients per season at high friction today. With Docket: 400-500 with the same quality.*
- *$36K/yr saved per practitioner at $250/mo. Junior preparer salary $40-60K/yr is the cost Docket displaces.*
- *Antonio is the example. He's not scared of it. If he can do it, so can you.*

Position Framework + compliance-first + cited authority is the **moat** (why an EA can adopt us where they can't adopt a deduction-finder). But it's the *second* sentence, not the first. The first sentence is the capacity claim. Same shape as Slant: their position framework equivalent (SOC 2 + fiduciary alignment) is also their second sentence, not their first.

**Tool-consolidation narrative** (also locked from Slant): we replace TaxDome + Canopy + Karbon (practice management) + Black Ore/Accrual return-prep AI + manual audit notice management + separate DocuSign + separate Square. **6+ tools collapse into 1.** This is how we close mid-market firms (20-100 staff) who are paying for 3-5 of those tools today.

**Pivot pattern (Pageport → Slant validates ours):** Slant started as Pageport, a video landing page + marketing tool for advisors. Users started manually using it as a CRM. Trigger: *"Two users in one week wanted to add Social Security numbers to PagePort."* Pivoted to full CRM. By Aug 2025: 1,200+ advisors, $1M ARR, $3.3M seed. Our analog: Antonio's 5/9 call surfaced 25+ feature requests that are now Phase 2-expansion. The customer-pull pivot story is identical. **Use this narrative shape in the YC application.**

---

## 14. Explicit NOs

| What | Why |
|---|---|
| **Don't fight Black Ore / Accrual / Basis** on autonomous return prep for big firms | $235M+ raised combined, 2-year head starts, top-25 firm distribution. Don't be the fifth entrant building backward. |
| **Don't build a consumer tax filer** | Deduction (Taylor CPAI) / Perplexity Computer / Rally / Gelt are crowding it. Wrong product anyway. |
| **Don't lead positioning with "deeper than any CPA"** | Table stakes by 2027. Depth is the engine that makes our surfaces correct, not the headline. |
| **No WhatsApp in v1** | SMS + email + voice + portal chat is enough. WhatsApp Business API has compliance friction. |
| **Don't build a return calculation engine** | OLT/Drake/UltraTax do that. Be the orchestrator, not the calculator. |
| **No per-customer snowflakes** | Every consulting engagement runs on the same multi-tenant substrate. Refuse out-of-thesis work. |
| **No Bloomberg/CCH/Checkpoint year 1** | Tier 1 (IRS/FTB primary) + tier 3 (internal playbooks) is enough. |
| **No OpenClaw / Hermes as base** | Personal AI, not multi-tenant B2B. Adopt patterns, not codebases. |
| **No default shadcn aesthetic** | Design fidelity is non-negotiable. Custom Docket tokens. |
| **No Claude Code CLI subscription as production inference** | Against ToS, can't multi-tenant, no SLA. Dev tool only. |
| **No Python backend** | TS end-to-end. Junior dev's instinct rejected. |
| **No AWS Bedrock from day 1** | Defer until first compliance customer asks. Direct Anthropic + ZDR is v0 default. |
| **No per-seat pricing** | Slant prices at $150/seat — works for advisor firms where seat = value unit. Tax: client = value unit. Per-active-client metering aligns cost with value; per-seat punishes growth. Locked per L6. (Re-affirmed 2026-05-13 after Slant pricing benchmark.) |
| **No on-site-only hiring** | Slant concentrates 16 staff on-site in Lehi, Utah. Works for LDS-network-dense talent pool. We're remote-first by deliberate choice (David in NJ, Haokun TBD, Antonio CA, future hires anywhere). Centralized HQ is not on the table for v1 or v1.5. |
| **No OpenAI GPT-primary** | Slant runs on GPT-5. We're Anthropic Claude + Voyage embeddings + Bedrock fallover. The Anthropic-vs-OpenAI rationale (§6) is structural: Claude calibrates better on legal/regulatory tasks where wrong answers cost $580 per Form 8867 occurrence. Don't second-guess this on cost basis — the cost discipline (§7) already accounts for it. |
| **No Calendly competitor build** | Slant is building lightweight Calendly into their product because their integrations are weak. Our Google Calendar MCP + Outlook MCP (planned V1.5) are cleaner. We integrate; we don't compete on scheduling. (Re-affirmed 2026-05-13 after Slant product audit.) |
| **No prospecting feature as PILLAR 1** | Slant builds Marketing/Prospecting as a top-level product surface (find leads · enrich · sequence outreach). For us this is a *paid add-on module* (per §6 add-ons) or a v1.5 feature — NOT a primary pillar competing with Position Framework / Ambient Operator / Memory / Review Automation / Multi-channel. Solo + small EA firms get prospecting as add-on; mid-market firms use their existing prospecting tools. Don't promote it to pillar status; promotion would dilute the "compliance-first tax operator" positioning. |
| **No Big 4 / top-100 firm pivot for 18-24 months** | Decided 5/2/2026 CEO review. Fortress market with $235M+ funded competitors holding 2-year head starts. Brand maturity gap that 12 weeks of building cannot close. 18-month sales cycles. Bootstrap option dies. Mid+down lane is the structurally open one. |
| **No F500 in-house tax department pivot for 18-24 months** | Same compliance + ERP integration timelines as Big 4 without the partner-network distribution upside. Underexplored but not by accident. |

### Segment posture (decided 5/2/2026 CEO review, **wedge clarified 2026-05-11**)

- **The wedge (2026-05-11 specification — the YC-legible frame)**: **2-10 preparer firms with active audit exposure, EA/CPA-led, $300K-$3M revenue.** ~40,000 firms in segment. **$300M-$700M wedge TAM** at standard tier pricing ($499-$1,499/mo). This is the *narrative frame for the YC application + investor decks + founder-50 cohort acceptance filter*, not a roadmap change.
  - Why the wedge isn't solo EAs alone: solo seasonal preparers are price-sensitive, part-time, high-churn, gettable by any incumbent that bolts on AI. Pitching "we sell $250/mo to solo seasonals" pattern-matches to feature-not-company for a YC reviewer. The 2-10 preparer firms have audit exposure pain that single-preparer solos don't carry at the same scale, growing-firm dynamics that compound ACV, and resistance to PM-tool feature-additions because they actually pay the §6694 penalty themselves. Same outreach motion, **4-6x Year-2 ARR** at the same cohort headcount.
  - **Antonio is the founding firm + 1% advisor**, not the ICP avatar. His two active 2026 IRS audits are the validation story regardless of his preparer count.
  - Solo EAs remain part of the **expansion ladder** (founder tier $250 / Solo $499) — addressable, not the wedge. The standard tier rollout post-founder-50 surfaces solo demand naturally.
  - **Stripe / Toast / ServiceTitan / Gusto / Ramp pattern**: category-defining primitive with the right-sized firm as wedge, expansion ladder visible. Toast didn't pitch "Boston restaurants" — they pitched "operating system for the $900B restaurant industry, starting with underserved independents." Same product, different framing.

- **v1 (7/30):** Mid-market and down-market only.
  - **Wedge (down-market within v1)** = 2-10 preparer firms (per above). Antonio's segment.
  - **Down-market expansion** = solo EAs, storefront tax shops, 1-preparer firms. Part of addressable; come in post-founder-50 via standard-tier rollout.
  - **Mid-market** = 20-100 staff regional firms. Phase 6 partner #2 onboarding territory; arrives via warm intros + AICPA ENGAGE 6/2027. Only PM incumbents (TaxDome, Canopy, Karbon) ship shallow AI here. AI-native players are economically forced up-market by their funding rounds.
- **v1.5 door open:** Tax franchise networks (Liberty Tax, Jackson Hewitt, JTH-aligned, smaller franchise networks). Storefront workflow is identical to the current mid+down product. Corporate licensee model = single deal could yield $1-5M ARR. Activate once mid-market reference customer is in hand to point at.
- **NOT pursuing for 18-24 months:** Big 4 / top-100 firms. F500 in-house tax departments. See §14 NOs above for reasoning.
- **Architecture posture:** Five-layer + RLS + per-tenant DEK + audit-trail + governance is enterprise-compatible by accident-of-good-decisions. No special enterprise-readiness work needed in v1. Door stays open for later segments without rework.

**Operational filter (founder-50 cohort acceptance, 2026-05-11)**: bias acceptance toward 2-10 preparer firms that are actively growing or carry active audit exposure. Don't reject solos who fit founder-tier criteria — but don't preferentially accept them either. The 20-EA validation sprint targeting criteria gets the same filter applied at funnel-top.

---

## 15. Build order — Docket OS v1 by 7/30 (Antonio sub-milestone 5/30)

> **Acquisition anchor (locked 2026-05-11):** alongside the v1 product build below,
> the company is running a parallel 12-week acquisition sprint targeting
> **100 paying customers by 2026-08-01**. Strategy + funnel math + channels +
> pricing + weekly milestones in
> [`docs/DESIGN-PARTNER-ACQUISITION-PLAN.md`](docs/DESIGN-PARTNER-ACQUISITION-PLAN.md).
> Operational kits in [`docs/pitch-decks/cold-outreach-templates.md`](docs/pitch-decks/cold-outreach-templates.md)
> and [`docs/DISCOVERY-SCAN-OPERATIONAL.md`](docs/DISCOVERY-SCAN-OPERATIONAL.md). The acquisition sprint and the product
> phased plan are tightly coupled: Phase 5 work (Discovery agent) gets pulled
> forward to support 6/15 Antonio reference scan; Phase 6 onboarding of mid-market
> partner #2 stays on track. The 100-customer goal IS the YC traction story.

> **CEO review 5/2/2026:** Original 5/15 plan was production scaffolding for
> down-market only. Real goal is the tax-native OS for mid-market AND
> down-market: 5 layers (Knowledge, Data, Agent, Orchestration, Governance),
> 10 specialized agents, 3 audiences (preparer, manager/partner, client),
> citations + confidence + audit on every output. Mode: SCOPE EXPANSION.
>
> Four expansions accepted on top of the original baseline: bilateral
> year-round client portal (D3), tax-law diff agent as 10th specialist (D4),
> manager mission-control with capacity planning + exception monitoring +
> advisory surface (D5), IRS-facing control plane via IRS Solutions API +
> 2848/transcripts/CAF/e-file (D6). Total scope = ~70 calendar days of work
> with CC compression. Timeline extended from 5/15 to **7/30** (12 weeks)
> with 19 days of buffer.
>
> Full plan + scope decisions + risks + success criteria:
> [`~/.gstack/projects/minesokim-child-docket/ceo-plans/2026-05-02-docket-os-v1.md`](file:///C:/Users/minse/.gstack/projects/minesokim-child-docket/ceo-plans/2026-05-02-docket-os-v1.md).

### Demo state (preserved as the marketing surface)
- `apps/client-portal` — 38-route walk-through. sessionStorage forms, mocked
  AI, hardcoded everything. Stays live at `docket-client-portal.vercel.app`
  for pitch / Loom / Antonio walkthrough.

### v1 phased plan + status

**Canonical home for v1 phase plan** (Phase 1-6, weekly milestones, what shipped vs open): [`docs/PRODUCT-ROADMAP.md`](docs/PRODUCT-ROADMAP.md). The §15 inline plan was authored 5/2/2026 and grew stale; the roadmap doc + [`docs/STATE.md`](docs/STATE.md) "Active development tasks" + [`docs/AUTONOMOUS-QUEUE.md`](docs/AUTONOMOUS-QUEUE.md) are the source of truth for "what shipped, what's queued." Whenever you ask "what's next," read STATE.md + AGENT-PLATFORM.md FIRST.

For agent-platform substrate work specifically (mcp-gateway, skills registry, Agent SDK migration, MCP servers, cross-context skills, Magic Buttons): [`docs/AGENT-PLATFORM.md`](docs/AGENT-PLATFORM.md) Waves 1-4 (C28-C42) supersedes the §15 phase plan on those items.

**The 5/2 phase plan had this shape, kept here for cross-reference:**

| Phase | Weeks | Status |
|---|---|---|
| 1 Foundation + Antonio essentials | 5/2-5/16 | ~90% shipped |
| 2 Antonio production sub-milestone | 5/16-5/30 | ~65% (Square + DocuSign + Gmail polling production wiring open) |
| 3 Agent fleet build-out (10 agents) | 5/30-6/13 | ~35% (5 of 10 agents coded) |
| 4 Orchestration + manager mission-control | 6/13-6/27 | ~10% (paper spec; mcp-gateway shipped C28) |
| 5 Year-round portal + IRS-facing (D6 descoped to V1.5) | 6/27-7/11 | ~12% |
| 6 Partner #2 + hardening + launch | 7/11-7/30 | ~15% (Antonio only) |

Realistic v1 launch: **late September to mid-October 2026** at current pace (6-10 week slip from 7/30). See last "where are we" exchange in chat history or `docs/STATE.md` Last verified entry for the math.

**D6 descope (5/2/2026)**: IRS Solutions API access deferred to V1.5 — IRS Transcripts API is invitation-only partner program (12-24 month relationship horizon), e-Services APIs require user session, bridge providers (TaxStatus/Compliancely) have dual-8821 consent conflicts, IRS cybersecurity bar is multi-month work. Browser automation against IRS Tax Pro Account is the v1 path for 2848/8821/transcripts. Full IRS partner program application + direct MeF deferred. Net: v1 risk register goes from 5 critical → 2 critical (compliance liability + agent-prompt-error remain critical).

### Top 5 risks (from CEO plan, post-D6-descope)

1. **Compliance liability on filed forms** — incorrect 2848 filing or missed notice deadline causes legal exposure. Defense: agent prompts unit + integration + eval-suite tested before prod; 2848 filings always require human approval (trust gate L1 for `file`); audit trail captures every filed form with the prompt + reasoning.
2. **Agent prompt error sends wrong filing for wrong client** — single bug could file fake 2848 to IRS for wrong client. Defense: structured prompt construction with client_id binding at every layer; pre-flight verification that form data matches client_id before submit; mandatory human approval before any IRS-facing submit.
3. **Knowledge layer ingestion brittleness** — start with hand-curated subset (Pub 17 + FTB residency); spot-check citations manually before agent output reaches users.
4. **Mid-market partner #2 acquisition timing** — start identification Phase 4; warm intros via Antonio's mentor network; pre-build partner-onboarding playbook (<2 week engagement-to-prod cycle).
5. **Cathedral-mode scope creep** — explicit no-more-expansions rule for v1 once 5/30 hits. New ideas go to TODOs.md. Expansion appetite check at 6/13 and 7/11.

---

<!-- Section §15 detailed phase listings + "Post-5/15 12-week plan" + "Status of original 5/15 DEFERS list" + surface ancestry deliberately removed to slim CLAUDE.md. Reference docs above. -->

## 16. Productization discipline

The rules that prevent services-revenue from killing the platform:

1. **Time-box engagements.** 1–2 week Foundation (productized, fixed price). 6–8 week Phase 1 build. Anything longer requires "this becomes a platform module" justification.
2. **Charge for outcomes, not hours.** Fixed-price Foundation. Retainer for expansion. Never hourly.
3. **Every engagement must produce platform IP.** New MCP integration, new playbook, new agent, or new UX module that ships to all customers.
4. **Refuse out-of-thesis work.** No "build us a chatbot for our marketing site." Tax practice ops only.
5. **Pick wedge clients deliberately.** 3–5 design partners across distinct segments: bilingual storefront EA, small CPA firm, EA specializing in rep work, multi-state practice. Not ten partners.
6. **Track platform readiness as a KPI.** "% of new engagement built from existing platform modules." Goal: rises every quarter. When it hits 70%, SaaS unlocks.

---

## 17. Competitive landscape

**Three layers of the AI-tax stack. Docket is the third (practice + relationship + rep). The other two are crowded with well-funded competitors; the third is structurally open.**

Don't compete head-on with autonomous-prep specialists (Accrual $75M, Basis $1.15B val, Black Ore $60M, TaxGPT, Filed, Juno). Orchestrate them via browser automation. Don't compete on consumer (Deduction, Rally Tax, Gelt, April, Perplexity). Don't compete with PM incumbents (TaxDome, Canopy, Karbon) on shallow AI — out-execute on depth.

**For the full competitor matrix, funding details, and strategic read**: [`docs/COMPETITIVE-LANDSCAPE.md`](docs/COMPETITIVE-LANDSCAPE.md).

**Outcome prediction**: partner with [Blue J](https://www.bluej.com/) via API for v1; native predictive model trained on practice ledger is the V2+ moat.

---

## 18. Repo structure & conventions

### Actual structure (5/2/2026)

```
docket/
├── apps/
│   ├── client-portal/        # Next.js 15, port 3001. 38 routes shipped + /scan
│   │                         #   (Discovery Scan cold-traffic landing, C12).
│   │                         #   Returning portal Home tab renders stage-specific
│   │                         #   status copy (5 canonical states, see §4 Client
│   │                         #   Portal). Video touchpoint slot per stage.
│   └── command-room/         # Next.js 15, port 3000. 4 working routes
│                             #   (sign-in, /clients, /clients/new, /clients/[id]).
│                             #   /messages /documents /settings = sidebar links → 404.
│                             # NO admin/ app — command-room subsumes it.
│                             #
│                             # NEW SURFACES (post-v3-IA-integration, building now):
│                             #   /calendar              — first-class Calendar
│                             #                            (§4 Command Room).
│                             #                            Backed by google-calendar
│                             #                            MCP server + calendar_events
│                             #                            table.
│                             #   /settings/ai-preferences  — Tone / insight toggles /
│                             #                              Docket Personality /
│                             #                              Quiet Hours.
│                             #                              Writes tenant_ai_preferences.
│                             #   /settings/reminders    — 5 automated reminder rules
│                             #                            per tenant. Writes
│                             #                            reminder_rules.
│                             #   /settings/notifications — 4 event categories ×
│                             #                             3 channels per tenant.
│                             #                             Writes notification_prefs.
│                             #   /settings/branding     — Logo + custom subdomain
│                             #                            + welcome copy + portal
│                             #                            videos (V1.5 white-label
│                             #                            tier).
│                             #   Home / Need You queue   — 4-lane workflow primitive
│                             #                            (New Intakes / Ready to
│                             #                            Prep / Ready to File /
│                             #                            Sign & File). Aggregate
│                             #                            MetricStrip at top of
│                             #                            every page.
├── services/
│   ├── orchestrator/         # 109 LOC. Direct @anthropic-ai/sdk wrapper:
│   │                         #   cost telemetry, prompt caching, audit hook,
│   │                         #   model tiering. NO MCP routing yet.
│   └── workers/              # Inngest jobs. 2 built agents
│                             #   (triage-classifier, inbox-drafter) +
│                             #   2 Inngest functions (gmail-poll,
│                             #   classify-gmail-message — 8× TODO(week-1)
│                             #   stubs for Gmail/DB plumbing).
│   #                           NO mcp-gateway/, browser-workers/, ingestion/ yet.
├── mcp-servers/              # EMPTY — directory exists, zero servers built.
│                             # Build order is paper spec. Defer post-5/15.
├── packages/
│   ├── db/                   # Drizzle schema (13 tables, 8 enums) +
│   │                         #   12 migrations (0000–0012) + RLS policies +
│   │                         #   encryption (master KEK + per-tenant DEK
│   │                         #   AES-256-GCM, in-process LRU cache) + seed
│   │                         #   (tenant + DEK + 1 user; NO mock clients).
│   │                         #
│   │                         # NEW TABLES (migration 0031, building now):
│   │                         #   tenant_ai_preferences  — tone, insight toggles,
│   │                         #                            Docket Personality,
│   │                         #                            Quiet Hours, 1 row/tenant
│   │                         #   reminder_rules         — 5 canonical triggers
│   │                         #                            per tenant (missing
│   │                         #                            docs / engagement letter
│   │                         #                            / 8879 / balance / Q-end)
│   │                         #   notification_prefs     — 4 categories ×
│   │                         #                            3 channels per tenant
│   │                         #   calendar_events        — google-calendar mirror
│   │                         #                            scoped per tenant, with
│   │                         #                            client_id + engagement_id
│   │                         #                            FKs
│   │                         #   tenant_settings        — generic JSONB key/value
│   │                         #                            store per tenant (theme
│   │                         #                            pref, refund_policy_md,
│   │                         #                            branding overrides)
│   ├── shared/               # IntakeState, intake-schemas (Zod), branded
│   │                         #   types, role helpers, in-process rate limit,
│   │                         #   masking (lives in intake.ts, NOT a separate
│   │                         #   masking.ts), formatters, sentry scrubber,
│   │                         #   tax-year. 7 test files, 112 tests pass.
│   └── ui/                   # tokens.ts (editorial/minimal/magazine tones,
│                             #   forest green oklch, Fraunces + DM Sans),
│                             #   TenantDisplayProvider, 30+ design primitives,
│                             #   intake-icons, services-catalog. Solar icon
│                             #   set is one 7,848-line file (tree-shaking
│                             #   liability flagged in audit).
│   #                           NO tax-graph/, agents/, playbooks/ yet.
├── content/
│   ├── authority/            # EMPTY — IRS/FTB ingestion deferred post-5/15
│   └── strategy-library/     # EMPTY — internal playbooks deferred post-5/15
├── docs/
│   ├── STRATEGIC-BRIEF.md      # full strategic synthesis
│   ├── PERSONA.md              # Antonio's reality
│   ├── ARCHITECTURE.md         # data model + RLS + encryption boundary
│   ├── BACKUPS.md              # backup/restore plan
│   ├── DECISION-JOURNEY.md     # how we got here
│   ├── DESIGN-NOTICE-TRIAGE-V0.md
│   ├── DOCS-CAPTURE-PIPELINE.md  # the 4-phase doc upload pipeline
│   ├── HOSTING.md / HOSTING-RESEARCH.md
│   ├── POST-5-15.md            # what's NOT in the demo cohort
│   ├── SLICES.md               # founder's verbatim framings
│   └── SESSION-HANDOFF-*.md    # per-session deltas (latest wins)
├── .claude/
│   ├── memory/               # 11 .md files mirroring user-level memory
│   ├── hooks/                # check-gstack.sh
│   └── settings.json
├── COSTS.md                  # cost discipline rules
├── README.md
└── CLAUDE.md                 # this file
```

### Conventions
- `@docket/*` workspace package names (`@docket/db`, `@docket/shared`, `@docket/ui`, `@docket/client-portal`, `@docket/command-room`, `@docket/orchestrator`, `@docket/workers`).
- Inline styles preserved for design-locked components (intake, portal). Tailwind v4 utility classes for new command-room layouts only.
- All branded types from `@docket/shared`.
- Drizzle schema in `packages/db/src/schema.ts` is the source of truth. Migrations in `packages/db/migrations/`.
- Multi-tenant isolation via Postgres RLS (`ENABLE + FORCE`). App reads/writes wrap in `withTenant(tenantId, async (db) => ...)` which `SET LOCAL app.current_tenant_id` for the transaction.
- `getAdminDb()` BYPASSES RLS — used ONLY in `apps/client-portal/src/lib/intake/auth.ts` (phone → tenant chicken-and-egg) and `apps/command-room/src/lib/current-user.ts` (Clerk session → user/tenant). Don't add a third caller without a SECURITY.md justification.
- Audit trail (`actions` table) on every tool call + every state-changing server action. INSERT-only via trigger, with one exception (migration 0012: FK-cascade SET NULL on `client_id`).
- All env vars in `.env.local` (gitignored, never committed). `.env.example` documents required keys.

### Cross-package context pattern (firm-owner display)
1. Layout (`(intake)/layout.tsx`, `portal/layout.tsx`) calls `resolveClient()` server-side.
2. Wraps children in `<TenantDisplayProvider tenantName={...} firmOwner={...}>` (from `@docket/ui`).
3. Components consume via `useFirmOwner()` / `useTenantName()` / `initialsOf()`.
4. Avoids prop-drilling firm-owner data through 27+ pages.

### Verified working (2026-05-15)
- `pnpm install` clean.
- Both Next.js apps deployed to Vercel and serving real traffic:
  - `apps/client-portal` → `https://docket-portal.vercel.app` (production). Vercel project name is still `docket-portal` post-Petal-rebrand — see `docs/BRAND-RENAME-INVENTORY.md`.
  - `apps/client-portal` legacy demo → `https://docket-client-portal.vercel.app` (mocks; do NOT point real flows here — kept alive for marketing/Loom).
  - `apps/command-room` → `docket-command-room.vercel.app` (check Vercel dashboard for canonical URL).
- **36 migrations applied** against Neon dev branch (0000–0035). Last applied: `0035_engagement_projects_one_primary.sql`.
- Test counts as of 2026-05-15:
  - `@docket/shared` — **317 tests** pass (`cd packages/shared && bun test src`).
  - `@docket/tax-graph` — 71 tests.
  - `@docket/db` — 57 pass + 2 skip (RLS skips without `DATABASE_URL_RLS_TEST`).
  - `services/orchestrator` — 67 tests.
  - `services/workers` — 62 tests across 4 agent test files.
- Hello-world Claude SDK verified: Sonnet 4.6, $0.0005, 1.8s latency. Haiku 4.5 verified: $0.0001 per doc-classification, <1s.
- **Seven agents** call `runDocketAgent` cleanly with cost telemetry + audit hooks firing (triage-classifier, inbox-drafter, doc-classifier, discovery-agent, memory-curator, nudge-agent, notice-drafter, notice-triage — see §9).
- Phone-OTP auth works end-to-end against Clerk + Twilio. Phone-binding gate redirects unbound phones to `/no-access`.
- 28 intake pages persist field writes via `useIntakeField` → `saveIntakeField` server action → Postgres (encrypted for SSN/EIN/bank/path-bound AAD, RLS-scoped per tenant).
- Cryptographic audit chain shipped (migration 0022). Nightly Inngest `verify-actions-chain` cron verifies per-tenant SHA-256 chain integrity.
- Webhook signature verification helper shipped at `packages/shared/src/webhook-verification.ts`; Twilio + Square + DocuSign + Inngest routes all verify HMAC before any DB read/write.
- AAD binding shipped: `deriveAAD({tenantId, clientId, taxYear, path})` at `packages/db/src/encryption.ts:223`. Called from `unlock.ts` + intake-write paths.

### Known stubs and mocks (must not be claimed as "done")

**Substantially refreshed 2026-05-15 after the 5-agent audit. ~half the prior items resolved; new audit-surfaced gaps added.**

Resolved between 5/2 and 5/15:
- ✅ **Stripe placeholder on `/deposit`** — replaced with Square Checkout (per-tenant token vault + payments table + webhook handler).
- ✅ **Twilio "Send via SMS"** — wired with `sendInviteSms` server action + per-tenant Twilio creds + Twilio API integration.
- ✅ **Preparer-side SSN/EIN reveal** — `apps/command-room/src/lib/intake/unlock.ts` shipped (per-session unlock, role gate, rate limit, AAD-aware decrypt, audit row).
- ✅ **Sidebar dead links** — `/messages`, `/documents`, `/settings` (and 5 sub-routes) all built.
- ✅ **MCP gateway** — `packages/mcp-gateway/` shipped (992 LOC; trust-gate + audit-chain integration).
- ✅ **Webhook signature verification helper** — `packages/shared/src/webhook-verification.ts` (317 tests covering Twilio + Square + DocuSign + Inngest).
- ✅ **AAD on AES-GCM** — bound to `(tenantId, clientId, taxYear, path)` via `deriveAAD()`. Legacy 3-tier fallback (AAD-bound → AAD-less → master-KEK) is still active during the migration window; `pnpm --filter @docket/db reencrypt-legacy` walker has NOT been run prod-wide yet — that's an open operator action.
- ✅ **Form 8879 mock route** — the mock SignaturePad + hardcoded fake tax figures REMOVED 2026-05-15 (audit fix). The `/portal/sign-8879` URL now renders an honest "we're wiring this up" placeholder; the real KBA-backed flow lives at `[id]/sign-iframe.tsx` and is reachable via the DocuSign envelope URL with envelope id. `NEXT_PUBLIC_ENABLE_MOCK_8879` env var no longer read.
- ✅ **`/api/e2e-bypass` + `/api/sentry-test` (both apps)** — DELETED 2026-05-15 per PRODUCTION-READINESS §D pre-public-launch checklist. Public auth-bypass + deliberate-500 routes don't belong in deployed code, even env-gated.
- ✅ **Sentry DSN configured** — both apps wired with `app:` tag; scrubber at `packages/shared/src/sentry-scrubber.ts` walks message/extra/breadcrumbs/request/user. PII `console.log` paths on `unlock.ts` + `send-invite-sms.ts` migrated to `Sentry.addBreadcrumb` 2026-05-15.
- ✅ **Trust escalation gate (partial)** — `assertTrustGate` helper at `packages/shared/src/trust-gate.ts` with 67 tests + called from 5 agents. Central enforcement inside `runDocketAgent` is still a follow-up (audit punch list).

Still open:
- **Hardcoded "Vazant Consulting" / "Antonio Vazquez" copy** — engagement letter + §7216 consent text fixed 2026-05-15 (tenant-aware via `useFirmOwner`/`useTenantName` — legal payload integrity for tenant #2). **Remaining surfaces:** `/portal/profile` Firm-info card + `VAZANT CONSULTING` footer, `/portal/messages` header, `apps/client-portal/src/app/page.tsx`, `apps/client-portal/src/app/(intake)/welcome/content.tsx`, `apps/client-portal/src/app/(intake)/deposit/page.tsx`. Plus the Petal-rename-pending surfaces inventoried at `docs/BRAND-RENAME-INVENTORY.md`.
- **Trial fonts** in `apps/client-portal/public/fonts/trial/` (Suisse Int'l + FAIRE Octave). License expired **2026-05-14**. Founder decision 2026-05-15: defer removal — not yet serving real production traffic. License OR revert before public launch.
- **In-process rate limiter** (`packages/shared/src/rate-limit.ts:31` per-Vercel-lambda `new Map`). Upstash Redis swap queued. ~20 call sites depend on this.
- **`tenants.clerk_org_id` is NULL** in dev — Antonio hasn't created the Clerk Organization yet, so the email-claim fallback path in `current-user.ts` is the active one.
- **Discovery Scan landing → Discovery agent pipeline** — `/api/scan-intake-stub` persists prospect rows + fires Sentry breadcrumb, but does NOT enqueue an Inngest event to run `composeDiscoveryScan`. Manual David-review gate per `docs/DISCOVERY-SCAN-OPERATIONAL.md` "Manual gate during first 30 scans" — intentional. Auto-pipeline ships after the first 30 manual scans validate cost + quality.
- **Position Library v0 review status** — all 20 entries at `content/position-library/v0/positions/*.md` are `DRAFT-DAVID`. The `reviewStatus` ingestion gate default-denies these from prospect-facing scans. Antonio review session is gating the wedge — until those flip to `ANTONIO-VALIDATED`, real prospects can't receive scan PDFs with surfaced positions.
- **Refusal floor evaluation** — every catalog entry has a `refusalIf` array; neither the deterministic scanner nor the LLM Discovery agent evaluates it against `IntakeState` today. PDF's "Refused — below Reasonable Basis" section is permanently empty in v0. Audit-flagged; fix is v1 work.
- **`reencrypt-legacy` walker not run prod-wide** — AAD-less + master-KEK fallback paths at `encryption.ts:285-296` stay active until the walker completes. Operator action.
- **Drizzle journal stops at 0016** — migrations 0017-0035 are applied via `packages/db/scripts/apply-N.ts` orchestrators (run from CI per `.github/workflows/ci.yml`). The `pnpm --filter @docket/db migrate` command referenced in §22 only applies through the journal; a new contributor following the boot ritual ends up 19 migrations behind prod with no obvious explanation for the resulting `column X does not exist` errors. See updated §22 below.
- **`.githooks/pre-commit` + `commit-msg` silent `exit 0` when `bun` is missing from PATH** — softer bypass than `--no-verify`, equally invisible. On a fresh Windows dev machine without bun, every commit skips the typecheck + shared-tests + protocol-gate enforcement. Audit-flagged; fix queued.
- **MFA enforcement** for `firm_owner`/`preparer`/`reviewer` roles is Clerk-dashboard-config-only, no code-level enforcement. SOC 2 CC6.1 gap.
- **Master KEK in `process.env.PII_ENCRYPTION_KEY`** — Vercel-env-only. No KMS, no HSM, no split-knowledge. Rotation script exists but is manual.
- ~~**Vision agent** at `services/orchestrator/src/vision-agent.ts` has NO Bedrock fallover. Anthropic outage = doc-classification pipeline dark.~~ **CLOSED Session 14 (2026-05-16):** `runVisionAgent` now mirrors `callClaudeWithFallover` — tries Anthropic, falls over to Bedrock on transient errors (5xx / 429 / credit-balance 400 / SDK connection failures) via the same `isTransientAnthropicError` classifier the text side uses. Result carries `provider: 'anthropic' | 'bedrock'` for cost telemetry. 7 new fallover tests in `services/orchestrator/src/vision-agent.test.ts`.
- **ZDR claim** asserted at `apps/client-portal/src/app/trust/page.tsx` + WISP + §7216 consent text + this CLAUDE.md §6, but no SDK header/flag verifies it. Anthropic-account-tier proof must live somewhere; operator action queued.

Operator actions queued (not engineering work):
- Unset `E2E_BYPASS_ENABLED` / `E2E_TEST_PHONE` / `E2E_TEST_OTP` / `E2E_ALLOW_PROD_BYPASS` from Vercel `docket-portal` envs (routes deleted 2026-05-15; envs are now noise).
- Unset `NEXT_PUBLIC_ENABLE_MOCK_8879` from Vercel envs.
- Verify Anthropic Console account tier supports ZDR; document or rewrite the public ZDR claim.
- Provision DNS + Resend domain + 3 mailboxes at the final brand domain (deferred pending name decision per `BRAND-RENAME-INVENTORY.md`).
- Apply Vouch + Embroker E&O + Cyber bundle per `docs/CYBER-INSURANCE-RECOMMENDATION.md` ($1M aggregate each, target $2,500-3,500/yr).
- Schedule Antonio review pass over the 20-position library; flip review-status to `ANTONIO-VALIDATED`.

---

## 19. Feedback — the small things (ported from memory)

These are user preferences and rules that came from prior conversations. Honor them on every change.

### Anti-AI-slop design (load-bearing)
- No vibe-coded look
- No decorative highlights
- No left-border accent lines on cards
- No decorative icons
- Use real brand logos (not generic icons)
- Intentional design only — every element earns its place
- Editorial warmth, not "AI dashboard"
- **Why:** the look will get judged. Slop disqualifies.

### Sync popup ↔ full page
When updating the client detail dialog, ALWAYS update both the popup and the full page together. They share data — they should never drift.

### Popup billing tab
The client popup has its own billing tab. **Don't add BillingCard to popup overview** — it's redundant with the existing tab.

### Voice
- Don't summarize what you just did at the end of every response — the user reads the diff
- Be terse. State results and decisions directly.
- No emojis unless explicitly requested.
- Cite file paths as markdown links (`[file.ts:42](path/to/file.ts:42)`).

### Iteration discipline
- Verify in browser before declaring UI work done
- Type checking and tests verify code correctness, not feature correctness
- If you can't test the UI, say so explicitly rather than claiming success

---

## 20. References & inspirations

### Direct templates
- **[FluentOS](https://www.fluentaiconsulting.com/fluentOS)** — productized AI consulting structure (3-day Foundation + retainer + ownership path). Built on Claude Code. Pattern we follow.
- **[Garry Tan's gstack](https://github.com/garrytan/gstack)** — workflow framework we use. Installed globally. 23 specialist roles + 8 power tools.
- **[Anthropic MCP](https://modelcontextprotocol.io/)** — integration substrate.
- **[Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)** — reasoning + tool orchestration substrate.

### Competitive references
- **[TaxGPT — Tax Prep Agent + Agent Andrew](https://www.taxgpt.com/blog/taxgpt-launches-agent-andrew)** — proves browser automation against tax software at scale.
- **[Black Ore Tax Autopilot (GA Apr 29, 2026)](https://www.globenewswire.com/news-release/2026/04/29/3283985/0/en/Black-Ore-Launches-Tax-Autopilot-for-Broad-Availability.html)** — top-25 firm reference.
- **[Accrual ($75M, Feb 2026)](https://www.businesswire.com/news/home/20260205968515/en/Accrual-Launches-with-$75-Million-to-Bring-AI-Native-Automation-to-Accounting)** — every fed/state form, prep + review.
- **[Basis ($100M Series B, $1.15B valuation)](https://www.businesswire.com/news/home/20260224020999/en/Basis-Raises-$100M-at-a-$1.15B-Valuation-as-Accounting-Firms-Adopt-End-to-End-Agents-Across-Accounting-Tax-and-Audit)** — long-horizon agents, autonomous 1065.
- **[K1x ($175M, Apr 2026)](https://www.businesswire.com/news/home/20260416792552/en/K1x-Secures-$175-Million-Growth-Investment-to-Scale-Digital-Infrastructure-for-Private-Market-Tax-Compliance)** — data layer, partnership target.

### Outcome prediction
- **[Blue J](https://www.bluej.com/)** — judicial-precedent-based outcome prediction. v1 partnership target.

### Design partner ecosystem
- **[IRS Solutions](https://www.irssolutions.com/)** — Antonio's rep platform; we orchestrate, don't replace.
- **[Latino Tax Pro](https://latinotaxpro.com/)** — bilingual EA training network (segment context).

### Pattern references (don't use as base, adopt patterns from)
- **[OpenClaw](https://github.com/openclaw/openclaw)** — local gateway pattern, messaging-as-UI
- **[Hermes Agent](https://hermes-agent.nousresearch.com/)** — skills/learning loop concept

---

## 21. Open questions

1. **Brand structure.** One name with two postures (Docket platform / Docket consulting), or two names (Docket + parent brand)? Decide before public launch. **Naming track open** — Linden, Linnea, June, Vera, Grace, Quill all rejected as of 2026-05-11. Currently paused; user will resume the search later. Until then, "Docket" remains the working codename.
2. **The 30-second wedge demo.** What's the "holy shit" moment for Antonio prospects? Hypothesis: a return getting prepped through OLT via browser automation while the preparer watches.
3. **Second design partner.** First is Antonio (CA EA, OLT/IRS Solutions/Xero). Who's #2 — small CPA firm, bilingual storefront, rep specialist?
4. **Tax co-founder situation.** ~~Recruiting target or existing relationship?~~ **CLOSED 2026-05-11**: this was never the right question — the company has two co-founders (David CEO + Haokun CTO, 5+ year relationship, on the project from inception per §1 Project identity), and the tax-domain depth runs through **Antonio Vazquez, EA** as the on-platform tax advisor (formalized 2026-05-11, equity 1%). All Position Library content, every tax-position classification, every cited-authority decision routes through Antonio. **Contracted backup advisors** ($200-400/hr, 5-10hrs/wk, sourced from AICPA + NAEA networks per `docs/CONTRACTED-EXPERT-OUTREACH.md`) provide scale-validation when Antonio's bandwidth is constrained (e.g., during his two active 2026 IRS audits). The 20-position Position Library v0 ships with explicit "reviewed by Antonio" sign-off per position, not "AI-classified." Earlier accelerator drafts (`docs/accelerator-applications/`) referenced this hire as open — refreshed 2026-05-11 to reflect the advisor-not-hire posture.
5. **The wedge agent.** OLT prep handoff vs notice triage. Decide week 1 with Antonio.

---

## 22. Boot-up pointers

When loading this project cold, in this order:

1. **Read this CLAUDE.md** (you are here). It now reflects reality as of 2026-05-16, not aspiration. Several §18 stubs that prior CLAUDE.md revisions listed as "not built" are shipped now; re-read §9 + §18 for the current honest state.
2. **Read [`docs/USER-PREFERENCES.md`](docs/USER-PREFERENCES.md)** — David's voice / decision flow / quality bar / what he pushes back on. Calibration captured in one place so it survives compaction + session handoffs. Added 2026-05-16 (Session 13).
3. **Read [`docs/MASTER-QUEUE.md`](docs/MASTER-QUEUE.md)** — single ordered "what's next" doc. Consolidates the forward-looking queue from PRODUCT-ROADMAP + DESIGN-PARTNER-ACQUISITION-PLAN + the punch lists. If you have to ask "what's next?" this doc didn't do its job. Added 2026-05-16 (Session 13).
4. **Then read the most recent session handoff** in `docs/OVERNIGHT-HANDOFF-*.md` or `docs/SESSION-HANDOFF-*.md` — the latest captures session-specific deltas. When this CLAUDE.md and a newer handoff disagree, **the handoff wins** until a docs-pass folds it back in. Latest handoff: [`docs/OVERNIGHT-HANDOFF-2026-05-13.md`](docs/OVERNIGHT-HANDOFF-2026-05-13.md). The 2026-05-15 + 2026-05-16 audit + fix sprints aren't in handoff files — their outputs are `docs/BRAND-RENAME-INVENTORY.md` + the §18 known-stubs rewrite above + the audit punch list embedded in the recent commit trailers + MASTER-QUEUE.md (Done section).
3. **Verify the dev DB is caught up** before writing any code that touches schema:

   ```bash
   pnpm --filter @docket/db migrate          # applies Drizzle-journaled migrations 0000-0016
   pnpm --filter @docket/db apply-post-journal  # applies hand-orchestrated 0017-0035
   ```

   **⚠️ CRITICAL TRAP — the Drizzle journal stops at 0016.** Migrations 0017–0035 (19 of them) are applied via `packages/db/scripts/apply-N.ts` orchestrators run from CI (`.github/workflows/ci.yml` lines ~196-233). If you run ONLY `pnpm --filter @docket/db migrate`, you end up 19 migrations behind prod and will hit `column X does not exist` errors with no obvious cause. The wrapper command `apply-post-journal` (if present) chains both; otherwise run the individual scripts in `packages/db/scripts/`. Audit-flagged 2026-05-15.

4. **Skim the live deployments** before assuming what works:
   - Open `https://docket-portal.vercel.app/login` → should show login UI
   - Open `https://docket-portal.vercel.app/scan` → Discovery Scan landing page (cold-traffic prospect funnel)
   - Open the command-room URL (`docket-command-room.vercel.app`, check Vercel dashboard) → `/clients` should show the empty state
5. **Strategic detail:** [`docs/STRATEGIC-BRIEF.md`](docs/STRATEGIC-BRIEF.md) — full strategic synthesis.
6. **The journey, not the destination:** [`docs/DECISION-JOURNEY.md`](docs/DECISION-JOURNEY.md) — chronological narrative of how we got here, what we considered, what we rejected, when to revisit each lock-in.
7. **User's verbatim framings:** [`docs/SLICES.md`](docs/SLICES.md) — actual passages the user wrote at each decision point. The framings ARE the product. When in doubt about voice, re-read.
8. **Persona:** [`docs/PERSONA.md`](docs/PERSONA.md) — Antonio at Vazant.
9. **Architecture detail:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — data model, RLS, encryption boundary.
10. **Doc-capture pipeline detail:** [`docs/DOCS-CAPTURE-PIPELINE.md`](docs/DOCS-CAPTURE-PIPELINE.md) — the 4-phase doc upload pipeline.
11. **Memory mirrors:** [`.claude/memory/`](.claude/memory/) — anchored copies of project memory files.
12. **Cost rules:** [`COSTS.md`](COSTS.md) — $50/mo discipline.
13. **Design source (legacy):** `C:\Users\minse\Downloads\docket-portal-design\` — the 36-screen prototype we ported from. Mostly historical now; tokens + components live in `packages/ui/`.
14. **Verify gstack:** `test -d ~/.claude/skills/gstack/bin && echo OK`
15. **If user has invoked `/overnight`** (the hands-off autonomous mode — see §23 + [`.claude/skills/overnight/SKILL.md`](.claude/skills/overnight/SKILL.md)): **RE-READ the overnight skill at every task boundary**, not just session start. The skill is load-bearing per founder mandate 2026-05-12. Hard rules (NEVER `--no-verify` / `Protocol-Skip` on feat|fix / skip codex / mark `Craft: N/A` on UI / skip /e2e past cadence / commit with Score<95 / commit MISALIGNED) are immutable for the duration of overnight mode. If a rule cannot be satisfied on a given commit, STOP and surface to the user. Stopping is fine; skipping is not.
16. **Confirm with David:** any decisions reversed since last session? Any new slices to capture?

---

## 23. Skill routing (gstack)

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

| Request | Skill |
|---|---|
| Product ideas / brainstorming | `/office-hours` |
| Strategy / scope question | `/plan-ceo-review` |
| Architecture decision | `/plan-eng-review` |
| Design system / UI plan review | `/design-consultation` or `/plan-design-review` |
| Full review pipeline | `/autoplan` |
| Bug / error / "why is this broken" | `/investigate` |
| QA / test the site | `/qa` (with fixes) or `/qa-only` (report) |
| Code review / diff check | `/review` |
| Visual polish on live site | `/design-review` |
| Ship / deploy / PR | `/ship` then `/land-and-deploy` |
| Save progress mid-session | `/context-save` |
| Resume context | `/context-restore` |
| Independent code review | `/codex` |
| Security audit | `/cso` |
| End-to-end verify a feature | `/smoke-test` (project-local; see `.claude/skills/smoke-test/`) |
| **Hands-off autonomous overnight mode** | **`/overnight`** (project-local; load-bearing; see `.claude/skills/overnight/SKILL.md` — LOCKED 2026-05-12) |

### Project-local skills

Beyond gstack, this repo ships ten project skills that together form the autonomous build cycle:

- **[`/overnight`](.claude/skills/overnight/SKILL.md)** — **LOAD-BEARING.** The hands-off autonomous mode contract. Same protocol-gate cycle as face-to-face work, but with HARD rules around `--no-verify`, `Protocol-Skip`, codex skipping, `Craft: N/A` on UI, /e2e cadence, Score floor (95), and a $5-per-session cost ceiling. Picks the next task via a scored algorithm (unblocks-other-work + Antonio-demo-dependency + hard-deadline + substrate-low-risk minus PROD-credential-required / schema-migration-approval). Comprehensive stop conditions enumerated. User-codified 2026-05-12: *"if its overnight mode dont just make it a skill you glance over and forget. make it higher in power so that you actually listen."* Re-read at every task boundary, not just session start.
- [`/edge-cases`](.claude/skills/edge-cases/SKILL.md) — runs BEFORE implementation. Forces explicit enumeration of 8-15 edge cases (input / state / failure-mode / time / permission / domain-specific) with handle-vs-document-vs-out-of-scope status. Catches "shipping happy path, finding edge cases in prod" drift.
- [`/code-quality`](.claude/skills/code-quality/SKILL.md) — runs BEFORE commit. Pre-commit gate that BLOCKS AI-sloppenheimer. Forces structural checks (typecheck, tests, no console.log, no undocumented `any`, lockfile-package.json sync) + substantive checks (pattern adherence, error handling, comment quality, atomicity) + post-push deploy verification (curl + Vercel state must be READY before next item). Reference exemplar: `packages/shared/src/webhook-verification.ts`.
- [`/smoke-test`](.claude/skills/smoke-test/SKILL.md) — runs AFTER implementation. Required after any change touching Inngest workers, document processing, storage helpers, server actions firing events, encryption, or new /api/* routes. Reference template: [`services/workers/scripts/smoke-finalize.ts`](services/workers/scripts/smoke-finalize.ts).
- [`/decisions-log`](.claude/skills/decisions-log/SKILL.md) — runs ALONGSIDE every commit + AT SESSION END. Tracks autonomous judgment calls (naming / UX / scope cuts / architecture trade-offs / defaults / deferrals) in [`docs/AUTONOMOUS-DECISIONS.md`](docs/AUTONOMOUS-DECISIONS.md). User reviews periodically; pending entries get auto-marked reviewed-approved after 7 days for low/medium severity.
- [`/keep-going`](.claude/skills/keep-going/SKILL.md) — runs BETWEEN items. Kills the natural-pause-handoff anti-pattern. After a clean commit + deploy + verify cycle, pick the next item from queue → followups → PRODUCTION-READINESS automatically. Do NOT pause to ask "which direction next?" Stop only when a real stop condition fires. User-codified 5/8/2026: "i wanted it to keep going here. until the feature list is complete."
- [`/score`](.claude/skills/score/SKILL.md) — runs AFTER every feature ships. 12-dimension production-readiness scoring (0-100 weighted average). If < 95, identifies the lowest-scoring gap and loops the same item through another iteration until it passes. Floor and ceiling guardrails prevent both self-flagellation and inflation. /keep-going only advances to the next item AFTER /score >= 95 on the current one. User-codified 5/8/2026: "it should be a loop. each feature check/end to end coding should do a score assessment."
- [`/align`](.claude/skills/align/SKILL.md) — runs BETWEEN /score and /keep-going. Asks the harder question /score doesn't: does this feature actually serve the product mission, the goal, the segment posture? Six-question alignment check against the 12 product anchors + 7 explicit NOs. If misaligned, reshape OR kill before merging. User-codified 5/8/2026: "look at the grand plan of the product as a whole. the mission, the goal, and the alignment of the feature with our grand goal. if it doesn't align, fix."
- [`/craft`](.claude/skills/craft/SKILL.md) — runs AFTER /code-quality, BEFORE /score on any UI-touching commit. Apple-bar UX gate. Six-question check: would I screenshot it / does the eye land on the right thing / does hierarchy do the work without color-borders-icons / does the copy have voice / are empty-loading-error states designed / does every element earn its place. Anti-AI-slop discipline applied to UI specifically. Captures the two coexisting visual languages (editorial-warm portal vs operational-modern command-room, locked 5/8 from user-shared dashboard reference). User-codified 5/8/2026: "is this beautiful user experience? is this good ui? is this how apple would handle the user experience?" + clarification: "that doesn't mean make the ui look like apple" — Apple is the BAR (rigor of craft), not the visual reference. Docket's languages stay Docket's.
- [`/e2e`](.claude/skills/e2e/SKILL.md) — runs PERIODICALLY (every N feature commits OR before any release). App-level end-to-end smoke that exercises the whole stack — migrations, server actions, Inngest agent fleet, audit chain, cost telemetry — composing as a single user journey. Catches the "individual features pass; composition is broken" failure mode. User-codified 5/8/2026: "is it possible to do end to end testing every once in a while with the app as a whole?"

The full cycle: plan → /edge-cases → implement → typecheck → test → /code-quality (lockfile, anti-patterns, codex if substantial) → /craft (UI-touching commits only) → commit (with /decisions-log entry if applicable) → push → verify deploy READY (curl test endpoint if applicable) → /smoke-test if applicable → /score (loop until >= 95) → /align (reshape if misaligned) → periodically /e2e → /keep-going (pick next item) ⟲

### Protocol enforcement (HOOKS, not docs — locked 2026-05-08)

User mandate: *"never ever make this mistake again. you are jeopardizing me."* After an autonomous session shipped 11 commits while skipping `/score`, `/align`, `/edge-cases`, `/craft` entirely, the protocols moved from optional documentation into hard hooks.

**Setup (run once on fresh clone):**
```bash
pnpm hooks:install   # sets git core.hooksPath = .githooks/
```
The `prepare` script runs this automatically on `pnpm install`.

**Pre-commit hook** (`.githooks/pre-commit`):
- Runs `pnpm typecheck` across all workspaces.
- Runs `bun test src` in `packages/shared` (the validation-layer-of-record for branded types, scrubPII, trust-gate, webhook verification).
- Fails the commit if either fails.

**Commit-msg hook** (`.githooks/commit-msg`):
- Invokes `bun run scripts/protocol-gate.ts --commit-msg <file>`.
- For commits whose subject starts with `feat(` or `fix(`, REQUIRES these trailers in the body:
  ```
  Edge-Cases: <N> enumerated, <N> handled, <N> documented
  Score: <0-100>/100
  Align: ALIGNED | MISALIGNED | BORDERLINE
  Craft: PASS | FAIL | N/A — substrate-only
  Codex-Reviewed: PASS | PASS-with-fixes-applied
  Decisions: [<n>] | none
  Compliance-Check: <≥80-char answer to "did I do what I was supposed to do?">
  ```
- Substantive thresholds:
  - `Score < 95` → BLOCKED. The user codified the floor: *"it needs to be 95+. if it doesn't reach those metrics, do it until it does."*
  - `Align: MISALIGNED` → BLOCKED. Reshape or kill before committing.
  - `Craft: FAIL` → BLOCKED.
  - `Craft: N/A` on a commit that touches UI files (any `apps/*/src/app/**.{tsx,jsx,css}`, `apps/*/src/components/**.{tsx,jsx,css}`, `packages/ui/src/components/**.{tsx,jsx}`, `packages/ui/src/tokens.{ts,tsx}`, `packages/ui/src/styles.css`) → BLOCKED. Run `/craft` and report PASS/FAIL.
  - `Codex-Reviewed` missing → BLOCKED. Run codex via `bash scripts/codex-review-staged.sh` (wraps `codex review --uncommitted`); fix any findings; commit with `Codex-Reviewed: PASS` or `PASS-with-fixes-applied`. NO N/A escape — codex itself flagged on the gate's first commit that allowing N/A would let the AI bypass the enforcement by claiming "trivial." For genuine emergencies (codex CLI broken, infra outage), use `Protocol-Skip` with a >=10-char reason. User mandate 2026-05-09 escalation: *"you continually skip steps i tell you not to skip. continually. over and over. it is very frustrating. bake it in."*
  - `Compliance-Check < 80 chars` → BLOCKED. The trailer must be a real answer to "did I do what I was supposed to do?" — naming the specific user instructions verified, the protocols that ran, and any gaps not hidden. "yes" / "I think so" / single-word answers are not allowed.

**/e2e cadence enforcement** (added 2026-05-09):
- WARN at >= 3 feat|fix commits since last `/e2e` pass
- BLOCK at >= 6 feat|fix commits since last `/e2e` pass
- State file: `.gstack/last-e2e-sha` (gitignored, per-developer-machine)
- Recorded automatically by `pnpm --filter @docket/workers e2e` wrapper
- Manual record: `bun run scripts/protocol-gate.ts --record-e2e-pass`

### The compliance-check rule (locked 2026-05-08)

User mandate verbatim: *"write something into yourself that asks 'did i do what i was supposed to do?' that should be the most important thing after you think you are finished. you have to follow my rules. please."*

**The rule, baked in:** Before declaring any task complete (commit, deploy, summary, handoff, response to the user), the AI MUST answer the question *"did I do what I was supposed to do?"* in writing. The answer:
1. Names the specific user instructions in scope.
2. Lists which protocols ran (`/edge-cases`, `/score`, `/align`, `/craft`, `/decisions-log`, `/smoke-test`, `/e2e`).
3. Identifies any gap, shortcut, or deferred item, openly. Hidden gaps are the failure mode this rule blocks.

This trailer is enforced on every `feat(...)` / `fix(...)` commit by the protocol-gate. For non-commit completion moments (responses to the user, handoff docs, summaries), the AI must include the same self-check explicitly. CI surfaces every commit's Compliance-Check trailer in the protocol-gate job's output so the user can read them in one place.

**Escape hatch** — `Protocol-Skip: <≥10-char reason>` trailer. Bypasses validation but:
1. Logged to `docs/protocol-skips.jsonl` with timestamp + sha + reason.
2. CI surfaces every protocol-skip in the `protocol-gate` job's output.
3. The skip is auditable forever in the git log.

**CI gate** (`protocol-gate` job in `.github/workflows/ci.yml`):
- Runs `bun run scripts/protocol-gate.ts --range <base..head>` against every commit in a PR (or last commit on push to main).
- Re-validates server-side so `git commit --no-verify` locally doesn't get past review.

**Why hooks not skills:**
The user's own audit (2026-05-08): *"the protocols are written as gates another agent could enforce. Running them on myself means catching myself before commit, and 'just commit, come back later' beats 'stop and run /score' every time when nothing external blocks me."* The hooks ARE the external block.

### Canonical reference docs (re-read at session start)

Beyond this CLAUDE.md, six docs anchor product + ops decisions and SHOULD NOT be duplicated inline:

- [`docs/AUTONOMOUS-PROTOCOL.md`](docs/AUTONOMOUS-PROTOCOL.md) — **bootloader for any AI working autonomously**. Read FIRST on session start, especially after context refreshes. Defines the four-skill build cycle (edge-cases → code-quality → smoke-test → decisions-log), session-start ritual, communication protocol, anti-patterns blocked, and the recovery sequence after window-fill resets. The user-facing rule: "the skills work every time. every time. every time."
- [`docs/PRODUCT-ROADMAP.md`](docs/PRODUCT-ROADMAP.md) — master product reference. Every feature, every phase, every defer. The five product pillars. V1 / V1.5 / V2 timeline. Marketing positioning lock. Distribution + GTM. Pricing. Open questions + risks. Explicit NOs. Supersedes the v1 phase plan that previously lived inline in §15 below.
- [`docs/POSITION-FRAMEWORK.md`](docs/POSITION-FRAMEWORK.md) — compliance-first deduction surfacing. Four-tier confidence framework + refusal floor. The marketing differentiator. Re-read before changing any agent that emits a tax position.
- [`docs/MEMORY-ARCHITECTURE.md`](docs/MEMORY-ARCHITECTURE.md) — six-layer memory model + cost-optimized prompt caching strategy. Re-read before changing prompt assembly order or the agent fleet's context-loading pattern.
- [`docs/PRODUCTION-READINESS.md`](docs/PRODUCTION-READINESS.md) — punch list of resilience / observability / security / dev-process gaps with priority tiers. Re-read every Friday during v1 build. Items get crossed out, not deleted.
- [`docs/POST-5-15.md`](docs/POST-5-15.md) — what's deferred. (Earlier-version "what's not in the demo cohort" doc; see PRODUCTION-READINESS for current deferred list.)
- [`docs/DESIGN-PARTNER-ACQUISITION-PLAN.md`](docs/DESIGN-PARTNER-ACQUISITION-PLAN.md) — **100-customers-by-8/1 sprint** (per L16). Strategy + funnel math + 5 distribution channels + 3 pricing options + 5 must-ship operational items + weekly milestones. Re-read every Friday during the sprint. Drift between this plan and reality is the bug.
- [`docs/pitch-decks/cold-outreach-templates.md`](docs/pitch-decks/cold-outreach-templates.md) — operational outreach kit. 5 cold email variants + LinkedIn DMs + voicemail + qualifying scripts + CRM schema. Re-read on every Friday during the sprint.
- [`docs/DISCOVERY-SCAN-OPERATIONAL.md`](docs/DISCOVERY-SCAN-OPERATIONAL.md) — Discovery Scan landing page copy + onboarding email + PDF template + Discovery agent technical spec for Haokun's queue. Ship target: landing page 5/25, Antonio reference scan 6/15.
- [`docs/COVERAGE-MAP.md`](docs/COVERAGE-MAP.md) — published transparent compliance scope. 4-tier classification + 5-layer Minimum-Viable Shield + 20-position v1 Position Library list. Re-read every demo, every cold-outreach reply with "what does it cover" questions, every Coverage Map update commit.
- [`docs/MARKETING-FRAMES.md`](docs/MARKETING-FRAMES.md) — Option B audience-segmented hierarchy. Per-surface lead language + penalty-anchored pricing math + canonical copy variants. Re-read before writing any external surface copy (landing page, deck, email, video script, social post).
- [`docs/AGENT-PLATFORM.md`](docs/AGENT-PLATFORM.md) — **agent runtime + MCP gateway + Skills registry + integration roster** (added 2026-05-13 after Claude Cowork launch). Reference architecture is Cowork (Agent SDK + MCP + Skills). Docket adopts same substrate, server-side multi-tenant runtime, tax-vertical depth. Full integration universe (75+ vendors across tax prep / practice mgmt / IRS / state / bookkeeping / payroll / banks / e-sign / portal / comms / OCR) categorized by integration approach (🟢 MCP / 🟡 OAuth REST / 🟠 limited API / 🔴 browser automation / ⚫ no API). Build plan: Waves 1-4 spanning C28-C42 (~9 weeks), replaces §10's earlier paper roster. Re-read before any new agent / connector / skill ship. Supersedes §10 on agent-platform questions until folded back.
- [`docs/COMPETITIVE-LANDSCAPE.md`](docs/COMPETITIVE-LANDSCAPE.md) — full competitor matrix + funding details + strategic read. Split from CLAUDE.md §17 for token efficiency (2026-05-13). Re-read before sales conversations, positioning work, or when a competitor ships something material.
- [`docs/SLANT-LESSONS.md`](docs/SLANT-LESSONS.md) — 33 patterns lifted from Slant.app (business strategy + marketing + pricing + operational). Split from CLAUDE.md §25 for token efficiency (2026-05-13). Re-read before YC application work, pre-seed pitch, or marketing-site content.
- [`docs/TOKEN-EFFICIENCY.md`](docs/TOKEN-EFFICIENCY.md) — **Claude Code session budget discipline.** Added 2026-05-13 after 25%-weekly-quota-with-6-days-left burn rate. The 5 highest-ROI changes (subagent codex / trim CLAUDE.md / filter outputs / /clear cadence / Grep-before-Read), settings to apply, commit-message discipline, anti-recommendations. Re-read before any /overnight session + when you see a session burning faster than expected.

**Vendor resilience posture (locked 2026-05-08 after Neon Cell 6 outage)**: Anthropic + Bedrock fallback at orchestrator layer (V1). Neon read replica us-east-2 (V1). Status-aware UX everywhere (V1). R2 cross-region replication (V1.5, before Feb 2027 tax season). Multi-cloud DB hot standby (V1.5). Read-only mode for DB write failures (V1). Detailed plan in PRODUCTION-READINESS §A.

---

## 24. Project history & key decisions

This project converged through a series of conversations. Major decision points, in order:

1. **Initial framing:** Build an AI with the depth of Deduction (autonomous workflow) + Gelt (year-round strategy). Knowledge depth would be the moat. → **Reframed.**
2. **First reframe:** Practice management for solo EAs is the lane, not return prep. The persona is mental-load-bound, not research-bound. (Maria the EA — hypothetical, later replaced by Antonio at Vazant.)
3. **The Command Room frame:** Docket is the agentic operator that sits above the existing tax stack. Browser automation the technical enabler. **Locked.**
4. **Field research (April 2026):** Identified the three layers (data/return/practice). Practice + relationship layer is open. Locked Docket as the third layer.
5. **Strategic posture:** Palantir/Foundry route — services first, platform second. FluentOS as structural template. Dual business model.
6. **Tech foundation:** Claude Agent SDK + MCP + browser automation. TypeScript end-to-end. Direct Anthropic + ZDR. Next.js + custom Docket tokens (no default shadcn).
7. **Cost discipline:** $50/mo target. Claude Code Max subscription as primary dev tool. Haiku-first testing.
8. **Design:** 36-screen mobile-first portal already authored. Editorial cream + forest green oklch.
9. **gstack installed** as workflow framework (v0.x.x — see `~/.claude/skills/gstack`).

The full strategic synthesis lives in [`docs/STRATEGIC-BRIEF.md`](docs/STRATEGIC-BRIEF.md). When something feels under-specified here, that's where to look first.

---

## 25. Slant.app strategic lessons

**Locked 2026-05-13** after deep Slant.app research. Slant is a vertical-adjacent reference (financial advisor CRM, $4.5M raised, $1M ARR). Product lessons (Memories, Nudges, Projects, 3-scope chat, Notetaker) are in §4/§8/§9. **Full business + marketing + pricing + operational lessons (33 patterns) live in [`docs/SLANT-LESSONS.md`](docs/SLANT-LESSONS.md).**

Quick recap — the load-bearing takeaways:
- Point-solution-first, platform-second pattern (Pageport → Slant). Our analog: Discovery Scan → Docket platform. The YC narrative arc.
- Capital-efficient $4.5M total over 2 years. Plan $1-2M pre-seed off Discovery Scan revenue summer 2026.
- Tagline anchor on every footer: *"Be the EA every taxpayer wishes they had — and the one your peers ask for advice."*
- Tool-consolidation framing: replaces TaxDome + Canopy + Karbon + DocuSign + Square + Otter (6+ tools → 1).
- Per-seat $150 is wrong for us; per-active-client metering aligns with our value unit per L6.
- Slant lacks Position Framework — our structural moat that they can't copy without rebuilding compliance posture.

---

*Last updated: May 2, 2026 — full reality-pass after the post-audit hardening session, then CEO review later that day shifted scope (5/15 demo path → 7/30 OS v1) and locked the segment posture (mid+down only, franchise networks v1.5 door open, Big 4/F500 deferred 18-24 months). Earlier drafts were partially aspirational; this version describes what's actually in the codebase plus the post-CEO-review forward plan. When a future session handoff disagrees with this doc, the handoff wins until a docs-pass folds it back in. CEO plan with full scope decisions, risks, and success criteria: `~/.gstack/projects/minesokim-child-docket/ceo-plans/2026-05-02-docket-os-v1.md`.*
