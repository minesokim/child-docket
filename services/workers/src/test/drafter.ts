// Hello-world for the Inbox Drafter.
// Chains: triage-classifier → inbox-drafter on the same Priya doc_mismatch case.
// Verifies the end-to-end "signal in → drafted message out" path works.
//
// Run: pnpm --filter @docket/workers test:drafter

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../../.env.local'), override: true });

import { classifySignal } from '../agents/triage-classifier.js';
import { draftReply } from '../agents/inbox-drafter.js';
import type { TenantId, ClientId } from '@docket/shared';

async function main() {
  console.log('▸ end-to-end test: triage-classifier → inbox-drafter');
  console.log('  signal: Priya portal_upload with OCR\'d 1099-NEC = $4,320, intake = $2,300');
  console.log();

  // STEP 1 — classify the signal
  console.log('  [1/2] running triage-classifier (Haiku 4.5)...');
  const classified = await classifySignal({
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
        income_1099_nec: 2300,
        income_1099_nec_payer: 'TikTok',
      },
      lastInteractionDays: 0,
    },
    modelTier: 'haiku-4-5',
    onAction: async (entry) => {
      const cost = entry.costUsd?.toFixed(6) ?? '0.000000';
      console.log(`        ${entry.toolName} (${entry.latencyMs}ms, $${cost})`);
    },
  });

  console.log(`        ✓ classified: ${classified.output.issueType} (conf ${classified.output.confidence})`);
  console.log();

  // STEP 2 — draft a reply
  console.log('  [2/2] running inbox-drafter (Sonnet 4.6)...');
  const drafted = await draftReply({
    input: {
      issue: classified.output,
      context: {
        tenantId: 'tenant_seed_vazant' as TenantId,
        clientId: 'client_seed_priya' as ClientId,
        clientFullName: 'Priya Sharma',
        clientFirstName: 'Priya',
        preferredLanguage: 'en',
        channel: 'portal_chat',
        preparerFullName: 'Antonio Vazquez',
        preparerSignOff: 'Antonio',
        firmName: 'Vazant Consulting',
        originalMessage: undefined,
      },
    },
    modelTier: 'sonnet-4-6',
    onAction: async (entry) => {
      const cost = entry.costUsd?.toFixed(6) ?? '0.000000';
      console.log(`        ${entry.toolName} (${entry.latencyMs}ms, $${cost})`);
    },
  });

  console.log(`        ✓ drafted (conf ${drafted.output.confidence})`);
  console.log();

  // PRESENT
  console.log('──────────────────────────────────────────────');
  console.log('  ISSUE');
  console.log(`    type:        ${classified.output.issueType}`);
  console.log(`    severity:    ${classified.output.severity}`);
  console.log(`    title:       ${classified.output.title}`);
  console.log();
  console.log('  DRAFTED REPLY');
  console.log(`    channel:     ${drafted.output.channel}`);
  console.log(`    language:    ${drafted.output.language}`);
  console.log(`    facing:      ${drafted.output.isClientFacing ? 'client-facing' : 'INTERNAL'}`);
  if (drafted.output.subject) console.log(`    subject:     ${drafted.output.subject}`);
  console.log();
  console.log('    body:');
  for (const line of drafted.output.body.split('\n')) {
    console.log(`      ${line}`);
  }
  console.log();
  console.log(`    signature:   — ${drafted.output.signature}`);
  if (drafted.output.suggestedAttachments.length > 0) {
    console.log();
    console.log('    suggested attachments:');
    for (const a of drafted.output.suggestedAttachments) {
      console.log(`      [${a.kind}] ${a.label}`);
    }
  }
  if (drafted.output.followUpDate) {
    console.log();
    console.log(`    follow-up:   ${drafted.output.followUpDate}`);
  }
  console.log();
  console.log(`    reasoning:   ${drafted.output.reasoning}`);
  console.log();
  console.log('  COST + LATENCY');
  console.log(`    classifier:  ${classified.modelUsed}, $${classified.costUsd.toFixed(6)}, ${classified.latencyMs}ms`);
  console.log(`    drafter:     ${drafted.modelUsed}, $${drafted.costUsd.toFixed(6)}, ${drafted.latencyMs}ms`);
  console.log(`    total:       $${(classified.costUsd + drafted.costUsd).toFixed(6)}, ${classified.latencyMs + drafted.latencyMs}ms`);
  console.log('──────────────────────────────────────────────');

  // ASSERTIONS
  if (!drafted.output.isClientFacing) {
    console.warn('✗ expected client-facing draft for doc_mismatch');
    process.exit(1);
  }
  if (drafted.output.channel !== 'portal_chat') {
    console.warn(`✗ expected portal_chat channel, got ${drafted.output.channel}`);
    process.exit(1);
  }
  if (drafted.output.subject !== null) {
    console.warn(`✗ portal_chat should have null subject, got: ${drafted.output.subject}`);
    process.exit(1);
  }
  if (drafted.output.body.length < 50) {
    console.warn('✗ body too short (likely off the rails)');
    process.exit(1);
  }
  if (drafted.output.language !== 'en') {
    console.warn(`✗ expected en, got ${drafted.output.language}`);
    process.exit(1);
  }
  console.log('✓ all assertions pass');
}

main().catch((err: unknown) => {
  if (err instanceof Error) {
    console.error('✗ drafter end-to-end failed:', err.message);
    if (err.stack) console.error(err.stack);
  } else {
    console.error('✗ drafter end-to-end failed (non-Error):', String(err));
  }
  process.exit(1);
});
