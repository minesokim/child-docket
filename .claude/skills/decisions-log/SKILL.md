---
name: decisions-log
version: 1.0.0
description: |
  Surfaces the autonomous decisions the AI made on its own that the user
  might want to review. Maintains a running log during the session and
  produces a "decisions made — please review" summary at session end (or
  every N commits).

  The user explicitly requested this: "for the decisions that you think
  are really important, lets say feature or ux decision, notify me of
  all the changes you made at the end."

  Triggered: continuously as decisions get made, with explicit summary
  surfacing at session-end or on user request ("show me your decisions").
voice-triggers:
  - what did you decide
  - decisions you made
  - show me your judgment calls
allowed-tools:
  - Read
  - Edit
  - Write
  - Glob
  - Grep
---

# decisions-log

> Autonomy is not infallibility. The AI makes judgment calls every commit.
> The user might disagree with any of them. This skill surfaces the calls
> at the end so disagreements are explicit, not silent.

## When to invoke

**Continuously, in the background**: every commit during autonomous
mode, the model checks "did I just make a decision the user might
disagree with?" If yes, append to `docs/AUTONOMOUS-DECISIONS.md`.

**At session end OR every 10 commits**: surface a summary in chat:
"Here are the N decisions I made tonight that you might want to
review. Number them, name the trade-off, name the alternative."

**On user request**: when the user asks "what did you decide" / "show
me your judgment calls" / "anything you decided I should know about,"
emit the current state of `docs/AUTONOMOUS-DECISIONS.md` as a summary.

## What counts as a "decision worth surfacing"

**Yes, surface**:
- Naming choices for public-facing surfaces (URLs, env vars, agent
  names, feature flags)
- UX shape decisions (button placement, error message wording, modal
  vs inline, default values for user-facing fields)
