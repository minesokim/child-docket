# /grand-context — load full project context at session start

> *Solves the post-compaction "I forgot the grand vision" problem.*
> *Read CLAUDE.md + PRODUCT-ROADMAP.md (relevant sections) + recent decisions + last handoff in one shot.*
> *Run at the start of any autopilot session OR after a context refresh.*

---

## When to run this

- At session start, when picking up autopilot work
- Immediately after a context compaction (auto-summary kicked in)
- When you, the AI, are unsure whether you have the grand picture
- Before any architectural-decision conversation

If you find yourself about to ask the user "remind me what we decided about X" — STOP. Run /grand-context first. The answer is likely already locked.

---

## What this skill does

Reads, in order:

1. **CLAUDE.md `🔒 LOCKED DECISIONS` section** — the immutable architectural / strategic / pricing / design locks. NEVER re-litigate these.
2. **CLAUDE.md `Project identity` + `Strategic posture`** — vision, pitch, ICP, positioning.
3. **CLAUDE.md `🔌` connected systems** (via STATE.md) — what's wired vs not.
4. **PRODUCT-ROADMAP.md `Phase 2-expansion` + Pricing + Distribution** — the live build plan.
5. **docs/AUTONOMOUS-DECISIONS.md last 5 entries** — recent judgment calls + rationale.
6. **Last `docs/OVERNIGHT-HANDOFF-*.md` if present** — what the previous session shipped + open items.
7. **Last 10 commits via `git log --oneline -10`** — most recent ground truth.

Echoes a structured ~5-10K-token "context block" that re-grounds you.

---

## How to invoke

```bash
# Run from repo root
bun run .claude/skills/grand-context/load.ts
# Or via the Skill tool:
# /grand-context
```

The script outputs a markdown digest. Read it. Internalize it. Then proceed.

---

## The script (in this same skill dir as `load.ts`)

```ts
#!/usr/bin/env bun
// .claude/skills/grand-context/load.ts
//
// Loads canonical project context for a fresh autopilot session.
// Echoes a structured digest to stdout.

/* eslint-disable no-console */

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

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

// 1. CLAUDE.md locked decisions
const claudeMd = read('CLAUDE.md');
if (claudeMd) {
  const locksMatch = claudeMd.match(/## 🔒 LOCKED DECISIONS[\s\S]*?(?=\n---|\n## )/);
  if (locksMatch) {
    section('🔒 LOCKED DECISIONS');
    console.log(locksMatch[0]);
  } else {
    section('CLAUDE.md');
    console.log(claudeMd.slice(0, 4000));
  }
}

// 2. STATE.md (live state)
const stateMd = read('docs/STATE.md');
if (stateMd) {
  section('🔌 LIVE STATE (docs/STATE.md)');
  // Just the headers + connected systems table, not the full file
  const trimmed = stateMd
    .split('\n')
    .filter((line, i, arr) => {
      const nextHeader = arr.findIndex(
        (l, j) => j > i && l.startsWith('## ') && l.includes('How to update'),
      );
      return nextHeader === -1 || i < nextHeader;
    })
    .join('\n');
  console.log(trimmed);
}

// 3. AUTONOMOUS-DECISIONS — last 5
const decisionsMd = read('docs/AUTONOMOUS-DECISIONS.md');
if (decisionsMd) {
  const entries = decisionsMd
    .split(/^## \[/m)
    .slice(1)
    .map((e) => '## [' + e);
  const last5 = entries.slice(-5);
  section('📋 RECENT DECISIONS (last 5 from docs/AUTONOMOUS-DECISIONS.md)');
  console.log(last5.join('\n---\n'));
}

// 4. Last 10 commits
section('📜 LAST 10 COMMITS');
try {
  const log = execSync('git log --oneline -10', { encoding: 'utf8', cwd: REPO_ROOT });
  console.log(log);
} catch {
  console.log('(unable to read git log)');
}

// 5. Latest overnight handoff
const handoffs = (() => {
  try {
    return execSync('ls docs/OVERNIGHT-HANDOFF-*.md 2>/dev/null', {
      encoding: 'utf8',
      cwd: REPO_ROOT,
    })
      .trim()
      .split('\n')
      .filter(Boolean);
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
  const phase2Match = roadmap.match(/### Phase 2-expansion[\s\S]*?(?=\n### |\n## )/);
  section('💰 PRICING (PRODUCT-ROADMAP §8)');
  if (pricingMatch) console.log(pricingMatch[0].slice(0, 2000));
  section('🛠 PHASE 2-EXPANSION (intro)');
  if (phase2Match) console.log(phase2Match[0].slice(0, 1500));
}

section('✅ /grand-context loaded');
console.log('You are now grounded. Proceed with autopilot work.');
console.log('Locked decisions are NOT subject to re-debate. If something is locked, treat it as fixed.');
console.log('Live state in docs/STATE.md answers most "is X configured?" questions.');
```

---

## After running

You should now be able to answer (without re-asking):

- What's the strategic positioning? (Path 2 / orchestration platform / "tax practice OS")
- What's the pricing model? (Founder $250 first 50, then tiered + active-client metering)
- What's the memory architecture? (pgvector + Voyage-3-Large + Cohere Rerank, tiered retention)
- What's already shipped? (check STATE.md and recent commits)
- What's the next item to build? (PRODUCT-ROADMAP.md Phase 2-expansion queue)
- Who's our design partner? (Antonio Vazquez, Vazant Consulting, CA EA)
- What's the YC deadline? (Fall 2026, ~early August)

If you can't answer one of these from the loaded context, that section of CLAUDE.md / STATE.md / ROADMAP needs updating — fix it in your current work.
