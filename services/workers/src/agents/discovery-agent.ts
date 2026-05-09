// Discovery Agent — compliance-first deduction surfacing.
//
// Per CLAUDE.md §13 white-space bet #1 + POSITION-FRAMEWORK.md §4.
// The marketing differentiator for Antonio's segment vs Big-4-targeted
// competitors. Every position carries an IRC cite + tier classification
// + audit-risk + supporting rationale. Below "reasonable basis" the
// agent REFUSES to surface — that's the framework's structural moat.
//
// V0 SCOPE (scaffold)
//   - Prompt + IO schema + agent function + smoke harness
//   - Returns synthetic positions for now (the model knows IRC well
//     enough to surface real ones from a richly-described intake)
//   - Trust-gate verdict computed post-output via positionTier (the
//     highest tier in the surfaced positions drives the verdict)
//   - When the knowledge layer (authorities table) populates in
//     Phase 3, the system prompt extends with retrieval-augmented
//     citations grounded in the live IRC + Treas Reg + IRS Pub +
//     FTB pub corpus
//
// MODEL TIER
//   Sonnet 4.6 default — surfacing positions needs IRC reasoning +
//   judgment. Haiku 4.5 acceptable for evals + dry-runs (cheaper);
//   Opus 4.7 reserved for complex multi-state / pass-through scenarios.
//
// COST POSTURE
//   Caching is critical — system prompt is 4-5k tokens. cachedSystem=true
//   makes per-call cost ~$0.01-0.03 on Sonnet vs ~$0.10 uncached.
//   Per-tenant budget cap (V1.5): 10 Discovery runs/client/year.

import { z } from 'zod';
import type { AgentId, ClientId, TenantId, TrustLevel } from '@docket/shared';
import { assertTrustGate, type PositionTier } from '@docket/shared';
import { runDocketAgent } from '@docket/orchestrator';
import { getPrompt } from '@docket/prompts';
import { lookupAuthorityByCitation } from '@docket/db';

// ────────────────────────────────────────────────────────────────
// Input shape — what the Discovery agent needs to scan a client.
// ────────────────────────────────────────────────────────────────
export type DiscoveryContext = {
  tenantId: TenantId;
  clientId: ClientId;
  /** Firm's currently-configured trust level. Drives verdict computation. */
  trustLevel?: TrustLevel;
};

export type DiscoveryInput = {
  context: DiscoveryContext;
  /**
   * The taxpayer's intake answers as a single JSON-stringified blob.
   * The agent reads filing status, dependents, income types, deductions
   * already claimed, life events, state. v0 caller composes this from
   * the intake_responses table; v1.5 adds doc-extracted facts (1099s
   * parsed by the doc-classifier, K-1 line items, etc.).
   */
  intakeAnswers: Record<string, unknown>;
  /**
   * Optional list of doc summaries already parsed by the doc-classifier.
   * Each: { kind, summary, year? }. The agent uses these to ground
   * specific deduction surfacing (e.g., a 1099-NEC unlocks
   * self-employment deductions).
   */
  documentSummaries?: Array<{
    kind: string;
    summary: string;
    year?: number;
  }>;
  /**
   * Optional jurisdiction list. v0 always [federal, state]. v1.5 adds
   * multi-state (resident + source-state pairs) when intake.state has
   * multiple entries.
   */
  jurisdictions?: Array<'federal' | 'CA' | 'NY' | 'TX' | 'FL' | 'WA'>;
};

// ────────────────────────────────────────────────────────────────
// Output schema — TaxPosition objects + refused-positions log.
// ────────────────────────────────────────────────────────────────
export const CitationSchema = z.object({
  source: z.enum([
    'irc',
    'treas-reg',
    'irs-pub',
    'ftb-pub',
    'tax-court',
    'rev-rul',
    'ftb-legal-ruling',
  ]),
  cite: z.string().min(2),
  summary: z.string().min(5),
});

