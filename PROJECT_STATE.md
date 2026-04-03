# IRBA Manager — project state and next steps

Use this file to onboard or resume work in a new chat. For setup commands, see [README.md](./README.md).

## Purpose

Self-hosted web app for **Ilan Ramon Basketball Association (IRBA)** — moving off Google Sheets / WhatsApp. **MVP focus:** practice **RSVP** with Hebrew / RTL UI, PostgreSQL persistence, Docker-friendly deployment.

## Stack

| Layer | Choice |
|--------|--------|
| App | Next.js 16 (App Router), React 19, Tailwind v4 |
| Theming | `next-themes`: system (default), light, dark; `class` on `<html>`; `storageKey` `irba-theme` |
| Page titles | Root layout uses `title.template: "\u200EIRBA · %s"` (LTR mark + middle dot separator) with `default: "IRBA"`; LTR mark forces correct display in narrow RTL browser tabs. |
| DB | PostgreSQL, Prisma ORM 7 (driver adapter `@prisma/adapter-pg`) |
| Auth (MVP) | Signed HTTP-only cookie (`jose`), `RSVP_SESSION_SECRET` (min 32 chars), JWT `iss`/`aud`, optional `RSVP_COOKIE_SECURE` |
| Icons | `lucide-react` |
| Tests | Vitest (`npm test`) |
| Package manager | **npm** (lockfile: `package-lock.json`) |
| CI | GitHub Actions — `lint`, `test`, `build` on `push` / `pull_request` to `main` ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)); job `env` sets placeholder `DATABASE_URL`, `RSVP_SESSION_SECRET`, and `ADMIN_SESSION_SECRET` so Prisma / Next build load without Postgres in CI. |
| Admin auth (MVP) | **Password + HttpOnly JWT session** — `ADMIN_SESSION_SECRET`, `ADMIN_PASSWORD_HASH` (bcrypt), cookie `irba_admin_session`, default 14-day TTL (`ADMIN_SESSION_MAX_AGE_SEC` optional). Separate from RSVP; shared `Secure` via [src/lib/cookie-secure.ts](src/lib/cookie-secure.ts). |
| PWA | Deferred indefinitely — app is fully server-dependent, offline adds no value, player base is small. |

## Repository

- Remote (as of last setup): `https://github.com/avivais/irba` — confirm with `git remote -v`.

## What exists today

### Data model (Prisma)

- **`Player`**: name, unique `phone` (normalized Israeli mobile `05xxxxxxxx`), `playerKind` (`REGISTERED` | `DROP_IN`, UI labels **קבוע** / **מזדמן**), `positions` (`Position[]`, multi-value array, default `[]`), optional `rank`, `balance`, `isAdmin`.
- **`GameSession`**: `date`, `maxPlayers` (default 15), `isClosed`, `durationMinutes Int?` (null = use config default), `locationName String?`, `locationLat Float?`, `locationLng Float?`.
- **`Attendance`**: links player ↔ session, `createdAt` for RSVP order (confirmed = first `maxPlayers` by time; rest = waiting list).
- **`AppConfig`**: `key String PK`, `value String`, `updatedAt`. Stores all admin-editable settings; fetched via `getAllConfigs()` (single round-trip, merged with `CONFIG_DEFAULTS`).
- **`HourlyRate`**: `id`, `effectiveFrom DateTime @db.Date`, `pricePerHour Float`. Multiple rows; newest `effectiveFrom ≤ today` is the active rate. List managed inline on `/admin/config`; add/edit on `/admin/config/rates/new` and `/admin/config/rates/[id]/edit`.
- **`AuditLog`**: `id Int PK autoincrement`, `timestamp DateTime`, `actor String` ("admin" | player phone | "cron"), `actorIp String?`, `action String` (enum-like constant e.g. `CREATE_PLAYER`), `entityType String?`, `entityId String?`, `before Json?`, `after Json?`. Indexed on `timestamp DESC`, `action`, `(entityType, entityId)`, `actor`. Written fire-and-forget via `src/lib/audit.ts`.

### RSVP flow (public)

- Home page (`/`): **dynamic** server render — next open game, Hebrew copy, **”אני מגיע”** form (name + phone). Shows **location card** with name + Waze + Google Maps buttons + OpenStreetMap iframe minimap when lat/lng are set. Responsive width: `max-w-lg` on mobile, `max-w-2xl` on `md+`.
- **Theme**: `ThemeProvider` in `layout.tsx`; `ThemeToggle` (popup button) still exists but is no longer in the nav. Theme is changed via `ThemeSelector` (`src/components/theme-selector.tsx`) — an inline 3-button row (כהה / מערכת / בהיר) in the profile page "מראה" section.
- **`normalizePhone`** in `src/lib/phone.ts` — strips non-digits, strict `/^05\d{8}$/` (no `972` rewrite).
- **RSVP window**: registration open until `session.date` (not the close window). `isRsvpOpen = !isClosed && now < session.date`. Close window (`rsvp_close_hours`) only affects cancellation for confirmed players.
- **Cancellation rules**: waitlisted players can always cancel; confirmed players cannot cancel within the close window (`now >= session.date - closeHours * 3_600_000`). Amber notice shown when cancellation is blocked ("ביטול הרשמה אינו אפשרי בשלב זה — פנה למנהל").
- Server actions: attend (find-or-create player, transactional RSVP), cancel (session-bound `playerId`, checks player index vs maxPlayers + close window); per-IP sliding-window rate limits (`src/lib/rate-limit.ts`, tunable `IRBA_RL_*`).
- **Cancel RSVP**: inline two-step confirmation (“האם לבטל את ההגעה?” + “כן, בטל” / “לא”) — no `window.confirm`. Success banner auto-dismisses after 3 s (tracked by state reference, not a boolean flag).
- **RSVP success banner** (“נרשמת בהצלחה”) auto-dismisses after 3 s.
- Lists: confirmed + waiting list; phones **masked** in UI; optional **”מזדמן”** badge for drop-ins.

### Admin (authenticated — full CRUD)

