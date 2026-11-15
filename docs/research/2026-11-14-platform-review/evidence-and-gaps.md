# Evidence and gap register

See [scope and evidence boundary](README.md). Paths below are relative to the repository root. Findings are source-derived unless explicitly labelled otherwise. Priority P0 blocks trusted paging; P1 blocks broader production readiness; P2 expands parity.

## Current capability inventory

| Area | What exists in this baseline | Assessment / next proof |
|---|---|---|
| Identity | Password/OAuth flows, sessions, invitations, roles, workspace guards | Validate complete onboarding and every cross-workspace access path |
| API access | Personal token creation, hash storage, expiry, revocation | Add operation/workspace scopes and service identities |
| Uptime | HTTP, keyword, expected status, TCP; histories, confirmations, pause, manual check | Basic engine exists; no complete advanced probe or geographic consensus model |
| Alert intake | Source adapters, parsing, routing, grouping, persisted inbound events | Verify duplicate/concurrent/out-of-order delivery and replay |
| Heartbeats | Source/configuration support | Verify deadlines, grace, initial state, pause, and recovery end to end |
| Incidents | List/detail/timeline, manual creation, acknowledgement, transitions | Status enum follows AI repair rather than independent response lifecycle |
| On-call | Fixed-hour rotations, participants, overrides, current responder | Calendar/timezone/DST and routing semantics need expansion |
| Escalation | Persisted runs, leases, steps, email loop | Delivery truth and policy assignment/snapshot behavior need repair |
| Notifications | Slack, signed webhook, push adapter, Twilio SMS/phone adapters | Provider acceptance is not recipient delivery; receipts and user-level routing need proof |
| Status | Pages, monitor links, updates, custom-domain verification, subscribers | Atomic automation, multi-component updates, maintenance, privacy, and delivery need proof |
| Telemetry | HTTP/OTLP parsing, Prometheus intake, logs/spans/metric rows, retention | Semantics, partial success, durable ingestion, cardinality and scale need work |
| Metrics | Metric names, labels, grouped series, dashboard CRUD | Histogram and counter rate semantics currently inadequate |
| Logs/traces | Search, service summaries, trace lookup, live-related contracts | Full analytical query/exploration and correlation need acceptance tests |
| Errors | Occurrences/groups, state changes, releases endpoints, source maps | Sentry protocol compatibility and richer grouping/spike workflows need work |
| RUM | Browser tag, ingest, sessions/users/events, funnels, HTML replay player | Present, not absent; delivery, privacy, replay fidelity and exact analytics need hardening |
| AI | Incident investigation, evidence, patch/sandbox/approval/PR workflows; chat | Preserve work; isolate its state and failure modes from paging |
| Operations | CI, infrastructure, dependency rules, Docker, deployment docs | Browser journey tests are optional; readiness is superficial; production defaults need revision |

## Concrete findings

