COMPOSE := docker compose -f infrastructure/docker/docker-compose.yml
WORKER  := services/ai-worker

.PHONY: setup up down logs ps migrate dev test lint typecheck format clean

## First-time setup: install deps and create local .env files from examples
setup:
	pnpm install
	pnpm --filter @ape/config build
	cd $(WORKER) && uv sync
	@for f in services/api services/ai-worker apps/web; do \
	  [ -f $$f/.env ] || cp $$f/.env.example $$f/.env; done
	@echo "Setup done. Next: make up && make dev"

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

## Database migrations (ORM chosen in Phase 1, ADR D-1)
migrate:
	@echo "No migrations yet. Added in Phase 1."

## Run web (3000), api (4000) and ai-worker (8000) together
dev:
	pnpm --filter @ape/config build
	@trap 'kill 0' INT TERM; \
	pnpm --filter @ape/web --filter @ape/api --parallel run dev & \
	(cd $(WORKER) && uv run python -m ai_worker.main) & \
	wait

test:
	pnpm --filter @ape/config build
	pnpm -r run test
	cd $(WORKER) && uv run pytest -q

lint:
	pnpm format:check
	pnpm -r run lint
	cd $(WORKER) && uv run ruff check . && uv run ruff format --check .

typecheck:
	pnpm --filter @ape/config build
	pnpm -r run typecheck
	cd $(WORKER) && uv run mypy src tests

format:
	pnpm format
	cd $(WORKER) && uv run ruff format . && uv run ruff check --fix .

## Stop infra and delete its volumes (destroys local data)
clean:
	$(COMPOSE) down -v
