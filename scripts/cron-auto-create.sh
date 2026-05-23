#!/usr/bin/env bash
set -euo pipefail

LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"
ENV_FILE="/opt/irba/.env"
URL="http://localhost:3004/api/cron/auto-create"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$LOG_PREFIX missing env file: $ENV_FILE"
  exit 1
fi

CRON_SECRET=$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
if [[ -z "$CRON_SECRET" ]]; then
  echo "$LOG_PREFIX missing CRON_SECRET"
  exit 1
fi

response=$(curl -sS --fail -H "Authorization: Bearer $CRON_SECRET" "$URL" 2>&1) || {
  status=$?
  echo "$LOG_PREFIX auto-create failed: $response"
  exit "$status"
}

echo "$LOG_PREFIX $response"
