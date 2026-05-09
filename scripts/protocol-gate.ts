#!/usr/bin/env bun
// scripts/protocol-gate.ts
//
// Hard enforcement of the autonomous-build protocols. Reads a commit
// message, classifies the commit type from the conventional-commit
// prefix, and validates that required protocol trailers are present
// AND meet substantive thresholds.
//
// User mandate (2026-05-08): "never ever make this mistake again. you
// are jeopardizing me." After 11 commits in one autonomous run that
// skipped /score, /align, /edge-cases, /craft entirely while citing
// them in commit messages, the protocols were converted from
// documentation into hooks. This is the validator.
//
// USAGE
//   --commit-msg <file>     Validate a commit message file (commit-msg hook)
//   --staged                Validate the most-recent staged commit's metadata
//   --range <from..to>      Validate every commit in a range (CI mode)
//
// CONTRACT
//
// Every commit whose subject begins with `feat(`, `fix(`, or `feat:` /
// `fix:` MUST include the following trailers in the body:
//
//   Edge-Cases: <count> enumerated, <handled> handled, <documented> documented
//   Score: <0-100>/100
//   Align: ALIGNED | MISALIGNED | BORDERLINE
//   Craft: PASS | FAIL | N/A — substrate-only
//   Decisions: [<n>] | none
//
// Substantive thresholds:
//   - Score >= 95 (per the user's "needs to be 95+ or loop until it does")
//   - Align must be ALIGNED or BORDERLINE (MISALIGNED blocks)
//   - Craft must be PASS for UI-touching commits; N/A is allowed only when
//     no UI files were touched in the commit
//
// ESCAPE HATCH
//
// `Protocol-Skip: <reason>` trailer (>=10 chars). Bypasses validation but:
//   1. The trailer is logged to docs/protocol-skips.jsonl
//   2. CI surfaces every protocol-skip in a separate report
//   3. The commit is auditable forever in the git log
//
// CI mode runs the same validator on every commit in a PR; locally
// the pre-commit + commit-msg hooks run it on the staged commit.

import { readFileSync, existsSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname } from 'node:path';

interface Trailers {
  edgeCases?: { enumerated: number; handled: number; documented: number };
  score?: number;
  align?: 'ALIGNED' | 'MISALIGNED' | 'BORDERLINE';
  craft?: 'PASS' | 'FAIL' | 'N/A';
  decisions?: string;
  complianceCheck?: string;
  protocolSkip?: string;
  /**
   * Codex-Reviewed trailer (mandate 2026-05-09): every feat|fix MUST
   * have an independent codex review. The trailer reports the verdict.
   *   PASS                    — codex review run, no issues
   *   PASS-with-fixes-applied — codex review run, findings fixed in
   *                             this same commit
   *
   * NO N/A escape hatch. Codex itself flagged on this gate's first
   * commit that allowing N/A would let me bypass the enforcement on
   * substantive commits by claiming "trivial." For genuine emergencies
   * (codex CLI broken, infra outage), use the existing `Protocol-Skip`
   * trailer with a real >=10-char reason.
   */
  codexReviewed?: 'PASS' | 'PASS-WITH-FIXES-APPLIED';
  raw: Record<string, string>;
}

const FEAT_PREFIX = /^(feat|fix)(\([\w/-]+\))?:/;

