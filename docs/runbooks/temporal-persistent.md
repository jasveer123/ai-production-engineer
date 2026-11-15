# Persistent Temporal (production Compose)

Production no longer runs `temporal server start-dev`. The `temporal` service in
`infrastructure/docker/compose.prod.yml` uses `temporalio/auto-setup`, backed by the same
PostgreSQL container as the app. On start it creates (or migrates) two databases, `temporal` and
`temporal_visibility`, and registers the namespace from `TEMPORAL_NAMESPACE` (default `default`)
with 7 days of history retention.

## What survives what

| Event | Effect |
| --- | --- |
| `temporal` container restart / image upgrade | Workflows, timers and history are kept (they live in Postgres). |
| Host reboot | Same; Postgres data is on `/srv/ape/data/postgres`. |
| Postgres volume loss | Workflow state is lost together with app data. Restore both from the same backup. |

Back up the `temporal` and `temporal_visibility` databases with the app database
(`pg_dumpall` or one `pg_dump` per database).

## First switch from the dev server

The old dev server kept state in SQLite at `/srv/ape/data/temporal/temporal.db`. That data is not
migrated.

1. Stop new work: `docker compose stop api-worker ai-temporal-worker`.
2. Check running workflows in the old server and let them finish, or accept that they are abandoned
   (incidents stay in the app database; investigations can be restarted from the UI).
3. Deploy the new compose file (`deploy.sh`). The `temporal` service waits for Postgres to be healthy,
   creates the schema and the namespace.
4. Confirm: `docker compose exec temporal temporal operator cluster health --address temporal:7233`
   prints `SERVING`, and `GET /health/ready` on the API shows `temporal: ok`.
5. Start workers again: `docker compose up -d api-worker ai-temporal-worker`.
6. After a week without problems, delete `/srv/ape/data/temporal`.

## Checks

- `GET /health/ready` reports Temporal reachability and latency.
- Postgres connection count: Temporal opens its own pool; keep `max_connections` at 100 or more.
- Memory: `mem_limit` is 640m. If the container is OOM-killed, raise it before anything else.

## Rollback

Put back the previous `temporal` service block (dev server with `--db-filename`) and redeploy.
Workflows started on the Postgres-backed server do not move back.
