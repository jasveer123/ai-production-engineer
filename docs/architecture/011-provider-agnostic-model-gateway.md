# ADR-011 — Provider-agnostic model gateway

- **Status:** Accepted
- **Date:** 2026-10-18

- **Decision:** One gateway interface with Anthropic and OpenAI adapters, enforcing timeouts, token budgets, cost tracking and tracing.
- **Consequences:** Models can be swapped or compared in evals; a small abstraction layer to maintain.
