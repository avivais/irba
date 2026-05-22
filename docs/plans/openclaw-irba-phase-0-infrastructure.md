# Phase 0 — OpenClaw ↔ IRBA Integration: Infrastructure Execution Plan

> Source plan: `docs/OPENCLAW_IRBA_INTEGRATION_PLAN.md`
> Scope: infrastructure only — no real IRBA business operations yet
> Status: complete and production-smoked on 2026-05-22

## 1. Purpose and explicit non-goals

Phase 0 created the safe foundation that OpenClaw/Mikey will use to call IRBA. IRBA now has an authenticated assistant API endpoint, a request envelope, group allowlist enforcement, actor resolution, idempotency storage, request logging, and a minimal `help` operation.

Completion notes:

- Implemented in `eb048a3 feat(assistant): add OpenClaw integration infrastructure`.
- Production configuration and manual smoke tests were verified on 2026-05-22.
- Local verification on 2026-05-22: `npm test` (337 tests), `npm run lint` (0 errors, 9 pre-existing warnings), and `DATABASE_URL='postgresql://build:placeholder@localhost:5432/build' npm run build` all passed.

Non-goals:

- No inbound WhatsApp listener in IRBA.
- No changes to the existing WhatsApp sidecar `wa/`.
- No natural-language parsing inside IRBA.
- No production roster/balance/payment operations yet, except a `help` skeleton.
- No OpenClaw-side implementation yet.
- No admin UI for assistant logs yet.
- No HMAC signing in MVP unless Avi decides to require it before implementation.

## 2. Deliverables

Phase 0 is complete when:

- `POST /api/assistant/v1` exists.
- The endpoint fails closed when `ASSISTANT_API_SECRET` is missing.
- Missing/wrong bearer token returns `401 UNAUTHORIZED`.
- A valid token but non-allowlisted `group_jid` returns `403 FORBIDDEN_GROUP`.
- A valid `help` operation from an allowlisted group returns `200` with a structured response.
- `AssistantRequestLog` exists in Prisma/Postgres.
- Requests that pass auth and envelope parsing are logged with an idempotency key and result code.
- Repeating the same idempotency key returns the cached result instead of executing again.
- `assistant_allowed_groups` and `assistant_log_retention_days` config keys exist.
- Existing prune-audit cron also prunes old assistant request logs.
- Unit tests cover auth, schema, allowlist, actor resolution, permissions, idempotency, and the route skeleton.

## 3. Expected files

New files:

```txt
src/app/api/assistant/v1/route.ts
src/lib/assistant/auth.ts
src/lib/assistant/actor.ts
src/lib/assistant/errors.ts
src/lib/assistant/idempotency.ts
src/lib/assistant/operations/help.ts
src/lib/assistant/permissions.ts
src/lib/assistant/schema.ts
src/lib/assistant/types.ts
src/lib/assistant/*.test.ts
prisma/migrations/<timestamp>_add_assistant_request_log/migration.sql
```

Changed files:

```txt
.env.example
prisma/schema.prisma
src/lib/config-keys.ts
src/app/api/cron/prune-audit/route.ts
PROJECT_STATE.md
```

Do not change:

```txt
wa/
existing WhatsApp outbound notification behavior
existing admin pages, except config keys if they render automatically
```

## 4. Data model / Prisma migration

Add a new model to `prisma/schema.prisma`:

```prisma
model AssistantRequestLog {
  id              String   @id @default(cuid())
  idempotencyKey  String   @unique
  operation       String
  actorPhone      String
  groupJid        String
  resultCode      String
  resultSnapshot  Json?
  createdAt       DateTime @default(now())

  @@index([createdAt])
}
```

Notes:

- `operation` stays `String`, not an enum, so future operations do not require DB migrations.
- `idempotencyKey` is globally unique to prevent double execution.
- `resultSnapshot` stores sanitized response data only. Store `null` for errors unless useful debugging metadata is explicitly safe.
- Keep retention short; default 7 days.

Migration should also seed, using `ON CONFLICT DO NOTHING`:

