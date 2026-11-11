# UX problems

Severity: Critical (cannot complete workflow), High (major IA or usability), Medium (hierarchy or interaction), Low (minor visual).

| ID | Sev | Problem | Where | Fix |
|---|---|---|---|---|
| U-01 | High | Tinted full-width banner on every page costs vertical space and reads as decoration | all modules | Replace with a compact status strip: one line, status dot, inline figures |
| U-02 | High | No way to jump between modules or act globally without the mouse | app shell | Command menu (Cmd/Ctrl+K): navigate, open incident, create |
| U-03 | High | Ask AI is a chat transcript. Answers are prose with source badges, no structure, no confidence, no next action | /assistant | Investigation view: question, answer, evidence list with links, "ask a follow-up" |
| U-04 | Medium | Lists cannot be sorted or have columns toggled | incidents, errors, services | Sortable headers, then column menu |
| U-05 | Medium | Filters reset on navigation | incidents, errors, services | Keep filter in URL |
| U-06 | Medium | Status page admin mixes domain, monitors and posting in one long card | /status-pages | Split into tabs per page |
| U-07 | Medium | Page title block repeats "Workspace · name" eyebrow everywhere | all | Move workspace to header, keep breadcrumb |
| U-08 | Low | Mixed badge, chip and tag styles for the same states | various | One status component |
| U-09 | Low | Phone layout untested | all | Test with browser emulation |
| U-10 | Low | Local test data (Inline test monitor) | monitors | Delete in dev DB |
