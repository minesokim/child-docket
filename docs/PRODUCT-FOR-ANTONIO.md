# Docket — What It Does, Feature by Feature

> *For Antonio. Written 2026-05-16. Easy to scan.*
> *Each feature: one sentence what it is + one paragraph what your clients see + status.*

The picture in one sentence: **Docket is your client portal + your daily operating screen + an AI layer that drafts and surfaces work, so you can double your client capacity at the same quality level.**

Three colors below mean:
- 🟢 **Live** — shipped to production. You can use it today.
- 🟡 **Partial** — working but with rough edges or limited surfaces.
- 🔵 **Planned** — designed, scheduled, not yet built.

---

## Part 1: What the client sees (the portal)

This is what your clients open on their phone.

### Sign-in by phone 🟢

A client puts in their phone, gets a code by text, and they're in. No password, no email-verification loop, no "I forgot which Gmail I used." The phone IS the identity. New clients get a one-time intake walk-through; returning clients land on the home tab with their current status. **What they see:** A clean phone-number field, then a 6-digit code, then their personalized welcome screen.

### Intake — 25-step guided walk-through 🟢

The client answers about themselves, their family, their state, their filing status, their income sources, their deductions, their life events — one screen at a time, on their phone, in about 10-12 minutes. Each answer is saved as they go, so if they close the browser they pick up exactly where they left. **What they see:** A progress bar across the top. A single question per screen, big tap targets, examples to the side. SSN entry uses an encrypted text field that hides what they typed. They never have to think about which screen comes next.

### Document upload — take-a-photo OR drop-a-file 🟢

The client uploads their W-2, 1099, K-1, driver's license, last year's return, etc. They can take a photo with their phone camera or drop a file. The AI classifies each document automatically (W-2 vs 1099-NEC vs 1099-K vs K-1 etc.) and extracts the fields visible on the document. The client doesn't have to label anything. **What they see:** Big "Take a photo" button or "Choose file." Real-time progress as the AI scans. A "Looks good?" review screen where they can fix the AI's classification if it got it wrong. Their phone's gallery is one tap away.

### Engagement letter sign 🟢

