# Autonomous Mode Protocol

> *Read this FIRST on every session start. After context refreshes too.*
> *The skills below are not decorative — they are the discipline that prevents AI-sloppenheimer.*

This doc is the bootloader for any AI agent (myself in a fresh context, or any future model) operating in autonomous mode on this repo. The user explicitly asked: "whenever there's context refreshes because window fills up, make sure the skills work every time. every time. every time."

This file is the answer.

---

## 1. Identify mode

**Autonomous mode is active when:**
- The user has typed something like "keep going," "run overnight," "autonomous," "keep going forever," "until you can't"
- OR the most recent commit on `main` was `Co-Authored-By: Claude Opus 4.7 (1M context)` (i.e., I was working autonomously and the session refreshed mid-flight)

**If autonomous mode is active**, this protocol governs every commit. No exceptions, no shortcuts, no "this one is small enough to skip."

---

## 2. Session-start ritual (after any context refresh)

Run these in order. Total time: ~2 minutes. Do this before touching any code.

### Step A — read the canonical docs

| Doc | Why |
|---|---|
| [`CLAUDE.md`](../CLAUDE.md) | Project context, conventions, the explicit NOs |
| [`docs/PRODUCT-ROADMAP.md`](PRODUCT-ROADMAP.md) | Master reference: every feature, every phase, every defer |
| [`docs/PRODUCTION-READINESS.md`](PRODUCTION-READINESS.md) | The punch list with priority tiers |
| [`docs/AUTONOMOUS-QUEUE.md`](AUTONOMOUS-QUEUE.md) | Current state of autonomous work — what shipped, what's next |
| [`docs/AUTONOMOUS-DECISIONS.md`](AUTONOMOUS-DECISIONS.md) | Judgment calls already made + their reversal paths |
| [`docs/POSITION-FRAMEWORK.md`](POSITION-FRAMEWORK.md) | Compliance moat — re-read before any agent that emits a tax position |
| [`docs/MEMORY-ARCHITECTURE.md`](MEMORY-ARCHITECTURE.md) | Memory model + cost-optimized prompt caching |

### Step B — read the skills that govern every commit

Four skills form the autonomous build cycle. **Each one is mandatory at its moment in the cycle.**

| Skill | When | What it forces |
|---|---|---|
| [`/edge-cases`](../.claude/skills/edge-cases/SKILL.md) | BEFORE implementation | List 8-15 edge cases (input / state / failure-mode / time / permission / domain). Decide handle / document / out-of-scope per case. Tax-domain checklist. |
| [`/code-quality`](../.claude/skills/code-quality/SKILL.md) | BEFORE commit + AFTER push | Pre-commit gate: typecheck, tests, no `any`, no console.log, no AI vocabulary, lockfile-package.json sync, atomicity, comment quality, codex review for substantial changes. Step 7: verify deploy READY before next item. |
| [`/smoke-test`](../.claude/skills/smoke-test/SKILL.md) | AFTER implementation | E2E verification per the canonical template (`services/workers/scripts/smoke-finalize.ts`). Required after Inngest worker / doc-processing / storage / encryption / new-/api/ changes. |
| [`/decisions-log`](../.claude/skills/decisions-log/SKILL.md) | ALONGSIDE every commit + AT SESSION END | Track judgment calls in `docs/AUTONOMOUS-DECISIONS.md`. Surface summary at session end OR every 10 commits OR on user request. |

### Step C — pick the next item

Open [`docs/AUTONOMOUS-QUEUE.md`](AUTONOMOUS-QUEUE.md). Find the next item with status `queued` or `in-progress`. That's what to work on. Do NOT pick by what feels easy or interesting — pick the next item in queue order.

**HARD RULE (added 2026-05-09 after a "what's next" failure):** Before answering ANY question shaped like "what's next," "what should I work on," or "what's the next step" — whether the user asked it or you're picking autonomously — do this state check FIRST, in this order:

1. `git log --oneline -50` — what shipped recently?
2. Read [`docs/AUTONOMOUS-QUEUE.md`](AUTONOMOUS-QUEUE.md) (canonical: what's queued + what's in-progress).
3. Read the latest [`docs/OVERNIGHT-HANDOFF-*.md`](.) (canonical: what's done + what's open from the last autonomous run).
4. Grep the codebase for the proposed feature ("does this already exist?") before recommending it.
5. ONLY THEN consult `CLAUDE.md` §15 — and treat it as the WHY (strategy, anchors, NOs), not the WHAT (current state). The build-order section in CLAUDE.md is a 5/2 snapshot and explicitly tagged stale; trust the queue + handoff.

