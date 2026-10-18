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
make setup   # install deps, create .env files from .env.example
make up      # start Postgres, Redis, Temporal, S3 (RustFS), Jaeger, OTel Collector
make dev     # run web, api and ai-worker
```

| What | URL |
|---|---|
| Web dashboard | http://localhost:3000 |
| API health | http://localhost:4000/health |
| AI worker health | http://localhost:8000/health |
| Temporal UI | http://localhost:8233 |
| Jaeger UI | http://localhost:16686 |
| S3 console (RustFS) | http://localhost:9001/rustfs/console/ (`ape-minio` / `ape-minio-secret`) |

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

Postgres `5432` (`ape`/`ape`, db `ape`) · Redis `6379` · Temporal `7233` · S3 API `9000` · OTLP `4317` gRPC / `4318` HTTP (collector → Jaeger).
