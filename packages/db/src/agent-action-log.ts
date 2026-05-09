// Agent action audit-trail persistence.
//
// Canonical onAction handler for runDocketAgent. Every production
// agent invocation should pass `persistAgentAction(extra)` (or a
// composed wrapper) so the action row lands in the audit table —
// which is what powers:
//   - cost dashboard rollups (/dashboard/cost reads SUM(cost_usd))
//   - audit-chain verification (verify-actions-chain cron)
//   - trust-gate verdict surface (inbox UI badges read tool_input.trustGate)
//   - retroactive prompt-version regression analysis
//
// USAGE
//
//   import { persistAgentAction } from '@docket/db';
//   await runDocketAgent({
//     ...,
//     onAction: persistAgentAction({
//       extraToolInput: { trustGate: drafted.trustGate },
//       textPreviewLength: 300,
//     }),
//   });
//
// Or for the simplest case (no extra payload, default preview):
//   onAction: persistAgentAction(),
//
// THREAD MODEL / TENANT SCOPING
//
// The action row is written via withTenant(entry.tenantId) so RLS
// scopes correctly even if the caller is in admin context. The
// chain-extension trigger (migration 0022) fires on insert and
// stamps chain_seq + prev_hash + row_hash automatically.

import { sql } from 'drizzle-orm';
import { withTenant } from './client.js';
import { schema } from './client.js';
import type { ActionLogEntry } from '@docket/shared';

export interface PersistAgentActionOptions {
  /**
   * Extra fields merged into the row's tool_input JSONB. Used for
   * agent-specific metadata that isn't on the base ActionLogEntry,
   * e.g. inbox-drafter passes { trustGate: { allowed, requires?, reason? } }.
   */
  extraToolInput?: Record<string, unknown>;
  /**
   * Max chars of text to preserve in tool_output.textPreview. Default
   * 200 (matches the orchestrator's onAction stub). Pass 0 to skip
   * the preview field entirely.
   */
  textPreviewLength?: number;
  /**
   * Hook invoked AFTER the row write succeeds with the new row id.
   * Useful for the caller to update `issues.draft_action_id` or
   * similar foreign-key fields. Failure here does NOT roll back the
   * action insert.
   */
  onPersisted?: (actionId: string) => Promise<void>;
}

type OnActionEntry = Omit<ActionLogEntry, 'id' | 'createdAt'>;

/**
 * Returns an onAction handler suitable for runDocketAgent.
 * The handler writes the action row inside withTenant(entry.tenantId)
 * so RLS + chain-extension trigger fire correctly.
 */
export function persistAgentAction(opts: PersistAgentActionOptions = {}) {
  const previewLength = opts.textPreviewLength ?? 200;

  return async (entry: OnActionEntry): Promise<void> => {
    const baseToolInput =
      typeof entry.toolInput === 'object' && entry.toolInput !== null
        ? (entry.toolInput as Record<string, unknown>)
        : {};
    const mergedToolInput = {
      ...baseToolInput,
      ...(opts.extraToolInput ?? {}),
    };

    // tool_output may already have a textPreview; if not, compose one
    // from any string-shaped fields. Length-bound to avoid bloat in
    // the audit table.
    let toolOutput = entry.toolOutput;
    if (
      previewLength > 0 &&
      toolOutput &&
      typeof toolOutput === 'object' &&
      !('textPreview' in toolOutput)
    ) {
      const guess =
        (toolOutput as Record<string, unknown>).text ??
        (toolOutput as Record<string, unknown>).body ??
        (toolOutput as Record<string, unknown>).content;
      if (typeof guess === 'string') {
        toolOutput = {
          ...(toolOutput as Record<string, unknown>),
          textPreview: guess.slice(0, previewLength),
        };
      }
    }

    let newId: string | null = null;

    await withTenant(entry.tenantId, async (db) => {
      // Use raw INSERT (not drizzle's typed insert) so we can write
      // chainSeq/prevHash/rowHash columns as nulls and let the trigger
      // fill them. The trigger expects them to be NULL on insert.
      const rows = await db.execute<{ id: string }>(sql`
        INSERT INTO actions (
          tenant_id, client_id, user_id, agent_id,
          action_class, tool_name, tool_input, tool_output,
          model_used, input_tokens, output_tokens, cached_tokens,
          cost_usd, latency_ms, success, error_message
        )
        VALUES (
          ${entry.tenantId}::uuid,
          ${entry.clientId ?? null}::uuid,
          ${entry.userId ?? null}::uuid,
          ${entry.agentId ?? null},
          ${entry.actionClass}::action_class,
          ${entry.toolName},
          ${JSON.stringify(mergedToolInput)}::jsonb,
          ${toolOutput === null || toolOutput === undefined
            ? null
            : JSON.stringify(toolOutput)}::jsonb,
          ${entry.modelUsed ?? null}::model_used,
          ${entry.inputTokens ?? null},
          ${entry.outputTokens ?? null},
          ${entry.cachedTokens ?? null},
          ${entry.costUsd ?? null},
          ${entry.latencyMs},
          ${entry.success},
          ${entry.errorMessage ?? null}
        )
        RETURNING id::text AS id
      `);
      const result = rows as unknown as Array<{ id: string }>;
      newId = result[0]?.id ?? null;
    });

    if (newId && opts.onPersisted) {
      try {
        await opts.onPersisted(newId);
      } catch (err) {
        // Don't surface — the audit row is already written; the
        // post-write hook is best-effort. Log via console; production
        // wires Sentry to capture.
        console.error('[persistAgentAction] onPersisted hook failed:', err);
      }
    }
  };
}
