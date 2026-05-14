// MCP Gateway audit-trail writer.
//
// Every tool call AND every resource read (success or failure) gets
// one row in the `actions` table. The chain-extension trigger
// (migration 0022) stamps chain_seq + prev_hash + row_hash so the
// row participates in the cryptographic audit chain like any other
// agent action.
//
// Distinct from @docket/db's persistAgentAction (which is shaped
// for runDocketAgent's onAction callback): gateway tool calls have
// no model/token/cost data, so we INSERT directly with those columns
// nulled. The shape is otherwise identical.
//
// AUDIT FAILURE POLICY
//   If the audit INSERT fails, we log + return actionId=null on the
//   caller's result rather than masking the underlying tool outcome.
//   A failed audit row is observable in Sentry; a failed tool call
//   that was actually successful would be a worse bug.

import { sql } from 'drizzle-orm';
import { withTenant } from '@docket/db/client';
import type { ActionClass, TenantId, UserId } from '@docket/shared';

export interface AuditToolCallInput {
  tenantId: TenantId;
  userId: UserId;
  /** Client the call relates to. Null for tenant-wide calls (firm-
   *  level settings, cross-client analytics). Codex round 3 P1 (C28). */
  clientId: string | null;
  /** Connector name, stamped as agent_id for grouping in /dashboard/cost. */
  connectorName: string;
  /** Tool name within the connector. */
  toolName: string;
  /** Resolved action class; defaults to 'read' for null/resource paths. */
  actionClass: ActionClass;
  /** Validated input (post-Zod). Truncated to ~4KB by the audit trigger
   *  if oversize; jsonb tolerates large values but query perf suffers
   *  past tens of KB. */
  toolInput: Record<string, unknown>;
  /** Handler output (success path). Truncated to a textPreview for
   *  large blobs; pass undefined on the failure path. */
  toolOutput: unknown;
  latencyMs: number;
  success: boolean;
  /** Set when success=false. */
  errorMessage: string | null;
  /** Calling agent (e.g., 'discovery-agent'); null for direct invocations. */
  agentId: string | null;
}

/**
 * Write a single audit row for an MCP-gateway tool call. Returns the
 * new row id, or null if the audit INSERT itself failed (caller logs
 * + continues).
 *
 * Uses raw SQL (not Drizzle's typed insert) so we can leave
 * chain_seq/prev_hash/row_hash NULL and let the trigger fill them.
 * Same shape persistAgentAction uses.
 */
export async function auditToolCall(
  input: AuditToolCallInput,
): Promise<string | null> {
  try {
    return await withTenant(input.tenantId, async (db) => {
      // Codex round 4 P2 (C28): use safeStringify so a bigint
      // return value or a circular reference in a connector's
      // output doesn't throw inside JSON.stringify + silently
      // drop the audit row. Replacer coerces bigint → string and
      // marks already-visited objects as [Circular].
      const toolOutputJson =
        input.toolOutput === null || input.toolOutput === undefined
          ? null
          : safeStringify(truncateForAudit(input.toolOutput));
      const rows = await db.execute<{ id: string }>(sql`
        INSERT INTO actions (
          tenant_id, client_id, user_id, agent_id,
          action_class, tool_name, tool_input, tool_output,
          model_used, input_tokens, output_tokens, cached_tokens,
          cost_usd, latency_ms, success, error_message
        )
        VALUES (
          ${input.tenantId}::uuid,
          ${input.clientId}::uuid,
          ${input.userId}::uuid,
          ${input.agentId},
          ${input.actionClass}::action_class,
          ${input.connectorName + ':' + input.toolName},
          ${safeStringify(input.toolInput)}::jsonb,
          ${toolOutputJson}::jsonb,
          NULL::model_used,
          NULL,
          NULL,
          NULL,
          NULL,
          ${input.latencyMs},
          ${input.success},
          ${input.errorMessage}
        )
        RETURNING id
      `);
      const arr = rows as unknown as Array<{ id: string }>;
      return arr[0]?.id ?? null;
    });
  } catch (err) {
    // Audit-failure surface. Caller continues; row is missing.
    // eslint-disable-next-line no-console
    console.error('[mcp-gateway] auditToolCall failed', {
      tenantId: input.tenantId,
      connectorName: input.connectorName,
      toolName: input.toolName,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * JSON.stringify wrapper that handles two failure modes which would
 * otherwise drop the audit row:
 *   1. bigint values throw "Do not know how to serialize a BigInt".
 *      Replacer coerces them to strings (lossy but visible).
 *   2. Circular references throw "Converting circular structure to JSON".
 *      Replacer marks already-visited objects with a sentinel string.
 *
 * Last-resort fallback: if the replacer still throws, return a
 * sentinel JSON so the audit row goes in with a marker instead of
 * being silently dropped. Codex round 4 P2 (C28).
 */
function safeStringify(value: unknown): string {
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(value, (_key, val) => {
      if (typeof val === 'bigint') return val.toString();
      if (val !== null && typeof val === 'object') {
        if (seen.has(val as object)) return '[Circular]';
        seen.add(val as object);
      }
      return val;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return JSON.stringify({
      __auditSerializationFailed: true,
      reason: message,
    });
  }
}

/**
 * Conservative truncation for audit-row payloads. The actions table
 * is jsonb so it tolerates large values, but query latency degrades
 * past ~tens of KB per row + the dashboard reads SUM(jsonb_length).
 * Keeps a textPreview of strings; structured values pass through
 * with deep-truncation of arrays and string fields.
 */
function truncateForAudit(value: unknown, maxStringLen = 1000): unknown {
  if (typeof value === 'string') {
    return value.length > maxStringLen
      ? value.slice(0, maxStringLen) + '… [truncated]'
      : value;
  }
  if (Array.isArray(value)) {
    // Cap arrays at 50 entries; deep-truncate each
    const capped = value.slice(0, 50).map((v) => truncateForAudit(v, maxStringLen));
    if (value.length > 50) {
      capped.push(`… [${value.length - 50} more entries truncated]`);
    }
    return capped;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = truncateForAudit(v, maxStringLen);
    }
    return out;
  }
  return value;
}