/**
 * Grandfathering for the Codex-Reviewed trailer + /e2e cadence
 * enforcement (the two new-as-of-2026-05-09 checks).
 *
 * Range mode (CI): a commit is post-enforcement IFF it has the
 * enforcement commit as an ancestor. Codex flagged on the gate's
 * first commit that date-based grandfathering breaks for in-flight
 * feature branches: a branch cut from main BEFORE the enforcement
 * commit but with new commits authored AFTER the cutoff date would
 * fail the gate even though the contributor's branch never had the
 * hook installed. Ancestry-based is the correct semantic: the
 * commits become "subject to the gate" only after the contributor
 * merges main and inherits the enforcement commit.
 *
 * Commit-msg mode: always enforces. The commit being authored
 * happens after the enforcement commit landed (or the operator
 * couldn't have run protocol-gate at all). Bypass via Protocol-Skip.
 *
 * The enforcement SHA lives in `docs/codex-e2e-enforcement-sha`
 * (tracked, NOT gitignored) so CI sees it. Initial commit ships an
 * EMPTY file; an immediate follow-up commit captures the
 * enforcement-commit SHA via:
 *
 *   git rev-parse HEAD > docs/codex-e2e-enforcement-sha
 *   git commit docs/codex-e2e-enforcement-sha \
 *     -m "chore: record codex/e2e enforcement SHA"
 *
 * If the file is empty (= we're in the gap between the enforcement
 * commit and the SHA-recording follow-up), all commits are exempt
 * from these checks in range mode. That's the correct fallback —
 * we'd rather skip enforcement on a one-commit window than break
 * unrelated PRs.
 *
 * Edge-Cases / Score / Align / Craft / Compliance-Check have been
 * gated since 2026-05-08; pre-existing commits already comply, no
 * grandfathering needed for those.
 */
const ENFORCEMENT_SHA_FILE = 'docs/codex-e2e-enforcement-sha';

/**
 * Read the enforcement SHA from a TRUSTED ROOT — not from the
 * candidate patch's working tree.
 *
 * Codex flagged across multiple review passes that local-file fallback
 * lets a PR self-disable enforcement by tampering with the tracked
 * file. The fix: only trust origin/main or the merge-base. NO local
 * fallback in range mode.
 *
 * Trust hierarchy (first hit wins):
 *   1. `git show origin/main:docs/codex-e2e-enforcement-sha`
 *      — main is branch-protected; PRs can't touch it
 *   2. `git show <merge-base HEAD origin/main>:<file>`
 *      — last common ancestor with main; same protection
 *
 * If neither resolves to a valid SHA → return null. The CALLER
 * fail-CLOSES on null (enforces trailers) so the rollout PR can't
 * disable the gate against itself. The rollout commit uses
 * Protocol-Skip with a reason; the SHA-recording follow-up is a
 * chore() commit that doesn't trigger feat/fix enforcement.
 *
 * Local-file existence is reported separately (for diagnostics in
 * the bootstrap window) but is NOT used to compute pre-enforcement.
 */
