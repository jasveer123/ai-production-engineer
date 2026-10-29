# Guide for AI coding agents

Read `docs/engineering/CODE-STANDARDS.md` before changing code. Short version:

- Group by feature. Keep files under 400 lines and functions under 80. No `any`.
- Validate input with Zod at the edge. Shared contracts live in `packages/api-contracts`.
- API modules live in `services/api/src/{modules,connectors,ingest}/<name>/` with `domain/` (pure logic), `application/` (services), `infrastructure/` (outside systems) and `activities/` (Temporal). `domain/` never imports the other layers.
- Web data goes through TanStack Query hooks and `lib/api`; forms use react-hook-form.
- Every change to tenant data is workspace-scoped and has a test.
- Prompts are versioned files in `services/ai-worker/prompts/`; model changes need `make eval`.
- Never commit secrets, `.env` files, Terraform state or plan files.

Commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm boundaries`, `make test`, `make eval`, `make dev`.
Architecture decisions: `docs/architecture/`. Deployment: `docs/architecture/026-*.md`.
