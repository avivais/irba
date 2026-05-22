# Phase 1 — OpenClaw ↔ IRBA Integration: Read-only MVP Execution Plan

> Source plan: `docs/OPENCLAW_IRBA_INTEGRATION_PLAN.md`  
> Depends on: `docs/plans/openclaw-irba-phase-0-infrastructure.md`  
> Scope: deterministic read-only assistant operations only  
> Status: planned  
> Date: 2026-05-22

## 1. Purpose and explicit non-goals

Phase 1 gives Mikey/OpenClaw enough safe IRBA data to answer common WhatsApp group questions without DB access and without natural-language handling inside IRBA.

At the end of this phase, IRBA exposes a small set of typed read-only operations through the existing authenticated `POST /api/assistant/v1` endpoint. OpenClaw still owns message understanding, ambiguity handling, and Hebrew reply formatting. IRBA only validates a typed request, checks permissions, executes deterministic queries, logs the request, and returns structured JSON.

Non-goals:

- No mutations: no add/remove RSVP, no session creation/editing, no charging, no payments.
- No inbound WhatsApp listener in IRBA.
- No changes to the existing outbound WhatsApp sidecar `wa/`.
- No natural-language parsing inside IRBA.
- No raw message text in the assistant API body.
- No broad admin API or generic DB query endpoint.
- No private financial detail in group-facing read operations unless explicitly added later with stricter permission/DM rules.
- No HMAC signing in this phase unless Avi decides to promote it before read-only rollout.

## 2. MVP operations

Implement these operations first:

```ts
type AssistantOperation =
  | "help"
  | "session_status"
  | "next_session";
```

### 2.1 `session_status`

Answers questions like:

- "מה הסטטוס?"
- "מי רשום?"
- "כמה מקומות נשארו?"
- "יש רשימת המתנה?"

Default target: the next active, non-archived, non-cancelled session with `date >= now`. Optional `session_id` can target a specific session later, but the MVP can support only `target: "next"`.

Request params:

```ts
{
  target?: "next";
  include_waitlist?: boolean; // default true
  include_registered_list?: boolean; // default true
}
```

Response data:

```ts
{
  session: {
    id: string;
    date: string; // ISO
    max_players: number;
    is_closed: boolean;
    is_cancelled: boolean;
    location_name: string | null;
  } | null;
  counts: {
    registered: number;
    confirmed: number;
    waitlisted: number;
    spots_left: number;
  };
  confirmed: Array<{
    position: number;
    player_id: string;
    display_name: string;
    player_kind: "REGISTERED" | "DROP_IN";
  }>;
  waitlist: Array<{
    position: number;
    player_id: string;
    display_name: string;
    player_kind: "REGISTERED" | "DROP_IN";
  }>;
}
```

If no upcoming active session exists, return `ok: true` with `session: null`, empty lists, and zero counts. Mikey formats a friendly "אין כרגע מפגש פתוח" reply.

### 2.2 `next_session`

Answers questions like:

- "מתי המשחק הבא?"
- "איפה משחקים?"
- "כמה מקומות יש?"

Request params:

```ts
{}
```

Response data:

```ts
{
  session: {
    id: string;
    date: string;
    max_players: number;
    is_closed: boolean;
    location_name: string | null;
    location_lat: number | null;
    location_lng: number | null;
    registered_count: number;
    confirmed_count: number;
    waitlisted_count: number;
    spots_left: number;
  } | null;
}
```

## 3. Permission model

Read-only group status is intentionally low-risk, but still goes through the existing checks:

- Bearer token required.
- `group_jid` must be allowlisted in `assistant_allowed_groups`.
- `actor_phone` is resolved server-side.
- `help`, `next_session`, and `session_status` may be run by `guest`, `member`, or `admin` in an allowlisted group.

Do not expose balances, payment state, national IDs, emails, birthdates, OTP/password fields, audit log details, or private profile completion state in Phase 1.

## 4. Expected files

New files:

```txt
src/lib/assistant/operations/session-status.ts
src/lib/assistant/operations/session-status.test.ts
src/lib/assistant/operations/next-session.ts
src/lib/assistant/operations/next-session.test.ts
```

Changed files:

```txt
src/lib/assistant/types.ts
src/lib/assistant/permissions.ts
src/lib/assistant/permissions.test.ts
src/app/api/assistant/v1/route.ts
src/app/api/assistant/v1/route.test.ts
docs/OPENCLAW_IRBA_INTEGRATION_PLAN.md
PROJECT_STATE.md
```

Optional refactor if it keeps the route clean:

```txt
src/lib/assistant/operations/index.ts
```

Do not change:

```txt
wa/
existing WhatsApp outbound notification behavior
existing public RSVP behavior
existing admin pages
```

## 5. Implementation details

### 5.1 Operation dispatch

`route.ts` currently dispatches directly to `getAssistantHelp(actor)`. Replace the single-operation branch with an explicit dispatcher, still narrow and typed.

Suggested shape:

```ts
switch (envelope.operation) {
  case "help":
    data = getAssistantHelp(actor);
    break;
  case "session_status":
    data = await getAssistantSessionStatus(envelope.params);
    break;
  case "next_session":
    data = await getAssistantNextSession();
    break;
}
```

Keep unknown/forbidden operations returning `UNKNOWN_OPERATION` as Phase 0 does, so callers cannot enumerate permission differences.

### 5.2 Shared session query helper

Prefer one internal helper used by both read operations:

```ts
getNextAssistantSession(now = new Date())
```

Criteria:

- `date >= now`
- `isArchived: false`
- `cancelledAt: null`
- order by `date asc`
- include attendance rows with player fields needed for display and sorting

