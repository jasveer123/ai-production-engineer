COMPOSE := docker compose -f infrastructure/docker/docker-compose.yml
WORKER  := services/ai-worker
PACKAGES := --filter @ape/config --filter @ape/api-contracts --filter @ape/temporal-workflows
SERVICES ?=
MODELS ?= scripted:reference
REPEAT ?= 1

.PHONY: setup up down logs ps migrate seed dev test lint typecheck format clean eval boundaries

setup:
	pnpm install
	pnpm $(PACKAGES) build
	cd $(WORKER) && uv sync
	@for f in services/api services/ai-worker services/sandbox-manager apps/web; do \
	  [ -f $$f/.env ] || [ ! -f $$f/.env.example ] || cp $$f/.env.example $$f/.env; done
	@echo "Setup done. Next: make up && make migrate && make seed && make dev"

up:
	$(COMPOSE) up -d --wait $(SERVICES)
	@echo "Temporal UI  http://localhost:8233"
	@echo "Jaeger UI    http://localhost:16686"
	@echo "S3 console   http://localhost:9001"

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

migrate:
	pnpm --filter @ape/api db:migrate

seed:
	pnpm --filter @ape/api db:seed

dev:
	pnpm $(PACKAGES) build
	@trap 'kill 0' INT TERM; \
	pnpm --filter @ape/web --filter @ape/api --parallel run dev & \
	(until curl -sf localhost:4000/health >/dev/null 2>&1; do sleep 1; done; cd services/api && node --watch dist/worker.js) & \
	(cd $(WORKER) && uv run python -m ai_worker.main) & \
	(cd $(WORKER) && uv run python -m ai_worker.temporal_worker) & \
	(cd services/sandbox-manager && pnpm dev) & \
	wait

test:
	pnpm $(PACKAGES) build
	pnpm -r run test
	pnpm --filter @ape/api test:e2e
	cd $(WORKER) && uv run pytest -q
	cd packages/sdk-python && uv run --group dev pytest -q

eval:
	cd $(WORKER) && uv run python -m ai_worker.evaluation run --models $(MODELS) --repeat $(REPEAT)

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

boundaries:
	pnpm boundaries

clean:
	$(COMPOSE) down -v
