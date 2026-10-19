ALTER TABLE "approvals" ADD COLUMN "actor_role" text;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "incident_id" uuid;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "approval_id" uuid;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "repository_full_name" text;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "base_branch" text;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "head_sha" text;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "number" integer;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "checks_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "checks" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "merge_commit_sha" text;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "merged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD COLUMN "last_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pull_requests_fix_key" ON "pull_requests" USING btree ("fix_proposal_id");