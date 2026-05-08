---
name: code-quality
version: 1.0.0
description: |
  Pre-commit quality gate that blocks AI-sloppenheimer code from shipping.
  Runs implicitly before EVERY commit during autonomous overnight work. Forces
  explicit checks against the senior-engineer bar: pattern adherence, error
  handling, type tightness, comment quality, test coverage.

  Triggered by: every git commit during autonomous mode. Not a user-invoked
  skill — it's a self-discipline mechanism the model runs on itself before
  pushing changes.
voice-triggers:
  - quality check
  - is this senior level
  - review my own work
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
---

# code-quality

> Speed comes from REUSE and PARALLELISM. Quality is non-negotiable.
> If you can't hit the bar, PARK the item and move on. Don't ship junk.

## The drift this skill prevents

After 5-10 hours of autonomous work, code quality drops in predictable ways:

- **Lazy comments**: `// adds two numbers` instead of `// why this comment exists`
- **`any` slipping in**: bridges to external types without documenting why
- **Pattern drift**: writing a new helper instead of using the existing one
- **Skipped error handling**: happy-path only, no thinking about failure modes
- **Test thinness**: one assertion when the code has five branches
- **Copy-paste**: from earlier in the same session, without checking if
  the problem genuinely matches
- **Architectural shortcuts**: "I'll just put this here for now" turns
  into permanent
- **Comment-as-narration**: explaining WHAT the next 5 lines do, instead
  of WHY they exist
- **Boilerplate doc bloat**: padding files with templated headers
  instead of substantive content

