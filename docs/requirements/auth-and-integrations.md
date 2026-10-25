# Requirements: accounts, roles and the integrations hub

Status: accepted, being built · Date: 2026-10-21 · Owner: Jasveer Singh

This document is the brief for three pieces of work done together:

1. Replace the old dashboard (`apps/web`) with the new product UI (`business-ai`), which becomes `apps/web`.
2. Real accounts: register, sign in, password reset, invitations, and role management by admins.
3. A working integrations hub: the 7 ways to send or connect data, the code connections, and our own
   SDK packages for JavaScript/TypeScript and Python.

It lists what was researched, what is required, what is out of scope, and how each requirement is checked.

---

## 1. Research summary

| Topic | What we found | Consequence |
|---|---|---|
| Existing API | NestJS control plane already has DB-backed sessions (JWT cookie + `sessions` row), GitHub OAuth, dev login, 4 roles (`owner > admin > engineer > viewer`), invitations accepted on sign-in, per-route `@MinRole`, tenant guard that returns 404 to non-members, append-only audit log. | Keep all of it. Add password accounts beside it, not instead of it. |
| Existing ingestion | Durable `inbound_events` buffer → processor → incidents. Sources: deploy webhook, Jaeger poller, alert sources (Alertmanager, Grafana, Sentry, Datadog, HTTP, heartbeat). | New error sources (OTLP, SDK, HTTP, drains) feed the same buffer, so dedup, grouping, severity rules and auto-investigation work unchanged. |
| OTLP/HTTP | Endpoints `/v1/traces`, `/v1/logs`, `/v1/metrics`. Body is protobuf (`application/x-protobuf`, default for Python, Go, Java and the Collector) or JSON (`application/json`, JS default). Collector gzips by default. Trace/span ids are hex in JSON and raw bytes in protobuf. | Accept both encodings and gzip. Decode protobuf with a small hand-written decoder for the 4 OTLP messages (no new dependency). |
| Vercel drains | POST JSON array or NDJSON, batches up to 1 MB. Fields: `id, deploymentId, source, host, timestamp(ms), projectId, level(info/warning/error/fatal), message, path, statusCode, requestId, environment, traceId, spanId, proxy{}`. Custom headers are allowed; optional `x-vercel-signature` (HMAC-SHA1 of the body). Trace drains are OTLP/HTTP. | Drain URL carries the token (`?token=`) or the user adds `Authorization: Bearer`. Use `id` as the dedup key. Trace drains point at `/v1/traces`. |
| Heroku drains | `Content-Type: application/logplex-1`, RFC 6587 octet-counted RFC 5424 lines without STRUCTURED-DATA, headers `Logplex-Msg-Count`, `Logplex-Frame-Id` (same on retry), `Logplex-Drain-Token`. Auth is HTTP Basic from the URL. Respond with empty body. | Parse octet framing, use `Logplex-Frame-Id` for idempotency, accept the token as the Basic password or `?token=`. |
| Render log streams | Custom endpoints are syslog over TLS (RFC 5424, `HOST:PORT`) with an optional token field; HTTPS only for listed providers. The wire placement of the token is not documented. | Run a syslog TCP listener (TLS when a cert is configured). Accept the token as an SD-ID (`[TOKEN@41058]`), an SD param `token="..."`, or a leading `token=` in the message. Flagged as "verify with a real Render stream". |
| Vector / Fluent Bit | Vector `http` sink: JSON array, `auth.strategy: bearer`. Fluent Bit `http` output: `format json`, `Header Authorization Bearer ...`, timestamps in `date` (epoch seconds). Both can also speak OTLP. | `/v1/logs` accepts an object, an array or NDJSON, and maps common field names (`message/msg/log`, `level/severity`, `timestamp/time/date/@timestamp`, `service/app/kubernetes.container_name`). |
| Read-only tool APIs (Way 7) | Loki `GET /loki/api/v1/query_range` (LogQL, bearer or basic, optional `X-Scope-OrgID`). Datadog `POST /api/v2/logs/events/search` (`DD-API-KEY` + `DD-APPLICATION-KEY`, per-site host). Sentry `GET /api/0/organizations/{org}/issues/` and `/issues/{id}/events/latest/` (bearer). Better Stack Telemetry: ClickHouse-over-HTTP "connect remotely" endpoint with username/password and SQL. CloudWatch Logs `FilterLogEvents` (SigV4). Elasticsearch `POST /{index}/_search` (`ApiKey` or basic). | One `LogReader` interface, one implementation per tool, credentials in the secret store, every call bounded (time range, 50 lines, 10 s timeout). |
| Password storage | OWASP: memory-hard KDF (Argon2id or scrypt), per-user salt, constant-time compare, generic error on login, lockout or throttle, invalidate sessions on reset, single-use expiring reset tokens stored hashed. | Use Node's built-in `scrypt` (N=2^15, r=8, p=1, 64-byte key), store `scrypt$N$r$p$salt$hash`. Tokens are random 32 bytes, only their SHA-256 is stored. |

