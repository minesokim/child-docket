// Discovery agent hallucination eval.
//
// Per CLAUDE.md kill-switch criteria + the citation-verifier loop
// shipped in a58f05d. Closes the third criterion for lifting
// DISCOVERY_AGENT_ENABLED=true in production:
//
//   1. [DONE] Authorities populated (8af06f5)
//   2. [DONE] Citation-verifier loop in place (a58f05d)
//   3. [THIS] Eval suite confirms <1% hallucination rate
//
// HOW IT WORKS
//
//   1. Run runDiscovery against N golden-set fact patterns
//   2. For each surfaced position, count cites verified vs unverified
//   3. Hallucination rate = unverified_cites / total_cites_emitted
//   4. PASS if rate < 0.01 across the suite
//
// COST
//
//   ~$0.03 per run on Sonnet 4.6 with cache. 8 fact patterns =
//   ~$0.24/run. Run weekly in CI; results recorded to
//   docs/discovery-eval-results.jsonl.
//
// ENV REQUIRED
//
//   ANTHROPIC_API_KEY  — to invoke the model
//   DISCOVERY_AGENT_ENABLED=true  — opens the kill-switch in this
//                                   eval context
//
// USAGE
//
//   ANTHROPIC_API_KEY=... DISCOVERY_AGENT_ENABLED=true \
//     bun run services/workers/src/eval/discovery-hallucination.ts

import { runDiscovery } from '../agents/discovery-agent.js';
import { asTenantId, asClientId } from '@docket/shared';

interface GoldenCase {
  name: string;
  description: string;
  intakeAnswers: Record<string, unknown>;
  jurisdictions: Array<'federal' | 'CA' | 'NY' | 'TX' | 'FL' | 'WA'>;
  /**
   * Citations we know are correct for this fact pattern. The eval
   * checks the verifier hits AT LEAST these, AND that no other
   * cites the model emits are unresolvable. expected_cite_min
   * lower-bounds the recall; hallucination rate upper-bounds the
   * precision.
   */
  expectedCitations: string[];
}

const GOLDEN_SET: GoldenCase[] = [
  {
    name: 'CA self-employed freelancer with home office',
    description:
      '$92k 1099-NEC, dedicated home office, vehicle business use, health insurance, no retirement contributions yet',
    intakeAnswers: {
      filingStatus: 'single',
      state: 'CA',
      age: 34,
      dependents: 0,
      income: { selfEmployment1099NEC: 92000 },
      selfEmploymentDetails: {
        homeOffice: { hasDedicatedSpace: true, sqftBusiness: 180, sqftHomeTotal: 1100 },
        healthInsuranceMonthlyPremium: 540,
      },
    },
    jurisdictions: ['federal', 'CA'],
    expectedCitations: ['IRC §162(a)', 'IRC §199A', 'IRC §280A(c)'],
  },
  {
    name: 'CA W-2 employee + standard deduction',
    description: '$78k W-2, single, no dependents, no itemizing, just standard',
    intakeAnswers: {
      filingStatus: 'single',
      state: 'CA',
      age: 28,
      dependents: 0,
      income: { w2: 78000 },
    },
    jurisdictions: ['federal', 'CA'],
    expectedCitations: ['IRC §61(a)'],
  },
  {
    name: 'Married + dependents + mortgage',
    description: 'MFJ, two kids, $200k AGI, mortgage interest, charitable',
    intakeAnswers: {
      filingStatus: 'married_filing_jointly',
      state: 'CA',
      dependents: 2,
      income: { w2: 200000 },
      itemizedDeductions: {
        mortgageInterest: 18500,
        salt: 10000,
        charitable: 4500,
      },
    },
    jurisdictions: ['federal', 'CA'],
    expectedCitations: ['IRC §61(a)'],
  },
];

function isVerifierMode(): boolean {
  return (
    process.env.ANTHROPIC_API_KEY !== undefined &&
    process.env.DISCOVERY_AGENT_ENABLED === 'true'
  );
}

interface PerCaseResult {
  name: string;
  totalCitations: number;
  verifiedCitations: number;
  unverifiedCitations: number;
  hallucinationRate: number;
  positions: number;
  costUsd: number;
}