| ID / priority | Evidence | Failure mechanism | Required repair / acceptance |
|---|---|---|---|
| G01 P0 | `services/api/src/modules/auth/infrastructure/mailer.service.ts`, `sendSmtp`, `sendResend`; escalation `runStep` | SMTP exceptions and Resend non-2xx are logged but not propagated. Caller can record successful send. Unconfigured transport logs instead of delivering. | Typed transport outcomes; fail visibly in production; queued/accepted/delivered/failed states; retry transient failure and test provider rejection |
| G02 P0 | `modules/alerts/application/monitors.service.ts`, `execute` | Check insert, monitor config/state update, and `sources.buffer` are separate writes. A crash after state update can lose the transition event permanently. | Persist result, transition, and outbox in one transaction; crash injection at every boundary |
| G03 P0 | Same, `runDue` and `checkNow` | Schedule advances before execution; long batches and manual checks can overlap. Mutable state is computed from an earlier row snapshot. | Due-job leases, run IDs, configuration versions and fencing; discard stale results; no overlapping transition decisions |
| G04 P0 | `modules/escalation/application/escalation.service.ts`, `startRuns` | Scans enabled policies against qualifying recent workspace incidents. This is not explicit resource/service policy assignment; outage beyond lookback can miss new runs. | Choose policy at incident creation, persist version and start event atomically; reconciliation without a narrow creation lookback |
| G05 P0 | Same, `runStep`; `core/temporal/outbox-publisher.service.ts` | Email occurs before attempt persistence; external actions occur during an outbox DB transaction. Crash/timeout can make outcome ambiguous; row lock spans network work. | Commit delivery intent first; send outside DB transaction; idempotent provider request IDs, receipt reconciliation, lease expiry |
| G06 P1 | `packages/api-contracts/src/incidents/status.ts` | `fix_proposed`, `validation`, `awaiting_review` and `verification_inconclusive` are incident statuses. A normal response path becomes coupled to optional AI. | Separate incident response, investigation, remediation and verification lifecycles; backward-compatible read projection |
| G07 P1 | `ingest/collector/domain/otlp.ts`, `pointsOf` | Histogram is converted to sum/count. Bucket distribution is irretrievably lost; percentile reconstruction is impossible. | Retain bounds/counts or native histograms, sum/count, temporality and start timestamps; fixtures with equal means and different p99 |
| G08 P1 | `modules/metrics/application/metrics.service.ts`, `series` | `rate` uses `(max-min)/bucketSeconds`, across selected data. It loses order, resets, and per-series identity. | Compute reset-aware increments per series, then aggregate; use established metrics query engine where possible |
| G09 P1 | `otlp.ts`, `metricsToBatch`; `collector.controller.ts`, success response | Points are capped at 5,000; collector success helper returns empty partial-success. Silent truncation can be reported as full success. | Protocol-specific rejected counts and reason; enforce bounded admission before processing; do not imply all data persisted |
| G10 P1 | `collector/application/telemetry-store.service.ts`, `write` | Logs, spans, error buffering, metric points and stream summaries are independently written. Mid-batch failures can leave partial durable data followed by whole-request retry. | Durable batch receipt and sink-specific idempotency/checkpoints; explicit partial outcome; document at-least-once duplicates for logs |
| G11 P1 | `modules/status/application/status-automation.service.ts`, `tick` | Link state advances before status update and subscriber notification. A crash can suppress the corresponding public update. | Transactional update/outbox; dedup by page/component/transition; independent subscriber deliveries |
| G12 P1 | Same, update predicate filters only `monitorId` | A monitor linked to multiple pages can have all links' `lastState` updated during one link's processing. | Scope update by page + monitor or link primary key; test two pages on one monitor |
| G13 P1 | `modules/status/application/subscribers.service.ts` | Email fanout is synchronous; notify returns recipient count, not verified deliveries. Confirmation token is reused without an expiry check here. | Queued fanout and receipt ledger; expiring confirmation capability and distinct unsubscribe token; abuse limits |
| G14 P1 | `apps/web/public/rum.js`, `payload`, `send` | Events are removed from memory before a fetch whose failure is swallowed. HTTP rejection is not checked. Beacon return is ignored. | Bounded retry/spool queue with batch IDs, explicit loss counters, consent-aware persistence and expiry |
| G15 P1 | `modules/rum/application/rum-ingest.service.ts` | Retry repeats session counter increments and event inserts; no batch/event dedup shown. Session/event/replay writes are separate. | Batch receipt and event IDs; atomic session increments with dedup acceptance; ordered replay chunks |
| G16 P1 | RUM ingest `limit` | Per-process in-memory rate map is cleared above 5,000 entries. Multiple replicas do not share enforcement. | Tenant/app/IP admission at gateway or shared limiter; bounded key eviction and abuse metrics |
| G17 P1 | RUM tag `replayOn`, `maskAll`, `scrub` | Replay defaults on unless disabled; full text masking requires opt-in. Form values are scrubbed, but other DOM text and attribute URLs can still contain sensitive data. | Explicit replay consent/settings; robust mask/block rules applied to replay and autocapture; synthetic privacy fixtures |
| G18 P1 | `modules/oncall/domain/shifts.ts` and oncall service | Fixed-hour arithmetic supports elapsed-duration rotation, not local calendar semantics. Service rejects overlapping overrides, which is useful; DB-level race behavior still needs proof. | IANA timezone/calendar model, DST policy, exclusion constraint/serialized override creation, deterministic preview |
| G19 P1 | `modules/rum/domain/funnel.ts`, `reachedPerStep` | Uses `>=` timestamp and searches from the beginning per step. One matching event can satisfy repeated adjacent steps. | Advance event index, explicit same-time ordering and conversion window; repeated-step fixtures |
| G20 P1 | `modules/auth/application/api-tokens.service.ts` | Resolve returns a user identity, not an operation or workspace-scoped capability. | Scoped machine tokens, least-access endpoints, membership recheck and rotation history |
| G21 P0 | `core/health/health.controller.ts` | Always returns `{status:'ok',service:'api'}`. It is a liveness check, not dependency/worker readiness. | Separate live/ready endpoints; dependency status and stale-worker/queue monitoring |
| G22 P0 | `infrastructure/docker/compose.prod.yml`; `infrastructure/terraform/stage1/variables.tf` | Production Compose invokes Temporal `server start-dev`; scheduled host stop/start defaults exist. These are configuration findings, not proof of deployed settings. | Production persistence/HA plan; monitoring hosts operate continuously; verify deployed runner flags and schedules |
| G23 P0 | `.github/workflows/ci.yml`, `e2e` | Job has `continue-on-error: true`; absent Playwright config exits successfully. | Required journey gate, fail on missing config, attach artifacts, test restarts and tenant isolation |

## Research source register

All summaries here are deliberately short; detailed proposed behavior in the other documents is our design.

