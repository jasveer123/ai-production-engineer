# Module specifications and contracts

All requirements and examples below are **proposed for our platform**. They are not captured Better Stack payloads. Better Stack reference behavior is linked in the [source register](evidence-and-gaps.md). Existing routes remain supported during migration; `/api/v1` examples describe the intended public API.

## Shared rules

Every authenticated resource belongs to an organization/workspace. Derive permitted tenancy from credentials and membership; a request body cannot override it. Use UUID resource IDs, UTC timestamps, explicit IANA timezone fields for calendar rules, cursor pagination, immutable event IDs, and resource versions. Return 404 for inaccessible objects, 403 for forbidden actions on visible resources, 409 for stale versions/idempotency conflicts, 422 for valid JSON with invalid domain values, 429 with retry guidance for admission limits, and 503 for unavailable durable admission. OTLP endpoints follow their protocol rather than this general response convention.

Mutation requests accept `Idempotency-Key`, scoped to principal, workspace, method and route. Store request hash and final result; same key and body returns the previous result, different body returns 409. Suggested key retention: seven days for incident commands and billing events; configurable for high-volume ingest. Internal event consumers keep durable processed IDs for at least the maximum replay window. Delivery is at least once; externally visible effects must tolerate duplicates.

Example error: `{"error":{"code":"version_conflict","message":"Resource changed","requestId":"req_123","details":{"currentVersion":8}}}`. Query responses include data range, freshness, sampling and truncation metadata. Missing data is distinct from zero and healthy.

## 1. Workspace, identity, access and usage

Support organizations, workspaces, teams, invitations with expiry/revocation, owner/admin/responder/viewer roles, service identities, scoped API tokens, session revocation, MFA/SSO later, audit history and per-product entitlements. Separate a user's global identity from workspace membership. Machine tokens carry explicit workspace and action scopes; ingest-only tokens cannot query telemetry.

Invite → persist invitation → queue email → accept once → create membership transactionally. Removal must revoke access immediately, preserve historical attribution, and force reassignment of sole-owner/on-call dependencies. Prevent last-owner deletion. Recheck membership on API calls, streams and background actions. Token plaintext is shown once; store only hashes for inbound tokens and encrypted references for outbound credentials.

Record raw and billable usage separately by durable receipt, unit, workspace and time bucket. Keep quotas and feature flags server-enforced. Replayed batches cannot inflate usage. Do not bill failed admission as accepted data. Billing provider webhooks require signature verification, replay protection and reconciliation. Full invoicing/tax/payment design remains a separate implementation workstream; no payment action is part of this research.

## 2. Uptime and synthetic monitoring

Required catalog: HTTP success, explicit status sets, keyword presence/absence, JSON/API assertions, redirects, TLS validity/expiry, domain expiry, DNS answers/record types, TCP, UDP, ICMP, SMTP/POP/IMAP and browser transactions. Certificate/domain expiry checks are scheduled checks with warning thresholds, not merely failed HTTP checks. Browser scenarios need versioned scripts, bounded runtime, encrypted secrets, isolated execution, restricted egress and screenshots/console artifacts.

Monitor config includes target, method, headers/body, auth secret references, assertions, timeout, interval, regions, IP family, TLS policy, redirect policy, confirmation duration, recovery duration, maintenance windows and escalation assignment. Validation must be variant-specific: no HEAD keyword body assertion; frequency cannot be shorter than the supported execution/overlap policy; ports and DNS query fields required for their variants. Updating headers replaces the collection only when explicitly requested. Never expose secret values in histories or audit payloads.

Scheduler → durable check job with monitor/config version → isolated regional probe → persisted result → evaluator → state transition plus outbox → incident command. Each probe has a run deadline, lease and fencing token. A late result may enrich history but cannot overwrite a newer configuration or resolved generation.

States: pending, healthy, suspect, down, recovering, unknown; pause and maintenance are orthogonal suppression flags. A transport outage in the probe infrastructure yields unknown, not a customer outage. Confirmation uses elapsed time and valid observations, not just a failure count. Recovery requires continuous passing observations for the recovery window; a failed check resets it. Pause/resume starts a fresh evaluation window. Multi-region quorum is explicit and versioned; missing regions do not silently vote healthy.

