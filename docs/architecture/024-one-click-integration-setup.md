# ADR-024: One-click setup for every integration

Status: accepted · Date: 2026-10-22 · Builds on [ADR-023](023-accounts-and-telemetry-intake.md)

## Context

Every integration needed people to copy URLs, tokens and config by hand. Most of that can be done for them with each tool's own API, as long as we never keep more access than we need.

## Decision

| Integration | How it is automated | What we store |
|---|---|---|
| GitHub | Install link carries a signed `state`; GitHub's Setup URL returns to `/integrations/callback/github/` and we connect that installation. | Installation id (as before) |
| Way 1 package | We open a pull request: dependency, preload (`node --require @ape/agent/register`, or `NODE_OPTIONS` in the Dockerfile; `ape_agent.start()` in the Python entry module), `.env.example`. Lockfiles we cannot refresh make it a draft with a checklist. | Nothing |
| Deploy markers | We open a pull request adding a workflow that authenticates with the **GitHub Actions OIDC token**; `/ingest/github-deploys` verifies it against GitHub's keys and maps the `repository` claim to the workspace. | Nothing (no secret exists) |
| Way 4 agent | `curl …/install/agent.sh \| sudo APE_TOKEN=… sh` (systemd, or Docker) and a Kubernetes DaemonSet manifest; the token is an env var or secret, never in a URL. | Nothing |
| Way 5 drains | Vercel (`POST /v1/drains`, via integration sign-in or a pasted token), Heroku (sign-in or API key, then `POST /apps/{app}/log-drains`), Render (`PUT /v1/logs/streams/owner/{id}`). Each uses a fresh ingest token. | Heroku sign-in token only, for picking apps |
| Grafana | Editor token used to create a webhook contact point, prepend a `continue: true` policy route, and find the Loki data source. | The token, for Loki reads (advise a Viewer token) |
| Datadog | API + app key create the `ape` webhook with our auth header. Datadog sign-in needs their partner programme, so keys are pasted. | The keys, for log reads |
| Elasticsearch / Kibana | Admin key used once to create a read-only API key for the log indices and a Kibana webhook connector. | Only the read-only key |
| Better Stack | Global token creates a ClickHouse "connect remotely" connection. Its outgoing webhooks are UI-only. | The connection's credentials |
| Sentry | Public integration: approve in Sentry, exchange the grant, verify the install. One shared webhook (`/ingest/sentry-app`, HMAC with the client secret) is routed by installation to the workspace. Tokens refresh every 8 h. | Access + refresh token |
| CloudWatch | One `aws cloudformation deploy` command: read-only IAM user, SNS topic subscribed to our intake, and a Lambda that posts the read-only key back once to a single-use, 2-hour callback URL. | Only the read-only key |

Every redirect-based flow uses a signed `state` bound to user, workspace and provider (30 minutes), so a callback cannot be replayed into another workspace.

## Consequences

- Operators register a Sentry public integration, a Vercel integration and a Heroku OAuth client once (`.env`). Until then the UI offers the paste-a-key path for those tools.
- The GitHub App needs `Contents: write`, `Pull requests: write`, `Workflows: write`, and the Setup URL set to `<WEB_URL>/integrations/callback/github/` with "Redirect on update" on.
- Cloud tools cannot reach a localhost URL; the UI warns when `PUBLIC_API_URL` / `PUBLIC_INGEST_URL` are local.
- Not automatable today: adding `@webhook-ape` to Datadog monitors, adding the connector to each Kibana rule, Better Stack outgoing webhooks, and running a package manager to refresh lockfiles.
