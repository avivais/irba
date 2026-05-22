# Phase 2 — OpenClaw ↔ IRBA Integration: Admin Roster Mutations Execution Plan

## Context

Phase 1 shipped read-only assistant operations (`help`, `session_status`, `next_session`) — fully tested and production-smoked on 2026-05-22. The assistant API lives at `POST /api/assistant/v1` and is called by OpenClaw's Mikey agent over Bearer token auth. All requests are idempotent-keyed and logged in `AssistantRequestLog`.

Phase 2 adds two admin-only mutations: **add a player to the next session's roster** and **remove a player from it**. The actor is identified server-side by phone → Player.isAdmin. All mutation logic reuses existing Prisma patterns from `src/app/admin/(protected)/sessions/[id]/actions.ts`.

---

## 1. Purpose and explicit non-goals

### In scope
- `session_roster_add`: admin adds a known player (by phone) to the next open session.
- `session_roster_remove`: admin removes a player (by phone) from the next open session.
- Enforce `admin`-level actor check before executing either operation.
- Return waitlist-position metadata so Mikey can compose a correct Hebrew reply.
- Write audit log entries for both mutations.
- Full unit + route test coverage matching Phase 1 quality.

### Not in scope (Phase 2)
- Creating a separate/manual promotion operation — Phase 2 auto-promotes as part of `session_roster_remove` when a confirmed player is removed and the waitlist is non-empty.
- Adding brand-new DROP_IN players who don't exist in the database — Phase 2 only handles known `Player` records with a matching phone. Unknown phones return `PLAYER_NOT_FOUND`.
- Self-service RSVP mutations for non-admin members (Phase 3).
- `session_roster_promote` as a standalone operation (Phase 3 candidate).
- WhatsApp push-notifications to the affected player (decided below in open questions).
- Targeting sessions other than the next upcoming one.

---

## 2. MVP operations and API contracts

Both operations use the same envelope structure already in production.

### `session_roster_add`

**Request**
```json
{
  "operation": "session_roster_add",
  "actor_phone": "0501234567",
  "group_jid": "120363409761679942@g.us",
  "idempotency_key": "uuid-v4",
  "params": {
    "player_phone": "0507654321"
  }
}
```

**Success response `200`**
```json
{
  "ok": true,
  "data": {
    "session_id": "clxyz...",
    "session_date": "2026-05-29T18:00:00.000Z",
    "player": {
      "id": "clxyz...",
      "display_name": "יוסי",
      "phone": "0507654321"
    },
    "status": "confirmed",          // or "waitlisted"
    "position": 8,                  // 1-based position in full attendance list
    "confirmed_count": 14,
    "waitlisted_count": 0
  },
  "error": null,
  "idempotent_replay": false
}
```

### `session_roster_remove`

**Request**
```json
{
  "operation": "session_roster_remove",
  "actor_phone": "0501234567",
  "group_jid": "120363409761679942@g.us",
  "idempotency_key": "uuid-v4",
  "params": {
    "player_phone": "0507654321"
  }
}
```

**Success response `200`**
```json
{
  "ok": true,
  "data": {
    "session_id": "clxyz...",
    "session_date": "2026-05-29T18:00:00.000Z",
    "player": {
      "id": "clxyz...",
      "display_name": "יוסי",
      "phone": "0507654321"
    },
    "was_confirmed": true,
    "confirmed_count": 14,
    "waitlisted_count": 1,
    "promoted_player": {
      "display_name": "דני",
      "phone": "0509999999"
    }
  },
  "error": null,
  "idempotent_replay": false
}
```

`promoted_player` is `null` when the removed player was waitlisted or when no waitlisted player exists after removing a confirmed player.

---

## 3. Permission, confirmation, idempotency, audit, and safety model

### Permissions
- `admin` actor: allowed.
- `member` or `guest` actor: return `FORBIDDEN_OPERATION` (HTTP 403).
- The existing `canRunAssistantOperation` function in `permissions.ts` must be updated from "any level for any known op" to "admin only for mutation ops". Two sets replace the current single set:

```ts
const ADMIN_ONLY_OPERATIONS = new Set(["session_roster_add", "session_roster_remove"]);
const ANY_LEVEL_OPERATIONS  = new Set(["help", "session_status", "next_session"]);
```

The route already calls `canRunAssistantOperation` before dispatching; it should return `false` for non-admin callers on mutation ops so the existing 400 path fires. We'll change that to `FORBIDDEN_OPERATION` / 403 to give Mikey a clear signal to reply "רק מנהל יכול לבצע פעולה זו".

