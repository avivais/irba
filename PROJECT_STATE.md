# IRBA Manager — project state and next steps

Use this file to onboard or resume work in a new chat. For setup commands, see [README.md](./README.md).

## Purpose

Self-hosted web app for **Ilan Ramon Basketball Association (IRBA)** — moving off Google Sheets / WhatsApp. **MVP focus:** practice **RSVP** with Hebrew / RTL UI, PostgreSQL persistence, Docker-friendly deployment.

## Stack

| Layer | Choice |
|--------|--------|
| App | Next.js 16 (App Router), React 19, Tailwind v4 |
| Theming | `next-themes`: system (default), light, dark; `class` on `<html>`; `storageKey` `irba-theme` |
| DB | PostgreSQL, Prisma ORM 7 (driver adapter `@prisma/adapter-pg`) |
| Auth (MVP) | Signed HTTP-only cookie (`jose`), `RSVP_SESSION_SECRET` (min 32 chars), JWT `iss`/`aud`, optional `RSVP_COOKIE_SECURE` |
| Icons | `lucide-react` |
| Tests | Vitest (`npm test`) |
| Package manager | **npm** (lockfile: `package-lock.json`) |
| CI | GitHub Actions — `lint`, `test`, `build` on `push` / `pull_request` to `main` ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)); job `env` sets placeholder `DATABASE_URL`, `RSVP_SESSION_SECRET`, and `ADMIN_SESSION_SECRET` so Prisma / Next build load without Postgres in CI. |
| Admin auth (MVP) | **Password + HttpOnly JWT session** — `ADMIN_SESSION_SECRET`, `ADMIN_PASSWORD_HASH` (bcrypt), cookie `irba_admin_session`, default 14-day TTL (`ADMIN_SESSION_MAX_AGE_SEC` optional). Separate from RSVP; shared `Secure` via [src/lib/cookie-secure.ts](src/lib/cookie-secure.ts). |
| PWA (goal) | Installable app: **manifest**, **service worker**, offline/cache strategy TBD — after core admin works on mobile web. |

## Repository

- Remote (as of last setup): `https://github.com/avivais/irba` — confirm with `git remote -v`.

## What exists today

### Data model (Prisma)

- **`Player`**: name, unique `phone` (normalized Israeli mobile `05xxxxxxxx`), `playerKind` (`REGISTERED` | `DROP_IN`), `positions` (`Position[]`, multi-value array, default `[]`), optional `rank`, `balance`, `isAdmin`.
- **`GameSession`**: `date`, `maxPlayers` (default 15), `isClosed`.
- **`Attendance`**: links player ↔ session, `createdAt` for RSVP order (confirmed = first `maxPlayers` by time; rest = waiting list).

### RSVP flow (public)

- Home page (`/`): **dynamic** server render — next open game, Hebrew copy, **“אני מגיע”** form (name + phone).
- **Theme**: header `ThemeToggle` (התאם למכשיר / בהיר / כהה); root `ThemeProvider` in `layout.tsx` so future admin UI inherits the same behavior — reuse `ThemeToggle` or rely on global `dark:` styles.
- **`normalizePhone`** in `src/lib/phone.ts` — strips non-digits, strict `/^05\d{8}$/` (no `972` rewrite).
- Server actions: attend (find-or-create player, transactional RSVP), cancel (session-bound `playerId`); per-IP sliding-window rate limits (`src/lib/rate-limit.ts`, tunable `IRBA_RL_*`).
- Lists: confirmed + waiting list; phones **masked** in UI; optional **“אורח”** badge for drop-ins.

### Admin (authenticated — full CRUD)

- **`/admin/login`** — password form (Hebrew / RTL); on success, client-side redirect to **`/admin`** (protected shell with theme toggle + logout). Route groups: `(public)/login` vs `(protected)/` with layout auth guard.
- **Session**: separate HttpOnly JWT cookie (`jose` HS256), env `ADMIN_SESSION_SECRET` (min 32 chars, distinct from RSVP; generate with `npm run generate-admin-secret`), default `iss`/`aud` overridable via `ADMIN_JWT_ISSUER` / `ADMIN_JWT_AUDIENCE`; default **14-day** TTL (`ADMIN_SESSION_MAX_AGE_SEC` optional).
- **Credentials**: `ADMIN_PASSWORD_HASH` (bcrypt only in env); set via `npm run hash-admin-password` — writes `.env` with single-quoted `\$` escaping so Next’s dotenv-expand preserves the hash (`scripts/hash-admin-password.ts`).
- **Rate limit**: admin login uses `consumeAdminLoginRateLimit` (`IRBA_RL_ADMIN_LOGIN_MAX` / `IRBA_RL_ADMIN_LOGIN_WINDOW_MS`).
- **Dev diagnostics**: in `NODE_ENV=development`, the login server action logs each step to the terminal (env raw/normalized values, secret status, bcrypt result, cookie outcome) — never in production.
- **Shared cookie `Secure` flag**: [src/lib/cookie-secure.ts](src/lib/cookie-secure.ts) (same `RSVP_COOKIE_SECURE` / production behavior as RSVP).

