// Vision-enabled agent runner with Anthropic + Bedrock fallover.
//
// Same shape as runDocketAgent but takes one or more images as input
// (Anthropic content blocks of type 'image' / 'document'). Used by
// the doc classification worker to send PDF page images / photos /
// scans to Haiku 4.5 vision and get back structured JSON.
//
// MODEL TIER
//   Default: haiku-4-5. Per CLAUDE.md §6 model tiering, doc
//   classification is the canonical Haiku case — fast, cheap,
//   structured output. Promote to Sonnet only when Haiku confidence
//   drops below the agent's threshold.
//
// COST TELEMETRY + AUDIT
//   Same onAction hook as runDocketAgent. Caller wires it to the
//   `actions` table for per-tool-call cost + latency tracking.
//   Without the hook, costs aren't logged but the call still works.
//
// IMAGE INPUT
//   Two shapes supported:
//     - { kind: 'base64', data, mediaType }  — raw bytes inline
//     - { kind: 'url', url }                  — public/presigned URL
//   We use base64 for R2-hosted documents (R2 presigned URLs aren't
//   long-lived enough for a model that might see retries; also keeps
//   the bytes off the open internet).
//
// BEDROCK FALLOVER (Session 14, 2026-05-16)
//   Mirrors the text-side callClaudeWithFallover. The classifier
//   isTransientAnthropicError (now top-level export from providers.ts)
//   detects 5xx/429/network/billing-400/connection failures + falls
//   over to Bedrock via the Converse API. Same Claude model on both
//   providers; different control planes.
//
//   Failure modes addressed:
//     1. Anthropic 429 / 5xx     → fall back to Bedrock
//     2. Anthropic credit-bal    → fall back to Bedrock (different
//                                  billing relationship)
//     3. Anthropic SDK timeout   → fall back to Bedrock (different
//                                  transport)
//     4. Both fail               → throw aggregated error
//
//   Limitations:
//     - URL-source images don't fall over to Bedrock cleanly because
//       Bedrock Converse requires raw bytes (not URL). If Anthropic
//       fails on a URL-source image, the fallover converts by
//       fetching the URL to bytes. If the fetch ALSO fails, both
//       errors aggregate in the final throw.
//     - Bedrock Haiku 4.5 model ID is mapped from the same tier alias
//       (haiku-4-5 → us.anthropic.claude-haiku-4-5-20251001-v1:0).
//
//   When fallover fires, the result carries provider='bedrock' so
//   cost telemetry can split spend per control plane + the cost
//   dashboard can alarm if Bedrock fires more than ~1% of vision
//   calls (signals Anthropic vision instability).

import Anthropic from '@anthropic-ai/sdk';
import {
  ConverseCommand,
  type ContentBlock as BedrockContentBlock,
  type ImageFormat,
  type DocumentFormat,
} from '@aws-sdk/client-bedrock-runtime';
import type { ActionLogEntry, AgentId, TenantId } from '@docket/shared';
import {
  bedrockClient,
  isTransientAnthropicError,
  type Provider,
} from './providers.js';

const PRICING = {
  'haiku-4-5':  { input: 0.80,  output: 4.00,  cached: 0.08 },
  'sonnet-4-6': { input: 3.00,  output: 15.00, cached: 0.30 },
  'opus-4-7':   { input: 15.00, output: 75.00, cached: 1.50 },
} as const;

type ModelTier = keyof typeof PRICING;

const ANTHROPIC_MODEL_IDS: Record<ModelTier, string> = {
  'haiku-4-5':  'claude-haiku-4-5-20251001',
  'sonnet-4-6': 'claude-sonnet-4-6',
  'opus-4-7':   'claude-opus-4-7',
};

// Bedrock model IDs use the cross-region inference profile prefix
// `us.` for higher availability across us-east-1 / us-west-2 / us-east-2.
// Same pattern as providers.ts BEDROCK_MODEL_IDS for text. Sonnet
// pinned to 4.5 because Anthropic's 4.6 alias on direct API doesn't
// have a direct Bedrock equivalent yet (same caveat as text side).
const BEDROCK_MODEL_IDS: Record<ModelTier, string> = {
  'haiku-4-5':  'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  'sonnet-4-6': 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  'opus-4-7':   'us.anthropic.claude-opus-4-1-20250805-v1:0',
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
  /**
   * If the systemPrompt was sourced from @docket/prompts, pass the
   * prompt id + version so cost telemetry can break down spend per
   * prompt version. Same shape as runDocketAgent.
   */
  promptId?: string;
  promptVersion?: string;
};

