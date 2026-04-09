# IRBA Manager — project state and next steps

Use this file to onboard or resume work in a new chat. For setup commands, see [README.md](./README.md).

## Table of Contents

- [Purpose](#purpose)
- [Stack](#stack)
- [Repository](#repository)
- [What exists today](#what-exists-today)
  - [Data model (Prisma)](#data-model-prisma)
  - [RSVP flow (public)](#rsvp-flow-public)
  - [Admin](#admin-authenticated--full-crud)
  - [Dynamic ranking](#dynamic-ranking-adminranking)
  - [WhatsApp sidecar](#whatsapp-sidecar-wa)
  - [Auto-create cron](#auto-create-cron-get-apicronauto-create)
  - [Auto-close cron](#auto-close-cron-get-apicronauto-close)
  - [Tests](#tests)
  - [Security / abuse](#security--abuse-mvp)
  - [Ops / DX](#ops--dx)
- [Decisions & Constraints](#decisions--constraints)
- [Feature history — Phase 1 (all shipped)](#feature-history--phase-1-all-shipped)
- [Phase 2 Roadmap — post-MVP features](#phase-2-roadmap--post-mvp-features)

---

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
| CI | GitHub Actions — `lint`, `test`, `build` on `push` / `pull_request` to `main` ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)); job `env` sets placeholder `DATABASE_URL`, `RSVP_SESSION_SECRET`, `PLAYER_SESSION_SECRET`, and `ADMIN_SESSION_SECRET` so Prisma / Next build load without Postgres in CI. |
| Admin auth | **Single identity model** — admin access is determined by `player.isAdmin` flag in DB, not a separate session. Players log in normally (phone + OTP or password); the player session cookie (`irba_player_session`) is the sole identity. Admin guard: `requireAdmin()` in `src/lib/admin-guard.ts` checks player session → DB `isAdmin`. The legacy `admin-session.ts` and shared admin password login are no longer used at runtime. |
| PWA | Deferred indefinitely — app is fully server-dependent, offline adds no value, player base is small. |

## Repository

- Remote (as of last setup): `https://github.com/avivais/irba` — confirm with `git remote -v`.

## What exists today

### Data model (Prisma)

- **`Player`**: name, unique `phone` (normalized Israeli mobile `05xxxxxxxx`), `playerKind` (`REGISTERED` | `DROP_IN`, UI labels **קבוע** / **מזדמן**), `positions` (`Position[]`, multi-value array, default `[]`), optional `rank`, `computedRank Float?` (blended 0–100 score, recalculated on rank/config/peer changes), `isAdmin`. No stored `balance` — balance is always computed: `Σ(payments.amount) - Σ(sessionCharges.amount)`.
- **`PeerRatingSession`**: `id`, `year Int @unique`, `openedAt`, `closedAt DateTime?`, `openedBy String` (playerId of admin). Admin-triggered annual survey; one open session at a time.
- **`PeerRating`**: `id`, `ratingSessionId`, `raterId`, `ratedPlayerId`, `position Int` (1 = best), `submittedAt`. Unique on `(ratingSessionId, raterId, ratedPlayerId)`; cascades on session delete.
- **`GameSession`**: `date`, `maxPlayers` (default 15), `isClosed`, `isCharged Boolean @default(false)`, `durationMinutes Int?` (null = use config default), `locationName String?`, `locationLat Float?`, `locationLng Float?`. Alert flags: `alertEarlyFiredAt DateTime?`, `alertCriticalFiredAt DateTime?`.
- **`Attendance`**: links player ↔ session, `createdAt` for RSVP order (confirmed = first `maxPlayers` by time; rest = waiting list).
- **`AppConfig`**: `key String PK`, `value String`, `updatedAt`. Stores all admin-editable settings; fetched via `getAllConfigs()` (single round-trip, merged with `CONFIG_DEFAULTS`).
- **`HourlyRate`**: `id`, `effectiveFrom DateTime @db.Date`, `pricePerHour Float`. Multiple rows; newest `effectiveFrom ≤ today` is the active rate. List managed inline on `/admin/config`; add/edit on `/admin/config/rates/new` and `/admin/config/rates/[id]/edit`.
- **`Payment`**: `playerId`, `date`, `amount Int` (ILS), `method PaymentMethod @default(BIT)` (enum: `CASH | PAYBOX | BIT | BANK_TRANSFER | OTHER`), `description String?`.
- **`SessionCharge`**: `sessionId`, `playerId`, `amount Int`, `calculatedAmount Int`, `chargeType ChargeType` (enum: `REGISTERED | DROP_IN | ADMIN_OVERRIDE`), unique on `(sessionId, playerId)`. Has `auditEntries ChargeAuditEntry[]`.
- **`ChargeAuditEntry`**: `sessionChargeId`, `changedAt`, `changedBy String`, `previousAmount Int`, `newAmount Int`, `reason String?`. Tracks every per-charge override.
- **`AuditLog`**: `id Int PK autoincrement`, `timestamp DateTime`, `actor String` ("admin" | player phone | "cron"), `actorIp String?`, `action String` (enum-like constant e.g. `CREATE_PLAYER`), `entityType String?`, `entityId String?`, `before Json?`, `after Json?`. Indexed on `timestamp DESC`, `action`, `(entityType, entityId)`, `actor`. Written fire-and-forget via `src/lib/audit.ts`.
- **`Match`**: `id`, `sessionId`, `teamAPlayerIds String[]`, `teamBPlayerIds String[]`, `scoreA Int`, `scoreB Int`, `createdAt`, `updatedAt`. Indexed on `(sessionId, createdAt)`. Cascades on session delete.
- **`Player` regulations fields**: `regulationsAcceptedAt DateTime?`, `regulationsAcceptedVersion Int?`. Null = not yet accepted. Version compared against `regulations_version` config to gate access.

### RSVP flow (public)

- Home page (`/`): **dynamic** server render — next open game, Hebrew copy. Shows **location card** with name + Waze + Google Maps buttons + OpenStreetMap iframe minimap when lat/lng are set. Responsive width: `max-w-lg` on mobile, `max-w-2xl` on `md+`.
- **RSVP flow**:
  - **Logged-in + already registered**: only cancel option shown (no form). Fixed: `userAttendance` now checks both the RSVP session cookie AND the player session cookie, so players who registered via admin (no RSVP cookie) are correctly detected.
  - **Logged-in + not yet registered**: shows player's name as a header + single “אני מגיע” button (`AuthenticatedRsvpForm` component, calls `rsvpAuthenticatedAction` — no name/phone inputs, uses player session directly).
  - **Not logged in**: shows `PlayerLoginForm` (which now auto-provisions unknown phones as DROP_IN players). After OTP verification for a new unnamed DROP_IN, shows a “set_name” step (enter name or skip). After login/name-step, page reloads showing the authenticated RSVP form above.
- **Drop-in self-registration**: `requestOtpAction` now uses `upsert` — unknown phones auto-create a DROP_IN player before issuing OTP (no more “לא קיים במערכת” error). `verifyOtpAction` redirects to `redirectTo` param (homepage passes `”/”`) so login stays on the homepage. `setNameAction` saves optional name and redirects to `/`.
- **Theme**: `ThemeProvider` in `layout.tsx`; `ThemeToggle` (popup button) still exists but is no longer in the nav. Theme is changed via `ThemeSelector` (`src/components/theme-selector.tsx`) — an inline 3-button row (כהה / מערכת / בהיר) in the profile page "מראה" section.
- **`normalizePhone`** in `src/lib/phone.ts` — strips non-digits, strict `/^05\d{8}$/` (no `972` rewrite).
- **RSVP window**: registration open until `session.date` (not the close window). `isRsvpOpen = !isClosed && now < session.date`. Close window (`rsvp_close_hours`) only affects cancellation for confirmed players.
- **Cancellation rules**: waitlisted players can always cancel; confirmed players cannot cancel within the close window (`now >= session.date - closeHours * 3_600_000`). Amber notice shown when cancellation is blocked ("ביטול הרשמה אינו אפשרי בשלב זה — פנה למנהל").
- Server actions: attend (find-or-create player, transactional RSVP), cancel (session-bound `playerId`, checks player index vs maxPlayers + close window); per-IP sliding-window rate limits (`src/lib/rate-limit.ts`, tunable `IRBA_RL_*`).
- **Cancel RSVP**: inline two-step confirmation (“האם לבטל את ההגעה?” + “כן, בטל” / “לא”) — no `window.confirm`. Success banner auto-dismisses after 3 s (tracked by state reference, not a boolean flag).
- **RSVP success banner**: auto-dismisses after 3 s.
- **Waitlist handling**: when a player is added to the waiting list, the server action calls `redirect(“/?waitlisted=1”)` instead of returning. The homepage shows a persistent server-rendered amber notice (“אתה ברשימת ההמתנה — ההרשמה תאושר אם יפנה מקום”) whenever `userIsWaitlisted` is true. On first registration (`?waitlisted=1`), an `AutoScroll` client component (`src/components/auto-scroll.tsx`) scrolls the page to `#waiting-list`. This is reliable because the notice is rendered AFTER the page re-renders with the new attendance (unlike a useEffect on a form component that unmounts).
- **Registration timestamp**: attending users see “נרשמת למפגש זה ב-{date}” below the cancel section (`userAttendance.createdAt` via `formatGameDate`).
- **Attendance sorting**: `src/lib/sort-attendances.ts` — REGISTERED players sorted by precedence score (desc) before DROP_IN players (FIFO by `createdAt`). Slice at `maxPlayers` determines confirmed vs waitlist. Admin (`isAdmin=true`) always sorts first regardless of score.
- **Cancel RSVP**: `cancelAttendanceAction` checks both the RSVP session cookie and the player session cookie — covers players added by admin (who have no RSVP cookie).
- Lists: confirmed + waiting list (waiting list section has `id=”waiting-list”` for scroll targeting); phones **masked** in UI; optional **”מזדמן”** badge for drop-ins.

### Admin (authenticated — full CRUD)

- **`/admin/login`** — redirects to `/` (admin users log in via normal player login; `isAdmin` flag in DB grants admin access).
- **Auth guard**: `requireAdmin()` in [`src/lib/admin-guard.ts`](src/lib/admin-guard.ts) — checks player session → DB `isAdmin`. Used by the protected layout and all admin server actions. Single identity: one session cookie (`irba_player_session`), admin is just a DB role.
- **Legacy**: `admin-session.ts`, `ADMIN_SESSION_SECRET`, `ADMIN_PASSWORD_HASH` and the shared admin password login are no longer used at runtime. Files kept for reference but not imported by any active code.

#### Navigation

All back links in admin pages display "→ חזרה" with no destination suffix (previously had suffixes like "לרשימה", "לניהול", "לשחקנים", etc.).

#### Admin home (`/admin`)

Navigation cards to שחקנים, מפגשים, ייבוא נתונים, הגדרות, **לוג פעולות**, and **דירוג שחקנים** (`/admin/ranking`, `BarChart2` icon) sections (קדימות card removed — merged into שחקנים); logout button. All nav cards and the logout button have `active:` press states.

#### Players CRUD (`/admin/players`) — unified with Precedence

- **List** (`/admin/players`): all players **sorted by precedence score descending**; ranked #1…N on the left. Shows kind badge (**קבוע** / **מזדמן**), positions, phone (clickable `wa.me` link — opens WA DM in new tab), balance (coloured; formatted `₪N` / `-₪N` with `dir="ltr"` so minus/₪ always on correct side), current-year attendance with fraction `(attended/total sessions)`, total precedence score inline in subscript, and **computed rank** (blue, e.g. "72.4") with "(ידני: X)" muted subscript when set. Edit button + delete button; full-row click navigates to edit. **משקלות** button in header links to `/admin/precedence/weights`. **Add player** button is a circular `+` icon (no label) — saves space on mobile. Same circular `+` pattern used across sessions and weights list pages. Loading state: spinner + freeze overlay (`PlayerList` client component, `src/components/admin/player-list.tsx`).
- **Add** (`/admin/players/new`): form with phone, playerKind, positions (multi-select checkboxes — PG / SG / SF / PF / C, English-only), rank, balance, isAdmin, nickname, name fields (He/En), birthdate. Balance field uses `type="text"` + `inputMode="numeric"` (not `type="number"`) — browsers drop intermediate `-` in number inputs. **Birthdate**: dual-input pattern — visible text input displaying `dd.mm.yyyy` (Israeli format) + hidden `type="date"` input for canonical `YYYY-MM-DD`; calendar icon button calls `hiddenRef.showPicker()` to open native date picker. Picker works on desktop Chrome and mobile iOS; display always shows Israeli format regardless of browser locale. **Cancel button** (red, outside form) + **back button** (→ חזרה לרשימה) at top of form — both trigger dirty-guard confirm dialog when any field has been touched. Popstate guard active for create mode.
- **Edit** (`/admin/players/[id]/edit`): player name + precedence rank/score shown in header (`מקום N · ניקוד X`). Same player form; phone disabled. Dual save buttons: **שמור שינויים** (stay) + **שמור וחזור לרשימה**. Cancel button + back button with dirty-guard confirm. Popstate guard active. **Computed rank breakdown card** below the form: shows final `computedRank` in blue + three components (admin/peer/win) with their weights; `getPlayerRankBreakdown` fetched server-side (`.catch(() => null)` so it never blocks the page). **Precedence sections below the form:** current-year live attendance (read-only, auto-counted), historical aggregates (upsert/delete per year), bonuses/fines (adjustments) with add/edit/delete.
- **Delete**: guarded — blocked if player has any attendance records (count shown in tooltip); `window.confirm` for players with 0 attendances. Server action (`deletePlayerAction`) double-checks count before deleting.
- **Back button**: inner `→ חזרה` in `PlayerForm` only renders in create mode; edit mode uses the page header back link (which respects the `?from=finance` param) to avoid duplicate buttons.
- **Server actions**: `createPlayerAction`, `updatePlayerAction`, `deletePlayerAction` in `src/app/admin/(protected)/players/actions.ts`. All call `requireAdmin()` (session guard) before any DB access.
- **Validation**: `src/lib/player-validation.ts` — `parsePlayerForm` with per-field Zod + phone normalization; tested in `src/lib/player-validation.test.ts`.

#### Sessions CRUD (`/admin/sessions`)

- **List** (`/admin/sessions`): client component (`SessionList`); full-row invisible Link with loading spinner; row hover/active highlight. Shows date, attendance count / maxPlayers (`dir="ltr"`, color-coded: green when ≥ maxPlayers, red when < session_min_players, zinc otherwise), status badge (**פתוח** / **סגור** / **ארכיון**). Row actions: archive/unarchive button + delete button. Filter bar: date range pickers (`from`/`to` URL params), "הצג ארכיון" checkbox, search/clear. Archived sessions excluded from `getNextGame()`.
- **Archive**: `GameSession.isArchived Boolean @default(false)` (migration `20260329113136_add_session_archived`). `archiveSessionAction(id, archive)` in `sessions/actions.ts`. `SessionArchiveButton` component (`session-archive-button.tsx`) with Archive / ArchiveRestore icon.
- **Add** (`/admin/sessions/new`): form with date (pre-filled to next occurrence of config default day/time), maxPlayers (default 15), durationMinutes (pre-filled from config), locationName/locationLat/locationLng (pre-filled from config). `nextDefaultSessionDateISO` in `session-validation.ts` computes the correct next slot (same-day only if session time is still upcoming, else next week). On create, redirects to `/admin/sessions/${newSessionId}`.
- **Edit / detail** (`/admin/sessions/[id]`): **unified page** — replaces separate `/[id]/edit`. Header: back link only (date removed — it's the first field in the form below, no need to repeat it). Session form card (always visible, success message shown inline). Attendance card: confirmed list + precedence-sorted waitlist + add-player form + quick drop-in form. Old `/[id]/edit` redirects here.
- **Session form dirty guard**: "שמור שינויים" button is inactive until the form is dirty. After successful save, `lastSavedRef` resets so button goes inactive again. `beforeunload` guard fires on tab close/refresh; `popstate` guard shows custom confirm dialog ("יש שינויים שלא נשמרו" / עזוב / המשך עריכה) on browser back. Mirrors the pattern from `PlayerForm`.
- **`isClosed` toggle**: `toggleSessionAction` — blocks re-opening if `Date.now() >= session.date - rsvp_close_hours * 3_600_000 && Date.now() < session.date`. isClosed is a checkbox in the SessionForm.
- **Delete**: guarded — blocked if session has any attendance records. `window.confirm` for empty sessions.
- **Overlap guard**: `createSessionAction` rejects if any session started in the last 24 h is still running (`session.date + (durationMinutes ?? configDefault) > now`). Message: `"לא ניתן לפתוח מפגש חדש לפני שהמפגש הנוכחי הסתיים"`.
- **Auto-register admin**: on session create, the player with `isAdmin=true` is automatically added as an attendee (if found).
- **Server actions**: `createSessionAction`, `updateSessionAction`, `deleteSessionAction`, `toggleSessionAction`, `archiveSessionAction` in `src/app/admin/(protected)/sessions/actions.ts`.
- **Validation**: `src/lib/session-validation.ts` — `parseSessionForm` + `parseIsraelLocalDate` + `nextDefaultSessionDateISO`; tested in `src/lib/session-validation.test.ts`.
- **Duplicate guard**: `createSessionAction` and `updateSessionAction` reject a session if another already exists on the same Israel calendar day; edit excludes the session being updated.
- **Attendance management** (on `/admin/sessions/[id]`):
  - Confirmed list + precedence-sorted waitlist (registered by score desc, drop-ins by createdAt asc).
  - **Add registered player**: `SessionAddPlayerForm` — searchable dropdown from all players not yet attending. Submit button is icon-only circular (no text label) to prevent overflow on mobile.
  - **Quick drop-in**: `SessionQuickDropInForm` — name + phone fields. Submit button is icon-only circular. On valid phone, calls `lookupPlayerByPhoneAction` (via `useTransition`) and shows inline status: **already_registered** (red, button disabled) / **existing_not_registered** (blue "שחקן קיים: [name]", name field hidden) / **new** (name field required). `quickAddDropInAction` uses `findUnique` + `create` — never modifies existing player data.
  - **Remove player**: `SessionRemoveButton` with confirmation.
- **Match results panel** (`SessionMatchPanel`, `src/components/admin/session-match-panel.tsx`): last section on the session detail page (below attendance). Records multiple matches per session. UI is mobile-first (designed for iPhone on-court use):
  - **Team selection**: 2-column grid (קבוצה א׳ | קבוצה ב׳); each player appears as a named toggle button in both columns. Tapping a button assigns the player to that team (atomic move from the other). Column header shows live count `(n/5)` in green when full.
  - **Team size enforcement**: each team must have exactly 5 players. Buttons in a full team are disabled for non-members; submit disabled until both teams have 5. Server action also validates `!== 5`.
  - **Score entry**: per-team labelled rows with `−` / `+` steppers (44px) + direct numeric input simultaneously; `−` disabled at 0; no upper bound.
  - **Match list**: 2-column layout — players string on the left (truncated), score on the right; entire row is clickable to edit; trash button stop-propagates. Score uses `–` separator; winner highlighted green.
  - Auto-selects winner + sitting-out team when opening new match (3-team rotation). Server actions: `createMatchAction`, `updateMatchAction`, `deleteMatchAction` in `src/app/admin/(protected)/sessions/[id]/matches/actions.ts`.
- **Delete redirect**: `deleteSessionAction` now calls `redirect("/admin/sessions")` on success — prevents landing on a 404 for the just-deleted session.

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
- **`src/lib/config-validation.ts`** — Zod schema for all config keys with Hebrew error messages; `parseConfigForm`. Includes `nonNegativeFloat` and `pctField` validators for the rank weight keys.
- **Admin UI** (`/admin/config`): grouped settings form — מפגשים, לוח זמנים, מיקום, שחקנים, משחקים, **דירוג שחקנים** (3 weight inputs + 1 min-games-pct input), תעריף שעתי (past rates collapsed), חיוב, וואטסאפ, **התראות נוכחות נמוכה**. Server action `updateConfigAction` upserts all keys in a transaction; if any of the 4 rank keys changed it calls `recalculateAllComputedRanks`. The "התראות נוכחות נמוכה" section exposes the 7 `alert_*` keys: master toggle, early-alert card (enabled checkbox + hours-before input + template textarea), critical-alert card (same structure). Template variable hints shown inline: `{date}`, `{confirmed}`, `{min_players}`.

**Config keys:**
| Key | Default | Purpose |
|-----|---------|---------|
| `session_schedule_day` | `1` (Monday) | Day-of-week — used for both manual session pre-fill and auto-create |
| `session_schedule_time` | `21:00` | Time HH:MM — used for both manual session pre-fill and auto-create |
| `session_default_duration_min` | `120` | Session duration (minutes) |
| `rsvp_close_hours` | `13` | Hours before start that RSVP auto-closes |
| `location_name` | Ilan Ramon school court | Default location display name |
| `location_lat` / `location_lng` | `""` | GPS coordinates for map links |
| `session_min_players` | `10` | Minimum confirmed players required to charge a session; also sets the denominator for rate calculation |
| `debt_threshold` | `10` | Debt ILS: if player balance ≤ -threshold they are charged at drop-in rate |
| `alert_low_attendance_enabled` | `false` | Master toggle for low-attendance alerts |
| `alert_early_enabled` | `false` | Enable early-warning alert tier |
| `alert_early_hours_before` | `48` | Hours before session for early alert |
| `alert_early_template` | (Hebrew template) | WA group message template; vars: `{date}` `{confirmed}` `{min_players}` |
| `alert_critical_enabled` | `false` | Enable critical-warning alert tier |
| `alert_critical_hours_before` | `2` | Hours before session for critical alert |
| `alert_critical_template` | (Hebrew template) | WA group message template; same vars |
| `default_player_rank` | `50` | Rank for players with no rank set |
| `match_win_score` | `12` | Points to win a match |
| `match_duration_min` | `7` | Per-match time limit (minutes) — first of score or time wins |
| `session_schedule_enabled` | `"false"` | Enable auto-create cron |
| `session_auto_create_hours_before` | `"48"` | Hours before session that RSVP opens (auto-create fires) |
| `regulations_version` | `1` | Increment to force all players to re-accept regulations |
| `regulations_text` | (full Hebrew template) | Admin-editable regulations body; supports `## heading`, `**bold**`, `{variable}` substitution |
| `fine_no_show` | `3` | Precedence points deducted for no-show after RSVP |
| `fine_kick_ball` | `2` | Precedence points deducted for kicking the ball |
| `fine_early_leave` | `1` | Precedence points deducted for leaving early without notice |
| `rank_weight_admin` | `1` | Weight for admin manual rank in blended `computedRank` |
| `rank_weight_peer` | `1` | Weight for peer-rating component (REGISTERED only) |
| `rank_weight_winloss` | `1` | Weight for win/loss ratio component (REGISTERED, threshold met) |
| `rank_winloss_min_games_pct` | `50` | % of max-games-played a player must reach to include win score |

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

#### Dynamic ranking (`/admin/ranking`)

Admin-managed peer rating sessions + computed rank blending.

**Blending formula:**
```
peerScore    = (1 − (avgPosition − 1) / (N − 1)) × 100    [position 1 = best]
winScore     = winRatio × 100
effectivePeerW = peerWeight   if REGISTERED && hasPeerData
effectiveWinW  = winWeight    if REGISTERED && gamesPlayed >= ceil(minPct/100 × maxGames)
computedRank = (adminW×adminRank + peerW×peerScore + winW×winScore) / totalW
```
DROP_IN players: only admin rank component applies.

**Pure computation layer** (`src/lib/computed-rank-pure.ts`): `computeBlendedRank`, `normalizePeerScore`, `normalizeWinScore` — no DB imports, safe for tests and client components.
**DB orchestrator** (`src/lib/computed-rank.ts`): `recalculateAllComputedRanks(actor)` + `getPlayerRankBreakdown(playerId)`.

**Admin UI** (`/admin/ranking`):
- Lists all `PeerRatingSession` rows ordered by year desc
- Open session: shows submission count / total REGISTERED players; Close button (which triggers recalc)
- Closed sessions: expandable table (player → avgPosition → peerScore, sorted desc)
- "פתח סשן חדש" form (year input; validates no open session)
- "חשב מחדש את כל הדירוגים" button
- Client component `RankingSessionPanel` (`src/components/admin/ranking-session-panel.tsx`)

**Server actions** (`src/app/admin/(protected)/ranking/actions.ts`):
- `openPeerRatingSessionAction` / `closePeerRatingSessionAction` / `deletePeerRatingSessionAction` / `recalculateRanksAction`
- `fetchRankingSessionsAction` (returns session summaries with results for closed sessions)
- `checkPendingPeerRatingAction` (called from profile to check if player has a pending submission)

**Player-facing peer rating** (`/ranking/submit`):
- Auth-gated page: not-logged-in → redirect `/`; DROP_IN → show notice; no open session → show notice
- `<PeerRatingForm>` (`src/components/peer-rating-form.tsx`): sortable list using `@dnd-kit/core` + `@dnd-kit/sortable`; PointerSensor (distance:5) + TouchSensor (delay:150) + KeyboardSensor; always-visible ↑↓ buttons as universal fallback
- `submitPeerRatingAction` validates the submitted ordering is a permutation of all REGISTERED players except self → `$transaction` (delete existing + `createMany`) → `recalculateAllComputedRanks`
- `<PeerRatingBanner>` (`src/components/peer-rating-banner.tsx`): amber dismissible banner on `/profile` when a session is open and player hasn't submitted

**Team balance integration:** Session detail page (`/admin/sessions/[id]`) now passes `computedRank ?? rank` to the team balance algorithm.

**New dependency:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`

---

### Security / abuse (MVP)

- **Cookies**: HTTP-only, `sameSite=lax`, `Secure` in production or when `RSVP_COOKIE_SECURE` is set; JWT verifies `iss` / `aud` (defaults `irba` / `irba-rsvp`).
- **Rate limits**: in-memory per process for attend vs cancel and **admin login**; client IP from `CF-Connecting-IP`, `X-Real-IP`, or first `X-Forwarded-For` hop (configure your reverse proxy).
- **Response headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and full **CSP** (`default-src 'self'`, `script-src 'self' 'unsafe-inline'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `frame-ancestors 'none'`) via `next.config.ts`.

### Ops / DX

- **`GET /api/health`** — JSON; 200 if DB answers `SELECT 1`, else 503 (generic body, no secrets). Response includes `version` field (git commit hash injected at build time via `NEXT_PUBLIC_COMMIT_HASH`).
- **Favicon / icons**: `src/app/icon.svg` (desktop SVG favicon), `src/app/icon.png` (48×48 PNG fallback), `src/app/apple-icon.png` (180×180 PNG, served as `apple-touch-icon` for iOS Safari / Add to Home Screen). PNGs generated from icon.svg via sharp.
- **Docker**: `docker-compose.yml` with 3 services: `db` (Postgres 16-alpine), `app` (Next.js on `127.0.0.1:3004`), `wa` (Baileys/Express sidecar on internal port 3100). `Dockerfile` uses `output: standalone` — runner stage copies `.next/standalone` to WORKDIR so `server.js` sits at `/app/server.js` alongside `public/` and `.next/static/`. `docker-entrypoint.sh` runs `prisma migrate deploy` then `exec node server.js`. `init: true` on the app service uses Docker's built-in tini as PID 1 to reap zombie processes.
- **Deploy**: `./scripts/deploy.sh` — pre-deploy DB backup, then SSH to EC2: `git pull → COMMIT_HASH=$(git rev-parse --short HEAD) docker compose build → docker compose up -d → prisma migrate deploy`. See `RUNBOOK.md` for full ops guide.
- **Versioning**: `COMMIT_HASH` build arg passed through `docker-compose.yml` → `Dockerfile` → baked as `NEXT_PUBLIC_COMMIT_HASH` at `next build` time. `COMMIT_DATE` is set via `git log -1 --format='%cI'` (strict ISO 8601 with full timezone offset, e.g. `2026-04-08T18:46:43+00:00`) — the full offset is required so `new Date()` on the client correctly parses UTC and `Intl.DateTimeFormat` converts to the user's local timezone. Displayed as a subtle footer on all admin pages (`src/app/admin/(protected)/layout.tsx`) and in the `/api/health` response. Footer uses `CommitInfo` client component (`src/components/admin/commit-info.tsx`) to show local-timezone date and a Hebrew relative time ("לפני X שעות") — avoids showing UTC server time to the user.
- **Production**: live at `https://irba.sportgroup.cl` (EC2 → Apache TLS → localhost:3004).
- **Custom 404**: `src/app/not-found.tsx` — Hebrew page ("הדף לא נמצא") with back-to-home link; fixes RTL layout issue with the default Next.js 404 page.
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

**Bot status & re-link** — dedicated `/admin/wa` page (`src/app/admin/(protected)/wa/page.tsx`). Shows `WaBotStatus` widget (green/red dot, QR code when disconnected, logout button; polls every 15s). Bot status actions (`fetchWaStatusAction`, `logoutWaAction`) live in `src/app/admin/(protected)/wa/actions.ts`.

**Global status indicator** — `WaStatusDot` (`src/components/admin/wa-status-dot.tsx`) renders a green/red `h-2 w-2` dot in the admin nav (via `NavLinks`), positioned as a badge on the MessageCircle icon. Polls `fetchWaStatusAction` every 15s; shows nothing until first response. Admins see connection state on every page without visiting `/admin/wa`.

**Manual group send** — also on `/admin/wa` (`WaSendForm` component, `src/components/admin/wa-send-form.tsx`). Shows read-only group JID + resolved group name (fetched from sidecar on mount if bot is connected). Textarea + green "שלח לקבוצה" button. If `wa_group_jid` is not configured, a hint links to `/admin/config`. `/admin/config` WA section now only has JID field + notification toggles — no bot status, no send form.

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
5. Runs `checkLowAttendanceAlerts` — fires WA group message if any upcoming open session is below `session_min_players` and the alert hasn't fired yet for that session/tier
6. Returns `{ closed: string[], skipped: number, alerts: { earlyFired, criticalFired } }`

EC2 cron: `* * * * * /opt/irba/scripts/cron-auto-close.sh`

Core logic in `src/lib/auto-close-sessions.ts` (`autoClosePastSessions()`); alert logic in `src/lib/low-attendance-alert.ts` (`checkLowAttendanceAlerts`).

### Tests

- Unit tests: `phone`, `maskPhone`, `rate-limit` (including admin login), `admin-session`, `bcryptjs` verify, mocked `checkDatabase` (`src/lib/*.test.ts`, `src/lib/health.test.ts`).
- **Player validation tests** (`src/lib/player-validation.test.ts`): 25 cases covering all fields, phone normalization, rank/balance boundaries, multi-position array (valid/invalid values, single-string coercion, empty), isAdmin flag.
- **Session validation tests** (`src/lib/session-validation.test.ts`): 16 cases covering date parsing (including Israel timezone DST conversion), maxPlayers bounds, isClosed flag.
- **Precedence tests** (`src/lib/precedence.test.ts`): 10 cases covering score formula (zero state, aggregates only, live count, adjustments, combined), edge cases (missing weight, negative adjustments, fractional weights).
- **Schedule tests** (`src/lib/schedule.test.ts`): 10 cases — today/tomorrow/multi-day skip, same-weekday-just-passed, DST winter/summer, midnight/23:59 edge cases. Uses `Intl.DateTimeFormat` with `% 24` normalization for older ICU versions.
- **Waitlist promote tests** (`src/lib/waitlist-promote.test.ts`): 8 cases — promote moves to last confirmed slot, error on confirmed player, error on missing attendance.
- **Computed rank tests** (`src/lib/computed-rank.test.ts`): 18 cases covering `normalizePeerScore` (position 1/N/middle/N=1/fractional avg), `normalizeWinScore` (0/0.5/1), and `computeBlendedRank` (admin-only, defaultRank, all-three, DROP_IN ignores peer+win, below-threshold excludes win, zero weights → null, custom ratios, admin weight 0, edge 0/100). Imports from `computed-rank-pure.ts` to avoid DB init.
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
- **Ranking**: `OPEN_PEER_RATING_SESSION`, `CLOSE_PEER_RATING_SESSION`, `DELETE_PEER_RATING_SESSION`, `SUBMIT_PEER_RATING`, `RECALCULATE_RANKS`
- **Import**: `IMPORT_PLAYERS`, `IMPORT_PAYMENTS`, `IMPORT_AGGREGATES` (with `imported` count + `errorCount`)
- **Public RSVP**: `RSVP_ATTEND` (actor = player phone + IP, with session + status), `RSVP_CANCEL` (actor = player phone + IP)

**Admin page** (`/admin/audit`): server-rendered, 75 entries/page.
- **Filters** (URL params): `action` dropdown (all ~55 actions with Hebrew labels), `entity` type dropdown, `actor` text field, `from`/`to` date range, `q` free-text (searches `entityId` + `actor`); clear link when any filter active.
- **Table** (`AuditLogTable` client component): color-coded action badges (green=creates, blue=updates/state-changes, red=deletes, purple=admin auth, violet=player auth, amber=OTP events, indigo=imports, teal=WA/system), actor badge (purple=admin, zinc=cron, amber=player phone), IP sub-label. **Responsive**: entity column hidden on mobile (`hidden sm:table-cell`), action badge truncated, no forced min-width — no horizontal scroll on 430px.
- **Human-readable display**: all action names translated to Hebrew (`ACTION_LABELS` map); actor column resolves player cuid IDs to display names (nickname/firstNameHe/phone), shows "מנהל"/"מערכת" for admin/cron; entity column resolves player IDs to names and session IDs to Hebrew date strings. Column headers renamed: "על מה" (entity), "מבצע" (actor). `JsonDiff` headers: "שדה"/"לפני"/"אחרי". Server-side ID resolution via two batch queries (player names + session dates) passed as maps to the client component.
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

## Decisions & Constraints

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

## Feature history — Phase 1 (all shipped)

Completed in build order. Each section below maps to the detailed documentation above.

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
- **Logout:** `playerLogoutAction` clears the player session cookie and redirects to `/`
- **Admin layout guard:** `requireAdmin()` from `src/lib/admin-guard.ts` — checks player session + DB `isAdmin`; redirects to `/` if unauthorized

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

#### 5. Payments ✅ DONE

**Schema:** `method PaymentMethod @default(BIT)` added to `Payment` (enum: CASH/PAYBOX/BIT/BANK_TRANSFER/OTHER).

**Balance:** fully computed — `balance = Σ(payments.amount) - Σ(sessionCharges.amount)` for a player. Pure helper in `src/lib/balance.ts`; DB functions use dynamic imports (no module-level prisma).

**Admin UI:** Per-player payments section in `/admin/players/[id]/edit` — positioned immediately below the player details form (before attendance/precedence sections). Add (date, amount, method, description), delete, balance breakdown (paid / charged / balance). Server actions: `addPaymentAction`, `deletePaymentAction` in `src/app/admin/(protected)/players/[id]/payments/actions.ts`.

**Finance dashboard** (`/admin/finance`): summary cards (total paid / charged / net balance), debtors list, credits list, all-players table sorted by debt, recent payments, recent charges. Linked from admin home nav card (Banknote icon). All player rows are fully clickable (overlay link + hover highlight). Links pass `?from=finance` so the player edit page shows "→ חזרה לפיננסים" instead of "→ חזרה לשחקנים".

**Player-facing:** Balance shown on `/profile` (computed live; shows +/- and breakdown).

**Remaining (deferred):** Municipality CSV export (needs national IDs from auth flow).

---

#### 6. Charging ✅ DONE

**Models:** `SessionCharge(sessionId, playerId, amount, calculatedAmount, chargeType)` + `ChargeAuditEntry(sessionChargeId, changedBy, previousAmount, newAmount, reason?)`.

**Charge engine (`src/lib/charging.ts`):**
- `proposeSessionCharges(input)` → returns null if count < minPlayers; else: drop-ins + registered-in-debt each pay `ceil(totalCost / minPlayers)`; remainder after subtracting those payments is split equally among normal registered players with `Math.ceil`. This means registered players pay slightly more or less than `totalCost / minPlayers` depending on how many drop-ins/debt-players are in the session.
- `computeSingleCharge(opts)` — delegates to `proposeSessionCharges` with the full `allPlayers` list so the registered remainder is computed correctly in cascade context

**Balance engine (`src/lib/balance.ts`):** `computePlayerBalance`, `computePlayerBalances` (bulk), `computeBalanceFromTotals` (pure).

**Cascade recalc (`src/lib/cascade-recalc.ts`):** `cascadeRecalc` preserves admin delta (`newAmount = newCalculated + savedDelta`); `summarizeRecalc` for change preview.

**Session charge flow (admin):** “חייב מפגש” button on `/admin/sessions/[id]` → `chargeSessionAction` writes charges + sets `isCharged=true`. “בטל חיוב” → `unchargeSessionAction`. Per-charge amount override with reason → `updateSessionChargeAction` + `ChargeAuditEntry`. Admin delta preserved on future recalcs. UI: `SessionChargePanel` client component.

**Charge audit history:** Each charge row in `SessionChargePanel` shows a clock icon when overrides exist. Clicking expands an inline list of changes (date, actor, before → after amount, reason).

**Cascade recalc UI:** After saving a charge override, `previewCascadeAction` automatically checks for downstream impact. If any downstream session charges would change, an amber banner shows a per-player diff table. Admin confirms → `applyCascadeAction` applies all changes, creating `ChargeAuditEntry` rows with `reason: “cascade_recalc”`. No downstream sessions → silent (no banner).

**Per-player charge history (admin):** `/admin/players/[id]/edit` — חיובי מפגשים section below payments; shows all session charges with date (links to session page), amount, type badge, override indicator. Read-only; editing happens on the session page.

**Low-attendance alerts (`src/lib/low-attendance-alert.ts`):** `checkLowAttendanceAlerts` runs on every auto-close cron tick. Two tiers (early / critical), each with configurable hours + WA template. Fire-once via `alertEarlyFiredAt` / `alertCriticalFiredAt` on `GameSession`. Master toggle: `alert_low_attendance_enabled`.

**Config:** `session_min_players` (replaces `dropin_charge`) — sets both the charge minimum and the rate denominator. 8 alert config keys added.

**Tests:** `balance.test.ts` (6), `charging.test.ts` (updated for new split formula), `cascade-recalc.test.ts` (11). All pure — no DB required.

**Player-facing `/profile` page — section order:**
1. **יתרה** — balance card (total paid / charged / net)
2. **סטטיסטיקות משחק** — match analytics (wins/losses/rounds/teammate affinity)
3. **היסטוריית פעולות** — paginated account statement (payments + charges, running balance, filter tabs, per-page selector); URL-param driven
4. **נוכחות אחרונה** — last 10 sessions attended
5. **הגדרות** — single card grouping: password change + regulations viewer + theme selector (previously three separate cards)

---

#### 7. Match results ✅ DONE

**Model:** `Match(id, sessionId, teamAPlayerIds String[], teamBPlayerIds String[], scoreA Int, scoreB Int, createdAt, updatedAt)` — cascades on session delete.

Winning team stays; next match teams are composed by admin from session attendees. Multiple matches per session. Teams editable after recording.

**Admin UI** (`SessionMatchPanel` on `/admin/sessions/[id]`):
- **Mobile-first redesign**: optimised for live on-court use from an iPhone
  - Player assignment: single vertical list, each player has [א׳] and [ב׳] toggle buttons (40×48px tap targets). Tapping the other team's button atomically moves the player. Selected A → blue; selected B → orange; unselected → outlined.
  - Score entry: `[−] [input] [+]` stepper rows per team (44px stepper buttons). `−` disabled at 0. Input is large, tappable, opens numeric keyboard on mobile (`inputMode=”numeric”`) for direct score entry. Stepper and direct input work simultaneously.
  - Action buttons: `min-h-12 w-full` on mobile, inline on `sm:`. `flex-col-reverse` puts Save above Cancel.
  - Match list edit/delete: upgraded to `h-9 w-9` (36px) tap targets.
- **Nickname display**: `confirmedAttendees` in the session page prefers `nickname → firstNameHe → firstNameEn → full name` to keep names short in the panel.
- Match history list; edit or delete any row
- Server actions: `createMatchAction`, `updateMatchAction`, `deleteMatchAction` in `sessions/[id]/matches/actions.ts`
- Config: `match_win_score` (default 12) — stored in `AppConfig`
- **Auto-selection on new match**: `computeNextMatchDefaults` inspects the last recorded match — winner pre-fills Team A, sitting-out players pre-fill Team B. Covers 3-team rotation. Tied → no pre-fill. Hint shown when pre-populated.

---

#### 8. IRBA Regulations acceptance ✅ DONE

Players must read and accept the IRBA regulations before using the app.

**Schema additions to `Player`:** `regulationsAcceptedAt DateTime?`, `regulationsAcceptedVersion Int?`.

**Flow:** Root layout (`src/app/layout.tsx`) is now `async` — on every request it checks if the logged-in player's `regulationsAcceptedVersion` is null or behind `regulations_version` config. If so, `RegulationsOverlay` (`src/components/regulations-overlay.tsx`) is rendered before `{children}`, blocking all content. Zero client-side flash — check is server-side.

**Overlay UX:** Full-screen `fixed inset-0 z-50` overlay. Scrollable content area; sticky header and footer. Accept button starts **disabled**; enables only once the user has scrolled to the bottom sentinel (`IntersectionObserver` with `root: scrollRef.current` — must be the scrollable div, not viewport). `acceptRegulationsAction` server action records timestamp + version, writes `PLAYER_ACCEPTED_REGULATIONS` audit log, calls `revalidatePath("/", "layout")`. Overlay unmounts optimistically on success.

**Versioning:** Admin bumps `regulations_version` in the config panel → all players see the overlay again on next visit.

**Re-read from profile:** Players can re-read accepted regulations anytime via `/profile` → "תקנון" section → "קרא את התקנון" button. Opens a non-blocking full-screen modal (`RegulationsViewer`, `src/components/regulations-viewer.tsx`) with the same rendered content but no accept button or scroll gate. ✕ button or backdrop click closes it.

**Template engine (`src/lib/regulations-renderer.ts`):** `parseRegulationsTemplate(text, configValues)` — pure function, line-by-line parser with buffer/flush pattern. Supports `## Heading` (h3), `### Sub-heading` (h4), `**bold**` inline, `- bullet` list items (consecutive `-` lines form one `<ul>` block), blank line (paragraph break), `{variable}` substitution (all config keys + special `{session_schedule_day_name}` derived from `session_schedule_day`). `RegulationsContent` component is exported from `regulations-overlay.tsx` and reused by both the viewer and the admin preview. Admin can fully edit the text via `/admin/config` → "תקנון" section. The "תקנון" section has: macro/syntax reference overlay (toggle button), live preview toggle ("תצוגה מקדימה") that renders the current textarea content with real config values substituted — updates on every keystroke.

**Regulations content (default):** 10 sections — ידידות, הוגנות וספורטיביות, כיף, כללי המשחק (`{match_win_score}` נק׳ / `{match_duration_min}` דק׳ — with `### עבירות קבוצה` sub-heading using `{fouls_until_penalty}`), סמכות מנהל, לוח זמנים, כספים (סף חוב `{debt_threshold}₪`), הרשמה והגעה, קנסות עדיפות (bullet list with `{fine_no_show/kick_ball/early_leave}`), אפס סובלנות לאלימות, הסכמה לוואטסאפ.

**New config keys:** `regulations_version`, `regulations_text`, `match_duration_min`, `fine_no_show`, `fine_kick_ball`, `fine_early_leave`, `fouls_until_penalty` — all admin-editable on `/admin/config`.

**Audit:** `PLAYER_ACCEPTED_REGULATIONS` action type added to `AuditAction` union.

---

#### 9. Balanced team selection ✅ DONE


**Algorithm (`src/lib/team-balance.ts`):**
- Input: `PlayerInput[]` with `rank` (null → `default_player_rank` config), `positions`, `displayName`
- Snake-draft assigns players sorted by rank desc: A B C C B A A B C… (minimises rank-sum variance)
- `generateTeamOptions(players, seed)` — seed param (default 0) derives per-tier shuffle seeds; each call from the UI passes a fresh `Math.random()` seed so re-shuffle produces different results
- Handles non-divisible N gracefully (e.g., 14 → teams of 5,5,4)
- Pure function — no DB, runs client-side. 9 unit tests in `src/lib/team-balance.test.ts`

**Admin UI** (`TeamBalancePanel` on `/admin/sessions/[id]`, between attendance and match panels):
- “צור קבוצות” button (disabled + note when < 3 confirmed players)
- Shows 3 option cards stacked vertically; each card: Teams א׳/ב׳/ג׳ with player names + rank sum
- Each player row shows: name, position badges (PG/SG/SF/PF/C, monospace pill), rank (right-aligned, admin-only)
- “העתק” button per option — copies names-only plain-text Hebrew format (no rank/positions in copy)
- “ערבב מחדש” now generates genuinely different teams on every press (random seed each call)

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

#### 10. Player precedence table ✅ DONE

Players see the full precedence ranking at `/precedence` (login-gated). `ListOrdered` icon in nav for all logged-in players.

- `src/app/precedence/page.tsx` — Server Component; reuses `computePrecedenceScores`; filters out players with no history (no sessions, no adjustments); reads player session for row highlight
- `src/components/precedence-table.tsx` — Client Component; expandable accordion rows (one open at a time); each row shows rank + name + score; tapping expands inline detail: year-by-year table (sessions × weight = points) + adjustments list (date, description, ±points); current player highlighted in blue with "(אתה)" label
- `src/components/nav-links.tsx` — `ListOrdered` icon link to `/precedence`

No schema changes. No migrations.

---

#### 11. Personal match analytics on `/profile` ✅ DONE

Players see their match stats at the bottom of `/profile`.

**UI sections:**
- Summary: wins / losses / ties counts + win% (ties excluded from ratio denominator)
- Breakdown toggle ("לפי סבב" / "לפי מפגש") — `useState` client-side only (no URL param, no scroll-to-top); CSS-only colored bar per row
  - Per-round view: expandable accordion rows — each round shows "סבב N" + date range (RTL label, LTR dates) + wins/losses bar; expanding reveals individual match results (score + win/loss/tie badge); round size driven by `round_size` config key (default 5 sessions)
  - Per-session view: each session date with that night's wins/losses
- Teammate affinity: top 5 by shared wins; shows "X ניצחונות מתוך Y משחקים יחד"

**Implementation:**
- `src/lib/match-analytics.ts` — pure functions: `computeMatchStats`, `computeSessionBreakdown`, `computeRoundBreakdown`, `computeTeammateAffinity`; no Prisma
- `src/lib/match-analytics.test.ts` — 25 unit tests
- `src/app/profile/analytics.ts` — server fetcher; single raw SQL query; fetches all sessions for ordering; reads `round_size` config; resolves teammate names
- `src/components/match-stats-section.tsx` — Client Component; `useState` toggle
- `src/lib/config-keys.ts` — added `round_size` key (default 5)

---

## Phase 2 Roadmap — post-MVP features

Dependencies: #11 (match analytics) is prerequisite for #12 and #13 — both depend on per-player win/loss data. #12's peer rating is independent of #11 but adds complexity. #13 depends on both #11 (win ratio metric) and existing attendance data.

**Suggested build order: #13 (competitions) → #12 (dynamic ranking last — changes how rank works, needs careful UX design).**

---

#### 12. Dynamic player ranking ✅ DONE

Replace the single manual `rank` field with a computed score from three inputs:
- **Admin weight** — manual `rank` as base; drop-ins use only this component
- **Peer rating** — annual admin-triggered survey; players rank all other REGISTERED players; history preserved per year; `PeerRatingSession` + `PeerRating` models
- **Win/loss ratio** — computed from `Match` data; only applied when player meets min-games threshold

See "Dynamic ranking" section under "What exists today" for full implementation details.

---

#### 13. Competitions / challenges

Admin creates a `Challenge` with a metric (e.g. win ratio), an eligibility rule (e.g. played ≥X% of max sessions anyone played in the period), and a prize description. The system tracks it passively and shows a live leaderboard.

**Round concept:** A round = a fixed number of consecutive sessions (configurable via `round_size`, default 5). Challenges are scoped to a round or a configurable number of last N sessions. This avoids calendar-date ranges which break when weeks are skipped.

**Rough schema additions:**
- `Challenge(id, title, metric, eligibilityThreshold Float, roundCount Int, prize String?, createdAt)`
- Leaderboard is a computed view — no separate model needed

**Depends on:** #11 (win ratio metric, round concept, `round_size` config) + existing attendance data

---

*Last updated: Apr 2026 — All Phase 1 items (#1–#11) shipped. Phase 2: #12 dynamic ranking ✅ DONE. Remaining: #13 competitions.*
