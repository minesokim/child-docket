# Soraban Feature + UX Deep Inventory

> Companion to the Soraban strategic deep-dive. That doc covered the business shape, founders, pricing tiers ($25 / $20 / $40 / $30 / 50-return floor / 300-return Connect floor), legacy-integration hack patterns (ProConnect credential-share, CCH AutoFlow piggyback, 2-5 day batch SLA). **This pass goes DEEPER on product feature anatomy + UX patterns** — the two highest-leverage steal surfaces per the founder: (a) intake mechanics and (b) per-tax-software import flow UX.
>
> Match-shape with `PING-FEATURE-UX-DEEP-DIVE-2026-05-13.md`. Token-extraction depth on the visual identity, step-by-step on the intake + import flows, recommended-steals with codebase paths.

---

## 1. Visual & UX Identity (the design language)

**Confirmed via raw CSS inspection of `soraban-new.webflow.shared.0a4363c29.min.css`** (Webflow-hosted; site is on Webflow + CMS). Hard data, not guesswork.

**Primary brand color + accent palette (verbatim from `:root`):**
- White: `--white: #fff`
- Text dark: `--text-dark: #000` (pure black, not warm-ink)
- **Accent (primary brand): `--accent: #1f95ff`** (vivid sky-blue, sometimes shown as `#1F95FF`)
- Blue gradient top: `--blue-border-gradient-top: #1f95ff`
- Blue gradient bottom (deep navy): `--blue-border-gradient-btm: #051956`
- Text secondary: `--text-secondary: #666`
- **Primary surface: `--primary: #f7f7f7`** (light-gray canvas, NOT warm cream like Ping/Docket)
- **Yellow accent: `--yellow-accent: #e0fa4d`** (acid lime — the CTA pill color; loud)
- Lavender accent: `--lavender-accent: #c3a6ff`
- Success: `--success: #00e884` (saturated mint green)
- Critical: `--critical: #d13112` (warm orange-red)
- Border gradient top: `--border-gradient-top: #f7f7f7`
- Spec border: `--spec-border-gr-top: #9b9b9b`, `--spec-border-gr-btm: #05195633` (navy at 20% alpha)
- Text white: `--text-white: #fff`
- Box-shadow size token: `--box-shadow--size: 1rem`

**Translation:** Soraban ships a **white canvas + bright sky-blue brand + acid-lime CTA + lavender + mint-green success** palette. Three load-bearing brand colors stacked: blue for trust/links, **lime-yellow `#e0fa4d` for the primary button background** (hover `#cee547`, active `#c2d943`), and pure black/white for typography. **This is structurally very different from Docket's editorial-warm and Ping's warm-cream-+-orange.** It reads as Y Combinator-house-style modern SaaS (Stripe + Notion + Linear lineage) rather than editorial/craft.

