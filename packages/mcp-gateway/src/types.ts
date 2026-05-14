// MCP Gateway types — the connector contract.
//
// A connector is the Docket-side equivalent of an MCP server: it
// exposes named tools (writable actions), resources (readable data),
// and optionally requires a per-tenant credential. The Gateway routes
// calls from agents (or server actions) through the connector while
// applying multi-tenant scoping, trust-gate checks, and audit logging.
//
// V0 scope (C28):
//   - In-process connectors only. Remote-MCP transport (stdio / HTTP)
//     lands when we wire external partner MCP servers (V1.5+).
//   - Zod input schemas; runtime validation in callTool.
//   - Generic Credential typing; v1.5+ can narrow per connector.
//   - Resource handlers return MCP-shaped { contents: [...] }.
//
// Per docs/AGENT-PLATFORM.md §2.3 (Universal MCP shape).

import type { z } from 'zod';
import type { ActionClass, TenantId, UserId } from '@docket/shared';
import type { CredentialKind } from '@docket/db';

// ────────────────────────────────────────────────────────────────
// Tool context — what handlers receive at invocation time.
// ────────────────────────────────────────────────────────────────

/**
 * Runtime context passed to a tool / resource handler. Includes
 * the multi-tenant scope, the calling user, the decrypted credential
 * (if the connector required one), the calling agent (for audit
 * traceability), and a structured-logging helper that lands in the
 * audit row's tool_input.metadata.
 */
export interface ToolContext<Credential = unknown> {
  /** Tenant scope. RLS is enforced server-side; handlers should still
   *  pass tenantId into any cross-call APIs that don't auto-scope. */
  tenantId: TenantId;
  /** Calling user. Required for audit traceability. */
  userId: UserId;
  /** Client the call relates to. Same value the gateway stamps into
   *  actions.client_id, so handlers can use it for tenant-credential
   *  pulls that need per-client scope (e.g., Gmail history.list since
   *  this client's last sync) without duplicating it in input.
   *  Null for tenant-wide calls. Codex round 4 P2 (C28). */
  clientId: string | null;
  /** Decrypted credential blob if connector declares credentialKind.
   *  null when the connector is internal/public (no auth needed). */
  credential: Credential | null;
  /** Calling agent name (e.g., 'discovery-agent'); null when invoked
   *  directly from a server action or background job. */
  agentName: string | null;
  /** Structured-log hook. Anything passed is merged into the audit
   *  row's tool_input.metadata, e.g. ctx.log({ retries: 2, vendorId: 'xyz' }). */
  log: (data: Record<string, unknown>) => void;
}

// ────────────────────────────────────────────────────────────────
// Tool — a single named action.
// ────────────────────────────────────────────────────────────────

/**
 * MCP-shaped resource content. One element per chunk; type 'text'
 * is the common case, 'json' for structured payloads.
 */
export interface ResourceContent {
  type: 'text' | 'json' | 'binary-ref';
  /** Plain text content (type='text'). */
  text?: string;
  /** Structured payload (type='json'). */
  data?: unknown;
  /** Reference to a binary blob, e.g. R2 object key (type='binary-ref'). */
  ref?: string;
  /** Optional MIME type hint. */
  mimeType?: string;
}

/**
 * Tool definition. Handler is async; input is validated against
 * inputSchema before the handler fires.
 *
 * actionClass drives trust-gate enforcement:
 *   - null    = handler bypasses the gate (use for pure-read tools
 *               that have no side effects beyond logging)
 *   - 'read' / 'classify' / 'draft' / 'send-internal' / 'mutate-intake'
 *             = the gate's NEVER_GATED set; recorded but auto-passes
 *   - 'send-external' / 'mutate-tax-software' / 'file'
 *             = the gate's ALWAYS_EA set OR position-tier-bound;
 *               firm trust level may auto-pass or require approval
 */
export interface ToolDefinition<Schema extends z.ZodTypeAny = z.ZodTypeAny, Credential = unknown> {
  name: string;
  description: string;
  inputSchema: Schema;
  /** null = bypass trust gate (read-only tool). Else: gated per
   *  CLAUDE.md §8 + docs/POSITION-FRAMEWORK.md §6. */
  actionClass: ActionClass | null;
  handler: (
    input: z.infer<Schema>,
    ctx: ToolContext<Credential>,
  ) => Promise<unknown>;
}

// ────────────────────────────────────────────────────────────────
// Resource — a readable URI-addressed data source.
// ────────────────────────────────────────────────────────────────

