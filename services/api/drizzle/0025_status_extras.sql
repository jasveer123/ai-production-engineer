CREATE TABLE "status_subscribers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "status_page_monitors" ADD COLUMN "last_state" text;--> statement-breakpoint
ALTER TABLE "status_pages" ADD COLUMN "custom_domain" text;--> statement-breakpoint
ALTER TABLE "status_pages" ADD COLUMN "domain_token" text;--> statement-breakpoint
ALTER TABLE "status_pages" ADD COLUMN "domain_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "status_updates" ADD COLUMN "auto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "status_subscribers" ADD CONSTRAINT "status_subscribers_page_id_status_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."status_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "status_subscribers_email_idx" ON "status_subscribers" USING btree ("page_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "status_subscribers_token_idx" ON "status_subscribers" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "status_pages_domain_idx" ON "status_pages" USING btree ("custom_domain");