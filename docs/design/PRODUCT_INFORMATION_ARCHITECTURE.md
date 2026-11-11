# Information architecture

Principle: modules follow the incident lifecycle. Sidebar groups already do (Overview, Respond, Uptime, Observe, Workspace). Keep them. Do not add modules.

| Group | Module | Responsibility | Feeds |
|---|---|---|---|
| Overview | Dashboard | What needs me now | links to Incidents |
| Overview | Ask AI | Question about current state, with evidence | reads every module |
| Respond | Incidents | Lifecycle of a problem | Fixes, Escalation |
| Respond | Fixes | Pull requests Pramaan opened | Incidents |
| Respond | On-call, Escalation | Who is paged and when | Alerts, Incidents |
| Respond | Alerts | Raw signals and routing | Incidents |
| Uptime | Monitors, Heartbeats | Is it answering, did the job run | Alerts, Status pages |
| Uptime | Status pages | What customers see | Monitors |
| Uptime | Services | Per-service health and business impact | Logs, Incidents |
| Observe | Live tail, Metrics, Errors, Real users | Evidence | Incidents, Ask AI |
| Workspace | Integrations, Notifications, Settings | Plumbing and admin | all |

Page anatomy: breadcrumb and title, one-line status strip, primary action top right, content, related links. Detail pages link to the module that feeds them and the one they feed.
Global: command menu (Cmd/Ctrl+K) lists every route and the open incidents.
