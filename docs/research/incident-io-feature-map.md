# Research: incident.io feature map and our build plan

Date: 2026-10-20. Purpose: list every capability of incident.io, compare it with what this
platform already does, and decide what to build, in which order, and where our AI goes further.

## How this was researched (and what was not done)

- **Sources: public material only.** incident.io's docs (docs.incident.io, help.incident.io),
  changelog, blog and product pages, plus third-party reviews, read through web search. The
  build container cannot reach incident.io directly. Claims from incident.io's own marketing are
  marked as vendor-stated where it matters.
- **REA (morluto/rea) was evaluated and deliberately not used on incident.io's app.** REA's own
  disclaimer excludes "copying proprietary software or reproducing its protected code and
  assets" and requires authorization for runtime and browser observation. Decompiling or
  tracing incident.io's logged-in web app would copy their implementation, which we neither
  need nor want. We re-implement *capabilities* (what the product does) from public
  descriptions, with our own data model, code and UI. REA remains useful for its intended
  purpose: analysing artifacts we are authorized to examine, for example our customers' own
  services during an investigation.
- **No UI, copy, branding or assets are taken.** Our UI is our own design system; the product
  is white-label (workspace branding, custom domains for status pages).

## 1. incident.io's product areas

| Area | What it does (public descriptions) |
|---|---|
| **Alerts** | Alert sources (monitoring tools, generic HTTP/webhook, email), alert routes that filter, group and deduplicate alerts, decide whether to escalate and whether to create an incident; auto-cancel escalation when the alert resolves; heartbeat monitors that alert when an expected ping stops (shipped Apr 2026). |
| **On-call** | Schedules (rotations, layers, handovers, working hours), overrides, "cover me" requests sent to everyone on the schedule and turned into an override on accept; escalation paths with levels (schedule, user or Slack channel), per-level timeouts, repeats, round-robin, branches by working hours and priority; hard (page) vs soft (Slack/email/SMS) escalation; iOS/Android app with critical notifications; on-call pay report and pay configuration API; pager-load insights. |
| **Response** | Declare from Slack/Teams/web/API/alerts; one channel per incident; incident lead and custom roles; severities; incident types that scope custom fields and roles; custom fields (select, multi-select, text, numeric, catalog-backed); lifecycle statuses with timestamps; status updates with reminders; private incidents with team-scoped access; announcement rules (post new incidents to channels by condition); call links (Zoom, Google Meet, Teams); follow-ups exported to Jira/Linear; actions/tasks with assignees and due dates; test incidents. |
| **Workflows** | Trigger (incident created/updated, status change, field change, alert...) + conditions + steps (create channel, invite, assign role, send message, escalate, create ticket, update status page, prompt a decision flow, webhooks with signed requests); delays and loops; run on all or only test incidents. |
| **Decision flows** | Admin-built decision trees prompted from a workflow step to guide responders (e.g. "is customer data affected?"). |
| **Post-incident** | Post-incident flow with tasks, assignees and due dates; post-mortem documents with templates and AI-assisted writing; timeline generation; debrief meetings; export (Confluence/Notion/Google Docs). |
| **Status pages** | Public, internal (staff, Slack/email subscriptions) and customer pages (authenticated, per account); components and groups with uptime; incidents and scheduled maintenance; email/RSS subscriptions per page or component; branding and custom domains; status page and widget APIs; maintenance automation. |
| **Catalog** | Typed entries (services, teams, customers, features...) with attributes and relationships, synced from GitHub, Terraform or the API; powers routing, ownership, fields and workflows; catalog graph (beta). |
| **Insights** | Dashboards of MTTx (definitions follow your configured lifecycle timestamps), counts, durations, time spent, pager load by time of day and waking hours, workload per person, scheduled reports; filters by any field. |
| **AI** | AI SRE agent: investigates on declaration (deploys, telemetry, past incidents, code, Slack), proposes cause and fix PRs (vendor-stated); suggested summaries; suggested follow-ups; related incidents; Slack assistant (ask questions about an incident); Scribe (joins Zoom/Meet/Teams calls, transcribes, summarizes into the channel and post-mortem); alert grouping insights. |
| **Platform** | Public REST API and API keys; outgoing webhooks; Terraform provider; SAML SSO; SCIM provisioning; RBAC with custom roles and team-scoped permissions; audit logs; Slack and Microsoft Teams apps; many integrations (Jira, Linear, GitHub, Zoom, Google Meet, Datadog, Grafana, Sentry, PagerDuty/Opsgenie migration...). |

