# Architecture Decision Records

Format: **Context → Decision → Consequences**. Status is *Accepted* unless noted. Add a new numbered file for each new decision.

| ADR | Title |
|---|---|
| [ADR-001](001-multi-runtime-modular-backend.md) | Multi-runtime modular backend |
| [ADR-002](002-modular-monolith-independently-scaled-workers.md) | Modular monolith + independently scaled workers |
| [ADR-003](003-temporal-for-durable-workflows.md) | Temporal for durable workflows |
| [ADR-004](004-postgresql-as-system-of-record-large-data-elsewhere.md) | PostgreSQL as system of record; large data elsewhere |
| [ADR-005](005-opentelemetry-collector-first-go-later.md) | OpenTelemetry Collector first, Go later |
| [ADR-006](006-managed-queue-first-streaming-later.md) | Managed queue first, streaming later |
| [ADR-007](007-isolated-ephemeral-sandbox-for-all-generated-code.md) | Isolated ephemeral sandbox for all generated code |
| [ADR-008](008-human-approval-before-any-external-write-no-production-mutation.md) | Human approval before any external write; no production mutation |
| [ADR-009](009-github-app-not-personal-tokens.md) | GitHub App (not personal tokens) |
| [ADR-010](010-evidence-first-ai-with-structured-outputs.md) | Evidence-first AI with structured outputs |
| [ADR-011](011-provider-agnostic-model-gateway.md) | Provider-agnostic model gateway |
| [ADR-012](012-managed-containers-before-kubernetes.md) | Managed containers before Kubernetes |
| [ADR-013](013-drizzle-orm.md) | Drizzle ORM for PostgreSQL |
| [ADR-014](014-auth-github-oauth-api-sessions.md) | GitHub OAuth with API-issued sessions |
| [ADR-015](015-temporal-typescript-workflows-python-ai-activities.md) | TypeScript workflows, polyglot activities |
| [ADR-016](016-anthropic-model-gateway-and-evidence-guard.md) | Model gateway: Claude first, structured output, evidence guard |

## Open decisions
(make these during the build)

| # | Question | Options | Decide in |
|---|---|---|---|
| D-1 | ORM | ~~Prisma vs Drizzle~~ → Drizzle (ADR-013) | Phase 1 |
| D-2 | Auth | ~~Auth.js vs NestJS sessions~~ → NestJS sessions (ADR-014) | Phase 1 |
| D-3 | Temporal SDK for workflows | ~~TypeScript vs Python~~ → TS workflows + polyglot activities (ADR-015) | Phase 4 |
| D-4 | Pre-Temporal buffer | Postgres table vs BullMQ | Phase 3 |
| D-5 | Hosting | VPS + Compose vs AWS + Terraform | Phase 10 |
| D-6 | Stream (if Phase 11) | Redis Streams vs NATS vs Kafka | Phase 11 |

