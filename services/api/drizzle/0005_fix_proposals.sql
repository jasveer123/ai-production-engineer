ALTER TABLE "fix_proposals" ADD COLUMN "incident_id" uuid;--> statement-breakpoint
ALTER TABLE "fix_proposals" ADD COLUMN "workflow_run_key" text;--> statement-breakpoint
ALTER TABLE "fix_proposals" ADD COLUMN "repository_full_name" text;--> statement-breakpoint
ALTER TABLE "fix_proposals" ADD COLUMN "source_reference" text;--> statement-breakpoint
ALTER TABLE "fix_proposals" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "fix_proposals" ADD COLUMN "test_path" text;--> statement-breakpoint
ALTER TABLE "fix_proposals" ADD COLUMN "test_reference" text;--> statement-breakpoint
ALTER TABLE "fix_proposals" ADD COLUMN "test_rationale" text;--> statement-breakpoint
ALTER TABLE "fix_proposals" ADD COLUMN "explanation" text;--> statement-breakpoint
ALTER TABLE "fix_proposals" ADD COLUMN "diff_stat" jsonb;--> statement-breakpoint
ALTER TABLE "fix_proposals" ADD COLUMN "patch_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "fix_proposals" ADD COLUMN "policy_violations" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fix_proposals" ADD COLUMN "usage" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "sandbox" jsonb;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD COLUMN "attempt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD COLUMN "duration_ms" integer;--> statement-breakpoint
ALTER TABLE "validation_runs" ADD COLUMN "summary" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fix_proposals" ADD CONSTRAINT "fix_proposals_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fix_proposals_run_version_key" ON "fix_proposals" USING btree ("workflow_run_key","version");--> statement-breakpoint
CREATE INDEX "fix_proposals_incident_idx" ON "fix_proposals" USING btree ("incident_id");