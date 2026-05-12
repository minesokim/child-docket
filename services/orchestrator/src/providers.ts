// Provider abstraction for Claude inference.
//
// Two backends behind one interface: direct Anthropic API (primary) and
// AWS Bedrock (fallback). Same Claude model on both, different control
// planes. Vendor resilience without losing prompt-caching benefits or
// adding latency from a third-party gateway.
//
// WHY THIS EXISTS
//   PRODUCTION-READINESS §A locked the vendor-resilience posture after
//   the Neon Cell 6 outage of 2026-05-08 proved infra outages are
//   quarterly events. If Anthropic's API is down (a real occurrence),
//   every agent fails. Without a fallback, Docket is "cooked" during
//   tax season when the user has zero room for outages.
//
//   AWS Bedrock serves the same Claude models with the same prompt
//   format (Converse API). Auth + control plane are different. When
//   Anthropic returns 5xx/429/timeout, fall through to Bedrock with
//   the same prompt. Recovery time = the duration of one extra HTTP
//   round-trip.
//
// EDGE CASES (analyzed before writing this file — see /edge-cases skill)
//   1. Anthropic 429        → fall back to Bedrock                ← HANDLED
//   2. Anthropic 5xx        → fall back to Bedrock                ← HANDLED
//   3. Anthropic timeout    → abort + fall back                   ← HANDLED (15s timeout)
//   4. Anthropic 401        → DO NOT fall back, throw immediately ← HANDLED (config error)
//   5. Anthropic 400 caller-bug → DO NOT fall back, throw         ← HANDLED (bad prompt / model ID)
//   6. Bedrock also fails   → throw aggregated error              ← HANDLED
//   7. Model ID per tier    → BEDROCK_MODEL_IDS table             ← HANDLED
//   8. Cost telemetry tag   → result.provider field               ← HANDLED
//   9. Prompt cache markers → Converse API cachePoint blocks      ← HANDLED
//   10. Sentry breadcrumb   → on fallback fire                    ← HANDLED
//   11. Infinite loop       → ONE fallback attempt only           ← HANDLED
//   12. Tool use format     → defer until first tool-use agent    ← DOCUMENTED
//   13. Streaming           → defer; no agent streams today       ← DOCUMENTED
//   14. Bedrock cost ~+5-10% → tagged in telemetry                ← DOCUMENTED
//   15. Idempotency rare-dup → both calls non-mutating, ok        ← DOCUMENTED
//   16. Anthropic 400 billing → "credit balance too low" → fall back ← HANDLED (2026-05-12)

import Anthropic from '@anthropic-ai/sdk';
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ConverseCommandInput,
  type Message as BedrockMessage,
  type SystemContentBlock,
} from '@aws-sdk/client-bedrock-runtime';

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────

export type ModelTier = 'haiku-4-5' | 'sonnet-4-6' | 'opus-4-7';
export type Provider = 'anthropic' | 'bedrock';

export type CallClaudeInput = {
  modelTier: ModelTier;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  /**
   * When true, the system prompt is wrapped with cache_control:
   * ephemeral. Cache hits get 90% discount on cached input. See
   * MEMORY-ARCHITECTURE.md §4 for cost math.
   *
   * Bedrock supports the same caching via Converse API cachePoint
   * blocks. The wrapper handles the per-provider syntax difference.
   */
  cachedSystem?: boolean;
};

export type CallClaudeResult = {
  text: string;
  provider: Provider;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  cacheCreationInputTokens: number;
  latencyMs: number;
};

// ────────────────────────────────────────────────────────────────
// Model ID mappings
//
// Anthropic's API and Bedrock use different model identifiers for
// the same underlying model. The `us.` prefix on Bedrock IDs uses
// the cross-region inference profile — routes to whichever us-east-*
// region has capacity. Built-in resilience.
//
// Bedrock Sonnet pinned to 4.5 because Anthropic's `sonnet-4-6` tier
// alias on direct API doesn't have a direct Bedrock equivalent yet.
// Falling back to a slightly older Sonnet during outage > failing.
// ────────────────────────────────────────────────────────────────

const ANTHROPIC_MODEL_IDS: Record<ModelTier, string> = {
  'haiku-4-5': 'claude-haiku-4-5-20251001',
  'sonnet-4-6': 'claude-sonnet-4-6',
  'opus-4-7': 'claude-opus-4-7',
};

