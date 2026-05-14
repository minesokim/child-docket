# CLAUDE.md Draft Edits — 2026-05-14 Session

> Draft patch for review before applying to `CLAUDE.md`. 20 surgical edits
> across 8 sections, derived from the product-design Q&A + competitor
> research (Ping audit-trail UX + Composio detailed mechanics) completed
> this session.

## How to use this file

Each edit is shown as one of three operation types:

- **MODIFY** — find existing text, replace with new
- **ADD** — insert new text at a specific anchor
- **REPLACE** — full section replacement

Once approved, these get applied as targeted `Edit` tool calls and
committed as `docs(claude-md): integrate competitor research + product
Q&A decisions from 2026-05-14 session`. Docs commits skip the
protocol-gate trailer block per CLAUDE.md §23.

## Summary of changes

| # | Section | Type | One-line change |
|---|---|---|---|
| 1 | §4 Client Portal | MODIFY | Reinforce L9: AI-drafted outreach signed under preparer's name; AI is invisible to client |
| 2 | §4 Command Room | ADD | Memory citation footer on every AI-drafted message (preparer-only visibility) |
| 3 | §4 Command Room | ADD | Call recording via Twilio Conference API merge-pattern (Option A1) + outbound forwarding (Option A2) |
| 4 | §4 Command Room | ADD | Channel-detection per-client `channel_activity` table with reply-as-strongest-signal rules |
| 5 | §4 Command Room | MODIFY | Inbox Drafter mechanics correction — context-based AI drafts, NOT pre-written templates |
| 6 | §4 Command Room | ADD | Ask Docket three entry points (Cmd+K / side panel / full page) + optional client-pill scoping |
| 7 | §4 Command Room | MODIFY | Three-scope chat clarified + FactChip/Tipping Point inline assumption-toggling |
| 8 | §4 Command Room | REPLACE | Audit Trail UI — full rewrite with three-lane attribution, tier pill, Rewind affordance, IRS-defensible PDF export |
| 9 | §4 Command Room | ADD | Rewind primitive clarified — append-only chain, reversal = new audit row |
| 10 | §6 Tech foundation | MODIFY | Outcome predictor: V1 LLM-driven, V2 native classifier. Blue J partnership skipped. |
| 11 | §8 Intelligence layers | REPLACE | Discovery Agent scope expanded from "deductions" to 9 categories |
| 12 | §8 Intelligence layers | ADD | Notification routing: SMS via Twilio default, paused when client active in portal (60-sec idle), Quiet Hours respected |
| 13 | §9 Agent fleet | ADD | Critical boundary: Docket NEVER auto-files / auto-pushes / auto-submits without preparer authorization per trust escalation L1-L4 |
| 14 | §9 Agent fleet | MODIFY | Discovery vs Tax Reviewer as TWO distinct agents (continuous scanner vs filing-time gate) |
| 15 | §9 Agent fleet | ADD | Memories Curator UX matches Ping's pattern (per-client sidebar, source-link click-through, pin/edit/add, search, version-history changes bar) |
| 16 | §9 Agent fleet | MODIFY | SOP generator deferred to V1.5/V2 (explicit deprioritization) |
| 17 | §10 MCP server roster | REPLACE | Composio hybrid pattern with corrected architecture, full curated connector list, IntegrationProvider boundary, wean-off plan |
| 18 | §11 Design system | ADD | Memos as first-class — six reasons documented (audit defense / §6694 doc / continuity / pattern reuse / client trust / pricing leverage) |
| 19 | §18 Repo conventions | ADD | Document naming convention configurable in Settings → Firm Preferences with default template + variable substitution |
| 20 | §23 Skill routing | ADD | New competitor-research docs added to canonical reference list |

---

## Detailed edits

### Edit 1: §4 Client Portal — AI is invisible (reinforce L9)

**Type:** ADD
**Location:** §4 Client Portal subsection, after "Mediated by AI, gated by Antonio."

**Content to add:**

```markdown
**Critical: every client-facing message is preparer-reviewed and signed
under the preparer's name.** AI drafts; preparer reviews; preparer
sends. The text that lands on Maria's phone has Antonio's name signed
at the bottom, written in Antonio's voice (learned from past sent
messages). Antonio can edit before sending. Per L9: AI is invisible
infrastructure; the conversation is between client and preparer; the
client should never know AI noticed something, only that their
preparer is on top of things.

The single design test: if a Memory-triggered outreach (e.g., the
AOTC reminder when a client's kid starts college) would feel "creepy"
or "surveillance-like" to the client, the framing is wrong. Always
lead with the relationship moment, not the data point. *"Congrats to
Lily on UC Davis!"* not *"Your daughter Lily starts UC Davis this
fall."* The preparer's review pass catches creepiness.
```

**Rationale:** The "six months later text" pushback this session
revealed the L9 lock wasn't operationalized in the AI-drafting
pipeline. Make it explicit.

---

### Edit 2: §4 Command Room — Memory citation footer on AI drafts

**Type:** ADD
**Location:** §4 Unified Inbox subsection, after the existing description of "AI drafts replies pulled from real client state."

**Content to add:**

```markdown
**Every AI-drafted message surfaces its source memories in a footer
visible to the preparer only (NOT to the client).** Example footer:

> ─────────────────────────────────────
> Sources for this draft:
> • Memory #142: "Daughter Lily — UC Davis fall 2026"
>   (from intake answer 2024, page 18)
> • Memory #156: "AOTC eligibility — MAGI within range"
>   (from prior-year return analysis 2025-04)
> • Trigger: Nudges Agent — life-event detector
>   (fired on 2026-08-01, 60 days pre-college-start)
> ─────────────────────────────────────

The preparer can trace exactly which memories drove the AI's draft. If
a memory is wrong, edit the memory (single source of truth), AI re-
drafts. The Disagree button on the draft routes to categorized
feedback — wrong memory / wrong inference / right facts wrong
conclusion — each routes to a specific fix point. This is load-bearing
for trust calibration on AI-generated outreach.
```

**Rationale:** The user explicitly asked for memory citation on AI-
drafted outreach. Critical for trust calibration + traceability.

---

### Edit 3: §4 Command Room — Call recording mechanics

**Type:** ADD
**Location:** §4 Unified Inbox subsection, after the "voicemail transcription default substrate" mention.

**Content to add:**

