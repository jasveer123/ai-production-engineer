# ADR-013 — Drizzle ORM for PostgreSQL (resolves D-1)

- **Status:** Accepted
- **Date:** 2026-10-19

- **Context:** The API needs typed queries, migrations and explicit transactions (outbox pattern in Phase 3). Options were Prisma and Drizzle.
- **Decision:** Use Drizzle ORM with node-postgres. The schema is TypeScript in `services/api/src/core/db/schema.ts`; migrations are generated SQL files in `services/api/drizzle/` and applied with `drizzle-kit migrate`.
- **Consequences:** No engine binaries or code generation step, and the SQL stays visible, which suits outbox and locking queries. Fewer batteries than Prisma (no Studio-first workflow). Raw SQL is still allowed in migrations for triggers and constraints Drizzle can't express (for example the append-only audit trigger).
