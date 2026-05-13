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
import { lookupAuthorityByCitation, PostgresRetriever } from '@docket/db';
import {
  type KnowledgeRetriever,
  type RetrievalHit,
} from '@docket/tax-graph';

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
// Canonical alert format.
//
// Per CLAUDE.md §8 Canonical insight format:
//   "Every AI-surfaced alert renders in the canonical form:
//    `{ClientName}'s {situation} · {quantified impact}`.
//    The quantified-impact half is what makes the alert *legible* —
//    preparers triage by dollar amount + deadline distance, not by
//    alert title."
//
// formatDiscoveryAlert composes a TaxPosition into this canonical
// shape. Used by:
//   - the dashboard Discovery findings card
//   - the Morning Brief insight feed
//   - any future AI alert surface that lists Discovery results
//
// EXAMPLES
//   "Maria Ortega's home-office deduction · est. $14K savings"
//   "Patel Family's Augusta-rule rental (Tier 2, Substantial Authority) · est. $4,200 savings"
//   "Doe Family's QBI aggregation · est. $8,500 savings, Tier 3 (8275 required)"
//
// FALLBACK
//   When a position's estimatedImpact.dollars is 0 or null, the
//   alert routes to the secondary "informational" queue rather than
//   the primary dashboard — quantified impact is what makes alerts
//   legible.
// ────────────────────────────────────────────────────────────────

const TIER_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: 'Settled',
  2: 'Substantial Authority',
  3: 'Reasonable Basis with 8275',
  4: 'More Likely Than Not',
};

/**
 * Compose a TaxPosition into the canonical alert string.
 *
 * Pass the prepared client display name (e.g., "Maria Ortega" or
 * "Patel Family"). The function does NOT pluralize or auto-strip
 * — caller controls the display form.
 *
 * Returns null when the impact is non-quantified (dollars <= 0).
 * Callers route null returns to the informational queue, not the
 * primary alert surface.
 */
export function formatDiscoveryAlert(
  position: TaxPosition,
  clientDisplayName: string,
): string | null {
  if (position.estimatedImpact.dollars <= 0) return null;
  const situation = humanSituation(position.claim);
  const impact = humanImpact(position);
  return `${clientDisplayName}'s ${situation} · ${impact}`;
}

/**
 * Extract a SHORT situation phrase from the position.claim. The
 * full claim is a sentence; the alert wants a noun-phrase like
 * "home-office deduction" or "Augusta-rule rental."
 *
 * Heuristic v0:
 *   - Take the first 6 words of the claim
 *   - Strip leading articles ("A ", "The ")
 *   - Lowercase the first character (unless it's a proper noun)
 *   - Drop trailing punctuation
 *
 * Caller can still override by passing in custom claim text from
 * the prompt; this is the default formatter.
 */
export function humanSituation(claim: string): string {
  let trimmed = claim.trim().replace(/^(A |An |The )/i, '');
  // Cut at 6 words to keep alert legible.
  const words = trimmed.split(/\s+/).slice(0, 6);
  trimmed = words.join(' ');
  // Drop trailing punctuation.
  trimmed = trimmed.replace(/[.,;:!?]+$/, '');

  // Lowercase first char ONLY when the first word is sentence-case
  // (initial cap + lowercase rest). Preserve case for:
  //   - all-caps acronyms (QBI, IRS, LLC)
  //   - proper-noun pairs (Augusta Rule, Patel Family — detected by
  //     second word also starting with A-Z)
  //   - mixed-case (S-corp, K-1)
  const firstWord = trimmed.split(/\s+/)[0] ?? '';
  const isAllCaps =
    firstWord.length > 1 && firstWord === firstWord.toUpperCase();
  const isMixedCase = /[A-Z].*[a-z].*[A-Z]/.test(firstWord);
  const second = trimmed.split(/\s+/)[1] ?? '';
  // Restrict to ASCII A-Z — symbols like § are not "uppercase" for
  // this purpose (they don't signal a proper noun continuation).
  const secondIsCapitalized = /^[A-Z]/.test(second);

  if (
    trimmed.length > 1 &&
    /^[A-Z]/.test(firstWord) &&
    !isAllCaps &&
    !isMixedCase &&
    !secondIsCapitalized
  ) {
    trimmed = trimmed[0]!.toLowerCase() + trimmed.slice(1);
  }
  return trimmed;
}

/**
 * Compose the quantified-impact half of the alert. Includes the
 * tier label when tier > 1 (Tier 1 positions are settled law; the
 * tier disclosure is most legible on the gray-area positions).
 */
