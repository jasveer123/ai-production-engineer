#!/bin/bash
# First-boot setup for the app host. Idempotent: safe to re-run.
set -euxo pipefail

dnf install -y docker jq cronie
systemctl enable --now docker crond

# 2 GB of RAM is tight for the whole stack: add swap on the root volume.
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile && mkswap /swapfile && echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi
swapon -a || true

mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/download/v5.6.1/docker-compose-linux-aarch64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Data volume (Postgres, Redis, Temporal). Format only when blank.
DEV="/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_${data_volume_id}"
for i in $(seq 1 60); do [ -e "$DEV" ] && break; sleep 2; done
if ! blkid "$DEV"; then mkfs.xfs "$DEV"; fi
mkdir -p /srv/ape/data
UUID=$(blkid -s UUID -o value "$DEV")
grep -q "$UUID" /etc/fstab || echo "UUID=$UUID /srv/ape/data xfs defaults,nofail 0 2" >> /etc/fstab
mount -a
mkdir -p /srv/ape/data/postgres /srv/ape/data/redis /srv/ape/data/temporal /srv/ape/secrets

ACCOUNT=$(curl -s -H "X-aws-ec2-metadata-token: $(curl -s -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')" \
  http://169.254.169.254/latest/dynamic/instance-identity/document | jq -r .accountId)
cat > /srv/ape/host.env <<ENV
RELEASES_BUCKET=${releases_bucket}
ARTIFACTS_BUCKET=${artifacts_bucket}
AWS_REGION=${region}
REGISTRY=$ACCOUNT.dkr.ecr.${region}.amazonaws.com
ENV

aws s3 sync "s3://${releases_bucket}/host" /srv/ape --exclude "*.service" --exclude "deploy-sandbox.sh"
chmod +x /srv/ape/*.sh

# Nightly database backup to S3 (kept 30 days by a lifecycle rule).
cat > /etc/cron.d/ape-backup <<'CRON'
15 3 * * * root /srv/ape/backup.sh >> /var/log/ape-backup.log 2>&1
CRON
