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
- Auto-promoting the first waitlisted player after a removal — that stays a separate admin decision. The response will surface the first waitlisted player's name so Mikey can prompt the admin.
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
    "confirmed_count": 13,
    "waitlisted_count": 2,
    "waitlist_first": {
      "display_name": "דני",
      "phone": "0509999999"
    }
  },
  "error": null,
  "idempotent_replay": false
}
```

`waitlist_first` is `null` when `waitlisted_count === 0` after removal.

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
- Sessions in the past, archived, or cancelled are excluded by `getNextAssistantSession()` (already filters `isClosed: false, isArchived: false, cancelledAt: null`). If no qualifying session exists → `SESSION_NOT_FOUND`.
- No blind-add of strangers: `player_phone` must resolve to an existing `Player` record.
- Prisma unique constraint on `(playerId, gameSessionId)` is the final guard against double-adds.
- `removePlayerAction` in the admin UI already silently absorbs `P2025` (already gone); the assistant route will surface this as `NOT_REGISTERED` instead, so Mikey can reply clearly.

---

## 4. Session and player selection

**Session**: Always the next open session, selected by `getNextAssistantSession(now)` from `src/lib/assistant/operations/session-status.ts`. No session-ID param is accepted; if the admin needs to target a different session (edge case), that's a Phase 3+ concern.

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
1. getNextAssistantSession()                   → session (or SESSION_NOT_FOUND)
2. normalizeAssistantPhone(params.player_phone)
3. prisma.player.findUnique(phone)             → player (or PLAYER_NOT_FOUND)
4. prisma.attendance.create({ playerId, gameSessionId })
   → if P2002 unique violation → ALREADY_REGISTERED
5. Re-fetch sorted attendances to compute position + counts
6. Return data: status = confirmed if position <= maxPlayers, else waitlisted
7. writeAuditLog(ASSISTANT_ROSTER_ADD)
```

No explicit transaction needed — the create is a single atomic insert; P2002 is the correct conflict signal. Position is computed post-insert by re-fetching all attendances and running `sortAttendancesByPrecedence` (same as `buildSessionStatus` in session-status.ts).

### Remove
```
1. getNextAssistantSession()                   → session (or SESSION_NOT_FOUND)
2. normalizeAssistantPhone(params.player_phone)
3. prisma.player.findUnique(phone)             → player (or PLAYER_NOT_FOUND)
4. prisma.attendance.findFirst({ playerId, gameSessionId })  → or NOT_REGISTERED
5. Re-fetch sorted attendances BEFORE delete to determine was_confirmed (position <= maxPlayers)
6. prisma.attendance.delete({ id: attendance.id })
   → if P2025 (race: already gone) → silently succeed (treat as idempotent success)
7. Compute post-delete counts + first waitlisted player
8. writeAuditLog(ASSISTANT_ROSTER_REMOVE)
```

**Waitlist promotion semantics**: Phase 2 does **not** auto-promote. After remove, `waitlist_first` in the response gives Mikey the name of the next-in-line. Mikey surfaces this to the admin ("יש 2 בהמתנה, הראשון הוא דני — להקדים?"). The admin would then issue a separate command (Phase 3) or use the admin dashboard.

---

## 6. Error cases and Hebrew reply guidance

New error codes to add to `AssistantErrorCode` in `types.ts`:

| Code | HTTP | Scenario | Mikey Hebrew reply |
|------|------|----------|--------------------|
| `FORBIDDEN_OPERATION` | 403 | Non-admin called a mutation | "רק מנהל יכול לבצע פעולה זו." |
| `SESSION_NOT_FOUND` | 404 | No next open session | "לא נמצא מפגש פתוח קרוב." |
| `PLAYER_NOT_FOUND` | 404 | Phone not in Player table | "לא נמצא שחקן עם מספר זה." |
| `ALREADY_REGISTERED` | 409 | Add: player already in session | "השחקן כבר רשום למפגש זה." |
| `NOT_REGISTERED` | 409 | Remove: player not in session | "השחקן אינו רשום למפגש זה." |

Existing codes reused as-is: `UNAUTHORIZED`, `VALIDATION_ERROR`, `UNKNOWN_OPERATION`, `IDEMPOTENCY_CONFLICT`, `INTERNAL_ERROR`.

`statusForCode` in `route.ts` gains entries for `FORBIDDEN_OPERATION` (403), `SESSION_NOT_FOUND` (404), `PLAYER_NOT_FOUND` (404), `ALREADY_REGISTERED` (409), `NOT_REGISTERED` (409).

### Success reply templates (for Mikey, not stored in IRBA):
- Add confirmed: "✅ [שם] נוסף למשחק ([position]/[maxPlayers])."
- Add waitlisted: "⏳ [שם] נוסף לרשימת ההמתנה (מקום [position])."
- Remove (was confirmed, no waitlist): "✅ [שם] הוסר מהמשחק."
- Remove (was confirmed, waitlist exists): "✅ [שם] הוסר. יש [N] בהמתנה — הבא הוא [waitlist_first.display_name]."
- Remove (was waitlisted): "✅ [שם] הוסר מרשימת ההמתנה."

---

## 7. Tests

### Unit tests (new files)

**`src/lib/assistant/operations/session-roster-add.test.ts`**
- No session → SESSION_NOT_FOUND
- Unknown phone → PLAYER_NOT_FOUND
- Happy path: player added to confirmed slot → returns `status: "confirmed"`, correct counts
- Happy path: player added beyond maxPlayers → `status: "waitlisted"`, correct position
- Duplicate add → ALREADY_REGISTERED (mock P2002)
- Correct audit log call

