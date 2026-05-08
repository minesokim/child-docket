// services/workers/scripts/eval-classify.ts
//
// Eval harness for the triage-classifier agent.
//
//   bun run services/workers/scripts/eval-classify.ts
//
// What it does:
//   1. Loads golden vectors from ./eval-cases/classifier-cases.ts.
//   2. For each case, calls classifySignal() (real Anthropic API).
//   3. Compares emitted issueType against expected.
//   4. Reports per-case pass/fail + macro F1 across all 11 issue
//      types + total cost.
//
// What it doesn't do (v1 scope):
//   - LLM-as-judge for free-form fields (whyThisMatters,
//     recommendedAction). Deferred to v1.5 when the writing-quality
//     bar matters more than the categorization bar.
//   - GitHub Actions integration (separate commit). Run manually
//     before any prompt-template change for now.
//   - Confidence calibration (Brier score). Defer to v1.5.
//
// Cost: ~8 cases × Haiku 4.5 ≈ $0.001 per run. Cheap.
//
// Required env vars:
//   ANTHROPIC_API_KEY
//
// Exit codes:
//   0   F1 ≥ 0.85 (release-gate threshold)
//   1   F1 < 0.85 (regression — block the change)
//   2   FATAL (env / network / unexpected error)
//
// Why this exists: per docs/PRODUCTION-READINESS.md §C, prompt
// regressions go undetected for weeks without an eval harness.
// Run this before any commit that touches the triage-classifier
// prompt or the agent's input shape.

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env.local'), override: true });

import { classifySignal } from '../src/agents/triage-classifier.js';
import type { IssueType } from '@docket/shared';
import { ISSUE_TYPES } from '@docket/shared';
import { CLASSIFIER_CASES, type ClassifierEvalCase } from './eval-cases/classifier-cases.js';

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

const F1_THRESHOLD = 0.85;

interface CaseResult {
  caseId: string;
  description: string;
  expected: IssueType;
  actual: IssueType | null;
  confidence: number | null;
  costUsd: number;
  latencyMs: number;
  passed: boolean;
  error?: string;
}

async function runOne(c: ClassifierEvalCase): Promise<CaseResult> {
  const t0 = Date.now();
  try {
    const { output, costUsd, latencyMs } = await classifySignal({
      signal: c.signal,
      context: c.context,
      modelTier: 'haiku-4-5',
    });

    const passed =
      output.issueType === c.expected.issueType &&
      (c.expected.confidenceMin === undefined ||
        output.confidence >= c.expected.confidenceMin);

    return {
      caseId: c.id,
      description: c.description,
      expected: c.expected.issueType,
      actual: output.issueType,
      confidence: output.confidence,
      costUsd,
      latencyMs,
      passed,
    };
  } catch (err) {
    return {
      caseId: c.id,
      description: c.description,
      expected: c.expected.issueType,
      actual: null,
      confidence: null,
      costUsd: 0,
      latencyMs: Date.now() - t0,
      passed: false,
      error: (err as Error).message,
    };
  }
}

// Macro F1 across all issue types: average of per-type F1.
//
// For each issue type:
//   tp = expected==X AND actual==X
//   fp = expected!=X AND actual==X
//   fn = expected==X AND actual!=X
//   precision = tp / (tp + fp)
//   recall    = tp / (tp + fn)
//   f1        = 2 * precision * recall / (precision + recall)
//
// Types with zero expected AND zero predicted are excluded from the
// average (no signal — including them would dilute F1 unfairly).
function macroF1(results: CaseResult[]): { f1: number; perType: Record<string, number> } {
  const perType: Record<string, number> = {};
  let total = 0;
  let counted = 0;

  for (const issueType of ISSUE_TYPES) {
    let tp = 0;
    let fp = 0;
    let fn = 0;

    for (const r of results) {
      if (r.expected === issueType && r.actual === issueType) tp++;
      else if (r.expected !== issueType && r.actual === issueType) fp++;
      else if (r.expected === issueType && r.actual !== issueType) fn++;
    }

    const support = tp + fn;        // expected = this type
    const predictedSupport = tp + fp; // actual = this type

    if (support === 0 && predictedSupport === 0) {
      // No data either way; exclude from average.
      continue;
    }

    const precision = predictedSupport === 0 ? 0 : tp / predictedSupport;
    const recall = support === 0 ? 0 : tp / support;
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

    perType[issueType] = f1;
    total += f1;
    counted++;
  }

  return { f1: counted === 0 ? 0 : total / counted, perType };
}

async function main(): Promise<number> {
  console.log(`${YELLOW}━━ eval-classify ━━${RESET}`);
  console.log(`Cases: ${CLASSIFIER_CASES.length}`);
  console.log(`F1 threshold: ${F1_THRESHOLD} (release-gate)`);
  console.log('');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`${RED}FATAL${RESET} ANTHROPIC_API_KEY not set`);
    return 2;
  }

  const results: CaseResult[] = [];
  let totalCost = 0;
  let totalLatency = 0;

  for (const c of CLASSIFIER_CASES) {
    process.stdout.write(`  ${DIM}${c.id}${RESET} ... `);
    const r = await runOne(c);
    results.push(r);
    totalCost += r.costUsd;
    totalLatency += r.latencyMs;

    if (r.passed) {
      console.log(
        `${GREEN}PASS${RESET}  ${DIM}(actual=${r.actual} conf=${r.confidence?.toFixed(2)} ${r.latencyMs}ms $${r.costUsd.toFixed(5)})${RESET}`,
      );
    } else if (r.error) {
      console.log(`${RED}ERROR${RESET}  ${DIM}${r.error}${RESET}`);
    } else {
      console.log(
        `${RED}FAIL${RESET}  ${DIM}(expected=${r.expected} actual=${r.actual} conf=${r.confidence?.toFixed(2)})${RESET}`,
      );
    }
  }

  const { f1, perType } = macroF1(results);
  const passed = results.filter((r) => r.passed).length;

  console.log('');
  console.log(`${YELLOW}━━ summary ━━${RESET}`);
  console.log(`  cases:   ${passed}/${results.length} passed`);
  console.log(`  F1:      ${f1.toFixed(3)} (threshold ${F1_THRESHOLD})`);
  console.log(`  cost:    $${totalCost.toFixed(5)} total`);
  console.log(`  latency: ${totalLatency}ms total / ${(totalLatency / results.length).toFixed(0)}ms avg`);
  console.log('');
  console.log(`  per-type F1:`);
  for (const [type, f] of Object.entries(perType).sort()) {
    const color = f >= 0.9 ? GREEN : f >= 0.7 ? YELLOW : RED;
    console.log(`    ${color}${f.toFixed(3)}${RESET}  ${type}`);
  }
  console.log('');

  if (f1 >= F1_THRESHOLD) {
    console.log(`${GREEN}━━ F1 ${f1.toFixed(3)} >= ${F1_THRESHOLD} — release-gate PASS ━━${RESET}`);
    return 0;
  } else {
    console.log(`${RED}━━ F1 ${f1.toFixed(3)} < ${F1_THRESHOLD} — release-gate FAIL ━━${RESET}`);
    return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`${RED}FATAL${RESET}`, e);
    process.exit(2);
  });
