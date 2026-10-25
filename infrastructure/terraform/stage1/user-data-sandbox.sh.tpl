#!/bin/bash
# First-boot setup for the sandbox host. Idempotent: safe to re-run.
set -euxo pipefail

dnf install -y docker jq tar gzip
systemctl enable --now docker

NODE=v22.23.4
curl -fsSL "https://nodejs.org/dist/$NODE/node-$NODE-linux-arm64.tar.xz" -o /tmp/node.tar.xz
mkdir -p /opt/node && tar -xJf /tmp/node.tar.xz -C /opt/node --strip-components=1

id sandbox || useradd --system --create-home --home-dir /var/lib/ape-sandbox sandbox
usermod -aG docker sandbox
mkdir -p /opt/ape/sandbox/releases /etc/ape /var/lib/ape-sandbox/work
chown -R sandbox:sandbox /var/lib/ape-sandbox

cat > /etc/ape/host.env <<ENV
RELEASES_BUCKET=${releases_bucket}
AWS_REGION=${region}
ENV
cat > /etc/ape/sandbox.env <<ENV
TEMPORAL_ADDRESS=${temporal_address}
TEMPORAL_NAMESPACE=default
S3_USE_AWS=true
S3_REGION=${region}
S3_BUCKET=${artifacts_bucket}
SANDBOX_WORK_DIR=/var/lib/ape-sandbox/work
ENV

aws s3 cp "s3://${releases_bucket}/host/deploy-sandbox.sh" /opt/ape/deploy-sandbox.sh
aws s3 cp "s3://${releases_bucket}/host/ape-sandbox.service" /etc/systemd/system/ape-sandbox.service
chmod +x /opt/ape/deploy-sandbox.sh
systemctl daemon-reload
docker pull node:22-slim || true
