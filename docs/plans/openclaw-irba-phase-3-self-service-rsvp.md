# OpenClaw ↔ IRBA Phase 3 — Self-Service RSVP

## Status

Draft plan for Avi approval. Do not implement until approved.

## Goal

Let known IRBA players register or cancel **their own** upcoming-session RSVP from WhatsApp through Mikey/OpenClaw, without an admin doing roster mutations for them.

Examples:

- `תרשום אותי`
- `אני מגיע`
- `תבטל אותי`
- `אני לא מגיע`
- `am I registered?`

This phase should make the group flow useful for normal players while keeping admin-only roster management from Phase 2 unchanged.

## Non-goals

- No registering/cancelling other players by non-admins.
- No creating new `DROP_IN` players from WhatsApp assistant messages.
- No payments/balances.
- No date-specific/session-specific RSVP selection yet; operate on the next upcoming active session only.
- No proactive DM reminders or notification preference system.
- No change to the web RSVP/login UX.
- No broad NLP inside IRBA. Natural language parsing remains in the local OpenClaw skill; IRBA exposes typed operations.

## Current baseline

Already deployed:

- Read-only assistant operations: `help`, `session_status`, `next_session`.
- Admin-only mutation operations: `session_roster_add`, `session_roster_remove`.
- Admin-only lookup operation: `player_lookup`.
- Local OpenClaw skill: `/root/.openclaw/skills/irba-assistant/`.
- Existing web RSVP actions already encode important product behavior:
  - Registration allowed until session start unless `GameSession.isClosed` is true.
  - Confirmed players cannot cancel inside `rsvp_close_hours`; waitlisted players can cancel.
  - Group WA roster notifications are already emitted by web RSVP actions, but Phase 3 should decide whether assistant RSVP should also trigger them.

## Proposed operations

### `player_register_add`

Self-service register the actor for the next upcoming active session.

**Access**: known member or admin, self only.

**Params**: `{}`

**Behavior**:

1. Resolve `actor_phone` to `Player`.
2. If actor is guest, return `PLAYER_NOT_FOUND` or `FORBIDDEN_OPERATION` (recommend `FORBIDDEN_OPERATION` from permission layer for unknown actors).
3. Load next assistant session using the same session selection as existing assistant operations.
4. If no session: `SESSION_NOT_FOUND`.
5. If `session.isClosed` or now >= session start: `SESSION_CLOSED`.
6. Create `Attendance(playerId=actor.player.id, gameSessionId=session.id)`.
7. If duplicate: `ALREADY_REGISTERED`.
8. Re-sort roster with `sortAttendancesByPrecedence` and return actor position/status/counts.
9. Write audit log with a new action such as `ASSISTANT_SELF_REGISTER_ADD`.
10. Store assistant request log through existing route idempotency behavior.

**Return shape**:

```jsonc
{
  "session_id": "cuid",
  "session_date": "2026-05-25T18:00:00.000Z",
  "player": { "id": "cuid", "display_name": "אבי", "phone": "0507666550" },
  "status": "confirmed", // "confirmed" | "waitlisted"
  "position": 4,
  "confirmed_count": 4,
  "waitlisted_count": 0
}
```

### `player_register_cancel`

Self-service cancel the actor's own RSVP for the next upcoming active session.

**Access**: known member or admin, self only.

**Params**: `{}`

**Behavior**:

1. Resolve `actor_phone` to `Player`.
2. If actor is guest, deny.
3. Load next assistant session.
4. If no session: `SESSION_NOT_FOUND`.
5. If no attendance row: `NOT_REGISTERED`.
6. Determine whether actor is confirmed or waitlisted using `sortAttendancesByPrecedence`.
7. Enforce cancellation window:
   - If actor is confirmed and now >= `session.date - rsvp_close_hours`, return `SESSION_CLOSED` or a new clearer code (`CANCEL_WINDOW_CLOSED`). Recommendation: add `CANCEL_WINDOW_CLOSED` so Mikey can say “אי אפשר לבטל עכשיו — פנה למנהל”.
   - If actor is waitlisted, allow cancellation even inside the close window, matching web behavior.
8. Delete the attendance row.
9. Return whether the actor had been confirmed and who, if anyone, is newly promoted from waitlist.
10. Write audit log with `ASSISTANT_SELF_REGISTER_CANCEL`.

**Return shape**:

```jsonc
{
  "session_id": "cuid",
  "session_date": "2026-05-25T18:00:00.000Z",
  "player": { "id": "cuid", "display_name": "אבי", "phone": "0507666550" },
  "was_confirmed": true,
  "confirmed_count": 13,
  "waitlisted_count": 1,
  "promoted_player": { "display_name": "יקיר", "phone": "0506759667" }
}
```

### Optional: `player_register_status`

Self-service “am I registered?” check.

**Access**: known member or admin.

**Params**: `{}`

**Recommendation**: include this if it is cheap, because it avoids players needing the full roster just to ask whether they personally are in.

**Return shape**:

```jsonc
{
  "session_id": "cuid",
  "session_date": "2026-05-25T18:00:00.000Z",
  "player": { "display_name": "אבי" },
  "registered": true,
  "status": "confirmed",
  "position": 4,
  "confirmed_count": 4,
  "waitlisted_count": 0
}
```

## Permissions

Update `src/lib/assistant/permissions.ts`:

- Everyone: `help`, `session_status`, `next_session`.
- Known members + admins: `player_register_add`, `player_register_cancel`, optionally `player_register_status`.
- Admin only remains: `session_roster_add`, `session_roster_remove`, `player_lookup`.

Important: `actor_phone` remains the identity source. A non-admin must never pass `player_phone` or any target player param for self-service operations.

## OpenClaw skill changes

Update `/root/.openclaw/skills/irba-assistant/` after IRBA API deploy:

- Recognize self-service intent from known players:
  - Add/register: `תרשום אותי`, `אני מגיע`, `רשום אותי`, `מגיע`, `add me`, `register me`.
  - Cancel/remove self: `תבטל אותי`, `אני לא מגיע`, `remove me`, `cancel me`.
  - Status: `אני רשום?`, `אני בפנים?`, `am I registered?`.
- For non-admin self commands, call only self-service operations.
- For admin commands that mention other players, keep using Phase 2.1 admin flow.
- For ambiguous text from admin like `תוסיף אותי`, prefer self-service operation because target is actor.
- Reply in concise Hebrew with session date, confirmed/waitlist state, and promoted player if relevant.

## Notification decision

Need Avi decision before implementation:

Option A — no extra WA broadcast from IRBA assistant operations.

- Pros: avoids duplicate/noisy group notifications because Mikey already replies in the group.
- Cons: web/app notification templates are not reused; roster-broadcast side effects differ from web RSVP.

Option B — reuse existing `notifyPlayerRegistered` / `notifyPlayerCancelled` in assistant operations.

- Pros: behavior matches web RSVP; group roster is broadcast in the same format.
- Cons: if Mikey also replies in the group, users may see two messages per RSVP.

Recommendation: **Option A for Phase 3**. Keep assistant operation response rich enough for Mikey to answer once. Revisit broadcast fanout later with notification preferences.

## Implementation plan

1. Add operation types and error code(s):
   - `player_register_add`
   - `player_register_cancel`
   - optional `player_register_status`
   - optional `CANCEL_WINDOW_CLOSED`
2. Add permission tier for known actors.
3. Implement assistant operation handlers under `src/lib/assistant/operations/`.
4. Wire route dispatch and help listing.
5. Reuse existing helper logic where possible:
   - session selection from `getNextAssistantSession()`
   - display names from `getSafeAssistantDisplayName()`
   - sorting from `sortAttendancesByPrecedence()`
   - close window config from `getConfigInt(CONFIG.RSVP_CLOSE_HOURS)`
6. Add unit tests:
   - member can self-register.
   - guest cannot self-register.
   - duplicate self-register returns `ALREADY_REGISTERED`.
   - full roster returns `waitlisted` with correct position.
   - member can self-cancel before close window.
   - confirmed member cannot self-cancel inside close window.
   - waitlisted member can self-cancel inside close window.
   - not registered returns `NOT_REGISTERED`.
   - route permission/help/idempotency coverage.
7. Run targeted tests, full test suite, lint.
8. Commit/push.
9. Deploy via GitHub Actions using `main` or full SHA.
10. Production smoke:
    - `help` shows self-service ops for known member/admin.
    - non-player actor is denied.
    - known member dry/safe test against upcoming session.
11. Update OpenClaw skill for natural self-service commands.
12. Local skill smoke tests.
13. Live WhatsApp QA in IRBA Coding group with Avi only first.

## Safety / rollback

- These are real roster mutations. Production QA must use Avi or a controlled known player.
- Do not test by bothering real players without explicit approval.
- If behavior is bad after deploy, rollback app image to previous commit and temporarily avoid self-service skill commands.
- Since operations are additive, existing Phase 1/2/2.1 operations should continue working if the new skill paths are disabled.

## Acceptance criteria

- Known player can register themself from WhatsApp.
- Known player can cancel themself when allowed by `rsvp_close_hours` rules.
- Confirmed player cannot cancel inside close window; Mikey gives a clear “contact admin” reply.
- Waitlisted player can cancel inside close window.
- Guest/non-player cannot mutate roster.
- Non-admin cannot add/remove someone else.
- Admin Phase 2 roster commands still work.
- All tests and lint pass.
- Production health and smoke checks pass.
- Docs updated with deployed status.

## Open questions for Avi

1. Should Phase 3 include `player_register_status` (`אני רשום?`) now? Recommendation: yes.
2. Should assistant self-service RSVP trigger the existing WA roster broadcast templates, or should Mikey’s group reply be the only visible message? Recommendation: Mikey reply only for now.
3. If a player writes a cancellation inside the close window, should we return a hard block only, or optionally notify/tag admin? Recommendation: hard block only in Phase 3.
4. Should admins using `תרשום אותי` go through self-service or admin mutation? Recommendation: self-service, because it is safer and semantically exact.
