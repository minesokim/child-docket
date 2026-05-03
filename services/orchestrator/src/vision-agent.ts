// Vision-enabled agent runner.
//
// Same shape as runDocketAgent but takes one or more images as input
// (Anthropic content blocks of type 'image'). Used by the doc
// classification worker to send PDF page images / photos / scans to
// Haiku 4.5 vision and get back structured JSON.
//
// MODEL TIER
//   Default: haiku-4-5. Per CLAUDE.md §6 model tiering, doc classification
//   is the canonical Haiku case — fast, cheap, structured output. Promote
//   to Sonnet only when Haiku confidence drops below the agent's threshold.
//
// COST TELEMETRY + AUDIT
//   Same onAction hook as runDocketAgent. Caller wires it to the
//   `actions` table for per-tool-call cost + latency tracking. Without
//   the hook, costs aren't logged but the call still works (used in
//   tests).
//
// IMAGE INPUT
//   Two shapes supported:
//     - { kind: 'base64', data, mediaType }  — raw bytes, encoded inline
//     - { kind: 'url', url }                  — public/presigned URL
//   Anthropic's API supports both. We use base64 for R2-hosted documents
//   (since R2 presigned URLs aren't long-lived enough for a model that
//   might see retries; also keeps the bytes off the open internet).

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

/**
 * One image source. `base64` is preferred for non-public bytes (R2
 * presigned URLs would work but expire fast and leak a URL into the
 * model's prompt context).
 */
export type VisionImageInput =
  | {
      kind: 'base64';
      /** Raw base64-encoded image bytes (no data: prefix). */
      data: string;
      /** Standard MIME — image/png | image/jpeg | image/webp | image/gif | application/pdf */
      mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'application/pdf';
    }
  | {
      kind: 'url';
      url: string;
    };

export type VisionAgentOptions = {
  tenantId: TenantId;
  agentId: AgentId;
  systemPrompt: string;
  /**
   * Text portion of the user message. The images come along separately
   * — the API stitches `[image, image, ..., text]` into one user turn.
   */
  userPrompt: string;
  images: VisionImageInput[];
  modelTier?: ModelTier;
  maxTokens?: number;
  cachedSystem?: boolean;
  onAction?: (entry: Omit<ActionLogEntry, 'id' | 'createdAt'>) => Promise<void>;
};

export type VisionAgentResult = {
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

export async function runVisionAgent(opts: VisionAgentOptions): Promise<VisionAgentResult> {
  const tier: ModelTier = opts.modelTier ?? 'haiku-4-5';
  const start = Date.now();

  const systemBlock = opts.cachedSystem
    ? [{ type: 'text' as const, text: opts.systemPrompt, cache_control: { type: 'ephemeral' as const } }]
    : opts.systemPrompt;

  // Stitch the user turn: [image1, image2, ..., text]. The text block
  // anchors the question. Order matters — Anthropic recommends images
  // first, instructions last, so the model has the visual context
  // before the prompt that asks about it.
  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    ...opts.images.map(toContentBlock),
    { type: 'text' as const, text: opts.userPrompt },
  ];

  const response = await client().messages.create({
    model: MODEL_IDS[tier],
    max_tokens: opts.maxTokens ?? 1024,
    system: systemBlock,
    messages: [{ role: 'user', content: userContent }],
  });

  const latencyMs = Date.now() - start;
  const usage = response.usage;
  const inputTokens = usage.input_tokens;
  const outputTokens = usage.output_tokens;
  const cachedTokens =
    (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);

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
      actionClass: 'classify',
      toolName: 'anthropic.vision.messages.create',
      toolInput: {
        model: MODEL_IDS[tier],
        maxTokens: opts.maxTokens ?? 1024,
        imageCount: opts.images.length,
      },
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

function toContentBlock(image: VisionImageInput): Anthropic.Messages.ContentBlockParam {
  if (image.kind === 'base64') {
    if (image.mediaType === 'application/pdf') {
      // Anthropic supports PDFs as a separate `document` block type.
      return {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: image.data,
        },
      };
    }
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mediaType,
        data: image.data,
      },
    };
  }
  // URL form (image only — PDFs via URL aren't broadly supported yet).
  return {
    type: 'image',
    source: {
      type: 'url',
      url: image.url,
    },
  };
}
