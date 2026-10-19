COMPOSE := docker compose -f infrastructure/docker/docker-compose.yml
WORKER  := services/ai-worker

.PHONY: setup up down logs ps migrate seed dev test lint typecheck format clean

## First-time setup: install deps and create local .env files from examples
setup:
	pnpm install
	pnpm $(PACKAGES) build
	cd $(WORKER) && uv sync
	@for f in services/api services/ai-worker apps/web; do \
	  [ -f $$f/.env ] || [ ! -f $$f/.env.example ] || cp $$f/.env.example $$f/.env; done
	@echo "Setup done. Next: make up && make migrate && make seed && make dev"

## Start local infrastructure (Postgres, Redis, Temporal, S3, Jaeger, OTel Collector)
up:
	$(COMPOSE) up -d --wait
	@echo "Temporal UI  http://localhost:8233"
	@echo "Jaeger UI    http://localhost:16686"
	@echo "S3 console   http://localhost:9001"

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

## Apply database migrations (Drizzle, ADR-013)
migrate:
	pnpm --filter @ape/api db:migrate

## Seed the demo workspace and users (safe to re-run)
seed:
	pnpm --filter @ape/api db:seed

PACKAGES := --filter @ape/config --filter @ape/api-contracts --filter @ape/temporal-workflows

## Run web (3000), api (4000), ai-worker (8000) and the Temporal workers (incident, AI, sandbox).
## The TS worker waits for the API's health check: `nest --watch` rebuilds dist/ on start, and a
## stale dist/worker.js would otherwise start mid-rebuild and crash.
dev:
	pnpm $(PACKAGES) build
	@trap 'kill 0' INT TERM; \
	pnpm --filter @ape/web --filter @ape/api --parallel run dev & \
	(until curl -sf localhost:4000/health >/dev/null 2>&1; do sleep 1; done; cd services/api && node --watch dist/worker.js) & \
	(cd $(WORKER) && uv run python -m ai_worker.main) & \
	(cd $(WORKER) && uv run python -m ai_worker.temporal_worker) & \
	(cd services/sandbox-manager && pnpm dev) & \
	wait

## Unit tests, API integration tests (needs `make up`: Postgres + Temporal) and Python tests
test:
	pnpm $(PACKAGES) build
	pnpm -r run test
	pnpm --filter @ape/api test:e2e
	cd $(WORKER) && uv run pytest -q

lint:
	pnpm format:check
	pnpm -r run lint
	cd $(WORKER) && uv run ruff check . && uv run ruff format --check .

typecheck:
	pnpm $(PACKAGES) build
	pnpm -r run typecheck
	cd $(WORKER) && uv run mypy src tests

format:
	pnpm format
	cd $(WORKER) && uv run ruff format . && uv run ruff check --fix .

## Stop infra and delete its volumes (destroys local data)
clean:
	$(COMPOSE) down -v
