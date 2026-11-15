CREATE TABLE "rum_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"app_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rum_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"type" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"url" text,
	"value" double precision,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rum_funnels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"name" text NOT NULL,
	"steps" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rum_replay" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"kind" text NOT NULL,
	"html" text,
	"url" text,
	"moves" jsonb
);
--> statement-breakpoint
CREATE TABLE "rum_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"app_id" uuid NOT NULL,
	"session_key" text NOT NULL,
	"user_id" text,
	"user_name" text,
	"user_email" text,
	"started_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"page_views" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"entry_url" text,
	"browser" text,
	"os" text,
	"device" text,
	"has_replay" boolean DEFAULT false NOT NULL,
	"viewport_w" integer,
	"viewport_h" integer
);
--> statement-breakpoint
ALTER TABLE "rum_applications" ADD CONSTRAINT "rum_applications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rum_events" ADD CONSTRAINT "rum_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rum_events" ADD CONSTRAINT "rum_events_session_id_rum_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."rum_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rum_funnels" ADD CONSTRAINT "rum_funnels_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rum_funnels" ADD CONSTRAINT "rum_funnels_app_id_rum_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."rum_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rum_replay" ADD CONSTRAINT "rum_replay_session_id_rum_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."rum_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rum_sessions" ADD CONSTRAINT "rum_sessions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rum_sessions" ADD CONSTRAINT "rum_sessions_app_id_rum_applications_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."rum_applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rum_applications_key_idx" ON "rum_applications" USING btree ("app_key");--> statement-breakpoint
CREATE INDEX "rum_events_session_idx" ON "rum_events" USING btree ("session_id","ts");--> statement-breakpoint
CREATE INDEX "rum_events_app_time_idx" ON "rum_events" USING btree ("workspace_id","type","ts");--> statement-breakpoint
CREATE INDEX "rum_funnels_workspace_idx" ON "rum_funnels" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "rum_replay_session_idx" ON "rum_replay" USING btree ("session_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "rum_sessions_key_idx" ON "rum_sessions" USING btree ("app_id","session_key");--> statement-breakpoint
CREATE INDEX "rum_sessions_time_idx" ON "rum_sessions" USING btree ("workspace_id","last_seen_at");