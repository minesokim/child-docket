// Unit test for the Discovery agent kill-switch.
//
// Validates that runDiscovery refuses to invoke the model unless
// DISCOVERY_AGENT_ENABLED=true is set. This is the licensure-stakes
// guard against pre-knowledge-layer IRC-citation hallucination.
//
// We do NOT exercise the positive (enabled) path here because that
// would invoke Sonnet 4.6 (real cost + ANTHROPIC_API_KEY required +
// non-deterministic output). The positive path is exercised by
// services/workers/scripts/smoke-discovery.ts when the user explicitly
// opts in.

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { runDiscovery, DiscoveryAgentNotEnabledError } from './discovery-agent.js';
import { asTenantId, asClientId } from '@docket/shared';

describe('Discovery agent kill-switch', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.DISCOVERY_AGENT_ENABLED;
    delete process.env.DISCOVERY_AGENT_ENABLED;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.DISCOVERY_AGENT_ENABLED;
    else process.env.DISCOVERY_AGENT_ENABLED = originalEnv;
  });

  test('throws DiscoveryAgentNotEnabledError when env var is unset', async () => {
    let caught: unknown;
    try {
      await runDiscovery({
        input: {
          context: {
            tenantId: asTenantId('00000000-0000-0000-0000-000000000001'),
            clientId: asClientId('00000000-0000-0000-0000-000000000002'),
            trustLevel: 1,
          },
          intakeAnswers: { test: true },
        },
        modelTier: 'haiku-4-5',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DiscoveryAgentNotEnabledError);
  });

  test('throws when env var is set to "false"', async () => {
    process.env.DISCOVERY_AGENT_ENABLED = 'false';
    let caught: unknown;
    try {
      await runDiscovery({
        input: {
          context: {
            tenantId: asTenantId('00000000-0000-0000-0000-000000000001'),
            clientId: asClientId('00000000-0000-0000-0000-000000000002'),
            trustLevel: 1,
          },
          intakeAnswers: { test: true },
        },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DiscoveryAgentNotEnabledError);
  });

  test('throws when env var is set to "1" (must be exact string "true")', async () => {
    process.env.DISCOVERY_AGENT_ENABLED = '1';
    let caught: unknown;
    try {
      await runDiscovery({
        input: {
          context: {
            tenantId: asTenantId('00000000-0000-0000-0000-000000000001'),
            clientId: asClientId('00000000-0000-0000-0000-000000000002'),
            trustLevel: 1,
          },
          intakeAnswers: { test: true },
        },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DiscoveryAgentNotEnabledError);
  });

  test('error message names the licensure-stakes reason', async () => {
    let caught: unknown;
    try {
      await runDiscovery({
        input: {
          context: {
            tenantId: asTenantId('00000000-0000-0000-0000-000000000001'),
            clientId: asClientId('00000000-0000-0000-0000-000000000002'),
            trustLevel: 1,
          },
          intakeAnswers: { test: true },
        },
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(DiscoveryAgentNotEnabledError);
    const msg = (caught as Error).message;
    // Must mention citation hallucination + EA license risk + the override env var
    expect(msg).toContain('hallucinated');
    expect(msg).toContain('license');
    expect(msg).toContain('DISCOVERY_AGENT_ENABLED=true');
  });
});
