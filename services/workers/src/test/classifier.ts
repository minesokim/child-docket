// Hello-world for the triage classifier.
// Feeds a Priya-style doc-mismatch signal in and expects "doc_mismatch" out.
//
// Run: pnpm --filter @docket/workers test:classifier

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../../.env.local'), override: true });

import { classifySignal } from '../agents/triage-classifier.js';
import type { TenantId, ClientId } from '@docket/shared';

async function main() {
  console.log('▸ triage-classifier hello-world');
  console.log('  signal: Priya doc_mismatch (TikTok 1099 vs intake)');
  console.log();

  const result = await classifySignal({
    signal: {
      kind: 'portal_upload',
      filename: 'TikTok_1099-NEC_2024.pdf',
      mimeType: 'application/pdf',
      uploadedAt: new Date().toISOString(),
      ocrPreview:
        'FORM 1099-NEC\nNonemployee Compensation 2024\nPayer: TikTok Inc.\nRecipient: Priya Sharma\nBox 1 Nonemployee compensation: $4,320.00',
    },
    context: {
      tenantId: 'tenant_seed_vazant' as TenantId,
      clientId: 'client_seed_priya' as ClientId,
      clientFullName: 'Priya Sharma',
      engagementType: 'return_1040',
      engagementStatus: 'prep',
      intakeAnswers: {
        income_1099_nec: 2300, // $2,300 — what Priya said in intake
        income_1099_nec_payer: 'TikTok',
      },
      recentDocs: [],
      lastInteractionDays: 0,
    },
    modelTier: 'haiku-4-5',
    onAction: async (entry) => {
      console.log(`  ▸ ${entry.toolName} (${entry.latencyMs}ms, $${entry.costUsd?.toFixed(6)})`);
    },
  });

  console.log();
  console.log('──────────────────────────────────────────────');
  console.log(`  issue type:    ${result.output.issueType}`);
  console.log(`  severity:      ${result.output.severity}`);
  console.log(`  confidence:    ${result.output.confidence}`);
  console.log();
  console.log(`  title:         ${result.output.title}`);
  console.log(`  summary:       ${result.output.summary}`);
  console.log();
  console.log(`  why:           ${result.output.whyThisMatters.slice(0, 200)}...`);
  console.log();
  console.log(`  recommended:   ${result.output.recommendedAction}`);
  console.log();
  console.log(`  sources:`);
  for (const s of result.output.sources) {
    console.log(`    - [${s.kind}] ${s.label}`);
  }
  console.log();
  console.log(`  model:         ${result.modelUsed}`);
  console.log(`  cost:          $${result.costUsd.toFixed(6)}`);
  console.log(`  latency:       ${result.latencyMs}ms`);
  console.log('──────────────────────────────────────────────');

  if (result.output.issueType !== 'doc_mismatch') {
    console.warn(`✗ expected doc_mismatch, got ${result.output.issueType}`);
    process.exit(1);
  }
  console.log('✓ classified as doc_mismatch as expected');
}

main().catch((err: unknown) => {
  // Use err.message + err.stack rather than logging the whole object —
  // Node v24 console.error blows up on certain Anthropic error objects.
  if (err instanceof Error) {
    console.error('✗ classifier hello-world failed:', err.message);
    if (err.stack) console.error(err.stack);
  } else {
    console.error('✗ classifier hello-world failed (non-Error):', String(err));
  }
  process.exit(1);
});
