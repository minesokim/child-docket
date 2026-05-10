# 5/11 BUILD KICKOFF Brief

> *Read this on session-open Monday 2026-05-11.*
> *Goal: zero-friction transition from prep to build.*
> *Time-box: 30 min to read + verify, then write code.*

**Author**: Claude (autonomous, 2026-05-09 prep)
**Audience**: Claude on 2026-05-11 + David Kim
**Codex**: available again starting 2026-05-11 (was maxed until then)

---

## Recap of where we are

You (Claude) have been on autopilot for 2026-05-08 → 2026-05-09. Substantive work that landed:

**Strategic locks (CLAUDE.md §🔒 L1–L15)**:
- L1: Path 2 commitment (orchestration platform; public API + MCP server in v1).
- L2: Category positioning ("tax practice operating system," not PM).
- L3: 5 capability pillars, headline = compliance-first Position Framework.
- L4: Memory architecture — pgvector + Voyage-3-Large + Cohere Rerank + tiered retention. NOT Pinecone.
- L5: Voice transcription — Deepgram Nova-3 in v1, Gladia Solaria-1 in v2.
- L6: Pricing — tiered base + active-client metering. Founder tier $250/mo for first 50 firms; Solo $499 / Small $1,499 / Growing $4,499 / Mid $14,999; add-on agents; per-event; API tier for Path 2.
- L7: Per-active-client cost target $1.39/mo → 80%+ gross margin at peak tier.
- L8: SOC 2 Type II posture — controls in codebase NOW, attestation later. **The 12-doc set landed at `docs/security/`.**
- L9–L15: see CLAUDE.md.

**Substrate work landed (from autopilot batch)**:
- 8 codex-reviewed feat/fix commits (audit chain + AAD-bound encryption + KEK rotation + cost outlier/spike alerts + notice-drafter trust gate + Bedrock fallback verification + webhook signature verification + PII regex scrubber).
- Migrations 0026 + 0027 applied to dev. **NOT yet applied to prod.** Prod authorization pending.
- Inngest crons registered: gmail-poll, classify-gmail-message, classify-document, classify-notice, finalize-document, verify-actions-chain, cost-outlier-alert, cost-spike-alert.
- Both apps deployed to Vercel READY (verified 2026-05-09).
- protocol-gate hard-baked: feat/fix commits require Edge-Cases + Score≥95 + Align ALIGNED + Craft + Codex-Reviewed (PASS or PASS-with-fixes-applied; no N/A escape) + Decisions + Compliance-Check (≥80 chars).
- /e2e cadence enforcement: WARN at ≥3 feat|fix since last pass; BLOCK at ≥6.

**Prep work landed (this 2-day stretch, autopilot, docs-only)**:
- `CLAUDE.md` updated with L1–L15 LOCKED DECISIONS section.
- `docs/STATE.md` created — live state of connected systems, migrations, deploys, smoke-tests.
- `docs/security/` created — 12 SOC 2 Type II policy + procedure docs per L8.
- `docs/PRODUCT-ROADMAP.md` updated with Path 2 lock + multi-year arc + L6 pricing.
- `.claude/skills/grand-context/` + `.claude/skills/check-state/` shipped (both codex-reviewed across 2 passes).
- claude-mem v13.0.1 installed (memory across sessions). Worker not started; run `npx claude-mem start` to activate.
- Understand-Anything (Lum1104) installed via Claude Code plugin marketplace.
- Naming due diligence: Linden ❌ blocked (Linden Lab trademark + Linden Capital Partners owns linden.com + LindenAI LLC owns lindenai.com + brand pollution from 3 financial firms). Linnea rejected by user.

**Open naming question**: Vera due-diligence pending if user requests.

---

## What to do FIRST on 2026-05-11 (in order)

### Step 1 — Re-ground (10 min)

```bash
# Load the canonical context.
bun run .claude/skills/grand-context/load.ts

# Verify what's connected before asking anything.
bun run .claude/skills/check-state/check.ts

# Confirm dev DB is caught up.
pnpm --filter @docket/db migrate
```

### Step 2 — Verify deploys + branch state (5 min)

```bash
# Both apps should show READY.
git status
git log --oneline -10

# Confirm pre-commit + commit-msg hooks are wired.
test -x .githooks/pre-commit && echo "pre-commit OK" || echo "MISSING — run pnpm hooks:install"
```

If anything reads stale, pause and re-read [`docs/STATE.md`](STATE.md) before writing code.

### Step 3 — Decide the day's primary item (5 min)

The default queue for 2026-05-11 (priority order):

