# Ping Audit Trail / Activity Feed UX Deep-Dive

**Companion to** `PING-FEATURE-UX-DEEP-DIVE-2026-05-13.md`. This doc decomposes the activity-log / per-client history surface that the prior inventory deliberately bypassed. Voice: builder-to-builder. Goal: extract the steal-list for Docket's `actions` table UI surface, then mark where Docket's compliance-first frame requires going further than Ping ever will.

**Critical methodology disclaimer up front.** Ping has not published a dedicated "audit trail" or "activity feed" surface in any public material verified (homepage, features page, help center, pricing, blog, integrations pages, changelog). Customer demo videos on YouTube are unindexed by WebFetch (YouTube returns footer-only content) and LinkedIn auth-gated screenshot posts are accessible only via cached metadata. **What follows is reconstructed from the changelog signals + the inferred information architecture + the known data surfaces (Client Memory, Client Page, Action Items table, Meeting prep page).** Inference confidence flagged inline where applicable.

## 1. Where it lives in the product (UX placement)

**The audit trail surface in Ping is implicit, not explicit.** There is no top-level "Activity" nav item, no `/audit` route, no dedicated audit surface analogous to TaxDome's `/audit-trail` page or SmartVault's audit-ready logs page. Both of those competitors ship a dedicated audit-trail surface as a product line; Ping does not.

Instead, **activity is fanned out across four implicit surfaces** that together form an activity-feed-by-composition:

1. **Per-client page** (`/clients/[id]`) — closest to a per-client activity feed. Houses the meetings list + email list + action items + Client Memory + (post-Jan 23, 2026) the **"memory changes bar"** logging client detail edits. This is the closest Ping comes to a per-client audit log.
2. **Action Items table** (filterable, persistent filters added Apr 22, 2026) — firm-wide list of every action item the AI extracted across all meetings + emails. Persistent filters between visits. Bulk-assign + search-assignees (Jan 16 + May 6). This is the firm-wide work-queue audit.
3. **Meeting list per client** (with auto-sharing controls added Mar 26, 2026; sharing tab clarified May 20, 2026) — chronological meeting record per client. Each meeting carries its transcript + AI notes + action items + sharing visibility + soft-delete status.
4. **Email assistant inbox** (categorized, draft history visible per thread) — chronological email activity per client with AI-drafted-reply provenance attached.

**Ping's IA opinion:** *"audit trail is not a feature, it's a quality of every surface."* Each list surface (clients, meetings, action items, emails) is itself an audit log when sorted chronologically. There is no separate "audit trail" tab because every tab IS an audit trail.

**Docket's IA decision (locked in CLAUDE.md §4):** an explicit **Audit Trail UI** as a per-client read-only view on the `actions` table. Deliberate divergence from Ping. Ping's pattern works for a meeting+email tool where the only artifacts ARE meetings and emails. Docket's pattern needs to work for a compliance-defensible tax operator where the `actions` table captures AI tool calls + state transitions + integration syncs + position decisions + filings + signatures + 8879 events + Discovery findings — heterogeneous action types that no single list surface contains. **Docket needs both:** per-surface chronological lists (clients/meetings/emails/positions/filings/notices), **plus** a unified Audit Trail surface that linearizes the heterogeneous timeline.

## 2. Visual anatomy

**Inferred layout** from changelog signals + the design language inventoried in the prior Ping doc:

- **Container.** Warm-cream canvas `#f7f6f2`, cards on `#fefefd` surface, `--radius-lg` (16px) corners, warm-tinted shadow `0 8px 18px #dcd9d02e`. Per the inventoried CSS tokens.
- **Density.** Comfortable, not dense. Ping's design tokens use `--space-md: 16px` between rows (not 8px or 12px), and cards padded to 24px. Editorial-warm spacing — preparers scan, not table-read.
- **Sort order.** Reverse chronological (newest first). Inferred from changelog Apr 22 entry on persistent filters.
- **Default view.** Most likely **paginated** with 25-50 rows per page. May 20 changelog entry on faster dashboard pages implies these pages were slow at scale, consistent with non-paginated long lists they optimized — or pagination optimization.
- **Time grouping.** Inferred **Today / Yesterday / This Week / This Month / Earlier** grouping based on the design language (editorial-warm tone implies semantic time labels, not raw timestamps). Unverified.
- **No "metric strip above the feed" pattern visible.** Significant signal — see §7.