```markdown
**Call recording — two mechanics, both via Twilio:**

**Option A1 (default — the Ping pattern):** Antonio dials the client
normally from his cell. Mid-call, he taps a button in the Docket
mobile app or dials a Docket Twilio number. Docket joins the call as
a third party via Twilio Conference API (merges the call legs).
Docket announces *"Joining for note-taking — recording starts now"*
to handle 2-party-consent states (CA, FL, IL, MA, etc.). Records
from join-point forward, transcribes via Deepgram Nova-3 (per L5),
files to client record. Notetaker Agent runs post-call: notes +
action items + draft follow-up queued for Antonio's review. Works
for impromptu calls — no pre-planning required.

**Option A2 (configurable — scheduled call default):** Antonio dials
a Docket-provisioned Twilio number that auto-forwards to the client.
Recording is on from the start. Better for scheduled calls; worse
for impromptu. Per-firm setting in Settings → Practice → Call
Recording.

**Video meetings (Zoom / Google Meet / Microsoft Teams):** Notetaker
bot joins the meeting as a participant. Customizable bot name +
avatar so clients see "Vazant Consulting Notes" not "Docket Bot".

**In-person meetings:** Mobile recording from Antonio's phone via
PWA — tap record → upload audio → same pipeline. Antonio handles
consent at start of meeting (standard practice).

Consent: every call opens with the recording disclosure (most
restrictive 2-party state default; configurable per-firm). State-
by-state consent rules surfaced in Settings → Compliance.

Twilio implementation cost: ~$0.013/min recording + $0.0125/min
Deepgram transcription = ~$0.05 for a 5-min call. Per-call cost
trivial vs the value.
```

**Rationale:** User confirmed Option A1 (the Ping merge-call trick) as
default. Specifies the technical implementation.

---

### Edit 4: §4 Command Room — Channel-detection per-client

**Type:** ADD
**Location:** §4 Unified Inbox subsection, after the "Channel-availability icons render inline per conversation" sentence.

**Content to add:**

```markdown
**Channel-detection mechanics.** Per-client `channel_activity` table
updated by events:

| Event | Updates |
|---|---|
| Portal login | `last_portal_active_at = now()` |
| Portal message read | `last_portal_active_at = now()` |
| SMS reply received | `last_sms_active_at = now()` |
| SMS STOP received | `sms_opted_out = true` |
| Email open (pixel) | `last_email_open_at = now()` (weak — many email clients block pixels) |
| Email reply | `last_email_active_at = now()` (strong signal) |
| Click-through from email | `last_email_active_at = now()` |
| Voicemail callback | `last_phone_active_at = now()` |

Icon color computed at render time:

- `last_portal_active_at` within 24h → 🟢 portal
- else `last_sms_active_at` within 30d AND not `sms_opted_out` → 🟡 SMS
- else `last_email_active_at` within 30d → ⚫ email
- else → ⚪ stale (>30d on every channel — Touchpoint Freshness flag)

**Reply behavior is the strongest signal** — email pixels are
unreliable; SMS read-receipts only work Apple-to-Apple. The most
honest signal of "they read this channel" is "they replied here."
```

**Rationale:** User asked how channel-detection works technically. Add
the explicit mechanics.

---

### Edit 5: §4 Command Room — Inbox Drafter mechanics correction

**Type:** MODIFY
**Location:** §4 Unified Inbox subsection, the existing description of "AI drafts replies pulled from real client state."

**Find:**
> AI drafts replies pulled from real client state. Preparer approves.

**Replace with:**

```markdown
**AI drafts replies per-inbound, context-aware, NOT from pre-written
templates.** For every inbound email or SMS, the Inbox Drafter Agent:

1. **Categorizes** the inbound — label (urgent / informational /
   scheduling / doc-request / payment / etc.) renders as inline pill
   before the draft appears.
2. **Gathers context** — pulls Client Memory (per-client + firm-wide
   profile), thread history, prior preparer responses, firm SOPs, and
   any matched Smart Reply Library phrases if the inbound matches a
   known pattern.
3. **Writes the draft** — generative model writes from scratch,
   blending the client's specific facts + the inbound's specific ask
   + the preparer's voice (learned from past sent messages) + any
   applicable Smart Reply Library phrase building blocks.
4. **Surfaces as inline draft** — Approve / Edit / Discard buttons.

**Smart Reply Library** is NOT pre-written templates that get sent
verbatim. It's a firm-authored phrase library the AI *can* draw from
when appropriate. Example: Antonio has phrasing he uses every time a
client asks about refund status — that phrasing lives in the library,
and when an inbound asks about refund status, the AI's draft pulls
from it. The AI is still writing context-aware prose, not pasting a
template.

**Per-category settings** (Settings → AI Preferences → Inbox):
- Auto-draft this category? (yes / no per category)
- Auto-send if confidence > X? (no by default; L4-trust-tier firms can
  enable for low-stakes categories)
- Per-category Quiet Hours respect (always on)
```

**Rationale:** User pushed back on "pre-written drafts." Correction
based on how Ping actually does it.

---

### Edit 6: §4 Command Room — Ask Docket three entry points + client pill

**Type:** ADD
**Location:** §4 Command palette subsection, after the existing description.

**Content to add:**

```markdown
**Ask Docket — three entry points, same engine, different surfaces:**

| Entry point | Use case | Density |
|---|---|---|
| **Cmd+K command palette** | Quick lookups, single-shot questions, navigation ("go to Maria's file") | Light — answer in popup, citations collapsed |
| **Side-tab AI panel** | Conversational, persistent across the session, scoped to the current page | Medium — full chat thread, citations visible inline |
| **Full Ask Docket page** | Deep research, multi-doc analysis, scenario modeling, memo drafting | Heavy — full surface, document uploads, FactChip toggles, multi-step reasoning, export to memo |

All three share the same Research Agent. A Cmd+K answer can be
expanded into the full page.

**Optional client-pill scoping** (Ping's pattern):

- The chat input has a small pill at the bottom: `[+ Attach client]`
- Click → typeahead client picker
- Once attached: `[Maria Ortega ✕]` renders inline
- Click ✕ to remove

**When attached:** every query implicitly scopes to that client.
*"Can she claim AOTC?"* uses Maria's facts immediately — no
disambiguation.

**When NOT attached:** the AI can still query a client if the question
names them. *"For Maria Ortega, can she claim AOTC?"* → AI auto-
detects the named entity, asks *"Use Maria Ortega's current facts?
[Yes / No]"* before running, attaches the pill for the rest of the
thread.

The pill is a performance optimization (no re-typing client name) AND
a scoping guarantee (definitive "this question is about Maria").
Multi-client pills allowed for comparisons (*"Compare Maria's vs
Patel's QBI calculations"*).
```

**Rationale:** User specified the Ping client-pill pattern as a feature
to adopt.

---

### Edit 7: §4 Command Room — Three-scope chat + FactChip

**Type:** MODIFY
**Location:** §4 "Three-scope chat split" subsection, the existing description.

**Find:** The existing 3-bullet description of client / meeting / book scopes.

**Replace with:**