Reuse existing attendance ordering rules from `src/lib/sort-attendances.ts` / `sortAttendancesByPrecedence` rather than inventing a new order. Confirmed players are the sorted first `maxPlayers`; waitlist is the remainder.

### 5.3 Display name rules

Return a safe display name only:

1. `nickname` if present
2. Hebrew first + last if present
3. `name`
4. fallback `שחקן`

Do not return phone numbers in Phase 1 operation responses.

### 5.4 Params validation

Each operation owns its params schema with Zod. Invalid operation params should return `VALIDATION_ERROR` with HTTP 400 and should be stored in `AssistantRequestLog` like other post-auth parsed requests.

For MVP, be strict:

- reject unknown `target` values
- default booleans server-side
- do not accept arbitrary filters/search strings yet

### 5.5 Help response update

Update `help` to include:

```json
["help", "session_status", "next_session"]
```

If the help payload has descriptions, add short human-readable descriptions for the two read-only operations.

## 6. Tests

Add/extend unit tests for:

### Operation tests

- No upcoming active session → returns `session: null` and empty counts/lists.
- Next session selected over later sessions.
- Archived sessions ignored.
- Cancelled sessions ignored.
- Past sessions ignored.
- Attendance is split into confirmed/waitlist by `maxPlayers` after existing precedence sort.
- `spots_left` never goes below 0.
- Response omits phone/email/national/private fields.
- Display name fallback works.

### Permission tests

- `help`, `next_session`, `session_status` are known operations.
- guest/member/admin can run read-only operations.
- unknown operation remains unknown.

### Route tests

- Valid `next_session` request returns 200 and stores idempotency result.
- Valid `session_status` request returns 200 and stores idempotency result.
- Replayed idempotency key returns cached read-only response with `idempotent_replay: true`.
- Invalid params returns 400 `VALIDATION_ERROR`.
- Missing/wrong auth still returns 401 before parsing/DB work.
- Non-allowlisted group still returns 403.

## 7. Local verification

Run the normal gates:

```bash
npm test -- src/lib/assistant src/app/api/assistant/v1/route.test.ts
npm test
npm run lint
DATABASE_URL='postgresql://build:placeholder@localhost:5432/build' npm run build
```

Expected lint state should stay at zero errors. If pre-existing warnings remain, mention them explicitly.

## 8. Manual production smoke test

After deploy and env/config verification, run `curl` checks against `https://irba.club/api/assistant/v1` using the production `ASSISTANT_API_SECRET` without printing the secret.

Smoke cases:

- `help` returns operations including `session_status` and `next_session`.
- `next_session` from allowlisted IRBA Coding group returns 200.
- `session_status` from allowlisted IRBA Coding group returns 200.
- Same idempotency key replay returns `idempotent_replay: true`.
- Non-allowlisted group returns 403.
- Invalid params returns 400.

## 9. OpenClaw-side wiring after IRBA deploy

Once production smoke passes, configure Mikey/OpenClaw to call the endpoint for these read-only intents.

Mikey responsibilities:

- Convert natural Hebrew/English group messages into typed operations.
- Generate a UUID idempotency key per user request.
- Pass the real WhatsApp sender phone as `actor_phone`.
- Pass the real group JID as `group_jid`.
- Format replies in concise Hebrew for the IRBA Coding/IRBA group.
- If IRBA returns `session: null`, say there is no upcoming active session.
- If API is unavailable, say the IRBA data lookup failed briefly; do not invent roster data.

Suggested first intent mapping:

- "מה הסטטוס", "מי רשום", "כמה רשומים", "כמה מקום" → `session_status`
- "מתי המשחק הבא", "איפה המשחק", "מה המפגש הבא" → `next_session`

## 10. Rollout plan

1. Implement Phase 1 read-only operations behind the already-disabled-by-default assistant API.
2. Run local tests/build.
3. Commit and push.
4. Deploy to production.
5. Run production smoke tests with the existing allowlisted group.
6. Only after smoke passes, wire Mikey/OpenClaw intent handling.
7. Test from IRBA Coding first before enabling/using in the main IRBA group.

## 11. Rollback plan

The feature is additive and gated by the existing allowlist/secret.

Fastest rollback options:

1. Set AppConfig `assistant_allowed_groups` to an empty string — disables all assistant API operations without deploy.
2. Remove/rotate `ASSISTANT_API_SECRET` on production — endpoint fails closed with 401.
3. Revert the Phase 1 commit and redeploy if the route code itself is problematic.

No database rollback should be required for Phase 1 because it adds no schema changes.

## 12. Acceptance criteria / definition of done

Phase 1 is complete when:

- [ ] `help` lists `session_status` and `next_session`.
- [ ] `session_status` returns structured next-session roster status using existing attendance precedence rules.
- [ ] `next_session` returns structured next-session metadata and counts.
- [ ] Read-only responses omit private/sensitive player fields.
- [ ] All new operations are authenticated, allowlisted, permission-checked, idempotent, and logged.
- [ ] Invalid params return typed `VALIDATION_ERROR`.
- [ ] Local targeted tests pass.
- [ ] Full `npm test`, `npm run lint`, and production-style build pass.
- [ ] Production smoke tests pass.
- [ ] `PROJECT_STATE.md` and `docs/OPENCLAW_IRBA_INTEGRATION_PLAN.md` are updated.
- [ ] Mikey can answer a real IRBA Coding group read-only status question from the API response.

## 13. Open questions

- Should Phase 1 expose only roster/status, or also a safe member-only personal balance summary? Recommendation: keep balances out of Phase 1 and add them later as a private-DM/member operation.
- Should `session_status` support selecting a session by date in Phase 1? Recommendation: not yet; default to next active session to keep the MVP narrow.
- Should group users see full confirmed/waitlist names in the main IRBA group? Recommendation: yes, because the roster is already group-visible operational data, but omit phones and private profile data.
