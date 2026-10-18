# ADR-004 — PostgreSQL as system of record; large data elsewhere

- **Status:** Accepted
- **Date:** 2026-10-18

- **Decision:** Business entities in PostgreSQL; large artifacts in S3-compatible storage; raw high-volume telemetry stays in the customer's provider (or ClickHouse later); Redis only for disposable state.
- **Consequences:** Clear data ownership per store; retention/deletion must be handled across stores.
