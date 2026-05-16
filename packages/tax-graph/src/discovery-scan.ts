// Discovery Scan — deterministic Position Library scanner.
//
// ⚠️ SCOPE CLARIFIER (2026-05-15 audit fix)
// ───────────────────────────────────────────────────────────────────
// This is NOT the production Discovery Scan path. The production
// path is the LLM-driven Discovery agent at
// `services/workers/src/agents/discovery-agent.ts` (728 LOC,
// RAG-grounded via `PostgresRetriever` + BM25 + Voyage-3-Large +
// RRF fusion + Sonnet 4.6 classifier) plus the composeDiscoveryScan
// orchestrator at `services/workers/src/flows/discovery-scan.ts`.
// The production substrate sources cited authority from a
// versioned `authority_chunks` table (dated `effective_from` /
// `superseded_at` per POSITION-FRAMEWORK.md §5: "retrieval over a
// curated, dated authority library. The AI never relies on
// parametric recall for a citation it could be wrong about").
//
// This deterministic scanner exists as:
//   1. A typed reference for the Position Library taxonomy (the 20
//      v0 entries here mirror the source memos at
//      content/position-library/v0/positions/p001..p020-*.md +
//      their ingested form at authority_chunks).
//   2. A cheap-lowbar comparator for the LLM Discovery agent — run
//      both, diff the surfaced positions, flag discrepancies.
//   3. An offline-without-LLM-cost development aid for testing the
//      PDF adapter + downstream pipeline shape without burning
//      Anthropic credits or needing a live RAG corpus.
//
// What this scanner is NOT:
//   - The wedge for the 100-customers-by-8/1 acquisition push (that
//     runs through the LLM agent).
//   - The path the /scan landing form should call when wired
//     (that's `composeDiscoveryScan`).
//   - A source of cited authority for delivery to prospects — its
//     citations are frozen from a TS module rather than retrieved
//     from a dated authority library, so they can drift from the
//     authoritative version over time.
//
// Audit found that I (Claude) shipped this scanner today
// (2026-05-15) WITHOUT grepping services/workers/ first to discover
// the LLM Discovery agent. The duplicate-architecture mistake is
// real; the scanner stays in the repo as a dev/debug aid + this
// banner exists so the next reader doesn't repeat my mistake.
// ───────────────────────────────────────────────────────────────────
//
// Complement to the LLM-driven runDiscovery in services/workers. This
// pure-logic scanner enumerates POSITION_LIBRARY_V0 against a
// taxpayer's intake state + optional document summaries, runs the
// trigger taxonomy, and emits structured DiscoveredPosition[] with
// cited authority frozen from the catalog.
//
// Why deterministic over LLM:
//   1. Predictability — every position has a structured shape.
//      Demos don't hallucinate.
//   2. Cited authority safety — citations come from the catalog
//      (Antonio-reviewed) not the model. Zero risk of citation
//      hallucination.
//   3. Speed — sub-millisecond enumeration. The LLM agent is for
//      ENRICHMENT (per-client explanation + per-client tuning of
//      sustainability + savings); the scanner is for the SURFACE
//      detection.
//   4. Testability — given fixed input, output is identical. Easy
//      to lock with unit tests that Antonio can read.
//
// v0 inputs: IntakeState (taxpayer's intake answers). v1.5 adds
// document summaries from the doc-classifier, prior-year tax return
// line items, bank-feed transaction patterns.
//
// v0 outputs: DiscoveredPosition[] — sorted by tier asc + confidence
// desc. The caller (worker / agent) hands these to the UI surface
// (command-room Discovery queue) and the audit-defense PDF builder.
//
// Threshold: surfaceConfidence < 0.3 entries are dropped. The
// noisy-OR compound rule (positions.ts) means a single weak trigger
// produces a low confidence; multiple triggers compound. The 0.3
// floor avoids surfacing every position in the catalog on every
// scan.

import type { IntakeState } from '@docket/shared';
import {
  compoundConfidence,
  type DiscoveredPosition,
  POSITION_LIBRARY_V0,
  type PositionLibraryEntry,
  type PositionTrigger,
  type PositionTriggerSignal,
  TIER_RANK,
} from './positions.js';

// ────────────────────────────────────────────────────────────────
// Signal extraction — read IntakeState + emit (signal, match) tuples
// the scanner can pattern-match against POSITION_LIBRARY_V0 triggers.
// ────────────────────────────────────────────────────────────────

/**
 * One signal extracted from intake state. Multiple may share a
 * signal type (e.g., a client with both W-2 and SE income emits two
 * `income_type` signals).
 */
export type ScanSignal = {
  signal: PositionTriggerSignal;
  match: string;
};

