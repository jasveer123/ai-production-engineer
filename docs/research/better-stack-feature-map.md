# Better Stack feature map

_Researched 2026-10-20. Compared against `main` (435556d, Phase 10 alert sources)._

## How this was researched (and what was not done)

- **Public docs** at betterstack.com/docs (product pages, docs navigation and the getting-started
  pages for each product), read on 2026-10-20.
- **Our own Better Stack account** (team t617840): only the product menu, the AI SRE integration
  list and the MCP/API page, read as visible text. These are names of features, not implementation.
- **Not done:** no reverse engineering of Better Stack's web app, bundles or private APIs (REA was not
  used). Their terms of service and REA's own disclaimer rule that out, and so does the rule in
  [incident-io-feature-map.md](incident-io-feature-map.md). We re-implement *capabilities* with our own
  data model, code and UI.
- Where a docs page only names a feature without describing it, this map says "named only".

## 1. What Better Stack is

Five products under one account (top-level menu in the dashboard):

| Product | One line |
|---|---|
| **AI SRE** (chat) | Chat-based assistant that reads your telemetry, incidents and third-party tools, finds root causes, builds dashboards and can open fix PRs |
| **Incidents** | Uptime monitors, heartbeats, on-call schedules, escalation, phone/SMS/push alerts, status pages, post-mortems |
| **Telemetry** | Logs, metrics and traces storage: ingestion, live tail, SQL queries, dashboards, alerts |
| **Errors** | Sentry-SDK-compatible error tracking with grouping, releases, source maps and AI fix prompts |
| **RUM** | Real user monitoring: session replay, web vitals, product analytics, funnels, frontend errors |

The big difference from us: **Better Stack stores the data itself** (it is an observability vendor).
We **read** data from other tools and add what they don't do: reproduce the bug in a sandbox, write a
failing test, validate a patch and open a PR behind two human approvals.

## 2. Feature map

### AI SRE

| Feature | Detail |
|---|---|
| Chat investigations | Ask in the web chat; `@` mention incidents, errors, applications, sources, Slack threads; paste or upload files |
| Data it reads | Own logs, metrics, traces, incidents, on-call schedules |
| Integrations (from our dashboard) | GitHub, GitLab ("connect your codebase"), Sentry ("investigate errors"), Grafana ("query Prometheus metrics and panels"), Datadog ("inspect monitors and search logs"), Linear ("reference issues"), Notion ("look up runbooks") |
| Customize AI SRE | Choose the default model, custom system prompt and "skills" |
| Scheduled tasks | Run AI SRE on a schedule, e.g. "fix your top errors", daily health check |
| Writing code | "Create pull request" from an error (GitHub) or merge request (GitLab); bulk resolving errors |
| Analysis | Analyze incidents, logs, outliers |
| Dashboards | Create dashboards; import Datadog and Grafana dashboards |
| Slack / Teams | Tag `@Better Stack` in a thread to start an investigation |
| MCP server | `mcp.betterstack.com` for Claude Code, Codex, Cursor, ChatGPT, OpenCode: query logs, metrics, traces and errors in natural language |
| SQL API | Query telemetry with SQL over an API |
| AI SRE API | Tokens, Chats API, list models |
| Approvals | Not described in the docs |

### Incidents (uptime, on-call, status pages)

| Feature | Detail |
|---|---|
| Monitor types | HTTP status, keyword, ping, API, DNS, TCP/UDP port, SSL certificate, domain expiration, Playwright (browser), heartbeats; private-network monitoring (most named only) |
| Alert channels | Phone call, SMS, email, push, critical alert (bypasses Do Not Disturb), Slack, Teams |
| On-call schedules | Rotations, preview, calendar view, overrides, shift reminders (email/push/SMS, default 24 h before), external calendar sync |
| Escalation policies | Primary responder → whole team if not acknowledged; fallback steps, delays, time-based rules, conditions on metadata; backup and follow-the-sun schedules |
| Incident management | Post-mortems, metadata and catalog, screening alerts (noise filtering), reporting |
| Status pages | Sections of monitors/heartbeats/third-party services, custom subdomain, password protection, branding, embeddable announcements (subscribers, maintenance and history named only or not covered) |
| Mobile apps | iOS and Android |
| Platform | Incidents API, Terraform provider, SSO, team management, audit logs |

