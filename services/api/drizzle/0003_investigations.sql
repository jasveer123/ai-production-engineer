ALTER TABLE "evidence_items" ADD COLUMN "ref" text NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN "title" text NOT NULL;--> statement-breakpoint
ALTER TABLE "evidence_items" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "hypotheses" ADD COLUMN "confidence_label" text;--> statement-breakpoint
ALTER TABLE "hypotheses" ADD COLUMN "suspected_location" jsonb;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "attempt" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "status_reason" text;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "evidence_bundle_ref" text;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "report_ref" text;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "coverage" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "observations" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "data_gaps" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "rejected" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "usage" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "investigations" ADD COLUMN "request_note" text;--> statement-breakpoint
CREATE UNIQUE INDEX "investigations_workflow_attempt_key" ON "investigations" USING btree ("workflow_id","attempt");--> statement-breakpoint
CREATE INDEX "investigations_incident_idx" ON "investigations" USING btree ("incident_id");