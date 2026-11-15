# SRE platform: research, gap analysis, and implementation plan

Research date: 14 November 2026 (India time). Repository baseline: `da0ea87b826b644399ac5fb8e89ad68ec178eca6`.

## Decision

Build a unified observability and incident-response platform, with optional AI investigation and code repair. Keep the Next.js interface, NestJS modular control plane, shared contracts, Python AI workers, and Temporal investment. Repair the reliability path before expanding the product surface. Separate analytical telemetry storage from transactional incident state as volume grows.

The current repository is a substantial prototype. Its module count does not establish operational readiness. The highest risks are lost transitions, inaccurate delivery status, incomplete metrics semantics, incident/AI lifecycle coupling, and unproven recovery after restart. Rewriting everything would discard useful foundations without solving these invariants.

## Read this package

| Document | Purpose |
|---|---|
| [Evidence and gaps](evidence-and-gaps.md) | Current implementation, concrete findings, validation limits, research sources |
| [Module specifications](module-specifications.md) | Required functionality, processing behavior, API examples, and edge cases |
| [Architecture and delivery](architecture-and-delivery.md) | Technology choices, data ownership, migrations, work packages, and release gates |

These documents supersede the older feature map and parity roadmap **for this research**, without rewriting their historical contents. The older documents describe missing features that now have implementations, including RUM, API tokens, releases/source maps, acknowledgements, and SMS/phone adapters.

## Evidence boundary

- **Source verified:** selected repository implementations and contracts were read at the baseline above. This is not a full security audit or proof that every endpoint works.
- **Documented:** current official Better Stack documentation and primary technical specifications were retrieved. Sources are linked in the evidence document and module references.
- **Observed:** the authenticated Better Stack Errors application list was visible. It showed application onboarding, Sentry SDK collection, releases navigation, integrations, and an Autofix entry point. No ingestion or delivery behavior was established by that screen.
- **Blocked:** access to the authenticated incident origin was rejected by the browser permission gate. It was not retried through an alternate browser or REA. Public documentation research remains distinct from this blocked authenticated inspection.
- **REA attempted:** cached REA 6.7.0 ran, inventoried the local API tree, and failed starting its static analysis worker because its macOS ownership helper could not compile through `xcrun`. Its partial inventory is not verified semantic analysis. No valid Better Stack request/response capture was obtained with REA.
- **Runtime unverified:** the selected Jest invocation exited with `connect EPERM 127.0.0.1:50377` before test results. No tests are represented as passed in this package.
- **Proposed:** the target architecture, own-platform API contracts, limits, SLOs, and delivery estimates are design recommendations. They are not claims about Better Stack's private implementation.

It is not possible to establish every proprietary edge condition or private backend design from public documentation and a few screens. This package provides an implementable product specification, a source-backed repair plan, and a precise verification backlog. It does not claim exhaustive reverse engineering or feature parity certification.

## First executable milestone

One workspace creates an HTTP monitor, a controlled outage opens exactly one incident, notification attempts and receipts remain truthful, acknowledgement stops future escalation, recovery resolves the incident after its configured recovery window, and the status page updates. Repeat while restarting every worker and while the provider returns 429/500. Run with AI disabled. This milestone must pass before the platform is trusted to page a real on-call team.

## Recommended sequencing

1. Make incident state, monitor transitions, and notification work durable and atomic.
2. Finish the complete monitoring-to-recovery workflow and operational release gates.
3. Preserve telemetry semantics and introduce a scalable data plane.
4. Complete logs, traces, metrics, alerts, dashboards, and errors.
5. Harden RUM and replay, then extend analytics.
6. Complete AI actions, enterprise controls, integrations, and infrastructure automation.

The full target remains broad. Sequencing is a dependency order, not a proposal to permanently reduce the product to an uptime checker.
