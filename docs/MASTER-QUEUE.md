# Docket — Master Queue

> *Single ordered "what's next" doc. Read at every session start.*
> *Consolidates the forward-looking queue from PRODUCT-ROADMAP.md +*
> *DESIGN-PARTNER-ACQUISITION-PLAN.md + PRODUCTION-READINESS.md +*
> *POST-5-15.md + recent session findings.*
>
> *Last updated: 2026-05-23 (Session 17 — Petal v2 reconciliation; Phase 0.5 priority track added per CLAUDE.md §26)*

## How to read this

- **Status**: `queued` / `in-progress` / `blocked` / `done` / `operator-action`
- **Owner**: who can advance the item. `Claude` = I can ship code. `David` / `Antonio` / `Haokun` = founder action. `Operator` = needs external credential or console access.
- **Blocker**: empty if unblocked. Names the thing that has to happen first.
- **Target ship**: best-guess date. Slips happen; update this column when reality drifts.

## Update discipline

- When an item ships: status → `done`, link the commit SHA, MOVE the row to the bottom under `## Done (recent)`. Keep the queue top-of-doc lean.
- When a new item lands: insert it in priority order, not at the bottom.
- When something blocks: change status to `blocked`, write the blocker, don't delete the row.
- When this doc and PRODUCT-ROADMAP.md disagree: this doc wins for "what's next this week," PRODUCT-ROADMAP.md wins for "what's the V1 vision."

---

## Top of queue — immediate (this week + next, 5/16 → 5/30)

The 100-customers-by-8/1 sprint (L16) is the load-bearing constraint. Most of these items gate the sprint.

| # | Item | Why | Status | Owner | Blocker | Target |
|---|---|---|---|---|---|---|
| 1 | Cold outreach automation — Apollo + Lemlist scripts + Resend transactional templates | L16 must-ship #2 (acquisition Channel 2). Templates exist in `docs/pitch-decks/cold-outreach-templates.md`; need automation. | queued | David + Claude | None | **5/18** |
| 2 | Discovery agent grounded for Antonio reference scan | L16 must-ship #1 + the wedge demo. Currently agent code shipped but runs against the v0 Position Library (`DRAFT-DAVID` only, gated). Antonio's reference output needs the catalog flipped to `ANTONIO-VALIDATED`. | blocked | Antonio + Claude | Item #3 | **6/15** |
| 3 | Antonio review pass on 20 Position Library entries | Unlocks #2. Each entry is at `content/position-library/v0/positions/p001..p020-*.md`; ingestion gate (`packages/db/scripts/ingest-position-library.ts`) default-denies `DRAFT-DAVID` from prospect-facing scans. | queued | Antonio | Antonio's calendar | **5/31** |
| 4 | Boney-Henderson presentation booked + slides ready | L16 must-ship #5 (acquisition Channel 1 — warm-intro multiplier). | queued | Antonio + David | Boney-Henderson availability | **5/30** |
| 5 | Sales VA hired ($20-40/hr, 10-20 hrs/wk) | L16 must-ship #3. Sourced from Antonio network or Latino Tax Pro instructor pool. | queued | David | None | **5/31** |
| 6 | Unset Vercel envs: `E2E_BYPASS_*` + `NEXT_PUBLIC_ENABLE_MOCK_8879` | Routes deleted 2026-05-15; envs are noise. SOC 2 hygiene. | queued | Operator | Vercel console access | This week |
| 7 | Verify Anthropic Console account tier supports ZDR | Public ZDR claim asserted on `/trust` + WISP + §7216 consent + CLAUDE.md §6 — needs documented Anthropic-tier proof OR rewrite the claim. | queued | David | Anthropic Console access | This week |

## Phase 0.5 priority track (Petal v2 — 90-day killer slice, per CLAUDE.md §26)