- **`/admin/login`** — redirects to `/` (no longer needed; player auth handles admin login via `isAdmin` bridge). Route groups: `(public)/login` vs `(protected)/` with layout auth guard.
- **Session**: separate HttpOnly JWT cookie (`jose` HS256), env `ADMIN_SESSION_SECRET` (min 32 chars, distinct from RSVP; generate with `npm run generate-admin-secret`), default `iss`/`aud` overridable via `ADMIN_JWT_ISSUER` / `ADMIN_JWT_AUDIENCE`; default **14-day** TTL (`ADMIN_SESSION_MAX_AGE_SEC` optional).
- **Credentials**: `ADMIN_PASSWORD_HASH` (bcrypt only in env); set via `npm run hash-admin-password` — writes `.env` with single-quoted `\$` escaping so Next’s dotenv-expand preserves the hash (`scripts/hash-admin-password.ts`).
- **Rate limit**: admin login uses `consumeAdminLoginRateLimit` (`IRBA_RL_ADMIN_LOGIN_MAX` / `IRBA_RL_ADMIN_LOGIN_WINDOW_MS`).
- **Dev diagnostics**: in `NODE_ENV=development`, the login server action logs each step to the terminal (env raw/normalized values, secret status, bcrypt result, cookie outcome) — never in production.
- **Shared cookie `Secure` flag**: [src/lib/cookie-secure.ts](src/lib/cookie-secure.ts) (same `RSVP_COOKIE_SECURE` / production behavior as RSVP).

#### Admin home (`/admin`)

Navigation cards to שחקנים, מפגשים, ייבוא נתונים, הגדרות, and **לוג פעולות** sections (קדימות card removed — merged into שחקנים); logout button. All nav cards and the logout button have `active:` press states.

#### Players CRUD (`/admin/players`) — unified with Precedence

- **List** (`/admin/players`): all players **sorted by precedence score descending**; ranked #1…N on the left. Shows kind badge (**קבוע** / **מזדמן**), positions, phone (clickable `wa.me` link — opens WA DM in new tab), balance (coloured; formatted `₪N` / `-₪N` with `dir="ltr"` so minus/₪ always on correct side), current-year attendance with fraction `(attended/total sessions)`, and total precedence score inline in the subscript. Edit button + delete button; full-row click navigates to edit. **משקלות** button in header links to `/admin/precedence/weights`. **Add player** button is a circular `+` icon (no label) — saves space on mobile. Same circular `+` pattern used across sessions and weights list pages. Loading state: spinner + freeze overlay (`PlayerList` client component, `src/components/admin/player-list.tsx`).
- **Add** (`/admin/players/new`): form with phone, playerKind, positions (multi-select checkboxes — PG / SG / SF / PF / C, English-only), rank, balance, isAdmin, nickname, name fields (He/En), birthdate. Balance field uses `type="text"` + `inputMode="numeric"` (not `type="number"`) — browsers drop intermediate `-` in number inputs. **Birthdate**: dual-input pattern — visible text input displaying `dd.mm.yyyy` (Israeli format) + hidden `type="date"` input for canonical `YYYY-MM-DD`; calendar icon button calls `hiddenRef.showPicker()` to open native date picker. Picker works on desktop Chrome and mobile iOS; display always shows Israeli format regardless of browser locale. **Cancel button** (red, outside form) + **back button** (→ חזרה לרשימה) at top of form — both trigger dirty-guard confirm dialog when any field has been touched. Popstate guard active for create mode.
- **Edit** (`/admin/players/[id]/edit`): player name + precedence rank/score shown in header (`מקום N · ניקוד X`). Same player form; phone disabled. Dual save buttons: **שמור שינויים** (stay) + **שמור וחזור לרשימה**. Cancel button + back button with dirty-guard confirm. Popstate guard active. **Precedence sections below the form:** current-year live attendance (read-only, auto-counted), historical aggregates (upsert/delete per year), bonuses/fines (adjustments) with add/edit/delete.
- **Delete**: guarded — blocked if player has any attendance records (count shown in tooltip); `window.confirm` for players with 0 attendances. Server action (`deletePlayerAction`) double-checks count before deleting.
- **Server actions**: `createPlayerAction`, `updatePlayerAction`, `deletePlayerAction` in `src/app/admin/(protected)/players/actions.ts`. All call `requireAdmin()` (session guard) before any DB access.
- **Validation**: `src/lib/player-validation.ts` — `parsePlayerForm` with per-field Zod + phone normalization; tested in `src/lib/player-validation.test.ts`.

#### Sessions CRUD (`/admin/sessions`)