| Source | Documented behavior used |
|---|---|
| [Product docs entry](https://betterstack.com/docs/getting-started/welcome/) | Product families and API entry points |
| [Monitor creation](https://betterstack.com/docs/uptime/api/create-a-new-monitor/) | Probe variants; methods/headers; timing; regions; recovery/confirmation configuration |
| [Monitor update](https://betterstack.com/docs/uptime/api/update-an-existing-monitor/) | Configuration update surface |
| [Escalation policy creation](https://betterstack.com/docs/uptime/api/create-escalation-policy/) | Ordered escalation, time/metadata branches, instructions, repeats and fallback |
| [Escalation behavior](https://betterstack.com/docs/uptime/escalation-policies/) | Assign policies to resources; primary/team fallback |
| [Heartbeat behavior](https://betterstack.com/docs/uptime/cron-and-heartbeat-monitor/) | Incident after expected period plus grace |
| [Heartbeat states](https://betterstack.com/docs/uptime/api/list-all-existing-hearbeats/) | Initial, paused, maintenance, validation and recovery states |
| [Incident workflow](https://betterstack.com/docs/uptime/working-with-incidents/) | Incident creation/response and diagnostic context |
| [Acknowledgement](https://betterstack.com/docs/uptime/acknowledging-an-incident/) | Phone acknowledgement is an interaction, distinct from placing a call |
| [Complex schedules](https://betterstack.com/docs/uptime/complex-schedules/) | Multiple regional schedules and coverage |
| [Holiday mode](https://betterstack.com/docs/uptime/holiday-mode/) | Availability exceptions and fallback behavior |
| [Status pages](https://betterstack.com/docs/uptime/getting-started-with-status-pages/) | Outage/maintenance communication, custom domains and private pages |
| [Subscriptions](https://betterstack.com/docs/uptime/subscribing-to-status-updates/) | Subscriber notification selection and double opt-in |
| [Status resources](https://betterstack.com/docs/uptime/api/create-a-new-status-page-resource/) | Resource/component linkage |
| [HTTP log ingestion](https://betterstack.com/docs/logs/ingesting-data/http/logs/) | JSON/NDJSON/MessagePack, source Bearer token, 202 acceptance |
| [Metrics ingestion](https://betterstack.com/docs/logs/ingesting-data/http/metrics/) | Source-specific metric submission |
| [SQL API](https://betterstack.com/docs/logs/query-api/connect-remotely/) | Team-scoped read-only query connections; logs/spans/metrics access |
| [Telemetry alerts](https://betterstack.com/docs/logs/dashboards/alerts/) | Threshold, relative change and anomaly alert types |
| [Alert response schema](https://betterstack.com/docs/logs/api/alerts/get/) | Missing-data policy, per-series incidents, confirmation/recovery and evaluation windows |
| [Collector](https://betterstack.com/docs/logs/collector/) | SDK/eBPF collection, resource correlation and configuration limitations |
| [Errors](https://betterstack.com/docs/errors/start/) | Sentry SDK compatibility, releases, AI prompt and integrations |
| [Grouping](https://betterstack.com/docs/errors/using-the-product/exception-grouping/) | Groups/occurrences, users, tags, replay links and configurable grouping |
| [Tag privacy/configuration](https://betterstack.com/docs/errors/js-tag/configure/) | Per-session replay sampling and distinct masking/blocking behavior |
| [RUM](https://betterstack.com/docs/rum/start/) | RUM product entry and tag installation |
| [AI SRE](https://betterstack.com/docs/ai-sre/welcome/) | Contextual chat, third-party tools, code-fix entry points and resumed conversations |
| [OTLP specification](https://opentelemetry.io/docs/specs/otlp/) | Protocol-defined full/partial failure and retry semantics |
| [Metric model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/) | Metric identity, temporal semantics and distribution model |
| [Prometheus functions](https://prometheus.io/docs/prometheus/latest/querying/functions/) | Reset-aware rate per series before aggregation |
| [Temporal production](https://docs.temporal.io/production-deployment) | Production deployment must be planned beyond a development server |
| [ClickHouse observability](https://clickhouse.com/use-cases/observability) | Candidate analytical storage; vendor guidance, not an independent benchmark |

## Verification ledger

Executed: repository status and baseline inspection, selected source reads, official web retrieval, authenticated Errors list read, cached REA CLI help and local analysis attempt, selected Jest attempt. Initial git working tree was clean. REA failed with `execution_failure`, phase `startup`; selected source was `monitors.service.ts`. The helper compilation diagnostic is sufficient to classify analysis as unavailable; the large partial inventory is intentionally excluded from deliverables.

Jest command: `pnpm --filter @ape/api exec jest --runInBand --runTestsByPath src/modules/incidents/domain/lifecycle.spec.ts src/modules/rum/domain/funnel.spec.ts src/modules/errors/domain/sourcemap.spec.ts src/ingest/ingestion/domain/normalize.spec.ts src/modules/investigations/domain/redact.spec.ts`. It failed before results with a local connection permission error. No database migration, paid service, alert delivery, cloud deployment, or live incident was triggered.

Pending evidence: authenticated incident/monitor/escalation/status/telemetry/RUM forms; real request/response capture with credentials redacted; actual provider receipts; concurrent DB behavior; full browser journeys; restore/failover/load tests; deployed configuration. REA cannot expose private Better Stack backend code or establish undocumented server invariants.
