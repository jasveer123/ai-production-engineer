# CI and enforcement

| Job | Blocking | What it checks |
| --- | --- | --- |
| `typescript` | yes | format, lint, typecheck, unit and e2e tests |
| `python` | yes | ruff, mypy, pytest, evaluation harness |
| `secrets` | yes | gitleaks over full history |
| `boundaries` | yes | import rules in `.dependency-cruiser.cjs` (`pnpm boundaries`) |
| `pr-title` | yes | PR title follows Conventional Commits (commitlint) |
| `docker-build` | yes after 1 week green | builds api, web, migrate, ai-worker images without pushing, plus an api module-load smoke test |
| `knip` | no | unused files, exports, dependencies (`pnpm knip`); report in the job summary |
| `e2e` | no | Playwright, only when web/api/packages change and `apps/web/playwright.config.ts` exists |

## Import boundaries

Rules: no circular imports; `packages/*` never import `apps/*` or `services/*`; a feature in
`apps/web` imports another feature only through its `index.ts`. Existing violations are recorded in
`.dependency-cruiser-known-violations.json`; new ones fail CI. When you fix some, regenerate with
`pnpm boundaries:baseline` so the file only shrinks. The goal is an empty file.

## Commits

Conventional Commits (`feat:`, `fix:`, `ci:`, ...). A husky `commit-msg` hook checks locally; CI checks the PR title.

## Making the non-blocking jobs blocking

- `docker-build`: mark required in branch protection after a week of green runs.
- `knip`: after the first cleanup PR brings the report to zero, drop `continue-on-error` and require it.
- `e2e`: once the web owners add `playwright.config.ts` and stable tests, drop `continue-on-error` and require it.

## Deploy

Pushes to `main` deploy automatically when CI succeeds (`workflow_run`). A manual
**Actions > Deploy > Run workflow** run deploys the selected ref only if a successful CI run exists
for that exact commit; otherwise the `ci-green` job fails and nothing is published.