/**
 * Extract scan signals from an IntakeState. Pure function — no I/O.
 *
 * The signal taxonomy maps to the catalog's PositionTriggerSignal
 * enum. Each branch reads the relevant IntakeState field and emits
 * the matching scan signal. Order doesn't matter; the noisy-OR
 * compound rule is symmetric.
 *
 * Signals emitted from v0 IntakeState:
 *   - filing_status: 'mfs' | 'mfj' | 'single' | 'hoh' | 'qw'
 *   - income_type: 'w2_only' | 'self_employment' | 'rental' |
 *     'rental_multiple_properties' | 'low_to_moderate_w2'
 *   - entity_type: 'sole_prop' | 's_corp' | 'c_corp' | 'partnership'
 *   - jurisdiction: 'high_tax_state' | 'ca'
 *   - lifecycle_event: 'has_minor_dependents' | 'dependent_starts_college' |
 *     'dependent_under_13' | 'property_acquisition'
 *   - business_pattern: 'home_address_eq_business_address' |
 *     'owner_holds_meetings_at_home' | 'owner_pays_business_expense_personally' |
 *     'no_w2_income'
 *   - expense_pattern: 'health_insurance_premiums' | 'vehicle_expense' |
 *     'charitable_gifts' | 'childcare_expenses' | 'retirement_contribution' |
 *     'low_itemized' | 'home_utilities_high'
 *   - document_present: 'form_1098' | 'form_1098_t' | 'w2_with_state_tax' |
 *     'property_tax_statement' | 'charity_receipt' | 'k1_from_pass_through' |
 *     'form_1095_a' | 'rental_property_settlement'
 *
 * Future signal classes (v1.5+):
 *   - doc-classifier outputs (1099-NEC parsed → income_type: self_employment)
 *   - prior-year return line items (YoY income jump → strategy moments)
 *   - bank-feed transaction patterns (recurring charitable gifts)
 */