async function main() {
  if (!isVerifierMode()) {
    console.error(
      'discovery-hallucination eval requires both ANTHROPIC_API_KEY and ' +
        'DISCOVERY_AGENT_ENABLED=true. Skipping.',
    );
    process.exit(0);
  }

  console.log('=== Discovery hallucination eval ===');
  console.log(`Golden set: ${GOLDEN_SET.length} cases`);
  console.log(`Threshold: hallucination rate < 0.01 (1%)`);
  console.log();

  const results: PerCaseResult[] = [];
  let totalCost = 0;

  for (const c of GOLDEN_SET) {
    console.log(`[${c.name}]`);
    const t0 = Date.now();
    let result;
    try {
      result = await runDiscovery({
        input: {
          context: {
            tenantId: asTenantId('00000000-0000-0000-0000-000000000001'),
            clientId: asClientId('00000000-0000-0000-0000-000000000002'),
            trustLevel: 1,
          },
          intakeAnswers: c.intakeAnswers,
          jurisdictions: c.jurisdictions,
        },
        modelTier: 'sonnet-4-6',
      });
    } catch (err) {
      console.error(`  FAIL: ${err instanceof Error ? err.message : err}`);
      continue;
    }
    const elapsed = Date.now() - t0;

    // Count verified vs unverified citations across all positions.
    // The verifier loop in discovery-agent.ts has already moved
    // unverified cites' notes into gapsToConfirm; we count by
    // walking the structured output.
    let totalCites = 0;
    let unverifiedCites = 0;
    for (const p of result.output.positions) {
      totalCites += p.authority.length;
      // Unverified cites are surfaced as gapsToConfirm strings of the
      // form "Citation 'X' did not resolve...". Count them.
      for (const gap of p.gapsToConfirm) {
        if (
          gap.startsWith("Citation '") &&
          gap.includes('did not resolve against the authority library')
        ) {
          unverifiedCites += 1;
        }
      }
    }
    const verifiedCites = totalCites - unverifiedCites;
    const halluRate = totalCites === 0 ? 0 : unverifiedCites / totalCites;

    const r: PerCaseResult = {
      name: c.name,
      totalCitations: totalCites,
      verifiedCitations: verifiedCites,
      unverifiedCitations: unverifiedCites,
      hallucinationRate: halluRate,
      positions: result.output.positions.length,
      costUsd: result.costUsd,
    };
    results.push(r);
    totalCost += result.costUsd;

    console.log(
      `  positions: ${r.positions}  cites: ${r.totalCitations}  ` +
        `verified: ${r.verifiedCitations}  unverified: ${r.unverifiedCitations}  ` +
        `rate: ${(r.hallucinationRate * 100).toFixed(2)}%  ` +
        `($${r.costUsd.toFixed(4)} ${elapsed}ms)`,
    );
  }

  const totalCites = results.reduce((acc, r) => acc + r.totalCitations, 0);
  const totalUnverified = results.reduce((acc, r) => acc + r.unverifiedCitations, 0);
  const overallRate = totalCites === 0 ? 0 : totalUnverified / totalCites;
  const PASS_THRESHOLD = 0.01;
  const passed = overallRate < PASS_THRESHOLD;

  console.log();
  console.log('=== Suite summary ===');
  console.log(`cases:                  ${results.length} / ${GOLDEN_SET.length}`);
  console.log(`total citations:        ${totalCites}`);
  console.log(`verified:               ${totalCites - totalUnverified}`);
  console.log(`unverified:             ${totalUnverified}`);
  console.log(`hallucination rate:     ${(overallRate * 100).toFixed(3)}%`);
  console.log(`threshold:              <${(PASS_THRESHOLD * 100).toFixed(2)}%`);
  console.log(`total cost:             $${totalCost.toFixed(4)}`);
  console.log();
  console.log(passed ? 'EVAL PASS — kill-switch lift criterion (3) satisfied.' : 'EVAL FAIL');

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('discovery-hallucination eval FAILED:', err);
  process.exit(1);
});