```markdown
**Three-scope chat split** (locked 2026-05-13 after Slant.app research,
refined 2026-05-14): the same Ask Docket surface auto-scopes to *where
the preparer invoked it*, not one global chat. Three scopes:

- **Client chat** — invoked from a client page (or `Cmd+K → @ClientName`,
  or via the client pill). Scoped to that client's facts, engagements,
  prior returns, memos, signatures, messages.
- **Meeting chat** — invoked from a meeting transcript. Scoped to that
  meeting's transcript + linked client record. Auto-extracts action
  items + commitments from the transcript.
- **Book chat** — invoked from the global palette with no client pill.
  Scoped to the entire firm's clients, engagements, calendar, position
  library. Answers cross-firm questions ("which Schedule C clients
  haven't paid Q3 estimates?").

Same model, same retrieval substrate (Voyage embeddings + Cohere
Rerank + Tier 1 federal + CA-state corpus). Scope is a system-prompt
parameter + retrieval filter, not three separate agents.

**FactChip / Tipping Point inline assumption-toggling.** When the AI
gives an answer based on assumptions, those assumptions render as
draggable chips inline in the answer text:

> **Yes.** AOTC begins phasing out at MAGI **$160K-$180K (MFJ)**. At
> Maria's **MAGI $87K** filing **MFJ**, she's well within range. — IRC
> §25A(d)(2)(B)
>
> Assumptions:
> [MAGI: $87K]  [filing: MFJ]  [dependent age: 18-22]  [enrolled half-time+]

Drag the MAGI chip to $175K → answer instantly re-runs and shows the
phase-out triggered. Drag the filing chip from MFJ to Single → answer
shifts to the single $80K-$90K phase-out. Implementation: LLM-driven
re-evaluation with cached retrieval chunks (per-flip cost ~$0.0015 via
Sonnet 4.6 cached input).

Useful for client conversations: Antonio can sit with Maria, drag the
chip live, show her *"if you do this Roth conversion, your AGI jumps,
here's how the credit shifts."*
```

**Rationale:** Clarifies the three-scope mechanism + introduces FactChip
as a core UX primitive per user feedback ("the chips are genius").

---

### Edit 8: §4 Command Room — Audit Trail UI full rewrite

**Type:** REPLACE
**Location:** §4 Audit Trail UI subsection (current content is brief and outdated).

**New content:**

```markdown
- **Audit Trail UI** — read-only view on `actions` table per client.

  **Visual model: three-lane attribution.** Every row tinted by actor
  lane — AI rows on faint blue-gray tint, human rows on cream
  (default), integration rows on faint warm-gray. The AI/human
  distinction is structurally required for audit defense (§6694 needs
  to show *who* did *what* under *whose* authority). This is a
  deliberate divergence from Ping, which conflates AI and human
  actions because their compliance bar is low.

  **Per-row content:**
  - Actor icon (AI glyph / user avatar / vendor logo for integration)
  - Timestamp (relative for recent, absolute for older)
  - Action title + 1-2 line snippet
  - **Tier pill** for tax-position actions (Tier 1 green / Tier 2
    amber / Tier 3 orange / Tier 4 red / Refused gray)
  - **Cited authority** for tax-position rows — IRC §, Treas Reg, case
    cite. Hover for full text. Click for effective-from/superseded-on
    dates + jurisdiction.
  - **Confidence** badge (H/M/L) for non-tax-position AI outputs
  - **Status pill** (open / completed / reversed / superseded)
  - **Cost telemetry** — Anthropic API cost per row (from `runDocket
    AgentWithTools` already wired)
  - **Reasoning trail** — collapsible per-step view (curated steps
    from the agent's chain-of-thought, per §9 agent contract)
  - **Rewind affordance** — "Reverse this action?" button gated by
    role + reversibility flag

  **The four AI-action-attribution states:**
  1. *AI took an action under human authority* — AI lane tint, human
     avatar in secondary slot, approval timestamp ("AI drafted ·
     approved by Antonio at 9:32 AM · sent via Gmail")
  2. *AI surfaced a recommendation* — AI lane tint, "awaiting review"
     status pill + Tier + cited authority ("AI flagged Augusta Rule ·
     Tier 2 Substantial Authority · awaiting Antonio review")
  3. *Human acted on AI suggestion* — human lane tint, small "AI-
     assisted" sub-glyph showing provenance ("Antonio sent email ·
     AI-assisted draft")
  4. *AI auto-executed under L2-L4 trust tier* — AI lane tint with
     "auto-accepted" pill + link to firm's AI Preferences config that
     authorized it (chain-of-authorization audit)

  **Filtering:** date range / actor lane / action category / Tier /
  cited authority / client / preparer / cost threshold. Persistent
  across visits via query-params (Ping pattern).

  **Search:** hybrid full-text + vector across `actions.reasoning_trail`
  + linked artifacts. Same Voyage embeddings as the rest of memory.

  **Aggregate metric strip above the feed:** actions today / this week
  / this month, breakdown by actor lane, Tier classifications surfaced,
  dollar impact ($ tax savings claimed YTD), reversals YTD,
  authority citations used YTD. This is the strategic absence in Ping
  that Docket exploits — Ping treats time-saved as a marketing claim,
  Docket surfaces it as an in-product metric.

  **Export — IRS-defensible PDF packet per engagement:**
  - All `actions` rows for the engagement, chronological, with
    reasoning trails + cited authority
  - Every Tier 2/3/4 position with the AI's recommendation, cited
    authority text, human's decision, timestamp, trust-tier config at
    decision time
  - Chain-hash audit chain verification
  - Form 8275 attachments where required
  - Client engagement letter + §7216 consent at signature
  - All sync events (Square deposit, DocuSign signature, Gmail sends,
    Twilio SMS sends, integration writes)
  - Cover page with firm PTIN + tenant ID + IRS-defensible date range

  The packet IS the §6694 defense. Antonio's two active 2026 IRS
  audits are the structural validation.

  **Client-facing year-end PDF.** Lighter version of the audit packet,
  same substrate — *"here's what we did for you this year"*. Retention
  move per Slant lessons.

  **Mobile rendering:** single-column vertical list, sticky filter
  chips, tap row → reasoning trail in bottom-sheet. Rewind affordance
  intentionally NOT shown on mobile (force desktop interaction for
  reversals).
```

**Rationale:** Full rewrite based on Ping audit-trail UX research +
user's specific feedback on Rewind mechanics + tier classification +
cited authority per row.

---

### Edit 9: §4 Command Room — Rewind primitive clarified

**Type:** ADD
**Location:** §4 Audit Trail UI subsection, after the new content from Edit 8.

**Content to add:**

