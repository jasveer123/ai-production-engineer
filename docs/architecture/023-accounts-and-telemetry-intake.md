# ADR-023: Password accounts and a first-party telemetry intake

Status: accepted · Date: 2026-10-21 · Requirements: [docs/requirements/auth-and-integrations.md](../requirements/auth-and-integrations.md)

## Context

Sign-in was GitHub OAuth plus a dev-only email login, so a team without GitHub could not use the product, and the integrations page only covered alert webhooks, a Jaeger poller and a deploy webhook. The new UI promises 7 ways to send data and our own packages.

## Decision

1. **Password accounts beside GitHub.** scrypt (N=2^15, r=8, p=1) from Node's standard library, parameters stored with the hash. Lockout after 5 wrong passwords for 15 minutes, plus a per-IP rate limit. Reset, verification and invitation links are random 32-byte tokens; only their SHA-256 is stored, and they are single-use and expiring.
2. **Invitations need a proven email.** Pending invitations are only accepted by an account whose email is verified, or through the invite link itself. A verified identity (GitHub, dev login) that matches an unverified password account removes that password and its sessions, which closes the pre-registration takeover.
3. **One intake for Ways 1-5** under `/v1/*`, authenticated by a workspace ingest token (`ape_live_…`, stored hashed, cached 60 s). Bodies are read raw so OTLP protobuf (hand-written decoder, no dependency), OTLP JSON, NDJSON, Vercel drains and Heroku logplex all go through one controller; gzip is inflated by the body parser. A TCP syslog listener serves Render and rsyslog.
4. **Logs and spans are stored in Postgres** (`log_records`, `spans`), redacted before insert, with time-based retention. Errors become `ingest_error` events in the existing `inbound_events` buffer, so incidents, dedup, severity rules and auto-investigation are unchanged.
5. **Way 7 readers are read-only HTTP clients** (Loki, Datadog, Sentry, Better Stack ClickHouse, CloudWatch with our own SigV4 signer, Elasticsearch). Credentials live in the encrypted secret store. Investigations query every connected reader for the incident window; failures become coverage gaps.
6. **SDKs have no required dependencies.** `@ape/agent` (Node) and `ape-agent` (Python) batch, retry, bound their queues, redact before sending, and use OpenTelemetry only when the app already has it.

## Consequences

- Postgres is fine for one team's log volume. Heavy volume needs ClickHouse (planned for the scale stage, ADR-006); the intake writes through one service, so the swap is contained.
- Metrics are acknowledged and counted, not stored.
- Render's token placement in syslog is not documented; the receiver accepts the common placements and the setup page tells users to check the live status.
- Email delivery is a log line until `RESEND_API_KEY` is set.
