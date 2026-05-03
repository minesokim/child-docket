// Knowledge-layer type system.
//
// Six entity types make up the tax-graph ontology (CLAUDE.md §12).
// Two have DB tables today (Authority, AuthorityChunk). The other
// four (TaxConcept, WorkflowObject, FactPattern, DecisionRule,
// PlanningStrategy) are defined as types so future agent code is
// well-typed; they get DB tables when the first agent needs them.
//
// EFFECTIVE-DATE MODEL
//   Every authority has effectiveDate + optional supersededDate.
//   Retrieval queries filter to authorities in effect on the relevant
//   tax year. Citations rendered to users include supersession status
//   inline so outdated law is visually flagged.

import type { TenantId } from '@docket/shared';

// ────────────────────────────────────────────────────────────────
// Enums — kept as string literal unions, not TS enums, so they
// flow cleanly through Drizzle (whose pgEnum returns string-literal
// values) and across HTTP boundaries.
// ────────────────────────────────────────────────────────────────

export type AuthorityKind =
  | 'irc'                // Internal Revenue Code section
  | 'treas_reg'          // Treasury Regulation
  | 'irs_pub'            // IRS Publication (Pub 17, 535, ...)
  | 'irs_form'           // IRS Form / Instructions
  | 'irs_irm'            // Internal Revenue Manual
  | 'irs_irb'            // Internal Revenue Bulletin
  | 'irs_notice'         // IRS Notice
  | 'irs_revrul'         // Revenue Ruling
  | 'irs_revproc'        // Revenue Procedure
  | 'tax_court'          // Tax Court opinion
  | 'ca_ftb_pub'         // CA FTB publication
  | 'ca_ftb_legal'       // CA FTB Legal Ruling
  | 'ca_ftb_form'        // CA FTB Form / Instructions
  | 'cdtfa'              // CA Dept of Tax & Fee Admin
  | 'edd'                // CA Employment Development Dept
  | 'firm_playbook'      // Firm-internal playbook
  | 'firm_memo'          // Firm-internal memo
  | 'firm_template';     // Firm-internal template

export const AUTHORITY_KINDS: readonly AuthorityKind[] = [
  'irc',
  'treas_reg',
  'irs_pub',
  'irs_form',
  'irs_irm',
  'irs_irb',
  'irs_notice',
  'irs_revrul',
  'irs_revproc',
  'tax_court',
  'ca_ftb_pub',
  'ca_ftb_legal',
  'ca_ftb_form',
  'cdtfa',
  'edd',
  'firm_playbook',
  'firm_memo',
  'firm_template',
] as const;

export type AuthorityJurisdiction = 'federal' | 'CA' | 'firm';

export const AUTHORITY_JURISDICTIONS: readonly AuthorityJurisdiction[] = [
  'federal',
  'CA',
  'firm',
] as const;

