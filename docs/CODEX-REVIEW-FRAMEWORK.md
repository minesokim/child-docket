# Codex Review Framework — production-code review workflow

> *How codex + gstack protocol-gate work together on every `feat(`/`fix(` commit during the 5/30 Antonio production sub-milestone + 6/8 Discovery agent build phases.*
> *Locked 2026-05-11. Aligns with CLAUDE.md §23 + the protocol-gate enforcement that the user explicitly codified after autonomous-session skips on 5/8.*

This file documents WHAT happens when Haokun ships code + WHAT Claude reviews + WHAT codex independently verifies. Pairs with `scripts/protocol-gate.ts` (commit-msg hook) and `scripts/codex-review-staged.sh` (codex review wrapper).

---

## The flow (every `feat(`/`fix(` commit)

```
Haokun writes the code
   ↓
Pre-commit hook runs:
   - pnpm typecheck (turbo across all 13 packages)
   - bun test src in packages/shared
   ↓
[If fails, fix and re-stage. Commit blocked.]
   ↓
Haokun runs /edge-cases skill on the change
   - Enumerates 8-15 edge cases (input/state/failure/time/permission/domain)
   - Marks each: handled / documented / out-of-scope
   - Output trailer: Edge-Cases: <N> enumerated, <N> handled, <N> documented
   ↓
Haokun runs /code-quality skill
   - Structural checks (no console.log, no undocumented any, lockfile sync)
   - Substantive checks (pattern adherence, error handling, comment quality)
   - Output: PASS or BLOCKED (with specific fixes)
   ↓
Haokun runs codex review:
   bash scripts/codex-review-staged.sh
   - Codex reviews the staged diff independently
   - Reports findings via codex CLI
   - Findings can be: critical (must-fix), high (should-fix), medium, low, informational
   ↓
[If critical or high findings: Haokun fixes, re-stages, re-runs codex.]
[Loop until codex returns PASS or PASS-with-fixes-applied.]
   ↓
Haokun runs /craft skill (if commit touches UI files)
   - Apple-bar UX gate
   - Six-question check (screenshot, eye-landing, hierarchy, copy voice, states, earned-place)
   - Output: PASS or FAIL or N/A — substrate-only
   ↓
Haokun runs /score skill (production-readiness scoring)
   - 12-dimension weighted average 0-100
   - Required: >= 95
   - If < 95: identifies lowest-scoring gap, loops until PASS
   ↓
Haokun runs /align skill
   - Six-question alignment check vs 12 product anchors + 7 explicit NOs
   - Output: ALIGNED / BORDERLINE / MISALIGNED
   - MISALIGNED blocks the commit
   ↓
Haokun runs /smoke-test skill (if commit touches Inngest workers,
document processing, storage helpers, server actions firing events,
encryption, or new /api/* routes)
   - Real end-to-end exercise against production-quality fixtures
   - Output: PASS or FAIL
   ↓
Haokun creates the commit with trailer block:
   Edge-Cases: 12 enumerated, 11 handled, 1 documented
   Score: 97/100
   Align: ALIGNED
   Craft: PASS (or N/A — substrate-only)
   Codex-Reviewed: PASS (or PASS-with-fixes-applied)
   Decisions: none (or [1] linking to AUTONOMOUS-DECISIONS.md)
   Compliance-Check: <≥80 char answer to "did I do what I was supposed to do?">
   ↓
Commit-msg hook validates trailer block:
   - All required trailers present
   - Score >= 95 → continue
   - Align != MISALIGNED → continue
   - Craft != FAIL on UI commits → continue
   - Codex-Reviewed present → continue
   - Compliance-Check >= 80 chars → continue
   ↓
[If any check fails: commit blocked.]
   ↓
Commit lands locally.
   ↓
Haokun pushes to origin/main.
   ↓
CI pipeline runs:
   - Protocol-gate job validates every commit in PR
   - Vercel auto-deploy
   - GitHub Actions: tests + smoke + /e2e if cadence-due
   ↓
Vercel deploy verified READY (curl check).
   ↓
/keep-going: pick next item from queue.
```

---

