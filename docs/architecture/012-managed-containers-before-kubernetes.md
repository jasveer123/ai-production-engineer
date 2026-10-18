# ADR-012 — Managed containers before Kubernetes

- **Status:** Accepted
- **Date:** 2026-10-18

- **Decision:** Deploy on Docker Compose (VPS) or ECS Fargate. EKS only if orchestration needs justify it.
- **Consequences:** Lower ops burden; Terraform still used for repeatable infra.
