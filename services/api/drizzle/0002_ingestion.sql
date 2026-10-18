CREATE TYPE "public"."inbound_event_status" AS ENUM('pending', 'processed', 'dead');--> statement-breakpoint
CREATE TABLE "deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"integration_id" uuid,
	"service_id" uuid,
	"service_name" text NOT NULL,
	"environment" text NOT NULL,
	"commit_sha" text NOT NULL,
	"version" text,
	"external_event_id" text NOT NULL,
	"deployed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbound_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"source" text NOT NULL,
	"external_event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "inbound_event_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dead_reason" text,
	"last_error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "secrets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "incidents_fingerprint_key";--> statement-breakpoint
ALTER TABLE "incident_events" ADD COLUMN "kind" text DEFAULT 'error' NOT NULL;--> statement-breakpoint
ALTER TABLE "incident_events" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "incident_events" ADD COLUMN "trace_id" text;--> statement-breakpoint
ALTER TABLE "incident_events" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "incident_events" ADD COLUMN "actor_id" uuid;--> statement-breakpoint
ALTER TABLE "incident_events" ADD COLUMN "attributes" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "service_name" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "environment" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "event_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "integrations" ADD COLUMN "config" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_events" ADD CONSTRAINT "inbound_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_events" ADD CONSTRAINT "inbound_events_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secrets" ADD CONSTRAINT "secrets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deployments_external_key" ON "deployments" USING btree ("integration_id","external_event_id");--> statement-breakpoint
CREATE INDEX "deployments_service_time_idx" ON "deployments" USING btree ("workspace_id","service_name","environment","deployed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inbound_events_external_key" ON "inbound_events" USING btree ("integration_id","external_event_id");--> statement-breakpoint
CREATE INDEX "inbound_events_pending_idx" ON "inbound_events" USING btree ("next_attempt_at") WHERE "inbound_events"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "incidents_open_fingerprint_key" ON "incidents" USING btree ("workspace_id","fingerprint") WHERE "incidents"."status" not in ('resolved', 'closed_without_fix');