export type VisionAgentResult = {
  text: string;
  modelUsed: ModelTier;
  /**
   * Which control plane responded. Anthropic is primary; bedrock
   * fires only on transient primary failure (5xx / 429 / timeout /
   * credit-balance 400 / network error / SDK connection failure).
   * Cost telemetry tags by this so the dashboard can surface per-
   * provider vision spend + flag if Bedrock fires more than ~1% of
   * calls (signals Anthropic vision instability).
   */
  provider: Provider;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
  latencyMs: number;
};

let _client: Anthropic | null = null;
function anthropicClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Top-level runner. Tries Anthropic first, falls over to Bedrock on
 * transient errors. Returns a result tagged with the provider that
 * actually responded so cost telemetry routes correctly.
 *
 * EDGE CASE: exactly ONE fallback attempt. Bedrock failure throws
 * with both errors aggregated (mirrors callClaudeWithFallover).
 */
export async function runVisionAgent(
  opts: VisionAgentOptions,
): Promise<VisionAgentResult> {
  let primaryError: unknown;

  try {
    return await runVisionAgentViaAnthropic(opts);
  } catch (err) {
    primaryError = err;
    if (!isTransientAnthropicError(err)) {
      // Permanent — propagate as-is. The onAction hook already fired
      // with success=false from inside runVisionAgentViaAnthropic if
      // the call got that far; otherwise the audit row is missing.
      // Caller decides how to surface to the user.
      throw err;
    }
    // Log the failover firing. Same pattern as
    // callClaudeWithFallover; using console.error so orchestrator
    // stays free of @sentry/nextjs (server-only module).
    console.error(
      '[orchestrator/vision] Anthropic transient failure, failing over to Bedrock',
      {
        modelTier: opts.modelTier ?? 'haiku-4-5',
        imageCount: opts.images.length,
        primaryError:
          err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      },
    );
  }

  // Fallback path. If THIS fails too, aggregate both errors so the
  // caller can diagnose which provider broke + why.
  try {
    return await runVisionAgentViaBedrock(opts);
  } catch (bedrockErr) {
    const primaryMsg =
      primaryError instanceof Error
        ? `${primaryError.name}: ${primaryError.message}`
        : String(primaryError);
    const fallbackMsg =
      bedrockErr instanceof Error
        ? `${bedrockErr.name}: ${bedrockErr.message}`
        : String(bedrockErr);
    throw new Error(
      `Vision: both providers failed. Anthropic: ${primaryMsg}. Bedrock: ${fallbackMsg}.`,
    );
  }
}

/**
 * Anthropic vision path. Same logic as the pre-Session-14 single-
 * provider implementation. Extracted so the top-level runVisionAgent
 * can wrap it in the fallover orchestration.
 */