```sql
INSERT INTO "AppConfig" ("key", "value", "updatedAt")
VALUES
  ('assistant_allowed_groups', '', NOW()),
  ('assistant_log_retention_days', '7', NOW())
ON CONFLICT ("key") DO NOTHING;
```

## 5. Config/env plan

Environment variable:

```env
# OpenClaw ↔ IRBA assistant API secret.
# Generate with: openssl rand -hex 32
ASSISTANT_API_SECRET=
```

Runtime behavior:

- If `ASSISTANT_API_SECRET` is unset or empty, `/api/assistant/v1` rejects all requests with `401`.
- Secret is stored on IRBA production host and separately in OpenClaw/Mikey config.
- Do not log the secret or incoming bearer token.

Config keys in `src/lib/config-keys.ts`:

```ts
ASSISTANT_ALLOWED_GROUPS: "assistant_allowed_groups"
ASSISTANT_LOG_RETENTION_DAYS: "assistant_log_retention_days"
```

Defaults:

```ts
assistant_allowed_groups: ""
assistant_log_retention_days: "7"
```

Allowlist format:

```txt
120363409761679942@g.us,972507666550-1441540291@g.us
```

Empty allowlist means disabled: every authenticated request returns `403 FORBIDDEN_GROUP`.

## 6. API endpoint skeleton

Endpoint:

```http
POST /api/assistant/v1
Content-Type: application/json
Authorization: Bearer <ASSISTANT_API_SECRET>
```

Request envelope:

```json
{
  "operation": "help",
  "actor_phone": "0507666550",
  "group_jid": "120363409761679942@g.us",
  "idempotency_key": "00000000-0000-4000-8000-000000000000",
  "params": {}
}
```

Success response:

```json
{
  "ok": true,
  "data": {
    "operations": ["help"]
  },
  "error": null,
  "idempotent_replay": false
}
```

Error response:

```json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "FORBIDDEN_GROUP",
    "message": "Group is not allowlisted",
    "detail": null
  },
  "idempotent_replay": false
}
```

Phase 0 operation support:

- `help` only.
- Unknown operations return `400 UNKNOWN_OPERATION`.
- The route structure should make Phase 1 operations easy to add without rewriting the pipeline.

Recommended route pipeline:

1. Verify bearer token.
2. Parse JSON.
3. Validate envelope with Zod.
4. Enforce group allowlist.
5. Check idempotency key.
6. Resolve actor from `actor_phone`.
7. Check operation permission.
8. Dispatch operation.
9. Store request log.
10. Return structured JSON.

## 7. Auth and group allowlist

Auth module: `src/lib/assistant/auth.ts`

- Read `process.env.ASSISTANT_API_SECRET`.
- Require `Authorization: Bearer <token>`.
- Compare with `crypto.timingSafeEqual`.
- Fail closed if the secret is missing.
- Return typed errors; never throw raw auth details.

Group allowlist:

- Read via `getConfigValue(CONFIG.ASSISTANT_ALLOWED_GROUPS)`.
- Split by comma, trim whitespace, drop empty values.
- Require exact match against `group_jid`.
- Empty list means no groups allowed.
- Prefer reading per request so config changes apply without deploy.

## 8. Actor resolution

Actor module: `src/lib/assistant/actor.ts`

Input:

```ts
actor_phone: string
```

Output:

```ts
type AssistantActor =
  | { level: "guest"; player: null; normalizedPhone: string | null }
  | { level: "member"; player: PlayerSummary; normalizedPhone: string }
  | { level: "admin"; player: PlayerSummary; normalizedPhone: string };
```

Rules:

- Normalize phone using existing repo utilities if available (`src/lib/phone.ts`).
- Find `Player` by normalized phone.
- Unknown or malformed phone becomes `guest`.
- Admin status is derived from `Player.isAdmin`; never trust OpenClaw to tell IRBA that someone is admin.
- Phase 0 only needs actor resolution for `help`, but this must be implemented now so Phase 1/2 reuse it.

