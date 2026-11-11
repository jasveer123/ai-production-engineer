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
