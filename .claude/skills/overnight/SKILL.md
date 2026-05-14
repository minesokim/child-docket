# /overnight — hands-off autonomous build cycle

> *Same protocol-gate cycle we run face-to-face. Same rules. Same discipline.*
> *Pick task → ship clean → pick next → ship clean → repeat until stop condition.*
> *No Protocol-Skip. No `--no-verify`. No "I'll get to it next time."*

---

## STATUS: LOAD-BEARING

This skill is **not** an aspirational checklist. It is the contract that lets the founder leave the house and trust the build is happening correctly while they sleep. Treat the rules below as immutable for the duration of overnight mode.

Founder mandate (2026-05-12, verbatim):

> "if its overnight mode dont just make it a skill you glance over and forget. make it higher in power so that you actually listen."

If you cannot satisfy every rule below on a given commit, **STOP** and surface to the user before continuing. Stopping is fine. Skipping is not.

---

## When this fires

- User says "go overnight" / "run overnight" / "/overnight" / "autonomous overnight"
- User leaves a queue and says "keep going until X" / "until you're done" / "until morning"
- User explicitly invokes this skill with `/overnight`

The skill stays active across compactions / context resets until the user says "stop", "pause", "I'm back", or a stop condition fires. After compaction, re-read this file as part of the boot-up ritual (CLAUDE.md §22 already points at it).

---

## HARD RULES — never violate

These are encoded after the 5/8/2026 incident where an autonomous run shipped 11 commits while skipping /score, /align, /edge-cases, /craft. The user response was: *"never ever make this mistake again. you are jeopardizing me."*

1. **NEVER use `git commit --no-verify`.** Pre-commit hooks run typecheck + tests for a reason. If they fail, fix the underlying issue.
2. **NEVER use the `Protocol-Skip: <reason>` trailer on `feat()` or `fix()` commits.** In normal mode it's an escape hatch for genuine emergencies. In overnight mode it is **forbidden** on any commit whose subject starts with `feat(` or `fix(` — those are the only commits where the protocol-gate enforces trailers, so a skip would suppress the safety contract that overnight mode exists to honor. `docs()` and `chore()` commits never need the trailer block (the gate ignores them), so they ship cleanly without any skip. If a `feat`/`fix` trailer is required and you don't have a real PASS for it, STOP.
3. **NEVER mark `Codex-Reviewed: N/A` or skip codex.** Every `feat(...)` and `fix(...)` commit runs `bash scripts/codex-review-staged.sh` and lands with `PASS` or `PASS-with-fixes-applied`.
4. **NEVER mark `Craft: N/A` on a UI commit.** A commit is "UI" if its diff touches:
   - `apps/*/src/app/**/*.{tsx,jsx,css}`
   - `apps/*/src/components/**/*.{tsx,jsx,css}`
   - `packages/ui/src/components/**/*.{tsx,jsx}`
   - `packages/ui/src/tokens.{ts,tsx}` or `packages/ui/src/styles.css`
   Run /craft. Report PASS or FAIL. The gate enforces this server-side too.
5. **NEVER skip /e2e past the cadence threshold.** Warn at 3 feat|fix commits since last pass. BLOCK at 6. Just run it; it costs $0.012 and 14 seconds.
6. **NEVER commit with `Score < 95`.** The user codified the floor: *"it needs to be 95+. if it doesn't reach those metrics, do it until it does."* Iterate until it passes.
7. **NEVER commit with `Align: MISALIGNED`.** Reshape or kill the change. The product mission is not negotiable.
8. **NEVER amend a commit to fix a missing trailer.** Trailers attest the protocol run; amending changes nothing about the prior run. Land a follow-up commit instead.
9. **NEVER `git add -A` or `git add .`.** Always stage specific files by name. Otherwise you risk committing `.env`, large binaries, or unrelated WIP.
10. **NEVER assume an integration "just works" because it compiled.** Run the smoke for any module the diff touches. Smoke is cheap; production fires are not.
11. **NEVER push to `main` with a failing pre-commit hook.** Investigate. Fix. Re-commit. Push.
12. **NEVER spend more than $5 of Anthropic / Voyage / Cohere API in a single overnight session without surfacing it.** Cost ceilings exist to catch runaway loops.

If you find yourself reaching for any of these escape hatches: **STOP**. Print the status. Wait for the user.

