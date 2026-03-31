# IRBA Operations Runbook

**App:** https://irba.sportgroup.cl
**Health:** https://irba.sportgroup.cl/api/health
**Server:** `ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com`
**SSH key:** `~/.ssh/VaisenKey.pem`
**Deploy dir:** `/opt/irba`

---

## Deploy

```bash
./scripts/deploy.sh
```

Runs a pre-deploy backup, then SSHes into EC2 and runs:
`git pull → docker compose build → docker compose up -d`

**First-time setup (one-off):**
```bash
ssh -i ~/.ssh/VaisenKey.pem ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com
sudo mkdir -p /opt/irba && sudo chown ubuntu:ubuntu /opt/irba
cd /opt/irba
git clone <repo-url> .
cp .env.example .env
# Edit .env — see Env Vars section below
```

---

## Rollback

```bash
ssh -i ~/.ssh/VaisenKey.pem ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com \
  "cd /opt/irba && git checkout <sha> && docker compose build && docker compose up -d"
```

To find the SHA: `git log --oneline -10`

---

## Database Backup

**Manual backup:**
```bash
ssh -i ~/.ssh/VaisenKey.pem ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com \
  "/opt/irba/scripts/backup.sh"
```

**List backups:**
```bash
ssh -i ~/.ssh/VaisenKey.pem ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com \
  "ls -lh /opt/irba/backups/"
```

**Restore from backup:**
```bash
# On EC2:
docker compose -f /opt/irba/docker-compose.yml stop app
gunzip -c /opt/irba/backups/<filename>.sql.gz \
  | docker exec -i irba-db-1 psql -U irba irba
docker compose -f /opt/irba/docker-compose.yml start app
```

Backups are kept for 30 days. The nightly cron runs at 03:00 server time.

---

## Cron Setup (one-off on EC2)

```bash
crontab -e
```

Add these two lines:
```cron
# Daily database backup at 03:00
0 3 * * * /opt/irba/scripts/backup.sh >> /opt/irba/backups/backup.log 2>&1

# Hourly check to auto-create the next session when the lead window opens
0 * * * * curl -s -H "Authorization: Bearer $(grep CRON_SECRET /opt/irba/.env | cut -d= -f2 | tr -d '\"')" https://irba.sportgroup.cl/api/cron/auto-create >> /opt/irba/cron.log 2>&1
```

Auto-create only fires if `SESSION_SCHEDULE_ENABLED=true` is set in admin config.

---

## WhatsApp Re-auth

The WA session is persisted at `/opt/irba/wa-session/` on EC2.
It survives deploys automatically. Re-auth is only needed if the session is invalidated
(e.g. phone logged out remotely or session files deleted).

```bash
# On EC2:
rm -rf /opt/irba/wa-session/*
cd /opt/irba && docker compose restart wa
docker logs irba-wa-1 --follow   # Scan the QR code with the WA account
```

---

## Logs

```bash
# App logs (last 100 lines)
ssh -i ~/.ssh/VaisenKey.pem ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com \
  "docker logs irba-app-1 --tail 100"

# WA sidecar logs
ssh -i ~/.ssh/VaisenKey.pem ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com \
  "docker logs irba-wa-1 --tail 50"

# Database logs
ssh -i ~/.ssh/VaisenKey.pem ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com \
  "docker logs irba-db-1 --tail 20"

# Cron log
ssh -i ~/.ssh/VaisenKey.pem ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com \
  "tail -50 /opt/irba/cron.log"
```

---

## Env Vars Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string (`postgresql://irba:<pw>@db:5432/irba`) |
| `POSTGRES_USER` | Yes | Postgres user (default: `irba`) |
| `POSTGRES_PASSWORD` | Yes | Postgres password — use a strong random value |
| `POSTGRES_DB` | Yes | Database name (default: `irba`) |
| `RSVP_SESSION_SECRET` | Yes | Min 32 chars — signs RSVP JWT cookies |
| `ADMIN_SESSION_SECRET` | Yes | Min 32 chars — signs admin JWT cookies |
| `ADMIN_PASSWORD_HASH` | Yes | Bcrypt hash — generate with `npm run hash-admin-password` |
| `CRON_SECRET` | Yes | Bearer token for `/api/cron/auto-create` — min 32 chars |
| `NODE_ENV` | Yes | Set to `production` |
| `WA_NOTIFY_ENABLED` | No | Set to `true` to enable WA notifications (default: off) |
| `IRBA_RL_ATTEND_MAX` | No | RSVP rate limit max requests (default: 15/15min) |
| `IRBA_RL_CANCEL_MAX` | No | Cancel rate limit max requests (default: 30/15min) |

Generate secrets:
```bash
openssl rand -hex 32   # for session secrets and CRON_SECRET
npm run hash-admin-password -- --print-only   # for ADMIN_PASSWORD_HASH
```

---

## Container Names

| Container | Service |
|-----------|---------|
| `irba-app-1` | Next.js app |
| `irba-db-1` | PostgreSQL 16 |
| `irba-wa-1` | WhatsApp sidecar |