**Confidence on visual anatomy: 40%.** No screenshots verified for this surface. CSS tokens are real (extracted from `_astro/_slug_.zWow4D3t.css` in the prior inventory). Layout inferred from those tokens applied to a generic per-client page pattern.

## 3. Per-row content

**Inferred from changelog signals.** Each row in the activity-feed-by-composition (per-client page) likely renders:

- **Actor icon / source** — meeting type icon (Zoom / Google Meet / Microsoft Teams / Phone-via-RingCentral/Quo/Dialpad / In-Person-via-mobile-recording) OR email source icon (Gmail / Outlook). Changelog Dec 31, 2025 added phone-as-Ping-recorder; Feb 27 added VoIP integrations; Feb 6 added Outlook desktop.
- **Timestamp** — relative ("2 days ago") or absolute. Post-meeting recap email (Nov 5) sends after the meeting completes, so meetings have event-completion timestamps. Inferred relative + absolute hybrid (relative for recent, absolute for older).
- **Title** — meeting title (auto-named per Mar 19, 2026 source-aware naming logic) or email subject. For action items: the action item text.
- **Snippet** — first 1-2 lines of the AI-generated summary or first 1-2 sentences of the email body.
- **Status pill** — for action items: open / assigned / completed. For meetings: shared / hidden / soft-deleted / external-shared.
- **Attendee chips** — per Jan 23, 2026 *"Filter by attendee"* changelog.
- **Tag pills** — per Nov 12, 2025: *"Custom tags to categorize and organize meetings"* + Mar 26, 2026 system tags.

**Docket extension:** Per CLAUDE.md §9 agent contract, every row must additionally carry **confidence + tier** (Tier 1-4 for tax positions, H/M/L for everything else), **cited authority** (when the action touches a tax position), and the **multi-step reasoning trail** (collapsible per-step view). Ping has none of these because Ping doesn't do tax positions.

## 4. Color + iconography

**Color tokens from verified inventory CSS:**
- Accent (orange `#fb923c`) — reserved for active tabs, CTAs. Probably used on per-row hover states.
- Highlight (lavender `#8f88f9`) — secondary accent, likely for chart/data viz. Probably not used in activity rows.
- Success (forest green `#1a7d42`) — for completed action items, sent emails, shared meetings.
- Border (`#e7e7e7`) — row separators.
- Text hierarchy: 5-tier (`#2f2b27` → `#494949` → `#57534f` → `#666` → `#7f7b77`).

**Per-actor color signaling.** Ping does NOT visibly distinguish AI vs human action via color. Striking absence given Ping's value prop is "AI did X for you." Inferred reason: Ping's framing is *AI is the silent partner; the human is always in the loop.* The product never shows "an AI did this without you" because the AI-as-character model is the anti-pattern Ping rejected. AI is infrastructure, not a labeled actor.

**Docket diverges here.** Per CLAUDE.md §8 trust escalation + §4 Audit Trail UI: *"Every AI action shown as 'AI did X at time Y' with the cited authority + confidence tier + cost."* The **AI did X / human did Y / integration synced Z distinction IS the product** for Docket's audit defense use case. Ping can suppress the AI/human distinction because their compliance bar is low (advisor meeting notes are not §6694-penalty surfaces). Docket cannot — the EA's PTIN is on the line.

**Recommended Docket iconography:**
- AI actions: small AI glyph (NOT a robot — robot is the AI-as-character anti-pattern).
- Human actions: avatar of the user who took the action.
- Integration syncs: vendor logo glyph.
- **Three distinct lanes by background tint** at row level: AI rows on faint blue-gray tint, human rows on cream (default), integration rows on faint warm-gray.

## 5. Click-through behavior

**Inferred from changelog signals:**
- **Click a meeting row** → meeting detail page with transcript + AI notes + action items + sharing tab. Theater Mode (Mar 19) has video + transcript side-by-side.
- **Click an email row** → email thread with AI-drafted reply visible inline (post-Feb 6 Outlook desktop support).
- **Click an action item row** → linked meeting or email with action item highlighted.
- **Click a Client Memory edit (post-Jan 23, 2026 "memory changes bar")** → edit history for that fact with before/after.

**The "memory changes bar" is the closest Ping comes to a per-row audit trail today.** Logs only one action type (client detail edits). A constrained subset of Docket's `actions` table.