```json
{"name":"Checkout API","kind":"http","target":"https://example.test/health","http":{"method":"GET","expectedStatuses":[200],"followRedirects":false},"intervalSeconds":60,"timeoutSeconds":10,"regions":["eu","as"],"confirmationSeconds":120,"recoverySeconds":180,"policyId":"pol_1"}
```

`POST /api/v1/workspaces/{w}/monitors` → 201 with `id`, normalized config, `version:1`, `state:"pending"`, `nextCheckAt`. `POST .../monitors/{id}/check-runs` → 202 with run ID; polling returns queued/running/completed/failed. Manual checks do not silently change the recurring schedule. `GET .../checks?cursor=...` exposes regional result, timing, DNS/TLS/HTTP outcome and artifact references.

Edges/tests: DNS rebinding and redirects to private IPs; oversized/decompressed bodies; slow headers/body; expired certificates; 301 loops; ambiguous UDP silence; region outage; duplicate result; stale result after edit/delete; two schedulers; execution longer than interval; maintenance crossing midnight; an outage that starts before a maintenance window. Uptime reporting defines time denominator, unknown/paused/maintenance exclusion and timezone boundaries; do not use a raw percentage of samples as contractual availability.

## 3. Heartbeats and scheduled jobs

Support periodic heartbeats with period/grace and later timezone-aware cron schedules; success/failure/start signals with execution IDs and optional duration. Distinguish never received, currently expected, late/down, recovering, paused and maintenance. Secret heartbeat URLs are write-only capabilities and support rotation.

`POST /api/v1/heartbeat/{token}` with `{"executionId":"backup-20261114","signal":"success","occurredAt":"2026-11-14T00:00:00Z"}` → 202 after durable acceptance. Server receive time controls deadlines unless a documented bounded-lateness policy applies. Duplicate execution does not repeatedly resolve/reopen incidents. Failure can fire immediately; missing signal fires only after deadline plus grace. Race heartbeat arrival against deadline in a transaction. First-deadline semantics are explicit at creation, not inferred from an absent timestamp.

Test clock skew, duplicate start, job running beyond period, overlapping executions, cron DST gaps, delayed network delivery, rotated token, paused deadline and recovery after worker downtime.

## 4. Incoming alerts, normalization and routing

Support generic webhooks, Prometheus/Alertmanager, cloud/third-party sources, email later, and provider-native signature verification. Save bounded raw evidence securely, normalize to event ID/source/dedup key/status/severity/timestamps/labels, and retain parser version. Validate before returning durable acceptance. Expose dead letters and authorized replay.

Routing is ordered and deterministic: source match → metadata match → service/team → severity → policy → grouping/suppression. Define first-match versus cumulative behavior and a fallback. Preview rule matches before activation. Normalize firing/resolved into one alert generation; older resolved messages cannot close a newer firing generation. Grouping merges incident membership without losing the identities or recovery state of individual alerts.

`POST /api/v1/alert-sources/{id}/events` → 202 `{"receiptId":"rcpt_1","duplicate":false}`. Invalid signature → 401; invalid payload → 422; durable store unavailable → 503. A 202 is not proof an incident has already been created. Status polling exposes processing, rejected and dead-letter outcomes.

## 5. Incident response and collaboration

Incident response states: open → acknowledged → mitigating → monitoring → resolved; cancelled is explicit. Reopen increments an incident generation or creates a linked recurrence according to policy. Investigation, remediation and verification have independent states and IDs. Human acknowledgement is an action with actor/time; AI failure cannot unacknowledge a human or restart paging.

Support severity, service/environment, owner/commander, responders, immutable timeline, comments, attachments, evidence, related alerts, merging/unmerging, runbooks, postmortems, action items and reporting. Resolution rules specify whether every attached alert must recover, whether manual resolution overrides firing sources, and how a subsequent firing reopens. Preserve audit when merging; redaction/deletion uses policy-controlled tombstones.

`POST .../incidents/{id}/acknowledgements` with `{"expectedVersion":7}` → 200 with new version and acknowledgement. In one transaction: record acknowledgement, invalidate future escalation generation, append event and outbox. A delivery already accepted by a provider may still arrive; guarantee no newly authorized attempts after the acknowledgement fence rather than promising recall of an in-flight SMS.

