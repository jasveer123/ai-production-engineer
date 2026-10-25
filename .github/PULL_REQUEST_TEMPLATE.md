## What and why

<!-- One or two sentences. Link the issue or decision record. -->

## Risk and rollback

<!-- What could break? How do we undo it? Migrations must stay backwards compatible for one release. -->

## Checklist

- [ ] Tests added or updated (a bug fix has a test that failed before)
- [ ] `pnpm lint`, `pnpm typecheck` and tests pass locally
- [ ] No new lint warnings; no `any`, no secrets, no console logging
- [ ] Docs or ADR updated if behaviour or architecture changed
- [ ] Tenant data access is workspace-scoped (if touched)
- [ ] Prompt or model change: `make eval` run and attached (if touched)
