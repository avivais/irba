# IRBA Future Ideas

Ideas parked for later. These are not active commitments unless promoted into issues/tasks.

## Future suggestions

Loosely ordered by likely impact / cost ratio. Treat as a brainstorm of natural next steps now that the league management core is stable.

## A. Multiple admin roles
Today there is one boolean `isAdmin`. Splitting into roles (e.g. `OWNER` / `TREASURER` / `COACH`) would let a treasurer manage payments without granting full DB access — and is a prerequisite for handing IRBA to a successor. Schema change: `Player.role` enum + per-action capability checks in `requireAdmin()`. Existing audit log already records actor identity, so the audit trail mostly comes free.

## B. Per-player notification preferences
Some players want every roster update; others want only their own status changes. Add a per-player `notificationPrefs` JSON (or columns) and gate WA dispatchers on it. Useful especially for the roster-broadcast flow which currently fans out to the whole group — a quiet-hours / mute toggle would cut complaints without losing the always-synced roster benefit.

## C. SMS fallback for OTP
OTP is WA-only today. A new player without WhatsApp can't log in (admin-forwarded OTP via `/admin/wa` is a workaround but requires admin involvement). Adding Twilio (or 019 / Cellact) SMS as a fallback when the WA bot is offline or the user hasn't received the OTP within ~30 s would close the last "I can't log in" support case. Reuse `requestOtpAction` plumbing — only the delivery channel changes.

## D. Calendar feed (.ics export)
A signed per-player `.ics` URL (`/api/calendar/{playerToken}.ics`) that exposes upcoming sessions plus that player's RSVP status would let players subscribe in Google Calendar / Apple Calendar without needing the app. Cheap to build (no UI) and adds real ambient value.

## E. Public season summary page
End-of-season "yearbook" — final leaderboard, biggest comebacks, longest win streak, MVP of the year (highest `computedRank` swing). Generate a static page per closed year from existing `Match` + `Challenge` + `PeerRatingSession` data. Good marketing artifact for the WA group; nothing to maintain because it's a snapshot.

## F. Tournament brackets (vs round-robin Challenges)
The current `Challenge` model assumes win% over a window. Some events (a 4-team knockout night, end-of-season cup) need single- or double-elimination brackets. Add `Tournament` + `TournamentMatch(round, slot, winnerAdvancesTo)`; reuse `SessionMatchPanel` UX for score entry. Probably the next natural extension to the competition system.

## G. Streaks / achievements / badges
Cheap engagement boost: badge a player who attends 10 in a row, wins 5 straight matches, fills a waitlist gap last-minute. Compute from existing `Attendance` + `Match` data — pure derived view, no new write paths. Show as small icons next to names on the players list and `/profile`.

## H. Photo upload per match / session
A single photo per session (admin uploads), shown on the homepage banner after the session and on `/profile` history. Object store (S3 / Cloudflare R2) + signed URLs; reuse the EC2 IAM role. Adds minimal DB surface (`GameSession.photoKey String?`).

## I. Player profile cards (limited public view)
Let any logged-in player view another player's stats card (matches, win%, computed rank, position, attendance %). Today `/profile` is self-only. This is the "social" piece that makes peer-rating context-rich — when ranking teammates you'd see their stats inline. Scope: a new `/players/[id]` route reusing the analytics components from `/profile`, gated to logged-in users; admin-controlled fields hidden.

## J. Smarter team rotation suggester
Today `SessionMatchPanel` auto-fills "winner stays + sitting-out team in" but only naively (last winner). A smarter suggester would consider rest minutes per player, win-rate balance over the night, and avoid back-to-back-of-back-to-back for the strong players. Pure function — drop into the existing panel as a "הצע קבוצות" button.

## K. Multi-venue / multi-group tenancy
Today the app assumes one IRBA league at one location. If a sister group at another school wants the same tooling, multi-tenancy via a `League` parent table (with per-league `AppConfig`, players, sessions) is the conservative path. Big change — only worth doing when there's a concrete second tenant.

## L. AI match summaries
Daily WA digest after a session: "Tonight at IRBA — 4 matches, A won 3 in a row, biggest upset was C beating B 12-9 in match 3. Top streak: D, 4 of 4." Wire `Match` + `Attendance` data into Claude Haiku via the Anthropic SDK; one-shot `wa-notify` dispatch. Cheap to prototype, high "this lives in WhatsApp where the league actually lives" value.

---

*Last updated: 2026-05-11 — reflects all commits through `79a73dd` (simplified OTP first-login). IRBA is live in production at https://irba.club.*