```markdown
**Rewind mechanics (critical clarification):** the audit chain is
NEVER rewound. It only grows. The `actions` table is INSERT-only via
Postgres trigger; nothing edits or deletes a row. "Reverse this
action" appends a new audit row that says *"Reversal of action #X —
reason: ..."* + executes a compensating real-world action.

Both the original action and the reversal remain in the chain
forever. Auditors / Antonio / the IRS see the full history — there's
no way to make it look like an action didn't happen. Like a banking
ledger: you don't erase a charge, you post a reversal; both are
forever in the log.

**What's rewindable:**

| Action | Rewind effect |
|---|---|
| AI drafted + sent client email | Follow-up "disregard" email + flag conversation for preparer attention |
| AI tagged client as "high churn risk" | Untag, log reason for reversal |
| AI auto-classified doc as 1099-NEC | Reclassify, log + train classifier on corrected label |
| AI scheduled recurring nudge | Cancel future nudges, log decision |
| AI drafted position memo | Archive (mark superseded, never delete), allow new memo |
| Preparer accepted Tier 3 position | Mark position rejected, recompute downstream impact |
| AI pulled IRS transcript via 8821 | Can't undo at IRS — log that data was retrieved, flag as "should not have been pulled" |

**What's NOT rewindable:**

- Filed forms with the IRS (amendments are separate filings, not
  unfilings; the original is in the IRS system)
- Payments processed via Square (refund as compensating action, don't
  pretend the payment didn't happen)
- Webhooks fired to third-party systems (compensating action logged,
  third party already received the event)

Marketing handle: *"the only tax AI where every action is reversible."*
The audit chain itself remains immutable; the real-world effect is
what gets reversed, with the reversal logged permanently.
```

**Rationale:** User specifically asked about rewind mechanics + how it
isn't dangerous despite reversing actions.

---

### Edit 10: §6 Tech foundation — Outcome predictor

**Type:** MODIFY
**Location:** §6 in the row about model tiering or near where Blue J appears in §13.

**Find:** The existing line about Blue J partnership in §13 white-space bet #1 or §17.

**Replace with:**

```markdown
Outcome prediction: native compliance-first Position Framework +
cited-authority retrieval over Tier 1 federal + CA-state corpus is the
V1 deliverable. Blue J partnership deferred indefinitely;
classifier coverage gap (Blue J's ~20 modules vs Docket's 50-100
distinct positions) + price-band incompatibility ($1,498/seat-year
breaks the EA-segment $250-$1,499/mo model) documented in
`docs/competitor-research/BLUE-J-DEEP-DIVE-2026-05-13.md` and
`docs/competitor-research/BLUE-J-RESEARCH-QUALITY-MECHANICS-2026-05-13.md`.

V1 mechanism: LLM-driven prediction using retrieval over Tax Court
corpus + Claude reasoning over similar past cases + structured output
(probability distribution across outcomes + confidence interval +
explanation citing controlling cases).

V2+ moat: native predictive model trained on aggregated (anonymized,
opted-in) Docket practice ledger data — positions taken across all
customer firms + resolutions. Classical ML per issue domain
(XGBoost / random forest, mirroring Blue J's Tax Foresight pattern
but with broader coverage than their 20 classifiers).
```

**Rationale:** Deprecate Blue J partnership per the strategic
recommendation in Option D from the Blue J research.

---

### Edit 11: §8 Intelligence layers — Discovery Agent scope expansion

**Type:** REPLACE
**Location:** §8 Position framework subsection's Discovery mode bullet.

**Find:** The existing Discovery description scoped to "deductions."

**Replace with:**

```markdown
**Discovery Agent — continuous, year-round, across the entire firm's
book.** Not just deductions. Discovery surfaces **everything worth
the preparer's attention** across nine categories:

| Category | Examples |
|---|---|
| **Tax-saving opportunities** | Augusta rule eligibility · §179 unutilized capacity · S-corp election thresholds · QBI bunching · Roth conversion windows · AOTC/LLC eligibility · §199A optimization · cost segregation · charitable bunching |
| **Discrepancies (cross-doc)** | 1099-NEC says $X, Xero says $Y, bank deposits show $Z — reconcile and surface |
| **Discrepancies (YoY)** | W-2 jumped 40% → Roth conversion conversation · 1099 income tripled → entity choice review · refund dropped 60% → withholding adjustment |
| **Missing docs** | Last year had 3 1099 sources, this year only 2 — chase the missing one · prior-year Schedule C, no Schedule C this year — verify business closure |
| **Compliance gaps** | BOI not filed within 90d of formation · Statement of Information overdue · CA SoS suspension risk · payroll deadline approaching · 1099-K reporting threshold crossed |
| **Audit risk signals** | Schedule C with high meals % triggers DIF score · home office in conjunction with rental property · large Schedule A relative to AGI · cash-intensive business with low net income |
| **Strategy moments** | Business revenue crossed $250K → S-corp conversation · client crossed $1M net worth → estate planning · new state residency → multi-state apportionment · LLC formed → BOI deadline starts |
| **Cross-platform reconciliation** | Xero P&L vs bank statements vs 1099s — three-way match · QuickBooks payroll vs W-2 totals · brokerage capital gains vs 1099-B vs prior-year carryover |
| **Lifecycle / relationship** | 5th year of engagement → relationship audit · silent 90 days → check-in · payment patterns deteriorating · referral source dried up |
| **Client-side life events** | Marriage / divorce / death of spouse · child turns 17 (CTC age-out) · child starts college (AOTC) · home purchase/sale · retirement (RMD age 73) · inheritance |

Each finding carries:
- **Category tag** (one of above)
- **Severity** (informational / opportunity / risk / critical-deadline)
- **Cited authority** if it's a tax position
- **Dollar impact estimate** if computable
- **Action card** — what should Antonio do (draft email? schedule meeting? pull transcripts? calculate scenario?)

Discovery runs nightly (cron) + on-demand + event-triggered (new doc
uploaded, new YoY data point, life-event detected from connected app
data). Findings queue to the Discovery dashboard, ranked by severity
+ dollar impact.

Distinct from the Tax Reviewer Agent (see §9): Discovery is the
**proactive year-round scanner** ("what should Antonio be aware of?"),
Tax Reviewer is the **filing-time gate** ("is this return correct
before file?"). They overlap; a Discovery finding can become a Tax
Reviewer blocker.
```

**Rationale:** User explicitly pushed for Discovery to go deeper than
deductions. Documented the 9-category scope.

---

### Edit 12: §8 Intelligence layers — Notification routing

**Type:** ADD
**Location:** §8 Notifications subsection, after the existing 4-category × 3-channel table.

**Content to add:**

