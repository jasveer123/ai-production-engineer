# ADR-003 — Temporal for durable workflows

- **Status:** Accepted
- **Date:** 2026-10-18

- **Context:** Investigations run for minutes to days, call flaky external APIs and wait for human approval.
- **Decision:** Use Temporal for incident workflows (signals for approvals, retries, timers, versioning).
- **Consequences:** Workflow code must be deterministic; activities must be idempotent (at-least-once execution). Temporal history isn't the business DB, so status is mirrored in PostgreSQL.