- **List** (`/admin/sessions`): client component (`SessionList`); full-row invisible Link with loading spinner; row hover/active highlight. Shows date, attendance count / maxPlayers, status badge (**פתוח** / **סגור** / **ארכיון**). Row actions: archive/unarchive button + delete button. Filter bar: date range pickers (`from`/`to` URL params), "הצג ארכיון" checkbox, search/clear. Archived sessions excluded from `getNextGame()`.
- **Archive**: `GameSession.isArchived Boolean @default(false)` (migration `20260329113136_add_session_archived`). `archiveSessionAction(id, archive)` in `sessions/actions.ts`. `SessionArchiveButton` component (`session-archive-button.tsx`) with Archive / ArchiveRestore icon.
- **Add** (`/admin/sessions/new`): form with date (pre-filled to next occurrence of config default day/time), maxPlayers (default 15), durationMinutes (pre-filled from config), locationName/locationLat/locationLng (pre-filled from config). `nextDefaultSessionDateISO` in `session-validation.ts` computes the correct next slot (same-day only if session time is still upcoming, else next week). On create, redirects to `/admin/sessions/${newSessionId}`.
- **Edit / detail** (`/admin/sessions/[id]`): **unified page** — replaces separate `/[id]/edit`. Header: back link + formatted date in h1 + archive/delete buttons. Session form card (always visible, success message shown inline). Attendance card: confirmed list + precedence-sorted waitlist + add-player form + quick drop-in form. Old `/[id]/edit` redirects here.
- **`isClosed` toggle**: `toggleSessionAction` — blocks re-opening if `Date.now() >= session.date - rsvp_close_hours * 3_600_000 && Date.now() < session.date`. isClosed is a checkbox in the SessionForm.
- **Delete**: guarded — blocked if session has any attendance records. `window.confirm` for empty sessions.
- **Overlap guard**: `createSessionAction` rejects if any session started in the last 24 h is still running (`session.date + (durationMinutes ?? configDefault) > now`). Message: `"לא ניתן לפתוח מפגש חדש לפני שהמפגש הנוכחי הסתיים"`.
- **Auto-register admin**: on session create, the player with `isAdmin=true` is automatically added as an attendee (if found).
- **Server actions**: `createSessionAction`, `updateSessionAction`, `deleteSessionAction`, `toggleSessionAction`, `archiveSessionAction` in `src/app/admin/(protected)/sessions/actions.ts`.
- **Validation**: `src/lib/session-validation.ts` — `parseSessionForm` + `parseIsraelLocalDate` + `nextDefaultSessionDateISO`; tested in `src/lib/session-validation.test.ts`.
- **Duplicate guard**: `createSessionAction` and `updateSessionAction` reject a session if another already exists on the same Israel calendar day; edit excludes the session being updated.
- **Attendance management** (on `/admin/sessions/[id]`):
  - Confirmed list + precedence-sorted waitlist (registered by score desc, drop-ins by createdAt asc).
  - **Add registered player**: `SessionAddPlayerForm` — searchable dropdown from all players not yet attending.
  - **Quick drop-in**: `SessionQuickDropInForm` — name + phone fields. On valid phone, calls `lookupPlayerByPhoneAction` (via `useTransition`) and shows inline status: **already_registered** (red, button disabled) / **existing_not_registered** (blue "שחקן קיים: [name]", name field hidden) / **new** (name field required). `quickAddDropInAction` uses `findUnique` + `create` — never modifies existing player data.
  - **Remove player**: `SessionRemoveButton` with confirmation.

#### Hourly rates (inline on `/admin/config`)

- Rates list rendered inline at the top of the config page card — same page, no separate nav.
- Current rate (newest `effectiveFrom ≤ today`) highlighted in green with "נוכחי" badge; all historical rates shown below.
- Add → `/admin/config/rates/new`; Edit → `/admin/config/rates/[id]/edit`; Delete inline with `window.confirm`.
- Duplicate-date guard on create and update.
- Components: `HourlyRateForm` (client, shared by new/edit), `HourlyRateDeleteButton` (client).
- Server actions in `src/app/admin/(protected)/config/rates/actions.ts`; redirects back to `/admin/config`.

#### Config system (`/admin/config`)

- **`src/lib/config-keys.ts`** — client-safe constants: `CONFIG` key map, `ConfigKey` type, `CONFIG_DEFAULTS`. No Prisma/Node.js imports; safe to import from client components.
- **`src/lib/config.ts`** — server-side: re-exports from `config-keys.ts` + `getConfigValue`, `getAllConfigs`, `getConfigInt`, `getConfigFloat`, `setConfigs`, `googleMapsUrl`, `wazeUrl`.
- **`src/lib/config-validation.ts`** — Zod schema for all 11 keys with Hebrew error messages; `parseConfigForm`.
- **Admin UI** (`/admin/config`): grouped settings form — מפגשים, לוח זמנים, מיקום, שחקנים, משחקים, תעריף שעתי (past rates collapsed), חיוב, וואטסאפ. Server action `updateConfigAction` upserts all keys in a transaction.

**Config keys:**
| Key | Default | Purpose |
|-----|---------|---------|
| `session_schedule_day` | `1` (Monday) | Day-of-week — used for both manual session pre-fill and auto-create |
| `session_schedule_time` | `21:00` | Time HH:MM — used for both manual session pre-fill and auto-create |
| `session_default_duration_min` | `120` | Session duration (minutes) |
| `rsvp_close_hours` | `13` | Hours before start that RSVP auto-closes |
| `location_name` | Ilan Ramon school court | Default location display name |
| `location_lat` / `location_lng` | `""` | GPS coordinates for map links |
| `dropin_charge` | `40` | Drop-in flat charge (ILS) |
| `debt_threshold` | `10` | Debt ILS above which registered player is charged as drop-in |
| `default_player_rank` | `50` | Rank for players with no rank set |
| `match_win_score` | `12` | Points to win a match |
| `session_schedule_enabled` | `"false"` | Enable auto-create cron |
| `session_auto_create_hours_before` | `"48"` | Hours before session that RSVP opens (auto-create fires) |

> `session_default_day` and `session_default_time` were removed — `session_schedule_day/time` are now the single source of truth for both UI pre-fill and auto-create.

#### Precedence — רשימת קדימות (unified into `/admin/players`)

**Data model** (migration `20260323180203_precedence`):
- **`YearWeight`**: calendar `year` (Int, PK) → `weight` (Float). Controls how much each past year counts.
- **`PlayerYearAggregate`**: `(playerId, year)` unique — stores historical attendance count for years before live tracking. Not created for the current year (counted from live `Attendance` rows).
- **`PlayerAdjustment`**: `id`, `playerId`, `date`, `points` (Float, signed), `description` (String). Covers bonuses (+) and fines (−).

**Score formula** (`src/lib/precedence.ts`):
```
score = Σ(aggregate.count × yearWeight) + liveCurrentYearCount × currentYearWeight + Σ(adjustment.points)
```
Current year is auto-counted from live `Attendance` records; no `PlayerYearAggregate` row needed for it.

