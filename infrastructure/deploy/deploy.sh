#!/usr/bin/env bash
# Deploys image tag $1 on the app host: pull, migrate, start, health-check, roll back on failure.
# Run by pull-deploy.sh after it unpacks a release (GHCR_NAMESPACE=ghcr.io/<owner> in the environment). Migrations only move forward (add columns before using
# them, remove them in a later release), so a rollback only needs the previous images.
set -euo pipefail
TAG=${1:?usage: deploy.sh <image-tag>}
cd /srv/ape
source host.env
export AWS_DEFAULT_REGION=$AWS_REGION

get() { aws ssm get-parameter --name "/ape/prod/$1" --with-decryption --query Parameter.Value --output text; }
opt() { local v; v=$(get "$1" 2>/dev/null || true); [ "$v" = "unset" ] && v=""; printf '%s' "$v"; }

PUBLIC_URL=$(get PUBLIC_URL)
PRIVATE_IP=$(curl -s -H "X-aws-ec2-metadata-token: $(curl -s -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')" http://169.254.169.254/latest/meta-data/local-ipv4)
PREVIOUS=$(cat current_tag 2>/dev/null || true)

write_env() {
  local tag=$1 pg origin
  pg=$(get POSTGRES_PASSWORD); origin=$(get ORIGIN_VERIFY)
  umask 077
  {
    echo "REGISTRY=${GHCR_NAMESPACE:?set by pull-deploy.sh}"; echo "TAG=$tag"; echo "PRIVATE_IP=$PRIVATE_IP"
    echo "ORIGIN_VERIFY=$origin"; echo "POSTGRES_PASSWORD=$pg"
    echo "NODE_ENV=production"; echo "ENV=production"
    echo "DATABASE_URL=postgresql://ape:$pg@postgres:5432/ape"
    echo "REDIS_URL=redis://redis:6379"
    echo "TEMPORAL_ADDRESS=temporal:7233"
    echo "S3_BUCKET=$ARTIFACTS_BUCKET"; echo "S3_REGION=$AWS_REGION"; echo "S3_USE_AWS=true"
    echo "OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318"
    echo "JAEGER_QUERY_URL=http://jaeger:16686"; echo "JAEGER_UI_URL=http://jaeger:16686"
    echo "WEB_URL=$PUBLIC_URL"; echo "PUBLIC_API_URL=$PUBLIC_URL/api"; echo "PUBLIC_INGEST_URL=$PUBLIC_URL/api"
    echo "SYSLOG_ENABLED=false"; echo "AUTH_DEV_LOGIN=false"
    echo "JWT_SECRET=$(get JWT_SECRET)"; echo "SECRETS_ENCRYPTION_KEY=$(get SECRETS_ENCRYPTION_KEY)"
    echo "AI_PROVIDER=anthropic"; echo "AI_MODEL=claude-haiku-5-5"; echo "AI_EFFORT=medium"
    echo "ANTHROPIC_API_KEY=$(opt ANTHROPIC_API_KEY)"
    echo "GITHUB_APP_ID=$(opt GITHUB_APP_ID)"; echo "GITHUB_WEBHOOK_SECRET=$(opt GITHUB_WEBHOOK_SECRET)"
    echo "GITHUB_OAUTH_CLIENT_ID=$(opt GITHUB_OAUTH_CLIENT_ID)"; echo "GITHUB_OAUTH_CLIENT_SECRET=$(opt GITHUB_OAUTH_CLIENT_SECRET)"
    echo "RESEND_API_KEY=$(opt RESEND_API_KEY)"
  } > .env
  local pem; pem=$(opt GITHUB_APP_PRIVATE_KEY)
  if [ -n "$pem" ]; then
    printf '%s\n' "$pem" > secrets/github-app.pem; chmod 600 secrets/github-app.pem; chown 1000:1000 secrets/github-app.pem
    echo "GITHUB_APP_PRIVATE_KEY_PATH=/run/secrets/github-app.pem" >> .env
  fi
}

dc() { docker compose --env-file .env -f compose.prod.yml "$@"; }

healthy() {
  for _ in $(seq 1 40); do
    if curl -fs -H "X-Origin-Verify: $(get ORIGIN_VERIFY)" http://localhost/api/health >/dev/null \
       && curl -fs -H "X-Origin-Verify: $(get ORIGIN_VERIFY)" http://localhost/ -o /dev/null; then return 0; fi
    sleep 3
  done
  return 1
}

write_env "$TAG"
dc pull --quiet
dc up -d postgres redis temporal
for _ in $(seq 1 30); do dc ps postgres --format '{{.Health}}' | grep -q healthy && break; sleep 2; done
dc --profile tools run --rm migrate
dc up -d --remove-orphans

# Config files are bind-mounted, so `up` does not notice edits to them. Reload the proxy without
# dropping connections, and restart the collector only when its file changed.
dc exec -T caddy caddy reload --config /etc/caddy/Caddyfile || dc restart caddy
NEW_OTEL=$(md5sum otel-collector.yaml | cut -d' ' -f1)
if [ "$NEW_OTEL" != "$(cat .otel.md5 2>/dev/null || true)" ]; then
  dc restart otel-collector && echo "$NEW_OTEL" > .otel.md5
fi

if healthy; then
  echo "$TAG" > current_tag
  docker image prune -af --filter "until=168h" >/dev/null || true
  echo "deployed $TAG"
else
  echo "health check failed for $TAG" >&2
  dc logs --tail 60 api web caddy || true
  if [ -n "$PREVIOUS" ] && [ "$PREVIOUS" != "$TAG" ]; then
    echo "rolling back to $PREVIOUS" >&2
    write_env "$PREVIOUS"; dc pull --quiet; dc up -d --remove-orphans
  fi
  exit 1
fi