**Typography (verbatim from CSS, in declared order of weight):**
- **Body sans: `Albert Sans, sans-serif`** (the operational typeface — used for everything that's not a heading)
- **Display: `Satoshi`** (geometric grotesque — used for product H1/H2 mid-page; modern, sharp)
- **Display alt: `Featuredeck, Georgia, sans-serif`** (the headline/hero typeface with Georgia fallback — feels like a serif-pretending-to-be-sans; gives the editorial feel)
- **Mono: `Spacemono`** (for code blocks / accents)

Webflow base default tokens leak through unused (Arial, Helvetica Neue) but the four above are the load-bearing choices. **Albert Sans is the dominant typeface across the whole site.**

**Type scale (verbatim from media queries — rem-based scaled to viewport):**
- h1: `38px → 44px line-height` (Webflow default; overridden in custom blocks to `8.89rem` on mobile = ~28pt)
- h2: `32px → 36px line-height` (custom override to `8.89rem` for "faq_title" pattern)
- h3: `24px → 30px line-height`
- h4: `18px → 24px line-height`
- Body: 14px-16px base, mobile scaled to `5rem` / `4.44rem` (~16-18px equivalents on phone)
- Text-size-18: `5rem` on mobile (~18px) — used for body copy in heroes
- Text-size-12: `3.33rem` on mobile (~12px) — used for footer/microcopy
- Text-size-14: standard secondary body

**Translation:** Soraban uses **a serif-flavored sans for display + a workhorse modern sans for body**. The combo is decidedly *modern SaaS*, not editorial. **Featuredeck** is a relatively rare contemporary typeface that gives the site its slight character — it sits in the "rounded geometric grotesque with serif energy" lane. The pattern is **closer to Pretto/Notion than to Stripe** — modern but not sterile.

**Layout grid + density:**
- Webflow `.w-container` max-width: `940px` (narrow! tighter than Ping's 1024-1440 default)
- Breakpoint stack: `<479px` (tiny), `<767px` (small), `<991px` (medium), default desktop
- Spacing scale is `rem`-based with heavy values on mobile (`6.67rem` ≈ 24px, `8.89rem` ≈ 32px, `13.33rem` ≈ 48px). On desktop these scale down via Webflow's responsive multipliers.
- **Hero generously spaced**: `padding-top: 20rem` and `padding-bottom: 31rem` on mobile is a huge breathing-room signal. Soraban-the-website prioritizes whitespace over density.

**Color usage rules** (extracted from observed CSS state classes):
- Background = white `#fff` for cards + primary surface `#f7f7f7` for section backgrounds.
- **Acid lime `#e0fa4d` is reserved for primary CTAs** (`.button_inner.color--dark` background, hover→`#cee547`, active→`#c2d943`). Never used for body text, headings, or icon flooding. **The "Let's Chat" / "Request a Demo" button on the homepage hero is this lime color.**
- Sky-blue `#1f95ff` is for links + accent borders + secondary buttons + brand mark.
- Pure black `#000` for headings + body ink.
- Secondary text `#666` for subhead copy.
- Mint success `#00e884` for status indicators (likely "submitted" pill).
- Critical red-orange `#d13112` for warnings.

**Iconography style:** Webflow icon font (slider arrows, dropdowns, hamburger) is used minimally. Most icons appear to be inline SVG or PNG. Investor logos render as full-color images (Y Combinator orange wordmark, Altos, Village Global, etc.). Integration logos render in COLOR (Lacerte teal, Drake green, Karbon purple). **No abstract 3D illustration. No custom icon system. Just real logos.**

**Card patterns (from CSS):**
- Radius: very generous radii. Repeated values include `2.22rem` (~8px), `5.56rem` (~20px on mobile), `6.67rem` (~24px on mobile), and up to `11.11rem` (~40px on mobile = pill shape). **`6.67rem` is the dominant card radius — very rounded, friendly, almost iOS-app-like.** Buttons use `40px` (pill) or `2.22rem` (rounded rect).
- Shadow scale: minimal. One observed `box-shadow: 4px 24px 15rem 10rem #10151af5` for blog hero cards — a heavy bottom-tinted shadow with deep-navy tint at 96% alpha. **The blog-card shadow is a signature move:** giant blur + deep navy = high-contrast cards floating on the light surface. NOT the warm-cream-tinted shadows of Ping/Docket.

**Button styles (verbatim from CSS observation):**
```
.button-3 { border-radius: 5rem; }  /* pill */
.button-3.secondary { border-width: 1px; border-color: #1f95ff; border-radius: 40px; }
.button_inner-3 { padding: 4.44rem 0; font-family: Featuredeck; border-radius: 40px; }
.button_inner-3.color--dark { background-color: #e0fa4d; }  /* LIME PRIMARY */
.button_inner-3.color--dark:hover { background-color: #cee547; }
.button_inner-3.is--small-text-only { padding: 3.5rem 4rem; }
.button_inner-3.header-menu { background-color: #f7f7f7; }
.button_inner-3.header-menu:hover { background-color: #fff; }
```

**Translation:** Primary CTA = **acid-lime fill, pill shape, Featuredeck font, no border, lift on hover (lighter lime).** Secondary CTA = sky-blue 1px outline on white. Header buttons = light-gray fill on hover-to-white. **The lime-on-white-on-black combo is the brand signature.**

**Imagery:** The home page shows multiple **product screenshots** — the actual Soraban app UI rendered against the white canvas, often with alternating left-right layout. No stock photography. No abstract gradients (other than the navy/blue gradient for accent borders). Customer testimonial section features photos of named CPA professionals (Nadine Julson, Brandon Hall) alongside firm logos.

**Copy voice — 10 verbatim examples:**
1. *"Get More 1040s Out the Door"* (hero H1 — declarative, blue-collar-friendly, focused on volume not technology)
2. *"The intelligent, AI-powered tax workflow platform that automates the manual work across intake, data entry, and delivery."* (hero subhead — three named phases, "manual work" as the enemy)
3. *"Get More Capacity. Keep Your Evenings."* (sub-hero claim — work-life-balance framing, two sentences)
4. *"Your Tax Workflow, As It Should Be"* (section H2 — implicit "as it isn't today")
5. *"Have Soraban automate the tedious task of document collection so you can focus on running your firm."* (Smart Dynamic Questionnaire tile — "tedious" is voice marker)
6. *"Provide a painless experience working with your firm."* (Seamless Client Experience tile — "painless" voice marker)
7. *"We'll customize the platform to fit your firm's branding. Avoid client confusion."* (White-Label tile — "we'll" = white-glove voice; "client confusion" is the felt-pain hook)
8. *"Experience unprecedented AI accuracy and heighten data privacy."* (Connect tile — "unprecedented" + "heighten data privacy" = vendor-pitch register)
9. *"Soraban allowed me to take two vacations with my family during tax season."* (Nadine Julson, CPA testimonial — the **best line on the entire site**: outcome-specific, family-anchored, vacation as proof)
10. *"Workflow is table stakes. Capacity is the future."* (Enoch Ko founder line from rebrand post)
11. *"Accounting has an execution problem — not for the accounting work, but for everything around it."* (Series A announcement opening — frames the unbillable 60%)
12. *"Soraban's AI fixed the 60% of a firm's week they can't bill for."* (Series A subhead — the bumper-sticker)
13. *"Real innovation isn't magical. It's reliable, repeatable, and built to scale."* (closing line of the AI-vetting blog post — anti-hype, builder voice)

**Voice = professional-with-empathy + dollars-and-hours specific + "tedious work" as the named enemy.** Less builder-casual than Ping, less editorial than Docket. The register is **mid-market CPA owner pitch deck**: capacity, evenings, vacations, the work-before-the-work. NOT solo-EA-storefront. NOT Big-4-partner.

**Page architecture (homepage):**
1. Sticky nav (logo left, nav center — Product / About / Security / Perspective / Blog / Careers, auth right — Log In / Request a Demo)
2. Hero (centered, NOT 2-col): H1 + subhead + lime "Let's Chat" CTA + small "See it in Action" secondary
3. Investor / customer logo block (Y Combinator, Village Global, Altos, PHX Ventures, "& Others")
4. **Three-phase product walkthrough**: Collect → Connect → Deliver, each with 3 feature tiles + product screenshots in alternating left-right layout
5. Integration logo grid (14+ logos in color: Dropbox, ProSeries, Gmail, Outlook, Zapier, Thomson Reuters, SmartVault, Lacerte, ShareFile, ATX, TaxWise, Drake, Karbon)
6. Customer testimonial section ("Insights from Satisfied Firms") — carousel format, photo + name + firm + headline + body quote
7. Security section ("Safe and Secure") — 6 checklist bullets + AICPA SOC 2 Type II badge
8. Final CTA section
9. Footer (multi-column: About / Security / Case Studies / Resources / Careers / Status / Privacy / Terms; support@/sales@ emails; "Made with care for accountants" tagline equivalent absent — they don't do geographic micro-pride)

**Translation for Docket:**
- **DO adopt:** the **three-phase named workflow** (Collect / Connect / Deliver) as a product-page architecture pattern. Docket's analog could be "Intake / Operate / Deliver" or "Gather / Decide / File." This is the strongest single IA move on Soraban's site — the buyer immediately sees the three places Soraban's product touches their week, in order of how a return moves.
- **DO adopt:** the **"vacation as proof" testimonial frame** ("Soraban allowed me to take two vacations with my family during tax season"). For Docket: *"Antonio handled both 2026 IRS audits with Docket — without missing a single client deadline."* Outcome-specific, family-anchored.
- **DO adopt:** integration logo grid in color (Soraban shows 14+ vendor logos; Docket today shows zero on marketing).
- **DON'T adopt:** the lime-on-white CTA. Lime `#e0fa4d` is loud and out-of-character for editorial-warm portal aesthetic. Docket's CTAs should remain warm-ink-on-cream per L11. The Soraban lime is YC-house-style modern-SaaS — wrong for the editorial-warm portal language.
- **DON'T adopt:** Featuredeck. The serif-energy display font is a deliberate craft choice; Docket already has Fraunces (portal) + Inter/Geist (command-room). Mixing in a third would dilute.
- **DON'T adopt:** the centered hero. Docket's 2-col hero-with-product-screenshot is structurally stronger (per Ping inventory). Soraban's centered hero with no product screenshot is a weaker pattern.

---

## 2. The Intake Surface — Step-by-Step Anatomy (the load-bearing piece)

**This is the gold mine.** Soraban's entire moat is here. Walking through what a taxpayer experiences from end-to-end, reconstructed from help-center articles + Capterra reviews + the founder's own blog posts.

### Step 0. Firm sets up the questionnaire (firm-side)

**Mechanics:** Firm authors a questionnaire template via the **Template Editor** (`/template-editor-creating-and-customizing-questionnaire-templates`). Templates carry: name, **Annual Behavior** setting (auto-resends each tax year), description, **Document Path** (where uploaded docs land in the firm's storage hierarchy). Sections inside the template can have **videos embedded** (Loom iframe paste — `/how-to-add-videos-to-sections-in-the-template-editor`) for per-section instructions to the client.

**UX pattern Soraban uses:** Drag/drop or click-to-add for sections + questions. **Rollover Items** (prior-year answers carried forward) and **Rollover Answers** can be stacked. **Custom Items** (Open Item Requests) for ad-hoc doc requests. **Firm Glossary** — firm-authored tooltips on hover for jargon terms within questions (`/firm-glossary`).

**Why it's good:** Templates are NOT one-size-fits-all. Each firm builds a different questionnaire matching their preferred workflow. Annual Behavior auto-cloning means the template re-fires next January without re-authoring. Embedded videos give per-section clarity — *"Here's a 90-second clip explaining what a 1099-NEC looks like before you upload it"* — without bloating the question copy.

**Where in Docket today:** Docket has the 25-step intake hardcoded in `apps/client-portal/src/lib/intake-flow.ts`. **No firm-side template editor exists.** The intake is built for one firm (Vazant), not authored per firm. This is the **biggest single capability gap** Docket has vs Soraban for multi-firm scale.

**Recommended steal:**
- **What to clone:** Template Editor + Annual Behavior + Custom Items + Firm Glossary. The Annual Behavior pattern is especially clever — it solves the "every January the firm has to redo the questionnaire" anti-pattern that competitors leave on the firm's plate.
- **Where in Docket codebase:**
  - Schema: `packages/db/src/schema/intake_templates.ts` (new) — `tenant_id`, `name`, `version`, `annual_behavior` (boolean), `description`, `document_path_pattern`, `sections jsonb`, `glossary jsonb`
  - Editor UI: `apps/command-room/src/app/settings/intake-templates/[id]/page.tsx` + `_components/TemplateEditor.tsx`
  - Per-tenant runtime: replace hardcoded `intake-flow.ts` with `loadTemplateForTenant(tenantId)` → returns the same `IntakeStep[]` shape from a row in `intake_templates`
- **Effort estimate:** 4 sprints. This is THE multi-firm-readiness blocker. Antonio's intake can stay hardcoded; tenant #2 onboarding is gated by this.
- **Priority:** **P0** for v1.5 / tenant #2 onboarding.

### Step 1. Firm sends the questionnaire (firm-side)

**Mechanics:** Firm goes to client list → selects N clients → "Send Questionnaire" → picks template → optionally schedules a future send date (`/how-to-schedule-a-date-in-the-future-to-send-a-questionnaire`). Bulk send + individual send supported. **Rollover items toggle on per-send** to carry prior-year answers (`/how-to-include-rollover-items-prior-years-data-when-sending-a-questionnaire-template`). Additional one-off questions can be added at send time without modifying the template (`/how-to-include-additional-questions-when-sending-a-questionnaire-template`). **Custom Questionnaire** pattern for non-template ad-hoc sends.

**UX pattern Soraban uses:** Send wizard. Bulk-select clients via table. Picker for template. Toggle for rollover. Calendar picker for future-date scheduling. Confirmation modal showing per-client preview of the outbound message.

**Why it's good:** The firm doesn't author a fresh questionnaire per client — they send a template, then optionally append per-client questions. The scheduling primitive ("send Jan 5 to all 750 returns") is the operational unlock for Necelis CPA's 750-return scale.

**Where in Docket today:** No bulk-send. No template picker. Antonio manually starts each client's intake by adding them to the `clients` table; the intake then "pulls" the client through the 25-step flow. Different model — pull (Docket) vs push (Soraban). Both have merit; Soraban's push model better fits high-volume firms.

**Recommended steal:**
- **What to clone:** The bulk-send wizard + scheduling primitive. Even with Docket's pull-based intake, the firm-side should be able to *queue* outbound invitations to N clients at once for a future date.
- **Where in Docket codebase:**
  - UI: `apps/command-room/src/app/intake/send/page.tsx` (bulk-send wizard)
  - Schema: `packages/db/src/schema/intake_invitations.ts` — `tenant_id`, `client_id`, `template_id`, `scheduled_for`, `sent_at`, `channel` (`sms` | `email`)
  - Inngest function: `services/workers/src/functions/dispatch-intake-invitations.ts` (cron every 5min, dispatches due rows)
- **Effort estimate:** 1.5 sprints.
- **Priority:** **P1** post-template-editor. Soraban's `750 returns in 1 day` workflow is gated by this primitive.

### Step 2. Client receives the magic-link invitation (client-side)

**Mechanics:** Soraban dispatches a triple-channel notification: **SMS (from a preset number)**, **email**, and a **portal notification** (only visible if the client logs in). Default cadence: initial send + auto-reminder every 7 days until completion. **Voicemail bot is mentioned in third-party reviews** as a third reminder channel ("auto-remind clients via email, SMS, and virtual messages [voicemail]") — confirming SMS + email + VM is the canonical three-channel stack.

**UX pattern Soraban uses:** Client receives a single short SMS like (reconstructed from voice + help-center patterns): *"Hi [client first name], it's tax time at [Firm Name]. Click here to start your [Tax Year] return: [magic-link URL]. Reply STOP to opt out."* Email contains a similar body with the firm's logo if white-labeled. Voicemail script is short — pre-recorded audio dialing the client's number with the same prompt.

**Why it's good:** Triple-channel from the start. The client's preferred channel (SMS/email/portal) is autodetected from their contact card; if SMS is on file, SMS sends and email follows as redundancy. **`Contact Method` is a client-facing setting** that can be changed by either the firm or the client.

**Where in Docket today:** Twilio is wired for SMS OTP authentication only. Outbound questionnaire-launch SMS is NOT built (the "Send via SMS" button on `/clients/new` is greyed out with "Coming soon" — per CLAUDE.md §18). Gmail is wired for receive; outbound email-with-magic-link is NOT built. No voicemail bot.

**Recommended steal:**
- **What to clone:** The triple-channel dispatch logic + the contact-method preference primitive + the voicemail bot (this is the **least-built capability across all competitors** — Soraban's only major moat-grade move at the comms layer).
- **Where in Docket codebase:**
  - Schema: `packages/db/src/schema/clients.ts` — add `contact_method` enum (`sms_first` | `email_first` | `portal_only`) + `sms_opt_out` + `voicemail_opt_out` booleans
  - SMS dispatch: extend existing `services/workers/src/lib/twilio-sender.ts` (build) with `sendMagicLink(clientId, magicLink)` wrapper
  - Email dispatch: `services/workers/src/lib/gmail-sender.ts` (firm's OAuth gmail per L10) with React Email template
  - **Voicemail bot:** Twilio `<Pause>` + `<Say>` TwiML script. New `services/workers/src/lib/twilio-voicemail-bot.ts`. Cron-scheduled to fire only after N failed SMS attempts.
- **Effort estimate:** 3 sprints (SMS = 1, email = 1, voicemail bot = 1). Voicemail bot is the diff vs. Ping/Slant/Docket-today.
- **Priority:** **P0**. This is the single most "Antonio's clients aren't tech-natives" capability — voicemail bot is the multilingual-storefront moat.

### Step 3. Client clicks magic link → auth (client-side)

**Mechanics:** Magic link opens directly to the questionnaire — no password. **Sign-In Link** is the named mechanism (`/how-to-send-a-sign-in-link` — article URL inferred). Token is single-use, short-lived. For returning visits, client uses **MFA** (`/multi-factor-authentication-mfa-in-soraban`):
- 6-digit SMS code (or email fallback)
- 10-minute validity, reusable within window
- 5-attempt lockout
- **Required as of 2025** per IRS preparer MFA mandate (federal compliance, not Soraban-specific)
- **Session timeout: 30 minutes idle**, with 60-second warning dialog before automatic logout (`/understanding-session-timeout-in-soraban`). Admin-configurable below 30min for higher security, NOT above. Auto-save preserves work.

**UX pattern Soraban uses:** Click link → directly inside the questionnaire on first visit (token-authenticated). Returning visit → enter phone → SMS code → in. Inactivity → modal dialog says *"You'll be logged out in 60 seconds. Stay logged in / Sign out."*

**Why it's good:** Magic link bypasses the password problem for tax clients who'd otherwise forget/reset. MFA is now legally required (IRS mandated 2025). The 60-second warning before timeout is a polish detail that prevents losing in-flight work — Soraban explicitly states *"Soraban preserves all data, so work in progress is saved automatically."*

**Where in Docket today:** Phone-OTP auth via Clerk + Twilio is shipped (per CLAUDE.md §18). Magic link for outbound invitations NOT built (see Step 2). Session timeout via Clerk default (not customized to 30min). 60-second warning dialog NOT built.

**Recommended steal:**
- **What to clone:** Magic-link invitation flow + 60-second pre-timeout warning dialog + auto-save preserves-in-flight messaging.
- **Where in Docket codebase:**
  - Magic link: `apps/client-portal/src/app/(intake)/magic/[token]/page.tsx` (new) — validates token, signs in via Clerk session, redirects to in-progress intake step
  - Token issuance: `packages/db/src/schema/intake_magic_links.ts` — `token`, `client_id`, `expires_at` (24hr), `used_at`
  - Warning modal: `packages/ui/src/components/SessionTimeoutWarning.tsx` — countdown timer + Stay/Sign-out actions
  - Auto-save messaging: extend `useIntakeField` hook to display "Auto-saved" toast on field save (existing infra)
- **Effort estimate:** 1 sprint.
- **Priority:** **P1**.

### Step 4. Client lands inside the questionnaire (client-side)

**Mechanics:** Mobile-first responsive UI. Sections rendered with section navigation (sidebar/tab on desktop, dropdown on mobile). **Firm Glossary tooltips** highlight jargon and show definitions on hover/tap. **Embedded videos** play inline at the top of each section if the firm authored one. Progress indicator shows completion percentage. Questions support: text input, multi-choice, date, dropdown, file upload, and **"Upload Later"** marker for documents the client doesn't have on hand.

**UX pattern Soraban uses:** Per-section progressive disclosure. Auto-save on every field change ("Soraban preserves all data"). **Clients cannot submit incomplete questionnaires** — every required question or upload must be answered or marked "Upload Later" (which leaves it on the firm's "missing docs" list but allows submit). **Custom Buttons** can appear in the client dashboard (firm-authored links to scheduling tools, the firm's website, payment portals — `/how-to-add-custom-buttons-with-live-links`).

**Why it's good:** "Upload Later" is the single most-empathetic UX move on the platform. The client doesn't get blocked by a missing 1099 — they mark it, keep going, and the firm sees the gap. **This solves the "abandoned intake" problem.** Soraban marks unanswered items in the PDF export as "Unanswered" (`/identifying-missing-documents-in-the-pdf-export`).

**Where in Docket today:** Docket has the 25-step `canAdvanceFromStep` gating (per CLAUDE.md §4). `STEPS_WITHOUT_GATE = ['docs']` is the doc-step exemption. **Docket does NOT have "Upload Later" as a per-question marker** — the doc step is currently all-or-nothing per-doc-type. Custom Buttons on portal dashboard NOT implemented.

**Recommended steal:**
- **What to clone:** "Upload Later" marker on every doc-request step + Custom Buttons primitive.
- **Where in Docket codebase:**
  - Schema: `packages/db/src/schema/intake_responses.ts` — add `status` enum (`answered` | `upload_later` | `pending`) per question
  - UI: extend `apps/client-portal/src/app/(intake)/docs/page.tsx` doc-row component with "I'll upload this later" button per doc-type
  - Missing-docs view: `apps/command-room/src/app/clients/[id]/missing-docs/page.tsx` — surface every `upload_later` row across the client's intake
  - Custom buttons: `packages/db/src/schema/tenant_dashboard_buttons.ts` — `label`, `url`, `scope` (firm-wide vs per-entity), authored in firm settings; render on portal Home tab below the status card
- **Effort estimate:** 2 sprints.
- **Priority:** **P0** — "Upload Later" closes the highest-leverage abandonment hole.

### Step 5. Document Upload UX (client-side)

**Mechanics:** Clients upload documents in **three places**:
1. Directly inside the Questionnaire (per-section, per-question)
2. In the general **Document** section or per-folder (firm-customizable folder structure — `/portal-folder-structure-customization`)
3. As an **attachment to a message** in the conversations panel
**Auto-conversion of images to PDF** is a core Soraban capability (named explicitly in reviews — third-party reviewers note "auto-conversion of uploads to PDF format"). **Bulk Upload Processor** handles multi-doc PDF uploads — splits compiled PDFs (`/bulk-upload-processor-complete-user-guide`). **Document Triage** routes uploaded docs to the right questionnaire (`/document-triage-from-upload-to-the-right-questionnaire`).

**UX pattern Soraban uses:** Drag-drop in browser; mobile camera capture (likely native file-picker → camera option, not a custom camera UI). Auto-convert JPG/PNG → PDF on upload. **Bulk Document Requires Splitting** notification fires if the firm admin needs to manually split a compiled multi-form PDF (i.e., the AI couldn't auto-split).

**Why it's good:** Three upload locations means clients can drop docs wherever they're already looking — they don't have to navigate to a specific page. Auto-PDF-conversion is invisible polish. **The Document Triage agent + Bulk Upload Processor are the auto-classification primitives that compete with TaxGPT/Filed.** Bookmarked PDF export bundles all the docs in the right order for tax-software import (`/identifying-missing-documents-in-the-pdf-export` shows the export structure).

**Where in Docket today:** Docket has a 4-phase doc upload pipeline (per `docs/DOCS-CAPTURE-PIPELINE.md` — empty → AI scanning → retake prompt → AI parsed → saved). Mobile camera capture is wired. **Auto-classification AGENT is paper-spec only** (`Document Triage` agent in CLAUDE.md §9 — designed but NOT built). Bulk upload processor NOT built.

**Recommended steal:**
- **What to clone:** Three-location upload primitive + auto-PDF conversion + Bulk Upload Processor (multi-doc PDF splitter) + Document Triage agent (routes uploaded docs to the right question/section/client).
- **Where in Docket codebase:**
  - Three-location upload: extend message thread UI (`apps/client-portal/src/app/portal/messages/page.tsx`) with inline file-attach; extend portal Documents tab with folder-aware drop zone
  - Auto-PDF: `services/workers/src/lib/pdf-converter.ts` — Sharp or pdf-lib to convert JPG/PNG/HEIC → PDF on upload. Wire into existing Cloudflare R2 upload pipeline
  - Bulk splitter: `services/workers/src/agents/document-splitter.ts` — Haiku vision-call on bulk PDFs, returns split-point indices + suggested classifications per page-range; surfaces as a Need-You-Queue card with one-click accept/reject
  - Document Triage agent: `services/workers/src/agents/document-triage.ts` — already on the paper-spec roadmap per CLAUDE.md §9; promote priority
- **Effort estimate:** 4 sprints total (auto-PDF = 0.5, bulk splitter = 2, triage = 1.5).
- **Priority:** **P0** for auto-PDF + triage; **P1** for bulk splitter.

### Step 6. Conditional Logic / Branching (client-side)

**Mechanics:** Help-center articles reference "**Smart, Dynamic Questionnaire**" repeatedly. The "dynamic" qualifier in marketing language implies branching logic. The template editor article (`/template-editor-creating-and-customizing-questionnaire-templates`) references customization options. Help docs reference **"Manage Sections"** and "**conditional**" patterns but do not expose the underlying mechanic publicly.

**UX pattern Soraban uses (inferred):** Question-level "Show If" conditions based on prior answer values. Section-level enablement based on intake type (1040 only is the floor — *"Note: Only 1040 clients are supported; business entities are excluded"* appears across import + export articles, meaning the dynamic logic primarily branches on individual-return facts: filing status, dependents, self-employment, rental income, state).

**Why it's good:** Single template can serve filers across many fact patterns without exposing irrelevant questions. **Marketing handle:** *"dynamic questionnaire"* — but the underlying mechanic is standard skip-logic. Soraban's choice to keep this simple (not Quora-style multi-step decision trees) is craft: simple, performant, easy for firms to author.

**Where in Docket today:** Docket has the 25-step flow with `isApplicable()` per step in `intake-flow.ts` — same primitive. Already implemented. **The gap is firm-authoring of branching rules** — Docket's branching is code-defined, Soraban's is firm-editor-defined.

**Recommended steal:**
- **What to clone:** Expose branching in the Template Editor UI (when the editor itself ships per Step 0). The mechanic is the same; the firm UI to author rules is the diff.
- **Where in Docket codebase:** Part of the Template Editor scope (Step 0 above). Branching rules stored as `jsonb` on each question (`show_if: { question_id, op, value }`).
- **Effort estimate:** +0.5 sprint on the Template Editor work.
- **Priority:** **P0** bundled with Template Editor.

### Step 7. SMS / Email / Voicemail Reminders (the breakthrough mechanic)

**Mechanics:**
- **Default cadence:** every **7 days** between initial send and completion/lock/due-date (`/how-to-change-the-questionnaire-reminder-frequency`).
- **Minimum interval:** 3 days (hard floor — firm cannot reminder more often than 3 days).
- **Auto-stop conditions:** completion, locked, past due-date, or 1 year post-send.
- **Channels:** SMS (from preset number) + Email (always sent by default) + Portal (in-app). **Voicemail bot is the third channel per third-party reviews.** Soraban explicitly: *"auto-remind clients via email, SMS, and virtual messages."*
- **Client-side controls:** Clients can reply STOP to SMS to opt out; clients can change Contact Method to "Email only" in their profile; firm can disable client messaging entirely (`/remove-client-messaging-capability` per firm preferences index).
- **Manual reminders:** Firm can fire a one-off reminder via the Action button or the Messages panel (`/how-to-manually-send-a-one-time-questionnaire-reminder`).
- **Per-client opt-out:** Yes, supported via Contact Method change + per-client manual disable.
- **Default reminder copy:** `/what-are-the-default-messages-associated-with-default-questionnaires` exists but the article returned 404 on direct fetch. **The default messages ARE editable** per `/how-do-i-update-my-questionnaires-messaging` (article body inaccessible but title confirms editability).
- **Twice-Daily Summary** for the FIRM ADMIN (`/twice-daily-summary-notification-morning-and-evening`): two daily emails (morning + evening) covering items occurring between the prior summary. Default is morning-only; the twice-daily mode is opt-in via Soraban support — *"Ask a Soraban team member to enact our Twice Daily Summary Notification."*

**UX pattern Soraban uses:** Reminders are **automatic** by default — no firm-side action required. Firm can adjust the interval via Settings → Customization. Reminders escalate gracefully: SMS first, then email follow-up, then voicemail (escalation pattern inferred from "auto-remind clients via email, SMS, and virtual messages" being the canonical order in marketing copy). Client-facing **Quiet Hours** are NOT explicitly documented; reminders likely fire 9am-7pm in the firm's timezone by default (inferred — no explicit doc found).

**Why it's good:** **Voicemail bot is the killer feature.** Storefront EA clients (Antonio's segment, especially Spanish-speaking and non-tech-native filers) skip SMS, ignore email, but answer the phone. A voicemail in English/Spanish saying *"This is Vazant Consulting. You have a tax document missing — please log in and finish your return"* converts at 3-5x the rate of email. **Soraban appears to be the ONLY player in this segment with a productized voicemail-reminder bot.** Ping/Slant/Black Ore/Accrual all skip it.

**Where in Docket today:** Docket has Reminders substrate spec'd in CLAUDE.md §8 — five canonical triggers (Missing documents / Engagement letter / 8879 / Outstanding balance / Year-round planning), defaults, cadence settings. **Not yet built.** Twilio SMS substrate wired only for OTP. **No voicemail bot.**

**Recommended steal:**
- **What to clone:** All of it.
  - 7-day default cadence with 3-day minimum
  - Triple-channel dispatch (SMS → Email → Voicemail)
  - Client opt-out via reply STOP + Contact Method preference
  - Auto-stop on completion/lock/due-date/1-year-ceiling
  - **Twice-Daily Summary** for the firm (morning + evening operations email)
- **Where in Docket codebase:**
  - Schema: extend the spec'd `reminder_rules` table (CLAUDE.md §8) with `channel_escalation` enum + `voicemail_after_n_attempts` (default 3) + `min_interval_days` (default 3)
  - Inngest cron: `services/workers/src/functions/reminder-cron.ts` (every 15min) — walks `reminder_rules` × `engagement` state, fires due reminders via the channel escalation
  - Voicemail bot: Twilio `<Say>` TwiML — pre-recorded firm-voice template ("This is [firm name] — please complete your tax documents at [short URL]"). Multi-lingual: TwiML's voice attribute supports Spanish (`Polly.Lupe-Neural`).
  - Twice-daily summary: `services/workers/src/functions/firm-daily-summary.ts` — 7am + 6pm cron, sends summary email via React Email
- **Effort estimate:** 3 sprints (cron + escalation = 1.5, voicemail bot = 1, daily summary = 0.5).
- **Priority:** **P0** for voicemail bot; **P1** for full reminder substrate.

### Step 8. Engagement Letter + §7216 + e-signature (client-side, mid-intake)

**Mechanics:** Soraban supports **engagement letter signing inside the questionnaire** (`/how-to-modify-questionnaires-or-engagement-letters-that-were-already-sent`). Signature happens before the substantive questionnaire content or as a discrete step within the flow. The Notifications doc lists *"Engagement letter has been signed in questionnaire (Track Changes only)"* — confirming the e-sign event is captured as an audit-trail entry. **Soraban's Identity Verification is IRS-aligned and NIST-compliant** (the article title `/soraban-identity-verification-irs-aligned-and-nist-compliant` was inaccessible but the title alone tells the story — IRS Pub 1345 + NIST IAL2 references).

**UX pattern Soraban uses:** Engagement letter renders as a scrollable doc inline; client scrolls to read; click "I agree" → typed signature or drawn signature → timestamped. KBA (knowledge-based authentication via credit bureau) is implied by "IRS-aligned" — though Soraban may use a third-party signer (DocuSign or similar) under the hood. **The signing is bundled inside the questionnaire flow**, not delegated to a separate DocuSign session that loses context.

**Why it's good:** **Bundling the engagement letter + §7216 consent inside the intake flow** is the single biggest UX win over generic e-sign tools. The client never breaks out to DocuSign — they're already in the firm's branded portal, they read, they sign, they continue. **Conversion goes up dramatically** when the signature doesn't require a context switch.

**Where in Docket today:** Docket has DocuSign + LexisNexis KBA path planned (per CLAUDE.md §6 L8). Form 8879 mock route at `/portal/sign-8879` gated by feature flag. **Engagement letter + §7216 NOT integrated into the intake flow yet** — they're separate steps in the 25-step flow (steps 22-23: engagement letter + §7216 consent — though the actual implementation is incomplete per CLAUDE.md §18).

**Recommended steal:**
- **What to clone:** **Inline engagement letter + §7216 consent inside the intake flow**, with embedded signature pad. DocuSign-embedded-signing is the v0 implementation; Documenso self-hosted is v1+ per CLAUDE.md §6.
- **Where in Docket codebase:**
  - Already exists in plan — execute the existing roadmap. The Soraban steal is the **UX bundling** (signature happens inside the portal flow, not in a side-channel) and the audit-trail event capture (Track Changes).
  - Audit hook: every signature event INSERTs into `actions` table with `action_type=engagement_letter_signed` + `position_tier=N/A` + `cited_authority=engagement_letter_id`. Substrate exists per CLAUDE.md §18 audit trail.
- **Effort estimate:** Already in Docket's plan; Soraban informs UX bundling. +0.5 sprint to surface the audit-trail entry on the firm's notification feed.
- **Priority:** Already **P0** in Docket roadmap.

### Step 9. Payment / Deposit Collection (client-side, late intake)

**Mechanics:** **Stripe Connect** is Soraban's payment integration (`/stripe-connect-integration`). Firms connect their Stripe account (Standard or Express) via Firm Settings → Integrations → Connect button. Once connected, firms get: **Self-Managed Refunds** (via their Stripe dashboard, not via Soraban), **ACH Payment Visibility** (payer info + amounts), **Customer Name Search** in transactions. Clients pay during the **Deliver** phase (post-return-completion) for the prep fee.

**UX pattern Soraban uses:** Payment step renders as a Stripe Checkout-style page inside the portal. Client enters card / ACH / bank account. Confirmation receipt + audit-trail entry. The Lee & Crowley case study quotes: *"Collect payments and files simultaneously, the firm eliminated outstanding AR"* — implying the payment can be collected in the same session as the intake/delivery, eliminating the "I'll pay later" pattern that creates outstanding AR.

**Why it's good:** Stripe Connect is the **right architectural choice** — money flows directly to the firm's bank account, not through Soraban's escrow. Soraban takes no payment percentage cut. The "simultaneous collection" framing (Lee & Crowley) is a powerful sales story: AR-zero firms.

**Where in Docket today:** **Docket uses Square API** (per CLAUDE.md §6 — locked decision; Antonio already uses Square day-to-day). Stripe is rejected at the L6 level. Different choice. Antonio's $50 deposit is collected via Square Checkout link + webhook (in plan; not yet shipped).

**Recommended steal:**
- **What to clone:** The **"collect payment + docs in the same session"** narrative as the killer Deliver-phase story. *AR-zero* is a marketing handle.
- **DO NOT clone:** Stripe Connect specifically — Docket is on Square per L6.
- **Where in Docket codebase:** Square integration is on the existing roadmap. The Soraban steal is the **case-study narrative**: when Docket onboards customer #3, ask if they'd describe their pre-Docket AR vs post-Docket AR — quote it.
- **Effort estimate:** Zero engineering effort beyond existing roadmap.
- **Priority:** **P1** marketing exercise.

### Step 10. Save-State / Resume (client-side, anywhere in the flow)

**Mechanics:** Soraban auto-saves every field change. Clients can leave and return; the questionnaire reopens at the most recent state. Session timeout (30min) does not lose work — *"Soraban preserves all data, so work in progress is saved automatically."* The client can re-enter via their existing magic link or via the standard sign-in.

**UX pattern Soraban uses:** No explicit "Save" button. No "Resume from step N" branded experience. Just transparent auto-save + auto-resume on sign-in.

**Why it's good:** Zero ceremony. The client never thinks about saving. The 7-day reminder cadence picks up the slack if they abandon for days.

**Where in Docket today:** Docket has `useIntakeField` → `saveIntakeField` server action → Postgres autosave on every field change (per CLAUDE.md §18). Same pattern. ✅ Built.

**Recommended steal:** Already matched. The UX is the same.

### Step 11. Mobile Experience (client-side)

**Mechanics:** Soraban is **mobile-responsive**, not native mobile app. Multiple third-party reviews flag mobile responsiveness as a weak spot (Capterra reviewer Jackson P., May 2023: *"Mobile responsiveness needs improvement (noted as actively being addressed)"*; Taxhance review: *"Poor mobile experience"*). The platform is **desktop-first by design** — firms operate from desktop; clients are expected to use desktop for serious filings.

**UX pattern Soraban uses:** Standard Webflow responsive breakpoints (the CSS shows `<479px`, `<767px`, `<991px`, default). The mobile breakpoint reflows but does not deeply restructure. Form inputs at `13.33rem` height on mobile (~48px — touch-friendly), text scales up via `rem` system.

**Why it's good:** It's not. Soraban's mobile is its weakest surface. This is a structural **opportunity for Docket**.

**Where in Docket today:** Docket portal is **mobile-first (390×780 iOS viewport per CLAUDE.md §4)**. The intake flow is engineered for thumb-reach. This is one of Docket's structural advantages.

**Recommended steal:** **DO NOT clone Soraban's mobile.** Docket should pitch *"Built mobile-first because your clients fill returns on their phone in line at Costco, not at a desk"* as a structural differentiator vs Soraban. Marketing handle.

### Step 12. Per-Firm White-Label Customization Knobs

**Mechanics — every config knob Soraban exposes:**

| Knob | What it does |
|---|---|
| **Custom Portal URL (CNAME)** | Firm's clients see `portal.yourfirm.com` instead of `app.soraban.com`. Setup via Customer Success Manager (NOT self-serve). Login creds + bookmarks transferable. |
| **Custom Favicon** | The small browser-tab icon. Firm-uploadable. |
| **Portal Colors + Logo** | Theme color tokens replaceable. Firm logo replaces Soraban wordmark in the portal header. |
| **Profile Photo** | Each FIRM USER (preparer/admin) uploads their own photo, visible to assigned clients in the portal. |
| **Custom Buttons** | Firm-wide or per-entity buttons on the client dashboard that link to firm's scheduling tool, payment portal, or website. |
| **Welcome Message** | (Implied — per articles referenced but not directly accessible.) Firm authors a welcome paragraph shown on first-portal-login. |
| **Firm-Internal Statuses** | Firm-authored workflow statuses (beyond Soraban's defaults). |
| **Customized File Path** | Document path pattern (e.g., `{year}/{client_id}/intake/{doc_type}.pdf`) for downstream storage organization. |
| **Portal Folder Structure** | Firm-authored hierarchical folders for client docs. |
| **Firm Glossary** | Tooltip definitions for jargon terms — case-insensitive matching, hover/tap to reveal. |
| **Firm Groups** | Team organization structure (segments staff into groups for assignments). |
| **Customized Words (Variables)** | Replace standard Soraban terminology with the firm's preferred wording (e.g., "Tax Organizer" instead of "Questionnaire"). |
| **Customize Questionnaire Export Text Colors** | The exported PDF/bookmarked workpaper's text styling. |
| **Custom Domain Email Sender** | Implied — outbound email comes from the firm's domain, not @soraban.com. |
| **Remove Inbox / Documents Section** | Firms can hide specific portal sections from clients. |
| **Twice-Daily Summary Notification** | Firm admin gets two daily emails (morning + evening) instead of just morning. |
| **Disable Client Messaging Capability** | Firm can disable client-to-firm messages entirely. |
| **Engagement Letter In-Questionnaire** | The engagement letter can be embedded as a step within the questionnaire flow. |

**UX pattern Soraban uses:** Firm-level settings under **Firm Settings → Customization** tab. Some settings (CNAME, glossy white-label) require firm to email support; most are self-serve via Settings UI.

**Why it's good:** **The white-label depth is the moat against TaxDome / Canopy / Karbon.** Soraban's customization surface is 2-3x richer than competitors' at this price point. The **Customized Words** primitive is especially clever — let a firm rename "Questionnaire" to "Tax Organizer" and the entire UX adapts.

**Where in Docket today:** Per CLAUDE.md §4 + L11 + §18:
- Per-firm Twilio sender — substrate exists in `tenant_credentials`; UI gap.
- Custom client-portal subdomain — V1.5 (post-7/30; tenant #2 onboarding gate).
- Firm logo, color tokens, Welcome screen copy — designed; not all shipped.
- Custom branding settings — `Settings → Client Experience` is planned in CLAUDE.md §4 but routes don't exist yet (sidebar dead links).

**Recommended steal:**
- **What to clone:** **All of the above**, in this priority order:
  1. **Custom Portal URL via CNAME** (`portal.vazantconsulting.com` → Docket portal). Single highest-leverage move for tenant #2.
  2. **Firm logo + theme color tokens** in Settings → Branding.
  3. **Custom Buttons** on portal dashboard.
  4. **Customized Words (Variables)** — let firms rename "Intake" to whatever they call it ("Tax Organizer" / "Onboarding").
  5. **Firm Glossary** for in-intake jargon tooltips.
  6. **Firm-Internal Statuses** beyond Docket's default `engagement` state machine.
  7. **Twice-Daily Summary** for firm admin (morning + evening operations email).
  8. **Welcome Message** customizable on portal Home tab.
- **Where in Docket codebase:**
  - Substrate: `packages/db/src/schema/tenant_branding.ts` (logo_url, theme_color_oklch, custom_subdomain, custom_words_jsonb, welcome_md, twice_daily_summary boolean)
  - UI: `apps/command-room/src/app/settings/branding/page.tsx` + sub-pages
  - Multi-tenant routing: middleware reads request hostname, resolves to tenant via `tenant_branding.custom_subdomain` lookup, sets `app.current_tenant_id`
  - Glossary lookup: tooltip primitive in `packages/ui/src/components/GlossaryTooltip.tsx`
- **Effort estimate:** 4 sprints to ship all 8 knobs.
- **Priority:** **P0** for #1 (CNAME — blocks tenant #2). **P1** for #2-5. **P2** for #6-8.

### Step 13. Time-to-Complete (client-side metric)

**Mechanics:** Not publicly disclosed by Soraban. Inferred from case studies + reviews: a 1040 questionnaire takes a returning client **15-30 minutes** to complete (versus 1-2 hours for prior paper-organizer flows). The 7-day reminder cadence assumes most clients take 1-3 weeks to fully complete (with the "Upload Later" pattern letting them submit before they have all docs).

**Where in Docket today:** Docket's 25-step intake is engineered for ~12-15 minutes (per CLAUDE.md §4 portal welcome copy: *"~12 minutes"*). Faster than Soraban — Docket is structurally better here.

**Recommended steal:** **Docket is winning on time-to-complete already.** Marketing handle: *"Docket intake: 12 minutes. Soraban intake: 30 minutes. Paper organizer: 2 hours."*

---

## 3. The Legacy Tool Integration UX (the other load-bearing piece)

**Each tax software is a different UX shape.** Reconstructed from help-center articles.

### 3.1 Lacerte (Intuit) — Individual returns

**Firm-side onboarding UX:**
- **Part 1 — Generate Client List inside Lacerte:**
  1. Open Lacerte → log in
  2. Press `F3` keyboard shortcut → select "All clients" → OK
  3. Clients dropdown → Export → "Export to File"
  4. Browse → save to Desktop
  5. Rename to `"Soraban Client List"`
  6. Verify required fields are in order: Client Number, Taxpayer First Name, Taxpayer Last Name, Title/Suffix, Email, Mobile Phone, Spouse First Name + Last Name + Title + Email + Mobile, Street, Apt, City, State, Zip
  7. Click OK to export

- **Part 2 — Upload to Soraban:**
  1. Navigate to Users or Entities → click Import
  2. Select "Client List"
  3. Client List Type = Individuals
  4. Method = Lacerte
  5. Next → choose file → Next
  6. Review for missing columns + rows
  7. Click "Rows with issues" to resolve duplicate emails (mark "Is Primary")
  8. Remove duplicate emails between taxpayer + spouse
  9. Import
  10. **Email confirmation upon completion**

**SLA / timing communicated:** Email arrives upon completion (no specific hour-count given for Lacerte client-list import; likely near-immediate since it's a CSV parse, not OCR).

**Error handling UX:** "Rows with issues" surface — Soraban flags duplicate emails (common when taxpayer + spouse share email). Firm marks one as Primary; the other is removed/marked secondary. This is THE most common import error and Soraban handles it inline.

**Outbound (Connect BETA) UX:** Not documented for Lacerte specifically. Lacerte is listed as an export target for the Connect module's data-export step but the exact mechanic is not in the public help center.

### 3.2 Drake — Prior-year data

**Firm-side onboarding UX:** (Article inaccessible at fetch time; pattern reconstructed from other software).
Likely shape: export `.dz` archive from Drake → upload zipped file to Soraban → 3-5 business day batch processing → email confirmation when ready.

### 3.3 UltraTax (Thomson Reuters)

**Firm-side onboarding UX:** (Article inaccessible at fetch time; same SLA pattern as CCH Axcess).

### 3.4 CCH Axcess (Wolters Kluwer)

**Firm-side onboarding UX:**
- **Prerequisites:** *"Make sure returns are not password-protected or have other export restrictions."* Applies to **1040 clients only**.
- **Part 1 — Standard Export (in Return Manager):**
  1. Click Filter icon
  2. Select prior tax year from dropdown (2024 for 2025 returns)
  3. Return Type dropdown → "1040 Individual"
  4. Click checkbox to select all returns
  5. Utilities → Export
  6. Choose "Returns selected in Return Manager"
  7. Select "Include input data" → click export
  8. Click Finish

- **Part 2 — Download Export File:**
  9. Click Dashboard icon (top-left)
  10. Click Application Links
  11. Click Batch Manager
  12. Click "Refresh Job Status" if file doesn't appear
  13. Review exceptions (most common cause: password-protected returns)
  14. Click "Ready for Download"
  15. Choose location, filename, Save

- **Part 3 — Alternative Method** (if standard fails):
  - Use Utilities → "Transfer to ProSystem fx"
  - Enter Office Group name
  - Optionally update file location
  - Click Transfer
  - Review Return Transfer Report

- **Part 4 — Upload to Soraban:**
  1. Navigate to User or Entities → click Import
  2. Select "PYD/Rollover Items"
  3. Select "Axcess Tax Export"
  4. Select tax year → Next
  5. Choose exported file → Next
  6. **Await email confirmation (2-3 business days)**

**SLA / timing communicated:** *"2-3 business days"* explicit. **Files > 150MB must be split into multiple zipped folders** — this is a firm-side responsibility, not Soraban-side handled.

**Error handling UX:** Soraban surfaces an "exceptions" list during the export step in CCH. Password-protected returns are the most common error. The firm-side fix is unlocking those returns before re-exporting. Soraban then processes the cleaned export.

### 3.5 ProConnect (Intuit) — THE CREDENTIAL-SHARE HACK

**Firm-side onboarding UX:**
- **Step 1: Access User Management**
  1. ProConnect → Settings → "Manage & invite users"

- **Step 2: Add New User**
  2. Click "Add user"
  3. **First Name:** `Soraban`
  4. **Last Name:** `Team`
  5. **Email Address:** `hello@soraban.com`

- **Step 3: Assign Role**
  6. Dropdown under "Assign roles" → `Standard all access`

- **Step 4: Grant Access to All Clients**
  7. Scroll to "Access to clients" section
  8. Check "Edit client access" checkbox
  9. Check top-level checkbox to grant access to ALL clients

- **Step 5: Send Invite**
  10. Click "Send invite"
  11. Confirmation message appears

**SLA / timing communicated:** *"After You Send the Invite — Your Part Is Complete."* No further firm action. Soraban Team logs in as a user inside the firm's ProConnect account and runs the export themselves.

**THIS IS THE HACK.** Soraban literally has the firm **add `hello@soraban.com` as a user with all-client access** inside their ProConnect account. The Soraban team then logs into the firm's ProConnect as that shared user and runs the prior-year-data export from inside. This is **deeply non-standard** and would not pass enterprise security review. But it works for small/mid firms who don't have such review.

**Restriction caveat noted in the doc:** Return-level restrictions may prevent some clients from appearing in exports → may require manual worksheet creation. Scope: **1040 clients only**.

### 3.6 ProSeries — Prior-year data

**Firm-side onboarding UX:** (Article not surfaced in search; ProSeries is listed as integration partner on the homepage and as an export target).

### 3.7 TaxSlayer Pro

**Firm-side onboarding UX:**
- **Export Steps in TaxSlayer Pro:**
  1. Select "Print" from the right panel
  2. Click "Print Organizer"
  3. Click "Currently using data from tax year:" line → set to prior year (2023 for 2024 returns)
  4. "Mask SSN(s) on the Organizer" → toggle to "No" (type 6) to show full SSNs
  5. Choose organizer option: **"Print Organizer for Selected Clients" (recommended in batches of 10-20)**, or "Marked to Print", or "All Clients"
  6. Select "Complete Organizer with [Tax Year] Year Data"
  7. **Print organizers to PDF and zip the file**

- **Upload to Soraban:**
  1. Users/Entities page → click Import icon
  2. Select "PYD/Rollover Items"
  3. Click "Show other methods" → select "Other" from Tax Software dropdown
  4. Select tax year → Next
  5. Choose file → Next
  6. **Await email notification (3-5 business days)**

**SLA / timing communicated:** *"Processing takes 3-5 business days."* For TaxSlayer specifically, the export is **PDF organizers** (not a structured data file), so Soraban must run OCR + classification on the receiving end — hence the longer SLA.

**Scope:** **1040 clients only.**

### 3.8 CCH Scan + AutoFlow Export (the Connect-module piggyback)

**Firm-side onboarding UX:**
- **Purpose:** Bundle source documents + target sheets into a single bulk PDF, converting all images to PDF for **CCH Scan and AutoFlow** processing.
- **Setup:**
  1. Firm Settings → Integrations & Connect → Manage Target Sheets
  2. Upload target sheets
  3. (Limitation: "We currently don't support 'Force Classification' targetsheets")
- **Export Process:** Export questionnaire → select "Scan and AutoFlow" option from formats
- **Enablement gate:** *"Reach out to your Soraban rep or support team members to help enable it for you."*

**WHAT THIS IS:** Soraban exports its questionnaire data + uploaded docs in a format that CCH Scan and AutoFlow (Wolters Kluwer's existing OCR + data-pump-to-tax-software product) can ingest. Soraban doesn't compete with CCH AutoFlow; it **piggybacks** on it. Firms that use CCH Axcess + CCH Scan/AutoFlow already pay for that downstream pipeline; Soraban replaces the doc-chasing front-end and hands the cleaned bundle to CCH's existing pipe.

**SLA / timing:** Once the bundle is exported, CCH AutoFlow's processing kicks in — same timeline as the firm's normal CCH AutoFlow workflow (typically same-day for small returns). Soraban's own contribution is the questionnaire + doc-organization layer.

### Common patterns across all tax-software imports

1. **1040-only scope.** Every per-software article notes *"1040 clients only"* or similar. Soraban does NOT handle business entities (1120, 1120-S, 1065). This is a deliberate scope limit and one of their largest structural gaps for mid-market firms.

2. **2-5 business day batch SLA.** Imports are NOT real-time. Soraban operates a back-office processing queue. The firm-side UX is fire-and-wait-for-email. Capterra reviewer Cliff S. flagged the absence of phone support; the email-only async model extends to imports.

3. **"Rows with issues" inline error UX.** When the import has problems (duplicate emails, missing required columns, password-locked returns), Soraban surfaces a per-row error list inline. Firm fixes inline → re-imports.

4. **Email confirmation upon completion.** Every import completes with an outbound email to the firm admin. Notification Bell also receives the event.

5. **File size constraint: 150MB cap per upload.** Larger uploads must be zipped + split. Self-service responsibility.

**Recommended steal for the per-software import UX:**

For EACH tax software Docket integrates with (via browser automation MCP per CLAUDE.md §10 — OLT first, then Drake/Lacerte/UltraTax/CCH Axcess/ProConnect/ProSeries):

- **What to clone:**
  1. The **step-by-step help article format** with numbered steps + screenshots. Verbatim shape: "Part 1: Export from {Software}. Part 2: Upload to Docket."
  2. The **"Rows with issues" inline error resolution UX** at import time.
  3. The **explicit SLA messaging** ("Processing takes 2-5 business days for prior-year data; 30 seconds for client lists").
  4. The **email confirmation pattern** when async jobs complete.
- **Where in Docket codebase:**
  - Help articles: `apps/marketing/src/app/help/imports/[software]/page.tsx` + `content/help/imports/{lacerte,drake,ultratax,cch-axcess,proconnect,proseries}.mdx`
  - Import UI: `apps/command-room/src/app/imports/page.tsx` — wizard with software picker → file upload → row-issue resolver → submit
  - Schema: `packages/db/src/schema/import_jobs.ts` — `tenant_id`, `software`, `file_url`, `status` (queued/processing/needs_review/done/failed), `error_rows jsonb`, `created_at`, `completed_at`
  - Inngest function: `services/workers/src/functions/process-import-job.ts` — parses CSV/PDF/zip; emits per-row events for triage
  - Email notification: React Email template "Your {software} import is complete."
- **Effort estimate:** 6 sprints total (3 for the substrate + 0.5 per software for the help article + import path).
- **Priority:** **P0** for Lacerte + OLT (Antonio's stack). **P1** for Drake/UltraTax. **P2** for CCH Axcess + ProConnect + ProSeries.

**DO NOT clone:**
1. **The ProConnect credential-share hack.** Adding `hello@docket.com` as a Standard-all-access user inside the firm's ProConnect account is a **security anti-pattern** that fails SOC 2 review and creates legal exposure. Docket should refuse this approach. Build a proper OAuth/API integration or use browser automation under per-tenant credentials, NOT a shared mailbox user. This is a **clear ethics + security line.**
2. **The 2-5 day SLA.** For client-list imports (CSV parse), Docket should ship in <60 seconds. For prior-year-data imports (OCR), Docket should target <4 hours. The "2-5 business days" framing is a competitive opportunity, not a pattern to copy.
3. **1040-only scope.** Docket should ship 1040 + 1120-S + 1120 + 1065 from v1. Soraban's 1040-only floor is a strategic choice (for them) and a structural gap (for us to fill).

---

## 4. The "Connect" OCR + Push-to-Legacy UX (the BETA module)

**Mechanics:** **Connect is in BETA with 97% accuracy** (per multiple third-party reviews). Connect takes the source documents the client uploaded + extracts data via AI vision → outputs structured data that's pushed (via the export step) into the firm's tax software.

**What it auto-extracts:** Source documents like W-2, 1099-NEC, 1099-MISC, 1099-DIV, 1099-INT, K-1, brokerage statements, 1098 (mortgage interest), 1095 (health insurance), and others. *"Lead sheet and other information for K1s and 1099s"* is named in the podcast review. Hosts describe Connect as automating "lead sheet and other information for K1s and 1099-9s."

**Review surface UX:** Firm reviews the AI-extracted data inline before push-to-tax-software. Help article `/how-does-the-scan-and-autoflow-questionnaire-export-work` mentions "target sheets" — Soraban maps extracted form data to user-uploaded "target sheet" templates so the output exactly matches the firm's preferred tax-software import format. **The firm reviews via a one-step review process** (per the homepage tile: *"One-step Review Process — Work with a flow that simplifies the entire tax return review process."*).

**97% / 3% error UI — how needs-human-review is surfaced:** Not publicly documented. Inferred: confidence scores per extracted field. Below threshold → flagged for human review with the source document inline + the extracted value + a quick correction inline. Above threshold → green-checkmarked. **The pattern parallels how Notion AI / Loop AI surface "needs review" — inline confidence indicator.**

**Output formats:**
- **Direct push to tax software:** Soraban claims integration with ProSeries, Lacerte, Drake, ATX, TaxWise, UltraTax. *"How to Import Forms from Soraban to ProConnect"* article exists. The push mechanic is via the bookmarked PDF + CCH Scan/AutoFlow piggyback for CCH stack; via direct file format for Drake/Lacerte.
- **Bookmarked PDF export:** The "Scan and AutoFlow" export bundles all client docs + classification metadata into a single PDF that CCH's downstream tool can ingest.

**Where in Docket today:** Document classification AGENT is paper-spec only (CLAUDE.md §9 Document Triage agent — designed, not built). No push-to-tax-software pipe. OLT is the priority browser-automation target (M2+); Drake/Lacerte/UltraTax/CCH defer to V1.5+.

**Recommended steal:**
- **What to clone:**
  1. The **"target sheet" primitive** — firm uploads their preferred classification schema (e.g., the lead-sheet they hand to the preparer) and the AI maps extracted data to those fields.
  2. The **one-step inline review surface** — firm sees source doc + extracted value + confidence + correction-on-hover.
  3. The **confidence-tier color coding** (green=auto-accepted, amber=needs glance, red=needs full review).
- **Where in Docket codebase:**
  - Schema: `packages/db/src/schema/firm_target_sheets.ts` (tenant_id, name, schema_jsonb)
  - Agent: `services/workers/src/agents/form-extractor.ts` + per-form-type sub-agents (`w2-extractor.ts`, `k1-extractor.ts`, etc.)
  - Review UI: `apps/command-room/src/app/clients/[id]/extracted-forms/page.tsx` — split-view source doc + structured fields
  - Push pipeline: `services/workers/src/functions/push-to-tax-software.ts` — dispatches per-software writers (OLT, Drake, Lacerte, etc.)
- **Effort estimate:** 6 sprints total for the full chain. **3 sprints** for v0 (W-2 + 1099-NEC + 1099-MISC only, OLT push only, no target sheets).
- **Priority:** **P1** v1.5. The 97% / 3% framing is the marketing handle Docket should adopt: *"Docket's vision pipeline extracts every W-2, 1099, and K-1 with 99%+ accuracy and a one-glance review surface — the 1% that needs review is flagged in amber with the source document side-by-side."*

---

## 5. The "Deliver" Module (e-sign + Stripe + delivery portal)

**Mechanics:** Deliver is the post-prep phase. Once the firm has the return prepared (in OLT/Drake/Lacerte/etc.), Soraban delivers the **assembled tax return package** to the client via the same portal where intake happened.

**Preparer-side UX:**
1. Firm uploads the prepared return PDF (output from their tax software) into the client's record in Soraban.
2. Firm queues the delivery — assigns e-sign requirements (Form 8879 + any state-equivalents), payment terms, and any final notes.
3. Soraban dispatches notification to client (SMS + email + portal).

**Client-side UX:**
1. Client receives notification: *"Your tax return is ready for review and signature."*
2. Client signs in (existing portal session).
3. Client sees the return PDF inline, scrolls through.
4. Client signs the 8879 inline (e-sign, with KBA per IRS Pub 1345 — Soraban explicitly compliant per *"IRS-Aligned and NIST-Compliant"* identity verification).
5. Client pays via Stripe (if firm has Stripe Connect integration).
6. Confirmation + receipt + downloadable signed return.

**Audit-trail event capture:**
- *"Client has finished signing the Tax Return"* — firm admin notification (per `/what-are-the-types-of-notifications`)
- *"Signature Request is ready for review"* — pre-flight notification before client receives
- *"Client has signed up through Questionnaire Template Link"* — onboarding event
- *"Engagement letter has been signed in questionnaire"* — mid-flow event

**Streamlined Workflow** tile (homepage): *"Automate the tedious tasks of sending tax returns."* — frames the delivery step as a multi-task burden that Soraban collapses.

**Where in Docket today:** Docket's portal `Signatures` tab + 8879 sign flow is designed (per CLAUDE.md §4). DocuSign embedded signing planned (per L8). Mock route exists. **Full Deliver workflow as a coherent surface is NOT built.**

**Recommended steal:**
- **What to clone:** **The named "Deliver" phase as a top-level workflow primitive.** Docket should structure the firm-side and client-side UX around three named phases: **Intake → Operate → Deliver** (or analogous; *"Operate"* per Docket's L2 *"the agentic operator"* framing). Marketing this trio gives buyers a 3-second mental model.
- **Where in Docket codebase:**
  - Phase markers on `engagement` state machine: `phase: 'intake' | 'operate' | 'deliver' | 'closed'`
  - UI nav: command-room sidebar grouped by phase; portal Home tab status copy aware of phase
  - Marketing homepage: three-phase walkthrough mimicking Soraban's three-phase tile layout
- **Effort estimate:** 0.5 sprint to add phase markers + nav grouping; 1 sprint for marketing-page treatment.
- **Priority:** **P0** for marketing surface; **P2** for product nav restructure.

---

## 6. Per-Firm Customization Surfaces

**Already enumerated in detail in Section 2 Step 12.** Recap of what Soraban exposes vs. what Docket plans:

| Customization | Soraban | Docket (planned per CLAUDE.md §4) | Gap |
|---|---|---|---|
| Custom subdomain (CNAME) | Yes (Customer Success Manager-mediated) | Yes (V1.5) | Match planned; not yet shipped |
| Favicon | Yes | Implied via branding settings | Not explicitly planned |
| Portal colors | Yes | Yes (within token constraints per L11) | Match |
| Logo upload | Yes | Yes | Match |
| User profile photo | Yes | Yes (via Clerk imageUrl, lazy-backfilled) | Match |
| Custom buttons on dashboard | Yes (firm-wide + per-entity) | Not planned | **Gap** |
| Welcome message customization | Yes (implied) | Yes (per stage-status copy) | Match |
| Firm-internal statuses | Yes | Yes (per `engagement` state machine) | Match |
| Customized file path | Yes | Implied via R2 path conventions | Less surfaced |
| Portal folder structure | Yes (firm-authored) | Designed (Documents tab two-tabbed: Client docs + Firm files) | Match |
| Firm Glossary (tooltips on jargon) | Yes | Not planned | **Gap** |
| Firm Groups (team segmentation) | Yes | Partially (Clerk Organizations) | Match |
| Customized Words (Variables) | Yes | Not planned | **Gap** |
| Custom export text colors | Yes | Not planned | Low-priority gap |
| Custom domain email sender | Implied | Yes (firm's own Gmail via OAuth per L10) | **Match — Docket is structurally better here** |
| Remove inbox/documents sections | Yes | Not planned | Low-priority gap |
| Twice-daily summary | Yes (opt-in) | Implied via Notifications spec | **Gap** |
| Disable client messaging | Yes | Not planned | Low-priority gap |
| Engagement letter in-questionnaire | Yes | Designed (steps 22-23 in 25-step flow) | Match |
| Per-firm video upload (portal videos) | Implied via Loom-iframe-embedding | Yes (CLAUDE.md §4: five video portal touchpoints) | **Match — Docket structurally better with stage-aware video** |
| Refund policy field | Yes (firm sets policy displayed at checkout) | Yes (tenant_settings.refund_policy_md per CLAUDE.md §8) | Match |

**Net assessment:** Soraban has **3-4 customization knobs Docket doesn't plan**: Custom Buttons on dashboard, Firm Glossary (tooltips on jargon), Customized Words (variable replacement), and Twice-Daily Summary cadence. These should all be added to Docket's `Settings → Customization` roadmap.

**Docket structurally wins on:**
- **Stage-aware video touchpoints** (5 distinct firm-recorded videos per stage vs Soraban's section-level embedded video)
- **Custom domain email sender via firm's own Gmail OAuth** (vs Soraban's implied @soraban-mediated email — Docket sender brand is the firm itself per L10)
- **Mobile-first portal** (per CLAUDE.md §11 vs Soraban's flagged-weak mobile)

---

## 7. Reminders / Automated Communication

**Already enumerated in Section 2 Step 7.** Recap:

| Element | Soraban | Docket (planned) |
|---|---|---|
| Default cadence | 7 days between auto-reminders | 3 days for missing docs / 2 days engagement letter / 24h for 8879 (per CLAUDE.md §8) |
| Minimum interval | 3 days (hard floor) | Not specified; should add `min_interval_days` |
| Channels | SMS + Email + Voicemail (triple) | SMS + Email (per spec); **NO voicemail** |
| SMS opt-out | Reply STOP | Twilio standard; should add explicit opt-out tracking |
| Auto-stop | Completion + lock + past due + 1-year ceiling | Per `engagement` state machine; ceiling not specified |
| Manual one-off | Yes (Action button + Messages) | Not planned |
| Quiet hours | Not documented (likely default 9am-7pm firm-local) | Yes (per AI Preferences in CLAUDE.md §8) |
| Voicemail script | Per-firm customizable (implied) | Not planned |
| Twice-daily admin summary | Yes (opt-in via support) | Not planned |

**Recommended Docket adds (priority order):**
1. **Voicemail bot** (P0 — single biggest comms-layer moat opportunity)
2. **Manual one-off reminder fire** (Action button on engagement page — P1)
3. **Twice-daily admin summary email** (P1 — operational habit-former)
4. **`min_interval_days` floor in `reminder_rules`** (P2 — prevents firm-mistake spam)
5. **Reply STOP tracking** + `sms_opt_out` boolean per client (P1)

---

## 8. Document Auto-Classification + Workpaper Generation

**What docs get auto-classified:** Per third-party reviews + help docs:
- W-2
- 1099-NEC, 1099-MISC, 1099-DIV, 1099-INT, 1099-B, 1099-R
- K-1
- 1098 (mortgage interest), 1098-E (student loan), 1098-T (tuition)
- 1095-A/B/C (health insurance)
- Brokerage statements (Schedule D source docs)
- Charitable contribution receipts
- Property tax statements

**Bookmarked workpaper PDF format:**
- **Scan and AutoFlow** export bundles source docs + target sheet (firm-authored classification schema) into a single PDF
- PDF is **bookmarked by form type** — each form is a chapter in the PDF with its own bookmark for navigation in Adobe / Foxit
- **Unanswered questions are flagged "Unanswered"** in the export
- **"Upload Later"** items are listed as missing in the export
- **Lead sheet generation** — Soraban's Connect module produces lead sheets ("lead sheet and other information for K1s and 1099-9s" per podcast review)

**Error correction UX:** Document Triage (`/document-triage-from-upload-to-the-right-questionnaire`) — when classification confidence is low, Soraban surfaces a "needs review" prompt to the firm. Firm clicks to expand → sees source doc + AI's best guess + dropdown for manual correction. Bulk Upload Processor surfaces "Bulk Document Requires Splitting" notification when a multi-form PDF needs manual splitting (the AI couldn't auto-split).

**Where in Docket today:** Per CLAUDE.md §9: Document Triage agent designed but NOT built. Per `docs/DOCS-CAPTURE-PIPELINE.md` (referenced but full content not in scope): 4-phase pipeline (empty → AI scanning → retake → AI parsed → saved).

**Recommended steal:**
- **What to clone:**
  1. **Bookmarked PDF workpaper export** (chapter-per-form-type) as a Docket primitive. Firm uses for their internal records + as backup-to-tax-software.
  2. **Lead sheet generation** as a separate report (high-touch firms want a 1-page summary of all extracted income/deductions before they open the tax software).
  3. **Per-form-type confidence tiers** with inline correction UX. Same shape as Connect.
  4. **"Upload Later" / "Unanswered" flagged-in-export** for transparency.
- **Where in Docket codebase:**
  - Agent: `services/workers/src/agents/document-triage.ts` (existing paper spec — promote priority)
  - Workpaper builder: `services/workers/src/functions/build-workpaper-pdf.ts` — uses pdf-lib to bookmark by classification, chapters per form-type
  - Lead sheet: `services/workers/src/functions/build-lead-sheet.ts` — renders to PDF via React PDF; one-page summary
  - Correction UI: `apps/command-room/src/app/clients/[id]/documents/[doc_id]/review/page.tsx`
- **Effort estimate:** 4 sprints.
- **Priority:** **P1** v1.5 (after intake template editor is in place).

---

## 9. Pricing Page UX

**Soraban does NOT publish a pricing page.** The `/pricing` URL returns 404. All pricing info is sourced from third-party reviews (Capterra, Taxhance, Genwise, podcast reviews, CPA Practice Advisor) and the founder's own posts. **This is a deliberate choice** — sales contact-gated. Buyers must request a demo to learn pricing.

**Tier structure (reconstructed from third-party sources):**
- **Collect only:** $25/return
- **Deliver only:** $20/return
- **Both (Collect + Deliver):** $40/return
- **Connect (BETA):** $30/return (300-return minimum)
- **Minimum:** 50 returns (Collect-Deliver floor); 300 returns (Connect floor)
- **Enterprise:** Custom pricing for 150+ returns

**Pricing model:** Per-return metered. Linear scaling. **No per-seat, no flat monthly base.** A 750-return firm using Collect+Deliver pays $30K/year. A 1,000-return firm pays $40K/year.

**Contact-sales CTA pattern:** Every CTA on the site is *"Let's Chat"* or *"Request a Demo"* or *"Register Now"* (for the weekly webinar). No "Start Free Trial." No "Sign Up." **Sales-gated entirely.**

**Where in Docket today:** Pricing is per-active-client metered (per CLAUDE.md §6 L6). Founder tier $250/mo. Standard tiers $499 / $1,499 / $4,499 / $14,999. Add-ons per agent ($199-$299). **Public, transparent pricing** is the explicit choice per L6.

**Recommended steal:**
- **DO NOT clone:** Soraban's contact-sales-gated pricing. Docket's L6 commits to **public transparent pricing**. The Slant-style "no surprise pricing" frame is the right one. Marketing handle: *"We publish our pricing. Soraban won't."*
- **DO learn from:**
  1. The **per-return** framing is what gives Soraban its sticker shock at scale ($30K-$40K for a 750-return firm). Docket's **per-active-client** metering is structurally better — a firm scaling clients without scaling returns (year-round advisory + planning + audit defense + notice response = recurring revenue per client, not seasonal-spike) pays less per dollar of value delivered.
  2. The **enterprise custom-pricing for 150+ returns** primitive is a real thing in the segment. Docket should have an enterprise tier *"by quote"* for firms above the top standard tier.
- **Where in Docket codebase:**
  - Pricing page: `apps/marketing/src/app/pricing/page.tsx` — three-tier card + add-on rows + per-active-client meter calculator + "Talk to Sales" CTA for enterprise
  - Per CLAUDE.md §15 / `docs/PRICING-PAGE-SPEC.md` referenced as canonical
- **Effort estimate:** Already in roadmap.
- **Priority:** **P0** marketing surface.

---

## 10. Marketing Site Patterns

**Hero pattern:**
- **Centered, no product screenshot.** Just headline + subhead + CTA. Generous whitespace.
- Headline = volume-/capacity-anchored (*"Get More 1040s Out the Door"*). NOT technology-anchored.
- Subhead names the three phases: *"intake, data entry, and delivery."*
- CTA = lime "Let's Chat" + secondary blue "See it in Action."
- Below CTA: investor logo cluster (YC, Altos, Village Global, PHX Ventures).

**Case study format:**
- Single-page per firm: `/case-studies/{firm-slug}`. Most URLs 404'd on direct fetch (likely behind nav or paywall) but the firm names + headline metrics are extractable from the listing page.
- Format per case study: **Firm details (name, # returns, tax software) → Prior process (before Soraban) → Key quote (single sentence) → Changes (3-5 bullets) → Workflow impact paragraph → Additional quote.**
- Quantified impact named in headline (*"750 annual returns"* / *"89% client adoption"* / *"700 returns + AR eliminated"* / *"1,200 returns + nearly doubled volume"*).

**Testimonial format:**
- **Carousel + headshot + firm logo + headline + body quote.**
- The single best testimonial on the entire site: **Nadine Julson, CPA — *"Soraban allowed me to take two vacations with my family during tax season."*** Outcome-specific. Family-anchored. Reads as authentically grateful, not marketing-curated.
- Brandon Hall (Hall CPA PLLC) appears multiple times with different headlines — likely sourced from multiple separate quotes vs. one long testimonial chopped up.

**Blog cadence:**
- **Renamed "Perspective"** in the December 2025 rebrand.
- Monthly cadence with multi-month gaps. 6 posts visible from Apr 2025 → Mar 2026 = **~1 post/month**.
- **Two primary authors:** Jenna Bayler (marketing/operations voice — "leadership," "burnout," "AI vetting") and Enoch Ko (founder voice — rebrand announcement, occasional Series A).
- **Voice:** Professional CPA-firm-owner pitch. Less builder-casual than Ping. Less editorial than Docket. Anchored in **dollar-and-hour specifics** ("20-30 minutes per return", "40-60% unbillable", "$36K saved per practitioner").
- **Newsletter:** "The Brass Tax" — *"A monthly newsletter for accounting leaders who don't need more tax headlines. They need clarity on what to do next."*
- **Lead magnets:** "AI Vetting Checklist" downloadable PDF (December 19, 2025 post).
- **Stake-in-the-ground posts:** "Stop Falling for the AI Illusion" (December 11, 2025) is a competitor-vetting frame disguised as a helpful checklist. Three categories of AI: *cosmetic*, *human-powered*, *actual*. Without naming names, it positions Soraban as the third while implicitly painting competitors as the first two.

**Recommended steal — Docket's blog:**
- **Voice:** Add **dollar-and-hour anchored economic writing** to Docket's blog cadence. Antonio's framing of "Year-2 ARR" / "PTIN penalty exposure" / "$36K junior preparer salary saved" is structurally similar to Soraban's "20-30 minutes per return" / "60% unbillable" pattern.
- **Lead magnet:** Ship a **"Compliance-First AI Checklist"** as Docket's equivalent — same downloadable format, framed around position-framework rigor ("How to vet whether your AI tool will protect your PTIN, not put it at risk").
- **Stake-in-the-ground post:** *"Why we refused to ship an AI that auto-files tax positions"* — the refusal-floor moment as a marketing weapon. Same shape as Soraban's "AI Illusion" post.
- **Where in Docket codebase:**
  - Blog: `apps/marketing/src/app/blog/[slug]/page.tsx` + `content/blog/*.mdx`
  - Newsletter signup: `apps/marketing/src/app/_components/NewsletterSignup.tsx`
  - Lead magnet: `apps/marketing/public/lead-magnets/compliance-first-ai-checklist.pdf`
- **Effort estimate:** 1 sprint for blog substrate + 0.5 sprint per lead-magnet PDF.
- **Priority:** **P1** v1.5.

---

## 11. Tier-1 Steals for Docket (ship in next 4 weeks)

These are the highest-leverage Soraban patterns Docket should clone first.

| # | What | Where in Docket | Effort | Why now |
|---|---|---|---|---|
| 1 | **Voicemail bot** (Twilio TwiML script, fires after N failed SMS attempts) | `services/workers/src/lib/twilio-voicemail-bot.ts` + `reminder_rules` extension | 1 sprint | Single biggest comms-layer moat. Antonio's storefront clients answer phones, ignore email. |
| 2 | **"Upload Later" marker** on every doc-request step in intake | `packages/db/src/schema/intake_responses.ts` status enum + UI flag | 1 sprint | Closes the abandoned-intake hole; client never gets blocked by a missing 1099 |
| 3 | **Document auto-classification + bookmarked workpaper PDF** (Document Triage agent, was paper-spec) | `services/workers/src/agents/document-triage.ts` + `build-workpaper-pdf.ts` | 3 sprints | The single feature most prospects benchmark against Soraban (97% accuracy claim) |
| 4 | **Three-phase product page (Intake → Operate → Deliver)** in marketing | `apps/marketing/src/app/product/page.tsx` + three-tile layout | 1 sprint | The "Collect/Connect/Deliver" IA is Soraban's strongest mental-model move; Docket needs the equivalent |
| 5 | **Triple-channel reminder dispatch** (SMS → Email → Voicemail escalation) with per-client opt-out + 3-day minimum + 1-year ceiling | Extend `reminder_rules` substrate (already spec'd) + `reminder-cron.ts` Inngest function | 2 sprints | Substrate spec'd; ship the runtime |
| 6 | **"AR-zero" pitch story** when Docket onboards customer #3+ — collect pre-Docket-AR vs post-Docket-AR data and quote it | Marketing exercise; no code | 0 (zero effort beyond outreach) | Lee & Crowley's "*Collect payments and files simultaneously, the firm eliminated outstanding AR*" is killer; Docket needs the analog |
| 7 | **Twice-daily firm admin summary email** (morning + evening operations digest) | `services/workers/src/functions/firm-daily-summary.ts` + React Email template | 1 sprint | Habit-forming operational pulse; Antonio's morning brief already plans this — extend with evening |
| 8 | **Inline error UX for client-list / prior-year-data imports** ("Rows with issues" pattern) | `apps/command-room/src/app/imports/page.tsx` + row-level error resolver | 1.5 sprints | Imports are the #1 onboarding friction; Soraban's pattern is correct and copyable |
| 9 | **Help center articles per tax software** — Lacerte, Drake, UltraTax, CCH Axcess (start with Antonio's stack: OLT + Lacerte for Phase 2 partner #2) | `apps/marketing/src/app/help/imports/[software]/page.tsx` + content MDX | 2 sprints (1 per software for v0) | SEO + sales-call enablement — every prospect asks "do you integrate with my software" |
| 10 | **"Vacation testimonial" capture from Antonio** — film a 30-second clip during off-season: *"With Docket, I handled both my 2026 IRS audits without missing a single client deadline. First year I didn't work weekends in March."* | `content/testimonials/antonio-vazquez.mdx` + video upload | 0.5 sprint (filming + edit) | Nadine Julson's vacation quote is the best line on Soraban's site; Docket needs the same shape |

---

## 12. Tier-2 Steals (next sprint after that)

| # | What | Where in Docket | Effort | Priority |
|---|---|---|---|---|
| 11 | **Intake Template Editor** (firm-side wizard to author per-firm questionnaires) | `apps/command-room/src/app/settings/intake-templates/[id]/page.tsx` + `_components/TemplateEditor.tsx` + `intake_templates` schema | 4 sprints | **P0 for tenant #2** — blocks multi-firm onboarding |
| 12 | **Custom Portal URL (CNAME) routing** — `portal.vazantconsulting.com` → Docket | Middleware-level hostname resolution + `tenant_branding.custom_subdomain` lookup | 2 sprints | P0 v1.5 — white-label moat |
| 13 | **Custom Buttons** on portal dashboard (firm-wide + per-entity) | `packages/db/src/schema/tenant_dashboard_buttons.ts` + portal Home tab render | 1 sprint | P1 |
| 14 | **Customized Words (Variables)** — let firms rename "Intake" → "Tax Organizer" | `tenant_branding.custom_words_jsonb` + UI-wide token interpolation | 1.5 sprints | P1 |
| 15 | **Firm Glossary** — jargon tooltips authored by firm | `packages/db/src/schema/tenant_glossary.ts` + `GlossaryTooltip.tsx` primitive | 1 sprint | P1 |
| 16 | **Bulk Upload Processor** — multi-doc PDF splitter | `services/workers/src/agents/document-splitter.ts` + Need-You-Queue card | 2 sprints | P1 |
| 17 | **Embedded section videos** in intake (Loom-iframe-paste pattern + per-section instructions) | Extend intake-step schema with `video_embed_url` field | 0.5 sprint | P2 |
| 18 | **Drop Link primitive** — magic-link for non-clients (prospects, attorneys) to upload docs without account | `apps/client-portal/src/app/drop/[token]/page.tsx` + `drop_links` schema | 1.5 sprints | P2 |
| 19 | **Compliance-First AI Checklist** lead magnet PDF | `apps/marketing/public/lead-magnets/compliance-first-ai-checklist.pdf` + landing form | 1 sprint (writing + design) | P1 |
| 20 | **"Stop Falling for the AI Illusion"-equivalent blog post** — *"Why we refused to ship an AI that auto-files tax positions"* | `content/blog/refusal-floor-as-feature.mdx` | 0.5 sprint | P1 |

---

## 13. Tier-3 Steals (V1.5+)

| # | What | Effort | Priority |
|---|---|---|---|
| 21 | **"Connect"-equivalent form-extraction surface** — per-form-type extractors (W-2, 1099-NEC, K-1) with one-step review UX | 6 sprints | P1 v1.5 |
| 22 | **Per-Karbon-equivalent integration page** (Docket × TaxDome / Docket × Canopy if those land) | 0.5 sprint per page | P2 |
| 23 | **CCH AutoFlow piggyback export** — bookmarked PDF format compatible with CCH Scan/AutoFlow | 2 sprints | P2 v1.5 |
| 24 | **Lead sheet generation** as separate PDF export | 1 sprint | P2 |
| 25 | **Track Changes audit trail surface** (read-only view of every client change for the firm) | 2 sprints | P2 |
| 26 | **Per-engagement-status workflow customization** (firm-internal statuses beyond Docket defaults) | 1 sprint | P3 |
| 27 | **Disable client messaging** firm-level setting | 0.5 sprint | P3 |
| 28 | **Remove inbox / documents portal sections** — per-firm hide toggles | 0.5 sprint | P3 |
| 29 | **PDF export text color customization** — firm-branded workpaper PDFs | 1 sprint | P3 |
| 30 | **"The Brass Tax"-equivalent newsletter** (monthly cadence, Docket's voice) | Ongoing operational work | P2 |

---

## 14. What NOT to copy

1. **Per-return pricing.** Soraban charges $25-$40/return with 50-return minimum. Docket is per-active-client metered per L6. The model is locked. **Adopt the segment intel (sticker-shock at scale), not the meter.** A 1,000-return firm pays Soraban $40K/year; Docket should publish pricing that *transparently* shows it's cheaper for the same volume because the meter is tied to engagement-value, not return-count.

2. **1040-only scope.** Soraban explicitly excludes business entities (1120, 1120-S, 1065) from every per-software import + Connect module. *"Only 1040 clients are supported; business entities are excluded"* appears verbatim across multiple help articles. **Docket should ship 1040 + 1120-S + 1120 + 1065 from v1** per CLAUDE.md §12 (multi-entity workspace = typed graph data model). This is the single largest structural gap Docket can exploit.

3. **Desktop-first design.** Soraban's mobile is its weakest surface — flagged by multiple reviewers. **Docket's mobile-first portal is a structural moat** per CLAUDE.md §11 (390×780 iOS viewport). Marketing handle: *"Your clients fill returns on their phone in line at Costco. Docket is built for that. Soraban isn't."*

4. **Long-form dynamic questionnaire pattern.** Soraban's questionnaire can run to 80-150 questions across many sections with conditional branching. **Docket's 25-step wizard with structural branching is structurally better for taxpayer UX** — fewer cognitive load steps, mobile-thumb-friendly, clear progress signal. The Slant pivot story (Pageport → Slant) validates that simpler intake structures convert better at lower technical-confidence cohorts.

5. **The ProConnect credential-share hack.** **Security anti-pattern.** Soraban has firms add `hello@soraban.com` as a Standard-all-access user inside the firm's ProConnect account so Soraban Team can log in and export data. **Docket must refuse this pattern** for SOC 2 + legal exposure reasons (per CLAUDE.md §6 L8 + per ethics — handing third-party engineers full access to a firm's tax-software account would fail audit). Docket's path: per-tenant OAuth where APIs exist; per-tenant browser-automation credentials in Infisical where they don't (per CLAUDE.md §10 MCP roster).

6. **2-5 business day batch SLA.** Soraban operates a back-office processing queue for prior-year-data imports. Email-on-completion async UX. **Docket should target 30 seconds for client lists, <4 hours for prior-year data imports** — real-time wherever possible, async only when batch-OCR is unavoidable. Marketing handle: *"Soraban: 2-5 business days for prior-year data. Docket: same-day."*

7. **Soraban's lime-yellow CTA `#e0fa4d`.** The acid-lime button is YC-house-style modern-SaaS aesthetic — wrong for Docket's editorial-warm portal language per L11. Docket's primary CTA stays warm-ink-on-cream. **Adopt the rigor of the design system (CSS-variable tokens, consistent radii), not the specific colors.**

8. **Contact-sales-gated pricing.** Soraban's `/pricing` URL is 404. Buyers must request demo to learn cost. Docket is committed to **public transparent pricing** per L6. **DO NOT clone the gated-pricing pattern.**

9. **Featuredeck + Satoshi typography stack.** Soraban uses Featuredeck (serif-energy display) + Albert Sans (operational). Docket has Fraunces (portal) + Inter/Geist (command-room). Don't add a third typeface family — design fidelity per L11 means the locked-in stacks stay locked.

10. **The "Soraban Team" as a shared user in the firm's tax software.** See #5 above. **Refuse this pattern explicitly in security review.**

11. **The 30-minute session timeout cap.** Soraban caps session timeout at 30 minutes (firm admins can request shorter, NOT longer). Per CLAUDE.md §6 + Clerk-default session length, Docket's intake flow can be longer-lived during a single client visit. Don't artificially shorten.

---

## 15. UX/UI Patterns Worth Stealing Verbatim

These 10 are quote-grade specific — hand to a designer with no further translation.

1. **The three-phase product IA: "Intake → Operate → Deliver"** as a top-level marketing structure mirroring Soraban's "Collect / Connect / Deliver." Each phase = one tile. Each tile = 3 sub-features. **Steal the IA verbatim.** Codebase: `apps/marketing/src/app/product/page.tsx` with three-section layout + alternating left-right product screenshots.

2. **The "vacation testimonial" frame.** Soraban's *"Soraban allowed me to take two vacations with my family during tax season"* is the **single best line on the entire site**. Outcome-specific, family-anchored, vacation-as-proof. **Steal the shape verbatim:** *"With Docket, [name] handled [hard-thing] without [sacrifice]."* For Antonio: *"With Docket, Antonio handled both 2026 IRS audits without missing a single client deadline."* Codebase: `content/testimonials/*.mdx` + video upload.

3. **The "Upload Later" inline marker** on every doc-request step. Client never blocked; firm sees gap. **Steal the primitive verbatim.** Codebase: extend `intake_responses.status` enum.

4. **The voicemail-bot triple-channel escalation** (SMS → Email → Voicemail after N failed SMS). **Steal the escalation pattern verbatim.** Codebase: `reminder_rules.channel_escalation` jsonb + Twilio TwiML.

5. **The "Rows with issues" inline error resolver UX** at import time. Soraban handles duplicate emails (taxpayer + spouse share email) inline by marking one Primary. **Steal the pattern verbatim** for client-list + prior-year-data imports. Codebase: `apps/command-room/src/app/imports/page.tsx` row-by-row error UI.

6. **The 60-second session-timeout warning dialog** with "Stay logged in / Sign out" + countdown timer + auto-save messaging. **Steal verbatim.** Codebase: `packages/ui/src/components/SessionTimeoutWarning.tsx`.

7. **The Annual Behavior toggle on intake templates** — auto-clones the questionnaire next tax year so firms don't re-author. **Steal verbatim.** Codebase: `intake_templates.annual_behavior` boolean.

8. **The Customized Words (Variables) primitive** — firms rename "Intake" → "Tax Organizer" + all UI surfaces interpolate. **Steal the concept.** Codebase: `tenant_branding.custom_words_jsonb` lookup at render time.

9. **The "Stop Falling for the AI Illusion" stake-in-the-ground blog post.** Three categories of AI (cosmetic / human-powered / actual). Seven critical vetting questions. Green flags + Red flags lists. **Steal the structure for Docket's compliance-first counter-post:** *"Why we refused to ship an AI that auto-files tax positions"* — three categories of tax AI (deduction-finder / autonomous prep / refusal-floor-cited). Codebase: `content/blog/refusal-floor-as-feature.mdx`.

10. **The "AR-zero in the same session" Lee & Crowley narrative.** *"Collect payments and files simultaneously, the firm eliminated outstanding AR."* **Steal the framing verbatim** when Docket has customer evidence: *"With Docket, [Firm] collects the deposit + engagement letter signature + §7216 consent + first doc upload in a single client portal session — eliminating the multi-week back-and-forth that creates outstanding AR."* Codebase: `content/case-studies/*.mdx`.

**Bonus 11th pattern — the engagement-letter-inside-the-questionnaire bundling.** Soraban embeds the engagement letter sign step inside the intake flow rather than punting to a separate DocuSign session. **Steal the bundling.** Docket already plans this; the UX evidence from Soraban validates the choice. Audit-trail event capture (`/what-are-the-types-of-notifications`) — *"Engagement letter has been signed in questionnaire"* — fires as a firm admin notification.

**Bonus 12th pattern — the "Firm Glossary" jargon tooltip primitive.** Every firm has its own preferred terminology. Soraban lets firms author tooltips for terms inside their questionnaires (hover → definition). Especially valuable for bilingual / non-tech-native clients who don't know what "1099-NEC" means. **Steal verbatim.** Codebase: `packages/ui/src/components/GlossaryTooltip.tsx` + `tenant_glossary` table.

---

## 16. Citations

| URL | What I extracted |
|---|---|
| `https://www.soraban.com/` | Hero copy + 9 feature tiles (Collect/Connect/Deliver) verbatim; customer + investor logos; Nadine Julson + Brandon Hall testimonials; security claims; footer structure |
| `https://www.soraban.com/about` | Enoch Ko founder bio; 2021 founding; core values; customer logos (YourBottomLine, DarkHorse CPAs, Real Estate CPAs, Anomaly CPAs); timeline |
| `https://www.soraban.com/case-studies` | 4 case studies: Necelis (750 returns), Aiola (89% adoption), Lee & Crowley (700 returns + AR-zero), Zuazo (1,200 returns + nearly doubled volume) |
| `https://www.soraban.com/case-studies/necelis-cpa` | Adam Necelis details: 750 returns, Drake software, "*best improvement we made this tax season as we moved away from paper*" |
| `https://www.soraban.com/perspective` | 6 blog posts Apr 2025 → Mar 2026, 2 authors (Jenna Bayler + Enoch Ko), monthly cadence, "The Brass Tax" newsletter framing |
| `https://www.soraban.com/perspective/announcing-our-rebrand-a-new-look-a-clearer-mission` | "*Workflow is table stakes. Capacity is the future.*"; abacus inspiration; "the work before the work" |
| `https://www.soraban.com/perspective/stop-falling-for-the-ai-illusion-a-practical-guide-for-accountants-vetting-automation-tools` | Full 7-question AI vetting framework; three AI categories; green/red flags |
| `https://www.soraban.com/perspective/burnout-is-a-leadership-problem-and-fixing-it-starts-with-how-we-design-the-work` | Voice/positioning: dollar-and-hour anchored, leadership-focused, anti-wellness-stipend framing |
| `https://www.soraban.com/perspective/we-closed-series-a-to-help-you-grow-with-ai-not-chaos` | "*Soraban's AI fixed the 60% of a firm's week they can't bill for*"; Altos Ventures lead investor; 300+ firms; 5 tax seasons completed |
| `https://www.soraban.com/perspective/the-quiet-economics-of-a-tax-return` | "*20-30 minutes of staff time before a preparer ever opens the tax software*"; "*bottleneck is the operational workflow surrounding the return*" |
| `https://www.soraban.com/soraban-overview` | Three-phase product structure; AICPA partnership; weekly webinar |
| `https://www.soraban.com/soraban-live-demo` | 30-minute live demo, weekly cadence, GoToWebinar registration |
| `https://www.soraban.com/contact-us` | support@/sales@ paths; 500+ firms trusted-by; demo + webinar CTAs |
| `https://www.soraban.com/security` (404'd) | Security claims sourced from homepage section instead |
| `https://www.soraban.com/pricing` (404'd) | Pricing intentionally gated; tier structure reconstructed from third-party sources |
| `https://helpcenter.soraban.com/` | 12 categories: Getting Started, Manage and Edit Sent Questionnaires, Customizing Firm Preferences, Manage Conversations, Contact Management, Assignments & Filtering, Export Questionnaires, Edit Questionnaire Templates, Manage Documents, Send Questionnaire Templates, Notification & Activity Log, Portal Customizations |
| `https://helpcenter.soraban.com/how-do-i-export-my-client-list-from-lacerte` | Full 11-step Lacerte client list export + upload UX; F3 keyboard shortcut; "Soraban Client List" rename; duplicate-email "Is Primary" resolution |
| `https://helpcenter.soraban.com/how-do-i-export-prior-year-data-from-proconnect` | THE CREDENTIAL-SHARE HACK: add `hello@soraban.com` as Standard-all-access user inside firm's ProConnect; "*After You Send the Invite — Your Part Is Complete*" |
| `https://helpcenter.soraban.com/how-do-i-export-prior-year-data-from-taxslayer` | 7-step TaxSlayer Pro export; 3-5 business day SLA; PDF-organizer-and-zip approach; 1040-only |
| `https://helpcenter.soraban.com/how-to-export-return-data-from-cch-axcess` | 15-step CCH Axcess Standard + Alternative export paths; 2-3 business day SLA; 150MB file split rule; "*returns are not password-protected*" prerequisite |
| `https://helpcenter.soraban.com/stripe-connect-integration` | Stripe Connect Standard + Express setup; firm-side Self-Managed Refunds + ACH visibility |
| `https://helpcenter.soraban.com/how-does-the-scan-and-autoflow-questionnaire-export-work` | CCH AutoFlow piggyback: target sheets in Firm Settings → Integrations & Connect → Manage Target Sheets; "*reach out to your Soraban rep*" enablement gate |
| `https://helpcenter.soraban.com/karbon-integration` | 6-step Karbon API key setup; entity-name + user-email matching; task statuses sync; "*Entity records are linked for reference but data doesn't auto-update*" |
| `https://karbonhq.com/integrations/soraban/` | "*Track client data collection progress from Soraban inside your Karbon workflow*"; one-way data sync from Soraban → Karbon; Zapier bidirectional |
| `https://helpcenter.soraban.com/multi-factor-authentication-mfa-in-soraban` | 6-digit SMS code + 10-minute validity + 5-attempt lockout; IRS-mandated 2025; SMS or email fallback (no authenticator app) |
| `https://helpcenter.soraban.com/understanding-session-timeout-in-soraban` | 30-minute idle timeout; 60-second warning dialog; "Stay logged in / Sign out"; auto-save preserves work |
| `https://helpcenter.soraban.com/customizing-firm-preferences` | 12 firm-preference settings: Firm-Internal Statuses, Customized File Path, Remove Client Messaging, Twice Daily Summary, Portal Folder Structure, Portal White-Label & Favicon, CName, Firm Glossary, Firm Groups, Customized Words (Variables), Customize Portal Colors and Logo, Customize Questionnaire Export Text Colors |
| `https://helpcenter.soraban.com/portal-customizations` | 4 portal customization options: remove inbox/documents, URL white-label, custom buttons with live links, profile photo |
| `https://helpcenter.soraban.com/how-to-add-custom-buttons-with-live-links` | Firm-wide + per-entity custom buttons; Firm Settings → Customization → Client Dashboard Customization → Add New |
| `https://helpcenter.soraban.com/what-to-expect-when-your-firm-url-is-white-labeled` | Custom portal URL via CNAME; favicon uploadable; login creds unchanged; Customer Success Manager-mediated setup |
| `https://helpcenter.soraban.com/how-to-customize-the-profile-photo` | Per-user profile photo; visible to assigned clients in portal |
| `https://helpcenter.soraban.com/twice-daily-summary-notification-morning-and-evening` | Twice-daily admin email (opt-in); covers items between morning + evening summaries |
| `https://helpcenter.soraban.com/firm-glossary` | Jargon tooltips authored by firm; case-insensitive matching; hover/tap reveals definition |
| `https://helpcenter.soraban.com/what-are-the-types-of-notifications-the-firm-admin-receives-and-what-is-included-under-each-soraban-help-center` | 4 categories (Questionnaire/Document/Detail Change/Conversation); 19 specific notification triggers including "*Client has finished signing the Tax Return*", "*Engagement letter has been signed in questionnaire*" |
| `https://helpcenter.soraban.com/how-and-when-will-clients-receive-notifications` | 7-day default cadence; SMS + Email + Portal (triple channel); STOP opt-out; firm-side disable option; 1-year ceiling |
| `https://helpcenter.soraban.com/how-to-change-the-questionnaire-reminder-frequency` | 7-day default + 3-day minimum; auto-stop on completion/lock/due-date |
| `https://helpcenter.soraban.com/manage-questionnaire-reminders` | Sub-articles index: Multi-questionnaire-in-one-email, Disable Reminders, Change Frequency, Reasons reminders stop, How Automatic Reminders Work, Manually Send One-Time Reminder |
| `https://helpcenter.soraban.com/send-questionnaire-templates` | 7 articles: Custom Questionnaire, Remove Sections, Schedule Future Send, Send to Individual/Multiple Clients, Include Additional Questions, Include Rollover Items |
| `https://helpcenter.soraban.com/edit-questionnaire-templates` | 6 articles: Add Videos to Sections, Template Link Creation, Stack with Rollover Items vs Answers, Template Settings (Annual Behavior + Document Path), Template Editor, Export Template |
| `https://helpcenter.soraban.com/manage-documents` | 13 articles including Bulk Upload Processor, Document Triage, Drop Off Feature, Drop Link, Secure Document Share Link, Disable Client Folder Creation |
| `https://helpcenter.soraban.com/contact-management` | 21 contact-management articles: spouse merging, primary contact reassignment, deceased client removal, read-only access, child-under-parent, non-client access |
| `https://helpcenter.soraban.com/export-questionnaires` | 8 articles: Import to ProConnect, Export Client Questionnaire, Find Previously Exported, Why Didn't Export Download, Identifying Missing Documents, Scan and AutoFlow, Custom Document Order, Create Open Items |
| `https://helpcenter.soraban.com/notification-activity-log` | 12 articles on notification management + audit trail features |
| `https://helpcenter.soraban.com/identifying-missing-documents-in-the-pdf-export` | "Upload Later" items + unanswered questions surfaced as "Unanswered" in PDF export; client blocked from submitting without marking |
| `https://helpcenter.soraban.com/how-to-handle-documents-provided-by-a-client-in-person` | Firm manually checks off paper-delivered docs via blue checkmark; "COMPLETED" tag; undo-able |
| `https://helpcenter.soraban.com/how-to-add-videos-to-sections-in-the-template-editor` | Loom iframe paste; per-section instructional video embedding |
| `https://helpcenter.soraban.com/how-drop-link-works-firm-user-guide` | Drop Link primitive: shareable link or QR code for non-account-holders to upload docs; zipped folder delivery; assigned-user notification |
| `https://helpcenter.soraban.com/where-do-my-clients-upload-documents` | Three upload locations: in-questionnaire, in Document section/folder, attached to message |
| `https://helpcenter.soraban.com/manage-and-edit-sent-questionnaires` | 11 articles including Lock Questionnaire, Reverse Submission, Add Question Post-Send, Change Due Date, In-Person Doc Handling, Mark Complete |
| `https://helpcenter.soraban.com/assignments-filtering` | 5 articles: Auto-assign clients, Filter & Understand Status, Bulk Reassign, Filter Types |
| `https://cdn.prod.website-files.com/69185a40b687509ff666872c/css/soraban-new.webflow.shared.0a4363c29.min.css` | Full `:root` CSS variables (verbatim): `--accent: #1f95ff`, `--yellow-accent: #e0fa4d`, `--lavender-accent: #c3a6ff`, `--success: #00e884`, `--critical: #d13112`, `--primary: #f7f7f7`, `--text-dark: #000`, `--text-secondary: #666`, `--blue-border-gradient-btm: #051956`; fonts: Albert Sans, Satoshi, Featuredeck, Spacemono; border-radius scale; button hover states (lime `#cee547` hover, `#c2d943` active) |
| `https://www.capterra.com/p/10008641/Soraban/` | 5 user reviews (May 2023): 4.8/5 average; named users Greg O., Jaclyn M., Jackson P., Todd S., Cliff S.; mobile responsiveness flagged as weak; phone support absent flagged |
| `https://taxhance.com/reviews/soraban` | Pricing tiers verbatim ($25 / $20 / $40 + 50-return minimum + 150+ enterprise); Connect BETA 97% accuracy; SMS + email + voicemail triple-channel auto-reminders; ProSeries + Lacerte + ATX + Drake + TaxWise integrations |
| `https://www.cpapracticeadvisor.com/podcasts/review-of-soraban-the-accounting-technology-lab-podcast-nov-2024/` | Founder year (~2018 incorporated; 2021 active); Tempe AZ + SF dual office; "Silicon Valley data harvesting" concern from Brian Tankersley; "Nordstrom product" framing; Thompson Reuters / Wolters Kluwer notably absent integrations |
| `https://www.ycombinator.com/companies/soraban` | YC W21 batch; Gustaf Alstromer YC partner; 50 employees; Tempe AZ HQ + SF secondary; 3 open roles (Marketing Manager, Demand Gen, Tax Accountant) |
| `https://www.spotsaas.com/product/soraban` | 30 employees as of mid-2024; double-digit MoM growth; W21 YC batch funding $125K; pre-seed $125K (YC + Liquid2); May 2023 seed est. $4.4M (Village Global + AZ-VC + Friále + PHX Ventures); WeFunder Dec 2021 $78K |
| `https://getlatka.com/companies/soraban.com` | $4.5M ARR June 2024; 30 employees; $13.5M valuation; bootstrapped per their data (conflicts with Series A announcement — likely outdated) |
| `https://www.genwise.com/post/soraban-the-best-tax-software-to-collect-more-client-data` | (Fetch blocked 403) — referenced for SMS + Email + VM triple-channel confirmation; surfaced in search snippets |
| `https://www.phxfounders.com/guests/enoch-ko-ceo-and-fo/` | Enoch Ko PHX Founders podcast Oct 31 + Nov 7 2023 (Parts 1 + 2); immigration narrative; entrepreneurial development |
| `C:\Users\minse\projects\docket\CLAUDE.md` | Docket source-of-truth referenced throughout: §4 Command Room + Client Portal surfaces; §6 tech foundation (Twilio, Square, DocuSign + KBA per L8); §8 intelligence layers + AI Preferences + Reminders + Notifications; §9 agent fleet (Document Triage paper-spec; Inbox Drafter + Triage Classifier shipped); §10 MCP roster; §11 design system (two visual languages); §12 multi-entity workspace; §16 productization; §17 competitive landscape; §18 known stubs |
| `C:\Users\minse\projects\docket\docs\competitor-research\PING-FEATURE-UX-DEEP-DIVE-2026-05-13.md` | Shape + depth reference for this inventory |

**Pages that 404'd or were inaccessible (gaps in the inventory):**
- `https://www.soraban.com/llms.txt` — 404. Soraban does not ship an llms.txt yet (opportunity for Docket).
- `https://www.soraban.com/pricing` — 404. Pricing intentionally contact-sales gated.
- `https://www.soraban.com/security` — 404. Security claims live on homepage only.
- `https://www.soraban.com/case-studies/aiola-cpa` — 404 on direct fetch; metrics extracted from listing page.
- `https://www.soraban.com/case-studies/lee-crowley` — 404 on direct fetch; metrics extracted from listing page.
- `https://www.soraban.com/case-studies/zuazo` — 404 on direct fetch; metrics extracted from listing page.
- `https://www.soraban.com/perspective/find-the-right-ai-partner` — 404 on direct fetch; abstract extracted.
- `https://helpcenter.soraban.com/portal-white-label-favicon-customization` — 404.
- `https://helpcenter.soraban.com/how-to-customize-portal-colors-and-logo` — 404.
- `https://helpcenter.soraban.com/customized-words-variables` — 404.
- `https://helpcenter.soraban.com/template-editor-creating-and-customizing-questionnaire-templates` — 404 on direct fetch.
- `https://helpcenter.soraban.com/how-do-i-update-my-questionnaires-messaging` — 404 on body fetch; title only.
- `https://helpcenter.soraban.com/what-are-the-default-messages-associated-with-default-questionnaires` — 404 on direct fetch.
- `https://helpcenter.soraban.com/how-to-customize-default-questionnaire-related-client-communication-messages` — 404.
- `https://helpcenter.soraban.com/soraban-identity-verification-irs-aligned-and-nist-compliant` — 404 on body fetch; title alone confirms IRS Pub 1345 + NIST IAL2 framing.
- `https://helpcenter.soraban.com/how-do-i-export-prior-year-data-from-drake` — 404 on direct fetch (article exists per Google index but body inaccessible).
- `https://helpcenter.soraban.com/how-do-i-export-prior-year-data-from-ultratax` — 404 on direct fetch.
- `https://helpcenter.soraban.com/how-do-i-export-my-prior-year-data-from-lacerte` — 404 on direct fetch.
- `https://www.genwise.com/post/*` (multiple) — 403 blocked.
- `https://www.linkedin.com/in/koenoch/` — 404 on direct profile fetch.
- `https://taxdome.com/soraban-vs-taxdome` — 403 blocked.
- `https://www.youtube.com/@SorabanTeam` — empty footer scrape (YouTube channel page render-blocking).
- `https://x.com/soraban` — 402 (X paywall on unauthenticated reads).
- `https://www.crunchbase.com/person/enoch-ko-9258` — 403.

These gaps don't materially affect the inventory; the on-site sources + third-party reviews + CSS-level token extraction cover the full feature + UX surface needed for the steal recommendations. The biggest single inaccessible artifact is the **default-questionnaire-related-messaging templates** (exact SMS/email copy templates Soraban ships out-of-the-box); reconstructable when Docket needs to author equivalents by reasoning from the channel mix + cadence + voice patterns documented elsewhere.
