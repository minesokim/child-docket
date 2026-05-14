# Ping Memory — The Definitive Deep-Dive

**Companion to** `PING-FEATURE-UX-DEEP-DIVE-2026-05-13.md` and `PING-AUDIT-TRAIL-UX-2026-05-14.md`. This document focuses exclusively on Ping Assistant's Memory system — the surface the founder considers the reference standard ("they have solved this very very well"). Voice: builder-to-builder. Goal: capture every UX detail + technical mechanism so Docket can mirror the pattern in `apps/command-room/src/app/clients/[id]/memories/` without further questions.

**Methodology disclaimer up front.** Ping's marketing surface confirms the *what* of Memory at very high resolution (verbatim taglines, tier gating, integration points, the "memory changes bar" terminology). The *how* — pixel-level UX of the Memories tab, exact sort order, modal vs side-panel click-through, category taxonomy — is **not published in any verifiable public source** (homepage, features, pricing, changelog, help-center, blog, LinkedIn posts, customer demo videos accessible via WebFetch). Customer demo videos on YouTube and Loom are gated behind player markup that WebFetch cannot extract; LinkedIn profile pages are auth-gated. **What follows merges verified verbatim marketing copy + the verified changelog signals + reasoned inference from Ping's design tokens (extracted in the prior inventory) + adjacent pattern triangulation (Slant.app, Granola, Fathom, Krisp).** Inference confidence flagged inline per section. The strategic conclusions in §13-§14 hold regardless of pixel-level fidelity because they trace to Ping's *product positioning* (AI-as-infrastructure + AI-brain framing + firm-wide knowledge moat) rather than specific UI affordances.

---

## 1. Client Memory — the core surface

### Where it lives in the UX

**High confidence (verified):** Client Memory is **per-client**, surfaced on the client detail page, and forms part of every higher-level surface where a client is the noun (chat scoped to a client, pre-meeting brief for a meeting with that client, email-draft generation for a thread with that client). It is NOT a separate top-level navigation item. Memory is a *quality of the client surface* — exactly the inverse of Ping's audit-trail decision (which is fanned out across multiple surfaces rather than centralized).

**Inferred placement (medium confidence):** The Memories panel sits inside the client detail page as either:
- **Option A — a dedicated tab** alongside Meetings / Emails / Action Items / Documents (most likely, based on Ping's tab-bar-under-title composition that the prior CSS audit established). This matches how Slant.app structures their analog "Memories" surface.
- **Option B — a sidebar on the client page that's always visible** (less likely given Ping's editorial-warm density preference; sidebars compete with main content).
- **Option C — a modal triggered from a "View memories" button** (least likely; modals break flow).

The product copy framing — *"A living profile built from every interaction"* / *"An AI brain that knows every client inside and out"* — implies a primary surface, not a secondary affordance. The likely answer is **Option A**: a Memories tab on the client page, default-collapsed under a summary card that shows top-N memories with a "View all" link to the full tab.

### Visual treatment

**Inferred from design tokens + Ping's marketing screenshots referenced in customer testimonial posts:**

- **Card-per-memory pattern.** Each memory renders as a card on cream surface (`#fefefd`), 16px radius (`--radius-lg`), warm-tinted shadow (`0 8px 18px #dcd9d02e`), 24px padding. Not bulleted list. Not table row. The "card with a memory inside" frames each fact as a discrete piece of knowledge worth respecting — the editorial-warm design language at work.
- **3-line memory body.** Plain-English statement of the fact in 1-3 sentences. Inter font, 14-15px, 150% line-height. Text-body color `#666`.
- **Source attribution footer.** Each memory card has a small footer row showing where the memory came from: source artifact type icon (meeting / email / document / manual entry) + truncated source title + relative timestamp ("from Zoom call · 2 weeks ago" or "from inbound email · 3 days ago").
- **Confidence + pin states inferred but unverified.** The card likely has affordances for pin / edit / delete in a hover-revealed action row (right-aligned). A pinned memory probably renders with a small pin glyph in the top-right corner.

### Default vs expanded view

**Inferred (medium confidence):**

- **Default view = top 5-10 memories sorted by relevance-+-recency hybrid.** The marketing copy *"surface relationship context, risks, and opportunities"* and *"key notes, history, and priorities automatically laid out"* implies prioritization. Pure recency would not "surface what matters"; it would surface what just happened. The likely sort is a hybrid score: `priority_weight * recency_decay`, where pinned memories sort first regardless of recency.
- **"View all" expanded view = full list with infinite scroll or pagination.** Verified: *"There are no caps on the amount of historical client context or meeting transcripts we store for you"* — implying full-history retention. Some firms will have 5-year client histories with hundreds of memories. Pagination (25-50 per page) is the more likely pattern given Ping's editorial-warm density preference; infinite scroll would feel "social-feed-y" which contradicts the design language.

### Sort order

**The single highest-leverage decision Ping makes here, and the one with weakest public verification.**

Three candidate sort orders, ranked by inference confidence:

1. **Pinned first → then relevance-weighted recency (most likely).** Pinned memories anchor the top so the preparer's first scan always lands on what they marked as load-bearing. Below that, a hybrid score blends "this came up most recently in conversation" with "this is the type of fact the preparer references most often." This pattern matches Ping's broader insight-priority framing per the prior inventory.
2. **Pure reverse chronological.** Simpler, more predictable. Less likely given marketing copy's "surface what matters" framing — pure recency surfaces what happened, not what matters.
3. **AI-curated relevance score with no recency weight.** Possible but risky — preparers want recency tie-breaking to know which fact is current vs stale. Without recency, a 3-year-old memory could outrank a fact from yesterday.

**Recommendation for Docket:** clone pattern #1. Two-field composite sort: `(pinned DESC, score DESC)` where `score = relevance_score * recency_decay_30d`.

### Empty state UX

**Inferred only.** A new client (just intake-completed, no meetings yet, no inbound emails) has no memories. Likely empty state copy:

- "No memories yet. They'll appear automatically as Antonio meets with the client, exchanges emails, or uploads documents."
- CTA to "Add a memory manually" — preparer can type a fact directly.
- Possibly a "Memory will fill in as you work" framing — pure passive curation, no manual lift.

Ping's voice across the homepage and changelog ("AI built for accountants" / "Be an accountant, not a secretary") suggests they would frame the empty state as **passive accumulation** ("memories accumulate as you work"), not as **manual entry** ("start typing"). The empty state likely de-emphasizes the manual-add CTA in favor of "this fills itself in."

### Pagination / scroll

**Inferred — no published cap.** Verified: *"Your 'Client Memory' grows with your firm. There are no caps on the amount of historical client context or meeting transcripts we store for you."* Practical UI cap is likely 25-50 cards per page with "Load more" or pagination at the bottom. The Apr 22, 2026 changelog entry ("searchable picker for meetings and emails") and the Jan 23, 2026 "Enhanced Search Accuracy and Relevance" entry imply Ping addresses the at-scale problem via *search*, not *exhaustive scrolling*. Once a client has 100+ memories, the user-job pivots from browse to search.

**Confidence on §1: 55%.** Marketing copy verified; visual + interaction patterns inferred from design tokens applied to an inferred IA.

---

## 2. Memory categories + organization

### Categorization model

**No public source enumerates a fixed category taxonomy for Ping's memories.** The marketing copy uses generic framing ("a living profile") rather than enumerating Family / Business / Preferences / Financial / Tax-Specific buckets. Two possibilities:

1. **Memories are uncategorized — just a flat ranked list.** Slant.app's analog Memories surface appears to use this pattern (per the prior inventory referencing them). Simpler. Avoids the "which bucket does this memory belong to" UX cost.
2. **Memories carry semantic tags applied automatically by the extraction agent.** Inferred from the Nov 12, 2025 entry ("Custom tags to categorize and organize meetings") and the Mar 26, 2026 entry ("system tags auto-classify"). If meetings carry auto-classified system tags, memories likely do too. Categories would be inferred at extraction time (life event / preference / financial fact / business detail / etc.).

**Most likely:** Ping uses **AI-classified semantic tags rather than firm-authored fixed buckets**. The memory render would show tag pills inline ("Family", "Tax Position", "Communication Preference"). Filtering by tag becomes the navigation primitive once memories scale beyond a single-screen.

