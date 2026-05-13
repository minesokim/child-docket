import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  bigint,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  real,
  date,
  customType,
  foreignKey,
  check,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Custom type helpers — Drizzle 0.45 doesn't have a built-in for these
// shapes that's stable across versions, so we declare them locally.

// int[] — Postgres native integer array. Used by authorities.applicable_tax_years.
const intArray = customType<{ data: number[]; driverData: number[] }>({
  dataType() {
    return 'int[]';
  },
});

// text[] — Postgres native text array. Used by authority_chunks.section_path.
const textArray = customType<{ data: string[]; driverData: string[] }>({
  dataType() {
    return 'text[]';
  },
});

// bytea — raw bytes. Used by actions.prev_hash + actions.row_hash
// (cryptographic chain, migration 0022). Application code never
// WRITES these — the BEFORE INSERT trigger fills them. Read-side
// returns Buffer (Node) / Uint8Array.
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return 'bytea';
  },
});

// vector(1024) — pgvector column for embedding storage. Used by
// authority_chunks.embedding (migration 0028). The driver round-trips
// as the canonical "[f1,f2,...]" text format pgvector emits; we serialize
// number[] → bracketed string on insert and parse on read. Keeps the
// schema portable across postgres drivers (node-postgres, postgres.js)
// that don't all bind vector natively. NULL is permitted — pre-ingest
// rows have it; the retriever filters via `WHERE embedding IS NOT NULL`
// when running cosine queries.
const vector1024 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1024)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    if (typeof value !== 'string') return value as unknown as number[];
    return value.replace(/^\[|\]$/g, '').split(',').map(Number);
  },
});

// ──────────────────────────────────────────────────────────────
// v0 schema. Multi-tenant via RLS on tenant_id (added in migration).
// Every table touching tenant data has tenant_id NOT NULL.
// ──────────────────────────────────────────────────────────────

export const trustLevelEnum = pgEnum('trust_level', ['1', '2', '3', '4']);

// User role enum — firm staff only. Clients/taxpayers don't have roles
// (they're not in the users table). See @docket/shared exports for the
// type-side companion + the policy matrix in
// apps/command-room/src/lib/require-role.ts.
export const userRoleEnum = pgEnum('user_role', [
  'firm_owner',
  'preparer',
  'reviewer',
  'admin',
  'assistant',
]);
export const actionClassEnum = pgEnum('action_class', [
  'read',
  'draft',
  'classify',
  'send-internal',
  'send-external',
  'mutate-tax-software',
  'mutate-intake',           // taxpayer-initiated write to intake_responses
  'file',
]);
export const modelEnum = pgEnum('model_used', ['haiku-4-5', 'sonnet-4-6', 'opus-4-7']);

// ────────────────────────────────────────────────────────────────
// Issue taxonomy — the 11 v0 issue types Antonio works through in the Triage view.
// Issue types map 1:1 to v4 dashboard categories (per docs/STRATEGIC-BRIEF.md).
// ────────────────────────────────────────────────────────────────
export const issueTypeEnum = pgEnum('issue_type', [
  'doc_mismatch',         // intake says X, document shows Y (Priya's TikTok 1099 case)
  'doc_gap',              // required document not yet uploaded
  'ero_pending',          // ERO countersignature required to file
  'prep_decision',        // entity choice / structural decision blocking prep (S-corp vs LLC)
  'signature_pending',    // engagement letter / §7216 / 8879 / 2848 / 8821 awaiting signature
  'extension_risk',       // no portal activity + deadline approaching
  'payment_status',       // paid / signed / ready to file (or unpaid blocking work)
  'meeting_prep',         // scheduled call needs brief
  'missing_info',         // specific data point missing (1095-A, basis, dependent SSN)
  'quick_reply',          // client message awaiting short response
  'irs_notice',           // CP2000 / CP504 / LT11 / etc. arrived
]);

export const issueSeverityEnum = pgEnum('issue_severity', ['high', 'medium', 'low']);

export const issueStatusEnum = pgEnum('issue_status', [
  'open',
  'in_progress',
  'snoozed',
  'resolved',
  'archived',
]);

// ────────────────────────────────────────────────────────────────
// Engagement types — Antonio's full lifecycle: prep, rep, advisory.
// ────────────────────────────────────────────────────────────────
export const engagementTypeEnum = pgEnum('engagement_type', [
  'return_1040',          // individual income tax
  'return_1120s',         // S-corp
  'return_1065',          // partnership
  'return_1120',          // C-corp
  'representation',       // IRS notice / audit / collections work
  'advisory',             // tax planning, entity choice, etc.
  'bookkeeping',          // ongoing books
]);

export const engagementStatusEnum = pgEnum('engagement_status', [
  'intake',
  'docs',
  'prep',
  'review',
  'signature',
  'file',
  'pay',
  'done',
  'extended',
  'on_hold',
]);

// ────────────────────────────────────────────────────────────────
// Signature types — the IRS-authority + engagement-control documents.
// 8879 requires KBA per IRS Pub 1345 (verify with tax attorney before live).
// ────────────────────────────────────────────────────────────────
export const signatureTypeEnum = pgEnum('signature_type', [
  'engagement_letter',
  'consent_7216',         // §7216 disclosure consent — criminal penalty if wrong
  'form_8879',            // individual e-file authorization (REQUIRES KBA)
  'form_2848',            // power of attorney
  'form_8821',            // tax info authorization
]);

export const signatureStatusEnum = pgEnum('signature_status', [
  'pending',
  'sent',
  'signed',
  'declined',
  'expired',
  // Migration 0027 — distinguishes KBA-failure from envelope-declined.
  // Per IRS Pub 1345, a KBA-failed envelope must be re-issued fresh;
  // DocuSign retries against the same envelope are not compliant.
  'kba-failed',
]);

// ────────────────────────────────────────────────────────────────
// Channel types — every comm surface.
// ────────────────────────────────────────────────────────────────
export const channelEnum = pgEnum('channel', [
  'email',
  'sms',
  'portal_chat',
  'voicemail',
  'phone_call',
  'in_person',
]);

export const directionEnum = pgEnum('direction', ['inbound', 'outbound']);

// Tenants (firms). One row per tax practice.
export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  timezone: text('timezone').notNull().default('America/Los_Angeles'),
  // Clerk Organization id mapping. One Clerk Org = one tenant.
  // Firm staff (owner / preparer / reviewer / admin) are members of the
  // org with Clerk-managed memberships + roles. Clients (taxpayers)
  // are NOT in any Clerk org — they auth via phone OTP and bind to
  // pre-seeded `clients` rows by phone match. See May 2026 multi-firm
  // wiring (Day 2 of post-audit hardening).
  //
  // Nullable for migration backfill. Code paths that read this should
  // fall back gracefully when null — Antonio creates the Clerk Org via
  // dashboard, then UPDATE this once. Subsequent firms will set this
  // at provisioning time.
  clerkOrgId: text('clerk_org_id').unique(),
  defaultTrustLevel: trustLevelEnum('default_trust_level').notNull().default('1'),
  bedrockEnabled: boolean('bedrock_enabled').notNull().default(false),
  awsRegion: text('aws_region'),
  // Per-tenant Data Encryption Key (DEK), encrypted with the master KEK
  // from PII_ENCRYPTION_KEY. Stored as base64 of [12-byte IV][16-byte tag]
  // [N-byte ciphertext]. Generated at tenant provisioning, never rotated
  // in v0 (rotation lands when KMS replaces env-var KEK).
  //
  // Defense-in-depth model: a database compromise alone yields encrypted
  // DEKs that can't be decrypted without the master KEK held in env. A
  // master-key compromise alone yields ciphertext that can't be decrypted
  // without DB access to the per-tenant DEK rows. Both required to
  // exfiltrate plaintext SSNs/EINs/bank routing for any one tenant.
  //
  // Nullable for migration backfill; the application throws if a tenant
  // hits a sensitive write/read with no DEK provisioned.
  dekEncrypted: text('dek_encrypted'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Users (preparers + staff). Maps to Clerk user IDs.
//
// Role is enforced at two layers:
//   - Schema: userRoleEnum (Postgres rejects unknown values at write).
//   - App: requireRole() / assertRole() in apps/command-room/src/lib/
//     require-role.ts gate sensitive Server Components + Server Actions.
//
// Policy matrix lives in require-role.ts header. Default 'preparer' is
// the safe baseline — anyone newly seeded without an explicit role gets
// preparer access (NOT firm_owner — that's the role with PTIN signing
// authority and team-management privileges, only Antonio for now).
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    clerkUserId: text('clerk_user_id').notNull().unique(),
    email: text('email').notNull(),
    name: text('name'),
    role: userRoleEnum('role').notNull().default('preparer'),
    // Profile picture URL. Populated from Clerk's user.imageUrl on
    // sign-in (claim path or auto-provision). NULL when Clerk hasn't
    // captured one yet — UI falls back to initials of `name`.
    //
    // Stored at the column level (not pulled from Clerk on every read)
    // so client portal pages — which surface the firm owner's avatar
    // to taxpayers — don't need to fetch a Clerk session per request.
    avatarUrl: text('avatar_url'),
    // Per-user theme override. NULL = inherit firm default from
    // tenant_settings.theme_pref. Added migration 0031.
    themePref: text('theme_pref').$type<'light' | 'dark' | 'system' | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tenantIdx: index('users_tenant_idx').on(t.tenantId) }),
);

