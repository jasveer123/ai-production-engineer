#!/usr/bin/env bash
# One-off (idempotent) setup of the polling timers on an existing host: bootstrap-pull.sh app|sandbox
set -euo pipefail
ROLE=${1:?usage: bootstrap-pull.sh app|sandbox}
export AWS_DEFAULT_REGION=ap-southeast-2
if [ "$ROLE" = app ]; then
  source /srv/ape/host.env
  aws s3 cp "s3://$RELEASES_BUCKET/host/" /srv/ape/ --recursive --exclude "*" --include "*.sh" --include "*.yml" --include "Caddyfile" --include "*.yaml" --quiet
  chmod +x /srv/ape/*.sh
  SCRIPT=/srv/ape/pull-deploy.sh; NAME=ape-pull-deploy
else
  source /etc/ape/host.env
  aws s3 cp "s3://$RELEASES_BUCKET/host/pull-sandbox.sh" /opt/ape/pull-sandbox.sh --quiet
  aws s3 cp "s3://$RELEASES_BUCKET/host/deploy-sandbox.sh" /opt/ape/deploy-sandbox.sh --quiet
  chmod +x /opt/ape/*.sh
  SCRIPT=/opt/ape/pull-sandbox.sh; NAME=ape-pull-sandbox
fi
cat > "/etc/systemd/system/$NAME.service" <<UNIT
[Unit]
Description=$NAME
After=network-online.target
[Service]
Type=oneshot
ExecStart=$SCRIPT
UNIT
cat > "/etc/systemd/system/$NAME.timer" <<UNIT
[Unit]
Description=Check for a new release every 3 minutes
[Timer]
OnBootSec=90
OnUnitActiveSec=180
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now "$NAME.timer"
echo "$NAME.timer enabled"
