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
| 3 | Schema migrations 0019-0021 | queued | ~1d | — | `firm_profile`, `firm_patterns`, `client_facts`. Memory architecture foundation per `docs/MEMORY-ARCHITECTURE.md` §2. SQL files in `packages/db/migrations/`; not auto-applied. |
| 4 | Audit trail crypto chaining | queued | ~1d | — | Migration adds `prev_hash` + `row_hash` to `actions`; helper computes + verifies. Tamper detection on the audit log itself. |
| 5 | PII regex scrubbing helper | queued | ~0.5d | — | Standalone module in `packages/shared/` for SSN/EIN/bank-account/DL detection + redaction. Inbound text channels (SMS / portal chat) feed it before Anthropic. |
| 6 | Prompt version control (`prompts/` registry) | queued | ~1d | — | Move existing system prompts (triage-classifier, inbox-drafter) to versioned MD files + loader. Per MEMORY-ARCHITECTURE §3. |
| 7 | Status-aware UX components | queued | ~1d | — | Banner + per-service indicators in `packages/ui/`. Anthropic outage / Neon outage / R2 outage / read-only-mode states. |
| 8 | Read-only mode UI primitive | queued | ~0.5d | — | Banner + write-action wrapper in `packages/ui/`. Pairs with #7. |
| 10 | Eval harness scaffolding | queued | ~1d | — | Pattern + first agent eval (`services/workers/scripts/eval-classify.ts`). Golden-vector approach for triage classifier. |

**Tonight's session shipped (5/8 → present)**: Q1 + Q2 + Q3 + B1 + B2 + items 1-2 + item 9 = 8 done. Items 3-8 + 10 remain.

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

## Status as of mid-session (2026-05-08)

Tonight's session has shipped: webhook verification + codex fixup, test fixtures + lockfile fixup, three project skills (code-quality / edge-cases / decisions-log) + bootloader doc, Sentry pipeline (initial wire + middleware allowlist + flush fix, events confirmed landing), Bedrock fallback in the orchestrator (Anthropic primary + transient-error classifier + cross-region inference profiles, 38/38 unit tests + 4/4 smoke tests). Last successful smoke test: 14/14 PASS against prod (commit `1576ef0`); pipeline healthy. Bedrock failover fired in dev once during smoke test (intentional probe).

Next item: #3 schema migrations 0019-0021 (firm_profile / firm_patterns / client_facts) — memory architecture foundation per [`docs/MEMORY-ARCHITECTURE.md`](MEMORY-ARCHITECTURE.md) §2. Pure SQL files in `packages/db/migrations/`; not auto-applied so no deploy implications.