// Clients (taxpayers). One row per taxpayer per tenant.
// Real signups (phone OTP via Clerk) get clerk_user_id set on creation.
// Seed clients have clerk_user_id = NULL (placeholder rows for demo data).
export const clients = pgTable(
  'clients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    clerkUserId: text('clerk_user_id').unique(),
    fullName: text('full_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    preferredLanguage: text('preferred_language').notNull().default('en'),
    state: text('state'),
    intakeStatus: text('intake_status').notNull().default('not-started'),
    kycStatus: text('kyc_status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('clients_tenant_idx').on(t.tenantId),
    phoneIdx: index('clients_phone_idx').on(t.tenantId, t.phone),
    clerkIdx: index('clients_clerk_user_idx').on(t.clerkUserId),
    // Global phone index for the binding lookup at first sign-in.
    // We don't yet know the tenant when a client completes phone OTP,
    // so the lookup is global (`SELECT ... WHERE phone = X AND
    // clerk_user_id IS NULL`). The (tenantId, phone) composite above
    // is leading-key tenantId, which Postgres can't use efficiently
    // for a phone-only predicate. See client-portal/src/lib/intake/auth.ts.
    phoneGlobalIdx: index('clients_phone_global_idx').on(t.phone),
  }),
);

// Documents uploaded by clients.
//
// parse_phase transitions (app-controlled):
//   uploaded     bytes in R2 + documents row exists + classify event fired
//   classifying  Inngest worker picked up event, Haiku vision in flight
//   parsed       classification complete, awaiting user verification
//   accepted     user confirmed; finalize event fired
//   finalizing   Inngest worker running binarize + PDF + rename + upload
//   final        processing complete; final_storage_key populated
//   failed       classification or finalization errored
//
// TWO STORAGE KEYS PER DOC
//   storage_key       — original raw upload (preserved for audit)
//   final_storage_key — processed PDF (what preparers see + send)
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
    storageKey: text('storage_key').notNull(),
    originalFilename: text('original_filename').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    /** docKind from the doc-classifier agent (w2, 1099_nec, drivers_license, ...). */
    aiClassification: text('ai_classification'),
    /** [0..1] classification confidence. */
    aiConfidence: real('ai_confidence'),
    /** [0..1] image legibility — 1.0 perfect, <0.5 retake. */
    aiLegibility: real('ai_legibility'),
    /** Per-kind extracted fields (cents-as-int amounts). */
    aiExtracted: jsonb('ai_extracted'),
    /** Suggested filename from the classifier ("2024_W-2_RiversideUnified.pdf"). */
    aiSuggestedFilename: text('ai_suggested_filename'),
    /** Plain-English retake hint when legibility < 0.5. */
    aiRetakeHint: text('ai_retake_hint'),
    /** When the classification finished (success or failure). */
    aiClassifiedAt: timestamp('ai_classified_at', { withTimezone: true }),
    /** When the user accepted the classification (advances UX to "saved"). */
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    /** Latest error message if classification or finalization failed. */
    errorMessage: text('error_message'),
    parsePhase: text('parse_phase').notNull().default('uploaded'),
    /** Final processed PDF location in R2. NULL until finalize worker runs. */
    finalStorageKey: text('final_storage_key'),
    /** Final filename (e.g., "2024_W-2_RiversideUnified.pdf"). */
    finalFilename: text('final_filename'),
    /** Final PDF byte size. */
    finalSizeBytes: integer('final_size_bytes'),
    /** Final MIME — always 'application/pdf' once finalized. */
    finalMimeType: text('final_mime_type'),
    /** When the finalize pipeline completed. */
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    /** Whether binarization was applied. False for ID docs + PDF inputs. */
    binarized: boolean('binarized').notNull().default(false),
    /**
     * Bound expected-doc slot id (e.g., 'identity-dl-front',
     * 'income-w2', 'dependent-ssn-0'). NULL for "Other" uploads with
     * no specific slot. Drives slot-aware filename composition in the
     * finalize worker + direct slot lookups on the docs overview.
     * See packages/shared/src/required-docs.ts for the slot id space.
     */
    slotId: text('slot_id'),
    /**
     * When set, this row was consumed into a multi-page composite
     * (DL front merged into the back's 2-page PDF). The composite
     * row carries the merged final_storage_key + final_filename;
     * this row's raw upload still exists for "view raw" but is
     * hidden from doc listings.
     */
    mergedIntoDocumentId: uuid('merged_into_document_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('documents_tenant_idx').on(t.tenantId),
    clientIdx: index('documents_client_idx').on(t.tenantId, t.clientId),
    parsePhaseIdx: index('documents_parse_phase_idx').on(t.tenantId, t.parsePhase),
    slotIdx: index('documents_slot_idx').on(t.tenantId, t.clientId, t.slotId),
    mergedIntoIdx: index('documents_merged_into_idx').on(t.mergedIntoDocumentId),
  }),
);

// Messages — every comm in every channel.
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(), // sms · email · portal-chat · voicemail
    direction: text('direction').notNull(), // inbound · outbound
    body: text('body').notNull(),
    aiDraftedBy: text('ai_drafted_by'),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantClientIdx: index('messages_tenant_client_idx').on(t.tenantId, t.clientId),
  }),
);

// THE MOAT — every tool call, every AI inference, every approval.
//
// FK retention rules (May 2026 security audit):
//   - tenantId: ON DELETE CASCADE. If a tenant is fully removed (very
//     rare, manual op), audit history goes with it; tenant data should
//     not be queryable post-deletion under any circumstance.
//   - clientId: ON DELETE SET NULL. CCPA right-to-delete must be able
//     to remove a client's PII (clients row, intake_responses, etc.)
//     while PRESERVING the audit trail of what happened to that data.
//     `actions` is append-only by trigger (migration 0007); cascading
//     deletes from clients would defeat the SOC 2 evidence chain by
//     silently bypassing the trigger via FK action. Set-null keeps
//     the audit row, the action_class, the timestamp, and the
//     anonymized record of what was done — without retaining linkage
//     to the deleted PII subject.
//   - userId: no cascade (default). Same logic — user departures
//     shouldn't erase the actions they took.
export const actions = pgTable(
  'actions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id),
    agentId: text('agent_id'),
    actionClass: actionClassEnum('action_class').notNull(),
    toolName: text('tool_name').notNull(),
    toolInput: jsonb('tool_input'),
    toolOutput: jsonb('tool_output'),
    modelUsed: modelEnum('model_used'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cachedTokens: integer('cached_tokens'),
    costUsd: real('cost_usd'),
    latencyMs: integer('latency_ms').notNull(),
    success: boolean('success').notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Cryptographic chain (migration 0022). NEVER write from app
     * code — the BEFORE INSERT trigger `actions_set_chain` fills
     * all three. Per-tenant chain; chain_seq + prev_hash are NULL
     * on legacy rows from before migration 0022. Note that client_id
     * is intentionally EXCLUDED from the chain hash because of the
     * migration 0012 carve-out (CCPA NULL'ing); see 0022 header.
     */
    chainSeq: bigint('chain_seq', { mode: 'number' }),
    prevHash: bytea('prev_hash'),
    rowHash: bytea('row_hash'),
  },
  (t) => ({
    tenantCreatedIdx: index('actions_tenant_created_idx').on(t.tenantId, t.createdAt),
    agentIdx: index('actions_agent_idx').on(t.tenantId, t.agentId),
    /**
     * Used by the chain trigger for "most recent prior chain_seq"
     * lookup, and by verify_actions_chain to walk in order. Partial
     * — legacy rows (chain_seq IS NULL) excluded.
     */
    tenantChainSeqUniq: uniqueIndex('actions_tenant_chain_seq_uniq')
      .on(t.tenantId, t.chainSeq)
      .where(sql`chain_seq IS NOT NULL`),
  }),
);

// Approvals — every preparer accept/reject of an AI suggestion.
export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    actionId: uuid('action_id').notNull().references(() => actions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id),
    decision: text('decision').notNull(), // approve · reject · edit
    editPayload: jsonb('edit_payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ tenantIdx: index('approvals_tenant_idx').on(t.tenantId) }),
);

// ────────────────────────────────────────────────────────────────
// Engagements — a typed unit of work for a client. Multiple per client per year.
// Drives the pipeline state in the Command Room (Intake → Docs → Prep → ...).
// ────────────────────────────────────────────────────────────────
export const engagements = pgTable(
  'engagements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
    type: engagementTypeEnum('type').notNull(),
    status: engagementStatusEnum('status').notNull().default('intake'),
    taxYear: integer('tax_year'),
    feeQuotedCents: integer('fee_quoted_cents'),
    feeCollectedCents: integer('fee_collected_cents').notNull().default(0),
    depositPaidCents: integer('deposit_paid_cents').notNull().default(0),
    /**
     * When true, the intake /deposit page skips the deposit gate.
     * Antonio sets this for referral / pro-bono / waived engagements
     * via /clients/[id]. Migration 0025.
     */
    depositWaived: boolean('deposit_waived').notNull().default(false),
    deadline: timestamp('deadline', { withTimezone: true }),
    extendedDeadline: timestamp('extended_deadline', { withTimezone: true }),
    complexityFlags: jsonb('complexity_flags').$type<string[]>().default([]).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    tenantIdx: index('engagements_tenant_idx').on(t.tenantId),
    clientIdx: index('engagements_client_idx').on(t.tenantId, t.clientId),
    statusIdx: index('engagements_status_idx').on(t.tenantId, t.status),
    deadlineIdx: index('engagements_deadline_idx').on(t.tenantId, t.deadline),
  }),
);