export const TaxPositionSchema = z.object({
  claim: z.string().min(10),
  /** 1-4 only. Below-floor positions land in refusedPositions, not here. */
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  authority: z.array(CitationSchema).min(1),
  estimatedImpact: z.object({
    dollars: z.number(),
    certainty: z.enum(['estimate', 'precise']),
  }),
  auditRisk: z.enum(['low', 'moderate', 'high']),
  /** True iff tier === 3 (Form 8275 disclosure required). */
  disclosureRequired: z.boolean(),
  rationale: z.string().min(10),
  gapsToConfirm: z.array(z.string()).default([]),
});

export const DiscoveryOutputSchema = z.object({
  positions: z.array(TaxPositionSchema).default([]),
  refusedPositions: z
    .array(
      z.object({
        hypothetical: z.string().min(5),
        reason: z.string().min(5),
      }),
    )
    .default([]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(10),
});

export type TaxPosition = z.infer<typeof TaxPositionSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type DiscoveryOutput = z.infer<typeof DiscoveryOutputSchema>;

// ────────────────────────────────────────────────────────────────
// Trust-gate verdict — computed post-discovery from the highest-tier
// position in the output. The drafter computes verdict from action
// class only; Discovery additionally factors positionTier.
// ────────────────────────────────────────────────────────────────
export type DiscoveryTrustGate =
  | { allowed: true; highestTier: PositionTier }
  | {
      allowed: false;
      highestTier: PositionTier;
      requires: 'human-approval' | 'refusal';
      reason: string;
    };

// ────────────────────────────────────────────────────────────────
// Public API.
// ────────────────────────────────────────────────────────────────
export type DiscoverOptions = {
  input: DiscoveryInput;
  modelTier?: 'haiku-4-5' | 'sonnet-4-6' | 'opus-4-7';
  onAction?: Parameters<typeof runDocketAgent>[0]['onAction'];
};

/**
 * Class-marker thrown when runDiscovery is invoked without the explicit
 * DISCOVERY_AGENT_ENABLED env gate. Allows callers to catch + handle
 * (e.g., by rendering a "knowledge layer not ready" banner) without
 * confusing it with model-output errors.
 */
export class DiscoveryAgentNotEnabledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryAgentNotEnabledError';
  }
}

/**
 * Pre-knowledge-layer kill-switch. The Discovery agent's system prompt
 * tells the model to surface IRC citations directly. Without the
 * authorities table populated (Phase 3 work), citations come from the
 * model's training data and can be hallucinated — the EA's PTIN is on
 * every return, so a hallucinated cite that ships could end Antonio's
 * license. This guard refuses to run until the user explicitly opts in
 * via DISCOVERY_AGENT_ENABLED=true.
 *
 * To override (for evals, dev exploration, etc.):
 *   DISCOVERY_AGENT_ENABLED=true bun run services/workers/scripts/smoke-discovery.ts
 *
 * In production the env var stays UNSET until the knowledge-layer
 * ingest lands AND there's a verifier loop confirming each citation
 * resolves to a real authority row before the position surfaces in
 * Antonio's queue.
 *
 * Per the user's 2026-05-08 licensure-stakes mandate.
 */
function assertDiscoveryEnabled(): void {
  const enabled = process.env.DISCOVERY_AGENT_ENABLED;
  if (enabled !== 'true') {
    throw new DiscoveryAgentNotEnabledError(
      'Discovery agent is gated off until the knowledge layer (authorities ' +
        'table) is populated AND a citation-verifier loop is in place. The ' +
        'system prompt asks the model to emit IRC citations; pre-knowledge-' +
        'layer those come from training data and may be hallucinated, which ' +
        'is a license risk for any EA who trusts the output. To override for ' +
        'evals or dev exploration, set DISCOVERY_AGENT_ENABLED=true. Do NOT ' +
        'set in production until citation-verification ships.',
    );
  }
}