// ────────────────────────────────────────────────────────────────
// Authority — the unit of citation.
// One per cited document. Mirror of the DB row (with `Date` instead
// of `string` for date columns and `null` instead of optional
// undefined for nullable columns). The DB row is the source of truth;
// this type is the application-side shape.
// ────────────────────────────────────────────────────────────────
export type Authority = {
  id: string;
  /** NULL = global authority (every tenant sees it). */
  tenantId: TenantId | null;
  kind: AuthorityKind;
  jurisdiction: AuthorityJurisdiction;
  /**
   * Display-form citation string ("IRS Pub 17 (2024)", "IRC §61(a)(1)").
   * Drives citation rendering — what a preparer sees in a cite chip.
   */
  citationLabel: string;
  /** Full title for detail panels. */
  title: string;
  /** Stable slug for routing inside Docket. Unique per scope. */
  slug: string;
  /** Canonical external URL (irs.gov / ftb.ca.gov / ...). NULL for firm authorities. */
  externalUrl: string | null;
  /** Where we ingested from (URL or R2 key for archived PDFs). */
  sourceUri: string | null;
  /** When this authority TAKES effect. */
  effectiveDate: Date;
  /** When superseded. NULL = still in effect. */
  supersededDate: Date | null;
  /** Replacement authority id. NULL = no replacement. */
  supersededById: string | null;
  /** Tax year(s) this authority applies to. Empty = evergreen. */
  applicableTaxYears: number[];
  /** Sha256 of normalized full text for change detection. */
  contentHash: string | null;
  /** Free-form metadata. */
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

// ────────────────────────────────────────────────────────────────
// AuthorityChunk — chunked content for retrieval.
// One row per ~512-token chunk. The retrievable unit. Hierarchical
// section path lets us reconstruct the citation depth from the chunk
// alone (e.g., ["§61", "(a)", "(1)"] renders as §61(a)(1)).
// ────────────────────────────────────────────────────────────────
export type AuthorityChunk = {
  id: string;
  authorityId: string;
  /** Mirror of authorities.tenant_id for retrieval-side filtering. */
  tenantId: TenantId | null;
  /** 0-indexed position within the parent authority. */
  ordinal: number;
  /** Section breadcrumb. */
  sectionPath: string[];
  /** Display anchor ("§5.1: Earned income"). */
  heading: string | null;
  /** The chunk text. */
  text: string;
  /** Char positions in source for highlighting. */
  charStart: number | null;
  charEnd: number | null;
  contentHash: string;
  createdAt: Date;
};

// ────────────────────────────────────────────────────────────────
// Conceptual entities — defined as types now, get DB tables when the
// first agent needs to materialize them. The agent-fleet build-out
// (Phase 3 of CEO plan) will likely surface these in this order:
//   - WorkflowObject  → return drafting agent needs to know forms
//   - TaxConcept      → research agent + planning agent
//   - DecisionRule    → review agent (junior-staff drafting)
//   - PlanningStrategy → planning agent
//   - FactPattern     → intake agent (matches taxpayer to playbook)
// ────────────────────────────────────────────────────────────────

/**
 * Abstract tax concept referenced from authority text. Concepts let
 * an agent answer "what does X mean" with a definition + cite chain
 * back to source authorities.
 */
export type TaxConcept = {
  id: string;
  /** NULL = shared (universally taught), tenantId = firm's interpretation. */
  tenantId: TenantId | null;
  name: string;
  /** 1-2 sentence summary. */
  summary: string;
  /** Aliases / alternate names. */
  aliases: string[];
  /** Authorities that define / reference this concept. */
  authorityIds: string[];
};

/**
 * Concrete tax workflow object: forms, schedules, returns, deadlines,
 * elections, notice types. The "things" Antonio interacts with in
 * software / on paper / when responding to the IRS.
 */
export type WorkflowObject = {
  id: string;
  /** NULL = universal (forms + schedules are universal). */
  tenantId: TenantId | null;
  kind:
    | 'form'              // 1040, Schedule C, 8889
    | 'schedule'          // Schedule A/B/C/D/E
    | 'return_type'       // individual, 1120-S, 1065
    | 'election'          // §83(b), S-election, mark-to-market
    | 'notice_type'       // CP2000, CP504, LT11
    | 'deadline';         // 4/15, 9/15, 10/15
  /** "1040" / "Schedule C" / "8889" / "CP2000" / etc. */
  code: string;
  /** Human label ("Form 1040 — U.S. Individual Income Tax Return"). */
  title: string;
  /** Tax year(s) this version applies to. */
  applicableTaxYears: number[];
  /** Authorities that define this object. */
  authorityIds: string[];
};

/**
 * Recognized fact pattern → matches a taxpayer's situation to a
 * playbook + concepts + workflow objects. Agents use this for
 * "this client's situation matches Pattern P, which applies these
 * workflow objects + cites these authorities."
 */
export type FactPattern = {
  id: string;
  /** NULL = canonical pattern, tenantId = firm-tweaked variant. */
  tenantId: TenantId | null;
  name: string;
  /** Conditions that must hold for a taxpayer to match. */
  conditions: Record<string, unknown>;
  /** Concepts this pattern engages. */
  conceptIds: string[];
  /** Workflow objects this pattern requires/touches. */
  workflowObjectIds: string[];
};

/**
 * If/then logic with cited authorities. The "computable" piece of the
 * knowledge layer — review agents lean on this to flag missing checks,
 * planning agents lean on this for "if X then strategy Y is on the
 * table."
 */
export type DecisionRule = {
  id: string;
  tenantId: TenantId | null;
  name: string;
  /** Conditions in serializable form. */
  antecedent: Record<string, unknown>;
  /** Action / determination if antecedent holds. */
  consequent: Record<string, unknown>;
  /** Authorities supporting this rule. */
  authorityIds: string[];
  effectiveDate: Date;
  supersededDate: Date | null;
};

/**
 * Named planning strategy with prerequisites + risks + savings range.
 * Powers the planning agent (D4 per CEO plan adds the tax-law diff
 * agent; planning agent is one of the 10).
 */
export type PlanningStrategy = {
  id: string;
  tenantId: TenantId | null;
  name: string;
  /** Conditions a taxpayer must satisfy to pursue this strategy. */
  prerequisites: Record<string, unknown>;
  /** Known risks (audit risk, complexity, IRS scrutiny). */
  risks: Record<string, unknown>;
  /** Expected savings — { min, max, basis }. */
  expectedSavings: { min: number; max: number; basis: string };
  /** Documentation requirements (what Antonio must collect). */
  documentationRequirements: string;
  /** Authorities supporting this strategy. */
  authorityIds: string[];
};

// ────────────────────────────────────────────────────────────────
// Retrieval result — the shape returned by KnowledgeRetriever.retrieve.
// ────────────────────────────────────────────────────────────────

/**
 * One retrieved chunk with its parent authority + relevance score.
 * Score is implementation-defined (cosine similarity / BM25 / hybrid)
 * but normalized to [0, 1] where 1 is most relevant.
 */
export type RetrievalHit = {
  authority: Authority;
  chunk: AuthorityChunk;
  /** Normalized relevance score in [0, 1]. */
  score: number;
  /**
   * Per-strategy raw scores when a hybrid retriever is used. Lets
   * downstream code (rerankers, calibration tooling) inspect what
   * each leg contributed.
   */
  scores?: {
    bm25?: number;
    cosine?: number;
    reranker?: number;
  };
};