// ────────────────────────────────────────────────────────────────
// Issues — the Triage queue. THIS IS THE PRODUCT.
// One row per surfaced issue. Antonio works through them.
// Every issue has: client + type + evidence + recommended action + sources.
// ────────────────────────────────────────────────────────────────
export const issues = pgTable(
  'issues',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
    engagementId: uuid('engagement_id').references(() => engagements.id, { onDelete: 'set null' }),
    type: issueTypeEnum('type').notNull(),
    severity: issueSeverityEnum('severity').notNull().default('medium'),
    status: issueStatusEnum('status').notNull().default('open'),

    // What the user sees
    title: text('title').notNull(),                              // "Priya's TikTok 1099 doesn't match her intake"
    summary: text('summary').notNull(),                          // 1-line subtitle
    whyThisMatters: text('why_this_matters'),                    // longer explanation in detail panel
    recommendedAction: text('recommended_action'),               // human-readable next step

    // Structured evidence (sources, attachments, signals) — JSONB schema documented in @docket/shared
    evidence: jsonb('evidence').$type<Record<string, unknown>>(),
    sources: jsonb('sources').$type<Array<{ kind: string; ref: string; label: string }>>(),

    // AI metadata
    classifiedBy: text('classified_by'),                         // agent id, e.g. 'triage-classifier'
    aiConfidence: real('ai_confidence'),                         // 0-1
    draftActionId: uuid('draft_action_id').references(() => actions.id, { onDelete: 'set null' }),

    // Time-to-clear ETA (minutes). Simple v0 model: rolling avg per type.
    etaMinutes: integer('eta_minutes'),

    // Lifecycle
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id),
    resolutionNote: text('resolution_note'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantStatusIdx: index('issues_tenant_status_idx').on(t.tenantId, t.status),
    tenantSeverityIdx: index('issues_tenant_severity_idx').on(t.tenantId, t.severity),
    tenantTypeIdx: index('issues_tenant_type_idx').on(t.tenantId, t.type),
    clientIdx: index('issues_client_idx').on(t.tenantId, t.clientId),
    engagementIdx: index('issues_engagement_idx').on(t.tenantId, t.engagementId),
    snoozedUntilIdx: index('issues_snoozed_until_idx').on(t.tenantId, t.snoozedUntil),
  }),
);

// ────────────────────────────────────────────────────────────────
// Signatures — engagement letter, §7216 consent, 8879, 2848, 8821.
// 8879 requires KBA per IRS Pub 1345 — pending tax attorney review.
// ────────────────────────────────────────────────────────────────
export const signatures = pgTable(
  'signatures',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
    engagementId: uuid('engagement_id').references(() => engagements.id, { onDelete: 'cascade' }),
    type: signatureTypeEnum('type').notNull(),
    status: signatureStatusEnum('status').notNull().default('pending'),
    documentText: text('document_text'),                         // rendered document content
    documentStorageKey: text('document_storage_key'),            // R2 key for archived signed copy
    kbaRequired: boolean('kba_required').notNull().default(false),
    kbaPassedAt: timestamp('kba_passed_at', { withTimezone: true }),
    kbaProvider: text('kba_provider'),                           // 'lexisnexis' (DocuSign-bundled) or 'lexisnexis_direct'
    sentAt: timestamp('sent_at', { withTimezone: true }),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    signedByIp: text('signed_by_ip'),
    signedByUserAgent: text('signed_by_user_agent'),
    auditPayload: jsonb('audit_payload').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('signatures_tenant_idx').on(t.tenantId),
    clientIdx: index('signatures_client_idx').on(t.tenantId, t.clientId),
    engagementIdx: index('signatures_engagement_idx').on(t.tenantId, t.engagementId),
    statusIdx: index('signatures_status_idx').on(t.tenantId, t.status),
  }),
);

// ────────────────────────────────────────────────────────────────
// Gmail threads — raw Gmail messages we've ingested for classification.
// Inngest cron polls every 10 min, pulls new threads, persists here, classifies.
// ────────────────────────────────────────────────────────────────
export const gmailThreads = pgTable(
  'gmail_threads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    gmailMessageId: text('gmail_message_id').notNull(),          // unique Gmail message ID
    gmailThreadId: text('gmail_thread_id').notNull(),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'set null' }),
    direction: directionEnum('direction').notNull(),
    fromAddress: text('from_address').notNull(),
    toAddresses: jsonb('to_addresses').$type<string[]>().notNull(),
    subject: text('subject'),
    bodyText: text('body_text'),
    bodyHtml: text('body_html'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),
    classifiedIssueId: uuid('classified_issue_id').references(() => issues.id, { onDelete: 'set null' }),
    classifiedAt: timestamp('classified_at', { withTimezone: true }),
    rawPayload: jsonb('raw_payload'),                            // full Gmail API response for replay
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('gmail_threads_tenant_idx').on(t.tenantId),
    gmailMessageIdx: index('gmail_threads_message_idx').on(t.tenantId, t.gmailMessageId),
    clientIdx: index('gmail_threads_client_idx').on(t.tenantId, t.clientId),
    receivedAtIdx: index('gmail_threads_received_at_idx').on(t.tenantId, t.receivedAt),
    unclassifiedIdx: index('gmail_threads_unclassified_idx').on(t.tenantId, t.classifiedAt),
  }),
);

// ────────────────────────────────────────────────────────────────
// Intake responses — answers from the 36-screen client portal flow.
// One row per intake (per client per tax year). Stores all answers as JSONB.
// ────────────────────────────────────────────────────────────────
export const intakeResponses = pgTable(
  'intake_responses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
    engagementId: uuid('engagement_id').references(() => engagements.id, { onDelete: 'cascade' }),
    taxYear: integer('tax_year').notNull(),
    status: text('status').notNull().default('in_progress'),     // in_progress · complete · abandoned
    completedSteps: jsonb('completed_steps').$type<string[]>().default([]).notNull(),
    answers: jsonb('answers').$type<Record<string, unknown>>().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    // updatedAt is set on every saveIntakeField. Used for audit-trail debugging
    // ("when did this field last flip?") and as an optimistic-concurrency token
    // if we ever need it. notice_responses has the same column for parity.
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    abandonedAt: timestamp('abandoned_at', { withTimezone: true }),
  },
  (t) => ({
    tenantIdx: index('intake_responses_tenant_idx').on(t.tenantId),
    // UNIQUE on (tenant_id, client_id, tax_year). Prevents the first-visit
    // race in getOrCreateIntakeAnswers from creating duplicate rows when two
    // concurrent requests fire (e.g., user double-clicks the "Continue" CTA
    // on the welcome screen). With the unique constraint in place, the second
    // INSERT errors and the caller falls back to SELECT — single source of
    // truth per (tenant, client, year).
    clientYearUnique: uniqueIndex('intake_responses_client_year_uidx').on(
      t.tenantId,
      t.clientId,
      t.taxYear,
    ),
  }),
);

// ────────────────────────────────────────────────────────────────
// Tenant credentials — per-firm secrets vault.
//
// One row per (tenant, integration kind). Each row's `data` column is
// an EncryptedMarker ({__enc: base64}) encrypted with that tenant's
// DEK — same key that protects SSN/EIN/bank in intake_responses.
//
// Why per-tenant + DEK-encrypted (not env vars)?
//   - Vercel env vars are global per deploy. Per-firm secrets in env
//     would force a snowflake-per-customer pattern (CLAUDE.md §16).
//   - DEK encryption means even cross-tenant DB access can't decrypt
//     another firm's secrets at the crypto layer.
//
// The same table holds Twilio + Square + DocuSign + Gmail going
// forward; the `kind` column discriminates. Helpers in
// packages/db/src/tenant-credentials.ts encrypt/decrypt + validate
// the per-kind shape on read.
// ────────────────────────────────────────────────────────────────
export const tenantCredentials = pgTable(
  'tenant_credentials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    // Free-text discriminator. App-side validation enforces the
    // known set ('twilio' | 'square' | 'docusign' | 'gmail' | ...).
    // Free-text on purpose so we don't need a migration to add the
    // next integration.
    kind: text('kind').notNull(),
    // EncryptedMarker shape: {__enc: <base64-iv-tag-ciphertext>}.
    // Decrypts to a JSON object whose shape varies per kind. See
    // tenant-credentials.ts for the per-kind shapes.
    data: jsonb('data').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    // Independent of updatedAt — metadata-only writes shouldn't reset
    // the rotation clock. Set explicitly when secrets actually change.
    rotatedAt: timestamp('rotated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('tenant_credentials_tenant_idx').on(t.tenantId),
    tenantKindUniq: uniqueIndex('tenant_credentials_tenant_kind_uniq').on(t.tenantId, t.kind),
  }),
);