export function extractScanSignals(state: IntakeState): ScanSignal[] {
  const out: ScanSignal[] = [];

  // ─── filing_status ───
  const filing = state.filing?.status;
  if (filing) {
    out.push({ signal: 'filing_status', match: filing });
  }

  // ─── income_type ───
  const incomeTypes = state.income?.types ?? [];
  if (incomeTypes.includes('w2') && incomeTypes.length === 1) {
    out.push({ signal: 'income_type', match: 'w2_only' });
  }
  if (incomeTypes.includes('self')) {
    out.push({ signal: 'income_type', match: 'self_employment' });
  }
  if (incomeTypes.includes('rental')) {
    out.push({ signal: 'income_type', match: 'rental' });
    const rentalCount = state.rental?.properties?.length ?? 0;
    if (rentalCount >= 2) {
      out.push({ signal: 'income_type', match: 'rental_multiple_properties' });
    }
  }
  // 'low_to_moderate_w2' — flagged when W-2 is the only income type
  // (intake doesn't carry numeric income today). The savers credit
  // surfaces broadly here and the catalog phase-out check happens at
  // EA review time, not at scan time.
  if (incomeTypes.includes('w2') && !incomeTypes.includes('self')) {
    out.push({ signal: 'income_type', match: 'low_to_moderate_w2' });
  }

  // ─── entity_type ───
  //
  // Two intake surfaces carry entity-type data:
  //   - business.entityType   (biz-return path; populated when
  //                            service.kind === 'biz')
  //   - selfEmployment.entityType  (1040-return path with SE income;
  //                                 a freelancer self-electing S-corp
  //                                 still files Schedule C/SE)
  //
  // Read BOTH (codex caught the missing selfEmployment.entityType
  // path 2026-05-15). If neither is populated but the client has SE
  // income, default to sole_prop.
  const businessEntityRaw = state.business?.entityType?.toLowerCase() ?? '';
  const seEntityRaw = state.selfEmployment?.entityType?.toLowerCase() ?? '';
  const entityRaw = businessEntityRaw || seEntityRaw;
  if (entityRaw) {
    if (entityRaw.includes('sole') || entityRaw.includes('prop')) {
      out.push({ signal: 'entity_type', match: 'sole_prop' });
    } else if (entityRaw.includes('s-corp') || entityRaw.includes('s corp')) {
      out.push({ signal: 'entity_type', match: 's_corp' });
    } else if (entityRaw.includes('c-corp') || entityRaw.includes('c corp')) {
      out.push({ signal: 'entity_type', match: 'c_corp' });
    } else if (entityRaw.includes('partnership') || entityRaw === 'llc') {
      // LLC defaults treated as partnership for scan purposes; LLC
      // S-elect would say 'S-Corp' upstream.
      out.push({ signal: 'entity_type', match: 'partnership' });
    }
  }
  // self-employment income WITHOUT any entity-type signal → sole_prop default
  if (
    incomeTypes.includes('self') &&
    !entityRaw &&
    state.service?.kind !== 'biz'
  ) {
    out.push({ signal: 'entity_type', match: 'sole_prop' });
  }

  // ─── jurisdiction ───
  const primaryState = state.state?.primaryState?.trim() ?? '';
  const stateUpper = primaryState.toUpperCase().slice(0, 2);
  const HIGH_TAX_STATES = new Set([
    'CA',
    'NY',
    'NJ',
    'IL',
    'OR',
    'MN',
    'MA',
    'DC',
    // Codex catch 2026-05-15 — also high-marginal-rate states that
    // bind the §164 SALT cap for typical earners.
    'HI',
    'CT',
    'VT',
    'ME',
  ]);
  const HIGH_TAX_FULL_NAMES = new Set([
    'california',
    'new york',
    'new jersey',
    'illinois',
    'oregon',
    'minnesota',
    'massachusetts',
    'district of columbia',
    'hawaii',
    'connecticut',
    'vermont',
    'maine',
  ]);
  if (
    HIGH_TAX_STATES.has(stateUpper) ||
    HIGH_TAX_FULL_NAMES.has(primaryState.toLowerCase())
  ) {
    out.push({ signal: 'jurisdiction', match: 'high_tax_state' });
  }
  if (
    stateUpper === 'CA' ||
    primaryState.toLowerCase() === 'california'
  ) {
    out.push({ signal: 'jurisdiction', match: 'ca' });
  }

  // ─── lifecycle_event — dependents ───
  const depCount = state.dependents?.count ?? 0;
  if (depCount > 0) {
    out.push({ signal: 'lifecycle_event', match: 'has_minor_dependents' });
    // Children under 13 surfaces dependent care credit. We don't have
    // per-dependent age data in v0 intake, so we emit
    // 'dependent_under_13' optimistically when depCount > 0; the EA
    // refines at review time.
    out.push({ signal: 'lifecycle_event', match: 'dependent_under_13' });
  }

  // ─── expense_pattern — derived from intake toggles ───
  const ded = state.deductions;
  if (ded?.charity) {
    out.push({ signal: 'expense_pattern', match: 'charitable_gifts' });
  }
  if (ded?.childcare) {
    out.push({ signal: 'expense_pattern', match: 'childcare_expenses' });
  }
  if (state.taxQuestions?.retirement) {
    out.push({ signal: 'expense_pattern', match: 'retirement_contribution' });
  }
  if (state.taxQuestions?.healthAll) {
    out.push({ signal: 'expense_pattern', match: 'health_insurance_premiums' });
  }

  // ─── business_pattern — biz-path signals ───
  // S-corp owner without an accountable plan setup → flag for the
  // accountable_plan position. We don't have an explicit "no
  // accountable plan" intake field, so the scan emits the signal
  // whenever S-corp is detected; the position card surfaces it for
  // EA verification.
  const isOwnerOperator =
    out.some((s) => s.signal === 'entity_type' && s.match === 's_corp') ||
    out.some((s) => s.signal === 'entity_type' && s.match === 'sole_prop');
  if (isOwnerOperator) {
    out.push({
      signal: 'business_pattern',
      match: 'owner_pays_business_expense_personally',
    });
  }

  // Owner-operator + biz address matches home address → home office
  // signal. The intake collects both business address + personal
  // address; if they coincide, surface.
  const personalStreet = state.personal?.street?.trim().toLowerCase() ?? '';
  const businessStreet = state.business?.street?.trim().toLowerCase() ?? '';
  if (
    isOwnerOperator &&
    personalStreet.length > 0 &&
    personalStreet === businessStreet
  ) {
    out.push({
      signal: 'business_pattern',
      match: 'home_address_eq_business_address',
    });
  }

  // No W-2 income (only SE) → REP signal candidate
  if (
    incomeTypes.includes('self') &&
    !incomeTypes.includes('w2') &&
    incomeTypes.includes('rental')
  ) {
    out.push({ signal: 'business_pattern', match: 'no_w2_income' });
  }

  return out;
}

// ────────────────────────────────────────────────────────────────
// Scanner — enumerate catalog vs signals.
// ────────────────────────────────────────────────────────────────

export type ScanResult = {
  /** Discovered positions sorted by tier asc + surfaceConfidence desc. */
  positions: DiscoveredPosition[];
  /** Library entries dropped because no triggers matched OR confidence
   *  fell below threshold. Caller can render these as "considered but
   *  did not apply" — useful for audit defense + EA review. */
  rejected: Array<{
    positionType: string;
    displayName: string;
    reason: 'no_trigger_match' | 'below_confidence_threshold';
    matchedTriggers: PositionTrigger[];
    surfaceConfidence: number;
  }>;
  /** Diagnostic: every signal the scanner extracted. */
  signals: ScanSignal[];
};