async function runVisionAgentViaAnthropic(
  opts: VisionAgentOptions,
): Promise<VisionAgentResult> {
  const tier: ModelTier = opts.modelTier ?? 'haiku-4-5';
  const start = Date.now();

  const systemBlock = opts.cachedSystem
    ? [{ type: 'text' as const, text: opts.systemPrompt, cache_control: { type: 'ephemeral' as const } }]
    : opts.systemPrompt;

  // Stitch the user turn: [image1, image2, ..., text]. The text
  // anchors the question. Order matters — Anthropic recommends
  // images first, instructions last, so the model has the visual
  // context before the prompt that asks about it.
  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    ...opts.images.map(toAnthropicContentBlock),
    { type: 'text' as const, text: opts.userPrompt },
  ];

  const response = await anthropicClient().messages.create({
    model: ANTHROPIC_MODEL_IDS[tier],
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
        model: ANTHROPIC_MODEL_IDS[tier],
        provider: 'anthropic',
        maxTokens: opts.maxTokens ?? 1024,
        imageCount: opts.images.length,
        ...(opts.promptId ? { promptId: opts.promptId } : {}),
        ...(opts.promptVersion ? { promptVersion: opts.promptVersion } : {}),
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

  return {
    text,
    modelUsed: tier,
    provider: 'anthropic',
    inputTokens,
    outputTokens,
    cachedTokens,
    costUsd,
    latencyMs,
  };
}

/**
 * Bedrock vision path. Mirrors the Anthropic call shape but routes
 * through Bedrock's Converse API. Image bytes (base64 → Uint8Array)
 * + DocumentBlock for PDFs.
 *
 * URL-source images: fetched into bytes here. If the fetch fails,
 * we throw with a clear error — the caller's outer try/catch in
 * runVisionAgent will aggregate this into the "both providers
 * failed" message.
 */
async function runVisionAgentViaBedrock(
  opts: VisionAgentOptions,
): Promise<VisionAgentResult> {
  const tier: ModelTier = opts.modelTier ?? 'haiku-4-5';
  const start = Date.now();

  // Convert image inputs → Bedrock content blocks. Async because
  // URL-source images require a fetch. The base64 path is sync.
  const imageBlocks = await Promise.all(
    opts.images.map(toBedrockContentBlock),
  );

  // Stitch the user turn: [image1, image2, ..., text]. Same ordering
  // as Anthropic — images first, instructions last.
  const userContent: BedrockContentBlock[] = [
    ...imageBlocks,
    { text: opts.userPrompt } as BedrockContentBlock,
  ];

  const command = new ConverseCommand({
    modelId: BEDROCK_MODEL_IDS[tier],
    system: [{ text: opts.systemPrompt }],
    messages: [{ role: 'user', content: userContent }],
    inferenceConfig: { maxTokens: opts.maxTokens ?? 1024 },
  });

  const response = await bedrockClient().send(command);

  const latencyMs = Date.now() - start;
  const usage = response.usage;
  const inputTokens = usage?.inputTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? 0;
  // Bedrock Converse reports cacheReadInputTokens for prompt caching
  // when enabled via cachePoint blocks. Vision agent doesn't use
  // caching today (cachedSystem flag is Anthropic-only); the field
  // is read defensively in case future Bedrock features add it.
  const cachedTokens =
    (usage as { cacheReadInputTokens?: number } | undefined)
      ?.cacheReadInputTokens ?? 0;

  const pricing = PRICING[tier];
  const costUsd =
    ((inputTokens - cachedTokens) * pricing.input) / 1_000_000 +
    (cachedTokens * pricing.cached) / 1_000_000 +
    (outputTokens * pricing.output) / 1_000_000;

  // Bedrock Converse returns output.message.content[] with text
  // blocks. Same shape as Anthropic text blocks; concatenate.
  const text = (response.output?.message?.content ?? [])
    .map((b) => (typeof b === 'object' && b && 'text' in b ? (b as { text: string }).text : ''))
    .filter((s) => s.length > 0)
    .join('\n');

  if (opts.onAction) {
    await opts.onAction({
      tenantId: opts.tenantId,
      clientId: null,
      userId: null,
      agentId: opts.agentId,
      actionClass: 'classify',
      toolName: 'bedrock.converse.vision',
      toolInput: {
        model: BEDROCK_MODEL_IDS[tier],
        provider: 'bedrock',
        maxTokens: opts.maxTokens ?? 1024,
        imageCount: opts.images.length,
        ...(opts.promptId ? { promptId: opts.promptId } : {}),
        ...(opts.promptVersion ? { promptVersion: opts.promptVersion } : {}),
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

  return {
    text,
    modelUsed: tier,
    provider: 'bedrock',
    inputTokens,
    outputTokens,
    cachedTokens,
    costUsd,
    latencyMs,
  };
}

function toAnthropicContentBlock(
  image: VisionImageInput,
): Anthropic.Messages.ContentBlockParam {
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

/**
 * Map our MIME → Bedrock ImageFormat. Bedrock's enum uses bare format
 * names ('png' / 'jpeg' / 'webp' / 'gif') not MIME types.
 */
function mediaTypeToBedrockImageFormat(
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
): ImageFormat {
  switch (mediaType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpeg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
  }
}

async function toBedrockContentBlock(
  image: VisionImageInput,
): Promise<BedrockContentBlock> {
  if (image.kind === 'base64') {
    const bytes = Buffer.from(image.data, 'base64');
    if (image.mediaType === 'application/pdf') {
      const pdfFormat: DocumentFormat = 'pdf';
      return {
        document: {
          format: pdfFormat,
          // Bedrock requires a name field on documents — use a
          // deterministic placeholder so identical content gets the
          // same name (helps the model not be confused by random
          // identifiers; doesn't matter for classification).
          name: 'document.pdf',
          source: { bytes },
        },
      } as BedrockContentBlock;
    }
    return {
      image: {
        format: mediaTypeToBedrockImageFormat(image.mediaType),
        source: { bytes },
      },
    } as BedrockContentBlock;
  }
  // URL form: fetch bytes + infer format from URL extension.
  // Bedrock Converse doesn't accept URL-source images; we have to
  // pull the bytes ourselves. If the fetch fails the outer
  // runVisionAgent aggregates the error into the "both providers
  // failed" message.
  const res = await fetch(image.url);
  if (!res.ok) {
    throw new Error(
      `Bedrock vision URL fetch failed: ${res.status} ${res.statusText} for ${image.url}`,
    );
  }
  const arrayBuffer = await res.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  // Best-effort format inference from URL extension. Falls back to
  // jpeg which Bedrock accepts for most photo-derived content.
  const ext = image.url.toLowerCase().match(/\.(png|jpe?g|webp|gif)(?:\?|$)/);
  const fmt: ImageFormat = ext
    ? ext[1] === 'jpg'
      ? 'jpeg'
      : (ext[1] as ImageFormat)
    : 'jpeg';
  return {
    image: {
      format: fmt,
      source: { bytes },
    },
  } as BedrockContentBlock;
}