### Telemetry (logs, metrics, traces)

| Feature | Detail |
|---|---|
| Ingestion | Better Stack collector, OpenTelemetry (OTLP + source token as Bearer), Vector (setup script per source, token in URL), HTTP API, Prometheus scraping, Docker, Kubernetes, Nginx, Apache, Ubuntu, Render/Vercel/Heroku log streams, Datadog agent migration |
| Sources | Each source has a **source token** and **ingesting host** |
| Live tail | Stream logs in real time |
| Query | SQL |
| Dashboards | Build dashboards; infrastructure monitoring |
| Alerts | Presence/absence alerts on logs |
| Collaboration | Comment on log lines, share links |
| Transformations | VRL (Vector Remap Language) |
| Tracing | eBPF-based, OpenTelemetry-native |
| APIs | Tokens, sources, dashboards, explorations, alerts, connections, Query API, Usage API |

### Errors

| Feature | Detail |
|---|---|
| Collection | Keep existing **Sentry SDKs**, point them at Better Stack (JS, Python, Go, Ruby, Java, .NET, PHP); JavaScript tag |
| Grouping | Automatic, configurable |
| Releases | Trends and analytics per release |
| Source maps | Upload for readable frontend stacks |
| Spike protection / snooze | Snooze for the next N occurrences, notify if severe |
| AI | Per-error "AI prompt" to paste into Claude Code/Cursor/Codex; MCP access; PR from error (via AI SRE) |
| Workflows | Send to Linear/Jira; acknowledge/resolve from Slack/Teams; escalate to on-call; outgoing webhooks |
| API | Applications, groups, releases |

### RUM

Session replays, web vitals (TTFB, FCP, LCP, JS memory), product analytics, event funnels, frontend
errors correlated with sessions and backend telemetry; installed with a JavaScript tag.

## 3. Comparison with our platform

✅ have · 🟡 partly · ❌ missing · ⚪ not our focus

| Better Stack capability | Us | Notes |
|---|---|---|
| **AI root cause analysis** | ✅ | Evidence-cited report, guard drops uncited claims, injection treated as data |
| **Fix PR from an error** | ✅ **stronger** | We reproduce in a sandbox, require a failing test, validate the patch and need two human approvals. Better Stack docs describe no test or approval gate |
| Recovery verification after deploy | ✅ **ours only** | Phase 7 |
| AI evaluation / quality report card | ✅ **ours only** | Phase 9 |
| GitHub integration | ✅ | GitHub App, least privilege |
| GitLab | ❌ | |
| Sentry / Datadog / Grafana as **alert sources** | ✅ | Phase 10 Alerts page |
| Sentry / Datadog / Grafana as **evidence the AI queries** (logs, metrics, panels) | ❌ | Biggest AI gap: today the AI sees only our Jaeger traces, deploys, alerts and code |
| Linear / Notion (issues, runbooks as evidence) | ❌ | |
| Chat with the AI (ask follow-up questions) | ❌ | Ours is one report per incident, no chat |
| Slack bot (`@mention` to investigate) | ❌ | We only send Slack notifications |
| Customize AI (model, system prompt, skills) | 🟡 | Model is env config; no per-workspace prompt or runbook "skills" |
| Scheduled AI tasks (daily health check, top errors) | ❌ | |
| MCP server for coding agents | ❌ | Good fit: expose incidents, reports and evidence to Claude Code |
| Public API + API tokens | ❌ | Only session-authenticated internal API |
| **Log ingestion and storage** | ❌ | Collector drops logs (`debug` exporter) |
| Per-source ingest token for OTLP | ❌ | Traces matched by service name only (`jaeger.poller.ts`) |
| Live tail, SQL query, dashboards | ❌ | |
| Log alerts (presence/absence) | ❌ | |
| Metrics | ❌ | Collector drops metrics |
| Traces | 🟡 | Jaeger, read-only; no UI of our own |
| Error tracking with Sentry SDK compatibility | ❌ | We group errors from traces by fingerprint; no Sentry-protocol endpoint |
| Releases view | 🟡 | Deploy markers exist; no per-release error view |
| Uptime monitors (HTTP, keyword, SSL…) | ❌ | |
| Heartbeat monitors | ✅ | Phase 10 |
| On-call schedules, escalation, phone/SMS | ❌ | |
| Status pages | ❌ | |
| Post-mortems | ❌ | Report + timeline exist, no post-mortem doc |
| Audit log, roles | ✅ | |
| SSO, Terraform, mobile apps | ❌ / ⚪ | |
| RUM, session replay | ⚪ | Not our focus |