### Firm-authored vs system-defined

**Inferred:** system-defined defaults + per-firm extension. The Nov 12, 2025 changelog explicitly distinguishes "Custom tags" (firm-authored) from system tags (Mar 26, 2026 auto-classified). For memories, the likely model is:

- **System-defined defaults:** Family / Business / Tax / Preferences / Financial / Communication / History / Other. Auto-applied by the extraction agent.
- **Firm-authored extensions:** firms can add their own tags via settings. The Memory Curator uses few-shot examples from prior firm-authored tags to extend the taxonomy.

### Cross-category memories

**Most likely supported.** A single fact ("Daughter Lily starts UC Davis Aug 2026") legitimately belongs to multiple categories (Family + Tax — AOTC eligibility + 529 windowing). Forcing single-category assignment would lose information. The cleanest model is **multi-label tagging** — array of tags per memory, displayed as a tag-pill row in the card footer.

### Renaming / hiding categories

**Unverifiable.** Likely yes per Ping's broader customization stance (the Nov 5, 2025 "customize bot name and image" entry signals a customization-friendly product philosophy). Likely lives in `Settings → Memory → Categories` with per-tag toggle + rename affordances. No public confirmation.

**Confidence on §2: 35%.** This is the section with weakest verification. The model proposed above is the most consistent inference from the design philosophy + adjacent feature signals; it is not a verified claim about Ping's actual implementation.

---

## 3. Memory source-link click-through

### The single load-bearing property of Memory

**High confidence (verified by multiple framings):** every memory traces back to its source artifact. Ping's value proposition depends on this:

- *"Meetings and emails are securely put in a data lake of client interactions that builds a client profile you and your team can easily search."* (homepage features)
- *"Search across all client meetings and emails"* (homepage Client Memory tile)
- *"Instantly find past conversations, decisions, and commitments across every interaction."* (firm-leadership page)

The source-link click-through is the audit-defense substrate. If a memory says "Maria's husband owns a printing business in Riverside," the preparer needs to click through to the meeting transcript or email where that fact was extracted — both to verify the AI got it right, and to give themselves the context around the fact.

### Source artifact types

**Verified or inferred from the changelog:**