```markdown
**Notification routing — SMS via Twilio default, paused when client
active in portal.**

Default routing rule for **client-facing** notifications:
- If client is `is_portal_active` (websocket presence + last
  interaction within 60 seconds) → render in-app only, queue SMS for
  15-min delay, send if still nothing read in-app
- Else → send SMS immediately via Twilio
- Quiet Hours respected: never send SMS between 9pm-7am client local
  time (defer to next morning); in-app still renders if they happen
  to be in portal at midnight
- STOP handling: Twilio webhook detects STOP/UNSTOP → updates
  `sms_opted_out` → falls back to email + portal

Per-firm overrides (Settings → AI Preferences → Notifications):
- "Always send via portal first, SMS only as fallback" — for firms
  with younger clients who live in the portal
- "SMS only, never portal-first" — for firms with older clients who
  don't open the portal
- "Configure per-client" — per-client channel preference override

For **preparer-facing** notifications (Antonio's own alerts): same
4 categories × 3 channels matrix above; no portal-presence detection
(preparer is always reachable via in-app + email).

Default cadence + rate limits per CLAUDE.md §8 Automated Reminders.
```

**Rationale:** User specified the SMS-default-with-portal-pause pattern.

---

### Edit 13: §9 Agent fleet — Critical authorization boundary

**Type:** ADD
**Location:** §9 Agent contract subsection, near the existing trust escalation reference.

**Content to add:**

```markdown
**Critical authorization boundary (non-negotiable):**

**Docket NEVER:**
- Auto-files a return with the IRS or any state agency
- Auto-submits 8879 e-signature transmission
- Auto-pushes return data to OLT / Drake / Lacerte / ProConnect /
  CCH Axcess / ProSeries / any tax prep software
- Auto-files 2848 / 8821 / 8275 with the IRS
- Auto-sends client-facing communications (email / SMS / portal
  message)
- Auto-charges deposits or processes payments
- Auto-executes ANY action that touches an external system or sends
  to a client

**What Docket DOES autonomously:**
- Reads source documents
- Builds the workpaper (proposed, in Docket's internal database)
- Drafts return data in Docket's staging area (NOT pushed to tax
  software)
- Surfaces Discovery findings + Position classifications + draft 8275
  disclosures
- Generates pre-meeting briefs
- Curates Memories from interactions

**Per-action gating via trust escalation L1-L4** (per §8):
- L1 firm (Antonio's starting state): every external action requires
  explicit preparer approval click. No auto-execute.
- L2: Tier-1 positions auto-accepted into workpaper, but pushing to
  OLT still requires approval. Logged.
- L3: Tier-1-2 positions auto-accepted, pushing to OLT auto-approved
  IF return below configurable complexity threshold. Weekly L1-2
  audit review.
- L4: most autonomy — only Tier-3+ positions or unusual returns
  require human attestation.

Trust escalation is **per-firm + per-action-class**, not all-or-
nothing. Antonio can be L4 on "auto-classify documents" (low risk)
while staying L1 on "push to OLT" (high risk) — same firm, different
gates per action class. This is the line that makes Docket adoptable
where Claude Cowork isn't.
```

**Rationale:** User explicitly flagged the OLT auto-push as a "big no
no" — this needs to be a locked architectural boundary, not implicit.

---

### Edit 14: §9 Agent fleet — Discovery vs Tax Reviewer separation

**Type:** MODIFY
**Location:** §9 Agent fleet table, the Discovery / Strategy / Position rows.

**Find:** The existing single Discovery Agent description.

**Replace with:**

Add to the agent fleet table (or as a clarification note after):

```markdown
**Discovery Agent vs Tax Reviewer Agent — two distinct agents:**

| Agent | When it runs | What it looks at | Question it answers |
|---|---|---|---|
| **Discovery Agent** | Continuous: nightly cron + on-demand + event-triggered (new doc, YoY data, life event) | Client facts · source docs · YoY patterns · connected-app data (Xero/QBO) · compliance calendar · audit risk signals | *"What should Antonio be aware of about this client?"* |
| **Tax Reviewer Agent** | Filing-time gate: triggered when preparer clicks "Review before file" on a return | The completed return · the source docs · the math · the form structure | *"Is this return correct?"* |

Where they overlap:

- A Discovery finding can become a Tax Reviewer blocker. Example:
  Discovery (March) flags *"Maria's 1099-NEC totals don't match her
  Xero P&L by $4,200 — investigate."* Antonio reconciles → Tax
  Reviewer at filing time confirms the return matches the
  reconciled number → passes.
- Discovery raises a position-tier question; Tax Reviewer confirms
  the position is taken correctly on the actual return + cited
  authority is attached to the audit packet.

Different mental model, same data flowing through both. **Discovery
is the proactive scanner; Tax Reviewer is the gate before filing.**
Both are needed. Discovery is what keeps a year-round relationship
valuable. Tax Reviewer is what stops Antonio from filing a bad
return.
```

**Rationale:** User asked "is Discovery done during review for errors?
think intelligently." They're two distinct agents with overlapping
scope.

---

### Edit 15: §9 Agent fleet — Memories Curator UX

**Type:** ADD
**Location:** §9 Memory Curator Agent description.

**Content to add (extending the existing Memory Curator entry):**

```markdown
**Memories tab UX matches Ping's pattern** (the strongest steal):

- **Per-client page sidebar** — Memories rendered as primary content
  on the client page, not buried in a tab
- **Bullets organized by category** — Relationships / Business /
  Family / Preferences / Prior Positions / Communication Notes
- **Each Memory shows its source** on hover — *"from meeting
  2026-03-12"* / *"from intake answer 2024 page 18"* — clickable to
  jump to the source artifact
- **Pin button** — preparer can pin a Memory so it always renders at
  top
- **Edit button** — inline edit to correct or refine. Edit writes a
  new `client_facts` row + supersede link (audit-chain preserved).
- **Add Memory button** — manual entry when AI missed something
- **Search box** at top of the Memories panel — search across all
  Memories for this client
- **Memory changes bar** (Ping's Jan 23 pattern) — version-history
  pane for any edited/superseded Memory
- **Color treatment** — soft warm-cream panel separating Memories
  from the rest of the client page

Codebase: `apps/command-room/src/app/clients/[id]/memories/page.tsx` +
`packages/ui/src/components/MemoryCard.tsx` +
`packages/ui/src/components/MemoriesTab.tsx`. Reads from `client_facts`
table (migration 0021, already shipped).

Memory Curator Agent runs nightly: extracts plain-English Memories
from every inbound message, meeting transcript, doc parse, intake
answer → writes `client_facts` rows tagged `kind='memory'` with
`source_reference_id` linking to originating artifact.
```

**Rationale:** User said "for memory ux/ui lets mimic ping and how
they do it."

---

### Edit 16: §9 Agent fleet — SOP generator deferred