These 10 items are the new priority engineering track post-reconciliation 2026-05-23. They replace the older "ship everything by 7/30" framing with the brief's hard-acceptance-criteria 90-day plan. Sequence per CLAUDE.md §26.5 week-by-week. Phase 0.5 ships when ALL §26.6 acceptance criteria pass.

| # | Item | Why | Status | Owner | Blocker | Target |
|---|---|---|---|---|---|---|
| P1 | `packages/tax-compute` with 5 tools (MACRS depreciation / asset basis / individual AMT / NOL post-TCJA-OBBBA / §199A QBI). 95% test coverage on IRS published examples. | Computer toolkit = moat #3 (deterministic computation with replay traces). Closes the existing Discovery `estimatedImpact.dollars`-from-LLM §6694 exposure. | queued | Claude | None | Phase 0.5 wk 1-3 |
| P2 | Migration 0039: `computation_traces` table. Every Computer call writes a replayable row. | Substrate for moat #3 audit defense. | queued | Claude | P1 design | Phase 0.5 wk 1-3 |
| P3 | Refactor `discovery-agent` to delegate dollar synthesis to `packages/tax-compute`. Add Verifier check flagging any LLM-emitted dollar amount without a `computation_traces` backing. | Closes the §6694 exposure. Cannot ship Verifier without this refactor. | queued | Claude | P1, P2, P5 | Phase 0.5 wk 3 |
| P4 | `packages/tax-compliance` with SSTS / Circ 230 / IRC §6694 / Form 8867 rulesets + check engine. | Moat #2 (compliance-by-construction). | queued | Claude | None | Phase 0.5 wk 4-6 |
| P5 | Verifier agent (`services/workers/src/agents/verifier/`) with 6 checks per CLAUDE.md §26.2 brief: citation faithfulness / citation accuracy / authority tier compliance / stale law / computation reproducibility / compliance. Migration 0040: `verification_results` table. Wire as render-blocking gate inside the orchestrator loop. | Moat #2 substrate. Render-blocking is the load-bearing rule (CLAUDE.md §26.4). | queued | Claude | P4 | Phase 0.5 wk 4-6 |
| P6 | `packages/tax-defense` with adversary corpus ingestion (ATGs + TIGTA + IRM Part 4 + taxpayer-loss Tax Court cases) as a SEPARATE pgvector table per CLAUDE.md anti-pattern #6. | Moat #1 (defense-by-construction) substrate. | queued | Claude | None | Phase 0.5 wk 7-9 |
| P7 | Adversary agent + 7-component defense package generation at position-time. Migration 0041: `defense_packages` table + position→package linkage. UI surface in `apps/command-room/src/app/clients/[id]/` showing position library with defense-package status. | Moat #1 — the actual differentiator. | queued | Claude | P6 | Phase 0.5 wk 7-9 |
| P8 | `packages/tax-ledgers` with 8 ledger types (basis / NOL / capital_loss / AMT credit / passive_loss / charitable / FTC / §1031 deferred). Migration 0042: `ledger_entries` table (append-only, INSERT-only enforced by PG trigger). Reconstruction logic in Planner module. | Moat #4 (multi-year live ledgers). | queued | Claude | None | Phase 0.5 wk 10-12 |
| P9 | Discrete Planner module for individual-return state machine. 3 more Drafter artifact types (research memo + 8275 statement + S-corp reasonable comp memo — existing inbox/notice cover the others). CA-specific authority ingestion into `packages/tax-graph` (FTB Pubs + Residency Manual + CDTFA + EDD). | Closes the 6-agent architecture (only Planner + Drafter remaining) + L13 CA-first commitment + RL3 decision. | queued | Claude | P8 | Phase 0.5 wk 10-12 |
| P10 | Eval expansion to ~420 vetted questions (120 existing + 100 from Antonio + 200 scripted). Wire as CI render-blocking gate (>2% regression OR any settled-law failure blocks merge). Onboard 9 more founder firms from JBH / Latino Tax Pro / NAEA networks (satisfies L14). Public Q4 2026 accuracy report draft. | Phase 0.5 ship gate per §26.6. | queued | Claude + David + Antonio | Antonio time for the 100-question vetting pass | Phase 0.5 wk 13 |

