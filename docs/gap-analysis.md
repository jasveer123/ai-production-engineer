# Gap analysis — what is left, and what can be automated

_Research date: 2026-10-20. Checked against `PLAN.md` and the code at `main` (c061ba0)._

## 1. Where things stand

| Phase | Status | Notes |
|---|---|---|
| 0–6 | ✅ Built, tested, live-checked | Phase 6 live PR on demo-shop still waiting for the Gemini quota |
| 7 Recovery verification | ✅ Mostly built | Missing: before/after chart, live end-to-end run |
| 8 Product completeness | 🟡 Partly built | Live updates, Slack/webhooks and settings are done. Usage limits, overview metrics and retention are missing |
| 9 Evaluation & hardening | 🟡 Partly built | Eval harness and Quality page are done. Threat model, runbooks, security scans, chaos tests and Grafana are missing |
| 10 Deployment | ❌ Not started | No production Dockerfiles, Terraform is empty, CI does not build or deploy |
| 11 Scale | ❌ Not started (optional) | `tests/load` is empty |
| 12 Portfolio | ❌ Not started | |

`PLAN.md` lives outside the repo (`~/Desktop/sre`), so the cloud session could not tick Phases 7–9. **Fix:** move `PLAN.md` and `docs/01–06` into the repo.

## 2. Gaps inside the "done" phases (7–9)

**Phase 7**
- No before/after error chart on the verification panel (the plan asked for Recharts).
- The full loop (bug → … → merge → deploy → Recovered) and the "unrelated deploy must not show Recovered" check have never run live.

**Phase 8**
- **Usage limits / budgets are missing.** Tokens and cost are recorded in `usage_records`, but nothing blocks a new investigation when a monthly budget or concurrency limit is hit. Sandbox minutes and stored artifacts are not metered.
- The overview page shows counts only. It's missing MTTR trend, investigations this week and AI cost.
- No retention-days setting, and nothing deletes old artifacts or events.
- The "Investigations" menu item still says SOON (placeholder page since Phase 4).
- Email notifications are not built (optional).

**Phase 9**
- `docs/threat-model/` and `docs/runbooks/` are empty folders.
- CI has gitleaks only. Missing: `pnpm audit`, `pip-audit`, Trivy image scan, Dependabot config.
- No API rate limits (per tenant / per integration).
- No automated cross-tenant test that walks **every** route (one tenant-isolation spec exists).
- No chaos test (kill API / workers / sandbox mid-run → nothing lost or duplicated). This was done manually once.
- Platform tracing: spans don't carry `incident_id` / `workflow_id`. No Grafana dashboard.
- Eval results with real models are not in the README yet (quota), and `tests/evaluation/results/` is empty.
- `tests/security`, `tests/integration` and `tests/load` are empty folders.

**Known MVP shortcuts (security debt, written in code comments)**
- GitHub installation claim: an admin picks from unclaimed installations. Production needs the App's setup URL with a signed `state`, so one tenant can't claim another's install (`github.service.ts`).
- Telemetry is matched to workspaces by service name. Production needs per-tenant OTLP tokens (`jaeger.poller.ts`; this is Phase 11).
- Dev login is the only login used locally. GitHub OAuth exists but isn't set up.

## 3. Phase 10–12 — what can be built and tested fully on this Mac

| Item | Local? | How |
|---|---|---|
| Production Dockerfiles (web, api, worker, ai-worker, sandbox-manager): multi-stage, non-root | ✅ | Build and run locally |
| `docker-compose.prod.yml` + Caddy (TLS), the whole platform from images | ✅ | Run it locally as "staging" |
| CI: build images, Trivy scan, push to GHCR | ✅ build/scan; push needs your OK | GitHub Actions |
| Terraform for the chosen host | ✅ write + `terraform validate`/`plan` | `apply` costs money → your OK |
| Separate staging/prod config, secrets from env/secret manager only | ✅ | |
| Postgres backup + **tested restore** script | ✅ | |
| Demo mode: public read-only workspace with pre-run incidents | ✅ | Seed script + read-only role |
| k6 load test + Go telemetry gateway + Redis Streams (+ ClickHouse) | ✅ (optional) | All run in Docker |
| README, diagrams, GIF, release tags | ✅ | Video needs you |