/**
 * Resource definition. Read-only by contract (no trust-gate path).
 * uriPattern is a glob-ish prefix that the gateway matches against
 * the incoming uri; first match wins. V1.5+ can add full URI templates.
 */
export interface ResourceDefinition<Credential = unknown> {
  /** Glob-ish URI prefix, e.g. 'ledger://actions' or 'ledger://action/*'.
   *  V0 supports exact match and trailing-* wildcard. */
  uriPattern: string;
  name: string;
  description: string;
  mimeType: string;
  handler: (
    ctx: ToolContext<Credential> & { uri: string },
  ) => Promise<{ contents: ResourceContent[] }>;
}

// ────────────────────────────────────────────────────────────────
// Connector — a registered bundle of tools + resources.
// ────────────────────────────────────────────────────────────────

/**
 * A connector exposes one logical integration: 'ledger' (internal
 * audit trail), 'quickbooks' (Intuit MCP), 'gmail' (Google MCP),
 * 'olt' (browser automation), etc.
 *
 * credentialKind binds to the @docket/db tenant_credentials.kind
 * enum. Set to null for internal connectors that have no external
 * vendor auth (e.g. 'ledger', 'knowledge', 'documents').
 */
export interface ConnectorDefinition<Credential = unknown> {
  /** Stable identifier. Used by callers to route, and stamped into
   *  audit rows as agent_id. Lowercase, snake-or-kebab acceptable. */
  name: string;
  /** Human-readable summary; surfaces in /settings/connectors UI when shipped. */
  description: string;
  /** Maps to @docket/db CredentialKind, or null for internal connectors. */
  credentialKind: CredentialKind | null;
  tools: ToolDefinition<z.ZodTypeAny, Credential>[];
  resources: ResourceDefinition<Credential>[];
}

// ────────────────────────────────────────────────────────────────
// Gateway invocation shapes.
// ────────────────────────────────────────────────────────────────

export interface CallToolOptions {
  tenantId: TenantId;
  userId: UserId;
  /** Client this call relates to. Stamped into actions.client_id so
   *  the /messages/[id] activity tail + per-client audit views find
   *  the row. Required for client-scoped connector calls (Gmail,
   *  Twilio, OLT prefill, etc.). Pass null for tenant-wide calls
   *  (firm-level settings, cross-client analytics). Codex round 3 P1 (C28). */
  clientId?: string | null;
  connectorName: string;
  toolName: string;
  input: unknown;
  /** Agent that initiated the call; null for direct server-action invocations. */
  agentName?: string | null;
  /** Optional position-tier hint for trust-gate evaluation when the
   *  action class is position-bearing. */
  positionTier?: 1 | 2 | 3 | 4 | 5;
}

export interface ReadResourceOptions {
  tenantId: TenantId;
  userId: UserId;
  /** Same shape as CallToolOptions.clientId. */
  clientId?: string | null;
  connectorName: string;
  uri: string;
  agentName?: string | null;
}

export type ToolErrorCode =
  | 'UNKNOWN_CONNECTOR'
  | 'UNKNOWN_TOOL'
  | 'INVALID_INPUT'
  | 'MISSING_CREDENTIAL'
  /** getTenantCredential threw (DB outage, malformed-row decrypt failure,
   *  unexpected schema validator error). Distinct from MISSING_CREDENTIAL
   *  which signals "no row configured." Codex round 1 P1 (C28). */
  | 'CREDENTIAL_LOOKUP_FAILED'
  /** trustLevelResolver or assertTrustGate threw unexpectedly. */
  | 'TRUST_GATE_LOOKUP_FAILED'
  | 'TRUST_GATE_DENIED'
  | 'TRUST_GATE_REFUSED'
  | 'HANDLER_ERROR';

export type ResourceErrorCode =
  | 'UNKNOWN_CONNECTOR'
  | 'UNKNOWN_RESOURCE'
  | 'MISSING_CREDENTIAL'
  /** Same shape as ToolErrorCode CREDENTIAL_LOOKUP_FAILED, resource path. */
  | 'CREDENTIAL_LOOKUP_FAILED'
  | 'HANDLER_ERROR';

export type ToolResult =
  | { ok: true; output: unknown; actionId: string | null; latencyMs: number }
  | {
      ok: false;
      error: { code: ToolErrorCode; message: string; detail?: unknown };
      actionId: string | null;
      latencyMs: number;
    };

export type ResourceResult =
  | { ok: true; contents: ResourceContent[]; actionId: string | null; latencyMs: number }
  | {
      ok: false;
      error: { code: ResourceErrorCode; message: string; detail?: unknown };
      actionId: string | null;
      latencyMs: number;
    };
