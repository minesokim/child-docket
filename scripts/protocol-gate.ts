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

import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

interface Trailers {
  edgeCases?: { enumerated: number; handled: number; documented: number };
  score?: number;
  align?: 'ALIGNED' | 'MISALIGNED' | 'BORDERLINE';
  craft?: 'PASS' | 'FAIL' | 'N/A';
  decisions?: string;
  complianceCheck?: string;
  protocolSkip?: string;
  raw: Record<string, string>;
}

const FEAT_PREFIX = /^(feat|fix)(\([\w/-]+\))?:/;
// File extensions/paths that count as UI-touching for /craft enforcement.
const UI_PATTERNS = [
  /^apps\/[^/]+\/src\/app\/.+\.(tsx|jsx|css)$/,
  /^apps\/[^/]+\/src\/components\/.+\.(tsx|jsx|css)$/,
  /^packages\/ui\/src\/components\/.+\.(tsx|jsx)$/,
  /^packages\/ui\/src\/tokens\.(ts|tsx)$/,
  /^packages\/ui\/src\/styles\.css$/,
];

function parseArgs(argv: string[]): { mode: string; arg?: string } {
  const args = argv.slice(2);
  if (args[0] === '--commit-msg' && args[1]) return { mode: 'commit-msg', arg: args[1] };
  if (args[0] === '--staged') return { mode: 'staged' };
  if (args[0] === '--range' && args[1]) return { mode: 'range', arg: args[1] };
  console.error(
    'usage: protocol-gate.ts --commit-msg <file> | --staged | --range <from..to>',
  );
  process.exit(2);
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
      const result = validate({ subject, body, files, shaForLog: sha });
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