### Confirmation
Confirmation UX is OpenClaw's responsibility. Mikey asks the admin "להוסיף את [שם]?" before calling the API. The IRBA API is the execution layer; it does not implement a two-step confirmation flow.

### Idempotency
The existing `idempotency_key` / `AssistantRequestLog` mechanism covers mutations correctly:
- First call: executes and stores result.
- Replay with same key + same operation: returns cached result with `idempotent_replay: true`.
- Replay with same key + different operation: returns `IDEMPOTENCY_CONFLICT` (422).

For mutations, this means OpenClaw can safely retry on network timeout without double-adding/removing.

### Audit
Both operations call `writeAuditLog` (from `@/lib/audit`) with:
- `actor`: the admin's player ID
- `action`: `"ASSISTANT_ROSTER_ADD"` or `"ASSISTANT_ROSTER_REMOVE"`
- `entityType`: `"Attendance"`
- `entityId`: the attendance ID created or deleted
- `before` / `after`: minimal snapshot (`{ sessionId, playerId, playerPhone }`)

### Safety
- Session lookup must distinguish "no upcoming session" from "next session is closed": find the next future, non-archived, non-cancelled session; if `isClosed` is true return `SESSION_CLOSED`, otherwise proceed. If no qualifying session exists → `SESSION_NOT_FOUND`.
- No blind-add of strangers: `player_phone` must resolve to an existing `Player` record.
- Prisma unique constraint on `(playerId, gameSessionId)` is the final guard against double-adds.
- `removePlayerAction` in the admin UI already silently absorbs `P2025` (already gone); the assistant route will surface this as `NOT_REGISTERED` instead, so Mikey can reply clearly.

---

## 4. Session and player selection

**Session**: Always the next upcoming non-archived, non-cancelled session. For the foreseeable future IRBA will have at most one open/upcoming session, so Phase 2 does not accept a `session_id` parameter. If the next session exists but `isClosed === true`, return `SESSION_CLOSED` instead of the misleading `SESSION_NOT_FOUND`.

**Player**: Resolved from `params.player_phone` using the same `normalizeAssistantPhone()` that already normalizes actor phones (`src/lib/assistant/actor.ts`). Then:
```ts
prisma.player.findUnique({ where: { phone: normalizedPhone }, select: { id, phone, nickname, firstNameHe, ... } })
```
If no row → `PLAYER_NOT_FOUND`.

**Display name**: `getSafeAssistantDisplayName(player)` from `src/lib/assistant/operations/session-status.ts` (already exported; reuse it).

---

## 5. Transaction behavior

### Add
```
1. getNextAssistantSessionForMutation()        → session (or SESSION_NOT_FOUND / SESSION_CLOSED)
2. normalizeAssistantPhone(params.player_phone)
3. prisma.player.findUnique(phone)             → player (or PLAYER_NOT_FOUND)
4. In one Prisma transaction: create attendance + write audit log
   → if P2002 unique violation → ALREADY_REGISTERED
5. Re-fetch sorted attendances to compute position + counts
6. Return data: status = confirmed if position <= maxPlayers, else waitlisted
7. Return result
```

Use a Prisma transaction so the attendance insert and `AuditLog` write are committed together. P2002 remains the correct conflict signal for duplicate adds. Position is computed post-insert by re-fetching all attendances and running `sortAttendancesByPrecedence` (same as `buildSessionStatus` in session-status.ts).

### Remove
```
1. getNextAssistantSessionForMutation()        → session (or SESSION_NOT_FOUND / SESSION_CLOSED)
2. normalizeAssistantPhone(params.player_phone)
3. prisma.player.findUnique(phone)             → player (or PLAYER_NOT_FOUND)
4. prisma.attendance.findFirst({ playerId, gameSessionId })  → or NOT_REGISTERED
5. Re-fetch sorted attendances BEFORE delete to determine was_confirmed (position <= maxPlayers)
6. In one Prisma transaction:
   a. delete the attendance row
      → if P2025 (race: already gone) → treat as NOT_REGISTERED unless this is an idempotent replay
   b. if the removed player was confirmed and the waitlist is non-empty, auto-promote the first waitlisted player by effectively moving them into the confirmed slice through canonical sorting (no extra DB field is needed; removing the confirmed attendance opens a slot)
   c. write audit log for the removal and include promoted-player metadata in `after` when applicable
7. Re-fetch sorted attendances after the transaction and return counts + promoted player metadata
```

**Waitlist promotion semantics**: Phase 2 **does auto-promote** after removing a confirmed player when the waitlist is non-empty. The promoted player is selected by the same canonical ordering used everywhere else: registered players by precedence score desc, then `createdAt` asc, then name asc; drop-ins by `createdAt` asc, then name asc. In practical terms: if candidates have the same precedence, the one who entered the waitlist earlier is promoted first. The response includes `promoted_player` so Mikey can say who moved in.

