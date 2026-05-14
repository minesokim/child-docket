// MCP Gateway unit tests.
//
// Strategy: exercise the gateway against in-memory connectors that
// don't require real DB access. The audit-write path is mocked at
// the module level (auditToolCall returns a stub id) so we avoid
// needing a live Postgres for every assertion.
//
// What's covered:
//   - register() duplicate detection
//   - register() duplicate tool / resource within a connector
//   - callTool happy path with read-only tool (bypasses trust gate)
//   - callTool: unknown connector → UNKNOWN_CONNECTOR
//   - callTool: unknown tool → UNKNOWN_TOOL
//   - callTool: input fails Zod → INVALID_INPUT with detail
//   - callTool: trust gate denial (trustLevel=1, actionClass='send-external')
//   - callTool: handler throws → HANDLER_ERROR captured
//   - callTool: log() metadata threads into audit input
//   - readResource: exact-match URI
//   - readResource: trailing-wildcard URI
//   - readResource: unknown URI → UNKNOWN_RESOURCE
//   - list() returns sorted connector names
//
// What's NOT covered (intentional v0):
//   - Real DB integration; audit-row chain insertion. That's an
//     /e2e smoke once C31 ledger MCP ships.
//   - Credential lookup with a real tenant_credentials row. Stubbed.

import { describe, expect, test, mock } from 'bun:test';
import { z } from 'zod';
import type { TenantId, UserId } from '@docket/shared';
import type { ConnectorDefinition, ToolContext } from '../src/types.js';

// Mock the audit writer + tenant-credential lookup BEFORE importing
// the gateway so the gateway picks up the stubs.
const auditCalls: Array<Record<string, unknown>> = [];

mock.module('../src/audit.ts', () => ({
  auditToolCall: async (input: Record<string, unknown>) => {
    auditCalls.push(input);
    return 'stub-audit-id-' + auditCalls.length;
  },
}));

// Stub @docket/db's getTenantCredential + withTenant. The gateway's
// trust-gate path doesn't touch the DB at all for null-credentialKind
// connectors. We test the credential-required path separately below.
mock.module('@docket/db', () => ({
  getTenantCredential: async () => ({
    accountSid: 'AC_STUB',
    authToken: 'STUB',
    fromNumber: '+15555550100',
  }),
}));
mock.module('@docket/db/client', () => ({
  withTenant: async <T>(_tenantId: string, fn: (db: unknown) => Promise<T>): Promise<T> =>
    fn({}),
}));

// Runtime import AFTER mocks are installed.
const { McpGateway } = await import('../src/gateway.js');

const TENANT_A = '11111111-1111-1111-1111-111111111111' as TenantId;
const USER_A = '22222222-2222-2222-2222-222222222222' as UserId;

// ────────────────────────────────────────────────────────────────
// Test fixtures: in-memory connectors.
// ────────────────────────────────────────────────────────────────

function makeReadOnlyConnector(): ConnectorDefinition {
  return {
    name: 'test-ledger',
    description: 'Test connector with read-only tools',
    credentialKind: null,
    tools: [
      {
        name: 'echo',
        description: 'Echoes back the input',
        inputSchema: z.object({ value: z.string() }),
        actionClass: null,
        handler: async (input: unknown) => {
          const { value } = input as { value: string };
          return { echoed: value };
        },
      },
      {
        name: 'with-log',
        description: 'Tool that calls ctx.log to inject metadata',
        inputSchema: z.object({}),
        actionClass: null,
        handler: async (_input: unknown, ctx: ToolContext) => {
          ctx.log({ probed: true, count: 3 });
          return { ok: true };
        },
      },
      {
        name: 'thrower',
        description: 'Always throws',
        inputSchema: z.object({}),
        actionClass: null,
        handler: async () => {
          throw new Error('synthetic failure');
        },
      },
    ],
    resources: [
      {
        uriPattern: 'test-ledger://hello',
        name: 'hello',
        description: 'Greeting',
        mimeType: 'text/plain',
        handler: async () => ({
          contents: [{ type: 'text', text: 'hi there' }],
        }),
      },
      {
        uriPattern: 'test-ledger://items/*',
        name: 'item',
        description: 'Item by id',
        mimeType: 'application/json',
        handler: async (ctx) => ({
          contents: [{ type: 'json', data: { uri: ctx.uri } }],
        }),
      },
    ],
  };
}

function makeGatedConnector(): ConnectorDefinition {
  return {
    name: 'test-external',
    description: 'Test connector with a send-external tool',
    credentialKind: null,
    tools: [
      {
        name: 'send',
        description: 'Sends external (gated)',
        inputSchema: z.object({ to: z.string().email() }),
        actionClass: 'send-external',
        handler: async (input: unknown) => {
          const { to } = input as { to: string };
          return { sent: to };
        },
      },
    ],
    resources: [],
  };
}

// ────────────────────────────────────────────────────────────────
// Tests.
// ────────────────────────────────────────────────────────────────

