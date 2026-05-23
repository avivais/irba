# IRBA Product & Feature Reference

Detailed feature notes extracted from `PROJECT_STATE.md`. Keep `PROJECT_STATE.md` short; put durable feature-level details here.

## Identity & auth

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

## Public RSVP flow

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

## Admin area

### Navigation & shell

- **Top nav** (`PlayerNav` server component, `src/components/player-nav.tsx`) renders on all pages — homepage, profile, all admin pages. Shows IRBA brand (sole home link), Profile icon, Admin icon (if `isAdmin`), Logout. Active page highlighted via `NavLinks` client component (`usePathname()`). No ThemeToggle in nav.
- **Admin home (`/admin`)**: nav cards to שחקנים, מפגשים, ייבוא נתונים, הגדרות, **לוג פעולות**, **דירוג שחקנים** (`/admin/ranking`), **תחרויות** (`/admin/challenges`); logout button. All cards have `active:` press states.
- **Back links**: all admin pages display "→ חזרה" with no destination suffix.
- **Sticky bottom save bar** on the config page: slides in only when the form is dirty.
- **WaStatusDot** (`src/components/admin/wa-status-dot.tsx`) — green/red badge on the MessageCircle icon in the admin nav, polls `fetchWaStatusAction` every 15 s.

### Players (`/admin/players`) — unified with Precedence

