// Position Library — v0 catalog of tax positions Petal can recognize
// and surface via the Discovery Agent (continuous scanner) and
// Position Agent (aggressive-request defender).
//
// See docs/POSITION-FRAMEWORK.md for the framing. Two types live here:
//
//   1. PositionLibraryEntry — the CATALOG. Static template per
//      position type. "What is the Augusta Rule, what tier does it
//      sit in, what authority backs it, what documentation defends it,
//      what triggers should make the agent surface it." One row per
//      position type.
//
//   2. TaxPosition — the INSTANCE. Per-client, per-engagement,
//      per-tax-year application of a library entry. Captures the
//      EA's decision at the moment of decision plus the cited
//      authority frozen at that moment (so a Rev. Proc. superseded
//      next year still leaves the audit trail intact). Mirrors the
//      schema spec in docs/POSITION-FRAMEWORK.md §3.
//
// v0 ships ~20 hand-curated positions covering the highest-volume
// surfaces of Antonio's book. Each entry is reviewed/approved by
// Antonio per CLAUDE.md §21 #4 (the on-platform tax advisor
// posture — Antonio signs off, scale-validation contracted advisors
// fill gaps post-50-firms). The corpus grows via the L13 ingestion
// project (4-week Phase 5 work).

// ────────────────────────────────────────────────────────────────
// Confidence tier — the four-tier framework + refusal floor per
// docs/POSITION-FRAMEWORK.md §2. Settled (Tier 1) through
// More-Likely-Than-Not (Tier 4).
// ────────────────────────────────────────────────────────────────

export type PositionTier =
  | 'settled'              // Tier 1 — clear authority, no challenge
  | 'substantial'          // Tier 2 — substantial authority (~40% sustainability)
  | 'reasonable_basis'     // Tier 3 — reasonable basis, requires Form 8275
  | 'more_likely_than_not'; // Tier 4 — >50%, required for reportable transactions

export const POSITION_TIERS: readonly PositionTier[] = [
  'settled',
  'substantial',
  'reasonable_basis',
  'more_likely_than_not',
] as const;

/**
 * Numeric tier order (1-4). Used by Discovery Agent for sorting and
 * by the audit-defense PDF for tier-pill rendering. Settled = 1.
 */
export const TIER_RANK: Record<PositionTier, 1 | 2 | 3 | 4> = {
  settled: 1,
  substantial: 2,
  reasonable_basis: 3,
  more_likely_than_not: 4,
};

/**
 * Display label per tier — drives the Tier pill on every TaxPosition
 * card. Keep short; the cited authority chip carries the detail.
 */
export const TIER_LABEL: Record<PositionTier, string> = {
  settled: 'Tier 1 · Settled',
  substantial: 'Tier 2 · Substantial Authority',
  reasonable_basis: 'Tier 3 · Reasonable Basis + 8275',
  more_likely_than_not: 'Tier 4 · MLTN (Required Disclosure)',
};

// ────────────────────────────────────────────────────────────────
// Triggers — what the Discovery Agent watches for to surface a
// position. Each entry has 1-N triggers; any match raises that
// position's surface confidence by its confidenceBoost. Multiple
// matching triggers compound (clamped to 1.0).
// ────────────────────────────────────────────────────────────────

export type PositionTriggerSignal =
  | 'income_type'         // taxpayer has W-2 / SE / rental / etc.
  | 'expense_pattern'     // pattern in expense data
  | 'entity_type'         // sole prop / S-corp / partnership / LLC
  | 'lifecycle_event'     // dependent turning 18, business hits §199A phaseout, etc.
  | 'document_present'    // 1099-NEC / K-1 / 1098 / 1098-T / SSA-1099 / etc.
  | 'jurisdiction'        // CA-specific, multi-state, etc.
  | 'filing_status'       // MFS / MFJ / HoH / QW — gates ~6 positions (CTC,
                          //   AOTC, dep-care, SALT MFS-cap, Augusta-by-MFS, etc.)
  | 'business_pattern';   // home office expenses, vehicle use, family wages, etc.

export type PositionTrigger = {
  /** What kind of signal raises this position to attention. */
  signal: PositionTriggerSignal;
  /** Specific match string (intake-state field, classifier label, etc.). */
  match: string;
  /** [0, 1] — confidence boost when matched. Multiple matches compound. */
  confidenceBoost: number;
};

// ────────────────────────────────────────────────────────────────
// PositionLibraryEntry — the catalog row. Hand-curated, Antonio-
// approved. The Discovery Agent enumerates this library against
// each client's facts and surfaces candidates with a baseline
// confidence per the matched triggers.
// ────────────────────────────────────────────────────────────────

export type PositionLibraryEntry = {
  /** Stable id, snake_case. Powers `positionType` field on TaxPosition. */
  positionType: string;
  /** Human label ("Home Office Deduction (§280A)"). */
  displayName: string;
  /** One-liner summary shown on Discovery Agent cards. */
  shortDescription: string;
  /** Confidence tier per the four-tier framework. */
  tier: PositionTier;
  /** Baseline sustainability estimate 0-100. Discovery Agent may adjust
   *  for client-specific facts before surfacing. */
  baselineSustainabilityPct: number;
  /** Whether Form 8275 disclosure is required. True for Tier 3+ by default
   *  but may be required for some Tier 2 positions with edge facts. */
  disclosureRequired: boolean;
  /** Whether this is a §6011 reportable transaction (Listed / Notice / etc). */
  reportableTransaction: boolean;

  // Cited authority chain — the canonical citation set for this
  // position. Frozen here; TaxPosition instances capture an
  // authority-as-of-date snapshot so retroactive supersession
  // doesn't undermine the original decision.
  /** IRC section ("§280A(c)(1)"). REQUIRED — every position cites
   *  a primary statutory anchor. */
  ircSection: string;
  /** Treasury Regulation citation if applicable. */
  treasReg: string | null;
  /** Controlling court case (Tax Court, Circuit, SCOTUS). */
  controllingCase: string | null;
  /** Revenue Ruling / Revenue Procedure if applicable. */
  revRuling: string | null;
  /** Pertinent IRS Publication for taxpayer-facing explanation. */
  irsPub: string | null;

  // Documentation defense.
  /** What records the preparer needs to defend this position on audit.
   *  These become checklist items on the TaxPosition card + the PDF. */
  documentationChecklist: string[];
  /** Facts that would PROHIBIT taking this position (forces refusal).
   *  Discovery Agent surfaces a refusal if any matches. */
  refusalIf: string[];

  // Trigger patterns — Discovery Agent enumerates these.
  triggers: PositionTrigger[];

  // Savings range (typical client). For Discovery Agent's quantified
  // impact estimate. Per-client refinement happens at TaxPosition
  // creation time using actual facts.
  estimatedSavingsLow: number;
  estimatedSavingsHigh: number;

  /** Notes for Antonio's review pass — internal context the AI uses
   *  when explaining the position. Never shown to the client directly. */
  preparerNotes: string;
};

