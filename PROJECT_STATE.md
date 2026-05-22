# IRBA Manager — project state and next steps

Use this file to onboard or resume work in a new chat. For setup commands, see [README.md](./README.md).

## Table of Contents

- [Purpose](#purpose)
- [Stack](#stack)
- [Repository](#repository)
- [Current features and decisions](#current-features-and-decisions)
  - [Data model (Prisma)](#data-model-prisma)
  - [Identity & auth](#identity--auth)
  - [Public RSVP flow](#public-rsvp-flow)
  - [Admin area](#admin-area)
    - [Players](#players-adminplayers--unified-with-precedence)
    - [Sessions](#sessions-adminsessions)
    - [Hourly rates](#hourly-rates-inline-on-adminconfig)
    - [Config system](#config-system-adminconfig)
    - [Precedence](#precedence--רשימת-קדימות)
    - [Dynamic ranking](#dynamic-ranking-adminranking)
    - [Competitions / Challenges](#competitions--challenges-adminchallenges-and-challenges)
    - [Match results](#match-results)
    - [Charging](#charging)
    - [Shared expenses](#shared-expenses)
    - [Finance dashboard](#finance-dashboard-adminfinance)
    - [Audit log](#audit-log-adminaudit)
    - [Import pipeline](#import-pipeline-adminimport)
    - [QA testing system](#qa-testing-system-admintesting)
    - [WhatsApp admin](#whatsapp-admin-adminwa)
  - [WhatsApp sidecar](#whatsapp-sidecar-wa)
  - [Cron jobs](#cron-jobs)
  - [Regulations acceptance gate](#regulations-acceptance-gate)
  - [Profile completion gate](#profile-completion-gate)
  - [Balanced team selection](#balanced-team-selection)
  - [Player-facing pages](#player-facing-pages)
  - [Tests](#tests)
  - [Security / abuse](#security--abuse)
  - [Ops / DX](#ops--dx)
  - [Accessibility](#accessibility)
- [Decisions & Constraints](#decisions--constraints)
- [Future suggestions](#future-suggestions)

---

## Purpose

Self-hosted web app for **Ilan Ramon Basketball Association (IRBA)** — replacement for a Google Sheets / WhatsApp workflow. Live in production at **[https://irba.club](https://irba.club)**. Hebrew / RTL UI, PostgreSQL persistence, Docker-based deployment to a single EC2 host.

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
| CI | GitHub Actions — `lint`, `test`, `build` on `push` / `pull_request` to `main` ([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)); placeholder DB / session secrets in job `env` so Prisma + Next build load without Postgres |

## Repository

- Remote: `https://github.com/avivais/irba`
- Production host: EC2 `t4g.large` (Graviton ARM, 8 GB RAM + 2 GB swap, 50 GB gp3 EBS) → Apache TLS → `localhost:3004` → Docker

---

## Current features and decisions

### Data model (Prisma)

- **`Player`**: `name`, unique `phone` (normalized Israeli mobile `05xxxxxxxx`), `playerKind` (`REGISTERED` | `DROP_IN`, UI labels **קבוע** / **מזדמן**), `positions` (`Position[]`, multi-value array, default `[]`), optional manual `rank`, `computedRank Float?` (blended 0–100 score, recalculated on rank/config/peer changes), `isAdmin`. Auth fields: `email`, `nationalId`, `passwordHash`, `otpCode`, `otpExpiresAt`, `emailVerified`, name components (`nickname`, `firstNameHe/En`, `lastNameHe/En`), `birthdate`. Regulations: `regulationsAcceptedAt`, `regulationsAcceptedVersion`. **No stored `balance`** — balance is always computed: `Σ(payments.amount) − Σ(sessionCharges.amount) − Σ(sharedExpenseCharges.amount)`.
- **`GameSession`**: `date`, `maxPlayers` (default 15), `isClosed`, `isCharged`, `isArchived`, `durationMinutes Int?` (null = use config default), `locationName/Lat/Lng`, alert flags `alertEarlyFiredAt` / `alertCriticalFiredAt`, cancellation `cancelledAt DateTime?` (null = active — acts as flag) + `cancellationReason String?`.
- **`Attendance`**: links player ↔ session; `createdAt` for RSVP order (confirmed = first `maxPlayers` by precedence-then-FIFO; rest = waitlist).
- **`AppConfig`**: `key` PK + `value` + `updatedAt`. Single source for all admin-editable settings.
- **`HourlyRate`**: `effectiveFrom Date` + `pricePerHour Float`. Newest row with `effectiveFrom ≤ today` is the active rate.
- **`Payment`**: `playerId`, `date`, `amount Int` (ILS, signed), `method PaymentMethod` (enum: `CASH | PAYBOX | BIT | BANK_TRANSFER | OTHER`, default `BIT`), `description?`, `sessionId?` (FK → `GameSession`, `onDelete: SetNull`, indexed — links admin auto-offset payments to their source session).
- **`SessionCharge`**: `sessionId`, `playerId`, `amount`, `calculatedAmount`, `chargeType` (`REGISTERED | DROP_IN | ADMIN_OVERRIDE | FREE_ENTRY`), unique on `(sessionId, playerId)`. Has `auditEntries ChargeAuditEntry[]`.
- **`ChargeAuditEntry`**: per-charge override audit (`changedBy`, `previousAmount`, `newAmount`, `reason?`, `changedAt`).
- **`SharedExpense`**: `title`, `totalAmount`, `lookbackYears`, `minAttendancePct`, `eligibilityPool` (enum `REGISTERED_ONLY | ALL_PLAYERS`), `createdBy`, `revertedAt?`. Children: `SharedExpenseCharge(playerId, amount, manuallyAdded)`.
- **`PeerRatingSession`**: `id`, `year @unique`, `openedAt`, `closedAt?`, `openedBy` (admin playerId).
- **`PeerRating`**: `ratingSessionId`, `raterId`, `ratedPlayerId`, `position Int` (1 = best), `submittedAt`. Unique on `(ratingSessionId, raterId, ratedPlayerId)`.
- **`Match`**: `sessionId`, `teamAPlayerIds String[]`, `teamBPlayerIds String[]`, `scoreA`, `scoreB`. Cascades on session delete; indexed on `(sessionId, createdAt)`.
- **`Challenge`**: `number @unique` (auto-sequenced), `startDate Date`, `sessionCount`, `minMatchesPct`, `isActive`, `isClosed`, `winnerId?`, `createdBy`. Relations: `winner Player?`, `freeEntry FreeEntry[]`. No leaderboard model — computed passively from Match data.
- **`FreeEntry`**: `playerId`, `challengeId`, `usedInSessionId?`, `usedAt?`. Created when a competition closes; consumed when winner attends next charged session.
- **`YearWeight`**: PK `year` → `weight Float`. Controls how much each past year counts in precedence.
- **`PlayerYearAggregate`**: `(playerId, year)` unique — historical attendance count for years before live tracking; not created for the current year (counted from live `Attendance` rows).
- **`PlayerAdjustment`**: `playerId`, `date`, `points` (Float, signed), `description`. Bonuses (+) and fines (−).
- **`AuditLog`**: append-only log of every mutation. `id Int PK`, `timestamp`, `actor` (`"admin"` | player phone | `"cron"`), `actorIp?`, `action` (constant string), `entityType?`, `entityId?`, `before Json?`, `after Json?`. Indexed on `timestamp DESC`, `action`, `(entityType, entityId)`, `actor`.
- **`AssistantRequestLog`**: idempotency/audit log for the OpenClaw assistant API. `id`, unique `idempotencyKey`, `operation`, `actorPhone`, `groupJid`, `resultCode`, sanitized `resultSnapshot`, `createdAt`; indexed on `createdAt`. Used by `POST /api/assistant/v1`, retained separately from `AuditLog` (default 7 days).

### Identity & auth

- **Single identity model**: `Player` IS the user. Phone is the identity key. There is no separate User model and no separate admin login — admin access is just the `Player.isAdmin` flag in DB.
- **One session cookie**: `irba_player_session` (JWT in HTTP-only cookie). Legacy `admin-session.ts` / `ADMIN_PASSWORD_HASH` files are kept for reference but no longer used at runtime.
- **Admin guard**: `requireAdmin()` in `src/lib/admin-guard.ts` reads the player session and verifies `isAdmin` against the DB; used by the `/admin/(protected)/` layout and every admin server action.
- **Login flows**:
  - **Phone + OTP** — WA-delivered OTP. Unknown phones are auto-provisioned as DROP_IN by `requestOtpAction` so drop-ins can self-register. After OTP verify, the player is sent straight to `/profile` — there is no forced password setup and no in-flow `set_name` step. Any first-login follow-up (Hebrew names, regulations acceptance) is collected by the layout overlays (see [Regulations acceptance gate](#regulations-acceptance-gate) and [Profile completion gate](#profile-completion-gate)).
  - **Phone + password** — falls back to OTP if no password set.
  - **Password reset** — phone → WA OTP → set new password.
  - **Set / change password** — opt-in from `/profile` (`changePasswordAction` + `ChangePasswordForm`); `changePasswordAction` handles the no-existing-hash case so phone+password login continues to work for anyone who sets one later.
- **Login redirect pattern**: `verifyOtpAction` and `playerPasswordLoginAction` set the cookie then return `{ step: "logged_in", redirectTo }` — `useActionState` reads the step and triggers `router.push()` client-side. (A bare `redirect()` from the server action is swallowed by the action wrapper, which previously left the form spinning.)
- **Remember me**: 30-day persistent cookie vs. 12 h session cookie.
- **Login location**: `/login` and `/admin/login` both redirect to `/`. `PlayerLoginForm` is embedded inline on the homepage when not authenticated. All logout paths redirect to `/`.
- **Israeli ID validation** (`src/lib/israeli-id.ts`): Luhn-like check digit; tested.

### Public RSVP flow

- Home page (`/`): server-rendered, shows next non-archived non-cancelled open game, location card (name + Waze + Google Maps + OpenStreetMap iframe minimap when lat/lng set). Responsive `max-w-lg` mobile / `max-w-2xl` md+.
- **RSVP form variants**:
  - **Logged in + already attending**: only cancel option (no form). `userAttendance` checks both the RSVP cookie and the player session — admin-added players (no RSVP cookie) are still detected.
  - **Logged in + not attending**: name header + single "אני מגיע" button (`AuthenticatedRsvpForm` → `rsvpAuthenticatedAction`).
  - **Not logged in + not identified**: `PlayerLoginForm` (also auto-provisions unknown phones as DROP_IN). Login form is suppressed when the player is identified as attending via either cookie.
- **Phone normalization** (`src/lib/phone.ts`): strict `/^05\d{8}$/`, no `972` rewrite.
- **RSVP window**: registration open until `session.date`. Close window (`rsvp_close_hours`) only restricts cancellation for confirmed players (waitlisted can always cancel). Amber notice shown when cancellation blocked: "ביטול הרשמה אינו אפשרי בשלב זה — פנה למנהל".
- **Cancel RSVP**: inline two-step confirmation (no `window.confirm`). Success banners auto-dismiss after 3 s (tracked by reference, not bool flag).
- **Waitlist**: server action `redirect("/?waitlisted=1")` after waitlisting; homepage shows a persistent server-rendered amber notice whenever `userIsWaitlisted` is true. `AutoScroll` client component scrolls to `#waiting-list` on first registration.
- **Registration timestamp**: attending users see "נרשמת למפגש זה ב-{date}" below the cancel section.
- **Attendance sorting** (`src/lib/sort-attendances.ts`): admin first, then REGISTERED by precedence score desc → `createdAt` asc → name asc, then DROP_IN by `createdAt` asc → name asc. Slice at `maxPlayers` separates confirmed from waitlist. `buildNumberedList(attendances, sessionYear)` wraps this sort and returns a `"1. Name\n2. Name…"` string for the `{numbered_list}` WA macro.
- Per-IP sliding-window rate limits on attend/cancel; phones masked in UI; **"מזדמן"** badge for drop-ins.

### Admin area

#### Navigation & shell

- **Top nav** (`PlayerNav` server component, `src/components/player-nav.tsx`) renders on all pages — homepage, profile, all admin pages. Shows IRBA brand (sole home link), Profile icon, Admin icon (if `isAdmin`), Logout. Active page highlighted via `NavLinks` client component (`usePathname()`). No ThemeToggle in nav.
- **Admin home (`/admin`)**: nav cards to שחקנים, מפגשים, ייבוא נתונים, הגדרות, **לוג פעולות**, **דירוג שחקנים** (`/admin/ranking`), **תחרויות** (`/admin/challenges`); logout button. All cards have `active:` press states.
- **Back links**: all admin pages display "→ חזרה" with no destination suffix.
- **Sticky bottom save bar** on the config page: slides in only when the form is dirty.
- **WaStatusDot** (`src/components/admin/wa-status-dot.tsx`) — green/red badge on the MessageCircle icon in the admin nav, polls `fetchWaStatusAction` every 15 s.

#### Players (`/admin/players`) — unified with Precedence

- **List**: all players sorted by precedence score desc, ranked #1…N. Shows kind badge (קבוע / מזדמן), positions, phone (clickable `wa.me` link → opens WA DM), balance (color-coded `dir="ltr"`), current-year attendance with fraction, total precedence inline in subscript, **computed rank** (blue, e.g. "72.4") with "(ידני: X)" muted subscript when set. Edit + delete buttons; full-row click navigates. **משקלות** button → `/admin/precedence/weights`. **Add player** button is a circular `+` (icon-only — saves space on mobile). Loading state: spinner + freeze overlay.
- **Add** (`/admin/players/new`): phone, playerKind, positions (multi-select PG/SG/SF/PF/C), rank, balance (text + `inputMode="numeric"` so the browser doesn't drop intermediate `-`), isAdmin, nickname, name fields (He/En), birthdate. Cancel + back triggers dirty-guard confirm. Popstate guard active.
- **Edit** (`/admin/players/[id]/edit`): header shows `מקום N · ניקוד X`. Phone disabled. Dual save buttons (**שמור שינויים** stay / **שמור וחזור לרשימה**). Cancel + back with dirty-guard confirm. **Section order**: (1) form, (2) תשלומים, (3) חיובי מפגשים (with retroactive-debt-closure card when applicable), (4) דירוג מחושב + win/loss stats, (5) נוכחות (current year + historical merged), (6) בונוסים/קנסות.
- **Computed rank card**: labeled grid showing `value × weight = contribution` per component; inactive components grayed out with Hebrew reason; formula summary `סכום ÷ N = X`. Win/loss row shows total · wins · losses · win% bar · threshold badge ("מעל הסף" / "מתחת לסף", with "חסרים X משחקים" when below).
- **Delete**: blocked if any attendance records (count shown in tooltip); `window.confirm` for empty players. Server action double-checks before deleting.
- **Validation**: `src/lib/player-validation.ts` (Zod + phone normalization) — 25 unit tests.

#### Sessions (`/admin/sessions`)

- **List**: `SessionList` client component; full-row link with loading spinner; row hover/active highlight. Shows date, attendance count / maxPlayers (`dir="ltr"`, color-coded), status badge (**בוטל** red / **ארכיון** / **סגור** / **פתוח** — cancelled wins). Row actions: archive/unarchive + delete. Filter bar: date range pickers, "הצג ארכיון" checkbox, search/clear.
- **Add** (`/admin/sessions/new`): date pre-filled to next occurrence of config schedule day/time (`nextDefaultSessionDateISO`); maxPlayers (default 15), durationMinutes (from config), location fields (from config). Per-session WA override section (collapsible, pre-filled from global). On create, redirects to `/admin/sessions/${id}`.
- **Detail / edit unified** (`/admin/sessions/[id]`): header (back link only), session form card (always visible, success message inline), attendance card (confirmed + precedence-sorted waitlist + add-player form + quick drop-in form), team balance panel, match panel. Old `/[id]/edit` redirects here. Dirty guard on form (button inactive until dirty; `beforeunload` + custom popstate confirm).
- **`isClosed` toggle**: `toggleSessionAction` blocks re-opening when within the close window (`now ≥ session.date − rsvp_close_hours`).
- **Overlap guard**: `createSessionAction` rejects if any session in the last 24 h is still running (`session.date + duration > now`).
- **Auto-register admin**: every `isAdmin: true` player auto-attended on session create (via `addAdminAttendances` helper, `src/lib/admin-attendance.ts`) — wired into both `createSessionAction` and `autoCreateNextSession`.
- **Cancel**: `SessionCancelButton` in detail header; inline form with optional reason + confirm dialog. `cancelSessionAction` runs in a transaction — clears all `Attendance`, sets `cancelledAt`/`cancellationReason`/`isClosed = true`, fires `notifySessionCancelled` (template macros `{date}`, `{reason}` — empty → "לא צוינה"). Cancelled sessions render a red "המפגש בוטל" banner with reason + Asia/Jerusalem timestamp; submit disabled with "שחזר כדי לערוך" note. `uncancelSessionAction` clears the flags but does NOT auto-restore attendances or reopen registration. Cancelled records act as tombstones — auto-create cron's same-day check still sees them, blocking recreation. Charging blocked. Excluded from `getNextGame`, auto-close, low-attendance alerts, `hasActiveSession`, challenge windows.
- **Archive**: `archiveSessionAction(id, archive)`; archived excluded from `getNextGame()`.
- **Delete**: blocked if any attendance; `window.confirm` for empty. `deleteSessionAction` redirects to `/admin/sessions` on success.
- **Duplicate guard**: `createSessionAction` and `updateSessionAction` reject another session on the same Israel calendar day; edit excludes the session being updated.
- **Attendance management** (on the detail page):
  - **Add registered player**: `SessionAddPlayerForm` — searchable dropdown (icon-only circular submit).
  - **Quick drop-in**: `SessionQuickDropInForm` — name + phone. On valid phone calls `lookupPlayerByPhoneAction` and shows inline status: already_registered (red, disabled) / existing_not_registered (blue "שחקן קיים: [name]", name field hidden) / new (name required). `quickAddDropInAction` uses `findUnique + create` — never modifies existing player data.
  - **Promote waitlist**: `promoteWaitlistAction` re-timestamps the attendance to the last confirmed slot; "קדם" button per waitlisted row; WA notification to the player.
  - **Remove**: `SessionRemoveButton` with confirmation.
- **Manual roster broadcast**: "שלח עדכון רשימה" in the attendance section header → `broadcastSessionRosterAction` → `notifySessionRoster` (group). Useful when WA was down at notification time.
- **Validation**: `src/lib/session-validation.ts` — 16 unit tests covering DST conversion, bounds, etc.

#### Hourly rates (inline on `/admin/config`)

- Rates list rendered inline at the top of the config page card. Current rate (newest `effectiveFrom ≤ today`) highlighted green with "נוכחי" badge.
- Add → `/admin/config/rates/new`; edit → `/.../[id]/edit`; delete inline. Duplicate-date guard on create + update.

#### Config system (`/admin/config`)

- **`src/lib/config-keys.ts`** — client-safe constants: `CONFIG` key map, `ConfigKey` type, `CONFIG_DEFAULTS`. No Prisma/Node imports.
- **`src/lib/config.ts`** — server: re-exports `config-keys.ts` + `getConfigValue`, `getAllConfigs`, `getConfigInt`, `getConfigFloat`, `setConfigs`, `googleMapsUrl`, `wazeUrl`.
- **`src/lib/config-validation.ts`** — Zod with Hebrew errors; `parseConfigForm`. Includes `nonNegativeFloat` and `pctField` for rank weights.
- **Admin UI**: grouped form — מפגשים, לוח זמנים, מיקום, שחקנים, משחקים, **דירוג שחקנים** (3 weight inputs + 1 min-games-pct), תעריף שעתי (past rates collapsed), חיוב, וואטסאפ, **התראות נוכחות נמוכה**, **תקנון** (with macro reference + live preview toggle). Save = single transaction; if any rank key changed, calls `recalculateAllComputedRanks`.

**Config keys:**

| Key | Default | Purpose |
|-----|---------|---------|
| `session_schedule_day` | `1` (Mon) | Day-of-week for both manual session pre-fill and auto-create |
| `session_schedule_time` | `21:00` | Time HH:MM |
| `session_default_duration_min` | `120` | Session duration (min) |
| `rsvp_close_hours` | `13` | Hours before start that RSVP auto-closes |
| `location_name` / `location_lat` / `location_lng` | … | Default location for new sessions |
| `session_min_players` | `10` | Charge minimum + denominator for rate calculation |
| `debt_threshold` | `10` | Debt ILS threshold; below → drop-in tariff |
| `default_player_rank` | `50` | Rank for players with no manual rank |
| `match_win_score` | `12` | Points to win a match |
| `match_duration_min` | `7` | Per-match time limit |
| `session_schedule_enabled` | `false` | Enable auto-create cron |
| `session_auto_create_hours_before` | `48` | Hours before session that RSVP opens |
| `regulations_version` | `1` | Increment to force re-acceptance |
| `regulations_text` | (Hebrew template) | Editable body; supports `## heading`, `**bold**`, `{variable}` |
| `fine_no_show` / `fine_kick_ball` / `fine_early_leave` | `3` / `2` / `1` | Precedence point deductions |
| `rank_weight_admin` / `_peer` / `_winloss` | `1` / `1` / `1` | Computed-rank component weights |
| `rank_winloss_min_games_pct` | `50` | % of max-games-played threshold |
| `round_size` | `5` | Sessions per round (analytics + challenge windows) |
| `alert_low_attendance_enabled` | `false` | Master toggle for alerts |
| `alert_early_enabled` / `alert_early_hours_before` / `alert_early_template` | `false` / `48` / (Heb) | Early tier |
| `alert_critical_enabled` / `alert_critical_hours_before` / `alert_critical_template` | `false` / `2` / (Heb) | Critical tier |
| `wa_group_jid` | `""` | Group JID `XXXXXXXXXX@g.us` |
| `wa_notify_*_enabled` / `_template` | … | Per-event toggles + Hebrew templates (session open/close/cancelled, player registered/cancelled, waitlist promote, session roster, debtors, competition winner) |
| `competition_session_count` / `_min_matches_pct` | `6` / `10` | Competition defaults |

#### Precedence — רשימת קדימות

- **Score formula** (`src/lib/precedence.ts`):
  ```
  score = Σ(aggregate.count × yearWeight) + liveCurrentYearCount × currentYearWeight + Σ(adjustment.points)
  ```
- **Admin UI**:
  - `/admin/players` is the precedence list. `/admin/precedence` redirects here.
  - `/admin/players/[id]/edit` includes full precedence editing (aggregates + adjustments). `/admin/precedence/[playerId]` redirects here.
  - `/admin/precedence/weights` — year weights CRUD.
  - `/admin/precedence/[playerId]/adjustments/{new,[adjId]/edit}` — adjustment forms (date, points, description).
- **Validation + tests**: `src/lib/adjustment-validation.ts`, `src/lib/year-weight-validation.ts`; `src/lib/precedence.test.ts` (10 cases).

#### Dynamic ranking (`/admin/ranking`)

Computed rank blends three components:
```
peerScore     = (1 − (avgPosition − 1) / (N − 1)) × 100   [position 1 = best]
winScore      = winRatio × 100
effectivePeerW  = peerWeight  if REGISTERED && hasPeerData
effectiveWinW   = winWeight   if REGISTERED && gamesPlayed ≥ ceil(minPct/100 × maxGames)
computedRank  = (adminW×adminRank + peerW×peerScore + winW×winScore) / totalW
```
DROP_IN players use only the admin component.

- **Pure layer** (`src/lib/computed-rank-pure.ts`): `computeBlendedRank`, `normalizePeerScore`, `normalizeWinScore` — no DB.
- **DB layer** (`src/lib/computed-rank.ts`): `recalculateAllComputedRanks(actor)`, `getPlayerRankBreakdown(playerId)` (returns `matchStats`, `meetsThreshold`, `winThreshold` for admin display).
- **UI** lists peer rating sessions; open session shows submission count + Close button; closed sessions show a sortable table; "פתח שאלון חדש" auto-fills the year (current); "חשב מחדש" button.
- **Player-facing peer rating** (`/ranking/submit`): auth-gated; DROP_IN sees a notice; sortable list (`@dnd-kit/*` with `DragOverlay` so the dragged row becomes an invisible placeholder while a floating blue copy follows the pointer); two ↑/↓ buttons per row (44 px tap targets) for keyboard / no-DnD use. `submitPeerRatingAction` validates the ordering is a permutation of all REGISTERED players except self → `$transaction(delete + createMany) → recalculateAllComputedRanks`.
- **`PeerRatingBanner`** on `/profile`: amber dismissible when an open session has no submission from the player.
- **Tests**: `src/lib/computed-rank.test.ts` (18 cases).

#### Competitions / Challenges (`/admin/challenges` and `/challenges`)

One active competition at a time. Win-% only metric. Prize = free entry for winner. Auto-numbered (סיבוב 1, 2…). Live leaderboards computed passively from Match data.

- **Time window**: sessions with `date ≥ challenge.startDate`, sorted ASC, take first `sessionCount`. Completes when the Nth session is charged.
- **Eligibility**: only `REGISTERED` players compete. Must have played ≥ `effectiveThreshold = round(minMatchesPct/100 × maxMatchesPlayed)` matches in the window. `minMatchesPct = 0` → everyone qualifies.
- **Pure layer** (`src/lib/challenge-analytics.ts`): `computeLeaderboard({ minMatchesPct, windowSessionIds, matches, playerNames, registeredPlayerIds })` → `{ leaderboard, ineligible, effectiveThreshold }`. Each entry has `wins`, `losses`, and `sessionStats` (per-session W/L/total). Eligible sorted by win ratio desc, matchesPlayed desc, name. Ineligible sorted by matchesPlayed desc with `gamesNeeded`. Tested in `src/lib/challenge-analytics.test.ts`.
- **Server fetcher** (`src/app/challenges/data.ts`): `fetchChallengeLeaderboard(id)` + `fetchAllChallengeLeaderboards()` filter to REGISTERED players, return `{ leaderboard, ineligible, effectiveThreshold, completedSessions, sessions }`.
- **Winner flow** (`chargeSessionAction`): Nth session charged → compute final leaderboard → create `FreeEntry` for rank-1 → set `isClosed=true`, `winnerId` → WA group message → return `competitionResult` to UI. UI shows banner with winner + link to open new competition.
- **Free entry at charge time**: before proposing charges, `chargeSessionAction` finds attendees with unused `FreeEntry` records and passes them as `freeEntryPlayerIds`. They are excluded from the billable pool and receive `FREE_ENTRY` charges of ₪0; `FreeEntry.usedAt` set in the same transaction.
- **Admin CRUD**: List page (active at top, history below sorted by number desc); "פתח תחרות חדשה" only when no active. New/edit `ChallengeForm` (`startDate`, `sessionCount`, `minMatchesPct`); edit disabled when closed.
- **Player-facing** (`/challenges`): login-gated; active at top with live leaderboard; history below as collapsed `ChallengeCard` per past competition. Each row: name + W/L count + red-green `WinLossBar` + win%. Rows with ≥1 match expand a `SessionBreakdown` (per-session W/L). Top-3 visible; rest behind "הצג הכל"; current player pinned above the toggle when collapsed. Ineligible section collapsed by default with "לא עומדים בסף עדיין" + "חסרים X משחקים".

#### Match results

- **Schema**: `Match(sessionId, teamAPlayerIds, teamBPlayerIds, scoreA, scoreB)` — cascades on session delete. Multiple matches per session; teams editable after recording.
- **`SessionMatchPanel`** (`src/components/admin/session-match-panel.tsx`) — last section on the session detail page (mobile-first, designed for iPhone on-court use):
  - **Team selection**: 2-column grid (קבוצה א׳ | קבוצה ב׳); each player appears as a named toggle button in both columns; tapping atomically moves. Column header shows live count `(n/5)` (green when full). Buttons `min-h-11`, `py-3 text-sm`.
  - **Team size enforcement**: exactly 5 per team; non-members disabled when a team is full; submit disabled until both have 5.
  - **Score entry**: per-team labeled rows with `−` / `+` steppers (44 px) + direct numeric input. `−` disabled at 0; no upper bound.
  - **Match list**: 2-column — players on left (truncated), score on right; row clickable to edit; trash button stop-propagates. Score uses `–` separator; winner highlighted green.
  - **Auto-select on new match**: `computeNextMatchDefaults` inspects the last recorded match — winner → Team A, sitting-out players → Team B (3-team rotation). Tied → no pre-fill.
  - **Nickname display**: confirmed attendees prefer `nickname → firstNameHe → firstNameEn → name`.
- Server actions: `createMatchAction`, `updateMatchAction`, `deleteMatchAction` in `sessions/[id]/matches/actions.ts`.

#### Charging

- **Models**: `SessionCharge` + `ChargeAuditEntry`.
- **Engine** (`src/lib/charging.ts`):
  - `proposeSessionCharges(input)` returns null if attendee count < `session_min_players`; else: drop-ins + registered-in-debt each pay `ceil(totalCost / minPlayers)`; remainder after subtracting those payments is split equally among normal registered players with `Math.ceil`.
  - `computeSingleCharge(opts)` delegates to `proposeSessionCharges` with the full `allPlayers` list so the registered remainder is correct in cascade context.
- **Balance engine** (`src/lib/balance.ts`): `computePlayerBalance`, `computePlayerBalances` (bulk), `computeBalanceFromTotals` (pure). Subtracts `SessionCharge` totals AND `SharedExpenseCharge` totals; `BalanceBreakdown` exposes `sessionChargesTotal` / `sharedExpenseChargesTotal` breakouts.
- **Cascade recalc** (`src/lib/cascade-recalc.ts`): preserves admin delta (`newAmount = newCalculated + savedDelta`); `summarizeRecalc` for change preview.
- **Admin flow**: "חייב מפגש" button on the session detail page → `chargeSessionAction` writes charges + sets `isCharged=true`. "בטל חיוב" → `unchargeSessionAction`. Per-charge override with reason → `updateSessionChargeAction` + `ChargeAuditEntry`. UI: `SessionChargePanel` client component with clock-icon expand to view audit history.
- **Cascade UI**: after saving an override, `previewCascadeAction` runs automatically — if downstream session charges would change, an amber banner shows a per-player diff. Admin confirms → `applyCascadeAction` rewrites in one transaction with `reason: "cascade_recalc"` audit entries. No downstream → silent.
- **Per-player charge history** on `/admin/players/[id]/edit` — חיובי מפגשים section below תשלומים; read-only; clock icon links each row to its session.
- **Retroactive debt closure**: "סגירת חוב רטרואקטיבית" card embedded in the charging section, visible only when the focal player is REGISTERED with a trailing streak of consecutive DROP_IN charges (debt-threshold path). Modal with per-session expandable rows showing focal-player diff + every affected teammate (old → new, diff). Re-runs `proposeSessionCharges` with focal balance flipped to 0 and other in-debt-registered balances synthesized to remain in debt; sessions containing any `ADMIN_OVERRIDE` charge are skipped and surfaced as "דולגו". Apply rewrites in one transaction with `reason: "retro_close_debt"` audit entries + one `RETRO_CLOSE_DEBT` audit log. Idempotent — post-apply the streak is empty so the section disappears. **Critical mechanic**: closing the debt retroactively must reverse the redistribution end-to-end. The focal player's charge drops to registered AND every normal-registered teammate from those sessions loses their debt discount and is re-billed up at the new (higher) registered amount. Drop-in-by-kind, other still-in-debt teammates, free-entry, and ADMIN_OVERRIDE charges are untouched.
- **Admin auto-attendance + auto-offset**: `chargeSessionAction` creates a matching `Payment` row alongside each admin `SessionCharge` (same amount, `method: OTHER`, description `"קיזוז מנהל"`, `date: session.date`, `sessionId: session.id`) — both sides written in the same `$transaction` so charging and offsetting are atomic. `unchargeSessionAction` deletes by `sessionId` so admin-offset payments come off cleanly. `Payment.sessionId` (nullable FK) links offsets to source. Backfill: `scripts/backfill-admin-attendance.ts` — idempotent one-shot for historical sessions, uses Prisma 7 driver adapter.
- **Low-attendance alerts** (`src/lib/low-attendance-alert.ts`): `checkLowAttendanceAlerts` runs on every auto-close cron tick; two tiers (early / critical) with configurable hours + WA template; fire-once via `alertEarlyFiredAt` / `alertCriticalFiredAt` on `GameSession`; master toggle `alert_low_attendance_enabled`.
- **Tests**: `balance.test.ts` (6+ regression cases for shared expense), `charging.test.ts`, `cascade-recalc.test.ts` (11). All pure.

#### Shared expenses

- **Schema**: `SharedExpense(title, totalAmount, lookbackYears, minAttendancePct, eligibilityPool, createdBy, revertedAt?)` + `SharedExpenseCharge(sharedExpenseId, playerId, amount, manuallyAdded)`. Enum `EligibilityPool { REGISTERED_ONLY, ALL_PLAYERS }`.
- **Engine** (`src/lib/shared-expenses.ts` pure + `shared-expenses-server.ts` DB): `computeSharedExpenseShares(total, count)` floors with deterministic remainder distribution so the per-player sum equals `totalAmount` exactly. `computeEligible(candidates, sessionsTotal, minPct, pool)` is a pure threshold + pool filter; admin candidates always pass and report 100% (they run every session, so the system doesn't capture their attendance via Attendance rows). `findEligiblePlayers({lookbackYears, minAttendancePct, eligibilityPool})` is the DB orchestrator and uses **precedence-style attendance sources** — live segment (current year ∩ window) from `Attendance` rows; historical segment from `PlayerYearAggregate` with the boundary year fraction-scaled by its overlap with the window. **Denominator = max attendance count across all players in the window** (top attendee = 100% by definition; everyone else's pct is their share relative to the top). `listAllPlayersForManualAdd()` powers the manual-add dropdown.
- **Admin flow** (`/admin/finance/shared-expenses`): index lists past expenses with active/reverted status. `/new` → `SharedExpenseForm`: title, amount, lookback years, min attendance %, eligibility radio (REGISTERED_ONLY default vs ALL_PLAYERS). "טען תצוגה מקדימה" populates eligible table + full roster; admin can remove rows or use the searchable add-player dropdown to manually include any player from the pool (flagged with a manual badge). Share recomputes locally on every change. Submit → `createSharedExpenseAction` re-runs eligibility server-side (rejects stale lists), validates manual IDs exist, writes parent + N children in one `$transaction`. Detail page shows criteria + per-charge rows + revert button. `revertSharedExpenseAction` soft-marks parent (`revertedAt = now()`) and deletes children — balances restore automatically.
- **Tests**: `shared-expenses.test.ts` (14 cases) — share split (clean / remainder / total < count / zero count / zero total), rolling cutoff (whole + fractional years), eligibility filter.

#### Finance dashboard (`/admin/finance`)

- Summary cards (total paid / charged / net), debtors list, credits list, all-players table sorted by debt, recent payments, recent charges.
- All player rows fully clickable (overlay link + hover); links pass `?from=finance` so the player edit page shows "→ חזרה לפיננסים".
- **Manual debt reminder broadcast**: "שלח תזכורת" button in the debtors section header → `broadcastDebtorsAction` → `notifyDebtors` (group). Template macros `{debtors_list}` (newline-joined `{name} @{972…} — ₪{abs(balance)}` rows, biggest first), `{count}`. Button shows "נשלח לאחרונה: {date+time}" derived from the latest `BROADCAST_DEBTORS` audit log row — note the audit row is written via `await prisma.auditLog.create` (not fire-and-forget) before `revalidatePath` so the next render reflects it. `wa_notify_debtors_tag_enabled` (default on) `@`-mentions debtors via Baileys (see WA section).
- **Shared-expense entry**: link to `/admin/finance/shared-expenses`.

#### Audit log (`/admin/audit`)

Persistent action log covering every mutation in the system.

- **Helper** (`src/lib/audit.ts`): `writeAuditLog({ actor, actorIp?, action, entityType?, entityId?, before?, after? })` — fire-and-forget, never throws, never blocks the caller. `before`/`after` are JSON snapshots.
- **Instrumented call sites**: every mutating server action — auth (login/fail/logout), players (create/update/delete with snapshots), sessions (create/update/delete/archive/unarchive/open/close/cancel/uncancel + add/remove attendance), precedence (adjustments + aggregates + year weights), config (full snapshot diff + rates), WA / system (`SEND_WA_MESSAGE`, `SEND_ADMIN_TEST_OTP`, `WA_LOGOUT`, `RUN_AUTO_CREATE`, `AUTO_CREATE_SESSION` actor `cron`), ranking (open/close/delete/submit/recalc), import (`IMPORT_PLAYERS/PAYMENTS/AGGREGATES`), public RSVP (`RSVP_ATTEND`, `RSVP_CANCEL`), regulations (`PLAYER_ACCEPTED_REGULATIONS`), profile (`PLAYER_PROFILE_UPDATED`, `PLAYER_PROFILE_COMPLETED`), shared expenses (`CREATE_SHARED_EXPENSE`, `REVERT_SHARED_EXPENSE`), retro debt (`RETRO_CLOSE_DEBT`), broadcasts (`BROADCAST_SESSION_ROSTER`, `BROADCAST_DEBTORS`).
- **Admin page**: server-rendered, 75 entries/page.
  - **Filters** (URL params): `action` dropdown (Hebrew labels), `entity` dropdown, `actor` text, `from`/`to` date range, `q` free-text (searches `entityId` + `actor`); clear link when any filter active.
  - **Table** (`AuditLogTable` client component): color-coded action badges (green=creates, blue=updates/state-changes, red=deletes, purple=admin auth, violet=player auth, amber=OTP, indigo=imports, teal=WA/system); actor badge (purple=admin, zinc=cron, amber=player phone), IP sub-label. Responsive — entity column hidden on mobile, no horizontal scroll on 430 px.
  - **Human-readable**: action names → Hebrew (`ACTION_LABELS`); actor column resolves player IDs to display names; entity column resolves player IDs to names and session IDs to Hebrew dates. Server-side ID resolution via two batch queries.
  - **Expandable rows**: clicking reveals `JsonDiff` — for objects shows each field with before/after columns, changed rows highlighted amber; for raw JSON shows pre blocks. No-details rows show a dot.
  - **Pagination**: prev/next with page N of M counter.
- **Retention**: `pruneAuditLogs(retentionDays)` cron job daily, default 90 days (env override `AUDIT_LOG_RETENTION_DAYS`, clamped `[1, 3650]`).

#### Import pipeline (`/admin/import`)

Migrates historical Sheets data into the DB. Three flows; each has file upload OR paste CSV (tab switcher), client-side parse → preview table (✓/✗ per row) → confirm → server action.

- **Player fields used**: `nickname` (primary matching key, indexed), `firstNameHe/En`, `lastNameHe/En`, `birthdate`, plus the existing `phone` / `playerKind` / `positions`.

| Flow | Route | CSV format | Key |
|------|-------|-----------|-----|
| שחקנים | `/admin/import/players` | `nickname,firstNameHe,lastNameHe,firstNameEn,lastNameEn,phone,birthdate,playerKind,positions` | upsert by `phone`; update by `nickname` if no phone |
| נוכחות עבר | `/admin/import/aggregates` | Wide: `nickname,2021,2022,…` | upserts `PlayerYearAggregate(playerId, year)` |
| תשלומים | `/admin/import/payments` | Wide: `date,אבי,עידן,…` | creates `Payment` rows |

- **CSV parsing** (`src/lib/csv-import.ts`): pure functions, RFC 4180 quoted fields (handles `"PG,SG"` multi-value cells), birthdate accepts ISO + Israeli formats. 30 unit tests.
- **Conflict review** (`src/components/admin/import-upload.tsx`): optional `checkConflicts` prop — each conflicting row gets a דלג/דרוס choice; only decided rows are passed to `onImport`.
- **Results import** (תוצאות sheet) — deferred.

#### QA testing system (`/admin/testing`)

Admin-only page for end-to-end manual testing with automated DB-state verification.

- **Snapshot manager**: save / restore / delete full DB snapshots. Prisma-based serialization, gzipped, stored in `/opt/irba/backups/snapshots/{label}__{ISO_timestamp}.json.gz` (persistent volume). FK-safe restore in a single `$transaction` (children before parents on delete; parents before children on insert; resets `AuditLog` autoincrement). Path-traversal protection; `requireAdmin()` guard.
- **Interactive test plan**: 60 steps across 20 groups. Each step: `id`, `group`, `title`, `instructions[]`, optional `links[]`, `verifyFnName`. Steps unlock sequentially. "Verify" → `runVerification(stepId)` server action → `{ pass, detail, manual? }`. Steps with no automated verification return `manual=true` (blue dot). Progress in `localStorage` (`irba-test-plan-results`). On mount the plan auto-expands and scrolls the first non-passed step into view.
- **Cron verification (Group 19)** runs lib functions directly (`autoClosePastSessions()`, `autoCreateNextSession({ force: true })`) instead of HTTP-fetching `/api/cron/*` — same code path but avoids server-to-self fetch failures.
- **OTP lookup widget** on steps that require player login: generates a fresh OTP, stores bcrypt hash in DB, sends plaintext code as a WA DM to the admin phone — plaintext never hits DB or browser.
- **11 test players** (A–K, phones `0500000001`–`0500000011`): A–C manual; D–K auto-created on demand. D = DROP_IN; E–K = REGISTERED. All match steps use 5v5; sessions use maxPlayers=10.
- **Group order**: 0 Snapshot → 1 Config → 2 Players → 3 Competition setup → 4 Session 1 lifecycle → 5 Public RSVP → 6 Match recording → 7 Leaderboard → … . Competition creation precedes session 1 so session 1 + matches are scoped into the active challenge window.
- **Competition winner is B** (not A) — given prescribed match outcomes B ends 5W/1L (83%) vs A 7W/3L (70%). Group 9.3 verifies `winnerId=B`; Group 10 consumes B's FreeEntry in session 4; Group 11.1 overrides A's normal-tariff charge.

#### WhatsApp admin (`/admin/wa`)

Dedicated page. Combines three widgets:

- **Bot status**: `WaBotStatus` widget — green/red dot, QR when disconnected, action button. Polls every 15 s (4 s when disconnected so a fresh QR appears quickly). Action button context-aware: **"התנתק"** when ready (POST `/logout` → wipes session); **"אפס וצור QR חדש"** when disconnected (same call, framed as manual recovery). Combined with sidecar auto-recovery on `loggedOut`, no SSH required to re-pair.
- **Manual group send**: `WaSendForm` — read-only group JID + resolved name (fetched from sidecar on mount); textarea + "שלח לקבוצה" button. If `wa_group_jid` not set, hint links to `/admin/config`.
- **Admin OTP forwarder** (`WaAdminOtpForm`): admin enters a player's phone → `sendAdminTestOtpAction` generates a fresh 6-digit OTP, stores its bcrypt hash on the player (`otpCode` + 10 min `otpExpiresAt`), and sends the plaintext code as a WA DM to the admin's own phone. Used for QA / support — admin can hand the code to the player out-of-band when the player can't receive a WA message themselves. Requires `WA_NOTIFY_ENABLED=true`. Audited as `SEND_ADMIN_TEST_OTP` with `{ targetPhone, adminPhone }`. Tested in `wa/actions.test.ts`.

### WhatsApp sidecar (`wa/`)

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

### Cron jobs

#### Auto-create (`GET /api/cron/auto-create`)

Idempotent endpoint, called hourly by EC2 cron. Bearer-token auth (`CRON_SECRET`).
1. Check `SESSION_SCHEDULE_ENABLED=true` in AppConfig
2. Compute next scheduled session datetime (`src/lib/schedule.ts` — DST-safe via `Intl.DateTimeFormat`)
3. If `now ≥ sessionTime − autoCreateHours` and no session exists for that Israel day (any status, including cancelled — tombstones block recreation) → create + auto-attend admin + notify WA group
4. Otherwise → `{ created: false, reason }`

Core in `src/lib/auto-create-session.ts`. Admin config has a **"הרץ עכשיו"** button (in לוח זמנים) calling `runAutoCreateAction({ force: true })` to bypass the lead-time check.

#### Auto-close (`GET /api/cron/auto-close`)

Idempotent, called every minute by EC2 cron.
1. Find sessions with `isClosed=false AND isArchived=false`
2. For each, compute `endTime = date + (durationMinutes ?? defaultDuration) min`
3. If `endTime ≤ now` → set `isClosed=true`, write `CLOSE_SESSION` audit (actor: cron), notify WA group
4. Run `checkLowAttendanceAlerts` — fire WA group message if any upcoming open session is below `session_min_players` and the alert hasn't fired for that session/tier
5. Returns `{ closed: string[], skipped: number, alerts: { earlyFired, criticalFired } }`

Core in `src/lib/auto-close-sessions.ts`; alert logic in `src/lib/low-attendance-alert.ts`.

#### Audit-prune (`GET /api/cron/prune-audit`)

Idempotent, called daily by EC2 cron. Deletes `AuditLog` rows older than `retentionDays` (default 90) and `AssistantRequestLog` rows older than `assistant_log_retention_days` (default 7). Returns `{ deleted, cutoff, assistantDeleted, assistantCutoff }`. Core in `src/lib/audit-prune.ts`.

### Regulations acceptance gate

- **Schema additions to `Player`**: `regulationsAcceptedAt`, `regulationsAcceptedVersion`.
- **Flow**: root layout (`src/app/layout.tsx`) is `async` — on every request it checks if the logged-in player's `regulationsAcceptedVersion` is null or behind `regulations_version` config. If so, `RegulationsOverlay` renders before children, blocking content. Zero client-side flash.
- **Overlay UX**: full-screen `fixed inset-0 z-50`. Scrollable content area; sticky header + footer. Accept button starts disabled; enables only after `IntersectionObserver` confirms the bottom sentinel has been reached (root must be the scrollable div, not viewport). `acceptRegulationsAction` records timestamp + version, writes `PLAYER_ACCEPTED_REGULATIONS` audit, calls `revalidatePath("/", "layout")`. On success the overlay calls `router.refresh()` and stays mounted (spinning) until the new layout tree arrives — this avoids a flash of the underlying page between the regulations overlay and the profile completion overlay that often follows it.
- **Versioning**: admin bumps `regulations_version` → all players see the overlay again.
- **Re-read from profile**: `/profile` → "תקנון" → "קרא את התקנון" opens a non-blocking full-screen modal (`RegulationsViewer`) with the same rendered content but no accept button or scroll gate.
- **Template engine** (`src/lib/regulations-renderer.ts`): line-by-line parser with buffer/flush. Supports `## Heading` (h3), `### Sub-heading` (h4), `**bold**`, `- bullet` (consecutive `-` lines form one `<ul>`), blank line (paragraph break), `{variable}` substitution (all config keys + special `{session_schedule_day_name}`). `RegulationsContent` reused by both viewer and admin live preview.
- **Default content**: 10 sections — ידידות, הוגנות וספורטיביות, כיף, כללי המשחק (with `{match_win_score}` נק׳ / `{match_duration_min}` דק׳ + sub-heading עבירות קבוצה using `{fouls_until_penalty}`), סמכות מנהל, לוח זמנים, כספים (`{debt_threshold}₪`), הרשמה והגעה, קנסות עדיפות (with `{fine_no_show/kick_ball/early_leave}`), אפס סובלנות לאלימות, הסכמה לוואטסאפ.

### Profile completion gate

Runs alongside (and after) the regulations gate in the async root layout. Every logged-in player must have a baseline profile filled before they can use the rest of the app. Also picks up the slack left when OTP first-login was simplified — there is no more forced password setup or `set_name` step during OTP verify; the overlay collects whatever the player still owes.

- **Required fields by player kind** (`src/lib/profile-completion.ts`):
  - `REGISTERED`: `firstNameHe`, `lastNameHe`, `birthdate`, `nationalId`, `email`
  - `DROP_IN`: `firstNameHe`, `lastNameHe`
  - Exported helpers: `REGISTERED_REQUIRED_FIELDS`, `DROP_IN_REQUIRED_FIELDS`, `requiredFieldsFor(playerKind)`, `isProfileComplete(player)`.
- **Validation** (`src/lib/player-validation.ts`): `parseProfileForm(raw, { playerKind })` only enforces the fields required for that kind — birthdate / nationalId / email errors are skipped entirely for DROP_INs.
- **Overlay** (`ProfileCompletionOverlay`): renders inside the async root layout when `isProfileComplete(player) === false`, but only after the regulations gate is cleared (regulations always renders first). For DROP_INs the REGISTERED-only inputs (birthdate, nationalId, email, English names, nickname) are hidden so the form is a 2-field stub. Save → `completeProfileDetailsAction` (in `src/app/actions/player-profile.ts`) which validates with `parseProfileForm({ playerKind })`, persists the fields, writes a `PLAYER_PROFILE_COMPLETED` audit entry, and calls `revalidatePath("/", "layout")` — invoked via a form-action submit so Next.js auto-revalidates and the overlay unmounts naturally.

### Balanced team selection

- **Algorithm** (`src/lib/team-balance.ts`): snake-draft assigns players sorted by rank desc (A B C C B A A B C…) → minimises rank-sum variance. `generateTeamOptions(players, seed)` — seed param (default 0) derives per-tier shuffle seeds; UI passes a fresh `Math.random()` seed per call so re-shuffle is genuinely different. Handles non-divisible N gracefully (e.g. 14 → 5/5/4). Pure function — no DB. Uses `computedRank ?? rank` (so peer / win-loss data flows through). 9 unit tests.
- **Admin UI** (`TeamBalancePanel` on the session detail page, between attendance and match panels):
  - "צור קבוצות" (disabled + note when < 3 confirmed)
  - 3 option cards stacked vertically; each card: Teams א׳/ב׳/ג׳ with player names + rank sum
  - Per-row: name, position badges (PG/SG/SF/PF/C, monospace pill), rank (right-aligned, admin-only)
  - "העתק" copies names-only plain-text Hebrew (no rank/positions)
  - "ערבב מחדש" generates different teams every press
- **WA group send + poll**: send option to group; emit a single-choice poll for the group to vote.

### Player-facing pages

- **`/profile`** — section order:
  1. **יתרה** — balance card (paid / charged / net)
  2. **סטטיסטיקות משחק** — match analytics: all-time summary (W/L/T + win%, ties excluded from ratio); breakdown toggle "לפי תחרות" (per-Challenge — סיבוב N, win%, W/L/T, active/closed badge; Challenges with 0 player matches hidden) / "לפי מפגש" (per-session date + bar); teammate affinity top 5 ("X ניצחונות מתוך Y משחקים יחד")
  3. **היסטוריית פעולות** — paginated account statement (payments + charges, running balance, filter tabs, per-page selector); URL-param driven
  4. **נוכחות אחרונה** — last 10 sessions attended
  5. **הגדרות** — single card: password set/change + regulations viewer + theme selector
  - **Self-service profile editing** ("פרטים אישיים" card): all logged-in players edit their own `firstNameHe/En`, `nickname`, `birthdate`, `nationalId`, `email`. Inline display ↔ edit modes; `updatePlayerProfileAction` audited as `PLAYER_PROFILE_UPDATED`.
- **`/precedence`** — login-gated; full precedence ranking. Server Component reuses `computePrecedenceScores`; filters out players with no history. Client `PrecedenceTable` is an expandable accordion (one open at a time): rank + name + score; tap expands inline detail (year-by-year `sessions × weight = points` + adjustments list). Current player highlighted blue with "(אתה)".
- **`/challenges`** — see Competitions section.
- **`/ranking/submit`** — see Dynamic ranking section.

**Date / datetime input system (canonical, Israeli format)**: all date / date-time fields share two components:
- `DateInputIL` (`src/components/ui/date-input-il.tsx`) — `DD/MM/YYYY`
- `DateTimeInputIL` (`src/components/ui/datetime-input-il.tsx`) — `DD/MM/YYYY HH:MM`

Identical UX everywhere — auto-formats digits (8 → date, +`:` between hour/minute, single space between date and time); accepts `/ . -` separators (auto-rebuilt to `/`); live validation rejects impossible dates (31/02) and out-of-range times; calendar icon overlays a transparent native `<input type="date">` / `<input type="datetime-local">` so the OS picker opens reliably; submits via a hidden ISO field. Used by `EditProfileForm`, `ProfileCompletionOverlay`, admin `PlayerForm`, `SessionForm`, `AdjustmentForm`, `HourlyRateForm`, `ChallengeForm`, `PlayerPayments`, sessions list filters, audit log filters. Config "שעת התחלה" uses native `<input type="time">` (locale-neutral 24 h).

### Tests

`npm test` runs Vitest with no Postgres requirement. All tests are pure (no DB).

- `phone`, `maskPhone`, `rate-limit` (incl. admin login), `admin-session`, `bcryptjs verify`, mocked `checkDatabase`
- `player-validation.test.ts` (25 cases) — fields, normalization, multi-position, isAdmin
- `session-validation.test.ts` (16 cases) — DST conversion, bounds
- `precedence.test.ts` (10) — score formula, edge cases
- `schedule.test.ts` (10) — DST winter/summer, midnight/23:59
- `waitlist-promote.test.ts` (8)
- `computed-rank.test.ts` (18) — pure peer + win + blend
- `challenge-analytics.test.ts` — sorting, tie-breaking, threshold filtering, drop-in exclusion, ineligible `gamesNeeded`, window scoping
- `match-analytics.test.ts` (25) — match stats, session breakdown, teammate affinity
- `team-balance.test.ts` (9) — snake draft, non-divisible N
- `csv-import.test.ts` (30)
- `cascade-recalc.test.ts` (11)
- `balance.test.ts` (6+ shared-expense regression)
- `charging.test.ts`
- `shared-expenses.test.ts` (14)
- `wa/actions.test.ts` (admin OTP forward)

### Security / abuse

- **OpenClaw assistant API**: `POST /api/assistant/v1` is a narrow typed API for Mikey/OpenClaw. Auth is `Authorization: Bearer <ASSISTANT_API_SECRET>` and fails closed if the env var is missing. Requests must include `operation`, `actor_phone`, `group_jid`, `idempotency_key`, and optional `params`; Phase 1 read-only implementation adds `help`, `session_status`, and `next_session` (production deployment/smoke pending). `group_jid` must be in AppConfig `assistant_allowed_groups` (empty = disabled). `actor_phone` accepts `05...`, `972...`, or `+972...` and is resolved server-side to guest/member/admin from `Player.isAdmin`. Results are stored in `AssistantRequestLog` and same-key retries replay the cached result. No inbound WhatsApp listener or natural-language execution exists in IRBA. Planning docs: `docs/OPENCLAW_IRBA_INTEGRATION_PLAN.md`; Phase 1 execution plan: `docs/plans/openclaw-irba-phase-1-read-only-mvp.md`.
- **Cookies**: HTTP-only, `Secure` in production or when `RSVP_COOKIE_SECURE` set; player + RSVP use `sameSite=lax` (compatible with WA-link redirects); JWT verifies `iss`/`aud` (defaults `irba` / `irba-rsvp`).
- **Rate limits** (in-memory per process): attend / cancel, **admin login**, **player login** (shared across OTP-send/verify and password login), and a stricter **OTP-send** bucket (per-phone + per-IP, both must pass) applied at the WA-message-issuing step so an attacker can't spam a victim's phone or burn the WA budget; client IP from `CF-Connecting-IP`, `X-Real-IP`, or first `X-Forwarded-For` hop.
- **Response headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, full **CSP** (`default-src 'self'`, `script-src 'self' 'unsafe-inline'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `frame-src` allows OpenStreetMap, `frame-ancestors 'none'`) — `next.config.ts`.
- **Mobile zoom**: `viewport` export sets `maximumScale: 1` to prevent iOS auto-zoom on input focus (pinch-zoom still works).

### Ops / DX

- **`GET /api/health`** — JSON; 200 if DB answers `SELECT 1`, else 503 (generic body, no secrets). Response includes `version` (git commit hash) and `wa.ready`.
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

### Accessibility

All admin form label/input associations have been audited and fixed:
- `Field` component in `config-form.tsx` accepts `htmlFor`, propagated to its `<label>`; all 14 `Field` usages pass `htmlFor={CONFIG.xxx}` with matching `id`.
- Standalone WA Group JID label has `htmlFor`/`id`.
- Group filter input uses `aria-label` (transient widget, no visible label).
- Manual send textarea linked via `htmlFor="wa-send-message"`.
- `hourly-rate-form.tsx`: both labels have `htmlFor` with matching `id` on inputs.
- `session-form.tsx`: WA override template label linked.
- `session-quick-dropin-form.tsx`: name + phone use `aria-label` (compact inline form).
- `session-add-player-form.tsx`: player select uses `aria-label`.

---

## Decisions & Constraints

| Topic | Decision |
|--------|----------|
| **Player = User** | No separate User model. `Player` IS the user. Phone is the identity key. |
| **Admin auth** | Single `Player.isAdmin` flag — no separate admin login. Legacy `ADMIN_PASSWORD_HASH` files kept for reference but unused. |
| **First-login UX** | OTP verify drops the player straight on `/profile`; no forced password setup, no `set_name` step. The layout overlays (regulations + profile completion) collect anything that's still missing. Password is opt-in from `/profile`. |
| **Balance** | Always computed: `Σ(payments) − Σ(sessionCharges) − Σ(sharedExpenseCharges)`. Never stored. Opening balances handled via a payment record at import time. |
| **WhatsApp** | Baileys library, dedicated SIM. Used for OTP delivery + all notifications + group-broadcast roster + manual debt reminders + admin-forwarded test OTPs. |
| **Cascade recalc** | Editing any past `SessionCharge` triggers chronological re-evaluation of all subsequent sessions for all players (running balance at each session determines charge tier). |
| **Admin court cost** | Admin is auto-attended on every session and charged as a regular registered player; `chargeSessionAction` writes a matching `Payment` (`method: OTHER`, "קיזוז מנהל") so balance stays ~0. |
| **In-debt drop-in pricing** | A registered player below `−debt_threshold` is charged at the drop-in tariff. Their surplus is redistributed as a discount across normal-registered teammates in the same session. Retroactive / what-if work must reverse this end-to-end (focal player drops to registered AND every teammate loses their discount). |
| **Waitlist order** | Admin first, then REGISTERED by precedence score desc, then DROP_IN by `createdAt` asc. Promotion is manual. |
| **Cancellation tombstones** | Cancelled `GameSession` records remain in the DB with cleared attendance and act as same-day tombstones; auto-create won't recreate, charging is blocked, excluded from `getNextGame` / auto-close / alerts / challenge windows / `hasActiveSession`. |
| **Profile completion** | Required for both player kinds — REGISTERED need 5 fields (Hebrew first+last name, birthdate, nationalId, email); DROP_IN need only Hebrew first+last name. Enforced by the post-login `ProfileCompletionOverlay`. |
| **PWA** | Deferred indefinitely — app is fully server-dependent, offline adds no value. |
| **Results import (תוצאות sheet)** | Deferred. |
| **Municipality CSV export** | Deferred. |
| **Redis rate limits** | Single replica; in-memory per-process is fine for now. |

---

## Future suggestions

Loosely ordered by likely impact / cost ratio. Treat as a brainstorm of natural next steps now that the league management core is stable.

#### A. Multiple admin roles
Today there is one boolean `isAdmin`. Splitting into roles (e.g. `OWNER` / `TREASURER` / `COACH`) would let a treasurer manage payments without granting full DB access — and is a prerequisite for handing IRBA to a successor. Schema change: `Player.role` enum + per-action capability checks in `requireAdmin()`. Existing audit log already records actor identity, so the audit trail mostly comes free.

#### B. Per-player notification preferences
Some players want every roster update; others want only their own status changes. Add a per-player `notificationPrefs` JSON (or columns) and gate WA dispatchers on it. Useful especially for the roster-broadcast flow which currently fans out to the whole group — a quiet-hours / mute toggle would cut complaints without losing the always-synced roster benefit.

#### C. SMS fallback for OTP
OTP is WA-only today. A new player without WhatsApp can't log in (admin-forwarded OTP via `/admin/wa` is a workaround but requires admin involvement). Adding Twilio (or 019 / Cellact) SMS as a fallback when the WA bot is offline or the user hasn't received the OTP within ~30 s would close the last "I can't log in" support case. Reuse `requestOtpAction` plumbing — only the delivery channel changes.

#### D. Calendar feed (.ics export)
A signed per-player `.ics` URL (`/api/calendar/{playerToken}.ics`) that exposes upcoming sessions plus that player's RSVP status would let players subscribe in Google Calendar / Apple Calendar without needing the app. Cheap to build (no UI) and adds real ambient value.

#### E. Public season summary page
End-of-season "yearbook" — final leaderboard, biggest comebacks, longest win streak, MVP of the year (highest `computedRank` swing). Generate a static page per closed year from existing `Match` + `Challenge` + `PeerRatingSession` data. Good marketing artifact for the WA group; nothing to maintain because it's a snapshot.

#### F. Tournament brackets (vs round-robin Challenges)
The current `Challenge` model assumes win% over a window. Some events (a 4-team knockout night, end-of-season cup) need single- or double-elimination brackets. Add `Tournament` + `TournamentMatch(round, slot, winnerAdvancesTo)`; reuse `SessionMatchPanel` UX for score entry. Probably the next natural extension to the competition system.

#### G. Streaks / achievements / badges
Cheap engagement boost: badge a player who attends 10 in a row, wins 5 straight matches, fills a waitlist gap last-minute. Compute from existing `Attendance` + `Match` data — pure derived view, no new write paths. Show as small icons next to names on the players list and `/profile`.

#### H. Photo upload per match / session
A single photo per session (admin uploads), shown on the homepage banner after the session and on `/profile` history. Object store (S3 / Cloudflare R2) + signed URLs; reuse the EC2 IAM role. Adds minimal DB surface (`GameSession.photoKey String?`).

#### I. Player profile cards (limited public view)
Let any logged-in player view another player's stats card (matches, win%, computed rank, position, attendance %). Today `/profile` is self-only. This is the "social" piece that makes peer-rating context-rich — when ranking teammates you'd see their stats inline. Scope: a new `/players/[id]` route reusing the analytics components from `/profile`, gated to logged-in users; admin-controlled fields hidden.

#### J. Smarter team rotation suggester
Today `SessionMatchPanel` auto-fills "winner stays + sitting-out team in" but only naively (last winner). A smarter suggester would consider rest minutes per player, win-rate balance over the night, and avoid back-to-back-of-back-to-back for the strong players. Pure function — drop into the existing panel as a "הצע קבוצות" button.

#### K. Multi-venue / multi-group tenancy
Today the app assumes one IRBA league at one location. If a sister group at another school wants the same tooling, multi-tenancy via a `League` parent table (with per-league `AppConfig`, players, sessions) is the conservative path. Big change — only worth doing when there's a concrete second tenant.

#### L. AI match summaries
Daily WA digest after a session: "Tonight at IRBA — 4 matches, A won 3 in a row, biggest upset was C beating B 12-9 in match 3. Top streak: D, 4 of 4." Wire `Match` + `Attendance` data into Claude Haiku via the Anthropic SDK; one-shot `wa-notify` dispatch. Cheap to prototype, high "this lives in WhatsApp where the league actually lives" value.

---

*Last updated: 2026-05-11 — reflects all commits through `79a73dd` (simplified OTP first-login). IRBA is live in production at https://irba.club.*
