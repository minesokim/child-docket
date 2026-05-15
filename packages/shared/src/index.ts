// Re-export the intake state type + helpers so they're importable as
// `import { IntakeState, getNextStep } from '@docket/shared'` from both
// the client portal and command room.
export * from './intake.js';

// Zod validation schemas for IntakeState. Used by saveIntakeField server
// action to reject malformed writes before they touch JSONB.
export * from './intake-schemas.js';

// Sentry beforeSend PII scrubber. Last-line defense before events leave
// our processes — strips SSN/EIN/email/phone substrings + redacts whole
// values for sensitive-looking field names.
export * from './sentry-scrubber.js';

// PII scrubber for inbound text channels (SMS / email / portal-chat).
// Runs BEFORE the artifact gets fact-extracted or vector-indexed so
// SSN/EIN/bank-account tokens never reach embeddings or prompts.
// Sister to sentry-scrubber.ts; consolidation tracked as v1.5 work.
export * from './pii-scrubber.js';

// Trust-gate enforcement helper. Pure function; no I/O. Pairs with
// docs/POSITION-FRAMEWORK.md §6 + CLAUDE.md §8 trust escalation.
// Every agent that performs a side-effect action calls assertTrustGate
// before executing; the gate either allows, queues for EA approval,
// or refuses (below the framework floor).
export * from './trust-gate.js';

// In-process token-bucket rate limiter for abusable server actions
// + API routes (revealIntakeField, /api/intake/flush, etc.). v0 is
// per-instance; swap to Upstash Redis when traffic justifies.
export * from './rate-limit.js';

// Input formatters — strict digit-only filter + auto-format for
// EIN, money, ZIP, year, count fields. Used by every intake page
// at the onChange boundary so the UI never accepts garbage that
// the Zod schema would later reject.
export * from './format.js';

// Expected-documents derivation — given an IntakeState, returns the
// list of documents the client should upload. Powers the docs-page
// checklist + slot matching for AI-classified uploads.
export * from './required-docs.js';

// Routing number → bank name lookup for intake autofill. Local map
// covering top 25 US consumer banks (~120 routing numbers). Returns
// null on miss; safe per-keystroke (single object lookup).
export * from './bank-routing.js';

// Multi-step reasoning trail — canonical shape every agent emits
// alongside its primary answer. Locked as a contract per CLAUDE.md
// §9 Agent contract. The UI primitive lives at
// apps/command-room/src/components/reasoning-trail.tsx.
export * from './reasoning-trail.js';

// Portal stage-specific copy + CTA map for the taxpayer-facing
// Home tab. Five canonical states (first_time / docs_received /
// review_ready / filed_refund / off_season). State machine
// drives copy; firms cannot author per-stage strings (platform-owned
// language for consistency). Locked as a contract per CLAUDE.md §4
// Client Portal.
export * from './portal-stage.js';

// Webhook signature verification lives in `@docket/shared/webhooks` as a
// SUBPATH export — NOT from this main barrel. The verifier imports
// `node:crypto`, which webpack/turbopack will pull into any bundle that
// imports from the main barrel. That breaks browser builds. Same risk
// shape as the inngest client (also server-only, also subpath-exported).
//
// Server code imports via:
//
//   import { verifyTwilioSignature } from '@docket/shared/webhooks';
//
// See `packages/shared/package.json` `exports['./webhooks']`.

// Inngest client lives in shared but is NOT re-exported from the main
// barrel — `inngest` internally imports `node:async_hooks` which
// breaks browser bundles. Server code imports via the subpath:
//
//   import { inngest } from '@docket/shared/inngest'
//
// See packages/shared/package.json `exports['./inngest']`.

