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
  'send-internal',
  'send-external',
  'mutate-tax-software',
  'file',
]);
export const modelEnum = pgEnum('model_used', ['haiku-4-5', 'sonnet-4-6', 'opus-4-7']);

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
export const clients = pgTable(
  'clients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
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