`POST .../incidents/{id}/resolution` requires version/reason and records manual/automatic origin. Timeline pagination remains stable under new events. Reports define acknowledgement/resolution durations using lifecycle events, with merged/reopened/missing timestamps treated explicitly. Test concurrent acknowledgements, permission changes, stale buttons, duplicate chat callbacks and recovery while a person is acknowledging.

## 6. On-call scheduling

Model schedule, ordered layers, rotation rules, participants, local timezone, effective date range, overrides, availability and coverage gaps. Support daily/weekly/custom rotations, backup and follow-the-sun layers, calendar export and shift reminders. Fixed elapsed-hour rotation and local-calendar rotation are separate options. Define behavior for spring-forward missing times and fall-back repeated times.

`GET .../oncall/schedules/{id}/coverage?from=...&to=...` returns clipped coverage intervals, responders, contributing layer/override and uncovered intervals. Preview uses the same evaluator as paging. Override creation rejects overlap atomically or uses a documented priority order; concurrent validation alone is insufficient. Membership deletion must preserve history and surface future gaps.

Test exact boundaries, negative offsets before anchor, participant changes, overlapping requests, timezone migration, holidays, nobody available, calendar token revocation and reminder dedup. Snapshot policy configuration at incident creation but resolve schedule recipients at the intended execution time, unless policy explicitly pins the original responder.

## 7. Escalation policies

Policies support ordered steps, delays, individuals/schedules/teams/integrations, acknowledgement stop, retries, repeats, fallback, time/metadata branches, instructions and eventual exhaustion. Detect policy cycles and enforce maximum runtime/repeat limits. Persist assigned policy version, incident generation, branch decision, step and recipient resolution.

Incident event → create run transactionally → durable timer → check incident fence → create recipient attempts → provider dispatch → update receipts → next step. A recipient's failed transport does not count as a successful page. Empty schedule invokes explicit fallback and an operator alert. A disabled/deleted policy has a defined effect on running instances; edits affect new runs unless explicitly migrated.

Test worker restart during timer/send, lease expiry, acknowledgement before send, provider timeout after accepting, schedule handoff, branch missing metadata, fallback cycle and 24-hour system outage. A reconciliation loop discovers incidents missing runs without relying only on recent-created scans.

## 8. Notification channels and provider receipts

Channel catalog: email, Slack, signed webhook, Teams, SMS, voice, push. Differentiate broadcast channels from user contact methods. Verify contacts and track opt-in/unsubscribe where applicable. Voice acknowledgement requires a signed callback/DTMF flow; a call creation response does not acknowledge an incident. Push delivery and critical-alert permissions require supported clients/platform entitlements.

Delivery record states: queued, leased, provider_accepted, delivered, failed_permanent, retry_wait, outcome_unknown, cancelled. Preserve provider message IDs and attempt IDs. Use provider idempotency when available; after ambiguous timeout reconcile before blindly resending. Backoff with jitter, respect Retry-After, bound attempts and expose dead letters. Provider callbacks authenticate raw body/signature, tolerate reordering/duplicates and cannot regress final state.

Example callback-normalized event: `{"attemptId":"att_1","providerMessageId":"msg_1","eventId":"evt_1","state":"delivered","occurredAt":"2026-11-14T00:01:00Z"}`. Receiver webhooks include event ID, timestamp and HMAC over exact bytes; publish verification examples and secret rotation overlap. Retain payload redaction and prevent SSRF through egress policy. Test 400/401/403/408/429/500, redirects, timeout, bounce, invalid number, expired push token and provider outage fallback.

## 9. Status pages and public communication

Support pages, sections, components, monitors/manual components, incident reports, updates, maintenance, history, uptime charts, subscriptions, branding, custom domain/TLS and private access. Public names/descriptions are independent from private monitor targets and internal incident notes. Map multiple monitors to components with an explicit aggregation rule and unknown state.

Monitor transition → transactional component projection + public update intent → queued publication/fanout. Public report lifecycle is separate from internal incident lifecycle; operators choose audience and whether to notify. Scheduled maintenance has start/end, timezone, affected components and notification settings. Domain ownership must be verified before binding; deleted tenants release routes safely and invalidate cache.

`POST .../status-pages/{id}/reports` creates a report with component IDs, impact, title/body and `notifySubscribers`; 201 returns report ID and queued fanout status. Public reads return only published fields. Subscriber enrollment returns a generic response and uses double opt-in, expiring confirmation, distinct unsubscribe capabilities and rate limits. Fanout tracks each recipient and report version.

