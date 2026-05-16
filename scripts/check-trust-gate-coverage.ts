#!/usr/bin/env bun
// scripts/check-trust-gate-coverage.ts
//
// Per CLAUDE.md §13 white-space bet #1 + POSITION-FRAMEWORK.md §2:
// the trust-gate ladder (L1-L4 × Tier 1-4) is the structural safety
// net that makes Petal adoptable for an EA whose PTIN is on every
// return. The helper at `packages/shared/src/trust-gate.ts` (67
// tests pass) is the source-of-truth implementation.
//
// Per the 2026-05-15 audit (security agent): the helper is shipped
// + called from 5 sites (3 agents + flows/discovery-scan + mcp-
// gateway), but enforcement is OPT-IN per agent. A new agent file
// that forgets the call silently bypasses the trust ladder — high-
// risk silent failure mode.
//
// This script enforces the per-agent decision at lint time. Every
// `.ts` file in `services/workers/src/agents/` (excluding test files)
// must either:
//
//   (a) call `assertTrustGate(` somewhere in the file body, OR
//   (b) carry a `// SKIP-TRUST-GATE: <reason>` marker (>=10-char
//       reason) in a header comment, documenting why this agent
//       doesn't need the gate (typically: doesn't emit tax positions).
//
// Failing both → fail the build.
//
// USAGE
//   bun run scripts/check-trust-gate-coverage.ts
//
// EXIT CODES
//   0 — all agents covered
//   1 — drift; details to stderr
//   2 — script crashed (fs unavailable)
//
// CI INTEGRATION (follow-up): wire alongside check-getAdminDb-callers
// in .github/workflows/ci.yml. Until that lands, run manually + by
// reviewers on diffs that add or modify agent files.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const AGENTS_DIR = 'services/workers/src/agents';
const SKIP_MARKER_REGEX =
  /\/\/\s*SKIP-TRUST-GATE\s*:\s*([^\n]{10,})/i;
const CALL_REGEX = /assertTrustGate\s*\(/;

function listAgentFiles(): string[] {
  let entries: string[];
  try {
    entries = readdirSync(AGENTS_DIR);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[check-trust-gate] cannot read ${AGENTS_DIR}: ${msg}`,
    );
    process.exit(2);
  }
  return entries
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => !f.endsWith('.test.ts'))
    .map((f) => join(AGENTS_DIR, f).replace(/\\/g, '/'));
}

type FileVerdict = {
  file: string;
  state: 'gated' | 'skipped' | 'missing';
  skipReason?: string;
};

function classify(file: string): FileVerdict {
  let body: string;
  try {
    body = readFileSync(file, 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[check-trust-gate] cannot read ${file}: ${msg}`);
    process.exit(2);
  }

  if (CALL_REGEX.test(body)) {
    return { file, state: 'gated' };
  }
  const skipMatch = body.match(SKIP_MARKER_REGEX);
  if (skipMatch) {
    return {
      file,
      state: 'skipped',
      skipReason: skipMatch[1]!.trim(),
    };
  }
  return { file, state: 'missing' };
}

function run(): { ok: boolean; messages: string[] } {
  const files = listAgentFiles();
  const messages: string[] = [];
  let ok = true;

  const verdicts = files.map(classify);
  const missing = verdicts.filter((v) => v.state === 'missing');
  const skipped = verdicts.filter((v) => v.state === 'skipped');
  const gated = verdicts.filter((v) => v.state === 'gated');

  if (missing.length > 0) {
    ok = false;
    for (const v of missing) {
      messages.push(
        `❌ TRUST-GATE COVERAGE MISSING: ${v.file}\n` +
          `   This agent file does not call assertTrustGate(...) and does\n` +
          `   not carry a SKIP-TRUST-GATE opt-out marker. Either:\n` +
          `     (a) Import + call assertTrustGate from @docket/shared.\n` +
          `         Pattern: see services/workers/src/agents/discovery-\n` +
          `         agent.ts for the position-emitting case.\n` +
          `     (b) Add a header comment line:\n` +
          `           // SKIP-TRUST-GATE: <>=10-char reason — typically\n` +
          `           // "doesn't emit tax positions" for classifiers /\n` +
          `           // extractors / drafters that route through the\n` +
          `           // critical-authorization boundary downstream.`,
      );
    }
  }

  // Always print a summary line for visibility, even when ok.
  const summary =
    `   Coverage: ${gated.length} gated · ${skipped.length} skip-marked · ${missing.length} missing of ${files.length} total agent files.`;
  if (skipped.length > 0) {
    const skipList = skipped
      .map((v) => `     - ${v.file}: ${v.skipReason}`)
      .join('\n');
    messages.push(
      `Trust-gate skip-marked agents (intentional opt-outs):\n${skipList}`,
    );
  }
  if (ok) {
    messages.unshift(`✓ Trust-gate coverage clean.\n${summary}`);
  } else {
    messages.push(summary);
  }

  return { ok, messages };
}

const { ok, messages } = run();
const stream = ok ? process.stdout : process.stderr;
for (const msg of messages) stream.write(`${msg}\n`);
process.exit(ok ? 0 : 1);
