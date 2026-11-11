# Better Stack feature parity

Pramaan keeps its own idea: after the problem is found, the AI explains the cause and drafts a fix that a person approves. This roadmap adds the rest of what a team expects from an incident tool.

Feature list source: the Better Stack menus and public docs, read on 2026-11-10. Nothing here copies their code or assets.

Rule for every feature: build it, test it, commit it, then move to the next.

## Modules

### 1. Incidents (response)
| Feature | Status |
| --- | --- |
| Incident list, detail, timeline, status changes | Built |
| AI investigation, ranked causes, evidence | Built (needs AI workers running) |
| Fix proposals, approve, reject, redraft | Built (needs AI workers running) |
| Verification after deploy | Built |
| Alert sources, routes and alert feed (screens) | Built |
| Heartbeats (screens) | Built |
| Monitors (uptime checks) | Not started |
| On-call schedules | Not started |
| Escalation policies | Not started |
| Notifications: Slack, webhook (screens) | Backend built, screens missing |
| Notifications: email | Not started |
| Notifications: SMS, call, push | Not started (needs a paid provider) |
| Acknowledge, comments, post-mortem | Not started |
| Status pages | Not started |
| Reporting | Not started |

### 2. Telemetry
| Feature | Status |
| --- | --- |
| Sources with one token each | Built |
| Collector, one command for Docker and Kubernetes | Built |
| Live tail with chart | Built |
| Services page | Built |
| Log alerts (rules on logs) | Not started |
| Metrics storage and dashboards | Not started |
| Explore logs and traces | Not started |
| Service map | Not started |
| Schema | Not started |

### 3. Error tracking
Not started: applications, errors, releases.

### 4. Real user monitoring
Not started: applications, session replay, users, events, funnels.

### 5. AI SRE
Investigation is built inside incidents. A chat page is not started.

### 6. Settings
Members and invitations backend exists, screens are missing. Usage, API tokens, single sign-on: not started.

## Order
1. Alerts and heartbeats screens
2. Notification channels screens
3. Monitors
4. On-call schedules
5. Escalation policies with email notifications
6. Acknowledge and comments on incidents
7. Status pages
8. Log alerts
9. Metrics and dashboards
10. Error tracking
11. Real user monitoring
12. AI SRE chat
13. Settings: team, usage, API tokens, single sign-on
14. Documentation for each module
