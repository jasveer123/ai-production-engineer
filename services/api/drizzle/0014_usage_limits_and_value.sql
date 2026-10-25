ALTER TABLE "services" ADD COLUMN "value_per_request" numeric(14, 4);--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "value_currency" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "ai_budget_usd" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "max_concurrent_investigations" integer;