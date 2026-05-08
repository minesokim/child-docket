# Autonomous Work Queue

> *Live ledger of what the AI factory is shipping overnight.*
> *Updated continuously as items move through gates.*

User wakes up, reads this top-to-bottom in 60 seconds, sees exactly what shipped + what needs eyes.

---

## How items move

```
queued → in-progress → in-review (codex) → done
                  └─→ blocked (with reason)
```

Each `done` item links to its commit hash + commit message. Each `blocked` item names what unblocks it.

## Quality gates (every item passes ALL four)

1. **Typecheck** (`pnpm typecheck` — must pass)
2. **Smoke test** (per `/smoke-test` skill — required if item touches Inngest workers / doc processing / storage / encryption / multi-step flows / new /api routes)
3. **Self-critique** (re-read like a senior reviewer; check pattern adherence, error handling, types, atomic commits)
4. **Codex review** (second-opinion agent; fix what it surfaces or document why I overruled)

Failure on any gate → fix and re-loop. Three failed items in a row → STOP and write status report.

---

## Tonight's queue (no-credential items — start immediately)

| # | Item | Status | Effort | Commit | Notes |
|---|---|---|---|---|---|
| 1 | Webhook signature verification helper | ✅ done | ~1d | [`b31e91f`](https://github.com/minesokim/child-docket/commit/b31e91f) + [`00cd377`](https://github.com/minesokim/child-docket/commit/00cd377) (codex fixup) | 32/32 tests. Subpath export `@docket/shared/webhooks`. Timing-safe. Codex review cycle exercised end-to-end. |
| 2 | Test fixtures package | ✅ done | ~1d | [`605ba26`](https://github.com/minesokim/child-docket/commit/605ba26) + [`7d36688`](https://github.com/minesokim/child-docket/commit/7d36688) (lockfile fixup) | 1 tenant + 3 users + 3 clients + 3 engagements + 3 intake answers + 5 documents. **CAUTIONARY TALE**: original commit broke deploys because lockfile wasn't regenerated. /code-quality skill now has hard rule to prevent. |
| Q1 | `/code-quality` skill (pre-commit gate) | ✅ done | ~0.5d | [`a91f165`](https://github.com/minesokim/child-docket/commit/a91f165) + [`7e59c58`](https://github.com/minesokim/child-docket/commit/7e59c58) (Step 7) | Senior-engineer pre-commit checklist. Anti-patterns blocked. Lockfile rule locked in. Step 7 = verify deploy READY post-push (added after the Sentry endpoint drift). |
| Q2 | `/edge-cases` + `/decisions-log` skills + AUTONOMOUS-DECISIONS.md | ✅ done | ~0.5d | [`b430887`](https://github.com/minesokim/child-docket/commit/b430887) | Pre-implementation edge-case enumeration (8-15 cases, handle/document/out-of-scope). Decision-tracking format with severity + reversal path. Backfilled 10 existing entries from this session. |
| Q3 | AUTONOMOUS-PROTOCOL.md (session-start bootloader) | ✅ done | ~0.5d | this commit | The discipline that prevents AI-sloppenheimer after context refreshes. Identify-mode, session-start ritual, build-cycle diagram, anti-patterns blocked, recovery sequence, end-of-session ritual. Wired into CLAUDE.md §23 as the FIRST canonical doc. |
| B2 | Sentry wiring (DSN unblocked) | ✅ done | ~0.5d | [`a122ae5`](https://github.com/minesokim/child-docket/commit/a122ae5) → [`95e2629`](https://github.com/minesokim/child-docket/commit/95e2629) → [`40c5caa`](https://github.com/minesokim/child-docket/commit/40c5caa) | Both apps wired with `app:` tag. Test endpoints allowlisted in Clerk middleware. Final fix: explicit `captureException` + `await flush(2000)` because Vercel serverless lambdas terminate before auto-capture transport drains. Events confirmed landing. |
| B1 | Bedrock fallback in orchestrator (creds unblocked, tested working) | ✅ done | ~2d | [`303f886`](https://github.com/minesokim/child-docket/commit/303f886) | `callClaudeWithFallover` — Anthropic primary, Bedrock fallback on transient errors only (5xx/429/network). 38/38 unit tests + 4/4 smoke tests. Sonnet 4.6 + Haiku 4.5 both verified via `us.anthropic.*` cross-region inference profiles. Deploy verified READY post-push. |
| 9 | `@docket/orchestrator` provider abstraction | ✅ done | ~1d | folded into [`303f886`](https://github.com/minesokim/child-docket/commit/303f886) | Replaced standalone abstraction with `callClaudeWithFallover` directly in `providers.ts`. Same outcome: provider routing is hidden behind one function the agents call. |
| 3 | Schema migrations 0019-0021 | ✅ done | ~1d | [`c8cfa18`](https://github.com/minesokim/child-docket/commit/c8cfa18) | `firm_profile` (PK on tenant_id), `firm_patterns` (UNIQUE per tenant+type+key), `client_facts` (composite FK on tenants+clients to prevent cross-tenant client binding, supersession trigger validates same-tenant+client+fact_key chain). Codex review HIGH × 2 + LOW × 2 fixed in same commit. |
| 4 | Audit trail crypto chaining | ✅ done | ~1d | [`0680874`](https://github.com/minesokim/child-docket/commit/0680874) | Migration 0022 adds `chain_seq` (per-tenant monotonic, set by trigger under advisory lock) + `prev_hash` + `row_hash` to actions. `verify_actions_chain(tenantId)` walks chain in order. client_id intentionally excluded from hash (CCPA compatibility). Codex HIGH × 3 + MEDIUM × 1 fixed in rewrite. Suffix-deletion deferred to v1.5 (R2 head-hash checkpoint). |
| 5 | PII regex scrubbing helper | ✅ done | ~0.5d | [`8f0c2d5`](https://github.com/minesokim/child-docket/commit/8f0c2d5) | `packages/shared/src/pii-scrubber.ts` + 32 tests. SSN / EIN / BANK detection. BANK regex digit-bookended with internal dashes/spaces (catches grouped formats). Documented false negatives: SSN with periods, 7-digit no-separator account, EIN no-dash falls through to SSN. Codex MEDIUM × 2 + LOW × 3 addressed. |
| 6 | Prompt version control (`@docket/prompts`) | ✅ done | ~1d | [`fbae613`](https://github.com/minesokim/child-docket/commit/fbae613) | New workspace package. `getPrompt(id)` with hash-drift detection (sha256(version+template) verified at load). triage-classifier + inbox-drafter migrated. doc-classifier migration pending (mechanical). 11 tests pass; lockfile updated in same commit. |
| 7 | Status-aware UX components | ✅ done | ~1d | [`0521701`](https://github.com/minesokim/child-docket/commit/0521701) | `StatusBanner` (severity info/warn/error, role=alert/status, OKLCH palette), `ServiceIndicator` (per-vendor dot), pre-shaped helpers `bedrockFallbackBanner` / `neonReadOnlyBanner` / `r2UnavailableBanner`. Codex HIGH × 1 + MEDIUM × 2 + LOW × 1 fixed (inert keyboard block, removed forceReadOnly footgun, de-promised copy). |
| 8 | Read-only mode UI primitive | ✅ done | ~0.5d | folded into [`0521701`](https://github.com/minesokim/child-docket/commit/0521701) | `ReadOnlyContext` + `ReadOnlyProvider` + `useIsReadOnly` + `WriteAction` (uses HTML `inert` attribute to block pointer + keyboard + focus). UX-only; server actions check independently. |
| 10 | Eval harness scaffolding | ✅ done | ~1d | [`3a26ed3`](https://github.com/minesokim/child-docket/commit/3a26ed3) | `services/workers/scripts/eval-classify.ts` + 8 golden cases. Macro F1 across 11 issue types; release-gate at 0.85. Run via `pnpm --filter @docket/workers eval:classify`. ~$0.001 per run on Haiku 4.5. Pattern extends to inbox-drafter + doc-classifier. |

**Tonight's session shipped (5/8 → present)**: Q1 + Q2 + Q3 + B1 + B2 + items 1-8 + item 9 + item 10 = 14 done. Original `tonight's queue` complete; `Credential-blocked items` complete except B3 (Neon read replica wiring, not yet started). All non-blocked v1 items in this queue file are done.

---

## Credential-blocked items (queued for when auth lands)

| # | Item | Blocked on | Effort once unblocked |
|---|---|---|---|
| B1 | ~~Bedrock fallback~~ | ~~AWS creds~~ | ✅ done — see B1 above |
| B2 | ~~Sentry DSN wiring~~ | ~~DSN env vars~~ | ✅ done — see B2 above |
| B3 | Neon read replica wiring | DATABASE_URL_READ_REPLICA confirmed valid | ~1d. User provided `DATABASE_URL_READ_REPLICA` earlier this session. Wiring not yet done — pairs with item #7 (status-aware UX, since same-cell replica is the v1 fallback story per [`AUTONOMOUS-DECISIONS.md` §5](AUTONOMOUS-DECISIONS.md)). |

---

## Decisions queued for morning review

(Items where I made a judgment call you might want to revisit. Will populate as I work.)

*None yet.*

---

## Items requiring user action (cannot do alone)

(Will populate as I work.)

*None yet.*

---

## Stop-condition triggers (none active)

- [ ] Three failed items in a row
- [ ] Production smoke test failure
- [ ] Prod 500s spike (per Vercel logs)
- [ ] Codex review surfaces security issue
- [ ] Commit touching >10 files (flag before push)

---

## Status as of overnight session end (2026-05-08, 03:00 PT)

**SEE [`OVERNIGHT-HANDOFF-2026-05-08.md`](OVERNIGHT-HANDOFF-2026-05-08.md) FOR THE COMPREHENSIVE SUMMARY.**

23 commits shipped overnight. /score 94/100 weighted. /align verdict: 9 ALIGNED, 1 BORDERLINE (trust gate substrate-without-current-consumer), 0 MISALIGNED, 1 acknowledged-exception (OTP bypass with launch-prep removal tracked).

Each commit passed the four-skill cycle (edge-cases enumerated, code-quality gates, codex review where applicable, decisions logged where applicable, deploy verified per Step 7). Three new skills shipped (`/keep-going`, `/score`, `/align`, `/e2e`) that codify the loop the user asked for.

ACTION ITEMS for the morning (~10 min total):

1. Set 4 env vars in Vercel (BOTH apps) — see OVERNIGHT-HANDOFF #1
2. Review 6 architectural decisions [11]-[16] — see OVERNIGHT-HANDOFF #2  
3. Find Clerk's test-phone setting + remove the OTP bypass — see OVERNIGHT-HANDOFF #3

Commits since session start:

1. [`def8a9d`](https://github.com/minesokim/child-docket/commit/def8a9d) — AUTONOMOUS-PROTOCOL.md bootloader + queue + decisions log [11].
2. [`c8cfa18`](https://github.com/minesokim/child-docket/commit/c8cfa18) — schema migrations 0019-0021 (memory architecture foundation, composite FK + cross-tenant trigger).
3. [`0680874`](https://github.com/minesokim/child-docket/commit/0680874) — migration 0022 audit-trail cryptographic chaining.
4. [`8f0c2d5`](https://github.com/minesokim/child-docket/commit/8f0c2d5) — PII regex scrubber for inbound text channels.
5. [`fbae613`](https://github.com/minesokim/child-docket/commit/fbae613) — `@docket/prompts` package with hash-drift detection.
6. [`ee9c0a7`](https://github.com/minesokim/child-docket/commit/ee9c0a7) — mid-session queue update.
7. [`0521701`](https://github.com/minesokim/child-docket/commit/0521701) — status-aware UX banners + read-only primitive.
8. [`3a26ed3`](https://github.com/minesokim/child-docket/commit/3a26ed3) — eval harness scaffold (triage-classifier; F1 release-gate at 0.85).

Five new AUTONOMOUS-DECISIONS entries to review ([11]-[15]) — see [`AUTONOMOUS-DECISIONS.md`](AUTONOMOUS-DECISIONS.md). Four are architectural-severity and pending explicit review.

Production: all 8 deploys landed READY. Last successful smoke test: 14/14 PASS against prod (commit `1576ef0`).

This file's `Tonight's queue` is now empty modulo B3 (Neon read replica wiring, not started). Subsequent work picks from [`PRODUCTION-READINESS.md`](PRODUCTION-READINESS.md) directly:

  Wk 4-5  Trust gate enforcement (POSITION-FRAMEWORK §6 spec)
          §7216 consent UI add-on
          Cost dashboard + outlier alerts
  Wk 6    Discovery agent end-to-end (the v1 wedge demo)

Follow-ups noted in commit messages:
  - doc-classifier.ts migration to `@docket/prompts` (~15 min, mechanical)
  - Nightly Inngest cron calling `verify_actions_chain` per tenant
  - R2 head-hash + row-count checkpoint for suffix-deletion detection (v1.5)
  - Wire `scrubPII` into Twilio + Gmail + portal-chat ingest paths
  - v1.5: consolidate `PII_PATTERNS` between pii-scrubber and sentry-scrubber
  - Cost telemetry: tag `actions.tool_input` with `prompt.version`
  - Server-side read-only mode helper at `apps/*/src/lib/read-only-mode.ts`
  - `/api/health` endpoint for vendor-status polling
  - Eval harness extension to inbox-drafter + doc-classifier
  - GitHub Actions wiring for eval-classify on every PR
