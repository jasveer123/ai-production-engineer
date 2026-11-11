CREATE TABLE "error_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"title" text NOT NULL,
	"error_type" text NOT NULL,
	"message" text NOT NULL,
	"service" text NOT NULL,
	"environment" text NOT NULL,
	"status" text DEFAULT 'unresolved' NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"release" text,
	"route" text,
	"stack" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"incident_id" uuid,
	"reopened_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "error_occurrences" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"trace_id" text,
	"release" text,
	"message" text NOT NULL,
	"external_event_id" text
);
--> statement-breakpoint
ALTER TABLE "error_groups" ADD CONSTRAINT "error_groups_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_occurrences" ADD CONSTRAINT "error_occurrences_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_occurrences" ADD CONSTRAINT "error_occurrences_group_id_error_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."error_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "error_groups_fingerprint_idx" ON "error_groups" USING btree ("workspace_id","fingerprint");--> statement-breakpoint
CREATE INDEX "error_groups_last_seen_idx" ON "error_groups" USING btree ("workspace_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "error_occurrences_group_idx" ON "error_occurrences" USING btree ("group_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "error_occurrences_event_idx" ON "error_occurrences" USING btree ("group_id","external_event_id") WHERE "error_occurrences"."external_event_id" is not null;