**`src/lib/assistant/operations/session-roster-remove.test.ts`**
- No session → SESSION_NOT_FOUND
- Unknown phone → PLAYER_NOT_FOUND
- Player not in session → NOT_REGISTERED
- Happy path: confirmed player removed, no waitlist → `was_confirmed: true`, `waitlist_first: null`
- Happy path: confirmed player removed with waitlist → `waitlist_first` populated
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

1. **Extend types** (`src/lib/assistant/types.ts`): add `"session_roster_add" | "session_roster_remove"` to `AssistantOperation`; add `FORBIDDEN_OPERATION | SESSION_NOT_FOUND | PLAYER_NOT_FOUND | ALREADY_REGISTERED | NOT_REGISTERED` to `AssistantErrorCode`.

2. **Update permissions** (`src/lib/assistant/permissions.ts`): introduce `ADMIN_ONLY_OPERATIONS` set; update `isKnownAssistantOperation` and `canRunAssistantOperation` to enforce admin level; change return to a discriminated type so route.ts can distinguish "unknown" from "forbidden".

3. **Update route** (`src/app/api/assistant/v1/route.ts`): where `canRunAssistantOperation` returns false, emit `FORBIDDEN_OPERATION` / 403 for mutations vs `UNKNOWN_OPERATION` / 400 for truly unknown ops; add `FORBIDDEN_OPERATION` case to `statusForCode`.

4. **Implement `session-roster-add`** (`src/lib/assistant/operations/session-roster-add.ts`): Zod schema for `{ player_phone: z.string() }`; full add logic with audit log.

5. **Implement `session-roster-remove`** (`src/lib/assistant/operations/session-roster-remove.ts`): Zod schema; full remove logic with audit log.

6. **Wire operations into route** (`route.ts`): add two cases to `runAssistantOperation`; pass `actor` to both (needed for audit log actor ID).

7. **Update `help.ts`**: add both new operations to the returned list. Consider returning `admin_only: true` per-operation for Mikey to gate confirmation prompts.

8. **Write all tests** (steps 4-5 first, to drive implementation).

9. **Run full test suite + lint** locally.

10. **Manual QA** on production per checklist above.

---

## 9. Risks and open questions for Avi

1. **Auto-promote on remove?** The current plan does not auto-promote. Should Mikey be able to say "הסר את X וקדם את הבא" in one command? If yes, Phase 2 should include `session_roster_promote` or a `promote_first_waitlisted: true` flag on remove.

2. **Unknown player add?** A player may have a WhatsApp number not in the DB (new drop-in). Should the admin be able to add them by phone only (creating a DROP_IN record on the fly)? This mirrors `quickAddDropInAction`. If yes, Phase 2 complexity rises; suggested: defer to Phase 3.

3. **WA notification to affected player?** After an admin-add/remove via assistant, should the affected player receive a DM? The admin dashboard doesn't auto-notify on add, only on waitlist-promote. Recommend: no notification in Phase 2, same as dashboard behavior.

4. **Session selection edge case**: What if there are two future open sessions? `getNextAssistantSession` picks the earliest; the admin might mean a different one. Acceptable for now given one-session cadence?

5. **`isClosed` session behavior**: `getNextAssistantSession` filters `isClosed: false`. If admin closes the session (locking the roster), add/remove will return SESSION_NOT_FOUND, not a "session is locked" error. Is that clear enough, or should `isClosed` be checked explicitly with a dedicated `SESSION_CLOSED` error code?

6. **Audit actor field**: Current `writeAuditLog` actor for admin-session actions is the string `"admin"` (single-operator MVP). For the assistant, the actor is a Player with an ID. Should audit entries use `actor: player.id` or the string `"assistant:admin"`? Recommend `actor: actor.player.id` for traceability.

7. **Idempotency TTL for mutations**: The current TTL is `assistant_log_retention_days` (default 7). A replay of a 6-day-old "add" idempotency key would return success even though the session is long past. Is this fine? (It's harmless but slightly misleading.) Recommend keeping current behavior for now.

8. **`help` operation output for non-admins**: Once mutations are admin-only, should `help` return the full list (including admin-only ops) to all levels, or filter by actor level? Recommend: show all ops to all levels, mark admin-only ops with `"level": "admin"` in the response so OpenClaw can give a useful explanation.

---

## 10. Expected files

| File | Change |
|------|--------|
| `src/lib/assistant/types.ts` | Add 2 operations + 5 error codes |
| `src/lib/assistant/permissions.ts` | Admin-only enforcement; two operation sets |
| `src/lib/assistant/operations/help.ts` | Include new ops; add `level` field per op |
| `src/app/api/assistant/v1/route.ts` | Wire new ops; `FORBIDDEN_OPERATION` branch; `statusForCode` entries |
| `src/lib/assistant/operations/session-roster-add.ts` | **New file** |
| `src/lib/assistant/operations/session-roster-remove.ts` | **New file** |
| `src/lib/assistant/operations/session-roster-add.test.ts` | **New file** |
| `src/lib/assistant/operations/session-roster-remove.test.ts` | **New file** |
| `src/lib/assistant/__tests__/permissions.test.ts` | Extend for admin-only logic |
| `src/lib/assistant/__tests__/route.test.ts` | New cases for mutations + FORBIDDEN_OPERATION |
| `docs/plans/openclaw-irba-phase-2-admin-mutations.md` | This execution plan |

No database schema changes required. No new AppConfig keys required.
