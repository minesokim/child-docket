---
name: context-watch
description: Surface a structured `/compact` recommendation when the agent observes a natural wave boundary in long /overnight sessions. Never auto-clears; user always decides. Invoke when a coherent unit of work just shipped AND a meaningfully different track begins next.
---

# /context-watch — wave-boundary recommendation surface

> *When the agent (Claude) observes a natural compact moment, this skill prints a structured recommendation. The user reads and decides.*

**Codified 2026-05-13** after founder reported that aggressive `/clear` between commits had previously caused significantly lower performance + more bugs even with session-handoff docs + CLAUDE.md + claude-mem.

## The fundamental rule

- **`/clear` is OFF the agent's table.** Agent never invokes, never recommends `/clear` between commits. User invokes only when they explicitly decide a session needs full reset.
- **`/compact` is the recommended tool at wave boundaries.** Lossy summarization preserves working memory; `/clear` does not.
- **Agent surfaces recommendations; user executes.** This skill is the surface. The agent calls it when conditions are right.

## When the agent should invoke this skill

Invoke `Skill({ skill: "context-watch" })` when ANY of these conditions are observed:

| Condition | Why it's a safe compact moment |
|---|---|
| **Wave boundary** — a coherent build phase just shipped AND a meaningfully different track begins next | Working memory of the just-completed wave is captured in commits + docs; the next wave has different file paths + different mental model |
| **Codex round 5 CLEAN PASS** on a substantial commit + commit pushed + STATE.md synced | Working memory has stabilized; codex calibration carried through to clean pass; no in-flight reasoning |
| **User signals natural break** ("nice", "great", "let's pause", "what's next", "okay") AFTER a successful ship | User is asking for direction, not mid-task; safe to consolidate |
| **Context % above 70%** (per statusline or `/usage`) AND just completed a commit | Auto-compact will fire at 70% anyway; user's explicit invocation is more controlled |
| **Three-strikes recovery point** — after a failed task that took 3+ retries to land | Working memory is full of dead-end paths; compact removes the noise while keeping the lesson |

## When the agent should NOT invoke this skill

Do not invoke during:
- Mid-codex-loop (between rounds of the same commit)
- Mid-/edge-cases enumeration or planning phase
- Mid-implementation (writing code, running tests)
- Immediately after an integrity failure (like C27→C27a) — finish the recovery first
- During an investigation / debugging session
- When the user is mid-question or mid-decision

## What the skill prints

When invoked, emit this exact format (fill in the bracketed values):

```
[context-watch] Recommendation surface: this is a safe `/compact` moment.

Just completed: [last commit sha + 1-line summary]
Next track: [what would be picked up next per AGENT-PLATFORM.md or queue]
Context % estimate: [if visible from /usage or statusline; otherwise "unknown"]

If you `/compact`:
  - Working memory of [prior wave / track] gets summarized to ~500-1000 tokens
  - Codex calibration + codebase shape preserved (lossy summarization)
  - Budget recovered: estimated 30-50% of current context
  - Performance: minor drop (single-digit %) vs the long session

If you stay in this session:
  - Full working memory preserved (best performance)
  - Budget cost: continue at current rate
  - When auto-compact fires at 70%, less control over what gets summarized

Suggested `/compact` instruction (paste into the /compact command):
  "Preserve: [list of files / decisions / patterns that should survive].
   Focus summary on: [what to optimize the summary around — e.g., 'the
   substrate decisions and codex-flagged gotchas from C28-C29']."

Your call. Reply `compact` to take the recommendation, anything else to keep going.
```

## How `/compact` differs from `/clear`

| Action | What survives | What loses | When to use |
|---|---|---|---|
| `/compact` (auto-summarized) | Codebase mental map ~80%; codex calibration ~70%; explicit decisions 100% (via summary); voice/idiom ~60% | Verbatim tool outputs; codex round transcripts; intermediate iteration noise | Wave boundaries; mid-session budget recovery while continuing work |
| `/clear` (full reset) | Only what's in disk docs (handoff + CLAUDE.md + claude-mem observations) | Working memory completely; codex calibration completely; consistency drift likely | ONLY when user explicitly decides a session needs full reset (rare; reserve for end-of-day or major track changes) |

## Heuristic table — strength of recommendation

| Boundary type | Recommendation strength | Default action |
|---|---|---|
| Wave 1→2 boundary (substrate done, integrations begin) | STRONG | Surface recommendation |
| Within-wave commit boundary | NONE | Stay in session |
| After multi-codex-round commit | WEAK | Surface only if context % > 60% |
| User signals natural break | MEDIUM | Surface recommendation |
| Context % > 80% | STRONG | Surface immediately |
| Mid-investigation | NONE | Don't surface |

## Anti-patterns to avoid

- **Don't surface every commit.** That's noise; the user starts ignoring the recommendation.
- **Don't surface mid-loop.** Codex r3 → r4 is not a compact moment.
- **Don't recommend `/clear`.** Ever. Per founder priority 2026-05-13.
- **Don't auto-execute anything.** The agent surfaces; the user decides.
- **Don't surface when budget isn't actually pressing.** If context % is low and user is in flow, stay quiet.

## Reference

- `docs/TOKEN-EFFICIENCY.md` — the canonical rules + measurements
- `.claude/skills/overnight/SKILL.md` — Step 19 calls this skill at wave boundaries
- `docs/OVERNIGHT-HANDOFF-2026-05-13.md` — the failure mode that motivated this skill
