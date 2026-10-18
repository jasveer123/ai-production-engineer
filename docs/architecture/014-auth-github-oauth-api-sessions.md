# ADR-014 — GitHub OAuth with API-issued sessions (resolves D-2)

- **Status:** Accepted
- **Date:** 2026-10-19

- **Context:** Users log in with GitHub. Authorization (RBAC, tenant scope) lives in the NestJS API. Options were Auth.js in Next.js or sessions issued by NestJS.
- **Decision:** NestJS handles the GitHub OAuth flow and issues a signed JWT in an httpOnly, SameSite=Lax cookie. The JWT carries a session ID, and every request checks the `sessions` row (not revoked, not expired) and the current workspace membership in the database. A dev-only login (`AUTH_DEV_LOGIN=true`, never in production) allows local work before a GitHub OAuth app exists.
- **Consequences:** One place owns identity and permissions, and logout or member removal takes effect on the next request. The web app stays a thin client that calls the API with credentials. Account recovery is delegated to GitHub.