---

## 2. Scope

### In scope

- Move `business-ai` to `apps/web` (package `@ape/web`, port 3000) and delete the old dashboard.
- Accounts and roles (section 3).
- Ingest tokens and Ways 1 to 5 (section 4).
- Ways 6 and 7 for Grafana, Datadog, Sentry, Better Stack, CloudWatch, Elasticsearch (section 5).
- Code tab: GitHub App status and deploy webhook (section 6).
- `@ape/agent` (Node.js/TypeScript) and `ape-agent` (Python) packages (section 7).
- Logs page reads real stored logs.
- Members page manages members, roles and invitations for real.

### Out of scope for this round (later work)

- Wiring Overview, Changes, Deploys, Business impact, Incidents, Alerts, Services, Fixes and Quality
  to the API. They keep sample data and show a "Sample data" label. The API endpoints for most of them
  already exist.
- Real email delivery provider. Mail goes through a `Mailer` interface; the dev implementation logs the
  link to the API console. An SMTP/Resend adapter is a config change later.
- Metrics storage. OTLP metrics are accepted (so exporters don't error) and counted, not stored.
- GitLab, Argo Rollouts, SAML/SSO, 2FA.
- Real vendor keys. Every connector is built and unit-tested against recorded payloads; "Test connection"
  works once real keys are entered.

---

## 3. Accounts and roles

### Functional requirements

| ID | Requirement |
|---|---|
| AUTH-01 | A visitor can register with name, email and password. Email is unique case-insensitively. Password is 10–128 characters and not in the common-password list. |
| AUTH-02 | After registering, a user with no workspace is sent to "Create your workspace" and becomes its **owner**. |
| AUTH-03 | A user signs in with email and password. Wrong email and wrong password give the same message. |
| AUTH-04 | After 5 failed attempts the account is locked for 15 minutes; the lock is audited. |
| AUTH-05 | Forgot password sends a single-use link valid for 30 minutes. Using it sets a new password, revokes every session of that user, and signs them in. The response never reveals whether the email exists. |
| AUTH-06 | Signed-in users can change their password (current password required); other sessions are revoked. |
| AUTH-07 | Email verification link is sent on registration. Unverified users can use the app; the UI shows a reminder. |
| AUTH-08 | GitHub sign-in keeps working and links to an existing account with the same verified email. Dev login stays local-only. |
| AUTH-09 | Sign out revokes the session server-side. |
| ROLE-01 | Admins and owners invite people by email with a role. The invite produces a link (`/register?invite=…`) valid for 7 days that pre-fills the email. Pending invites also apply on next sign-in with that email (existing behaviour). |
| ROLE-02 | Admins change roles between viewer, engineer and admin; only owners grant or remove owner; the last owner cannot be demoted or removed (existing rules). |
| ROLE-03 | Admins remove members; access ends on the next request. |
| ROLE-04 | The UI hides or disables actions the user's role cannot do, and the API enforces it regardless. |
| ROLE-05 | Every auth and membership action is in the audit log with outcome. |

### Role matrix

| Capability | Viewer | Engineer | Admin | Owner |
|---|---|---|---|---|
| See incidents, logs, reports, integrations status | ✓ | ✓ | ✓ | ✓ |
| Approve reproduction / pull request, mark AI answers | | ✓ | ✓ | ✓ |
| Connect integrations, create/rotate ingest tokens | | | ✓ | ✓ |
| Invite, change roles (below owner), remove members | | | ✓ | ✓ |
| Grant or remove owner, approval policy | | | | ✓ |

### Non-functional

- Passwords hashed with scrypt; tokens stored as SHA-256 only; constant-time comparisons.
- Session cookie stays `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- Rate limit on `/auth/login`, `/auth/register`, `/auth/forgot-password`: 20 requests per minute per IP.

---

## 4. Sending data (Ways 1–5)

### Ingest tokens

| ID | Requirement |
|---|---|
| ING-01 | A workspace has one or more ingest tokens `ape_live_<32 random chars>`. Only the SHA-256 is stored, plus the last 4 characters for display. |
| ING-02 | The full token is shown once at creation or rotation. Afterwards the UI shows `ape_live_••••abcd`. |
| ING-03 | Admins create, name, rotate and revoke tokens. Revoked tokens stop working within 60 s (lookup cache TTL). |
| ING-04 | A token is accepted from `Authorization: Bearer`, `X-Ape-Token`, HTTP Basic password, `?token=`, or a syslog SD element. |

### Endpoints (public, token-authenticated, on the API at `PUBLIC_INGEST_URL`)

| Endpoint | Accepts |
|---|---|
| `POST /v1/traces` | OTLP/HTTP protobuf or JSON, gzip optional |
| `POST /v1/logs` | OTLP logs (protobuf/JSON) **or** plain JSON object / array / NDJSON (HTTP API, Vector, Fluent Bit) |
| `POST /v1/metrics` | OTLP metrics, counted and acknowledged |
| `POST /v1/errors` | SDK error events (type, message, stack, service, environment, trace id, context) |
| `POST /v1/drain` | Vercel JSON/NDJSON and Heroku `application/logplex-1` (detected by content type) |
| TCP `SYSLOG_PORT` (default 6514) | RFC 5424 syslog, octet-counted or newline framed (Render, rsyslog) |

| ID | Requirement |
|---|---|
| ING-10 | Responses: `202` accepted (OTLP returns `200` with an empty `partialSuccess`), `401` bad token, `413` over 10 MB, `415` unknown content type, `400` unreadable body. |
| ING-11 | Logs are redacted (tokens, passwords, emails, card numbers, keys) **before** storage. |
| ING-12 | Logs are stored per workspace with time, service, environment, level, message, attributes, trace id, span id, host and the way they came from. Retention `LOG_RETENTION_DAYS` (default 7). |
| ING-13 | Spans are stored per workspace (bounded attributes) so the AI can read a full trace even without Jaeger. |
| ING-14 | Error spans with an exception, error/fatal logs with exception attributes, and SDK error events become error events in the ingestion buffer, so they open or join incidents through the existing pipeline. |
| ING-15 | Each (way, service, environment) has a stream record with first/last received time and counts. A way is **receiving** if data arrived in the last 5 minutes, **silent** if it received before but nothing for 15 minutes, **not set up** if never. |
| ING-16 | Heroku `Logplex-Frame-Id` and Vercel `id` make retried deliveries idempotent. |
| ING-17 | The Logs page searches stored logs with `level:error service:x env:prod trace:abc "phrase"`, newest first, paginated, with a per-minute histogram. |

---

## 5. Connecting tools (Ways 6–7)

| ID | Requirement |
|---|---|
| TOOL-01 | Tools: Grafana, Datadog, Sentry, Better Stack, CloudWatch, Elasticsearch. Each card shows two independent switches. |
| TOOL-02 | **Send alerts to us (Way 6)** creates (or re-enables) an alert source of the matching kind and shows its URL, token and a setup snippet once. Turning it off disables the source. Better Stack, CloudWatch (SNS, including subscription confirmation) and Elasticsearch/Kibana get parsers. |
| TOOL-03 | **Let the AI read logs (Way 7)** needs a read-only credential. The form asks only for what that tool needs. Credentials go to the encrypted secret store and are never returned. |
| TOOL-04 | Saving runs a test query. Only a successful test marks the reader connected; errors are shown in plain words. |
| TOOL-05 | During an investigation, every connected reader is queried for the incident's service and time window (first seen − 15 min to last seen + 5 min), at most 50 lines each, 10 s timeout, redacted, and added as evidence. Failures are recorded as coverage gaps, never invented. |
| TOOL-06 | Readers never write to the tool. |

---

## 6. Code and deploys

| ID | Requirement |
|---|---|
| CODE-01 | The GitHub card shows the real GitHub App installation, repositories in scope, and the number of pull requests opened. Connect goes through the existing install flow. |
| CODE-02 | The Deploy pipeline card creates the signed deploy webhook, shows the URL and secret once, and gives a GitHub Actions step. |
| CODE-03 | GitLab and Argo Rollouts are shown as "Coming soon", disabled. |

---

## 7. SDK packages

### `@ape/agent` (Node.js ≥ 18, JavaScript and TypeScript)

- `start({ token, service, environment, endpoint, release })`, reading `APE_TOKEN`, `APE_SERVICE`,
  `APE_ENVIRONMENT`, `APE_ENDPOINT` when not passed.
- Captures uncaught exceptions and unhandled rejections (then keeps Node's default exit behaviour),
  `console.*` output as logs, and `captureException(err, context)`, `log(level, message, attrs)`.
- Tracing: when `@opentelemetry/sdk-node` is installed, sets it up with an OTLP exporter pointed at our
  endpoint and our token; log records carry the active trace and span id.
- Express/Connect error middleware `errorHandler()`.
- Batching (100 items or 2 s), bounded queue (10 000, drops oldest and counts drops), retry with backoff
  on 429/5xx, flush on exit, `flush()` and `shutdown()`. Never throws into the host app.
- Redacts the same patterns as the server before sending.
- Zero required runtime dependencies; ships ESM + CJS + types.

### `ape-agent` (Python ≥ 3.9)

- `ape_agent.start(token=..., service=..., environment=...)` with the same env vars.
- `logging.Handler` attached to the root logger, `sys.excepthook` and `threading.excepthook`,
  `capture_exception()`, `log()`.
- Middlewares: ASGI (FastAPI/Starlette), WSGI (Flask/Django), Django middleware class.
- Optional extra `ape-agent[otel]` configures the OpenTelemetry SDK with our endpoint.
- Background thread batching, bounded queue, retry, `atexit` flush. Standard library only for the core.

---

## 8. Acceptance checks

- `pnpm --filter @ape/api test` and `test:e2e` cover: register → create workspace → owner; login lockout;
  reset flow revokes sessions; invite link → register → role; admin cannot grant owner; token auth on
  every ingest endpoint; OTLP protobuf + JSON + gzip; Vercel and Heroku drains; syslog parsing; error
  log opens an incident; stream status; reader parsers against recorded payloads.
- `pnpm --filter @ape/agent test` and `uv run pytest` in `packages/sdk-python` cover batching, retry,
  redaction and exception capture against a local test server.
- Manual: register in the browser, create a workspace, create a token, run the Node and Python examples,
  see logs on the Logs page and the way tiles turn to Receiving.