---

## 6. Error cases and Hebrew reply guidance

New error codes to add to `AssistantErrorCode` in `types.ts`:

| Code | HTTP | Scenario | Mikey Hebrew reply |
|------|------|----------|--------------------|
| `FORBIDDEN_OPERATION` | 403 | Non-admin called a mutation | "רק מנהל יכול לבצע פעולה זו." |
| `SESSION_NOT_FOUND` | 404 | No upcoming non-archived/non-cancelled session | "לא נמצא מפגש קרוב." |
| `SESSION_CLOSED` | 409 | Next session exists but roster is closed | "המפגש הקרוב סגור לשינויים." |
| `PLAYER_NOT_FOUND` | 404 | Phone not in Player table | "לא נמצא שחקן עם מספר זה." |
| `ALREADY_REGISTERED` | 409 | Add: player already in session | "השחקן כבר רשום למפגש זה." |
| `NOT_REGISTERED` | 409 | Remove: player not in session | "השחקן אינו רשום למפגש זה." |

Existing codes reused as-is: `UNAUTHORIZED`, `VALIDATION_ERROR`, `UNKNOWN_OPERATION`, `IDEMPOTENCY_CONFLICT`, `INTERNAL_ERROR`.

`statusForCode` in `route.ts` gains entries for `FORBIDDEN_OPERATION` (403), `SESSION_NOT_FOUND` (404), `SESSION_CLOSED` (409), `PLAYER_NOT_FOUND` (404), `ALREADY_REGISTERED` (409), `NOT_REGISTERED` (409).

### Success reply templates (for Mikey, not stored in IRBA):
- Add confirmed: "✅ [שם] נוסף למשחק ([position]/[maxPlayers])."
- Add waitlisted: "⏳ [שם] נוסף לרשימת ההמתנה (מקום [position])."
- Remove (was confirmed, no waitlist): "✅ [שם] הוסר מהמשחק."
- Remove (was confirmed, promoted waitlisted player): "✅ [שם] הוסר, ו־[promoted_player.display_name] קודם אוטומטית מרשימת ההמתנה."
- Remove (was waitlisted): "✅ [שם] הוסר מרשימת ההמתנה."

---

## 7. Tests

### Unit tests (new files)

**`src/lib/assistant/operations/session-roster-add.test.ts`**
- No session → SESSION_NOT_FOUND
- Next session exists but `isClosed` → SESSION_CLOSED
- Unknown phone → PLAYER_NOT_FOUND
- Happy path: player added to confirmed slot → returns `status: "confirmed"`, correct counts
- Happy path: player added beyond maxPlayers → `status: "waitlisted"`, correct position
- Duplicate add → ALREADY_REGISTERED (mock P2002)
- Correct audit log call

**`src/lib/assistant/operations/session-roster-remove.test.ts`**
- No session → SESSION_NOT_FOUND
- Next session exists but `isClosed` → SESSION_CLOSED
- Unknown phone → PLAYER_NOT_FOUND
- Player not in session → NOT_REGISTERED
- Happy path: confirmed player removed, no waitlist → `was_confirmed: true`, `promoted_player: null`
- Happy path: confirmed player removed with waitlist → first waitlisted player is promoted and `promoted_player` is populated
- Happy path: waitlisted player removed → `was_confirmed: false`
- Race/already-gone (P2025) treated as success
- Correct audit log call

### Permission tests (`permissions.test.ts` additions)
- Guest actor → `canRunAssistantOperation` returns false for both mutation ops
- Member actor → returns false
- Admin actor → returns true
- All three levels still pass for read-only ops

### Route tests (`route.test.ts` additions)
- Member calling `session_roster_add` → 403, `FORBIDDEN_OPERATION`
- Admin calling `session_roster_add`, mocked happy path → 200
- Admin calling `session_roster_remove`, mocked happy path → 200
- `session_roster_add` with missing `player_phone` → 400 `VALIDATION_ERROR`
- Idempotent replay of a mutation → 200, `idempotent_replay: true`

### Types test (`types.ts`)
New error codes are literals; no runtime test needed — TypeScript compile is the check.