**Admin UI (merged into players):**
- **`/admin/players`** — players list sorted by precedence score; `/admin/precedence` redirects here.
- **`/admin/players/[id]/edit`** — player edit page includes full precedence editing (aggregates + adjustments); `/admin/precedence/[playerId]` redirects here.
- **`/admin/precedence/weights`** — year weights CRUD (list with row-click/hover like players list, new, edit, delete). Back link → `/admin/players`. Component: `YearWeightList` (`src/components/admin/year-weight-list.tsx`).
- **`/admin/precedence/[playerId]/adjustments/new`** and **`.../[adjId]/edit`** — adjustment forms (date, points, description); back link → `/admin/players/[id]/edit`.
- **Server actions**: in `src/app/admin/(protected)/precedence/[playerId]/actions.ts` (aggregate upsert/delete, adjustment create/update/delete — all revalidate and redirect to `/admin/players/[id]/edit`) and `weights/actions.ts`.
- **Validation**: `src/lib/adjustment-validation.ts`, `src/lib/year-weight-validation.ts`; tested in `src/lib/precedence.test.ts` (10 cases).

### Security / abuse (MVP)

- **Cookies**: HTTP-only, `sameSite=lax`, `Secure` in production or when `RSVP_COOKIE_SECURE` is set; JWT verifies `iss` / `aud` (defaults `irba` / `irba-rsvp`).
- **Rate limits**: in-memory per process for attend vs cancel and **admin login**; client IP from `CF-Connecting-IP`, `X-Real-IP`, or first `X-Forwarded-For` hop (configure your reverse proxy).
- **Response headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and full **CSP** (`default-src 'self'`, `script-src 'self' 'unsafe-inline'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `frame-ancestors 'none'`) via `next.config.ts`.

### Ops / DX

- **`GET /api/health`** — JSON; 200 if DB answers `SELECT 1`, else 503 (generic body, no secrets). Response includes `version` field (git commit hash injected at build time via `NEXT_PUBLIC_COMMIT_HASH`).
- **Favicon / icons**: `src/app/icon.svg` (desktop SVG favicon), `src/app/icon.png` (48×48 PNG fallback), `src/app/apple-icon.png` (180×180 PNG, served as `apple-touch-icon` for iOS Safari / Add to Home Screen). PNGs generated from icon.svg via sharp.
- **Docker**: `docker-compose.yml` with 3 services: `db` (Postgres 16-alpine), `app` (Next.js on `127.0.0.1:3004`), `wa` (Baileys/Express sidecar on internal port 3100). `Dockerfile` uses `output: standalone` — runner stage copies `.next/standalone` to WORKDIR so `server.js` sits at `/app/server.js` alongside `public/` and `.next/static/`. `docker-entrypoint.sh` runs `prisma migrate deploy` then `exec node server.js`. `init: true` on the app service uses Docker's built-in tini as PID 1 to reap zombie processes.
- **Deploy**: `./scripts/deploy.sh` — pre-deploy DB backup, then SSH to EC2: `git pull → COMMIT_HASH=$(git rev-parse --short HEAD) docker compose build → docker compose up -d → prisma migrate deploy`. See `RUNBOOK.md` for full ops guide.
- **Versioning**: `COMMIT_HASH` build arg passed through `docker-compose.yml` → `Dockerfile` → baked as `NEXT_PUBLIC_COMMIT_HASH` at `next build` time. Displayed as a subtle footer on all admin pages and in the `/api/health` response.
- **Production**: live at `https://irba.sportgroup.cl` (EC2 → Apache TLS → localhost:3004).
- **Backup**: `scripts/backup.sh` — `pg_dump | gzip`, 30-day retention. Runs daily at 03:00 via EC2 cron.
- **Logging**: cron auto-create/auto-close both run via wrapper scripts (`/opt/irba/scripts/cron-auto-create.sh`, `cron-auto-close.sh`) that add `[YYYY-MM-DD HH:MM:SS]` prefix + newline per entry → `/opt/irba/cron.log`. Both `cron.log` and `backups/backup.log` are rotated daily, 30-day retention, via `/etc/logrotate.d/irba`. Docker container logs rotate automatically via global `/etc/docker/daemon.json` (10 MB max, 3 files).
- **Process management**: `npm start` writes PID to `.next.pid`; `npm run web` / `npm run startweb` / `npm run buildandstartweb` write cloudflared's PID to `.cloudflared.pid`; `npm stop` kills both by PID file (project-scoped).
- **Seeds**: deterministic `prisma/seed.ts` (`npm run db:seed`); random QA script `scripts/seed-random.ts` (`npm run db:seed:random`) with env guards — see README.
- **CI**: GitHub Actions workflow above; confirm runs in the repo **Actions** tab after push.

### WhatsApp sidecar (`wa/`)

Separate Docker service (`wa` in `docker-compose.yml`) — Baileys + Express on internal port 3100. Next.js POSTs to sidecar endpoints; if `wa` is down, calls are best-effort (logs, doesn't throw).

- `GET /status` → `{ ready: boolean }` — health probe
- `POST /send` → `{ to: "05xxxxxxxx", message: "text" }` — individual DM
- `POST /send-group` → `{ groupId: "XXXXXXXXXX@g.us", message: "text" }` — group broadcast
- `GET /groups` → `[{ id, subject }]` — list groups the bot is in; used by admin group-search UI
- Phone normalization: `05xxxxxxxx → 972xxxxxxxx@s.whatsapp.net`
- Session persisted to `/opt/irba/wa-session/` (bind-mounted volume); survives deploys
- First run: QR printed to stdout → admin scans once with dedicated WA account
- Controlled by `WA_NOTIFY_ENABLED=true` env var (default off; set `true` on EC2)

**`src/lib/wa-notify.ts`** — typed notification dispatcher; `renderTemplate` for `{placeholder}` substitution; per-type high-level functions route to group or individual DM.

**Notification config** — all settings in `AppConfig` (admin-editable at `/admin/config` → "וואטסאפ" section):
- `wa_group_jid` — group JID for broadcasts (format `XXXXXXXXXX@g.us`; leave empty to disable group notifications). **"חפש קבוצה"** button in the config form fetches the group list from the sidecar (`/groups`), shows a filterable inline picker, and fills the JID field on click — no manual JID extraction needed.
- Per event: `wa_notify_{type}_enabled` + `wa_notify_{type}_template`
- Master kill switch: `WA_NOTIFY_ENABLED` env var

**Notification triggers:**
| Trigger | Recipient | Default on |
|---------|-----------|-----------|
| Session open (auto-create cron or manual create) | WA group broadcast | ✅ |
| Session closed (admin toggle) | WA group broadcast | ❌ |
| Player registered (public RSVP) | WA group broadcast | ❌ |
| Player cancelled (public RSVP) | WA group broadcast | ❌ |
| Admin promotes waitlisted player | Individual DM to player | ✅ |

**Per-session override** — `/admin/sessions/new` form has a collapsible "התראות וואטסאפ" section (pre-filled from global config) to override session-open notification for that session only.

**Bot status & re-link** — `WaBotStatus` component rendered at the top of the `/admin/config` WA section. Shows green/red connection dot, QR code when disconnected (auto-refreshes every 15s as Baileys regenerates), logout button when connected. Calls `fetchWaStatusAction` on mount and polls every 15s; `logoutWaAction` clears session and triggers reconnect for a fresh QR. All WA management (status, JID config, notifications, manual send) is in one place.

**Manual group send** — `/admin/config` WA section (visible only when `wa_group_jid` is set) has a free-text textarea + "שלח" button (`sendWaGroupMessageAction`). Calls the sidecar directly (bypasses `WA_NOTIFY_ENABLED` kill switch) — useful for ad-hoc messages and smoke-testing the pipeline.

### Auto-create cron (`GET /api/cron/auto-create`)

Idempotent endpoint called hourly by EC2 cron. Bearer-token auth (`CRON_SECRET`). Logic:
1. Check `SESSION_SCHEDULE_ENABLED=true` in AppConfig
2. Compute next scheduled session datetime (`src/lib/schedule.ts` — DST-safe via `Intl.DateTimeFormat`)
3. If `now >= sessionTime - autoCreateHours` and no session exists for that Israel day → create session + notify WA group (if `wa_notify_session_open_enabled` and `wa_group_jid` set)
4. Otherwise → `{ created: false, reason }` (idempotent)

EC2 cron: `0 * * * * curl -s -H "Authorization: Bearer ..." https://irba.sportgroup.cl/api/cron/auto-create`

Core logic extracted to `src/lib/auto-create-session.ts` (`autoCreateNextSession({ force? })`). The cron route calls it normally; the admin config page has a **"הרץ עכשיו"** button (in the "לוח זמנים" section) that calls `runAutoCreateAction` with `force: true` to bypass the lead-time window check. Result shown as a toast.

### Auto-close cron (`GET /api/cron/auto-close`)

Idempotent endpoint called **every minute** by EC2 cron. Bearer-token auth (`CRON_SECRET`). Logic:
1. Fetch `session_default_duration_min` from AppConfig
2. Find all sessions where `isClosed = false AND isArchived = false`
3. For each, compute `endTime = date + (durationMinutes ?? defaultDuration) minutes`
4. If `endTime <= now` → set `isClosed = true`, write `CLOSE_SESSION` audit log (actor: "cron", after: `{ reason: "auto_close" }`), notify WA group
5. Returns `{ closed: string[], skipped: number }`

EC2 cron: `* * * * * /opt/irba/scripts/cron-auto-close.sh`

Core logic in `src/lib/auto-close-sessions.ts` (`autoClosePastSessions()`).

### Tests

- Unit tests: `phone`, `maskPhone`, `rate-limit` (including admin login), `admin-session`, `bcryptjs` verify, mocked `checkDatabase` (`src/lib/*.test.ts`, `src/lib/health.test.ts`).
- **Player validation tests** (`src/lib/player-validation.test.ts`): 25 cases covering all fields, phone normalization, rank/balance boundaries, multi-position array (valid/invalid values, single-string coercion, empty), isAdmin flag.
- **Session validation tests** (`src/lib/session-validation.test.ts`): 16 cases covering date parsing (including Israel timezone DST conversion), maxPlayers bounds, isClosed flag.
- **Precedence tests** (`src/lib/precedence.test.ts`): 10 cases covering score formula (zero state, aggregates only, live count, adjustments, combined), edge cases (missing weight, negative adjustments, fractional weights).
- **Schedule tests** (`src/lib/schedule.test.ts`): 10 cases — today/tomorrow/multi-day skip, same-weekday-just-passed, DST winter/summer, midnight/23:59 edge cases. Uses `Intl.DateTimeFormat` with `% 24` normalization for older ICU versions.
- **Waitlist promote tests** (`src/lib/waitlist-promote.test.ts`): 8 cases — promote moves to last confirmed slot, error on confirmed player, error on missing attendance.
- Default `npm test` does **not** require a running Postgres.

#### Audit log (`/admin/audit`)

Persistent action log covering every mutation in the system.

**Helper** (`src/lib/audit.ts`): `writeAuditLog({ actor, actorIp?, action, entityType?, entityId?, before?, after? })` — fire-and-forget, never throws, never blocks the caller. `before`/`after` are JSON snapshots.

**Instrumented call sites (37 total)** — every server action that mutates state:
- **Auth**: `ADMIN_LOGIN`, `ADMIN_LOGIN_FAIL` (with reason: `rate_limited` / `wrong_password` / `no_hash_configured` / `bcrypt_error` / `cookie_error`), `ADMIN_LOGOUT`
- **Players**: `CREATE_PLAYER`, `UPDATE_PLAYER` (with `before` snapshot), `DELETE_PLAYER` (with `before` snapshot)
- **Sessions**: `CREATE_SESSION`, `UPDATE_SESSION` (with `before`/`after`), `DELETE_SESSION` (with `before`), `ARCHIVE_SESSION`, `UNARCHIVE_SESSION`, `OPEN_SESSION`, `CLOSE_SESSION`, `ADD_ATTENDANCE`, `REMOVE_ATTENDANCE` (with `before`)
- **Precedence**: `CREATE_ADJUSTMENT`, `UPDATE_ADJUSTMENT` (with `before`/`after`), `DELETE_ADJUSTMENT` (with `before`), `UPSERT_AGGREGATE` (with `before`/`after`), `DELETE_AGGREGATE`
- **Year weights**: `CREATE_YEAR_WEIGHT`, `UPDATE_YEAR_WEIGHT` (with `before`/`after`), `DELETE_YEAR_WEIGHT` (with `before`)
- **Config**: `UPDATE_CONFIG` (full `before`/`after` of all config keys), `CREATE_RATE`, `UPDATE_RATE` (with `before`/`after`), `DELETE_RATE` (with `before`)
- **WA / system**: `SEND_WA_MESSAGE` (with message text + JID), `WA_LOGOUT`, `RUN_AUTO_CREATE` (with result), `AUTO_CREATE_SESSION` (actor: "cron")
- **Import**: `IMPORT_PLAYERS`, `IMPORT_PAYMENTS`, `IMPORT_AGGREGATES` (with `imported` count + `errorCount`)
- **Public RSVP**: `RSVP_ATTEND` (actor = player phone + IP, with session + status), `RSVP_CANCEL` (actor = player phone + IP)

**Admin page** (`/admin/audit`): server-rendered, 75 entries/page.
- **Filters** (URL params): `action` dropdown, `entity` type dropdown, `actor` text field, `from`/`to` date range, `q` free-text (searches `entityId` + `actor`); clear link when any filter active.
- **Table** (`AuditLogTable` client component): color-coded action badges (green=creates, blue=updates/state-changes, red=deletes, purple=admin auth, violet=player auth, amber=OTP events, indigo=imports, teal=WA/system), actor badge (purple=admin, zinc=cron, amber=player phone), IP sub-label. **Responsive**: entity column hidden on mobile (`hidden sm:table-cell`), action badge truncated, no forced min-width — no horizontal scroll on 430px.
- **Expandable rows**: clicking anywhere on a row (that has details) reveals a `JsonDiff` table — for objects shows each field with `before` / `after` columns, changed rows highlighted amber; for raw JSON shows pre blocks. No-details rows show a dot indicator instead of chevron. The chevron icon is decorative (`aria-hidden`); the `<tr>` itself carries the `onClick`.
- **Pagination**: prev/next links with page N of M counter.

#### Import pipeline (`/admin/import`)

Migrates historical Sheets data into the DB. Three flows, each with **file upload** or **paste CSV** input (tab switcher), client-side parse → preview table (✓/✗ per row) → confirm → server action.

**Player fields added** (migration `20260324104857_add_player_fields_and_payment`):
- `nickname String?` — primary matching key for all CSV imports; indexed
- `firstNameHe`, `lastNameHe`, `firstNameEn`, `lastNameEn` (`String?`) — name components
- `birthdate DateTime?`

**New `Payment` model** (same migration): `playerId`, `date`, `amount: Int` (NIS, signed), `description?`.

**Import flows:**

| Flow | Route | CSV format | Key |
|------|-------|-----------|-----|
| שחקנים | `/admin/import/players` | `nickname,firstNameHe,lastNameHe,firstNameEn,lastNameEn,phone,birthdate,playerKind,positions` | upsert by `phone`; update by `nickname` if no phone |
| נוכחות עבר | `/admin/import/aggregates` | Wide: `nickname,2021,2022,…` | upserts `PlayerYearAggregate(playerId, year)` |
| תשלומים | `/admin/import/payments` | Wide: `date,אבי,עידן,…` | creates `Payment` rows |

**CSV parsing** (`src/lib/csv-import.ts`): `parsePlayersCsv`, `parseAggregatesCsv`, `parsePaymentsCsv` — pure functions, no DB, reuse `normalizePhone`. RFC 4180 quoted-field parser (handles `"PG,SG"` multi-value cells). Birthdate accepts ISO (`YYYY-MM-DD`) and Israeli (`D.M.YY` / `D.M.YYYY`) formats. Tested in `src/lib/csv-import.test.ts` (30 cases).

**Input modes** (`src/components/admin/import-upload.tsx`): tab switcher — "העלה קובץ" (FileReader) or "הדבק טקסט" (textarea + parse button). Switching tabs resets preview. Optional `checkConflicts` prop triggers a conflict-review step before import: each conflicting row gets a **דלג / דרוס** (skip / overwrite) choice; only the decided rows are passed to `onImport`.

**Server actions**: `importPlayersAction`, `importAggregatesAction`, `importPaymentsAction` — each calls `requireAdmin()`, resolves nicknames to playerIds in batch, upserts/creates rows. `checkPlayerConflictsAction` — batch-checks incoming rows against existing phone + nickname; returns per-row conflict messages for the review step. Player import now upserts `positions` array.

**Results import** (תוצאות sheet) — deferred.

### Accessibility

All admin form label/input associations have been audited and fixed:
- `Field` component in `config-form.tsx` accepts `htmlFor` prop, propagated to its `<label>`; all 14 `Field` usages now pass `htmlFor={CONFIG.xxx}` with matching `id` on the input/select/textarea.
- Standalone WA Group JID label in `config-form.tsx` now has `htmlFor`/`id`.
- Group filter input uses `aria-label` (transient search widget, no visible label).
- Manual send textarea in `config-form.tsx` linked via `htmlFor="wa-send-message"`.
- `hourly-rate-form.tsx`: both labels now have `htmlFor` with matching `id` on inputs.
- `session-form.tsx`: WA override template label now linked to its textarea.
- `session-quick-dropin-form.tsx`: name + phone inputs have `aria-label` (compact inline form).
- `session-add-player-form.tsx`: player select has `aria-label`.

---

## What is not built yet

### Decisions & constraints

| Topic | Decision |
|--------|----------|
| **Admin auth (current)** | `ADMIN_PASSWORD_HASH` + HttpOnly JWT cookie — kept as bootstrap/fallback. Once user auth ships and the admin player account exists, this becomes obsolete. |
| **Player = User** | No separate User model. `Player` IS the user. Phone is the identity key — if admin pre-creates a player and they later register, they link by phone. |
| **`Player.isAdmin`** | Grants full admin access when the player logs in via user auth. One admin today. |
| **WhatsApp** | Baileys library, dedicated SIM. Used for OTP delivery, all notifications (session open, waitlist promotion, admin alerts). WA group integration deferred. |
| **Balance** | Fully computed from `Payment` and `SessionCharge` history — never stored directly. Prevents drift. Opening balances handled via a payment record at import time. |
| **Cascade recalc** | Editing any past `SessionCharge` triggers chronological re-evaluation of all subsequent sessions for all players (because running balance at each session determines charge tier). |
| **Admin court cost** | Admin is charged like any registered player for their session share. Financial dashboard shows aggregate: total court costs charged vs. total collected vs. outstanding gap. |
| **Waitlist order** | Registered players sorted by precedence score descending, then drop-ins by `createdAt` ascending. Promotion is manual (admin picks from sorted list). |
| **PWA** | Deferred indefinitely — app is fully server-dependent, offline adds no value. |
| **Results import** | (תוצאות sheet) deferred. |

---

### Feature roadmap — ordered by priority

Each area lists its logical commits in sequence. Commits should be human-sized and independently reviewable.

---

#### 1. Config system ✅ DONE

See "Config system" and "Hourly rates" sections under "What exists today".

---

#### 2. Session enhancements ✅ DONE

- ✅ Schema migration: `durationMinutes`, `locationName`, `locationLat`, `locationLng` on `GameSession`
- ✅ Schema migration: `isArchived Boolean @default(false)` on `GameSession`
- ✅ Config integration: session create form pre-fills date/duration/location from `AppConfig`
- ✅ Map links: Google Maps + Waze shown in admin form and on public page when lat/lng set
- ✅ OpenStreetMap iframe minimap on public page location card
- ✅ Session creation constraint: block if any session started in last 24h is still running
- ✅ Auto-register admin (`isAdmin=true` player) on session create
- ✅ RSVP enforcement: registration open until `session.date`; close window blocks cancel for confirmed only
- ✅ Unified session detail/edit page (`/admin/sessions/[id]`)
- ✅ Sessions list: row-click navigation, hover effect, archive filter, date range filter
- ✅ Archive/unarchive sessions; archived excluded from public next-game
- ✅ Admin session detail: attendee list + precedence-sorted waitlist
- ✅ Add registered player to session (searchable dropdown)
- ✅ Quick drop-in: phone lookup before submit, never overwrites existing player data
- ✅ Remove player from session (with confirmation)

**Remaining (all done):**
- ✅ Manual waitlist promote action — `promoteWaitlistAction` in `sessions/[id]/actions.ts`; re-timestamps attendance to last confirmed slot; "קדם" button on each waitlisted row; WA notification to promoted player.

---

#### 3. User auth ✅ DONE

Player = User. Phone is the identity. Two registration paths, both on the public site.

**Schema additions to `Player`:**
- `email String?`, `nationalId String?` (9-digit Israeli ID)
- `passwordHash String?`, `otpCode String?`, `otpExpiresAt DateTime?`
- `emailVerified Boolean default false`

**Flows:**
- **Phone + OTP:** enter phone → WhatsApp OTP sent → verify → set password + email + nationalId on first login
- **Phone + password:** enter phone + password; falls back to OTP if no password set
- **Remember me:** 10-year persistent cookie vs. session cookie (12h JWT)
- **Password reset:** phone → WhatsApp OTP → set new password
- **Change/set password:** available from `/profile` — "הגדרת סיסמה" if no password yet, "שינוי סיסמה" if one exists (requires current password); `changePasswordAction` server action + `ChangePasswordForm` client component (`src/components/change-password-form.tsx`)
- **Email:** stored, used as fallback notification channel (not primary)
- **`isAdmin=true`** players → full admin access; existing `ADMIN_PASSWORD_HASH` auth kept as fallback
- **Login location:** `/login` route redirects to `/`; `/admin/login` also redirects to `/`; login form (`PlayerLoginForm`) embedded inline on the homepage when not authenticated; all logout paths redirect to `/`
- **Navigation:** unified sticky top nav (`PlayerNav` server component, `src/components/player-nav.tsx`) rendered on all pages (homepage, profile, all admin pages via protected layout) — shows IRBA brand (sole home link), Profile icon, Admin icon (if `isAdmin`), Logout; active page highlighted via `NavLinks` client component (`src/components/nav-links.tsx`, uses `usePathname()`); no ThemeToggle in nav
- **Logout:** `playerLogoutAction` clears both player session cookie AND admin session cookie, then redirects to `/`. `adminLogoutAction` also redirects to `/`
- **Admin layout guard:** redirects unauthorized users to `/` (not `/admin/login`)

**Israeli ID validation (`src/lib/israeli-id.ts`):**
Luhn-like check-digit: pad to 9 digits, alternate ×1/×2, subtract 9 if >9, sum % 10 === 0.

**Commits:**
1. Schema migration: auth fields on `Player`
2. `src/lib/israeli-id.ts` + tests
3. OTP generation/verification logic (WA delivery wired in step 4)
4. Phone+OTP registration/login flow (UI + actions)
5. Phone+password registration/login flow (UI + actions)
6. Password reset flow
7. Remember me + session cookie handling
8. `isAdmin` → admin access; bridge from old `ADMIN_PASSWORD_HASH` auth

---

#### 4. WhatsApp integration *(Baileys)* — ✅ DONE

**Done (production):**
- ✅ Baileys sidecar service (`wa/`) — Express on port 3100, session persistence, QR auth; `POST /send-group` + `GET /groups` added
- ✅ `src/lib/wa-notify.ts` — typed dispatcher, `renderTemplate`, per-event notify functions
- ✅ Configurable notification system — admin-editable toggles + templates + group JID in `/admin/config`
- ✅ Session open notification → WA group broadcast (cron + manual create, with per-session override)
- ✅ Session close notification → WA group broadcast
- ✅ Player registered/cancelled → WA group broadcast (with confirmed/waitlisted status)
- ✅ Waitlist promotion notification → individual DM to promoted player

**Remaining:** none — OTP delivery wired in `requestOtpAction` / `requestPasswordResetAction` (shipped with step 3).

---

#### 5. Payments

**Schema:** Add `method` field to `Payment` — enum `CASH | PAYBOX | BIT | BANK_TRANSFER | OTHER`.

**Balance:** fully computed — `balance = Σ(payments.amount) - Σ(sessionCharges.amount)` for a player.

**Admin UI:**
- Per-player payment history page: add, edit, delete payments; method selector; balance shown live
- Admin financial dashboard: total charged across all sessions, total collected, outstanding gap

**Player-facing (after login):**
- Payment history + current balance shown on public page

**Municipality export:**
- Admin button → CSV of all players: full name + national ID (once collected via auth)

**Commits:**
1. Schema migration: `method` on `Payment`
2. `src/lib/balance.ts` — computed balance function
3. Admin per-player payment management UI
4. Admin financial dashboard (aggregate view)
5. Player-facing balance + payment history (requires user auth)
6. Municipality CSV export

---

#### 6. Charging

**New models:**
- `HourlyRate(id, effectiveFrom DateTime, pricePerHour Float)` — multiple rows, latest wins
- `SessionCharge(id, sessionId, playerId, amount Float, chargeType: REGISTERED | DROP_IN | ADMIN_OVERRIDE, createdAt, updatedAt)`
- `ChargeAuditLog(id, sessionChargeId, changedAt, changedBy, previousAmount, newAmount, reason?)` — every edit tracked

**Charge calculation engine (`src/lib/charging.ts`):**
- Resolve applicable hourly rate for session date
- Total cost = rate × duration (from session `startTime`/`endTime`)
- For each player at session time: compute running balance (all payments + charges strictly before `session.startTime`)
- Classify: drop-in flat if `playerKind=DROP_IN`; drop-in flat if registered and `runningBalance ≤ -threshold`; else split remainder equally
- Returns proposed `SessionCharge[]` — not written until admin confirms

**Session charge flow (admin):**
- “Charge session” button on session detail → shows proposed amounts per player
- Admin can edit any individual amount (type changes to `ADMIN_OVERRIDE`)
- Confirm → charges written; audit log entry created for each

**Cascade recalculation:**
- Triggered when any `SessionCharge` is edited after the fact
- Re-runs charge engine chronologically for all sessions after the edited session's date
- Rewrites `SessionCharge` amounts for all affected players; appends audit log entries
- Runs in a transaction; admin sees a summary of what changed before confirming

**Admin audit log viewer:**
- `/admin/charges/audit` — filterable by player, session, date range

**Commits:**
1. ✅ Schema migration: `HourlyRate` (done; `SessionCharge`, `ChargeAuditLog` still pending)
2. ✅ `HourlyRate` admin CRUD (inline list on `/admin/config`, add/edit on `/admin/config/rates/*`) — done
3. `src/lib/charging.ts` — computation engine + tests (various tier scenarios, threshold edge cases)
4. Session charge proposal UI (propose → edit → confirm)
5. `src/lib/cascade-recalc.ts` — cascade engine + tests
6. Cascade trigger on charge edit + confirmation dialog showing what will change
7. Audit log writes throughout
8. Audit log viewer UI

---

#### 7. Match results

**New model:** `Match(id, sessionId, teamAPlayerIds String[], teamBPlayerIds String[], scoreA Int, scoreB Int, createdAt)`

Winning team stays; next match teams are composed by admin from session attendees. Multiple matches per session. Teams editable after recording (players leave early, switch teams, etc.).

**Admin UI** on session detail page:
- “New match” → pick team A players, team B players from session attendees → record score
- Match history list for the session; edit any match

**Commits:**
1. Schema migration: `Match` model
2. Match creation UI + action
3. Score entry + match edit UI

---

#### 8. Balanced team selection

**Algorithm (`src/lib/team-balance.ts`):**
- Input: N players (≤15) with rank and positions; unranked use config default rank
- Goal: 3 teams, equal size (or ±1), total rank per team as close as possible, ideally 1 player per position per team
- Generate 3 distinct options using different random seeds / perturbations of the optimal split
- Output: 3 team configurations with rank sums per team

**Admin UI** on session detail:
- “Generate teams” → 3 options shown side by side with rank totals
- Each option copyable as formatted text (for WhatsApp poll)

**Commits:**
1. `src/lib/team-balance.ts` — algorithm + tests
2. Admin UI: team generation + display + copy

---

#### 9. Precedence-based waitlist (UI completion)

- Waitlist on session detail already sorted (step 2); this step wires precedence scores in
- “Promote” button next to each waitlisted player → moves to confirmed, triggers WA notification (step 4)
- If session is past auto-close window, promote is admin-only

**Commits:**
1. Wire precedence score into waitlist sort query
2. Manual promote action + WA notification trigger

---

### Platform (pre-production) — **DONE**

- ✅ Automated daily Postgres backups (`scripts/backup.sh`, 30-day retention, EC2 cron at 03:00)
- ✅ Ops runbook (`RUNBOOK.md`) — deploy, rollback, DB restore, WA re-auth, env vars, cron setup
- ✅ Health monitoring: `GET /api/health`; 200 = DB up, 503 = down
- ✅ CSP header in `next.config.ts`
- ✅ **Deployed**: `https://irba.sportgroup.cl` — EC2 → Apache TLS → localhost:3004 → Docker
- ✅ Auto-create cron running hourly on EC2
- ✅ Uptime alerts — UptimeRobot free tier, public status page: https://stats.uptimerobot.com/dHQF2WHXL9
- Redis rate limits — single replica, in-memory is fine for now

---

*Last updated: Apr 2026 — **Nav consistency + profile polish fully done.** `PlayerNav` now covers all pages including admin (via protected layout). Nav shows IRBA brand + Profile + Admin + Logout icons only (no player name, no Home duplicate, no ThemeToggle). Active page highlighted. Title uses LTR mark for correct display in narrow RTL tabs. Profile: no greeting, right-aligned phone, collapsible password form, inline `ThemeSelector`. Audit log responsive on mobile (entity column hidden on small screens). Next: payments (step 5).*