**Type:** MODIFY
**Location:** §9 SOP curator / generator entry (if it exists), or add to the "Designed but NOT built" table.

**Find:** Any existing aggressive timeline for SOP generator.

**Replace with:**

```markdown
**SOP Curator Agent** — DEFERRED to V1.5/V2 per user direction
2026-05-14. The `actions` table audit chain supports it later (pattern
detection over action sequences → SOP draft generation → review queue
→ publish). Out of scope for the wedge segment. Not building until
usage data is rich enough to derive patterns (minimum 6 months of
production usage across 20+ firms).
```

**Rationale:** User explicitly deprioritized.

---

### Edit 17: §10 MCP server roster — Composio hybrid architecture (FULL REPLACE)

**Type:** REPLACE
**Location:** §10 entirely (the current paper-plan roster).

**New content:**

```markdown
## 10. MCP server roster + integration architecture

> **Architecture locked 2026-05-14** after Composio detailed mechanics
> research + Ping audit-trail UX research. Supersedes the prior paper
> plan. Full detail in
> [`docs/competitor-research/COMPOSIO-DETAILED-2026-05-14.md`](docs/competitor-research/COMPOSIO-DETAILED-2026-05-14.md)
> and [`docs/AGENT-PLATFORM.md`](docs/AGENT-PLATFORM.md).

### The three-specialist hybrid architecture

```
                    [@docket/mcp-gateway]
                  (trust + audit + §7216 +
                    tenant routing)
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
        Composio    Browser-     Tax-vertical +
        (OAuth      automation   IRS systems +
        long-tail)  workers      research corpus
                    (Fly.io      (Docket-native
                    sandboxes)   MCP servers)
```

`@docket/mcp-gateway` (shipped C28) stays on top. It owns trust gates,
audit chain, §7216 consent gating, multi-tenant routing.
**Three downstream specialists** route through it:

1. **Composio** (rented managed service) — commodity OAuth long-tail
2. **Browser-automation workers** (Docket-owned, Fly.io sandboxed) —
   legacy tax software + IRS/state browser automation
3. **Docket-native MCP servers** (Docket-owned) — tax-vertical APIs +
   internal services + research corpus

Composio's "custom MCP" feature is "create Composio-hosted MCP
servers" — there's no documented path to register self-hosted MCP
servers behind their gateway. So **`@docket/mcp-gateway` stays on top;
Composio cannot be the umbrella.**

### Composio — the OAuth long-tail specialist

**Composio handles ~35-40 commodity connectors across V1 + V1.5.**
Tax-vertical stays Docket-native (the moat).

**Pricing**: Pro tier $229/mo (2M tool calls/mo) is the realistic
starting point — Starter $29/mo's 200K-call cap doesn't survive 10
firms doing OmniContext + meeting + doc sync. All ~1,000 toolkits
available at every tier; pricing is metered on calls, not gated by
catalog. Enterprise (custom, with VPC + BAA + DPA) from 200+ customer
firms onward.

**Day-1 wired connectors (~12, ship in 2-3 sprints for the founder-50
cohort):**

1. Gmail (Composio) — OmniContext inbox source
2. Outlook (Composio) — Microsoft parity
3. Google Calendar (Composio)
4. Outlook Calendar (Composio)
5. Zoom (Composio) — Notetaker source
6. Google Drive (Composio) — client doc receipt
7. Dropbox (Composio) — alternative doc receipt
8. OneDrive (Composio) — Microsoft parity
9. Plaid (Composio) — bank transaction reconciliation
10. Calendly (Composio) — client scheduling
11. Karbon (Composio) — for firms keeping their existing PM
12. Xero (Composio) — bookkeeping cross-check (alternative to QBO)

**Day-1 DIRECT vendor OAuth (NOT Composio):**

- **QuickBooks Online** (Direct Intuit OAuth) — load-bearing for
  trial-balance work; want direct partnership + field-level control;
  ~1 week build
- **Square** (Direct) — already in stack; Antonio uses it daily
- **Stripe** (Direct) — alternative payment processor; already in stack
- **Twilio** (Direct) — SMS + Voice + Conference API for call
  recording; already in stack
- **DocuSign (8879 KBA flow)** (Direct) — KBA per IRS Pub 1345 NIST
  IAL2 needs custom DocuSign API surface, may not be exposed through
  Composio's generic connector
- **DocuSign (everything else)** — can route through Composio for
  general document signing

**V1 expansion (~15 more connectors, 1 day each as firms request):**

- Microsoft Teams (Composio) — for Microsoft-first firms
- Google Meet (Composio) — for non-Zoom firms
- Slack (Composio) — firm-internal comms + Magic Button triggers
- Financial Cents (Composio) — PM for firms using it
- Anchor (Composio) — engagement letter + proposals
- Double (Composio) — PM for firms using it
- HubSpot (Composio) — CRM for firms using it
- SharePoint (Composio) — Microsoft-first internal SOPs
- Mailchimp (Composio) — firm newsletter / marketing automation
- Asana (Composio) — task management
- Monday.com (Composio) — task management
- ClickUp (Composio) — task management
- Fathom (Composio) — transcript import for firms using it
- Granola (Composio) — transcript import
- Otter (Composio) — transcript import
- RingCentral (Composio) — VoIP capture
- Dialpad (Composio) — VoIP capture

**V1.5 / V2 niche (case-by-case):**

- NetSuite (Composio) — mid-market ERP
- Sage Intacct (Composio) — mid-market accounting
- Salesforce (Composio) — mid-market CRM
- Box (Composio) — enterprise file storage
- Brex / Ramp / Mercury / Relay (Composio) — corporate cards + banking
- PayPal / Wave / FreshBooks (Composio) — payments + accounting long-tail
- Notion / Coda / Airtable (Composio) — internal docs/wikis
- Avalara / TaxJar (Composio if available, else direct) — sales tax
- CoinTracker / Koinly (Composio) — crypto tax
- Bill.com / Melio (Composio) — AP automation

### Browser-automation workers — the legacy tax software specialist

Long-running browser sessions in Fly.io sandboxed containers. Cannot
fit Composio's request-response model. Includes:

- **Tax software**: OLT (Antonio's primary) · Drake · Lacerte ·
  ProConnect · CCH Axcess · ProSeries · ATX · TaxWise · TaxSlayer Pro
  · UltraTax CS · GoSystem Tax RS
- **IRS systems**: Tax Pro Account · e-Services · TDS · Direct File
  partner program · IRS Solutions (private API when granted)
- **State agencies**: CA FTB · CDTFA · EDD · CA SoS · NY DTF · NY SoS
  · TX Comptroller · TX SoS · multi-state expansion (FL, IL, MA, NJ,
  PA, GA, CO)
- **BOI / FinCEN** — until FinCEN direct partner program lands
- **1099 filing services** — Tax1099 · Track1099 · efile4Biz (if API
  not available)

All audit-chained via `@docket/mcp-gateway`. Critical authorization
boundary: NEVER auto-files / auto-pushes without explicit preparer
approval per trust escalation L1-L4 (per §9).

### Docket-native MCP servers — the tax-vertical specialist

Internal MCP servers for tax-vertical capabilities + research corpus:

- **ledger** — `log_action`, `query_actions`, `get_audit_trail`,
  `get_client_state` (Wave 2, post-C30 substrate)
- **knowledge** — `search_authority`, `get_form_instructions`,
  `get_concept`, `get_playbook` (Wave 2, depends on tax-graph corpus
  ingestion)
- **documents** — `parse`, `classify`, `link`, `generate_workpaper`
- **portal** — `post_message`, `request_document`, `update_status`
- **skills** — `list`, `invoke`, `get_definition` (uses `@docket/skills`
  registry shipped C29)
- **memos** — `create`, `version`, `link`, `export` (per §11 memos as
  first-class)
- **positions** — `propose`, `classify_tier`, `accept`, `reject`,
  `superseded` (per Position Framework)
- **rules** — deterministic calculators (Schedule C, §199A, AOTC,
  bonus depreciation, etc.) per §5 Rules layer

All Docket-owned, Docket-hosted, no vendor risk.

### Vendor lock-in mitigation: the IntegrationProvider boundary

`@docket/mcp-gateway` exposes a single interface:

```typescript
interface ConnectorProvider {
  invoke(toolName: string, input: unknown): Promise<ConnectorResult>;
  oauth(firmId: TenantId, ...): Promise<OAuthFlow>;
  webhook(event: WebhookEvent): Promise<void>;
}
```

Three implementations wrap the three downstream specialists:
- `ComposioConnectorProvider` (rents Composio's managed service)
- `BrowserAutomationProvider` (Fly.io sandboxed Playwright)
- `NativeMcpProvider` (Docket-owned MCP servers)

A fourth implementation for direct vendor OAuth:
- `DirectVendorProvider` (used for QBO, Stripe, Square, Twilio,
  DocuSign-8879-KBA)

**Migration scenarios:**

- **Composio raises prices 5x:** swap `ComposioConnectorProvider`
  to `NangoConnectorProvider` (open-source self-hosted alternative,
  Apache 2.0). Per-connector migration: 2 days.
- **Composio gets acquired** (probability ~30-40% within 18 months per
  the research): 6-month wean-off plan in
  [`COMPOSIO-DETAILED-2026-05-14.md`](docs/competitor-research/COMPOSIO-DETAILED-2026-05-14.md)
  §11. Self-host Nango ($250/mo cloud or self-hosted Docker), migrate
  high-priority connectors first (Gmail, QBO).
- **Composio outage:** existing `actions` table state preserved;
  Inngest workers retry; user-visible degradation only on connectors
  routed through Composio.

### §7216 compliance posture

Composio's "metadata-only retention" claim is in tension with their
"accuracy improved through millions of real-world tool calls"
marketing. **Required before 1040 data flows through Composio:**

1. **Contractual DPA** with explicit carve-out that Docket tool-call
   payloads are NOT used for training, model improvement, or
   aggregate accuracy benchmarking
2. **§301.7216-2 "third-party service provider" carve-out** in the
   client engagement letter (already in §7216 consent flow; add
   Composio as a named processor when wired)
3. **Per-firm Composio entity_id** mapping to Docket tenant; isolated
   connected accounts per firm

For the founder-50 cohort (mostly Antonio + JBH-network firms),
Antonio can sign a §7216 consent specifically authorizing Composio
routing. At scale (100+ firms), the DPA is in writing.

### Build-vs-adopt rules (refined)

| Situation | Decision |
|---|---|
| Commodity OAuth (Gmail, Drive, Slack, Calendar, etc.) | **Composio** (long-tail) |
| Load-bearing vendor with strong direct partnership program (QBO, Stripe, DocuSign-KBA, Twilio) | **Direct vendor OAuth** |
| Legacy tax software (Drake, Lacerte, OLT, etc.) | **Docket-native browser automation in Fly.io** |
| IRS / state agency / BOI / 1099 filing | **Docket-native browser automation OR direct partner API** |
| Tax research / corpus / memos / position library | **Docket-native MCP server** |
| Tax-vertical competitor PM (TaxDome, Canopy, Liscio) | **NOT integrated — Docket replaces these** |
| Advisory-leaning PM (Karbon, Financial Cents, Anchor, Double) | **Composio integration** — firms keep these, Docket runs AI on top |
| Custom abstraction over multiple sources (client tax timeline merging Drake + IRS transcript + ledger) | **Always build native.** This is the product. |
```