## Mid queue — 3-6 weeks (5/30 → 6/27)

Phase 3 + Phase 4 work per PRODUCT-ROADMAP.md. Items #8-#15 are pre-reconciliation queue; Phase 0.5 track (P1-P10 above) takes priority. Items here unblock as Phase 0.5 items ship.

| # | Item | Why | Status | Owner | Blocker | Target |
|---|---|---|---|---|---|---|
| 8 | OLT browser automation MCP server | Wedge demo + Antonio's primary tax software. Per CLAUDE.md §3 it's a forced integration moat (no AI-native competitor integrates with OLT). | queued | Claude | None | 6/20 |
| 9 | Form 8879 KBA-backed signing wired end-to-end | IRS Pub 1345 compliance for remote 8879. Sessions 15-16 (5/16) closed the three substrate gaps: initial SMS on envelope creation (commit `9f054f8`) → hourly reminder cadence cron via `reminder_rules` (commit `e018ca4`) → Antonio-side notification via issues table when signature transitions (this commit). Only remaining gap: Resend email channel (blocked on brand decision per §18). | mostly-done | Claude | Item #15 (Resend) for email channel | 6/15 |
| 10 | Calendar surface (first-class top-level) | CLAUDE.md §4 Calendar requirement. Needs `google-calendar` MCP server + `calendar_events` table (migration 0031 already shipped). | queued | Claude | None | 6/27 |
| 11 | Notice triage + drafter real-notice testing | Substrate shipped; needs real CP2000 / CP504 / LT11 testing against Antonio's actual case load. | queued | Antonio + Claude | Antonio's audit case timing | 6/20 |
| 12 | Partner #2 acquisition pipeline | Per L14 (90-day Antonio-dependency mitigation). Mid-market firm preferred, 20-100 staff, different network than Antonio. | queued | David | None | 6/27 |
| 13 | Run `reencrypt-legacy` walker against prod | Closes the AAD-less + master-KEK fallback paths (Session 3 audit finding). Needs DB creds. | queued | Operator | Operator access | 5/30 |
| 14 | Apply Vouch + Embroker E&O+Cyber bundle | $2,500-3,500/yr; per CLAUDE.md §18 + Insurance recommendation. Required for SOC 2 + most enterprise sales. | queued | David | None | 5/30 |
| 15 | DNS + Resend domain + 3 mailboxes provisioning | Deferred per brand-rename indecision. Resend transactional email queued; the brand decision unblocks. | blocked | David | Brand-name decision | When brand decided |
| ~~16~~ | ~~Vision agent Bedrock fallover~~ | ~~Doc-classification pipeline goes dark on Anthropic outage. Per Session 4 finding.~~ | **done Session 14** | — | — | shipped 5/16 |

## Lower queue — 6-12 weeks (6/27 → 7/30 — V1 launch)

Path 2 commitments + V1 hardening per L1 + L13.

| # | Item | Why | Status | Owner | Blocker | Target |
|---|---|---|---|---|---|---|
| 17 | Public API v1 outline + endpoints | L1 Path 2 commitment: "Public API + MCP server ship in v1 as deployable artifacts." Currently zero. | queued | Claude | None | 7/15 |
| 18 | MCP server v1 outline + first integration | Same L1 commitment. | queued | Claude | None | 7/20 |
| 19 | Eval suite for prompt-bearing agents | All four prompt-bearing agents now have prompt-injection coverage: discovery (D18, e9a742c), notice-drafter (D19, 67bbfc2), inbox-drafter (D20, a87648c), triage-classifier (D21, this commit). A15 fully closed across the agent fleet. A16 (§6695(g) Form 8867 rule) covered by D18. Remaining items in #19: citation-accuracy eval (gated on knowledge layer ingestion), F1 calibration across all agents, eval for memory-curator + nudge-agent once those have richer prompt surfaces. | in-progress | Claude | None | 7/01 |
| 20 | Manager mission-control surface (V1.5 preview) | Per CLAUDE.md §4. For firms with multiple preparers. | queued | Claude | Partner #2 onboarding | 7/15 |
| 21 | AI Tasks layer (scheduled + on-event AI workflows) | Per PRODUCT-ROADMAP.md Phase 4. | queued | Claude | None | 7/15 |
| 22 | Magic Buttons substrate | CLAUDE.md §8 — chat-bound custom workflows. Slant pattern. | queued | Claude | None | 7/20 |
| 23 | YC Fall 2026 application submitted | Deadline ~early August (target submission week 7/30). | queued | David | None | 7/30 |

