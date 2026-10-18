# ADR-002 — Modular monolith + independently scaled workers

- **Status:** Accepted
- **Date:** 2026-10-18

- **Context:** Microservice-per-agent would add huge operational cost before there's any load.
- **Decision:** One NestJS app (control plane) with domain modules; one Python worker app with logical agent roles; a separate sandbox-manager for the security boundary.
- **Consequences:** Simple deployment. Modules can be split later if load, security or ownership requires it.