const BEDROCK_MODEL_IDS: Record<ModelTier, string> = {
  'haiku-4-5': 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  // Sonnet 4.6 not on Bedrock yet; falling back to Sonnet 4.5 is acceptable
  // — losing one minor version of model quality during a vendor outage
  // beats failing the request.
  'sonnet-4-6': 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  // TODO(production-readiness §A): test Opus 4.7 model ID on Bedrock
  // against the live AWS account before this falls back in prod.
  'opus-4-7': 'us.anthropic.claude-opus-4-1-20250805-v1:0',
};

// ────────────────────────────────────────────────────────────────
// Anthropic primary path
// ────────────────────────────────────────────────────────────────

let _anthropicClient: Anthropic | null = null;
function anthropicClient(): Anthropic {
  if (_anthropicClient) return _anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set — cannot call primary provider');
  }
  _anthropicClient = new Anthropic({
    apiKey,
    // 15s timeout — long enough for normal Sonnet completion at 4K
    // tokens; short enough that a hung Anthropic doesn't block a
    // user-facing request for a full minute.
    timeout: 15_000,
  });
  return _anthropicClient;
}

async function callViaAnthropic(input: CallClaudeInput): Promise<CallClaudeResult> {
  const start = Date.now();
  const systemBlock = input.cachedSystem
    ? [
        {
          type: 'text' as const,
          text: input.systemPrompt,
          cache_control: { type: 'ephemeral' as const },
        },
      ]
    : input.systemPrompt;

  const response = await anthropicClient().messages.create({
    model: ANTHROPIC_MODEL_IDS[input.modelTier],
    max_tokens: input.maxTokens,
    system: systemBlock,
    messages: [{ role: 'user', content: input.userPrompt }],
  });

  const latencyMs = Date.now() - start;
  const usage = response.usage;
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  return {
    text,
    provider: 'anthropic',
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cachedInputTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationInputTokens: usage.cache_creation_input_tokens ?? 0,
    latencyMs,
  };
}

// ────────────────────────────────────────────────────────────────
// Bedrock fallback path (Converse API)
//
// Converse is Bedrock's unified text-generation API across all
// foundation models. For Claude specifically, it accepts the same
// message structure + supports the same prompt-caching mechanism
// via cachePoint blocks (different syntax, same effect).
//
// Auth via standard AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY env
// vars. Region defaults to us-east-1 unless AWS_BEDROCK_REGION is
// set to something else.
// ────────────────────────────────────────────────────────────────

let _bedrockClient: BedrockRuntimeClient | null = null;
function bedrockClient(): BedrockRuntimeClient {
  if (_bedrockClient) return _bedrockClient;
  const region = process.env.AWS_BEDROCK_REGION ?? 'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY not set — Bedrock fallback unavailable',
    );
  }
  _bedrockClient = new BedrockRuntimeClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  return _bedrockClient;
}

async function callViaBedrock(input: CallClaudeInput): Promise<CallClaudeResult> {
  const start = Date.now();

  // Bedrock Converse API takes system as an array of content blocks.
  // For prompt caching, append a `cachePoint` block AFTER the text;
  // everything before the cachePoint marker is cache-eligible.
  const system: SystemContentBlock[] = input.cachedSystem
    ? [
        { text: input.systemPrompt },
        { cachePoint: { type: 'default' } },
      ]
    : [{ text: input.systemPrompt }];

  const messages: BedrockMessage[] = [
    {
      role: 'user',
      content: [{ text: input.userPrompt }],
    },
  ];

  const command = new ConverseCommand({
    modelId: BEDROCK_MODEL_IDS[input.modelTier],
    system,
    messages,
    inferenceConfig: { maxTokens: input.maxTokens },
  } satisfies ConverseCommandInput);

  const response = await bedrockClient().send(command);
  const latencyMs = Date.now() - start;

  const text =
    response.output?.message?.content
      ?.map((b) => ('text' in b && typeof b.text === 'string' ? b.text : ''))
      .filter(Boolean)
      .join('\n') ?? '';

  const usage = response.usage ?? {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadInputTokens: 0,
    cacheWriteInputTokens: 0,
  };

  return {
    text,
    provider: 'bedrock',
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cachedInputTokens: usage.cacheReadInputTokens ?? 0,
    cacheCreationInputTokens: usage.cacheWriteInputTokens ?? 0,
    latencyMs,
  };
}

