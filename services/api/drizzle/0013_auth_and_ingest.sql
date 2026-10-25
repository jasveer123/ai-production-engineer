CREATE TABLE "auth_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_streams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"way" text NOT NULL,
	"service_name" text NOT NULL,
	"environment" text NOT NULL,
	"host" text,
	"first_received_at" timestamp with time zone NOT NULL,
	"last_received_at" timestamp with time zone NOT NULL,
	"log_count" bigint DEFAULT 0 NOT NULL,
	"span_count" bigint DEFAULT 0 NOT NULL,
	"error_count" bigint DEFAULT 0 NOT NULL,
	"metric_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"last4" text NOT NULL,
	"created_by" uuid,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_records" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"service" text NOT NULL,
	"environment" text NOT NULL,
	"level" text NOT NULL,
	"message" text NOT NULL,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"trace_id" text,
	"span_id" text,
	"host" text,
	"way" text NOT NULL,
	"dedup_key" text
);
--> statement-breakpoint
CREATE TABLE "spans" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"trace_id" text NOT NULL,
	"span_id" text NOT NULL,
	"parent_span_id" text,
	"service" text NOT NULL,
	"environment" text NOT NULL,
	"name" text NOT NULL,
	"kind" integer DEFAULT 0 NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"duration_ms" numeric(14, 3) NOT NULL,
	"status_code" integer DEFAULT 0 NOT NULL,
	"status_message" text,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "failed_login_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD COLUMN "token_hash" text;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_streams" ADD CONSTRAINT "ingest_streams_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_tokens" ADD CONSTRAINT "ingest_tokens_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_tokens" ADD CONSTRAINT "ingest_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_records" ADD CONSTRAINT "log_records_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spans" ADD CONSTRAINT "spans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_tokens_hash_key" ON "auth_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "auth_tokens_user_idx" ON "auth_tokens" USING btree ("user_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_streams_key" ON "ingest_streams" USING btree ("workspace_id","way","service_name","environment");--> statement-breakpoint
CREATE UNIQUE INDEX "ingest_tokens_hash_key" ON "ingest_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "ingest_tokens_workspace_idx" ON "ingest_tokens" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "log_records_workspace_ts_idx" ON "log_records" USING btree ("workspace_id","ts");--> statement-breakpoint
CREATE INDEX "log_records_service_ts_idx" ON "log_records" USING btree ("workspace_id","service","ts");--> statement-breakpoint
CREATE INDEX "log_records_trace_idx" ON "log_records" USING btree ("workspace_id","trace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "log_records_dedup_key" ON "log_records" USING btree ("workspace_id","dedup_key") WHERE "log_records"."dedup_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "spans_key" ON "spans" USING btree ("workspace_id","trace_id","span_id");--> statement-breakpoint
CREATE INDEX "spans_workspace_time_idx" ON "spans" USING btree ("workspace_id","start_time");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitations_token_key" ON "workspace_invitations" USING btree ("token_hash");--> statement-breakpoint
-- GitHub (verified primary email) and dev-login users already proved their email.
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "identity_provider" IN ('github', 'dev');
