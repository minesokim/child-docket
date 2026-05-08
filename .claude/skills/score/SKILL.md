# /score — production-readiness scoring loop

> *Run AFTER every feature ships. Score 0-100 against unbiased criteria. If < 95, iterate until it passes. Only then move to the next item.*

---

## Why this skill exists

User-codified 5/8/2026:

> "is there anything that determines whether it holds up to the prd? you have to do unbiased metrics. whether it holds up to production level or you just slopped on me. do a score out of 100"

> "it needs to be 95+. if it doesn't reach those metrics, do it until it does. every single nook and cranny of every feature and the product as a whole."

> "it should be a loop. each feature check/end to end coding should do a score assessment."

The codex review cycle catches code-level issues. This skill catches the next layer — "the code is fine but the FEATURE isn't load-bearing yet." Common failure modes the loop catches:

- Substrate without consumers (helper exists, nothing calls it)
- Migrations that compile but were never applied
- Eval harnesses written but never run
- Server-side gates that exist but aren't wired into write paths
- Tests that prove unit behavior but not integration

---

## When this fires

After each feature commit lands deploy-READY. Before /keep-going picks the next item.

```
finish item N (deploy READY)
  │
  ▼
/score on item N
  │
  ▼
score >= 95?
  │
  ├── YES → /keep-going picks item N+1
  │
  └── NO  → close gaps on item N, recommit, /score again
```

The loop on the SAME item runs until score >= 95. Only then does /keep-going advance.

---

## The 12 dimensions

Each scored 0-100. Total is weighted average. Weights reflect what makes a feature production-ready vs theoretical.

| # | Dimension | Weight | What 100 looks like |
|---|---|---|---|
| 1 | Compiles + deploys | 5% | Workspace typecheck clean. Production deploy READY for both apps. |
| 2 | Codex findings addressed | 8% | Every codex finding fixed before commit. None papered over. |
| 3 | Tests prove integration | 15% | Not just unit tests in isolation. End-to-end test proves the path works. For DB work: integration test against real Postgres. For agent work: fixture run with real model. |
| 4 | Substrate is consumed | 15% | Helper actually called from the path it was meant to defend. Not "exists in @docket/shared but no app code imports it." |
| 5 | Migrations applied | 10% | SQL files RUN against dev DB. Schema exists. Triggers fire. Indexes built. |
| 6 | Server-side gates wired | 10% | Security checks in the load-bearing place (server actions), not just the UI. |
| 7 | Edge cases handled (not just enumerated) | 8% | "Documented" gaps that make it to prod don't count. Every enumerated case has either code-level handling or an explicit out-of-scope justification with revisit-condition. |
| 8 | Comments earn their bytes | 5% | Headers explain WHY. No paraphrase comments. No AI vocab. |
| 9 | Decisions logged with reversal paths | 5% | Architectural-severity choices captured in AUTONOMOUS-DECISIONS.md with reversal steps. |
| 10 | Telemetry / observability wired | 8% | Cost telemetry tagged correctly. Errors flow to Sentry. Inngest runs visible. |
| 11 | Failure modes documented | 6% | What happens when the dependency goes down? When the input is malicious? Known + addressed. |
| 12 | Real consumer exercises the feature | 5% | Manual smoke run OR integration test OR existing prod traffic. Not "should work in theory." |

---

## How to score

For each dimension, write:

```
Dim N (Name): SCORE/100
  - Specific evidence FOR the score (file paths, test results, commit hashes)
  - Specific evidence AGAINST a higher score
  - What would push it to 100
```

Then weighted total:

```
Total: SUM(score_i × weight_i) / 100
```

Round honestly. Bias toward LOW. The user explicitly said "unbiased" — score what's actually wired and tested, not what's intended.

---

## Honest-floor and honest-ceiling

The score has a floor and ceiling that bound the rounding:

**Floor**: if NONE of the failure modes from the protocol's anti-pattern list apply (no faked tests, no `any`, no AI vocab, no skipped verification, no copy-paste, no codex findings papered over), score >= 60. The work is HONEST even if not COMPLETE.

**Ceiling**: anything that's "substrate without consumer" caps at 75. To break above 75, the feature must have at least ONE real call site exercising it.

These are guardrails, not formal arithmetic. They exist to prevent both inflation ("looks good in PR review") and excessive self-flagellation ("I should have done more").

---

## What 95+ requires

Concretely, for almost any feature shipped tonight:

1. Migration applied to dev DB. Schema visible via `\d table_name` or equivalent drizzle introspection.
2. At least one integration test that exercises the full path against real infrastructure.
3. At least one production code path that calls the helper / function / API.
4. Cost telemetry / Sentry / Inngest dashboard view confirms the feature fires.
5. Decisions log entry IF an architectural choice was made.

If any of those is missing, score < 95. Fix the gap, then re-score.

---

## The iteration loop

```
score < 95
  │
  ▼
identify the lowest-scoring dimension
  │
  ▼
write the smallest change that closes that gap
  │
  ▼
implement + commit + verify
  │
  ▼
re-score
  │
  └── still < 95? → repeat ⟲
```

NO MAXIMUM. The user said "every single nook and cranny of every feature." If a feature genuinely cannot reach 95 (e.g., migrations can't apply because the dev DB is unreachable), document the blocker as a stop condition + flag for the user, but don't claim a score that isn't real.

---

## Anti-patterns this skill blocks

### "It compiles, ship it"
Compiles = 5% of the score. Real production-readiness is the other 95%.

### "Tests pass" without integration
Unit tests are necessary but not sufficient. The integration test is what proves the wiring.

### "Will wire later" deferrals
"Substrate without consumer" caps at 75. The wiring IS the feature for scoring purposes.

### Self-grading inflation
Bias toward low. If you're between 92 and 95, score 92. The cost of being honest is one more iteration; the cost of inflating is undetected production gaps.

### "Score 95 because I said so"
Each dimension has a 0-100 sub-score with concrete evidence. Total is arithmetic, not vibes.

---

## What this skill does NOT do

- Replace codex review (codex is code-level; /score is feature-level)
- Replace /code-quality (pre-commit) or /smoke-test (post-implementation)
- Auto-fix gaps — surfaces them so the loop can attack them
- Trust the model's "I'm done" signal — the score is the gate

---

## Output format

```
/score on [feature name / commit SHA]

Dim 1 (Compiles + deploys): X/100
  + evidence for
  - evidence against
  → would need [specific] to hit 100

(...12 dimensions...)

Weighted total: X/100

Lowest-scoring dimensions: [list]
Next iteration target: [specific change]
```

If total >= 95: log + advance to next item via /keep-going.
If total < 95: implement the next iteration's change, recommit, re-score.

---

*Last updated: 2026-05-08. The iteration is the protection. Single-pass scoring is biased; loop scoring is honest.*