---

## Per-task ritual (mandatory, in order)

For every task in the autonomous loop, execute every step. Do not batch, do not interleave, do not skip ahead.

| # | Step | Tool / Command | Pass criterion |
|---|---|---|---|
| 0 | Clean-index precondition | `git diff --cached --quiet` | Index is empty before this task starts. Codex C5-overnight round 6 P2: if anything is already staged, `git add` accumulates into it and the eventual commit pulls in unrelated WIP. If non-empty, surface to user — do NOT auto-clear (could drop their work). |
| 1 | /edge-cases | Enumerate 8-15 edge cases (input / state / failure / time / permission / domain-specific). | Each one marked `handle` / `document` / `out-of-scope`. |
| 2 | Plan | Brief approach (files, functions, tests). | Written in your reasoning, not just imagined. |
| 3 | Implement | Edit / Write the code. | The diff matches the plan. |
| 4 | Typecheck | `pnpm -r typecheck` | 13/13 packages clean. |
| 5 | Tests | `cd packages/shared && bun test src`; any relevant smoke. | All pass. |
| 6 | /code-quality | Pattern adherence, no `console.log`, no untyped `any` w/o justification, lockfile-package.json sync. | No flags. |
| 7 | /craft (if UI) | Apple-bar UX check: hierarchy / copy voice / empty-loading-error states / every element earns its place. | PASS. |
| 8 | Stage diff | `git add <specific files>` | Only the intended files. |
| 9 | /codex review | **Token-efficient form: `bash scripts/codex-review-staged.sh --summary-only`** (cuts output 70-85%). Run via Agent (subagent) when budget-tight. Loop up to **5 rounds**. If round 5 still has the same finding, STOP. | Clean (or all findings fixed) |
| 10 | /score | Identify gap. Iterate until ≥95. | `Score: ≥95/100`. |
| 11 | /align | Six-question alignment check vs product anchors + L1-L16. | `Align: ALIGNED`. |
| 12 | /smoke-test | If diff touches Inngest workers / doc processing / storage / server actions firing events / encryption / new /api/* routes. | All checks PASS. |
| 13 | /e2e cadence pre-commit gate | If this would be the **3rd+** feat\|fix commit since the last `/e2e` pass, run `pnpm --filter @docket/workers e2e` **BEFORE committing**. Codex C5-overnight round 6 P2 #1: protocol-gate enforces BLOCK at 6 server-side, but waiting until after push means commit #6 reaches remote before /e2e fails. Run pre-commit when ≥3 to fail fast. | /e2e PASS 8/8. |
| 14 | Commit | `git commit --file=.git/COMMIT_MSG_TMP.txt` with full trailer block. | Pre-commit + commit-msg hooks pass. |
| 15 | Push | `git push` | Remote accepts. |
| 16 | STATE.md sync | Update Last verified line + build queue row + Connected systems if applicable. Commit as `docs(state): ... — sync substrate state`. `docs()` commits do NOT require the protocol-gate trailer block (the gate only enforces `feat()`/`fix()`), so no `Protocol-Skip` is needed; commit cleanly. | Pushed. |
| 17 | /decisions-log | If a judgment call was made (naming / UX / scope / architecture / default / deferral), append to `docs/AUTONOMOUS-DECISIONS.md`. | Row added. |
| 18 | Per-task report | One line: `feat(scope): summary @ <sha> · cost $X.XXX · cycles N` | Surface to user log. |
| 19 | `/clear` if next task is unrelated | Context cleanup. Run `/clear` after STATE.md sync IF the next task has no meaningful dependency on the prior chat (e.g., different package, different primitive, different layer). Skip /clear if continuing in tightly-coupled work (e.g., immediate follow-up fix to the same module). Per docs/TOKEN-EFFICIENCY.md: avoids carrying 50-100K tokens of prior-task context into the next commit. | Token budget protected. |

---

## Pick-next-task algorithm

Before starting the next task, score candidates and pick the highest. Read sources in this order:

1. **`docs/STATE.md`** "Active development tasks" — current substrate-coding queue. C-track has natural ordering (C1→C2→C3→…).
2. **`docs/AUTONOMOUS-QUEUE.md`** — rolling work queue (canonical for "what's queued"); newer than CLAUDE.md §15.
3. **`docs/PRODUCTION-READINESS.md`** — gap list by priority tier.
4. **`docs/POST-5-15.md`** — deferred items.
5. **CLAUDE.md §15** — phase plan (carries staleness warning; use as last resort).
6. **followups from recent commits** — `git log -50 --grep="FOLLOWUP\|FOLLOW-UP\|TODO"` surfaces work the recent self flagged.

### Scoring

For each candidate task, sum:

- **+3** if it unblocks 2+ other queued tasks (e.g., C6 PostgresRetriever unblocks C7-C12 Discovery)
- **+2** if it's an Antonio-facing demo dependency (5/30 sub-milestone or 100-customers-by-8/1 sprint item)
- **+2** if it's a hard-deadline item (e.g., trial fonts license expires 5/14/2026)
- **+1** if substrate-only / low-risk (encryption hardening, audit chain extension, schema additive migration)
- **−2** if it requires PROD credential / user approval (skip; surface to user)
- **−3** if it requires schema change AND the schema migration is non-additive (drop column, rename, type change — needs user approval first)
- **−2** if recent commit chain has 3+ failed codex rounds on similar code (signals architectural disagreement; back off)

Pick the highest-scoring task. Tie-break by file-path proximity to the just-shipped commit (cache warmth) or alphabetical task ID (deterministic).

Print the top 3 candidates and the chosen one before starting work. Format:

```
[overnight] Picking next task from queue.
  Candidates:
    +5  C6 PostgresRetriever (unblocks C7-C12 + retrieval pipe demo)
    +3  C7 Discovery prompt scaffolding
    +1  trial-fonts-license-resolution (hard deadline 5/14)
  Chosen: C6 PostgresRetriever
```

---

## Stop conditions (ONLY these — comprehensive list)

Stop the loop and surface a session report to the user if ANY of these fire:

1. **Queue empty** — no candidate tasks across all sources. Print summary; await direction.
2. **PROD credential required** — task needs a secret only the user can paste.
3. **Schema migration approval required** — non-additive change (drop / rename / type cast).
4. **/e2e fails** AND the fix attempt fails. Don't loop forever on broken composition.
5. **Codex round 5 still has the same finding** as round 4. Print finding; ask user.
6. **Anthropic + Voyage + Cohere combined spend ≥ $5** for the session. Print spend; ask user.
7. **3 consecutive task failures** (cycle aborted at step 4-12). Print failures + suggest next move.
8. **Typecheck or shared tests start failing on `main` for a reason unrelated to the just-shipped change.** Investigate; don't push more on top.
9. **Repository state corrupted** — merge conflict on `main`, detached HEAD, force-push by someone else.
10. **User says "stop" / "pause" / "wait" / "hold on" / "I'm back".**
11. **Context budget critically low** (< 10% remaining estimate). Final-status commit + handoff.
12. **Three-strikes-stop**: 3 items in a row failed the four-skill cycle. Status report; wait for human.