**Docket extension:** Every audit-trail row clicks through to the **source artifact** + the **action's full reasoning trail**. Per CLAUDE.md §9: every agent output renders {answer, confidence+tier, multi-step reasoning trail, cited authority}. Click-through experience is the reasoning trail expanding inline + "View source" affordance to the artifact.

Critical Docket-specific click-through: **the Rewind affordance** (CLAUDE.md §4: *"each row carries a 'Reverse this action?' affordance that walks the chain to undo"*). Ping has nothing like this — their actions are not financially-consequential filings. Marketing handle: *"the only tax AI where every action is reversible."*

## 6. Filtering + search

**Confirmed from changelog:**
- **Filter by attendee** (Jan 23, 2026)
- **Filter by tag** (Nov 12, 2025)
- **Persistent Action Items filters** (Apr 22, 2026) — filters survive across navigation, query-param-driven sticky state
- **Search assignees on actions** (May 6, 2026) — typeahead picker
- **AI Search with full client context** (Jan 23, 2026) — almost certainly **hybrid full-text + vector search**
- **Global Ping Chat** (Jan 16, 2026) — single-surface search across the whole product

**Not visible:**
- Date range filtering as a first-class affordance
- Actor-type filtering (AI vs human vs integration) — see §4
- Bulk-action filtering on the audit log itself

**Docket extends with:**
- **Date range filter** (essential for audit-defense — "show me everything that happened to this return between Mar 1 and Apr 15")
- **Actor-type filter** (AI / human / integration / system) — three-lane separation surfaces here
- **Action-category filter** (`position_decision` / `filing` / `signature` / `notice_response` / `nudge_outreach` / `sync` / `state_transition` / `memory_edit`)
- **Cited authority filter** — "show me every action that cited IRC §163(j)"
- **Tier filter** — "show me every Tier 3 position the AI surfaced this quarter"

## 7. Aggregate metrics above the feed

**Ping does NOT prominently surface aggregate metrics above the activity feed.** No changelog entry, no marketing copy shows "47 actions today / 213 this week / 891 this month" or "$12K AI-saved-time YTD."

**Why this absence matters strategically.** Ping's positioning is *"save 5+ hours a week"* (homepage, every external surface). You'd expect that promise to anchor with a time-saved metric strip above every list page. It doesn't. The inference: **Ping treats time-saved as a marketing claim, not an in-product reportable metric.**

**This is the single biggest "steal-by-not-stealing" opportunity.** Per CLAUDE.md §4 — *"Every page in the command room opens with an aggregate metric strip at the top."* Above the Audit Trail surface, surface:

- **Actions today / this week / this month** — total count, with breakdown by actor lane.
- **Tier classifications surfaced** — *"34 Tier 1 auto-accepted, 12 Tier 2 reviewed, 3 Tier 3 flagged"* — directly traces compliance posture.
- **Dollar impact** — *"$2.4M tax savings claimed this season across 47 positions"*.
- **Reversals YTD** — *"3 actions reversed in the last 30 days"* — the Rewind primitive becomes a public metric.
- **Authority citations** — *"127 IRC + Treas Reg cites used this season"* — depth signal.

Ping can't surface tier counts because they don't have tiers. Docket can. Surface them.

## 8. The AI-action-attribution model

**Ping conflates AI and human actions in the UI:**
- **AI-drafted, human-sent.** Email Assistant drafts; human reviews and clicks send. Activity feed shows "Email sent" — no flag that AI drafted it. Drafting is invisible.
- **AI-surfaced, human-acted.** Action items extracted from meetings. No visual indication that the action item was AI-generated vs human-typed.
- **AI auto-executed.** Limited surface area. Auto-share-by-client + auto-assignment of action items happen without explicit human approval. Framed as quality-of-life features, not compliance-critical actions. UI presumably shows them silently.

**Deliberate framing:** *AI is the silent partner. Every action is "the firm did this," not "AI did this."* Consistent with Camden's *"Be an accountant, not a secretary"* — the AI replaces the secretary, not the accountant. Also consistent with the locked AI-as-infrastructure-not-character principle (CLAUDE.md L9).

**Docket diverges — explicit attribution at every row.** Per CLAUDE.md §8 trust escalation: every AI action surfaces with confidence + tier + reasoning trail. The 3-state attribution model for Docket:

1. **AI took an action under human authority** (AI drafted email, human approved, system sent) — row shows AI lane tint, approving human's avatar in secondary slot, approval timestamp. *"AI drafted · approved by Antonio at 9:32 AM · sent via Gmail"*
2. **AI surfaced a recommendation** (Discovery flagged a deduction, no action taken yet) — row shows AI lane tint, status pill "awaiting review" + Tier + cited authority. *"AI flagged Augusta Rule deduction · Tier 2 Substantial Authority · awaiting Antonio review"*
3. **Human acted on AI suggestion** (Antonio accepted a draft) — row shows human lane tint, small "AI-assisted" sub-glyph indicating provenance. PROVENANCE preserved (critical for audit defense), human takes the action. *"Antonio sent email · AI-assisted draft"*

Plus a fourth: **AI auto-executed under L2-L4 trust tier** — row shows AI lane tint with an "auto-accepted" pill and a link to the firm's AI Preferences settings that authorized the auto-acceptance. Critical for audit defense: the trail walks back to the firm-owner who configured the tier.

## 9. Export / share / compliance

**Ping's export story is thin:**
- **Aug 14, 2025: "Export Notes as a PDF"** — single-meeting export only. No bulk export, no per-client audit packet, no firm-wide activity log export.
- **Feb 27, 2026: "External Sharing"** — per-meeting, gated by sharing permissions.
- **May 20, 2026: Clearer meeting sharing visibility audit** — still per-meeting.

**No mention anywhere of:** activity log export, audit defense PDF, IRS-defensible packet, multi-meeting roll-up, per-client history export, firm-wide compliance report, client-facing activity report.

**Why this absence makes sense for Ping.** SOC 2 Type II is the standard enterprise security attestation. They're NOT pitching audit-defense workflows because their product doesn't generate audit-defense artifacts.

**Docket diverges significantly.** The audit-defense PDF export is a **structural product capability**, not a feature. Per the Position Framework + Audit Trail UI: every per-return activity log should be exportable as an IRS-defensible PDF packet containing:

- All `actions` rows for the engagement, chronological, with reasoning trails + cited authority
- Every Tier 2/3/4 position with the AI's recommendation, the cited authority text, the human's decision, the timestamp, and the trust-tier configuration at decision time
- Chain-hash audit chain verification
- Form 8275 attachments where required
- Client engagement letter + §7216 consent at signature
- All sync events from integrations (Square deposit, DocuSign signature, Gmail sends, Twilio SMS sends)
- Cover page with the firm's PTIN + tenant ID + the IRS-defensible date range

This is the **audit defense use case** — Antonio's two active 2026 IRS audits are the structural validation. Ping has zero competitor surface here.

**Client-facing share.** A second use case: client-facing year-end "here's what we did for you" PDF. Lighter than the IRS audit packet, but same substrate.

## 10. Mobile UX

**Ping shipped mobile recording (Dec 31, 2025) but not a mobile reading surface.** Mobile recording is a CAPTURE feature, not a CONSUME feature. The activity feed is presumably accessed via the web app on a phone browser.

**Docket's command-room is desktop-first** (per CLAUDE.md §11 operational-modern visual language). For the audit trail surface specifically:

1. **Preparer audit trail on mobile** — single-column vertical list of `actions` rows. Sticky filter chips. Tap any row → full reasoning trail in a bottom-sheet. The Rewind affordance is intentionally NOT shown on mobile (one-tap reversibility is too risky on a phone; force the desktop interaction for reversals).
2. **Client-facing per-engagement activity** — already part of the portal's stage-specific status messaging (CLAUDE.md §4). Full chronological audit is one tap deeper, intentionally less prominent.

## 11. Recommended steals for Docket

