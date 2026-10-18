# ADR-010 — Evidence-first AI with structured outputs

- **Status:** Accepted
- **Date:** 2026-10-18

- **Decision:** All AI outputs are Pydantic-validated JSON. Every hypothesis must cite existing evidence IDs. Retrieved content is treated as untrusted data. Prompts are versioned in Git, and every model call is traced (Langfuse/OTel).
- **Consequences:** Some answers become "unknown / needs more evidence", which is intended.
