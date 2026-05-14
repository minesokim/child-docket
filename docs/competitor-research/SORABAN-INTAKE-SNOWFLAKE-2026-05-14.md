# Soraban Intake — Snowflake Mechanics Deep-Deep-Dive

> Companion to `SORABAN-FEATURE-UX-DEEP-DIVE-2026-05-13.md`. That doc cataloged the full intake surface end-to-end. **This doc goes DEEPER on ONE specific question the founder asked:** *"How does Soraban personalize the intake form per client when each client is a snowflake?"*
>
> Founder context: Docket today has a hard-coded 25-step intake wizard at `apps/client-portal/src/app/(intake)/` driven by `apps/client-portal/src/lib/intake-flow.ts`. Soraban is widely cited as having "amazing" intake. The strategic question is whether Docket's hard-coded model is structurally inferior, and if so, what to do about it.
>
> Short answer up front: **Soraban does NOT have AI-driven dynamic personalization.** What they have is (a) **firm-authored templates with skip-logic** + (b) **prior-year-data import that pre-flags which docs to expect** + (c) **send-time per-client section removal and additional questions** + (d) **a Custom Questionnaire pattern for true one-offs.** It's a *configurable* questionnaire system with strong firm-side authoring, NOT an AI that infers "Maria's a Schedule C filer with a rental — show her the Schedule E branch." The "smart, dynamic" marketing handle does a lot of work for what is, mechanically, **decision-tree skip logic + rollover items**.
>
> This is good news for Docket — the gap is smaller than it appears, and Docket's 25-step wizard is closer to parity than the "snowflake" framing suggests. The actual moat to clone is the **firm-side template editor + prior-year-data ingestion + custom-item escape-hatch**, not an AI inference engine.

---

## 1. The per-client personalization mechanism

### Signal sources — where the personalization actually comes from

Soraban's per-client personalization comes from **four signal sources stacked together**, in declining importance:

1. **The firm-authored template itself** (the dominant signal). Each firm authors one or more questionnaire templates in the Template Editor. The template encodes skip logic, follow-up questions, sections, and required uploads. Personalization is then driven by **which template the firm picks for this client** + **how the client answers the template's questions**. Templates do NOT pull from prior-year data to auto-branch.

2. **Rollover items from the prior-year return** (the second-strongest signal). Two distinct flavors documented in `/understanding-the-stack-with-rollover-items-feature-in-the-questionnaire-template-editor`:
   - **Rollover Items** — document names pulled from the firm's prior-year tax-software export (Lacerte/Drake/CCH/etc., via the 2-5 business day batch processing pipe). These are **finalized document names** (e.g., "Acme Corp W-2," "Wells Fargo 1099-INT"). They drive **follow-up document upload prompts**.
   - **Rollover Answers** — the client's prior-year questionnaire answers carried forward as reference. NOT pre-filled values; **shown as reference notes** to the client *next to* the current-year question. The client still answers, but they can see what they said last year.

3. **The client's own answers to the template's branching questions** (mid-flow signal). When the client answers Yes/No, Multiple Choice, or Multiple Select questions, follow-up questions trigger via the template's skip logic. **Sections can also trigger conditionally** based on a prior section's answer.

4. **Send-time firm overrides** (the fourth signal, deeply firm-mediated):
   - Sections removed for this particular send (`/how-to-remove-sections-from-a-questionnaire-template`)
   - Additional questions added for this particular send (`/how-to-include-additional-questions-when-sending-a-questionnaire-template`)
   - Rollover Items toggle on/off for this particular send

**Critical finding:** None of these signals are AI-inferred. They're all **deterministic** — firm-authored templates + firm-mediated configuration + client-answered branches. The "AI" in Soraban's marketing pitch primarily refers to the **Connect** module (OCR/extraction of uploaded documents after intake), not to dynamic intake itself.

### Granularity

Personalization is granular at **three levels**:

| Level | Mechanism | Authored by |
|---|---|---|
| **Per-question** | Follow-up questions trigger from Yes/No, Multiple Choice, Multiple Select. Hierarchy max 3 deep: `1 → 1.1 → 1.1.1`. | Firm (in Template Editor) |
| **Per-section** | "Triggered by question" toggle. Section appears only when a specific source-section question matches a specific answer. *"Only Questionnaire sections can act as trigger sources."* | Firm (in Template Editor) |
| **Per-send (per-client)** | Sections removed via X-button at send-time; additional questions added inline at send-time; rollover items toggled; custom questionnaire for one-offs. | Firm (at send moment) |

There is **no per-form-type templating** beyond what the firm authors. A firm wanting different intake for "W-2 only" vs "Schedule C" vs "multi-state" must author N different templates and pick which one to send per client. There is no auto-template-selection.

### Mid-flow adaptation

**Mid-flow adaptation is LIMITED.** Per `/how-to-modify-the-questionnaires-or-engagement-letter-that-ive-already-sent`:

> *"it's not possible to edit the questions within a questionnaire after it has been sent to a client."*

This is a hard limitation. Once sent, the firm CANNOT change existing question wording or branching. What the firm CAN do (per `/how-to-add-an-additional-question-or-document-request-to-an-already-sent-questionnaire`):

- **Add** additional questions or document requests via the plus-icon in the questionnaire header
- **Resend** the questionnaire to notify the client

This means **the client's answer to question 5 cannot retroactively reshape question 15 if both are already in-flight**. Skip logic operates within the template's pre-defined branching, not as a continuously-recomputed graph. If the firm realizes mid-flow that the client needs Schedule E questions they weren't pre-branched into, the firm appends ad-hoc questions and resends — they don't restructure the live form.

### Conditional logic engine

The conditional logic engine is, mechanically, **a decision-tree skip-logic system** — the same primitive SurveyMonkey/Typeform/Jotform have shipped for 15+ years. Specifically per `/new-template-editor-creating-and-customizing-questionnaire-templates`:

- **Question-level follow-ups** authored via hover → blue + icon → modal: *"If client selects ___ then ask the question below."* Maximum hierarchy depth: 3 (`1 → 1.1 → 1.1.1`).
- **Section-level triggers** via the "Triggered by question" toggle, requiring: Source Section + Trigger Question + Client's Answer Condition. Only Questionnaire sections (not Custom/Agreement/Review/Document Checklist) can act as trigger sources.
- **Copy semantics** — *"Copying a parent question also copies all attached follow-ups. Copying an individual follow-up converts it into a new parent question in the destination section."*
- **Cascade delete** — *"If a question with follow-ups is deleted, all of its follow-up questions are deleted automatically."*

**There is no rules engine, no decision graph DSL, no AI inference, and no LLM in this loop.** It's a graph the firm draws by hand in a UI, with conditions evaluated by deterministic match.

