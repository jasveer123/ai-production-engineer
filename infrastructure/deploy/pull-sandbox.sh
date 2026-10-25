#!/usr/bin/env bash
# Runs every few minutes on the sandbox host: if the app host published a newer worker bundle, install it.
set -euo pipefail
source /etc/ape/host.env
export AWS_DEFAULT_REGION=$AWS_REGION
LATEST=$(aws s3 cp "s3://$RELEASES_BUCKET/sandbox/LATEST" - 2>/dev/null || true)
[ -z "$LATEST" ] && exit 0
CURRENT=$(basename "$(readlink -f /opt/ape/sandbox/current 2>/dev/null || true)")
[ "$LATEST" = "$CURRENT" ] && exit 0
aws s3 cp "s3://$RELEASES_BUCKET/host/deploy-sandbox.sh" /opt/ape/deploy-sandbox.sh --quiet && chmod +x /opt/ape/deploy-sandbox.sh
/opt/ape/deploy-sandbox.sh "$LATEST"
