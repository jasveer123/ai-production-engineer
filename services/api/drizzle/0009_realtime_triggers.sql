-- Phase 8 (ADR-020). Change notifications for live dashboards: NOTIFY fires on commit and carries
-- only ids (workspace, table, incident), never row data; clients re-read through the API.
CREATE OR REPLACE FUNCTION ape_notify_change() RETURNS trigger AS $$
DECLARE
  incident uuid;
BEGIN
  IF TG_TABLE_NAME = 'incidents' THEN
    incident := NEW.id;
  ELSIF TG_TABLE_NAME = 'validation_runs' THEN
    SELECT incident_id INTO incident FROM fix_proposals WHERE id = NEW.fix_proposal_id;
  ELSE
    incident := NEW.incident_id;
  END IF;
  PERFORM pg_notify(
    'ape_changes',
    json_build_object('w', NEW.workspace_id, 't', TG_TABLE_NAME, 'i', incident)::text
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER incidents_notify_change AFTER INSERT OR UPDATE ON incidents
  FOR EACH ROW EXECUTE FUNCTION ape_notify_change();
--> statement-breakpoint
CREATE TRIGGER incident_events_notify_change AFTER INSERT ON incident_events
  FOR EACH ROW EXECUTE FUNCTION ape_notify_change();
--> statement-breakpoint
CREATE TRIGGER investigations_notify_change AFTER INSERT OR UPDATE ON investigations
  FOR EACH ROW EXECUTE FUNCTION ape_notify_change();
--> statement-breakpoint
CREATE TRIGGER fix_proposals_notify_change AFTER INSERT OR UPDATE ON fix_proposals
  FOR EACH ROW EXECUTE FUNCTION ape_notify_change();
--> statement-breakpoint
CREATE TRIGGER validation_runs_notify_change AFTER INSERT ON validation_runs
  FOR EACH ROW EXECUTE FUNCTION ape_notify_change();
--> statement-breakpoint
CREATE TRIGGER pull_requests_notify_change AFTER INSERT OR UPDATE ON pull_requests
  FOR EACH ROW EXECUTE FUNCTION ape_notify_change();
--> statement-breakpoint
CREATE TRIGGER verification_runs_notify_change AFTER INSERT OR UPDATE ON verification_runs
  FOR EACH ROW EXECUTE FUNCTION ape_notify_change();
--> statement-breakpoint
-- Notification candidates: every incident creation and status change, whichever code path wrote
-- it, enters the outbox in the same transaction. Skipped when the workspace has no channel.
CREATE OR REPLACE FUNCTION ape_enqueue_notification() RETURNS trigger AS $$
BEGIN
  IF NEW.kind IN ('created', 'status_change') AND EXISTS (
    SELECT 1 FROM notification_channels
    WHERE workspace_id = NEW.workspace_id AND enabled
  ) THEN
    INSERT INTO outbox (workspace_id, topic, payload)
    VALUES (
      NEW.workspace_id,
      'notify',
      json_build_object('incidentEventId', NEW.id, 'incidentId', NEW.incident_id)::jsonb
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER incident_events_enqueue_notification AFTER INSERT ON incident_events
  FOR EACH ROW EXECUTE FUNCTION ape_enqueue_notification();