## 2. Gap analysis against this platform

Legend: ✅ have, 🟡 partial, ❌ missing.

| Capability | Status here | Notes |
|---|---|---|
| Error detection from traces (Jaeger) with fingerprint dedup | ✅ | Phase 3 |
| Deploy markers, signed webhooks | ✅ | Phase 3 |
| Generic alert sources (HTTP, Alertmanager, Datadog, Grafana, Sentry, email) | ❌ | Only Jaeger polling today |
| Alert routes, grouping, auto-resolve | 🟡 | Fingerprint dedup only |
| Heartbeat monitors | ❌ | |
| Schedules, rotations, overrides, cover requests | ❌ | |
| Escalation paths, paging, acknowledgement | ❌ | |
| Severity rules | ✅ | Phase 3/8 |
| Lifecycle state machine with history | ✅ | Phase 3; needs configurable timestamps for MTTx |
| Incident roles (lead, comms, custom) | ❌ | |
| Incident types, custom fields | ❌ | |
| Status updates + reminders | ❌ | |
| Private incidents | ❌ | |
| Follow-ups / actions (+ Jira/Linear) | ❌ | Fix PRs exist (Phase 6) |
| Workflow engine + decision flows | ❌ | Temporal is already in place to run them durably |
| Slack / Teams app (channel per incident, slash commands) | 🟡 | Outbound Slack notifications only (Phase 8) |
| Notifications (Slack, signed webhooks) | ✅ | Phase 8 |
| Live dashboard | ✅ | Phase 8 SSE |
| Post-mortems, templates, AI draft, debriefs | ❌ | Timeline + evidence exist to draft from |
| Status pages (public/internal/customer), subscribers, maintenance | ❌ | |
| Catalog (typed entries, ownership, sync) | 🟡 | Services mapped to repos only |
| Insights: MTTx, pager load, workload, reports | 🟡 | Phase 9 Quality page (AI/fix outcomes) |
| AI investigation with cited evidence | ✅ | Phase 4 (evidence guard) |
| AI reproduces the bug and validates a fix in a sandbox | ✅ | Phase 5, **beyond incident.io** |
| Approved, idempotent fix PRs | ✅ | Phase 6 |
| Verified recovery after deploy | ✅ | Phase 7, **beyond incident.io** |
| AI evaluation against an answer key, model comparison | ✅ | Phase 9, **beyond incident.io** |
| AI summaries, suggested follow-ups, related incidents, assistant | ❌ | Gateway and guard exist |
| Call transcription (Scribe-like) | ❌ | Needs meeting-bot integrations |
| Public API + API keys, outgoing webhooks | 🟡 | Signed outgoing webhooks exist; no API keys |
| SSO (SAML/OIDC), SCIM, custom roles | 🟡 | GitHub OAuth + 4 fixed roles |
| Audit log | ✅ | Append-only |
| Mobile app with critical alerts | ❌ | Web push / PWA first |
| Terraform provider | ❌ | |

## 3. Our twist: where the AI goes further

incident.io's AI helps people respond. Ours is built to **close the loop with proof**:

1. **Evidence-guarded analysis** (have): every claim cites collected evidence, invented
   citations are dropped, injections in logs and commits are treated as data.
2. **Reproduce before fixing** (have): a failing regression test in an isolated sandbox.
3. **Validated, approved fix PRs** (have): full suite passes; a human approves; idempotent.
4. **Verified recovery** (have): "resolved" means the error stopped in production after deploy.
5. **Measured quality** (have): offline answer-key evaluation and online outcome metrics.

New AI features to build on the same gateway and guard, each with evidence citations:
- AI triage on every alert: group related alerts, explain *why* they are related, propose a
  severity and owner from the catalog.