This skill is the discipline mechanism. Run it at every commit boundary.
The webhook-verification helper (item #1, commits `b31e91f` + `00cd377`)
is the current calibration target. The test-fixtures package (item #2,
commit `605ba26`) is the watermark — anything thinner than that is
sloppenheimer.

## When to invoke

**Always**, before any commit during autonomous mode. The skill is short
enough that running it costs single-digit seconds; the cost of NOT
running it is the user pointing out drift hours later.

**Specifically**: between writing the last line of code and `git commit`.
After typecheck passes. After tests pass. Before composing the commit
message.

## Workflow

### Step 1 — list the diff with intent

Before quality-gating, write down (in scratch, not committed):

- What is this change for? (One sentence — should fit a commit subject.)
- What gap from PRODUCTION-READINESS.md / PRODUCT-ROADMAP.md does it close?
- What is the smallest possible scope? Anything bigger is two commits.

If you can't answer all three sharply, the change isn't ready. Either
narrow it or document why the broader scope is necessary.

### Step 2 — run the structural checks

These are the cheap, automated checks. None are optional.

```bash
# Typecheck — pass or stop
pnpm typecheck

# Tests — pass or stop. If the change touches code without tests,
# you must have ADDED tests in this commit.
pnpm test  # or bun test, or per-package test command

# No leftover console.log / debug statements
git diff --cached | grep -E "^\+.*(console\.log|debugger|TODO\(me\)|FIXME\(me\)|XXX)" || true

# No new `any` (only existing ones, structurally documented)
git diff --cached | grep -E "^\+.*: any[\s,;)\]>]" || true

# No emoji in code or commit messages
git diff --cached | grep -P "[\x{1F300}-\x{1F9FF}]" || true
```

If any of these surface findings, FIX them. Do not commit with them
present. Do not write a commit message that says "TODO: fix the lints
in followup."

### Step 2b — workspace package check (HARD RULE)

If this commit adds OR modifies any `package.json` (root or any
workspace package), the `pnpm-lock.yaml` MUST be in the same commit and
MUST be up to date.

This rule exists because Vercel's CI uses `--frozen-lockfile` install,
which fails the entire build with `ERR_PNPM_OUTDATED_LOCKFILE` if the
lockfile drifts from any workspace `package.json`. We hit this exact
trap in commit `605ba26` (test-fixtures) → all 3 deploys errored →
follow-up fix in `7d36688`. Don't repeat it.

```bash
# If you touched any package.json, check the lockfile is current:
git diff --cached --name-only | grep -E "package\.json$" && {
  echo "⚠ package.json changed — verify pnpm-lock.yaml is in this commit"
  pnpm install  # regenerates lockfile
  git diff pnpm-lock.yaml | head -1 || echo "lockfile is clean"
}
```

If `pnpm install` modifies the lockfile, `git add pnpm-lock.yaml` and
include it in this commit. NEVER commit a `package.json` change without
the lockfile update.

### Step 3 — run the substantive checks

These require reading the diff with senior-engineer eyes. The questions
below are deliberately loaded — answering "yes" to "is this lazy?" is
disqualifying.

**Pattern adherence:**
- Does this file fit the conventions of its package? (Read 2-3 neighbor
  files. Check imports, exports, file structure, comment style, function
  naming. Match.)
- Did I use existing helpers (withTenant, getAdminDb, asTenantId,
  buildStorageKey, requireRole, etc.) where applicable, instead of
  re-implementing?
- Is anything in this diff a duplicate of code that already exists
  elsewhere in the repo? (`grep` the new function names + the obvious
  patterns.)

**Error handling:**
- For every async call: what happens if it fails? Is the failure mode
  documented and handled, or did I assume happy path?
- For every external call (DB, R2, fetch, Anthropic, Bedrock): what's
  the timeout? What's the retry policy? What gets logged?
- Are exceptions caught at the right layer (don't swallow at the leaf;
  don't propagate raw errors up to the user)?

**Type tightness:**
- Zero `any` unless documented why at the declaration with a reason and
  a TODO for replacement. Even then, it's borderline.
- Branded types (TenantId, ClientId, etc.) used where applicable — not
  raw strings.
- Optional fields: explicit `| null` or `| undefined`, not implicit.
- Function return types declared (Drizzle inference is fine; for hand-
  written helpers, declare).

**Comment quality:**
- Every non-trivial block of code has a "WHY" comment, not a "WHAT"
  comment. "WHAT" the code does is visible from reading it. "WHY" needs
  prose.
- Comments anchor to the broader context — name the bug they prevent,
  the convention they follow, the doc they reference.
- No comment that just paraphrases the next line.
- For tricky code, the comment explains "what would go wrong without
  this" — not "what this does."

**Test coverage:**
- Every non-trivial function has at least one test. "Non-trivial" means
  branches, loops, error paths, side effects.
- Tests cover the failure modes, not just the happy path. If the code
  has a try/catch, there's a test that triggers the catch.
- Tests are named for the property they assert ("returns false on
  malformed base64"), not for the function they call ("test
  verifyTwilioSignature").

**Atomicity:**
- This commit changes ONE thing. If the diff includes unrelated changes
  (drive-by refactors, gitignore tweaks, doc edits to unrelated files),
  split into separate commits.
- Commit subject describes the ONE thing in <70 chars.
- Commit body explains WHY (the gap from PRODUCTION-READINESS, the
  failure mode this prevents, etc.) — never just WHAT.

### Step 4 — write the commit message FIRST

Write the commit subject + body BEFORE the commit. If the message is
hard to write, the change is probably wrong.

Subject (under 70 chars):
- Format: `<type>(<scope>): <imperative description>`
- Types: `feat / fix / chore / docs / refactor / test / build`
- Scope: package or area (e.g., `shared`, `command-room`, `finalize`)

Body:
- Lead paragraph: WHY does this exist? What gap does it close?
- Middle: the load-bearing decisions and tradeoffs
- Last paragraph: how to verify (tests passing, smoke test results,
  etc.) + any followups (with explicit links to PRODUCTION-READINESS
  items or new TODOs)
- Sign-off: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`

If the message is "fix some stuff" or "add the thing": **STOP**. The
change isn't ready. Find the actual reason it exists.

### Step 5 — codex review for substantial changes

Trigger codex review (background agent, see `Agent` tool with
`codex:codex-rescue`) when ANY of:

- Touches >100 lines net
- Adds new architectural surface (new package, new agent, new schema
  table, new env var)
- Touches encryption, auth, RLS, audit trail
- Touches the prompt-construction layer of any agent
- Touches the trust-gate enforcement layer

For smaller changes (<100 lines, no architectural surface), the
self-review in Steps 1-4 is sufficient.

When codex reports findings:
- CRITICAL or HIGH → fix BEFORE pushing. Period.
- MEDIUM → fix in same commit if cheap; document inline as TODO with
  a referenced followup item if not.
- LOW → judgment call. Default to fix if cheap.

NEVER commit with codex CRITICAL/HIGH findings open. The webhook-
verification fixup (commit `00cd377`) is the calibration target —
when codex surfaces real issues, fix them, even if it means a fixup
commit on top of the original.

### Step 6 — final read of the diff

Before `git commit`, do `git diff --cached` and read it line by line.
Ask: "would I be embarrassed if a senior eng pulled up this diff in
review tomorrow?" If yes, fix.

Specific tells of embarrassment:
- A function with no comment explaining its purpose
- A test name that just echoes the function name
- A type alias that's just `string`
- An import not actually used
- A `useState` that's never read
- A `try/catch` whose catch just `console.log`s
- A SQL query that selects `*`
- A new file that duplicates 80%+ of an existing file
- A new env var without a comment + entry in the env example/README

## Anti-patterns this skill blocks

These are the specific shapes of sloppenheimer code. NEVER ship any of
them.

### Anti-pattern: "TODO followup" without an issue link

```typescript
// TODO: handle the edge case where amount is negative
return amount;
```

Either handle the edge case or write `// TODO(production-readiness-§D-3):
handle negative-amount edge case` with a reference. Bare TODOs rot.

### Anti-pattern: comment paraphrases code

```typescript
// Increment count by 1
count = count + 1;
```

Either explain why the count needs to increment here (the actual
context), or delete the comment.

### Anti-pattern: error swallow

```typescript
try {
  await externalCall();
} catch (e) {
  console.log('failed:', e);
}
```

Either handle the error meaningfully (retry, fallback, surface to
caller) or let it propagate. Logging without acting is "I see the
problem and chose to do nothing." That's the IG-ad-scenario shape.

### Anti-pattern: `any` without justification

```typescript
function processData(data: any): any {
```

If genuinely needed, write the type alias structurally:

```typescript
// Bridge type — Inngest's event.data.event.data nesting in onFailure
// is two-deep and the SDK doesn't export the shape. Documenting here
// rather than spreading `any` through call sites.
type InngestOnFailureNested = { data: { event?: { data?: unknown } } };
```

### Anti-pattern: test name = function name

```typescript
test('verifyTwilioSignature', () => { ... });
```

Test name should describe the PROPERTY:

```typescript
test('returns false on malformed base64 header', () => { ... });
test('rejects tampered body even with valid signature', () => { ... });
```

### Anti-pattern: copy-paste without checking neighbor

If you find yourself writing code that "feels familiar" — STOP. Search
the codebase for similar patterns. Reuse the helper. The
webhook-verification commit barely escaped this trap (codex caught the
barrel-export issue that already existed for the inngest-client).

### Anti-pattern: commit subject "wip" / "fix" / "update"

These words don't earn their bytes. If you can't write a specific
subject, you don't know what the commit does.

### Anti-pattern: shipping a file that duplicates an existing one's structure 80%+

If a new file looks 80% like another file, the abstraction is wrong —
either factor out the common pattern, or genuinely justify why the
duplication is the right shape.

### Anti-pattern: AI vocabulary slipping in

The Docket house style explicitly forbids: `delve`, `crucial`, `robust`,
`comprehensive`, `nuanced`, `multifaceted`, `furthermore`, `moreover`,
`additionally`, `pivotal`, `landscape`, `tapestry`, `underscore`,
`foster`, `showcase`, `intricate`, `vibrant`, `fundamental`,
`significant`. If a sentence in a comment or commit message uses any
of these, rewrite it.

## When to PARK an item

If, after going through the gate, the change can't pass without
substantial additional work, **park the item**:

1. Don't commit half-done work to main.
2. Stash or branch the in-progress code.
3. Add a row to `docs/AUTONOMOUS-QUEUE.md` under "Items requiring user
   action" or "Decisions queued for morning review" with the specific
   blocker.
4. Move to the next item.

The bar is "would this pass codex + senior review without a follow-up
fixup commit." If the answer is "probably not," park it.

## How to use this skill in autonomous mode

The user explicitly enabled bypass-permissions for autonomous overnight
work. That means: this skill cannot rely on the user to enforce
quality. It must enforce itself.

The mechanism:
1. Before EVERY commit, mentally run through Steps 1-6.
2. The list above isn't aspirational — it's a checklist. If any item
   fails, fix or park.
3. The webhook-verification → fixup-after-codex cycle (`b31e91f` →
   `00cd377`) is what RIGHT looks like. The codex catch was real, the
   fixup was substantive (subpath export, tightened comment, added
   no-throw tests). Replicate that shape on every change.
4. When in doubt, the answer is more rigor, not less. Speed comes from
   reuse + parallelism, not from cutting corners on quality.

## Reference exemplars

Calibration targets — read these to recalibrate the bar:

- **Best**: `packages/shared/src/webhook-verification.ts` — explicit
  attack model, per-provider docs with quirks, timing-safe primitives,
  comprehensive tests including no-throw contracts. Codex review caught
  real issues; fixup was substantive.
- **Good**: `services/workers/src/functions/finalize-document.ts` —
  thorough header explaining the failure modes the worker prevents,
  state-machine clarity, defensive top-level catch, persistFinalizeFailure
  helper.
- **Good**: `packages/db/src/encryption.ts` — two-tier API with header
  explaining when to use each, branded types throughout.

Anti-exemplars (do not pattern-match):

- **NEVER**: code generated by `npx @sentry/wizard` without manual
  review. Wizard output is fine to start, but ship-quality code needs
  the wrapper-helpers, error handling, and explanatory comments humans
  write.
- **NEVER**: any file that's mostly boilerplate copied from another
  file in the repo with names changed. If you find yourself doing this,
  there's an abstraction missing.

## Reading checklist

Before declaring autonomous work "done" for the night:

- [ ] Every commit message describes WHY, not WHAT
- [ ] Every commit passes typecheck + tests
- [ ] Every commit was preceded by a self-review
- [ ] Codex review was triggered for substantial commits
- [ ] CRITICAL/HIGH findings were fixed before push
- [ ] No `any` slipped in undocumented
- [ ] No console.log / debugger / TODO(me) left in code
- [ ] No new file duplicates >80% of an existing file
- [ ] No emoji or AI vocabulary in code or commits
- [ ] AUTONOMOUS-QUEUE.md is up to date

If any check fails: amend or follow-up commit. Do not leave it for
"morning review." Future-you will not catch what present-you missed.
