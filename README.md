# AI Production Engineer

An AI platform that turns production incidents into evidence-backed, reproducible, tested, reviewable fixes, with engineers staying in control.

Planning docs (FRD, system design, build plan) live one level up in [`../PLAN.md`](../PLAN.md) and [`../docs/`](../docs/). Architecture decisions are in [`docs/architecture/`](docs/architecture/README.md).

## Prerequisites

| Tool | Version | macOS install |
|---|---|---|
| Node.js | 22 LTS | `brew install node@22` |
| pnpm | 10 | `corepack enable` |
| uv (manages Python 3.12) | latest | `brew install uv` |
| Docker runtime | Docker Desktop or Colima | `brew install colima docker && colima start --cpu 4 --memory 8` |
| Temporal CLI (optional) | latest | `brew install temporal` |

## Quick start

```bash
make setup    # install deps, create .env files from .env.example
make up       # start Postgres, Redis, Temporal, S3 (RustFS), Jaeger, OTel Collector
make migrate  # create the database tables
make seed     # demo workspace + owner/engineer/viewer users
make dev      # run web, api and ai-worker
```

| What | URL |
|---|---|
| Web dashboard | http://localhost:3000 |
| API health | http://localhost:4000/health |
| API docs (OpenAPI) | http://localhost:4000/docs |
| AI worker health | http://localhost:8000/health |
| Temporal UI | http://localhost:8233 |
| Jaeger UI | http://localhost:16686 |
| S3 console (RustFS) | http://localhost:9001/rustfs/console/ (`ape-minio` / `ape-minio-secret`) |

Open http://localhost:3000 and **create an account**, then create a workspace. Admins invite people from **Members** with a role; the invite link is shown once and emailed. Without `RESEND_API_KEY`, account emails (verify, reset, invite) are printed in the API log. For real GitHub sign-in, create a GitHub OAuth app with callback `http://localhost:4000/auth/github/callback` and set `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` in `services/api/.env`.

### Detecting incidents (Phase 3)

1. **Integrations → OpenTelemetry (Jaeger)**: polls Jaeger every 15 s for error traces of the services on the Services page.
2. **Integrations → Deploy webhook**: copy the URL and signing secret (shown once) into demo-shop as `PLATFORM_DEPLOY_WEBHOOK_URL` / `PLATFORM_DEPLOY_WEBHOOK_SECRET`, then run `pnpm deploy-marker` there.
3. Turn on a demo-shop scenario (see its `BUGS.md`) and run `pnpm load`. Repeated errors collapse into one incident, with deploys on its timeline.

### Verifying recovery (Phase 7)

When the fix's pull request is merged, the incident moves to **monitoring**. The platform waits for a deploy marker whose commit contains the merge commit (send one from demo-shop with `pnpm deploy-marker`), then watches the incident's own error for 30-minute windows after the deploy:

- the same error keeps happening → **needs attention**, with the previous deploy named as a rollback candidate (the platform never rolls back itself);
- no errors, with enough traffic in Jaeger or enough errors expected at the old rate → **resolved**;
- otherwise the window is extended (up to 3), then **verification inconclusive** for a human to decide.

The numbers are on the incident page under *Recovery verification*. Tune with the `VERIFY_*` variables in `services/api/.env` ([ADR-019](docs/architecture/019-recovery-verification.md)).

### Live updates and notifications (Phase 8)

The dashboard updates live over server-sent events (the dot next to the product name says *Live*); if the stream drops it falls back to polling. Under **Settings**:

- **Notifications**: add a Slack incoming webhook or any HTTPS webhook and choose the events (new incident, fix waiting for review, needs attention, resolved, recovery not verified) and a minimum severity. *Send test* checks the channel. Webhooks are signed like the deploy webhook; the secret is shown once.
- **Severity rules** and the **pull request approval** policy (owners only).

See [ADR-020](docs/architecture/020-live-updates-and-notifications.md).

### Measuring quality (Phase 9)