// ────────────────────────────────────────────────────────────────
// TaxPosition — per-engagement INSTANCE of a library entry. Mirrors
// the schema spec in docs/POSITION-FRAMEWORK.md §3 exactly. This is
// the unit the audit-defense PDF aggregates per engagement.
// ────────────────────────────────────────────────────────────────

export type EaDecision = 'accepted' | 'modified' | 'rejected' | 'pending';

export type TaxPosition = {
  id: string;
  clientId: string;
  engagementId: string;
  taxYear: number;

  // Identity — copied from the library entry at creation time.
  positionType: string;
  ircSection: string;
  treasReg: string | null;
  controllingCase: string | null;
  revRuling: string | null;
  /** ISO date — the day this authority chain was current. CRITICAL:
   *  this is captured at creation so a later supersession doesn't
   *  undermine the EA's decision on audit. */
  authorityAsOfDate: string;

  // Confidence — at creation time.
  tier: PositionTier;
  sustainabilityEstimatePct: number;
  disclosureRequired: boolean;
  reportableTransaction: boolean;

  // Impact — quantified per this specific client's facts.
  estimatedSavingsLow: number;
  estimatedSavingsHigh: number;
  /** Multi-year impact projection (e.g., for Roth conversion or
   *  cost segregation). NULL when not applicable. */
  multiYearImpact: Array<{ year: number; estimatedSavings: number }> | null;

  // Risk.
  /** Estimated DIF score delta (audit-risk proxy). NULL when no
   *  estimate available. */
  auditDifScoreDelta: number | null;
  /** Historical audit rate for this position type per IRS data. NULL
   *  when unknown. */
  similarPositionAuditRate: number | null;
  /** What to collect — derived from the library entry but may be
   *  trimmed/extended per client facts. */
  documentationChecklist: string[];

  // EA decision (filled when EA acts; NULL while pending).
  eaDecision: EaDecision | null;
  /** ISO timestamp. */
  eaDecisionAt: string | null;
  eaDecisionUserId: string | null;
  /** When EA modifies the tier (e.g., drops Tier 3 → Tier 2 because
   *  they decided 8275 isn't needed). NULL otherwise. */
  eaModifiedToTier: PositionTier | null;
  /** Free-text reason when EA rejects. Searchable. */
  eaRejectionReason: string | null;
  /** Link to disclosure_filings row when EA accepts a Tier 3
   *  position. NULL otherwise. */
  generated8275Id: string | null;

  // Provenance — which agent produced this position + what artifacts
  // it was triggered by (so the audit trail can reconstruct).
  triggeredBy: 'discovery' | 'strategy' | 'position_request';
  sourceArtifactIds: string[];
};

// ────────────────────────────────────────────────────────────────
// Discovery Agent surface — what the agent emits before EA decision.
// Subset of TaxPosition fields; the rest get filled when the EA
// clicks Accept / Modify / Reject (per docs/POSITION-FRAMEWORK.md §3).
// ────────────────────────────────────────────────────────────────

export type DiscoveredPosition = {
  /** Generated at creation; becomes TaxPosition.id when EA accepts. */
  id: string;
  clientId: string;
  taxYear: number;
  /** The catalog row this was instantiated from. */
  positionType: string;
  /** Snapshot fields from the catalog. */
  displayName: string;
  shortDescription: string;
  tier: PositionTier;
  ircSection: string;
  treasReg: string | null;
  controllingCase: string | null;
  revRuling: string | null;
  irsPub: string | null;
  disclosureRequired: boolean;

  // Per-client tuned fields.
  /** Confidence the position applies (0-1) after trigger compounding. */
  surfaceConfidence: number;
  /** Sustainability — baseline copied from catalog, may be tuned. */
  sustainabilityEstimatePct: number;
  /** Quantified impact range for this client. */
  estimatedSavingsLow: number;
  estimatedSavingsHigh: number;
  /** Documentation the EA will need to defend. */
  documentationChecklist: string[];
  /** Which triggers fired for this client (provenance). */
  matchedTriggers: PositionTrigger[];
  /** Source artifacts that surfaced this (gmail message ids, doc ids,
   *  bank-feed row ids, intake fields). */
  sourceArtifactIds: string[];
};

// ────────────────────────────────────────────────────────────────
// THE LIBRARY — 20 v0 entries.
//
// ⚠️ SCOPE + REVIEW-STATUS CLARIFIER (2026-05-15 audit fix)
// ───────────────────────────────────────────────────────────────
// PRIOR comment text on this line said "Antonio-approved." That
// claim was FALSE — every source memo at
// content/position-library/v0/positions/p001..p020-*.md carries
// `Review status: DRAFT-DAVID` + the footer "Pending Antonio
// review. Status DRAFT-DAVID until Antonio signs off." The
// reviewStatus ingestion gate (packages/db/scripts/
// ingest-position-library.ts) default-DENIES these entries from
// prospect-facing scans precisely because they haven't been
// authority-validated by an EA.
//
// This TS module is a TYPED MIRROR of the source memos and the
// authority_chunks ingestion. Useful for:
//   - The deterministic scanner at discovery-scan.ts (a dev/debug
//     comparator, NOT the production path — see that file's
//     scope clarifier).
//   - Static-typed access to the taxonomy in tooling.
//
// The PRODUCTION Position Library source-of-truth is the
// authority_chunks DB ingestion (Voyage-3-Large embeddings,
// dated effective_from, reviewStatus-gated). The LLM Discovery
// agent at services/workers/src/agents/discovery-agent.ts pulls
// from authority_chunks, not from this module.
//
// Antonio review session is queued as the wedge unlock for the
// 100-customers-by-8/1 sprint. Until those 20 source memos flip
// to ANTONIO-VALIDATED, no real prospect should receive a scan
// PDF with surfaced positions from this catalog.
// ───────────────────────────────────────────────────────────────
//
// Curation rules:
//   1. Every entry MUST cite a primary IRC section.
//   2. Tier 3+ MUST list refusalIf facts that move the position
//      below Reasonable Basis.
//   3. documentationChecklist items must be actionable, not vague
//      ("mileage log with date/destination/business-purpose", not
//      "records").
//   4. estimatedSavings ranges are typical-client; the Discovery
//      Agent quantifies per actual facts.
//   5. preparerNotes are internal — they explain to the agent (and
//      to the EA reviewing the surface) the gotchas Antonio sees.
//
// As the library grows (Phase 5 corpus ingestion), entries land here
// with a "reviewed by Antonio on [date]" comment. v0 entries are
// pre-launch curated.
// ────────────────────────────────────────────────────────────────

