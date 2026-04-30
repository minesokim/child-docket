CREATE TYPE "public"."action_class" AS ENUM('read', 'draft', 'classify', 'send-internal', 'send-external', 'mutate-tax-software', 'file');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('email', 'sms', 'portal_chat', 'voicemail', 'phone_call', 'in_person');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."engagement_status" AS ENUM('intake', 'docs', 'prep', 'review', 'signature', 'file', 'pay', 'done', 'extended', 'on_hold');--> statement-breakpoint
CREATE TYPE "public"."engagement_type" AS ENUM('return_1040', 'return_1120s', 'return_1065', 'return_1120', 'representation', 'advisory', 'bookkeeping');--> statement-breakpoint
CREATE TYPE "public"."issue_severity" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('open', 'in_progress', 'snoozed', 'resolved', 'archived');--> statement-breakpoint
CREATE TYPE "public"."issue_type" AS ENUM('doc_mismatch', 'doc_gap', 'ero_pending', 'prep_decision', 'signature_pending', 'extension_risk', 'payment_status', 'meeting_prep', 'missing_info', 'quick_reply', 'irs_notice');--> statement-breakpoint
CREATE TYPE "public"."model_used" AS ENUM('haiku-4-5', 'sonnet-4-6', 'opus-4-7');--> statement-breakpoint
CREATE TYPE "public"."signature_status" AS ENUM('pending', 'sent', 'signed', 'declined', 'expired');--> statement-breakpoint
CREATE TYPE "public"."signature_type" AS ENUM('engagement_letter', 'consent_7216', 'form_8879', 'form_2848', 'form_8821');--> statement-breakpoint
CREATE TYPE "public"."trust_level" AS ENUM('1', '2', '3', '4');--> statement-breakpoint
CREATE TABLE "actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid,
	"user_id" uuid,
	"agent_id" text,
	"action_class" "action_class" NOT NULL,
	"tool_name" text NOT NULL,
	"tool_input" jsonb,
	"tool_output" jsonb,
	"model_used" "model_used",
	"input_tokens" integer,
	"output_tokens" integer,
	"cached_tokens" integer,
	"cost_usd" real,
	"latency_ms" integer NOT NULL,
	"success" boolean NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"action_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"edit_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"preferred_language" text DEFAULT 'en' NOT NULL,
	"state" text,
	"intake_status" text DEFAULT 'not-started' NOT NULL,
	"kyc_status" text DEFAULT 'pending' NOT NULL,
	"stripe_identity_session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"ai_classification" text,
	"ai_confidence" real,
	"ai_extracted" jsonb,
	"parse_phase" text DEFAULT 'uploaded' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"type" "engagement_type" NOT NULL,
	"status" "engagement_status" DEFAULT 'intake' NOT NULL,
	"tax_year" integer,
	"fee_quoted_cents" integer,
	"fee_collected_cents" integer DEFAULT 0 NOT NULL,
	"deposit_paid_cents" integer DEFAULT 0 NOT NULL,
	"deadline" timestamp with time zone,
	"extended_deadline" timestamp with time zone,
	"complexity_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "gmail_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"gmail_message_id" text NOT NULL,
	"gmail_thread_id" text NOT NULL,
	"client_id" uuid,
	"direction" "direction" NOT NULL,
	"from_address" text NOT NULL,
	"to_addresses" jsonb NOT NULL,
	"subject" text,
	"body_text" text,
	"body_html" text,
	"received_at" timestamp with time zone NOT NULL,
	"classified_issue_id" uuid,
	"classified_at" timestamp with time zone,
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"engagement_id" uuid,
	"tax_year" integer NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"completed_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answers" jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"abandoned_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"engagement_id" uuid,
	"type" "issue_type" NOT NULL,
	"severity" "issue_severity" DEFAULT 'medium' NOT NULL,
	"status" "issue_status" DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"why_this_matters" text,
	"recommended_action" text,
	"evidence" jsonb,
	"sources" jsonb,
	"classified_by" text,
	"ai_confidence" real,
	"draft_action_id" uuid,
	"eta_minutes" integer,
	"snoozed_until" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid,
	"channel" text NOT NULL,
	"direction" text NOT NULL,
	"body" text NOT NULL,
	"ai_drafted_by" text,
	"approved_by_user_id" uuid,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notice_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"issue_id" uuid,
	"notice_type" text,
	"notice_date" timestamp with time zone,
	"proposed_adjustment_cents" integer,
	"notice_storage_key" text,
	"extracted_text" text,
	"draft_response" text,
	"final_response" text,
	"response_sent_at" timestamp with time zone,
	"irs_response_at" timestamp with time zone,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"engagement_id" uuid,
	"type" "signature_type" NOT NULL,
	"status" "signature_status" DEFAULT 'pending' NOT NULL,
	"document_text" text,
	"document_storage_key" text,
	"kba_required" boolean DEFAULT false NOT NULL,
	"kba_passed_at" timestamp with time zone,
	"kba_provider" text,
	"sent_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"signed_by_ip" text,
	"signed_by_user_agent" text,
	"audit_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'America/Los_Angeles' NOT NULL,
	"default_trust_level" "trust_level" DEFAULT '1' NOT NULL,
	"bedrock_enabled" boolean DEFAULT false NOT NULL,
	"aws_region" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" text DEFAULT 'preparer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "actions" ADD CONSTRAINT "actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_action_id_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."actions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_threads" ADD CONSTRAINT "gmail_threads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_threads" ADD CONSTRAINT "gmail_threads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_threads" ADD CONSTRAINT "gmail_threads_classified_issue_id_issues_id_fk" FOREIGN KEY ("classified_issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_responses" ADD CONSTRAINT "intake_responses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_responses" ADD CONSTRAINT "intake_responses_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_responses" ADD CONSTRAINT "intake_responses_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_draft_action_id_actions_id_fk" FOREIGN KEY ("draft_action_id") REFERENCES "public"."actions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_responses" ADD CONSTRAINT "notice_responses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_responses" ADD CONSTRAINT "notice_responses_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_responses" ADD CONSTRAINT "notice_responses_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signatures" ADD CONSTRAINT "signatures_engagement_id_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actions_tenant_created_idx" ON "actions" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "actions_agent_idx" ON "actions" USING btree ("tenant_id","agent_id");--> statement-breakpoint
CREATE INDEX "approvals_tenant_idx" ON "approvals" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "clients_tenant_idx" ON "clients" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "clients_phone_idx" ON "clients" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "documents_tenant_idx" ON "documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "documents_client_idx" ON "documents" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "engagements_tenant_idx" ON "engagements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "engagements_client_idx" ON "engagements" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "engagements_status_idx" ON "engagements" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "engagements_deadline_idx" ON "engagements" USING btree ("tenant_id","deadline");--> statement-breakpoint
CREATE INDEX "gmail_threads_tenant_idx" ON "gmail_threads" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "gmail_threads_message_idx" ON "gmail_threads" USING btree ("tenant_id","gmail_message_id");--> statement-breakpoint
CREATE INDEX "gmail_threads_client_idx" ON "gmail_threads" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "gmail_threads_received_at_idx" ON "gmail_threads" USING btree ("tenant_id","received_at");--> statement-breakpoint
CREATE INDEX "gmail_threads_unclassified_idx" ON "gmail_threads" USING btree ("tenant_id","classified_at");--> statement-breakpoint
CREATE INDEX "intake_responses_tenant_idx" ON "intake_responses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "intake_responses_client_year_idx" ON "intake_responses" USING btree ("tenant_id","client_id","tax_year");--> statement-breakpoint
CREATE INDEX "issues_tenant_status_idx" ON "issues" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "issues_tenant_severity_idx" ON "issues" USING btree ("tenant_id","severity");--> statement-breakpoint
CREATE INDEX "issues_tenant_type_idx" ON "issues" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "issues_client_idx" ON "issues" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "issues_engagement_idx" ON "issues" USING btree ("tenant_id","engagement_id");--> statement-breakpoint
CREATE INDEX "issues_snoozed_until_idx" ON "issues" USING btree ("tenant_id","snoozed_until");--> statement-breakpoint
CREATE INDEX "messages_tenant_client_idx" ON "messages" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "notice_responses_tenant_idx" ON "notice_responses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "notice_responses_client_idx" ON "notice_responses" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "notice_responses_issue_idx" ON "notice_responses" USING btree ("tenant_id","issue_id");--> statement-breakpoint
CREATE INDEX "signatures_tenant_idx" ON "signatures" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "signatures_client_idx" ON "signatures" USING btree ("tenant_id","client_id");--> statement-breakpoint
CREATE INDEX "signatures_engagement_idx" ON "signatures" USING btree ("tenant_id","engagement_id");--> statement-breakpoint
CREATE INDEX "signatures_status_idx" ON "signatures" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");