- **Offline:** `make eval` runs the frozen cases in `tests/evaluation/cases/` (S1, S1 with a prompt injection, S1 with a red-herring deploy, S6, and a no-evidence case that should abstain) through the real investigation pipeline and scores them against `tests/evaluation/answer-key.json`. With API keys in `services/ai-worker/.env`, compare models: `make eval MODELS="gemini:gemini-3.6-flash anthropic:claude-opus-5-5 openai:<model>" REPEAT=3`. Without keys it runs hand-written reference answers, which tests the harness (CI does this).
- **Online:** mark each hypothesis *correct / partly / wrong* on the incident page. The **Quality** page combines those verdicts with real outcomes: the funnel from detection to verified recovery, top-1 precision per model, fix validation rate, cost and latency.

See [ADR-021](docs/architecture/021-evaluation-and-model-comparison.md).

### Alerts from any monitoring tool (Phase 10)

**Alerts → Sources**: add Prometheus Alertmanager, Grafana, Sentry, Datadog, generic HTTP JSON, or a heartbeat monitor. Each source shows its URL and a token once, with a ready-to-paste setup snippet. **Alerts → Routes**: ordered rules (first match wins) that filter on title, severity or labels, group alerts into one incident by labels such as `service`, set the severity, or only record. *Test a payload* previews where alerts would go. Heartbeats raise an alert when a job stops pinging. See [ADR-022](docs/architecture/022-alert-sources-routes-and-heartbeats.md) and the product plan in [docs/research](docs/research/incident-io-feature-map.md).

### Accounts and the integrations hub

See [docs/requirements/auth-and-integrations.md](docs/requirements/auth-and-integrations.md) and [ADR-023](docs/architecture/023-accounts-and-telemetry-intake.md).

- **Integrations → Send data**: create the workspace token (shown once), then pick a way. Every setup page has copyable snippets with your URL and token, and turns green when data arrives.
  1. Our packages: [`@ape/agent`](packages/sdk-node/README.md) (Node.js, JS/TS) and [`ape-agent`](packages/sdk-python/README.md) (Python).
  2. OpenTelemetry: `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4000` (protobuf or JSON, gzip).
  3. HTTP API: `POST /v1/logs` and `POST /v1/errors`.
  4. Vector / Fluent Bit: `POST /v1/logs`.
  5. Drains: Vercel and Heroku on `POST /v1/drain`, Render over syslog on port 6514.
- **Integrations → Connect tools**: per tool, *Send alerts to us* (Way 6) and *Let the AI read logs* (Way 7, read-only credentials, tested on save).
- **Logs**: search everything received, e.g. `level:error service:checkout-api "timeout"`.
- Smoke test: `APE_TOKEN=… node packages/sdk-node/examples/send-test-data.mjs`.

**One-click setup** ([ADR-024](docs/architecture/024-one-click-integration-setup.md)): every way and tool has a "Let us set it up" / "Set up automatically" path. It opens setup pull requests (package, OIDC deploy markers), installs the server agent with one command, creates drains in Vercel/Heroku/Render, configures Grafana, Datadog, Elasticsearch and Better Stack from one admin key, and connects Sentry and AWS by approval. For the sign-in flows, register the apps once and fill `SENTRY_*`, `VERCEL_*`, `HEROKU_*` in `services/api/.env`. Cloud tools need public URLs: set `PUBLIC_API_URL` and `PUBLIC_INGEST_URL` (a tunnel works for local testing).

Other targets: `make test`, `make eval`, `make lint`, `make typecheck`, `make format`, `make down`, `make clean` (deletes local data volumes).

## Layout

```text
apps/web/                 Next.js product UI (was business-ai)
services/api/             NestJS control plane
services/ai-worker/       Python FastAPI AI worker (uv project)
services/sandbox-manager/ Isolated job runner (Phase 5)
services/telemetry-gateway/ Go gateway (Phase 11 only)
workflows/temporal/       Temporal workflows (Phase 4)
packages/config/          Zod-validated env config
packages/api-contracts/   OpenAPI + generated types (Phase 1)
packages/ui/              Shared UI components
packages/sdk-node/        @ape/agent: Node.js SDK (Way 1)
packages/sdk-python/      ape-agent: Python SDK (Way 1)
prompts/                  Versioned prompt files
infrastructure/           docker-compose, Terraform, OTel/Grafana config
tests/                    integration, security, load, evaluation
docs/                     ADRs, threat model, runbooks
```

## Local data ports

Postgres `5433` (`ape`/`ape`, db `ape`) · Redis `6380` · Temporal `7233` · S3 API `9000` · OTLP `4317` gRPC / `4318` HTTP (collector → Jaeger).