The failure mode being blocked: anchoring on `CLAUDE.md` §15 phased-plan items as if they were ground truth, then proposing work that already shipped a week ago. The protocol is here; my discipline is the gap to close.

### Step D — declare intent

Before writing any code, write down (in scratch, not committed):

- What is this change for? (One sentence.)
- Which gap from PRODUCTION-READINESS or PRODUCT-ROADMAP does it close?
- What is the smallest viable scope?

If you can't answer all three sharply, the change isn't ready. Read more.

---

## 3. The build cycle (per item)

```
                    pick next item from AUTONOMOUS-QUEUE.md
                              │
                              ▼
              ┌── /edge-cases (8-15 cases enumerated, status decided)
              │
              ▼
                    plan files + functions
                              │
                              ▼
                          implement
                              │
                              ▼
                       pnpm typecheck
                              │ (fail → fix and re-loop)
                              ▼
                         pnpm test
                              │ (fail → fix and re-loop)
                              ▼
              ┌── /code-quality Steps 1-6 (self-review)
              │
              ▼
              ┌── codex review (if substantial: >100 LOC, new arch surface,
              │                  encryption/auth/RLS/audit, prompt construction,
              │                  trust gates)
              │
              ▼
                       fix codex findings
                              │
                              ▼
                            git add ⟶ commit (with /decisions-log entry if applicable)
                              │
                              ▼
                            git push
                              │
                              ▼
              ┌── /code-quality Step 7 — verify deploy READY (poll Vercel)
              │   distinguish target='production' from PR-preview
              │   if ERROR: pull build logs, fix-up commit, NEVER continue
              │
              ▼
              ┌── /smoke-test (if applicable)
              │
              ▼
                  update AUTONOMOUS-QUEUE.md status
                              │
                              ▼
                       pick next item ⟲
```