#### Admin home (`/admin`)

Navigation cards to שחקנים and מפגשים sections; logout button.

#### Players CRUD (`/admin/players`)

- **List** (`/admin/players`): all players sorted by name; shows full phone (unmasked), kind badge (רשום / אורח), positions (comma-separated English shorthands, e.g. `PG, SF`), attendance count, edit link, delete button.
- **Add** (`/admin/players/new`): form with name, phone, playerKind, positions (multi-select checkboxes — PG / SG / SF / PF / C, English-only), rank, balance, isAdmin.
- **Edit** (`/admin/players/[id]/edit`): same form; phone field is disabled (identity — phone cannot be changed via admin UI).
- **Delete**: guarded — blocked if player has any attendance records (count shown in tooltip); `window.confirm` for players with 0 attendances. Server action (`deletePlayerAction`) double-checks count before deleting.
- **Server actions**: `createPlayerAction`, `updatePlayerAction`, `deletePlayerAction` in `src/app/admin/(protected)/players/actions.ts`. All call `requireAdmin()` (session guard) before any DB access.
- **Validation**: `src/lib/player-validation.ts` — `parsePlayerForm` with per-field Zod + phone normalization; tested in `src/lib/player-validation.test.ts`.

#### Sessions CRUD (`/admin/sessions`)

- **List** (`/admin/sessions`): all sessions sorted newest-first; shows formatted date, attendance count / maxPlayers, open/closed badge, toggle / edit / delete actions.
- **Add** (`/admin/sessions/new`): form with date (datetime-local, Jerusalem TZ), maxPlayers.
- **Edit** (`/admin/sessions/[id]/edit`): same fields plus isClosed checkbox; datetime-local pre-filled with session date converted to Jerusalem local time.
- **Toggle open/close**: `SessionToggleButton` submits `toggleSessionAction` — flips `isClosed`, revalidates `/admin/sessions` and `/` (public page).
- **Delete**: guarded — blocked if session has any attendance records. `window.confirm` for empty sessions.
- **Server actions**: `createSessionAction`, `updateSessionAction`, `deleteSessionAction`, `toggleSessionAction` in `src/app/admin/(protected)/sessions/actions.ts`.
- **Validation**: `src/lib/session-validation.ts` — `parseSessionForm`; tested in `src/lib/session-validation.test.ts`.

### Security / abuse (MVP)