Open question to verify before implementation: which phone format OpenClaw will pass (`05...`, `+972...`, or `972...`). Prefer making normalization accept all three if the existing utility already supports it safely.

## 9. Idempotency design

Idempotency module: `src/lib/assistant/idempotency.ts`

Expected behavior:

- New key: execute operation and store result.
- Same key + same operation: return cached result with `idempotent_replay: true`.
- Same key + different operation: return `422 VALIDATION_ERROR` or equivalent conflict error.
- Expired old rows are pruned by cron, not checked with complicated TTL logic in the hot path.
- DB unique constraint on `idempotencyKey` protects against concurrent duplicate writes.

Phase 0 implementation can store idempotent records after execution. For Phase 2 mutations, consider a transaction boundary that writes the domain mutation and assistant result atomically.

## 10. Audit/logging behavior

Phase 0 writes to `AssistantRequestLog`, not the existing `AuditLog`.

Log these requests:

- Any request that passed auth and envelope validation.
- Successful `help` requests.
- Allowlist failures, permission failures, unknown operation, and handler errors when an idempotency key is available.

Do not log:

- Missing/wrong bearer token.
- Invalid JSON that cannot provide `idempotency_key`.

Existing `AuditLog` is reserved for real domain mutations in Phase 2, e.g. `ASSISTANT_ROSTER_ADD`, `ASSISTANT_ROSTER_REMOVE`.

Prune behavior:

- Extend `src/app/api/cron/prune-audit/route.ts`.
- Read `assistant_log_retention_days` via config helper.
- Delete `AssistantRequestLog` rows older than retention.
- Keep the existing cron auth behavior unchanged.

## 11. Tests to add/run

Unit tests:

- `auth.test.ts`
  - Valid token passes.
  - Missing token fails.
  - Wrong token fails.
  - Missing env secret fails closed.

- `schema.test.ts`
  - Valid envelope passes.
  - Invalid UUID fails.
  - Missing operation fails.
  - Missing group JID fails.
  - Missing params defaults to `{}` if we choose that behavior.

- `permissions.test.ts`
  - Guest can call `help`.
  - Unknown operation is denied/unknown consistently.
  - Member/admin behavior is ready for Phase 1.

- `actor.test.ts`
  - Known admin resolves to `admin`.
  - Known non-admin resolves to `member`.
  - Unknown phone resolves to `guest`.
  - Malformed phone resolves to `guest` without throwing.

- `idempotency.test.ts`
  - New key returns no cached result.
  - Existing same-operation key returns cached result.
  - Existing different-operation key reports conflict.

- Route tests if the repo's test setup supports route handlers:
  - No auth → 401.
  - Bad group → 403.
  - Valid help → 200.
  - Repeated idempotency key → replay response.

Commands to run:

```bash
npm test -- src/lib/assistant
npm run lint
npm run build
```

If full build requires placeholder DB env, follow existing repo build instructions.

## 12. Manual smoke tests

Use placeholders only; never paste the real secret in docs or commits.

Generate secret:

```bash
openssl rand -hex 32
```

No auth:

```bash
curl -i https://irba.club/api/assistant/v1 \
  -H 'Content-Type: application/json' \
  -d '{"operation":"help","actor_phone":"0500000000","group_jid":"120363000000000000@g.us","idempotency_key":"00000000-0000-4000-8000-000000000001","params":{}}'
```

Expected: `401`.

Wrong group:

```bash
curl -i https://irba.club/api/assistant/v1 \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <ASSISTANT_API_SECRET>' \
  -d '{"operation":"help","actor_phone":"0500000000","group_jid":"120363-not-allowed@g.us","idempotency_key":"00000000-0000-4000-8000-000000000002","params":{}}'
```

Expected: `403 FORBIDDEN_GROUP`.

Valid help:

```bash
curl -i https://irba.club/api/assistant/v1 \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <ASSISTANT_API_SECRET>' \
  -d '{"operation":"help","actor_phone":"0500000000","group_jid":"<ALLOWLISTED_GROUP_JID>","idempotency_key":"00000000-0000-4000-8000-000000000003","params":{}}'
```

