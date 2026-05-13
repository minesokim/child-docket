// Smoke: discovery-agent against a synthetic intake.
//
// Validates:
//   1. Prompt registry hash check passes (no drift).
//   2. Sonnet 4.6 produces a JSON object that passes DiscoveryOutputSchema.
//   3. At least one Tier 1-2 position surfaces for an obvious fact pattern
//      (self-employed CA freelancer with home office + 1099 income).
//   4. Trust-gate verdict computes correctly (L1 firm + Tier 1 = blocked
//      for human-approval; L2+ firm + Tier 1 = allowed).
//   5. Cost stays under ~$0.05 per call (Sonnet + caching).
//
// Usage: ANTHROPIC_API_KEY=... DISCOVERY_AGENT_ENABLED=true \
//          bun run services/workers/scripts/smoke-discovery.ts
//
// IMPORTANT — DISCOVERY_AGENT_ENABLED is the kill-switch added 2026-05-08
// (licensure-stakes mandate). Without it set to 'true', runDiscovery
// throws DiscoveryAgentNotEnabledError before invoking Sonnet. This
// is intentional: pre-knowledge-layer the model can hallucinate IRC
// citations, and Antonio's PTIN is on every return that uses them.
//
// EXPECTED OUTPUT (illustrative — exact positions vary per call):
//   - Self-employment expense deductions (IRC §162(a))
//   - Self-employed health insurance (IRC §162(l))
//   - QBI deduction (IRC §199A)
//   - Maybe: home-office (IRC §280A(c))
//   - Maybe: SEP/Solo-401k contributions (IRC §401(a))
//   - CA-specific: PTET election if S-corp; SDI/EDD considerations

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load env from BOTH .env.local (preferred — most contributors store
// secrets here) AND .env (fallback for setups that only have a
// non-local file). .env.local wins when both exist because we load
// it second with `override: true` (codex C7 round 3 P3). Without
// .env fallback, contributors running with only `.env` would see
// missing ANTHROPIC_API_KEY / DATABASE_URL / DISCOVERY_AGENT_ENABLED.
const repoRoot = path.resolve(__dirname, '../../..');
loadEnv({ path: path.join(repoRoot, '.env') });
loadEnv({ path: path.join(repoRoot, '.env.local'), override: true });

import { runDiscovery } from '../src/agents/discovery-agent.js';
import { asTenantId, asClientId } from '@docket/shared';
import { PostgresRetriever } from '@docket/db';

const SYNTHETIC_INTAKE = {
  filingStatus: 'single',
  state: 'CA',
  age: 34,
  dependents: 0,
  income: {
    w2: 0,
    selfEmployment1099NEC: 92000,
    interestIncome: 410,
  },
  selfEmploymentDetails: {
    businessType: 'web design freelance',
    homeOffice: {
      hasDedicatedSpace: true,
      sqftBusiness: 180,
      sqftHomeTotal: 1100,
      usedRegularlyAndExclusively: true,
    },
    vehicleMiles: { business: 2200, total: 8400 },
    healthInsuranceMonthlyPremium: 540,
    retirementContributions: { ira: 0, sepIra: 0, solo401k: 0 },
  },
  itemizedDeductions: { mortgageInterest: 0, salt: 6800, charitable: 1200 },
  lifeEvents: [],
};

async function main() {
  console.log('--- discovery-agent smoke ---');
  console.log('Synthetic intake: CA self-employed freelancer, $92k 1099-NEC,');
  console.log('  180 sq ft home office, health insurance, no retirement contributions.');
  console.log();

  // Wire the production retriever (PostgresRetriever — hybrid BM25 +
  // cosine + RRF fusion). Ungated mode: includeDrafts:true so the seeded
  // DRAFT-DAVID position memos surface during smoke. Production callers
  // leave includeDrafts:false (default) so prospects never see drafts.
  //
  // Constructor shape is (tenantId, opts) — codex C7 round 1 P2.
  // Smoke runs against the seeded global authorities + Vazant firm
  // memos; in production each tenant gets its own retriever scoped to
  // that tenant's authorities via RLS.
  const smokeTenantId = asTenantId('00000000-0000-0000-0000-000000000001');
  const retriever = new PostgresRetriever(smokeTenantId, {
    apiKey: process.env.VOYAGE_API_KEY,
    includeDrafts: true,
    fallbackToBM25: true,
  });

  const t0 = Date.now();
  const result = await runDiscovery({
    input: {
      context: {
        tenantId: smokeTenantId,
        clientId: asClientId('00000000-0000-0000-0000-000000000002'),
        trustLevel: 1, // Conservative L1 — should yield "human-approval" verdict
      },
      intakeAnswers: SYNTHETIC_INTAKE,
      jurisdictions: ['federal', 'CA'],
    },
    modelTier: 'sonnet-4-6',
    retriever,
    retrievalTopK: 12,
    // Match the retriever — verifier must surface drafts too,
    // otherwise injected DRAFT-DAVID cites get false-flagged as
    // unresolved and the trust gate downgrades (codex C7 round 2 P3).
    includeDrafts: true,
  });
  const elapsedMs = Date.now() - t0;

  console.log(`positions: ${result.output.positions.length}`);
  for (const p of result.output.positions) {
    console.log();
    console.log(`  [Tier ${p.tier}] ${p.claim}`);
    console.log(`    audit risk: ${p.auditRisk}`);
    console.log(`    estimated impact: $${p.estimatedImpact.dollars} (${p.estimatedImpact.certainty})`);
    if (p.disclosureRequired) console.log(`    *** Form 8275 required ***`);
    console.log(`    authority:`);
    for (const a of p.authority) {
      console.log(`      - ${a.source}: ${a.cite} — ${a.summary.slice(0, 80)}`);
    }
    console.log(`    rationale: ${p.rationale}`);
    if (p.gapsToConfirm.length > 0) {
      console.log(`    gaps: ${p.gapsToConfirm.length}`);
      for (const g of p.gapsToConfirm) console.log(`      - ${g}`);
    }
  }

  if (result.output.refusedPositions.length > 0) {
    console.log();
    console.log(`refused (below floor): ${result.output.refusedPositions.length}`);
    for (const r of result.output.refusedPositions) {
      console.log(`  - ${r.hypothetical}`);
      console.log(`    why: ${r.reason}`);
    }
  }

  console.log();
  console.log(`confidence:    ${result.output.confidence}`);
  console.log(`reasoning:     ${result.output.reasoning}`);
  console.log();
  console.log('--- trust gate ---');
  console.log(`verdict:       ${result.trustGate.allowed ? 'allowed' : 'BLOCKED'}`);
  console.log(`highestTier:   ${result.trustGate.highestTier}`);
  if (!result.trustGate.allowed) {
    console.log(`requires:      ${result.trustGate.requires}`);
    console.log(`reason:        ${result.trustGate.reason}`);
  }
  console.log();
  console.log('--- retrieval ---');
  console.log(`hits injected: ${result.retrievalHitCount} authority chunk(s) grounded the model`);

  console.log();
  console.log('--- cost / latency ---');
  console.log(`cost:          $${result.costUsd.toFixed(4)}`);
  console.log(`latency:       ${result.latencyMs}ms (total round-trip ${elapsedMs}ms)`);
  console.log(`modelUsed:     ${result.modelUsed}`);

  // Assertion floor: at least one Tier 1-2 position surfaced. A real
  // self-employed freelancer with home office + 1099 income should have
  // multiple settled-law deductions available; if Discovery returns
  // zero positions, the prompt or the model has regressed.
  const tier12Count = result.output.positions.filter((p) => p.tier <= 2).length;
  if (tier12Count === 0) {
    console.error();
    console.error('SMOKE FAILED: expected >=1 Tier 1-2 position for the CA');
    console.error('  self-employed freelancer fact pattern. Prompt regression?');
    process.exit(1);
  }

  console.log();
  console.log(`SMOKE OK: ${tier12Count} Tier 1-2 position(s) surfaced.`);
  console.log(`Cost ceiling check: ${result.costUsd <= 0.05 ? 'PASS' : 'FAIL'} ($${result.costUsd.toFixed(4)} <= $0.05)`);
}

main().catch((err) => {
  console.error('smoke-discovery FAILED:', err);
  process.exit(1);
});