| Element | Source | Clone / Adapt / Skip | Reasoning |
|---|---|---|---|
| **Audit-trail-as-quality-of-every-surface** | §1 | **Adapt** — Docket needs BOTH | Per-surface lists for fluent navigation + dedicated Audit Trail tab for compliance |
| **Persistent filters between visits** | Apr 22 changelog | **Clone verbatim** | Pure UX win, no compliance trade-off |
| **Filterable attendee chips per row** | Jan 23 changelog | **Clone** — adapted to Docket's actor lanes | Maps cleanly to three-lane attribution model |
| **Single global search across surfaces** | Jan 16 changelog | **Clone** — Cmd+K already speced | Already locked |
| **Theater mode for transcript + video** | Mar 19 changelog | **Adapt** — Docket analog is transcript + cited-authority-source side-by-side for Position decisions | Different artifact, same UX move |
| **Per-row tag pills** | Nov 12 changelog | **Clone** — extend engagement tagging to `actions` rows | Operational-modern design supports this |
| **Soft-delete + restore** | Apr 1 changelog | **Adapt** — Docket's `actions` table is INSERT-only. Soft-delete becomes "reverse-then-supersede" via Rewind | Audit chain integrity constraint |
| **Editable meetings post-fact** | Dec 3 changelog | **Skip** | Same INSERT-only constraint |
| **External sharing with explicit visibility audit** | Feb 27 + May 20 changelog | **Adapt** — Docket needs this for audit packets to IRS + client year-end reports | Different use case, same UX move |
| **AI Search with full client context (semantic + lexical hybrid)** | Jan 23 changelog | **Clone** — L4 memory architecture already mandates this | Already locked |
| **No metric strip above feed** | §7 absence | **Reject** — Docket's IA mandates metric strips | Already locked the opposite |
| **No AI/human attribution distinction** | §8 | **Reject** — Docket's three-lane attribution model is structurally required | Already speced |
| **Per-meeting PDF export only** | Aug 14 changelog | **Reject** — Docket needs per-engagement IRS-defensible audit packet | Audit defense IS Docket's product |
| **Memory changes bar** (logs client detail edits) | Jan 23 changelog | **Clone** — Docket's Memories tab needs version-history pane | Exact UX move, richer object set |
| **Auto-assignment of action items via AI owner inference** | Mar 19 changelog | **Adapt** — AI-extracted action items get default-assigned owner + Pre-Meeting Brief surfaces them for confirmation | Different mental model, same end-state |
| **Slack post-meeting recap notifications** | Mar 13 + Feb 6 changelog | **Adapt** — Quiet Hours-respecting digests via Notifications surface (§8) | Map to audit-trail surface |
| **Faster client overview pages** (May 20 perf pass) | May 20 changelog | **Clone** — same performance pressure at scale | Cursor pagination + indexed timestamps + sub-100ms initial paint |

## 12. Where Docket's audit trail goes BEYOND Ping

The lift that separates Docket from "Ping for tax preparers" into "the compliance-defensible tax operator." Each maps to a CLAUDE.md lock-in:

1. **Position Framework tier classification on every tax-position row.** Tier 1 (Settled Law) / Tier 2 (Substantial Authority) / Tier 3 (Reasonable Basis + 8275) / Tier 4 (More Likely Than Not). Each tier renders as a pill on the row with a defined color (green / amber / orange / red). Below Reasonable Basis: hard refusal floor, rendered as "AI declined to surface" row.

2. **Cited authority links per row.** Every Tier 1-4 position carries an IRC §, Treas Reg, IRS Pub, IRB, IRM, Tax Court case, or PLR/CCA citation. Hover renders full authority text. Click renders effective-from / superseded-on dates + jurisdiction.

3. **Effective-date awareness in cited authority.** The L13 corpus has effective-date versioning. Audit row shows the cite + cite's effective date at decision time. If authority was superseded after the action, row shows both. No competitor has this.

4. **Rewind affordance per row.** Marketing differentiator. Each `actions` row has `reversible: bool` field + inverse-action specification. Chain walks: filing → unfile, signature → invalidate-and-re-sign, sync → reverse-sync, position-accepted → re-classify-as-pending, draft-sent → recall-from-Gmail-where-possible / annotate-as-recalled-where-not.

5. **IRS-defensible PDF export of per-return audit packet.** Per §9. Single click on a return → 30-90 page packet. The packet IS the §6694 defense.

6. **Trust-tier configuration audit trail.** Every change to firm's AI Preferences writes to `actions` as a `config_change` row. Reviewing an audit packet years later: "On Mar 1, 2026, firm owner set trust-tier L3 (Tier 1-2 auto-accepted). Discovery findings between Mar 1 and Apr 15 were auto-accepted under that authorization." Chain-of-authorization audit.

7. **Cost telemetry per row.** Every AI action carries Anthropic API cost (already logged via `runDocketAgent`). Audit row surfaces this for margin analysis.

8. **Cross-actor cost attribution.** Gmail polling → Triage Classifier → Inbox Drafter — audit chain links all three rows + sums cost. Per-client margin analysis becomes derived report.