Expected: `200`, `ok: true`, operations includes `help`.

Replay same request:

```bash
# Repeat the exact valid-help curl with the same idempotency_key.
```

Expected: `200`, same data, `idempotent_replay: true`.

## 13. Rollback plan

Before deploy:

- Keep DB migration file isolated.
- Keep endpoint isolated under `/api/assistant/v1`.
- Keep feature disabled by default via empty `assistant_allowed_groups`.

Rollback options:

1. Fast disable: clear `assistant_allowed_groups` in AppConfig. Endpoint remains deployed but all group requests return `403`.
2. Secret disable: unset/change `ASSISTANT_API_SECRET`; endpoint returns `401` for all callers.
3. App rollback: revert deployment to previous commit.
4. DB rollback, only if needed: drop `AssistantRequestLog` after confirming no later migration depends on it.

Because the endpoint is additive and disabled unless configured, the preferred rollback is config/secret disable, not DB rollback.

## 14. Acceptance criteria / definition of done

All Phase 0 acceptance criteria are complete as of 2026-05-22:

- [x] New endpoint exists and is documented.
- [x] Endpoint fails closed with missing secret.
- [x] Auth, allowlist, schema validation, actor resolution, permission check, idempotency, logging, and `help` dispatch all exist.
- [x] `AssistantRequestLog` migration applies cleanly.
- [x] Config keys are seeded and defaults are safe.
- [x] Prune cron handles assistant logs.
- [x] Tests pass.
- [x] Manual curl smoke tests pass in production.
- [x] `PROJECT_STATE.md` records the new assistant API skeleton.
- [x] No inbound WhatsApp listener was added to IRBA.
- [x] No changes were made to `wa/`.

Production smoke results:

- Valid `help` request from allowlisted IRBA Coding group → `200`, `ok: true`, `operations: ["help"]`, actor resolved as admin for Avi.
- Same idempotency key replay → `200`, `idempotent_replay: true`.
- Missing auth → `401 UNAUTHORIZED`.
- Non-allowlisted group → `403 FORBIDDEN_GROUP`.
- Unknown operation → `400 UNKNOWN_OPERATION`.

## 15. Open questions before implementation

Resolved before implementation: Avi approved all recommendations below. Implementation follows Bearer token auth for Phase 0, AppConfig allowlist, no AssistantRequestLog entries for failed auth, implemented-only `help`, broad phone normalization for `05...`/`972...`/`+972...`, and no future mutation audit actions yet.


1. Should Phase 0 use Bearer token only, or HMAC signing from day one?
   - Recommendation: Bearer token for Phase 0; design modules so HMAC can replace/extend auth later.

2. Which exact phone format will OpenClaw send as `actor_phone`?
   - Recommendation: accept `05...`, `972...`, and `+972...` if existing normalization supports it safely.

3. Should failed auth requests be logged anywhere?
   - Recommendation: not in `AssistantRequestLog`; use server logs only, without token values.

4. Should `help` return only implemented operations or future operations too?
   - Recommendation: only implemented operations in Phase 0.

5. Should `assistant_allowed_groups` live in AppConfig or env?
   - Recommendation: AppConfig, because it is live-editable and defaults to disabled.

6. Should Phase 0 add future mutation audit actions to `src/lib/audit.ts` now?
   - Recommendation: defer until Phase 2 unless tests or typing make it useful now.

## 16. Suggested commit sequence

1. `docs: add phase 0 OpenClaw IRBA execution plan`
   - This document only.

Implementation commits later:

2. `prisma: add assistant request log`
   - Prisma model, migration, config seed rows.

3. `config: add assistant api settings`
   - `.env.example`, config keys/defaults.

4. `feat(assistant): add auth schema actor and idempotency modules`
   - Core library modules and unit tests.

5. `feat(assistant): add assistant api route and help operation`
   - Route skeleton, `help`, route tests.

6. `chore(cron): prune assistant request logs`
   - Extend prune cron and tests.

7. `docs: update project state for assistant api phase 0`
   - `PROJECT_STATE.md` after implementation is actually shipped.
