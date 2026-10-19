ALTER TABLE "verification_runs" ADD COLUMN "deployment_id" uuid;--> statement-breakpoint
ALTER TABLE "verification_runs" ADD COLUMN "window" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_runs" ADD COLUMN "status" text DEFAULT 'observing' NOT NULL;--> statement-breakpoint
ALTER TABLE "verification_runs" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "verification_runs" ADD CONSTRAINT "verification_runs_deployment_id_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."deployments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "verification_runs_window_key" ON "verification_runs" USING btree ("incident_id","deployment_id","window");