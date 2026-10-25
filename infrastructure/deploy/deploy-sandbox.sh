#!/usr/bin/env bash
# Installs a sandbox worker bundle built by CI (s3://<releases>/sandbox/<tag>.tgz) and restarts it.
set -euo pipefail
TAG=${1:?usage: deploy-sandbox.sh <tag>}
source /etc/ape/host.env
DIR=/opt/ape/sandbox/releases/$TAG
mkdir -p "$DIR"
aws s3 cp "s3://$RELEASES_BUCKET/sandbox/$TAG.tgz" /tmp/sandbox.tgz
tar -xzf /tmp/sandbox.tgz -C "$DIR"
rm -f /tmp/sandbox.tgz
ln -sfn "$DIR" /opt/ape/sandbox/current
chown -R sandbox:sandbox /opt/ape/sandbox
systemctl enable ape-sandbox
systemctl restart ape-sandbox
sleep 8
systemctl is-active --quiet ape-sandbox || { journalctl -u ape-sandbox -n 40 --no-pager; exit 1; }
# Keep the last three releases.
ls -1dt /opt/ape/sandbox/releases/* | tail -n +4 | xargs -r rm -rf
echo "sandbox worker $TAG is running"