export type ScanOptions = {
  /** Surface threshold — entries with compound confidence below this
   *  are dropped to `rejected`. Default 0.3 (single weak trigger
   *  ~= 0.3-0.5 floor; multiple triggers compound above).  */
  threshold?: number;
  /** Optional clientId / taxYear for stamping the DiscoveredPosition
   *  ids. When omitted, positions get synthetic ids; caller must
   *  rewrite before persisting. */
  clientId?: string;
  taxYear?: number;
  /** Optional artifact ids — when this scan was triggered by specific
   *  doc/intake/email artifacts, the caller passes them so each
   *  DiscoveredPosition carries provenance. */
  sourceArtifactIds?: string[];
};

const DEFAULT_THRESHOLD = 0.3;

/**
 * Run the Position Library scan over an IntakeState. Returns a
 * structured ScanResult with discovered positions, rejected
 * candidates, and the diagnostic signal list.
 *
 * Pure function. Same input → same output. No I/O. No LLM call.
 * Sub-millisecond on a ~20-entry catalog.
 */
export function scanPositionLibrary(
  state: IntakeState,
  options: ScanOptions = {},
): ScanResult {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const signals = extractScanSignals(state);

  // Build a fast lookup from (signal, match) → present.
  const signalSet = new Set<string>();
  for (const s of signals) {
    signalSet.add(`${s.signal}:${s.match}`);
  }

  const positions: DiscoveredPosition[] = [];
  const rejected: ScanResult['rejected'] = [];

  for (const entry of POSITION_LIBRARY_V0) {
    // Filter triggers to those that fired for this client.
    const matchedTriggers = entry.triggers.filter((t) =>
      signalSet.has(`${t.signal}:${t.match}`),
    );

    if (matchedTriggers.length === 0) {
      rejected.push({
        positionType: entry.positionType,
        displayName: entry.displayName,
        reason: 'no_trigger_match',
        matchedTriggers: [],
        surfaceConfidence: 0,
      });
      continue;
    }

    const surfaceConfidence = compoundConfidence(
      matchedTriggers.map((t) => t.confidenceBoost),
    );

    if (surfaceConfidence < threshold) {
      rejected.push({
        positionType: entry.positionType,
        displayName: entry.displayName,
        reason: 'below_confidence_threshold',
        matchedTriggers,
        surfaceConfidence,
      });
      continue;
    }

    positions.push(buildDiscoveredPosition(entry, matchedTriggers, surfaceConfidence, options));
  }

  // Sort: lower tier rank first (Tier 1 before Tier 4), then higher
  // confidence first within each tier.
  positions.sort((a, b) => {
    const tierDelta = TIER_RANK[a.tier] - TIER_RANK[b.tier];
    if (tierDelta !== 0) return tierDelta;
    return b.surfaceConfidence - a.surfaceConfidence;
  });

  return { positions, rejected, signals };
}

function buildDiscoveredPosition(
  entry: PositionLibraryEntry,
  matchedTriggers: PositionTrigger[],
  surfaceConfidence: number,
  options: ScanOptions,
): DiscoveredPosition {
  // Deterministic id generation only — no Math.random, no Date.now,
  // no new Date(). When clientId + taxYear are provided, the id is
  // a stable composite. When omitted, a clearly-synthetic prefix
  // signals "you forgot to pass context; rewrite before persist."
  // Codex caught the impurity on review 2026-05-15.
  const id =
    options.clientId && options.taxYear
      ? `${options.clientId}-${entry.positionType}-${options.taxYear}`
      : `synthetic-${entry.positionType}`;
  // taxYear stamp falls back to 0 (sentinel) when caller didn't pass
  // one — caller MUST set before persisting. We don't call new Date()
  // here because that introduces wall-clock dependence into a
  // function meant to be pure.
  const taxYearStamp = options.taxYear ?? 0;

  return {
    id,
    clientId: options.clientId ?? '',
    taxYear: taxYearStamp,
    positionType: entry.positionType,
    displayName: entry.displayName,
    shortDescription: entry.shortDescription,
    tier: entry.tier,
    ircSection: entry.ircSection,
    treasReg: entry.treasReg,
    controllingCase: entry.controllingCase,
    revRuling: entry.revRuling,
    irsPub: entry.irsPub,
    disclosureRequired: entry.disclosureRequired,
    surfaceConfidence,
    sustainabilityEstimatePct: entry.baselineSustainabilityPct,
    estimatedSavingsLow: entry.estimatedSavingsLow,
    estimatedSavingsHigh: entry.estimatedSavingsHigh,
    documentationChecklist: entry.documentationChecklist,
    matchedTriggers,
    sourceArtifactIds: options.sourceArtifactIds ?? [],
  };
}
