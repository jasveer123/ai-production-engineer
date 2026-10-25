# Code standards

How code in this repository is written and reviewed. Formatting is automatic (Prettier, Ruff
format) and not discussed here. These rules are about structure, clarity and safety. They come from
studying Langfuse, Sentry, next-enterprise, brocoders/nestjs-boilerplate and the FastAPI full-stack
template, and from what has gone wrong in this codebase.

Review rule: judge new and changed code. Do not demand unrelated cleanup. A new violation is fixed
before merge unless an owner approves an exception in the pull request.

## 1. Structure

- **Group by feature, not by kind.** `features/incidents/{components,hooks,api}`, not top-level
  `components/`, `hooks/`, `api/` folders for everything. Shared primitives live in
  `components/ui` and `lib/`.
- **One responsibility per module.** A file over 400 lines (300 in `apps/web`) or a function over
  80 lines (120 for a React component) is split or justified. ESLint warns; the count only goes down.
- **Dependencies point inward.** `features` may import `components/ui`, `lib`, `packages/*`.
  Nothing imports from another feature's internals; go through its `index.ts`. Packages
  (`packages/*`) never import from `apps/*` or `services/*`.
- **Public surface by barrel.** Each feature or Nest module exposes a small `index.ts`. Importing a
  deep path from another module is a review comment.
- **Contracts are shared, not copied.** Request and response shapes live in `packages/api-contracts`
  as Zod schemas and are used by both the API and the web app.

## 2. Functions and files

- One level of abstraction per function. The exported function reads as a list of named steps.
- Early returns over nesting (max depth 4). Complexity under 15 (12 in the web app).
- At most 5 parameters (4 in the web app). More means an options object with a named type.
- Return results instead of mutating inputs. Mutate only clearly owned local state.
- No dead code, commented-out code or unused exports. `pnpm knip` lists them.
- Names say what a thing is: `findOpenIncidents`, not `getData`. Booleans read as questions
  (`isResolved`, `hasCode`). No abbreviations except well-known ones (`id`, `url`).
- Comments explain why, not what. A comment that restates the code is deleted.

## 3. TypeScript

- `strict` and `noUncheckedIndexedAccess` stay on. No `any` (lint error), no `@ts-ignore`; use
  `unknown` and narrow, or `@ts-expect-error` with a reason and a ticket.
- Validate every untrusted input at the edge with Zod (HTTP bodies, queue messages, webhooks,
  environment). Inside the boundary, trust the types.
- Prefer discriminated unions and `satisfies` over optional-field soup. Model states, not flags.
- `import type` for type-only imports. No default exports except where a framework requires them.
- No `console.log` in services; use the logger. `console.warn/error` only in scripts.

## 4. React and Next.js (`apps/web`)

- Fetch data in hooks (TanStack Query) under `features/*/api`, never inside presentational
  components. Query keys come from one factory per feature.
- Server state lives in TanStack Query. Local UI state in `useState`. A store only for state shared
  across distant components. Never mirror server state into a store.
- Forms: `react-hook-form` with the Zod schema from `api-contracts` as the resolver.
- Do not use effects to compute derived state or react to user actions. Effects are for external
  systems (subscriptions, browser APIs) and always clean up.
- One exported component per file, named like the file; props type is `<Name>Props`.
- Accessibility is part of done: every control reachable by keyboard, labelled, visible focus,
  correct roles. Use Radix-based primitives (shadcn) for dialogs, menus, popovers, tooltips and
  selects instead of hand-rolled ones.
- Every route has loading, empty and error states. Errors render a recoverable message with a
  correlation id, never a stack trace.
- No component fetches with raw `fetch`; use `lib/api` so errors, auth and retries behave the same.

## 5. NestJS API (`services/api`)

- Layering: controller (HTTP only, DTO in, DTO out) → service (business rules) → repository or
  Drizzle queries (data). Controllers hold no business logic; services hold no HTTP types.
- Constructor injection only. No `new Service()` inside other services; no service locators.
- Every endpoint declares its Zod schema, its auth guard and its role. Default is deny.
- Every query that touches tenant data filters by workspace id in the query itself, and a test
  proves another workspace cannot read it (`tenant-isolation.e2e-spec.ts` is the model).
- Errors: throw typed domain errors; one filter maps them to the response shape with a
  correlation id. Never leak internals or stack traces to clients.
- Database: migrations are forward-only and backwards compatible for one release (add, then use,
  then remove). No `SELECT *`. Add an index with every foreign key you filter on. Batch to avoid N+1.
- Long or external work goes to Temporal activities, not request handlers. Activities are
  idempotent and carry timeouts.
- Config comes from the validated environment schema (`packages/config`). No `process.env` reads
  outside it.

## 6. Python (`services/ai-worker`)

- Fully typed (`mypy --strict`). Pydantic models at every boundary. No `Any` in signatures.
- Ruff rule set in `pyproject.toml` is the baseline (bugbear, simplify, security, performance,
  naming, complexity 12). Exceptions are per-file with a reason.
- Anything that calls a model goes through the gateway (`llm/gateway.py`). Prompts live in
  `prompts/` as versioned files, never inline strings. A prompt or model change is accepted only
  with an eval run (`make eval`) that does not regress.
- Model output is untrusted. Validate it with a schema, ground every claim in evidence, and keep the
  guardrails deterministic and tested.
- Async code never blocks the loop; blocking SDK calls go through `asyncio.to_thread`.

## 7. Errors, logging, observability

- Fail fast at startup on bad configuration; fail loudly and specifically at runtime. Never swallow
  an error silently. An empty `catch` needs a comment saying why it is safe.
- Log structured events with a correlation id, never secrets, tokens or full request bodies.
  Redaction happens before data is stored or sent to a model.
- New code paths that can fail in production get a trace span or a metric. A new background job has
  a health signal.

## 8. Security

- Treat all external input as hostile: HTTP, webhooks, logs, repository content, model output.
- Secrets never enter Git, logs, prompts or error messages. Use the secret store; gitleaks runs in CI.
- Least privilege: each service and role gets only the permissions it uses. New AWS permissions
  are justified in the pull request.
- Outbound requests to user-supplied URLs go through an allow-list and block private ranges.
- Dependencies are pinned by lockfile and updated by Dependabot; a new dependency needs a reason.

## 9. Testing

- Every bug fix lands with a test that failed before the fix.
- Pyramid: many unit tests (pure logic), fewer integration tests (database, Temporal), a handful of
  end-to-end flows. Tests are deterministic: no sleeps, no real network, no clock dependence.
- Test behaviour, not implementation. Name tests after the behaviour ("opens one incident for
  repeated errors").
- Shared packages (`api-contracts`, `config`) have unit tests for their schemas.
- Frontend: component tests with Testing Library for logic-heavy components; Playwright for the
  critical journeys (sign up, send data, see incident, approve fix).
- Flaky tests are fixed or deleted within a week. `main` stays green.

## 10. Git and delivery

- Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`). One logical
  change per pull request, small enough to review in 20 minutes.
- Pull requests explain what and why, list risk and rollback, and link the decision record when a
  design choice was made. Architecture changes add or update an ADR in `docs/architecture/`.
- CI must pass before merge. Deploys happen from `main` only, and every release is reversible.
- Definition of done: code, tests, types, lint, docs, observability, security reviewed, and the
  feature works on the live environment.