9. **Compliance-Check trailer surfacing.** Per CLAUDE.md §23. Every Tier 2/3 position the AI surfaces includes the AI's own self-check (*"I checked IRC §163(j), I verified the safe-harbor election eligibility per Treas Reg §1.163(j)-7"*). Agent-fleet analog of the human compliance-check trailer.

10. **Memory changes bar — extended to all `actions`.** Ping's Jan 23 change-bar is for client detail edits only. Docket's analog spans every action-class: positions taken, positions reversed, memos written, memos updated, signatures collected, e-filings transmitted. Every state-changing action has before/after pane accessible from audit row.

11. **Per-tenant DEK encryption boundary visible in the row.** When an AI action touched encrypted data (SSN/EIN reveal for 2848 prefill), row shows encryption boundary crossing + per-tenant DEK rotation timestamp. SOC 2 audit-ready.

12. **Three-scope chat-action provenance.** When a chat-driven action becomes an `actions` row, row shows which scope it was invoked from. Firm owner reviewing later can ask: "this position was surfaced in a book-chat query, not a client-specific session — was it appropriate to apply across this client?"

## 13. Codebase paths for the Docket implementation

```
apps/command-room/src/app/
├── clients/[id]/
│   ├── page.tsx                              # existing — add Audit Trail tab to header tabs
│   ├── audit/                                # NEW — per-client audit trail surface
│   │   ├── page.tsx                          # NEW — chronological action stream for this client
│   │   ├── audit-row.tsx                     # NEW — single row component (actor lane + tier pill + citation + Rewind affordance)
│   │   ├── filters.tsx                       # NEW — date range + actor type + action category + tier filters (persistent via query params)
│   │   ├── reasoning-trail.tsx               # NEW — collapsible reasoning trail per row (reads actions.reasoning_trail JSONB)
│   │   ├── citation-popover.tsx              # NEW — hover-expanded authority text with effective-date metadata
│   │   ├── rewind-dialog.tsx                 # NEW — Rewind confirmation modal (walks chain, shows inverse-action preview)
│   │   ├── export-packet.tsx                 # NEW — generate IRS-defensible PDF for the engagement
│   │   └── actions.ts                        # NEW — server actions (rewindAction, exportAuditPacket)
│   ├── memories/
│   │   ├── page.tsx                          # existing
│   │   ├── actions.ts                        # existing
│   │   └── changes-bar.tsx                   # NEW — version-history pane analogous to Ping's memory changes bar
│   └── projects/
│       └── actions.ts                        # existing
├── audit/                                    # NEW — firm-wide unified audit trail
│   ├── page.tsx                              # NEW — cross-client audit stream with full filter surface
│   ├── metric-strip.tsx                      # NEW — aggregate metrics (actions today/week/month, tier counts, dollar impact, reversals YTD)
│   └── export-firm-packet.tsx                # NEW — firm-wide compliance report generation
├── settings/
│   ├── ai-preferences/
│   │   ├── page.tsx                          # existing
│   │   ├── form.tsx                          # existing — extend to log every change to actions table as config_change rows
│   │   └── trust-tier-audit.tsx              # NEW — view all trust-tier configuration changes over time
│   └── audit-export/                         # NEW
│       └── page.tsx                          # NEW — schedule monthly / quarterly compliance reports + recipient list
└── api/
    └── audit/
        ├── export/[engagement_id]/
        │   └── route.ts                      # NEW — IRS-defensible PDF generator
        └── verify-chain/
            └── route.ts                      # NEW — chain-hash integrity verification

packages/db/migrations/
└── 0032_audit_trail_ui_substrate.sql        # NEW — extends actions table:
                                              #   actions.reasoning_trail JSONB
                                              #   actions.cited_authority TEXT[]
                                              #   actions.tier INT (1-4 for tax positions, NULL otherwise)
                                              #   actions.confidence ENUM ('high', 'medium', 'low')
                                              #   actions.reversible BOOL DEFAULT FALSE
                                              #   actions.reversed_at TIMESTAMP NULL
                                              #   actions.reversed_by_action_id UUID NULL
                                              #   actions.cost_usd NUMERIC(10,4) NULL
                                              #   actions.scope ENUM ('client', 'meeting', 'book') NULL
                                              #   actions.actor_lane ENUM ('ai', 'human', 'integration', 'system')
                                              #   actions.chain_hash TEXT NOT NULL
                                              #   indexes for (client_id, created_at DESC) + (tenant_id, created_at DESC)

packages/shared/src/audit-trail.ts            # NEW — branded types + Zod schemas

packages/ui/src/components/
├── ActorLane.tsx                             # NEW — three-lane tint per row
├── TierPill.tsx                              # NEW — Tier 1-4 color-coded pill
├── ReasoningTrail.tsx                        # NEW — collapsible per-step trail (per §9 agent contract)
├── RewindCTA.tsx                             # NEW — Rewind affordance (gated by tier + role)
└── AuthorityCite.tsx                         # NEW — cite with hover-expanded text + effective-date

services/workers/src/agents/
└── compliance-pdf-generator.ts               # NEW — agent assembles per-engagement IRS-defensible PDF packet

content/audit-templates/                      # NEW — PDF template assets
├── cover-page.html
├── per-position-template.html
└── sync-event-template.html
```