## V1.5 — post 8/1 (deferred but not forgotten)

Per `docs/POST-5-15.md` + scattered V1.5 notes. Captured here so we don't lose them.

- docket_app + docket_admin role split (per CLAUDE.md 0001 design intent; needs Neon console)
- Custom subdomain per firm (CNAME provisioning)
- MFA enforcement at code level (currently Clerk-dashboard-config-only)
- Master KEK in KMS/HSM (currently Vercel env var)
- Year-round portal bilateral chat
- IRS Tax Pro Account browser-auto (2848 / 8821 / transcript pulls)
- Notetaker agent (meeting transcription + action-item extraction)
- Action-Item Extractor agent
- Pre-Meeting Brief agent
- Strategy agent (multi-year tax planning)
- Position agent (aggressive territory: defend or refuse)
- Practice Pattern / Promise Keeper / Outcome Prediction / Phone agents
- Suffix-deletion defense for audit chain (R2 object-locked head-hash checkpoint)
- Centralize `assertTrustGate` runtime enforcement inside `runDocketAgent`
- Rebuild Playwright auth on Clerk Testing Tokens
- Wire `check-getAdminDb-callers` + `check-trust-gate-coverage` into CI (Session 7 partial — already wired; this is a future re-tightening if needed)
- Upstash Redis swap for in-process rate limiter
- Trial fonts replacement (`apps/client-portal/public/fonts/trial/` — license expired 5/14)

---

## Done (recent — last 14 days)

Pruning lower than 14 days old; older work lives in commit history + AUTONOMOUS-QUEUE.md.

