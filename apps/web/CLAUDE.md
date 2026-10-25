# web

Next.js product UI. Auth, integrations, logs, members, audit and account pages call the NestJS API (`src/lib/api.ts`, TanStack Query, session cookie). Other pages still use fixture data under `src/features/*/fixtures.ts`; `LIVE_ROUTES` in `components/shell/nav-config.ts` lists the live ones.

Every change in this folder follows the frontend standards in AGENTS.md:

@AGENTS.md

Project facts:

- Next.js 15 App Router, React 19, TypeScript strict, Tailwind CSS 4, TanStack Query, pnpm workspace package `@ape/web` on port 3000.
- `(auth)` holds sign-in pages; `(app)` is wrapped in `AuthGate` (`features/auth/session.tsx`), which provides the user, workspace and role.
- Design tokens live in `src/app/globals.css` (light and dark under `data-theme`). Use the Tailwind color names mapped there (`bg-surface`, `text-ink`, `text-brand` …), never hex values.
- Tests are plain `node --test` files (`*.test.ts`) for pure logic; keep tested modules free of runtime imports from Next or React.
- Checks: `pnpm --filter @ape/web typecheck`, `lint`, `test`, `build`.