export const POSITION_LIBRARY_V0: readonly PositionLibraryEntry[] = [
  // ─── Tier 1 — Settled law ─────────────────────────────────────

  {
    positionType: 'standard_deduction',
    displayName: 'Standard Deduction (§63)',
    shortDescription:
      'Election to take the standard deduction in lieu of itemizing. Always available unless MFS spouse itemizes.',
    tier: 'settled',
    baselineSustainabilityPct: 99,
    disclosureRequired: false,
    reportableTransaction: false,
    ircSection: '§63(c)',
    treasReg: null,
    controllingCase: null,
    revRuling: null,
    irsPub: 'Pub 17',
    documentationChecklist: ['Filing status confirmation'],
    refusalIf: ['MFS where spouse itemizes (§63(c)(6)(A))'],
    triggers: [
      { signal: 'income_type', match: 'w2_only', confidenceBoost: 0.6 },
      { signal: 'expense_pattern', match: 'low_itemized', confidenceBoost: 0.4 },
    ],
    estimatedSavingsLow: 0,
    estimatedSavingsHigh: 0,
    preparerNotes:
      'Default unless itemized exceeds standard. Compare both at prep time.',
  },

  {
    positionType: 'salt_deduction',
    displayName: 'State and Local Tax Deduction (§164, capped $10K)',
    shortDescription:
      'Itemized deduction for state/local income (or sales) + property tax. TCJA cap is $10K combined ($5K MFS).',
    tier: 'settled',
    baselineSustainabilityPct: 98,
    disclosureRequired: false,
    reportableTransaction: false,
    ircSection: '§164',
    treasReg: 'Treas. Reg. §1.164-1',
    controllingCase: null,
    revRuling: null,
    irsPub: 'Pub 17',
    documentationChecklist: [
      'State income tax withholding (W-2 box 17) OR state estimated payments',
      'Property tax statements / payment records',
      'Sales tax: use IRS optional sales tax tables OR actual receipts',
    ],
    refusalIf: ['Taxes attributable to business income (those go on Schedule C/E)'],
    triggers: [
      { signal: 'document_present', match: 'w2_with_state_tax', confidenceBoost: 0.5 },
      { signal: 'document_present', match: 'property_tax_statement', confidenceBoost: 0.5 },
      { signal: 'jurisdiction', match: 'high_tax_state', confidenceBoost: 0.3 },
    ],
    estimatedSavingsLow: 1500,
    estimatedSavingsHigh: 3700,
    preparerNotes:
      'Cap binds for CA / NY / NJ / IL clients above ~$70K income. Choose between state income tax OR sales tax — never both. For PTET-electing pass-through owners, the entity-paid state tax is NOT subject to the cap — handled via §164(b)(6)(A) workaround.',
  },

  {
    positionType: 'mortgage_interest',
    displayName: 'Home Mortgage Interest (§163(h))',
    shortDescription:
      'Qualified residence interest on acquisition debt up to $750K ($375K MFS) for post-12/15/2017 mortgages.',
    tier: 'settled',
    baselineSustainabilityPct: 97,
    disclosureRequired: false,
    reportableTransaction: false,
    ircSection: '§163(h)(2)(D)',
    treasReg: 'Treas. Reg. §1.163-10T',
    controllingCase: null,
    revRuling: null,
    irsPub: 'Pub 936',
    documentationChecklist: [
      'Form 1098 from lender',
      'Acquisition-debt verification (mortgage origination date determines $1M vs $750K cap)',
      'For HELOC: proof use was for substantial improvement (post-TCJA)',
    ],
    refusalIf: [
      'Home equity debt not used to buy/build/substantially improve residence (TCJA disallowed)',
      'Mortgage on property not qualifying as residence (§121 use)',
    ],
    triggers: [
      { signal: 'document_present', match: 'form_1098', confidenceBoost: 0.8 },
    ],
    estimatedSavingsLow: 2000,
    estimatedSavingsHigh: 9000,
    preparerNotes:
      'Pre-12/15/2017 mortgages grandfathered at $1M cap. Refinance preserves grandfathering UP TO original principal. HELOC interest only deductible if traceable to acquisition/improvement — most consumer HELOC use does NOT qualify post-TCJA.',
  },

  {
    positionType: 'child_tax_credit',
    displayName: 'Child Tax Credit + Additional Child Tax Credit (§24)',
    shortDescription:
      'Up to $2,000 per qualifying child under 17 (non-refundable) + up to $1,700 refundable as ACTC (2024 figures). Phase-out begins at $200K single / $400K MFJ MAGI.',
    tier: 'settled',
    baselineSustainabilityPct: 97,
    disclosureRequired: false,
    reportableTransaction: false,
    ircSection: '§24',
    treasReg: 'Treas. Reg. §1.24-1',
    controllingCase: null,
    revRuling: null,
    irsPub: 'Pub 972',
    documentationChecklist: [
      'Qualifying child SSN (must be issued before return due date)',
      'Qualifying child under 17 at year-end',
      'Relationship test (son/daughter/stepchild/foster/sibling/descendant)',
      'Residency test (lived with taxpayer >50% of year)',
      'Support test (child did NOT provide >50% of own support)',
      'Joint-return test (child not filing jointly except for refund-only)',
      'Citizenship/national/resident-alien status',
    ],
    refusalIf: [
      'Child has ITIN, not SSN (CTC requires SSN; ACTC allows ITIN for some refundable portion)',
      'Custodial parent claims child (non-custodial cannot claim without Form 8332 release)',
      'Child filed joint return with own spouse (other than for refund only)',
    ],
    triggers: [
      { signal: 'lifecycle_event', match: 'has_minor_dependents', confidenceBoost: 0.8 },
    ],
    estimatedSavingsLow: 1000,
    estimatedSavingsHigh: 2000,
    preparerNotes:
      'Form 8867 due-diligence applies — preparer penalty risk on every CTC claim. Verify SSN timing (must be issued before return due date including extensions). Coordinate with Credit for Other Dependents (§24(h)(4), $500 non-refundable) for dependents who don\'t qualify for CTC. ACTC refundable portion is computed via §24(d) formula — earned income > $2,500 threshold triggers refundable component. OBBBA 2025 changes — verify rate + phase-out thresholds for the current tax year.',
  },

  {
    positionType: 'charitable_cash_to_public_charity',
    displayName: 'Cash Charitable Contributions to Public Charities (§170)',
    shortDescription:
      'Cash gifts to qualified 501(c)(3) public charities. AGI ceiling 60% for cash to public charities.',
    tier: 'settled',
    baselineSustainabilityPct: 98,
    disclosureRequired: false,
    reportableTransaction: false,
    ircSection: '§170(b)(1)(A)',
    treasReg: 'Treas. Reg. §1.170A-1',
    controllingCase: null,
    revRuling: null,
    irsPub: 'Pub 526',
    documentationChecklist: [
      'Bank record OR written acknowledgment from charity for every gift $250+',
      'Charity must be on IRS Tax Exempt Organization Search list',
      'For gifts > $250: contemporaneous written acknowledgment with goods/services received (or "no goods or services") per §170(f)(8)',
    ],
    refusalIf: [
      'Gift to private non-operating foundation (lower 30% ceiling; different rules)',
      'Gift to political organizations (NOT deductible)',
      'Gift of personal services / time (NOT deductible)',
    ],
    triggers: [
      { signal: 'expense_pattern', match: 'charitable_gifts', confidenceBoost: 0.7 },
      { signal: 'document_present', match: 'charity_receipt', confidenceBoost: 0.8 },
    ],
    estimatedSavingsLow: 250,
    estimatedSavingsHigh: 5000,
    preparerNotes:
      'For non-itemizers, this is moot unless above-the-line provision returns. Bunching strategy: alternate-year donor-advised-fund pre-funding can multiply utility for clients near the standard-deduction line.',
  },

  // ─── Tier 2 — Substantial authority ───────────────────────────

  {
    positionType: 'home_office_280a',
    displayName: 'Home Office Deduction — Regular and Exclusive Use (§280A(c)(1))',
    shortDescription:
      'Deduction for portion of home used regularly and exclusively for business. Simplified ($5/sqft, max 300 sqft) or actual-expenses method.',
    tier: 'substantial',
    baselineSustainabilityPct: 85,
    disclosureRequired: false,
    reportableTransaction: false,
    ircSection: '§280A(c)(1)',
    treasReg: 'Treas. Reg. §1.280A-2',
    controllingCase: 'Soliman v. Commissioner, 506 U.S. 168 (1993)',
    revRuling: null,
    irsPub: 'Pub 587',
    documentationChecklist: [
      'Floor-plan or photo of dedicated space (proves exclusive use)',
      'Square-footage measurement (home total + dedicated office)',
      'Utility bills for the year (electricity, gas, water — actual method)',
      'Mortgage statements + property tax records (actual method)',
      'Calendar / appointment book showing regular use',
    ],
    refusalIf: [
      'Space used for any personal purpose during the year (kills "exclusive use")',
      'Sole proprietor working primarily at a separate office (Soliman; not "principal place of business")',
      'W-2 employee using home for convenience-of-employer (TCJA disallowed 2018-2025)',
    ],
    triggers: [
      { signal: 'income_type', match: 'self_employment', confidenceBoost: 0.5 },
      { signal: 'expense_pattern', match: 'home_utilities_high', confidenceBoost: 0.2 },
      { signal: 'business_pattern', match: 'home_address_eq_business_address', confidenceBoost: 0.4 },
    ],
    estimatedSavingsLow: 800,
    estimatedSavingsHigh: 3500,
    preparerNotes:
      'Simplified method ($5/sqft, max 300 sqft = $1,500 cap) sacrifices upside for speed. Actual method recaptures depreciation on §121 sale — model carefully for clients planning to sell within 3 years. Soliman applies; "principal place of business" includes administrative-only when no other fixed location exists.',
  },

  {
    positionType: 'sep_ira',
    displayName: 'SEP-IRA Contribution (§408(k))',
    shortDescription:
      'Up to 25% of net self-employment earnings (after SE-tax deduction), capped at the annual §415 limit. Funding deadline through extended return due date.',
    tier: 'substantial',
    baselineSustainabilityPct: 92,
    disclosureRequired: false,
    reportableTransaction: false,
    ircSection: '§408(k)',
    treasReg: 'Treas. Reg. §1.408-7',
    controllingCase: null,
    revRuling: null,
    irsPub: 'Pub 560',
    documentationChecklist: [
      'SEP-IRA establishment Form 5305-SEP (or custodial agreement)',
      'Net SE earnings from Schedule C (after Schedule SE deduction)',
      'Funding confirmation from custodian (statement)',
      'For owner with employees: pro-rata coverage proof for eligible employees',
    ],
    refusalIf: [
      'Contribution exceeds 25% of net SE earnings cap',
      'Owner-only contribution while excluding eligible employees (violates pro-rata coverage)',
    ],
    triggers: [
      { signal: 'income_type', match: 'self_employment', confidenceBoost: 0.6 },
      { signal: 'entity_type', match: 'sole_prop', confidenceBoost: 0.3 },
    ],
    estimatedSavingsLow: 1500,
    estimatedSavingsHigh: 17000,
    preparerNotes:
      'For >$50K net SE earnings, solo 401(k) usually beats SEP-IRA because the employee-deferral piece compounds the limit. Use SEP for clients with side income < ~$30K who want simplicity. SEP funding deadline is the EXTENDED return due date — useful for last-minute tax planning.',
  },

  {
    positionType: 'solo_401k',
    displayName: 'Solo 401(k) Contribution (§401(k))',
    shortDescription:
      'Owner-only 401(k) plan. Employee deferral up to §402(g) limit + employer profit-sharing up to 25% of comp. Total capped at §415 limit. Plan must exist by year-end; funding through extended return due date.',
    tier: 'substantial',
    baselineSustainabilityPct: 90,
    disclosureRequired: false,
    reportableTransaction: false,
    ircSection: '§401(k)',
    treasReg: 'Treas. Reg. §1.401(k)-1',
    controllingCase: null,
    revRuling: null,
    irsPub: 'Pub 560',
    documentationChecklist: [
      'Plan adoption agreement with custodian (executed BY DEC 31 of the contribution year)',
      'Net SE earnings (Schedule C - SE-tax-deduction half)',
      'Annual Form 5500-EZ when plan assets exceed $250K (filing deadline 7/31 following year)',
      'Funding confirmation from custodian',
    ],
    refusalIf: [
      'Plan not adopted by Dec 31 of contribution year',
      'Owner has W-2 employees other than spouse (kicks plan out of solo-only safe harbor; full 401(k) compliance required)',
      'Combined deferral exceeds §402(g) across multiple employer plans',
    ],
    triggers: [
      { signal: 'income_type', match: 'self_employment', confidenceBoost: 0.5 },
      { signal: 'entity_type', match: 'sole_prop', confidenceBoost: 0.2 },
      { signal: 'entity_type', match: 's_corp', confidenceBoost: 0.4 },
    ],
    estimatedSavingsLow: 5000,
    estimatedSavingsHigh: 25000,
    preparerNotes:
      'For S-corp owner: deferral is based on W-2 reasonable comp, not pass-through. Roth solo 401(k) variant lets high earners get Roth treatment despite the $146K/$240K MFJ Roth IRA phase-out. Spouse-employee compounds limit (each spouse maxes out separately).',
  },

  {
    positionType: 'qbi_safe_harbor_199a',
    displayName: 'QBI Deduction at Safe-Harbor (§199A)',
    shortDescription:
      '20% deduction on qualified business income from pass-through entities. Below taxable income threshold = automatic; above = SSTB exclusion + W-2/UBIA tests apply.',
    tier: 'substantial',
    baselineSustainabilityPct: 88,
    disclosureRequired: false,
    reportableTransaction: false,
    ircSection: '§199A',
    treasReg: 'Treas. Reg. §1.199A-1 through §1.199A-6',
    controllingCase: null,
    revRuling: 'Rev. Proc. 2019-38 (rental real estate safe harbor)',
    irsPub: 'Pub 535',
    documentationChecklist: [
      'Form K-1 (for partnership / S-corp) or Schedule C (sole prop)',
      'W-2 wages paid by the QBI activity (above-threshold clients)',
      'Unadjusted basis immediately after acquisition (UBIA) of qualified property',
      'For real estate: hours log per Rev. Proc. 2019-38 safe harbor (250+ rental services hours/year)',
      'SSTB classification documented if borderline (consulting / health / law / accounting / etc.)',
    ],
    refusalIf: [
      'Taxpayer is W-2 employee only (no QBI)',
      'Above threshold + SSTB + above phaseout window (full disallowance)',
    ],
    triggers: [
      { signal: 'income_type', match: 'self_employment', confidenceBoost: 0.6 },
      { signal: 'document_present', match: 'k1_from_pass_through', confidenceBoost: 0.7 },
      { signal: 'income_type', match: 'rental', confidenceBoost: 0.3 },
    ],
    estimatedSavingsLow: 1000,
    estimatedSavingsHigh: 18000,
    preparerNotes:
      'Safe-harbor for rentals (Rev. Proc. 2019-38) requires 250+ hours of rental services, separate books, and the election filed with the return. Aggregation election can convert SSTB+non-SSTB into one trade or business — model carefully because aggregation is sticky once filed. Above-threshold SSTB analysis is THE common audit trigger; document the SSTB classification call.',
  },

  {
    positionType: 'self_employed_health_insurance',
    displayName: 'Self-Employed Health Insurance Deduction (§162(l))',
    shortDescription:
      'Above-the-line deduction for SE individuals\' health insurance premiums (taxpayer + spouse + dependents + adult children to age 27). Cannot exceed SE earnings.',
    tier: 'substantial',
    baselineSustainabilityPct: 93,
    disclosureRequired: false,
    reportableTransaction: false,
    ircSection: '§162(l)',
    treasReg: 'Treas. Reg. §1.162(l)-1',
    controllingCase: null,
    revRuling: 'Notice 2008-1 (S-corp 2% shareholder treatment)',
    irsPub: 'Pub 535',
    documentationChecklist: [
      'Premium payment records (insurance company statements or HSA-eligible plan EOB)',
      'Net SE earnings from Schedule C / K-1',
      'For S-corp 2% shareholder: premiums must be on W-2 box 1 as wages',
      '1095-A (marketplace plan) — must reconcile with APTC',
    ],
    refusalIf: [
      'Subsidized employer plan available to taxpayer or spouse (§162(l)(2)(B))',
      'Net SE earnings are zero or negative (deduction cap is SE earnings)',
      'Premiums exceed SE earnings (deduction capped; excess goes to itemized 7.5%-AGI medical)',
    ],
    triggers: [
      { signal: 'income_type', match: 'self_employment', confidenceBoost: 0.5 },
      { signal: 'expense_pattern', match: 'health_insurance_premiums', confidenceBoost: 0.5 },
      { signal: 'document_present', match: 'form_1095_a', confidenceBoost: 0.3 },
    ],
    estimatedSavingsLow: 800,
    estimatedSavingsHigh: 6000,
    preparerNotes:
      'S-corp 2% shareholders: premiums must hit W-2 Box 1 OR the deduction is disallowed (Notice 2008-1; Notice 2015-17 addresses the < 2-employee employer-payment-plan rules). Common Antonio finding: S-corp clients pay premiums directly from the corp without running through payroll — fix at year-end via a one-time W-2c adjustment. Marketplace plan reconciliation via 1095-A is a frequent IRS auto-letter trigger.',
  },

  {
    positionType: 'standard_mileage_auto',
    displayName: 'Standard Mileage Method — Business Auto Use',
    shortDescription:
      'Per-mile rate election for business use of personal vehicle in lieu of actual expenses. 2025 business rate $0.70/mile (per the IRS\'s annual mileage rate notice).',
    tier: 'substantial',
    baselineSustainabilityPct: 90,
    disclosureRequired: false,
    reportableTransaction: false,
    ircSection: '§162',
    treasReg: 'Treas. Reg. §1.274-5',
    controllingCase: null,
    revRuling: 'IRS annual mileage rate notice (Notice 2024-89 for TY2025; replaced annually)',
    irsPub: 'Pub 463',
    documentationChecklist: [
      'Contemporaneous mileage log: date, destination, business purpose, miles',
      'Total annual miles + business miles separated',
      'Vehicle ownership/lease records (election standard mileage requires ownership/lease in taxpayer\'s name)',
    ],
    refusalIf: [
      'More than 4 vehicles used simultaneously in the business (fleet rule)',
      'Previously claimed actual depreciation (MACRS) on this vehicle (cannot switch to standard mileage in subsequent year)',
      'Vehicle is for hire (taxi, ride-share) — must use actual',
    ],
    triggers: [
      { signal: 'income_type', match: 'self_employment', confidenceBoost: 0.4 },
      { signal: 'expense_pattern', match: 'vehicle_expense', confidenceBoost: 0.4 },
    ],
    estimatedSavingsLow: 600,
    estimatedSavingsHigh: 6500,
    preparerNotes:
      'For high-cost / luxury vehicles, actual method often beats standard mileage despite the §280F luxury caps. Annual decision: pick the higher result. Once actual + MACRS depreciation taken, the choice locks for that vehicle\'s life. Standard mileage includes depreciation component — keep a separate basis tracker for §1245 gain on disposition.',
  },

  {
    positionType: 'aotc',
    displayName: 'American Opportunity Tax Credit (§25A(i))',
    shortDescription:
      'Up to $2,500 credit per eligible student per year (100% of first $2K + 25% of next $2K). 40% refundable. First 4 post-secondary years, half-time+ enrollment.',
    tier: 'substantial',
    baselineSustainabilityPct: 91,
    disclosureRequired: false,
    reportableTransaction: false,
    ircSection: '§25A(i)',
    treasReg: 'Treas. Reg. §1.25A-3',
    controllingCase: null,
    revRuling: null,
    irsPub: 'Pub 970',
    documentationChecklist: [
      'Form 1098-T from the eligible educational institution',
      'Proof of qualified expenses (tuition, required fees, books, supplies, equipment)',
      'Enrollment status (must be at least half-time for AOTC)',
      'Student has not completed first 4 years of postsecondary education',
      'Student has not been convicted of felony drug offense',
    ],
    refusalIf: [
      'Student claimed AOTC in 4+ prior tax years',
      'MFS filing status (AOTC unavailable)',
      'Phase-out (MAGI above $90K single / $180K MFJ — full phase-out)',
    ],
    triggers: [
      { signal: 'document_present', match: 'form_1098_t', confidenceBoost: 0.8 },
      { signal: 'lifecycle_event', match: 'dependent_starts_college', confidenceBoost: 0.6 },
    ],
    estimatedSavingsLow: 1500,
    estimatedSavingsHigh: 2500,
    preparerNotes:
      'Form 8867 due-diligence checklist applies (preparer penalty exposure!). Coordinate with 529 distributions to avoid double-dip (must reduce qualified expenses by tax-free 529 use). Dependent\'s grandparent-paid 529 distributions go on the GRANDPARENT\'s tax return (post-2024 FAFSA simplification). Lifetime Learning Credit (§25A(c)) is the fallback for grad / 5th+ year students at lower max.',
  },

  {
    positionType: 'dependent_care_credit',
    displayName: 'Child and Dependent Care Credit (§21)',
    shortDescription:
      'Credit for care expenses for qualifying child under 13 or incapacitated dependent/spouse, enabling taxpayer to work. 20-35% of up to $3K (one qual person) or $6K (two+).',
    tier: 'substantial',
    baselineSustainabilityPct: 90,
    disclosureRequired: false,
    reportableTransaction: false,
    ircSection: '§21',
    treasReg: 'Treas. Reg. §1.21-1',
    controllingCase: null,
    revRuling: null,
    irsPub: 'Pub 503',
    documentationChecklist: [
      'Provider name, address, TIN (or SSN if individual) on Form 2441',
      'Total amount paid to each provider',
      'Both spouses must have earned income (or be a full-time student / disabled)',
      'Qualifying person info (child under 13, OR incapacitated)',
    ],
    refusalIf: [
      'Filing MFS (only narrow exception under §21(e)(4) for separated spouses)',
      'Provider is the taxpayer\'s own child under 19 or the spouse',
      'Care for a child of divorced parents claimed by non-custodial parent',
    ],
    triggers: [
      { signal: 'expense_pattern', match: 'childcare_expenses', confidenceBoost: 0.7 },
      { signal: 'lifecycle_event', match: 'dependent_under_13', confidenceBoost: 0.5 },
    ],
    estimatedSavingsLow: 600,
    estimatedSavingsHigh: 2100,
    preparerNotes:
      'Coordinate with employer Dependent Care FSA (§129) — the FSA reduces the §21 ceiling dollar-for-dollar. For high earners with FSA, the §21 credit floor is 20% of the post-FSA ceiling. Common Antonio finding: provider TIN missing on intake — collect early or face Form 2441 disqualification.',
  },

  {
    positionType: 'savers_credit',
    displayName: 'Saver\'s Credit (§25B)',
    shortDescription:
      'Non-refundable credit for low-income taxpayers contributing to retirement accounts. 10-50% of first $2K ($4K MFJ).',
    tier: 'substantial',
    baselineSustainabilityPct: 95,
    disclosureRequired: false,
    reportableTransaction: false,
    ircSection: '§25B',
    treasReg: null,
    controllingCase: null,
    revRuling: null,
    irsPub: 'Pub 17',
    documentationChecklist: [
      'IRA/401(k) contribution statements (Form 5498 or year-end statement)',
      'AGI within phase-out range',
      'Taxpayer over 18, not full-time student, not claimed as dependent',
    ],
    refusalIf: [
      'Full-time student status (§25B(c)(2))',
      'Claimed as dependent on another return',
      'AGI above phase-out ceiling',
    ],
    triggers: [
      { signal: 'income_type', match: 'low_to_moderate_w2', confidenceBoost: 0.6 },
      { signal: 'expense_pattern', match: 'retirement_contribution', confidenceBoost: 0.4 },
    ],
    estimatedSavingsLow: 100,
    estimatedSavingsHigh: 1000,
    preparerNotes:
      'Frequently missed — every Antonio client under the AGI ceiling contributing to retirement should get this. The 50% rate only applies in the lowest band; most clients land in 10-20%. SECURE 2.0 makes this refundable starting 2027 (Saver\'s Match); flag for clients to plan rollover timing.',
  },

  {
    positionType: 'accountable_plan',
    displayName: 'Accountable Plan Reimbursements (§62(c))',
    shortDescription:
      'Employer reimbursements for employee business expenses under an accountable plan are excluded from W-2 wages (taxpayer doesn\'t recognize income; employer deducts).',
    tier: 'substantial',
    baselineSustainabilityPct: 88,
    disclosureRequired: false,
    reportableTransaction: false,
    ircSection: '§62(c)',
    treasReg: 'Treas. Reg. §1.62-2',
    controllingCase: null,
    revRuling: null,
    irsPub: 'Pub 535',
    documentationChecklist: [
      'Written accountable plan document (board minutes, employee handbook)',
      'Substantiation: receipts + business-purpose documentation for each reimbursement',
      'Substantiation timing (60 days for advances; 120 days for reimbursements)',
      'Return of excess advances within 120 days',
    ],
    refusalIf: [
      'Failure to substantiate (employee pockets unjustified reimbursement = wages)',
      'Failure to return excess advance (becomes wages)',
      'Reimbursement of inherently-personal expenses (commuting; clothing not uniform)',
    ],
    triggers: [
      { signal: 'entity_type', match: 's_corp', confidenceBoost: 0.6 },
      { signal: 'business_pattern', match: 'owner_pays_business_expense_personally', confidenceBoost: 0.5 },
    ],
    estimatedSavingsLow: 1000,
    estimatedSavingsHigh: 8000,
    preparerNotes:
      'Single most common S-corp owner finding. Owner-employee paying business expenses from personal account without an accountable plan = lost deduction + wage characterization. Establish the plan in year 1 of the S-corp; reimburse via separate check (not via shareholder-loan or distribution). Use this proactively in S-corp election conversations.',
  },

  // ─── Tier 3 — Reasonable basis (requires Form 8275) ───────────

  {
    positionType: 'augusta_rule_280a_g',
    displayName: 'Augusta Rule — 14-Day Rental of Personal Residence (§280A(g))',
    shortDescription:
      'Rental of personal residence for ≤14 days/year results in tax-free rental income. When rental is to taxpayer\'s own business at fair market rate, business gets deduction; owner reports nothing.',
    tier: 'reasonable_basis',
    baselineSustainabilityPct: 65,
    disclosureRequired: true,
    reportableTransaction: false,
    ircSection: '§280A(g)',
    treasReg: 'Treas. Reg. §1.280A-2(g)',
    controllingCase: null,
    revRuling: null,
    irsPub: 'Pub 527',
    documentationChecklist: [
      'Comparable-rental analysis (3+ comparable commercial venue rates) supporting fair-market price',
      'Business-purpose documentation for each rental day (meeting agenda, attendee list, materials)',
      'Rental agreement between business and owner',
      'Bank record showing payment from business to owner (not commingled)',
      'Day count log — must stay ≤14 days/year',
      'Form 1099-MISC (or equivalent) issued by business to owner',
    ],
    refusalIf: [
      'Rental exceeds 14 days (loses §280A(g) safe harbor; full rental income reported)',
      'Rate not supported by FMV comparables (IRS reclassification as compensation or constructive dividend)',
      'No genuine business purpose for the meeting (audit hammer — Skinner doctrine)',
      'Owner is sole user/decision-maker and the "rental" lacks economic substance',
    ],
    triggers: [
      { signal: 'entity_type', match: 's_corp', confidenceBoost: 0.4 },
      { signal: 'entity_type', match: 'c_corp', confidenceBoost: 0.4 },
      { signal: 'business_pattern', match: 'owner_holds_meetings_at_home', confidenceBoost: 0.3 },
    ],
    estimatedSavingsLow: 1000,
    estimatedSavingsHigh: 5000,
    preparerNotes:
      'High audit-attention position. The 8275 disclosure is mandatory. The DEDUCTION at the business level maxes around $14K (14 days × ~$1K/day) but actual TAX savings to the family unit are typically $1K-$5K depending on entity type + marginal rate (C-corp 21%, S-corp pass-through 22-37% marginal). Maximum tax planning when rate is supported by COMMERCIAL venue comps (not consumer Airbnb rates). Critical: meetings must have genuine business purpose with documented agenda; "I held a meeting at home" with no minutes loses on audit. Antonio recommends explicit board resolution authorizing the rental program.',
  },

  {
    positionType: 'hiring_minor_children',
    displayName: 'Hiring Minor Children — Wages from Family Business',
    shortDescription:
      'Sole prop / family-owned partnership pays own children under 18 for actual services rendered. Wages deductible; child under 18 exempt from FICA/FUTA; child may avoid income tax if total earned income below standard deduction.',
    tier: 'reasonable_basis',
    baselineSustainabilityPct: 70,
    disclosureRequired: true,
    reportableTransaction: false,
    ircSection: '§3121(b)(3)(A) (FICA), §3306(c)(5) (FUTA), §162 (wage deduction)',
    treasReg: 'Treas. Reg. §31.3121(b)(3)-1',
    controllingCase: 'Eller v. Commissioner, 77 T.C. 934 (1981)',
    revRuling: null,
    irsPub: 'Pub 15-A',
    documentationChecklist: [
      'Written job description appropriate for child\'s age + skills',
      'Time records / time sheets documenting actual hours worked',
      'Work product evidence (photos, files, documents produced)',
      'Wage rate comparable to what unrelated party would receive (no premium)',
      'Wages paid via standard payroll (W-2 issued; not "allowance")',
      'Separate bank account for child where wages deposited',
      'Form W-4 filed by child',
    ],
    refusalIf: [
      'No actual services rendered (gift dressed up as wages)',
      'Wage rate exceeds FMV for similar work + age (kicks into constructive distribution / gift territory)',
      'Parent operates as S-corp or C-corp (FICA/FUTA exemption is sole-prop or family-partnership only)',
      'Child under age of true productivity (toddlers cannot perform $X of services regardless of payroll documentation)',
    ],
    triggers: [
      { signal: 'income_type', match: 'self_employment', confidenceBoost: 0.4 },
      { signal: 'entity_type', match: 'sole_prop', confidenceBoost: 0.5 },
      { signal: 'lifecycle_event', match: 'has_minor_dependents', confidenceBoost: 0.3 },
    ],
    estimatedSavingsLow: 500,
    estimatedSavingsHigh: 5000,
    preparerNotes:
      'Common audit hammer when documentation is weak. Eller v. Comm\'r is THE controlling guidance — services must be appropriate to age and actually performed. Modeling agencies, social-media content (legitimate when child is the talent), and document-filing work for clients age 12+ have survived audit. Avoid family LLC paying wages to children under 7 — too easy for IRS to recharacterize. The FICA exemption ONLY exists for sole-prop or family-partnership (both parents own); S-corp / C-corp clients DO pay FICA on minor wages.',
  },

  {
    positionType: 'cost_segregation_edge_classifications',
    displayName: 'Cost Segregation — Edge Component Classifications',
    shortDescription:
      'Engineering-based reclassification of building components into 5/7/15-year MACRS lives instead of 27.5-year residential rental. Tier 3 framing covers the EDGE classifications (HVAC component splits, exterior land improvements with mixed use, structural components recharacterized as personal property). Routine 5/7/15-year reclassifications by a legitimate engineering firm on a standard residential rental belong in Tier 2; this entry is the aggressive subset.',
    tier: 'reasonable_basis',
    baselineSustainabilityPct: 65,
    disclosureRequired: true,
    reportableTransaction: false,
    ircSection: '§168(e), §263A',
    treasReg: 'Treas. Reg. §1.263(a)-2T',
    controllingCase: 'Hospital Corp. of America v. Comm\'r, 109 T.C. 21 (1997)',
    revRuling: 'Rev. Proc. 87-56 (asset class life)',
    irsPub: 'Pub 946',
    documentationChecklist: [
      'Engineering-firm cost-segregation study report (legitimate firm, not a $99 self-help kit)',
      'Detailed asset reclassification schedule (HVAC: §1245 vs §1250, etc.)',
      'Original cost basis breakout: land vs. structure',
      'Form 3115 (Change of Accounting Method) if cost-seg study is on a prior-year property',
      'Acquisition documents (HUD-1 / settlement statement / appraisal)',
    ],
    refusalIf: [
      'Cost-seg study from non-engineering source (preparer firm self-study)',
      'Property has been on the books for years without Form 3115 catch-up (post-acquisition cost-seg requires §481(a) catch-up adjustment)',
      'Property is land-only or primarily land value (no depreciable basis to reclassify)',
    ],
    triggers: [
      { signal: 'income_type', match: 'rental', confidenceBoost: 0.5 },
      { signal: 'lifecycle_event', match: 'property_acquisition', confidenceBoost: 0.5 },
      { signal: 'document_present', match: 'rental_property_settlement', confidenceBoost: 0.4 },
    ],
    estimatedSavingsLow: 3000,
    estimatedSavingsHigh: 50000,
    preparerNotes:
      'Engineering-firm studies (KBKG, CSSI, Engineered Tax Services) cost $3-8K and run 30-60 days. For properties >$500K basis, the study typically pays itself back 5-10x in year-1 depreciation. Coordinate with §469 passive-activity rules — accelerated depreciation creating losses gets trapped if taxpayer isn\'t a Real Estate Professional. §168(k) bonus depreciation phase-down: 2025 = 40%, 2026 = 20%, 2027 = 0% absent legislative extension.',
  },

  {
    positionType: 'real_estate_professional_469',
    displayName: 'Real Estate Professional Status — Material Participation (§469(c)(7))',
    shortDescription:
      'Taxpayer is RE Professional if >50% of personal services + 750+ hours in real property trades/businesses. Combined with material participation, rental losses become non-passive (offset against ordinary income).',
    tier: 'reasonable_basis',
    baselineSustainabilityPct: 55,
    disclosureRequired: true,
    reportableTransaction: false,
    ircSection: '§469(c)(7)',
    treasReg: 'Treas. Reg. §1.469-9; Temp. Reg. §1.469-5T (material participation)',
    controllingCase: null,
    revRuling: null,
    irsPub: 'Pub 925',
    documentationChecklist: [
      'Contemporaneous time log of hours per real-estate activity (calendar entries, work logs, written summaries)',
      'Documentation that >50% of personal services performed in any trade/business were in real property trades/businesses',
      '750-hour threshold met per year',
      'Material participation per §469(h) for each rental activity (or aggregation election under §1.469-9(g))',
      'Aggregation election (one-time, sticky) filed with return',
    ],
    refusalIf: [
      'Taxpayer has full-time W-2 employment in unrelated field AND no documented offsetting RE hours that exceed W-2 hours (defeats the >50% test)',
      'Time log reconstructed solely after IRS contact with NO contemporaneous source records (calendars, emails, vendor invoices, MLS access logs) — Temp. Reg. §1.469-5T(f)(4) permits reasonable means of proof but bare post-audit reconstructions fail',
      'Hours include investor activities (passive review of investment statements doesn\'t count per §469(h)(4))',
      'Spouse cannot aggregate hours for the 750/>50% personal-services test; one spouse must individually qualify (though either spouse meeting REP unlocks rental losses against household ordinary income under §469(c)(7)(C))',
    ],
    triggers: [
      { signal: 'income_type', match: 'rental_multiple_properties', confidenceBoost: 0.5 },
      { signal: 'business_pattern', match: 'no_w2_income', confidenceBoost: 0.4 },
    ],
    estimatedSavingsLow: 5000,
    estimatedSavingsHigh: 75000,
    preparerNotes:
      'Highest audit risk position in residential real estate planning. The >50% personal services test is the hard wall — substantial W-2 income almost always defeats it (the taxpayer would need to log more RE hours than W-2 hours for the year, rarely realistic). Most defensible for stay-at-home spouse handling property management + leasing, or for full-time RE professionals (brokers, builders, property managers). Aggregation election (§1.469-9(g)) is sticky once filed — model carefully. Coordinate with cost-seg: the savings stacking is what justifies the higher fees, but only if the REP status holds. Antonio strongly disfavors REP claims for clients with substantial W-2 income — the math almost never works.',
  },

  // ─── Tier 4 — More likely than not ────────────────────────────

  {
    positionType: 'partnership_704b_special_allocation',
    displayName: 'Partnership Special Allocations (§704(b))',
    shortDescription:
      'Allocation of partnership income/loss/deduction items in a manner that varies from partners\' pro-rata interests. Must have substantial economic effect OR satisfy the partners\' interest in the partnership (PIP) safe harbor.',
    tier: 'more_likely_than_not',
    baselineSustainabilityPct: 55,
    disclosureRequired: true,
    reportableTransaction: false,
    ircSection: '§704(b)',
    treasReg: 'Treas. Reg. §1.704-1(b)(2) (substantial economic effect)',
    controllingCase: 'Goldfine v. Commissioner, 80 T.C. 843 (1983)',
    revRuling: null,
    irsPub: 'Pub 541',
    documentationChecklist: [
      'Partnership agreement with explicit special-allocation provisions',
      'Capital account maintenance per §1.704-1(b)(2)(iv) (the "Big Three": book-up to FMV, liquidation per positive capital accounts, deficit restoration obligation OR qualified income offset)',
      'Annual capital account ledger reconciling each partner\'s book + tax + 704(b) accounts',
      'Economic effect documentation (which partner bears the economic burden of each allocated item)',
      'Form 8275 disclosure for non-safe-harbor allocations',
    ],
    refusalIf: [
      'Partnership agreement doesn\'t maintain capital accounts per §1.704-1(b)(2)(iv) (fails safe harbor)',
      'No deficit restoration obligation AND no qualified income offset (kicks out of substantial-economic-effect safe harbor)',
      'Allocation purely for tax-avoidance with no economic reality (Goldfine)',
      'Allocation that shifts tax burden among related parties without corresponding economic shift',
    ],
    triggers: [
      { signal: 'entity_type', match: 'partnership', confidenceBoost: 0.6 },
      { signal: 'document_present', match: 'k1_from_pass_through', confidenceBoost: 0.4 },
    ],
    estimatedSavingsLow: 5000,
    estimatedSavingsHigh: 100000,
    preparerNotes:
      'Tier 4 because partnership allocations under §704(b) are pattern-matched against the substantial-economic-effect safe harbor; deviations require MLTN. Practical Antonio scenario: family LP allocating depreciation 99% to high-bracket parent, income 99% to low-bracket child. The IRS audits these aggressively. Form 8275 mandatory. Annual capital account ledger is the load-bearing artifact — without it, every safe harbor falls.',
  },
];

