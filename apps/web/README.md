# web

The AI Production Engineer product UI (formerly `business-ai`). Sign-in, workspaces, **Integrations**, **Logs**, **Members**, **Audit log** and **Your account** read and write the real API with the session cookie. The other pages still show sample data and say so in the top bar ("Sample data on this page").

## Run it

```bash
pnpm install
pnpm --filter @ape/web dev        # http://localhost:3000 (API on :4000, see NEXT_PUBLIC_API_URL)
pnpm --filter @ape/web build
```


## Screens

| Route | What it shows |
| --- | --- |
| `/` | Overview: risky changes about to ship, the live deploy guard, open incidents, setup |
| `/changes/` | Every PR scored before it ships, grouped by what needs attention |
| `/changes/[id]/` + `evidence/`, `deploy/`, `comment/` | One PR: explainable risk score, safeguards, business impact, blast radius, every reason with evidence, prediction vs outcome, the GitHub comment |
| `/deploys/`, `/deploys/[id]/` | Rollouts in steps; guardrails old vs new; pause and rollback recommendations (a person decides) |
| `/business/` | Critical flows with users, events and value per hour, and the changes and incidents that put them at risk |
| `/incidents/` | All incidents |
| `/incidents/[id]/` + `timeline/`, `logs/`, `fix/`, `recovery/` | One incident: AI report with evidence, timeline, its logs, the validated fix, recovery check |
| `/alerts/` | Alerts from other tools and the routes that turn them into incidents |
| `/logs/` | Log search (`level:error service:x trace:abc "phrase"`), histogram, live tail |
| `/services/` | Services, their repositories and health |
| `/fixes/` | Every AI fix and its pull request |
| `/quality/` | How well the AI does: funnel, accuracy, cost, guardrails |
| `/integrations/`, `tools/`, `code/` | The 7 ways to send data, How it works, the Way finder |
| `/integrations/[way]/` | Step-by-step setup for ways 1–5 with copyable snippets |
| `/members/`, `/audit/`, `/settings/` | Workspace administration |

## How it is organised

- `src/app/` routes only: thin pages that compose feature components. `(app)` holds the shell layout.
- `src/features/<feature>/` domain types, sample data (`fixtures.ts`), pure logic and feature components. `incidents.ts` and similar files are the data-access seam to replace with API calls later.
- `src/components/ui/` design-system primitives; `src/components/shell/` the sidebar, top bar, theme switch and logo.
- `src/app/globals.css` the design tokens for light and dark. Components use the Tailwind names mapped from them.

Light, Dark and System themes: the choice is stored per browser and applied before first paint, so there is no flash.

Actions that would change data (approve, connect, invite) are disabled with a note, because a static preview must not show fake success.

## Checks

```bash
pnpm --filter @ape/web typecheck
pnpm --filter @ape/web lint
pnpm --filter @ape/web test       # node --test, pure logic
pnpm --filter @ape/web build
```

Coding standards for this folder are in [AGENTS.md](AGENTS.md). Claude Code loads them through [CLAUDE.md](CLAUDE.md), and the `frontend-engineer` agent in `.claude/agents/` uses them.
