# IRBA Operations & Runtime Reference

Operational/runtime notes extracted from `PROJECT_STATE.md`.

## Stack

| Layer | Choice |
|--------|--------|
| App | Next.js 16 (App Router), React 19, Tailwind v4 |
| Theming | `next-themes`: system (default), light, dark; `class` on `<html>`; `storageKey` `irba-theme` |
| Page titles | Root layout uses `title.template: "‎IRBA · %s"` (LTR mark + middle dot) with `default: "IRBA"`; LTR mark forces correct display in narrow RTL browser tabs |
| DB | PostgreSQL, Prisma ORM 7 (driver adapter `@prisma/adapter-pg`) |
| Auth | Signed HTTP-only cookie (`jose`), single identity model — `Player` IS the user; admin is the `Player.isAdmin` flag. `RSVP_SESSION_SECRET` (min 32 chars), JWT `iss`/`aud`, optional `RSVP_COOKIE_SECURE` |
| Icons | `lucide-react` |
| DnD | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (peer rating UI) |
| Tests | Vitest (`npm test`) — pure unit tests, no Postgres required |
| Package manager | **npm** (lockfile: `package-lock.json`) |
| CI | GitHub Actions — `lint`, `test`, `build` on `push` / `pull_request` to `main` ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)); placeholder DB / session secrets in job `env` so Prisma + Next build load without Postgres |

## Repository

- Remote: `https://github.com/avivais/irba`
- Production host: EC2 `t4g.large` (Graviton ARM, 8 GB RAM + 2 GB swap, 50 GB gp3 EBS) → Apache TLS → `localhost:3004` → Docker

---

## WhatsApp sidecar (`wa/`)

