#!/usr/bin/env bash
set -euo pipefail
source /srv/ape/host.env
cd /srv/ape
STAMP=$(date -u +%Y-%m-%dT%H%M%SZ)
docker compose --env-file .env -f compose.prod.yml exec -T postgres pg_dump -U ape -d ape --no-owner \
  | gzip | aws s3 cp - "s3://$ARTIFACTS_BUCKET/backups/ape-$STAMP.sql.gz"
echo "backup ape-$STAMP.sql.gz uploaded"
