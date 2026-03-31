#!/usr/bin/env bash
set -euo pipefail

SSH_KEY="$HOME/.ssh/VaisenKey.pem"
HOST="ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com"
REMOTE="ssh -i \"$SSH_KEY\" $HOST"

echo "==> Running pre-deploy backup..."
ssh -i "$SSH_KEY" "$HOST" "/opt/irba/scripts/backup.sh || echo 'Warning: backup failed, continuing deploy'"

echo "==> Deploying IRBA to production..."
ssh -i "$SSH_KEY" "$HOST" "cd /opt/irba && git pull && COMMIT_HASH=\$(git rev-parse --short HEAD) COMMIT_DATE=\$(git log -1 --format='%ci' | cut -c1-16) docker compose build && docker compose up -d && docker compose ps"
echo "==> Done. Check https://irba.sportgroup.cl/api/health"