- Feature scope cuts ("I deferred X to V1.5 because it conflicted
  with Y")
- Architecture trade-offs picked between two reasonable options
  ("subpath export vs main barrel export," "single Sentry project vs
  per-app projects," "test fixtures plaintext vs encrypted")
- Pricing or billing-related defaults
- Security trade-offs ("dropped iframe sandbox because Chrome PDF
  viewer broke under it")
- Defaults that flip behavior on/off ("DOCKET_ENABLE_OCR=0 by default")
- Decisions that contradict CLAUDE.md or other docs and need them
  updated
- Any change to the canonical reference docs (POSITION-FRAMEWORK,
  MEMORY-ARCHITECTURE, PRODUCTION-READINESS, PRODUCT-ROADMAP)
- Decisions that defer a known concern to a followup

**No, don't surface**:
- Pure code refactors with no behavior change
- Bug fixes where the right fix is obvious
- Test additions
- Comment-only edits
- Style / typography changes
- Lockfile updates (mechanical, not judgment)
- Reordering of existing items in the autonomous queue

## The log format

`docs/AUTONOMOUS-DECISIONS.md` is the running ledger. Each entry has
this exact shape:

```markdown
## [N] [DATE] [SHORT TITLE]

**Decision**: <one sentence stating what was decided>

**Reasoning**: <2-3 sentences. Why this choice over the alternative?
What constraint forced it? What evidence supports it?>

**Alternative considered**: <what was the other option and why was it
rejected>

**How to reverse**: <if the user disagrees, what would they change?
Specific files, env vars, or commits to revert.>

**Severity**: low | medium | high | architectural

**Commit**: <commit hash if shipped>

**User-review status**: pending | reviewed-approved | reviewed-reversed
```

`docs/AUTONOMOUS-DECISIONS.md` is checked into git. The user can read
it any time. They can mark entries as reviewed-approved or
reviewed-reversed in follow-up commits.

## Workflow

### Step 1 — when making a commit, ask "is this a decision worth surfacing?"

Run through the "Yes, surface" list above. If the commit hits any of
those categories, add an entry to `docs/AUTONOMOUS-DECISIONS.md`
in the same commit.

### Step 2 — write the entry

Use the format above. Be concrete:
- "Decision" is one sentence and names the actual choice
- "Reasoning" is 2-3 sentences and references the constraint
- "Alternative considered" is the rejected option with one-sentence
  reasoning for why
- "How to reverse" is specific (file paths, env var names, etc.)

Bad entry (vague):

> Decision: Used a different approach for caching.
> Reasoning: It seemed better.

Good entry (specific):

> **Decision**: Cache markers placed at firm_profile boundary, not at
> system_prompt boundary, in `runDocketAgent` prompt assembly.
>
> **Reasoning**: Anthropic prompt cache requires 1024+ tokens before
> the marker. system_prompt alone is ~200 tokens. Placing marker after
> firm_profile (~80K tokens) puts the cache boundary where it actually
> activates. See MEMORY-ARCHITECTURE §4 for the math.
>
> **Alternative considered**: Marker at end of system_prompt — would
> have failed to cache at all because of the 1024-token minimum.
>
> **How to reverse**: Edit `services/orchestrator/src/runDocketAgent.ts`,
> move the `cache_control: { type: "ephemeral" }` annotation up to
> the system_prompt section. Will silently disable caching; cost
> will spike ~5x within 5 min.
>
> **Severity**: architectural
>
> **Commit**: <hash>
>
> **User-review status**: pending

### Step 3 — periodic surfacing

At session end OR every 10 commits OR on explicit user request, read
the most recent N entries with `user-review status: pending` and
surface them in chat as a numbered summary.

The summary message format:

```
## Decisions made this session — please review

I shipped N commits tonight. M of them included decisions you might
want to revisit. Listed below by severity.

### Architectural (highest impact, hardest to reverse)
- [1] <one-line title> — `<commit>`
  Decision: <one sentence>
  How to reverse: <specific>

### High (significant trade-offs)
- [2] <one-line title> — `<commit>`
  ...

### Medium / Low
- [3] ...

If any are wrong, tell me and I'll reverse them in a follow-up commit.
Items get marked reviewed-approved (default after no objection) or
reviewed-reversed in their AUTONOMOUS-DECISIONS.md entries.
```

### Step 4 — track outcomes

When the user reviews a decision and approves or asks to reverse:
- Update the entry's `user-review status` to `reviewed-approved` or
  `reviewed-reversed`
- If reversed, link to the reversing commit
- This creates an audit trail of "what did the AI decide that was
  wrong" — a feedback signal for the AI Founder pattern (per Diana's
  YC framing, the founder can't outsource AI strategy; reviewing these
  is how you keep the strategy yours).

## Anti-patterns

### Anti-pattern: silent feature creep

Every time you ship something the user didn't explicitly ask for and
DIDN'T log as a decision, you've cheated this skill. The bar is
"would the user notice this in a code review and ask 'why?'" — if yes,
log it.

### Anti-pattern: vague reasoning

"It seemed cleaner" / "matched my intuition" / "this is best practice"
are all signals you didn't actually have a reason. Decisions need
specific constraints — file paths, doc references, prior commits,
benchmarks. If you can't write specifics, the decision wasn't
considered carefully.

### Anti-pattern: 50-entry log

If you're logging more than ~5 decisions per 10 commits, you're being
too liberal with what counts. Re-read the "No, don't surface" list.
Bug fixes, refactors, and test additions don't go here — only
decisions where the user might say "wait, why did you do it that way?"

### Anti-pattern: decisions in past tense without commits

Every entry needs a commit hash (or `<not-yet-committed>` if the
decision is pre-commit and gets the hash at ship time). A decision
without a commit is a thought, not a change.

## What's already in the session that should have been logged

Calibration list — decisions made earlier in this session that I
should retroactively add to AUTONOMOUS-DECISIONS.md:

| # | Title | Severity | Commit |
|---|---|---|---|
| 1 | Webhook verification → subpath export `/webhooks` instead of main barrel | architectural | `00cd377` |
| 2 | Test fixtures store intake answers PLAINTEXT (not encrypted) | medium | `605ba26` |
| 3 | Sentry: single project both apps with `app:` tag, not per-app projects | medium | `a122ae5` |
| 4 | Bedrock model IDs use `us.anthropic.claude-*` cross-region inference profile | medium | (pending wiring) |
| 5 | Neon read replica created in same cell (us-east-1 c-6); regional resilience deferred to V1.5 | medium | (config only) |
| 6 | OCR (Tesseract) bypassed by default; opt-in via `DOCKET_ENABLE_OCR=1` | high | `b81808b` |
| 7 | iframe sandbox dropped from PDF preview because Chrome viewer broke | medium | `ea32333` |
| 8 | R2 storage key includes `documentId/` to prevent collision when same filename | medium | `1576ef0` |

These should be backfilled into AUTONOMOUS-DECISIONS.md as part of
implementing this skill — see Step 1 of "How to start using this
skill below."

## How to start using this skill (one-time setup)

1. Create `docs/AUTONOMOUS-DECISIONS.md` with the header from this
   skill.
2. Backfill the calibration list above with full entries.
3. Going forward, update the file in every commit that hits a "Yes,
   surface" category.
4. Surface summary at the user's session-end check-in OR every 10
   commits OR on request.

## How this pairs with other skills

- `/edge-cases` — runs BEFORE implementation (think about failure modes)
- `/code-quality` — runs BEFORE commit (post-implementation gate)
- `/smoke-test` — runs AFTER implementation (E2E verification)
- `/decisions-log` — runs ALONGSIDE every commit (track judgment calls)
  + AT SESSION END (surface summary)

The full autonomous build cycle:

```
plan → /edge-cases → implement → typecheck → test
  → /code-quality (lockfile, anti-patterns, codex if substantial)
  → commit (with /decisions-log entry if applicable)
  → push → verify deploy READY → /smoke-test if applicable
  → next item
```

At session end or every 10 commits:

```
→ /decisions-log surfaces the pending-review entries
→ user reviews, approves or asks to reverse
→ continue or fix
```
