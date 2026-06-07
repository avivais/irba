#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/opt/irba/cron.log"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"
ENV_FILE="/opt/irba/.env"
URL="http://localhost:3004/api/cron/auto-close"

log() {
  echo "$LOG_PREFIX $*" >> "$LOG_FILE"
}

if [[ ! -f "$ENV_FILE" ]]; then
  log "auto-close missing env file: $ENV_FILE"
  exit 1
fi

CRON_SECRET=$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
if [[ -z "$CRON_SECRET" ]]; then
  log "auto-close missing CRON_SECRET"
  exit 1
fi

response=$(curl -sS --fail -H "Authorization: Bearer $CRON_SECRET" "$URL" 2>&1) || {
  status=$?
  log "auto-close failed: $response"
  exit "$status"
}

log "$response"