1. **Spawned task: Intake "Take photo" + upload-arrow dead links** (P0 from Antonio call). In flight as a session-spawn task; check `apps/client-portal/src/app/portal/docs/page.tsx` for state.
2. **Spawned task: Entity-type branching (Corp showing W2)** (P0 from Antonio call). In flight.
3. **Background codex-rescue agent on prior 8 commits**. Started 2026-05-09; check status with the agent's last output; if any findings landed, fix before new feature work.
4. **Apply migrations 0026 + 0027 to prod** — pending user authorization. Substrate-blocking for any 8879 KBA-failed-status code path.
5. **Citation hover infrastructure** — tooltip on every dollar value sourced from artifact. v1 marquee diff.

If the spawned tasks are still in flight: pick item 3 or 4 or 5. If prod migration is blocked: pick item 5.

### Step 4 — Run /edge-cases BEFORE writing code (per CLAUDE.md §23)

For whichever item you pick, enumerate 8–15 edge cases (input / state / failure-mode / time / permission / domain-specific) before opening an editor. Save in the implementing PR description or commit body.

### Step 5 — Implement → typecheck → test → /code-quality → /craft → codex review → commit

Standard cycle from CLAUDE.md §23. Codex is back online 2026-05-11; **every feat/fix commit requires Codex-Reviewed PASS or PASS-with-fixes-applied trailer**. No N/A escape.

### Step 6 — /smoke-test if applicable → /score → /align → /keep-going

Standard /keep-going pattern. /score must be ≥95; loop the same item if not. /align must be ALIGNED; reshape or kill if not.

---

## Don't repeat 2026-05-09's mistakes

The autopilot batch on 2026-05-09 caught the user awake mid-stream. Lessons:

1. **Don't skip codex on feat/fix commits.** User mandate verbatim: *"you continually skip steps i tell you not to skip. continually. over and over. it is very frustrating. bake it in."* The protocol-gate hard-bakes this; never use `git commit --no-verify` or `Protocol-Skip` without a real >=10-char reason.
2. **Don't skip /e2e past the threshold.** The cadence enforcement WARN/BLOCK is the structural defense; respect it.
3. **Don't ask the user about credentials that are already documented.** Run `bun run .claude/skills/check-state/check.ts --query <vendor>` first. The "Twilio-keys forgetfulness" pattern is solved structurally; use the solution.
4. **Don't repeat the L1-L15 debates.** They are LOCKED. CLAUDE.md §🔒 says "decisions the founder + AI locked in deliberate sessions. NOT subject to re-debate without a written counter-case." Treat as fixed.

---

## What "ship in a day" looks like for 2026-05-11

A successful 2026-05-11 ships at least one of:
- **Migrations 0026 + 0027 applied to prod** (if user authorizes) → unlocks 8879 KBA-failed code path.
- **Citation hover infrastructure** (v1 marquee diff) → tooltip on every dollar value sourced from artifact.
- **Spawned-task resolution** (Take photo / entity branching) → P0 Antonio-call items resolved.

A successful 2026-05-11 does NOT:
- Re-debate any L1–L15 lock.
- Ask the user about already-documented credentials.
- Skip codex review on any feat/fix commit.
- Skip /score or /align loops.

---

## Risks for 2026-05-11

- **Background codex-rescue may have surfaced findings on the prior 8 commits.** Fix those FIRST before new feature work; the protocol-gate's grandfathering means commits before the enforcement-sha don't auto-block, but findings still need to land.
- **prod migrations 0026 + 0027 are blocking some downstream paths.** Get user authorization before assuming you can apply them.
- **Naming decision is open.** If user wants to lock a name, run the trademark + domain DD pass on the chosen candidate before any branding work.

---

## What's NOT in scope for 2026-05-11

- Accelerator applications (drafts shipped 2026-05-09; user reviews + edits + submits when ready).
- Tax co-founder hire (open question #4 in CLAUDE.md §21; not a Claude task).
- v1.5 features (PRODUCT-READINESS.md is the punch list; v1 must launch first).
- Any consumer-tax-filer / Big-4 / F500 lane (per CLAUDE.md §14 NOs).

---

## End-of-day check

Before signing off on 2026-05-11, answer: *"did I do what I was supposed to do?"* in the day's handoff doc (`docs/OVERNIGHT-HANDOFF-2026-05-11.md`). The trailer must:
1. Name the items shipped.
2. Confirm codex review + protocol-gate trailers on every feat/fix.
3. Confirm /score ≥95 + /align ALIGNED on every shipped feature.
4. Surface any gap, shortcut, or deferred item openly. Hidden gaps are the failure mode.

This is the same compliance-check rule that fires at every commit; same rule fires at end of session.

---

*Created 2026-05-09 by autopilot Claude. Re-read at session-open 2026-05-11.*
