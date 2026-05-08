# /keep-going — kill the natural-pause-handoff anti-pattern

> *Run autonomously through the queue + PRODUCTION-READINESS until a real stop condition fires.*
> *Do NOT pause to ask the user "which direction" after a clean batch.*

---

## When this fires

This skill is implicit during autonomous mode. It governs the
"between items" decision after a clean commit + deploy + verify cycle.

The user explicitly called out the anti-pattern (5/8/2026):

> "i wanted it to keep going here. until the feature list is complete. im going to sleep."

I had hit a natural pause point — 6 items shipped clean, status
summary surfaced, asked the user "which direction next." That was
the bug. The user wanted me to keep shipping until the feature list
was empty or context ran out. The pause+handoff pattern broke their
overnight run.

This skill encodes: **keep going automatically.** Stop only when
something real says stop.

---

## The rule

After any item finishes the four-skill cycle clean (deploy READY +
queue updated + decisions logged), pick the next item and start the
next /edge-cases iteration **without surfacing a "you can stop or
keep going" decision to the user.**

The selection order:

1. `docs/AUTONOMOUS-QUEUE.md` — anything still `queued` or `in-progress`
2. Followups inventoried in recent commit messages (search
   `git log -50 --grep="FOLLOWUPS"` for items)
3. `docs/PRODUCTION-READINESS.md` — pick the next V1-tagged item, smallest first
4. After V1 is empty: V1.5 items, then V2, then "anything in NOs that's
   been re-opened"

---

## The only stop conditions (per AUTONOMOUS-PROTOCOL §3)

These are the ONLY reasons to pause the loop. Each comes with a
concrete trigger; if none of these fire, keep going.

| Stop trigger | What it looks like | What to do |
|---|---|---|
| **Three-strikes-stop** | 3 items in a row failed the four-skill cycle (deploy ERROR, codex unresolvable, smoke failure) | Write a status report. Wait for human input. |
| **Production smoke failure** | Existing or new smoke test fails against prod | Stop. Investigate root cause. |
| **Production 500s spike** | Vercel runtime logs show >5 errors/min that didn't exist 10 min ago | Stop. Triage. |
| **Security-severity codex finding** | Codex reports a SECURITY finding that can't be fixed in <30 min | Stop. Surface to user. |
| **Commit touches >10 files** | `git diff --stat HEAD` shows 10+ files | Stop before push. Surface for review. |
| **3+ pending architectural decisions** | `AUTONOMOUS-DECISIONS.md` has 3+ entries with severity=architectural still pending review | Stop until user clears at least one. |
| **Context budget critically low** | Active estimation says < 10% remaining | Final-status commit + handoff. |
| **User explicitly says pause** | User message contains "stop", "pause", "wait", "hold on", "let me think" | Pause immediately. |

If NONE of these fire after a clean commit, **keep going.** No "what do
you want next" question. No "shipped 6 items, ready to pause" status.
Just pick the next item and start the cycle.

---

## What "keep going" looks like in practice

```
finish item N (deploy READY)
  │
  ▼
update AUTONOMOUS-QUEUE.md item N row
  │
  ▼
check stop conditions ← NEW step. If any fire, pause.
  │
  ▼ (none fire)
select item N+1 from the priority list above
  │
  ▼
/edge-cases enumerate
  │
  ▼
implement
  │
  ▼ (... full four-skill cycle ...)
  │
  ▼
deploy READY
  │
  ▼
update AUTONOMOUS-QUEUE.md item N+1 row
  │
  ▼
check stop conditions ← repeat
  │
  ▼ (none fire)
item N+2 ⟲
```

The loop does not exit unless a stop condition fires. The user's
"keep going forever until you can't" is the contract.

---

## Anti-patterns this skill blocks

### "Natural pause" handoff
Symptom: ship 6 items, surface comprehensive status report ending in
"which direction next?" The user reads the summary, says "keep going."
Wasted the natural-pause overhead for nothing — should have just kept
going.
Fix: this skill. The pause is the bug.

### "End of session ritual" run mid-session
Symptom: do the §7 end-of-session ritual after a big batch as if the
session were ending, when actually only ~half the budget is spent.
Fix: end-of-session ritual fires when a stop condition fires, not on
a sense of "feels like a good place to pause."

### "Surface decisions for review" mid-stream
Symptom: pause to ask "should we keep doing X or pivot to Y?" when
both X and Y are in the queue and just need to be sequenced.
Fix: pick the smaller-effort one, ship it, move to the other. No
question to user.

### "Too many tools used, time to summarize"
Symptom: arbitrary "I've done a lot, let me consolidate" pauses
based on tool-call count rather than queue progress.
Fix: tool count is irrelevant. Queue progress is the only metric.

---

## What this skill does NOT change

- Codex review still fires for >100 LOC / new arch / encryption / auth.
  Findings still get fixed before commit.
- Step 7 deploy verification still required between commits.
- Decisions log still surfaces architectural-severity entries.
- The four-skill cycle (edge-cases / code-quality / smoke-test /
  decisions-log) still runs every commit.
- If the user sends a message asking a question or pivoting, respond.
  This skill doesn't ignore the user; it just doesn't INVENT pauses.

---

## Reading this file

If the loop is governing a session that's already in progress: nothing
new — keep going. This file just codifies what was always meant.

If a fresh-context-me starts mid-loop: this is the rule. The user
wants the queue empty. Don't ask "which direction." Pick + ship.

The only edits this file should ever receive are:
- New stop conditions (when failure modes are discovered that should
  halt the loop)
- Sharper wording on the "between items" decision

---

*Last updated: 2026-05-08. The user said "keep going forever until you
can't until there's nothing left." This skill is the structural answer
to "until you can't."*
