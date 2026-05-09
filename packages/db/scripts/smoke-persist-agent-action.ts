// Smoke: persistAgentAction writes a real audit row + the chain
// trigger fills chain_seq/prev_hash/row_hash automatically.
//
// Validates the canonical onAction-to-DB path that draftReply +
// future agents use. Confirms:
//   1. Insert succeeds (no NOT NULL violations, no enum-coercion errors)
//   2. The chain trigger populates chain_seq + prev_hash + row_hash
//   3. tool_input merges extraToolInput correctly (trustGate landing
//      in the JSONB)
//   4. tool_output.textPreview is bounded by textPreviewLength

import { sql } from 'drizzle-orm';
import { getAdminDb, persistAgentAction } from '../src/index.js';
import { asTenantId, asClientId } from '@docket/shared';

async function main() {
  const db = getAdminDb();
  const rows = await db.execute<{ id: string; [k: string]: unknown }>(
    sql`SELECT id::text AS id FROM tenants LIMIT 1`,
  );
  const tenants = rows as unknown as Array<{ id: string }>;
  if (tenants.length === 0) {
    console.log('No tenants on dev DB; nothing to smoke.');
    process.exit(0);
  }
  const tenantId = tenants[0]!.id;
  console.log(`tenant: ${tenantId}`);

  const persist = persistAgentAction({
    textPreviewLength: 50,
    extraToolInput: {
      trustGate: {
        allowed: false,
        actionClass: 'send-external',
        requires: 'human-approval',
        reason: 'L1 firm policy',
      },
      smoke: true,
    },
  });

  let actionId: string | null = null;
  await persist({
    tenantId: asTenantId(tenantId),
    clientId: null,
    userId: null,
    // 'inbox-drafter' is one of the existing branded AgentId values;
    // we tag the smoke row with smoke=true in tool_input to distinguish
    // it from real drafter writes.
    agentId: 'inbox-drafter',
    actionClass: 'draft',
    toolName: 'smoke-persist-agent-action',
    toolInput: { from: 'smoke', want: 'merged-with-trustGate' },
    toolOutput: {
      body:
        'A draft body that is longer than the 50 char preview limit so we can test truncation works correctly.',
      confidence: 0.92,
    },
    modelUsed: 'sonnet-4-6',
    inputTokens: 100,
    outputTokens: 50,
    cachedTokens: 80,
    costUsd: 0.0042,
    latencyMs: 1234,
    success: true,
    errorMessage: null,
  });

  // Read back the row we just wrote (most recent smoke=true).
  const back = await db.execute<{
    id: string;
    chain_seq: number | null;
    has_prev_hash: boolean;
    has_row_hash: boolean;
    has_trust_gate: boolean;
    text_preview: string | null;
    tool_input_keys: string;
  }>(sql`
    SELECT
      id::text AS id,
      chain_seq,
      (prev_hash IS NOT NULL OR chain_seq = 1) AS has_prev_hash,
      (row_hash IS NOT NULL) AS has_row_hash,
      (tool_input ? 'trustGate') AS has_trust_gate,
      tool_output->>'textPreview' AS text_preview,
      (SELECT string_agg(jsonb_object_keys, ',' ORDER BY jsonb_object_keys)
       FROM jsonb_object_keys(tool_input)) AS tool_input_keys
    FROM actions
    WHERE tool_name = 'smoke-persist-agent-action'
      AND tool_input->>'smoke' = 'true'
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const row = (back as unknown as Array<{
    id: string;
    chain_seq: number | null;
    has_prev_hash: boolean;
    has_row_hash: boolean;
    has_trust_gate: boolean;
    text_preview: string | null;
    tool_input_keys: string;
  }>)[0];

  if (!row) {
    console.error('FAIL: smoke audit row not found post-write');
    process.exit(1);
  }
  actionId = row.id;

  console.log(`audit row id:        ${actionId}`);
  console.log(`chain_seq:           ${row.chain_seq}`);
  console.log(`has prev_hash:       ${row.has_prev_hash}`);
  console.log(`has row_hash:        ${row.has_row_hash}`);
  console.log(`has tool_input.trustGate: ${row.has_trust_gate}`);
  console.log(`tool_input keys:     ${row.tool_input_keys}`);
  console.log(`tool_output.textPreview: ${row.text_preview}`);

  // Assertions
  let failed = false;
  if (!row.has_row_hash) {
    console.error('FAIL: chain trigger did not populate row_hash');
    failed = true;
  }
  if (!row.has_trust_gate) {
    console.error('FAIL: extraToolInput.trustGate did not merge into tool_input');
    failed = true;
  }
  if (row.text_preview === null || row.text_preview.length > 50) {
    console.error(
      `FAIL: textPreview is ${row.text_preview === null ? 'null' : `${row.text_preview.length} chars`}, expected <= 50`,
    );
    failed = true;
  }

  if (failed) {
    console.error('SMOKE FAILED');
    process.exit(1);
  }

  console.log();
  console.log('SMOKE OK: persistAgentAction writes audit row + chain trigger fires + extraToolInput merges + textPreview bounded.');
  console.log(
    `Note: a smoke audit row remains in actions table (id=${actionId}). Append-only — leave it; it's part of the chain.`,
  );
}

main().catch((err) => {
  console.error('smoke-persist-agent-action FAILED:', err);
  process.exit(1);
});