export async function runDiscovery(opts: DiscoverOptions): Promise<{
  output: DiscoveryOutput;
  trustGate: DiscoveryTrustGate;
  costUsd: number;
  latencyMs: number;
  modelUsed: 'haiku-4-5' | 'sonnet-4-6' | 'opus-4-7';
}> {
  assertDiscoveryEnabled();

  const userPrompt = JSON.stringify({
    intakeAnswers: opts.input.intakeAnswers,
    documentSummaries: opts.input.documentSummaries ?? [],
    jurisdictions: opts.input.jurisdictions ?? ['federal'],
  });

  const prompt = await getPrompt('discovery-agent');

  const result = await runDocketAgent({
    tenantId: opts.input.context.tenantId,
    agentId: 'discovery-agent' as AgentId,
    systemPrompt: prompt.template,
    userPrompt,
    modelTier: opts.modelTier ?? 'sonnet-4-6',
    cachedSystem: true,
    maxTokens: 4096,
    onAction: opts.onAction,
    promptId: prompt.id,
    promptVersion: prompt.version,
  });

  // Extract first JSON object from response.
  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(
      `discovery-agent: model returned no JSON. Raw text: ${result.text.slice(0, 500)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error(
      `discovery-agent: JSON.parse failed. Raw text: ${result.text.slice(0, 500)}`,
    );
  }
  const validation = DiscoveryOutputSchema.safeParse(parsed);
  if (!validation.success) {
    throw new Error(
      `discovery-agent: schema validation failed. Errors: ${JSON.stringify(validation.error.issues)}. Parsed: ${JSON.stringify(parsed).slice(0, 500)}`,
    );
  }

  // CITATION-VERIFIER LOOP. The Discovery agent prompt instructs
  // "always provide IRC or regulatory citation"; pre-knowledge-layer
  // those came from the model's training data and could be
  // hallucinated. Now (post-authorities-seed-8af06f5) we verify each
  // emitted citation against the authority library. Positions whose
  // citations don't resolve get marked: their gapsToConfirm gains a
  // "verify cite '${cite}'" note. The trust-gate verdict downgrades
  // for any position with unverified citations (treat as one tier
  // lower because we can't confirm authority). The kill-switch can
  // be lifted once: (1) authorities populated (done), (2) this
  // verifier in place (done), (3) eval suite confirms <1%
  // hallucination rate (next).
  for (const position of validation.data.positions) {
    const unverified: string[] = [];
    for (const cite of position.authority) {
      try {
        const found = await lookupAuthorityByCitation(
          opts.input.context.tenantId,
          cite.cite,
        );
        if (!found) unverified.push(cite.cite);
      } catch (err) {
        console.error('[discovery] citation verifier threw:', err);
        unverified.push(cite.cite);
      }
    }
    if (unverified.length > 0) {
      const verifyNotes = unverified.map(
        (c) =>
          `Citation '${c}' did not resolve against the authority library — verify before relying on this position.`,
      );
      position.gapsToConfirm = [...position.gapsToConfirm, ...verifyNotes];
      // Downgrade by one tier (capped at 4 since we don't push to
      // refusal-floor here — the floor is for positions BELOW
      // reasonable basis, not for unverified-cite positions). The
      // surfaced position still ships, just at lower auto-acceptance.
      if (position.tier < 4) {
        position.tier = (position.tier + 1) as 2 | 3 | 4;
      }
    }
  }

  // Compute trust-gate verdict. Highest tier in the output drives the
  // verdict because that's the position whose surfacing requires the
  // most authority. Default to Tier 1 if no positions surfaced (no
  // gating concern — nothing to act on).
  const highestTier: PositionTier =
    validation.data.positions.length === 0
      ? 1
      : (Math.max(
          ...validation.data.positions.map((p) => p.tier),
        ) as PositionTier);
  const trustLevel = opts.input.context.trustLevel ?? 1;
  const decision = assertTrustGate({
    trustLevel,
    actionClass: 'send-external',
    positionTier: highestTier,
  });
  const trustGate: DiscoveryTrustGate = decision.allowed
    ? { allowed: true, highestTier }
    : {
        allowed: false,
        highestTier,
        requires: decision.requires,
        reason: decision.reason,
      };

  return {
    output: validation.data,
    trustGate,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
    modelUsed: result.modelUsed,
  };
}
