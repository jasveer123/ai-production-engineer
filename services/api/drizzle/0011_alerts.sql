CREATE TYPE "public"."alert_status" AS ENUM('firing', 'resolved');--> statement-breakpoint
CREATE TABLE "alert_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"source_ids" uuid[] DEFAULT '{}' NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"group_by" text[] DEFAULT '{}' NOT NULL,
	"create_incident" boolean DEFAULT true NOT NULL,
	"incident_severity" "severity",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"route_id" uuid,
	"incident_id" uuid,
	"dedup_key" text NOT NULL,
	"status" "alert_status" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" "severity" DEFAULT 'medium' NOT NULL,
	"labels" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_url" text,
	"group_key" text,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"first_fired_at" timestamp with time zone NOT NULL,
	"last_fired_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alert_routes" ADD CONSTRAINT "alert_routes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_source_id_integrations_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_route_id_alert_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."alert_routes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_routes_workspace_idx" ON "alert_routes" USING btree ("workspace_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "alerts_source_dedup_key" ON "alerts" USING btree ("source_id","dedup_key");--> statement-breakpoint
CREATE INDEX "alerts_workspace_status_idx" ON "alerts" USING btree ("workspace_id","status","last_fired_at");--> statement-breakpoint
CREATE INDEX "alerts_incident_idx" ON "alerts" USING btree ("incident_id");