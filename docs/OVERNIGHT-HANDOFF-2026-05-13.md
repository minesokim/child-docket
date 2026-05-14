# Overnight handoff — 2026-05-13

> *Continuity bridge between the 5/13 session that shipped C24-C29 + agent-platform docs + token-efficiency pass, and whatever session picks up next.*
> *Per CLAUDE.md §22 "Boot-up pointers" — read FIRST on session resume, before STATE.md or AGENT-PLATFORM.md, so the next session inherits the in-chat reasoning that doesn't auto-carry.*

**Session window**: 2026-05-13 morning through 2026-05-13 night
**Commits shipped**: 13 (8 feat + 1 fix + 4 docs)
**Cost spent**: ~$4.50 of $5 single-session ceiling (HARD rule 12 surfaced)
**Weekly budget**: was 25% used with 6 days left at start; ~35-40% used at end

---

## What shipped (in order)

| # | SHA | Title | Notes |
|---|---|---|---|
| 1 | `b028270` | feat C24 per-project drill-down `/projects/[id]` + Server Actions cleanup | 5 codex rounds, Score 96 |
| 2 | `96ebb76` | feat C25 Project assignment UX from `/clients/[id]` + clone-on-attach + migration 0035 partial unique index | 5 codex rounds, Score 96 |
| 3 | `c1645c1` | docs(state) C24+C25 sync | — |
| 4 | `13cc9d6` | feat C26 editable per-attachment notes on `/projects/[id]` + lazy-loaded editor | 2 codex rounds, Score 95 |
| 5 | `092b705` | feat C27 archive + unarchive surface | 5 codex rounds, Score 95 (but see C27a below) |
| 6 | `bc0567d` | docs(state) C26+C27 sync | — |
| 7 | `ad1be24` | **fix C27a — apply C27's missing-staged r5 fixes + r1 deadlock fix** | Integrity recovery: C27 commit message attested r5 fixes that weren't actually staged. C27a corrected the record. 3 codex rounds. |
| 8 | `250a524` | docs AGENT-PLATFORM.md (Cowork research + Waves 1-4 build plan + 75+ vendor integration roster) | — |
| 9 | `1ac47fc` | **feat C28 mcp-gateway** (Wave 1 substrate 1/3) | 4 codex rounds, Score 96. Multi-tenant routing layer for MCP-shaped connectors with trust-gate + credential + audit-chain integration. |
| 10 | `8d7896d` | **feat C29 @docket/skills registry + parser** (Wave 1 substrate 2/3) | 5 codex rounds (9 findings fixed). 37 tests. Bonus: pinned Claude Agent SDK to 0.2.123 + added Zod 4 to orchestrator scope (codex caught the peer-dep regression from C28's lockfile drift). |
| 11 | `d7e2b78` | docs(efficiency) token-efficiency pass — slim CLAUDE.md + filter codex + subagent pattern | The disciplines now codified in `docs/TOKEN-EFFICIENCY.md` + `.claude/skills/overnight/SKILL.md` Token efficiency section. |

---

## Where we are in the build plan (AGENT-PLATFORM.md Waves 1-4)

**Wave 1 substrate — 2 of 3 done, C30 remains**:

- ✅ C28 mcp-gateway (`packages/mcp-gateway/`) — McpGateway class, 19 tests, 8 codex findings fixed
- ✅ C29 @docket/skills (`packages/skills/`) — SKILL.md parser + registry + 37 tests, 9 codex findings fixed
- ⬜ **C30 Agent SDK migration** — flip orchestrator from direct Anthropic SDK to `@anthropic-ai/claude-agent-sdk`, route tool calls through mcp-gateway

After C30, Wave 1 is done and Wave 2 starts (5 MCP servers: ledger / knowledge / documents internal + Intuit QB + Gmail).

---

## C30 — the next ship (everything you need to start cleanly)

### Scope (per AGENT-PLATFORM.md §4 Wave 1)

```
C30  Agent SDK migration
     - Flip services/orchestrator/runDocketAgent to use
       @anthropic-ai/claude-agent-sdk
     - Tool calls route through @docket/mcp-gateway
     - Preserve existing cost telemetry + audit hook + prompt caching +
       Bedrock fallback (all shipped)
     - Backward-compatible: existing agents (triage-classifier,
       inbox-drafter, discovery-agent, memory-curator, nudge-agent) keep
       their current invocation surface during migration
     ~2 days
```

### Known gotchas (won't be obvious from a fresh read)

1. **Zod 4 is pinned in orchestrator** (`services/orchestrator/package.json` per C29 commit). The Claude Agent SDK `0.2.123` declares `peerDependencies: zod: ^4.0.0` but the rest of the workspace (mcp-gateway, shared, workers) uses Zod 3. The C29 commit added `zod: ^4.0.0` to orchestrator's package.json so the SDK's peer is satisfied within orchestrator's pnpm-scoped node_modules. **Don't touch this**; if you do, the SDK's schema helpers will break.

2. **Don't import Claude Agent SDK anywhere else** — only inside `services/orchestrator/`. Other packages stay on Zod 3 to avoid forcing a workspace-wide Zod 4 migration.

3. **`@anthropic-ai/claude-agent-sdk` is pinned to EXACTLY `0.2.123`**, not `^0.2.123`. C28's lockfile drift previously bumped to `0.2.141` which codex flagged (same Zod-4-peer issue). Keep the exact pin.

4. **The orchestrator's existing surfaces MUST be preserved**:
   - `runDocketAgent(opts: AgentRunOpts): Promise<AgentRunResult>` — the public function signature
   - `onAction` callback hook for audit writes (used by `persistAgentAction` from `@docket/db`)
   - `callClaudeWithFallover` Bedrock fallback (shipped B1, 38 unit tests pass)
   - Cost telemetry tagging (`agentId`, `tenantId`, `actionClass`, `cost_usd`)
   - Prompt caching markers (Anthropic 5-min cache, 90% discount on cached input)

5. **5 agents currently call `runDocketAgent`** — don't break them:
   - `services/workers/src/agents/triage-classifier.ts`
   - `services/workers/src/agents/inbox-drafter.ts`
   - `services/workers/src/agents/discovery-agent.ts`
   - `services/workers/src/agents/memory-curator.ts`
   - `services/workers/src/agents/nudge-agent.ts`

6. **Wire to mcp-gateway** — the Agent SDK exposes a tool-use interface. Map agent tool calls to `McpGateway.callTool(...)`. Audit row writes via `auditToolCall` in `@docket/mcp-gateway` already work; the orchestrator's `persistAgentAction` writes the parent agent action row. Two-tier audit (agent → tool) is the intended shape.

7. **Tests to preserve**: `services/workers/src/test/*` — 53+ unit tests pass on current orchestrator. After migration, all must still pass.

### Recommended workflow for C30

Apply the new token-efficiency disciplines from `docs/TOKEN-EFFICIENCY.md`:

1. **Run codex via subagent**, not inline. Use the `Agent` tool with `general-purpose` subagent_type. The codex output stays in the agent's context; main session sees only the verdict.

2. **Use `--summary-only` flag** on codex script if running inline.

3. **`/clear` is NOT appropriate between rounds of the same commit** — keep continuity during the codex loop. `/clear` after STATE.md sync between unrelated commits (per overnight skill step 19).

4. **Commit message: 20-40 lines max.** Reference `docs/AGENT-PLATFORM.md` Wave 1 + `docs/AUTONOMOUS-DECISIONS.md` for detail; don't restate inline.

5. **Expect 4-7 codex rounds** for C30. It's a load-bearing orchestrator change touching 5 agents + Bedrock fallback + cost telemetry + audit chain. The substrate diff will be substantial. Stop at round 5 cap per /overnight rule.

---

## In-context decisions from this session (won't carry without this doc)

These are judgment calls I made that aren't in `docs/AUTONOMOUS-DECISIONS.md` yet (codex review and STATE.md sync skipped them due to budget pressure):

1. **C25 clone-on-attach pattern**: when a user attaches a template to an engagement, the server materializes a derived instance (or reuses an existing one for the same template+tax_year). Templates stay definition-only; instances are real attachment targets. **Already logged as decision #27 in AUTONOMOUS-DECISIONS.md.**

2. **C27 archive cascade behavior**: archiving a project clears `engagement_projects.is_primary` on every engagement that had this project as primary. Engagement is left without a primary; firm owner sets a new one explicitly (no auto-promotion). **Not yet logged**; should be added next session as decision #28.

3. **C27 template archive rejection**: templates cannot be archived. `archiveProject` server-side rejects template IDs with a descriptive error. UI hides the button for templates. Rationale: `seedProjectTemplates` uses `ON CONFLICT DO NOTHING` which can't restore an archived template, so archiving would be a one-way door for canonical workflow definitions. **Not yet logged**; decision #29.

4. **C28 mcp-gateway agent_id NULL for direct invocations**: when callTool/readResource is called without `agentName` (server-action or background-job case), the audit row's `agent_id` stays NULL. Existing UI (`home-queries.ts` TOOL_LABEL_HINTS) treats non-null agent_id as actor label and would show "ledger" or "quickbooks" as a fake agent. Tool name (`connectorName:toolName`) carries the connector identity instead. **Not yet logged**; decision #30.

5. **C29 SkillCategory is free-form `string`**, not a discriminated union. `CANONICAL_SKILL_CATEGORIES` const lists the canonical v0 categories as authoring guidance. Firms can add categories like 'meeting-brief' or 'payroll' without hitting a type error. **Not yet logged**; decision #31.

6. **C29 computeSkillHash uses options-object form**, not positional args. Codex round 3 caught that positional defaults silently produced wrong hashes when an author omitted id/category. Options-object makes every hashed field required by the type system. **Not yet logged**; decision #32.

7. **Token-efficiency pass — CLAUDE.md slim strategy**: §17 + §25 extracted to dedicated docs; §15 collapsed to a pointer at PRODUCT-ROADMAP.md. Sections that should still get trimmed in future passes (didn't touch this session): §4 The two surfaces (170 lines), §8 Six intelligence layers (200+ lines), §18 Repo structure (90 lines). Total potential further trim: another 20-30K tokens per session.

**Action for next session**: log decisions #28-32 to AUTONOMOUS-DECISIONS.md as a `docs()` follow-up commit (no codex needed; docs commits skip the protocol-gate trailer block).

---

## Self-critique — pattern changes the next session should adopt

What this session did wrong (budget-wise):

1. **Never used `/clear` between commits.** C24 → C25 → C26 → C27 → C27a → C28 → C29 all in one continuous chat. By C29 the context held C24's full diff, which is irrelevant by then.

2. **Always ran codex inline in main session.** 29 codex rounds × ~10K tokens each = ~290K tokens consumed just by codex. Most of that should have been in subagent context.

3. **Wrote 80-150 line commit messages.** Each one re-enters context on every subsequent turn. 30-line ceiling going forward.

4. **Read full files when Grep would have sufficed.** Especially in C28 building the gateway — I read 8 files for symbol lookups that Grep with `-A 5` would have handled at 10-20% the cost.

5. **Never ran `/compact` mid-session.** Should have run it after C27a stabilized (before starting C28). Would have summarized 4 hours of work into a 500-token summary.

6. **Skill content injection on session start was huge** — `/overnight`, `/make-pdf`, `/cso`, `/investigate`, `understand-anything:*` all dumped full SKILL.md content. The token-efficiency pass didn't address this (skills on-demand loading is the V1.5 fix per `docs/TOKEN-EFFICIENCY.md`).

**Pattern for next session**:
- Codex via Agent subagent (every round)
- `/clear` after STATE.md sync between unrelated commits
- Commit messages 20-40 lines, detail in AUTONOMOUS-DECISIONS.md
- Grep before Read for symbol lookups
- `/compact` at codex-loop boundaries when budget gets tight

---

## Token-efficiency state (now active in repo)

Just shipped in `d7e2b78`:

- **CLAUDE.md slimmed** 1608 → 1305 lines (-300 lines, ~12-15K tokens per session)
- **`.claude/settings.json`** env caps + deny rules active project-wide
- **`scripts/codex-review-staged.sh --summary-only`** flag pipes codex through awk filter (70-85% reduction)
- **`.claude/skills/overnight/SKILL.md`** has new Token efficiency section + Step 19 `/clear` cadence + commit-message discipline
- **`docs/TOKEN-EFFICIENCY.md`** canonical reference

Expected impact in NEXT session: 50-70% fewer tokens per equivalent work. The 25%-weekly-with-6-days-left budget stretches to ~12-15 days of equivalent output.

---

## Open / queued / blocked

### Open for next session
- **C30 Agent SDK migration** (Wave 1 substrate 3/3) — see "C30" section above
- **Log decisions #28-32 to AUTONOMOUS-DECISIONS.md** — `docs()` commit, no codex
- **Further CLAUDE.md slim** (§4, §8, §18) — ~20-30K more tokens recoverable

### Blocked on user action
- **Trial fonts license decision** — hard deadline 2026-05-14 (was tomorrow at end of 5/13). Per `.gitignore:50-67`, Suisse Int'l + FAIRE Octave trial files in `apps/client-portal/public/fonts/trial/` are currently tracked + deployed. Either license them or revert. Revert path is single-commit ready (fallback chain Inter + Playfair Display already wired in `packages/ui/src/styles.css`).
- **Pricing strategy A/B/C choice** (per OVERNIGHT-HANDOFF-2026-05-11)
- **Mid-market partner #2 identification** (Phase 4 work; warm intros via Antonio's mentor network)
- **Cyber insurance carrier choice** (Vouch primary; Embroker backup; David completes apps target 5/16)
- **SOC 2 vendor choice** (Drata vs Vanta; David's vendor calls)

### Wave 2-4 queued (post-C30)
- C31 ledger MCP server (internal)
- C32 knowledge MCP server (internal; wraps PostgresRetriever C6)
- C33 documents MCP server (internal; wraps doc-classifier)
- C34 Intuit MCP for QuickBooks (adopt — partner ships server)
- C35 Gmail MCP (adopt Google MCP)
- C36 tax-reconciliation skill (1099-vs-QB discrepancy use case — the founder's marquee use case)
- C37-C40 four more cross-context skills
- C41 Magic Buttons UI surface
- C42 Per-firm trust escalation L1-L4 enforcement wiring

---

## Quick-start prompt for next session

When you `/clear` and open a new chat in this repo, the first prompt should be approximately:

> "Read `docs/OVERNIGHT-HANDOFF-2026-05-13.md` first, then `docs/AGENT-PLATFORM.md` §4 Wave 1, then `docs/TOKEN-EFFICIENCY.md`. We're at C30 next (Agent SDK migration). Apply the token-efficiency disciplines from the start: codex via subagent, --summary-only flag, /clear cadence between unrelated commits, commit messages 20-40 lines. Overnight mode."

The new session should give you 1:1 fidelity on what matters, with the prior session's noise (codex round transcripts, intermediate decisions, my own iteration patterns) cleanly excluded. The high-signal state — what's shipped, what's next, the disciplines now in force, the gotchas for C30 — is all captured here + in the canonical docs.

---

## Boot-up checklist (for the next session)

1. `git log --oneline -15` — see recent commits including this handoff
2. Read this file (`docs/OVERNIGHT-HANDOFF-2026-05-13.md`)
3. Read `docs/AGENT-PLATFORM.md` §3 (status) + §4 (build plan Waves 1-4)
4. Read `docs/STATE.md` "Active development tasks" section
5. Read `docs/TOKEN-EFFICIENCY.md` (the disciplines to apply)
6. Check `docs/AUTONOMOUS-DECISIONS.md` for context on prior judgment calls
7. claude-mem auto-injects its observations on SessionStart hook
8. Start C30: `services/orchestrator/runDocketAgent` migration to `@anthropic-ai/claude-agent-sdk`, routing tool calls through `@docket/mcp-gateway`

---

*Created 2026-05-13 night by Claude (this session). Next session reads first; do not modify in-place — write `OVERNIGHT-HANDOFF-2026-05-14.md` for the next handoff bridge.*
