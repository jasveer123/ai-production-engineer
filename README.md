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

Sign in at http://localhost:3000/login with the seeded demo users (`owner@demo.local`, `engineer@demo.local`, `viewer@demo.local`) through the local-only dev login. For real GitHub sign-in, create a GitHub OAuth app with callback `http://localhost:4000/auth/github/callback` and set `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` in `services/api/.env`.

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

Other targets: `make test`, `make lint`, `make typecheck`, `make format`, `make down`, `make clean` (deletes local data volumes).

## Layout

```text
apps/web/                 Next.js dashboard
services/api/             NestJS control plane
services/ai-worker/       Python FastAPI AI worker (uv project)
services/sandbox-manager/ Isolated job runner (Phase 5)
services/telemetry-gateway/ Go gateway (Phase 11 only)
workflows/temporal/       Temporal workflows (Phase 4)
packages/config/          Zod-validated env config
packages/api-contracts/   OpenAPI + generated types (Phase 1)
packages/ui/              Shared UI components
prompts/                  Versioned prompt files
infrastructure/           docker-compose, Terraform, OTel/Grafana config
tests/                    integration, security, load, evaluation
docs/                     ADRs, threat model, runbooks
```

## Local data ports

Postgres `5433` (`ape`/`ape`, db `ape`) · Redis `6380` · Temporal `7233` · S3 API `9000` · OTLP `4317` gRPC / `4318` HTTP (collector → Jaeger).
