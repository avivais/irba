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

  # Trim old images: keep the 2 most recent tags per IRBA repo (current +
  # previous, for rollback). Older tags get untagged; in-use images are
  # protected by Docker itself (rmi on a running image fails harmlessly).
  # An age filter alone (e.g. until=168h) is too lenient with rapid deploys —
  # 14 deploys in a day pushed disk over 85% before the weekly cron ran.
  for repo in ghcr.io/avivais/irba/app ghcr.io/avivais/irba/wa; do
    docker images "\$repo" --format '{{.CreatedAt}}|{{.Repository}}:{{.Tag}}' \
      | sort -r \
      | tail -n +3 \
      | cut -d'|' -f2 \
      | xargs -r -n1 docker rmi 2>/dev/null || true
  done
  docker image prune -f >/dev/null 2>&1 || true
  docker builder prune -af --filter "until=168h" >/dev/null 2>&1 || true
REMOTE

# ── 4. Health check ───────────────────────────────────────────────────────────
step "HEALTH CHECK"
log "Waiting 8s for app to start and run migrations..."
sleep 8
ssh -i "$SSH_KEY" "$HOST" bash <<REMOTE
  response=\$(curl -sf https://irba.club/api/health 2>&1) \
    && echo "Health: \$response" \
    || echo "Warning: health check failed — check container logs"
REMOTE

echo ""
log "Deploy complete. https://irba.club"
log "Deployed: $COMMIT_HASH"