- **List**: all players sorted by precedence score desc, ranked #1…N. Shows kind badge (קבוע / מזדמן), positions, phone (clickable `wa.me` link → opens WA DM), balance (color-coded `dir="ltr"`), current-year attendance with fraction, total precedence inline in subscript, **computed rank** (blue, e.g. "72.4") with "(ידני: X)" muted subscript when set. Edit + delete buttons; full-row click navigates. **משקלות** button → `/admin/precedence/weights`. **Add player** button is a circular `+` (icon-only — saves space on mobile). Loading state: spinner + freeze overlay.
- **Add** (`/admin/players/new`): phone, playerKind, positions (multi-select PG/SG/SF/PF/C), rank, balance (text + `inputMode="numeric"` so the browser doesn't drop intermediate `-`), isAdmin, nickname, name fields (He/En), birthdate. Cancel + back triggers dirty-guard confirm. Popstate guard active.
- **Edit** (`/admin/players/[id]/edit`): header shows `מקום N · ניקוד X`. Phone disabled. Dual save buttons (**שמור שינויים** stay / **שמור וחזור לרשימה**). Cancel + back with dirty-guard confirm. **Section order**: (1) form, (2) תשלומים, (3) חיובי מפגשים (with retroactive-debt-closure card when applicable), (4) דירוג מחושב + win/loss stats, (5) נוכחות (current year + historical merged), (6) בונוסים/קנסות.
- **Computed rank card**: labeled grid showing `value × weight = contribution` per component; inactive components grayed out with Hebrew reason; formula summary `סכום ÷ N = X`. Win/loss row shows total · wins · losses · win% bar · threshold badge ("מעל הסף" / "מתחת לסף", with "חסרים X משחקים" when below).
- **Delete**: blocked if any attendance records (count shown in tooltip); `window.confirm` for empty players. Server action double-checks before deleting.
- **Validation**: `src/lib/player-validation.ts` (Zod + phone normalization) — 25 unit tests.

### Sessions (`/admin/sessions`)

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

### Hourly rates (inline on `/admin/config`)

- Rates list rendered inline at the top of the config page card. Current rate (newest `effectiveFrom ≤ today`) highlighted green with "נוכחי" badge.
- Add → `/admin/config/rates/new`; edit → `/.../[id]/edit`; delete inline. Duplicate-date guard on create + update.

### Config system (`/admin/config`)

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

### Precedence — רשימת קדימות

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

### Dynamic ranking (`/admin/ranking`)

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

### Competitions / Challenges (`/admin/challenges` and `/challenges`)

One active competition at a time. Win-% only metric. Prize = free entry for winner. Auto-numbered (סיבוב 1, 2…). Live leaderboards computed passively from Match data.

- **Time window**: sessions with `date ≥ challenge.startDate`, sorted ASC, take first `sessionCount`. Completes when the Nth session is charged.
- **Eligibility**: only `REGISTERED` players compete. Must have played ≥ `effectiveThreshold = round(minMatchesPct/100 × maxMatchesPlayed)` matches in the window. `minMatchesPct = 0` → everyone qualifies.
- **Pure layer** (`src/lib/challenge-analytics.ts`): `computeLeaderboard({ minMatchesPct, windowSessionIds, matches, playerNames, registeredPlayerIds })` → `{ leaderboard, ineligible, effectiveThreshold }`. Each entry has `wins`, `losses`, and `sessionStats` (per-session W/L/total). Eligible sorted by win ratio desc, matchesPlayed desc, name. Ineligible sorted by matchesPlayed desc with `gamesNeeded`. Tested in `src/lib/challenge-analytics.test.ts`.
- **Server fetcher** (`src/app/challenges/data.ts`): `fetchChallengeLeaderboard(id)` + `fetchAllChallengeLeaderboards()` filter to REGISTERED players, return `{ leaderboard, ineligible, effectiveThreshold, completedSessions, sessions }`.
- **Winner flow** (`chargeSessionAction`): Nth session charged → compute final leaderboard → create `FreeEntry` for rank-1 → set `isClosed=true`, `winnerId` → WA group message → return `competitionResult` to UI. UI shows banner with winner + link to open new competition.
- **Free entry at charge time**: before proposing charges, `chargeSessionAction` finds attendees with unused `FreeEntry` records and passes them as `freeEntryPlayerIds`. They are excluded from the billable pool and receive `FREE_ENTRY` charges of ₪0; `FreeEntry.usedAt` set in the same transaction.
- **Admin CRUD**: List page (active at top, history below sorted by number desc); "פתח תחרות חדשה" only when no active. New/edit `ChallengeForm` (`startDate`, `sessionCount`, `minMatchesPct`); edit disabled when closed.
- **Player-facing** (`/challenges`): login-gated; active at top with live leaderboard; history below as collapsed `ChallengeCard` per past competition. Each row: name + W/L count + red-green `WinLossBar` + win%. Rows with ≥1 match expand a `SessionBreakdown` (per-session W/L). Top-3 visible; rest behind "הצג הכל"; current player pinned above the toggle when collapsed. Ineligible section collapsed by default with "לא עומדים בסף עדיין" + "חסרים X משחקים".

### Match results

- **Schema**: `Match(sessionId, teamAPlayerIds, teamBPlayerIds, scoreA, scoreB)` — cascades on session delete. Multiple matches per session; teams editable after recording.
- **`SessionMatchPanel`** (`src/components/admin/session-match-panel.tsx`) — last section on the session detail page (mobile-first, designed for iPhone on-court use):
  - **Team selection**: 2-column grid (קבוצה א׳ | קבוצה ב׳); each player appears as a named toggle button in both columns; tapping atomically moves. Column header shows live count `(n/5)` (green when full). Buttons `min-h-11`, `py-3 text-sm`.
  - **Team size enforcement**: exactly 5 per team; non-members disabled when a team is full; submit disabled until both have 5.
  - **Score entry**: per-team labeled rows with `−` / `+` steppers (44 px) + direct numeric input. `−` disabled at 0; no upper bound.
  - **Match list**: 2-column — players on left (truncated), score on right; row clickable to edit; trash button stop-propagates. Score uses `–` separator; winner highlighted green.
  - **Auto-select on new match**: `computeNextMatchDefaults` inspects the last recorded match — winner → Team A, sitting-out players → Team B (3-team rotation). Tied → no pre-fill.
  - **Nickname display**: confirmed attendees prefer `nickname → firstNameHe → firstNameEn → name`.
- Server actions: `createMatchAction`, `updateMatchAction`, `deleteMatchAction` in `sessions/[id]/matches/actions.ts`.

### Charging

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

### Shared expenses

- **Schema**: `SharedExpense(title, totalAmount, lookbackYears, minAttendancePct, eligibilityPool, createdBy, revertedAt?)` + `SharedExpenseCharge(sharedExpenseId, playerId, amount, manuallyAdded)`. Enum `EligibilityPool { REGISTERED_ONLY, ALL_PLAYERS }`.
- **Engine** (`src/lib/shared-expenses.ts` pure + `shared-expenses-server.ts` DB): `computeSharedExpenseShares(total, count)` floors with deterministic remainder distribution so the per-player sum equals `totalAmount` exactly. `computeEligible(candidates, sessionsTotal, minPct, pool)` is a pure threshold + pool filter; admin candidates always pass and report 100% (they run every session, so the system doesn't capture their attendance via Attendance rows). `findEligiblePlayers({lookbackYears, minAttendancePct, eligibilityPool})` is the DB orchestrator and uses **precedence-style attendance sources** — live segment (current year ∩ window) from `Attendance` rows; historical segment from `PlayerYearAggregate` with the boundary year fraction-scaled by its overlap with the window. **Denominator = max attendance count across all players in the window** (top attendee = 100% by definition; everyone else's pct is their share relative to the top). `listAllPlayersForManualAdd()` powers the manual-add dropdown.
- **Admin flow** (`/admin/finance/shared-expenses`): index lists past expenses with active/reverted status. `/new` → `SharedExpenseForm`: title, amount, lookback years, min attendance %, eligibility radio (REGISTERED_ONLY default vs ALL_PLAYERS). "טען תצוגה מקדימה" populates eligible table + full roster; admin can remove rows or use the searchable add-player dropdown to manually include any player from the pool (flagged with a manual badge). Share recomputes locally on every change. Submit → `createSharedExpenseAction` re-runs eligibility server-side (rejects stale lists), validates manual IDs exist, writes parent + N children in one `$transaction`. Detail page shows criteria + per-charge rows + revert button. `revertSharedExpenseAction` soft-marks parent (`revertedAt = now()`) and deletes children — balances restore automatically.
- **Tests**: `shared-expenses.test.ts` (14 cases) — share split (clean / remainder / total < count / zero count / zero total), rolling cutoff (whole + fractional years), eligibility filter.

### Finance dashboard (`/admin/finance`)

- Summary cards (total paid / charged / net), debtors list, credits list, all-players table sorted by debt, recent payments, recent charges.
- All player rows fully clickable (overlay link + hover); links pass `?from=finance` so the player edit page shows "→ חזרה לפיננסים".
- **Manual debt reminder broadcast**: "שלח תזכורת" button in the debtors section header → `broadcastDebtorsAction` → `notifyDebtors` (group). Template macros `{debtors_list}` (newline-joined `{name} @{972…} — ₪{abs(balance)}` rows, biggest first), `{count}`. Button shows "נשלח לאחרונה: {date+time}" derived from the latest `BROADCAST_DEBTORS` audit log row — note the audit row is written via `await prisma.auditLog.create` (not fire-and-forget) before `revalidatePath` so the next render reflects it. `wa_notify_debtors_tag_enabled` (default on) `@`-mentions debtors via Baileys (see WA section).
- **Shared-expense entry**: link to `/admin/finance/shared-expenses`.

### Audit log (`/admin/audit`)

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

### Import pipeline (`/admin/import`)

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

### QA testing system (`/admin/testing`)

Admin-only page for end-to-end manual testing with automated DB-state verification.

- **Snapshot manager**: save / restore / delete full DB snapshots. Prisma-based serialization, gzipped, stored in `/opt/irba/backups/snapshots/{label}__{ISO_timestamp}.json.gz` (persistent volume). FK-safe restore in a single `$transaction` (children before parents on delete; parents before children on insert; resets `AuditLog` autoincrement). Path-traversal protection; `requireAdmin()` guard.
- **Interactive test plan**: 60 steps across 20 groups. Each step: `id`, `group`, `title`, `instructions[]`, optional `links[]`, `verifyFnName`. Steps unlock sequentially. "Verify" → `runVerification(stepId)` server action → `{ pass, detail, manual? }`. Steps with no automated verification return `manual=true` (blue dot). Progress in `localStorage` (`irba-test-plan-results`). On mount the plan auto-expands and scrolls the first non-passed step into view.
- **Cron verification (Group 19)** runs lib functions directly (`autoClosePastSessions()`, `autoCreateNextSession({ force: true })`) instead of HTTP-fetching `/api/cron/*` — same code path but avoids server-to-self fetch failures.
- **OTP lookup widget** on steps that require player login: generates a fresh OTP, stores bcrypt hash in DB, sends plaintext code as a WA DM to the admin phone — plaintext never hits DB or browser.
- **11 test players** (A–K, phones `0500000001`–`0500000011`): A–C manual; D–K auto-created on demand. D = DROP_IN; E–K = REGISTERED. All match steps use 5v5; sessions use maxPlayers=10.
- **Group order**: 0 Snapshot → 1 Config → 2 Players → 3 Competition setup → 4 Session 1 lifecycle → 5 Public RSVP → 6 Match recording → 7 Leaderboard → … . Competition creation precedes session 1 so session 1 + matches are scoped into the active challenge window.
- **Competition winner is B** (not A) — given prescribed match outcomes B ends 5W/1L (83%) vs A 7W/3L (70%). Group 9.3 verifies `winnerId=B`; Group 10 consumes B's FreeEntry in session 4; Group 11.1 overrides A's normal-tariff charge.

### WhatsApp admin (`/admin/wa`)

Dedicated page. Combines three widgets:

- **Bot status**: `WaBotStatus` widget — green/red dot, QR when disconnected, action button. Polls every 15 s (4 s when disconnected so a fresh QR appears quickly). Action button context-aware: **"התנתק"** when ready (POST `/logout` → wipes session); **"אפס וצור QR חדש"** when disconnected (same call, framed as manual recovery). Combined with sidecar auto-recovery on `loggedOut`, no SSH required to re-pair.
- **Manual group send**: `WaSendForm` — read-only group JID + resolved name (fetched from sidecar on mount); textarea + "שלח לקבוצה" button. If `wa_group_jid` not set, hint links to `/admin/config`.
- **Admin OTP forwarder** (`WaAdminOtpForm`): admin enters a player's phone → `sendAdminTestOtpAction` generates a fresh 6-digit OTP, stores its bcrypt hash on the player (`otpCode` + 10 min `otpExpiresAt`), and sends the plaintext code as a WA DM to the admin's own phone. Used for QA / support — admin can hand the code to the player out-of-band when the player can't receive a WA message themselves. Requires `WA_NOTIFY_ENABLED=true`. Audited as `SEND_ADMIN_TEST_OTP` with `{ targetPhone, adminPhone }`. Tested in `wa/actions.test.ts`.

## Regulations acceptance gate

- **Schema additions to `Player`**: `regulationsAcceptedAt`, `regulationsAcceptedVersion`.
- **Flow**: root layout (`src/app/layout.tsx`) is `async` — on every request it checks if the logged-in player's `regulationsAcceptedVersion` is null or behind `regulations_version` config. If so, `RegulationsOverlay` renders before children, blocking content. Zero client-side flash.
- **Overlay UX**: full-screen `fixed inset-0 z-50`. Scrollable content area; sticky header + footer. Accept button starts disabled; enables only after `IntersectionObserver` confirms the bottom sentinel has been reached (root must be the scrollable div, not viewport). `acceptRegulationsAction` records timestamp + version, writes `PLAYER_ACCEPTED_REGULATIONS` audit, calls `revalidatePath("/", "layout")`. On success the overlay calls `router.refresh()` and stays mounted (spinning) until the new layout tree arrives — this avoids a flash of the underlying page between the regulations overlay and the profile completion overlay that often follows it.
- **Versioning**: admin bumps `regulations_version` → all players see the overlay again.
- **Re-read from profile**: `/profile` → "תקנון" → "קרא את התקנון" opens a non-blocking full-screen modal (`RegulationsViewer`) with the same rendered content but no accept button or scroll gate.
- **Template engine** (`src/lib/regulations-renderer.ts`): line-by-line parser with buffer/flush. Supports `## Heading` (h3), `### Sub-heading` (h4), `**bold**`, `- bullet` (consecutive `-` lines form one `<ul>`), blank line (paragraph break), `{variable}` substitution (all config keys + special `{session_schedule_day_name}`). `RegulationsContent` reused by both viewer and admin live preview.
- **Default content**: 10 sections — ידידות, הוגנות וספורטיביות, כיף, כללי המשחק (with `{match_win_score}` נק׳ / `{match_duration_min}` דק׳ + sub-heading עבירות קבוצה using `{fouls_until_penalty}`), סמכות מנהל, לוח זמנים, כספים (`{debt_threshold}₪`), הרשמה והגעה, קנסות עדיפות (with `{fine_no_show/kick_ball/early_leave}`), אפס סובלנות לאלימות, הסכמה לוואטסאפ.

## Profile completion gate

Runs alongside (and after) the regulations gate in the async root layout. Every logged-in player must have a baseline profile filled before they can use the rest of the app. Also picks up the slack left when OTP first-login was simplified — there is no more forced password setup or `set_name` step during OTP verify; the overlay collects whatever the player still owes.

- **Required fields by player kind** (`src/lib/profile-completion.ts`):
  - `REGISTERED`: `firstNameHe`, `lastNameHe`, `birthdate`, `nationalId`, `email`
  - `DROP_IN`: `firstNameHe`, `lastNameHe`
  - Exported helpers: `REGISTERED_REQUIRED_FIELDS`, `DROP_IN_REQUIRED_FIELDS`, `requiredFieldsFor(playerKind)`, `isProfileComplete(player)`.
- **Validation** (`src/lib/player-validation.ts`): `parseProfileForm(raw, { playerKind })` only enforces the fields required for that kind — birthdate / nationalId / email errors are skipped entirely for DROP_INs.
- **Overlay** (`ProfileCompletionOverlay`): renders inside the async root layout when `isProfileComplete(player) === false`, but only after the regulations gate is cleared (regulations always renders first). For DROP_INs the REGISTERED-only inputs (birthdate, nationalId, email, English names, nickname) are hidden so the form is a 2-field stub. Save → `completeProfileDetailsAction` (in `src/app/actions/player-profile.ts`) which validates with `parseProfileForm({ playerKind })`, persists the fields, writes a `PLAYER_PROFILE_COMPLETED` audit entry, and calls `revalidatePath("/", "layout")` — invoked via a form-action submit so Next.js auto-revalidates and the overlay unmounts naturally.

## Balanced team selection

- **Algorithm** (`src/lib/team-balance.ts`): snake-draft assigns players sorted by rank desc (A B C C B A A B C…) → minimises rank-sum variance. `generateTeamOptions(players, seed)` — seed param (default 0) derives per-tier shuffle seeds; UI passes a fresh `Math.random()` seed per call so re-shuffle is genuinely different. Handles non-divisible N gracefully (e.g. 14 → 5/5/4). Pure function — no DB. Uses `computedRank ?? rank` (so peer / win-loss data flows through). 9 unit tests.
- **Admin UI** (`TeamBalancePanel` on the session detail page, between attendance and match panels):
  - "צור קבוצות" (disabled + note when < 3 confirmed)
  - 3 option cards stacked vertically; each card: Teams א׳/ב׳/ג׳ with player names + rank sum
  - Per-row: name, position badges (PG/SG/SF/PF/C, monospace pill), rank (right-aligned, admin-only)
  - "העתק" copies names-only plain-text Hebrew (no rank/positions)
  - "ערבב מחדש" generates different teams every press
- **WA group send + poll**: send option to group; emit a single-choice poll for the group to vote.

## Player-facing pages

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

## Tests

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

## Security / abuse

- **OpenClaw assistant API**: `POST /api/assistant/v1` is a narrow typed API for Mikey/OpenClaw. Auth is `Authorization: Bearer <ASSISTANT_API_SECRET>` and fails closed if the env var is missing. Requests must include `operation`, `actor_phone`, `group_jid`, `idempotency_key`, and optional `params`. Current production operations are `help`, `next_session`, `session_status`, admin `player_lookup`, admin `session_roster_add`, admin `session_roster_remove`, and self-service `player_register_add`, `player_register_cancel`, `player_register_status`. `group_jid` must be in AppConfig `assistant_allowed_groups` (empty = disabled). `actor_phone` accepts `05...`, `972...`, or `+972...` and is resolved server-side to guest/member/admin from `Player.isAdmin`. Results are stored in `AssistantRequestLog` and same-key retries replay the cached result. Domain mutations write audit logs. No inbound WhatsApp listener or natural-language execution exists in IRBA; natural parsing/replies live in OpenClaw. Planning docs: `docs/OPENCLAW_IRBA_INTEGRATION_PLAN.md`; completion tracker: `docs/plans/openclaw-irba-completion-plan.md`.
- **Cookies**: HTTP-only, `Secure` in production or when `RSVP_COOKIE_SECURE` set; player + RSVP use `sameSite=lax` (compatible with WA-link redirects); JWT verifies `iss`/`aud` (defaults `irba` / `irba-rsvp`).
- **Rate limits** (in-memory per process): attend / cancel, **admin login**, **player login** (shared across OTP-send/verify and password login), and a stricter **OTP-send** bucket (per-phone + per-IP, both must pass) applied at the WA-message-issuing step so an attacker can't spam a victim's phone or burn the WA budget; client IP from `CF-Connecting-IP`, `X-Real-IP`, or first `X-Forwarded-For` hop.
- **Response headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, full **CSP** (`default-src 'self'`, `script-src 'self' 'unsafe-inline'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:`, `frame-src` allows OpenStreetMap, `frame-ancestors 'none'`) — `next.config.ts`.
- **Mobile zoom**: `viewport` export sets `maximumScale: 1` to prevent iOS auto-zoom on input focus (pinch-zoom still works).

## Accessibility

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
