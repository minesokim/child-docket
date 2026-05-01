import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
  real,
} from 'drizzle-orm/pg-core';

// ──────────────────────────────────────────────────────────────
// v0 schema. Multi-tenant via RLS on tenant_id (added in migration).
// Every table touching tenant data has tenant_id NOT NULL.
// ──────────────────────────────────────────────────────────────

export const trustLevelEnum = pgEnum('trust_level', ['1', '2', '3', '4']);
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
  defaultTrustLevel: trustLevelEnum('default_trust_level').notNull().default('1'),
  bedrockEnabled: boolean('bedrock_enabled').notNull().default(false),
  awsRegion: text('aws_region'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Users (preparers + staff). Maps to Clerk user IDs.
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    clerkUserId: text('clerk_user_id').notNull().unique(),
    email: text('email').notNull(),
    name: text('name'),
    role: text('role').notNull().default('preparer'),
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
    stripeIdentitySessionId: text('stripe_identity_session_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('clients_tenant_idx').on(t.tenantId),
    phoneIdx: index('clients_phone_idx').on(t.tenantId, t.phone),
    clerkIdx: index('clients_clerk_user_idx').on(t.clerkUserId),
  }),
);

// Documents uploaded by clients.
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
    aiClassification: text('ai_classification'),
    aiConfidence: real('ai_confidence'),
    aiExtracted: jsonb('ai_extracted'),
    parsePhase: text('parse_phase').notNull().default('uploaded'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantIdx: index('documents_tenant_idx').on(t.tenantId),
    clientIdx: index('documents_client_idx').on(t.tenantId, t.clientId),
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
export const actions = pgTable(
  'actions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
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
  },
  (t) => ({
    tenantCreatedIdx: index('actions_tenant_created_idx').on(t.tenantId, t.createdAt),
    agentIdx: index('actions_agent_idx').on(t.tenantId, t.agentId),
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
    kbaProvider: text('kba_provider'),                           // 'lexisnexis' / 'stripe_identity' / etc.
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