### Manual QA checklist (production smoke)
1. Non-admin WhatsApp member calls `session_roster_add` → gets FORBIDDEN_OPERATION reply.
2. Admin calls `session_roster_add` with a phone not in DB → gets PLAYER_NOT_FOUND reply.
3. Admin calls `session_roster_add` with a valid player phone → player appears in `session_status` confirmed list.
4. Admin calls `session_roster_add` again with same idempotency key → `idempotent_replay: true`, no duplicate attendance.
5. Admin calls `session_roster_add` on a full session → player appears in waitlist.
6. Admin calls `session_roster_remove` → player gone from `session_status`.
7. Admin calls `session_roster_remove` on already-removed player → NOT_REGISTERED.
8. Audit log rows visible in DB for both actions.

---

## 8. Implementation steps (recommended order)

1. **Extend types** (`src/lib/assistant/types.ts`): add `"session_roster_add" | "session_roster_remove"` to `AssistantOperation`; add `FORBIDDEN_OPERATION | SESSION_NOT_FOUND | SESSION_CLOSED | PLAYER_NOT_FOUND | ALREADY_REGISTERED | NOT_REGISTERED` to `AssistantErrorCode`.

2. **Update permissions** (`src/lib/assistant/permissions.ts`): introduce `ADMIN_ONLY_OPERATIONS` set; update `isKnownAssistantOperation` and `canRunAssistantOperation` to enforce admin level; change return to a discriminated type so route.ts can distinguish "unknown" from "forbidden".

3. **Update route** (`src/app/api/assistant/v1/route.ts`): where `canRunAssistantOperation` returns false, emit `FORBIDDEN_OPERATION` / 403 for mutations vs `UNKNOWN_OPERATION` / 400 for truly unknown ops; add `FORBIDDEN_OPERATION` case to `statusForCode`.

4. **Implement `session-roster-add`** (`src/lib/assistant/operations/session-roster-add.ts`): Zod schema for `{ player_phone: z.string() }`; full add logic with audit log.

5. **Implement `session-roster-remove`** (`src/lib/assistant/operations/session-roster-remove.ts`): Zod schema; full remove logic with audit log.

6. **Wire operations into route** (`route.ts`): add two cases to `runAssistantOperation`; pass `actor` to both (needed for audit log actor ID).

7. **Update `help.ts`**: show all operations to all actors, with per-operation metadata explaining who may run each one (for example `level: "any" | "admin"`), so Mikey can explain permissions clearly.

8. **Write all tests** (steps 4-5 first, to drive implementation).

9. **Run full test suite + lint** locally.

10. **Manual QA** on production per checklist above.

---

## 9. Avi decisions / resolved questions

Resolved by Avi on 2026-05-22:

1. **Auto-promote on remove**: yes. If a confirmed player is removed and the waitlist is non-empty, promote the next waitlisted player automatically using the canonical precedence order. If multiple players tie on precedence, use waitlist entry time (`createdAt`) as the tie-breaker.

2. **Unknown player add**: defer to Phase 3. Phase 2 returns `PLAYER_NOT_FOUND` and does not create new DROP_IN players.

3. **WA notification to affected player**: no player DM/push notification in Phase 2.

4. **Session selection**: for the foreseeable future there will not be more than one open/upcoming IRBA session, so no `session_id` parameter is needed.

5. **Closed session behavior**: explicitly check `isClosed` and return `SESSION_CLOSED` rather than a misleading `SESSION_NOT_FOUND`.

6. **Audit actor field**: use `actor.player.id` for traceability.

7. **Idempotency TTL**: 7-day retention is acceptable.

8. **`help` output**: show all operations with an explanation/metadata for who can run each operation.

No unresolved questions remain before implementation. If implementation reveals an ambiguity not covered here, stop and ask Avi before changing the plan.

---

## 10. Expected files

| File | Change |
|------|--------|
| `src/lib/assistant/types.ts` | Add 2 operations + 6 error codes |
| `src/lib/assistant/permissions.ts` | Admin-only enforcement; two operation sets |
| `src/lib/assistant/operations/help.ts` | Include new ops; add `level` field per op |
| `src/app/api/assistant/v1/route.ts` | Wire new ops; `FORBIDDEN_OPERATION` branch; `statusForCode` entries |
| `src/lib/assistant/operations/session-roster-add.ts` | **New file** |
| `src/lib/assistant/operations/session-roster-remove.ts` | **New file** |
| `src/lib/assistant/operations/session-roster-add.test.ts` | **New file** |
| `src/lib/assistant/operations/session-roster-remove.test.ts` | **New file** |
| `src/lib/assistant/permissions.test.ts` | Extend for admin-only logic |
| `src/app/api/assistant/v1/route.test.ts` | New cases for mutations + FORBIDDEN_OPERATION |
| `docs/plans/openclaw-irba-phase-2-admin-mutations.md` | This execution plan |

No database schema changes required. No new AppConfig keys required.
