# Token Efficiency

> *How to keep Docket's Claude Code sessions within weekly quota at same-or-higher output quality.*
> *Researched 2026-05-13 after founder hit 25% weekly usage with 6 days remaining.*

**Last updated**: 2026-05-13. Living doc — update with new patterns as they prove out.

---

## What burns tokens (from C24-C29 measured)

Ranked by estimated share of the C24-C29 overnight session's burn:

| Drain | Share | Why |
|---|---|---|
| Codex review rounds | ~40% | 29 rounds across 7 commits; each round dumps 1500-3000 tokens of analysis into main session context |
| CLAUDE.md (pre-trim) | ~20% | 1608 lines = 50-80K tokens loaded on every turn |
| Auto-injected skill content | ~10% | `/overnight`, `/make-pdf`, `/cso`, `/investigate`, `understand-anything:*` all inject full SKILL.md content |
| Unfiltered tool output | ~10% | `pnpm install`, `pnpm typecheck`, etc. — even with `\| tail -X` the bash buffer holds full output |
| Multi-file Read tool burn | ~8% | Each Read sends full file content; Grep with `-A` would have used 10-20% the tokens for symbol lookups |
| Long commit messages re-read | ~7% | 80-150 line commit messages re-enter context every turn |
| Continuous chat no /clear | ~2% (compounds) | C24's full diff still in context when C29 ships |
| TodoWrite + system reminders | ~3% | Per-turn overhead |

**Headline**: codex review + CLAUDE.md bloat = 60% of the burn. Most other tips are second-order.

---

## The 5 highest-ROI changes (in priority order)

### 1. Subagent the codex review

Default codex output is 1500-3000 tokens per round, mostly source quotes + tool traces. Wrap codex in a subagent so the verbose output stays in the agent's context; only the verdict returns to main.

```typescript
Agent({
  subagent_type: "general-purpose",
  description: "Codex review staged Cnn diff",
  prompt: "Run `bash scripts/codex-review-staged.sh --summary-only`.
  Return ONLY: (a) verdict CLEAN/HAS_FINDINGS, (b) up to 3 most
  important findings with file:line and one-sentence fix, (c) nothing
  else. Under 150 words total."
})
```

**Savings**: 60-70% of codex-round tokens. Across C24-C29 that would have been ~200K tokens recovered.
**Performance**: zero loss (codex still runs, findings still actionable).

### 2. Trim CLAUDE.md aggressively

Anthropic's official advice: keep CLAUDE.md under 200 lines. Pre-2026-05-13 it was 1608 lines. After the 5/13 token-efficiency pass, 1305 lines (-300 lines, -12-15K tokens per session).

Sections moved out (preserving content; just relocated):
- §17 Competitive landscape → `docs/COMPETITIVE-LANDSCAPE.md`
- §25 Slant.app strategic lessons → `docs/SLANT-LESSONS.md`
- §15 inline phase plan → collapsed to pointer at `docs/PRODUCT-ROADMAP.md`

Sections that should still get trimmed in future passes:
- §4 The two surfaces (170 lines) — trim verbose prose; keep tables
- §8 Six intelligence layers (200+ lines) — heavily nested; move detail to docs
- §18 Repo structure (90 lines of directory tree comments)

**Savings**: 12-15K tokens per session already shipped; another 20-30K available via §4/§8/§18 trim.
**Performance**: same or better (less noise in baseline context).

### 3. Filter tool outputs with grep, not tail

`tail -X` keeps the last X lines but the bash buffer holds the full output before truncation; grep filters at source.

```bash
# Token-efficient patterns:
pnpm typecheck 2>&1 | grep -E "error|Error|FAIL|✗" | head -20
pnpm test 2>&1 | grep -A 3 -E "FAIL|✗|expect\(.*\)\.toEqual" | head -50
bash scripts/codex-review-staged.sh --summary-only

# Less efficient:
pnpm typecheck 2>&1 | tail -15           # keeps tail but buffer is full
pnpm test 2>&1 | tail -30                # may miss mid-output failures
```

Project-level settings (`.claude/settings.json`) cap outputs server-side:
```json
"env": {
  "BASH_MAX_OUTPUT_LENGTH": "8000",
  "MAX_MCP_OUTPUT_TOKENS": "4000",
  "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "70",
  "MAX_THINKING_TOKENS": "8000"
}
```

**Savings**: 20-30% of tool-output tokens.

### 4. /clear after STATE.md sync between unrelated commits

Each commit in an overnight session inherits the context of all prior commits. By C29, the chat history includes C24's full diff. None of it is relevant.

Pattern: after `git push origin main` + STATE.md sync, run `/clear` IF the next task is meaningfully independent. Keep continuity for tightly-coupled work (e.g., codex r1→r2→r3 within the same commit; immediate follow-up fix to the same module).

**Savings**: 30-50% of mid-session token bloat.
**Performance**: zero for unrelated tasks; minor friction when continuity matters (skip /clear in those cases).

Note on prompt caching: Anthropic's prompt cache has 5-minute TTL. Rapid commits in tight time windows benefit from cache hits; long pauses lose the cache. Cluster commits.

### 5. Grep before Read for symbol lookups

```bash
# Targeted symbol lookup:
Grep "export.*getTenantCredential" packages/db/src -A 8

# NOT:
Read packages/db/src/tenant-credentials.ts   # sends 200+ lines
```

When you need surrounding context, use Read with `offset` + `limit` for targeted reads. Full-file Read only when you actually need full-file understanding.

