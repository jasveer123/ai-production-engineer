# ADR-015 — TypeScript workflows, polyglot activities (resolves D-3)

- **Status:** Accepted
- **Date:** 2026-10-19

- **Context:** The incident workflow orchestrates evidence collection (needs Postgres, the GitHub App, Jaeger, all owned by the NestJS codebase) and model calls (owned by the Python AI worker). D-3 asked whether workflows are written with the TypeScript or Python Temporal SDK.
- **Decision:** Workflows are TypeScript (`packages/temporal-workflows`). Temporal activities are polyglot: evidence, persistence and status activities run in a TypeScript worker (`services/api/src/worker.ts`, task queues `incident` and `evidence`); the model activity `investigate` runs in the Python worker (task queue `ai`). Workflow history carries only IDs and object-storage references; evidence bundles and reports live in S3 (RustFS locally).
- **Consequences:** Each language does what it is good at, and the AI worker never touches the database or GitHub credentials. Activity contracts cross a language boundary, so their input/output shapes are versioned in `workflows/temporal/src/contracts.ts` and mirrored by Pydantic models in the AI worker. Both workers must be running for an investigation to progress; Temporal keeps the workflow durable if either is down.