// ────────────────────────────────────────────────────────────────
// Payments — per-tenant Square Checkout link state.
// One row per checkout link minted; status transitions on
// refresh-status action OR future webhook. Migration 0024.
// ────────────────────────────────────────────────────────────────
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
    engagementId: uuid('engagement_id').references(() => engagements.id, { onDelete: 'set null' }),
    squarePaymentLinkId: text('square_payment_link_id').notNull(),
    squareOrderId: text('square_order_id').notNull(),
    // Free-text with CHECK constraint at DB level (matches enum:
    // pending | paid | partial | refunded | cancelled | failed).
    status: text('status').notNull().default('pending'),
    amountCents: integer('amount_cents').notNull(),
    collectedCents: integer('collected_cents').notNull().default(0),
    refundedCents: integer('refunded_cents').notNull().default(0),
    currency: text('currency').notNull().default('USD'),
    checkoutUrl: text('checkout_url').notNull(),
    taxYear: integer('tax_year'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
    lastSquareStatus: text('last_square_status'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantLinkUniq: uniqueIndex('payments_tenant_link_uniq').on(t.tenantId, t.squarePaymentLinkId),
    tenantClientIdx: index('payments_tenant_client_idx').on(t.tenantId, t.clientId),
    tenantStatusIdx: index('payments_tenant_status_idx').on(t.tenantId, t.status),
    engagementIdx: index('payments_engagement_idx').on(t.tenantId, t.engagementId),
  }),
);

// ────────────────────────────────────────────────────────────────
// Gmail sync state — per-tenant polling cursor for the gmail-poll
// Inngest cron. One row per tenant; tracks Gmail historyId + the
// timestamps the dashboard uses to show stale-poll tenants.
// Migration 0023.
// ────────────────────────────────────────────────────────────────
export const gmailSyncState = pgTable(
  'gmail_sync_state',
  {
    tenantId: uuid('tenant_id').primaryKey().references(() => tenants.id, { onDelete: 'cascade' }),
    // Gmail's history cursor. ~7-day TTL per Gmail API docs — falls
    // out of window → 404 from history.list → bootstrap from current
    // historyId via getProfile.
    lastHistoryId: text('last_history_id'),
    lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
    lastAdvancedAt: timestamp('last_advanced_at', { withTimezone: true }),
    totalClassified: integer('total_classified').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    polledIdx: index('gmail_sync_state_polled_idx').on(t.lastPolledAt),
  }),
);

// ────────────────────────────────────────────────────────────────
// Notice responses — IRS notices and the drafted/sent responses.
// Powers the irs_notice issue type. Antonio uploads a notice or it arrives via
// IRS Solutions API (when key lands); AI classifies + drafts response.
// ────────────────────────────────────────────────────────────────
export const noticeResponses = pgTable(
  'notice_responses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
    issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'set null' }),
    noticeType: text('notice_type'),                             // CP2000, CP504, LT11, etc.
    noticeDate: timestamp('notice_date', { withTimezone: true }),
    proposedAdjustmentCents: integer('proposed_adjustment_cents'),
    noticeStorageKey: text('notice_storage_key'),                // R2 key of uploaded notice PDF
    extractedText: text('extracted_text'),                       // OCR'd text
    draftResponse: text('draft_response'),                       // AI-drafted response
    finalResponse: text('final_response'),                       // post-edit final
    responseSentAt: timestamp('response_sent_at', { withTimezone: true }),
    irsResponseAt: timestamp('irs_response_at', { withTimezone: true }),
    outcome: text('outcome'),                                    // accepted / partial / denied / pending
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('notice_responses_tenant_idx').on(t.tenantId),
    clientIdx: index('notice_responses_client_idx').on(t.tenantId, t.clientId),
    issueIdx: index('notice_responses_issue_idx').on(t.tenantId, t.issueId),
  }),
);

// ────────────────────────────────────────────────────────────────
// KNOWLEDGE LAYER (CEO plan D14) — `authorities` is the unit of
// citation. The IRC, Treas Regs, IRS Pubs, FTB pubs, firm playbooks
// all live here.
//
// tenant_id IS NULL → global authority, every firm sees it
// tenant_id NOT NULL → firm-internal (playbook / memo / template)
//
// Effective-date model: every authority has an effective_date and an
// optional superseded_date + superseded_by_id. Retrieval queries filter
// to authorities in effect on the relevant date so we never cite
// outdated law.
//
// Per D12 retrieval architecture: chunk-level (~512 tokens) hybrid
// search via BM25 (tsvector — already wired here) + cosine similarity
// (Voyage embeddings — column added in a follow-up migration).
// ────────────────────────────────────────────────────────────────
export const authorityKindEnum = pgEnum('authority_kind', [
  'irc',                // Internal Revenue Code section
  'treas_reg',          // Treasury Regulation
  'irs_pub',            // IRS Publication (Pub 17, Pub 535, ...)
  'irs_form',           // IRS Form / Instructions
  'irs_irm',            // Internal Revenue Manual
  'irs_irb',            // Internal Revenue Bulletin
  'irs_notice',         // IRS Notice
  'irs_revrul',         // Revenue Ruling
  'irs_revproc',        // Revenue Procedure
  'tax_court',          // Tax Court opinion
  'ca_ftb_pub',         // CA FTB publication
  'ca_ftb_legal',       // CA FTB Legal Ruling
  'ca_ftb_form',        // CA FTB Form / Instructions
  'cdtfa',              // CA Dept of Tax & Fee Admin (sales/use)
  'edd',                // CA Employment Development Dept (payroll)
  'firm_playbook',      // Firm-internal playbook
  'firm_memo',          // Firm-internal memo
  'firm_template',      // Firm-internal template (engagement letter ...)
]);

export const authorityJurisdictionEnum = pgEnum('authority_jurisdiction', [
  'federal',
  'CA',
  'firm',
]);

export const authorities = pgTable(
  'authorities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // NULL for global authorities (IRS / FTB / etc.).
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    kind: authorityKindEnum('kind').notNull(),
    jurisdiction: authorityJurisdictionEnum('jurisdiction').notNull(),
    /** Display-form citation: "IRS Pub 17 (2024)", "IRC §61(a)(1)", etc. */
    citationLabel: text('citation_label').notNull(),
    /** Full title for detail panels. */
    title: text('title').notNull(),
    /** Stable URL slug for routing inside Docket. Unique per scope. */
    slug: text('slug').notNull(),
    /** Canonical external URL (irs.gov, ftb.ca.gov, ...). NULL for firm authorities. */
    externalUrl: text('external_url'),
    /** Where we ingested from (URL or R2 key for archived PDFs). */
    sourceUri: text('source_uri'),
    /** When this authority TAKES effect. Required. */
    effectiveDate: date('effective_date').notNull(),
    /** When this authority was retired / replaced. NULL = still in effect. */
    supersededDate: date('superseded_date'),
    /** Replacement authority (Pub 17 (2024) supersedes Pub 17 (2023)). */
    supersededById: uuid('superseded_by_id'),
    /** Tax year(s) this authority applies to. [] = evergreen. */
    applicableTaxYears: intArray('applicable_tax_years').notNull().default(sql`'{}'::int[]`),
    /** Sha256 of normalized full text for change-detection on re-ingestion. */
    contentHash: text('content_hash'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('authorities_tenant_idx').on(t.tenantId),
    kindIdx: index('authorities_kind_idx').on(t.kind),
    jurisdictionIdx: index('authorities_jurisdiction_idx').on(t.jurisdiction),
    effectiveDateIdx: index('authorities_effective_date_idx').on(t.effectiveDate),
  }),
);

