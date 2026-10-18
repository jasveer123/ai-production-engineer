# ADR-009 — GitHub App (not personal tokens)

- **Status:** Accepted
- **Date:** 2026-10-18

- **Decision:** Integrate via a GitHub App with least-privilege permissions and short-lived installation tokens; read and write paths separated.
- **Consequences:** Scoped, revocable access; requires handling installation webhooks.