Test one monitor on two pages, two monitors on one component, partial recovery, edit while fanout runs, repeat subscribe, bounce, unsubscribed-before-send, private-page cache isolation, custom-domain takeover, maintenance overlap and timezone reporting boundaries.

## 10. Telemetry ingestion and collectors

Support OTLP HTTP/protobuf and JSON with documented conformance; add gRPC through a standard collector gateway. Keep JSON/NDJSON HTTP intake, Prometheus scrape/remote-write and log drains behind explicit protocol adapters. Publish limits on compressed/decompressed bytes, events, attributes, nesting, timestamps and cardinality. Tokens identify workspace/source and accepted signal types. Bound queues per tenant and reject before claiming durable acceptance.

Gateway authentication → bounded decode/validation/redaction → durable batch receipt → independent sink consumers → indexed watermark. Store event time and received time, resource and instrumentation scope, trace/span IDs, release/environment and parser version. Redaction rules are versioned and testable. Collector config changes roll out with last-good rollback, heartbeat/version reporting and local disk buffering limits.

Use protocol-native full/partial failure responses. OTLP partial success reports rejected records/data points and reasons; do not encourage a full resend after partial success. Custom batch API returns `{"receiptId":"r1","accepted":98,"rejected":2,"rejections":[{"index":3,"code":"invalid_timestamp"}]}` only after its documented durability boundary. Query visibility may lag acceptance and must be measurable. Arbitrary logs may be delivered more than once; producer event IDs enable stronger dedup where supplied.

Test malformed protobuf, gzip bombs, integer overflow, nanosecond precision, invalid IDs, unsupported metric types, partial sink failure, duplicate retry, expired token, quota exhaustion, out-of-order data, hot tenant and retention race.

## 11. Logs, queries and live tail

Provide time/filter/search queries, structured fields, histogram/facets, surrounding context, saved explorations, links, comments and SQL access later. Exact AST-scoped SQL permissions are required; appending a workspace WHERE clause to arbitrary SQL is unsafe. A separate query service constrains tables/functions, bytes scanned, time and concurrency. SQL connections are scoped credentials rather than application DB credentials.

`POST .../queries` with signal, absolute range, filters, sort and limit → query ID/results/cursor plus scanned bytes, sampling, freshness and truncation. Stable cursor includes event timestamp plus immutable ID; count and page must share an appropriate snapshot/watermark. Cancellation stops backend work. Live tail carries a resume cursor and visible gap markers under backpressure; reconnect cannot silently appear complete.

Test late arrivals, same timestamps, escaping, deleted source, query timeout, quota fairness, stale saved query schemas, empty range, 100k matching events and stream reconnect after token revocation.

## 12. Metrics, dashboards and alert evaluation

Preserve gauge, monotonic/nonmonotonic sum, cumulative/delta temporality, explicit/exponential histogram and exemplars. Series identity includes resource + scope + metric + attributes. Reject or separate conflicting unit/type identities. Compute per-series reset-aware rates before aggregation. Never label a mean as p95/p99. Preserve null/stale/no-data semantics.

Dashboards need versioned layouts/widgets, variables, shared ranges, query validation, permissions, import/export and conflict handling. Templates for RED, host/container/Kubernetes and database metrics should map to documented semantic conventions. Public sharing is a separate explicit access grant.

Alert rules define query/window, evaluation cadence, threshold/relative/anomaly mode, per-series grouping, confirmation, recovery, missing-data action, severity and route. Evaluator state survives restart; query failure means evaluation error, not zero. Add SLO/error-budget burn alerts after reliable counters and availability definitions exist. Anomaly detection requires sufficient history, explainable warmup and deterministic fallbacks.

Test counter sequences with resets and sparse samples; multiple instances restarting independently; histogram bucket merge/unit changes; delta retry; zero traffic; disappearing series; late windows; dashboard version conflicts; duplicate evaluator jobs; missing-data policies; query storage outage and alert storm cardinality.

## 13. Tracing and service topology

Provide trace search, waterfall, parent/child links, events/links, span attributes, logs/errors/session correlation, duration/error analysis, RED metrics and dependency map. Mark incomplete/sampled traces. A service-map edge uses observed client/server relationships with timestamp/confidence, not just service-name co-occurrence. Async messaging needs span links and producer/consumer semantics.

