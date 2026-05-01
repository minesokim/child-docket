DROP INDEX "intake_responses_client_year_idx";--> statement-breakpoint
ALTER TABLE "intake_responses" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "intake_responses_client_year_uidx" ON "intake_responses" USING btree ("tenant_id","client_id","tax_year");