// ────────────────────────────────────────────────────────────────
// Branded types — prevent IDs from being mixed up at compile time.
// ────────────────────────────────────────────────────────────────
export type TenantId = string & { readonly __brand: 'TenantId' };
export type ClientId = string & { readonly __brand: 'ClientId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type EngagementId = string & { readonly __brand: 'EngagementId' };
export type IssueId = string & { readonly __brand: 'IssueId' };
export type SignatureId = string & { readonly __brand: 'SignatureId' };
export type DocumentId = string & { readonly __brand: 'DocumentId' };
export type MessageId = string & { readonly __brand: 'MessageId' };
export type ActionId = string & { readonly __brand: 'ActionId' };

// ────────────────────────────────────────────────────────────────
// Agent registry — every agent has a stable id + role.
// ────────────────────────────────────────────────────────────────
export type AgentId =
  | 'morning-brief'
  | 'inbox-drafter'
  | 'triage-classifier'
  | 'document-triage'
  | 'notice-classifier'
  | 'notice-drafter'
  | 'practice-pattern'
  | 'olt-prep-handoff'        // v1+
  | 'outcome-prediction';     // v1+

// ────────────────────────────────────────────────────────────────
// Trust escalation — Level 1 (every action approved) → Level 4 (autopilot).
// ────────────────────────────────────────────────────────────────
export type TrustLevel = 1 | 2 | 3 | 4;

// ────────────────────────────────────────────────────────────────
// User role — firm staff (NOT clients/taxpayers, those are a separate
// auth surface and not in `users` table). Re-exports from ./role.ts:
// USER_ROLES, Role, isRole, assertRole, hasRole.
//
// Policy matrix (Day 3 of post-audit hardening; full doc in
// apps/command-room/src/lib/require-role.ts):
//
//   firm_owner  full access; only role that can sign returns (PTIN holder)
//   preparer    prep work + client data + SSN/EIN reveal
//   reviewer    review prep work + override + finalize
//   admin       billing + scheduling + team mgmt; CANNOT reveal SSN/EIN
//   assistant   limited read + message routing; CANNOT reveal SSN/EIN
// ────────────────────────────────────────────────────────────────
export * from './role.js';

// ────────────────────────────────────────────────────────────────
// Action class — taxonomy for the audit ledger.
// ────────────────────────────────────────────────────────────────
export type ActionClass =
  | 'read'                    // observed / queried / pulled
  | 'draft'                   // generated content awaiting approval
  | 'classify'                // categorized something (issue type, doc kind, etc.)
  | 'send-internal'           // internal-only side effect (DB write, log entry)
  | 'send-external'           // external comm (email, SMS) — gated
  | 'mutate-tax-software'     // wrote to OLT / IRS Solutions / etc. — gated
  | 'mutate-intake'           // taxpayer-initiated write to intake_responses
  | 'file';                   // submitted to IRS / state — most gated

// ────────────────────────────────────────────────────────────────
// Issue taxonomy — the 11 v0 types Antonio works through in the Triage view.
// ────────────────────────────────────────────────────────────────
export type IssueType =
  | 'doc_mismatch'
  | 'doc_gap'
  | 'ero_pending'
  | 'prep_decision'
  | 'signature_pending'
  | 'extension_risk'
  | 'payment_status'
  | 'meeting_prep'
  | 'missing_info'
  | 'quick_reply'
  | 'irs_notice';

export const ISSUE_TYPES: readonly IssueType[] = [
  'doc_mismatch',
  'doc_gap',
  'ero_pending',
  'prep_decision',
  'signature_pending',
  'extension_risk',
  'payment_status',
  'meeting_prep',
  'missing_info',
  'quick_reply',
  'irs_notice',
] as const;

export const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  doc_mismatch: 'Document mismatch',
  doc_gap: 'Document gap',
  ero_pending: 'ERO pending',
  prep_decision: 'Prep decision',
  signature_pending: 'Signature',
  extension_risk: 'Extension risk',
  payment_status: 'Payment',
  meeting_prep: 'Meeting prep',
  missing_info: 'Missing info',
  quick_reply: 'Quick reply',
  irs_notice: 'IRS notice',
};

// Default time-to-clear ETA (minutes) per issue type.
// v0 model: rolling avg constant. Refined in v1 with accumulated history.
export const ISSUE_DEFAULT_ETA_MINUTES: Record<IssueType, number> = {
  doc_mismatch: 15,
  doc_gap: 5,
  ero_pending: 10,
  prep_decision: 30,
  signature_pending: 5,
  extension_risk: 20,
  payment_status: 5,
  meeting_prep: 20,
  missing_info: 10,
  quick_reply: 5,
  irs_notice: 25,
};

