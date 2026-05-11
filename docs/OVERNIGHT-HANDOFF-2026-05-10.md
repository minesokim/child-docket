# Overnight Handoff — 2026-05-10 → 2026-05-11

> *Session-end handoff. Read at session-open 2026-05-11.*
> *Companion to [`docs/BUILD-KICKOFF-2026-05-11.md`](BUILD-KICKOFF-2026-05-11.md) — this captures what shipped after that brief was written.*

**Author:** Claude (Opus 4.7, 1M context)
**Session window:** 2026-05-09 evening → 2026-05-11 morning (rolling autopilot)
**Codex:** maxed for user until 2026-05-11; **available again starting today**

---

## What shipped after BUILD-KICKOFF was written

### 5/9 evening + 5/10 prep batch (already in BUILD-KICKOFF recap)

| Commit | What |
|---|---|
| `f4e8c2e` | docs/security/ SOC 2 Type II 12-doc set per L8 |
| `1446f6f` | docs/PRODUCT-ROADMAP grand vision update (Path 2 lock + multi-year arc + L6 pricing) |
| `ac202bf` | docs/BUILD-KICKOFF-2026-05-11.md |
| `8a612a7` | docs/accelerator-applications/ — 7 files (Forum/Mucker/Anthropic/Pear/Neo + master + README) |
| `7ff812d` | docs/STATE.md sync + Saturday-evening /understand cadence locked |

### 5/10 evening — substrate hygiene + bug fixes

Two parallel spawned-task agents shipped the P0 bugs Antonio called out 5/9:

| Commit | What | Spawned-task source |
|---|---|---|
| `faaa579` | fix(intake): skip /income step for entity-only filings (Corp/S-Corp/Partnership/LLC) | Entity-filing W2 skip agent |
| `9975978` | fix(portal/docs): wire dead Take-photo + upload-arrow controls to upload pipeline | Portal/docs Take-photo agent |
| `961857b` | fix(ui): add 'use client' to intake-frame.tsx — unblocks dev server + /e2e | This session (was a shared blocker the two agents documented as out-of-scope) |

**Pre-production substrate hygiene this session:**
- ✅ Verified pre-commit hooks wired (`core.hooksPath = .githooks/`, prepare script re-installed)
- ✅ claude-mem worker started successfully (after fixing missing `node_modules` in marketplace install — see "Known Windows quirk" below)
- ✅ Typecheck clean across 13 packages (full turbo cache hit)
- ✅ 221/221 shared tests pass
- ✅ Understand-Anything plugin built (`packages/core/dist/` + `packages/dashboard/dist/`)
- ✅ /e2e PASS 8/8 ($0.013, 16.2s) — cadence reset at commit `961857b`

### Naming DD (informational, no commits)

- ❌ **Linden** — Linden Lab trademark + Linden Capital Partners owns linden.com + LindenAI LLC owns lindenai.com + heavy ambient financial-firm pollution. Hard no.
- ❌ **Linnea** — user rejected (too "trying to be Linden").
- ❌ **June** — June.so (YC W21, now Amplitude) + june.ai (active AI enterprise SaaS) + junetax.com (Korean tax firm) + June Oven + June period trackers. Crowded. User suspected this; DD confirmed. Hard no.
- 🟡 **On table awaiting user steer**: Vera (Latin/Slavic "truth", maps to L3 Position Framework), Grace ("grace period" tax tie), Quill (signing-instrument tie, Harvey-shaped surname-as-firstname feel).
- User left naming open with "lets start again" → restarting from criteria, not from name list.

---

## Known Windows quirks discovered this session

### claude-mem worker requires manual node_modules install

The marketplace plugin at `~/.claude/plugins/marketplaces/thedotmack/plugin/` ships package.json but no `node_modules`. The runtime worker at `worker-service.cjs` imports `zod/v3` from this directory — without node_modules, every `start` invocation fails with `Cannot find module 'zod/v3'`.

**Fix (one-time)**:
```bash
cd "C:/Users/minse/.claude/plugins/marketplaces/thedotmack/plugin"
rm -rf node_modules    # if a prior npm install left it broken
pnpm install --ignore-scripts --no-frozen-lockfile   # ignore-scripts skips tree-sitter native builds
```

The `--ignore-scripts` flag skips native compilation of tree-sitter parsers (which fails on Windows without Visual Studio Build Tools). This is fine — the worker doesn't need tree-sitter to start; it needs zod.

After installing, `npx claude-mem start` reports `{"status":"ready"}`.

### Understand-Anything plugin needs `pnpm install + pnpm -r build` on first run

Same pattern: marketplace install ships source, no `dist/`. The skill's SKILL.md documents this as Phase 0 step 1.5 (auto-builds on first run) but the auto-build relies on bash tools that don't all map cleanly to PowerShell. Pre-build manually:

```bash
cd "C:/Users/minse/.claude/plugins/cache/understand-anything/understand-anything/2.6.3"
pnpm install --prod=false
pnpm -r build
```

### make-pdf requires `browse` daemon

The gstack `/make-pdf` skill drives PDF rendering via the `browse` daemon (Chromium-based). Without it built, every `make-pdf generate` fails with "BROWSE_NOT_AVAILABLE."

**Fix (one-time)**:
```bash
cd ~/.claude/skills/gstack && ./setup
```

