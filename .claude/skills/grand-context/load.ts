#!/usr/bin/env bun
// .claude/skills/grand-context/load.ts
//
// Loads canonical project context for a fresh autopilot session.
// Echoes a structured digest to stdout.
//
// Usage: bun run .claude/skills/grand-context/load.ts
// Or via the Skill tool: /grand-context

/* eslint-disable no-console */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

function read(file: string): string | null {
  const full = path.join(REPO_ROOT, file);
  if (!existsSync(full)) return null;
  return readFileSync(full, 'utf8');
}

function section(title: string) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ${title}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

// 1. CLAUDE.md — locked decisions + project identity + strategic posture
const claudeMd = read('CLAUDE.md');
if (claudeMd) {
  const locksMatch = claudeMd.match(/## 🔒 LOCKED DECISIONS[\s\S]*?(?=\n---|\n## )/);
  if (locksMatch) {
    section('🔒 LOCKED DECISIONS');
    console.log(locksMatch[0]);
  }
  // Project identity table — the ICP, vision, pitch, founder, stage, etc.
  // Codex flagged that earlier version skipped this; restored.
  const identityMatch = claudeMd.match(/## 1\. Project identity[\s\S]*?(?=\n## )/);
  if (identityMatch) {
    section('🪪 PROJECT IDENTITY');
    console.log(identityMatch[0].slice(0, 2500));
  }
  // Strategic posture — Palantir/Foundry route, dual-business-model framing.
  const postureMatch = claudeMd.match(/## 2\. Strategic posture[\s\S]*?(?=\n## )/);
  if (postureMatch) {
    section('🧭 STRATEGIC POSTURE');
    console.log(postureMatch[0].slice(0, 2500));
  }
}

// 2. STATE.md (live state)
const stateMd = read('docs/STATE.md');
if (stateMd) {
  section('🔌 LIVE STATE (docs/STATE.md)');
  // Truncate before "How to update this file" footer
  const cutPoint = stateMd.indexOf('## 📝 How to update');
  console.log(cutPoint > 0 ? stateMd.slice(0, cutPoint) : stateMd);
}

// 3. AUTONOMOUS-DECISIONS — last 5
// Codex flagged that joining-then-slicing(0, 5000) keeps OLDEST entries
// when total > 5K chars. Reverse: per-entry trim, then preserve newest.
const decisionsMd = read('docs/AUTONOMOUS-DECISIONS.md');
if (decisionsMd) {
  const entries = decisionsMd
    .split(/^## \[/m)
    .slice(1)
    .map((e) => '## [' + e);
  const last5 = entries.slice(-5);
  // Trim each entry to ~1000 chars so all 5 fit, prioritizing recency.
  const trimmed = last5.map((e) => (e.length > 1000 ? e.slice(0, 1000) + '\n  …(trimmed)…\n' : e));
  section('📋 RECENT DECISIONS (last 5, newest first)');
  console.log(trimmed.reverse().join('\n---\n'));
}

// 4. Last 10 commits
// Codex flagged: in safe.directory checkouts (CI sandboxes), `git log`
// throws and we silently lose the only ground-truth commit list. Add
// safe.directory fallback so we still emit recent history.
section('📜 LAST 10 COMMITS');
try {
  const log = execSync('git log --oneline -10', { encoding: 'utf8', cwd: REPO_ROOT });
  console.log(log);
} catch {
  // Retry with safe.directory bypass for CI-style sandboxed checkouts.
  try {
    const log = execSync(
      `git -c safe.directory="${REPO_ROOT}" log --oneline -10`,
      { encoding: 'utf8', cwd: REPO_ROOT },
    );
    console.log(log);
  } catch {
    console.log('(unable to read git log; safe.directory bypass also failed)');
  }
}

// 5. Latest overnight handoff (native fs — `ls` doesn't work on Windows
// where execSync uses cmd.exe. Codex flagged this on the first version.)
const handoffs = (() => {
  try {
    const docsDir = path.join(REPO_ROOT, 'docs');
    if (!existsSync(docsDir)) return [];
    return readdirSync(docsDir)
      .filter((f) => f.startsWith('OVERNIGHT-HANDOFF-') && f.endsWith('.md'))
      .map((f) => `docs/${f}`);
  } catch {
    return [];
  }
})();
const latestHandoff = handoffs.sort().pop();
if (latestHandoff) {
  const handoff = read(latestHandoff);
  if (handoff) {
    section(`🌙 LATEST HANDOFF (${latestHandoff})`);
    console.log(handoff.slice(0, 5000));
  }
}

// 6. PRODUCT-ROADMAP.md — pricing + Phase 2-expansion intro
const roadmap = read('docs/PRODUCT-ROADMAP.md');
if (roadmap) {
  const pricingMatch = roadmap.match(/## 8\. Pricing[\s\S]*?(?=\n## )/);
  if (pricingMatch) {
    section('💰 PRICING (PRODUCT-ROADMAP §8)');
    console.log(pricingMatch[0].slice(0, 2500));
  }
  // Match the actual Phase 2-expansion heading text in this repo
  // (currently "### Intake Flow v2 + State Compliance Engine
  // (Phase 2-expansion, ...)") — codex flagged the prior strict
  // `### Phase 2-expansion` regex never matched.
  const phase2Match = roadmap.match(/### [^\n]*Phase 2-expansion[\s\S]*?(?=\n### Agent fleet|\n## )/);
  if (phase2Match) {
    section('🛠 PHASE 2-EXPANSION');
    console.log(phase2Match[0].slice(0, 3000));
  }
}

section('✅ /grand-context loaded');
console.log('You are now grounded. Proceed with autopilot work.');
console.log('• Locked decisions are NOT subject to re-debate.');
console.log('• Live state in docs/STATE.md answers most "is X configured?" questions.');
console.log('• Recent decisions show ongoing rationale.');
console.log('');
