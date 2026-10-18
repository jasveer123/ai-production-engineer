# ADR-008 — Human approval before any external write; no production mutation

- **Status:** Accepted
- **Date:** 2026-10-18

- **Decision:** PR creation requires explicit approval, re-checked at execution time. The platform never deploys, rolls back or changes production.
- **Consequences:** Safer, more trustworthy; the "verify" step only observes.