## What I (Claude) review when codex returns findings

When `bash scripts/codex-review-staged.sh` returns codex output, here's what I check before signing off:

### Critical findings (must-fix before commit)

| Finding type | What to verify | Action |
|---|---|---|
| **Security vulnerability** (SQL injection, XSS, hardcoded secret, missing auth) | Verify the vulnerability is real (not false positive); confirm fix addresses root cause + adds test coverage | Fix + add test + re-run codex |
| **Encryption issue** (AAD not bound, key reuse, wrong cipher) | Verify against `packages/db/src/encryption.ts` patterns; confirm AAD binding to `(tenant_id, client_id, path)` | Fix per `docs/KEK-ROTATION.md` patterns + re-run codex |
| **RLS bypass** (admin DB used without justification) | Verify against `getAdminDb()` allowed-callers list in CLAUDE.md §18; new callers require SECURITY.md justification | Either fix to use `withTenant()` OR document in SECURITY.md |
| **Audit-chain integrity violation** (action not logged, INSERT bypass) | Verify the action writes to `actions` table; confirm trigger-based chain not bypassed | Fix per `docs/security/logging-and-monitoring.md` |
| **Webhook signature missing** (new webhook handler without verification) | Verify use of `@docket/shared/webhooks` helper (32/32 tests, timing-safe) | Add HMAC verification + re-run codex |
| **PII leak** (raw SSN/EIN/bank in logs or error messages) | Verify `scrubPII()` is called in code path | Add scrubber call + re-run |
| **Cost runaway** (LLM call without telemetry hook, missing cache flag) | Verify `runDocketAgent` is used with proper telemetry + cache flag | Fix per `services/orchestrator/` patterns |

### High findings (should-fix before commit unless documented)

| Finding type | What to verify | Action |
|---|---|---|
| **Test coverage gap** | Verify the new code path has corresponding test in same package's test directory | Add test + re-run codex |
| **Pattern divergence** (different approach from existing similar code) | Check if divergence is justified (e.g., new requirement) or accidental | Refactor to match existing pattern OR document why diverged |
| **Error handling missing** | Verify try/catch, fallback path, user-facing error message | Add error handling + test it |
| **Dead code / unused import** | Cleanup | Remove |
| **Performance issue** (N+1 query, missing index, large payload) | Verify against query patterns; consider adding index migration | Optimize + add benchmark if hot path |

### Medium findings (consider; document if not fixed)

| Finding type | Action |
|---|---|
| Naming clarity | Rename if quick; otherwise document with `Protocol-Skip: clarity-pass-deferred` |
| Comment quality | Add comments to non-obvious logic; defer if trivial |
| Refactor opportunity | Document as TODO; not blocking |
| Documentation gap | Add docstring if public API; defer if internal |

### Low / Informational findings

No action required. Note in commit body if interesting.

---

## What codex specifically catches

Codex is good at:

