// McpGateway — the multi-tenant routing layer for connector tool/resource calls.
//
// USAGE (from an agent or server action):
//
//   import { McpGateway } from '@docket/mcp-gateway';
//   import { ledgerConnector } from '@docket/mcp-server-ledger'; // C31
//
//   const gateway = new McpGateway();
//   gateway.register(ledgerConnector);
//
//   const result = await gateway.callTool({
//     tenantId,
//     userId,
//     connectorName: 'ledger',
//     toolName: 'query_actions',
//     input: { sinceMinutes: 60 },
//     agentName: 'discovery-agent',
//   });
//   if (result.ok) {
//     // result.output is whatever the handler returned
//   } else {
//     // result.error.code is one of ToolErrorCode
//   }
//
// CONTRACT
//   - Every callTool / readResource result includes actionId (the
//     audit-row id) and latencyMs. actionId is null only if the
//     audit INSERT itself failed (logged + Sentry).
//   - Tool handlers MUST NOT throw expected errors as exceptions;
//     they should return a documented shape. Unexpected throws are
//     caught + wrapped in HANDLER_ERROR.
//   - Trust gate fires for tools with actionClass != null. For
//     null-classed tools (pure reads), the gate is bypassed entirely.
//   - Credential lookup uses @docket/db getTenantCredential with the
//     connector's declared kind; absent credential = MISSING_CREDENTIAL
//     error; internal connectors (credentialKind=null) skip the lookup.

import { withTenant } from '@docket/db/client';
import { getTenantCredential, type CredentialKind } from '@docket/db';
import { assertTrustGate, type ActionClass } from '@docket/shared';
import { auditToolCall } from './audit.js';
import type {
  CallToolOptions,
  ConnectorDefinition,
  ReadResourceOptions,
  ResourceContent,
  ResourceErrorCode,
  ResourceResult,
  ToolErrorCode,
  ToolResult,
} from './types.js';
import type { TenantId, TrustLevel } from '@docket/shared';

/**
 * Per-tenant trust-level lookup. V0 uses a default of 1 (most
 * conservative; every gated action requires approval). V1.5 reads
 * from tenants.defaultTrustLevel (column exists per CLAUDE.md §8;
 * not yet surfaced to a settings UI).
 *
 * Caller can override via constructor to support test fixtures or
 * a future tenant-prefs cache.
 */
export type TrustLevelResolver = (tenantId: TenantId) => Promise<TrustLevel>;

/**
 * Per-tenant credential lookup. Defaults to @docket/db
 * getTenantCredential inside withTenant. Override for tests (in-
 * memory stub) or future remote-MCP transports (vault / KMS).
 */
export type CredentialResolver = (
  tenantId: TenantId,
  kind: CredentialKind,
) => Promise<unknown | null>;

const defaultTrustLevelResolver: TrustLevelResolver = async () => 1;

const defaultCredentialResolver: CredentialResolver = async (tenantId, kind) =>
  await withTenant(tenantId, async (db) =>
    getTenantCredential(db, tenantId, kind),
  );

export interface McpGatewayOptions {
  trustLevelResolver?: TrustLevelResolver;
  credentialResolver?: CredentialResolver;
}

export class McpGateway {
  private readonly registry = new Map<string, ConnectorDefinition>();
  private readonly trustLevelResolver: TrustLevelResolver;
  private readonly credentialResolver: CredentialResolver;

  constructor(options: McpGatewayOptions = {}) {
    this.trustLevelResolver =
      options.trustLevelResolver ?? defaultTrustLevelResolver;
    this.credentialResolver =
      options.credentialResolver ?? defaultCredentialResolver;
  }

  /**
   * Register a connector. Throws on duplicate name to fail-fast on
   * config errors at server startup.
   */
  register(connector: ConnectorDefinition): void {
    if (this.registry.has(connector.name)) {
      throw new Error(
        `[mcp-gateway] Connector "${connector.name}" is already registered.`,
      );
    }
    // Defensive: tool / resource name uniqueness within a connector.
    const toolNames = new Set<string>();
    for (const tool of connector.tools) {
      if (toolNames.has(tool.name)) {
        throw new Error(
          `[mcp-gateway] Connector "${connector.name}" has duplicate tool "${tool.name}".`,
        );
      }
      toolNames.add(tool.name);
    }
    const uriPatterns = new Set<string>();
    for (const resource of connector.resources) {
      if (uriPatterns.has(resource.uriPattern)) {
        throw new Error(
          `[mcp-gateway] Connector "${connector.name}" has duplicate resource pattern "${resource.uriPattern}".`,
        );
      }
      uriPatterns.add(resource.uriPattern);
    }
    this.registry.set(connector.name, connector);
  }

