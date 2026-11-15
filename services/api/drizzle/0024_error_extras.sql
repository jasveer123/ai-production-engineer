CREATE TABLE "source_maps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"release" text NOT NULL,
	"file" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "error_groups" ADD COLUMN "first_release" text;--> statement-breakpoint
ALTER TABLE "error_groups" ADD COLUMN "assignee_id" uuid;--> statement-breakpoint
ALTER TABLE "source_maps" ADD CONSTRAINT "source_maps_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "source_maps_unique_idx" ON "source_maps" USING btree ("workspace_id","release","file");--> statement-breakpoint
ALTER TABLE "error_groups" ADD CONSTRAINT "error_groups_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;