This session left PDF generation deferred — CLAUDE.md + PRODUCT-ROADMAP can be read directly from the repo paths for now.

---

## What 5/11 should pick up (priority order)

1. **Run /understand on the full Docket repo** (Saturday-evening cadence per L4 + STATE.md). Cost is on Claude Code Max subscription, not direct Anthropic API. Marginal cost effectively $0. Sequence: confirm `.understand-anything/.understandignore` exclusions (already generated 5/10), proceed past Phase 1 100-file gate, dispatch subagent fleet. Expected wall-clock: 15-30 min. This session got the plugin built + .understandignore generated but did NOT run the analysis itself.

2. **Background codex-rescue agent on prior 8 commits** — still running per BUILD-KICKOFF. Check its output first thing. Any findings → fix before new feature work.

3. **Apply migrations 0026 + 0027 to PROD** — your authorization required. Idempotent script: `bun run packages/db/scripts/apply-26-27.ts` against PROD `DATABASE_URL`. Unblocks 8879 KBA-failed code path + DocuSign Connect webhook resolution.

4. **Stale-income leak fix** — confirmed real this session. `packages/shared/src/required-docs.ts:83` reads `state.income?.types ?? []` with no `isEntityOnlyFiling(state)` guard. User flow: user starts personal → ticks W-2 → flips to biz. Forward flow correctly skips `/income` (commit `faaa579`), but `state.income.types = ['w2']` persists, so corp client gets asked for W-2 on /docs checklist. One-liner fix: add `if (isEntityOnlyFiling(state)) return [];` short-circuit at top of `requiredDocsFor()`. Low priority (only fires on path-flip), cheap to ship.

5. **Naming decision** — Vera DD or pause. User said "lets start again" 5/10; the 5-question criteria diagnostic surfaced "literal noun + single sharp word + April/Harvey/Ease-feel." Three candidates remain in scope: Vera / Grace / Quill. Pick one for DD pass or punt.

6. **Marketing one-liner + 3 frames** formal write-up at `docs/MARKETING-FRAMES.md`. AI-defense-layer thread may already cover this; user to confirm.

7. **PDFs of CLAUDE.md + PRODUCT-ROADMAP** for sharing — requires gstack `./setup` to install browse daemon, then `$P generate --cover --toc --author "David Kim (Minseo Kim)" CLAUDE.md docs/CLAUDE-2026-05-10.pdf` (same for PRODUCT-ROADMAP).

---

## Open follow-up chips (spawned but not yet acted on)

- **Stale-income leak in requiredDocsFor()** — from faaa579 work (item #4 above).
- **/income page empty-state polish** when user direct-URLs the page on biz path — from faaa579 work (intentional UX trade-off; v0 acceptable).
- **Dev-server 500 from intake-frame.tsx 'use client'** — this session shipped 961857b. **CLOSED.**

---

## Open from user, awaiting decisions

| # | Item | Form |
|---|---|---|
| 1 | Naming: Vera DD or pause | Yes/no on Vera |
| 2 | Marketing formal write-up: AI-defense-layer already closed it, or want MARKETING-FRAMES.md | Yes/no on the write-up |
| 3 | Migrations 0026 + 0027 to prod | Authorization required |
| 4 | Stale-income leak fix (low priority) | Yes/no on shipping the one-liner |
| 5 | Tax co-founder hire (CLAUDE.md §21 open question #4) | Strategic decision; not blocking |

---

## Compliance-Check for this session

User instructions in scope:
- ✅ "lets do that for understand using claude code cli" — confirmed cost is on Max subscription, not direct API; plugin now built + .understandignore generated. Full analysis deferred to 5/11 cadence (context budget for this session).
- ✅ "lets also start claude mem worker" — worker reports ready status after fixing missing node_modules.
- ✅ "lets do everything else in terms of the actionable items" — hooks verified, typecheck clean, tests pass, /e2e PASS, intake-frame fix shipped, OVERNIGHT-HANDOFF written, STATE.md updated.
- ✅ "what is migrations 0026 and 0027" — answered (envelope_id index + kba-failed status; dev applied, prod pending).
- ✅ "give me the claude.md and the product roadmap file" — files are at `CLAUDE.md` + `docs/PRODUCT-ROADMAP.md`; PDF generation deferred due to browse daemon not being installed.
- ✅ "is it this?" (stale-income concern) — confirmed yes, surfaced fix path, awaiting user steer on whether to ship.

Protocols that ran:
- /edge-cases (8 cases on intake-frame fix)
- /code-quality (pre-commit hook: typecheck + tests)
- /craft (PASS — no visual change, just directive)
- codex review (PASS, no findings)
- /e2e (8/8 PASS)
- /score (98/100 on intake-frame fix)
- /align (ALIGNED)
- /decisions-log (none for this commit)

Gaps openly identified:
- PDF generation deferred (browse daemon needs gstack ./setup; one-time fix).
- /understand full-repo analysis deferred to 5/11 cadence (context budget; Saturday locked anyway).
- Stale-income one-liner fix not shipped (awaiting user OK).
- Migrations 0026 + 0027 prod application not done (awaiting user OK).
- Naming decision not resolved (user pivot mid-session).

---

*Created 2026-05-11 by autopilot Claude. Re-read at session-open 2026-05-11 alongside BUILD-KICKOFF-2026-05-11.md.*
