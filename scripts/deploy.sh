#!/usr/bin/env bash
set -euo pipefail

SSH_KEY="$HOME/.ssh/VaisenKey.pem"
HOST="ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com"
APP_DIR="/opt/irba"

log() { echo "[$(date -u '+%H:%M:%S')] $*"; }
step() { echo ""; echo "━━━ $* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

# Resolve the local commit hash up front — we deploy whatever main is at and
# pin to the SHA so a concurrent build pushing `:latest` can't race us.
FULL_COMMIT_HASH=$(git rev-parse HEAD)
COMMIT_HASH=$(git rev-parse --short HEAD)

deploy_via_github_actions() {
  if ! command -v gh >/dev/null 2>&1; then
    log "Docker is not installed and GitHub CLI (gh) is unavailable."
    log "Install Docker for direct deploys, or install/authenticate gh for GitHub Actions deploys."
    exit 1
  fi

  if ! gh auth status >/dev/null 2>&1; then
    log "Docker is not installed and GitHub CLI is not authenticated."
    log "Run: gh auth login"
    exit 1
  fi

  step "GITHUB ACTIONS DEPLOY"
  log "Docker is not installed locally; dispatching .github/workflows/deploy.yml instead."
  log "Deploying commit $COMMIT_HASH via GitHub Actions..."
  gh workflow run deploy.yml -f "ref=$FULL_COMMIT_HASH"

  # workflow_dispatch does not return a run id. Give GitHub a moment to create
  # the run, then find the newest Deploy run for this exact commit.
  sleep 3
  RUN_ID=$(gh run list \
    --workflow deploy.yml \
    --limit 10 \
    --json databaseId,headSha \
    --jq ".[] | select(.headSha == \"$FULL_COMMIT_HASH\") | .databaseId" \
    | head -n 1)

  if [ -z "$RUN_ID" ]; then
    log "Could not find the dispatched deploy run. Check GitHub Actions:"
    log "  https://github.com/avivais/irba/actions/workflows/deploy.yml"
    exit 1
  fi

  gh run watch "$RUN_ID" --exit-status

  step "HEALTH CHECK"
  curl -sf https://irba.club/api/health
  echo ""
  log "Deploy complete. https://irba.club"
  log "Deployed: $COMMIT_HASH"
}

if ! command -v docker >/dev/null 2>&1; then
  deploy_via_github_actions
  exit 0
fi

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
