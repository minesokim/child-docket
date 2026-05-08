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
| Q1 | `/code-quality` skill (pre-commit gate) | ✅ done | ~0.5d | [`a91f165`](https://github.com/minesokim/child-docket/commit/a91f165) | Senior-engineer pre-commit checklist. Anti-patterns blocked. Lockfile rule locked in. |
| B2 | Sentry wiring (DSN unblocked) | in-progress | ~0.5d | — | Both Vercel projects have SENTRY_DSN + NEXT_PUBLIC_SENTRY_DSN. Command-room 3 configs updated with `app: command-room` tag. Need: client-portal 3 configs + test-error endpoints in both apps + verify events land. |
| B1 | Bedrock fallback in orchestrator (creds unblocked, tested working) | queued | ~2d | — | Sonnet 4.5 + Haiku 4.5 both responded via Bedrock. `us.anthropic.claude-*` model IDs work. Now writing wrapper in `services/orchestrator`. |
| 3 | Schema migrations 0019-0021 | queued | ~1d | — | `firm_profile`, `firm_patterns`, `client_facts`. SQL files only; not applied yet. |
| 4 | Audit trail crypto chaining | queued | ~1d | — | Migration adds `prev_hash` + `row_hash` to `actions`; helper computes + verifies. |
| 5 | PII regex scrubbing helper | queued | ~0.5d | — | Standalone module in `packages/shared/` for SSN/EIN/bank-account/DL detection + redaction. |
| 6 | Prompt version control (`prompts/` registry) | queued | ~1d | — | Move existing system prompts to versioned MD files + loader. |
| 7 | Status-aware UX components | queued | ~1d | — | Banner + per-service indicators in `packages/ui/`. |
| 8 | Read-only mode UI primitive | queued | ~0.5d | — | Banner + write-action wrapper in `packages/ui/`. |
| 9 | `@docket/orchestrator` provider abstraction | queued | ~1d | — | Wrapper that's Bedrock-ready (Bedrock client wiring lands when AWS creds arrive). |
| 10 | Eval harness scaffolding | queued | ~1d | — | Pattern + first agent eval (`services/workers/scripts/eval-classify.ts`). |

**Realistic completion target tonight**: items 1-5 (~5 days of work, 30-45 min per item with tooling). Items 6-10 likely tomorrow.

---

## Credential-blocked items (queued for when auth lands)

| # | Item | Blocked on | Effort once unblocked |
|---|---|---|---|
| B1 | Bedrock fallback in `runDocketAgent` | AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BEDROCK_REGION | ~2d (most code already in place via #9) |
| B2 | Sentry DSN wiring | SENTRY_DSN_COMMAND_ROOM, SENTRY_DSN_PORTAL | ~0.5d |
| B3 | Neon read replica wiring | DATABASE_URL_READ_REPLICA | ~1d |

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

## Status as of session start (2026-05-08)

Last successful smoke test: 14/14 PASS against prod (commit `1576ef0`). Pipeline is healthy. R2 has working binarized PDFs. Inngest is dispatching events successfully on new deploys. Position framework + memory architecture + production readiness + product roadmap docs all shipped.

Tonight's session begins with this queue. First item: #1 webhook signature verification helper.