- Incident summaries and status-update drafts that cite timeline evidence.
- Suggested follow-ups that link to the evidence and can become tickets or fix PRs.
- Related incidents by fingerprint, service and embedding similarity, with the reason shown.
- Post-mortem first drafts from timeline, evidence, fix and verification data.
- Ask-the-incident assistant (web and Slack) answering only from incident evidence.
- On-call intelligence: noise score per alert route, suggestions to tune or silence.
- Call transcription later (needs meeting-bot integrations and consent handling).

## 4. Build order

Each track is a phase with its own ADR, migrations, tests and UI, in the order below.

| Phase | Track | Scope |
|---|---|---|
| 10 | **Alerts & routes** | Alert sources (generic HTTP JSON, Prometheus Alertmanager, Grafana, Sentry, Datadog payloads), alert routes with filters, grouping and dedup, alert lifecycle (firing/resolved), alert → incident, heartbeat monitors, AI alert grouping explanations |
| 11 | **On-call** | Schedules with rotations/layers and handovers, overrides, cover requests, escalation paths (levels, timeouts, repeats, working-hours branches), paging by email/Slack/webhook/web push, acknowledge/escalate, pager-load data |
| 12 | **Response core** | Roles, incident types, custom fields, status updates with reminders, private incidents, follow-ups/actions, announcement rules, test incidents |
| 13 | **Workflows** | Trigger/condition/step engine on Temporal, decision flows, signed webhook steps, delays |
| 14 | **Slack app** | Channel per incident, `/inc` commands, interactive updates, ask-AI in thread |
| 15 | **Status pages** | Public/internal/customer pages, components, subscriptions (email, RSS), maintenance, white-label branding and custom domains |
| 16 | **Post-incident & AI assist** | Post-mortems with templates and AI drafts, debriefs, summaries, suggested follow-ups, related incidents, assistant |
| 17 | **Catalog & Insights** | Typed catalog with ownership and sync, MTTx/pager load/workload dashboards, scheduled reports |
| 18 | **Platform** | API keys and public API docs, SSO (OIDC/SAML), SCIM, custom roles, Terraform-friendly config, Teams app |

The original Phase 10 (hosting) and Phase 11 (Go gateway) move after these.

## Sources

- [Getting started with On-call](https://docs.incident.io/on-call/getting-started), [Escalations](https://docs.incident.io/on-call/escalations), [Escalations from alerts](https://docs.incident.io/alerts/escalations-from-alerts), [Overrides and cover requests](https://docs.incident.io/on-call/overrides), [Responder guide](https://docs.incident.io/on-call/responder-guide)
- [Incident types](https://docs.incident.io/incidents/incident-types), [Decision flows](https://docs.incident.io/incidents/decision-flows), [Private incidents](https://docs.incident.io/incidents/private-incidents), [Declaring incidents](https://docs.incident.io/incidents/declaring), [Customer updates](https://docs.incident.io/incidents/customer-updates)
- [Status pages overview](https://docs.incident.io/status-pages/overview), [Status page APIs](https://docs.incident.io/status-pages/api), [Internal vs public subscriptions](https://docs.incident.io/status-pages/internal-vs-public-subscriptions)
- [Insights supported measures](https://docs.incident.io/insights/supported-measures), [How incidents are measured](https://docs.incident.io/insights/how-we-measure-incidents)
- [Scribe](https://docs.incident.io/ai/scribe), [Slack assistant](https://docs.incident.io/ai/slack-assistant), [AI SRE blog](https://incident.io/blog/how-it-feels-to-run-an-incident-with-ai-sre), [What is AI SRE](https://incident.io/blog/what-is-ai-sre-complete-guide-2026)
- Changelog: [Heartbeat monitoring](https://incident.io/changelog/heartbeat-monitoring), [Post-mortems upgrade](https://incident.io/changelog/post-mortems-upgrade), [More powerful workflows](https://incident.io/changelog/more-powerful-workflows), [Mobile overrides](https://incident.io/changelog/manage-schedules-and-overrides-from-your-mobile), [Private incidents for teams](https://incident.io/changelog/private-incidents-for-teams)
- Third-party: [spike.sh overview](https://spike.sh/blog/what-is-incidentio/), [vigileshq review](https://vigileshq.com/blog/incident-io-review), [Augment Code AI incident tools](https://www.augmentcode.com/tools/ai-incident-management-software)
- [REA disclaimer](https://github.com/morluto/rea/blob/main/DISCLAIMER.md)