export function humanImpact(position: TaxPosition): string {
  const dollars = position.estimatedImpact.dollars;
  const formatted =
    dollars >= 1000
      ? `$${(dollars / 1000).toFixed(dollars >= 10000 ? 0 : 1)}K`
      : `$${dollars.toLocaleString()}`;
  const prefix =
    position.estimatedImpact.certainty === 'precise' ? '' : 'est. ';
  const base = `${prefix}${formatted} savings`;
  if (position.tier === 1) return base;
  const tierFragment = `Tier ${position.tier}, ${TIER_LABELS[position.tier]}`;
  if (position.disclosureRequired) {
    return `${base}, ${tierFragment} (8275 required)`;
  }
  return `${base}, ${tierFragment}`;
}

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
  /**
   * Optional knowledge retriever override. Default: a freshly
   * constructed `PostgresRetriever` scoped to
   * `input.context.tenantId`, using `VOYAGE_API_KEY` from the
   * environment for hybrid BM25 + cosine. Tests pass an explicit
   * retriever (real PostgresRetriever, NullRetriever, or stub) to
   * avoid touching the DB.
   *
   * Per CLAUDE.md L4: hybrid BM25 + cosine retrieval grounds Discovery
   * citations in the authority library — Antonio's PTIN is on every
   * return, so we minimize the model's reliance on training-data
   * cite-recall (which can hallucinate) by injecting real library
   * chunks into the user prompt. Defaulting to a real retriever
   * (rather than NullRetriever) ensures the eval + future production
   * callers get grounding automatically, not silently (codex C7 round
   * 2 P2).
   */
  retriever?: KnowledgeRetriever;
  /**
   * Surface DRAFT-DAVID firm_memo authorities (un-validated by
   * Antonio yet) during retrieval AND during citation verification.
   * Default: false — production callers must NEVER surface drafts
   * because the reviewStatus gate is the structural separation
   * between Antonio's validated work and David's drafts.
   *
   * Set true ONLY for: smoke harnesses, eval suites, admin tooling
   * where the operator explicitly wants to see the draft pipeline.
   * MUST be applied consistently to BOTH the retriever AND the
   * citation verifier — mismatched flags cause the verifier to
   * mark every injected draft cite as unresolved (codex C7 round
   * 2 P3).
   */
  includeDrafts?: boolean;
  /**
   * Top-K authority chunks to retrieve and inject into the prompt.
   * Default 10 — calibrated for ~5K tokens of authority context
   * (each chunk ~500 tokens). Set 0 to disable retrieval augmentation
   * (model falls back to training-only citations; citation verifier
   * still runs).
   */
  retrievalTopK?: number;
  /**
   * Tax year to use for in-effect filtering on the retrieval call.
   * Defaults to undefined ("in effect today") which is correct for
   * most ad-hoc Discovery runs. Set explicitly when running a
   * Discovery scan for a prior tax year.
   */
  taxYear?: number;
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
  retrievalHitCount: number;
}> {
  assertDiscoveryEnabled();

  // ──────────────────────────────────────────────────────────────
  // Retrieval-augmented prompt construction. Pull relevant authority
  // chunks from the library before the model runs so its citations
  // are grounded in actual seeded authorities rather than recalled
  // from training. The citation verifier below catches anything the
  // model still hallucinates; the retrieval step is the FIRST line
  // of defense against PTIN-risk citations (per CLAUDE.md L4).
  // ──────────────────────────────────────────────────────────────
  const retrievalTopK = opts.retrievalTopK ?? 10;
  const includeDrafts = opts.includeDrafts === true;
  // Default to a real PostgresRetriever scoped to the call's tenant.
  // The previous `getRetriever()` default returned NullRetriever
  // unless a process-wide `setRetriever()` had been called — and no
  // such call existed, so every default-path caller (including the
  // hallucination eval) ran without grounding (codex C7 round 2 P2).
  // Constructing per-call is cheap (no DB connection until first
  // retrieve() fires).
  const retriever =
    opts.retriever ??
    new PostgresRetriever(opts.input.context.tenantId, {
      apiKey: process.env.VOYAGE_API_KEY,
      includeDrafts,
      fallbackToBM25: true,
    });
  const retrievalQuery = buildRetrievalQuery(opts.input);
  let retrievalHits: RetrievalHit[] = [];
  if (retrievalTopK > 0 && retrievalQuery.length >= 2) {
    try {
      retrievalHits = await retriever.retrieve(retrievalQuery, {
        topK: retrievalTopK,
        jurisdictions: mapJurisdictionsForRetrieval(opts.input.jurisdictions),
        taxYear: opts.taxYear,
      });
    } catch (err) {
      // Retrieval failure is non-fatal — the model still has its
      // training-data citations and the verifier runs after. Log
      // for observability but don't fail the Discovery run; that
      // would block Antonio's wedge demo on an upstream Voyage or
      // pgvector hiccup.
      console.error('[discovery] retrieval failed (non-fatal):', err);
      retrievalHits = [];
    }
  }

  const userPrompt = JSON.stringify({
    intakeAnswers: opts.input.intakeAnswers,
    documentSummaries: opts.input.documentSummaries ?? [],
    jurisdictions: opts.input.jurisdictions ?? ['federal'],
    // Authority context: pass retrieved chunks to the model so its
    // citations resolve against the library. Empty when retriever is
    // NullRetriever or when retrievalTopK === 0; in those cases the
    // model falls back to training-only citations + verifier flags.
    //
    // We DO NOT pass `h.authority.kind` here — the DB enum uses
    // snake_case (`treas_reg`, `irs_revrul`, `ca_ftb_pub`) while
    // the public Discovery schema uses hyphenated values
    // (`treas-reg`, `rev-rul`, `ftb-pub`). Injecting the DB form
    // pollutes the model's source-enum choice and causes schema
    // validation rejection when the model echoes the wrong form back
    // (codex C7 round 3 P2). The citation label + heading + text are
    // sufficient context for grounding without exposing the kind.
    authorityContext: retrievalHits.map((h) => ({
      citation: h.authority.citationLabel,
      jurisdiction: h.authority.jurisdiction,
      heading: h.chunk.heading ?? null,
      text: h.chunk.text,
    })),
  });

  const prompt = await getPrompt('discovery-agent');

  const result = await runDocketAgent({
    tenantId: opts.input.context.tenantId,
    agentId: 'discovery-agent' as AgentId,
    systemPrompt: prompt.template,
    userPrompt,
    modelTier: opts.modelTier ?? 'sonnet-4-6',
    cachedSystem: true,
    // 8192 not 4096: with retrieval-augmented prompts the model writes
    // verbose rationales + multiple citations per position. 4096 was
    // enough pre-RAG but truncates the response mid-string under the
    // new prompt shape (Bedrock smoke surfaced this 2026-05-12).
    maxTokens: 8192,
    onAction: opts.onAction,
    promptId: prompt.id,
    promptVersion: prompt.version,
  });

  // Extract JSON from response. Different providers wrap differently:
  //   - Anthropic direct: usually raw {...} (no fence)
  //   - Bedrock Converse: often wraps in ```json ... ``` markdown
  //     fence, sometimes with a preamble like "Here's the JSON:".
  //
  // Strategy: prefer balanced-brace extraction starting from the
  // first `{`. That handles both wrapped and bare cases without
  // relying on the greedy regex `/\{[\s\S]*\}/` which can match
  // past the JSON's closing `}` if the response includes trailing
  // narrative text containing another `}` (Bedrock surfaced this
  // 2026-05-12 with a fenced-JSON response that broke greedy match).
  const jsonString = extractBalancedJson(result.text);
  if (jsonString === null) {
    throw new Error(
      `discovery-agent: model returned no JSON. Raw text: ${result.text.slice(0, 500)}`,
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(
      `discovery-agent: JSON.parse failed (${(err as Error).message}). Extracted: ${jsonString.slice(0, 500)}. Raw text: ${result.text.slice(0, 500)}`,
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
        // Pass includeDrafts through to the verifier so DRAFT-DAVID
        // citations the model picked up from retrieval-injected draft
        // memos can resolve. Without this, retrieval surfaces a draft
        // memo → model cites it → verifier (with default
        // includeDrafts:false) marks it unresolved → position
        // downgraded → false regression on the very draft this run
        // asked retrieval to surface (codex C7 round 2 P3).
        const found = await lookupAuthorityByCitation(
          opts.input.context.tenantId,
          cite.cite,
          { includeDrafts },
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
    retrievalHitCount: retrievalHits.length,
  };
}

// ────────────────────────────────────────────────────────────────
// extractBalancedJson — find the first `{`-rooted balanced object in
// `raw` and return it as a string. Handles markdown-fenced output
// (```json ... ```) and bare-JSON output uniformly because it walks
// from the first `{` and tracks brace depth, ignoring text inside
// JSON string literals (so a `}` character inside a string value
// doesn't false-balance the count). Returns null if no balanced
// object is found.
// ────────────────────────────────────────────────────────────────
function extractBalancedJson(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (inString) {
      if (ch === '\\') {
        escapeNext = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }
  // Unbalanced — return null so caller surfaces the parse failure
  // with the actual raw text rather than parsing a truncated chunk.
  return null;
}

// ────────────────────────────────────────────────────────────────
// buildRetrievalQuery — compose a natural-language retrieval string
// from the structured intake. Hybrid BM25 + cosine retrieval reads
// best when the query is a few keywords + a short phrase rather
// than the full intake JSON; we extract the high-signal facts
// (filing status, state, income types, life events) and concatenate.
//
// Example output:
//   "single CA self-employment 1099-NEC home office charitable QBI deduction"
//
// Empty if there's nothing extractable — caller skips retrieval in
// that case (no signal to ground on).
// ────────────────────────────────────────────────────────────────
function buildRetrievalQuery(input: DiscoveryInput): string {
  const parts: string[] = [];
  const intake = input.intakeAnswers as Record<string, unknown>;

  // Filing status + state — primary disambiguators for which body
  // of law applies (filing-status thresholds, CA residency rules).
  if (typeof intake.filingStatus === 'string') parts.push(intake.filingStatus);
  if (typeof intake.state === 'string') parts.push(intake.state);

  // Income types — surfaces the relevant deduction families.
  // Schedule C (self-employment), Schedule E (rental), W-2, etc.
  if (intake.income && typeof intake.income === 'object') {
    const income = intake.income as Record<string, unknown>;
    for (const [key, val] of Object.entries(income)) {
      if (typeof val === 'number' && val > 0) {
        // "selfEmployment1099NEC" → "selfEmployment 1099 NEC"
        parts.push(key.replace(/([A-Z0-9]+)/g, ' $1').trim());
      }
    }
  }

  // Self-employment details — home office, vehicle, retirement
  // unlock specific deductions (§280A, §62, §401, §199A).
  if (intake.selfEmploymentDetails && typeof intake.selfEmploymentDetails === 'object') {
    const se = intake.selfEmploymentDetails as Record<string, unknown>;
    if (se.homeOffice) parts.push('home office');
    if (se.vehicleMiles) parts.push('vehicle business miles');
    if (se.retirementContributions) parts.push('retirement contributions SEP IRA Solo 401k');
    parts.push('Schedule C self-employment QBI section 199A');
  }

  // Itemized deductions hint surfaces §163, §164, §170 chunks.
  if (intake.itemizedDeductions && typeof intake.itemizedDeductions === 'object') {
    parts.push('itemized deductions mortgage SALT charitable');
  }

  // Life events — marriage, divorce, dependents, sale of home all
  // shift the law that applies.
  if (Array.isArray(intake.lifeEvents) && intake.lifeEvents.length > 0) {
    parts.push('life events', ...intake.lifeEvents.map(String));
  }

  // Document kinds — 1099-NEC, K-1, etc. each tag a body of law.
  if (input.documentSummaries) {
    for (const doc of input.documentSummaries) {
      if (doc.kind) parts.push(doc.kind);
    }
  }

  return parts.join(' ').slice(0, 800);
}

// ────────────────────────────────────────────────────────────────
// mapJurisdictionsForRetrieval — DiscoveryInput's jurisdictions
// include {federal, CA, NY, TX, FL, WA}, but PostgresRetriever only
// supports {federal, CA, firm} in v0 (the only seeded jurisdictions).
// Non-CA states fall back to federal-only until ingestion expands.
//
// ALWAYS include 'firm' so Antonio-validated position memos surface
// alongside federal/state authorities. Without 'firm' the retriever's
// jurisdiction filter EXCLUDES firm_memo rows entirely, so the seeded
// position library (the differentiator vs Big-4-targeted competitors
// per CLAUDE.md L3) never reaches Discovery's context (codex C7 round
// 1 P2). DRAFT-DAVID memos are still default-denied by the
// reviewStatus gate in searchAuthorities — `includeDrafts:true` is
// required upstream to surface those.
// ────────────────────────────────────────────────────────────────
function mapJurisdictionsForRetrieval(
  inputJurisdictions: DiscoveryInput['jurisdictions'],
): Array<'federal' | 'CA' | 'firm'> {
  const supported: Array<'federal' | 'CA' | 'firm'> = ['federal', 'firm'];
  if (!inputJurisdictions || inputJurisdictions.length === 0) {
    return supported;
  }
  if (inputJurisdictions.includes('CA')) supported.push('CA');
  // NY/TX/FL/WA omitted: no rows in the v0 authority seed. Caller
  // can extend this map once state ingestion lands.
  return supported;
}
