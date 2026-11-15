# Implementation progress

| Module | Original problem | Decision | Components | Tested |
|---|---|---|---|---|
| App shell | flat nav, no search | grouped sidebar, mobile menu, command menu | NavList, MobileNav, CommandMenu | browser (sidebar), command menu below |
| All forms | overlay dialogs | inline composer | Drawer* | monitor create in browser |
| Incident detail | tabs hid the narrative | four-chapter story | StoryChapter, IncidentStory | browser |
| All module pages | no state at a glance | status strip | StatusStrip | browser (round one), strip below |
| Ask AI | chat bubbles | investigation view | AssistantPage | below |

## Round three (this pass)

| Item | Result | Verified |
|---|---|---|
| StatusStrip replaces tinted banner | one-line status, inline figures, no tint | tsc, lint, browser (monitors page) |
| CommandMenu (Cmd/Ctrl+K) | pages plus open incidents, arrow keys, Enter | tsc, lint, browser (search, Enter navigates to /heartbeats) |
| Ask AI | question, answer, evidence list, no bubbles | tsc, lint, browser (existing conversation renders question, answer, evidence) |

Open: browser QA of the three items above, sortable tables, URL-persisted filters, shared chart component, status page admin split.

## Round four: foundation and dashboard

| Item | Original problem | Decision | Tested |
|---|---|---|---|
| Tokens and primitives | purple/teal brand, sharp corners, mono uppercase labels, hover lift, glow and grid | zinc neutrals, indigo accent, 0.375rem radius, quiet labels, underline tabs | browser, light and dark |
| Dashboard | three flow cards, integration tiles, hero and a story panel | KPI row, needs-attention table, one-line setup path, usage, source health | browser, light and dark |
| Monitors | cards | dense table with status dot and uptime bar | browser |
| Sidebar and page heading | eyebrow on every page, tinted active item | plain title, neutral active state | browser |
| Removed | OverviewHero, StatusCards, flow cards, TodayStory, MonitorCard, corner-dot decoration | dead after the above | tsc, lint |

Browser-checked pages (light): dashboard, monitors, monitor detail, incidents, incident detail, errors, status pages, integrations, real users, services, on-call, settings. Dark: dashboard, incidents. Not checked: phone width, login pages, public status page, error detail, session replay, alerts, escalation, metrics, notifications, heartbeats, fixes, live tail after the token change.