Separate Docker service — Baileys + Express on internal port 3100. Next.js POSTs to sidecar endpoints; if `wa` is down, calls are best-effort (logs, doesn't throw).

- `GET /status` → `{ ready: boolean }`
- `GET /qr` → `{ qr: string | null }` — current pairing QR as a data URL (null when connected or not yet emitted)
- `POST /send` → `{ to: "05xxxxxxxx", message }` — DM
- `POST /send-group` → `{ groupId: "XXXXXXXXXX@g.us", message, mentions?: string[] }` — group broadcast with optional `@`-mentions (Baileys JIDs like `972…@s.whatsapp.net`)
- `POST /send-poll` → `{ groupId, question, options[] }` — single-choice poll
- `POST /logout` → wipes session dir + reconnects to emit a fresh QR
- `GET /groups` → `[{ id, subject }]` — used by admin group-search UI
- Phone normalization: `05xxxxxxxx → 972xxxxxxxx@s.whatsapp.net`
- Session persisted to `/opt/irba/wa-session/` (bind-mounted volume); survives deploys.
- **Auto-recovery on `loggedOut`**: when WhatsApp invalidates the bot session, the disconnect handler wipes `SESSION_PATH` and reconnects automatically (shared `resetSession()` helper used by `/logout` and `DisconnectReason.loggedOut`).
- Controlled by `WA_NOTIFY_ENABLED=true` env var (default off; set true on EC2).

**`src/lib/wa-notify.ts`** — typed dispatcher; `renderTemplate` for `{placeholder}` substitution; per-type high-level functions route to group or DM.

**Notification triggers:**

| Trigger | Recipient | Default on |
|---------|-----------|-----------|
| Session open (auto-create cron or manual create) | WA group | ✅ |
| Session closed (admin toggle) | WA group | ❌ |
| Session cancelled (admin) | WA group | ✅ |
| Player registered (public RSVP) | WA group | ❌ |
| Player cancelled (public RSVP) | WA group | ❌ |
| Admin promotes waitlisted player | DM to player | ✅ |
| Admin manual roster broadcast (button on session admin page) | WA group | ✅ |
| Admin manual debt reminder (button on finance page) | WA group | ✅ |
| Competition winner | WA group | ✅ |
| Admin test-OTP forward (WA admin page) | DM to admin | ✅ |

**Roster macros** — `{registered_list}`, `{waitlist}`, and `{numbered_list}` available in player-registered, player-cancelled, waitlist-promote, and session-roster templates. Each renders display names from the post-event session state. `{registered_list}` and `{waitlist}` are newline-joined by registration-time order; for session-roster broadcasts `{registered_list}` also appends a count summary line (e.g. `סה"כ *8 רשומים*`). `{numbered_list}` renders all attendees (confirmed + waitlist) as a numbered list sorted by precedence score → registration time → name (admins first, then REGISTERED by score, then DROP_IN), giving each player their exact queue position. Default templates demonstrate the multi-line layout. Empty waitlist → empty string. Admin textareas are 6 rows × 2,000 chars.

**Participant tagging in WA group messages** — `sendWaGroupMessage(groupJid, message, mentions?)` forwards optional Baileys JIDs. `phoneToWaMention(phone)` converts a normalised Israeli mobile (`05XXXXXXXX`) into both the inline `@972…` digits AND the `…@s.whatsapp.net` JID. Wired into the debt-reminder dispatcher today (gated by `wa_notify_debtors_tag_enabled`, default on); other dispatchers can opt in. Phones that don't match `05XXXXXXXX` are silently skipped — that line shows name+amount only, no tag.

**Per-session override** — `/admin/sessions/new` form has a collapsible "התראות וואטסאפ" section (pre-filled from global config) to override session-open notification for that session only.

## Cron jobs

### Auto-create (`GET /api/cron/auto-create`)

Idempotent endpoint, called hourly by EC2 cron. Bearer-token auth (`CRON_SECRET`).
1. Check `SESSION_SCHEDULE_ENABLED=true` in AppConfig
2. Compute next scheduled session datetime (`src/lib/schedule.ts` — DST-safe via `Intl.DateTimeFormat`)
3. If `now ≥ sessionTime − autoCreateHours` and no session exists for that Israel day (any status, including cancelled — tombstones block recreation) → create + auto-attend admin + notify WA group
4. Otherwise → `{ created: false, reason }`

Core in `src/lib/auto-create-session.ts`. Admin config has a **"הרץ עכשיו"** button (in לוח זמנים) calling `runAutoCreateAction({ force: true })` to bypass the lead-time check.

### Auto-close (`GET /api/cron/auto-close`)

Idempotent, called every minute by EC2 cron.
1. Find sessions with `isClosed=false AND isArchived=false`
2. For each, compute `endTime = date + (durationMinutes ?? defaultDuration) min`
3. If `endTime ≤ now` → set `isClosed=true`, write `CLOSE_SESSION` audit (actor: cron), notify WA group
4. Run `checkLowAttendanceAlerts` — fire WA group message if any upcoming open session is below `session_min_players` and the alert hasn't fired for that session/tier
5. Returns `{ closed: string[], skipped: number, alerts: { earlyFired, criticalFired } }`

Core in `src/lib/auto-close-sessions.ts`; alert logic in `src/lib/low-attendance-alert.ts`.

### Audit-prune (`GET /api/cron/prune-audit`)

Idempotent, called daily by EC2 cron. Deletes `AuditLog` rows older than `retentionDays` (default 90) and `AssistantRequestLog` rows older than `assistant_log_retention_days` (default 7). Returns `{ deleted, cutoff, assistantDeleted, assistantCutoff }`. Core in `src/lib/audit-prune.ts`.

## Ops / DX

- **`GET /api/health`** — JSON; 200 if DB answers `SELECT 1`, else 503 (generic body, no secrets). Response includes `version` (git commit hash) and `wa.ready`.
- **Assistant API / OpenClaw integration** — `POST /api/assistant/v1` is the typed production API used by Mikey/OpenClaw. Current production operations include `help`, `session_status`, `next_session`, `session_roster_add`, `session_roster_remove`, and admin-only `player_lookup`. The low-level OpenClaw helper is `/root/.openclaw/workspace/bin/irba-assistant-api`. Natural WhatsApp roster commands are handled outside this repo by the local OpenClaw skill `/root/.openclaw/skills/irba-assistant/`, whose `scripts/irba_roster_command.py` performs parse → `player_lookup` → safe all-or-clarify → `session_roster_add/remove`. The skill resolves phone/JID mentions directly and LID mentions only when OpenClaw/Baileys has a local reverse LID→phone mapping; unresolved LID-only mentions must block and ask for a name/phone. The skill must not partially mutate natural multi-player commands by default.
- **Favicon / icons**: `src/app/icon.svg` (desktop SVG), `src/app/icon.png` (48×48 PNG fallback), `src/app/apple-icon.png` (180×180 PNG, served as `apple-touch-icon` for iOS). PNGs generated from icon.svg via sharp.
- **Docker**: `docker-compose.yml` with 3 services — `db` (Postgres 16-alpine), `app` (Next.js on `127.0.0.1:3004`), `wa` (Baileys / Express sidecar on internal port 3100). All `restart: unless-stopped`; `wa` has 30 s `/status` healthcheck so a hung sidecar gets auto-restarted. `app` and `wa` reference prebuilt images via `image: ghcr.io/avivais/irba/{app,wa}:${IRBA_*_IMAGE:-:latest}` with `pull_policy: always`. `Dockerfile` uses `output: standalone`; runner stage installs only the 3 packages the entrypoint needs (`prisma`, `@prisma/client`, `dotenv`) — image is ~250 MB instead of ~3 GB. `docker-entrypoint.sh` runs `prisma migrate deploy` then `exec node server.js`. `init: true` on `app` and `wa` uses Docker's built-in tini as PID 1 to reap zombies.
- **Build pipeline**: `.github/workflows/build-image.yml` runs on every push to `main` (matrix: `app` + `wa`), builds with `docker/build-push-action`, pushes both `:latest` and `:<short-sha>` tags to GHCR (public, anonymous-pullable), reuses a `:buildcache` registry layer. Builds happen on GitHub-hosted ARM runners — never on EC2, so deploys can no longer OOM the 4 GB host. `NODE_OPTIONS=--max-old-space-size=1024` set in the builder stage as belt-and-braces.
- **Deploy**: `./scripts/deploy.sh` — local entry point: waits for the GHCR image tagged with the current commit SHA (polls up to 5 min), runs a pre-deploy DB backup, then SSHes to EC2: `git pull → docker compose pull → docker compose up -d → trim images`. Both services pinned to the SHA via `IRBA_APP_IMAGE` / `IRBA_WA_IMAGE` env vars exported just before compose so a concurrent push of `:latest` can't race the restart. Image trim keeps the **2 most recent tags per IRBA repo** (current + previous, for rollback) — Docker refuses to remove an in-use image so the running container is protected automatically. (Age-only filter was insufficient — 14 same-day deploys had pushed disk over 85% before the weekly cron caught up.) `.github/workflows/deploy.yml` does the same as a manual `workflow_dispatch`.
- **Versioning**: `COMMIT_HASH` build arg → baked as `NEXT_PUBLIC_COMMIT_HASH` at build time. `COMMIT_DATE` is set via `git log -1 --format='%cI'` (strict ISO 8601 with full TZ offset) — required so client-side `new Date()` parses UTC and `Intl.DateTimeFormat` renders local TZ. Footer on all admin pages uses `CommitInfo` client component to show local-TZ date + Hebrew relative time ("לפני X שעות").
- **Production**: live at `https://irba.club` — EC2 `t4g.large` on a 1-year reserved instance (No Upfront, ~$30.73/mo compute) purchased 2026-04-28. Total monthly bill ~$44.50 incl. storage, IPv4, tax. Renews / expires 2027-04-28; revisit before then.
- **Monitoring**: CloudWatch Agent on EC2 under namespace `IRBA/EC2`, pushing `mem_used_percent`, `swap_used_percent`, `disk_used_percent` every 60 s. Four alarms (`irba-ec2-{cpu,memory,disk,status-check}-*`):
  - CPU > 90% / 5 min, memory > 90% / 5 min, disk > 85% / 15 min → SNS `irba-alarms-info` (email to `avivais@gmail.com`)
  - `StatusCheckFailed` ≥ 1 / 2 min → `irba-alarms-critical` (email + SMS to `+972507666550`)
  - Disk-high alarm has full dimensions (`InstanceId`, `path=/`, `device=nvme0n1p1`, `fstype=ext4`) — partial dimensions silently won't match the metric.
  - Instance has `IrbaEC2CloudWatchAgent` IAM role (with `CloudWatchAgentServerPolicy`) attached so it can publish without static credentials.
- **Billing**: AWS Budgets `"My Monthly Cost Budget"` set to $60/month with notifications at 85% actual, 100% actual, 100% forecast — all email to `avivais@gmail.com`.
- **Backup**: `scripts/backup.sh` — `pg_dump | gzip`, 30-day retention. Runs daily 03:00 via EC2 cron.
- **Logging**: cron auto-create / auto-close run via wrapper scripts that prefix `[YYYY-MM-DD HH:MM:SS]` → `/opt/irba/cron.log`. Both `cron.log` and `backups/backup.log` rotated daily, 30-day retention, via `/etc/logrotate.d/irba`. Docker container logs rotate automatically via global `/etc/docker/daemon.json` (10 MB max, 3 files).
- **Custom 404**: `src/app/not-found.tsx` — Hebrew page ("הדף לא נמצא") with back-to-home link; fixes RTL layout issue with the Next.js default.
- **Process management** (dev): `npm start` writes PID to `.next.pid`; `npm run web` / `startweb` / `buildandstartweb` write cloudflared's PID to `.cloudflared.pid`; `npm stop` kills both by PID file.
- **Seeds**: deterministic `prisma/seed.ts` (`npm run db:seed`); random QA script `scripts/seed-random.ts` (`npm run db:seed:random`) with env guards.
- **Uptime alerts**: UptimeRobot free tier; public status page `https://stats.uptimerobot.com/dHQF2WHXL9`.
- **CI**: GitHub Actions — lint, test, build on push/PR to main.