**Savings**: 50-80% of Read tool tokens for symbol-lookup tasks.

---

## Anti-recommendations (popular advice that doesn't fit Docket)

| Recommendation | Why not for Docket |
|---|---|
| Switch everything to Haiku | Sonnet's reasoning catches concurrency bugs in substrate work (C25/C27 codex rounds proved this). Keep Sonnet for substrate; Haiku for mechanical edits. |
| Disable extended thinking entirely | Position Framework + trust gate work needs it. Cap budget instead (`MAX_THINKING_TOKENS=8000`). |
| Move CLAUDE.md to skills (on-demand) | The locked decisions (L1-L16) MUST be in baseline context. Skills are on-demand which is wrong here. |
| Enable agent teams (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`) | ~7x normal cost per Anthropic. Wrong direction for solo build pattern. |
| Cap everything to subagents | Subagent overhead > saved context for small tasks. Subagent ONLY heavy operations (codex review, e2e, multi-file analysis). |
| `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=1` | Drops tool descriptions Claude needs to invoke tools. False economy. |
| `CLAUDE_CODE_DISABLE_THINKING=1` | Harder version of the above. Don't. |

---

## Settings to apply

Project-level `.claude/settings.json` (already shipped 2026-05-13):

```json
{
  "env": {
    "BASH_MAX_OUTPUT_LENGTH": "8000",
    "MAX_MCP_OUTPUT_TOKENS": "4000",
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "70",
    "MAX_THINKING_TOKENS": "8000"
  },
  "permissions": {
    "deny": [
      "Read(node_modules/**)",
      "Read(.next/**)",
      "Read(dist/**)",
      "Read(.turbo/**)",
      "Read(coverage/**)",
      "Read(.gstack/**)",
      "Read(*.lock)",
      "Read(pnpm-lock.yaml)",
      "Read(package-lock.json)",
      "Read(yarn.lock)"
    ]
  }
}
```

Each developer should optionally add a statusline to user-level `~/.claude/settings.json` to show context % live:

```json
{
  "statusLine": { "type": "command", "command": "context-usage" }
}
```

---

## Commit-message discipline

The C24-C29 commit messages averaged 80-150 lines each. Target going forward: 20-40 lines.

**Bad (the pattern from C24-C29)**:
- Full architecture writeup inside the commit
- Every codex round's findings restated
- Inline NEXT-block roadmap
- 100+ line Compliance-Check trailer

**Good**:
```
feat(scope): short title (one line, ≤70 chars)

One paragraph: what shipped + why now (≤5 sentences).

Verification:
  - typecheck N/N PASS
  - tests N/N PASS  
  - codex M rounds (S findings fixed)
  - /e2e PASS at <sha> if applicable

NEXT: pointer to docs/AGENT-PLATFORM.md or docs/AUTONOMOUS-DECISIONS.md
       (don't recapitulate the plan inline)

[trailer block — Edge-Cases / Score / Align / Craft / Codex-Reviewed / Decisions / Compliance-Check]
```

Detailed rationale belongs in `docs/AUTONOMOUS-DECISIONS.md` (linked from the commit). The protocol-gate trailers MUST be present; the body prose around them should be terse.

**Savings**: commit messages get re-read on every codex round + every subsequent turn. 80 → 30 lines = 60% reduction on this dimension.

---

## Measurement

Track baseline + improvement:

1. **Before applying changes**: run a typical commit cycle and note `/usage` (or watch the statusline). Record context % at: start, after first codex round, after commit, before next task.

2. **After applying changes**: same protocol, same task class. Compare.

3. **Weekly tracking**: every Friday, check Claude Console Usage page for weekly token totals. Target: 50-70% reduction at same output quality.

---

## What we'll add as patterns prove out

- **Hook-based test filtering** (Anthropic's example): `PreToolUse` hook that wraps `npm test` / `pytest` etc. with `grep -A 5 -E '(FAIL|ERROR|error:)' | head -100`. Centralized output filtering instead of per-command piping.
- **Codex-review subagent skill**: dedicated `.claude/skills/codex-review-tight/SKILL.md` that wraps the subagent pattern as a callable skill.
- **CLAUDE.md auto-summarize hook**: on session start, summarize CLAUDE.md sections that aren't relevant to the current task. (V1.5 — needs careful design.)
- **Prompt-cache TTL awareness** in /overnight: cluster commits within 5-min windows when possible.

---

## Sources (researched 2026-05-13)

- [Manage costs effectively — Claude Code Docs (official)](https://code.claude.com/docs/en/costs)
- [Prompt caching — Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [23 Tips for Smart Claude Code Token Saving — Analytics Vidhya](https://www.analyticsvidhya.com/blog/2026/05/tips-for-claude-code-token-saving/)
- [7 Practical Ways to Reduce Claude Code Token Usage — KDnuggets](https://www.kdnuggets.com/7-practical-ways-to-reduce-claude-code-token-usage)
- [Claude Code Token Optimization — BuildToLaunch](https://buildtolaunch.substack.com/p/claude-code-token-optimization)
- [Reduce Claude Code token usage by 90% — Medium](https://medium.com/data-science-in-your-pocket/reduce-claude-code-token-usage-by-90-baa2a27b9ca3)
- [Anthropic prompt caching cut RCA cost by 90% — Dev.to](https://dev.to/stella_lin_82914c71e25769/anthropic-prompt-caching-cut-our-rca-cost-by-90-5gmb)