**Rationale:** Full §10 rewrite reflecting the corrected Composio
architecture (gateway-on-top, not Composio-on-top) + the tax-preparer-
specific connector matrix.

---

### Edit 18: §11 Design system — Memos as first-class

**Type:** ADD
**Location:** §11 after the "Memos as first-class objects" reference.

**Content to add:**

```markdown
**Why memos are first-class (six reasons):**

1. **Audit defense.** A client gets audited in 2027 for the 2024
   return. The position memo from 2024 — citing IRC §, controlling
   case, fact pattern, EA's reasoning — IS the defense. Without the
   memo, you reconstruct reasoning two years late under pressure.
   With it, you walk into the audit with the defense pre-written.

2. **§6694 preparer-penalty regulations.** The IRS requires
   "substantial authority" documentation for positions taken. Memos
   ARE the documentation. Form 8275 disclosures reference memos.
   Without memo discipline, the EA's PTIN is exposed every time the
   firm takes a Tier 2-3 position.

3. **Continuity when staff leaves.** Antonio's associate quits. The
   new associate inherits 80 active clients. Without memos, the new
   associate rebuilds context from scratch. With memos, they read
   the firm's accumulated reasoning and onboard in days, not months.

4. **Pattern reuse.** A memo written for Client A on Augusta-rule
   eligibility is applicable to Clients B, C, D with similar fact
   patterns. Memo-as-template means the firm's tax IP compounds.
   Without it, every analysis is from scratch.

5. **Client trust.** A client asks two years later: *"Why did we
   take that position? Was it the right call?"* The memo is the
   answer — written reasoning at the moment of decision, before
   hindsight. Builds trust; protects the relationship.

6. **Pricing leverage.** A firm that delivers position memos with
   cited authority on every return charges 2-3× more than a firm
   that just files. The memo is the deliverable that justifies the
   price.

**Memo types:**
- **Position memos** — every Tier 2-4 position taken, cited authority
  + fact pattern + EA decision + 8275 if applicable
- **Advice memos** — planning conversations with clients (Roth
  conversion analysis, S-corp election timing)
- **Audit defense memos** — packaged for an actual audit
- **Planning memos** — multi-year strategy summaries
- **Engagement memos** — scope-of-work summaries

Each is **versioned, append-only, full-text + vector searchable,
bidirectionally linked** to the docs / threads / positions / other
memos that informed it. Firms with TaxDome experience think of them
as "client notes." Docket reframes them as "the firm's IP."

Marketing handle: *"Your memo library is the firm's brain. Take it
with you wherever you go."* Stronger lock-in than docs alone.
```