## 4. Proposed build order

Rule: build what makes **our AI fix loop** better first; don't try to become a full observability
vendor. Each step is one PR-sized phase.

| # | Build | Why first | Size |
|---|---|---|---|
| 1 | **Per-workspace ingest tokens for OTLP** + an ingest endpoint in the API (traces and logs) | Fixes the service-name-only security gap; prerequisite for any real customer | M |
| 2 | **Log ingestion + storage + search** (OTLP logs → Postgres for small volume, ClickHouse/Loki later); log lines near failing traces become AI evidence; simple live tail | AI sees the story around the error; covers S2/S5-style bugs | L |
| 3 | **Evidence connectors: Sentry, Datadog, Grafana** (read-only queries during an investigation) | Customers keep their tools; AI gets their logs/metrics without us storing them | M each |
| 4 | **Sentry-compatible error endpoint** (accept Sentry SDK envelopes) | Zero-code onboarding for apps already using Sentry; better stacks than traces | M |
| 5 | **MCP server + public API with tokens** | Lets Claude Code/Cursor read incidents and fixes; cheap to build on existing services | M |
| 6 | **AI chat on an incident + Slack `@mention` bot** | Follow-up questions; meet engineers in Slack | L |
| 7 | **Workspace AI settings**: model choice, extra instructions, runbooks (Notion/Markdown) as evidence | Matches "Customize AI SRE" | S–M |
| 8 | **Scheduled AI tasks**: daily health check, "investigate top recurring errors" | Proactive value, reuses the workflow | M |
| 9 | **Uptime monitors** (HTTP, keyword, SSL expiry) feeding the same incident pipeline | Common ask, simple, extends heartbeats | M |
| 10 | **Status page** (public, read-only, per workspace) | Customer communication | M |
| 11 | **On-call schedules + escalation** (Slack/email first; phone/SMS via Twilio later) | Needed to be an incident tool, but large and well covered by others | L |
| 12 | Post-mortem draft from the timeline + report (AI-written, human-edited) | Builds on data we already have | S |
| — | GitLab, dashboards, RUM, mobile apps, SSO, Terraform | Later or never | — |

Steps 1–2 overlap with items already in [gap-analysis.md](../gap-analysis.md) (per-tenant tokens,
logs pipeline) and should replace them there.

## Sources

- [Better Stack docs home](https://betterstack.com/docs)
- [AI SRE welcome](https://betterstack.com/docs/ai-sre/welcome/)
- [Uptime monitoring start](https://betterstack.com/docs/uptime/monitoring-start/), [Monitor types](https://betterstack.com/docs/uptime/monitor-types/)
- [On-call getting started](https://betterstack.com/docs/uptime/getting-started-with-oncall/)
- [Status pages getting started](https://betterstack.com/docs/uptime/getting-started-with-status-pages/)
- [Log management start](https://betterstack.com/docs/logs/logging-start/), [Ingesting data](https://betterstack.com/docs/logs/ingesting-data/)
- [Error tracking start](https://betterstack.com/docs/errors/start/)
- [Real user monitoring](https://betterstack.com/docs/rum/)
- Our Better Stack dashboard (team t617840): product menu, AI SRE Integrations page, MCP and API page