When you stop: print a per-task report (commit sha + 1-line summary + cost) + the stop reason + what's blocked + one suggested next step. Do not just go silent.

---

## Token efficiency — required reading

Tokens are budget. Codex rounds + tool outputs + commit messages are the biggest drains. Disciplines below ship same-or-higher output quality at 30-50% the token cost.

### Codex via subagent (preferred when budget-tight)

The default `bash scripts/codex-review-staged.sh` dumps 1500-3000 tokens per round into the main session's context. Multi-round commits compound. **Run codex via Agent subagent** so the verbose output stays in the agent's context; only the verdict returns:

```
Agent({
  subagent_type: "general-purpose",
  description: "Codex review staged Cnn diff",
  prompt: "Run `bash scripts/codex-review-staged.sh --summary-only`.
  Return ONLY: (a) verdict CLEAN/HAS_FINDINGS, (b) up to 3 most
  important findings with file:line and one-sentence fix, (c) nothing
  else. Under 150 words total."
})
```

When the budget allows (early in a session, fresh `/clear`), run codex inline so the operator sees the full output for debugging. When the budget is tight (>50% weekly quota consumed, late session), subagent it.

### Filter tool outputs aggressively

`pnpm typecheck 2>&1 | tail -10` keeps the last 10 lines but the BASH buffer still holds the full output in some contexts. Better:

```bash
pnpm typecheck 2>&1 | grep -E "error|Error|FAIL|✗" | head -20
bash scripts/codex-review-staged.sh --summary-only
pnpm test 2>&1 | grep -A 3 -E "FAIL|✗|expect\(.*\)\.toEqual" | head -50
```

Project-level env vars in `.claude/settings.json` cap output server-side:
- `BASH_MAX_OUTPUT_LENGTH=8000` — caps any bash command output at ~2K tokens
- `MAX_MCP_OUTPUT_TOKENS=4000` — caps MCP server responses
- `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=70` — auto-compact at 70% instead of default 95%
- `MAX_THINKING_TOKENS=8000` — caps extended thinking; default is tens of thousands

### Commit message discipline

20-40 lines max per commit body. Detailed rationale belongs in `docs/AUTONOMOUS-DECISIONS.md` (linked from the commit). The protocol-gate trailers (Edge-Cases / Score / Align / Craft / Codex-Reviewed / Compliance-Check) MUST be present; the body prose around them should be terse.

Bad (this overnight session pattern, 80-150 lines per message): full architecture writeup + every codex round detail + next-block roadmap.

Good (target going forward, 20-40 lines):
```
feat(scope): C28 short title

One paragraph: what shipped + why now (≤ 5 sentences).

Verification:
  - typecheck 16/16 PASS
  - tests N/N PASS
  - codex M rounds (S findings fixed)
  - /e2e PASS at <sha> if applicable

NEXT: <pointer to docs/AGENT-PLATFORM.md or docs/AUTONOMOUS-DECISIONS.md>

[trailer block — Edge-Cases / Score / Align / Craft / Codex-Reviewed / Decisions / Compliance-Check]
```

### Grep before Read for symbol lookups

When the goal is "what's the shape of `getTenantCredential`," use Grep with `-A 5`. Don't Read the whole 200-line file.

```bash
Grep "export.*getTenantCredential" path -A 8
# NOT: Read path  (sends full file)
```

Use Read with `offset` + `limit` for targeted reads when you need surrounding context. Full-file Read only when you actually need full-file understanding.

### /clear cadence

Run `/clear` after STATE.md sync (per-task ritual step 19) IF the next task is meaningfully independent. Don't /clear inside a tight cluster (e.g., codex r1 → r2 → r3 of the same commit; rapid follow-up fix to the same module). Anthropic's prompt cache has 5-min TTL; rapid commits in tight time windows benefit from cache hits.

### Stop-conditions for token burn

Add to the existing stop conditions:
- If a single task burns >$1.50 in codex rounds, you are in a refactor that needs human input (existing rule for 5+ rounds applies; this is the cost-side cutoff)
- If session approaches the **weekly** subscription quota (>80% used in <5 days), STOP and surface — don't keep grinding through codex rounds

---

## Cost discipline — required reading

You are spending real money in overnight mode. Track it.

- **Codex review**: ~$0.10-0.30 per round, depending on diff size. 4 rounds on C5 ≈ $0.80.
- **/e2e run**: ~$0.012 verified.
- **Voyage embeddings**: now on paid tier (post-2026-05-12). Re-ingest the 20-position library = ~46K tokens = $0.0056. Free tier headroom still wide.
- **Cohere Rerank (C6+)**: $0.002/query when wired.
- **Anthropic agent calls inside tests**: depends; typically $0.001-0.01 per agent invocation.

**Posture:**
- Print running session total after each commit. Format: `[overnight] session total: $X.XXX (codex $A, /e2e $B, voyage $C, anthropic $D)`.
- If a single task uses 5+ codex rounds, you are in a refactor that needs human input. STOP.
- If /e2e cost trends up >$0.05 (suggests agent fleet got more expensive), investigate before continuing.
- Voyage re-ingest: only re-ingest if `content/position-library/v0/positions/*.md` changed since the last successful ingest. Check `git log -1 --format=%H content/position-library/`.

---

## Inheritance — read at session start, do NOT re-derive

The /overnight skill **inherits** but does **not** replace these existing skills. Their rules apply mechanically:

- [`.claude/skills/edge-cases/SKILL.md`](../edge-cases/SKILL.md)
- [`.claude/skills/code-quality/SKILL.md`](../code-quality/SKILL.md)
- [`.claude/skills/craft/SKILL.md`](../craft/SKILL.md)
- [`.claude/skills/smoke-test/SKILL.md`](../smoke-test/SKILL.md)
- [`.claude/skills/decisions-log/SKILL.md`](../decisions-log/SKILL.md)
- [`.claude/skills/keep-going/SKILL.md`](../keep-going/SKILL.md)
- [`.claude/skills/score/SKILL.md`](../score/SKILL.md)
- [`.claude/skills/align/SKILL.md`](../align/SKILL.md)
- [`.claude/skills/e2e/SKILL.md`](../e2e/SKILL.md)

Read each on the FIRST /overnight invocation in a session. After that, follow them mechanically. Re-read after compaction.

The protocol-gate (`scripts/protocol-gate.ts`) is the server-side enforcer; you are the client-side discipline. Both must run for the chain to hold.

---

## Self-check question — answer in writing before every commit

In overnight mode, the Compliance-Check trailer becomes load-bearing. Before writing any commit message, answer this in your head AND in the trailer:

> *"Did I do every step of the per-task ritual on THIS task? Or did I skip something?"*

If you skipped a step: **STOP, don't commit, run the step**, then re-stage and re-run codex. The user reads the Compliance-Check trailer; if you said "yes" but actually skipped a step, that's a trust violation that ends overnight mode permanently.

Acceptable Compliance-Check phrasing:

> "Ran the full /overnight ritual on this task: /edge-cases 12 enumerated, typecheck 13/13, shared 228/228, /code-quality clean, [no UI files so /craft N/A | /craft PASS], codex N rounds (N findings + clean round N+1), /score X/100, /align ALIGNED, /smoke-test PASS [or N/A — no smoke-applicable file touched], /e2e [PASS at SHA | cadence not yet due, last pass at SHA], STATE.md sync queued. Session spend: $X.XXX cumulative."

Unacceptable Compliance-Check phrasing:
- "yes"
- "ran most of the protocols"
- "skipped craft because the change was small"
- single-sentence answers without naming the specific gates

---

## Reporting

- **Per-task** (after every commit + push): 1 line, e.g., `[overnight] feat(db): C6 PostgresRetriever @ abc1234 · 3 codex rounds · $0.74 · cumulative $1.92`
- **Per /e2e**: `[overnight] /e2e PASS 8/8 @ abc1234 · $0.012 · 14.3s · cumulative $1.93`
- **Per stop**: full session report — total commits, total cost, what shipped, what's blocked, one suggested next step. Format:

```
[overnight] STOP — <reason>

Shipped:
  - feat(db): C6 PostgresRetriever @ abc1234 (3 codex rounds)
  - feat(workers): C7 Discovery prompt @ def5678 (1 codex round)
  - docs(state): sync C6 + C7 @ ghi9012

Cost: $2.41 (codex $1.80, /e2e $0.024, voyage $0.006, anthropic $0.58)
Cycles: 9 commits over 4 hours, 2 /e2e runs (both PASS 8/8)

Blocked:
  - C8 Discovery PDF rendering — needs Resend API key

Next step suggestion:
  Resend API key from user, then C8 (1-2 hours of work)
```

---

## Quick reference card

```
overnight loop:
  while !stop:
    pick task from queue (scored)
    verify `git diff --cached --quiet` (clean index precondition)
    /edge-cases 8-15
    implement
    typecheck (13/13) + tests (228+)
    /code-quality
    /craft (if UI)
    git add <specific files>
    bash scripts/codex-review-staged.sh  ← loop until clean, max 5 rounds
    /score (≥95) + /align (ALIGNED)
    /smoke-test (if applicable)
    /e2e if ≥3 feat|fix commits since last pass  ← BEFORE commit (codex round 7 P1)
    git commit --file=.git/COMMIT_MSG_TMP.txt
    git push
    docs(state) STATE.md sync commit (no Protocol-Skip needed — docs ignore trailer gate)
    /decisions-log (if applicable)
    print per-task report
```

**Quick-ref discipline rule**: this card and the ritual table above MUST match. If they ever disagree, the table wins (it has explicit pass criteria). Codex caught a stale card in round 7 — keep them in sync.

If at any point you think "this once I can skip X", **you cannot**. Either run X or stop.
