-- Phase 10: alert changes reach live dashboards like every other incident table (ADR-020).
CREATE TRIGGER alerts_notify_change AFTER INSERT OR UPDATE ON alerts
  FOR EACH ROW EXECUTE FUNCTION ape_notify_change();