export const authorityChunks = pgTable(
  'authority_chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    authorityId: uuid('authority_id')
      .notNull()
      .references(() => authorities.id, { onDelete: 'cascade' }),
    /**
     * Mirror of authorities.tenant_id — set by BEFORE INSERT trigger.
     * Drizzle inserts MUST omit this field; the trigger fills it from
     * the parent. Application code never writes to it directly.
     */
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    ordinal: integer('ordinal').notNull(),
    /** Hierarchical breadcrumb: ["Part 2", "Chapter 5", "§5.1"]. */
    sectionPath: textArray('section_path').notNull().default(sql`'{}'::text[]`),
    /** Display-friendly anchor ("§5.1: Earned income"). */
    heading: text('heading'),
    /** The chunk text (~512 tokens). Stored verbatim. */
    text: text('text').notNull(),
    /** Char positions in the source for highlight rendering. */
    charStart: integer('char_start'),
    charEnd: integer('char_end'),
    /** Sha256 of `text` for dedup + change-detection. */
    contentHash: text('content_hash').notNull(),
    /**
     * Voyage-3-lite embedding (1024 dims) — added in migration 0028.
     * NULL on every row until C5 ingestion fills it. The retriever
     * filters `WHERE embedding IS NOT NULL` for cosine queries; BM25
     * via the tsv index works regardless.
     */
    embedding: vector1024('embedding'),
    /**
     * Generated tsvector — populated by Postgres GENERATED ALWAYS AS.
     * Drizzle-side, treat as read-only. Not in the insert shape.
     * Embedding column (vector(1024) for voyage-3-lite) added in a
     * follow-up migration when ingestion ships.
     */
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    authorityIdx: index('authority_chunks_authority_idx').on(t.authorityId),
    authorityOrdinalUniq: uniqueIndex('authority_chunks_authority_ordinal_uniq').on(
      t.authorityId,
      t.ordinal,
    ),
    tenantIdx: index('authority_chunks_tenant_idx').on(t.tenantId),
  }),
);

// ────────────────────────────────────────────────────────────────
// Memory architecture (per docs/MEMORY-ARCHITECTURE.md §2).
//
// Three tables backing layers 4 (procedural), 6 (pattern), and the
// per-client fact extraction substrate. The context assembler reads
// these on every agent call — firm_profile in the cached static
// prefix, firm_patterns + client_facts in the dynamic context.
// ────────────────────────────────────────────────────────────────

// PROCEDURAL MEMORY — how this firm/EA works. One row per tenant.
export const firmProfile = pgTable(
  'firm_profile',
  {
    /**
     * tenantId IS the primary key. Exactly one row per tenant by
     * construction. UPSERT pattern: ON CONFLICT (tenant_id) DO UPDATE.
     */
    tenantId: uuid('tenant_id')
      .primaryKey()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Human-readable shorthand for prompt rendering. */
    toneDescriptor: text('tone_descriptor'),
    /** 5-10 representative sent-comm snippets, fed to inbox-drafter. */
    voiceExamples: jsonb('voice_examples')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /**
     * Per-position-type tier preferences. Map from position_key
     * (e.g., 'augusta_rule') to:
     *   { default_tier, acceptance_rate, last_observed_at }
     */
    positionTierPreferences: jsonb('position_tier_preferences')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** "{channel}.{topic}" → { median_response_minutes, p90_minutes } */
    responseCadence: jsonb('response_cadence')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    /**
     * Firm-wide default deposit amount (cents). Used by the intake
     * /deposit page when the engagement doesn't override via
     * fee_quoted_cents. Settings → "Default deposit amount" surface
     * is firm_owner-gated. Migration 0025.
     */
    defaultDepositCents: integer('default_deposit_cents').notNull().default(5000),
    /** Monotonic version. Bumps each meaningful extraction-job delta. */
    version: integer('version').notNull().default(1),
    /**
     * Last 5 snapshots, [{ version, snapshot, replaced_at }]. App
     * trims to 5 on write; schema can't cleanly bound array length.
     */
    priorVersions: jsonb('prior_versions')
      .$type<unknown[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    updatedIdx: index('firm_profile_updated_idx').on(t.updatedAt),
  }),
);

// PATTERN MEMORY — cross-client aggregates per firm.
// One row per (tenant_id, pattern_type, pattern_key).
export const firmPatterns = pgTable(
  'firm_patterns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /**
     * Coarse type. v1 set: 'examiner_response', 'deduction_hit_rate',
     * 'client_segment_metric', 'response_cadence_global'. New types
     * are app-layer additions; no schema change.
     */
    patternType: text('pattern_type').notNull(),
    /** Specific key inside the type (e.g., 'examiner.glendale.mike_chen'). */
    patternKey: text('pattern_key').notNull(),
    /** Aggregate value. Shape varies by patternType. */
    patternValue: jsonb('pattern_value')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    /** Data points supporting the aggregate. <10 = weak signal; ≥30 = trust. */
    observationCount: integer('observation_count').notNull().default(0),
    lastObservedAt: timestamp('last_observed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** 0..1 confidence; CHECK enforced at DB layer (mirrored below). */
    confidence: real('confidence').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantTypeKeyUniq: uniqueIndex('firm_patterns_tenant_type_key_uniq').on(
      t.tenantId,
      t.patternType,
      t.patternKey,
    ),
    tenantTypeIdx: index('firm_patterns_tenant_type_idx').on(t.tenantId, t.patternType),
    lastObservedIdx: index('firm_patterns_last_observed_idx').on(
      t.tenantId,
      t.lastObservedAt,
    ),
    confidenceRange: check(
      'firm_patterns_confidence_range',
      sql`${t.confidence} >= 0 AND ${t.confidence} <= 1`,
    ),
  }),
);

// CLIENT FACTS — atomic facts extracted from narratives.
// Append-mostly; supersession via the `supersededBy` self-FK.
//
// The composite FK (tenant_id, client_id) -> clients(tenant_id, id) is
// declared at the table level via `foreignKey()` below. This is the
// hard guarantee that a fact can't be cross-tenant-bound to a client.
// `clientId` therefore omits a column-level `.references()`.
//
// source_action_id keeps a single-column FK ON DELETE SET NULL because
// composite FKs can't express SET NULL on one column without nulling
// the rest. Tenant validation on source_action_id is enforced by the
// `enforce_client_facts_bindings` trigger (migration 0021). Same trigger
// validates the supersession chain stays within the same (tenant,
// client, fact_key).
export const clientFacts = pgTable(
  'client_facts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /**
     * Composite FK on (tenantId, clientId) handles cross-tenant
     * enforcement + cascade-on-client-delete via the `tenantClientFk`
     * declaration below. No column-level reference here.
     */
    clientId: uuid('client_id').notNull(),
    /**
     * Snake_case fact key. Free-form by design; the universe of fact
     * types grows over time. Application code maintains the canonical
     * registry + per-key value schema.
     */
    factKey: text('fact_key').notNull(),
    /** Value shape varies by factKey; app-side validation per key. */
    factValue: jsonb('fact_value').notNull(),
    /** Year-tagged. CHECK enforces 2000..2100 at DB layer (below). */
    taxYear: integer('tax_year').notNull(),
    /**
     * Where this fact came from. SET NULL on delete is defensive —
     * actions is append-only by trigger (migration 0007). Tenant
     * integrity enforced by the migration-0021 trigger.
     */
    sourceActionId: uuid('source_action_id').references(() => actions.id, {
      onDelete: 'set null',
    }),
    /**
     * Source authority. Free-form text matches messages.channel
     * convention. v1 vocabulary: 'client_assertion', 'third_party_doc',
     * 'irs_transcript', 'computed', 'firm_correction'.
     */
    sourceTier: text('source_tier').notNull(),
    /** 0..1 confidence; CHECK enforced at DB layer (below). */
    confidence: real('confidence').notNull().default(0),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Self-FK for the supersession chain. NULL = current; non-NULL
     * points at the row that replaced this one. Same-(tenant, client,
     * fact_key) integrity enforced by the migration-0021 trigger;
     * cycle prevention is application-layer.
     */
    supersededBy: uuid('superseded_by').references((): AnyPgColumn => clientFacts.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    /**
     * Composite FK to clients. Cross-tenant client binding is
     * impossible by FK validation; cascade fires on either tenant
     * deletion (transitive through clients) or direct client deletion.
     */
    tenantClientFk: foreignKey({
      name: 'client_facts_tenant_client_fk',
      columns: [t.tenantId, t.clientId],
      foreignColumns: [clients.tenantId, clients.id],
    }).onDelete('cascade'),
    /** Primary retrieval pattern: current value of fact_key for client X, year Y. */
    clientKeyYearIdx: index('client_facts_client_key_year_idx').on(
      t.tenantId,
      t.clientId,
      t.factKey,
      t.taxYear,
    ),
    /**
     * Currently-active facts for client X at year Y. Partial index
     * keeps it tight even as supersession chains grow.
     */
    activeIdx: index('client_facts_active_idx')
      .on(t.tenantId, t.clientId, t.factKey, t.taxYear)
      .where(sql`superseded_by IS NULL`),
    observedIdx: index('client_facts_observed_idx').on(t.tenantId, t.observedAt),
    confidenceRange: check(
      'client_facts_confidence_range',
      sql`${t.confidence} >= 0 AND ${t.confidence} <= 1`,
    ),
    taxYearRange: check(
      'client_facts_tax_year_range',
      sql`${t.taxYear} >= 2000 AND ${t.taxYear} <= 2100`,
    ),
  }),
);

