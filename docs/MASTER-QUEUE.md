# Docket — Master Queue

> *Single ordered "what's next" doc. Read at every session start.*
> *Consolidates the forward-looking queue from PRODUCT-ROADMAP.md +*
> *DESIGN-PARTNER-ACQUISITION-PLAN.md + PRODUCTION-READINESS.md +*
> *POST-5-15.md + recent session findings.*
>
> *Last updated: 2026-05-16 (Session 13)*

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

## Mid queue — 3-6 weeks (5/30 → 6/27)

Phase 3 + Phase 4 work per PRODUCT-ROADMAP.md. Mostly engineering items unblocked by Items #1-#7.

| # | Item | Why | Status | Owner | Blocker | Target |
|---|---|---|---|---|---|---|
| 8 | OLT browser automation MCP server | Wedge demo + Antonio's primary tax software. Per CLAUDE.md §3 it's a forced integration moat (no AI-native competitor integrates with OLT). | queued | Claude | None | 6/20 |
| 9 | Form 8879 KBA-backed signing wired end-to-end | IRS Pub 1345 compliance for remote 8879. Session 15 (5/16) closed the SMS-notification gap — Antonio uploads PDF → envelope created → client SMS'd automatically with signing link. Remaining gaps for FULL end-to-end: (a) Resend email channel (blocked on brand decision per §18), (b) reminder cadence (per migration 0031 `reminder_rules`), (c) Antonio-side notification when client signs. | in-progress | Claude | Item #15 (Resend) for email channel | 6/15 |
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
| 19 | Eval suite for prompt-bearing agents | Currently zero behavior-level tests on `discovery-agent` / `inbox-drafter` / `notice-drafter` prompts. Content-invariant tests only. | queued | Claude | None | 7/01 |
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
| D14 | Form 8879 client SMS notification — auto-fire on envelope creation (Session 15 partial-close of #9; SMS-only; en/es bilingual; 10 new tests on message-body composition; tsconfig excludes for *.test.ts) | this commit | 5/16 |

---

## How this doc gets maintained

Three rules:

1. **At every session start**, I (Claude) read this doc as part of the boot ritual. If I have to ask "what's next?", this doc didn't do its job — refactor it.
2. **At every commit that ships from the queue**, the row moves to `## Done (recent)` with the commit SHA + ship date.
3. **At every session end (or major decision)**, if the queue order shifted, I update it in the same commit as the work.

If this doc gets stale (older than 7 days without a touch + an item is in `queued` longer than expected), the trigger is to review + re-prioritize. Don't let it become read-only.

---

*Replaces no existing doc. Sits alongside PRODUCT-ROADMAP.md (the phase-organized vision) + DESIGN-PARTNER-ACQUISITION-PLAN.md (the acquisition sprint) + the punch lists (PRODUCTION-READINESS.md + AUTONOMOUS-DECISIONS.md). This doc is the single forward-looking queue; those others retain their reference roles.*