**Rationale:** User asked "explain why memos are important in the life
of a tax preparer." Document the reasoning so the next session reads
it cold.

---

### Edit 19: §18 Repo conventions — Naming conventions configurable

**Type:** ADD
**Location:** §18 conventions section, after the existing list of file-naming conventions.

**Content to add:**

```markdown
**Document naming conventions are configurable per-firm in
Settings → Firm Preferences → Document Conventions.**

Default template ships pre-set:
```
{ClientName} - {Year} - {DocType} - {Source}.pdf
```

Variables available:
- `{ClientName}` — Maria Ortega
- `{ClientLastName}` — Ortega
- `{Year}` — 2026
- `{TaxYear}` — 2025 (different — TY vs file year)
- `{DocType}` — W-2 / 1099-NEC / K-1 / etc.
- `{Source}` — Acme Corp / Schwab / etc.
- `{Date}` — 2026-04-12
- `{EngagementID}` — VAZ-2026-OR-001

Live preview as firm edits. Firms with existing conventions (e.g.,
`Last_First-TY-DocType` patterns common in the EA segment) edit
once and apply across the firm.

Same configurable pattern applies to:
- Memo naming
- Engagement folder structure
- Audit-packet PDF names
- Workpaper PDF names
- Bookmarked-doc PDF names

Per-firm config stored in `tenant_settings.document_conventions
JSONB` column. Docket-internal references (`actions` table,
`documents.path`) use canonical IDs; firm-facing displays render
via the configured template.
```

**Rationale:** User said "let's have a default but configurable in
settings."

---

### Edit 20: §23 Canonical reference docs — Add new competitor research

**Type:** ADD
**Location:** §23 canonical reference list.

**Content to add (extending the existing list):**

```markdown
- [`docs/competitor-research/PING-FEATURE-UX-DEEP-DIVE-2026-05-13.md`](docs/competitor-research/PING-FEATURE-UX-DEEP-DIVE-2026-05-13.md)
  — Ping feature + UX inventory (visual identity tokens, 30+ feature
  decompositions, Tier-1/2/3 steal list, codebase paths). Re-read
  before any product-design decision touching meeting/email/memory
  surfaces.
- [`docs/competitor-research/PING-AUDIT-TRAIL-UX-2026-05-14.md`](docs/competitor-research/PING-AUDIT-TRAIL-UX-2026-05-14.md)
  — Ping audit-trail UX decomposition (audit-as-quality-of-every-
  surface IA, three-lane attribution divergence, IRS-defensible PDF
  export). Re-read before Audit Trail UI implementation.
- [`docs/competitor-research/SORABAN-DEEP-DIVE-2026-05-13.md`](docs/competitor-research/SORABAN-DEEP-DIVE-2026-05-13.md)
  — Soraban strategic + intake mechanics + ProConnect credential-share
  hack pattern (security anti-pattern Docket must refuse).
- [`docs/competitor-research/SORABAN-FEATURE-UX-DEEP-DIVE-2026-05-13.md`](docs/competitor-research/SORABAN-FEATURE-UX-DEEP-DIVE-2026-05-13.md)
  — Soraban feature + UX inventory (intake anatomy, voicemail bot,
  "Upload Later" marker, per-tax-software import UX).
- [`docs/competitor-research/BLUE-J-DEEP-DIVE-2026-05-13.md`](docs/competitor-research/BLUE-J-DEEP-DIVE-2026-05-13.md)
  — Blue J strategic deep-dive ($1,498/seat-year, distribution moat,
  why partnership thesis dies for Docket).
- [`docs/competitor-research/BLUE-J-RESEARCH-QUALITY-MECHANICS-2026-05-13.md`](docs/competitor-research/BLUE-J-RESEARCH-QUALITY-MECHANICS-2026-05-13.md)
  — Blue J research quality mechanics + Docket's 6-week build plan to
  80% parity using Anthropic Citations API + Voyage + Cohere Rerank +
  Position Framework refusal floor.
- [`docs/competitor-research/COMPOSIO-DETAILED-2026-05-14.md`](docs/competitor-research/COMPOSIO-DETAILED-2026-05-14.md)
  — Composio detailed mechanics (pricing × catalog matrix, custom MCP
  limits, §7216 DPA requirements, 6-month wean-off plan for 30-40%
  acquisition-probability risk).
```

**Rationale:** New canonical references from this session need to be in
the boot-up reading list.

---

## What I'm NOT changing (intentionally)

- The five business-function pillars (OmniContext / Position Framework
  / Docket Prep / Strategy / Year-Round Representation) — these stay
  intact. The product structure is right.
- The two AI capabilities framing (Docket Research + Docket Cowork) —
  surfaces from prior turn, optional addition if user wants to lock it.
- The L1-L16 locks — unchanged.
- §3 Persona — Antonio detail unchanged.
- §11 Design system — the two visual languages (editorial-warm portal
  + operational-modern command-room) stay locked.
- §13 White-space bets — unchanged except the Blue J partnership
  reference (Edit 10).
- §14 Explicit NOs — unchanged.
- §15 Build order — unchanged (the phased plan still holds; this
  session refined the within-phase items but not the phase boundaries).
- §16 Productization — unchanged.
- §17 Competitive landscape — unchanged (the competitor-research docs
  are the deep-dive; §17 stays as the cross-reference).
- §22 Boot-up pointers — minor: add the new research docs to read
  list (covered in Edit 20).

## Next steps

1. **You review this file.** Mark any edits to revise or reject.
2. **You confirm:** "Apply edits 1, 3, 5-20" (or whatever subset works).
3. **I apply** as targeted Edit tool calls + commit as
   `docs(claude-md): integrate competitor research + product Q&A
   decisions from 2026-05-14 session`.
4. **No protocol-gate trailers needed** — docs commits skip Score /
   Align / Craft / Codex per §23.

Estimated CLAUDE.md size delta: +800 lines (mostly the §10 rewrite +
the §4 audit trail rewrite + the Discovery scope expansion). Current
1,305 → projected 2,105.