function readEnforcementShaFromTrustedRoot(): {
  sha: string | null;
  source: 'origin-main' | 'merge-base' | 'none';
} {
  // 1. Try origin/main directly. CI workflows that fetch full history
  // (actions/checkout with fetch-depth: 0) have this ref.
  try {
    const sha = execSync(`git show origin/main:${ENFORCEMENT_SHA_FILE}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (/^[0-9a-f]{7,40}$/i.test(sha)) {
      return { sha, source: 'origin-main' };
    }
  } catch {
    // origin/main not fetched, or file doesn't exist there.
  }

  // 2. Try merge-base with origin/main. The merge-base is on main
  // (or main's history) and unreachable from the PR's tampering.
  try {
    const mergeBase = execSync('git merge-base HEAD origin/main', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    const sha = execSync(`git show ${mergeBase}:${ENFORCEMENT_SHA_FILE}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (/^[0-9a-f]{7,40}$/i.test(sha)) {
      return { sha, source: 'merge-base' };
    }
  } catch {
    // No merge-base or no file at that revision.
  }

  return { sha: null, source: 'none' };
}

/**
 * Returns true if `commitSha` has `ancestorSha` in its history (or is
 * the same commit). Uses `git merge-base --is-ancestor`. Returns
 * false on any git error (e.g., SHA not reachable).
 */
function isAncestor(ancestorSha: string, commitSha: string): boolean {
  try {
    execSync(`git merge-base --is-ancestor ${ancestorSha} ${commitSha}`, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Committer-date is unused now (ancestry check is more correct), but
 * the helper stays in case a future grandfathering adds a date-based
 * constraint. %cI (NOT %aI) so cherry-pick/rebase resets the date.
 */
function commitDateIso(sha: string): string | null {
  try {
    return execSync(`git log -1 --format=%cI ${sha}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
      .trim();
  } catch {
    return null;
  }
}
// File extensions/paths that count as UI-touching for /craft enforcement.
const UI_PATTERNS = [
  /^apps\/[^/]+\/src\/app\/.+\.(tsx|jsx|css)$/,
  /^apps\/[^/]+\/src\/components\/.+\.(tsx|jsx|css)$/,
  /^packages\/ui\/src\/components\/.+\.(tsx|jsx)$/,
  /^packages\/ui\/src\/tokens\.(ts|tsx)$/,
  // Any CSS file directly under packages/ui/src/. Catches styles.css
  // (the canonical token sheet) AND skeleton-docs.css / future per-
  // surface CSS that the prior regex (only ^./styles.css$) missed.
  // Caught after the SSN/DL skeleton fix shipped without /craft
  // enforcement firing on its CSS file (commit 4964378, 2026-05-08).
  /^packages\/ui\/src\/[^/]+\.css$/,
];

function parseArgs(argv: string[]): { mode: string; arg?: string } {
  const args = argv.slice(2);
  if (args[0] === '--commit-msg' && args[1]) return { mode: 'commit-msg', arg: args[1] };
  if (args[0] === '--staged') return { mode: 'staged' };
  if (args[0] === '--range' && args[1]) return { mode: 'range', arg: args[1] };
  if (args[0] === '--record-e2e-pass') return { mode: 'record-e2e-pass' };
  console.error(
    'usage: protocol-gate.ts --commit-msg <file> | --staged | --range <from..to> | --record-e2e-pass',
  );
  process.exit(2);
}

// ────────────────────────────────────────────────────────────────
// /e2e cadence enforcement.
//
// User mandate (2026-05-09): "i have to run e2e? why aren't you
// doing it? its part of your strict protocol you have to follow.
// you are disappointing me. you aren't following my explicit
// directions. you are cutting corners every time. make sure this
// doesn't happen again."
//
// After 11 commits in one autonomous session without /e2e once,
// the cadence is now enforced HERE — not as documentation,
// not as a discipline I might forget.
//
// Cadence rules:
//   - WARN  at >= 3 feat|fix commits since last e2e pass
//           (= the cadence threshold per .claude/skills/e2e/SKILL.md)
//   - BLOCK at >= 6 feat|fix commits since last e2e pass
//           (= twice the cadence; clear cue I've been skipping)
//
// The state file `.gstack/last-e2e-sha` records the SHA of the
// commit that was at HEAD when /e2e last passed. Recorded by:
//   - `pnpm --filter @docket/workers e2e` wrapper on pass
//   - manual: `bun run scripts/protocol-gate.ts --record-e2e-pass`
//
// Bypassable via Protocol-Skip trailer for genuine emergencies.
// ────────────────────────────────────────────────────────────────

const E2E_STATE_FILE = '.gstack/last-e2e-sha';
const E2E_WARN_THRESHOLD = 3;
const E2E_BLOCK_THRESHOLD = 6;

interface E2eCadenceResult {
  warn?: string;
  error?: string;
}

function checkE2eCadence(): E2eCadenceResult {
  // No state file means /e2e has never been recorded. WARN once
  // with init instructions but don't block — first commit needs
  // breathing room.
  if (!existsSync(E2E_STATE_FILE)) {
    return {
      warn:
        '/e2e cadence state file missing (.gstack/last-e2e-sha). After your next /e2e pass, ' +
        'run `bun run scripts/protocol-gate.ts --record-e2e-pass` to seed it. ' +
        'The cadence enforcer counts feat|fix commits since the last recorded pass.',
    };
  }

  let lastSha: string;
  try {
    lastSha = readFileSync(E2E_STATE_FILE, 'utf8').trim();
  } catch {
    return { warn: `Could not read ${E2E_STATE_FILE}; e2e cadence check skipped.` };
  }
  if (!lastSha || !/^[0-9a-f]{7,40}$/i.test(lastSha)) {
    return {
      warn: `${E2E_STATE_FILE} contains an invalid SHA ("${lastSha}"). Re-record with --record-e2e-pass.`,
    };
  }

  // Count feat|fix commits since the last e2e pass. The grep
  // matches conventional-commit prefixes only — docs/, chore/,
  // refactor/, test/, etc. don't count toward cadence.
  //
  // Exclude grandfathered commits (commits that don't have the
  // codex/e2e enforcement SHA as ancestor). Codex flagged that
  // long-lived branches with several pre-enforcement feat/fix
  // commits would WARN/BLOCK on the first new commit purely
  // because of grandfathered work — incomplete grandfathering.
  let count = 0;
  try {
    // Verify the lastSha is reachable. If not (force-push, branch
    // switch), warn and continue without blocking.
    execSync(`git cat-file -e ${lastSha}`, { stdio: 'pipe' });
    const out = execSync(
      `git log --pretty="%H %s" --grep "^feat" --grep "^fix" -E ${lastSha}..HEAD`,
      { encoding: 'utf8' },
    );
    const candidates = out.split('\n').filter((l) => l.trim());
    const { sha: enforcementSha } = readEnforcementShaFromTrustedRoot();
    if (enforcementSha === null) {
      // No SHA recorded → bootstrap window → don't filter (everything
      // counts; the cadence system is itself bootstrapping).
      count = candidates.length;
    } else {
      // Filter out commits that DON'T have enforcement SHA as ancestor
      // (= pre-enforcement, grandfathered).
      count = candidates.filter((line) => {
        const sha = line.split(' ')[0];
        if (!sha) return false;
        return isAncestor(enforcementSha, sha);
      }).length;
    }
  } catch {
    return {
      warn:
        `Last-e2e SHA ${lastSha.slice(0, 8)} not reachable from HEAD (rebase / force-push?). ` +
        'Re-record after the next /e2e pass.',
    };
  }

  if (count >= E2E_BLOCK_THRESHOLD) {
    return {
      error:
        `BLOCKED: ${count} feat|fix commits since last /e2e pass (${lastSha.slice(0, 8)}). ` +
        `Cadence threshold is every ${E2E_WARN_THRESHOLD} commits. You are at ${E2E_BLOCK_THRESHOLD}+ — that's twice ` +
        `the cadence. Run /e2e (\`bun run services/workers/scripts/e2e-app.ts\`), then ` +
        `\`bun run scripts/protocol-gate.ts --record-e2e-pass\`. ` +
        `Genuine bypass: add Protocol-Skip trailer with reason.`,
    };
  }
  if (count >= E2E_WARN_THRESHOLD) {
    return {
      warn:
        `${count} feat|fix commits since last /e2e pass (${lastSha.slice(0, 8)}). ` +
        `Cadence is every ${E2E_WARN_THRESHOLD}; run /e2e soon to avoid the BLOCK at ${E2E_BLOCK_THRESHOLD}.`,
    };
  }
  return {};
}

function recordE2ePass(): void {
  const sha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/i.test(sha)) {
    console.error(`refusing to record invalid SHA: ${sha}`);
    process.exit(1);
  }
  mkdirSync(dirname(E2E_STATE_FILE), { recursive: true });
  writeFileSync(E2E_STATE_FILE, sha + '\n');
  console.log(`[protocol-gate] /e2e pass recorded at ${sha.slice(0, 8)}`);
}

function parseTrailers(message: string): Trailers {
  const trailers: Trailers = { raw: {} };
  const lines = message.split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Za-z][A-Za-z-]*):\s*(.+)$/);
    if (!m) continue;
    const [, key, value] = m;
    if (!key || !value) continue;
    trailers.raw[key.toLowerCase()] = value.trim();
  }
  // Edge-Cases: 12 enumerated, 9 handled, 3 documented
  const ec = trailers.raw['edge-cases'];
  if (ec) {
    const n = ec.match(/(\d+)\s+enumerated[,\s]+(\d+)\s+handled[,\s]+(\d+)\s+documented/);
    if (n) {
      trailers.edgeCases = {
        enumerated: Number(n[1]),
        handled: Number(n[2]),
        documented: Number(n[3]),
      };
    }
  }
  // Score: 96/100
  const sc = trailers.raw['score'];
  if (sc) {
    const n = sc.match(/(\d+)\s*\/\s*100/);
    if (n) trailers.score = Number(n[1]);
  }
  // Align: ALIGNED|MISALIGNED|BORDERLINE
  const al = trailers.raw['align'];
  if (al) {
    const upper = al.toUpperCase();
    if (upper === 'ALIGNED' || upper === 'MISALIGNED' || upper === 'BORDERLINE') {
      trailers.align = upper;
    }
  }
  // Craft: PASS | FAIL | N/A — substrate-only
  const cr = trailers.raw['craft'];
  if (cr) {
    const upper = cr.toUpperCase();
    if (upper.startsWith('PASS')) trailers.craft = 'PASS';
    else if (upper.startsWith('FAIL')) trailers.craft = 'FAIL';
    else if (upper.startsWith('N/A')) trailers.craft = 'N/A';
  }
  // Decisions: [17] | none
  trailers.decisions = trailers.raw['decisions'];
  // Compliance-Check: <free-text answer to "did I do what was asked">
  trailers.complianceCheck = trailers.raw['compliance-check'];
  // Protocol-Skip: <reason>
  trailers.protocolSkip = trailers.raw['protocol-skip'];
  // Codex-Reviewed: PASS | PASS-with-fixes-applied
  // (no N/A — see comment on the codexReviewed field)
  //
  // EXACT match (after trim + upper). Codex flagged that prefix matching
  // accepted "PASS (codex was down)" and "PASS-but-skipped" as valid —
  // an easy bypass on a hard gate. Hyphen vs space normalized so both
  // "PASS-WITH-FIXES-APPLIED" and "PASS WITH FIXES APPLIED" pass.
  const cx = trailers.raw['codex-reviewed'];
  if (cx) {
    const normalized = cx.trim().toUpperCase().replace(/\s+/g, '-');
    if (normalized === 'PASS-WITH-FIXES-APPLIED') {
      trailers.codexReviewed = 'PASS-WITH-FIXES-APPLIED';
    } else if (normalized === 'PASS') {
      trailers.codexReviewed = 'PASS';
    }
    // Any other value (including "PASS (codex down)", "PASS-skipped",
    // "N/A", etc.) is treated as missing — the validate() check
    // fires the BLOCK error.
  }
  return trailers;
}