- **Cookies**: HTTP-only, `sameSite=lax`, `Secure` in production or when `RSVP_COOKIE_SECURE` is set; JWT verifies `iss` / `aud` (defaults `irba` / `irba-rsvp`).
- **Rate limits**: in-memory per process for attend vs cancel and **admin login**; client IP from `CF-Connecting-IP`, `X-Real-IP`, or first `X-Forwarded-For` hop (configure your reverse proxy).
- **Response headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` via `next.config.ts`.

### Ops / DX

- **`GET /api/health`** — JSON; 200 if DB answers `SELECT 1`, else 503 (generic body, no secrets).
- **Docker**: `docker-compose.yml` (`db` + `app`), `Dockerfile`, `docker-entrypoint.sh` runs `prisma migrate deploy` then `next start`.
- **Seeds**: deterministic `prisma/seed.ts` (`npm run db:seed`); random QA script `scripts/seed-random.ts` (`npm run db:seed:random`) with env guards — see README.
- **CI**: GitHub Actions workflow above; confirm runs in the repo **Actions** tab after push.

### Tests

- Unit tests: `phone`, `maskPhone`, `rate-limit` (including admin login), `admin-session`, `bcryptjs` verify, mocked `checkDatabase` (`src/lib/*.test.ts`, `src/lib/health.test.ts`).
- **Player validation tests** (`src/lib/player-validation.test.ts`): 25 cases covering all fields, phone normalization, rank/balance boundaries, multi-position array (valid/invalid values, single-string coercion, empty), isAdmin flag.
- **Session validation tests** (`src/lib/session-validation.test.ts`): 13 cases covering date parsing, maxPlayers bounds, isClosed flag.
- Default `npm test` does **not** require a running Postgres.

## What is not built yet (non-exhaustive)

- **Import** pipeline: agreed format exports (CSV etc.) for payments, aggregates, precedence — not live Sheets API for now.
- CAPTCHA / advanced bot mitigation beyond rate limits.
- SMS/WhatsApp automation; push notifications.
- i18n beyond Hebrew for the public UI.

## Admin roadmap (owner priorities — Mar 2026)

Ordered by impact for the operator (solo admin today). **Mobile-friendly** admin is a first-class requirement (responsive layout, touch targets, flows that work on phone — Sheets was a pain on mobile).

1. **Admin UI** — Add/edit **players** and other operational fields; manage **sessions** (מפגשים: create, open/close, dates). Must be comfortable on **laptop and phone**.
2. **Import (export-based)** — Operator exports data in an agreed format (e.g. CSV). **Payments** and **past attendances** column mapping TBD when we define the first import template.
3. **Precedence list (“רשימת קדימות”)** — **Year weights**, per-player **aggregated attendance per year** (as in Sheets), **multiple bonuses and fines** per player over time — model in DB + import path (see **Decisions**).

### Precedence list — current Sheets shape (reference)

From the existing spreadsheet (screenshot on file): one row per player (name in the name column), **year columns** with numeric values, each year with a **משקל (weight)** that increases toward the current year, a **סה״כ** total score column, a **bonus sum** column, and **בונוסים / קנסות** (dated lines, points in parentheses). Rows ordered by total score descending.

### Decisions (Mar 2026)

| Topic | Decision |
|--------|----------|
| **Admin auth** | **Password + session**, stay logged in via **session cookie** (implement as **HttpOnly** session/JWT cookie — do **not** put session secrets in `localStorage`). |
| **Sheets / files** | **Manual exports** in whatever format we define together (CSV first); **no** live Google Sheets API for now. |
| **Player matching (imports)** | Sheets **do not include phone**. **One-time collaborative mapping** (e.g. screenshots / cross-reference **WhatsApp contacts** ↔ **Sheet name**) → then **update script** or **manual DB updates** to attach phones / `Player` rows. |
| **Past attendance** | Store **aggregated counts per year** per player (as in the sheet), **not** full historical `GameSession` rows for every past practice. |
| **Precedence model** | Each **calendar year** has a **weight**; each player has **yearly aggregates**; each player can have **multiple bonus and fine line-items** (structured and/or text — finalize in schema design). |
| **Mobile / PWA** | **Responsive admin** for v1; **PWA (installable)** is an explicit **goal** after core flows work (manifest + service worker + caching strategy). |

**Still TBD in implementation:** exact CSV column templates, multi-admin / `Player.isAdmin` linkage, and Prisma schema for precedence + imports. Admin uses `ADMIN_PASSWORD_HASH` + `ADMIN_SESSION_SECRET` and optional `ADMIN_SESSION_MAX_AGE_SEC`.

## Recommended next steps (before / for production)

**Product / operator (aligned with roadmap above):**

1. ~~Spike: **admin auth** (password + HttpOnly session cookie) + minimal protected `/admin` shell (mobile-responsive).~~ **Done** (login + shell).
2. ~~**Admin CRUD** for players + game sessions.~~ **Done** (list, add, edit, delete, open/close toggle).
3. **File import** — agree **CSV (or similar) templates** for payments / aggregates / precedence; no Sheets API in v1.
4. **Precedence** — Prisma schema (year weights, aggregates, bonus/fine line items) + import path aligned with export format.
5. **PWA** — manifest + service worker; ship after admin UX is solid on mobile Safari/Chrome.

**Platform:**

1. **Security & abuse (MVP slice done for public RSVP)** — TLS at edge (ops), CAPTCHA if needed, Redis-backed limits for multi-replica, optional CSP with nonces.
2. **Data reliability** — automated Postgres backups + **tested restore**; migration discipline (`migrate deploy` on deploy).
3. **Operations** — runbook (restart, logs), monitoring/uptime on `/api/health`, alerts on repeated failures.
4. **Launch checklist** — env vars, DB migrated, smoke test RSVP + cancel + health + admin login, rollback idea.

**Done:** **CI** — GitHub Actions (`lint`, `test`, `build` on `main`); see [`.github/workflows/ci.yml`](./.github/workflows/ci.yml).

---

*Last updated: Mar 2026 — Admin CRUD shipped (players + sessions); positions overhauled to multi-value array with English-only labels (PG/SG/SF/PF/C); back-navigation arrows corrected for RTL layout; next focus: file import pipeline.*
