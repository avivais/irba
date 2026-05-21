# OpenClaw ↔ IRBA Integration Plan

> **Replaces**: `docs/WHATSAPP_COMMAND_API_PLAN.md`
> **Status**: Phase 0 IRBA-side implementation complete; OpenClaw wiring and production configuration pending
> **Date**: 2026-05-20

---

## Execution Plans

- Phase 0 infrastructure: [`docs/plans/openclaw-irba-phase-0-infrastructure.md`](plans/openclaw-irba-phase-0-infrastructure.md) — IRBA-side implementation complete

These phase execution plans are the working implementation guides. This document remains the architecture/source-of-truth overview and should be updated after each phase is completed.

---

## 1. Goal and Non-Goals

### Goal

Enable Mikey (OpenClaw's AI assistant) to respond to natural-language WhatsApp messages in the IRBA group by calling a **narrow, typed, authenticated API** on the IRBA production server. IRBA executes operations deterministically; OpenClaw handles everything conversational.

### Non-Goals

| What we are NOT doing | Rationale |
|---|---|
| Inbound WhatsApp listener on the IRBA server | Separation of concerns; Baileys already runs in OpenClaw |
| Raw natural-language execution on the IRBA server | Security; server must only receive typed, validated intent |
| IRBA sending WhatsApp replies | Mikey owns group presence and reply formatting |
| LLM access to the IRBA database | Trust boundary violation |
| Modifying the existing Baileys sidecar (`wa/`) | It is outbound-only and should remain so |
| Building a general-purpose API | Narrow surface only; every operation is explicit and purposeful |

---

## 2. Current IRBA / OpenClaw Context

### IRBA App (irba.club)

- **Stack**: Next.js 16 App Router, PostgreSQL + Prisma 7, HTTP-only JWT auth, deployed on EC2 behind Apache TLS
- **WhatsApp sidecar** (`wa/`, port 3100): Baileys + Express, **outbound only** — `POST /send`, `POST /send-group`, `POST /send-poll`. No inbound message handling.
- **Notification client** (`src/lib/wa-notify.ts`): thin wrapper around the sidecar; all calls are best-effort, no-throw
- **Existing API routes**: only `/api/cron/*` (bearer token auth via `CRON_SECRET`) and `/api/health`
- **`AuditLog` table**: append-only, used for all admin mutations today
- **`AppConfig` table**: key-value store for all admin-editable settings (40+ keys, live — no deploy needed to change)
- **Auth model**: `Player.isAdmin` boolean; phone (`05XXXXXXXX`) is the identity key; JWT session cookie
- **Phone normalization**: `05XXXXXXXX` ↔ `972XXXXXXXX@s.whatsapp.net` (logic in `wa/src/index.ts:toJid()`)

### OpenClaw / Mikey

- OpenClaw already receives all WhatsApp group messages for the IRBA group via its own Baileys connection
- Mikey is the AI assistant within OpenClaw
- Mikey handles: message reception, NLU/intent classification, entity extraction, ambiguity handling, confirmation UX, reply formatting, and sending the reply back into the group
- OpenClaw calls external HTTP APIs today — this integration adds one more tool to Mikey's toolbox

---

## 3. Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  WhatsApp Group                                                   │
│  "מיקי תוסיף את אבי למפגש ביום שישי"                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │ (raw message + metadata)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  OpenClaw — Baileys listener                                      │
│  • Receives: sender JID, group JID, text, timestamp              │
│  • Routes to Mikey if IRBA group                                 │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  OpenClaw — Mikey (NLU + orchestration layer)                    │
│  • Classifies intent → typed operation name                      │
│  • Extracts + resolves parameters (player name/phone, session)   │
│  • Handles ambiguity ("which Avi?") with follow-up questions     │
│  • Confirms destructive mutations before calling API             │
│  • Formats Hebrew reply from structured API response             │
│  • Decides: group reply or private DM                            │
└──────────────────────────────┬──────────────────────────────────┘
                               │ POST /api/assistant/v1
                               │ Authorization: Bearer <SECRET>
                               │ Body: { operation, actor_phone,
                               │         group_jid, idempotency_key,
                               │         params }
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  IRBA — POST /api/assistant/v1  (new, Next.js route handler)     │
│  1. Verify Bearer token (ASSISTANT_API_SECRET)                   │
│  2. Check group_jid in AppConfig:assistant_allowed_groups        │
│  3. Check idempotency_key (dedup window: 24h)                    │
│  4. Resolve actor_phone → Player (unknown → guest context)       │
│  5. Check operation permission for actor level                   │
│  6. Validate params (Zod)                                        │
│  7. Execute typed handler (deterministic, transactional)         │
│  8. Write AssistantRequestLog entry (audit)                      │
│  9. Return structured JSON result                                │
└──────────────────────────────┬──────────────────────────────────┘
                               │ { ok, data, error }
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Mikey formats reply → sends to group (or DM)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Responsibility Split (explicit)

| Concern | Owner |
|---|---|
| Raw message reception | OpenClaw (Baileys) |
| Natural-language understanding | Mikey |
| Ambiguity resolution / follow-up questions | Mikey |
| Mutation confirmation UX ("בטוח?") | Mikey |
| Reply formatting (Hebrew, context-aware) | Mikey |
| Reply destination (group vs. DM) | Mikey |
| Rate limiting per user/group (chat-side) | Mikey / OpenClaw |
| Authentication of API caller | IRBA |
| Group allowlist enforcement | IRBA |
| Actor resolution (phone → Player) | IRBA |
| Permission checks | IRBA |
| Business logic + DB access | IRBA |
| Idempotency | IRBA |
| Audit trail | IRBA |
| Error semantics (typed error codes) | IRBA |

---

## 4. Trust Boundaries and Security Model

### 4.1 Authentication

- **Mechanism (MVP)**: `Authorization: Bearer <ASSISTANT_API_SECRET>` HTTP header
- Secret is a random 40+ character hex string, stored as `ASSISTANT_API_SECRET` env var on the IRBA EC2 instance
- Same secret configured in OpenClaw/Mikey
- Constant-time comparison on IRBA side (prevents timing attacks)
- **Upgrade path** (post-MVP): HMAC-SHA256 request signing (`X-Signature: sha256=<hmac>` over the raw body) prevents replay attacks if the channel is ever compromised. Worth considering for phase 2.

### 4.2 Group Allowlist

- `AppConfig` key: `assistant_allowed_groups` — comma-separated WhatsApp group JIDs (e.g., `120363123456789012@g.us`)
- Requests with an unknown `group_jid` → `403 FORBIDDEN_GROUP`
- Managed via AppConfig (live change, no deploy needed)
- Empty list = feature disabled entirely

### 4.3 Actor Model

- `actor_phone` in request body is the normalized Israeli phone of the WhatsApp sender, as extracted by OpenClaw
- IRBA resolves it to a `Player` record (or `null` for guest)
- IRBA never trusts Mikey's claim about permission level — it re-derives it from the DB

### 4.4 No Raw Text Execution

- The API body contains `operation` (string enum) and `params` (typed object) only
- No `message` or `raw_text` field exists in the API contract
- The IRBA handler never sees the original Hebrew message

### 4.5 Transport

- HTTPS only (Apache TLS terminator on EC2)
- No direct port exposure
- Same security posture as the existing app

### 4.6 Sensitive Data in Responses

- `player.balance.get` returns financial data — Mikey should DM the result privately unless actor is admin querying in an appropriate context
- `player.payments.list` returns payment history — always DM
- These policies are **Mikey's responsibility** to enforce; IRBA returns data to any authorized actor and trusts Mikey to route appropriately

---

## 5. Assistant API Contract

### Endpoint

```
POST https://irba.club/api/assistant/v1
Content-Type: application/json
Authorization: Bearer <ASSISTANT_API_SECRET>
```

### Request Schema

```jsonc
{
  "operation": "session.roster.status",   // typed enum (see operations below)
  "actor_phone": "0501234567",            // sender's Israeli phone, normalized
  "group_jid": "120363123456789012@g.us", // WhatsApp group JID
  "idempotency_key": "uuid-v4-here",      // client-generated UUID v4
  "params": {
    // operation-specific fields — see each operation below
  }
}
```

### Response Schema

**Success:**
```jsonc
{
  "ok": true,
  "data": { /* operation-specific payload */ },
  "error": null
}
```

**Error:**
```jsonc
{
  "ok": false,
  "data": null,
  "error": {
    "code": "PERMISSION_DENIED",          // machine-readable code
    "message": "Actor cannot access this operation",
    "detail": null                        // optional extra context
  }
}
```

### Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid Bearer token |
| `FORBIDDEN_GROUP` | 403 | `group_jid` not in allowlist |
| `UNKNOWN_OPERATION` | 400 | `operation` value not recognized |
| `PERMISSION_DENIED` | 403 | Actor lacks permission for this operation |
| `PLAYER_NOT_FOUND` | 404 | Target player phone doesn't match any Player |
| `SESSION_NOT_FOUND` | 404 | `session_id` not found, or no open session exists |
| `SESSION_CLOSED` | 409 | Session exists but is not open for registration |
| `VALIDATION_ERROR` | 422 | `params` failed Zod schema validation |
| `IDEMPOTENT_REPLAY` | 200 | Duplicate `idempotency_key`; cached result returned |
| `INTERNAL_ERROR` | 500 | Unexpected server error (no stack trace in response) |

---

### Operations

#### `help`
> Returns the list of available operations for the actor's permission level.

**Params**: `{}`
**Returns**: `{ operations: string[] }`
**Access**: everyone (including unknown actor)

---

#### `session.roster.status`
> Returns the current roster for the next open session (or a specific session).

**Params**:
```jsonc
{
  "session_id": "cuid"   // optional; omit to use next open session
}
```
**Returns**:
```jsonc
{
  "session": {
    "id": "cuid",
    "date": "2026-05-23T08:00:00.000Z",
    "location": "מגרש ורד הגליל",
    "max_players": 14,
    "status": "open"
  },
  "registered": [
    { "rank": 1, "name_he": "אבי", "is_dropin": false }
  ],
  "waitlist": [
    { "position": 1, "name_he": "יוסי", "is_dropin": true }
  ]
}
```
**Access**: everyone

---

#### `player.balance.get`
> Returns the computed balance for the actor or a named player.

**Params**:
```jsonc
{
  "target_phone": "0509876543"  // optional; omit = self (actor_phone)
}
```
**Returns**:
```jsonc
{
  "player": { "name_he": "אבי", "phone": "0501234567" },
  "balance": -120,   // negative = debt, positive = credit (₪)
  "as_of": "2026-05-20T12:00:00.000Z"
}
```
**Access**: self always; any target if admin

---

#### `player.payments.list`
> Lists recent payments for a player.

**Params**:
```jsonc
{
  "target_phone": "0509876543",
  "limit": 5   // optional, default 5, max 20
}
```
**Returns**:
```jsonc
{
  "player": { "name_he": "אבי" },
  "payments": [
    { "date": "2026-05-10", "amount": 200, "note": "מזומן" }
  ]
}
```
**Access**: admin only (phase 1); self in phase 3

---

#### `session.roster.add`
> Adds a player to the next open session (or a specific session). Idempotent.

**Params**:
```jsonc
{
  "player_phone": "0509876543",
  "session_id": "cuid"   // optional; omit = next open session
}
```
**Returns**:
```jsonc
{
  "player": { "name_he": "אבי" },
  "session_date": "2026-05-23T08:00:00.000Z",
  "was_already_registered": false,   // true = idempotent no-op
  "slot": "registered"               // "registered" | "waitlist"
}
```
**Access**: admin only
**Side effects**: writes `Attendance` row (if not already present), writes `AssistantRequestLog`

---

#### `session.roster.remove`
> Removes a player from the next open session. Idempotent.

**Params**:
```jsonc
{
  "player_phone": "0509876543",
  "session_id": "cuid"   // optional; omit = next open session
}
```
**Returns**:
```jsonc
{
  "player": { "name_he": "אבי" },
  "session_date": "2026-05-23T08:00:00.000Z",
  "was_not_registered": false   // true = idempotent no-op
}
```
**Access**: admin only
**Side effects**: deletes `Attendance` row (if present), may promote waitlisted player, writes `AssistantRequestLog`

---

### Phase 3+ Operations (not in MVP)

| Operation | Description | Access |
|---|---|---|
| `player.register.add` | Self-service RSVP | known player (self) |
| `player.register.cancel` | Self-service cancel | known player (self) |
| `session.info` | Next session time/location | everyone |
| `payment.add` | Record a cash payment | admin only |

---

## 6. Permission / Actor Model

| Actor Type | Detection | Allowed Operations (MVP) |
|---|---|---|
| **Guest** | `actor_phone` not in Player table | `help`, `session.roster.status` |
| **Known player** | Player record, `isAdmin=false` | + `player.balance.get` (self only) |
| **Admin** | Player record, `isAdmin=true` | all operations |

**Phone normalization**: Mikey sends `05XXXXXXXX`; IRBA applies the same normalization as the rest of the app (strip leading zero, etc.) before the DB lookup.

**No permission config file**: permissions are hardcoded in `src/lib/assistant/permissions.ts` as a constant map. The permission model is intentionally simple; if granularity is needed later, it can be extended.

---

## 7. Auditing / Idempotency / Error Handling

### Idempotency

- Every request includes a client-generated `idempotency_key` (UUID v4)
- IRBA stores all keys in `AssistantRequestLog` with a 24-hour TTL
- On duplicate key: return the stored result immediately, skip re-execution
- On same operation, same key → cached result (200 with `idempotent_replay: true` in data)
- On different operation, same key → reject as `VALIDATION_ERROR` (key collision is a client bug)
- This makes Mikey safe to retry on network timeout with the same key

### Audit Trail

Every request (read and write) is logged to `AssistantRequestLog`:

```prisma
model AssistantRequestLog {
  id              String   @id @default(cuid())
  idempotencyKey  String   @unique
  operation       String
  actorPhone      String
  groupJid        String
  resultCode      String   // "ok" | error code
  resultSnapshot  Json?    // sanitized response data (no PII beyond what's in Player)
  createdAt       DateTime @default(now())

  @@index([idempotencyKey])
  @@index([createdAt])
}
```

All mutating operations additionally write to the existing `AuditLog` table (consistent with how admin mutations work today), with `action: "ASSISTANT_ROSTER_ADD"` etc.

### Error Handling

- All unhandled exceptions caught at route level → `INTERNAL_ERROR` response (no stack traces in production)
- Mutating handlers wrapped in Prisma transactions (both DB write + log write in same transaction)
- Network errors on Mikey side: safe to retry with same `idempotency_key`
- IRBA does not retry internally; it responds synchronously

### Log Pruning

Extend the existing `prune-audit` cron to also delete `AssistantRequestLog` rows older than 7 days (configurable via `AppConfig:assistant_log_retention_days`).

---

## 8. MVP Scope and Phased Rollout

### Phase 0 — Infrastructure (est. 1–2 days)

Deliverables: API endpoint exists, auth works, group check works, actor resolution works, audit log table in DB.

- [x] Add `ASSISTANT_API_SECRET` to `.env.example`
- [ ] Add `ASSISTANT_API_SECRET` to production EC2 `.env` and OpenClaw config
- [x] Add `assistant_allowed_groups` seed row to `AppConfig`
- [x] Add `assistant_log_retention_days` seed row to `AppConfig` (default: 7)
- [x] Write Prisma migration: `AssistantRequestLog` model
- [x] Create `src/app/api/assistant/v1/route.ts` — request routing skeleton
- [x] `src/lib/assistant/auth.ts` — bearer token verification (constant-time)
- [x] `src/lib/assistant/actor.ts` — phone → Player + permission level
- [x] `src/lib/assistant/idempotency.ts` — check/store idempotency key
- [x] `src/lib/assistant/schema.ts` — outer Zod envelope validation
- [ ] Production smoke test: `curl -X POST ... -H "Authorization: Bearer ..." '{"operation":"help",...}'`

### Phase 1 — Read-only MVP (est. 2–3 days)

Deliverables: Mikey can answer "what's the roster?" and "what's my balance?" from the group.

- [x] `src/lib/assistant/operations/help.ts` (completed in Phase 0)
- [ ] `src/lib/assistant/operations/session-roster-status.ts` (reuses session + attendance DB queries)
- [ ] `src/lib/assistant/operations/player-balance-get.ts` (reuses `src/lib/balance.ts:computePlayerBalance()`)
- [ ] Wire up OpenClaw: Mikey calls IRBA API with correct params, formats Hebrew reply
- [ ] Manual QA in staging group (see §9)

### Phase 2 — Admin Mutations (est. 2–3 days)

Deliverables: Admin can add/remove players from a session via WhatsApp message.

- [ ] `src/lib/assistant/operations/session-roster-add.ts` (Prisma transaction + promote waitlist + AuditLog)
- [ ] `src/lib/assistant/operations/session-roster-remove.ts`
- [ ] Mikey: confirmation UX before calling mutating operations
- [ ] Manual QA with real admin in group

### Phase 3 — Self-service RSVP (future, requires product decision)

- `player.register.add` / `player.register.cancel` for non-admin players
- Respect `rsvp_close_hours` window (return `SESSION_CLOSED` if past deadline)
- IRBA-side rate limiting per actor (leverage existing rate-limit utilities)

### Phase 4 — Extended Operations (future)

- `payment.add` (admin only, with confirmation)
- `session.info` (next session time/location for any member)
- `player.register.list` ("am I registered?")
- `player.payments.list` self-service

---

## 9. Test Plan and Manual QA

### Unit Tests (Vitest, no Postgres)

**Auth middleware** (`src/lib/assistant/auth.ts`):
- Valid Bearer token → passes
- Wrong token → throws `UNAUTHORIZED`
- Missing header → throws `UNAUTHORIZED`

**Group allowlist** (`route.ts`):
- JID in allowlist → passes
- JID not in allowlist → throws `FORBIDDEN_GROUP`
- Empty allowlist config → all JIDs rejected

**Actor resolution** (`src/lib/assistant/actor.ts`):
- Known admin phone → `{ player, level: 'admin' }`
- Known non-admin phone → `{ player, level: 'member' }`
- Unknown phone → `{ player: null, level: 'guest' }`

**Permission map** (`src/lib/assistant/permissions.ts`):
- `help` allowed for guest, member, admin
- `player.balance.get` denied for guest; allowed for member (self) and admin
- `session.roster.add` denied for guest and member; allowed for admin

**Idempotency** (`src/lib/assistant/idempotency.ts`):
- New key → `null` (execute fresh)
- Duplicate key + same operation → cached result
- Expired key (>24h) → `null` (treat as fresh)

**Roster status handler**:
- No open session → `SESSION_NOT_FOUND`
- Session with waitlist → waitlist populated correctly

**Balance handler**:
- Non-admin querying other player → `PERMISSION_DENIED`
- Admin querying any player → returns balance

### Integration Tests (with Postgres, extend existing Vitest setup if possible)

- `session.roster.add` happy path: Attendance row created, AuditLog entry written, AssistantRequestLog entry written
- `session.roster.add` idempotent: second call with same key returns cached result, no duplicate Attendance row
- `session.roster.add` to closed session: `SESSION_CLOSED` error
- `session.roster.remove` happy path: Attendance row deleted
- `session.roster.remove` idempotent: player not present → `was_not_registered: true`

### Manual QA Checklist

**Phase 0 (infrastructure):**
- [ ] `curl -X POST /api/assistant/v1` with correct token + valid body → 200 `help` response
- [ ] Same curl with wrong token → 401
- [ ] Same curl with non-allowlisted group JID → 403
- [ ] Same curl twice with same `idempotency_key` → second returns 200 with `idempotent_replay: true`

**Phase 1 (read-only):**
- [ ] Mikey: ask "מה הסטטוס?" in group → Mikey replies with roster
- [ ] Mikey: ask "מה היתרה שלי?" → Mikey replies (group or DM based on operation type)
- [ ] Unknown sender asks balance of another player → `PERMISSION_DENIED` → Mikey replies gracefully

**Phase 2 (mutations):**
- [ ] Admin types "תוסיף את [name] למפגש" → Mikey confirms → Admin confirms → Attendance row in DB
- [ ] Admin adds player who is already registered → no duplicate row, Mikey says "already registered"
- [ ] Admin removes player → Attendance row deleted, next waitlisted player promoted
- [ ] Non-admin attempts `session.roster.add` → `PERMISSION_DENIED` → Mikey declines gracefully

---

## 10. Open Questions for Avi

1. **Auth mechanism depth**: Start with simple Bearer token, or implement HMAC-SHA256 request signing from day 1? HMAC prevents replay if the secret leaks, but adds ~20 lines of code on both sides.

2. **Reply destination for sensitive data**: When a member asks "מה היתרה שלי?" in the group, should Mikey reply in the group (everyone sees) or send a private DM? My instinct: DM for balance/payments, group for roster status.

3. **Self-service RSVP (phase 3)**: Is this in scope at all, or should the IRBA WhatsApp remain admin-only commands only?

4. **Confirmation flow in Mikey**: For `session.roster.add/remove`, should Mikey always ask "בטוח שאתה רוצה?" before calling IRBA, or trust the admin's message as confirmed intent? (I lean toward confirming once, then proceeding.)

5. **Rate limiting**: Should IRBA enforce per-actor rate limits on the API (e.g., max 20 requests/minute per phone), or leave all throttling to Mikey?

6. **Secret rotation procedure**: If `ASSISTANT_API_SECRET` is compromised, how do we rotate it? Suggest: EC2 env var change + `docker compose up -d app` → zero downtime. Should we document this in the runbook?

7. **Allowlist management**: Managed via `AppConfig` (preferred — live change) or env var? AppConfig means admin can add groups from the UI without an EC2 SSH.

8. **Phase 3 timing**: Any target date for self-service RSVP, or is phase 2 the end state for the next quarter?

9. **OpenClaw readiness**: Is Mikey's tool-calling scaffolding (calling external HTTPS APIs with a bearer token) already in place, or does that need to be built first on the OpenClaw side?

10. **`player.payments.list` access level**: Currently planned as admin-only. Should a player be able to request their own payment history from the group in phase 1, or hold for phase 3?

---

## 11. Concrete Implementation Checklist

### Prisma Migration

- [ ] Add `AssistantRequestLog` model to `prisma/schema.prisma`:
  - `id`, `idempotencyKey` (unique), `operation`, `actorPhone`, `groupJid`, `resultCode`, `resultSnapshot` (Json?), `createdAt`
  - Index on `idempotencyKey`, index on `createdAt`
- [ ] Run `npx prisma migrate dev --name add_assistant_request_log`
- [ ] Add seed/migration for new `AppConfig` keys: `assistant_allowed_groups`, `assistant_log_retention_days`

### Environment

- [ ] Add `ASSISTANT_API_SECRET` to `.env.example` with placeholder and comment
- [ ] Set `ASSISTANT_API_SECRET` on EC2 in `/opt/irba/.env`
- [ ] Add same secret to OpenClaw/Mikey configuration

### New Source Files

```
src/
  app/
    api/
      assistant/
        v1/
          route.ts              ← POST handler, orchestrates all steps
  lib/
    assistant/
      auth.ts                   ← bearer token verify (constant-time)
      actor.ts                  ← phone → Player + PermissionLevel
      permissions.ts            ← operation → required PermissionLevel map
      schema.ts                 ← Zod envelope schema + per-operation params schemas
      idempotency.ts            ← check/store AssistantRequestLog
      audit.ts                  ← write to AuditLog for mutating ops
      operations/
        help.ts
        session-roster-status.ts
        player-balance-get.ts
        player-payments-list.ts
        session-roster-add.ts   ← phase 2
        session-roster-remove.ts ← phase 2
```

### Existing Files to Reuse (do not duplicate logic)

| Utility | Location | Used by |
|---|---|---|
| `computePlayerBalance()` | `src/lib/balance.ts` | `player-balance-get.ts` |
| Attendance add/promote logic | `src/app/admin/sessions/[id]/actions.ts` or similar | `session-roster-add.ts` |
| Attendance remove logic | same | `session-roster-remove.ts` |
| AuditLog write | used throughout admin actions | `audit.ts` |
| Phone normalization | `src/lib/phone.ts` (or inline in wa-notify) | `actor.ts` |
| `AppConfig` reader | `src/lib/config.ts` | `route.ts` for allowlist |

### Cron Extension

- [ ] Extend `src/app/api/cron/prune-audit/route.ts` to also prune `AssistantRequestLog` rows older than `assistant_log_retention_days` days

### Docs

- [x] Delete the superseded `docs/WHATSAPP_COMMAND_API_PLAN.md` document
- [ ] Update `PROJECT_STATE.md` assistant API section once phase 0 ships

---

*End of plan.*