Retain resource/scope metadata and support late spans, orphan parents, clock skew and duplicate spans. Sampling decisions and retention are explicit; derived metrics must account for sampling or disclose bias. Adopt maintained eBPF instrumentation only after testing kernel permissions, TLS blind spots and performance; eBPF cannot guarantee visibility into every encrypted application request.

Test mixed SDK/eBPF duplicates, missing root, cross-tenant trace IDs, fanout, retries, invalid spans, clock skew, streaming response duration, high-cardinality routes and stale topology edges.

## 14. Errors, releases and source maps

Support project/application DSNs, Sentry envelope compatibility as a separately tested protocol, occurrences/groups, users/tags/breadcrumbs, stack symbolication, releases/environments, resolve/ignore/snooze/regression, assignment, issue integrations and spike protection. Current custom `/v1/errors` intake does not alone prove compatibility with existing Sentry SDKs.

Version grouping rules and fingerprints. Preserve raw normalized occurrence and rule version so regrouping can split/merge without destroying history. Event ID dedup prevents inflated counts. Source maps are tied to release + artifact identity, access-controlled, size-limited and parsed safely; missing maps keep the original stack. Regression rules use release ordering/deployment context rather than treating every repeat as a new regression.

Test chained exceptions, minified stacks, non-JS platforms, envelope attachments/compression/limits, malicious source maps, reused release names, repeated event IDs, spike sampling, ignore-next-N under concurrency, late old-release events and deleted-user attribution.

## 15. RUM, replay and analytics

Retain current sessions/users/events/funnels but formalize SDK contracts. Support SPA navigation, session expiry across tabs, anonymous/identified user transitions, Web Vitals via a maintained implementation, custom events, source-tag versioning, release correlation and sampling. Public app keys identify intake; they never authorize reads. Origin restrictions reduce browser abuse but cannot authenticate arbitrary non-browser senders.

Replay should use a maintained DOM recording format after evaluation, ordered compressed chunks, initial snapshots/checkpoints, mutation events and bounded retention. Apply masking/blocking at collection, reinforce server-side policy, and make consent/configuration explicit. Current periodic HTML snapshots offer limited fidelity; label limitations until replaced. Isolate replay on a dedicated origin with restrictive CSP and resource handling; do not allow arbitrary captured scripts/network destinations.

Proposed batch: `{"batchId":"b1","sessionId":"s1","sequence":4,"sdkVersion":"1.0","events":[{"id":"e1","type":"pageview","ts":1794614400000,"url":"https://example.test/cart"}]}` → 202 accepted/duplicate receipt. Dedup precedes session counters. Replay chunks have chunk ID, checksum, sequence and dependencies. SDK retries have storage/size/time limits and observable drops.

Funnels define user vs session unit, ordered steps, conversion window, URL matching, property filters, dedup and sampling. Repeated steps consume distinct event indices. Return capped/approximate flags when query limits apply. Test offline retry, unload/beacon failure, navigation, tab concurrency, consent revoke, password/payment/DOM fixtures, malformed chunks, missing snapshot, cross-origin frames, user erasure, repeated funnel steps and bot traffic.

## 16. AI SRE and remediation

Keep evidence-grounded investigation, sandbox testing and approvals. Add resumable contextual chat, bounded query/tool execution, per-tool scopes, repository/service mappings, scheduled investigation and integrations. Every conclusion links to evidence and confidence; stale/incomplete telemetry is explicit. Treat logs, runbooks and repo text as untrusted inputs. AI cannot grant itself write access through retrieved instructions.

Separate chat run, investigation, remediation attempt, approval and verification. Writes produce a concrete proposed action with authorization, resource version, diff and scope. Approvals bind to the exact artifact digest, repository/head and action; changes invalidate the approval. Provider failures and AI quotas cannot block incident creation, acknowledgement or paging. No direct production mutation by default.

Test provider outage, invalid structured output, malicious telemetry prompt, budget exhaustion, cancellation, replayed tool request, stale approval, head change, duplicate PR create and sandbox escape boundaries. Evaluate explanation accuracy, evidence support and patch correctness separately; a passing model response is not a passing fix.