The client reads the engagement terms (your firm's standard letter, tenant-aware so each firm has its own), checks "I agree," and signs with their finger on the screen. The signature is captured along with the exact text of the letter they saw, hashed, and timestamped — so years later you can prove what they signed. **What they see:** A scrollable letter, a checkbox, a signature pad. One tap to "Sign and continue."

### §7216 disclosure consent 🟢

Federal law (IRC §7216) requires explicit consent before any client's tax data can be shared. Docket walks the client through this consent, gets their signature, and records it the same way as the engagement letter. **What they see:** A second scrollable disclosure, similar feel to the engagement letter, with a signature. One-time per engagement.

### Deposit gate 🟢

The final intake step asks for a $50 (or your-configured-amount) deposit via Square. Once the deposit goes through, the client is "in." **What they see:** A Square-embedded card form on the screen, no redirect, no "we'll text you the payment link" friction.

### Returning portal — 5 tabs 🟡

After intake, returning clients land in a 5-tab interface: Home, Docs, Messages, Signatures, Profile. **Today** most tabs render real data but a few are still placeholders pending production flow wiring (per the v1 build plan). **What they see:** A welcome card on Home that knows where they are in the year ("Welcome back — your 2024 return was filed in March. Anything change?"). A docs list. A message thread. A profile with their personal info + your firm info.

### 8879 e-signature flow 🔵

When their return is ready, the client gets a notification + link. They sign Form 8879 remotely with credit-bureau identity verification (LexisNexis KBA, IRS-Pub-1345-compliant). The signed envelope is captured in your audit trail with timestamps + IP + user-agent. **What they see (when shipped):** A DocuSign-embedded signing flow. They never leave the portal. They get the 5-question identity quiz before signing. Once they sign, they see "Filed by your preparer. Refund expected by [date]."

### Stage-aware status copy 🟡

The Home tab tells the client where they are in their year, in plain English. **What they see:** Different text depending on whether they're mid-intake, awaiting prep, ready to sign, filed, or in the off-season. Five canonical states, five clear sentences. No "Status: PENDING_DOCS" jargon.

---

## Part 2: What you see (the command room)

This is your daily operating screen.

### Home — Need You queue 🟡

A single screen that opens with "here's what needs your attention today," broken into 4 swim lanes: New Intakes, Ready to Prep, Ready to File, Sign & File. Each card has the client name + the situation + the impact. **What you see:** Aggregate counts at the top ("5 new intakes · 12 ready to prep · 2 ready to file"). Below, the actual cards. Click any card to open the client. Today this surface renders against real data; UI is settling.

### Clients page — three views 🟡

A list of every active client with three ways to look at it: Cards (visual, scannable, AI commentary per card), Table (dense, sortable, exportable), and Pipeline (kanban across your workflow stages). Each row has a risk-tier pill (green/amber/red) based on the AI Preferences you set. **What you see:** Default view is Cards. Click a row to drill into the client. Filter by status, search by name, sort by activity. Pipeline view is a kanban board.

### Client detail page 🟢

A drill-down on a single client: their intake answers, their documents, their messages with you, their engagement history, their audit trail of every action ever taken on their account. **What you see:** A sidebar with the client's name + photo + key facts. Tabs across the top: Overview, Docs, Messages, Activity, Audit Trail. Each tab opens to that surface for THIS client only.

### Calendar 🔵

A first-class top-level calendar that shows client meetings, filing deadlines, internal reviews, audit milestones, year-round planning touchpoints. Two-way sync with your Google Calendar. **What you see (when shipped):** Weekly view default, switch to day/month. Each event color-coded by type. Click an event → opens the client/engagement it relates to.

### Audit Trail (per client) 🟢

A read-only chronological log of every AI action, every human action, every approval, every reversal — for one client. Each row shows actor (AI / you / a vendor), timestamp, what happened, the cited authority if it touched a tax position, and the option to reverse. **What you see:** A scrollable feed. Color tinting tells you AI rows (faint blue-gray) from human rows (cream). Filter by date, actor lane, action category. Search across reasoning trails. Export the whole thing as an IRS-defensible PDF.

### Audit Trail PDF export 🟡

One click on a client's engagement → 30-90 page PDF packet for IRS audit defense. Cover page with your PTIN + tenant ID. Chronological log. Form 8275 disclosures. Engagement letter + §7216 + 8879 signatures. Every sync event, every position, every preparer approval. **What you'll see:** A standard PDF that opens in any reader. Hand it to an IRS agent. This is the §6694 defense substrate — what makes the AI safe for your PTIN.

### Discovery agent — the wedge 🟡

You run Discovery against a client's intake + documents + prior return. Discovery walks the entire Position Library for the client's facts + surfaces every defensible deduction, credit, and election — each carrying an IRC cite + tier classification (Settled / Substantial / Reasonable Basis / More Likely Than Not) + a refusal-conditions checklist to verify NONE apply before approving. **What you see:** A "Run Discovery" button on the client page. After 15-30 seconds, a list of surfaced positions with the cite, the estimated dollar impact, the audit risk, and the conditions-to-rule-out. You click "Accept" on the ones that apply, "Modify" on the ones that need adjustment, "Reject" on the ones that don't. Each click logs to the audit trail.

### Inbox drafter 🟢

When a client emails / texts / portal-messages you, the AI classifies the issue and drafts a reply in your voice. You approve with one click, edit if needed, or rewrite. **What you see:** An inbox list with each conversation. Each conversation has an auto-drafted reply at the bottom. "Send as Antonio" button on the right. The AI matches your tone based on your past sends. It never sends without your approval.

### Notice drafter 🟢

When an IRS or FTB notice arrives (CP2000, CP504, LT11, etc.), Docket's Notice Triage agent classifies it and the Notice Drafter writes the response cover letter + lists the forms to attach. You approve before send. **What you see:** A drafted response letter with your firm's signature block, a list of attachments (e.g., "Form 9465, 5564"), and a deadline note. You review, sign, and Docket files via your IRS Solutions browser-automation (when that wires up at V1.5).

### Memory curator — client facts 🟢

The AI extracts plain-English "memories" from every client interaction — life events, preferences, prior-year positions, communication style. These memories surface on the client's card so you walk into every conversation knowing the context. **What you see:** On each client's profile, a Memories tab with bullets like "Daughter Lily starts UC Davis Aug 2026 (AOTC + 529 windowing relevant)" or "Prefers SMS over email; never call between 9am-1pm — daycare hours." You can pin, edit, or delete any memory.

### Nudges — proactive client outreach 🟡

Every morning, Docket scans your book for life-event triggers (child turns 18, business hits $250K rev, S-corp election windows, etc.) and drafts proactive client outreach for you to approve. **What you see:** A "Nudges" item in your daily queue with cards like "Maria's daughter starts UC Davis Aug 25 — AOTC + 529 conversation. Draft ready." You click Approve → message goes; Edit → tweak first; Dismiss → reason logged.

### Prospects — Discovery Scan CRM 🟢

A new admin page (built today, 5/16) that tracks every Discovery Scan submission through the funnel: Submitted → Contacted → Scan sent → Converted (or Rejected). Aggregate counts at top, filter chips by status, click a row to update. **What you see:** A table sorted by most-recent submission first. Status badge per row. Dropdown to advance the status. Aggregate counter strip showing total / submitted / contacted / scan_sent / converted / rejected.

### Cost dashboard 🟢

A read-only page that shows your AI spend per day, per agent, per tenant. Catches runaway-cost scenarios before they happen. **What you see:** Daily / weekly / monthly cost rollups by agent. Outlier alarms when a single call exceeds $0.50. Trend lines.

### Trust ladder — L1 → L4 🟢

A per-firm setting that controls how aggressive the AI can be. **L1** (default): every AI external action requires your approval click. **L2**: settled-law positions auto-accept; everything else routes through you. **L3**: more auto-accept. **L4**: most autonomous (only tier-3 positions or unusual returns require human approval). You can set this per action class — be L4 on "auto-classify documents" while staying L1 on "push to OLT" — same firm, different gates per action. **What you see (today):** L1 default. Your AI Preferences page lets you toggle settings. The full L1-L4 matrix per action class is V1.5.

### AI Preferences — tone, insights, quiet hours 🟢

A settings page that controls how the AI behaves: tone (professional/warm/direct), which insights to surface, your Docket Personality (free-text firm voice notes), and Quiet Hours (suppress non-critical AI outreach during these times). **What you see:** A list of toggles and dropdowns. Changes take effect immediately on every subsequent AI run.

### Reminders + Notifications 🟢

Per-firm rules for how Docket nudges clients (missing docs, engagement letter unsigned, 8879 awaiting signature, outstanding balance, year-round planning touchpoints) AND how Docket nudges you (deadlines, AI alerts, client activity, system events). Each has its own cadence, channel preference, and quiet-hours respect. **What you see:** A settings page with 5 reminder rules and 4 notification categories × 3 channels each. Toggle on/off, set cadence.

### Projects — recurring workflows 🟡

Templated multi-client workflows: Annual Return Prep, Discovery Scan, Audit Defense Engagement, Quarterly Estimated Payments, BOI Annual Filing, Year-Round Planning Touchpoints. Each project tracks every client through every stage. **What you see:** A Projects page. Click a project to see "all 47 clients currently in Annual Return Prep + their stage." Click a client to drill in.

---

## Part 3: What's running in the background

These are AI systems you don't directly click but that work for you 24/7.

### Triage classifier 🟢

Every inbound signal (Gmail message, SMS, portal upload, manual flag) is classified into one of 11 issue types so it lands in the right swim lane on your Home queue. **Impact for you:** Nothing's left in an unread state. Every signal goes somewhere meaningful.

### Doc classifier 🟢

Every uploaded document is classified post-OCR (W-2 / 1099-NEC / 1099-K / 1099-INT / 1099-DIV / K-1 / driver's license / etc.) and the fields are extracted into structured form. **Impact for you:** You don't sort docs. They show up in the right bucket on the client.

### Audit chain — cryptographic integrity 🟢

Every action ever taken in Docket is recorded in an append-only log, each row hashed to the previous row's hash. If anyone tampered with history (even a Postgres superuser), the chain breaks and the nightly verifier catches it. **Impact for you:** Your audit defense is structurally tamper-evident. An auditor can verify the chain is intact. SOC 2 Type II evidence trail is built in.

### Per-tenant encryption (AES-256-GCM) 🟢

Every sensitive field (SSN, EIN, bank routing, authToken, etc.) is encrypted with a per-tenant data encryption key, bound to the specific tenant + client + path so the ciphertext can't be relocated. The master key is rotation-ready. **Impact for you:** Your clients' tax data is encrypted at rest. A breach of the database alone doesn't leak plaintext. The Form 8879 audit trail is cryptographically defensible.

### Webhook replay protection 🟢

Every inbound webhook (Square payment, DocuSign envelope-completed, Twilio inbound SMS) is deduplicated by a globally-unique event ID. A captured-from-the-wire valid webhook can't be replayed to flip a refund-amount, reverse a void, or spam your audit chain. **Impact for you:** Your payment records are stable. Your 8879-signed status is stable. Your audit trail is stable.

### Trust gate enforcement 🟢

Every AI action passes through a trust gate that checks the firm's trust level, the action class, and (if applicable) the position tier — and either auto-executes, queues for your approval, or refuses outright. The check is wired into the orchestrator so future agents can't accidentally bypass it. **Impact for you:** Nothing aggressive goes to the IRS without your finger on the trigger. The L1 default means you see everything before it leaves.

### Anthropic Claude + Bedrock fallback 🟢

Every AI call goes to Claude (Anthropic's primary API). If that fails (capacity, network), the call automatically routes to Bedrock-hosted Claude. **Impact for you:** Discovery doesn't break when Anthropic has an outage. Your daily workflow keeps running.

---

## Part 4: What's coming next

In rough order of when it ships. Times are best estimates, not promises.

### Next 2 weeks (5/16 → 5/30)

- **Cold outreach automation** — Apollo + Lemlist scripts to run prospect outreach at scale. Pairs with the Prospects CRM page.
- **Discovery Scan landing page polish** — the public `/scan` form for cold prospects (already live; getting copy refinements).
- **Antonio reference Discovery Scan** — Antonio gets the first production-quality scan output to share with his network.
- **Engagement letter signing dependency wiring** — last bits of the post-intake flow.

### Weeks 3-8 (5/30 → 7/11)

- **Discovery agent grounded against real Position Library** — Antonio review pass on the 20-position v0 catalog is the unlock.
- **OLT browser automation** — push Discovery findings + return data into Antonio's OLT software via Playwright.
- **IRS notice triage + drafter end-to-end** — current substrate is shipped; real-notice testing comes next.
- **Calendar surface** — your first-class daily calendar.
- **AI Tasks** — schedulable AI workflows triggered on time or events.

### Weeks 9-12 (7/11 → 7/30)

- **Mid-market partner #2 onboarded** — second firm + first multi-firm test of the platform.
- **V1 launch — practice OS public** — Docket officially in production for paying firms.
- **YC Fall 2026 application** — submitted with traction numbers.

### V1.5 (post 8/1)

- **Form 8879 KBA-backed signing live** — currently substrate-only; needs DocuSign KBA wired end-to-end.
- **IRS Tax Pro Account automation** — 2848 / 8821 / transcript pulls via the IRS Solutions browser flow.
- **Notetaker** — meeting transcription + action-item extraction.
- **Custom subdomain per firm** — `clients.vazantconsulting.com` instead of the shared docket URL.
- **Manager mission-control surface** — for firms with multiple preparers.
- **Year-round client portal** — bilateral conversation, planning touchpoints, life-event nudges.

---

## Part 5: What I'd want to look at first if I were you

If you have 30 minutes:

1. **Open the portal as a test client.** Walk through intake (`/welcome` → all 25 steps). Get a feel for the flow your real clients see.
2. **Open the command room → Clients page.** See your own client list, click into one, look at the Audit Trail tab.
3. **Open the command room → Prospects page** (new today). See the funnel CRM for Discovery Scan submissions.
4. **Run a Discovery on yourself.** Feed your own return into it. See what surfaces. The cite + tier classification + refusal conditions are the things worth checking line by line.
5. **Check the AI Preferences page.** Set the trust level. Set the tone. Set Quiet Hours. Make Docket talk like you do.

If you have an hour:

6. Above + draft a notice response on a fake CP2000 (your discretion which kind). See if the drafted letter would land at "send" or "rewrite" for you.
7. Walk through the Audit Trail PDF export on a fake client. The 30-90 page packet is the §6694 defense substrate — verify it actually says what an IRS agent would want.

---

*Last updated: 2026-05-16. Add features as they ship; update statuses as they advance.*