**Decision needed from you (D-5, hosting):** one VPS (Hetzner/DigitalOcean, about $10–20/month, Docker Compose) or AWS (ECS + RDS, about $80+/month). A VPS is recommended for a portfolio. The sandbox needs Docker on the host, which a VPS gives directly. You also need a domain.

## 4. Manual steps today → how to automate them

| # | Manual step now | Automation |
|---|---|---|
| 1 | Edit `demo-shop/api/.env` flag, restart demo-shop | **`make demo SCENARIO=S1`** script: sets the flag, restarts, bumps `SERVICE_VERSION` |
| 2 | Run `pnpm deploy-marker` by hand | Same script sends it automatically with the real git SHA |
| 3 | Run `pnpm load` by hand | Same script generates traffic until the incident appears |
| 4 | Click "Approve reproduction" | **Policy option:** auto-approve reproduction (it only runs in the locked sandbox). PR approval stays human. Off by default |
| 5 | After merging the PR: pull demo-shop, restart, bump version, send deploy marker | **Local deployer:** watches `demo-shop` `main` on GitHub; on a new merge commit it pulls, restarts and sends the deploy marker. After Phase 10: a GitHub Action in demo-shop deploys and sends the marker |
| 6 | Reset the demo (flags off, `db:seed`) | `make demo-reset` |
| 7 | Gemini quota runs out → step fails → click "Investigate further" later | Workflow **waits and retries** AI steps on quota errors (backoff until the reset time) instead of stopping; daily budget shown in the UI |
| 8 | Stale processes / port clashes when restarting `make dev` | `make stop` (kills only this project's PIDs) + `make doctor` (ports, disk space, Docker, keys, migrations) |
| 9 | Disk fills up → everything crashes | `make doctor` warns under 5 GB; `make clean-cache`; the sandbox prunes old dependency images |
| 10 | New migrations after a pull | `make dev` runs `migrate` first |
| 11 | GitHub App: install, then come back and click Connect | Setup URL with signed `state` → GitHub redirects back and connects automatically (also fixes the security debt above) |
| 12 | Running evals by hand | Nightly CI job: scripted eval always; real-model eval weekly when a key secret is set; results committed to the README |
| 13 | Ticking `PLAN.md` | Move it into the repo; each phase PR ticks its own boxes |

Kept manual on purpose: **approving a PR, merging it, and deploying to production** (ADR-008: human approval before any external write).

## 5. Suggested order

1. **Automation + dev reliability first** (makes every later step faster): `make demo`, `make demo-reset`, `make stop`, `make doctor`, migrate-on-start, local deployer, quota-aware retries, move `PLAN.md` into the repo.
2. **Live end-to-end run** of S1 (needs Gemini quota): proves Phases 5–7 for real, with your OK before the PR.
3. **Finish Phase 8 gaps:** budgets and limits, overview metrics, retention job, Investigations page, verification chart.
4. **Finish Phase 9 gaps:** threat model, runbooks, security scans in CI, rate limits, all-routes tenant test, chaos test script, platform tracing + Grafana.
5. **Phase 10 locally:** Dockerfiles, prod compose + Caddy, CI image build/scan, Terraform (validate only), backup/restore, demo mode. Then, with your OK, the real cloud deploy.
6. **Phase 12** packaging. Phase 11 only if you want the scaling story.

## 6. What I need from you

- Hosting choice (VPS or AWS) and a domain, before the real deploy (everything else can be built locally first).
- Whether reproduction may be auto-approved (default: still manual).
- Optional: a Slack incoming webhook URL to test notifications for real; a paid model key later for better eval numbers.
- Rotate the Gemini key you pasted in chat earlier.
