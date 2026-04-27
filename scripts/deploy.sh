#!/usr/bin/env bash
set -euo pipefail

SSH_KEY="$HOME/.ssh/VaisenKey.pem"
HOST="ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com"
APP_DIR="/opt/irba"

log() { echo "[$(date -u '+%H:%M:%S')] $*"; }
step() { echo ""; echo "━━━ $* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

# Resolve the local commit hash up front — we deploy whatever main is at and
# pin to the SHA so a concurrent build pushing `:latest` can't race us.
COMMIT_HASH=$(git rev-parse --short HEAD)

# ── 1. Wait for the GHCR image to be published ────────────────────────────────
# CI builds on every push to main; we don't try to deploy a SHA that doesn't
# have an image yet. Polls up to 5 minutes (build + push usually <2 min).
step "WAIT FOR IMAGE"
log "Waiting for ghcr.io/avivais/irba/app:$COMMIT_HASH ..."
RETRIES=30
until docker manifest inspect "ghcr.io/avivais/irba/app:$COMMIT_HASH" >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    log "Image $COMMIT_HASH never published. Check the build workflow:"
    log "  https://github.com/avivais/irba/actions"
    exit 1
  fi
  sleep 10
done
log "Image is available."

# ── 2. Backup ─────────────────────────────────────────────────────────────────
step "BACKUP"
log "Running pre-deploy database backup..."
ssh -i "$SSH_KEY" "$HOST" "$APP_DIR/scripts/backup.sh" \
  || log "Warning: backup failed — continuing deploy"

# ── 3. Pull and switch ────────────────────────────────────────────────────────
step "PULL & RESTART"
log "Pulling images and restarting containers..."
ssh -i "$SSH_KEY" "$HOST" bash <<REMOTE
  set -euo pipefail
  cd $APP_DIR
  git fetch origin
  git checkout main
  git pull --ff-only

  # Pin both services to the deployed SHA so an in-flight :latest update can't
  # race the restart. Compose reads these from the shell environment.
  export IRBA_APP_IMAGE=ghcr.io/avivais/irba/app:$COMMIT_HASH
  export IRBA_WA_IMAGE=ghcr.io/avivais/irba/wa:$COMMIT_HASH

  docker compose pull
  docker compose up -d
  echo ""
  echo "Container status:"
  docker compose ps

  # Trim old images to keep disk usage in check (keeps anything tagged or
  # currently in use; only deletes dangling layers from previous deploys).
  docker image prune -f >/dev/null 2>&1 || true
REMOTE

# ── 4. Health check ───────────────────────────────────────────────────────────
step "HEALTH CHECK"
log "Waiting 8s for app to start and run migrations..."
sleep 8
ssh -i "$SSH_KEY" "$HOST" bash <<REMOTE
  response=\$(curl -sf https://irba.sportgroup.cl/api/health 2>&1) \
    && echo "Health: \$response" \
    || echo "Warning: health check failed — check container logs"
REMOTE

echo ""
log "Deploy complete. https://irba.sportgroup.cl"
log "Deployed: $COMMIT_HASH"
