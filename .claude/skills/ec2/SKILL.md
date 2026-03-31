---
name: ec2
description: Run commands on the IRBA EC2 instance, or run a diagnostic dump of the server state. Use when the user asks to check the server, inspect storage, check disk, inspect deployments, or run any command on EC2.
argument-hint: "[command]  — omit for full diagnostic dump"
---

# EC2 — IRBA Production Server

## Connection

```
SSH_KEY="$HOME/.ssh/VaisenKey.pem"
HOST="ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com"
```

## Usage

**No argument — run full diagnostic dump:**

```bash
ssh -i "$HOME/.ssh/VaisenKey.pem" ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com bash <<'EOF'
echo "=== Disk usage ==="
df -h

echo ""
echo "=== Docker volumes ==="
docker volume ls

echo ""
echo "=== IRBA volume inspect ==="
docker volume inspect irba_postgres_data 2>/dev/null || echo "(not found)"

echo ""
echo "=== /opt contents ==="
ls -lh /opt/

echo ""
echo "=== Running containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== Apache sites enabled ==="
ls /etc/apache2/sites-enabled/ 2>/dev/null || echo "(no apache)"

echo ""
echo "=== Let's Encrypt certs ==="
ls /etc/letsencrypt/live/ 2>/dev/null || echo "(none)"

echo ""
echo "=== Memory ==="
free -h

echo ""
echo "=== IRBA app logs (last 20) ==="
docker logs irba-app-1 --tail 20

echo ""
echo "=== IRBA db logs (last 5) ==="
docker logs irba-db-1 --tail 5
EOF
```

**With argument — run that command on the server:**

```bash
ssh -i "$HOME/.ssh/VaisenKey.pem" ubuntu@ec2-98-84-90-118.compute-1.amazonaws.com "$@"
```

## Notes

- Other deployed projects: moshavi (`/opt/moshavi` or similar), parking-gate-remote (`/opt/parking-gate-remote`)
- IRBA will live at `/opt/irba` (not yet deployed)
- Apache handles HTTPS with Let's Encrypt certs

## Deploy

Run `./scripts/deploy.sh` from the project root to deploy. The script SSHs into the EC2 instance, pulls the latest code, rebuilds the Docker image, and restarts the containers.

**Pre-requisite:** `/opt/irba/.env` must exist on the server with all required variables (see `.env.example` for the full list).

**First-time EC2 setup:**

```bash
sudo mkdir -p /opt/irba && sudo chown ubuntu:ubuntu /opt/irba
cd /opt/irba && git clone <repo-url> . && cp .env.example .env
# edit .env with real secrets, then run ./scripts/deploy.sh
```