// ────────────────────────────────────────────────────────────────
// Failover orchestration — the public entry point
// ────────────────────────────────────────────────────────────────

/**
 * Set of error shapes that mean "transient — retry on Bedrock."
 *
 * Anthropic SDK throws Anthropic.APIError subclasses with `.status`
 * (HTTP status code) and `.error?.type` (Anthropic error category).
 *
 * EDGE CASES 1-3, 4, 5: this classifier is the load-bearing decision.
 * Wrong category → either we fail-fast on transient (defeats the
 * whole point of fallback) or we retry-on-config-error (mask real
 * config bugs behind a "Bedrock didn't work either" message).
 */
function isTransientAnthropicError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  // Anthropic SDK error shape (APIError from @anthropic-ai/sdk):
  //   e.status         — HTTP status
  //   e.type           — top-level error type set by APIError constructor
  //                      from body.error.type (e.g. 'invalid_request_error',
  //                      'rate_limit_error', 'overloaded_error')
  //   e.error          — the raw JSON body, which Anthropic returns as
  //                      { type: 'error', error: { type, message } }.
  //                      So e.error.type is always 'error' (the wire
  //                      wrapper) — DO NOT use e.error.type to detect the
  //                      semantic error type. Use e.type (or e.error.error.type
  //                      as a fallback for non-SDK error shapes / direct
  //                      fetch responses).
  //   e.message        — Error.message string, prefixed with status code,
  //                      e.g. "400 Your credit balance is too low..."
  //   e.code           — Node-level network error code (ETIMEDOUT etc.)
  //                      ONLY when the failure is a network-layer error.
  //   e.name           — 'APIError' for SDK errors; 'AbortError' / 'TimeoutError'
  //                      for fetch-layer abort.
  //
  // Tests in providers.test.ts use `error: { type: ... }` (one level
  // nested) which is the legacy shape the classifier was written for.
  // We accept BOTH shapes:
  //   - e.error.type === 'rate_limit_error'        (legacy / test fixture)
  //   - e.type === 'rate_limit_error'              (real Anthropic SDK)
  //   - e.error.error.type === 'rate_limit_error'  (raw body when caller
  //                                                 passes the response body
  //                                                 directly, not the SDK error)
  const e = err as {
    status?: number;
    type?: string;
    error?: { type?: string; message?: string; error?: { type?: string; message?: string } };
    message?: string;
    name?: string;
    code?: string;
  };

  // 5xx server errors — always transient.
  if (typeof e.status === 'number' && e.status >= 500 && e.status < 600) {
    return true;
  }
  // 429 rate limit / overload — transient.
  if (e.status === 429) return true;

  // Anthropic semantic error types that indicate transient state.
  // Check all three possible paths to the inner type (see above).
  //
  // CRITICAL: skip the outer wire-wrapper literal value `'error'`.
  // When the function is given the raw Anthropic response body
  // (not wrapped in an APIError), `e.type` is the outer `'error'`
  // wrapper, not the semantic inner type. A naive `??` chain that
  // picks the first truthy value would lock onto `'error'` and
  // never reach the inner `error.error.type`. Codex C5-overnight
  // round 1 caught this regression — without the wrapper skip,
  // raw-body credit-balance / overloaded / api_error inputs would
  // be classified as permanent and not fall over to Bedrock.
  const transientTypes = new Set([
    'api_error',
    'overloaded_error',
    'service_unavailable',
    'rate_limit_error',
  ]);
  const candidates: Array<string | undefined> = [
    typeof e.type === 'string' ? e.type : undefined,
    typeof e.error?.error?.type === 'string' ? e.error.error.type : undefined,
    typeof e.error?.type === 'string' ? e.error.type : undefined,
  ];
  // Pick the first non-empty value that isn't the wire-wrapper literal.
  const innerType = candidates.find(
    (c): c is string => typeof c === 'string' && c.length > 0 && c !== 'error',
  );
  if (innerType && transientTypes.has(innerType)) return true;

  // Billing-condition 400: Anthropic returns
  //   status=400, error.type="invalid_request_error",
  //   message="Your credit balance is too low to access the Anthropic API."
  // This is structurally a 400 but semantically transient — the same
  // request will succeed against Bedrock (different billing relationship)
  // and against Anthropic once the user tops up. Treating it as
  // permanent meant a real outage in 2026-05-12 (Docket's Anthropic
  // balance ran out mid-day → every /e2e and agent run failed hard
  // instead of falling through to Bedrock). Real-world vendor
  // resilience requires recognizing billing 400s as transient.
  //
  // Detection: status 400 + invalid_request_error (at any of the three
  // paths above) + message contains "credit balance" (case-insensitive,
  // checked across both nested message and the SDK-flattened top-level
  // message). The narrow message match avoids treating legitimate
  // caller-bug 400s (malformed prompts, bad model IDs) as transient.
  if (e.status === 400 && innerType === 'invalid_request_error') {
    const innerMessage =
      e.error?.error?.message ?? e.error?.message ?? e.message ?? '';
    if (typeof innerMessage === 'string' && /credit balance/i.test(innerMessage)) {
      return true;
    }
  }

  // Network-layer errors (timeout, ECONNRESET, etc.) — transient.
  if (e.code === 'ETIMEDOUT' || e.code === 'ECONNRESET' || e.code === 'ECONNREFUSED') {
    return true;
  }
  if (e.name === 'AbortError' || e.name === 'TimeoutError') return true;

  // 401, 400 (non-billing), 403, 404 — config / caller errors. NOT transient.
  // Explicitly exclude even though the default-false path handles them.
  return false;
}