// ────────────────────────────────────────────────────────────────
// discovery_scans (migration 0029) — Discovery Scan deliverable audit.
//
// One row per scan delivered. Tracks the full lifecycle from rendered
// → delivered → opened → downloaded so cold-outreach has a paper
// trail. NOT the cryptographic actions audit chain (that's the
// `actions` table); discovery_scans tracks DELIVERABLE state, not
// agent-action state. Linked to the agent action that produced the
// underlying DiscoveryOutput via `actions_row_id`.
//
// RLS-scoped to tenant via withTenant. status enum lives at DB
// level (discovery_scan_status). Webhook lookup uses email_id
// (Resend's global identifier).
// ────────────────────────────────────────────────────────────────

export const discoveryScanStatusEnum = pgEnum('discovery_scan_status', [
  'rendered',
  'delivered',
  'opened',
  'downloaded',
  'bounced',
  'failed',
]);

export const discoveryScans = pgTable(
  'discovery_scans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /**
     * Optional client linkage. NULL for prospect-only scans
     * delivered before a client record exists (the common case for
     * cold-outreach Discovery Scans per the acquisition plan).
     *
     * Composite FK on (tenantId, clientId) — see the table-level
     * `tenantClientFk` below. Prevents cross-tenant references.
     */
    clientId: uuid('client_id'),
    /**
     * The agent action that produced the underlying DiscoveryOutput.
     * NULL for scans that ran outside the audit chain (evals, dry
     * runs). Composite FK on (tenantId, actionsRowId) below.
     */
    actionsRowId: uuid('actions_row_id'),
    /** R2 key: discovery-scans/<tenant>/<ulid>.pdf */
    storageKey: text('storage_key').notNull(),
    pdfBytes: integer('pdf_bytes').notNull(),
    recipientEmail: text('recipient_email').notNull(),
    /** Firm name at delivery time (denormalized for retention). */
    firmName: text('firm_name').notNull(),
    taxYear: integer('tax_year').notNull(),
    /** Sum of estimatedImpact.dollars across all surfaced positions. */
    totalSurfacedDollars: integer('total_surfaced_dollars').notNull().default(0),
    positionsCount: integer('positions_count').notNull().default(0),
    refusedCount: integer('refused_count').notNull().default(0),
    /**
     * 1-4 for the position framework tier of the highest-tier
     * surfaced position. NULL when positions_count === 0 (zero-
     * surfaced scans are a valid Discovery outcome per
     * docs/DISCOVERY-SCAN-OPERATIONAL.md — "if the return is already
     * tight, that's the answer"). A cross-column CHECK in the
     * migration enforces the invariant (codex C11 R4 P1).
     */
    highestTier: integer('highest_tier'),
    trustGateAllowed: boolean('trust_gate_allowed').notNull(),
    /** Resend email ID (FK for webhook → row lookup). */
    emailId: text('email_id'),
    status: discoveryScanStatusEnum('status').notNull().default('rendered'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    downloadedAt: timestamp('downloaded_at', { withTimezone: true }),
    urlExpiresAt: timestamp('url_expires_at', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantIdx: index('discovery_scans_tenant_idx').on(t.tenantId),
    tenantStatusIdx: index('discovery_scans_tenant_status_idx').on(
      t.tenantId,
      t.status,
    ),
    /**
     * Tenant-scoped recent-scans lookup. created_at DESC matches the
     * SQL migration's `(tenant_id, created_at DESC)` — codex C11 R5
     * P3 (avoid Drizzle schema-diff churn that would rebuild the
     * index on every drizzle-kit generate run).
     */
    tenantCreatedAtIdx: index('discovery_scans_tenant_created_at_idx').on(
      t.tenantId,
      sql`${t.createdAt} DESC`,
    ),
    /**
     * UNIQUE partial index on non-NULL email_id — enforces
     * one-row-per-Resend-message-ID so webhook lookups
     * (`WHERE email_id = $1`) are unambiguous. NULL values are
     * excluded so multiple still-rendered rows without an email_id
     * are allowed (codex C11 R4 P2).
     */
    emailIdUniq: uniqueIndex('discovery_scans_email_id_uniq')
      .on(t.emailId)
      .where(sql`email_id IS NOT NULL`),
    /**
     * Child-side indexes for the composite FKs to clients + actions.
     * Without these, DELETE on the parent tables triggers a full
     * scan of discovery_scans to find rows whose FK columns need
     * nulling under ON DELETE SET NULL (client_id / actions_row_id).
     * Partial WHERE keeps the indexes tight — most scans are
     * prospect-only / outside-audit-chain (codex C11 R6 P2).
     */
    tenantClientIdx: index('discovery_scans_tenant_client_idx')
      .on(t.tenantId, t.clientId)
      .where(sql`client_id IS NOT NULL`),
    tenantActionsIdx: index('discovery_scans_tenant_actions_idx')
      .on(t.tenantId, t.actionsRowId)
      .where(sql`actions_row_id IS NOT NULL`),
    /**
     * Cross-column CHECK: highest_tier MUST be 1-4 when at least
     * one position surfaced; MUST be NULL when zero surfaced. The
     * zero-position outcome is valid per
     * docs/DISCOVERY-SCAN-OPERATIONAL.md (codex C11 R4 P1).
     */
    highestTierRange: check(
      'discovery_scans_highest_tier_range',
      sql`(${t.highestTier} IS NULL AND ${t.positionsCount} = 0)
        OR (${t.highestTier} BETWEEN 1 AND 4 AND ${t.positionsCount} > 0)`,
    ),
    /**
     * Composite FK to clients — enforces tenant consistency.
     * Cross-tenant binding is blocked at the DB layer (FK checks
     * bypass RLS otherwise). Same pattern as client_facts.
     *
     * NOTE: NO `.onDelete()` declaration here. The actual DELETE
     * action lives in `migrations/0029_discovery_scans.sql` as
     * `ON DELETE SET NULL (client_id)` — a column-specific SET NULL
     * (Postgres 15+) required because tenant_id is NOT NULL. Drizzle
     * has no representation for column-specific SET NULL, so
     * declaring `.onDelete('set null')` here would emit bare
     * `SET NULL` in any auto-generated diff and conflict with the
     * migration's actual DDL (codex C11 R3 P2). The SQL migration
     * is the source of truth for the DELETE semantics.
     */
    tenantClientFk: foreignKey({
      name: 'discovery_scans_tenant_client_fk',
      columns: [t.tenantId, t.clientId],
      foreignColumns: [clients.tenantId, clients.id],
    }),
    /**
     * Composite FK to actions — same-tenant audit-chain link.
     * Same column-specific SET NULL caveat as the client FK above.
     * The migration SQL is the source of truth for delete behavior.
     */
    tenantActionsFk: foreignKey({
      name: 'discovery_scans_tenant_actions_fk',
      columns: [t.tenantId, t.actionsRowId],
      foreignColumns: [actions.tenantId, actions.id],
    }),
  }),
);

// ────────────────────────────────────────────────────────────────
// prospects (migration 0030) — pre-tenant Discovery Scan leads.
//
// Captures inbound /scan landing-page submissions. Prospects are
// PRE-TENANT (no tenant_id, no RLS) — they exist before signup.
// Once a prospect converts, lifecycle fields link to the new
// tenant + scan delivery.
//
// The Sentry scrubber redacts email/phone from event.extra (PII
// discipline), making Sentry alone unusable for lead capture
// (codex C12 R3 P1). This table is the structured persistence
// layer. Reads come from admin tooling.
// ────────────────────────────────────────────────────────────────

