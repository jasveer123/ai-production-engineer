# ADR-006 — Managed queue first, streaming later

- **Status:** Accepted
- **Date:** 2026-10-18

- **Decision:** Postgres outbox + Redis/BullMQ (or SQS in AWS) first; Kafka/NATS/Redis Streams only for sustained volume, replay or multi-consumer needs.
- **Consequences:** All consumers must be idempotent regardless of the transport.
