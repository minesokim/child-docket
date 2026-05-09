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