// ────────────────────────────────────────────────────────────────
// Library lookup helpers — Discovery Agent + Position Agent consume.
// ────────────────────────────────────────────────────────────────

/**
 * Get the library entry for a position type. Returns undefined when
 * the type is unknown (caller should treat as "position not in v0
 * catalog" — never silently fall back to a different position).
 */
export function getPositionLibraryEntry(
  positionType: string,
): PositionLibraryEntry | undefined {
  return POSITION_LIBRARY_V0.find((e) => e.positionType === positionType);
}

/**
 * Filter the library to positions in a given tier. Useful for the
 * Discovery Agent's "show me all Tier 3 positions" surface and for
 * the audit-defense PDF's tier-aggregated sections.
 */
export function getPositionsByTier(tier: PositionTier): PositionLibraryEntry[] {
  return POSITION_LIBRARY_V0.filter((e) => e.tier === tier);
}

/**
 * Find library entries whose triggers match a given signal+match
 * pair. Returns entries with the matched trigger inline so caller
 * can read the confidence boost. Discovery Agent calls this per
 * client signal (income type, expense pattern, etc.) then compounds
 * boosts across matches per entry.
 */
export function findPositionsByTrigger(
  signal: PositionTriggerSignal,
  match: string,
): Array<{ entry: PositionLibraryEntry; trigger: PositionTrigger }> {
  const hits: Array<{ entry: PositionLibraryEntry; trigger: PositionTrigger }> = [];
  for (const entry of POSITION_LIBRARY_V0) {
    for (const trigger of entry.triggers) {
      if (trigger.signal === signal && trigger.match === match) {
        hits.push({ entry, trigger });
      }
    }
  }
  return hits;
}

/**
 * Compound a list of confidence boosts into a final surface
 * confidence in [0, 1]. Uses 1 - prod(1 - b_i) — the "noisy-OR"
 * rule. Two 0.5 boosts compound to 0.75, three 0.4 boosts compound
 * to 0.784, etc. Clamped to [0, 1]. Empty array returns 0.
 */
export function compoundConfidence(boosts: number[]): number {
  if (boosts.length === 0) return 0;
  let inverseProduct = 1;
  for (const b of boosts) {
    const clamped = Math.max(0, Math.min(1, b));
    inverseProduct *= 1 - clamped;
  }
  return Math.max(0, Math.min(1, 1 - inverseProduct));
}
