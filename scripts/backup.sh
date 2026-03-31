#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/irba/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/irba_$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date -Iseconds)] Starting backup → $FILE"
docker exec irba-db-1 pg_dump -U irba irba | gzip > "$FILE"

# Retain last 30 days
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "[$(date -Iseconds)] Backup complete: $FILE ($(du -sh "$FILE" | cut -f1))"
