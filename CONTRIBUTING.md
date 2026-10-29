# Contributing

1. Branch from `main`: `feat/…`, `fix/…`, `chore/…`.
2. Run the checks locally: `pnpm lint && pnpm typecheck && pnpm test && pnpm boundaries` and, for the AI worker,
   `cd services/ai-worker && uv run ruff check . && uv run mypy src tests && uv run pytest`.
3. Commit with Conventional Commits and open a pull request using the template.
4. CI must pass. Review follows `docs/engineering/CODE-STANDARDS.md`.
5. Merge to `main` deploys to production automatically; keep changes small and reversible.

Local setup is in `README.md`. Report security issues as described in `SECURITY.md`.