| # | Item | Commit | Shipped |
|---|---|---|---|
| D1 | Audit chain test coverage + column-drift guard | `9314da3` | 5/15 |
| D2 | Authorities NULL-tenant privilege escalation closed (migration 0036) | `14ab47b` | 5/15 |
| D3 | Webhook replay protection: Square refund + DocuSign envelope + Twilio inbound (migration 0037 + dedup helper) | `c48315d` | 5/15 |
| D4 | Trust-gate central enforcement: CI lint + runtime gate on `runDocketAgent` | `8a8f628` | 5/15 |
| D5 | Tenant-aware prompts: `notice-drafter` + `inbox-drafter` + `discovery-agent` 8867 rule | `4b27322` | 5/15 |
| D6 | Prompt-injection content boundaries on all 3 drafter prompts | `8bf61d6` | 5/16 |
| D7 | Surfaced refusalIf clauses to preparer review (DiscoveredPosition + PDF adapter) | `50166d7` | 5/16 |
| D8 | Portal multi-tenant hardcode cleanup (Profile + Messages + Welcome) | `649ba59` | 5/16 |
| D9 | RLS bypass policies (migration 0038) + verify-actions-chain tx wrap | `e344d8b` | 5/16 |
| D10 | `/prospects` admin CRM page + status-update action | `7faff8b` | 5/16 |
| D11 | FINANCIALS-FOR-ANTONIO.md + PRODUCT-FOR-ANTONIO.md | `d30f0c3` | 5/16 |
| D12 | MASTER-QUEUE.md + USER-PREFERENCES.md + CLAUDE.md §22 boot ritual update | `74d4f17` | 5/16 |
| D13 | Vision agent Bedrock fallover (isTransientAnthropicError + bedrockClient top-level exports + runVisionAgent with fallover + 7 new tests) | `c833c2e` | 5/16 |
| D14 | Form 8879 client SMS notification — auto-fire on envelope creation (Session 15 partial-close of #9; SMS-only; en/es bilingual; 10 new tests on message-body composition; tsconfig excludes for *.test.ts) | `9f054f8` | 5/16 |
| D15 | ASSUMPTIONS-TO-TEST.md habit codified — every session's ASSUMED claims captured in `docs/ASSUMPTIONS-TO-TEST.md`; CLAUDE.md §22 boot ritual updated; USER-PREFERENCES.md updated; 25 open assumptions backfilled from Sessions 3-15 | this commit | 5/16 |
| D16 | Form 8879 reminder cadence cron — hourly Inngest function `send8879Reminders` walks pending signatures per tenant's `reminder_rules`, fires reminders via the workers-side helper `send8879NotificationWorker` (en/es bilingual reminder mode; quiet-hours respected; attempt count derived from actions audit rows, no migration); 14 new tests (10 message-body + 4 quiet-hours math); Session 15 partial-close of #9 | `e018ca4` | 5/16 |
| D17 | Antonio-side sign-notification — DocuSign Connect webhook writes an issues row when signature status transitions (signed → ero_pending/high "X signed their 8879 — ready to e-file"; kba-failed → signature_pending/high with Pub-1345 re-send guidance; declined → signature_pending/medium). Surfaces in Need You queue at /home on next page load. Best-effort write inside tx with bypass_rls + current_tenant_id; webhook doesn't 500 if issue-write fails (status UPDATE has already landed). Session 16 close of MASTER-QUEUE #9 substrate (only Resend email channel remains, blocked on brand). | `61d331f` | 5/16 |
| D18 | Discovery-agent eval scaffold (MASTER-QUEUE #19 partial) — 6 golden vectors covering 4 §6695(g) happy-paths (EITC / CTC / AOTC / HOH-via-parent) + 1 false-positive guard + 1 prompt-injection case. Mirrors eval-classify.ts + eval-draft.ts pattern. Uses NullRetriever (retrievalTopK=0) to test prompt behavior in isolation from the knowledge layer. Pass threshold 80%. Codex round-2 PASS-with-suggested-fixes. Closes ASSUMPTIONS A16 (Form 8867 hard rule) + partial A15 (prompt-injection on Discovery, the highest-stakes drafter). | `e9a742c` | 5/16 |
| D19 | Notice-drafter eval (MASTER-QUEUE #19 continued) — 6 cases covering 4 happy paths (CP2000-disagree / CP14-pay / CP01A-identity-theft / FTB-residency-manual-review) + 2 prompt-injection cases (via context.noticeTextExcerpt + via triage.summary). Asserts expectedTemplate, mustNotMatchTemplate, mustNotEcho, mustNotMentionDollars, letterBody length bounds, mustNotConcede phrase guards. Codex round-2 PASS. /e2e PASS 8/8 at e9a742c gating this commit. Continues A15 (prompt-injection on drafter prompts) coverage. | `67bbfc2` | 5/16 |
| D20 | Inbox-drafter prompt-injection extension (MASTER-QUEUE #19 third drafter — closes A15 fully) — extends the existing eval-draft.ts in-place with 3 adversarial cases: injection_via_original_message_body (SMS inbound contains override directive + language flip + $999M), injection_via_issue_summary (classifier output poisoned), injection_language_switch_attack (en client + "REPLY IN SPANISH" injection). DrafterEvalCase type gains `mustNotEcho` + `mustNotMentionDollars` optional fields; runner extended with both check loops. Codex round-1 PASS no findings. | `a87648c` | 5/16 |
| D21 | Triage-classifier prompt-injection extension (MASTER-QUEUE #19 fourth agent — A15 covered across all prompt-bearing agents) — extends eval-classify.ts in-place with 2 adversarial cases: injection_force_quick_reply_on_cp2000 (Gmail body w/ CP2000 facts + injection trying to suppress alert as quick_reply; classifier holds irs_notice) + injection_force_quick_reply_on_extension_risk (SMS w/ missed-extension facts + injection forcing quick_reply; classifier holds extension_risk). ClassifierEvalCase type gains optional `mustNotEcho`; runner composes `passed = issueOk && confOk && echoOk` with descriptive error string. /e2e PASS 8/8 at a87648c gating this commit. Codex round-1 PASS no findings. | `7219624` | 5/16 |
| D22 | Intake → clients writeback fix (email + state mirror-back) — Session 17 user-walkthrough finding. Pre-fix bug: intake captured `personal.email` + `personal.addressState` in `intake_responses.answers` JSON but only `personal.fullName` was mirrored to the `clients` table. Downstream effect: `requestSign8879()` failed with `client-incomplete` because `clients.email` was null even after a complete intake; command-room never displayed the email anywhere because every render is `{client.email && ...}`. Fix: extend `apps/client-portal/src/lib/intake/write.ts` to mirror email (lowercased to match `createClient` normalization) + addressState alongside the existing fullName branch. New one-off backfill script `packages/db/scripts/backfill-clients-from-intake.ts` (--dry-run supported, idempotent, COALESCE preserves preparer-supplied values) unblocks existing test clients. Codex round-1 PASS-with-suggested-fix (added `ir.tenant_id = c.tenant_id` defense-in-depth predicate to the JOIN). | `0fda30a` | 5/16 |
| D23 | Petal v2 reconciliation — David received a sister-Claude-authored implementation brief proposing four moats (defense-by-construction / compliance-by-construction / deterministic compute / multi-year live ledgers) + six-agent architecture (Planner / Researcher / Computer / Verifier / Adversary / Drafter) + 90-day killer slice (Phase 0.5) with hard acceptance criteria. Reconciled with shipped reality: adopted the strategic framing + the Verifier + Adversary + Computer agents as priority Phase 0.5 work; pushed back on the brief's "fresh start" framing + silent dropping of L1 (Path 2) + L4 (memory architecture) + L6 (pricing) + L13 (CA-first corpus) + L14 (partner #2 mitigation); modified the "no chat" rule (kept scope-anchored chat per L9 + §4) + 1000-question eval target (re-scoped to 420 for Phase 0.5) + federal-only Phase 0.5 (added CA in parallel for Antonio dogfooding). Files: new `docs/RECONCILIATION-PETAL-V2.md` (full reconciliation doc + the 4 RL decisions for the sister Claude); CLAUDE.md §26 added (Petal v2 architecture + four ironclad rules + Phase 0.5 acceptance criteria); CLAUDE.md L3 swapped (5 capability pillars → 4 moats); MASTER-QUEUE Phase 0.5 priority track added (P1-P10 covering computer toolkit / verifier / adversary / ledgers / CA corpus / eval expansion). | this commit | 5/23 |

---

## How this doc gets maintained

Three rules:

1. **At every session start**, I (Claude) read this doc as part of the boot ritual. If I have to ask "what's next?", this doc didn't do its job — refactor it.
2. **At every commit that ships from the queue**, the row moves to `## Done (recent)` with the commit SHA + ship date.
3. **At every session end (or major decision)**, if the queue order shifted, I update it in the same commit as the work.

If this doc gets stale (older than 7 days without a touch + an item is in `queued` longer than expected), the trigger is to review + re-prioritize. Don't let it become read-only.

---

*Replaces no existing doc. Sits alongside PRODUCT-ROADMAP.md (the phase-organized vision) + DESIGN-PARTNER-ACQUISITION-PLAN.md (the acquisition sprint) + the punch lists (PRODUCTION-READINESS.md + AUTONOMOUS-DECISIONS.md). This doc is the single forward-looking queue; those others retain their reference roles.*