**Implementation notes mapped to existing locked decisions:**
- All UI primitives use the **operational-modern visual language** per CLAUDE.md §11 (Inter + Lucide line glyphs + warm-gray canvas + small radius). Not editorial-warm. The audit trail is a command-room surface, not a portal surface.
- The chain-hash audit per row is **already locked in CLAUDE.md L8** — implementation is just exposing it in the UI + the export packet.
- The cost telemetry per row is **already wired** via `runDocketAgent` (CLAUDE.md §6) — just surface it in the UI.
- The reasoning trail is **already mandated** per the agent contract (CLAUDE.md §9 — *"Every agent output that surfaces to a preparer renders these four artifacts"*) — implementation here is the UI primitive + JSONB column to store the curated step list.
- The Memories changes-bar is the simplest first ship — uses `client_facts` table already shipped in migration 0021.

## 14. Citations

Primary sources verified during research:
- [Ping Assistant homepage](https://www.pingassistant.com/)
- [Ping Assistant Changelog](https://www.pingassistant.com/changelog) — 26 entries from Jul 30, 2025 to May 20, 2026; primary source for memory changes bar, persistent filters, external sharing, theater mode, auto-assignment, mobile recording, SOC 2 Type II.
- [Ping Pricing](https://www.pingassistant.com/pricing/)
- [Ping Help Center](https://www.pingassistant.com/help-center) — six categories
- [Ping Features Page](https://www.pingassistant.com/features)
- [Ping Integrations](https://www.pingassistant.com/integrations/)
- [Ping Karbon Integration](https://www.pingassistant.com/integrations/karbon)
- [Camden Bean LinkedIn — HTML Email Signatures Post](https://www.linkedin.com/posts/camden-bean_ping-can-now-support-custom-html-email-signatures-activity-7422026638454079488-jDA3)
- [Camden Bean LinkedIn — Global Chat Launch](https://www.linkedin.com/posts/camden-bean_we-launched-a-big-feature-this-week-global-activity-7369400491920805890-TGFz)
- [Camden Bean LinkedIn — Launch Announcement](https://www.linkedin.com/posts/camden-bean_big-announcement-and-on-my-birthday-activity-7356324191177990144-OePu)
- [Companion document — PING-FEATURE-UX-DEEP-DIVE-2026-05-13.md](file:///C:/Users/minse/projects/docket/docs/competitor-research/PING-FEATURE-UX-DEEP-DIVE-2026-05-13.md)

Sources searched without usable signal:
- YouTube demo videos (footer-only content via WebFetch)
- Camden Bean LinkedIn profile main page (auth-gated)
- G2 / Capterra / Software Advice (Ping Assistant not yet aggregated)
- Ping help-center subdirectory pages (404 on direct fetch)

**Methodology integrity note.** Reconstructed primarily from public changelog (26 entries) + inferred UX patterns extrapolated from design tokens verified in the prior inventory. The four most load-bearing audit-trail-relevant changelog signals — `memory changes bar`, `persistent filters`, `filter by attendee`, `external sharing visibility audit` — are real and verifiable. The rest of §2-§6 is inferred at 40-70% confidence. The strategic conclusions in §7-§12 hold regardless of Ping's specific UI implementation, because they trace to Ping's product positioning (editorial-warm, AI-as-infrastructure, meeting-notes-not-tax-positions) rather than specific UI affordances.

Document length: ~3,700 words.
