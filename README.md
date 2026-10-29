# AI Production Engineer

Detects production incidents, investigates them with an AI worker, proposes a validated fix and opens a pull request after human approval.

## Layout

| Folder | Contents |
|---|---|
| `apps/web` | Next.js dashboard |
| `services/api` | NestJS control plane, split into `core`, `modules`, `connectors`, `ingest` |
| `services/ai-worker` | Python investigation worker and its prompts |
| `services/sandbox-manager` | Runs generated tests and patches in isolated containers |
| `packages/api-contracts` | Zod schemas shared by the API and web app |
| `packages/config` | Typed environment validation |
| `packages/temporal-workflows` | Temporal workflow definitions |
| `packages/sdk-node`, `packages/sdk-python` | Agents that send telemetry from customer apps |
| `infrastructure` | Docker, Terraform, deploy scripts, observability |
| `docs`, `tests`, `scripts` | Architecture decisions, evaluation data, helpers |

## Run locally

Needs Node 22, pnpm, Python 3.12, uv and Docker.

```bash
make setup
make up
make migrate
make seed
make dev
```

Web on http://localhost:3000, API on http://localhost:4000, Jaeger on http://localhost:16686.

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm boundaries
make test
```

See `AGENTS.md` for conventions and `CONTRIBUTING.md` for the workflow.
