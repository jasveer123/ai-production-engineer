CREATE TABLE "contact_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"address" text NOT NULL,
	"min_severity" "severity" DEFAULT 'low' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"incident_id" uuid,
	"run_id" uuid,
	"step_index" integer,
	"channel_id" uuid,
	"user_id" uuid,
	"dedup_key" text NOT NULL,
	"event_type" text NOT NULL,
	"channel" text NOT NULL,
	"address" text NOT NULL,
	"recipient_name" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"state" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now(),
	"lease_owner" text,
	"lease_expires_at" timestamp with time zone,
	"provider_message_id" text,
	"response_status" integer,
	"error" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"subscriber_id" uuid NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "status_maintenance_resources" (
	"maintenance_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	CONSTRAINT "status_maintenance_resources_maintenance_id_resource_id_pk" PRIMARY KEY("maintenance_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "status_maintenances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"notify" boolean DEFAULT true NOT NULL,
	"start_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"dedup_key" text NOT NULL,
	"report_id" uuid,
	"maintenance_id" uuid,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"deliver_after" timestamp with time zone DEFAULT now() NOT NULL,
	"fanned_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_report_resources" (
	"report_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"impact" text NOT NULL,
	CONSTRAINT "status_report_resources_report_id_resource_id_pk" PRIMARY KEY("report_id","resource_id")
);
--> statement-breakpoint
CREATE TABLE "status_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"title" text NOT NULL,
	"state" text DEFAULT 'investigating' NOT NULL,
	"auto" boolean DEFAULT false NOT NULL,
	"monitor_id" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "status_resource_monitors" (
	"resource_id" uuid NOT NULL,
	"monitor_id" uuid NOT NULL,
	CONSTRAINT "status_resource_monitors_resource_id_monitor_id_pk" PRIMARY KEY("resource_id","monitor_id")
);
--> statement-breakpoint
CREATE TABLE "status_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"section_id" uuid,
	"public_name" text NOT NULL,
	"explanation" text,
	"position" integer DEFAULT 0 NOT NULL,
	"show_history" boolean DEFAULT true NOT NULL,
	"manual_state" text,
	"state" text DEFAULT 'unknown' NOT NULL,
	"state_changed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "status_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"route" text NOT NULL,
	"signal" text NOT NULL,
	"idempotency_key" text,
	"state" text DEFAULT 'processing' NOT NULL,
	"counts" jsonb NOT NULL,
	"sinks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rejections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"name" text NOT NULL,
	"query" jsonb NOT NULL,
	"condition" jsonb NOT NULL,
	"window_minutes" integer DEFAULT 5 NOT NULL,
	"every_seconds" integer DEFAULT 60 NOT NULL,
	"per_series" boolean DEFAULT false NOT NULL,
	"confirmation_seconds" integer DEFAULT 0 NOT NULL,
	"recovery_seconds" integer DEFAULT 0 NOT NULL,
	"missing_data" text DEFAULT 'keep' NOT NULL,
	"severity" "severity" DEFAULT 'high' NOT NULL,
	"escalation_policy_id" uuid,
	"paused" boolean DEFAULT false NOT NULL,
	"next_eval_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"last_evaluated_at" timestamp with time zone,
	"last_error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_alert_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"rule_id" uuid NOT NULL,
	"series_key" text NOT NULL,
	"state" text DEFAULT 'ok' NOT NULL,
	"since" timestamp with time zone DEFAULT now() NOT NULL,
	"pending_since" timestamp with time zone,
	"last_value" double precision,
	"last_observation" text,
	"last_evaluated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"platform" text DEFAULT 'javascript' NOT NULL,
	"public_key" text NOT NULL,
	"project_id" serial NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 600 NOT NULL,
	"dropped_events" integer DEFAULT 0 NOT NULL,
	"last_event_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_rate_windows" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rum_batches" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"app_id" uuid NOT NULL,
	"batch_id" text NOT NULL,
	"session_key" text NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worker_heartbeats" (
	"name" text PRIMARY KEY NOT NULL,
	"host" text,
	"pid" integer,
	"beat_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"signal" text NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"range" text DEFAULT '1h' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heartbeat_pings" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"signal" text NOT NULL,
	"outcome" text NOT NULL,
	"execution_id" text,
	"duration_ms" integer,
	"body" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "escalation_runs" DROP CONSTRAINT "escalation_runs_policy_id_escalation_policies_id_fk";
--> statement-breakpoint
ALTER TABLE "escalation_runs" ALTER COLUMN "policy_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "monitor_checks" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "monitor_checks" ADD COLUMN "maintenance" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "monitor_checks" ADD COLUMN "transition" text;--> statement-breakpoint
ALTER TABLE "monitor_checks" ADD COLUMN "timings" jsonb;--> statement-breakpoint
ALTER TABLE "monitor_checks" ADD COLUMN "config_version" integer;--> statement-breakpoint
ALTER TABLE "outbox" ADD COLUMN "lease_owner" text;--> statement-breakpoint
ALTER TABLE "escalation_policies" ADD COLUMN "branches" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "escalation_policies" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "escalation_policies" ADD COLUMN "repeat_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "escalation_policies" ADD COLUMN "generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "escalation_runs" ADD COLUMN "policy_name" text;--> statement-breakpoint
ALTER TABLE "escalation_runs" ADD COLUMN "policy_source" text;--> statement-breakpoint
ALTER TABLE "escalation_runs" ADD COLUMN "branch_name" text;--> statement-breakpoint
ALTER TABLE "escalation_runs" ADD COLUMN "steps_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "escalation_runs" ADD COLUMN "repeat_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "escalation_runs" ADD COLUMN "repeats_done" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "scopes" text[] DEFAULT '{read,write}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD COLUMN "areas" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "resolved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "resolved_by" uuid;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "resolution_origin" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "resolution_reason" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "assignee_id" uuid;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "monitor_id" uuid;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "post_mortem" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "post_mortem_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "post_mortem_updated_by" uuid;--> statement-breakpoint
ALTER TABLE "inbound_events" ADD COLUMN "duplicate_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "oncall_schedules" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "oncall_schedules" ADD COLUMN "layers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "oncall_schedules" ADD COLUMN "calendar_token_hash" text;--> statement-breakpoint
ALTER TABLE "status_pages" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "status_pages" ADD COLUMN "logo_dark_url" text;--> statement-breakpoint
ALTER TABLE "status_pages" ADD COLUMN "homepage_url" text;--> statement-breakpoint
ALTER TABLE "status_pages" ADD COLUMN "contact_url" text;--> statement-breakpoint
ALTER TABLE "status_pages" ADD COLUMN "theme" text DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "status_pages" ADD COLUMN "header_layout" text DEFAULT 'logo_and_name' NOT NULL;--> statement-breakpoint
ALTER TABLE "status_pages" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "status_pages" ADD COLUMN "hide_from_search" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "status_subscribers" ADD COLUMN "confirm_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "status_subscribers" ADD COLUMN "unsubscribe_token" text;--> statement-breakpoint
ALTER TABLE "status_subscribers" ADD COLUMN "unsubscribed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "status_updates" ADD COLUMN "report_id" uuid;--> statement-breakpoint
ALTER TABLE "dashboards" ADD COLUMN "variables" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "error_groups" ADD COLUMN "application_id" uuid;--> statement-breakpoint
ALTER TABLE "error_groups" ADD COLUMN "fingerprint_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "error_groups" ADD COLUMN "snooze_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "error_groups" ADD COLUMN "snooze_remaining" integer;--> statement-breakpoint
ALTER TABLE "error_groups" ADD COLUMN "resolved_in_release" text;--> statement-breakpoint
ALTER TABLE "error_occurrences" ADD COLUMN "environment" text;--> statement-breakpoint
ALTER TABLE "error_occurrences" ADD COLUMN "user_key" text;--> statement-breakpoint
ALTER TABLE "error_occurrences" ADD COLUMN "rum_session_key" text;--> statement-breakpoint
ALTER TABLE "error_occurrences" ADD COLUMN "tags" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "error_occurrences" ADD COLUMN "detail" jsonb;--> statement-breakpoint
ALTER TABLE "ingest_tokens" ADD COLUMN "paused_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "metric_points" ADD COLUMN "scope" text;--> statement-breakpoint
ALTER TABLE "metric_points" ADD COLUMN "series_key" text;--> statement-breakpoint
ALTER TABLE "metric_points" ADD COLUMN "start_ts" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "metric_points" ADD COLUMN "temporality" text;--> statement-breakpoint
ALTER TABLE "metric_points" ADD COLUMN "monotonic" boolean;--> statement-breakpoint
ALTER TABLE "metric_points" ADD COLUMN "histogram" jsonb;--> statement-breakpoint
ALTER TABLE "rum_applications" ADD COLUMN "replay_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rum_applications" ADD COLUMN "replay_sample_rate" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "rum_applications" ADD COLUMN "mask_all_text" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "rum_applications" ADD COLUMN "block_selectors" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "rum_events" ADD COLUMN "event_id" text;--> statement-breakpoint
ALTER TABLE "rum_funnels" ADD COLUMN "unit" text DEFAULT 'session' NOT NULL;--> statement-breakpoint
ALTER TABLE "rum_funnels" ADD COLUMN "window_minutes" integer;--> statement-breakpoint
ALTER TABLE "rum_replay" ADD COLUMN "seq" integer;--> statement-breakpoint
ALTER TABLE "rum_replay" ADD COLUMN "batch_id" text;--> statement-breakpoint
ALTER TABLE "rum_sessions" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "rum_sessions" ADD COLUMN "dropped_events" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_methods" ADD CONSTRAINT "contact_methods_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_methods" ADD CONSTRAINT "contact_methods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_run_id_escalation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."escalation_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_deliveries" ADD CONSTRAINT "status_deliveries_notification_id_status_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."status_notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_deliveries" ADD CONSTRAINT "status_deliveries_subscriber_id_status_subscribers_id_fk" FOREIGN KEY ("subscriber_id") REFERENCES "public"."status_subscribers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_maintenance_resources" ADD CONSTRAINT "status_maintenance_resources_maintenance_id_status_maintenances_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."status_maintenances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_maintenance_resources" ADD CONSTRAINT "status_maintenance_resources_resource_id_status_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."status_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_maintenances" ADD CONSTRAINT "status_maintenances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_maintenances" ADD CONSTRAINT "status_maintenances_page_id_status_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."status_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_notifications" ADD CONSTRAINT "status_notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_notifications" ADD CONSTRAINT "status_notifications_page_id_status_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."status_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_notifications" ADD CONSTRAINT "status_notifications_report_id_status_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."status_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_notifications" ADD CONSTRAINT "status_notifications_maintenance_id_status_maintenances_id_fk" FOREIGN KEY ("maintenance_id") REFERENCES "public"."status_maintenances"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_report_resources" ADD CONSTRAINT "status_report_resources_report_id_status_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."status_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_report_resources" ADD CONSTRAINT "status_report_resources_resource_id_status_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."status_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_reports" ADD CONSTRAINT "status_reports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_reports" ADD CONSTRAINT "status_reports_page_id_status_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."status_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_reports" ADD CONSTRAINT "status_reports_monitor_id_integrations_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_resource_monitors" ADD CONSTRAINT "status_resource_monitors_resource_id_status_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."status_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_resource_monitors" ADD CONSTRAINT "status_resource_monitors_monitor_id_integrations_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_resources" ADD CONSTRAINT "status_resources_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_resources" ADD CONSTRAINT "status_resources_page_id_status_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."status_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_resources" ADD CONSTRAINT "status_resources_section_id_status_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."status_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_sections" ADD CONSTRAINT "status_sections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_sections" ADD CONSTRAINT "status_sections_page_id_status_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."status_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_batches" ADD CONSTRAINT "ingest_batches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_alert_rules" ADD CONSTRAINT "metric_alert_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_alert_rules" ADD CONSTRAINT "metric_alert_rules_source_id_integrations_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_alert_rules" ADD CONSTRAINT "metric_alert_rules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_alert_states" ADD CONSTRAINT "metric_alert_states_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_alert_states" ADD CONSTRAINT "metric_alert_states_rule_id_metric_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."metric_alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "error_applications" ADD CONSTRAINT "error_applications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rum_batches" ADD CONSTRAINT "rum_batches_app_id_rum_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."rum_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_queries" ADD CONSTRAINT "saved_queries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_queries" ADD CONSTRAINT "saved_queries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_pings" ADD CONSTRAINT "heartbeat_pings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heartbeat_pings" ADD CONSTRAINT "heartbeat_pings_source_id_integrations_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_methods_user_idx" ON "contact_methods" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_attempts_dedup_key" ON "delivery_attempts" USING btree ("dedup_key");--> statement-breakpoint
CREATE INDEX "delivery_attempts_due_idx" ON "delivery_attempts" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "delivery_attempts_workspace_idx" ON "delivery_attempts" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "delivery_attempts_incident_idx" ON "delivery_attempts" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "delivery_attempts_run_idx" ON "delivery_attempts" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "delivery_attempts_provider_idx" ON "delivery_attempts" USING btree ("provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "status_deliveries_once_idx" ON "status_deliveries" USING btree ("notification_id","subscriber_id");--> statement-breakpoint
CREATE INDEX "status_deliveries_due_idx" ON "status_deliveries" USING btree ("state","next_attempt_at");--> statement-breakpoint
CREATE INDEX "status_maintenance_resources_resource_idx" ON "status_maintenance_resources" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "status_maintenances_page_idx" ON "status_maintenances" USING btree ("page_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "status_notifications_dedup_idx" ON "status_notifications" USING btree ("page_id","dedup_key");--> statement-breakpoint
CREATE INDEX "status_notifications_pending_idx" ON "status_notifications" USING btree ("fanned_out_at","deliver_after");--> statement-breakpoint
CREATE INDEX "status_report_resources_resource_idx" ON "status_report_resources" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "status_reports_page_idx" ON "status_reports" USING btree ("page_id","published_at");--> statement-breakpoint
CREATE INDEX "status_reports_open_auto_idx" ON "status_reports" USING btree ("page_id","monitor_id","resolved_at");--> statement-breakpoint
CREATE INDEX "status_resource_monitors_monitor_idx" ON "status_resource_monitors" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "status_resources_page_idx" ON "status_resources" USING btree ("page_id","position");--> statement-breakpoint
CREATE INDEX "status_sections_page_idx" ON "status_sections" USING btree ("page_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_batches_idempotency_key" ON "ingest_batches" USING btree ("workspace_id","idempotency_key") WHERE "ingest_batches"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "ingest_batches_workspace_created_idx" ON "ingest_batches" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "metric_alert_rules_workspace_idx" ON "metric_alert_rules" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "metric_alert_rules_due_idx" ON "metric_alert_rules" USING btree ("paused","next_eval_at");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_alert_states_rule_series_key" ON "metric_alert_states" USING btree ("rule_id","series_key");--> statement-breakpoint
CREATE INDEX "metric_alert_states_workspace_idx" ON "metric_alert_states" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "error_applications_key_idx" ON "error_applications" USING btree ("public_key");--> statement-breakpoint
CREATE UNIQUE INDEX "error_applications_project_idx" ON "error_applications" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "error_applications_workspace_idx" ON "error_applications" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_rate_windows_key_idx" ON "ingest_rate_windows" USING btree ("key","window_start");--> statement-breakpoint
CREATE INDEX "ingest_rate_windows_start_idx" ON "ingest_rate_windows" USING btree ("window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "rum_batches_batch_idx" ON "rum_batches" USING btree ("app_id","batch_id");--> statement-breakpoint
CREATE INDEX "rum_batches_received_idx" ON "rum_batches" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "saved_queries_workspace_idx" ON "saved_queries" USING btree ("workspace_id","signal");--> statement-breakpoint
CREATE INDEX "heartbeat_pings_source_time_idx" ON "heartbeat_pings" USING btree ("source_id","received_at");--> statement-breakpoint
CREATE INDEX "heartbeat_pings_received_idx" ON "heartbeat_pings" USING btree ("received_at");--> statement-breakpoint
ALTER TABLE "escalation_runs" ADD CONSTRAINT "escalation_runs_policy_id_escalation_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."escalation_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_monitor_id_integrations_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_post_mortem_updated_by_users_id_fk" FOREIGN KEY ("post_mortem_updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_updates" ADD CONSTRAINT "status_updates_report_id_status_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."status_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "escalation_runs_incident_key" ON "escalation_runs" USING btree ("incident_id") WHERE "escalation_runs"."policy_source" is not null;--> statement-breakpoint
CREATE INDEX "api_tokens_workspace_idx" ON "api_tokens" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "incident_events_incident_time_idx" ON "incident_events" USING btree ("incident_id","occurred_at");--> statement-breakpoint
CREATE INDEX "incidents_workspace_started_idx" ON "incidents" USING btree ("workspace_id","first_seen_at");--> statement-breakpoint
CREATE INDEX "incidents_monitor_idx" ON "incidents" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "inbound_events_integration_time_idx" ON "inbound_events" USING btree ("integration_id","received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "status_subscribers_unsubscribe_idx" ON "status_subscribers" USING btree ("unsubscribe_token");--> statement-breakpoint
CREATE INDEX "status_updates_report_idx" ON "status_updates" USING btree ("report_id","created_at");--> statement-breakpoint
CREATE INDEX "error_occurrences_external_idx" ON "error_occurrences" USING btree ("workspace_id","external_event_id");--> statement-breakpoint
CREATE INDEX "log_records_workspace_ts_id_idx" ON "log_records" USING btree ("workspace_id","ts","id");--> statement-breakpoint
CREATE INDEX "log_records_workspace_id_idx" ON "log_records" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE INDEX "metric_points_series_ts_idx" ON "metric_points" USING btree ("workspace_id","name","series_key","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "rum_events_event_id_idx" ON "rum_events" USING btree ("session_id","event_id") WHERE "rum_events"."event_id" is not null;--> statement-breakpoint
CREATE INDEX "spans_workspace_service_time_idx" ON "spans" USING btree ("workspace_id","service","start_time");--> statement-breakpoint
CREATE INDEX "spans_workspace_parent_idx" ON "spans" USING btree ("workspace_id","trace_id","parent_span_id");