export const prospects = pgTable(
  'prospects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    firmName: text('firm_name').notNull(),
    designation: text('designation').notNull(),
    firmSize: text('firm_size').notNull(),
    taxSoftware: text('tax_software').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    linkedinUrl: text('linkedin_url'),
    source: text('source').notNull(),
    redactedConfirmed: boolean('redacted_confirmed').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    /**
     * Lifecycle status. CHECK constraint enforced in migration:
     * submitted | contacted | scan_sent | converted | rejected.
     */
    status: text('status').notNull().default('submitted'),
    /**
     * Tenant linkage on conversion. NOT a FK — tenants may be
     * pruned (trial cleanup) without losing the conversion record.
     */
    convertedTenantId: uuid('converted_tenant_id'),
    /**
     * Discovery Scan delivery linkage. Plain FK with SET NULL —
     * the scan row may be retention-pruned without losing the
     * prospect record.
     */
    scanId: uuid('scan_id').references(() => discoveryScans.id, {
      onDelete: 'set null',
    }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    submittedAt: timestamp('submitted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    contactedAt: timestamp('contacted_at', { withTimezone: true }),
    scanSentAt: timestamp('scan_sent_at', { withTimezone: true }),
    convertedAt: timestamp('converted_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    statusIdx: index('prospects_status_idx').on(t.status),
    submittedAtIdx: index('prospects_submitted_at_idx').on(
      sql`${t.submittedAt} DESC`,
    ),
    emailIdx: index('prospects_email_idx').on(sql`lower(${t.email})`),
    firmNameIdx: index('prospects_firm_name_idx').on(sql`lower(${t.firmName})`),
    statusCheck: check(
      'prospects_status_check',
      sql`${t.status} IN ('submitted', 'contacted', 'scan_sent', 'converted', 'rejected')`,
    ),
  }),
);

// ────────────────────────────────────────────────────────────────
// Migration 0031: settings + calendar layer.
//
// Five tenant-scoped tables added 2026-05-13 from the v3 dashboard
// IA integration. See CLAUDE.md §4 Calendar / §8 AI Preferences +
// Automated Reminders + Notifications + Refund Policy, and §11
// Design Theme. Schema-of-record details live in
// migrations/0031_settings_calendar.sql.
// ────────────────────────────────────────────────────────────────

/**
 * Per-tenant AI behavior configuration. One row per tenant. Drives
 * every agent's system-prompt assembly + insight-suppression filter.
 *
 * Tone is an enum-style text column so prompt fragments can be
 * pre-compiled. Personality is free-text appended to system prompts.
 * Quiet Hours stored as integer minute-of-day pair (0-1440), local
 * to tenants.timezone.
 */
export const tenantAiPreferences = pgTable(
  'tenant_ai_preferences',
  {
    tenantId: uuid('tenant_id')
      .primaryKey()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    tone: text('tone')
      .$type<'professional' | 'warm' | 'direct'>()
      .notNull()
      .default('warm'),
    discoveryInsights: boolean('discovery_insights').notNull().default(true),
    complianceFlags: boolean('compliance_flags').notNull().default(true),
    riskTierClassification: boolean('risk_tier_classification')
      .notNull()
      .default(true),
    deadlineAlerts: boolean('deadline_alerts').notNull().default(true),
    pricingInconsistencyAlerts: boolean('pricing_inconsistency_alerts')
      .notNull()
      .default(true),
    churnRiskAlerts: boolean('churn_risk_alerts').notNull().default(true),
    capacityWarnings: boolean('capacity_warnings').notNull().default(true),
    personality: text('personality').notNull().default(''),
    quietHoursStartMin: integer('quiet_hours_start_min').notNull().default(1140),
    quietHoursEndMin: integer('quiet_hours_end_min').notNull().default(420),
    quietHoursEnabled: boolean('quiet_hours_enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    toneCheck: check(
      'tenant_ai_preferences_tone_check',
      sql`${t.tone} IN ('professional', 'warm', 'direct')`,
    ),
    quietStartCheck: check(
      'tenant_ai_preferences_quiet_start_check',
      sql`${t.quietHoursStartMin} >= 0 AND ${t.quietHoursStartMin} <= 1440`,
    ),
    quietEndCheck: check(
      'tenant_ai_preferences_quiet_end_check',
      sql`${t.quietHoursEndMin} >= 0 AND ${t.quietHoursEndMin} <= 1440`,
    ),
  }),
);

/**
 * Per-(tenant, trigger) reminder rule. Five canonical triggers
 * per CLAUDE.md §8 Automated Reminders. App seeds defaults on first
 * Settings → Reminders page visit; absence of a row = "use code
 * defaults" is also a valid state.
 */
export const reminderRules = pgTable(
  'reminder_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    trigger: text('trigger')
      .$type<
        | 'missing_documents'
        | 'engagement_letter_unsigned'
        | 'eightyseventynine_pending'
        | 'outstanding_balance'
        | 'year_round_planning'
      >()
      .notNull(),
    enabled: boolean('enabled').notNull().default(true),
    intervalHours: integer('interval_hours').notNull().default(72),
    maxAttempts: integer('max_attempts').notNull().default(5),
    channel: text('channel')
      .$type<'auto' | 'sms' | 'email' | 'portal' | 'all'>()
      .notNull()
      .default('auto'),
    respectQuietHours: boolean('respect_quiet_hours').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantIdx: index('reminder_rules_tenant_idx').on(t.tenantId),
    tenantTriggerUnique: uniqueIndex('reminder_rules_tenant_trigger_unique').on(
      t.tenantId,
      t.trigger,
    ),
    triggerCheck: check(
      'reminder_rules_trigger_check',
      sql`${t.trigger} IN ('missing_documents', 'engagement_letter_unsigned', 'eightyseventynine_pending', 'outstanding_balance', 'year_round_planning')`,
    ),
    channelCheck: check(
      'reminder_rules_channel_check',
      sql`${t.channel} IN ('auto', 'sms', 'email', 'portal', 'all')`,
    ),
    intervalCheck: check(
      'reminder_rules_interval_check',
      sql`${t.intervalHours} > 0 AND ${t.intervalHours} <= 2160`,
    ),
    attemptsCheck: check(
      'reminder_rules_attempts_check',
      sql`${t.maxAttempts} > 0 AND ${t.maxAttempts} <= 20`,
    ),
  }),
);

/**
 * Per-(tenant, category) notification preference. Four canonical
 * event categories × three channels per CLAUDE.md §8 Notifications.
 */
export const notificationPrefs = pgTable(
  'notification_prefs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    category: text('category')
      .$type<'deadlines' | 'ai_alerts' | 'client_activity' | 'system'>()
      .notNull(),
    sms: boolean('sms').notNull().default(false),
    email: boolean('email').notNull().default(true),
    inApp: boolean('in_app').notNull().default(true),
    threshold: text('threshold')
      .$type<'all' | 'medium' | 'high'>()
      .notNull()
      .default('medium'),
    deadlineDaysBefore: integer('deadline_days_before').notNull().default(7),
    respectQuietHours: boolean('respect_quiet_hours').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantIdx: index('notification_prefs_tenant_idx').on(t.tenantId),
    tenantCategoryUnique: uniqueIndex(
      'notification_prefs_tenant_category_unique',
    ).on(t.tenantId, t.category),
    categoryCheck: check(
      'notification_prefs_category_check',
      sql`${t.category} IN ('deadlines', 'ai_alerts', 'client_activity', 'system')`,
    ),
    thresholdCheck: check(
      'notification_prefs_threshold_check',
      sql`${t.threshold} IN ('all', 'medium', 'high')`,
    ),
    deadlineDaysCheck: check(
      'notification_prefs_deadline_days_check',
      sql`${t.deadlineDaysBefore} > 0 AND ${t.deadlineDaysBefore} <= 90`,
    ),
  }),
);

/**
 * Google Calendar mirror, tenant-scoped. Two-way sync via the
 * google-calendar MCP server. client_id + engagement_id FKs make
 * calendar entries first-class client artifacts queryable by the
 * Discovery + Strategy agents.
 */
export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    externalId: text('external_id'),
    icalUid: text('ical_uid'),
    calendarId: text('calendar_id'),
    eventType: text('event_type')
      .$type<
        | 'meeting'
        | 'filing_deadline'
        | 'internal_review'
        | 'audit_milestone'
        | 'planning_touchpoint'
      >()
      .notNull()
      .default('meeting'),
    title: text('title').notNull(),
    description: text('description'),
    location: text('location'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').notNull().default(false),
    clientId: uuid('client_id').references(() => clients.id, {
      onDelete: 'set null',
    }),
    engagementId: uuid('engagement_id').references(() => engagements.id, {
      onDelete: 'set null',
    }),
    attendeeCount: integer('attendee_count').notNull().default(0),
    organizerEmail: text('organizer_email'),
    status: text('status')
      .$type<'confirmed' | 'tentative' | 'cancelled'>()
      .notNull()
      .default('confirmed'),
    externalUpdatedAt: timestamp('external_updated_at', { withTimezone: true }),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantStartsIdx: index('calendar_events_tenant_starts_idx').on(
      t.tenantId,
      sql`${t.startsAt} DESC`,
    ),
    clientIdx: index('calendar_events_client_idx').on(t.clientId),
    engagementIdx: index('calendar_events_engagement_idx').on(t.engagementId),
    eventTypeIdx: index('calendar_events_event_type_idx').on(t.eventType),
    tenantCalendarExternalUnique: uniqueIndex(
      'calendar_events_tenant_calendar_external_unique',
    ).on(t.tenantId, t.calendarId, t.externalId),
    eventTypeCheck: check(
      'calendar_events_event_type_check',
      sql`${t.eventType} IN ('meeting', 'filing_deadline', 'internal_review', 'audit_milestone', 'planning_touchpoint')`,
    ),
    statusCheck: check(
      'calendar_events_status_check',
      sql`${t.status} IN ('confirmed', 'tentative', 'cancelled')`,
    ),
  }),
);

/**
 * client_memories (migration 0032) — Memories surface.
 *
 * Plain-English bullets of "what we know about this client" rendered
 * as a first-class object on the client page. Slant.app validated
 * this primitive in financial advice; we apply it to tax.
 *
 * Different semantics than client_facts (migration 0021): client_facts
 * holds STRUCTURED facts with tax-year supersession (income_w2_2024,
 * dependent_count); client_memories holds UNSTRUCTURED prose
 * ("Daughter Lily starts UC Davis Aug 2026", "Prefers SMS over email").
 */
