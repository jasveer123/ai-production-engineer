# Product audit

Scope: every route under `apps/web/src/app`. Source: code read plus the pages exercised in a real browser earlier in this program. Not verified: phone-width layouts, screen-reader behaviour, and live competitor products (see REDESIGN_ROADMAP).

Product: Pramaan, an AI production engineer. Logs in, AI root cause, drafted fix, human approval, verification. Users: on-call engineers (act fast), engineering leads (review fixes, set policy), workspace owners (team, tokens, limits).

## Route inventory

| Route | Purpose | Primary action | Verdict |
|---|---|---|---|
| /dashboard | Is anything wrong, what next | Open an incident | Keep. Needs denser header, less decoration |
| /assistant | Ask about workspace state | Ask a question | Redesign as investigation view |
| /incidents | List and triage incidents | Open one | Keep table, add sort and saved filters |
| /incidents/[id] | Story from detection to proof | Approve fix | Keep. Strongest page |
| /fixes | Track fix pull requests | Open PR | Keep, add filters |
| /oncall | Who is reachable | Add schedule, swap | Keep |
| /escalation | Who is paged, in what order | Add policy | Keep |
| /alerts | Alert feed, log alerts, sources, routes | Connect source | Tabs fine; routes tab needs plain language |
| /monitors, /monitors/[id] | Uptime checks | Add monitor | Cards for few, table for many |
| /heartbeats | Cron and job checks | Add heartbeat | Keep |
| /status-pages | Public status | Post update | Move editing to a detail view |
| /services | Per-service health and impact | Open logs | Keep table |
| /live-tail | Search logs | Filter | Keep |
| /metrics | Dashboards of numbers | Add chart | Keep |
| /errors, /errors/[id] | Grouped error issues | Assign, resolve | Keep |
| /rum, /rum/sessions/[id] | Real-user sessions and replay | Replay a session | Keep |
| /integrations, /integrations/[id], /docs/* | Connect apps | Copy snippet | Keep |
| /notifications | Where messages go | Add channel | Keep |
| /settings | Team, tokens, usage, audit | Invite | Keep |
| /status/[slug], by-domain, status-subscription | Public pages | Subscribe | Keep |
| /login and the other (auth) routes | Account access | Sign in | Keep |
| /design-system | Dev showcase | none | Dev only |

## Cross-cutting findings

- Forms: all 15 create and edit flows are inline panels now (no overlays). Delete is an inline confirm.
- Headers: every page now opens with a tinted status banner (added in the previous round). It adds colour and height without adding information density. See UX_PROBLEMS U-01.
- No global search or command menu.
- Tables lack sorting, column control and persistent filters.
- Charts are hand-built SVG or div bars with no shared chart component.
- The AI view is a chat transcript with message bubbles.
