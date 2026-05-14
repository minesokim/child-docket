# Slant.app — The Definitive Vertical-Adjacent Deep-Dive

> *Locked: 2026-05-14. Slant is the closest vertical-adjacent reference for Docket. They sell an AI-first CRM to financial advisors; we sell an AI-first practice OS to tax preparers. Their product shape, their pivot story, their fundraise arc, their pricing math, their distribution motion — all of it should be treated as instructive case data, not as a script to copy. This document catalogs every visible product detail and every strategic move, then maps each item to a Docket equivalent. Where Slant is wrong for our segment (per-seat pricing, on-site-only hiring, OpenAI-primary, prospecting as pillar), the negative example is captured explicitly.*
>
> *Companion docs: [`docs/SLANT-LESSONS.md`](../SLANT-LESSONS.md) (33 patterns lifted from Slant per CLAUDE.md §25); CLAUDE.md §4/§8/§9 (product lessons — Memories, Nudges, 3-scope chat, Notetaker, Magic Buttons, Pre-Meeting Brief). This document is the master reference; SLANT-LESSONS.md is the action-list extract; CLAUDE.md is the locked-decision layer.*

---

## 1. Product surface — complete catalog

Slant ships as a single AI-native CRM for financial advisors. The product is organized as **seven marketing-page surfaces** mapped onto **four core operational primitives** (records, activities, communication, automation) — with AI woven through every surface.

### 1.1 Marketing-page surfaces (the seven exposed product pages)

| Surface | Marketing-page framing (verbatim where captured) | What it actually is |
|---|---|---|
| **CRM record** | *"Everything your CRM does — only better."* | Households, people, businesses, accounts, files, tasks unified under a single record-of-truth. The substrate. |
| **AI Agents** | *"Ask questions, recall client details, and run AI agents — all from a chat that feels like talking to your assistant."* | Chat-driven agent workflows; the question→action bridge. Magic Buttons live inside this surface. |
| **AI Automation** | *"Custom AI-powered workflows to do repeatable tasks directly from the chat."* (also: trigger-based actions firing on CRM events) | Event-triggered automations + Magic Buttons + AI Tasks. |
| **Project management** | *"Templates for real advisor work — start fast with out-of-the-box projects like Client Onboarding, RMDs, Move Money, and Annual Review."* | Workflow templates (Onboarding, RMDs, Move Money, Annual Review) + per-template tasks + per-client instance tracking. |
| **Notetaker** | *"Listens, organizes, and turns conversations into actionable follow-ups."* | Meeting-bot recording + transcript + action-item extraction + post-meeting follow-up draft + client-record linkage. |
| **Marketing / Prospecting** | *"Define what your ideal client looks like, then surface matching leads from trusted data sources."* | Lead discovery (IDeal customer profile → matching leads) + contact enrichment + multi-step outreach sequences with approval workflows. |
| **Client Reviews** | *"Tracks last review date, next scheduled review, and calendar status."* | Annual-review tracking + touchpoint surveillance + overdue-flag automation. |

### 1.2 Documentation-exposed primitives (deeper than the marketing pages reveal)

