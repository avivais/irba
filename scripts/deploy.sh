#!/usr/bin/env bash
set -euo pipefail

SSH_KEY="$HOME/.ssh/VaisenKey.pem"
HOST="ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com"
SSH="ssh -i \"$SSH_KEY\" $HOST"
APP_DIR="/opt/irba"

log() { echo "[$(date -u '+%H:%M:%S')] $*"; }
step() { echo ""; echo "━━━ $* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

# ── 1. Backup ──────────────────────────────────────────────────────────────────
step "BACKUP"
log "Running pre-deploy database backup..."
ssh -i "$SSH_KEY" "$HOST" "$APP_DIR/scripts/backup.sh" \
  || log "Warning: backup failed — continuing deploy"

# ── 2. Pull ────────────────────────────────────────────────────────────────────
step "PULL"
log "Fetching latest code from origin/main..."
ssh -i "$SSH_KEY" "$HOST" bash <<'REMOTE'
  set -euo pipefail
  cd /opt/irba
  git fetch origin
  git log --oneline HEAD..origin/main | head -10 || true
  git pull --ff-only
  echo "Now at: $(git log -1 --oneline)"
REMOTE

# ── 3. Build ───────────────────────────────────────────────────────────────────
step "BUILD"
log "Building Docker images (this takes ~2 min)..."
ssh -i "$SSH_KEY" "$HOST" bash <<'REMOTE'
  set -euo pipefail
  cd /opt/irba
  # Prune build cache older than 24h to prevent multi-GB accumulation
  # that was causing 10+ minute hidden overhead in BuildKit cache management.
  docker builder prune --filter "until=24h" -f 2>/dev/null | tail -1 || true
  COMMIT_HASH=$(git rev-parse --short HEAD)
  COMMIT_DATE=$(git log -1 --format='%cI')
  echo "Building commit $COMMIT_HASH ($COMMIT_DATE)"
  COMMIT_HASH=$COMMIT_HASH COMMIT_DATE=$COMMIT_DATE \
    docker compose build --progress=plain 2>&1
REMOTE

# ── 4. Restart ─────────────────────────────────────────────────────────────────
step "RESTART"
log "Restarting containers..."
ssh -i "$SSH_KEY" "$HOST" bash <<'REMOTE'
  set -euo pipefail
  cd /opt/irba
  docker compose up -d
  echo ""
  echo "Container status:"
  docker compose ps
REMOTE

# ── 5. Health check ────────────────────────────────────────────────────────────
# Migrations run automatically in docker-entrypoint.sh on container start.
# No separate migrate step needed — avoid redundant docker exec that risks OOM.
step "HEALTH CHECK"
log "Waiting 10s for app to start and run migrations..."
sleep 10
ssh -i "$SSH_KEY" "$HOST" bash <<'REMOTE'
  response=$(curl -sf https://irba.sportgroup.cl/api/health 2>&1) \
    && echo "Health: $response" \
    || echo "Warning: health check failed — check container logs"
REMOTE

echo ""
log "Deploy complete. https://irba.sportgroup.cl"