describe('McpGateway.register', () => {
  test('rejects duplicate connector name', () => {
    const gw = new McpGateway();
    gw.register(makeReadOnlyConnector());
    expect(() => gw.register(makeReadOnlyConnector())).toThrow(/already registered/);
  });

  test('rejects connector with duplicate tool names', () => {
    const gw = new McpGateway();
    const bad = makeReadOnlyConnector();
    bad.tools.push({
      name: 'echo',
      description: 'dup',
      inputSchema: z.object({}),
      actionClass: null,
      handler: async () => ({}),
    });
    expect(() => gw.register(bad)).toThrow(/duplicate tool/);
  });

  test('rejects connector with duplicate resource patterns', () => {
    const gw = new McpGateway();
    const bad = makeReadOnlyConnector();
    bad.resources.push({
      uriPattern: 'test-ledger://hello',
      name: 'dup',
      description: 'dup',
      mimeType: 'text/plain',
      handler: async () => ({ contents: [] }),
    });
    expect(() => gw.register(bad)).toThrow(/duplicate resource/);
  });

  test('list() returns sorted connector names', () => {
    const gw = new McpGateway();
    gw.register({ ...makeReadOnlyConnector(), name: 'zeta' });
    gw.register({ ...makeReadOnlyConnector(), name: 'alpha' });
    expect(gw.list()).toEqual(['alpha', 'zeta']);
  });
});

describe('McpGateway.callTool', () => {
  test('happy path: read-only tool returns output + audit id', async () => {
    auditCalls.length = 0;
    const gw = new McpGateway();
    gw.register(makeReadOnlyConnector());
    const result = await gw.callTool({
      tenantId: TENANT_A,
      userId: USER_A,
      connectorName: 'test-ledger',
      toolName: 'echo',
      input: { value: 'hello' },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output).toEqual({ echoed: 'hello' });
      expect(result.actionId).toBe('stub-audit-id-1');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    }
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]?.success).toBe(true);
    expect(auditCalls[0]?.toolName).toBe('echo');
  });

  test('unknown connector → UNKNOWN_CONNECTOR', async () => {
    auditCalls.length = 0;
    const gw = new McpGateway();
    const result = await gw.callTool({
      tenantId: TENANT_A,
      userId: USER_A,
      connectorName: 'missing',
      toolName: 'whatever',
      input: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNKNOWN_CONNECTOR');
    }
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]?.success).toBe(false);
  });

  test('unknown tool on registered connector → UNKNOWN_TOOL', async () => {
    auditCalls.length = 0;
    const gw = new McpGateway();
    gw.register(makeReadOnlyConnector());
    const result = await gw.callTool({
      tenantId: TENANT_A,
      userId: USER_A,
      connectorName: 'test-ledger',
      toolName: 'missing',
      input: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNKNOWN_TOOL');
    }
    expect(auditCalls).toHaveLength(1);
  });

  test('invalid input → INVALID_INPUT with zod detail', async () => {
    auditCalls.length = 0;
    const gw = new McpGateway();
    gw.register(makeReadOnlyConnector());
    const result = await gw.callTool({
      tenantId: TENANT_A,
      userId: USER_A,
      connectorName: 'test-ledger',
      toolName: 'echo',
      input: { value: 12345 }, // wrong type — schema wants string
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_INPUT');
      expect(result.error.detail).toBeDefined();
    }
  });

  test('trust gate denies send-external at trust level 1', async () => {
    auditCalls.length = 0;
    const gw = new McpGateway();
    gw.register(makeGatedConnector());
    const result = await gw.callTool({
      tenantId: TENANT_A,
      userId: USER_A,
      connectorName: 'test-external',
      toolName: 'send',
      input: { to: 'a@b.com' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(['TRUST_GATE_DENIED', 'TRUST_GATE_REFUSED']).toContain(result.error.code);
    }
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]?.success).toBe(false);
  });

  test('handler throw → HANDLER_ERROR with message preserved', async () => {
    auditCalls.length = 0;
    const gw = new McpGateway();
    gw.register(makeReadOnlyConnector());
    const result = await gw.callTool({
      tenantId: TENANT_A,
      userId: USER_A,
      connectorName: 'test-ledger',
      toolName: 'thrower',
      input: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('HANDLER_ERROR');
      expect(result.error.message).toContain('synthetic failure');
    }
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]?.success).toBe(false);
    expect(auditCalls[0]?.errorMessage).toContain('synthetic failure');
  });

  test('ctx.log() metadata threads into audit row tool_input', async () => {
    auditCalls.length = 0;
    const gw = new McpGateway();
    gw.register(makeReadOnlyConnector());
    const result = await gw.callTool({
      tenantId: TENANT_A,
      userId: USER_A,
      connectorName: 'test-ledger',
      toolName: 'with-log',
      input: {},
    });
    expect(result.ok).toBe(true);
    const audit = auditCalls[0]!;
    const toolInput = audit.toolInput as Record<string, unknown>;
    expect(toolInput.metadata).toEqual({ probed: true, count: 3 });
  });
});