/**
 * Call Claude with automatic Bedrock failover.
 *
 * Returns a result tagged with the provider that actually responded,
 * so cost telemetry + observability can route appropriately.
 *
 * EDGE CASE 11 (infinite loop prevention): exactly ONE fallback
 * attempt. Bedrock failure throws.
 *
 * EDGE CASE 6 (Bedrock also fails): the thrown error includes both
 * the Anthropic and Bedrock error messages so the caller can see
 * what happened on both paths.
 */
export async function callClaudeWithFallover(
  input: CallClaudeInput,
): Promise<CallClaudeResult> {
  let primaryError: unknown;

  try {
    return await callViaAnthropic(input);
  } catch (err) {
    primaryError = err;

    // EDGE CASE 4, 5: do NOT fall back on permanent errors.
    if (!isTransientAnthropicError(err)) {
      throw err;
    }

    // EDGE CASE 10: log fallback firing for Sentry / cost dashboard.
    // Using console.error rather than Sentry directly so this module
    // doesn't depend on @sentry/nextjs (orchestrator is server-only,
    // not a Next.js app). Sentry's onRequestError hook + the explicit
    // captureException pattern in route handlers will pick this up.
    console.error(
      '[orchestrator] Anthropic transient failure, failing over to Bedrock',
      {
        modelTier: input.modelTier,
        primaryError:
          err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      },
    );
  }

  // Fallback path. If THIS fails too, we have nothing left.
  try {
    return await callViaBedrock(input);
  } catch (bedrockErr) {
    // EDGE CASE 6: aggregate both errors for diagnosis. The caller's
    // error handling sees a single Error, but the message includes
    // enough context to diagnose which provider failed how.
    const primaryMsg =
      primaryError instanceof Error
        ? `${primaryError.name}: ${primaryError.message}`
        : String(primaryError);
    const fallbackMsg =
      bedrockErr instanceof Error
        ? `${bedrockErr.name}: ${bedrockErr.message}`
        : String(bedrockErr);

    throw new Error(
      `Both providers failed. Anthropic: ${primaryMsg}. Bedrock: ${fallbackMsg}.`,
    );
  }
}

// ────────────────────────────────────────────────────────────────
// Test-only export — lets unit tests exercise the classifier and
// lets smoke-bedrock.ts hit the Bedrock wire directly (bypassing the
// failover orchestration).
//
// `callViaBedrock` is exported here because the smoke test can't
// realistically simulate a transient Anthropic error to trigger the
// failover branch — Anthropic's SDK throws 401 for an invalid key,
// which the classifier (correctly) treats as permanent. Direct
// access is the cleanest way to validate Bedrock auth + model
// availability + Converse API response shape.
// ────────────────────────────────────────────────────────────────
export const _testOnly = {
  isTransientAnthropicError,
  callViaBedrock,
  ANTHROPIC_MODEL_IDS,
  BEDROCK_MODEL_IDS,
};