1. **Cross-file pattern divergence** — when a new function uses a different approach than the codebase's existing pattern for the same problem
2. **Subtle security issues** — missing auth check, missing input validation, missing RLS scoping, hardcoded credentials, dangerous SQL string concatenation
3. **Edge cases not enumerated in `/edge-cases`** — codex frequently finds 1-3 edge cases the author missed
4. **Type-safety leaks** — `any` types, type assertions that hide bugs, missing branded-type wrappers
5. **Async-correctness issues** — missing await, race conditions, unhandled promise rejections
6. **Memory leaks** — listeners not cleaned up, intervals not cleared, large objects retained
7. **Performance regressions** — added query without index, added LLM call without cache, added loop with O(n²) behavior
8. **Test coverage gaps** — new code path not exercised by existing test
9. **Documentation drift** — new code that needs to update CLAUDE.md / STATE.md / a security/* policy

---

## What codex is NOT good at

1. **Strategic / product decisions** — codex doesn't know whether a feature should ship; only how
2. **Domain-specific tax law** — codex doesn't know IRC sections or Tax Court rulings; that's the Position Library + Antonio's role
3. **UX / visual design** — that's `/craft` skill's job
4. **Long-context architecture decisions** — codex reviews the diff, not the architecture; for architecture, use /plan-eng-review

For those, the protocol-gate has separate dedicated skills.

---

## Specific gstack-codex integration points (Antonio production sub-milestone + Discovery agent build)

### AAD encryption binding commit

**What Haokun ships**: Migration + code change to bind AES-256-GCM AAD to `(tenant_id, client_id, path)` per existing `encryption.ts` patterns.

**Codex should specifically check**:
- AAD construction is deterministic + collision-resistant
- AAD includes ALL three components (tenant_id, client_id, path)
- AAD is verified on decryption (decrypt fails if AAD mismatch)
- Migration is reversible (rollback path exists)
- Existing encrypted data is migrated (re-encrypted with new AAD or handled compatibly)
- Test cases cover: same data different AAD → decrypt fails; same AAD different tenant → decrypt fails; missing tenant_id → decrypt fails

**`/smoke-test` required**: Yes — this is encryption substrate. Run end-to-end with seed data; verify decrypt failures for incorrect AAD.

**`/score` thresholds**: 95+ required; encryption changes typically score 96-99 if all tests pass.

### KEK rotation execution commit

**What Haokun ships**: Run `rotate-kek.ts` script against existing tenant DEKs; remove master-KEK fallback path in `encryption.ts:194-215`.

**Codex should specifically check**:
- No master-KEK fallback remains in code (legacy path fully removed)
- Existing DEKs are re-encrypted under new master KEK
- Rotation script is idempotent (can be re-run safely)
- Audit trail captures every DEK rotation event
- Test cases cover: rotation success, partial failure recovery, idempotency

**`/smoke-test` required**: Yes. Run rotation against test tenant; verify decryption still works with new KEK.

### Discovery agent file commit

**What Haokun ships**: `services/workers/src/agents/discovery-agent.ts` implementing the 5-phase pipeline per `docs/DISCOVERY-SCAN-OPERATIONAL.md`.

**Codex should specifically check**:
- Position Library retrieval uses both pgvector + BM25 (hybrid)
- 4-tier classifier prompt uses prompt caching (cost discipline)
- Refusal floor enforcement is deterministic TypeScript rule (NOT LLM-based)
- PII scrubber runs on all inputs + outputs
- Cost telemetry tagged with prospect_id + scan_id
- All retrievals logged to audit chain
- Failure modes handled per spec: corrupt PDF, missing AAD, position library cache miss

**`/smoke-test` required**: Yes — this is the production-quality Discovery agent. Run end-to-end on a real test return.

**`/craft` required**: No (substrate-only; PDF rendering is a separate commit).

### Position Library backend wiring commit

**What Haokun ships**: Code to read `content/position-library/v0/positions/*.md` + index into pgvector + BM25.

**Codex should specifically check**:
- All 20 position entries are indexed (not partial)
- Effective-date versioning is preserved (per position file's "Effective date range")
- Tier classification mapping is correct (Tier 1-4 + REFUSED)
- Cited authority chain is preserved in retrieval results
- Re-indexing is idempotent (running twice doesn't duplicate)
- Test coverage on retrieval edge cases (no results, ambiguous queries)

**`/smoke-test` required**: Yes. Run Discovery agent on Antonio's sample return; verify retrievals match expected positions.

---

## When Haokun's commit lands, what I do (Claude)

1. **Read the commit message + trailer block**. Verify protocol-gate fields are all present + meet thresholds.
2. **Read the codex output** (typically in commit body or in `~/.gstack/codex-runs/`).
3. **If codex returned findings**: verify the fixes Haokun applied addressed root cause + added test coverage.
4. **Review the diff** for:
   - Pattern consistency with existing codebase
   - Anti-pattern detection (logging PII, missing trust gate, missing audit hook, hardcoded credentials)
   - Documentation drift (does CLAUDE.md / STATE.md need updating?)
5. **Run any required CI / smoke checks** if not already run.
6. **Update STATE.md** if integration / vendor / migration state changed.
7. **Update CLAUDE.md / docs/** if architectural decisions changed (rare for tactical commits, common for L-locked decisions).
8. **Move to next item per `/keep-going`** discipline.

---

## Anti-patterns the protocol-gate explicitly blocks

Per CLAUDE.md §23 user mandate:

1. **`Codex-Reviewed: N/A`** on a substantive commit — codex flagged that allowing N/A would let the AI bypass enforcement by claiming "trivial." NO N/A escape unless infrastructure broken.
2. **`Score: < 95`** — user codified the floor: "it needs to be 95+. if it doesn't reach those metrics, do it until it does."
3. **`Align: MISALIGNED`** — reshape or kill before committing. The product mission is the gate.
4. **`Craft: N/A`** on UI commits — UI commits must have explicit `/craft` PASS/FAIL.
5. **`Compliance-Check: <80 chars`** or filler answers like "yes" / "I think so" — must be substantive answer.
6. **`Protocol-Skip` without ≥10-char reason** — escape hatch requires accountability.

---

## CI gate (protocol-gate job in `.github/workflows/ci.yml`)

Re-validates every commit in a PR. Cannot bypass via `git commit --no-verify` locally; CI catches it.

Runs:
```bash
bun run scripts/protocol-gate.ts --range <base..head>
```

Fails the PR if:
- Any commit's trailer block is incomplete
- Any commit's Score < 95
- Any commit's Align is MISALIGNED
- Any commit's Craft is FAIL or N/A on UI files
- Any commit has `Protocol-Skip` without justification

---

## /e2e cadence enforcement

Per CLAUDE.md §23 + `scripts/protocol-gate.ts`:

- **WARN** at >= 3 `feat|fix` commits since last `/e2e` pass
- **BLOCK** at >= 6 `feat|fix` commits since last `/e2e` pass

State file: `.gstack/last-e2e-sha` (per-developer-machine, gitignored)

Run `/e2e` proactively if you've been heads-down for 3-5 commits.

---

## Examples of what good vs bad trailer blocks look like

### GOOD example

```
feat(orchestrator): bind AAD to (tenant_id, client_id, path) on AES-256-GCM encryption

Removes the master-KEK fallback path and binds AAD to the full tuple
required for per-tenant DEK isolation. Migration 0028 re-encrypts
existing DEK-encrypted columns with the new AAD construction.

Edge-Cases: 11 enumerated, 10 handled, 1 documented (legacy decrypt
fallback for migration window — handled in 0028)
Score: 97/100
Align: ALIGNED
Craft: N/A — substrate-only (no UI touched)
Codex-Reviewed: PASS-with-fixes-applied (codex flagged missing AAD
verification in 1 decrypt path; added in fixup; re-reviewed PASS)
Decisions: none
Compliance-Check: Addressed open CLAUDE.md Phase 2 item per user
priority. AAD bound. Master-KEK fallback removed. Migration 0028
applied. Test coverage at 34/34 encryption tests + 7 new AAD tests.
Smoke verified. /score 97 on first pass; no rerun needed.
```

### BAD example (blocked)

```
fix: encryption stuff

Edge-Cases: a few
Score: 82
Align: ALIGNED
Craft: N/A
Codex-Reviewed: N/A
Decisions: none
Compliance-Check: yes
```

Blocked because:
- Subject is non-descriptive
- Edge-Cases isn't formatted correctly
- Score 82 < 95 floor
- Codex-Reviewed: N/A on substantive commit
- Compliance-Check < 80 chars + filler answer

---

## Update discipline

- **After each major Haokun build phase** (AAD binding, KEK rotation, Discovery agent, etc.): update this doc with lessons learned + codex findings patterns
- **After first 10 codex reviews**: identify the top 3 finding categories; preemptively add them to /edge-cases default enumeration
- **After /e2e BLOCK condition fires**: review whether the BLOCK threshold (6 commits) is right; tune if needed
- **After cyber insurance binding (when deferred deferral lifts)**: integrate cyber insurance reporting requirements into commit hooks

---

*Created 2026-05-11. Re-read at the start of every Antonio production sub-milestone phase. Drift between this framework + actual codex / protocol-gate behavior is the bug it's designed to prevent.*