describe('McpGateway pre-handler error wrapping (codex r1 P1)', () => {
  test('trust resolver throw → TRUST_GATE_LOOKUP_FAILED, not rejected promise', async () => {
    auditCalls.length = 0;
    const gw = new McpGateway({
      trustLevelResolver: async () => {
        throw new Error('trust db offline');
      },
    });
    gw.register(makeGatedConnector());
    // Must NOT throw — must return a typed ToolResult per "never throws" contract.
    const result = await gw.callTool({
      tenantId: TENANT_A,
      userId: USER_A,
      connectorName: 'test-external',
      toolName: 'send',
      input: { to: 'a@b.com' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('TRUST_GATE_LOOKUP_FAILED');
      expect(result.error.message).toContain('trust db offline');
    }
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]?.success).toBe(false);
  });

  test('credential lookup throw → CREDENTIAL_LOOKUP_FAILED, audit row written', async () => {
    auditCalls.length = 0;
    const gw = new McpGateway({
      credentialResolver: async () => {
        throw new Error('malformed encrypted row');
      },
    });
    gw.register({
      name: 'test-with-cred',
      description: 'connector that requires a credential',
      credentialKind: 'twilio',
      tools: [
        {
          name: 'noop',
          description: 'no-op',
          inputSchema: z.object({}),
          actionClass: null,
          handler: async () => ({ ok: true }),
        },
      ],
      resources: [],
    });
    const result = await gw.callTool({
      tenantId: TENANT_A,
      userId: USER_A,
      connectorName: 'test-with-cred',
      toolName: 'noop',
      input: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CREDENTIAL_LOOKUP_FAILED');
      expect(result.error.message).toContain('malformed');
    }
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]?.success).toBe(false);
  });

  test('credential resolver returns null → MISSING_CREDENTIAL (distinct from lookup-failed)', async () => {
    auditCalls.length = 0;
    const gw = new McpGateway({
      credentialResolver: async () => null,
    });
    gw.register({
      name: 'test-no-cred',
      description: 'connector with no credential row',
      credentialKind: 'twilio',
      tools: [
        {
          name: 'noop',
          description: 'no-op',
          inputSchema: z.object({}),
          actionClass: null,
          handler: async () => ({ ok: true }),
        },
      ],
      resources: [],
    });
    const result = await gw.callTool({
      tenantId: TENANT_A,
      userId: USER_A,
      connectorName: 'test-no-cred',
      toolName: 'noop',
      input: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('MISSING_CREDENTIAL');
    }
  });

  test('readResource credential resolver throw → CREDENTIAL_LOOKUP_FAILED', async () => {
    auditCalls.length = 0;
    const gw = new McpGateway({
      credentialResolver: async () => {
        throw new Error('decrypt failed');
      },
    });
    gw.register({
      name: 'test-cred-resource',
      description: 'connector with a cred-required resource',
      credentialKind: 'twilio',
      tools: [],
      resources: [
        {
          uriPattern: 'test-cred-resource://thing',
          name: 'thing',
          description: 't',
          mimeType: 'text/plain',
          handler: async () => ({ contents: [] }),
        },
      ],
    });
    const result = await gw.readResource({
      tenantId: TENANT_A,
      userId: USER_A,
      connectorName: 'test-cred-resource',
      uri: 'test-cred-resource://thing',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CREDENTIAL_LOOKUP_FAILED');
    }
  });
});

describe('McpGateway.readResource', () => {
  test('exact-match URI returns contents', async () => {
    auditCalls.length = 0;
    const gw = new McpGateway();
    gw.register(makeReadOnlyConnector());
    const result = await gw.readResource({
      tenantId: TENANT_A,
      userId: USER_A,
      connectorName: 'test-ledger',
      uri: 'test-ledger://hello',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contents).toEqual([{ type: 'text', text: 'hi there' }]);
    }
  });

  test('wildcard URI prefix match passes the full URI to handler', async () => {
    auditCalls.length = 0;
    const gw = new McpGateway();
    gw.register(makeReadOnlyConnector());
    const result = await gw.readResource({
      tenantId: TENANT_A,
      userId: USER_A,
      connectorName: 'test-ledger',
      uri: 'test-ledger://items/abc123',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contents).toEqual([
        { type: 'json', data: { uri: 'test-ledger://items/abc123' } },
      ]);
    }
  });

  test('unmatched URI → UNKNOWN_RESOURCE', async () => {
    auditCalls.length = 0;
    const gw = new McpGateway();
    gw.register(makeReadOnlyConnector());
    const result = await gw.readResource({
      tenantId: TENANT_A,
      userId: USER_A,
      connectorName: 'test-ledger',
      uri: 'test-ledger://nope/123',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNKNOWN_RESOURCE');
    }
  });

  test('unknown connector → UNKNOWN_CONNECTOR', async () => {
    auditCalls.length = 0;
    const gw = new McpGateway();
    const result = await gw.readResource({
      tenantId: TENANT_A,
      userId: USER_A,
      connectorName: 'missing',
      uri: 'missing://x',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNKNOWN_CONNECTOR');
    }
  });
});