export const clientMemories = pgTable(
  'client_memories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /**
     * Composite FK on (tenantId, clientId) handles cross-tenant
     * enforcement + cascade-on-client-delete via the `tenantClientFk`
     * declaration below. No column-level reference here.
     */
    clientId: uuid('client_id').notNull(),
    text: text('text').notNull(),
    pinned: boolean('pinned').notNull().default(false),
    dismissed: boolean('dismissed').notNull().default(false),
    sourceKind: text('source_kind')
      .$type<
        | 'manual'
        | 'message'
        | 'meeting_transcript'
        | 'intake_response'
        | 'document_parse'
        | 'inferred'
      >()
      .notNull()
      .default('manual'),
    sourceActionId: uuid('source_action_id').references(() => actions.id, {
      onDelete: 'set null',
    }),
    sourceRef: text('source_ref'),
    extractedByAgent: text('extracted_by_agent'),
    confidence: real('confidence').notNull().default(1),
    lastReferencedAt: timestamp('last_referenced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    tenantClientFk: foreignKey({
      name: 'client_memories_tenant_client_fk',
      columns: [t.tenantId, t.clientId],
      foreignColumns: [clients.tenantId, clients.id],
    }).onDelete('cascade'),
    activeIdx: index('client_memories_active_idx')
      .on(t.tenantId, t.clientId, sql`pinned DESC`, sql`created_at DESC`)
      .where(sql`NOT dismissed`),
    clientIdx: index('client_memories_client_idx').on(t.tenantId, t.clientId),
    sourceActionIdx: index('client_memories_source_action_idx')
      .on(t.sourceActionId)
      .where(sql`source_action_id IS NOT NULL`),
    tenantRecentIdx: index('client_memories_tenant_recent_idx').on(
      t.tenantId,
      sql`created_at DESC`,
    ),
    sourceKindCheck: check(
      'client_memories_source_kind_check',
      sql`${t.sourceKind} IN ('manual', 'message', 'meeting_transcript', 'intake_response', 'document_parse', 'inferred')`,
    ),
    confidenceRange: check(
      'client_memories_confidence_range',
      sql`${t.confidence} >= 0 AND ${t.confidence} <= 1`,
    ),
    textLength: check(
      'client_memories_text_length',
      sql`char_length(${t.text}) > 0 AND char_length(${t.text}) <= 2000`,
    ),
  }),
);

/**
 * nudge_rules (migration 0033) — per-tenant Nudges trigger config.
 *
 * Each row defines whether a specific (trigger_class, trigger_key)
 * combination fires as a Nudge for this tenant. Default rule set
 * seeded per tenant; firms customize. The Nudge agent reads enabled
 * rules + client_facts + engagement state + calendar_events daily.
 */
export const nudgeRules = pgTable(
  'nudge_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    triggerClass: text('trigger_class')
      .$type<
        | 'life_event'
        | 'time_window'
        | 'drift'
        | 'milestone'
        | 'drift_from_prior'
        | 'compliance_risk'
      >()
      .notNull(),
    triggerKey: text('trigger_key').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    maxPerClientPerDays: integer('max_per_client_per_days').notNull().default(7),
    respectQuietHours: boolean('respect_quiet_hours').notNull().default(true),
    confidenceFloor: real('confidence_floor').notNull().default(0.7),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantClassKeyUnique: uniqueIndex('nudge_rules_tenant_class_key_unique').on(
      t.tenantId,
      t.triggerClass,
      t.triggerKey,
    ),
    tenantEnabledIdx: index('nudge_rules_tenant_idx')
      .on(t.tenantId)
      .where(sql`enabled`),
    classIdx: index('nudge_rules_class_idx')
      .on(t.tenantId, t.triggerClass)
      .where(sql`enabled`),
    triggerClassCheck: check(
      'nudge_rules_trigger_class_check',
      sql`${t.triggerClass} IN ('life_event', 'time_window', 'drift', 'milestone', 'drift_from_prior', 'compliance_risk')`,
    ),
    maxPerClientRange: check(
      'nudge_rules_max_per_client_range',
      sql`${t.maxPerClientPerDays} > 0 AND ${t.maxPerClientPerDays} <= 365`,
    ),
    confidenceFloorRange: check(
      'nudge_rules_confidence_floor_range',
      sql`${t.confidenceFloor} >= 0 AND ${t.confidenceFloor} <= 1`,
    ),
  }),
);

/**
 * nudges (migration 0033) — pending preparer-to-client outreach queue.
 *
 * Each row = one suggestion the Nudge agent generated. Lifecycle:
 * pending → approved → sent OR pending → dismissed OR pending →
 * expired. Title pre-composed in canonical alert format per
 * CLAUDE.md §8: "{ClientName}'s {situation} · {quantified impact}".
 */
export const nudges = pgTable(
  'nudges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').notNull(),
    ruleId: uuid('rule_id').references(() => nudgeRules.id, {
      onDelete: 'set null',
    }),
    triggerClass: text('trigger_class')
      .$type<
        | 'life_event'
        | 'time_window'
        | 'drift'
        | 'milestone'
        | 'drift_from_prior'
        | 'compliance_risk'
      >()
      .notNull(),
    triggerKey: text('trigger_key').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    draftOutreach: text('draft_outreach'),
    recommendedChannel: text('recommended_channel').$type<
      'sms' | 'email' | 'portal_chat' | 'phone_call' | null
    >(),
    confidence: real('confidence').notNull().default(0.7),
    status: text('status')
      .$type<
        | 'pending'
        | 'approved'
        | 'sent'
        | 'edited'
        | 'dismissed'
        | 'expired'
      >()
      .notNull()
      .default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: uuid('approved_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    dismissedBy: uuid('dismissed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    dismissedReason: text('dismissed_reason'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    sourceActionId: uuid('source_action_id').references(() => actions.id, {
      onDelete: 'set null',
    }),
    reasoningTrail: jsonb('reasoning_trail')
      .$type<Array<{ kind: string; label: string; detail?: string }>>()
      .notNull()
      .default([]),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantClientFk: foreignKey({
      name: 'nudges_tenant_client_fk',
      columns: [t.tenantId, t.clientId],
      foreignColumns: [clients.tenantId, clients.id],
    }).onDelete('cascade'),
    pendingIdx: index('nudges_pending_idx')
      .on(t.tenantId, sql`created_at DESC`)
      .where(sql`status = 'pending'`),
    clientIdx: index('nudges_client_idx').on(
      t.tenantId,
      t.clientId,
      sql`created_at DESC`,
    ),
    ruleClientIdx: index('nudges_rule_client_idx')
      .on(t.ruleId, t.clientId, sql`created_at DESC`)
      .where(sql`rule_id IS NOT NULL`),
    sourceActionIdx: index('nudges_source_action_idx')
      .on(t.sourceActionId)
      .where(sql`source_action_id IS NOT NULL`),
    expiresIdx: index('nudges_expires_idx')
      .on(t.expiresAt)
      .where(sql`status = 'pending' AND expires_at IS NOT NULL`),
    triggerClassCheck: check(
      'nudges_trigger_class_check',
      sql`${t.triggerClass} IN ('life_event', 'time_window', 'drift', 'milestone', 'drift_from_prior', 'compliance_risk')`,
    ),
    recommendedChannelCheck: check(
      'nudges_recommended_channel_check',
      sql`${t.recommendedChannel} IS NULL OR ${t.recommendedChannel} IN ('sms', 'email', 'portal_chat', 'phone_call')`,
    ),
    confidenceRange: check(
      'nudges_confidence_range',
      sql`${t.confidence} >= 0 AND ${t.confidence} <= 1`,
    ),
    statusCheck: check(
      'nudges_status_check',
      sql`${t.status} IN ('pending', 'approved', 'sent', 'edited', 'dismissed', 'expired')`,
    ),
    titleLength: check(
      'nudges_title_length',
      sql`char_length(${t.title}) > 0 AND char_length(${t.title}) <= 500`,
    ),
    bodyLength: check(
      'nudges_body_length',
      sql`char_length(${t.body}) > 0`,
    ),
  }),
);

/**
 * Generic per-tenant JSONB k/v store. Holds instance-scoped
 * configuration that doesn't earn its own column:
 *   - theme_pref          (firm-wide theme default)
 *   - refund_policy_md    (markdown refund policy shown at checkout)
 *   - branding            (logo URL, hue offset, etc.)
 *   - portal              (welcome_md, video URLs, custom subdomain)
 *   - metadata            (anything else)
 *
 * Prefer named columns when you query the field; prefer JSONB when
 * you only render it.
 */
export const tenantSettings = pgTable('tenant_settings', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  themePref: text('theme_pref')
    .$type<'light' | 'dark' | 'system'>()
    .notNull()
    .default('system'),
  refundPolicyMd: text('refund_policy_md').notNull().default(''),
  branding: jsonb('branding')
    .$type<{
      logoUrl?: string;
      hueOffset?: number;
      customSubdomain?: string;
    }>()
    .notNull()
    .default({}),
  portal: jsonb('portal')
    .$type<{
      welcomeMd?: string;
      videos?: Partial<{
        first_time: string;
        returning: string;
        docs_received: string;
        review_ready: string;
        post_filing: string;
      }>;
    }>()
    .notNull()
    .default({}),
  metadata: jsonb('metadata')
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
