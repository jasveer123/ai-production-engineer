# API layer

## Decision

The browser never talks to the NestJS API directly. It calls Next.js route handlers under `/api/*`, and those forward to the API. This is a backend-for-frontend (BFF) proxy.

- The NestJS service (`site-engineer/services/api`) is still the one backend. It owns auth, sessions, validation and data. The proxy adds no business logic.
- Cookies are first-party. The browser sees one origin, so there is no CORS, and the API address is never exposed to the page.
- The proxy checks the `Origin` header on every state-changing request. A request from another site gets 403 (CSRF guard).
- It forwards only a short allowlist of request headers, and drops hop-by-hop response headers.
- It rewrites the refresh cookie path from `/auth` to `/api/auth`, so the refresh cookie is sent only to the auth routes.
- OAuth callbacks come back through the proxy: set `OAUTH_CALLBACK_BASE_URL=http://localhost:3000/api` on the API and register `<web>/api/auth/<provider>/callback` with GitHub and Slack.
- The API sees one client for every request unless it trusts the proxy. Set `TRUST_PROXY=1` on the API so rate limits use each user's IP from `x-forwarded-for`.
- We do not use server actions. Server components use `serverHttp`, which calls the API directly and forwards the request cookies.

## Flow

```
Component
  -> hook            features/<name>/hooks          TanStack Query: cache, loading, retries
  -> service         features/<name>/services       one function per endpoint, typed in and out
  -> http client     lib/api/clients                browser-client (same-origin /api) or server-client
  -> request         lib/api/core/create-request    runs interceptors, refreshes on 401, then send
  -> send            lib/api/core/send              fetch, timeout, parse, schema check
  -> proxy           app/api/[...path]/route.ts     lib/bff: origin check, header allowlist, cookie path rewrite
  -> NestJS API
```

Request interceptors run before `send`, response interceptors after a good answer, and error interceptors after any failure. Every failure leaves as an `ApiError`.

## Folders

```
src/lib/api/
  config/        constants.ts (methods, headers, status, error codes and messages), env.ts
  endpoints/     one file per area, e.g. auth.endpoints.ts
  core/          api-error, types, build-url, send, create-request, create-http-client
  methods/       get, post, put, patch, delete, one file each
  interceptors/  request/ and error/
  clients/       browser-client, server-client, refresh-session
  errors/        get-error-message
src/lib/bff/     the /api proxy: constants, env, one file per job
src/app/api/[...path]/route.ts   thin route handler that calls the proxy
src/lib/query/   query client setup, stale times
src/features/<name>/
  services/      calls endpoints
  hooks/         wraps services in TanStack Query
  query-keys.ts  cache keys
  schemas.ts     zod schemas for forms and responses
src/lib/constants/routes.ts   page routes
```

## Rules

- No raw strings for paths, methods, headers, status codes or error codes. Use the constants.
- A component never calls `fetch` or `http` directly. It uses a hook.
- A service never touches React. A hook never builds a URL.
- Pass a zod `schema` to validate a response at the boundary.
- Calls where a 401 is a normal answer (login, register) pass `skipAuthRedirect: true`.
- New area: add `endpoints/<area>.endpoints.ts`, then a service, then hooks.
