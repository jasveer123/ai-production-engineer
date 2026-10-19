CREATE TABLE "hypothesis_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"investigation_id" uuid NOT NULL,
	"hypothesis_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"verdict" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hypothesis_feedback" ADD CONSTRAINT "hypothesis_feedback_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hypothesis_feedback" ADD CONSTRAINT "hypothesis_feedback_investigation_id_investigations_id_fk" FOREIGN KEY ("investigation_id") REFERENCES "public"."investigations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hypothesis_feedback" ADD CONSTRAINT "hypothesis_feedback_hypothesis_id_hypotheses_id_fk" FOREIGN KEY ("hypothesis_id") REFERENCES "public"."hypotheses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hypothesis_feedback" ADD CONSTRAINT "hypothesis_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hypothesis_feedback_user_key" ON "hypothesis_feedback" USING btree ("hypothesis_id","user_id");--> statement-breakpoint
CREATE INDEX "hypothesis_feedback_workspace_idx" ON "hypothesis_feedback" USING btree ("workspace_id","created_at");