From `docs.slant.app/llms.txt` (Slant's documentation root), the underlying primitives:

**Records:** Households, Persons, Clients, Prospects, Past Clients, Businesses, Other Contacts, Custodian Accounts, Manual Accounts, Trusts, Files, Bulk Email, Data Views.

**Activities:** Meetings, Opportunities (with pipelines + stages), Projects (with project types + pipeline view + templates), Tasks (one-off, recurring, templated).

**Dashboard primitives:** Home (Daily Overview + Team Activity + Book Chat tabs), Calendar, Notifications.

**Platform features:** Automations (Triggers + Actions + **Magic Buttons** + Run History), Reports (AI-generated queries returning fresh data), Scouting, Sequences (creating + managing enrollments).

**Communication:** Chat (per-record + book-wide), Document Filler (fill + send for signature + settings), Document Extraction, Email, Files.

**Integrations:** Custodians (Schwab, Fidelity, Pershing, Betterment confirmed; Altruist not yet connected as of Feb 2026), DocuSign, Email + Calendar, File Storage, Phone + SMS, Zapier, API tokens (full REST API exposed — see API Reference below).

### 1.3 API surface (public REST API)

Slant exposes a full REST API. Resources covered:
- **Automations** (get, list)
- **Books** (get, list)
- **Businesses** (create, get, list, update)
- **Clients** (create)
- **Contacts** (create, get, list, tag management)
- **Custom fields** (create, get, list)
- **Households** (create, get, list, update, tag management; profile-image management)
- **Meetings** (create, get, transcript, list)
- **Notes** (create, get, list)
- **Opportunities** (create, get, list, update)
- **People** (create, get, list, update, contact details management)
- **Pipelines** (get, list)
- **Prospects** (create)
- **Tags** (list)
- **Tasks** (create, get, list, update)
- **Users** (current user info)

OpenAPI spec is published. This is a meaningful Path-2 signal — Slant ships their product *and* the API to integrate against it. Docket's Path 2 (per CLAUDE.md L1) is the same shape, but tax-specialized.

### 1.4 User-facing verbs (the actions the *advisor* takes)

From product pages + docs:
- **Ask** Book Chat / Client Chat / Meeting Chat a question → get an answer scoped to the relevant context
- **Click Magic Button** → run a firm-authored AI workflow on the current context, draft pre-filled
- **Record meeting** → Notetaker bot joins; transcript + summary + action items auto-extracted
- **Get nudged** → Slant scans book daily and pushes preparer to reach out (life event / drift / milestone)
- **Approve / edit / dismiss** any AI-drafted email, text, scheduling outreach, follow-up
- **Run automation** → trigger-driven workflows fire on CRM events
- **Build cohort** → "list all clients with $1M+ AUM" via Book Chat, save the cohort
- **Bulk-action** stale touchpoints / overdue reviews → assign, schedule, dispatch outreach
- **Customize Memories** → pin, edit, delete AI-extracted Memories
- **Create project** from template (Onboarding, RMDs, Move Money, Annual Review) → instances per client
- **Migrate from Redtail / Wealthbox** via automated import (human oversight)

### 1.5 Client-facing verbs (the actions the *client* / household members take)

Slant is preparer-facing only. There is no taxpayer/client portal. Clients receive emails / texts drafted by the system but approved by the advisor before send. No client-side authenticated surface visible. (Compare Docket: dual surface — client-portal + command-room.)

### 1.6 Memories — the "scoped to the client" pattern (CLAUDE.md §1)

**Marketing-page framing verbatim:** *"Memories, Not Fields — Rather than traditional CRM fields, Slant captures personal client details as 'Memories' and surfaces relevant ones before meetings and during interactions."*

**Founder framing verbatim (Thomas Clawson):** *"Unstructured data is usable in software for the first time. If a client mentions they're a die-hard BYU fan or they love Diet Coke, Slant will remember that."*

**Design rule (Clawson):** *"We are trying to minimize usage of custom fields — you can always ask Slant chat what it is."*

The Memories primitive is the load-bearing design decision of the whole product. The bet: AI extraction from unstructured artifacts (emails, meeting transcripts, notes, document parses) plus client-scoped surfacing beats a structured-field CRM where the human has to remember to fill in custom fields. Memory categories visible publicly: personal preferences (sports teams, drink preferences), family relationships (Client Tree expansion — see §6), professional milestones, communication preferences. Memories surface on the client record AND auto-populate the pre-meeting brief.

**Storage hint (inferred):** unstructured key-value memories per household, AI-curated, AI-surfaced. Not a separate database — likely embedded in the household record with retrieval scoring by relevance + recency.

### 1.7 The 3-scope chat (CLAUDE.md §4) — confirmed at three explicit Slant surfaces

From `docs.slant.app`:

| Scope | Slant naming | What it can do |
|---|---|---|
| **Client chat** | Household chat (per-household, on every record page) | Q&A bounded to one household: facts, emails, meetings, notes, files, accounts, opportunities, projects, sequences |
| **Meeting chat** | Meeting chat (per-recorded-meeting) | Q&A bounded to a meeting's transcript + linked client record. Action-item extraction. |
| **Book chat** | Book Chat (Home tab + global palette) | Q&A across entire workspace ("book"). Cohort building. Cross-household calculations. Task assignment. |

**Book Chat example queries (verbatim from docs):**
- *"How many clients do I have in tier A?"*
- *"List all clients with over $1M in AUM"*
- *"What's the total AUM across all my clients?"*
- *"Which prospects haven't had a meeting in the last 90 days?"*
- *"Create a task for Sarah to call the Smiths about their RMD"*

Book Chat can also **create records** (clients, prospects), **assign tasks** to teammates, run **financial calculations** (RMDs, compound interest, loan amortization, tax projections, portfolio analysis), and **browse documents** in connected file storage. This is more action-capable than Docket's currently-designed Ask Docket — it goes beyond Q&A into record creation + task assignment.

### 1.8 Nudges — the life-event + drift + milestone surface (CLAUDE.md §8)

**Verbatim positioning (Slant marketing):** *"Slant scans your entire book of business daily to spot the moments that matter most, like when a client's child starts college, their business hits a new milestone, or their portfolio just out of alignment, so you can reach out with perfect timing."*

**Nudge taxonomy (publicly visible examples):**
- Client birthday + family-member birthday (via Client Tree, see §6)
- Upcoming RMDs
- New jobs / promotions (Client Tree)
- Obituaries in family (Client Tree)
- Meeting follow-ups
- Family-event triggers: child starting college, marriage, divorce
- Business milestones: revenue thresholds
- Portfolio out of alignment (from custodian data sync)

**Nudge output:** drafted email + queued text + scheduled outreach. Per the Aug 2025 PR: *"Nudges are both reminders and little programs, agents that actually do work for you, from notifying you about client birthday reminders and generating correspondence, to meeting follow-ups to reminders about a client's upcoming RMD."* Advisor approves / edits / dismisses.

**Client Tree adoption metrics (from finopotamus.com, post-Feb 2026 launch at Future Proof Citywide AI Demo Drop):**
- 350+ Client Tree nudges sent to advisors
- ~10,000 family trees created

### 1.9 Magic Buttons (CLAUDE.md §4)

**Marketing-page framing verbatim:** *"Custom AI-powered workflows to do repeatable tasks directly from the chat."*

**Mechanic:** Each Magic Button is a firm-authored AI workflow with a label, a scope (client / meeting / book), and a template. Click invokes the workflow scoped to the current context, drafts the output for approval.

**Slant calls out a marketplace:** *"Users can select from fully customizable prompts or access pre-built templates via Slant's marketplace."* This is the firm-authored-template-becomes-installable-by-others pattern — same shape as Docket's planned Workflow Marketplace (CLAUDE.md §9 Workflow Marketplace).

**Cross-referenced on multiple product pages:** Magic Buttons appear on both AI Agents and AI Automation pages — Slant is positioning them as the connecting tissue between question-asking and action-taking.

### 1.10 Notetaker (CLAUDE.md §9)

**Marketing-page framing verbatim:** *"Records, organizes, and turns conversations into actionable follow-ups."*

**Mechanic:** Bot-joiner attends Zoom / Google Meet / phone meetings → records → transcribes → summarizes → extracts action items → drafts post-meeting follow-up email → links everything back to the client record.

**Pre-meeting automation:** *"The system handles agenda preparation and client brief creation before meetings occur."*

**Post-meeting automation:** *"After meetings conclude, Slant automates follow-up email distribution and compiles action item summaries."*

**Pricing:** notetaker is **bundled** with the CRM at $150/seat/mo — distinct from Jump's $75-100/mo standalone notetaker. Kitces commentary positions this bundling as Slant's structural advantage vs Wealthbox-plus-third-party-notetaker.

**Per Kitces (April 2026 AdvisorTech roundup):** Slant is one of three CRM-native notetakers (with Practifi and Wealthbox AI) — *"a category that did not exist when last year's report shipped, and that now structurally threatens the standalone vendor model."* Notetaker market shift is recent and consequential.

### 1.11 Pre-Meeting Brief (per CLAUDE.md §9)

**Marketing-page framing verbatim:** *"Personalizes meeting agendas, surfaces client details, handles scheduling and follow-ups."*

**Mechanic:** N hours before a calendar event tagged as a client meeting, fires:
- Personalized agenda
- Relevant Memories surfaced
- Key client details pulled (recent emails, last meeting notes, open tasks, opportunities)
- Documents pulled (relevant files for the meeting)
- Logs notes + drafts follow-ups post-meeting

Marketed as "the Meeting & Scheduling Agent" — one of the three named agents (Nudges + Meeting&Scheduling + Chat) in their Aug 2025 launch announcement.

### 1.12 Action-Item Extractor

Part of Notetaker rather than a distinct agent. From `docs.slant.app/activity-management/meetings/overview` (404'd but cross-referenced): meeting transcripts produce tasks, assigned to owners, with due dates. Linked back to the household. The integration point: action items flow into the same Tasks primitive that's used everywhere else in the product (no separate "meeting tasks" silo).

### 1.13 Client Tree (the data-enrichment expansion, launched Feb 2026)

**Marketing framing:** *"Family-member birthdays, new jobs or promotions, and obituaries"* surfaced for the advisor so they can act with "appropriate timing."

**Mechanic:** AI-powered suggestions including:
- Send email / text
- Recommend a call
- Send a gift or flowers

Launched at Future Proof Citywide AI Demo Drop, March 2026. By Feb 2026 (post-Feb 2026): ~10,000 family trees created, 350+ Client Tree nudges sent.

This is the **wealth-transfer relationship play** — advisors who maintain a relationship with the next generation keep the AUM when the principal passes. Tax has a similar shape (children → file independent returns at 18-22 → new client relationships), though softer than the AUM transfer dynamic.

### 1.14 Custodian data integration ($6B AUM milestone)

Slant ships native custodian integrations: Schwab, Fidelity, Pershing, Betterment confirmed. Altruist queued. Result: $6B AUM connected in 2 months (Dec 2025 launch → Feb 2026 milestone). The integration carries:
- Account information
- Positions
- Transactions
- Tax lots

This is Slant becoming the "system of record" (per Clawson). Same play we want in tax: Docket as system of record over OLT + IRS Solutions + IRS Tax Pro Account + Xero + bank feeds.

### 1.15 Document Filler (signature workflow)

From `docs.slant.app/records/household-details/document-filler`: Slant ships its own document-filler + DocuSign integration. Fill documents → send for signature → settings configurable. This is the *third-party-tool consolidation* play (Docket equivalent: 8879 e-signature via DocuSign embedded signing — CLAUDE.md L6 tech foundation).

### 1.16 Sequences (multi-step outreach)

From `docs.slant.app/platform-features/sequences`: multi-step email sequences with approval workflows. Used for prospecting (lead nurturing) AND client outreach (year-end check-ins, review-prep). One primitive, two use cases.

---

## 2. Founder + founding story

### 2.1 Founders

**Thomas Clawson** — Co-founder. Salt Lake City metro area. BYU (undergrad). Previously: led collectibles marketing at Whatnot (YC unicorn); before that, led Demand Generation at Podium (YC unicorn). Both are YC alumni companies — meaningful for the Slant-vs-YC question (Slant itself is *not* YC, but the founder's prior employers are; the YC operating playbook is in his bones).

**Max Metcalf** — Co-founder. Salt Lake City. BYU (mathematics). Software engineer: Orca Health → SimpleNexus (Utah-based startups). Also previously at L.E.K. Consulting and Sorenson Impact. Built the working MVP in February 2023.

### 2.2 The relationship

Met in **2013, as LDS missionaries in Denmark together** (Clawson served 2013–2015). They've been building together for a decade. Both attended BYU after the mission. Both fluent in Danish. The 2048 Ventures investment note: *"finish each other's sentences."* This is the closest match for Docket's David + Haokun ("5+ year working relationship before Docket; on the project from inception" per CLAUDE.md §1) and the relationship-as-moat signal is one of the elements both investors and YC reviewers weight heavily.

### 2.3 The Pageport → Slant pivot story (verbatim)

The pivot is the load-bearing element of Slant's investor narrative. **Capture it verbatim because the YC application needs the same shape.**

**Pre-pivot Pageport (2023–2024):**
- Founded 2023 with $1.2M pre-seed (2048 Ventures + Boost VC).
- Original product: **vertical-video lead-conversion tool for financial advisors** — "personalized video landing pages" advisors could embed in lead-nurture workflows ("a website for one").
- Integrations: HubSpot, Salesforce, Pipedrive, Zapier, Gmail, Outlook, Twilio.
- Founders quit jobs **May 2023** to focus full-time after Metcalf's working MVP shipped Feb 2023.
- By Aug 2024: **1,000+ advisors**, **~$1M ARR**.
- Customer base: *"advisors with high lead volumes who had been struggling with cumbersome legacy CRMs."*

**The trigger event (verbatim — Clawson on Customer Wins podcast):**

> *"By the 400th time you've heard that question or a thing asked that way, we looked at ourselves and said, hey, this first product's been great, but we keep saying the CRM should handle this, and it's not."*

The specific moment cited:

> *"Users asked 'how do I add a custom field of Social Security number here in Pageport?' and stated 'my current default is so bad, I'm going to use your thing that's not meant for it and muscle it to be my new CRM.'"*

This is the verbatim "two users wanted SSN fields" detail referenced in CLAUDE.md §25. The trigger is precise: when **paying customers start trying to repurpose your point-solution as a CRM** (asking for fields you never built, doing work the point-solution isn't designed for), the market has told you what to build next.

**Strategic reframing (Clawson):**

> *"We realized most of the value we were providing should have been handled by the CRM itself. The problem was advisors were stuck on legacy, pretty crappy CRMs."*

**Build timeline (Clawson):**
- February 2025 — ideation
- March 2025 — build started (entirely in-house, led by Metcalf)
- August 2025 — public launch + $3.3M seed announcement + ~40 beta users on the platform
- Six-month sprint from ideation to **functional, safe, SOC 2-compliant CRM**

**Customer research substrate during the pivot:** 300+ advisor conversations. "Advisor in Residence" program — two advisors embedded in Lehi office working directly with engineers and product. Three years of pre-pivot advisor research total.

### 2.4 Co-founders + team composition

Per `slant.app/about` and other coverage, the team as of ~Aug 2025 announcement was **~9 people**, growing to **~16 people** by Apr-May 2026 (per inferred hiring announcements + LinkedIn evidence). Named team (Aug 2025 → current):

| Name | Role |
|---|---|
| Thomas Clawson | Co-founder |
| Max Metcalf | Co-founder (engineering lead) |
| Hayden Neal | GTM Lead |
| Hannah Gaskill | Head of Customer |
| McKade Adams | Onboarding Manager |
| Emma Walton | Onboarding Manager |
| Josh Menden | Software Engineer |
| McKay Court | Software Engineer |
| Chris Arnold | Software Engineer |
| Radley Nelson | Software Engineer |
| Trevan Reese | Software Engineer |
| Hunter Romano | Account Executive |
| Seth Stones | Account Executive |
| McKay Murphy | Account Executive |

Team shape: **5 engineers + 3 AEs + 2 Onboarding Managers + GTM Lead + Head of Customer + 2 founders** = ~13–16 visible roles. The 5-AE / 2-Onboarding-Manager / GTM-Lead / Head-of-Customer mix is **>50% customer-facing**, which is intentional — Slant optimizes for sales motion over feature velocity (per CLAUDE.md §25 #3 lesson).

### 2.5 Y Combinator status

**Slant is NOT a YC company.** Neither Pageport nor Slant has been part of a YC batch. **Both founders worked at YC unicorns** prior (Clawson at Podium + Whatnot — both are YC W16 / YC W22 alumni respectively). The YC operating playbook is internalized but the company chose VC (2048 + Boost + Matchstick) over YC.

**Implication for Docket's YC Fall 2026 application:** Slant is the *vertical-adjacent reference* you cite without being a direct YC competitor in your batch. The narrative shape ("we ran a wedge tool, customers pulled us into the platform, here's the data, give us money to ride the demand") is exactly the shape YC reviewers reward in Fall 2026, and you have a non-YC alumnus example to point at as validation.

### 2.6 Lehi, Utah HQ (CLAUDE.md §14)

**Pageport / Slant HQ:** Lehi, Utah (Salt Lake City metro). Specific address surfaced via The Wealth Mosaic: **272 N 100 E, American Fork, UT 84003** (American Fork is the city directly adjacent to Lehi; address may have moved between the announcement and current listing). Per Matchstick Ventures' investment note: *"tight nine-person team"* with *"deep connections within the financial advisory community."*

**Hiring posture:** On-site only. Founders are BYU alums; team is BYU-heavy; the LDS network is a deliberate talent-pool concentration. This is **not transferable** to Docket and CLAUDE.md §14 explicitly rejects "on-site-only hiring" as a Slant pattern.

---

## 3. Funding + growth metrics

### 3.1 Total raised — $4.5M over 2 years

| Round | Date | Amount | Lead | Co-investors |
|---|---|---|---|---|
| **Pre-seed** | 2023 (founders quit jobs May 2023) | **$1.2M** | 2048 Ventures | Boost VC |
| **Seed** | **August 2025** | **$3.3M** | 2048 Ventures (lead) | Matchstick Ventures + strategic angels |
| **Total** | 2 years | **$4.5M** | — | — |

Two-stage funding pattern. **Pre-seed funded the point-solution (Pageport) for 18 months. Seed funded the platform launch when they had PMF proof.** This is the canonical structure CLAUDE.md §25 #2 calls out as the model for Docket: $1.2M-1.5M pre-seed off Discovery Scan revenue summer 2026 → $3M+ seed Spring 2027 after platform PMF proof.

### 3.2 Lead investor — 2048 Ventures (both rounds)

2048 Ventures led both rounds. Investor: **Zann Ali, Principal**. Investment notes (verbatim):
- Pre-seed: *"What drew us to Max and Thomas wasn't just their product instinct, but their palpable passion and customer obsession."*
- Seed: *"The advisor CRM market has lacked innovation, but we believe systems of record are the foundation for winning in AI."*

2048 is a vertical-AI-focused pre-seed fund. They have a "Pre-Seed Fast Track" program. Their thesis: **vertical AI-native systems of record** is exactly Docket's category. They are a credible target for our pre-seed pitch when the time comes — but only after the founder-50 cohort has demonstrated PMF on the wedge.

### 3.3 Co-investors

**Boost VC** (pre-seed only) — early-stage fund, Brayton Williams co-founder. Quote on Pageport investment: *"Pageport is changing that by giving every person their own personalized site for businesses. Max and Thomas had paying customers day one, with revenue growing very quickly which is a testament to how valuable Pageport is to their customers."*

**Matchstick Ventures** (seed only) — Midwest-focused, less crowded. Investment thesis (verbatim from Matchstick blog):
- Market: *"dominated by outdated platforms like Redtail and Wealthbox"*
- Opportunity: *"helping each advisor serve more clients effectively translates to expanding access to quality financial advice for millions"*
- Founders: *"firsthand experience building advisor-focused point solutions" gives them "unique insight into the workflows that matter most"*
- Team: *"tight nine-person team" with "strong product instincts, and deep connections within the financial advisory community"*

**Strategic angels** — named but not disclosed in PR announcements. Inference: likely advisor-network angels with industry relationships (the customer-base they were already selling to).

### 3.4 Current valuation

Not publicly disclosed. Seed-round valuation typically 4-6x funding round size (industry standard) → **~$15-20M post-money** for the seed round. No subsequent priced round disclosed.

### 3.5 Revenue / ARR

**By Aug 2024 (Pageport):** $1M ARR with 1,000+ advisors → **~$1,000 ARR per advisor** (some buying cheaper plans, some buying higher-ticket).

**Slant launch (Aug 2025):** 40 beta users on the platform; mostly migrating from Pageport.

**Slant pricing:** $150/seat/mo → $1,800/seat/yr.

**Current customer base (per Customer Wins podcast):** *"Since launching in April of 2023, Slant has grown to work with over 1200 financial professionals."* This is somewhat ambiguous — Slant the CRM didn't launch until Aug 2025; the 1,200 number likely conflates Pageport + Slant users. Reality (best inference): ~1,000-1,200 advisors total in the Pageport + Slant funnel; **~200 firms** currently using Slant CRM daily (per Aug 2025 PR cohort), growing.

**ARR at $150/seat at 200 firms (1-2 seats/firm avg) = ~$540K-1M ARR.** This is consistent with CLAUDE.md §25 estimate of "$1M ARR" though the precise figure isn't publicly disclosed for Slant-the-CRM specifically; it's a reasonable inference from Pageport+Slant combined.

### 3.6 Custodian connection milestone

**$6 billion AUM connected within 2 months of custodian-data launch** (Dec 2025 → Feb 2026). This is the metric Slant has been beating on publicly — not customer count, not revenue, but AUM-on-platform. Smart marketing: AUM is the metric the advisor industry uses to measure scale; Slant is positioning as scale-credible through this metric without revealing direct customer growth.

### 3.7 Growth rate

Inferred from public data:
- Aug 2025 launch with 40 beta users
- Feb 2026: 200+ firms / 1,200 advisors / $6B AUM connected
- **5x growth in 6 months** by customer count; **infinite** by AUM (started at $0 connected)

Whether the 1,200 number reflects net-active or includes Pageport legacy is ambiguous. The 200-firm number is more directly comparable.

---

## 4. Pricing model deep-dive

### 4.1 Headline price — $150/seat/month

**Confirmed across multiple sources** (wealthmanagement.com, Kitces AdvisorTech roundup, Slant pricing page):
- **$150 per seat per month** (monthly billing)
- **Annual discount** (specific % not publicly disclosed; industry standard ~15-20%)
- **Beta-user discount** for ~40 early users (also not disclosed)
- **Contact Sales** for enterprise (probably $200-300+/seat for 50+ advisor firms; firm structure not disclosed)

**The price BUNDLES** the CRM + AI notetaker + AI agents + Magic Buttons + automations + prospecting + custodian integrations. Jump charges $75-100/mo for the notetaker alone. **The bundling IS the pricing strategy.**

### 4.2 No free tier

Slant explicitly has no free tier. No demo-without-commitment beyond a sales call. Beta program is closed.

### 4.3 Comparison-table-as-pricing-page

Slant's `/pricing` page leads with the **competitor matrix** (Slant vs Wealthbox vs Redtail), then the seat price. The matrix surfaces:

| Feature | Slant | Wealthbox | Redtail |
|---|---|---|---|
| Client & prospect management | ✓ | ✓ | ✓ |
| Tasks | ✓ | ✓ | ✓ |
| Projects | ✓ | ✓ | ✓ |
| Opportunities | ✓ | Limited | Limited |
| Notetaker | ✓ | Limited | Limited |
| Prospecting | ✓ | — | — |
| AI Agents | ✓ | — | — |
| AI Nudges | ✓ | — | — |
| AI Chat | ✓ | — | — |

Buyer reads the value justification before seeing the price. **Tool-consolidation framing is the math:** Slant @ $150 vs (Wealthbox $89 + Otter notetaker $30 + Salesloft prospecting $125 + Asana project mgmt $25) = $269/mo. Slant cuts the cost in half AND consolidates the UX.

### 4.4 Compared to Docket per-active-client model (CLAUDE.md L6)

| Dim | Slant | Docket |
|---|---|---|
| Unit | Seat | Active client |
| Value unit | Advisor (the productive worker) | Client (the productive return / engagement) |
| Penalty | Growth = more seats = more cost | Growth = more clients = more revenue (aligned) |
| Anchor | $150/seat/mo | $5/active client/mo effective |
| Founder tier | Beta discount | $250 flat, ≤100 active clients, all agents included |
| Mid-market | Contact Sales | $14,999/mo for 2,000 included + $3/active to max $23,999 |
| Bundling | All agents + notetaker bundled | Core agents bundled; Discovery/Strategy/Audit Defense add-on for Solo+Small tiers |

**Why per-seat is wrong for tax (CLAUDE.md §14 explicit NO):** a tax practice's value unit is the *return* / *client*, not the *staff seat*. A 5-seat firm with 100 clients = same throughput as a 2-seat firm with 100 clients (different efficiency, same revenue). Per-seat punishes the efficient firm. Per-active-client aligns cost with revenue. This is structural; the tax vertical economics differ from the advisor vertical economics here.

---

## 5. Distribution + GTM

### 5.1 Customer-acquisition channels (Slant's observed playbook)

1. **Founder-led sales** — Clawson + Metcalf personally close deals. The first 40 beta users were all founder-touched.
2. **Word-of-mouth in the advisor community** — small, networked vertical; happy advisors refer peers.
3. **Conference presence** — Future Proof Citywide (Miami, March 2026 — Client Tree launch venue; AI Demo Drop participant); inferred FPA Annual, Schwab Impact, MMI conferences.
4. **Industry press** — coordinated launch with PR Newswire + Wealth Management Magazine + Utah Business + Yahoo Finance + multiple outlets. The Aug 2025 seed announcement was a 6+ outlet coordinated push.
5. **Founder podcast appearances** — Clawson on "Customer Wins" (Richard Walker), and apparent others. Builds founder profile + ICP awareness.
6. **Trade publication thought leadership** — Kitces AdvisorTech monthly + WealthManagement.com features. The Aug 2025 wealthmanagement.com feature ("RIP Traditional Advisor CRM, Meet Slant") is the canonical positioning piece.
7. **Custodian partnerships** — Schwab Advisor Services has Slant in their provider directory. This is distribution muscle the company doesn't have to build (Schwab brings the advisors).
8. **Product-led growth (PLG) lite** — sign up via web → demo → buy. Not pure self-serve.

### 5.2 Influencer-led marketing observation

Less prominent than expected. The advisor space has named influencers (Michael Kitces, the Carson Group folks, etc.) — Slant is in the Kitces AdvisorTech roundup but doesn't appear to be running paid influencer programs visibly. Their growth motion is **AE-driven founder-led** rather than influencer-amplified.

### 5.3 Partner ecosystem (custodian integrations)

This is the load-bearing distribution play: **Schwab, Fidelity, Pershing, Betterment are listed as custodian partners** (each carries an integration setup page on the custodian's advisor portal). This is *vendor-leveraged distribution*: when Schwab tells an RIA "we integrate with Slant," that's free top-of-funnel. Docket's equivalent is the OLT + IRS Solutions + Xero + Square + Twilio + DocuSign integration partner network — for now, browser-automation MCP servers (CLAUDE.md §10) are the substrate, not direct partner programs.

### 5.4 Content marketing

Slant's `/resources` URL 404s currently. Suggests Resource Center is planned (per CLAUDE.md §25 #3 marketing strategy: hub-and-spoke content) but not fully shipped yet. Inferred from competitive context: blog cadence is moderate (1-2 posts/month), not Wealthbox-aggressive.

### 5.5 Brand investment

Clean wordmark, consistent typography, branded press release imagery. Visible brand investment. **The tagline rhythm is the marketing centerpiece:** *"Be the reason behind the retirement party, the second home, the peace of mind. Book a demo."* Emotional close on every page footer. Same pattern adopted by Docket per CLAUDE.md §25 #1: *"Be the EA every taxpayer wishes they had — and the one your peers ask for advice."*

---

## 6. Memory surface — the load-bearing piece for Docket

This is the single strongest steal-from-Slant for our product. Memory is the substrate decision; the Memories surface is the user-facing realization. **Re-emphasize verbatim** because the framing is the product.

### 6.1 Marketing positioning (verbatim from `/product/crm`)

> *"Memories, Not Fields — Rather than traditional CRM fields, Slant captures personal client details as 'Memories' and surfaces relevant ones before meetings and during interactions."*

### 6.2 Founder framing (verbatim from Customer Wins podcast)

> *"The future of this whole industry and of AI is unstructured. Data is now useful."*

> *"[You] should be able to ask, who are all my clients and what are their favorite sports teams?"*

> *"Unstructured data is usable in software for the first time. If a client mentions they're a die-hard BYU fan or they love Diet Coke, Slant will remember that."*

### 6.3 Design rule (Clawson)

> *"We need to make common things easy and uncommon things possible."*

> *"We are trying to minimize usage of custom fields — you can always ask Slant chat what it is."*

This is the **kill-the-custom-field principle**: AI captures unstructured Memories; chat answers any structured query without requiring the human to predefine a schema field.

### 6.4 Memory categories visible publicly

- **Preferences** — sports teams (BYU fan), drinks (Diet Coke), restaurants, vacation spots
- **Family** — spouse names, children's names + ages, family events (Client Tree expansion)
- **Professional** — title, company, industry, key colleagues, milestone dates
- **Communication preferences** — channel choice (email vs text), times to call, language
- **Financial milestones** — RMD age, retirement target, AUM thresholds, life events
- **Historical context** — past meeting decisions, prior advisor (migrated record), what they care about

### 6.5 Surfacing UX

- **On the client record** — Memories tab/section visible at all times
- **In chat (Client Chat)** — Memory-grounded answers
- **Pre-meeting brief** — top Memories auto-pulled into the brief 1-24 hours pre-meeting
- **During meetings** — Notetaker uses Memories to contextualize transcripts (action items appropriate to the client)
- **In outreach drafts** — Memory-aware email/text drafts (e.g., reference Lily's UC Davis start in the Q4 planning email)

### 6.6 Customer testimonials referencing Memory

**Daren Blonski, CEO, Sonoma Wealth (10-advisor firm, ~$1B AUM, 3,000 households):**
> *"An AI agent in the background 24/7 verifying all the data is correct or letting me know that they have or haven't been contacted in X months."*
> Reconciling client data inconsistencies (DOB across applications, e.g.) is "a game-changer."

**Alex Stoehr, Northstar Investment Partners (Alpharetta GA, RIA, scaled 400%):**
> *"With Slant, you're actually able to focus on the client and build a relationship... It almost feels like you have an assistant for your business."*

**Jason Jacobi, Boyer Financial Services:**
> *"Now we can pull up positions and recent activity instantly, right alongside the full client record, with everything in one place."*

### 6.7 Memory edit / curation UX

Inferred from documentation:
- Memories are AI-extracted continuously from emails, meeting transcripts, notes, document parses
- Advisor can **pin** important Memories so they always surface
- Advisor can **edit** any Memory (correct factual errors, refine wording)
- Advisor can **delete** Memories that became stale or wrong

### 6.8 Application to Docket — Memory Curator Agent (CLAUDE.md §9)

The exact Slant pattern is what CLAUDE.md §9 spec'd:

> *"Memory Curator Agent (continuous Memories extraction) — Background job that extracts plain-English Memories from every inbound message, meeting transcript, doc parse, and intake answer → writes `client_facts` rows tagged `kind='memory'`. Drives the Memories tab UI (§4). Locked 2026-05-13 after Slant.app research; their 'Memories' surface is the strongest single steal from their product. Ships Phase 5."*

Same shape, tax-specific examples:
- *"Daughter Lily starts UC Davis Aug 2026 (AOTC + 529 windowing relevant)"*
- *"Owns rental at 1244 Olive — depreciation Schedule E"*
- *"Took Augusta Rule position 2024, $14K saved"*
- *"Prefers SMS over email; never call between 9am-1pm — daycare hours"*
- *"Spouse files MFS; works at different CPA — request Form 8958 by 2/15"*

The memory primitive plus chat-based query collapses the "client schema bloat" anti-pattern that all of TaxDome / Canopy / Karbon suffer from. Same architecture, our specific tax memory types.

---

## 7. Nudges surface

### 7.1 Marketing-page framing (verbatim)

> *"Slant scans your entire book of business daily to spot the moments that matter most, like when a client's child starts college, their business hits a new milestone, or their portfolio just out of alignment, so you can reach out with perfect timing."*

### 7.2 The "perfect timing" framing

The phrase "perfect timing" is the marketing keyword. The system isn't reminding you to do tasks **you forgot** (table stakes); it's surfacing moments you'd **have never known about** without the system scanning the data. This is the differentiator vs Wealthbox-with-AI-add-on (which can only fire reminders on data you explicitly entered).

### 7.3 Trigger taxonomy (publicly visible + inferred)

| Trigger class | Examples |
|---|---|
| **Life events** | Child starts college · marriage · divorce · death in family · obituary · job change · new home · promotion · birth |
| **Time windows** | Birthday · client anniversary · RMD turnover age (73) · 401(k) catch-up at 50 · Roth conversion windows · annual review cadence |
| **Drift** | Portfolio out of alignment (custodian data) · income change · AUM threshold crossed · spending pattern change |
| **Milestones** | Business hits revenue threshold · client crosses $1M net worth · home value crosses threshold · 60-day-no-touch threshold |
| **Compliance** | Annual review overdue · KYC update required · trust amendment trigger |

### 7.4 Output format

Each Nudge surfaces with:
- A pre-drafted email/text
- A queue-able outreach action
- A suggested scheduling action (book a call, send a gift, etc.)
- One-click Approve / Edit / Dismiss

### 7.5 Cross-reference: Client Tree as Nudge expansion

Client Tree (Feb 2026 launch) **extends** Nudges to family members of the household, not just the principal client. So when the principal client's daughter starts a new job, the advisor gets a nudge with a drafted message — because the family relationship is the long-term retention play (and the AUM-transfer play).

### 7.6 Customer reaction

From wealthmanagement.com feature: advisors reported that Nudges + Memory Banks combined produced the "actually feels like an assistant" experience. Daren Blonski (Sonoma Wealth, who adds 30 clients/month) cited the "AI agent in the background 24/7" framing as the value.

### 7.7 Application to Docket — Nudges Agent (CLAUDE.md §8)

The Nudges spec in CLAUDE.md §8 is already direct-mapped from Slant:

> *"Locked 2026-05-13 after Slant.app research. Nudges are the proactive outreach surface — different from Discovery, Strategy, and Position. Fire on life events, time-window drift, and client-fact milestones that suggest the preparer should reach out before the client knows they need to."*

Tax-specific triggers (CLAUDE.md §8 has the full table):
- Life event: Child turns 18 (no longer dependent) · child starts college (AOTC) · marriage · divorce · spouse death · property purchase
- Time window: Q2 estimated payment June 15 · Q3 Sept 15 · Q4 Roth conversion window · BOI deadline cohort · RMD age 73
- Drift: W-2 jumped 40% YoY · 1099 tripled · charitable giving doubled (bunching)
- Milestone: Business hits §199A phaseout edge · CA SoS suspension risk · LLC formed → BOI deadline starts
- Compliance: Statement of Information overdue · payment past due

Same primitive, same UI surface, different rule library. Nobody at the tax-vertical PM tier (TaxDome / Canopy / Karbon) does this; nobody at the return-prep AI tier (Black Ore / Accrual / Basis) does outreach at all. **Open white space.**

---

## 8. Magic Buttons

### 8.1 Slant's framing

**On `/product/ai-agents`:** *"Custom AI-powered workflows to do repeatable tasks directly from the chat."*

**On `/product/ai-automation` (cross-mentioned):** Same primitive surfaces here too — Magic Buttons sit at the intersection of "ask the AI" and "run an automation."

### 8.2 Marketplace concept

> *"Users can select from fully customizable prompts or access pre-built templates via Slant's marketplace."*

Two implications:
1. **Slant ships starter buttons** — pre-built templates the user gets out-of-the-box
2. **Firms author their own buttons** — fully customizable prompts
3. **Marketplace** — firm-authored buttons become installable by other firms

This is the same Workflow Marketplace pattern CLAUDE.md §9 calls out as the platform-lock-in compounding mechanism: firm-specific buttons increase switching cost; cross-firm sharing increases network effect.

### 8.3 Starter buttons (inferred — not all publicly enumerated)

Likely shipped templates (inferred from product surfaces):
- Draft client outreach email (per-context: birthday, RMD reminder, annual review, missed appointment)
- Draft meeting agenda
- Pre-fill review prep package
- Generate financial summary
- Compose follow-up sequences
- Custom-prompt builder

### 8.4 The chat-question-to-action bridge

This is the key insight for Docket. The natural anti-pattern in AI products: chat answers your question but can't *do* anything. Magic Buttons close that loop: in the same chat surface where you ask "what's Maria's Q4 planning context," the Magic Button "Draft Q4 planning email" runs the workflow you'd otherwise need to flip to a separate tool to execute.

### 8.5 Application to Docket — Magic Buttons (CLAUDE.md §9)

Already locked in CLAUDE.md §9:

> *"Pattern. A click in Ask Docket (3-scope chat) that runs a firm-authored AI workflow on the current context. Different motion than AI Tasks (scheduled + natural-language-authored): Magic Buttons are on-demand + pre-authored."*

Tax-specific starter buttons (from CLAUDE.md §9):
- Q4 Planning Email
- Year-End Review Memo
- Audit Defense Draft
- Engagement Letter Renewal
- Bad-Client Fire Letter
- BOI Reminder
- Statement of Information Renewal
- 8821 Filing

Same primitive, tax-specific library. Marketplace pattern compounds the more firms author templates.

---

## 9. Notetaker + Pre-Meeting Brief

### 9.1 Notetaker mechanics

**Slant Notetaker is bundled with the CRM at $150/seat/mo.** No separate add-on price. Distinct from Otter ($16.99), Fathom ($24), Jump ($75-100). The bundle math is the GTM weapon.

**Bot-joiner:** standard pattern — Slant Notetaker bot joins Zoom / Google Meet / phone meeting on the advisor's calendar invite.

**Transcript handling:** verbatim transcript saved + auto-summary + extracted action items. Linked to the client record. Searchable via Book Chat ("did we ever talk about Nvidia? Here's the two emails and the one meeting" — Clawson, verbatim).

**Compliance:** Slant notetaker is positioned as advisor-CRM-native, which carries the SOC 2 + audit-ready posture forward to transcripts. Specific privacy/consent flow not publicly documented.

### 9.2 Pre-Meeting Brief automation

**Marketing framing (Aug 2025 launch):** Meeting & Scheduling Agent: *"prepares a personalized agenda for advisor-client meetings, brings in needed documents, and surfaces any key client details. It will also reach out to the client and do the scheduling, including confirmations and reminders and takes care of logging post-meeting notes, updating client or prospect records and preparing follow-ups."*

So the Pre-Meeting Brief is **part of a broader Meeting & Scheduling Agent** that includes:
- Pre-meeting agenda + document pull + Memory surfacing
- Outbound scheduling (initial invite + confirmation + reminder)
- During-meeting Notetaker recording
- Post-meeting follow-up draft + action items + client-record update

### 9.3 Action-item extraction

Embedded in Notetaker output. From the AI roundup (Kitces): action items become tasks (assigned to owner: advisor or client) with due dates. The "client commits to send X by Y" extraction is the load-bearing capability.

### 9.4 Compare to Ping (and our Docket Notetaker plan)

Ping is the strongest comparable in tax. Slant's bundled-pricing posture is the differentiator. **Docket's plan (CLAUDE.md §9): Notetaker + Pre-Meeting Brief Agent + Action-Item Extractor as three explicit agents (V1.5 ship), bundled in standard pricing.**

The Slant lesson: **don't price the notetaker separately**. The bundling IS the moat. Once we ship our Notetaker, Otter+Ping+Fathom become buyable-elsewhere capabilities that don't differentiate. The Docket lock-in is the Notetaker that *writes back into the tax engagement workflow*.

---

## 10. Marketing site walkthrough (hero copy, taglines verbatim)

### 10.1 Hero (homepage)

**Headline:** *"The Relationship CRM for Financial Advisors"*

**Subheadline:** *"AI that surfaces what matters, offloads the busywork, and frees up time for the stuff only you can do."*

**CTA:** *"Book a demo"*

### 10.2 "OUR WHY" section

**Eyebrow:** *"OUR WHY"*

**Tagline:** *"Advisors deserve better. Most CRMs demand constant attention and give little back."*

**Three benefits:**
1. *"More time for clients"* — Slant handles administrative tasks to enable relationship building
2. *"AI that works for you"* — System learns user workflows and delivers relevant information proactively
3. *"Trust, built in"* — SOC 2-compliant, encrypted, audit-ready infrastructure

### 10.3 Features section

**Eyebrow:** *"WHAT WE DO"*

**Tagline:** *"Advisor CRMs are finally getting an upgrade."*

**Four feature categories (with their one-liner descriptions):**
- **AI Chat:** Conversational interface for drafting emails, meeting prep, task management
- **Notetaker:** Records meetings and links to client records
- **Prospecting:** Identifies prospects, enriches contact data, automates outreach
- **Workflows:** Automates follow-ups, reminders, onboarding, reviews

### 10.4 Customer testimonial section (verbatim)

**Alex Stoehr, Northstar Investment Partners:**
> *"With Slant, you're actually able to focus on the client and build a relationship... It almost feels like you have an assistant for your business."*

Additional named contributors on the testimonial section: **Daren Blonski** (Sonoma Wealth Advisors), **Jake Gardner** (Defining Wealth), **Michael Sheerin**, **Ben Gajardo**, **Jason Jacobi** (Boyer Financial Services).

### 10.5 Logo wall

Ten company logos displayed: **Sonoma, Boyer, Northstar, Flip Flops, Van Diest, Maguire, Exponent, Guided, Artifex, Defining Wealth.**

### 10.6 Closing CTA (the structural emotional anchor)

> *"Be the reason behind the retirement party, the second home, the peace of mind. Book a demo"*

This appears on every page footer. The emotional close is the load-bearing marketing pattern (CLAUDE.md §25 marketing #1). The Docket equivalent is locked: *"Be the EA every taxpayer wishes they had — and the one your peers ask for advice."*

### 10.7 Footer navigation

| Group | Links |
|---|---|
| **Product** | CRM record, AI agents, Project management, Notetaker, AI automation, Marketing, Client reviews |
| **Resources** | Resource center, About Us, Docs, Security |
| **Company** | Careers, Contact |
| **Legal** | Privacy policy, Terms of Service, Cookie Policy |

**Copyright:** ©2025 Slant.

### 10.8 Mission statement (about page)

> *"Advisors matter. We're building the tools that help them serve the 20 million Americans who soon seek financial advice."*

The "20 million Americans" reference is the consistent TAM anchor in their pitch. **Docket equivalent: the ~150M tax-filing taxpayers x ~70% who use a preparer = ~100M filings/yr touched by our segment.** Anchor is bigger; framing the same.

### 10.9 Founder vision (from Customer Wins podcast)

> *"I want their job to be easier. I want them to come to work and not have 80 things to do, but maybe 18."*

> *"I want that Iron Man feeling for a lot more people. It'd be fun."*

> *"People deserve to use great software. I hate bad software."*

The "Iron Man feeling" framing is the verbatim emotional north star — the AI is a JARVIS for the advisor. Cleaner equivalent for tax: *"Antonio gets a co-pilot who knows the IRC, knows the client, and knows what to do next."*

---

## 11. Customer profile + ICP

### 11.1 The "sweet spot" — direct quote

From wealthmanagement.com Aug 2025 coverage: Slant's **"sweet spot is an advisor with an admin or two."** Read: 2-5 person advisor practices, not solo, not large.

### 11.2 Customer firmographics (visible cases)

- **Sonoma Wealth Advisors** (Sonoma CA): 10 advisors, ~$1B AUM, 3,000 households. Adds 30 clients/month. Daren Blonski, President/CEO.
- **Northstar Investment Partners** (Alpharetta GA): RIA, scaled 400%. Alex Stoehr, CEO/Lead Advisor.
- **Boyer Financial Services**: Wealth advisor Jason Jacobi.
- **Defining Wealth**: Jake Gardner.
- **Flip Flops, Van Diest, Maguire, Exponent, Guided, Artifex** — logo-wall firms; sizes not disclosed.

Pattern: **small-to-mid-size RIAs**. Not solo. Not Big-RIA. The 2-15 advisor firm with 100-3,000 households and $100M-$1B AUM is the sweet spot.

### 11.3 Years in practice

Inferred mid-career. Advisors with established practices and active growth motion, not fresh-out-of-CFP. Active growth = the "70-90 clients today, want to scale to 200-250" framing in their pitch.

### 11.4 Tech stack Slant replaces

From `/pricing` competitor matrix + Kitces commentary:
- **Wealthbox** (incumbent CRM, ~$59-89/seat) — Slant's #1 replacement target
- **Redtail** (incumbent CRM, ~$99/seat) — Slant's #2 replacement target
- **Salesforce FSC** (heavy CRM, $300-500+/seat) — less common in 2-15-advisor firm
- **Otter / Fathom / Jump** (separate AI notetaker, $25-100/mo) — bundled-replaced
- **Asana / ClickUp / Bento Engine** (project management) — replaced
- **Sales engagement tool** (Salesloft / Outreach for prospecting, $125+/seat) — bundled-replaced
- **Manual scheduling tool** (Calendly + manual outreach) — replaced by Meeting & Scheduling Agent

Five-to-six-tool consolidation. Same shape as Docket's TaxDome + Canopy + Karbon + DocuSign + Square + Otter (6+ tool collapse — CLAUDE.md §13 marketing lead).

### 11.5 AUM range

$100M – $1B (small-mid RIA). Sonoma Wealth at $1B is at the upper end of the public testimonial set. The product is *capable* of more (Salesforce FSC competes upmarket); the sweet spot is here.

### 11.6 NOT their ICP (negative space)

- Solo RIAs (sub-$50M AUM) — too price-sensitive at $150/seat
- Big banks / wirehouses (Morgan Stanley, Merrill, UBS) — incumbent CRM lockdown
- Large RIA aggregators (Carson, Mariner, Mercer) — Salesforce FSC + custom apps
- Insurance-first practices — different value chain

---

## 12. Strategic lessons applicable to Docket (the YES list)

The thirty-three SLANT-LESSONS.md list is the complete map. Highest-leverage takeaways re-emphasized here:

### 12.1 The pivot pattern is the YC narrative arc (lesson §1)

Pageport (point solution; 2 years; 1,000+ users; $1M ARR) → Slant (platform; 6 months to launch; $3.3M seed at launch; $6B AUM connected in 2 months).

**Docket map:** Discovery Scan (productized service; $1-5K per book scan, per CLAUDE.md L6) → 100 firms by 8/1 (per CLAUDE.md L16) → Docket platform subscription conversion → pre-seed Spring 2027.

**The YC application headline (locked structure):** *"We sold a wedge service to N firms; they pulled us into building the platform; we're now selling the platform back to them."*

### 12.2 Capital efficiency is the proof of focus (lesson §2)

$4.5M total over 2 years for $1M ARR (Pageport) + Slant platform launch is **capital-efficient** by AI-native-CRM-startup standards (compared to Accrual $75M, Basis $1.15B val, Black Ore $60M — much heavier raises for similar-stage products). 2048 + Matchstick + Boost is a **strategic-investor-over-signaling** mix that aligns with vertical AI thesis.

**Docket map:** $1-2M pre-seed targeting summer 2026 off Discovery Scan revenue + Antonio reference + 100-customer traction; don't raise more until v1 ships + founder-tier cohort has 30+ paying firms.

### 12.3 Tagline anchor pattern (lesson — marketing §1)

*"Be the reason behind the retirement party, the second home, the peace of mind."* Footer of every page. Emotional close as structural anchor.

**Docket equivalent (locked):** *"Be the EA every taxpayer wishes they had — and the one your peers ask for advice."* Apply to footer of every marketing-site page.

### 12.4 Tool-consolidation framing (lesson — marketing §5)

Slant names 5-6 tools they replace inline (Wealthbox + Redtail + Otter + Jump + ClickUp + sequence tool). Buyer reads the consolidation math before the price.

**Docket equivalent:** TaxDome + Canopy + Karbon + DocuSign + Square + Otter/Fathom (6+ tools collapsed into 1). Ship a graphic on `/pricing`: 6 competitor logos → arrow → Docket logo.

### 12.5 Public competitor matrix on pricing page (lesson — marketing §6)

Slant publishes the Wealthbox vs Redtail vs Slant matrix on `/pricing`. Bold move; works when their AI is demonstrably better.

**Docket equivalent:** Docket vs TaxDome vs Canopy vs Karbon, 18 rows (per PRODUCT-ROADMAP §6 marketing).

### 12.6 Investor narrative arc

The Pageport→Slant story is the structural archetype for the YC application. It validates:
- Customer pull > engineering vision
- Point solution > platform-from-day-1
- Same vertical lock-in (advisors → advisors; not "expand to insurance + accounting")
- Founder insight + customer relationships pre-existed the platform
- Capital efficiency
- Verticalization-as-moat

### 12.7 Six-month SOC 2-compliant CRM build (lesson — operational §1)

Feb 2025 ideation → Aug 2025 SOC 2-compliant launch. Six months. Validates the build-as-you-go SOC 2 approach (CLAUDE.md L8).

**Docket map:** v1 launch 7/30/2026 from CEO review 5/2/2026 = same shape (≈6 months). Don't fall behind on security controls; ship them with every feature commit.

### 12.8 Customer-facing-heavy team mix (lesson — business §3)

16 staff = 5 engineers + 3 AEs + 2 Onboarding Managers + GTM Lead + Head of Customer + 2 founders = >50% customer-facing. **Sales motion > feature velocity** in Slant's optimization.

**Docket map:** at firm #6-10, hire 1 Customer Success Manager FIRST, not another engineer.

### 12.9 Strategic investor selection (lesson — business §4)

2048 (vertical AI) + Matchstick (Midwest, less crowded) + Boost (early-stage). Optimized for partner support, not TechCrunch noise.

**Docket map:** target investors who understand tax-practitioner segment; look at funds that have invested in Practiq, Canopy/TaxDome wave, accounting-vertical tools. Avoid funds with TaxGPT/Black Ore/Accrual portfolio conflicts.

### 12.10 Insider knowledge moat (lesson — business §5)

Founders previously built Pageport for advisors. Customer base + relationships pre-existed the platform.

**Docket map:** Antonio + Antonio's mentor's 1,000+ preparer network + 100-customer push gives us insider relationships. Frame this in YC application.

---

## 13. Where Slant got it wrong (the NO list — per CLAUDE.md §14 explicit NOs)

Slant's choices that are wrong for Docket's tax-vertical segment economics. **These are the lessons we explicitly REJECT, not adopt.**

### 13.1 Per-seat pricing

Slant: $150/seat. Works for advisor firms where seat = value unit.

**Tax economics differ:** the value unit is the *return / client*, not the *seat*. A 5-seat firm with 100 clients generates the same revenue as a 2-seat firm with 100 clients. Per-seat punishes the efficient firm. Per-active-client (CLAUDE.md L6) aligns cost with revenue. **Locked NO.**

### 13.2 On-site-only hiring (Lehi UT)

Slant: 16 staff concentrated on-site in Lehi, Utah. LDS-network-dense talent pool. Works for them.

**Docket:** remote-first by deliberate choice (David NJ, Haokun TBD, Antonio CA, future hires anywhere). Different bet, neither inherently better. **Centralized HQ is not on the table for v1 or v1.5.** Don't get pressured by the Slant pattern.

### 13.3 OpenAI / GPT-primary

Slant ships on GPT-5 (publicly built on OpenAI).

**Docket:** Anthropic Claude (Sonnet 4.6 / Opus 4.7 / Haiku 4.5) + Voyage-3-Large embeddings + Cohere Rerank v3.5 + AWS Bedrock fallover. Structural reasoning (per CLAUDE.md §6 Anthropic rationale):
1. Claude calibrates better on legal/regulatory: refuses honestly when uncertain. For PTIN-on-the-line, this matters.
2. Anthropic ZDR is sharper than OpenAI's enterprise opt-out.
3. Anthropic prompt cache discount (90%) > OpenAI (75%) — compounds at our usage pattern.
4. Tool-use + Computer Use are first-class on Claude.
5. AWS Bedrock fallover already shipped.
6. Voyage embeddings are tax/legal-domain-specialized (4-6 pp accuracy advantage).

**Don't second-guess this on cost basis** — cost discipline (CLAUDE.md §7) already accounts for it. Slant's advice-vertical doesn't carry our compliance frame; their OpenAI choice is wrong for our segment.

### 13.4 Prospecting as a primary pillar

Slant builds Marketing / Prospecting as a top-level surface (find leads · enrich · sequence outreach). Sits alongside CRM, AI Agents, Notetaker etc as a marketing-page tile.

**Docket NO:** this is a *paid add-on module* (per CLAUDE.md L6 add-ons) or a V1.5 feature, **NOT a primary pillar competing with Position Framework / Ambient Operator / Memory / Review Automation / Multi-channel.** Solo + small EA firms get prospecting as add-on; mid-market firms use existing prospecting tools. Don't promote it to pillar status; would dilute compliance-first tax operator positioning.

### 13.5 Calendly competitor build

Slant builds lightweight Calendly into their product (Meeting & Scheduling Agent handles outbound scheduling) because their integrations are weak.

**Docket NO:** Google Calendar MCP + Outlook MCP (planned V1.5) are cleaner. We integrate; we don't compete on scheduling. (CLAUDE.md §14 explicit NO.)

### 13.6 LDS-network distribution

Slant's BYU + LDS + Utah network is non-transferable. Their hiring + early-customer base both ran through this network.

**Docket:** our distribution runs through r/taxpros + NAEA + Latino Tax Pro + Antonio's mentor + Boney-Henderson warm intros. Different community structure; don't try to copy their network.

### 13.7 Mass-affluent buyer profile ($200K-$1M AUM households)

Slant's customer base targets advisors who serve mass-affluent households (the $200K-$1M household segment is where most independent RIAs operate).

**Docket:** tax has different segment economics; we target 2-10 preparer firms with active audit exposure (CLAUDE.md L16) — the "growing-firm dynamics" segment, not a household-AUM-based segment.

### 13.8 Voice agent (NOT yet shipped but planned by Slant)

Slant pitches voice-agent capability for future ship.

**Docket NO:** tax has compliance issues with recording consent + tax-jargon transcription. V2+ is the right ship window. (CLAUDE.md §25 NOT-taking #1.)

### 13.9 Slant lacks Position Framework (our defensive moat)

Slant doesn't have a Position Framework because their market doesn't require it. An advisor isn't filing a 1040 with their PTIN on it; they're recommending an investment.

**Docket has the Position Framework as our headline differentiator (CLAUDE.md L3).** Refusal floor + cited authority + four confidence tiers + 8275 drafting. **This is the structural moat that Slant cannot copy without rebuilding their entire compliance posture.**

### 13.10 Slant's "minimize fields" goes too far for tax

Slant: kill custom fields, lean on AI-extracted Memories + chat queries.

**Tax NO:** we need structured tables (clients / engagements / signatures / filings) that legally must persist as queryable rows. Tax-software API integrations require structured data for round-trip. **Memories surface is the unstructured complement to structured tables, not a replacement.**

### 13.11 Slant's chat-first UX wouldn't work for return prep

Slant's primary input is chat. Click around, ask questions, get answers.

**Tax NO:** Antonio doesn't want to chat with an AI to assemble a workpaper; he wants the workpaper *assembled*. We keep the **agentic + UI-first principle** (CLAUDE.md §4): chat is one surface, not the only surface. Need You queue + Pipeline + Calendar + Documents pages are first-class.

---

## 14. The direct vertical-adjacent map (Slant feature → Docket equivalent)

| Slant feature | Docket equivalent | Status |
|---|---|---|
| **CRM record (households, persons, businesses)** | `clients` + `client_facts` + multi-entity workspace (CLAUDE.md L12) | Substrate shipped |
| **Memories** (AI-extracted unstructured facts) | Memories tab (CLAUDE.md §4) → backed by `client_facts` table + Memory Curator Agent (CLAUDE.md §9, Phase 5 ship) | Substrate shipped (migration 0021); UI surface pending |
| **AI Chat (3-scope: client / meeting / book)** | Ask Docket (3-scope, CLAUDE.md §4 — locked 2026-05-13 after Slant research) | Designed |
| **Magic Buttons** (firm-authored chat workflows + marketplace) | Magic Buttons (CLAUDE.md §9 — locked 2026-05-13) + Workflow Marketplace | Designed |
| **Nudges** (daily-scanning life-event + drift + milestone surface) | Nudges Agent (CLAUDE.md §8, V1.5 ship) + `nudge_rules` table | Paper spec |
| **Notetaker** (bot-joiner + transcript + summary + action items) | Notetaker Agent (CLAUDE.md §9, V1.5 ship) | Paper spec |
| **Pre-Meeting Brief / Meeting & Scheduling Agent** | Pre-Meeting Brief Agent (CLAUDE.md §9, V1.5) | Paper spec |
| **Action-Item Extractor** (transcript → tasks → owners + due dates) | Action-Item Extractor (CLAUDE.md §9, V1.5) | Paper spec |
| **Projects / project templates** (Onboarding, RMDs, Move Money, Annual Review) | Projects (CLAUDE.md §4) — Annual Return Prep · Discovery Scan · Audit Defense · Notice Response · Quarterly Estimates · Incorporation · BOI · Year-Round Planning · SoI Renewal · Pre-Filing IRS Reconciliation · 8821 Transcript Pull Cycle · Client Onboarding | Designed |
| **Tasks** (one-off + recurring + templated) | Tasks + done-for-you-tasks pattern (CLAUDE.md §4) | Designed |
| **Opportunities** (pipelines + stages — sales funnel) | Need You queue (CLAUDE.md §4) — workflow primitive, not sales pipeline | Designed; partially shipped |
| **Prospecting / Marketing** (lead discovery + enrichment + sequences) | NOT a primary pillar — paid add-on module (CLAUDE.md §14 NO) | Deferred |
| **Sequences** (multi-step outreach) | Automated Reminders (CLAUDE.md §8) + outbound nudge sequences | Substrate shipped (C13) |
| **Client Reviews / annual review tracking** | Year-round planning touchpoints (CLAUDE.md §4 + §8 Projects) + Touchpoint Freshness View | Designed |
| **Document Filler** (fill + DocuSign-sign) | DocuSign embedded signing (CLAUDE.md L6) + 8879 sign flow + document classification agent | Substrate shipped |
| **Custodian integrations** (Schwab, Fidelity, Pershing, Betterment) | Tax-stack integrations (OLT browser automation, IRS Solutions API, IRS Tax Pro Account, Xero, bank feeds) via MCP gateway | Paper spec (CLAUDE.md §10) |
| **Calendar** (with two-way Google Calendar sync) | Calendar first-class surface (CLAUDE.md §4) + google-calendar MCP server | Designed |
| **Reports** (AI-generated queries) | Practice intelligence + Discovery agent outputs + Audit Trail UI | Paper spec |
| **Data Views** (saved cohorts) | Client view toggles (Cards / Table / Pipeline) + freshness lens + filters | Designed |
| **Public REST API** | Path 2 public API + MCP server (CLAUDE.md L1) | v1 ship target |
| **Migration from Redtail / Wealthbox** | Migration from TaxDome / Canopy / Karbon | Not yet built |
| **AI Automation** (trigger-based event automations) | Automated Reminders + Notifications (CLAUDE.md §8) + Inngest-driven crons | Substrate shipped |

### 14.1 Where Docket has features Slant lacks

| Docket feature | Why Slant doesn't have it |
|---|---|
| **Position Framework** (CLAUDE.md L3) — refusal floor + cited authority + 4 confidence tiers + 8275 drafting | Their advisor segment doesn't carry PTIN penalty exposure on every recommendation |
| **Knowledge layer** (CLAUDE.md L13) — IRC + Treas Regs + IRS Pubs + Tax Court + state authorities, effective-date versioned | Advisors aren't authoritative-cited-source-grounded; recommendations are fiduciary-aligned but not regulatory-precise in the same way |
| **Client portal (taxpayer surface)** — bilingual, AI-mediated, gated by preparer | Advisors don't ship taxpayer portals; client communication is direct preparer-to-client |
| **Multi-entity workspace** (CLAUDE.md L12) — typed graph (Person / S-Corp / Trust / etc.) with cross-entity flow calculations | Advisor practices have entities but it's not the structural primitive their CRM is built around |
| **Document classification + extraction (4-phase pipeline)** | Advisors don't process 1099s/W-2s/K-1s at the volume tax prep does |
| **8879 e-signature + KBA via DocuSign** | Advisors don't need IRS-Pub-1345-KBA grade signing |
| **Trust escalation gates** (L1-L4 firm-level) | Their compliance posture is fiduciary-tier, not preparer-tier |
| **Browser automation against OLT / IRS Tax Pro Account** | Their world is custodian APIs, not closed proprietary platforms |

### 14.2 Where Slant has features Docket doesn't yet have

| Slant feature | Docket gap / status |
|---|---|
| **AUM / portfolio integration** | NO — not in our vertical (tax doesn't track AUM as a primary metric) |
| **Custodian-data live sync** | Tax equivalent is OLT browser automation + IRS Tax Pro Account; not yet built |
| **Public marketing/prospecting module** | Decided NO as a primary pillar (CLAUDE.md §14); deferred to add-on |
| **Sequences engine** | Substrate shipped (Automated Reminders); not yet a unified Sequences primitive — Phase 5+ |
| **Public REST API as user-facing surface (with API token UI)** | v1 ship target per CLAUDE.md L1 |
| **CSV migration tool from incumbent CRMs (Redtail/Wealthbox)** | Tax equivalent (migration from TaxDome/Canopy/Karbon) not yet built — V1.5 |
| **Mobile app (iOS + Android — Google Play listed)** | Mobile-first portal exists for taxpayers; preparer-side mobile is V2+ |

---

## 15. The YC pitch / investor narrative shape

Slant's investor narrative arc maps cleanly to Docket's YC Fall 2026 application. The shape:

### 15.1 Slant's narrative (reconstructed)

**Problem:** Advisors are bottlenecked at 70-90 clients each. Industry needs 4M new advisors by 2034 to serve the wealth transfer. Tools advisors have today (Wealthbox, Redtail) demand attention and give little back.

**Insight (the wedge):** Started Pageport — personalized video landing pages for advisors. 1,000+ advisors, $1M ARR over 2 years. Customers kept asking "why can't my CRM do this?" By the 400th time, we built the CRM.

**Solution:** Slant — AI-first CRM with Memories, Nudges, Notetaker, Chat. Advisors using Slant scale from 90 to 200-250 clients.

**Traction:** $6B AUM connected in 2 months. 200+ firms using daily. SOC 2-compliant.

**Why us:** Built advisor-focused point solutions for 2 years. 300+ advisor conversations. Advisor-in-residence program. Founders building together for a decade.

**Why now:** AI-first CRMs are emerging (Slant, Jump, Zocks vs Wealthbox/Redtail). Wealth transfer to next gen makes relationships more strategic than ever.

**Ask:** $3.3M seed to scale.

### 15.2 Docket's YC narrative (locked structure — for Fall 2026 application)

**Problem:** Solo + small EAs serve 150-200 clients per season at high friction. Industry needs 200K+ preparers retiring without replacement. Tools they have today (TaxDome, Canopy, Karbon) are shallow PM + half-built AI.

**Insight (the wedge):** Discovery Scan — productized service ($1-5K per book) that surfaces missed deductions across 3 prior years. ~100 firms by 8/1/2026. Customers ask "can you keep doing this, and run our whole practice?" That's the platform.

**Solution:** Docket — agentic operator for a tax practice. Position Framework + Compliance-First Deduction Surfacing + OmniContext Memory + Year-Round Representation + Multi-Channel Operator. Preparers using Docket scale from 200 to 400-500 clients with the same quality.

**Traction:** ~100 paying firms by 8/1. 1 partner (Antonio) + mid-market partner #2 onboarding. 12-table Drizzle schema with RLS + SOC 2-posture architecture shipped.

**Why us:** Built consulting/services flywheel to validate platform demand. Antonio Vazquez EA as on-platform tax advisor. Antonio's mentor commands 1000+ preparer network. 5+ year working relationship between David (CEO) + Haokun (CTO).

**Why now:** AI-native return prep is crowded (Accrual $75M, Black Ore $60M, Basis $1.15B val) — they target Big-4. Nobody targets solo + mid-market with compliance-first Position Framework. Window is 12-18 months.

**Ask:** $1-2M pre-seed.

### 15.3 Differences to flag

| Element | Slant | Docket |
|---|---|---|
| Wedge duration | 2 years (Pageport) | 12 weeks (Discovery Scan to 100 firms) |
| Wedge revenue at platform launch | $1M ARR | TBD — depends on Discovery Scan run rate |
| Founders' segment access | Built advisor point solutions for 2 yr | Antonio + mentor network |
| Investor count at platform launch | 2 (2048, Boost) + 1 added at seed (Matchstick) | TBD — target 2048 + Forum + Mucker + relevant industry funds |
| Total raised by platform launch | $1.2M | Target $0-200K consulting revenue + $0 outside capital until pre-seed |

Pre-seed Docket should aspire to: $1.5M, similar pattern to Slant's pre-seed ($1.2M) at a similar stage.

---

## 16. Open questions / unverifiable claims

1. **Exact ARR figure for Slant-the-CRM (vs Pageport+Slant combined).** The "$1M ARR" reference in CLAUDE.md §25 is consistent with public data but the precise CRM-only ARR is not publicly disclosed.
2. **Slant valuation at seed.** $3.3M raise typically implies $15-20M post; not publicly confirmed.
3. **Magic Buttons marketplace launch date.** Mentioned in product copy as a feature, but marketplace tab not directly accessible publicly. May be advisor-internal only at this point.
4. **Voice agent ship date.** Inferred to be V2+ for Slant; not publicly committed.
5. **The "1,200 advisors" figure** — conflates Pageport users (1,000+) and Slant CRM users (200+ firms). Net active on Slant is not crystal clear.
6. **Pricing tier structure** — only $150/seat (monthly billing) is public. Annual discount %, beta-user discount %, enterprise pricing are not disclosed.
7. **40 beta users to ~200 firms in 6 months** — 5x growth, but the *organic-vs-sales-driven* split is not visible. How much is founder-led close vs WOM is unclear.
8. **Future Proof Citywide AI Demo Drop placement** — Slant pitched at the conference; relative reception vs other competitors (Jump, Wealthbox) is not publicly reported.
9. **The Magic Button marketplace** — Slant references *"pre-built templates via Slant's marketplace"* but it's unclear whether the marketplace is firm-to-firm sharing or Slant-curated templates only.
10. **Notetaker compliance specifics** — recording consent flow, SEC/FINRA-specific consent requirements, retention/deletion mechanics not publicly documented.
11. **Path 2 / API monetization** — Slant publishes a full REST API but pricing on API access (rate limits, paid tiers) is not visible.
12. **Custodian integration revenue share** — Schwab, Fidelity, Pershing partnerships could carry referral fees in either direction; not disclosed.
13. **Founder equity split + cap table** — pre-seed dilution + seed dilution stack would inform our SAFE-vs-equity decision at our own pre-seed; not publicly available.

---

## 17. Citations

### Slant's own surfaces
- [Slant homepage](https://www.slant.app/)
- [Slant About page](https://www.slant.app/about)
- [Slant Pricing page](https://www.slant.app/pricing)
- [Slant CRM product page](https://www.slant.app/product/crm)
- [Slant AI Agents product page](https://www.slant.app/product/ai-agents)
- [Slant Notetaker product page](https://www.slant.app/product/notetaker)
- [Slant Marketing/Prospecting product page](https://www.slant.app/product/marketing)
- [Slant Project Management product page](https://www.slant.app/product/project-management)
- [Slant Client Reviews product page](https://www.slant.app/product/client-reviews)
- [Slant Security page](https://www.slant.app/security)
- [Slant Documentation root](https://docs.slant.app/)
- [Slant Documentation index (llms.txt)](https://docs.slant.app/llms.txt)
- [Slant Documentation: Book Chat](https://docs.slant.app/dashboard/book-chat)
- [Slant Documentation: Home dashboard](https://docs.slant.app/dashboard/home)
- [Slant Documentation: Clients records](https://docs.slant.app/records/clients/overview)
- [Slant Google Play app](https://play.google.com/store/apps/details?id=com.slant.app)
- [Pageport homepage](https://pageport.com/)

### Founder profiles
- [Thomas Clawson LinkedIn](https://www.linkedin.com/in/thomasclawson/)
- [Thomas Clawson on Customer Wins podcast (QuickForms recap)](https://www.quickforms.com/post/emerging-tech-reimagining-crm-with-ai-for-advisors-with-thomas-clawson)

### Funding announcements
- [Pageport $1.2M pre-seed announcement (TechBuzz News)](https://www.techbuzznews.com/pageport-raises-1-2-million-pre-seed-investment-by-2048-ventures-and-boost-ventures/)
- [Pageport $3.3M seed announcement (PR Newswire / Utah Business)](https://www.utahbusiness.com/press-releases/2025/08/27/pageport-raises-33m-to-launch-slant-the-ai-first-crm-built-for-financial-advisors/)
- [Slant launch + $3.3M seed (TechBuzz News)](https://www.techbuzznews.com/pageport-launches-ai-powered-crm-slant-raises-3-3m-seed-round/)
- [2048 Ventures investment thesis on Pageport](https://www.2048.vc/blog/our-investment-in-pageport)
- [Matchstick Ventures investment thesis on Pageport](https://www.matchstick.vc/companies/pageport)

### Industry coverage
- [WealthManagement.com: "RIP Traditional Advisor CRM, Meet Slant"](https://www.wealthmanagement.com/artificial-intelligence/rip-traditional-advisor-crm-meet-slant-its-ai-first-replacement)
- [Finopotamus: Slant Expands Access to Clients' Families (Client Tree launch)](https://www.finopotamus.com/post/slant-expands-financial-advisors-access-to-clients-families)
- [Yahoo Finance: Slant Exceeds $6B in Connected AUM](https://finance.yahoo.com/news/slant-exceeds-6b-connected-aum-173000817.html)
- [ContentGrip: Slant's AI CRM hits $6B AUM milestone](https://www.contentgrip.com/slant-connected-aum-custodian-data/)
- [Kitces.com: April 2026 AdvisorTech roundup](https://www.kitces.com/blog/the-latest-in-financial-advisortech-april-2026-wealthbox-ai-agents-tools-jump-rightcapital-wealthstream/)
- [WealthTech Today: AI Notetakers & Agentic OS for Advisors 2026](https://wealthtechtoday.com/2026/05/08/ai-notetakers-financial-advisors-2026/)
- [Schwab Advisor Services: Slant CRM provider directory](https://advisorservices.schwab.com/provider-solutions/Slant_CRM)
- [Betterment Advisor Solutions: Slant integration setup](https://www.betterment.com/advisors/resources/slant-integration)
- [Kitces AdvisorTech Directory: Slant entry](https://fintech.kitces.com/details/operations-essentials/crm/slant)
- [The Wealth Mosaic: Slant vendor profile](https://www.thewealthmosaic.com/vendors/slant/)
- [Financial Planning: Future Proof AI Demo Drop](https://www.financial-planning.com/list/future-proof-debuts-inaugural-ai-demo-drop)

### Cross-references inside Docket repo
- [`C:\Users\minse\projects\docket\CLAUDE.md`](file:///C:/Users/minse/projects/docket/CLAUDE.md) §1 (Memory architecture), §4 (Command Room + 3-scope chat), §6 (Anthropic-vs-OpenAI rationale), §8 (Nudges), §9 (agent fleet + Magic Buttons), §13 (marketing lead), §14 (explicit NOs), §17 (competitive landscape), §25 (Slant strategic lessons summary)
- [`C:\Users\minse\projects\docket\docs\SLANT-LESSONS.md`](file:///C:/Users/minse/projects/docket/docs/SLANT-LESSONS.md) — 33 patterns lifted from Slant (business + marketing + pricing + operational)

---

*Locked 2026-05-14. Next review: after Slant's next material public update (next funding round, new product launch, or significant pricing change). When this doc and a newer development disagree, the newer fact wins; capture it as an addendum below rather than rewriting the body.*
