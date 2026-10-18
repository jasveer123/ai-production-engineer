# ADR-005 — OpenTelemetry Collector first, Go later

- **Status:** Accepted
- **Date:** 2026-10-18

- **Context:** Custom ingestion services are costly to build and run.
- **Decision:** Use the OpenTelemetry Collector for ingestion. Add a Go gateway only when load tests show a bottleneck.
- **Consequences:** Faster MVP; Go stays an evidence-based scaling decision (Phase 11).