The "smart" in "Smart Dynamic Questionnaire" refers to:
- Skip logic (questions you wouldn't answer get hidden)
- Auto-PDF conversion on uploads
- The Connect module's downstream OCR (separate from intake)
- Reminders that auto-fire

Not to any inferential model. **This is the single most-overstated piece of Soraban's marketing.** When Capterra reviewer Cliff S. notes *"The questionnaire can be over 100 pages because of this"* (May 12, 2023, partner, Accounting), he's complaining that **the conditional logic doesn't deduplicate well** — i.e., the system is exactly as smart as the firm authored it to be, no smarter.

---

## 2. The firm-side template editor

### Who authors

**The firm authors. Always.** No Soraban-CS-team default templates ship out of the box (per the help-center articles — every article assumes the firm is in the editor). No AI-generated templates from prior-year analysis. No marketplace of community-shared templates (Slant has this; Soraban doesn't).

Onboarding pattern (inferred from `/template-editor-creating-and-customizing-questionnaire-templates`): firms either (a) build their template from scratch via Add Section + Add Question, or (b) duplicate an existing template they've already built, or (c) get hand-held by their Soraban Customer Success Manager during onboarding to migrate from their prior tax-organizer PDF.

### Editing UX

**The editor is a flat-list-with-hierarchy section/question authoring tool**, NOT a drag-drop branching diagram. Per the help center, the UX shape is:

- **Templates list** in the left sidebar of the firm's command center
- Click "+ Add section" → modal picks **section type** from 5 choices:
  - Custom (plain text / instructions / context)
  - Agreement Signature Request (e-signature)
  - **Questionnaire** (the interactive questions surface — only this section type supports the 11 question types + skip logic)
  - Review & Submit (system-generated, non-editable)
  - Document Checklist (system-generated)
- Inside a Questionnaire section: hover over question → blue + icon → add follow-up
- Drag to reorder when "Collapse questions toggle" is ON
- Parent questions reorder only with other parents; follow-ups reorder only within their hierarchy

**This is not a decision-tree diagram view.** A firm authoring complex conditional logic across 50+ questions does NOT see the branch tree visualized — they see a collapsed list with `1 → 1.1 → 1.1.1` indentation. **This is a UX weakness Docket can leapfrog** by shipping a node-graph editor (think Typeform Logic Map / Whimsical) as the authoring view.

### Question types (full inventory)

11 question types per the Template Editor:

| Type | Notes |
|---|---|
| Yes/No | Supports follow-ups |
| Multiple Choice | Supports follow-ups |
| Multiple Select | Supports follow-ups |
| Upload | Supports "Stack with rollover items" |
| Date | No follow-ups |
| Short Answer | Free-text, no follow-ups |
| Long Answer | Free-text, no follow-ups |
| Sensitive Information | SSN/EIN — encrypted handling |
| Email | Validated format |
| Phone | Validated format |
| Client Entries | **Repeating-data type** — dependents, rental properties, K-1s. Configurable "Entry Action Name" button. Optional Tabs to organize multi-attribute entries. *"A tab appears to clients only if it contains at least one question."* No nesting of entries. *"Fields inside Client Entries are not required; clients can submit even if they leave them blank."* |

**The "Client Entries" type is the most clever single primitive in the editor.** It solves the "how do we let a client with 5 rental properties enter all 5 sets of data without authoring 5 separate question groups" problem with a single repeating-block primitive. This is a structurally important steal candidate for Docket — Docket's current 25-step wizard has no repeating-block primitive (the dependents step is hand-coded; rentals don't have one).

### Question-level options (the underrated knob inventory)

Per question, the firm can toggle:

- **Required vs Optional** (`"Optional (clients may skip)"`)
- **Hide "Not Applicable"** (removes the N/A button from the client UI)
- **Hide "Ask Later"** (removes the defer-answer button)
- **Hide "Upload Later"** (removes the defer-upload button — Upload questions only)
- **Hide "Provided Elsewhere"** (separately removable; defaults visible) — the client can indicate they've already given the doc to the firm by some other channel
- **Stack with rollover items** (Upload questions only — drives the prior-year doc-name follow-ups)

These per-question knobs are MUCH more granular than Docket's current 25-step model. Each question carries 5-6 individual policy switches. Worth cloning verbatim.

### Reuse across clients

Templates are **reused by sending the same template to N clients**. The firm's library can have many templates. There is no Slant-style "smart template" that auto-picks per client. The firm picks at send time from a dropdown.

**Two reuse patterns documented:**

1. **Bulk send to N clients** — per `/how-to-send-questionnaires-to-individual-or-multiple-clients`. Three send paths (Collect page = "ideal for managing questionnaires in bulk"; Entities page = "useful for selecting multiple clients from your entity list"; Dashboard page = "best for sending to a specific individual client"). Selection mechanics support: per-row checkboxes, header "select all on this page," "+ Select All" for all firm entities with running count, "Clear Selection" with current count.

2. **Annual Behavior auto-clone** — per `/template-settings-name-annual-behavior-document-path`. The "Annual Questionnaire" checkbox on template settings makes the questionnaire fire once-per-year per client. *"Prevents auto-generating multiple questionnaires if the client revisits the same link."* When disabled: *"Allows clients to reuse the same link to submit multiple questionnaires throughout the year"* (used for recurring workflows like bookkeeping, payroll, estimated tax organizers).

### Template versioning

**Versioning is minimal-to-absent.** No change history. No "save as version 2." The firm edits in place. The articles don't reference rollback. The closest version-control primitive is **duplicating** the template ("create new template or duplicate existing ones").

This is a real Docket steal opportunity — `intake_templates` schema should ship with `version INT` + immutable history rows from day 1, even if no UI consumes it at launch.

### Multi-template per firm

**Yes — and the firm picks per send.** No automatic routing. There's no "if client's prior-year return had Schedule C, auto-pick the Schedule C template" inference. The firm sees a template picker dropdown at send time.

Operational implication: a 750-return firm like Necelis CPA likely has a small number of templates (3-5: Individual / Individual+Rental / Individual+Self-Employed / Business / Year-End-Planning), not 750. The per-client variability is then handled by **rollover items + skip logic + send-time section removal**, not by template proliferation.

### Template Settings — the four configurable knobs

Per `/template-settings-name-annual-behavior-document-path`:

| Setting | Purpose |
|---|---|
| **Template Name** | *"Should avoid including years to prevent duplication when the system auto-inserts the tax year."* Soraban auto-injects `{tax_year}` so the template renames itself yearly. |
| **Annual Behavior** | Once-per-year vs recurring throughout year. |
| **Internal Description** | Firm-internal notes; not shown to clients. |
| **Document Path** | Where uploaded files land in the firm's portal Documents tab. Default: `{year}/{Questionnaire_name}`. Customizable e.g.: `{year}/Tax/Tax Work Papers/{questionnaire_name}`. This is the **DMS-integration** primitive — firms with a parallel DMS (SmartVault, ShareFile) get docs filed in the right hierarchy by default. |
| **Action Button Text** | Customizable email-button label (defaults to "Open Questionnaire"). |

The Document Path setting is the **most underrated knob in the editor**. It's effectively a deterministic auto-filer that means uploaded docs land in the firm's preferred filing structure without manual re-filing. Worth cloning verbatim.

---

## 3. Question types inventory + interaction patterns

Already enumerated in §2 above. Highlights for the interaction-pattern angle:

- **Follow-ups only on Yes/No, Multiple Choice, Multiple Select** — these three types are the conditional-branching primitives. All other types are leaves.
- **Client Entries** is the repeating-data primitive (dependents, rentals, K-1s). Configurable button label. Optional tabs. No nesting.
- **Sensitive Information** is encrypted (SSN/EIN handling). Soraban does not document the encryption mechanism publicly, but the type exists distinctly.
- **No signature type** in the question-level inventory — signatures live at the **section level** ("Agreement Signature Request" section type). Each signature section is one e-sign event. Multiple signature sections per template is allowed.
- **Upload questions** are the only type with the "Hide Upload Later" + "Hide Provided Elsewhere" + "Stack with rollover items" toggles. These three switches make the upload UX richer than the answer UX.
- **Preview** — eye icon previews single section; "Preview" button shows the entire questionnaire from start to finish. **Preview includes evaluating skip-logic** — the firm sees what the client would see given specific answer paths.

### Validation

The articles don't expose validation rules beyond format-implicit types (Email, Phone, Date). No documented:
- SSN format validation (likely client-side regex on Sensitive Information)
- Prior-year AGI as Knowledge-Based Authentication
- Cross-field validation (e.g., "AGI must equal sum of W-2s + 1099s")
- Currency format
- Amount thresholds

This is a Docket opportunity — ship cross-field validation as a first-class question option.

### Multi-page sections vs single-scroll

The Soraban UX renders **per-section** with section navigation (left sidebar on desktop, dropdown on mobile). Within a section, all questions render single-scroll. Progress indicator at top shows section completion. This is closer to Typeform's per-screen than to a single long form.

Docket's 25-step wizard renders **one step per page** with progress dots — *more* paginated than Soraban. Different cognitive model. Both work; Soraban's section-pagination scales better to 50-150 question templates; Docket's per-step works better for tightly-curated 25-question flows.

### Required vs Optional vs Upload Later vs Ask Later vs Provided Elsewhere

**Five distinct completion-states per question/upload:**

1. **Required answered** — green checkmark, contributes to completion %
2. **Required but Optional toggle ON** — client can skip with no penalty
3. **Ask Later** (answer questions) — client defers; surfaces on firm's missing items
4. **Upload Later** (upload questions) — client defers the doc upload; surfaces on firm's missing items
5. **Provided Elsewhere** (upload questions only) — client indicates doc went via email / in-person / fax / other channel

The firm can hide any of (3), (4), (5) via per-question toggles. **The default visible-state for all three is ON** — meaning clients see all three deferral affordances unless the firm explicitly hides them.

This 5-state model is **massively more nuanced than Docket's current binary "complete vs incomplete" per step.** Worth cloning whole-cloth.

---

## 4. Document collection variation

### How does Soraban request different docs for different clients?

Three mechanisms stacked:

1. **Template skip-logic** — Upload questions inside Questionnaire sections trigger conditionally:
   - *"Do you have rental income? Yes/No"* → on Yes, follow-up appears: "Upload Schedule E supporting docs"
   - *"Did you receive any 1099s? Yes/No"* → on Yes, follow-up: "Upload Later or upload each 1099"
   - *"Do you own a business? Yes/No"* → on Yes, Client Entries follow-up: "+ Add Business" → name, EIN, P&L upload, 1099-NEC upload

2. **Document Checklist section type** — system-generated section that auto-aggregates all "upload-required" docs from earlier sections into a single end-of-form checklist. The client sees one consolidated list.

3. **Rollover Items / Stack with rollover items** — per `/understanding-the-stack-with-rollover-items-feature-in-the-questionnaire-template-editor`:

   > *"Generates tailored follow-up prompts based on the exact names of rollover documents."*
   >
   > Source: *"Finalized tax organizer data exported from tax software or manually added by the firm."*

   This is the **most under-marketed mechanic in Soraban's stack.** Mechanically: the firm imports the client's prior-year return via the 2-5 day batch import (Lacerte, Drake, CCH, etc.). The system extracts document names (e.g., "Wells Fargo 1099-INT," "Acme Corp W-2," "Schwab 1099-B"). When that client opens this year's questionnaire and reaches an Upload question with "Stack with rollover items" enabled, the form shows **document-specific upload prompts pre-named with last year's filers** — *"Please upload your Wells Fargo 1099-INT"* instead of generic *"Please upload your 1099-INT."*

   **Critical caveat in the docs:** *"Rollover item names must exactly match the wording used in the follow-up question, spelling, spacing, punctuation, and formatting."* Mismatches cause the system to default to generic prompts. This is brittle and points to a **string-matching implementation** rather than fuzzy-match. Worth doing better in Docket.

### Conditional doc requests — explicit examples

Reconstructed from the editor's branching primitives:

- *"Did you own rental property in 2025?"* (Yes/No, follow-up triggered on Yes) → *"How many rentals?"* (Client Entries with rental address, depreciation basis, 1098 upload per rental)
- *"Did you receive a K-1 in 2025?"* (Yes/No → Yes) → Client Entries: per K-1, capture entity name + EIN + K-1 upload
- *"Did you have any investment activity in 2025?"* (Yes/No → Yes) → *"Upload each brokerage 1099-B/DIV/INT statement"* with rollover-item stacking pulling last year's brokerage names
- *"Are you self-employed?"* (Yes/No → Yes) → P&L upload + 1099-NEC list + bank-account/expense reconciliation prompts
- *"Did you move states during 2025?"* (Yes/No → Yes) → state-residency dates + part-year-resident upload prompts

All of the above are **firm-authored**. The firm builds these branches. No AI suggests "this client probably needs Schedule E based on prior year." The firm has to wire it.

### The "missing doc" surfacing mechanism

Per `/how-to-check-the-clients-missing-documents`:

> *"Hover mouse over Documents in the header row. A list of missing documents will be displayed along with the number of documents missing out of the total."*

Plus per the PDF export article (`/identifying-missing-documents-in-the-pdf-export`):

- Unanswered questions are flagged "Unanswered" in the exported PDF workpaper
- Upload Later items are listed as missing in the export
- The export is bookmarked by form type for easy navigation in Adobe / Foxit

The firm's surface for missing items is **a hover-tooltip on the Collect page + an inline checklist within each questionnaire detail view + flagged-in-the-PDF-export-at-handoff**. Not a top-level "missing docs queue across all clients" view. **This is a gap Docket can leapfrog** by surfacing a firm-wide missing-docs queue with per-client roll-up + age + auto-reminder status (Docket already plans a Need-You queue per CLAUDE.md §4).

---

## 5. Reminder cadence variation

Already enumerated in `SORABAN-FEATURE-UX-DEEP-DIVE-2026-05-13.md` §2 step 7. Confirmed via fresh `/how-do-automatic-questionnaire-reminders-work` and `/how-to-change-the-questionnaire-reminder-frequency` fetches:

### The cadence rules (confirmed verbatim)

| Rule | Value | Source |
|---|---|---|
| Default | **7 days** | `/how-to-change-the-questionnaire-reminder-frequency` |
| Minimum interval | **3 days** | "*The minimum allowed interval is 3 days — reminders cannot be sent more frequently than that.*" |
| Maximum interval | Not explicitly stated; can be set to **999** to effectively disable firm-wide | `/how-to-disable-questionnaire-reminders` |
| Hard ceiling | **1 year post original send** | "*Automatic reminders for all overdue questionnaires and tax returns will stop one year after the original send date.*" |
| Stop on completion | Yes | Multiple sources |
| Stop on lock | Yes | "*If the tax organizer is locked, no reminders will be sent.*" |
| Stop on due-date pass | Yes | "*Once the due date has passed, automatic reminders stop.*" |
| Estimated completion date | Reschedules reminder to that date | "*If clients set estimated completion dates between the scheduled reminder and due date, the system sends reminders on the estimated date instead, preventing duplicate notifications.*" |

### Per-questionnaire opt-out (granularity)

Per `/how-to-disable-questionnaire-reminders`:

- **Per-questionnaire** — Collect page → Action menu → Reminders → Disable Reminders
- **Bulk per-questionnaire** — Multi-select checkbox → Actions → Reminders → Edit reminder status (#) → Disable
- **Post-completion** — Lock Questionnaire from Actions menu
- **Firm-wide** — Firm Settings → Customization → set reminder frequency to **999** (effectively disables)

**No per-client persistent opt-out separate from per-questionnaire.** A client who replies STOP to SMS gets opted out at the SMS-channel level (Twilio carrier behavior, not Soraban-controlled per se).

### Channel escalation

The reminder-frequency article does NOT specify channels. Per the homepage marketing copy + third-party reviews (Taxhance), reminders fire on **SMS + Email + Voicemail** in escalation. The voicemail bot is the moat-grade move — Soraban is the only player at the segment confirmed to ship productized voicemail reminders.

**Per-question reminder vs whole-form reminder:** Reminders are **per-questionnaire**, not per-question. The reminder copy variables (per `/customized-words-variables-new`):

- `{number_of_items_left}` — Remaining completion items (per-questionnaire count)
- `{required_documents}` — Bulleted document list
- `{by_due_date}` — Action deadline with date

So a single reminder can enumerate the N specific items missing across the form, but it's one reminder per questionnaire, not N reminders per item.

### Voicemail bot script — verbatim

**Not publicly available.** Soraban does not publish the voicemail bot's exact TwiML script. Third-party reviews (Taxhance) confirm voicemail is used as a third channel. The voicemail likely fires after N failed SMS+email attempts. Script content is inferred to be: *"This is [firm name]. You have a tax document missing — please log in and complete your questionnaire at [short URL]."* Per-firm customization is implied via the Customized Words variables (`{firm_name}`, `{questionnaire_name}`) but the exact TwiML template is not documented.

### Manual one-off reminders

Per `/how-to-manually-send-a-one-time-questionnaire-reminder`:

- Collect page → Action menu (three dots) → Reminders → choose:
  - **Send Reminder** → fires default reminder message immediately
  - **Edit Message** → opens editable template → "Send Now" or "Save & Do Not Send"
- Editing a one-off reminder DOES NOT change the firm's default templates

This is a clean firm-side affordance and an obvious Docket-clone target.

### Consolidation across multiple questionnaires per client

Per `/consolidate-email-reminders-for-single-users-with-multiple-entities`: when a single user owns multiple entities (e.g., personal + S-corp + LLC), reminders for all questionnaires can be consolidated into a single email. **This is operationally critical for clients with complex entity structures** and Docket should clone the consolidation behavior.

---

## 6. "Upload Later" marker mechanics

### State tracking

Per the help center, "Upload Later" is one of **five completion-states per Upload question**:

1. Required + completed (file uploaded, green checkmark)
2. Required + skipped via "Ask Later" (orange/yellow pending state)
3. Required + skipped via "Upload Later" (yellow pending state — doc-specific)
4. Required + indicated "Provided Elsewhere" (firm-flagged as off-platform delivery)
5. Required + not-applicable via "Not Applicable" button (closed state)

The firm can hide buttons (3), (4), and (5) via per-question toggles in the Template Editor. **The default visible state for all three is ON.**

### Firm-side surfacing

Three surfacing surfaces:

1. **Hover-tooltip on the Collect page** — *"Hover mouse over Documents in the header row. A list of missing documents will be displayed along with the number of documents missing out of the total."*

2. **Inline checklist within the questionnaire detail view** — clicking Documents inside a questionnaire shows *"both the missing and received documents"*

3. **Flagged in the PDF workpaper export** — *"Unanswered"* tags + missing-doc list per `/identifying-missing-documents-in-the-pdf-export`

There is NO top-level firm-wide cross-client missing-docs queue documented. A firm wanting to see "all clients with any Upload Later items" has to walk client-by-client. This is a structural gap Docket can leapfrog.

### Does the client get auto-reminded for Upload Later items?

**Yes — implicitly.** Because Upload Later doesn't mark the questionnaire complete, the auto-reminder cadence keeps firing per the 7-day default (or whatever the firm set). The client gets reminded about the questionnaire-as-a-whole, with the reminder body enumerating outstanding items via `{required_documents}` variable.

### Completeness semantics

Per the help center articles on `/how-to-mark-a-questionnaire-or-organizer-as-complete` + `/whats-the-difference-between-the-sent-in-progress-and-completed-questionnaire-statuses`:

- **Sent** — questionnaire dispatched, no client engagement yet
- **In-Progress** — client has answered at least one question
- **Completed** — client clicked "Submit" — this can happen with Upload Later items still pending (the system permits submit-with-pending)

Critical insight: **the system allows the client to submit the form even with Upload Later items pending.** The questionnaire transitions to Completed, but the firm still sees the outstanding upload items on their side. This is the **single most-empathetic UX move in Soraban's intake** — the client is never blocked by "I don't have my 1099-INT yet" from finishing the rest of the form. They submit, the firm sees the gap, the system continues nudging (via auto-reminders against the still-open Upload Later items).

**Submit-with-pending is the load-bearing primitive.** Worth cloning verbatim.

---

## 7. Mobile UX

Already covered in `SORABAN-FEATURE-UX-DEEP-DIVE-2026-05-13.md` §2 step 11 as Soraban's weakest surface.

Key mobile-specific findings on the intake side:

- **Section navigation** collapses to a dropdown on mobile (vs sidebar on desktop)
- **Form inputs** scale to ~48px touch-friendly height via the `rem` system
- **No mobile-app**, mobile-web-only
- **Auto-conversion of camera-captured images to PDF** is a core capability — the client takes a phone photo of a 1099, the system auto-converts to PDF and files
- **No question types skipped on mobile** — the same 11 types render; some are awkward (Client Entries with many tabs gets crowded on a phone)
- **Save-and-resume** is implicit via auto-save on every field change; no "Save" button anywhere

Multiple Capterra reviewers flagged mobile responsiveness as weak (Jackson P. May 2023: *"Mobile responsiveness needs improvement"*; Taxhance: *"Poor mobile experience"*). Soraban is desktop-first by deliberate posture. Docket's mobile-first design is a structural moat.

---

## 8. White-label customization (intake-specific)

Already enumerated in `SORABAN-FEATURE-UX-DEEP-DIVE-2026-05-13.md` §2 step 12. Intake-specific knobs (subset of the broader white-label surface):

| Knob | Where it applies to intake |
|---|---|
| **Portal Colors + Logo** | Header band + button colors on every intake screen |
| **Profile Photo** | Assigned firm user's photo shows in the intake (where the assigned preparer is named) |
| **Welcome Message** | First-screen copy on the intake before questions begin |
| **Embedded Videos (per section)** | Loom iframe paste; section-level (not per-question) |
| **Firm Glossary** | Tooltip definitions for jargon terms; case-insensitive matching; hover/tap reveal; **enablement gated — firm must contact account manager or in-app support to activate** |
| **Customized Words / Variables** | Token replacement in OUTBOUND messaging (email/SMS/in-app), NOT in-form copy. Inventory: ~25 variables across questionnaire/user/entity/tax-return categories. |
| **Document Path** | Per-template setting; controls where uploaded docs land in firm's portal Documents tab |
| **Action Button Text** | Per-template; the email-button label clients click to open the questionnaire |
| **Custom Portal URL (CNAME)** | `portal.yourfirm.com` instead of `app.soraban.com`. Setup via Customer Success Manager. |
| **Portal Folder Structure** | Per-firm document hierarchy in the post-intake portal — *"Customize your portal Document folder and its structure to match your DMS or preferences."* Customization is **support-mediated**, not self-serve. |
| **Provided Elsewhere button** | Removable firm-wide via Soraban Support (NOT self-serve) per `/remove-the-provided-elsewhere-button-in-the-questionnaire-new` |
| **Restrict client document uploads outside of questionnaires** | Firm-level setting managed by Soraban Support; prevents clients uploading anywhere except via questionnaires |
| **Engagement Letter In-Questionnaire** | Section-type "Agreement Signature Request" places signing mid-flow |
| **Refund Policy Display** | Displayed inline at checkout (firm-authored once in Settings) |
| **§7216 Consent** | Implemented as another Agreement Signature Request section |

**Observation:** A meaningful number of white-label knobs require firm to email Soraban Support (Custom Portal URL, Firm Glossary enablement, Provided Elsewhere removal, Restrict-uploads, Twice-Daily Summary). This is a **support-mediated firm-tier customization model** — not pure self-serve. Soraban uses the CS team as both onboarder AND configuration interface. This is a deliberate posture (high-touch for high-LTV firms), not a v1 gap. Docket's instinct should be more self-serve, but the high-touch posture is defensible for the top firm tier.

---

## 9. Technical implementation (inferred)

### Is the questionnaire JSON-schema-driven? React-form-based? Custom?

**Inferred to be JSON-schema-driven server-rendered React.** Evidence:

- The template editor's structure (section types + question types + follow-up hierarchy + per-question option toggles) maps cleanly onto a JSONB document model (likely `template_definition jsonb` on a `templates` table).
- The skip-logic semantics (`If client selects X then ask question Y`) point to a simple rules-evaluator that runs against the JSON-defined branching tree at render time.
- The auto-save behavior (every field change persists) implies a fine-grained client → server write pattern, likely with optimistic UI.
- Soraban's stack is documented externally as Next.js + React on the front, Postgres-backed on the back. No public mention of specific form library (no react-hook-form / Formik / SurveyJS references in their GitHub/job postings/founder posts as of mid-2026).

**Most likely shape:**
- Template stored as `template_definition jsonb` (sections array, each with questions array, each with follow-ups array, each with options + visibility rules)
- Per-questionnaire-send creates a `questionnaire_instance` row that snapshots the template at send-time (so mid-flow template edits don't reshape live instances)
- Per-question answer stored as a normalized row on `questionnaire_responses` table keyed on `(questionnaire_instance_id, question_id)`
- Skip logic evaluated client-side on each answer change; server validates at submit
- Rollover items stored separately on `client_rollover_items` table, joined at render time when the upload-question's `stack_with_rollover_items` flag is true

### State management

- **Client-side**: React state for in-flight answer + dirty-flag; debounced writes to server
- **Server-side**: Postgres as source of truth (the auto-save pattern requires this)
- **Real-time**: Unlikely to be true real-time (no documented WebSocket / SSE). Probably last-write-wins on save with optimistic UI.

### Auto-save mechanism

Per multiple help-center references — *"Soraban preserves all data, so work in progress is saved automatically."* Pattern is **per-field-debounced write to a server action that writes to Postgres**. Same pattern as Docket's existing `useIntakeField` + `saveIntakeField`.

### Offline support

**Not documented; almost certainly absent.** The 30-minute session timeout + auto-logout pattern + the auto-save model all imply online-only. Mobile offline drafting is not a Soraban capability.

---

## 10. What Docket should steal

Concrete patterns ranked by leverage, with codebase paths.

| # | Pattern | Codebase target | Effort |
|---|---|---|---|
| 1 | **Submit-with-pending semantics** — client can submit form with Upload Later items still pending; firm sees gaps and auto-reminders keep firing | `apps/client-portal/src/app/(intake)/` + `packages/db/src/schema/intake_responses.ts` `status` enum (`answered` / `upload_later` / `ask_later` / `provided_elsewhere` / `not_applicable`) | 1 sprint |
| 2 | **5-state per-question completion model** — Required + Optional + Ask Later + Upload Later + Provided Elsewhere, with per-question Hide toggles | Extend `intake_step` schema with `available_deferrals: string[]` + `optional: boolean` | 1 sprint |
| 3 | **Client Entries primitive** (repeating-block for dependents, rentals, K-1s) | New `RepeatingBlock` component in `packages/ui/src/components/` + schema support for `entries: jsonb[]` on a question | 2 sprints |
| 4 | **Rollover items / Stack-with-rollover-items mechanic** — pull document names from prior-year return import; show on this-year upload questions as document-specific prompts | New `client_rollover_items` table + `stack_with_rollover_items: boolean` on Upload questions + render-time merge in the intake flow | 3 sprints (requires prior-year-data import pipe first) |
| 5 | **Rollover Answers (reference-only)** — show prior-year answers as reference notes next to current-year questions, NOT pre-filled | Extend question render with `rollover_answer_reference?: string` field | 1 sprint |
| 6 | **Template Editor (firm-side)** — sections + 11 question types + follow-ups (max 3 deep) + Triggered-by-question section conditions + Annual Behavior + Document Path | `apps/command-room/src/app/settings/intake-templates/[id]/page.tsx` + `_components/TemplateEditor.tsx` + `intake_templates` schema (existing paper spec) | 4 sprints (THE multi-firm-readiness blocker) |
| 7 | **Send-time per-client section removal** — remove sections at send-time by clicking X; re-add via dropdown | Send wizard at `apps/command-room/src/app/intake/send/[client_id]/page.tsx` | 0.5 sprint (after template editor lands) |
| 8 | **Send-time additional questions** — add per-client custom items without altering template | Same send wizard + `questionnaire_overrides` table | 1 sprint |
| 9 | **Custom Questionnaire** (non-template ad-hoc) — quick one-off question/upload requests scoped to a single client | `apps/command-room/src/app/clients/[id]/custom-questionnaire/page.tsx` | 1 sprint |
| 10 | **Document Path templating** — `{year}/{Questionnaire_name}` style with firm-customizable patterns | Add `document_path_pattern` to template settings + render-time interpolation in upload pipeline | 0.5 sprint |
| 11 | **Customized Words (Variables) for outbound messaging** — `{client_fname}`, `{firm_name}`, `{required_documents}`, `{number_of_items_left}`, `{tax_year}`, `{by_due_date}`, etc. | Token-replacement layer in `services/workers/src/lib/message-templater.ts` | 1 sprint |
| 12 | **Per-question Hide toggles** — Hide "Ask Later," Hide "Upload Later," Hide "Provided Elsewhere," Hide "Not Applicable" | Per-question option flags + UI toggles in template editor | 0.5 sprint (bundled with #6) |
| 13 | **Estimated-completion-date reschedule** — client sets a date → reminders pause until that date | Extend `reminder_rules` runtime to honor `client_estimated_completion_at` field | 1 sprint |
| 14 | **Cross-questionnaire reminder consolidation** — single email for one user with multiple entity questionnaires | Reminder cron groups by `user_id` before dispatch | 1 sprint |
| 15 | **Annual Behavior toggle on templates** — auto-clone next year vs re-usable throughout year | `template.annual_behavior` boolean + Inngest cron auto-fires next year on enable | 0.5 sprint (bundled with #6) |
| 16 | **Bookmarked PDF export** with Upload Later flagged + Unanswered flagged | `services/workers/src/functions/build-workpaper-pdf.ts` | 2 sprints |
| 17 | **Preview-with-skip-logic** — firm previews the live form WITH skip logic evaluated against a hypothetical answer set | Preview mode in template editor that takes simulated answers + shows the resulting form path | 1.5 sprints |
| 18 | **Manual one-time reminder UI** — Action menu → Reminders → "Send Reminder" or "Edit Message" → "Send Now" / "Save & Do Not Send" | Action menu in client engagement page | 0.5 sprint |

**Tier-1 prioritization (4 sprints, ship first):**
1. Submit-with-pending semantics + 5-state completion model (#1, #2) — **closes Docket's biggest abandonment hole**
2. Client Entries primitive (#3) — **unlocks dependents/rentals/K-1s without code-changes per shape**
3. Custom Questionnaire pattern (#9) — **firm-side escape hatch for the actual one-offs**

**Tier-2 (after Template Editor lands):**
4. Send-time section removal + additional questions (#7, #8)
5. Document Path templating (#10)
6. Per-question Hide toggles (#12)

**Tier-3 (after Rollover Items pipe lands):**
7. Stack-with-rollover-items mechanic (#4)
8. Rollover Answers reference (#5)

---

## 11. What Docket should reject

1. **The marketing claim "AI-powered dynamic questionnaire."** Soraban's intake is decision-tree skip logic + firm-authored templates + rollover items. **There's no AI in the intake loop.** Docket should not over-promise on intake AI. The intake should be honestly described as "firm-authored adaptive forms with prior-year context" — not "AI personalizes your intake per client." Per L9: AI is invisible infrastructure; the intake should remain pro-human, not AI-as-character. **Mirror Soraban's actual mechanic, not their marketing.**

2. **The 100-page questionnaire failure mode.** Capterra reviewer Cliff S. (May 12, 2023, Partner, Accounting): *"Duplicate documents are part of the questionnaire when clients are uploading tax documents. The questionnaire can be over 100 pages because of this."* This is a **template-bloat failure mode** that happens when firms over-author every conditional branch into a giant flat template. **Docket's 25-step wizard is structurally better here** — the constraint that the form has 25 explicit steps prevents this kind of bloat. When Docket ships the template editor, **enforce a section/question count budget** with a warning ("This template has 87 questions — clients typically abandon over 60. Consider splitting into multiple templates.").

3. **The "exact string match" rollover items implementation.** *"Rollover item names must exactly match the wording used in the follow-up question, spelling, spacing, punctuation, and formatting."* This is a brittle implementation. Docket should ship **fuzzy match (Voyage embeddings + cosine similarity > 0.85)** for rollover item names, not string-equality. Voyage-3-Large is already wired (L4); use it.

4. **Support-mediated configuration for the white-label tier.** Soraban gates Custom Portal URL, Firm Glossary enablement, Provided Elsewhere removal, Twice-Daily Summary, and Portal Folder Structure customization behind email-the-CS-team. This is **operational debt that scales linearly with firm count**. Docket should ship these as self-serve from day 1 (the white-label surface is in CLAUDE.md §4 plan — keep the self-serve posture).

5. **The desktop-first intake assumption.** Multiple Capterra reviewers cited mobile as weak; Soraban's stance is "desktop-first by posture." **Docket is structurally better mobile-first.** Don't compromise this for parity-with-Soraban features.

6. **Static section navigation with no logic visualization.** The Soraban template editor shows a flat collapsed list with `1 → 1.1 → 1.1.1` indentation. A firm authoring 50+ questions with 30+ conditional branches cannot see the branch tree visually. **Docket should ship a node-graph editor view (Whimsical/Typeform Logic Map style) alongside the list view.** This is a real UX leapfrog.

7. **No mid-flow question editing.** Soraban hard-blocks editing existing questions after send. **Docket should permit mid-flow edits with audit-trail tracking** ("Firm edited Q14 wording at 3:42pm; client had already answered with old wording — preserved as historical answer; new wording shown to client on next page-load"). This is a real-world need; Soraban's "you must resend the whole questionnaire" forces firms into operational gymnastics.

8. **Pure section-pagination at the cost of step-cohesion.** Soraban's per-section UX scales to 150-question forms but loses the per-step polish Docket has. Docket should keep the step-paginated model as the default (12-minute UX target) and offer a section-pagination mode only when templates exceed 40 questions.

---

## 12. The structural choice: dynamic-form vs hard-coded-wizard

### The actual tradeoff

| Dimension | Soraban (template-editor-driven) | Docket (hard-coded 25-step wizard) |
|---|---|---|
| **Time-to-onboard a new firm** | Days-to-weeks (firm authors their template, or imports from prior tax-organizer PDF) | Zero (firm uses the wizard as-is) |
| **Per-firm customization ceiling** | High (each firm authors their own template) | Low (every firm gets the same 25 steps) |
| **Time-to-complete (client)** | 30-60min for a 100-page template; 15-30min for a tight one | ~12min target |
| **Mobile UX quality** | Variable per-template; weak on long forms | Strong (mobile-first by design) |
| **Submit-with-pending support** | Yes (Upload Later, Ask Later, Provided Elsewhere) | No (binary complete/incomplete) |
| **Skip-logic depth** | 3 levels (`1 → 1.1 → 1.1.1`) | Embedded in code per step via `isApplicable()` |
| **Per-client per-send overrides** | Yes (remove sections, add questions, toggle rollovers) | No (every client gets identical 25 steps) |
| **Repeating-data primitive (deps/rentals/K-1s)** | Yes (Client Entries) | Hand-coded per step |
| **Template versioning** | Minimal (in-place edits, no history) | N/A (code is the version, git history is the audit) |
| **Multi-tenant readiness** | Native (each firm has their own templates) | Bottlenecked (every tenant gets the hardcoded flow) |

### Recommendation: HYBRID, not either-or

**Ship a hybrid model where Docket's intake substrate supports both modes:**

1. **The default 25-step "Docket Standard" template** — a code-defined template that's the system default for new firms. The same hardcoded steps that exist today, exposed AS a template in the new substrate. Firms who don't want to author their own use this. This is structurally identical to what Docket has now, just re-platformed.

2. **The firm-authored template option** — same template substrate, but firms can author their own variants. Annual Behavior toggle, Document Path config, custom sections, Client Entries, follow-ups.

3. **Per-firm overrides on the standard template** — firms can take "Docket Standard" and *fork* it (clone-then-edit). Adds sections, removes sections, changes wording. Net result: every firm runs on the same engine, with progressively-customized templates per firm tier.

**Implementation path:**
- **Phase 1 (4 weeks):** Build the template substrate. Migrate the hardcoded 25-step wizard into a Postgres-stored template. No editor UI yet. Every firm runs "Docket Standard v1.0" (the same code-defined template, just lifted from `intake-flow.ts` to a `intake_templates` row).
- **Phase 2 (4 weeks):** Build the Template Editor UI. Firms can fork "Docket Standard," edit, save. Annual Behavior + Document Path + Customized Words ship in this phase.
- **Phase 3 (4 weeks):** Build the send-wizard. Per-client section removal, additional questions, Custom Questionnaire. Bulk-send. Scheduling.
- **Phase 4 (4 weeks):** Build the rollover items pipeline. Prior-year-data import (Lacerte / Drake / CCH / OLT browser-automated). Stack-with-rollover-items render-time merge.

**Net 16 weeks to surface-parity with Soraban on intake mechanics**, with Docket's mobile-first + step-paginated UX preserved as a differentiator.

### Why hybrid beats either pure option

- **Pure hard-coded (Docket today):** doesn't scale past tenant #1. Antonio + Vazant are fine, but tenant #2 (mid-market partner) wants their own questions, glossary, branding, etc. Hard-coded model fails at multi-firm.
- **Pure template-editor (Soraban):** loses Docket's 12-minute UX polish + mobile-first design. The "Docket Standard" floor is the on-ramp that lets a firm onboard without authoring anything; the editor is the off-ramp for firms that need more.
- **Hybrid:** preserves Docket's UX strength (mobile-first 25-step wizard as default) while adding multi-firm flexibility (firms can fork and customize).

### The narrative for the founder

Docket today has the **best 25-step intake in tax**, period. The 12-minute target, the mobile-first design, the per-step polish — all are structurally better than Soraban's 30-60min long-form questionnaire. **The "snowflake" framing is a false dichotomy.** Soraban's snowflake mechanic is mechanically (a) firm-authored skip logic, (b) prior-year rollover items, (c) send-time overrides. None of these require AI. All can be built incrementally on top of Docket's existing wizard substrate.

**The right marketing handle:** *"Docket: 12 minutes for 90% of clients, with firm-authored branches for the 10% of complex returns. Soraban: 30-60 minutes for everyone, with firm-authored branches for every complexity. We picked the cohort that matters — and built for them first."*

---

## 13. Open questions / unverifiable claims

1. **Exact voicemail TwiML script.** Soraban does not publish it. Inferred to be template-driven with `{firm_name}` and `{questionnaire_name}` tokens. Verifiable only by signing up as a Soraban customer and listening to the voicemail.

2. **The skip-logic evaluation engine — client-side or server-side?** Inferred to be client-side (instant UI response) with server-side validation at submit. Not publicly documented.

3. **The auto-save debounce interval.** Not documented. Probably 500-2000ms.

4. **Rollover Items fuzzy-match capabilities.** Docs only mention "exact match"; whether there's any pre-processing (trim whitespace, normalize punctuation) before equality check is unclear.

5. **Whether the questionnaire snapshot at send-time is full or partial.** Inferred to be full (otherwise mid-flow template edits would corrupt live instances), but not documented.

6. **Section-trigger conditions — single-condition or multi-condition?** The article says "Source Section + Trigger Question + Client's Answer Condition" — appears to be single-condition. Whether AND/OR combinations across multiple questions are supported is unclear.

7. **The maximum template size.** Not documented. The 100-page reviewer complaint suggests there's no hard cap.

8. **Client Entries — maximum entry count.** Not documented. A client with 100 rental properties presumably has an unbounded list.

9. **The "Twice-Daily Summary Notification" — exact content.** Documented as morning + evening, but the content schema is not public. Confirmed to be Soraban-Support-enabled, not self-serve.

10. **Whether Soraban supports multi-language intake (Spanish, Mandarin, etc.).** No public documentation. The Customized Words system supports token replacement but not full UI localization. **Inferred: English-only.** This is a Docket structural opportunity (per CLAUDE.md §4: bilingual support as config — Spanish, Mandarin, Vietnamese, Tagalog).

11. **Whether prior-year data import is rate-limited.** The 2-5 business day SLA suggests batch processing with capacity constraints. Not publicly stated.

12. **The exact Customer Success team size.** Important for understanding the operational cost of the support-mediated configuration model. Not publicly stated.

13. **The actual Connect (OCR) accuracy beyond the 97% marketing figure.** No third-party benchmark exists. Self-reported.

14. **Whether template export-to-PDF includes the conditional branches as separate paths.** Per `/how-to-export-a-questionnaire-template-pdf-spreadsheet`, the template can be exported, but the article doesn't clarify whether the export shows the full branching tree or a linearized form.

---

## 14. Citations

| URL | What I extracted (this pass) |
|---|---|
| `https://helpcenter.soraban.com/new-template-editor-creating-and-customizing-questionnaire-templates` | The 11 question types, 5 section types, follow-up hierarchy (3-deep max), Client Entries with Tabs, drag-drop reorder rules, copy semantics, cascade delete, preview behavior, per-question Hide toggles (Not Applicable / Ask Later / Upload Later), "Triggered by question" section conditions, Stack-with-rollover-items checkbox on Upload questions |
| `https://helpcenter.soraban.com/understanding-the-stack-with-rollover-items-feature-in-the-questionnaire-template-editor` | Rollover Items vs Rollover Answers distinction; exact-string-match brittleness; Rollover Answers shown as reference notes (not pre-filled) |
| `https://helpcenter.soraban.com/template-settings-name-annual-behavior-document-path` | Annual Behavior semantics (once-per-year vs recurring); Document Path patterning (`{year}/{Questionnaire_name}`); Action Button Text customization |
| `https://helpcenter.soraban.com/edit-questionnaire-templates` | Full article list in template-editor category: 6 articles |
| `https://helpcenter.soraban.com/send-questionnaire-templates` | Full article list in send-template category: 7 articles |
| `https://helpcenter.soraban.com/manage-and-edit-sent-questionnaires` | Full article list in sent-questionnaire-mgmt category: 11 articles |
| `https://helpcenter.soraban.com/how-to-modify-the-questionnaires-or-engagement-letter-that-ive-already-sent` | Confirmed: cannot edit questions mid-flow; can edit engagement letter (after un-signing); can add additional items via resend |
| `https://helpcenter.soraban.com/how-to-add-an-additional-question-or-document-request-to-an-already-sent-questionnaire` | Plus-icon → Request Additional Items → Question or Upload → drag handle reorder → Send Additional Items + Resend |
| `https://helpcenter.soraban.com/how-to-include-additional-questions-when-sending-a-questionnaire-template` | Send-dialog "Include Additional Questions" option; per-client overlay without altering template |
| `https://helpcenter.soraban.com/how-to-remove-sections-from-a-questionnaire-template` | Send-time X-button section removal; re-add via dropdown; per-client customization preserving template |
| `https://helpcenter.soraban.com/how-to-use-custom-questionnaire` | Custom Questionnaire (non-template ad-hoc) — toggle Question/Upload per item; Save Draft or Send Open Item |
| `https://helpcenter.soraban.com/whats-the-benefit-of-using-a-custom-item-open-item-request-vs.-asking-for-the-document-through-conversation-vs.-requesting-an-additional-item-through-an-existing-questionnaire` | Three doc-request mechanisms compared: Custom Item (Open Item Request) / Additional Item on existing questionnaire / Conversation attachment |
| `https://helpcenter.soraban.com/how-to-create-a-template-link-in-questionnaire-template-editor` | Template Links: shareable URL + QR code for self-service client signup; new vs existing client flows |
| `https://helpcenter.soraban.com/how-to-send-questionnaires-to-individual-or-multiple-clients` | Three send paths (Collect / Entities / Dashboard); bulk selection mechanics; Scheduled/Recurring Delivery option |
| `https://helpcenter.soraban.com/how-do-automatic-questionnaire-reminders-work` | 7-day default; stop conditions (due-date passed, completed, locked, 1-year ceiling); estimated-completion-date reschedule behavior |
| `https://helpcenter.soraban.com/how-to-change-the-questionnaire-reminder-frequency` | 7-day default + 3-day minimum + firm-wide (not per-questionnaire) frequency setting |
| `https://helpcenter.soraban.com/reasons-why-questionnaire-reminders-stop-going-out-to-clients` | Four reasons: due-date timing, status, manual disable, 1-year cutoff |
| `https://helpcenter.soraban.com/how-to-disable-questionnaire-reminders` | Per-questionnaire (Action menu); bulk; post-completion (lock); firm-wide (frequency=999) |
| `https://helpcenter.soraban.com/how-to-manually-send-a-one-time-questionnaire-reminder` | Action menu → Reminders → Send Reminder / Edit Message; one-off doesn't change defaults |
| `https://helpcenter.soraban.com/customized-words-variables-new` | Full variable inventory (~25 tokens) across questionnaire, user, entity, tax-return categories; replacement in email/SMS/in-app outbound messaging |
| `https://helpcenter.soraban.com/firm-glossary` | Jargon tooltips; case-insensitive matching; hover/tap reveal; CS-team-enabled (not self-serve) |
| `https://helpcenter.soraban.com/remove-the-provided-elsewhere-button-in-the-questionnaire-new` | Provided Elsewhere button removable firm-wide via support; "restrict client uploads outside questionnaires" related setting |
| `https://helpcenter.soraban.com/how-to-check-the-clients-missing-documents` | Missing-doc surfacing: hover-tooltip + per-questionnaire checklist; no top-level firm-wide queue documented |
| `https://helpcenter.soraban.com/how-to-add-videos-to-sections-in-the-template-editor` | Loom iframe paste; section-level embedding only (not per-question) |
| `https://helpcenter.soraban.com/portal-folder-structure-customization-soraban-help-center` | Portal Document folder structure customization — support-mediated, not self-serve |
| `https://helpcenter.soraban.com/customizing-firm-preferences` | Full list of firm-customization articles (branding, glossary, customized words, folder structure, internal statuses, groups, "Provided Elsewhere" toggle) |
| `https://www.capterra.com/p/10008641/Soraban/` | Jackson P. quote (per-client doc-request customization); **Cliff S. quote (100-page questionnaires — the template-bloat failure mode)**; Greg O. quote (recurring auto-questionnaires) |
| `https://taxhance.com/reviews/soraban` | Confirmed: triple-channel reminders (SMS + email + voicemail); auto-PDF conversion; no real-time chat; "duplicate documents inflate questionnaire length" |
| `SORABAN-FEATURE-UX-DEEP-DIVE-2026-05-13.md` (prior research) | Companion doc cross-referenced for the broader intake surface; specifically reused: §2 Step 7 reminder cadence; §2 Step 12 white-label inventory; §2 Step 11 mobile UX gaps |

---

*Authored 2026-05-14 as a focused deep-deep-dive on the founder's specific question: "How does Soraban handle each client being different?" Answer in one line: **firm-authored templates with skip logic + prior-year rollover items + send-time per-client overrides — no AI inference in the intake loop, despite the marketing.** Docket's right path is the hybrid model (§12): keep the 25-step wizard as "Docket Standard," ship the template substrate underneath, let firms fork for customization. This closes the multi-firm-readiness gap without sacrificing Docket's mobile-first 12-minute UX moat.*
