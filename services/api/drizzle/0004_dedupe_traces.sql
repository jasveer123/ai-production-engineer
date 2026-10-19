-- Remove duplicate error events for the same trace (delivered by two integrations), then
-- recount, so the new unique index can be created.
DELETE FROM "incident_events" a USING "incident_events" b
WHERE a."kind" = 'error' AND b."kind" = 'error' AND a."trace_id" IS NOT NULL
  AND a."incident_id" = b."incident_id" AND a."trace_id" = b."trace_id"
  AND (a."created_at", a."id") > (b."created_at", b."id");--> statement-breakpoint
UPDATE "incidents" i SET "event_count" = (
  SELECT count(*) FROM "incident_events" e WHERE e."incident_id" = i."id" AND e."kind" = 'error'
) WHERE i."source" <> 'manual';--> statement-breakpoint
CREATE UNIQUE INDEX "incident_events_trace_key" ON "incident_events" USING btree ("incident_id","trace_id") WHERE "incident_events"."trace_id" is not null and "incident_events"."kind" = 'error';