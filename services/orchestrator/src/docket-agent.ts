// Thin Docket layer over the Anthropic SDK.
// v0: minimal — single agent run, audit-trail hook stub, model tiering, cost telemetry.
// Adds: trust-escalation gate, MCP tool routing, sub-agents (later).

import Anthropic from '@anthropic-ai/sdk';
import type { ActionLogEntry, AgentId, TenantId } from '@docket/shared';

const PRICING = {
  'haiku-4-5':  { input: 0.80,  output: 4.00,  cached: 0.08 },
  'sonnet-4-6': { input: 3.00,  output: 15.00, cached: 0.30 },
  'opus-4-7':   { input: 15.00, output: 75.00, cached: 1.50 },
} as const;

type ModelTier = keyof typeof PRICING;

const MODEL_IDS: Record<ModelTier, string> = {
  'haiku-4-5':  'claude-haiku-4-5-20251001',
  'sonnet-4-6': 'claude-sonnet-4-6',
  'opus-4-7':   'claude-opus-4-7',
};

export type DocketAgentOptions = {
  tenantId: TenantId;
  agentId: AgentId;
  systemPrompt: string;
  userPrompt: string;
  modelTier?: ModelTier;
  maxTokens?: number;
  cachedSystem?: boolean;
  onAction?: (entry: Omit<ActionLogEntry, 'id' | 'createdAt'>) => Promise<void>;
};

export type DocketAgentResult = {
  text: string;
  modelUsed: ModelTier;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
  latencyMs: number;
};

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  _client = new Anthropic({ apiKey });
  return _client;
}

export async function runDocketAgent(opts: DocketAgentOptions): Promise<DocketAgentResult> {
  const tier: ModelTier = opts.modelTier ?? 'sonnet-4-6';
  const start = Date.now();

  const systemBlock = opts.cachedSystem
    ? [{ type: 'text' as const, text: opts.systemPrompt, cache_control: { type: 'ephemeral' as const } }]
    : opts.systemPrompt;

  const response = await client().messages.create({
    model: MODEL_IDS[tier],
    max_tokens: opts.maxTokens ?? 1024,
    system: systemBlock,
    messages: [{ role: 'user', content: opts.userPrompt }],
  });

  const latencyMs = Date.now() - start;
  const usage = response.usage;
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const cachedTokens = (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);

  const pricing = PRICING[tier];
  const costUsd =
    ((inputTokens - (usage.cache_read_input_tokens ?? 0)) * pricing.input) / 1_000_000 +
    ((usage.cache_read_input_tokens ?? 0) * pricing.cached) / 1_000_000 +
    (outputTokens * pricing.output) / 1_000_000;

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  if (opts.onAction) {
    await opts.onAction({
      tenantId: opts.tenantId,
      clientId: null,
      userId: null,
      agentId: opts.agentId,
      actionClass: 'read',
      toolName: 'anthropic.messages.create',
      toolInput: { model: MODEL_IDS[tier], maxTokens: opts.maxTokens ?? 1024 },
      toolOutput: { textPreview: text.slice(0, 200) },
      modelUsed: tier,
      inputTokens,
      outputTokens,
      cachedTokens,
      costUsd,
      latencyMs,
      success: true,
      errorMessage: null,
    });
  }

  return { text, modelUsed: tier, inputTokens, outputTokens, cachedTokens, costUsd, latencyMs };
}
