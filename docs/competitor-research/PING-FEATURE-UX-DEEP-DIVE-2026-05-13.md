I have everything I need. Now I'll write the comprehensive output.

# Ping Feature + UX Deep Inventory

## 1. Visual & UX Identity (the design language)

**Confirmed via raw CSS inspection of `/_astro/_slug_.zWow4D3t.css`** (the root token file). This is hard data, not guesswork.

**Primary brand color + accent palette (verbatim from `:root`):**
- Canvas: `--color-bg: #f7f6f2` (warm off-white cream, very close to Docket's editorial-warm `oklch(98% 0.01 85)`)
- Surface: `--color-surface: #fefefd`
- Surface-warm: `--color-surface-warm: #fdf6f0` (pinkish-cream cards)
- Border: `--color-border: #e7e7e7`
- Text: `--color-text: #2f2b27` (warm near-black ink)
- Text-body: `--color-text-body: #666`
- **Accent: `--color-accent: #fb923c`** (Tailwind orange-400) with strong `#f07510` and light `#f9a05b` variants
- **Highlight: `--color-highlight: #8f88f9`** (lavender/indigo) with strong `#645be9` — secondary accent
- Success: `#1a7d42` (forest green — same family as Docket's primary)
- Overlay: `#00000080`

**Translation:** Ping ships a **warm-cream canvas + orange accent + lavender highlight + forest-green success** palette. The orange accent is the load-bearing brand color. Docket already has the cream canvas + forest green primary; Ping's orange-as-accent is the move worth studying — it carries CTA energy and "moments of delight" without breaking the editorial-warm feel.

**Typography (verbatim from `:root`):**
- `--font-sans: "Inter", "Inter Tight", system-ui, -apple-system, sans-serif`
- `--font-serif: "IBM Plex Serif", "Hedvig Letters Serif", Georgia, serif`
- `--font-mono: "Fragment Mono", ui-monospace, monospace`
- `--font-display: "Inter Display", "Inter", system-ui, sans-serif`

**Type scale** uses fluid `clamp()` steps `--step--2` through `--step-5`, with display size topping out at `~3.95rem (~63px)` on wide viewports. h1 `38px → 44px`. h2 `32px`.

**Weight scale:** 300 / 400 / 500 / 600 / 700 / 900.

**Translation:** Ping uses **Inter for everything operational + IBM Plex Serif for editorial moments** (headlines, blockquotes). That mirrors Docket's editorial-warm pattern (Fraunces serif display + DM Sans body) extremely closely — but Ping's choice of *Inter* in the sans slot is the operational-modern command-room voice Docket already locked in §11. **The pattern is exact: a warm editorial serif for display + a clean geometric sans for body, applied to the SAME product without splitting it into two visual languages like Docket does.**

**Layout grid + density:**
- Max-width breakpoints: `1023px`, `1024px`, `1440px` — desktop-first responsive (mobile `<809px` reflow point)
- Spacing scale: `--space-xs: 8px` / `sm: 12px` / `md: 16px` / `lg: 24px` / `xl: 32px` (4-step rhythm)
- Cards padded to `--space-lg` (24px) on mobile, larger on desktop
- Hero is a 2-column grid (`hero-inner` with `grid-template-columns`) that collapses to 1-column at `<809px`

**Color usage rules:**
- Background = warm cream `#f7f6f2`. Sections alternate between bg and `surface-warm #fdf6f0` (the cream-pink card color) for visual rhythm.
- Orange (`#fb923c`) is reserved for: active tabs, CTAs in feature tiles, "Most Popular" badge color, and small accents. **Never used as a flood color on a whole section.**
- Lavender (`#8f88f9`) is the secondary accent — likely used for charts/data visualization moments (the highlight family includes a `surface` token `#f7f6fe` for tinted backgrounds).
- Text uses a 5-tier hierarchy: `#2f2b27` (text) → `#494949` (tertiary) → `#57534f` (muted) → `#666` (body) → `#7f7b77` (soft) → `#949191` (dimmed).

**Iconography style:** Image-based (PNG/SVG/WEBP), monochrome client logos, **colored vendor logos preserved** in integrations (Slack purple, Salesforce blue, etc.). No custom 3D illustration. The product chooses *photographs of integrations* over *custom illustration* — a craft decision that reads "we ship integrations" not "we hired a designer."

**Card patterns (from CSS):**
- Radius: `--radius-sm: 6px` (buttons), `--radius-md: 12px`, `--radius-lg: 16px`, `--radius-xl: 20px`. Cards use `--radius-lg` (16px) consistently.
- Shadow scale: `--shadow-xs` (1px subtle), `--shadow-sm`, `--shadow-card: 0 8px 18px #dcd9d02e` (cards), `--shadow-card-hover: 0 10px 22px #dcd9d03d`, `--shadow-nav`, `--shadow-elevated: 0 12px 28px #dcd9d040` (modals).
- **All shadows tinted warm (`#dcd9d0` base)**, not neutral gray. This is the single design move that makes the warmth feel intentional rather than accidental.

**Button styles (verbatim from CSS):**
```
.btn { padding: 12px 20px; border-radius: var(--radius-sm) /* 6px */; 
       border: 1px solid var(--color-border); font-size: 14px; 
       font-weight: 500; letter-spacing: -0.01em; line-height: 130%; 
       transition: all 0.12s ease; }
.btn-primary { background: var(--color-text) /* #2f2b27 ink */; 
               color: var(--color-surface); }
.btn-primary:hover { background: var(--color-primary-hover) /* #201d1a */; }
.btn-secondary { background: var(--color-surface); color: var(--color-text-muted); }
```

**Translation:** Primary CTA is **warm-ink-on-cream**, NOT orange. Orange is reserved for accent moments. The 6px radius is small (not 12-16px shadcn defaults). The 130% line-height + -0.01em letter-spacing is the operational-modern signal.

**Imagery:** Real product screenshots in the features section. Customer videos with thumbnail tiles + duration stamps (`12:34`, `15:22`, `6:15`, `8:47`). Speaker headshots. No stock photography.

**Copy voice — 8 verbatim examples:**
1. *"Firm Intelligence for Modern Advisory Firms"* (hero h1 — declarative, capitalized noun phrase, no verb)
2. *"Ping captures and centralizes client interactions, freeing advisors from admin work while giving leadership real-time visibility into the firm."* (hero subhead — one sentence, two-clause balance: "freeing advisors from X / giving leadership Y")
3. *"Turn every conversation into structured notes and action items."* (feature tile — imperative verb)
4. *"Drafts replies in your voice so you can focus on what matters."* (feature tile — third person, no subject)
5. *"An AI brain that knows every client inside and out."* (feature tile — colloquial "brain" beats "knowledge base")
6. *"Catch missed revenue opportunities hidden in client interactions across the firm."* (feature tile — imperative + revenue framing)
7. *"Client context stays with the firm, not the individual."* (institutional-memory tile — binary contrast)
8. *"We don't believe in 'counting minutes' when you're trying to run a firm."* (FAQ — first-person plural, defensive against competitor pricing models)
9. *"Be an accountant, not a secretary."* (Camden's launch tagline — the bumper sticker)
10. *"Know what matters about your prospect before they even walk through the door. (feel free to replace door with Zoom room.)"* (prospect-brief hero — parenthetical aside as voice texture)
11. *"Made in the USA, specifically Utah"* (footer — geographic micro-pride)

**Voice = builder-casual, single-sentence, imperative-leaning, occasional emoji, parenthetical asides. Not formal. Not sales-y. Not technical.** The closest Docket-equivalent voice is Antonio's portal copy.

**Page architecture (homepage):**
1. Sticky nav (logo left, nav center, Log In + Sign Up right)
2. Hero (2-col: copy left, product screenshot right) + SOC 2 badge below CTAs
3. Logo wall (horizontal scrolling carousel, monochrome, 7 named firms × 3 repeat)
4. **Feature tiles with audience toggle** (Individual Advisor / Firm Leadership tabs above the same 2×3 = 6-card grid)
5. Video testimonial wall (5 video thumbnails with duration stamps + speaker name + title)
6. Text testimonial scrolling carousel (5 short quotes)
7. Integrations logo grid (15 logos × 3 carousel repeat)
8. FAQ accordion (7 questions)
9. Final CTA section
10. Footer

**Translation for Docket:** Docket's marketing pages don't ship this pattern yet. The pattern to steal verbatim:
- **2-col hero with product screenshot beside copy** (Docket today is mostly copy-only)
- **Audience toggle ON the same grid** ("Preparer view / Firm-owner view" tabs surfacing different feature emphasis on the same homepage)
- **Video testimonial wall with duration stamps** (Docket needs to film customers — Antonio is the obvious first one)
- **Integration logo grid as social proof** (Docket has Square / DocuSign / Twilio / Clerk / Inngest / Gmail — show them)

---

## 2. Feature-by-Feature Inventory

### Feature: Meeting Assistant (AI Meeting Notes)
- **What it does mechanically:** A bot named after the firm joins Zoom / Google Meet / MS Teams as a participant, records the call, transcribes via ASR, and emits structured artifacts: meeting summary, action items, decisions, follow-up email draft. Notes flow to integrated systems (Karbon work items, HubSpot timeline, Salesforce notes, Asana/Monday/ClickUp tasks). Also has an in-person mode on mobile (Dec 31 release).
- **UX pattern Ping uses:** The bot appears in the call with a customizable name/avatar (Nov 5 release). Post-meeting, an email recap arrives. Notes are viewable in a Theater Mode (Mar 19) with side-by-side video + transcript. "Meeting tags" let users categorize (Nov 12); "system tags" auto-classify (Mar 26).
- **Why it's good:** Zero ceremony — Antonio doesn't have to *do anything* in the meeting. The artifacts produced are not just transcripts but *opinionated structured outputs* (action items extracted, follow-up drafted). The integration into the firm's PM tool means notes don't live in a fifth tool.
- **Where it lives in Docket today:** Paper spec only. CLAUDE.md §9 lists **Notetaker Agent** + **Action-Item Extractor** + **Pre-Meeting Brief Agent** as designed-but-not-built (V1.5 ship).
- **Recommended steal:**
  - **What to clone:** The bot-joins-the-meeting pattern with customizable name/avatar; post-meeting structured output (summary + action items + draft follow-up); auto-routing of action items to Tasks in the engagement; in-app Theater Mode (video + transcript side-by-side). Critically: **tag system** for meeting types.
  - **Where in Docket codebase:**
    - Agent: `services/workers/src/agents/notetaker.ts` + `services/workers/src/agents/action-item-extractor.ts`
    - Inngest function: `services/workers/src/functions/process-meeting-recording.ts`
    - Mobile recording: `apps/command-room/src/app/(mobile)/record/page.tsx`
    - Theater Mode UI: `apps/command-room/src/app/calendar/[id]/transcript/page.tsx`
    - Tags table: `packages/db/src/schema/meeting-tags.ts` (new) joined to `calendar_events`
  - **Effort estimate:** 3 sprints for the full chain (transcription provider integration + agent + Theater Mode UI). Deepgram/Gladia per L5.
  - **Priority:** **P1** (next-sprint after current build). Tax meetings are the highest-leverage event in Antonio's workflow.

### Feature: Email Assistant (AI Email Categorization + Voice-matched Drafting)
- **What it does mechanically:** Inbound emails get auto-classified into actionable labels. Replies are drafted in Antonio's voice using full thread context + Client Memory. A "Smart Reply Library" stores reusable templates.
- **UX pattern Ping uses:** Email sits in inbox with a label/badge. Click → draft appears inline. Approve / Edit / Discard.
- **Why it's good:** Triage is the single largest preparer time sink. Drafts-in-voice means Antonio approves rather than writes.
- **Where it lives in Docket today:** ✅ **Built.** `services/workers/src/agents/inbox-drafter.ts` (Sonnet 4.6, 209 LOC, 140-line system prompt) + `services/workers/src/agents/triage-classifier.ts` (Haiku 4.5, 258 LOC). Both surfaced in Unified Inbox UI per §4. **Docket is ahead of Ping on the substrate** but behind on UI polish.
- **Recommended steal:**
  - **What to clone:** Ping's *Smart Reply Library* — a firm-authored template gallery the agent picks from, not a free-text draft every time. Also the **categorization label UX** (Ping shows category as inline pill before the draft appears) — cleaner than Docket's current draft-only flow.
  - **Where in Docket codebase:**
    - Library data: extend `packages/db/src/schema/inbox-templates.ts` (new) — `tenant_id`, `label`, `body`, `triggers[]`, `created_by`
    - UI: `apps/command-room/src/app/messages/_components/SmartReplyLibrary.tsx`
    - Settings: `apps/command-room/src/app/settings/inbox/page.tsx` (per-firm template author)
    - Agent: extend `inbox-drafter.ts` to optionally select a template by category-match
  - **Effort estimate:** 1 sprint (substrate exists, just adds the template-selector + UI).
  - **Priority:** **P1.** Largest delta with Ping today is the *productized* feel of the inbox flow.

### Feature: Client Memory
- **What it does mechanically:** A persistent, searchable client profile assembled from every meeting + email + document. Lives at the firm level (institutional). Surfaced as: pre-meeting prep + during-meeting context + search. Recognizes accounting terms (tax codes, GAAP, financial standards).
- **UX pattern Ping uses:** Visible as a *Client* page with a "memory" view. Search across full history. Shows up in the chat as context.
- **Why it's good:** This is Ping's strongest single feature in their marketing. Quote: *"A new advisor can step in and understand a 5-year relationship in minutes."* The framing of *Memory* as a first-class noun (not "notes" or "CRM record") is the move.
- **Where it lives in Docket today:** Substrate ✅ shipped (`client_facts` table via migration 0021). **UI is the gap** — Memories tab per §4. **Memory Curator Agent** designed but not built (§9, Phase 5 ship).
- **Recommended steal:**
  - **What to clone:** The framing. Docket already plans this as "Memories" — adopt verbatim. Add the search-across-history affordance + the *"new advisor walks in cold"* user story explicitly into the marketing copy.
  - **Where in Docket codebase:**
    - UI: `apps/command-room/src/app/clients/[id]/memories/page.tsx`
    - Component: `packages/ui/src/components/MemoriesTab.tsx` + `MemoryCard.tsx`
    - Agent: `services/workers/src/agents/memory-curator.ts` (daily cron)
    - Inngest: `services/workers/src/functions/curate-memories-daily.ts`
    - Search: extend the existing PostgresRetriever to scope to `client_facts` per client
  - **Effort estimate:** 2 sprints (agent + UI + retrieval scope).
  - **Priority:** **P0** (per CLAUDE.md §9: *"the strongest single steal from their product"*).

### Feature: Revenue Finder (firm-leadership only)
- **What it does mechanically:** Scans every meeting + email for adjacent service mentions ("we should probably do tax planning this year," "do you do bookkeeping?") and surfaces flagged opportunities to firm leadership. Includes "at-risk account alerts" via sentiment + engagement-frequency drops.
- **UX pattern Ping uses:** A dashboard for firm leaders showing flagged opportunities with the source quote, client name, suggested service. Sorted by recency. Bulk-syncable. "Searchable picker for meetings and emails" (Apr 22 changelog).
- **Why it's good:** This is the **firm-leader pitch** — it justifies the $72/mo tier and the buyer is the partner, not the preparer. Marketing handle: *"revenue walks out the door"* if you don't have this.
- **Where it lives in Docket today:** Adjacent concept exists as **Discovery Agent** (tax-position surfacing, §9). Revenue Finder is the *advisor-services* analog — different output (cross-sell, not deduction). Not in plan as a distinct feature.
- **Recommended steal:**
  - **What to clone:** The dashboard pattern (sorted flagged opportunities with source quote inline) + the firm-leader-tier gating. For tax: this maps to **Practice Intelligence** in §4 ("margin per client, friction score, capacity, pricing inconsistency"). Reframe Practice Intelligence to include a **Cross-Sell Finder** sub-surface: every time a client mentions tax planning / audit defense / entity restructuring / estate planning, surface it to the firm owner.
  - **Where in Docket codebase:**
    - Agent: `services/workers/src/agents/cross-sell-finder.ts`
    - Dashboard: `apps/command-room/src/app/practice/opportunities/page.tsx`
    - Schema: `packages/db/src/schema/cross_sell_opportunities.ts` — `client_id`, `source_message_id`, `quoted_text`, `suggested_service`, `confidence`, `status` (open/dismissed/sold)
    - Pricing-tier gate: hide entire surface unless `tenant.tier >= 'firm'`
  - **Effort estimate:** 2 sprints.
  - **Priority:** **P1.** This is the feature that unlocks the firm-owner buyer for Docket beyond Antonio.

### Feature: AI Workflows / Magic Buttons
- **What it does mechanically:** Firm-authored AI workflows triggered by meeting/email events or on-demand. Example: meeting tagged "Year-End Review" auto-fires a workflow that produces a planning memo + emails the client.
- **UX pattern Ping uses:** Authored in a workflow editor. Triggered automatically or by button click. The "AI Workflows interface" screenshot on `/features` is the central artifact.
- **Why it's good:** Closes the loop between *AI surfaces an insight* and *AI executes a workflow*. Without this, AI is suggestive; with this, AI is operational.
- **Where it lives in Docket today:** **Magic Buttons** designed and locked in CLAUDE.md §9. Not built. Template library spec'd: Q4 Planning Email · Year-End Review Memo · Audit Defense Draft · Engagement Letter Renewal · BOI Reminder · etc.
- **Recommended steal:**
  - **What to clone:** Magic Buttons spec is already strong — what to additionally adopt is the **trigger pattern** (on-meeting-end, on-tag, on-action-item) that Ping uses, not just on-click. Also adopt the **starter gallery** approach — ship 8 buttons out of the box so firms see the pattern before they author their own.
  - **Where in Docket codebase:**
    - Schema: `packages/db/src/schema/magic_buttons.ts` (already spec'd in §9)
    - UI authoring: `apps/command-room/src/app/settings/ai/magic-buttons/page.tsx`
    - Library: `packages/playbooks/magic-buttons/*.ts` (file-based starter library)
    - Triggers: extend Inngest event types — `meeting.ended`, `tag.applied`, `action_item.created`
  - **Effort estimate:** 3 sprints (UI authoring + agent runtime + starter library + Workflow Marketplace v0).
  - **Priority:** **P1.** This is the bridge between Ask Docket chat and AI Tasks.

### Feature: Pre-meeting prep emails (May 20 changelog)
- **What it does mechanically:** N hours before a calendar meeting, Ping emails Antonio a prep brief with client context, recent activity, action items still open.
- **UX pattern Ping uses:** Email arrives at fixed offset before meeting. Renders the same artifacts Antonio would see in the in-app meeting card.
- **Why it's good:** Email > in-app for "I'm walking into a meeting in 5 minutes" because email is on every device.
- **Where it lives in Docket today:** **Pre-Meeting Brief Agent** designed in §9 — *fires N hours before a `calendar_events` entry*. V1.5 ship.
- **Recommended steal:** Spec is already there. Lift Ping's exact UX (email format) and the default offset cadence (1hr for in-day, 24hr for next-day per §4).
  - **Where in Docket codebase:**
    - Agent: `services/workers/src/agents/pre-meeting-brief.ts`
    - Inngest: `services/workers/src/functions/pre-meeting-brief-cron.ts` (every 15 min, looks ahead 25hr window)
    - Email template: `services/workers/src/templates/pre-meeting-brief.email.tsx` (React Email)
    - Calendar card UI: extend `apps/command-room/src/app/calendar/_components/EventCard.tsx`
  - **Effort estimate:** 1 sprint.
  - **Priority:** **P0** — small effort, high-leverage habit-forming touchpoint.

### Feature: Action Item Extraction & Assignment
- **What it does mechanically:** Every meeting transcript → action items by owner (firm vs. client) → assigned to right team member → synced to PM tool (Karbon work items / Asana tasks / Monday cards / ClickUp). Auto-assignment (Mar 19 release).
- **UX pattern Ping uses:** Inline list under meeting summary. Each item: owner avatar, due-by inference, link to source quote in transcript.
- **Where it lives in Docket today:** **Action-Item Extractor** designed in §9. Not built.
- **Recommended steal:** Inline list with owner avatar + source quote linkback is the polish move. Auto-assignment via team rules.
  - **Where in Docket codebase:**
    - Agent: `services/workers/src/agents/action-item-extractor.ts`
    - Task auto-creation: `services/workers/src/functions/extract-and-route-action-items.ts`
    - UI: `packages/ui/src/components/ActionItemList.tsx` (with avatar + source-quote tooltip)
  - **Effort estimate:** 1 sprint.
  - **Priority:** **P1** (depends on Notetaker — ships together).

### Feature: AI Chat Across Meetings (Global Chat / Ping Chat)
- **What it does mechanically:** A chat interface that can reason over all meetings + emails + memory. Three scopes: per-meeting, global, per-client. Web search built in (Aug 18 release). Enhanced search accuracy (Jan 23 release).
- **UX pattern Ping uses:** Chat panel on the right side of the app. Pin a client / meeting / book scope. Streaming responses with citations to source artifacts.
- **Where it lives in Docket today:** **Three-scope chat split** locked in §4 (Client chat / Meeting chat / Book chat). Substrate exists (`runDocketAgent` + PostgresRetriever). UI not yet shipped.
- **Recommended steal:** Three-scope split is the same pattern Ping ships. Lift their **citation-to-source-artifact** UX — every claim links to the meeting/email it came from.
  - **Where in Docket codebase:**
    - UI: `apps/command-room/src/app/_components/AskDocketPanel.tsx`
    - Component: `packages/ui/src/components/ChatTrail.tsx` (with source-citation pills inline)
    - Retrieval scope: extend orchestrator to accept `scope: 'client' | 'meeting' | 'book'` parameter
  - **Effort estimate:** 2 sprints.
  - **Priority:** **P0.** Ask Docket is the operational center of gravity.

### Feature: Export Notes as PDF (Aug 14 release)
- **What it does mechanically:** One-click PDF of any meeting notes.
- **UX pattern:** Button on meeting page → PDF download.
- **Where it lives in Docket today:** Not in plan. Trivially easy to ship.
- **Recommended steal:** Add to Notetaker output. Use the existing `make-pdf` infrastructure (gstack skill exists per CLAUDE.md §23).
  - **Where in Docket codebase:** `apps/command-room/src/app/api/meetings/[id]/pdf/route.ts`
  - **Effort estimate:** 1 day.
  - **Priority:** **P2.** Nice polish, not load-bearing.

### Feature: Customizable bot name + image (Nov 5 release)
- **What it does mechanically:** The bot that joins meetings has a firm-specific name/avatar.
- **UX pattern:** Settings page → upload image + edit name.
- **Why it's good:** Branding — the bot reads as *Vazant Consulting Notetaker* not *Ping Bot*.
- **Where it lives in Docket today:** Not in plan. Should be in white-label / portal-branding (§4: *"Custom client-portal subdomain"*).
- **Recommended steal:** Add to Settings → Client Experience → Portal Branding.
  - **Where in Docket codebase:** `apps/command-room/src/app/settings/branding/notetaker-bot/page.tsx`
  - **Effort estimate:** 2 days.
  - **Priority:** **P2.**

### Feature: Meeting tags + filter by tag (Nov 12, Mar 26 releases)
- **What it does mechanically:** Custom tags applied to meetings. System tags auto-applied. Filter the meeting list by tag.
- **UX pattern:** Tag pills on each meeting card. Filter chip row above the list.
- **Where it lives in Docket today:** Not specifically designed. Could fit under Engagement / Project view (§4).
- **Recommended steal:** Tag system on `calendar_events` table.
  - **Where in Docket codebase:** `packages/db/src/schema/event-tags.ts`; UI in `apps/command-room/src/app/calendar/page.tsx`
  - **Effort estimate:** 3 days.
  - **Priority:** **P2.**

### Feature: Teams, Roles, Permissions (Nov 21, Dec 3 releases)
- **What it does mechanically:** Multi-user firms with team / role / per-client visibility controls. Bulk meeting management.
- **UX pattern:** Settings → Team → Roles. Per-client assignee. Visibility scopes by team.
- **Where it lives in Docket today:** Substrate via Clerk Organizations (locked in §6). UI gap.
- **Recommended steal:** Ping's per-client visibility rule is the load-bearing piece — *not every team member sees every client.* Implement same.
  - **Where in Docket codebase:**
    - UI: `apps/command-room/src/app/settings/team/page.tsx`
    - Schema: extend `clients` with `assigned_to_user_ids[]` + `visible_to_team_ids[]`
    - RLS: extend Postgres RLS policies per CLAUDE.md §6 / Drizzle
  - **Effort estimate:** 2 sprints.
  - **Priority:** **P1** (blocks any firm with >1 preparer).

### Feature: SOC 2 Type II (Dec 16 release)
- **What it does mechanically:** Independent audit completion + unqualified result.
- **UX pattern:** Badge on homepage hero + security page + FAQ answer.
- **Where it lives in Docket today:** Not yet. CLAUDE.md notes SOC 2 Type II posture as L8 goal.
- **Recommended steal:** Trust signal placement. As soon as Docket has Type I, badge it everywhere.
  - **Where in Docket codebase:** `apps/marketing/src/app/_components/SOC2Badge.tsx`
  - **Effort estimate:** Audit work is months. Badge UX is 1 day.
  - **Priority:** **P2 substrate, P0 marketing surface once available.**

### Feature: HubSpot / Salesforce / Karbon / Double / Financial Cents / Slack / Asana / Monday / ClickUp / RingCentral / Dialpad / Quo integrations
- **What it does mechanically:** Each integration syncs meeting notes / action items / tasks bidirectionally with the third-party tool.
- **UX pattern:** Per-integration detail page with hero copy *"{Vendor} meets Ping. {Tagline}."* + 3-feature list + setup steps + screenshots.
- **Where it lives in Docket today:** MCP roster planned in §10 (8 servers, post-5/15). Ping integrations map to Docket's planned: Gmail · google-calendar · xero (substitute QBO) · slack · karbon-equivalent (TaxDome/Canopy if we adopt) · ringcentral (V1.5).
- **Recommended steal:**
  - **What to clone:** The /integrations hub page (grid of 20 logos) + the per-integration detail page format. The detail-page hero copy formula: **`"{Vendor} meets Docket. {Two-word tagline}."`** Ship one detail page per MCP server.
  - **Where in Docket codebase:**
    - Hub: `apps/marketing/src/app/integrations/page.tsx`
    - Detail pages: `apps/marketing/src/app/integrations/[slug]/page.tsx`
    - Per-vendor content: `content/integrations/*.mdx`
  - **Effort estimate:** Hub = 1 day. Each detail page = 0.5 day.
  - **Priority:** **P0** (marketing surface — ship for every integration as it lands).

### Feature: Phone / Mobile recording (Dec 31 release)
- **What it does mechanically:** Mobile app records in-person meetings; transcribes + processes same as online meetings.
- **UX pattern:** Mobile button → record → upload → same artifact pipeline.
- **Where it lives in Docket today:** Mobile not in v1 plan beyond responsive web. Could ship as PWA-recorded audio upload.
- **Recommended steal:** Audio-file-upload route into the same Notetaker pipeline.
  - **Where in Docket codebase:** `apps/command-room/src/app/api/meetings/upload-recording/route.ts`
  - **Effort estimate:** 3 days (if Notetaker pipeline exists).
  - **Priority:** **P2.**

### Feature: Theater Mode (Mar 19 release)
- **What it does mechanically:** Larger side-by-side video + transcript view for reviewing meetings.
- **UX pattern:** Toggle in meeting view → expanded 2-col layout.
- **Where it lives in Docket today:** Not in plan.
- **Recommended steal:** Trivial polish.
  - **Where in Docket codebase:** `apps/command-room/src/app/calendar/[id]/transcript/page.tsx` with `?view=theater` query param
  - **Effort estimate:** 1 day.
  - **Priority:** **P3.**

### Feature: External sharing of meetings/notes (Feb 27 release)
- **What it does mechanically:** Securely share a meeting recording or notes with someone outside the firm via tokenized link.
- **UX pattern:** Share button → copy link with expiration + permissions.
- **Where it lives in Docket today:** Adjacent to portal access pattern.
- **Recommended steal:** Tokenized share-link primitive. Useful for "send the audit-defense memo to the client's attorney."
  - **Where in Docket codebase:**
    - Schema: `packages/db/src/schema/share_links.ts` — `resource_type`, `resource_id`, `token`, `expires_at`, `permissions`
    - Route: `apps/client-portal/src/app/share/[token]/page.tsx`
  - **Effort estimate:** 1 sprint.
  - **Priority:** **P2.**

### Feature: Email signature customization (Camden's LinkedIn post)
- **What it does mechanically:** Custom HTML email signatures attached to AI-drafted replies.
- **UX pattern:** Settings → signature editor.
- **Where it lives in Docket today:** Not in plan.
- **Recommended steal:** Per-user signature config in inbox drafter.
  - **Where in Docket codebase:** `apps/command-room/src/app/settings/inbox/signature/page.tsx`
  - **Effort estimate:** 2 days.
  - **Priority:** **P2.**

### Feature: Referral program (May 6 release)
- **What it does mechanically:** Customer-facing referral link with reward.
- **UX pattern:** In-app banner + dedicated referral page.
- **Where it lives in Docket today:** Not in plan. CLAUDE.md §16 productization doesn't discuss this.
- **Recommended steal:** Once paid customer #5 is on, ship a simple Refer-a-Firm link.
  - **Where in Docket codebase:** `apps/command-room/src/app/refer/page.tsx`
  - **Effort estimate:** 3 days.
  - **Priority:** **P3.**

### Feature: Engagement scoring + Client sentiment tracking (firm-leader pitch)
- **What it does mechanically:** Score each client by meeting frequency + email cadence + sentiment trend. Surface decliners as at-risk.
- **UX pattern:** Per-client health pill (similar to Docket's risk-tier pill). Sortable column. Charted over time.
- **Where it lives in Docket today:** §4 *"Per-client risk tier (green/amber/red)"* — exists in design. Add sentiment dimension.
- **Recommended steal:** Add `engagement_score` + `sentiment_trend_30d` columns; show as sparkline on client card.
  - **Where in Docket codebase:**
    - Schema: extend `clients` table with `engagement_score: numeric` + `sentiment_summary: jsonb`
    - Agent: `services/workers/src/agents/engagement-scorer.ts` (daily cron)
    - UI: extend `packages/ui/src/components/RiskTierPill.tsx` to render sentiment-trend arrow
  - **Effort estimate:** 1.5 sprints.
  - **Priority:** **P1** (firm-leader pitch).

### Feature: AI-generated SOPs + Employee onboarding (firm-leader pitch)
- **What it does mechanically:** Watch the firm's preparers work → infer SOPs → output as documents for new-hire onboarding.
- **UX pattern:** Settings → Firm → SOPs (auto-generated, edit, publish).
- **Where it lives in Docket today:** Not in plan. CLAUDE.md §4 has *"Firm files"* tab in Documents (engagement letters, SOPs, audit-defense packets) — but assumes humans author.
- **Recommended steal:** Substrate is the `actions` table audit trail + memory. Generate SOPs from patterns in `actions` history.
  - **Where in Docket codebase:**
    - Agent: `services/workers/src/agents/sop-curator.ts`
    - UI: `apps/command-room/src/app/firm/sops/page.tsx`
    - Schema: `packages/db/src/schema/firm_sops.ts`
  - **Effort estimate:** 2 sprints.
  - **Priority:** **P2** (V1.5 — depends on enough usage data to infer SOPs).

### Feature: Real-Time Meeting Coach (Client Intelligence tier)
- **What it does mechanically:** During a live meeting, the bot suggests questions to ask based on Client Memory + current conversation. Listed under "Live suggested questions by Ping."
- **UX pattern:** Side panel during meeting with rolling suggestions.
- **Where it lives in Docket today:** Not in plan.
- **Recommended steal:** Higher complexity. Defer to V2.
  - **Where in Docket codebase:** `apps/command-room/src/app/calendar/[id]/live-coach/page.tsx`
  - **Effort estimate:** 4 sprints.
  - **Priority:** **P3** (V2+).

### Feature: Onboarding session (mid-tier) + Guided Onboarding (top tier)
- **What it does mechanically:** Human-led onboarding for higher tiers.
- **UX pattern:** Calendar booking after signup; dedicated CSM.
- **Where it lives in Docket today:** Not in plan.
- **Recommended steal:** Tier-gated white-glove onboarding as pricing signal.
  - **Where in Docket codebase:** Marketing-only. `apps/marketing/src/app/pricing/page.tsx`
  - **Effort estimate:** 1 day (pricing-page copy).
  - **Priority:** **P1** for pricing page redesign.

### Feature: Dedicated support (top tier)
- **What it does mechanically:** Higher-tier customers get a dedicated CSM.
- **UX pattern:** Pricing-tier feature listing only.
- **Recommended steal:** Same — pricing-tier differentiation move.
- **Priority:** **P1** (pricing page redesign).

### Feature: Lite seats ($10/mo for support staff)
- **What it does mechanically:** Add-on seat for support / junior staff who don't own client relationships but need to *view* client memory + action items + notes. $10/mo on most tiers, $20/mo on top tier.
- **UX pattern:** Add-on row inline in each pricing tier.
- **Why it's good:** Solves the *"my paralegal also needs to see this"* problem without forcing the firm to buy full seats. Per-seat pricing escape hatch.
- **Where it lives in Docket today:** Docket is per-active-client metering per CLAUDE.md §16 — different pricing model. **DO NOT ADOPT directly.** But the *concept* — a $10 read-only seat for staff who don't carry a PTIN — could fit Docket's model as a per-firm flat-rate read-only seat.
- **Recommended steal:** Adopt the **concept of a junior-staff read-only role** at the Clerk role + tenant pricing level. Not the seat-based pricing.
  - **Where in Docket codebase:**
    - Clerk roles: add `junior_staff` role
    - RLS: read-only for `junior_staff`
    - Pricing: include in firm tier flat-rate, surface as a checkbox on signup
  - **Effort estimate:** 1 sprint.
  - **Priority:** **P1.**

---

## 3. Changelog Velocity Pattern (the GTM weapon)

- **Total releases since launch (Jul 30 2025) → May 20 2026:** **25 releases over 295 days**.
- **Release cadence:** First 3 months (Aug-Oct 2025) = monthly. After that (Nov 2025 onward) = **weekly to bi-weekly**, averaging 5-7 days between releases. Peak cadence Jan-May 2026.
- **Copy voice:** Builder-casual, single-sentence headline, occasional emoji (*"Your choice 🤷🏼‍♂️"*), uses contractions, parenthetical asides, occasional self-deprecation, never sales-y. Sample headlines verbatim:
  - *"Your Phone Is Now a Ping Recorder"* (Dec 31)
  - *"Watch Ping on the Big Screen"* (Mar 19 — Theater Mode)
  - *"Salesforce Integration Is Here!"* (Mar 26 — exclamation, not period)
  - *"A Faster, Smoother Ping Experience"* (Apr 1)
  - *"Find Revenue Opportunities Faster"* (Apr 22)
- **What ships most:**
  - **Integrations (~32%):** Double, HubSpot, Slack, RingCentral/Quo/Dialpad bundle, Salesforce, ClickUp, Granola/Krisp imports
  - **Features (~48%):** Global Chat, Meeting Tags, Theater Mode, Mobile Recording, External Sharing, Pre-meeting prep emails
  - **Polish/UX (~16%):** Performance, notification layout, search accuracy
  - **Compliance (~4%):** SOC 2 Type II

**Recommended steal — how Docket should run its own changelog:**

1. **Ship at `docket.com/changelog`** under `apps/marketing/src/app/changelog/page.tsx` with each entry as MDX under `content/changelog/[YYYY-MM-DD]-[slug].mdx`. Frontmatter: `date`, `title`, `category` (feature/integration/polish/fix), `screenshot` (optional).
2. **Cadence target: weekly post starting Day 1 of v1 launch.** Use the protocol-enforcement hook approach from CLAUDE.md §23 — auto-prompt a changelog entry on every release tag.
3. **Voice rules:** single-sentence headline, 2-3 sentence body, 1 GIF or screenshot per entry, optional emoji, no sales copy. Match Antonio-voice from §11.
4. **Sample first 10 backfill entries for Docket changelog:**
   1. *"Antonio Vazquez voice — Inbox Drafter ships."* (Sonnet 4.6 in production, drafts in firm voice)
   2. *"Triage Classifier auto-categorizes every inbound message."*
   3. *"Bedrock fallover — zero downtime when Anthropic blips."*
   4. *"Square deposit collection in the intake flow."* (with Square checkout GIF)
   5. *"DocuSign + KBA — IRS Pub 1345-compliant 8879 signing."*
   6. *"Client Portal v1 — 25 intake steps, mobile-first."*
   7. *"Vazant Consulting goes live."* (the first-customer announcement — Slant-style)
   8. *"Gmail integration: real-time inbox + AI drafts."*
   9. *"Position Framework: every deduction carries a cite."*
   10. *"Audit trail is now reversible."* (the rewind primitive marketing handle)

---

## 4. /compare/{competitor} SEO Pages — The Pattern

**Ping's framing (verbatim header pattern):** *"Ping vs {Competitor}: which AI meeting assistant fits your accounting firm?"*

**Common structure across all three compare pages (Fathom / Otter / Fireflies):**
1. Logo-vs-logo banner
2. H1 question-format headline
3. TL;DR callout box ("X is good at A, but Ping is the stronger option for accounting firms because…")
4. Key differences bulleted narrative
5. **Row-by-row feature comparison table** (~14 rows × 2 columns of ✓/✗)
6. Scenario-based recommendation matrix ("Which tool is best for your situation?")
7. Pros/cons per product (Ping's own cons explicitly listed — credibility)
8. Side-by-side pricing
9. 5-6 FAQ blocks
10. **Methodology disclosure** ("data sourced from official product pages, pricing pages, and G2; quarterly re-verification; authorship by Ping team noted")
11. Bottom CTA: *"Try Ping free"*

**Tone:** Honest with disclosure ("This comparison was authored by the Ping team"), concrete differentials, occasional concession ("Fathom's free tier is hard to beat for basic meeting transcription"), measured language ("may be a better fit") not aggressive.

**Hub page** at `/compare`: *"Ping vs. the rest. Honest, side-by-side breakdowns of the tools firms ask about most."* Trust framing: *"Built to be trusted, not biased."*

**Which competitors Docket should write /compare pages for, in order:**

1. **`/compare/taxdome`** — the #1 competitor in incumbent practice management. Ping's "Karbon" but for the tax vertical. Position: *"TaxDome owns the practice management workflow. Docket owns the AI engine that powers it — and we ship two visual languages, one for clients, one for preparers, instead of TaxDome's single dated UI."*
2. **`/compare/canopy`** — adjacent PM, more modern UI but no real AI. Position: *"Canopy's UI is fine; their AI is a wrapper. Docket's AI carries citations and refusal logic."*
3. **`/compare/karbon`** — Ping already integrates with Karbon, signaling its strength outside tax. Position: *"Karbon is built for advisory firms broadly; Docket is built for tax preparation specifically — every position carries an IRC cite."*
4. **`/compare/black-ore`** — direct AI competitor. Position: *"Black Ore targets Big 4. Docket targets the EA / small CPA — and ships with a PTIN-safe position framework."*
5. **`/compare/taxgpt`** — Position: *"TaxGPT is consumer-facing tax Q&A. Docket is professional tax practice OS."*
6. **`/compare/ping`** — the meta-move. *"Ping is the right choice for general advisory firms. Docket is the right choice if your work touches a 1040 or 1120."* (Docket should literally write a /compare/ping page once positioning is sharp — Ping won't write one back.)

**Recommended Docket codebase paths:**
- Hub: `apps/marketing/src/app/compare/page.tsx`
- Detail: `apps/marketing/src/app/compare/[slug]/page.tsx`
- Content: `content/compare/{taxdome,canopy,karbon,black-ore,taxgpt,ping}.mdx`
- Shared: `packages/ui/src/components/CompareTable.tsx`, `CompareTLDR.tsx`, `CompareFAQ.tsx`

**Effort:** 1 day per detail page. Hub = 1 day.

**Priority:** **P0** SEO bet. Each page is a long-tail search funnel. Backlog 1 per week.

---

## 5. Pricing Page UX Deep Read

**Layout:** Three-column tier cards, side-by-side. No comparison matrix on-page (separate `/compare` hub).

**Annual vs monthly toggle:** Pill toggle at top — *"Annual (Save 20%) / Monthly"*. Default = annual. Saves-amount visible on the toggle, not in fine print.

**Tier card anatomy:**
- Tier name + tagline
- Big price ($/mo per user) with billing-frequency label
- Feature list (bulleted, no checkmarks on this page)
- **"Most popular"** badge above middle card (Virtual Assistant tier)
- Per-tier CTA: *"Get started"*

**Three tiers + pricing:**
| Tier | Annual | Monthly |
|---|---|---|
| Meeting Assistant | $28/mo/user | $35/mo/user |
| Virtual Assistant | $40/mo/user | $50/mo/user |
| **Client Intelligence** | $72/mo/user | $90/mo/user |

**Lite-seat add-on:** Embedded inside each tier's feature list — *"Unlimited Lite seats ($10/mo each)"* — not a separate add-on column. $20/mo at top tier.

**Feature inclusion pattern:** Each higher tier says "Everything in [prior tier] +" then lists the deltas. Clean.

**FAQ section (verbatim):**
- *"How secure is my data?"* — *"Ping Assistant is SOC2 compliant, and we never use your firm's proprietary data or client conversations to train public AI models. Your data remains siloed and encrypted."*
- *"Which plan is right for my firm?"* — tiered breakdown
- *"What are 'Lite seats' and why would I need them?"* — junior-staff use case
- *"How accurate are the accounting terms in the notes?"* — vertical-specific AI claim
- *"Can leadership see across all client accounts, or just their own?"* — Smarter Oversight
- *"Is there a discount for annual billing?"* — confirms 20% off
- *"Are there any usage limits on my plan?"* — *"We don't believe in 'counting minutes' when you're trying to run a firm."* (their best line — frames competitor pricing as petty)
- *"What happens to a client's history if an advisor leaves the firm?"* — institutional memory pitch
- *"How long does it take to get our firm up and running?"* — *"Personal setup under 90 seconds; team configuration takes 8 minutes."* (concrete numbers)

**Trust signals on pricing:** SOC 2 in FAQ. *"Made in the USA, specifically Utah"* in footer. No money-back guarantee. No customer logos on pricing page (logos live on homepage).

**Voice quotes from pricing:**
- *"Professional plans for modern advisory teams."*
- *"Every feature you need now and as you scale."*
- *"AI built for advisory-focused accounting firms."*
- *"A new advisor can step in and understand a 5-year relationship in minutes."*

**Recommended Docket pricing page redesign:**

Docket currently has per-active-client metering. Per CLAUDE.md §16, this is locked — **do not copy per-seat pricing**. But adopt Ping's *visual structure* and *FAQ playbook*:

**Three tiers for Docket** (suggested):
| Tier | Price | Target | Includes |
|---|---|---|---|
| **Solo EA** | $79/mo flat (up to 50 active clients) | Antonio | Inbox Drafter, Triage, Memories, Position Framework, Square deposits, Portal |
| **Small Firm** | $149/mo + $3/active client over 50 | 2-5 preparers | + Team roles, Cross-Sell Finder, Engagement Scoring, Magic Buttons authoring |
| **Practice** | $399/mo + $2/active client over 100 | 6+ preparers, firm-owner buyer | + Practice Intelligence, SOPs, Custom branding, Dedicated support, KBA wholesale, white-label portal subdomain |

**Pricing page structure** (steal from Ping verbatim):
- Three-col tier cards with annual/monthly toggle
- "Most popular" on Small Firm
- Per-tier CTA: *"Start free trial"*
- Junior-staff read-only seat as a sub-bullet on every tier ("Read-only seats for support staff included")
- FAQ section with 8-10 questions mirroring Ping's structure but tax-specific:
  - *"How is Docket different from TaxDome / Canopy / Karbon?"*
  - *"What about my PTIN? Does Docket carry compliance risk?"* (the position-framework pitch)
  - *"Will Docket train on my client data?"* (no, ZDR, encrypted, RLS-isolated)
  - *"How long does setup take?"* (concrete number — write down a real one)
  - *"What if my client volume changes mid-year?"* (active-client metering explanation)
  - *"How does pricing work during off-season?"* (year-round vs seasonal)
  - *"Can I run Docket alongside Drake / Lacerte / OLT?"* (yes, browser automation MCP)
  - *"Is there a discount for annual?"* (yes, 2 months free)

**Codebase paths:**
- `apps/marketing/src/app/pricing/page.tsx`
- `packages/ui/src/components/PricingCard.tsx`, `PricingToggle.tsx`, `PricingFAQ.tsx`
- Content: `content/pricing/faqs.mdx`

**Effort:** 1 sprint for full pricing-page rebuild.

**Priority:** **P0.** Per founder's note that "Docket's pricing page is currently underdeveloped."

---

## 6. Homepage Conversion Anatomy

**Section-by-section** (homepage flow, top → bottom):

1. **Sticky nav (always visible)** — logo left; nav center (Home / Individual Advisor / Firm Leadership / Integrations / Pricing); auth right (Log In / Sign up free). White background, faint border-bottom.

2. **Hero** (2-col grid, collapses at <809px):
   - **Left col copy:**
     - Eyebrow: none
     - H1: *"Firm Intelligence for Modern Advisory Firms"* — Inter Display, ~44px, weight 700, letter-spacing -0.01em
     - Subhead: *"Ping captures and centralizes client interactions, freeing advisors from admin work while giving leadership real-time visibility into the firm."* — Inter, ~18px, weight 400, line-height 150%, text-body color
     - CTA cluster: `[Sign up with Google] [Sign up with Microsoft]` (both primary-ink fill) + *"Talk to a human"* (text link)
     - **SOC 2 badge** below CTAs — small, faint, signal-not-shout
   - **Right col:** product screenshot (likely the client-memory dashboard view)

3. **Logo wall** — *"Trusted by accounting and advisory firms"* (implicit) — horizontal scrolling carousel, monochrome logos, 7 firms × 3 repeat. Speed slow enough to read. Logos: Sager CPAs, IgniteSpot, Protea Financial, Luma Accounting, FlowFi, Hall Accounting, Dejene & Associates.

4. **Feature tiles section** — H2: *"Discover Ping's features."*
   - **Audience toggle** above the grid: `[Individual advisor] [Firm leadership]` — pill tabs, active = orange border (uses `--color-accent-light`)
   - **2×3 = 6-card grid.** Each card: tier name h3 + tagline + 3-bullet feature list + `Learn more →` link
   - Individual advisor cards: Meeting Assistant · Email Assistant · Client Memory
   - Firm leadership cards: Revenue Finder · Institutional Memory · Employee Enablement

5. **Video testimonial wall** — H2: *"Watch Ping in action"* + subhead *"See how Ping makes work effortless."* + 5-tile grid (featured + 4 secondary). Each tile: thumbnail + duration badge (e.g. `12:34`) + speaker name + firm. Featured speaker Jason Staats gets the largest tile.

6. **Integrations carousel** — same logo-carousel pattern as the customer wall, but with vendor logos in color (Zoom blue, Slack purple, Google calendar multi-color, etc.). 15 logos × 3 repeat.

7. **Text testimonial wall** — H2: *"Loved by teams everywhere"* — scrolling carousel of short quotes. Notable: includes *raw enthusiasm quotes* like *"WHAT?!??!?! You have NO idea how excited I am right now! I just kicked back my chair and did the WORST but most spunky dance moves to celebrate."* — Slack message-style, not polished marketing-copy. **This is the single best UX move on the page** — feels real, not curated.

8. **FAQ accordion** — H2: *"Frequently asked questions"* — 7 collapsible questions. Same questions/answers as pricing-page FAQ (deduped from there).

9. **Final CTA section** — single big CTA bar at the bottom *"Discover how Ping can simplify your workflow."* with `[Sign up free]`.

10. **Footer** — multi-column: Product / Support / Company / Content. Footer tagline: *"Made in the USA, specifically Utah"*. Copyright 2026.

**Mobile breakpoints:** `<809px` collapses hero to 1-col, stacks feature tiles, narrows nav.

**What patterns Docket should mirror — top 8:**
1. **Sticky nav with prominent "Sign up free" CTA** in top-right
2. **2-col hero with product screenshot** — right column should be the Command Room dashboard
3. **Hero subhead = single sentence with two-clause balance** (X for advisors / Y for leaders)
4. **Audience toggle on the feature grid** — Preparer view / Firm-owner view tabs
5. **Logo wall above the fold** — even at v1 with 1 customer (Vazant), show it + the design-partner cohort
6. **Video testimonial wall** with duration stamps + speaker name/title — film Antonio first
7. **Real enthusiastic Slack-quote testimonials, not polished marketing copy**
8. **Integration logo grid in color** as second social-proof layer

**Codebase paths:**
- `apps/marketing/src/app/page.tsx` (homepage)
- `apps/marketing/src/app/_components/HeroSplit.tsx` (2-col hero)
- `apps/marketing/src/app/_components/LogoWall.tsx`
- `apps/marketing/src/app/_components/FeatureGridWithToggle.tsx`
- `apps/marketing/src/app/_components/VideoTestimonialWall.tsx`
- `apps/marketing/src/app/_components/IntegrationCarousel.tsx`
- `apps/marketing/src/app/_components/TestimonialCarousel.tsx`
- `apps/marketing/src/app/_components/FAQAccordion.tsx`

---

## 7. Tier-1 Steals (ship in next 4 weeks)

These compound: the homepage + pricing + changelog + llms.txt + first /compare page are the foundation for everything downstream.

| # | What | Where in Docket | Effort | Why now |
|---|---|---|---|---|
| 1 | **Marketing homepage rebuild** — 2-col hero + audience-toggle feature grid + logo wall + video testimonial wall + FAQ | `apps/marketing/src/app/page.tsx` and component tree above | 1 sprint | Current page is underbuilt; this is the front door |
| 2 | **Pricing page rebuild** — three-tier cards + annual toggle + Most-Popular badge + FAQ | `apps/marketing/src/app/pricing/page.tsx` + `packages/ui/src/components/Pricing*.tsx` | 1 sprint | Founder explicitly flagged pricing as underdeveloped |
| 3 | **Ship `/llms.txt`** at root | `apps/marketing/public/llms.txt` | 1 day | Tier-1 per prior analysis. Use Ping's format verbatim — capabilities list, pricing, integrations, compare links |
| 4 | **Ship `/changelog` and backfill 10 entries** | `apps/marketing/src/app/changelog/page.tsx` + `content/changelog/*.mdx` | 3 days | Velocity-as-marketing-weapon. Sets cadence expectation |
| 5 | **Ship `/compare/taxdome` (the first compare page)** | `apps/marketing/src/app/compare/[slug]/page.tsx` + `content/compare/taxdome.mdx` | 2 days | Highest-intent search query in the segment |
| 6 | **Integration hub page + one detail page for the highest-signal integration (Square or DocuSign)** | `apps/marketing/src/app/integrations/page.tsx` + `apps/marketing/src/app/integrations/[slug]/page.tsx` | 3 days | Each integration is a SEO funnel |
| 7 | **Memories tab UI on the client page** (Memory Curator Agent can come second; surface the data first from existing `client_facts`) | `apps/command-room/src/app/clients/[id]/memories/page.tsx` + `packages/ui/src/components/MemoriesTab.tsx` | 1 sprint | Per CLAUDE.md §9: *"the strongest single steal from their product"* |
| 8 | **Pre-meeting prep email** automation | `services/workers/src/agents/pre-meeting-brief.ts` + `services/workers/src/functions/pre-meeting-brief-cron.ts` | 1 sprint | High habit-formation value, small effort |
| 9 | **Smart Reply Library** added to inbox drafter | `packages/db/src/schema/inbox-templates.ts` + `apps/command-room/src/app/settings/inbox/page.tsx` | 1 sprint | Closes the polish gap vs Ping's inbox |
| 10 | **Junior-staff read-only role** | Clerk + RLS + pricing-page surface | 1 sprint | Multi-seat unlock without breaking active-client metering |

---

## 8. Tier-2 Steals (next sprint after that)

| # | What | Where in Docket | Effort | Priority |
|---|---|---|---|---|
| 11 | **Notetaker Agent + Action-Item Extractor** (joint ship) | `services/workers/src/agents/notetaker.ts` + `action-item-extractor.ts` + Inngest functions + Theater Mode UI | 3 sprints | P1 |
| 12 | **Magic Buttons (full ship with starter library)** | `packages/db/src/schema/magic_buttons.ts` + `apps/command-room/src/app/settings/ai/magic-buttons/page.tsx` + `packages/playbooks/magic-buttons/*.ts` | 3 sprints | P1 |
| 13 | **Cross-Sell Finder** under Practice Intelligence | `services/workers/src/agents/cross-sell-finder.ts` + `apps/command-room/src/app/practice/opportunities/page.tsx` | 2 sprints | P1 (firm-owner pitch) |
| 14 | **Engagement Scoring + Sentiment Trends** on client cards | extend `clients` schema + `services/workers/src/agents/engagement-scorer.ts` + `RiskTierPill.tsx` updates | 1.5 sprints | P1 |
| 15 | **Three-scope Ask Docket panel** (Client / Meeting / Book) with citation-to-source-artifact | `apps/command-room/src/app/_components/AskDocketPanel.tsx` + `packages/ui/src/components/ChatTrail.tsx` | 2 sprints | P0 |
| 16 | **Teams + per-client visibility roles** | Clerk org + RLS extensions + `apps/command-room/src/app/settings/team/page.tsx` | 2 sprints | P1 |
| 17 | **More /compare pages** (Canopy, Karbon, Black Ore, TaxGPT) | `content/compare/*.mdx` | 1 day each | P1 |
| 18 | **More integration detail pages** (Gmail, Square, DocuSign, Twilio, Clerk, Xero/QBO when shipped) | `content/integrations/*.mdx` | 0.5 day each | P1 |
| 19 | **External share links** (tokenized read-only artifacts) | `packages/db/src/schema/share_links.ts` + `apps/client-portal/src/app/share/[token]/page.tsx` | 1 sprint | P2 |
| 20 | **Customer testimonial blog posts** (video + transcript) — Antonio first, then design-partner cohort | `apps/marketing/src/app/blog/[slug]/page.tsx` + `content/blog/*.mdx` | 0.5 day per post (after filming) | P1 |

---

## 9. Tier-3 Steals (V1.5)

| # | What | Effort | Priority |
|---|---|---|---|
| 21 | **AI-generated SOPs** from `actions` audit-trail patterns | 2 sprints | P2 |
| 22 | **Real-Time Meeting Coach** (live question suggestion during meetings) | 4 sprints | P3 |
| 23 | **Phone / Mobile recording** PWA upload route | 3 days (post-Notetaker) | P2 |
| 24 | **Theater Mode** UI | 1 day | P3 |
| 25 | **Tag system** on `calendar_events` | 3 days | P2 |
| 26 | **PDF export** for meeting notes | 1 day | P2 |
| 27 | **Custom bot name/avatar** for Notetaker | 2 days | P2 |
| 28 | **Email signature customization** for inbox drafter | 2 days | P2 |
| 29 | **Referral program** | 3 days | P3 |
| 30 | **Dedicated CSM** tier-gated (marketing surface only) | 1 day | P1 (pricing page) |

---

## 10. What NOT to copy (where Docket's distinct identity matters)

1. **Per-seat pricing.** Ping is $28-$72/user/mo + Lite seats. Docket is per-active-client metered per CLAUDE.md §16. The model is locked. **Adopt the visual structure of Ping's pricing page; do not adopt its meter.** The active-client meter is a real differentiator — small EAs aren't punished for hiring a paralegal.

2. **Generic "AI assistant" copy.** Ping says *"AI for accountants"* broadly. Docket should say *"AI for tax preparation"* — specifically. The PTIN-on-the-line frame from CLAUDE.md §13 is the moat. Never say *"AI maximizes deductions"* or *"loophole finder"*; always *"catches every defensible deduction your team would have caught with unlimited time + audit trail built in."* This framing distinction is **non-negotiable** per §8.

3. **Ping's visual language as-is.** Their warm-cream + orange-accent + lavender-highlight is great — but Docket has *two* locked visual languages (editorial-warm portal + operational-modern command-room) per §11. Don't collapse to one. **However: adopt Ping's specific color-token discipline**: the warm shadow tints (`#dcd9d0` base, not neutral gray), the 6-step type scale with fluid clamp(), the 5-tier text hierarchy, the small 6px button radius. These are craft moves that compound.

4. **Their advisory-firm positioning.** Ping's *"advisory firms"* targeting is broader than tax. Docket is **tax-vertical specifically** — Antonio's EA segment per §3. Don't dilute. *"Built for the EA with a PTIN, not the CPA Big 4 partner."*

5. **Ping's "Magic Buttons" naming.** Docket already has this term locked in §9 — but Ping uses it. The risk of naming collision is real. Either rename Docket's version to *"Action Cards"* or *"Workflow Cards"* (mediocre) or *"Docket Moves"* (better), OR own the term and out-execute Ping. **Recommendation: rename to "Docket Moves"** — same primitive, distinct brand surface.

6. **Their changelog tone with too many emoji.** Ping uses occasional emoji (*🤷🏼‍♂️*, *🎉*). Docket's anti-AI-slop discipline per §19 forbids emoji in product surfaces. The changelog can carry one carefully-chosen emoji per entry, max, and only if it's the natural builder voice. **Generally: prefer no emoji.**

7. **Free tier.** Ping comparisons make a point of *"Fathom has a free tier; Ping does not."* They've made a decision: paid-only, no free, justify by the firm-level value. **Docket should adopt the same** — no free tier. The 5-min Discovery Scan / `/scan` flow (per §4) is the no-account try-it surface that handles the same demand. Don't collapse it into a "free Docket account."

---

## 11. UX/UI Patterns Worth Stealing Verbatim

These 10 are quote-grade specific — patterns you can hand to a designer with no further translation.

1. **Hero CTA cluster pattern.** Two primary `Sign up with Google` / `Sign up with Microsoft` buttons (both warm-ink-on-cream) + one text-link `Talk to a human` modal trigger. The Talk-to-a-human modal then asks *"What size is your firm?"* with three routes: Solo → Zoho chat / 2-10 → calendar booking / 11+ → calendar booking with a named human. **Steal this verbatim** — Docket's CTA cluster should be `[Sign up with Google] [Sign up with email]` + `Talk to Antonio's team` modal. Codebase: `apps/marketing/src/app/_components/HeroCTACluster.tsx` + `_components/FirmSizeModal.tsx`.

2. **Audience-toggle on the same feature grid.** Pill tabs (`Individual advisor` / `Firm leadership`) above a 2×3 card grid; clicking the tab swaps the 6 cards. Two-buyer-segments-in-one-page-without-splitting-pages. Codebase: `apps/marketing/src/app/_components/AudienceToggleGrid.tsx` with `Preparer view` / `Firm-owner view` tabs surfacing the right 6 cards.

3. **Real enthusiasm in the testimonial wall.** Ping's *"WHAT?!??!?! You have NO idea how excited I am right now! I just kicked back my chair and did the WORST but most spunky dance moves to celebrate."* is the single most authentic UX move on their site. **Steal verbatim** — Docket should drop a real Antonio Slack quote into the testimonial carousel. (Founder David: extract one from your Slack with Antonio next time he reacts to a feature shipping.)

4. **Video testimonial tile with duration stamp.** Thumbnail + `12:34` badge bottom-right + speaker name + firm/title. Five-tile grid: 1 featured + 4 secondary. **Steal the layout exactly.** Codebase: `packages/ui/src/components/VideoTestimonialTile.tsx`.

5. **Logo wall as horizontal-scrolling monochrome carousel.** 7 firms × 3 repeat, no labels, no headings. Lets visitors scan-and-recognize. **Adopt for Docket** even with 1 customer — pad with design-partner logos until ratio of customer:partner gets to 5:1.

6. **/compare hub framing: *"Honest, side-by-side breakdowns of the tools firms ask about most."* + *"Built to be trusted, not biased."* + methodology footnote.** The trust framing of the comparison hub is a craft move — sets the tone for every compare page. **Steal verbatim.** Codebase: `apps/marketing/src/app/compare/page.tsx`.

7. **Pricing FAQ line: *"We don't believe in 'counting minutes' when you're trying to run a firm."*** Ping uses this as a stake-in-the-ground against per-minute pricing models. **Docket should mirror with a stake against per-seat-pricing-during-low-volume-months**: *"We don't believe in charging you for seats during off-season. You pay for the clients you actively work with."* Codebase: `content/pricing/faqs.mdx`.

8. **Changelog single-sentence headlines.** *"Your Phone Is Now a Ping Recorder."* / *"Watch Ping on the Big Screen."* / *"Salesforce Integration Is Here!"* No marketing flourish. Just declarative. **Steal the voice.** Codebase: `content/changelog/*.mdx` — enforce single-sentence headline via frontmatter validation.

9. **Integration detail-page hero formula: *"{Vendor} meets Ping. {Two-word tagline}."*** *"Karbon meets Ping. Your workflow, connected."* / *"Double meets Ping. Unlock a smarter workflow."* **Steal verbatim** — *"Square meets Docket. Deposits, on rails."* / *"DocuSign meets Docket. 8879s, signed and KBA-passed."* Codebase: `content/integrations/*.mdx`.

10. **Footer geographic micro-pride.** *"Made in the USA, specifically Utah."* One line. Distinctive. **Adopt for Docket**: *"Made in San Francisco, with help from a real EA in Sacramento."* (or wherever Antonio is — Vazant Consulting). Codebase: `apps/marketing/src/app/_components/Footer.tsx`.

**Bonus 11th pattern — the methodology disclosure on /compare pages.** *"This comparison was authored by the Ping team, we're transparent about that. Data sourced from official product pages, pricing pages, and G2 profiles. Quarterly re-verification. Genuine Ping limitations are listed alongside competitor weaknesses."* — the honesty disclosure makes the comparison **more** credible, not less. **Steal verbatim.** Codebase: `apps/marketing/src/app/compare/_components/MethodologyNote.tsx`.

---

## 12. Citations

| URL | What I extracted |
|---|---|
| `https://www.pingassistant.com/` | Homepage architecture (hero / logo wall / feature tiles / video testimonials / text testimonials / integrations / FAQ / footer); hero copy and CTAs verbatim; feature card titles (Meeting Assistant · Email Assistant · Client Memory · Revenue Finder · Institutional Memory · Employee Enablement) |
| `https://www.pingassistant.com/_astro/_slug_.zWow4D3t.css` | Full `:root` design tokens — exact hex values for `--color-bg`, `--color-accent`, `--color-highlight`, `--color-success`; fonts (Inter / IBM Plex Serif / Fragment Mono / Inter Display); radius scale; shadow scale; type-step scale with clamp() |
| `https://www.pingassistant.com/_astro/_slug_.DYWmhGZP.css` + `index.C4qjkgsH.css` + `index.DssuzOdV.css` | Component-level CSS — button styles (`.btn-primary` warm-ink-on-cream); hero grid layout; tab pills; card padding |
| `https://www.pingassistant.com/features` | Four-pillar feature structure: Meeting Assistant / Email Assistant / Client Memory / AI Workflows |
| `https://www.pingassistant.com/individual-advisor` | Individual-advisor segment hero copy *"AI built for advisory."*; admin-reduction emphasis |
| `https://www.pingassistant.com/firm-leadership` | Firm-leadership segment hero copy *"AI built for firm leadership."*; Revenue Finder + Engagement Scoring + Sentiment Tracking + Institutional Memory + SOPs emphasis |
| `https://www.pingassistant.com/pricing` | Three tiers + annual/monthly toggle + Most-Popular badge on Virtual Assistant + Lite seats + 9 FAQ entries verbatim |
| `https://www.pingassistant.com/changelog` | Complete 25-release timeline Jul 30 2025 → May 20 2026 with copy voice analysis + cadence |
| `https://www.pingassistant.com/integrations` | 20-integration grid + category groupings; only 3 named integrations have detail pages (Karbon, Double, Financial Cents) |
| `https://www.pingassistant.com/integrations/karbon` | Per-integration detail page format + hero formula *"Karbon meets Ping. Your workflow, connected."* |
| `https://www.pingassistant.com/integrations/double` | Same format confirmed — *"Double meets Ping. Unlock a smarter workflow."* |
| `https://www.pingassistant.com/compare` | Hub-page trust framing *"Built to be trusted, not biased"* + methodology disclosure |
| `https://www.pingassistant.com/compare/fathom` | Full /compare page structure: TL;DR → feature table → scenarios → pros/cons → pricing → FAQ → methodology |
| `https://www.pingassistant.com/compare/otter` | Same structure confirmed |
| `https://www.pingassistant.com/compare/fireflies` | Same structure confirmed |
| `https://www.pingassistant.com/llms.txt` | Verbatim canonical capabilities list — Meeting Assistant / Email Assistant / Client Memory / Revenue Finder / Institutional Memory / Employee Enablement |
| `https://www.pingassistant.com/blog` | 4 posts visible — Jason Staats featured + Chad Davis + Zane Stevens + Timalyn Bowens + Dan Luthi |
| `https://www.pingassistant.com/testimonials` | 6 unique testimonials surfaced; layout uses stars + headshots + firm logos |
| `https://www.pingassistant.com/prospect-brief` | Hero copy *"Know what matters about your prospect before they even walk through the door. (feel free to replace door with Zoom room.)"* — voice texture example |
| `https://www.pingassistant.com/help-center` | 6 categories: Getting Started / Integrations / FAQs / Best Practices / Features / Troubleshooting |
| `https://www.linkedin.com/posts/camden-bean_big-announcement...` | Launch announcement Jul 30 2025; tagline *"Be an accountant, not a secretary"*; *"saves accountants 5+ hours a week"* |
| `https://www.linkedin.com/posts/camden-bean_we-launched-a-big-feature...` | Global Chat launch post; founder vision *"executive assistant for everything you'd want help with, except picking up lunch"* |
| `https://www.linkedin.com/posts/camden-bean_ping-can-now-support-custom-html-email-signatures...` | Email signature feature post |
| `https://www.americasfavoriteea.com/post/ping-assistant-ai-for-accountants` | EA customer review — features praised: Client Intelligence, Meeting Assistant, automated admin, custom AI tools; quote *"it's the client brain your firm has always needed"* |
| `https://encoursa.com/companies/ping-assistant` | Founder background: Camden Bean (son of CPA, ex-Divvy / Bill.com, $100M venture fund); upcoming webinar topic *"Using AI to Find Missed Revenue In Your Accounting Firm"* (May 26) |
| `C:\Users\minse\projects\docket\CLAUDE.md` | Docket source-of-truth: §4 Command Room + Client Portal surfaces; §8 intelligence layers + AI Preferences + Nudges + Reminders; §9 agent fleet (Triage Classifier + Inbox Drafter built; Memory Curator, Notetaker, Action-Item Extractor, Pre-Meeting Brief, Nudges, Discovery, Strategy, Position designed); §10 MCP roster; §11 design system with two visual languages + tokens; §16 productization; codebase structure |

**Pages that 404'd or were inaccessible (gaps in the inventory):**
- `https://www.pingassistant.com/security` — 404. Security details surface only on homepage FAQ + pricing FAQ + footer.
- `https://www.pingassistant.com/blog/why-i-switched-my-whole-firm-to-ping` — 404. Direct customer-story posts not indexed at predictable URLs.
- `https://www.pingassistant.com/changelog/pre-meeting-prep-emails` — 404. Changelog detail pages likely not individually routed.
- `https://www.pingassistant.com/blog/jason-staats-top-ai-app-2026` — 404.
- `https://www.youtu.be/2n0shweoC7c` and `https://www.youtu.be/dQIUPSDlcag` — YouTube transcripts not extractable via WebFetch; only metadata.
- `https://www.linkedin.com/in/camden-bean/` — 404 on direct profile fetch; individual posts accessible.
- `https://cute-screens-324207.framer.app/` — appears to be a *different* Framer "Ping Accounting" template, not Ping Assistant. Disregarded.

These gaps don't materially affect the inventory since the on-site sources cover the full feature surface; the customer-story posts are video-content-as-blog-post with no unique product info beyond what's already cataloged.

---

**Final note for the founder:** The single highest-ROI move from this inventory is **rebuilding the marketing surface** (homepage + pricing + /compare + /integrations + /changelog + /llms.txt) in the next 4 weeks. The product features Docket needs to ship to *match* Ping (Notetaker / Memory Curator / Magic Buttons / Cross-Sell Finder) take longer — but Docket already has the harder substrate (Position Framework, citation-grade authority, KBA-compliant 8879, multi-tenant RLS, Bedrock fallover) that Ping does not. The marketing surface is the bottleneck on telling that story. Ship that first; the feature parity follows.