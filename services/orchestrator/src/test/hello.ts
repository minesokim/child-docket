// Hello-world: verifies Claude Agent SDK substrate is wired and reachable.
// Run from repo root: pnpm --filter @docket/orchestrator test:hello

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env.local from repo root. `override: true` because the parent shell
// may have an empty ANTHROPIC_API_KEY set, which dotenv won't replace otherwise.
loadEnv({ path: path.resolve(__dirname, '../../../../.env.local'), override: true });

import { runDocketAgent } from '../docket-agent.js';
import type { TenantId } from '@docket/shared';

async function main() {
  console.log('▸ docket-orchestrator hello-world');
  console.log('  model tier: sonnet-4-6');
  console.log('  testing connection to Anthropic API...\n');

  const result = await runDocketAgent({
    tenantId: 'tenant_dev_vazant' as TenantId,
    agentId: 'morning-brief',
    systemPrompt:
      'You are a tax practice operator. Respond in one short sentence with the current date and a friendly hello.',
    userPrompt: 'Hello.',
    modelTier: 'sonnet-4-6',
    maxTokens: 200,
    cachedSystem: false,
    onAction: async (entry) => {
      console.log(`  ▸ action logged: ${entry.toolName} (${entry.latencyMs}ms, $${entry.costUsd.toFixed(6)})`);
    },
  });

  console.log('\n──────────────────────────────────────────────');
  console.log(result.text);
  console.log('──────────────────────────────────────────────');
  console.log(`  model:        ${result.modelUsed}`);
  console.log(`  input tokens: ${result.inputTokens}`);
  console.log(`  output:       ${result.outputTokens}`);
  console.log(`  cached:       ${result.cachedTokens}`);
  console.log(`  cost:         $${result.costUsd.toFixed(6)}`);
  console.log(`  latency:      ${result.latencyMs}ms`);
}

main().catch((err) => {
  console.error('✗ hello-world failed:', err);
  process.exit(1);
});
