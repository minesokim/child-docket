#!/usr/bin/env bun
// .claude/skills/check-state/check.ts
//
// Reads docs/STATE.md and echoes a focused status snapshot.
// Solves the "asking about already-configured Twilio keys" problem.
//
// Usage: bun run .claude/skills/check-state/check.ts [--query "twilio"]

/* eslint-disable no-console */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const args = process.argv.slice(2);
const queryIdx = args.indexOf('--query');
const query = queryIdx >= 0 ? args[queryIdx + 1]?.toLowerCase() : null;

const stateFile = path.join(REPO_ROOT, 'docs/STATE.md');
if (!existsSync(stateFile)) {
  console.error('docs/STATE.md not found. Build it first.');
  process.exit(1);
}

const state = readFileSync(stateFile, 'utf8');

function section(title: string) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ${title}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

function extractSection(text: string, startMarker: string, endMarkerOpts: string[]): string | null {
  const startIdx = text.indexOf(startMarker);
  if (startIdx < 0) return null;
  // Look for end markers as WHOLE-LINE matches (newline-prefixed) so
  // substring `---` doesn't match inside table separators like
  // `|---|---|---|`.
  let endIdx = text.length;
  for (const e of endMarkerOpts) {
    const wholeLineMarker = '\n' + e;
    const i = text.indexOf(wholeLineMarker, startIdx + startMarker.length);
    if (i > 0 && i < endIdx) endIdx = i;
  }
  return text.slice(startIdx, endIdx).trim();
}

const connected = extractSection(state, '## 🔌 Connected systems', ['## 📦', '## 🔧', '## 🌐', '---']);
const notConnected = extractSection(state, '## 📦 Vendors NOT yet connected', ['## 🔧', '## 🌐', '---']);
const migrations = extractSection(state, '## 🔧 Migrations applied', ['## 🌐', '---']);
const deploys = extractSection(state, '## 🌐 Deployed surfaces', ['## 🧪', '---']);
const smokes = extractSection(state, '## 🧪 What\'s been smoke-tested', ['## 🛠', '---']);
const tasks = extractSection(state, '## 🛠 Active development tasks', ['## 🔐', '---']);
const soc2 = extractSection(state, '## 🔐 SOC 2 controls', ['## 📝', '---']);

function maybeFilter(content: string | null): string | null {
  if (!content) return null;
  if (!query) return content;
  // Keep header + filtered rows that mention the query
  const lines = content.split('\n');
  const headerEndIdx = lines.findIndex((l) => l.startsWith('|---'));
  const header = headerEndIdx >= 0 ? lines.slice(0, headerEndIdx + 1) : lines.slice(0, 3);
  const matches = lines.filter((l) => l.toLowerCase().includes(query));
  return [...header, ...matches].join('\n');
}

if (connected) {
  section(query ? `🔌 Connected (filtered: ${query})` : '🔌 Connected systems');
  console.log(maybeFilter(connected));
}
if (notConnected) {
  section(query ? `📦 Not yet connected (filtered: ${query})` : '📦 Vendors NOT yet connected');
  console.log(maybeFilter(notConnected));
}
if (migrations) {
  section('🔧 Migrations applied');
  console.log(migrations);
}
if (deploys) {
  section('🌐 Deployed surfaces');
  console.log(deploys);
}
if (smokes) {
  section('🧪 Smoke-test status');
  console.log(smokes);
}
if (tasks) {
  section('🛠 Active development tasks');
  console.log(tasks);
}
if (soc2) {
  section('🔐 SOC 2 controls in codebase');
  console.log(soc2);
}

section('✅ /check-state loaded');
console.log('If the answer to your question is HERE, do NOT ask the user.');
console.log('If it is NOT here, you may ask, AND update docs/STATE.md in your current commit.');
console.log('');
