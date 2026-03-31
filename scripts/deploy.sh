#!/usr/bin/env bash
set -euo pipefail

SSH_KEY="$HOME/.ssh/VaisenKey.pem"
HOST="ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com"
REMOTE="ssh -i \"$SSH_KEY\" $HOST"

echo "==> Deploying IRBA to production..."
eval "$REMOTE" "cd /opt/irba && git pull && docker compose build && docker compose up -d && docker compose ps"
echo "==> Done. Check https://irba.sportgroup.cl/api/health"