**Three-strikes-stop rule**: if three items in a row fail to ship clean (deploy errors, smoke failures, codex findings can't be resolved), STOP. Write a status report. Wait for human input.

**Stop conditions** (any one of these → halt):
- Production smoke test failure (existing or new)
- Production 500s spike (per Vercel logs)
- Codex review surfaces SECURITY-severity finding
- Commit touches >10 files (flag for user review before push)
- AUTONOMOUS-DECISIONS.md has 3+ entries with severity=architectural still in `pending`
- Context budget critically low (<10% remaining)
- User explicitly pauses ("stop", "pause", "hold on", etc.)

**Keep-going rule** (the [`/keep-going`](../.claude/skills/keep-going/SKILL.md) skill): if NONE of the stop conditions above fire after a clean commit, **pick the next item and start the next /edge-cases iteration immediately**. Do NOT pause to surface a "which direction?" decision to the user. The user explicitly named this anti-pattern on 5/8/2026: "i wanted it to keep going here. until the feature list is complete." The selection order is queued items in `AUTONOMOUS-QUEUE.md`, then commit-message followups, then `PRODUCTION-READINESS.md` V1 items, then V1.5, then V2.

**Score-loop rule** (the [`/score`](../.claude/skills/score/SKILL.md) skill): every feature gets a 12-dimension production-readiness score (0-100) AFTER it ships deploy-READY. If score < 95, the loop runs again on the SAME item, closing the lowest-scoring gap, recommitting, re-scoring. /keep-going only advances to the next item AFTER /score >= 95 on the current one. User-codified 5/8/2026: "it needs to be 95+. if it doesn't reach those metrics, do it until it does. every single nook and cranny of every feature and the product as a whole." Floor: honest work scores >= 60. Ceiling: substrate-without-consumer caps at 75 (must have at least one real call site to break above 75).

---

## 4. Anti-patterns this protocol blocks

These are the specific shapes of drift. NEVER do any of them.

### Skipping verification "because the code looks right"
Symptom: pushing a commit, immediately starting next item, finding deploy broke 30 minutes later when user asks.
Fix: Step 7 of /code-quality. Always run.

### Building without listing edge cases
Symptom: ship feature, user finds an edge case in production, write a fixup commit.
Fix: /edge-cases skill. Run BEFORE implementation, not after.

### Lockfile drift
Symptom: add a workspace package, push, Vercel install fails with `ERR_PNPM_OUTDATED_LOCKFILE`.
Fix: /code-quality Step 2b. Hard rule.

### Test fakery
Symptom: tests use the same formula as the implementation; both can be wrong together.
Fix: golden vectors from external sources where possible. Tests assert PROPERTY, not function-name-equals-test-name.

### Sloppy comments
Symptom: comments that paraphrase the next 5 lines instead of explaining WHY.
Fix: /code-quality "comment quality" check.

### `any` slipping in
Symptom: `function processData(data: any): any` with no justification.
Fix: /code-quality structural check + every `any` documented at declaration.

### AI vocabulary
Symptom: "delve / crucial / robust / comprehensive / nuanced / multifaceted / pivotal / landscape" leaking into comments + commit messages.
Fix: /code-quality forbidden-word list. Rewrite if used.

### Decision drift without logging
Symptom: making feature/UX/scope choices autonomously, user finds them weeks later, friction.
Fix: /decisions-log. Track in real-time. Surface at session end.

---

## 5. Communication protocol

### What to write to the user mid-session
- Verification results: "All four checks pass" (with details)
- Blocked items: "I can't proceed on X because Y. Parking it."
- Decisions that need their attention: "I made N decisions you might want to review — see AUTONOMOUS-DECISIONS.md"
- Three-strikes-stop triggered: full status report + ask for direction

### What NOT to write
- Filler ("I'll now work on...")
- Apology for your own discipline
- Asking permission for items already in queue (you have approval)

### Commit message format

```
<type>(<scope>): <imperative description under 70 chars>

<one paragraph explaining WHY this exists — what gap from PRODUCTION-READINESS or PRODUCT-ROADMAP does it close>

<the load-bearing technical decisions — what tradeoff, what alternative, what edge cases handled>

<verification — tests passing, smoke results, links to commits>

<followups — explicit links to PRODUCTION-READINESS items or new TODOs with §refs>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

Subject types: `feat / fix / chore / docs / refactor / test / build`. Scope: package or area.

### Voice constraints (from CLAUDE.md house style)
- No emoji in code or commits
- No AI vocabulary (forbidden list above)
- No em dashes in code comments (only in markdown prose)
- Lead with the point. Concrete file paths + line numbers, not abstract description.
- Tie technical choices to user outcomes
- Builder-to-builder voice, not consultant-to-client

---

## 6. After context refresh — recovery sequence

If the session window fills up and a fresh-context-me starts:

1. **Read this file FIRST.** This is non-negotiable. The protocol is here.
2. **Read AUTONOMOUS-QUEUE.md** to find the in-progress item.
3. **Read AUTONOMOUS-DECISIONS.md** to understand recent judgment calls (especially `pending` status entries).
4. **Read recent commit history** — `git log --oneline -20` to see what shipped recently.
5. **Resume at the next queued item** with the build cycle from §3.

Do NOT:
- Re-do work that's already shipped
- Make assumptions about prior state — read the queue + decisions log
- Skip the four-skill cycle "because we're catching up"
- Push without verifying the deploy lands READY

The skills are the same skills. They work the same way. Every time. Every time. Every time.

---

## 7. End-of-session ritual

Before saying "done for the night":

1. Update `AUTONOMOUS-QUEUE.md` with final state of every item touched
2. Surface `AUTONOMOUS-DECISIONS.md` summary if there are pending-review entries
3. Check the last 10 commits hit the canonical commit-message format
4. Verify the latest production deploy is READY for both apps
5. If anything is BUILDING / ERROR / blocked: write a one-paragraph status report

The user wakes up to:
- A clean queue with clear next item
- A list of decisions made + how to reverse if they disagree
- Production in a known-healthy state

---

## 8. The principle this protocol encodes

**Speed comes from REUSE and PARALLELISM. Quality is non-negotiable.**

If a change can't pass the gates without substantial additional work, PARK it. Don't ship half-done to keep the queue moving. Future-you and future-user will not catch what present-you missed.

The four skills + this protocol are the structural defense against the autopilot drift that surfaces 5 hours into any session: lazy comments, `any` slipping in, error swallow, copy-paste, "TODO followup" without issue links, AI vocabulary, commit messages that don't earn their bytes, deploy verifications skipped.

The webhook-verification → codex-fixup cycle (`b31e91f` → `00cd377`) is what RIGHT looks like. The Sentry endpoints I shipped without verifying (`a122ae5` → `95e2629` → `40c5caa`) is what WRONG looks like. The protocol enforces the former and prevents the latter.

---

*Last updated: 2026-05-08. Re-read this file at every context refresh. The skills work every time.*