export type IssueSeverity = 'high' | 'medium' | 'low';
export type IssueStatus = 'open' | 'in_progress' | 'snoozed' | 'resolved' | 'archived';

// ────────────────────────────────────────────────────────────────
// Engagement taxonomy.
// ────────────────────────────────────────────────────────────────
export type EngagementType =
  | 'return_1040'
  | 'return_1120s'
  | 'return_1065'
  | 'return_1120'
  | 'representation'
  | 'advisory'
  | 'bookkeeping';

export type EngagementStatus =
  | 'intake'
  | 'docs'
  | 'prep'
  | 'review'
  | 'signature'
  | 'file'
  | 'pay'
  | 'done'
  | 'extended'
  | 'on_hold';

// ────────────────────────────────────────────────────────────────
// Signature types — the IRS-authority + engagement documents.
// ────────────────────────────────────────────────────────────────
export type SignatureType =
  | 'engagement_letter'
  | 'consent_7216'
  | 'form_8879'
  | 'form_2848'
  | 'form_8821';

export type SignatureStatus =
  | 'pending'
  | 'sent'
  | 'signed'
  | 'declined'
  | 'expired'
  | 'kba-failed';

// ────────────────────────────────────────────────────────────────
// Channel types — every comm surface.
// ────────────────────────────────────────────────────────────────
export type Channel = 'email' | 'sms' | 'portal_chat' | 'voicemail' | 'phone_call' | 'in_person';
export type Direction = 'inbound' | 'outbound';

// ────────────────────────────────────────────────────────────────
// Evidence schema — what an issue's evidence JSONB looks like.
// Each issue type has its own evidence shape. Documented per type.
// ────────────────────────────────────────────────────────────────
export type IssueSource = {
  kind: 'email' | 'document' | 'intake_response' | 'prior_return' | 'irs_transcript' | 'xero_invoice' | 'calendar_event' | 'manual_note';
  ref: string;                  // domain-specific reference (gmail message id, document id, etc.)
  label: string;                // human-readable ("Intake response (Jan 18)", "TikTok 1099-NEC")
};

export type DocMismatchEvidence = {
  intakeAmount: { value: number; source: string; confidence: 'low' | 'medium' | 'high' };
  documentAmount: { value: number; source: string; confidence: 'low' | 'medium' | 'high' };
  difference: number;
  field: string;                // 'income_1099_nec' | 'wages_w2' | 'capital_gains' | etc.
};

export type DocGapEvidence = {
  expectedDocs: Array<{ kind: string; reason: string; deadline?: string }>;
  uploadedDocs: string[];
  missingDocs: string[];
};

export type SignaturePendingEvidence = {
  signatureId: string;
  signatureType: SignatureType;
  sentAt?: string;
  daysOpen: number;
  kbaRequired: boolean;
};

// (Other issue types' evidence shapes added as agents are built.)

// ────────────────────────────────────────────────────────────────
// Action log entry — every tool call, every AI inference goes here.
// THIS IS THE MOAT. Practice ledger.
// ────────────────────────────────────────────────────────────────
export type ActionLogEntry = {
  id: string;
  tenantId: TenantId;
  clientId: ClientId | null;
  userId: UserId | null;
  agentId: AgentId | null;
  actionClass: ActionClass;
  toolName: string;
  toolInput: unknown;
  toolOutput: unknown;
  modelUsed: 'haiku-4-5' | 'sonnet-4-6' | 'opus-4-7' | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  costUsd: number | null;
  latencyMs: number;
  success: boolean;
  errorMessage: string | null;
  createdAt: Date;
};

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
export function asTenantId(s: string): TenantId {
  return s as TenantId;
}
export function asClientId(s: string): ClientId {
  return s as ClientId;
}
export function asUserId(s: string): UserId {
  return s as UserId;
}