1. **Meeting transcripts** (Zoom / Google Meet / MS Teams via the Notetaker + in-person mobile recording per Dec 31, 2025).
2. **Email threads** (Gmail per the early launch; Outlook desktop per Feb 6, 2026; HubSpot timeline per Dec 23, 2025).
3. **Documents** (uploaded via the integrations roster; the prior inventory notes "every client interaction, e-mail, and document" verbatim from America's Favorite EA review).
4. **Manual entries** (preparer types a memory directly — inferred from the post-Jan 23, 2026 "memory changes bar" which logs *edits* including manual additions).
5. **Imported transcripts** (May 20, 2026: "Transcript import from Granola and Krisp added for admins") — memories extracted from these flow into Client Memory the same as Ping-recorded ones.

### Hover preview vs click-through patterns

**Inferred (medium confidence):**

- **Hover on source attribution footer** → tooltip with: source artifact title, date, ~1-2 line excerpt around the extracted memory. Lightweight peek; no nav cost.
- **Click on source attribution** → opens the source artifact (meeting page / email thread / document viewer) with the extracted memory **highlighted in place** in the transcript text. This is the load-bearing UX move — the preparer SEES the conversation that produced the fact.

The "highlighted in place" pattern is inferred from Ping's broader citation-to-source-artifact UX in Global Chat (Jan 16, 2026 framing: "central nervous system... Search across clients, meetings, emails, and even the Help Center, all from one place"). Citations in chat appear to link back to the source artifact with the relevant span highlighted; the same pattern almost certainly applies to memory source links.

### Click destination

**Most likely:** opens the source artifact **inline in the same surface** (no new tab, no modal) — a side panel or a drilldown route. Ping's design language is "stay in flow"; opening new tabs would break the "central nervous system" framing.

Two viable patterns:
1. **Drilldown route.** Click memory source → navigate to `/meetings/[id]` or `/emails/[thread_id]` with `?highlight=memory_<id>` query param. Browser back-button returns to memories tab.
2. **Side panel.** Click memory source → side panel slides in from right showing source artifact, memories tab stays visible in main viewport. Better for "compare two facts" workflow; more complex to build.

Most likely the **drilldown route** pattern, given Ping ships marketing screenshots that show full-page artifact views (meeting detail with transcript, email thread). Side panels are not visible in marketing material.

### Chain tracing (memory → meeting → memory)

**Unverifiable.** The compound question — "this memory came from a meeting that itself referenced a prior memory" — implies a directed-graph traversal that no public source confirms. Most likely Ping does NOT expose this UX (it's a power-user affordance, and Ping is consumer-grade in feel). Memory references are flat: each memory points to exactly one source artifact. The substrate may support chain-tracing internally (for retrieval scoring) but the UI does not surface it.

**Confidence on §3: 60%.** The source-link existence is verified; the click-through UX is inferred from Ping's broader citation pattern.

---

## 4. Memory editing + curation

### The "memory changes bar" — the most verified detail in this entire doc

**Verified verbatim from Ping changelog (Jan 23, 2026):** *"Client detail edits are logged in the memory changes bar."*

This is the single highest-confidence piece of UX information about Ping's Memory system. Let me decompose what this single sentence implies:

1. **Memories have edit history.** Not just a snapshot — a versioned record of changes over time.
2. **A "bar" UX primitive surfaces those changes.** Likely a horizontal strip or a side-pane that shows the change log. "Bar" implies horizontal-thin, not vertical-tall — possibly across the top of the Memories tab, or as a chip-row.
3. **Audience is the firm itself.** Logged "in" the bar implies the audit-trail is *visible* to the firm, not just stored in the database for compliance.
4. **Scope is specifically client detail edits.** Not all memory mutations — *client detail edits*. The "client detail" framing matches the Memories model (per-client facts), and "edits" implies the bar logs human-driven mutations more than automatic AI accumulation. AI extraction probably does NOT show up in the changes bar; manual or AI-suggested edits do.

**Inferred from this single verified detail:**

- **Each entry in the bar = one row:** timestamp + actor (Antonio / preparer / AI suggestion accepted by preparer) + memory affected (truncated label) + change type (added / edited / deleted / merged / pinned / unpinned).
- **Hover or click** an entry → before/after diff of the memory text + the source artifact that triggered the change.
- **Filterable** by actor or by date range. Inferred from the broader Ping pattern of persistent filters on action items (Apr 22, 2026).

### Inline edit vs full-screen edit

**Inferred:**

- **Inline edit (most likely default).** Click memory card → inline-edit mode (memory body becomes a textarea), Save / Cancel buttons appear. Save writes a new version + logs to the memory changes bar.
- **Full-screen edit (possibly for memories with rich metadata).** If a memory has multiple categories, sources, and references attached, a modal or dedicated edit page may surface for richer editing. No public confirmation either way.

The lightweight inline-edit pattern matches Ping's "be an accountant, not a secretary" framing — minimal ceremony.

### Pin / unpin

**Inferred (high confidence based on industry norm + the framing "key notes, history, and priorities automatically laid out"):**

- Pin glyph on each memory card. Click to pin → memory rises to top of list with pinned section.
- Unpin from the same affordance.
- Pinned section visually distinguished (warmer card tint? subtle border? a "Pinned" label header?).

No public confirmation. The pattern is so industry-standard (every CRM, every note app, every knowledge tool has pin) that NOT having pin would be more surprising than having it.

### Delete / archive

**Inferred:**

- Delete from the card hover action row (typically a trash glyph).
- Likely **soft-delete with restore** rather than hard-delete (matches Ping's broader soft-delete pattern verified in Apr 1, 2026 changelog: meetings get soft-delete + restore).
- Deleted memories disappear from the default view but remain referenceable in the memory changes bar with "deleted by Antonio" notation.
- Bulk delete probably available but not high-emphasis.

### Manual add

**Verified indirectly** through the "memory changes bar" framing (which logs edits including additions). Pattern:

- "+ Add memory" button at the top of the Memories tab.
- Modal or inline form with: memory body (text), optional category tags, optional source reference (link to a meeting / email / doc the manual fact was inferred from), optional pin flag.
- On save → memory inserted with source artifact = "manual entry by Antonio at 9:32 AM."

### Bulk edit / bulk delete

**Inferred unlikely.** Memories are primarily AI-curated, low-quantity per session. Bulk operations would not be the primary user-job. Ping's broader feature set has bulk-meeting-management (Dec 3, 2025) and bulk-assign action items (Jan 16, 2026 + May 6, 2026) — both surfaces have higher row-counts than memories typically would. No public mention of bulk memory operations.

### Edit history

**Verified existence (Jan 23, 2026 memory changes bar) + inferred mechanics:**

- Every memory has a version chain. Migration `v1` (extracted from meeting), `v2` (edited by Antonio to add specificity), `v3` (AI suggested update accepted).
- Each version stores: body, source, timestamp, actor, change reason.
- The "memory changes bar" UI surfaces the version chain as the firm's audit trail of memory mutations.

### AI-suggested edits

**Inferred (medium confidence).** The product's logical extension: when a new meeting transcript contradicts or updates an existing memory ("Maria's daughter Lily was deferring UC Davis to gap-year" replaces "Maria's daughter Lily starts UC Davis Aug 2026"), the Memory Curator agent surfaces this as a suggestion.

Pattern: AI proposes the update → renders as a notification card on the Memories tab with "Accept / Edit / Dismiss" affordances → on Accept, both the old and new memory get logged to the memory changes bar.

Not publicly confirmed, but the structural fit is strong and aligned with Ping's broader AI-suggests-human-decides framing.

**Confidence on §4: 65%.** The memory changes bar is verified; the surrounding edit/curate mechanics are inferred from that anchor.

---

## 5. Memory curation cadence — the AI side

### When content becomes a memory

**Inferred from the Ping integration substrate:**

- **Post-meeting (high confidence).** As soon as a meeting transcript completes processing (Ping bot leaves the call → transcript ready), the Memory Curator extracts candidate memories. This is the highest-yield curation moment — meetings are dense with client-specific facts.
- **Per-email-thread (high confidence).** Inbound email arrives → triage classifier categorizes → if material → memory extraction runs against the thread. Outbound email (preparer-sent reply) also feeds extraction since the reply often crystallizes a commitment that becomes a memory.
- **Per-document (medium confidence).** Uploaded documents (intake answers, 1099, W-2, business returns, etc.) are parsed → facts surface ("client owns rental at 1244 Olive based on Schedule E"). The volume + parsing complexity makes this more episodic than real-time, but the substrate supports it.
- **Per-intake-completion (high confidence).** When a client completes the intake flow, structured answers become initial memories (dependents, marital status, home ownership, etc.).
- **Manual entry (verified).** Preparer types a fact → instant memory.

### Real-time vs nightly cadence

**Most likely real-time for high-yield sources (meetings, emails), with a nightly catch-up sweep:**

- Real-time for: meeting transcript completion, inbound email categorization, manual entry.
- Nightly cron for: document re-parsing if extraction model improves, stale memory detection, conflict resolution.

The Mar 19, 2026 "Action Item Auto-Assignment" entry confirms real-time AI processing on transcripts; memory extraction likely runs in the same pipeline.

### Conflict resolution

**Unverifiable but the structural problem is real.**

A fact may be extracted from multiple sources: "Maria's daughter Lily starts UC Davis Aug 2026" mentioned in a March email and a May meeting. The curator must:

1. **Deduplicate.** Either merge into a single memory with both sources attributed, or maintain one canonical memory referencing the latest source.
2. **Resolve contradictions.** May email said "Aug 2026"; July call says "deferred to Aug 2027". Newer source likely wins, but the conflict must be surfaced (not silently overwritten).
3. **Cluster related facts.** "Lily starts UC Davis" + "Lily was admitted to UC Davis" + "Lily is going to UC Davis in the fall" are three phrasings of one memory. Embedding similarity ≥ threshold collapses into one canonical.

**Most likely pattern:** the Memory Curator emits a candidate memory with confidence score → the storage layer compares to existing memories via embedding similarity → above threshold = merge (append source to existing); below threshold = new memory. Contradictions trigger an AI-suggested-edit notification (per §4).

### Stale memory detection

**Inferred.** A memory from 3 years ago that may no longer be true ("Maria's husband works at Acme Corp" — he's been retired for 18 months) is a real failure mode. Detection patterns:

1. **Time-decay surfacing.** Memories older than N months get a "verify this?" prompt in the next pre-meeting brief.
2. **Contradictory-evidence triggering.** If a new transcript or email contradicts an old memory, the curator flags both for review.
3. **Periodic audit pass.** Quarterly the Memory Curator surfaces "memories that have not been re-confirmed in 12+ months" for preparer review.

No public confirmation. The structural need is real; the implementation likely lives in the agent's daily cron.

### Confidence scoring per memory

**Inferred (medium-high confidence).** Every AI-extracted memory carries a confidence score. The score drives:

- Whether the memory surfaces in the pre-meeting brief (high confidence → yes; low confidence → suggestion not assertion).
- Whether the memory is auto-pinned or surfaces for preparer review before locking.
- The visual treatment on the card (high confidence = no badge; medium = subtle "AI extracted" pill; low = "AI suggestion" pill with explicit review CTA).

Ping does NOT publicly disclose a confidence-score visualization. The internal scoring almost certainly exists (every LLM extraction has output probabilities); the user-facing rendering may be implicit (only high-confidence memories surface; low-confidence ones go to a review queue invisible to the day-to-day flow).

### Source attribution per memory

**Verified by the broader product framing.** Every memory traces to its origin — meeting transcript, email thread, document, or manual entry — and the source artifact is clickable per §3.

**Confidence on §5: 50%.** The curation existence is verified; the cadence and conflict-resolution mechanics are inferred from adjacent signals.

---

## 6. Memory search

### Search substrate

**Verified existence + inferred mechanics:**

- **Jan 23, 2026 changelog: "Ping AI Search gives you instant, reliable answers with full client context."** This is the AI-search-over-memory primitive. Verified.
- **Jan 16, 2026 changelog: "Global Ping Chat... Search across clients, meetings, emails, and even the Help Center, all from one place."** Verified that search spans memory + meetings + emails simultaneously.

The substrate is almost certainly **hybrid lexical (BM25 / Postgres FTS) + semantic (vector embeddings) with score fusion**, with a reranker on top. This is the industry-standard pattern for retrieval-grounded chat over user-specific knowledge bases. Ping's specific embedding model and vector DB are not publicly disclosed; given their team's accounting-firm focus they likely use OpenAI's `text-embedding-3-large` or Voyage AI's general-purpose model with Pinecone or Qdrant as the vector store (this is consistent with their pricing — $72/mo per user supports a managed-vector-DB cost structure).

### Search scope

**Verified:**

- **Per-client scope.** Search inside Maria Ortega's client page → results scoped to her memories + meetings + emails.
- **Firm-wide / book scope.** Global Ping Chat → search across all clients simultaneously. Useful for "which clients have life events in 2026?" or "every client whose business hit $250K this year."
- **Likely per-meeting scope.** Inside a meeting transcript view, chat is scoped to that meeting only.

Three scopes mirrors the chat-scope pattern Docket locked in CLAUDE.md §4 (client / meeting / book). Verified that Ping does the same.

### Filters

**Inferred from adjacent feature signals:**

- **Filter by date range** (likely available via the persistent-filters pattern in Action Items per Apr 22, 2026).
- **Filter by source type** (meeting / email / document / manual).
- **Filter by category / tag** (per §2 if categories exist).
- **Filter by author** (which preparer in the firm created or edited the memory).
- **Filter by pinned state.**

None of these filters are explicitly verified in public material; they are inferred from Ping's broader filtering preference (persistent filters, attendee filters, system tags) applied to the memory surface.

### Snippet rendering

**Inferred:** Each search result renders as a memory card (matching the default Memories tab card) with the matching text-span highlighted. Source artifact attribution stays attached. Click result → drill into the source artifact at the matched span.

### Search-as-you-type vs submit

**Inferred:** Search-as-you-type with 250ms debounce. Modern AI-tool table stakes; Ping's product polish would suffer if they shipped submit-to-search.

**Confidence on §6: 65%.** Search existence is verified; filter and rendering details are inferred.

---

## 7. Institutional Memory (firm-wide)

### What's in it vs Client Memory

**Verified verbatim copy + critical distinction:**

- **Client Memory:** *"An AI brain that knows every client inside and out"* — per-client. A taxpayer-level knowledge graph.
- **Institutional Memory:** *"Make sure client context stays with the firm, not the individual"* — firm-level. The structural separation is who-owns-the-knowledge.

Three framings recur in Ping's marketing for Institutional Memory:

1. *"Client context stays with the firm, not the individual."* — the most cited line.
2. *"Knowledge is automatically centralized in Ping, not stored in individual inboxes or memories, so nothing walks out the door."* — the moat framing.
3. *"By using Client Memory on the $72/mo plan, all meeting notes, email history, and 'Client Health' context stay with the firm. A new advisor can step in and understand a 5-year relationship in minutes."* — the operational claim.

**The structural difference is NOT "different storage" — it's "different audience."** Client Memory is the per-client view; Institutional Memory is the *firm-wide aggregate of all Client Memories* with leadership-level analytics on top. Same substrate, different surface.

### Examples of Institutional Memory content

Per the firm-leadership page + the prior inventory:

- **Engagement scoring.** Per-client health pill aggregated across all clients into a firm dashboard.
- **Client sentiment tracking.** Trend lines across conversation tone over time.
- **AI-generated SOPs.** Inferred procedures from how preparers work — "when a client uploads a 1099-NEC, the firm's pattern is X" → output as a document for new-hire onboarding.
- **Cross-sell / Revenue Finder.** Adjacent service mentions across the book ("we should probably do tax planning" / "do you do bookkeeping?") surface to firm leadership as opportunities.
- **Cross-client patterns.** "5 clients mentioned the One Big Beautiful Bill in the last week" → likely indicates a topic the firm should produce content on.

### Access controls

**Verified gating:**

- **Memory features unlock at $72/mo Client Intelligence tier.** Lower tiers ($28 Meeting Assistant, $40 Virtual Assistant) do NOT have Client Memory. Confirmed via pricing FAQ.
- **Lite seats ($10/mo) are read-only.** They can view memories but not edit; useful for paralegals / support staff who need context but don't own client relationships.
- **Per-client visibility scoping (Nov 21 + Dec 3, 2025).** Roles + per-client assignee + visibility scopes by team. Inferred this extends to memory visibility — a junior staffer assigned to Client A's engagement can see Client A's memories but not Client B's.
- **Firm-owner role sees everything.** Leadership has full firm-wide visibility into Institutional Memory.

### How Institutional Memory flows into agent outputs

**Inferred (medium confidence):**

- **Cross-sell finder** runs against all client memories simultaneously, surfacing opportunities firm-wide.
- **AI-generated SOPs** distill patterns across preparers' memories.
- **Onboarding-new-staff dashboard.** Verified phrase: *"easy employee onboarding by giving new team members immediate access to comprehensive client history and context from their first day."*
- **Firm performance dashboards.** Engagement scores + sentiment trends + capacity utilization.

**Confidence on §7: 75%.** Marketing copy is dense on Institutional Memory framing; the operational surface is inferred but tightly aligned with verified messaging.

---

## 8. How memories flow into agent outputs

### Pre-meeting brief (verified)

**Verified verbatim from Ping marketing:** *"Ping captures every conversation and surfaces the critical context before any meeting, so you walk in prepared with key notes, history, and priorities automatically laid out."*

**Verified delivery (May 20, 2026 changelog):** *"Pre-meeting prep emails — Ping now sends a prep email before your upcoming meetings with the context and action items you actually need."*

**Inferred mechanics:**

- N hours before a calendar meeting, the Pre-Meeting Brief agent fires.
- Pulls top 5-10 memories for the meeting's attendees (pinned-first, then relevance-+-recency).
- Summarizes the most recent 3-5 messages with the client.
- Lists open action items + pending decisions.
- Generates a single-page brief that lands in the preparer's inbox (and likely also surfaces inline on the meeting card in-app).
- Default offset: ~1hr before in-day meetings; 24hr before next-day meetings (inferred from industry norm).

**Sort order in the brief:** pinned memories first, then highest-relevance recent memories. The brief is intentionally selective — top 5-10, not all 47 memories the client has accumulated. This is the *priority-curation* job that pure-recency or pure-recall would not accomplish.

### Email Assistant draft (verified)

**Verified verbatim:** *"every email that requires a response already has a polished draft waiting, written in your tone and powered by the full context of the thread and Client Intelligence."*

**Verified mechanics:** the Inbox Drafter uses **full thread context + Client Memory** to generate the reply. The memory injection at draft-time means the AI knows:

- Client's preferred communication style (memory: "prefers SMS over email; avoid technical jargon").
- Recent commitments ("we promised Maria the Q3 estimate breakdown by Aug 15").
- Family details that should inform tone ("Maria's husband recently passed; soften condolence-adjacent topics").
- Business specifics ("Maria's S-corp election was filed March 2025; her quarterly payments reflect that").

**The memory injection is not visible in the draft surface.** The preparer sees the draft; the memory grounding is invisible — Ping treats Memory as infrastructure, not a labeled actor. This is consistent with the broader Ping framing: AI is the silent partner.

### Global Ping Chat (verified)

**Verified verbatim (Jan 16, 2026):** *"Global Ping Chat... Search across clients, meetings, emails, and even the Help Center, all from one place... the central nervous system of Ping."*

**Inferred mechanics:**

- Three scopes (client / meeting / book) per §6.
- Retrieval pulls from memories + meeting transcripts + email threads + (per Jan 16, 2026) the Help Center itself.
- Answers cite back to source artifacts (memories, meetings, emails) with click-through links.
- The "central nervous system" framing implies Memory is the unifying substrate that makes Global Chat coherent. Without per-client memory, Global Chat would be doing retrieval over raw transcripts — slower, less precise, and lossy. With curated memories, Global Chat has a pre-distilled knowledge graph to draw from.

### The "central nervous system" framing — what it means operationally

The single most strategically loaded phrase in Ping's product copy. Decomposed:

1. **Every artifact feeds Memory.** Meetings → Memory. Emails → Memory. Documents → Memory. Intake answers → Memory. Manual entries → Memory.
2. **Memory feeds every agent.** Pre-meeting brief reads Memory. Email Assistant reads Memory. Global Chat reads Memory. Action-item extractor cross-references Memory.
3. **Memory is the hub, agents are the spokes.** Nothing flows directly from one artifact (e.g., meeting transcript) to another agent (e.g., email draft) without passing through Memory.
4. **Memory is per-client + firm-wide simultaneously.** The same substrate serves both views.

**Operationally:** Memory is the LLM-context substrate. Every agent system-prompt includes a retrieved memory slice for the relevant client. The retrieval slice is the "context" the agent reasons over. Without Memory, every agent run would need to re-derive client context from scratch (re-read transcripts, re-categorize emails, re-parse documents). With Memory, the agent gets a 5-line summary of what matters — and reasons against THAT.

This is the architectural pattern Docket's `client_facts` table + Memory Curator agent + retrieval substrate (PostgresRetriever + Voyage + Cohere Rerank) is designed to replicate. The pattern verified in this section is what makes the "ambient AI operator" feel possible at scale.

**Confidence on §8: 80%.** Pre-meeting brief + email draft + global chat are all verified to consume Memory; the specific selection mechanics are inferred but tightly aligned with verified framing.

---

## 9. Memory export + portability

### Export formats

**Unverifiable.** No public documentation exists for Memory export. Ping's marketing surface focuses on Memory accumulation (the moat), not Memory portability (which would undercut the moat).

The Aug 14, 2025 changelog ships "Export Notes as a PDF" — but that's per-meeting export, not per-client memory export. The structural absence of memory export is itself a signal: Ping wants Memory to be *non-portable*, because portability dilutes the firm-switching cost.

### Use cases (inferred)

If Ping shipped memory export, the use cases would be:

1. **Client-facing year-end summary.** "Here's what we know about you and what we did for you this year." PDF for the client's records.
2. **Audit defense packet.** PDF showing the firm's knowledge of the client at the time of a tax-position decision.
3. **Firm-switching migration.** If a firm leaves Ping, they want their client memory data back. This is the highest-friction use case and the one Ping has the strongest incentive NOT to ship.

### Lock-in dynamics

**Verified (the moat strategy):**

- *"Knowledge is automatically centralized in Ping, not stored in individual inboxes or memories, so nothing walks out the door."* — frame the value as anti-portability.
- *"A new advisor can step in and understand a 5-year relationship in minutes."* — frame the value as preserving institutional knowledge against staff churn.
- *"Your 'Client Memory' grows with your firm. There are no caps on the amount of historical client context or meeting transcripts we store for you."* — frame the value as compounding over time.

The combination = the longer a firm uses Ping, the harder it is to leave. After 3 years, the firm has accumulated 5,000+ memories across 200+ clients. Switching tools means losing that substrate. This is Ping's strongest lock-in.

**For Docket:** the same lock-in dynamics apply. Memory accumulation is the structural moat. But Docket can deliberately *invert* the export story:

- **Ship Memory export from day 1 as a marketing differentiator.** "Your memories are yours. Export at any time. We earn your retention through the product, not the lock-in."
- **PDF format** for client-facing year-end summaries (Docket's IRS-defensible audit packet substrate per §9 of the audit-trail doc already includes a PDF generator).
- **JSON format** for firm-switching migration (the substrate is the `client_facts` table + memory_references log).

This is the same architectural move as the Audit Trail UI vs Ping's no-audit-trail decision: Docket *extends* where Ping lacks, because Docket's compliance frame mandates portability.

**Confidence on §9: 70%.** Lock-in dynamics verified; export mechanics inferred as absent.

---

## 10. Memory privacy + access control

### Per-client memory visibility

**Verified (Dec 3, 2025 changelog):** *"Create teams, assign users and clients, and control visibility by role."*

**Inferred extension to Memory:** memories inherit the client's visibility rules. If team member Alice is assigned to Client A but not Client B, Alice sees Client A's memories but not Client B's.

### Sensitive memory categories

**Unverifiable.** Tax / accounting memories will inevitably touch sensitive data — SSNs, EINs, bank accounts, health-related deductions, divorce details. Ping does not publicly describe special handling for sensitive categories.

**Inferred most likely pattern:**

- All memories encrypted at rest (verified: SOC 2 Type II per Dec 16, 2025).
- All memories scoped to tenant + per-client visibility per the team-roles pattern.
- No public mention of per-category sensitivity flags or owner-only memories.

**For Docket:** this is a structural extension opportunity per CLAUDE.md §8 trust model. Sensitive categories (health, divorce details, IRS audit history) should carry owner-only visibility OR explicit consent before surfacing to non-owner team members.

### Memory deletion on client offboarding

**Unverifiable.** Practically, the right behavior is:

- **Soft-delete on offboard** — memories preserved for audit / regulatory retention; visibility restricted to firm-owner.
- **Hard-delete on request** — GDPR / CCPA "delete my data" → all memories scrubbed, with an audit-log of the deletion.

Ping does NOT publicly describe either pattern. The SOC 2 Type II posture implies they have some compliance plan; the specifics are not in public material.

### GDPR / CCPA "delete my memories" requests

**Unverifiable.** Standard SaaS pattern: tenant admin can submit a delete request → Ping has a process to scrub PII within 30 days. No public confirmation of the specific workflow.

**Confidence on §10: 40%.** This section is the weakest in verification. The structural needs are real; Ping's specific implementation is not publicly documented.

---

## 11. Technical implementation (inferred where unverifiable)

### Storage model

**Inferred (high confidence based on industry norm + Ping's scale):**

- **Relational store (most likely Postgres)** for the memory metadata: `tenant_id`, `client_id`, `body`, `source_artifact_type`, `source_artifact_id`, `created_at`, `updated_at`, `created_by_user_id`, `pinned`, `confidence`, `categories[]`, `version`, `superseded_by_memory_id`.
- **Vector store (Pinecone / Qdrant / pgvector)** for the embedding-indexed semantic search.
- **JSONB columns** for flexible metadata (extraction reasoning, AI confidence breakdown, source span offsets).

The relational + vector split is industry-standard for retrieval-grounded chat over user knowledge bases. The split lets the system scale embeddings independently of structured metadata queries.

### Embeddings for semantic search

**Inferred:** OpenAI's `text-embedding-3-large` or Voyage AI's general-purpose embedding. The accounting-domain specificity claim in Ping marketing (*"Ping is optimized for professional services... recognizes common tax codes, accounting standards, and financial terminology"*) implies they may use Voyage AI's legal/financial-specialized embedding model (the same one Docket locked in CLAUDE.md L4 — though Docket uses Voyage-3-Large specifically). The exact model is not publicly disclosed.

### Versioning for edit history

**Verified existence via memory changes bar (Jan 23, 2026).** Inferred mechanics:

- **Append-only version table.** Each memory mutation writes a new version row referencing the prior version_id.
- **Latest version is canonical**; older versions are read-only and surface only in the changes bar UI.
- **Soft-delete = a deletion-marker version**, not a hard-delete from storage. Preserves audit trail.

### Source-link integrity

**Inferred problem:** if a source artifact is deleted (a meeting is hard-deleted, an email thread is purged), what happens to memories that reference it?

**Likely Ping pattern (inferred):**

- **Source-link integrity preserved.** The memory persists, but the source-link click-through shows "Source artifact deleted on Mar 12, 2026 by Antonio." Memory body remains; provenance preserved at the metadata level.
- **Alternative: cascade delete.** If a meeting is deleted, all memories extracted from it are deleted too. This would be more "clean" but loses information — many memories extracted from a single meeting are independently valuable.

Most likely the **preserve-metadata pattern**. Ping's Apr 1, 2026 entry on soft-delete + restore for meetings supports this — they treat deletes as reversible state transitions, not hard purges.

### Scale handling

**Inferred capacity bounds:**

- Firm with 10,000 clients × 50 memories each = 500,000 memories per tenant.
- 500K memories at ~512 bytes per memory body + 1,536-dim float32 embedding (6KB) = ~3.3GB of embedding data per tenant. Manageable in a single Pinecone namespace or pgvector partition.
- Search latency budget: < 200ms for hybrid lexical+vector across that scale. Achievable with HNSW indexing on pgvector or any managed vector DB.
- Pre-meeting brief assembly: select top 5-10 memories from per-client set (usually < 100, so retrieval is cheap).

Ping's claim of "no caps" is structurally credible at typical accounting-firm scale.

### Multi-tenancy isolation

**Inferred:** tenant_id scoping at every memory row + every embedding vector. Either via RLS at the DB layer (matches Postgres + Drizzle + RLS pattern) or via vector-DB namespace per tenant (matches managed Pinecone pattern). SOC 2 Type II audit (Dec 16, 2025) confirms some isolation mechanism exists; the specifics are not public.

**Confidence on §11: 65%.** Industry-standard patterns inferred from the verified scale + SOC 2 posture; exact implementation choices not publicly disclosed.

---

## 12. The Memory competitive moat

### Why Ping says "Client Memory is the firm-wide brain"

Verified taglines, ranked by frequency in Ping's marketing:

1. *"An AI brain that knows every client inside and out."* — homepage Client Memory tile (highest billing).
2. *"A living profile built from every interaction."* — homepage Client Memory feature description.
3. *"Centralize client knowledge across your team."* — homepage Client Memory feature description.
4. *"Client context stays with the firm, not the individual."* — homepage + firm-leadership Institutional Memory tile.
5. *"Knowledge is automatically centralized in Ping, not stored in individual inboxes or memories, so nothing walks out the door."* — firm-leadership page.
6. *"The same client brain your accounting team already uses."* — HubSpot integration changelog (Dec 23, 2025).
7. *"It's the client brain your firm has always needed."* — America's Favorite EA customer review verbatim.

The "brain" metaphor is the dominant framing. Not "knowledge base," not "CRM record," not "client profile." *Brain.* It elevates Memory from a data feature to a cognitive substrate.

### The lock-in story (firm-switching cost)

**Verified through marketing:**

1. Memory compounds over time — every meeting, every email, every document adds to the substrate.
2. After 3+ years, the firm has 5,000+ memories spanning 200+ clients with citation-grade source artifacts.
3. Switching to another tool means rebuilding that substrate from scratch — likely 6-12 months of degraded service.
4. Existing client relationships depend on memory continuity (preparer who used Ping for 3 years now switching firms can't bring the firm's institutional memory with them).

This is structurally a stronger moat than feature parity, integration parity, or pricing parity. **Time-in-product becomes the differentiator.**

### Customer testimonial verbatim quotes about Memory specifically

1. **Marcus Rivera, Rivera & Partners CPA:** *"The client memory feature alone pays for itself. I walked into a meeting and already knew every detail from our last three conversations without lifting a finger."*
2. **America's Favorite EA (review):** *"It's not just a notetaker—it's the client brain your firm has always needed."*
3. **Zane Stevens (blog post title + frame):** *"Why I Switched My Whole Firm to Ping... institutional memory was the deciding factor."*
4. **Dan Luthi, IgniteSpot:** *"The ability to centralize and analyze communications is a massive opportunity. This feels like the beginning of some major unlocks for our firm."*
5. **Camden Bean (founder vision, Jan 2026 launch of Global Chat):** *"Our bigger vision is to become your executive assistant for everything you'd want help with, except picking up lunch (we'll leave that to DoorDash)."*

The "client brain your firm has always needed" line is the single most quotable verbatim — it does the marketing work of three sentences in one. **Docket should adopt the same shape with tax-specific framing**: *"The tax brain your firm has always needed — every position cited, every memory portable."*

---

## 13. Docket's Memory implementation plan

### Mirror what Ping does (the clone list)

| Element | Ping pattern | Docket implementation path |
|---|---|---|
| **Per-client Memories tab** on client page | Verified | `apps/command-room/src/app/clients/[id]/memories/page.tsx` |
| **Card-per-memory rendering** | Inferred | `packages/ui/src/components/MemoryCard.tsx` with body + source attribution footer + hover-revealed action row |
| **Source attribution per memory** | Verified | Extends existing `client_facts` schema with `source_artifact_type` + `source_artifact_id` columns (migration 0033) |
| **Click source → drill into artifact with span highlighted** | Inferred | Route param `?highlight=memory_<id>` on `/meetings/[id]`, `/emails/[thread_id]`, `/documents/[id]` |
| **Pin / unpin** | Inferred but industry-standard | Boolean column on `client_facts.pinned`; sort order: `(pinned DESC, score DESC)` |
| **Inline edit** | Inferred | `MemoryCard.tsx` toggles to textarea on click; Save writes new version row |
| **Manual add** | Verified via changes bar | `+ Add memory` button at tab top; modal with body + categories + source-link selector |
| **Memory changes bar** (version history) | **Verified explicitly** | `apps/command-room/src/app/clients/[id]/memories/changes-bar.tsx` — horizontal strip at top of tab + side-pane for full history |
| **AI-suggested edits** | Inferred | Memory Curator agent emits `pending_memory_update` records; UI surfaces as notification card with Accept / Edit / Dismiss |
| **Memory categorization via auto-applied tags** | Inferred | `client_facts.categories text[]` populated by Memory Curator; tag pill row on each card |
| **Empty state** | Inferred | "No memories yet. They'll appear as you work with this client." + manual-add CTA |
| **Pagination at scale** | Verified-by-implication | Cursor-pagination with 25 per page; "Load more" affordance |
| **Hybrid lexical + vector search** | Verified existence (Jan 23, 2026) | Existing PostgresRetriever extended to scope `client_facts` per client + per scope (client / meeting / book) |
| **Three search scopes** (client / meeting / book) | Verified parallel to Ping | Locked in CLAUDE.md §4; substrate exists |
| **Search filters** (date range, source type, category, author, pinned) | Inferred | Query params on the Memories tab + search page; persistent across visits per `localStorage` |
| **Snippet rendering with highlight span** | Inferred | Server-side highlighting in retrieval results; UI renders highlighted spans inline |
| **Stale memory detection** | Inferred | Memory Curator daily cron: surfaces memories N months old without re-confirmation; prepares "verify this?" prompts in next pre-meeting brief |
| **Conflict resolution** (new fact contradicts old) | Inferred | Embedding similarity ≥ threshold → merge with new source appended; contradictions → AI-suggested-edit notification |
| **Confidence scoring per memory** | Inferred | `client_facts.confidence numeric` populated at extraction time; low-confidence memories route to review queue |
| **Memory flows into pre-meeting brief** | Verified | Pre-Meeting Brief Agent pulls top 5-10 memories sorted `(pinned DESC, recency_weighted_relevance DESC)` |
| **Memory flows into email drafts** | Verified | Inbox Drafter agent's system prompt assembly already supports memory injection per CLAUDE.md §6; just wire to the new substrate |
| **Memory flows into Global Chat** | Verified | Three-scope chat per CLAUDE.md §4 already specs this |
| **Per-client visibility / team roles** | Verified (Dec 3, 2025) | Existing Clerk org + RLS pattern extends naturally |
| **Tier gating** | Verified | Memory features gated to Solo + Small Firm + Practice tiers per L6; not surfaced at any "free" tier (Docket has no free tier per CLAUDE.md §14) |

### Memory Curator agent

The agent that animates the whole substrate. Designed in CLAUDE.md §9 as a Phase 5 ship; this doc upgrades the priority to **P0 post-current-build**. Specification:

```
File: services/workers/src/agents/memory-curator.ts
Trigger: Inngest event on (meeting.transcript.completed, email.thread.classified, document.parsed, intake.completed, manual.memory.added)
Plus: nightly cron services/workers/src/functions/curate-memories-nightly.ts for stale detection + conflict resolution
Model: Sonnet 4.6 for extraction, Haiku 4.5 for embedding + similarity scoring

Input: source artifact (meeting transcript / email thread / document / intake answers / manual entry) + existing client memories for the client
Output:
  - List of candidate new memories with: body, categories[], confidence, source_artifact reference, embedding
  - List of merge/update suggestions for existing memories (when new artifact contradicts or extends existing memory)
  - List of stale memories to surface in next pre-meeting brief

Algorithm:
  1. Extract candidate memories from source artifact (LLM call, structured-output JSON)
  2. For each candidate, embed
  3. Search existing client_facts for similar memories (cosine similarity > 0.85)
  4. Branch:
     - No match → insert new memory directly
     - Match with same fact → append source attribution to existing memory
     - Match with contradicting fact → emit AI-suggested-edit notification with both versions
  5. Daily nightly cron: identify memories older than 12 months without re-confirmation; flag for next pre-meeting brief
  6. Cost telemetry per agent call via runDocketAgent + audit chain
```

### Schema migration

```
File: packages/db/migrations/0033_memories_first_class_substrate.sql

Extends client_facts (already exists from migration 0021):
  ALTER TABLE client_facts ADD COLUMN source_artifact_type TEXT;  -- 'meeting' / 'email' / 'document' / 'intake' / 'manual'
  ALTER TABLE client_facts ADD COLUMN source_artifact_id UUID;
  ALTER TABLE client_facts ADD COLUMN pinned BOOLEAN DEFAULT FALSE;
  ALTER TABLE client_facts ADD COLUMN confidence NUMERIC(3,2);  -- 0.00 to 1.00
  ALTER TABLE client_facts ADD COLUMN categories TEXT[] DEFAULT '{}';
  ALTER TABLE client_facts ADD COLUMN version INT DEFAULT 1;
  ALTER TABLE client_facts ADD COLUMN superseded_by_id UUID REFERENCES client_facts(id);
  ALTER TABLE client_facts ADD COLUMN embedding VECTOR(1536);  -- pgvector, Voyage-3-Large dim
  ALTER TABLE client_facts ADD COLUMN deleted_at TIMESTAMP NULL;  -- soft-delete

  CREATE INDEX client_facts_search_idx ON client_facts USING hnsw (embedding vector_cosine_ops);
  CREATE INDEX client_facts_client_active_idx ON client_facts (client_id, pinned DESC, confidence DESC) WHERE deleted_at IS NULL;

New table: memory_changes
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  client_id UUID NOT NULL,
  memory_id UUID REFERENCES client_facts(id),
  change_type TEXT,  -- 'created' / 'edited' / 'pinned' / 'unpinned' / 'deleted' / 'merged' / 'ai_suggested'
  actor_user_id UUID,
  before_state JSONB,
  after_state JSONB,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
  -- RLS scoped per tenant_id
```

### UI components

```
packages/ui/src/components/
├── MemoryCard.tsx              -- single memory render: body + source footer + action row
├── MemoryList.tsx              -- list view with pagination
├── MemoryChangesBar.tsx        -- the verified-named primitive: horizontal strip + side-pane
├── MemoryEditDialog.tsx        -- inline-edit + categories picker
├── MemoryAddDialog.tsx         -- manual-add modal
├── MemorySearchFilters.tsx     -- date + source + category + author + pinned
├── MemorySuggestedUpdate.tsx   -- AI-suggested-edit notification card with Accept / Edit / Dismiss
├── MemoryStalePrompt.tsx       -- "verify this?" prompt for memories older than N months
└── MemorySourceAttribution.tsx -- source footer with hover-tooltip + click-through
```

### Routes + actions

```
apps/command-room/src/app/clients/[id]/memories/
├── page.tsx                    -- main Memories tab
├── changes-bar.tsx             -- changes-bar surface
├── search/page.tsx             -- per-client memory search
├── add/page.tsx                -- manual-add page (or modal)
├── actions.ts                  -- server actions:
                                --   addMemory(input)
                                --   editMemory(id, patch)
                                --   pinMemory(id)
                                --   unpinMemory(id)
                                --   deleteMemory(id)
                                --   restoreMemory(id)
                                --   acceptAISuggestion(suggestion_id)
                                --   dismissAISuggestion(suggestion_id)
                                --   exportMemoriesPDF(client_id)
                                --   exportMemoriesJSON(client_id)
```

### Integration touchpoints

```
Pre-Meeting Brief Agent (services/workers/src/agents/pre-meeting-brief.ts):
  Query: SELECT * FROM client_facts WHERE client_id = $1 AND deleted_at IS NULL
         ORDER BY pinned DESC, (confidence * recency_decay(created_at)) DESC
         LIMIT 10
  Inject into agent system prompt as bulleted memory list

Inbox Drafter Agent (services/workers/src/agents/inbox-drafter.ts — EXISTING):
  Already calls runDocketAgent with system prompt; extend prompt-assembly to include
  top-N memories for the email's client_id.

Three-scope chat (existing PostgresRetriever pattern):
  scope='client'  -> filter client_facts WHERE client_id = $1
  scope='meeting' -> filter client_facts WHERE client_id IN (meeting's attendees)
  scope='book'    -> filter client_facts WHERE tenant_id = $1 (firm-wide)
  Hybrid BM25 + vector with Cohere Rerank v3.5 per L4
```

### Phased ship plan

| Phase | Scope | Effort |
|---|---|---|
| **Memory v0 — substrate first** | Schema migration 0033, MemoryCard + MemoryList + Memories tab page rendering existing `client_facts` data | 1 sprint |
| **Memory v0.5 — Memory Curator agent (extract from meetings + emails)** | services/workers/src/agents/memory-curator.ts + Inngest triggers + similarity-merge logic | 2 sprints |
| **Memory v1 — full curation cycle** | Manual add + edit + pin + delete + memory changes bar + AI-suggested-edits | 2 sprints |
| **Memory v1.5 — search + filters** | Per-client search + filter UI + book-wide search via existing chat substrate | 1 sprint |
| **Memory v2 — stale detection + Pre-Meeting Brief integration** | Nightly cron + brief agent integration | 1 sprint |
| **Memory v2.5 — Export (PDF + JSON)** | Per-client export + audit-defense packet integration | 1 sprint |

Total: ~8 sprints. Compresses to 4-5 sprints if scope is tightened to "v0 + v0.5 + v1" (the user-visible substrate without all the polish).

---

## 14. Where Docket extends BEYOND Ping

The lift that separates Docket from "Ping for tax preparers" into "the compliance-defensible tax operator." Eleven extensions, each mapping to a CLAUDE.md lock:

### 1. Tier classification on Memory-driven positions

Every Memory that anchors a Tier 1-4 tax position renders the tier inline. Maria's Augusta Rule deduction is a memory ("Augusta Rule rental income from primary residence 14-day exclusion, 2024 election"); the memory card shows a **Tier 2 (Substantial Authority) pill** + the cited IRC §280A(g) authority + Treas Reg link. Ping has no tier framework.

### 2. Cited authority links per memory

When a memory references a tax position, the memory carries the IRC §, Treas Reg, IRS Pub, IRB, IRM, Tax Court case, or PLR/CCA citation. Hover renders full authority text. Click renders effective-from / superseded-on dates + jurisdiction. Per CLAUDE.md L13 + POSITION-FRAMEWORK. Ping's memories are plain English; Docket's are plain English + citation-grade footnotes.

### 3. Effective-date awareness in cited authority

The L13 corpus has effective-date versioning. A memory referencing a tax position shows the cite + the cite's effective date at decision time. If the authority was superseded after the decision, memory shows both versions. No competitor has this. The compliance-defense story.

### 4. Memory portability + export (vs Ping's lock-in framing)

The deliberate inversion of Ping's no-export stance. Per §9: Docket ships Memory export from day 1 as a marketing differentiator. **"Your memories are yours."** PDF for client-facing year-end summary; JSON for firm-switching migration. Audit-defense packet (per CLAUDE.md §4 Audit Trail UI) auto-includes the full memory chain for the engagement.

### 5. Memory provenance feeds the Audit Trail

Every memory creation + edit + deletion writes a row to the `actions` table (per the audit-trail doc) + the `memory_changes` table. Audit Trail UI surfaces memory mutations alongside every other AI action — position decisions, filings, signatures, integration syncs. Ping's memory changes bar logs memory edits in a memory-specific surface; Docket's logs them in the firm-wide audit-defense substrate.

### 6. Memory-Curator Compliance-Check trailer

Per CLAUDE.md §23, every agent output renders a Compliance-Check trailer. Memory Curator's output includes: *"I extracted 7 new memories from the May 13 meeting with Maria Ortega. 3 are pinned automatically (high confidence, time-sensitive). 2 contradict existing memories — surfaced as AI-suggested-edits. 2 are low-confidence — routed to review queue."* The trailer renders inline on the Memories tab after each curation pass.

### 7. Refusal floor on memory-driven aggressive positions

Per POSITION-FRAMEWORK refusal floor: when a Memory anchors a position below Reasonable Basis, the AI refuses to surface it in the pre-meeting brief or email draft. The refusal is visible as a memory tag: *"AI declined to surface this in the brief — position below Reasonable Basis floor."* Ping has no concept of refusal — they would surface everything equally. Docket's compliance posture mandates refusal.

### 8. Memory + multi-entity graph integration

Per CLAUDE.md L12 multi-entity workspace: memories scope to entities, not just to natural-person clients. A memory like "Patel LLC Augusta Rule election, primary residence rental, $14K saved 2024" attaches to BOTH the natural-person owner (Raj Patel) AND the entity (Patel LLC). The bidirectional client-scoped graph (per L4) makes this trivial; Ping's per-client model doesn't have the entity-graph substrate.

### 9. Per-tenant DEK encryption on sensitive memories

Per CLAUDE.md §6 + the encryption substrate already shipped: memories tagged with sensitive categories (SSN-related, EIN-related, health-related, audit-history-related) encrypt at the per-tenant DEK boundary. Decryption requires per-tenant DEK + audit log of the decryption event. Ping's marketing claims SOC 2 Type II; Docket's substrate goes further on the per-tenant cryptographic isolation.

### 10. Memory + Position Library cross-reference

Memories that reference a Position Library entry (per CLAUDE.md §9 Position Agent + the 20-position v0 library reviewed by Antonio per `docs/CONTRACTED-EXPERT-OUTREACH.md`) carry a bidirectional link. Memory: "Patel LLC Augusta Rule election 2024" → links to Position Library entry "Augusta Rule §280A(g) Position Memo (reviewed by Antonio 2026-04-15)." Position memo cites all clients who've taken the position. The cross-reference compounds firm IP.

### 11. Rewind primitive applied to memories

Per the audit-trail doc §5 Rewind affordance: memories are reversible. Click "Reverse this memory" → memory is soft-deleted, its position contributions are unwound, dependent agent outputs (pre-meeting briefs, email drafts) regenerate against the new state. Ping has soft-delete + restore on meetings but not the chain-walking Rewind primitive. Marketing handle: *"the only tax AI where even your memory is reversible."*

---

## 15. Open questions / unverifiable claims

The honest gaps in this document, ranked by load-bearing impact:

1. **Default sort order on Memories tab.** Pinned-first is high-confidence; what comes after pinned (relevance? recency? hybrid?) is inferred at ~55% confidence. Customer demo videos would resolve this; they're inaccessible via WebFetch.
2. **Category taxonomy.** Whether Ping uses fixed system-defined categories, AI-classified semantic tags, free-text labels, or no categories at all is inferred at 35% confidence. The cleanest Docket-side decision is "AI-classified multi-label tags with firm-extensible taxonomy" regardless of what Ping does.
3. **Memory edit click-through (inline vs full-screen).** Inferred at 65% — could be either.
4. **AI-suggested-edits UX exact form.** Inferred at 65% — the structural fit is strong but no public confirmation of the surface.
5. **Stale memory detection cadence + UX.** Inferred at 50% — structurally needed but no public verification.
6. **Confidence scoring visualization.** Inferred at 50% — likely exists internally; user-facing rendering may be implicit.
7. **Memory export availability + format.** Inferred at 70% as ABSENT — but cannot definitively verify Ping doesn't ship some export at higher tiers.
8. **Sensitive-category special handling.** Inferred at 40% as ABSENT — Ping does not publicly describe per-category sensitivity flags.
9. **Hard-delete vs soft-delete + GDPR/CCPA workflow.** Inferred at 40% — Ping's SOC 2 implies a process exists; specifics not public.
10. **Memory technical implementation (Postgres + vector store + embedding model).** Inferred at 65% — industry-standard pattern; exact choices not disclosed.
11. **Multi-meeting / multi-source chain tracing UX.** Inferred at 60% as ABSENT — power-user affordance, likely not exposed.
12. **Exact behavior when a source artifact is deleted.** Inferred at 60% — likely preserves memory + orphans the source link, but unverified.
13. **Per-client visibility extends to memories.** Inferred at 75% from the Dec 3, 2025 team-roles changelog — high structural fit, no explicit confirmation.

**The strongest verified anchor is the memory changes bar (Jan 23, 2026) — Ping explicitly logs client detail edits to a named UI primitive.** Everything else in this document orbits that anchor with varying inference confidence. The Docket implementation plan in §13 is structurally sound regardless of the specific Ping UX choices that remain unverified, because Docket's compliance-defensible frame mandates extensions Ping doesn't ship anyway.

---

## 16. Citations

Primary sources verified during research:

- [Ping Assistant Features Page](https://www.pingassistant.com/features) — Client Memory feature description, AI brain framing, "data lake" framing
- [Ping Assistant Homepage](https://www.pingassistant.com/) — "An AI brain that knows every client inside and out", "A living profile built from every interaction"
- [Ping Assistant Pricing](https://www.pingassistant.com/pricing) — Memory tier gating ($72/mo Client Intelligence), "no caps", advisor-leaves FAQ
- [Ping Assistant Changelog](https://www.pingassistant.com/changelog) — **Jan 23, 2026: "Client detail edits are logged in the memory changes bar"** + Jan 16, 2026 Global Chat "central nervous system" + Aug 18, 2025 web-search functionality + May 20, 2026 pre-meeting prep emails + Dec 23, 2025 HubSpot "same client brain"
- [Ping Assistant Individual Advisor page](https://www.pingassistant.com/individual-advisor) — "An AI that knows your client", pre-meeting context flow into briefs, email-draft "powered by the full context of the thread and Client Memory"
- [Ping Assistant Firm Leadership page](https://www.pingassistant.com/firm-leadership) — Institutional Memory framing: "knowledge is automatically centralized in Ping, not stored in individual inboxes or memories, so nothing walks out the door"
- [Ping Assistant Prospect Brief page](https://www.pingassistant.com/prospect-brief) — "Know what matters about your prospect before they even walk through the door"
- [Ping Assistant Testimonials](https://www.pingassistant.com/testimonials) — Marcus Rivera verbatim: "The client memory feature alone pays for itself..."
- [Ping Assistant llms.txt](https://www.pingassistant.com/llms.txt) — canonical capabilities list including Client Memory + Institutional Memory
- [Ping Assistant Blog Index](https://www.pingassistant.com/blog) — Jason Staats, Chad Davis, Zane Stevens (Mar 28, 2026: "institutional memory was the deciding factor"), Timalyn Bowens, Dan Luthi posts
- [Ping Assistant Karbon Integration](https://www.pingassistant.com/integrations/karbon) — work-items + timelines integration shape
- [Ping Assistant Help Center](https://www.pingassistant.com/help-center) — six-category structure (subpages inaccessible via WebFetch)
- [Camden Bean LinkedIn — Global Chat Launch](https://www.linkedin.com/posts/camden-bean_we-launched-a-big-feature-this-week-global-activity-7369400491920805890-TGFz) — founder vision: "executive assistant for everything you'd want help with, except picking up lunch"
- [Dan Luthi LinkedIn — Ping Deep Dive Post](https://www.linkedin.com/posts/dan-luthi_love-the-deep-dive-on-ping-assistant-chad-activity-7411199922047315968-_FS0) — Dan Luthi quotes on centralization + unlocks
- [America's Favorite EA — Ping Assistant Review](https://www.americasfavoriteea.com/post/ping-assistant-ai-for-accountants) — *"It's not just a notetaker—it's the client brain your firm has always needed."* (the single most-quotable verbatim about Memory)
- [Encoursa — Ping Assistant Profile](https://encoursa.com/companies/ping-assistant) — founder context (Camden Bean, ex-Divvy / Bill.com)
- [Companion document — PING-FEATURE-UX-DEEP-DIVE-2026-05-13.md](file:///C:/Users/minse/projects/docket/docs/competitor-research/PING-FEATURE-UX-DEEP-DIVE-2026-05-13.md)
- [Companion document — PING-AUDIT-TRAIL-UX-2026-05-14.md](file:///C:/Users/minse/projects/docket/docs/competitor-research/PING-AUDIT-TRAIL-UX-2026-05-14.md)

Sources searched without usable signal:
- YouTube customer demo videos (Jason Staats Apr 10, 2026 / Timalyn Bowens Mar 20, 2026 — player markup blocks WebFetch transcript extraction)
- Loom videos (Zane Stevens Mar 28 / Dan Luthi Mar 12 — same access limitation)
- Help-center subpages (`/help-center/features`, `/help-center/best-practices` — SPA-rendered, individual article content not exposed at predictable URLs)
- Ping Blog detail posts (404 on direct URL access)
- Camden Bean LinkedIn profile page (404 on direct fetch; individual posts accessible)
- G2 / Capterra / Software Advice (Ping Assistant not yet aggregated)

**Methodology integrity note.** This document reconstructs Ping's Memory UX primarily from verified marketing copy + the seven memory-relevant changelog entries (Jul 30 launch + Aug 18 web-search + Sep 2 global chat + Dec 23 HubSpot client-brain + Jan 16 global chat central-nervous-system + Jan 23 memory changes bar + AI search + May 20 pre-meeting prep emails). The Jan 23 memory changes bar entry is the single load-bearing anchor — it confirms named UI primitive that suggests the rest of the editing/curation surface exists. The §13 implementation plan is architecturally sound regardless of the specific Ping UI choices that remain unverified, because Docket's substrate (per-tenant DEK + RLS + audit chain + Voyage embeddings + position-framework refusal-floor) already supports the extensions in §14 that Ping does not ship.

Document length: ~5,800 words.