  /**
   * List registered connector names. Used by agents that want to
   * surface available tools in their system prompt.
   */
  list(): string[] {
    return Array.from(this.registry.keys()).sort();
  }

  /**
   * Look up a connector by name. Returns null if not registered.
   * Exposed for agents that need to introspect tool schemas before
   * invoking (e.g., to surface to Claude as available tools).
   */
  get(name: string): ConnectorDefinition | null {
    return this.registry.get(name) ?? null;
  }

  /**
   * Invoke a named tool on a registered connector. Always returns
   * a ToolResult; never throws. Audit row is written regardless of
   * success/failure.
   */
  async callTool(opts: CallToolOptions): Promise<ToolResult> {
    const startedAt = Date.now();
    const connector = this.registry.get(opts.connectorName);
    if (!connector) {
      return await this.fail({
        code: 'UNKNOWN_CONNECTOR',
        message: `Connector "${opts.connectorName}" is not registered.`,
        opts,
        toolName: opts.toolName,
        actionClass: 'read',
        startedAt,
      });
    }
    const tool = connector.tools.find((t) => t.name === opts.toolName);
    if (!tool) {
      return await this.fail({
        code: 'UNKNOWN_TOOL',
        message: `Tool "${opts.toolName}" is not exposed by connector "${opts.connectorName}".`,
        opts,
        toolName: opts.toolName,
        actionClass: 'read',
        startedAt,
      });
    }
    // Input validation. zod's safeParse keeps us off the throw path
    // for expected errors.
    const parseResult = tool.inputSchema.safeParse(opts.input);
    if (!parseResult.success) {
      return await this.fail({
        code: 'INVALID_INPUT',
        message: `Input validation failed for ${opts.connectorName}:${opts.toolName}.`,
        detail: parseResult.error.flatten(),
        opts,
        toolName: opts.toolName,
        actionClass: tool.actionClass ?? 'read',
        startedAt,
      });
    }
    const validatedInput = parseResult.data;
    const effectiveActionClass: ActionClass = tool.actionClass ?? 'read';

    // Trust gate (only when actionClass is set; null means bypass).
    // Codex round 1 P1 (C28): wrap in try/catch so a user-supplied
    // trustLevelResolver that throws (or any unexpected exception
    // from assertTrustGate) is converted to a TRUST_GATE_LOOKUP_FAILED
    // ToolResult instead of rejecting the gateway's promise. Preserves
    // the "never throws" contract + ensures audit row written.
    if (tool.actionClass !== null) {
      let decision: ReturnType<typeof assertTrustGate>;
      try {
        const trustLevel = await this.trustLevelResolver(opts.tenantId);
        decision = assertTrustGate({
          trustLevel,
          actionClass: tool.actionClass,
          ...(opts.positionTier !== undefined ? { positionTier: opts.positionTier } : {}),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return await this.fail({
          code: 'TRUST_GATE_LOOKUP_FAILED',
          message: `Trust-gate evaluation failed: ${message}`,
          opts,
          toolName: opts.toolName,
          actionClass: tool.actionClass,
          validatedInput,
          startedAt,
        });
      }
      if (!decision.allowed) {
        const code: ToolErrorCode =
          decision.requires === 'refusal'
            ? 'TRUST_GATE_REFUSED'
            : 'TRUST_GATE_DENIED';
        return await this.fail({
          code,
          message: decision.reason,
          opts,
          toolName: opts.toolName,
          actionClass: tool.actionClass,
          validatedInput,
          startedAt,
        });
      }
    }

    // Credential lookup if required. Internal connectors skip this.
    // Codex round 1 P1 (C28): wrap in try/catch. getTenantCredential
    // throws on malformed-row decrypt failures, unencrypted blobs, AAD
    // mismatch — plus any transient DB error. Without this guard,
    // credential-backed connectors would reject the gateway promise
    // instead of returning a ToolResult, breaking the "never throws"
    // contract and skipping the audit row.
    let credential: unknown = null;
    if (connector.credentialKind !== null) {
      let fetched: unknown;
      try {
        fetched = await this.credentialResolver(
          opts.tenantId,
          connector.credentialKind,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return await this.fail({
          code: 'CREDENTIAL_LOOKUP_FAILED',
          message: `Credential lookup for "${connector.credentialKind}" failed: ${message}`,
          opts,
          toolName: opts.toolName,
          actionClass: effectiveActionClass,
          validatedInput,
          startedAt,
        });
      }
      if (fetched === null) {
        return await this.fail({
          code: 'MISSING_CREDENTIAL',
          message: `Connector "${opts.connectorName}" requires "${connector.credentialKind}" credential; tenant has none configured.`,
          opts,
          toolName: opts.toolName,
          actionClass: effectiveActionClass,
          validatedInput,
          startedAt,
        });
      }
      credential = fetched;
    }

    // Build context + invoke handler. Handler exceptions become
    // HANDLER_ERROR with the exception's message preserved.
    const metadata: Record<string, unknown> = {};
    try {
      const output = await tool.handler(validatedInput, {
        tenantId: opts.tenantId,
        userId: opts.userId,
        clientId: opts.clientId ?? null,
        credential,
        agentName: opts.agentName ?? null,
        log: (data) => Object.assign(metadata, data),
      });
      const latencyMs = Date.now() - startedAt;
      const actionId = await auditToolCall({
        tenantId: opts.tenantId,
        userId: opts.userId,
        clientId: opts.clientId ?? null,
        connectorName: opts.connectorName,
        toolName: opts.toolName,
        actionClass: effectiveActionClass,
        toolInput: {
          input: validatedInput,
          ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
        },
        toolOutput: output,
        latencyMs,
        success: true,
        errorMessage: null,
        // Codex round 2 P2 (C28): leave agent_id NULL for direct
        // server-action / background-job invocations. Existing UI
        // (home-queries.ts TOOL_LABEL_HINTS lookup +
        // messages/[id]/page.tsx) treats a non-null agent_id as the
        // actor label and shows it preferentially over tool_name.
        // Stamping the connector name (e.g., 'ledger') would surface
        // as a fake agent in the activity feed. The connector identity
        // already lives in tool_name (`${connectorName}:${toolName}`).
        agentId: opts.agentName ?? null,
      });
      return { ok: true, output, actionId, latencyMs };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return await this.fail({
        code: 'HANDLER_ERROR',
        message,
        opts,
        toolName: opts.toolName,
        actionClass: effectiveActionClass,
        validatedInput,
        metadata,
        startedAt,
      });
    }
  }

  /**
   * Read a resource by URI from a registered connector. Resources
   * are read-only by contract; trust gate does not fire.
   *
   * URI matching v0:
   *   - Exact match wins first.
   *   - Else: first uriPattern ending in '*' whose prefix matches.
   */
  async readResource(opts: ReadResourceOptions): Promise<ResourceResult> {
    const startedAt = Date.now();
    const connector = this.registry.get(opts.connectorName);
    if (!connector) {
      return await this.failResource({
        code: 'UNKNOWN_CONNECTOR',
        message: `Connector "${opts.connectorName}" is not registered.`,
        opts,
        startedAt,
      });
    }
    const resource = matchResource(connector.resources, opts.uri);
    if (!resource) {
      return await this.failResource({
        code: 'UNKNOWN_RESOURCE',
        message: `No resource matches URI "${opts.uri}" in connector "${opts.connectorName}".`,
        opts,
        startedAt,
      });
    }

    let credential: unknown = null;
    if (connector.credentialKind !== null) {
      // Codex round 1 P1 (C28): same try/catch wrap as callTool —
      // credentialResolver can throw on malformed-row / decrypt /
      // DB-transient errors; wrap to preserve never-throws contract.
      let fetched: unknown;
      try {
        fetched = await this.credentialResolver(
          opts.tenantId,
          connector.credentialKind,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return await this.failResource({
          code: 'CREDENTIAL_LOOKUP_FAILED',
          message: `Credential lookup for "${connector.credentialKind}" failed: ${message}`,
          opts,
          startedAt,
          uriPattern: resource.uriPattern,
        });
      }
      if (fetched === null) {
        return await this.failResource({
          code: 'MISSING_CREDENTIAL',
          message: `Connector "${opts.connectorName}" requires "${connector.credentialKind}" credential; tenant has none configured.`,
          opts,
          startedAt,
          uriPattern: resource.uriPattern,
        });
      }
      credential = fetched;
    }

    const metadata: Record<string, unknown> = {};
    try {
      const { contents } = await resource.handler({
        tenantId: opts.tenantId,
        userId: opts.userId,
        clientId: opts.clientId ?? null,
        credential,
        agentName: opts.agentName ?? null,
        uri: opts.uri,
        log: (data) => Object.assign(metadata, data),
      });
      const latencyMs = Date.now() - startedAt;
      const actionId = await auditToolCall({
        tenantId: opts.tenantId,
        userId: opts.userId,
        clientId: opts.clientId ?? null,
        connectorName: opts.connectorName,
        toolName: `resource:${resource.uriPattern}`,
        actionClass: 'read',
        toolInput: {
          uri: opts.uri,
          ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
        },
        toolOutput: { contentsSummary: summarizeContents(contents) },
        latencyMs,
        success: true,
        errorMessage: null,
        // Codex round 2 P2 (C28): leave agent_id NULL for direct
        // server-action / background-job invocations. Existing UI
        // (home-queries.ts TOOL_LABEL_HINTS lookup +
        // messages/[id]/page.tsx) treats a non-null agent_id as the
        // actor label and shows it preferentially over tool_name.
        // Stamping the connector name (e.g., 'ledger') would surface
        // as a fake agent in the activity feed. The connector identity
        // already lives in tool_name (`${connectorName}:${toolName}`).
        agentId: opts.agentName ?? null,
      });
      return { ok: true, contents, actionId, latencyMs };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return await this.failResource({
        code: 'HANDLER_ERROR',
        message,
        opts,
        startedAt,
        metadata,
        uriPattern: resource.uriPattern,
      });
    }
  }

  // ────────────────────────────────────────────────────────────────
  // Internal: failure-path audit writers.
  // ────────────────────────────────────────────────────────────────

  private async fail(args: {
    code: ToolErrorCode;
    message: string;
    detail?: unknown;
    opts: CallToolOptions;
    toolName: string;
    actionClass: ActionClass;
    validatedInput?: unknown;
    metadata?: Record<string, unknown>;
    startedAt: number;
  }): Promise<ToolResult> {
    const latencyMs = Date.now() - args.startedAt;
    const actionId = await auditToolCall({
      tenantId: args.opts.tenantId,
      userId: args.opts.userId,
      clientId: args.opts.clientId ?? null,
      connectorName: args.opts.connectorName,
      toolName: args.toolName,
      actionClass: args.actionClass,
      toolInput: {
        input: args.validatedInput ?? args.opts.input,
        ...(args.metadata && Object.keys(args.metadata).length > 0
          ? { metadata: args.metadata }
          : {}),
        errorCode: args.code,
      },
      toolOutput: null,
      latencyMs,
      success: false,
      errorMessage: args.message,
      // Codex round 3 P2 (C28): same NULL-for-direct-invocation
      // discipline as the success path. Without this, fail()
      // would stamp 'ledger'/'gmail' as a fake agent in the
      // activity feed for any failed direct invocation.
      agentId: args.opts.agentName ?? null,
    });
    return {
      ok: false,
      error: {
        code: args.code,
        message: args.message,
        ...(args.detail !== undefined ? { detail: args.detail } : {}),
      },
      actionId,
      latencyMs,
    };
  }

  private async failResource(args: {
    code: ResourceErrorCode;
    message: string;
    opts: ReadResourceOptions;
    metadata?: Record<string, unknown>;
    startedAt: number;
    uriPattern?: string;
  }): Promise<ResourceResult> {
    const latencyMs = Date.now() - args.startedAt;
    const actionId = await auditToolCall({
      tenantId: args.opts.tenantId,
      userId: args.opts.userId,
      clientId: args.opts.clientId ?? null,
      connectorName: args.opts.connectorName,
      toolName: `resource:${args.uriPattern ?? 'unknown'}`,
      actionClass: 'read',
      toolInput: {
        uri: args.opts.uri,
        ...(args.metadata && Object.keys(args.metadata).length > 0
          ? { metadata: args.metadata }
          : {}),
        errorCode: args.code,
      },
      toolOutput: null,
      latencyMs,
      success: false,
      errorMessage: args.message,
      // Codex round 3 P2 (C28): same NULL-for-direct-invocation
      // discipline as the success path.
      agentId: args.opts.agentName ?? null,
    });
    return {
      ok: false,
      error: { code: args.code, message: args.message },
      actionId,
      latencyMs,
    };
  }
}

// ────────────────────────────────────────────────────────────────
// Helpers.
// ────────────────────────────────────────────────────────────────

function matchResource<C>(
  resources: ConnectorDefinition<C>['resources'],
  uri: string,
) {
  // Exact-match preference.
  const exact = resources.find((r) => r.uriPattern === uri);
  if (exact) return exact;
  // Prefix-glob (trailing-*).
  return resources.find((r) => {
    if (!r.uriPattern.endsWith('*')) return false;
    const prefix = r.uriPattern.slice(0, -1);
    return uri.startsWith(prefix);
  }) ?? null;
}

function summarizeContents(contents: ResourceContent[]): {
  count: number;
  types: string[];
  textPreview: string | null;
} {
  const types = Array.from(new Set(contents.map((c) => c.type))).sort();
  const firstText = contents.find((c) => c.type === 'text' && c.text)?.text;
  return {
    count: contents.length,
    types,
    textPreview: firstText ? firstText.slice(0, 200) : null,
  };
}
