#!/usr/bin/env bash
# Runs every few minutes on the app host (systemd timer). If CI published a new release image,
# unpack it and deploy. Nothing outside AWS holds AWS credentials; the host only needs a read-only
# GitHub token for pulling images.
set -euo pipefail
cd /srv/ape
source host.env
export AWS_DEFAULT_REGION=$AWS_REGION
exec 9>/run/ape-pull-deploy.lock
flock -n 9 || exit 0

get() { aws ssm get-parameter --name "/ape/prod/$1" --with-decryption --query Parameter.Value --output text 2>/dev/null || true; }
OWNER=$(get GHCR_USER); TOKEN=$(get GHCR_TOKEN)
if [ -z "$OWNER" ] || [ "$TOKEN" = "unset" ] || [ -z "$TOKEN" ]; then
  echo "GHCR_TOKEN is not set yet; nothing to pull"; exit 0
fi
echo "$TOKEN" | docker login ghcr.io -u "$OWNER" --password-stdin >/dev/null

IMAGE="ghcr.io/$OWNER/ape-release:latest"
docker pull -q "$IMAGE" >/dev/null || { echo "no release image yet"; exit 0; }
DIGEST=$(docker image inspect "$IMAGE" --format '{{.Id}}')
[ "$DIGEST" = "$(cat release_digest 2>/dev/null || true)" ] && exit 0

echo "new release $DIGEST"
rm -rf incoming && mkdir incoming
CID=$(docker create "$IMAGE" /release)
docker cp "$CID:/release/." incoming/
docker rm "$CID" >/dev/null
TAG=$(cat incoming/VERSION)
cp incoming/compose.prod.yml incoming/Caddyfile incoming/otel-collector.yaml /srv/ape/
# mv, not cp: this script may be one of the files, and bash must not see it change in place.
for f in deploy.sh pull-deploy.sh backup.sh; do cp "incoming/$f" "/srv/ape/.$f.new"; chmod +x "/srv/ape/.$f.new"; mv "/srv/ape/.$f.new" "/srv/ape/$f"; done
GHCR_NAMESPACE="ghcr.io/$OWNER" /srv/ape/deploy.sh "$TAG"

# Hand the sandbox worker to the sandbox host through S3 (it has no GitHub token on purpose).
aws s3 cp incoming/sandbox.tgz "s3://$RELEASES_BUCKET/sandbox/$TAG.tgz" --quiet
printf '%s' "$TAG" | aws s3 cp - "s3://$RELEASES_BUCKET/sandbox/LATEST" --quiet
aws s3 cp incoming/deploy-sandbox.sh "s3://$RELEASES_BUCKET/host/deploy-sandbox.sh" --quiet
aws s3 cp incoming/pull-sandbox.sh "s3://$RELEASES_BUCKET/host/pull-sandbox.sh" --quiet
echo "$DIGEST" > release_digest
