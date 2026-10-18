# ADR-001 — Multi-runtime modular backend

- **Status:** Accepted
- **Date:** 2026-10-18

- **Context:** The product mixes product APIs, AI workloads, long-running workflows and high-volume data. A single language fits some of these poorly.
- **Decision:** TypeScript + NestJS for the product API; Python + FastAPI for AI; Temporal for orchestration; PostgreSQL as the source of truth.
- **Consequences:** Two languages to maintain. Needs strict service boundaries, versioned contracts (OpenAPI) and good observability. Keep the number of deployables small.