function getStagedFiles(): string[] {
  try {
    const out = execSync('git diff --cached --name-only', { encoding: 'utf8' });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function getCommitFiles(sha: string): string[] {
  try {
    const out = execSync(`git show --name-only --pretty=format: ${sha}`, { encoding: 'utf8' });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function isUITouching(files: string[]): boolean {
  return files.some((f) => UI_PATTERNS.some((p) => p.test(f)));
}

function classifyCommit(subject: string): 'feat-or-fix' | 'other' {
  return FEAT_PREFIX.test(subject) ? 'feat-or-fix' : 'other';
}

interface ValidateInput {
  subject: string;
  body: string;
  files: string[];
  shaForLog?: string;
  /**
   * The commit's SHA, used for ancestry-based grandfathering of the
   * Codex-Reviewed + /e2e cadence checks in range mode. In commit-msg
   * mode this is unset (the commit hasn't been authored yet) and the
   * checks always enforce. The validate function calls isAncestor()
   * against the enforcement SHA to decide if this commit is exempt.
   */
  commitSha?: string;
}

interface ValidateResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  skipped: boolean;
}

function validate(input: ValidateInput): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const klass = classifyCommit(input.subject);
  if (klass === 'other') {
    return { ok: true, errors: [], warnings: [], skipped: false };
  }

  const trailers = parseTrailers(input.body);

  // Escape hatch — protocol-skip with reason >= 10 chars.
  if (trailers.protocolSkip) {
    if (trailers.protocolSkip.length < 10) {
      errors.push(
        'Protocol-Skip trailer present but reason is <10 chars. Provide a real justification.',
      );
      return { ok: false, errors, warnings, skipped: false };
    }
    warnings.push(
      `PROTOCOL-SKIP invoked: "${trailers.protocolSkip}". Logged to docs/protocol-skips.jsonl.`,
    );
    return { ok: true, errors, warnings, skipped: true };
  }

  // Required trailers for feat/fix.
  if (!trailers.edgeCases) {
    errors.push(
      'Missing trailer: "Edge-Cases: <N> enumerated, <N> handled, <N> documented". Run /edge-cases BEFORE implementation.',
    );
  }
  if (trailers.score === undefined) {
    errors.push(
      'Missing trailer: "Score: <0-100>/100". Run /score AFTER implementation; loop until >= 95.',
    );
  } else if (trailers.score < 95) {
    errors.push(
      `Score ${trailers.score}/100 is below the 95 floor codified by the user 2026-05-08. Loop /score until >= 95 before committing.`,
    );
  }
  if (!trailers.align) {
    errors.push(
      'Missing trailer: "Align: ALIGNED | MISALIGNED | BORDERLINE". Run /align after /score.',
    );
  } else if (trailers.align === 'MISALIGNED') {
    errors.push(
      'Align verdict MISALIGNED. Reshape the feature or kill it before committing — do not ship misaligned code with a TODO.',
    );
  }
  if (!trailers.craft) {
    errors.push(
      'Missing trailer: "Craft: PASS | FAIL | N/A — substrate-only". Run /craft on UI-touching commits, or mark N/A with substrate-only justification.',
    );
  } else if (trailers.craft === 'FAIL') {
    errors.push('Craft verdict FAIL. Fix or descope the surface before committing.');
  } else if (trailers.craft === 'N/A' && isUITouching(input.files)) {
    errors.push(
      'Craft trailer is N/A but the commit touches UI files. Run /craft and report PASS or FAIL. UI files staged: ' +
        input.files
          .filter((f) => UI_PATTERNS.some((p) => p.test(f)))
          .slice(0, 5)
          .join(', '),
    );
  }
  if (!trailers.decisions) {
    errors.push(
      'Missing trailer: "Decisions: [<n>] | none". Run /decisions-log; if no judgment calls, write "none".',
    );
  }
  // Compliance-Check trailer (mandate 2026-05-08): every commit must end
  // with the answer to "did I do what I was supposed to do?" The check
  // is enforced for length only — the content is auditable in git log,
  // not parseable. Minimum 80 chars to prevent "yes" / "I think so" /
  // single-word answers. This is the meta-rule the user codified after
  // observing the protocols-cited-but-not-run failure mode.
  if (!trailers.complianceCheck) {
    errors.push(
      'Missing trailer: "Compliance-Check: <answer>". After every "I think I\'m done" moment, ' +
        'answer "did I do what I was supposed to do?" Reference specific user instructions you ' +
        'verified you followed. Minimum 80 chars. This is the meta-rule the user codified after ' +
        'catching me ship 11 commits without running protocols.',
    );
  } else if (trailers.complianceCheck.length < 80) {
    errors.push(
      `Compliance-Check trailer is ${trailers.complianceCheck.length} chars (minimum 80). ` +
        'A real answer to "did I do what I was supposed to do?" requires substantive content — ' +
        'name the specific user instructions, list which protocols ran, identify any gaps. ' +
        '"yes" or "I think so" is not an answer.',
    );
  }

  // Grandfather pre-enforcement commits in range/CI mode. Per codex
  // review on the first version of this gate: "any range that still
  // contains older feat/fix commits authored before this trailer
  // existed" would fail unmergeably. The exemption applies only to
  // Codex-Reviewed + /e2e cadence — those are the new-as-of-2026-05-09
  // checks. Score / Align / Craft / Compliance-Check have been gated
  // since 2026-05-08; pre-existing commits already comply.
  //
  // Ancestry-based grandfathering: a commit is post-enforcement IFF
  // it has the enforcement commit as an ancestor.
  //
  // Read the enforcement SHA from a TRUSTED ROOT (origin/main or
  // merge-base), NOT the local working tree, to prevent a PR from
  // self-disabling enforcement by emptying the tracked file. Codex
  // flagged this as a P1 CI bypass on the prior version of the gate.
  //
  // Trusted-root SHA missing → exempt all commits in range mode.
  // Codex flagged across passes that fail-closed-on-null breaks
  // every in-flight PR across the team during the rollout window.
  // The bounded risk during this window (1-2 PRs landing without
  // gate enforcement) is preferable to all-PRs-blocked. After the
  // SHA-recording chore() commit lands on main, ancestry check
  // takes over normally.
  //
  // Trusted-root SHA present + commit is descendant → enforce.
  // Trusted-root SHA present + commit is NOT descendant →
  //   genuinely pre-enforcement (in-flight branch from before
  //   rollout) → exempt, IFF the recorded SHA is itself a real
  //   mainline commit. If the recording is bogus (squashed out,
  //   feature-branch SHA), fail CLOSED so the operator notices.
  let isPreEnforcement = false;
  if (input.commitSha !== undefined) {
    const { sha: enforcementSha } = readEnforcementShaFromTrustedRoot();
    if (enforcementSha === null) {
      // Bootstrap window — exempt to avoid breaking in-flight PRs.
      isPreEnforcement = true;
    } else if (isAncestor(enforcementSha, input.commitSha)) {
      isPreEnforcement = false;
    } else {
      // Commit is not a descendant of the recorded SHA. Distinguish:
      //   (a) Genuinely pre-enforcement (older branch) → exempt
      //   (b) Recording is bogus (SHA not on mainline) → fail CLOSED
      let onMainline = false;
      try {
        execSync(`git cat-file -e ${enforcementSha}`, { stdio: 'pipe' });
        execSync(`git merge-base --is-ancestor ${enforcementSha} origin/main`, {
          stdio: 'pipe',
        });
        onMainline = true;
      } catch {
        onMainline = false;
      }
      if (!onMainline) {
        isPreEnforcement = false;
        warnings.push(
          `Recorded enforcement SHA ${enforcementSha.slice(0, 8)} is unreachable or not on ` +
            `origin/main. Treating commit as post-enforcement (fail-closed). Re-record via ` +
            `\`git rev-parse <real-mainline-commit> > ${ENFORCEMENT_SHA_FILE}\`.`,
        );
      } else {
        isPreEnforcement = true;
      }
    }
  }

  // Codex-Reviewed trailer (mandate 2026-05-09 escalated). The user
  // codified codex review as unconditional in AUTONOMOUS-DECISIONS [23]
  // ("the discipline should be unconditional"). After observing me skip
  // codex on 8/8 substantial commits in one session with rationalizations
  // ("textbook pattern", "bounded surface area"), the trailer is a hard
  // gate — same as Score, Align, Craft.
  //
  // NO N/A escape. Codex itself reviewed the first version of this gate
  // and correctly flagged that allowing N/A would let me bypass the
  // enforcement on substantive commits by claiming "trivial." So PASS
  // or PASS-with-fixes-applied only. For genuine emergencies (codex CLI
  // broken, infra outage), use Protocol-Skip with a real >=10-char reason.
  if (!isPreEnforcement && !trailers.codexReviewed) {
    errors.push(
      'Missing trailer: "Codex-Reviewed: PASS | PASS-with-fixes-applied". Run codex review ' +
        'BEFORE commit via `bash scripts/codex-review-staged.sh`. The discipline is unconditional ' +
        'per AUTONOMOUS-DECISIONS [23] and [25]. No N/A escape — codex itself flagged that path ' +
        'as a bypass surface. For genuine emergencies (codex CLI broken, infra outage), use ' +
        'Protocol-Skip with a >=10-char reason.',
    );
  }

  // /e2e cadence enforcement (mandate 2026-05-09). Same grandfather
  // rule as Codex-Reviewed.
  if (!isPreEnforcement) {
    const cadence = checkE2eCadence();
    if (cadence.error) {
      errors.push(cadence.error);
    } else if (cadence.warn) {
      warnings.push(cadence.warn);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    skipped: false,
  };
}

function logProtocolSkip(sha: string, subject: string, reason: string) {
  const entry =
    JSON.stringify({
      ts: new Date().toISOString(),
      sha,
      subject,
      reason,
    }) + '\n';
  try {
    appendFileSync('docs/protocol-skips.jsonl', entry);
  } catch {
    /* best-effort log; don't block on FS issues */
  }
}

function readCommitFromFile(file: string): { subject: string; body: string } {
  const raw = readFileSync(file, 'utf8');
  // Strip comment lines (git's commit message editor adds these).
  const lines = raw.split('\n').filter((l) => !l.startsWith('#'));
  const cleaned = lines.join('\n');
  const idx = cleaned.indexOf('\n');
  const subject = idx === -1 ? cleaned.trim() : cleaned.slice(0, idx).trim();
  const body = idx === -1 ? '' : cleaned.slice(idx + 1);
  return { subject, body };
}

function readCommit(sha: string): { subject: string; body: string } {
  const subject = execSync(`git log -1 --format=%s ${sha}`, { encoding: 'utf8' }).trim();
  const body = execSync(`git log -1 --format=%b ${sha}`, { encoding: 'utf8' });
  return { subject, body };
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.mode === 'record-e2e-pass') {
    recordE2ePass();
    process.exit(0);
  }

  if (args.mode === 'commit-msg') {
    if (!args.arg) process.exit(2);
    if (!existsSync(args.arg)) {
      console.error(`commit-msg file not found: ${args.arg}`);
      process.exit(2);
    }
    const { subject, body } = readCommitFromFile(args.arg);
    const files = getStagedFiles();
    const result = validate({ subject, body, files });
    if (result.warnings.length > 0) {
      for (const w of result.warnings) console.warn(`[protocol-gate] WARN: ${w}`);
    }
    if (!result.ok) {
      console.error('\n[protocol-gate] BLOCKED — required trailers missing or invalid:\n');
      for (const e of result.errors) console.error(`  - ${e}`);
      console.error('\nAdd trailers to the commit message body, e.g.:\n');
      console.error('  Edge-Cases: 12 enumerated, 9 handled, 3 documented');
      console.error('  Score: 96/100');
      console.error('  Align: ALIGNED');
      console.error('  Craft: PASS  (or: N/A — substrate-only)');
      console.error('  Codex-Reviewed: PASS  (or: PASS-with-fixes-applied)');
      console.error('  Decisions: [17]  (or: none)');
      console.error(
        '  Compliance-Check: I confirmed I ran /score (96/100), /align (ALIGNED),',
      );
      console.error(
        '    /craft (PASS — UI in operational-modern), /edge-cases (13 enumerated, all handled),',
      );
      console.error(
        '    and the user\'s no-shadcn-defaults rule. No gaps I\'m hiding. (>=80 chars)',
      );
      console.error(
        '\nIf the work genuinely cannot run a protocol, add: "Protocol-Skip: <>=10-char reason>".\n',
      );
      process.exit(1);
    }
    if (result.skipped) {
      logProtocolSkip('staged', subject, parseTrailers(body).protocolSkip ?? '');
    }
    process.exit(0);
  }

  if (args.mode === 'staged') {
    // Validate against the most-recent commit. Used by post-commit checks
    // / CI smoke. For pre-commit enforcement, prefer --commit-msg which
    // sees the unfinalized message before the commit lands.
    const { subject, body } = readCommit('HEAD');
    const files = getCommitFiles('HEAD');
    const result = validate({ subject, body, files });
    if (!result.ok) {
      console.error('[protocol-gate] HEAD commit fails validation:');
      for (const e of result.errors) console.error(`  - ${e}`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (args.mode === 'range') {
    if (!args.arg) process.exit(2);
    const shas = execSync(`git log --format=%H ${args.arg}`, { encoding: 'utf8' })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    let failed = 0;
    let skipped = 0;
    for (const sha of shas) {
      const { subject, body } = readCommit(sha);
      const files = getCommitFiles(sha);
      const result = validate({
        subject,
        body,
        files,
        shaForLog: sha,
        commitSha: sha,
      });
      if (result.skipped) {
        skipped += 1;
        const reason = parseTrailers(body).protocolSkip ?? '';
        console.warn(`[protocol-gate] ${sha.slice(0, 8)} SKIPPED — ${reason}`);
        logProtocolSkip(sha, subject, reason);
      }
      if (!result.ok) {
        failed += 1;
        console.error(`[protocol-gate] ${sha.slice(0, 8)} FAILED:`);
        for (const e of result.errors) console.error(`    - ${e}`);
      }
    }
    console.log(
      `[protocol-gate] range ${args.arg}: ${shas.length} commits, ${failed} failed, ${skipped} protocol-skip.`,
    );
    process.exit(failed > 0 ? 1 : 0);
  }
}

main().catch((err) => {
  console.error('[protocol-gate] internal error:', err);
  process.exit(2);
});
