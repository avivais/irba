# IRBA Manager — project state and next steps

Use this file to onboard or resume work in a new chat. For setup commands, see [README.md](./README.md).

## Purpose

Self-hosted web app for **Ilan Ramon Basketball Association (IRBA)** — moving off Google Sheets / WhatsApp. **MVP focus:** practice **RSVP** with Hebrew / RTL UI, PostgreSQL persistence, Docker-friendly deployment.

## Stack

| Layer | Choice |
|--------|--------|
| App | Next.js 16 (App Router), React 19, Tailwind v4 |
| DB | PostgreSQL, Prisma ORM 7 (driver adapter `@prisma/adapter-pg`) |
| Auth (MVP) | Signed HTTP-only cookie (`jose`), `RSVP_SESSION_SECRET` (min 32 chars), JWT `iss`/`aud`, optional `RSVP_COOKIE_SECURE` |
| Icons | `lucide-react` |
| Tests | Vitest (`npm test`) |
| Package manager | **npm** (lockfile: `package-lock.json`) |

## Repository

- Remote (as of last setup): `https://github.com/avivais/irba` — confirm with `git remote -v`.

## What exists today

### Data model (Prisma)

- **`Player`**: name, unique `phone` (normalized Israeli mobile `05xxxxxxxx`), `playerKind` (`REGISTERED` | `DROP_IN`), optional `position` / `rank`, `balance`, `isAdmin`.
- **`GameSession`**: `date`, `maxPlayers` (default 15), `isClosed`.
- **`Attendance`**: links player ↔ session, `createdAt` for RSVP order (confirmed = first `maxPlayers` by time; rest = waiting list).

### RSVP flow (public)

- Home page (`/`): **dynamic** server render — next open game, Hebrew copy, **“אני מגיע”** form (name + phone).
- **`normalizePhone`** in `src/lib/phone.ts` — strips non-digits, strict `/^05\d{8}$/` (no `972` rewrite).
- Server actions: attend (find-or-create player, transactional RSVP), cancel (session-bound `playerId`); per-IP sliding-window rate limits (`src/lib/rate-limit.ts`, tunable `IRBA_RL_*`).
- Lists: confirmed + waiting list; phones **masked** in UI; optional **“אורח”** badge for drop-ins.

### Security / abuse (MVP)

- **Cookies**: HTTP-only, `sameSite=lax`, `Secure` in production or when `RSVP_COOKIE_SECURE` is set; JWT verifies `iss` / `aud` (defaults `irba` / `irba-rsvp`).
- **Rate limits**: in-memory per process for attend vs cancel; client IP from `CF-Connecting-IP`, `X-Real-IP`, or first `X-Forwarded-For` hop (configure your reverse proxy).
- **Response headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` via `next.config.ts`.

### Ops / DX

- **`GET /api/health`** — JSON; 200 if DB answers `SELECT 1`, else 503 (generic body, no secrets).
- **Docker**: `docker-compose.yml` (`db` + `app`), `Dockerfile`, `docker-entrypoint.sh` runs `prisma migrate deploy` then `next start`.
- **Seeds**: deterministic `prisma/seed.ts` (`npm run db:seed`); random QA script `scripts/seed-random.ts` (`npm run db:seed:random`) with env guards — see README.

### Tests

- Unit tests: `phone`, `maskPhone`, `rate-limit`, mocked `checkDatabase` (`src/lib/*.test.ts`, `src/lib/health.test.ts`).
- Default `npm test` does **not** require a running Postgres.

## What is not built yet (non-exhaustive)

- Admin UI / authenticated back office (create games, import roster, promote drop-in → registered).
- Full login (OAuth, magic links, etc.) beyond RSVP session cookie.
- CAPTCHA / advanced bot mitigation beyond rate limits.
- SMS/WhatsApp automation; push notifications.
- i18n beyond Hebrew for the public UI.

## Recommended next steps (before / for production)

High level — drill into each in its own plan:

1. **Security & abuse (done for MVP slice)** — follow-up: TLS at edge (ops), CAPTCHA if needed, Redis-backed limits for multi-replica, optional CSP with nonces.
2. **Data reliability** — automated Postgres backups + **tested restore**; migration discipline (`migrate deploy` on deploy).
3. **Operations** — runbook (restart, logs), monitoring/uptime on `/api/health`, alerts on repeated failures.
4. **CI** — pipeline: lint, test, build on every PR/merge.
5. **Product** — admin + game lifecycle (sessions, open/close); stronger identity if the org needs it; cancellation rules when you’re ready.
6. **Launch checklist** — env vars, DB migrated, smoke test RSVP + cancel + health, rollback idea.

---

*Last updated: snapshot for handoff — edit when milestones land.*
