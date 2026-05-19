# WhatsApp Command API Plan

## Goal

Turn the IRBA WhatsApp group into a safe operational interface for the app: people can ask questions or request actions in natural Hebrew, while the system converts each message into a typed command, validates permissions, runs deterministic backend logic, audits the result, and replies clearly in WhatsApp.

Examples:

- `כמה חייב רונן?`
- `מה מצב הרשומים כרגע?`
- `שלח פירוט של התשלומים של עדי`
- `תוסיף את יקיר לרשימה`
- `תוריד את יקיר מהרשימה`

The important boundary: natural-language parsing may help classify messages, but database reads/writes must always go through explicit typed commands with validation, idempotency, permission checks, ambiguity handling, and audit logging.

## Current state observations

- The app is a Next.js/Prisma/PostgreSQL project.
- The WhatsApp sidecar lives in `wa/src/index.ts` and currently exposes send-oriented HTTP endpoints:
  - `POST /send`
  - `POST /send-group`
  - `POST /send-poll`
  - `GET /status`
  - `GET /qr`
  - `POST /logout`
  - `GET /groups`
- The main app already has outgoing WhatsApp primitives in `src/lib/wa-notify.ts`.
- Existing notification code is best-effort and no-throw, with a master `WA_NOTIFY_ENABLED=true` switch.
- The app already has useful domain primitives/models:
  - `Player`, including phone, names, nickname, `isAdmin`, `playerKind`
  - `GameSession`, `Attendance`, `Payment`, `SessionCharge`, `SharedExpenseCharge`
  - `AuditLog`
  - `balance.ts`, `charging.ts`, `waitlist*`, `sort-attendances.ts`, `format-date.ts`, etc.
- There is no inbound WhatsApp message listener yet.
- There is no command registry/intent router yet.

## Target architecture

```text
WhatsApp group message
        ↓
Baileys messages.upsert listener in wa sidecar
        ↓
Authenticated internal webhook to Next app
        ↓
src/app/api/wa/inbound/route.ts
        ↓
wa-command pipeline:
  1. normalize inbound event
  2. ignore self/noise/non-target groups
  3. resolve actor
  4. parse intent
  5. validate params
  6. check permissions
  7. resolve players/session
  8. execute deterministic command handler
  9. audit
 10. reply through wa sidecar
```

Recommended principle: the sidecar should remain thin. It should receive WhatsApp events, forward normalized data to the app, and send replies. The Next.js app should own business logic, database access, command authorization, and audit logging.

## Proposed module layout

```text
wa/src/index.ts
  - add messages.upsert listener
  - extract groupId, senderJid, messageId, text, timestamp
  - POST to main app internal webhook
  - optionally support quoted-message reply in /send-group

src/app/api/wa/inbound/route.ts
  - internal authenticated endpoint
  - verifies shared secret/header
  - calls command pipeline

src/lib/wa-command/
  types.ts
  inbound.ts
  registry.ts
  router.ts
  permissions.ts
  actor.ts
  player-resolver.ts
  session-resolver.ts
  replies.ts
  audit.ts
  commands/
    balance.ts
    payments.ts
    roster-status.ts
    roster-add.ts
    roster-remove.ts
    help.ts
  __tests__/
```

Optional later:

```text
src/lib/wa-command/llm-parser.ts
src/lib/wa-command/confirmations.ts
src/components/admin/wa-command-settings.tsx
```

## Inbound event contract

The sidecar forwards a normalized event to the app:

```ts
type WaInboundEvent = {
  provider: "baileys";
  groupId: string;
  groupSubject?: string;
  messageId: string;
  senderJid: string;
  senderPhone?: string;
  senderPushName?: string;
  text: string;
  timestamp: string;
  quotedMessageId?: string;
  isFromMe: boolean;
};
```

The app should reject events that are:

- missing `groupId`, `messageId`, `senderJid`, or text
- sent by the bot itself
- from an unconfigured group, unless explicitly enabled for testing
- duplicate message IDs already processed

## Intent JSON contract

The router should output one structured intent:

```ts
type WaCommandIntent =
  | {
      name: "player.balance.get";
      target: PlayerReference;
    }
  | {
      name: "player.payments.list";
      target: PlayerReference;
      limit?: number;
      period?: "all" | "year" | "month";
    }
  | {
      name: "session.roster.status";
      session?: SessionReference;
    }
  | {
      name: "session.roster.add";
      target: PlayerReference;
      session?: SessionReference;
    }
  | {
      name: "session.roster.remove";
      target: PlayerReference;
      session?: SessionReference;
    }
  | {
      name: "help";
    }
  | {
      name: "unknown";
      reason: string;
    };

type PlayerReference =
  | { kind: "self" }
  | { kind: "name"; value: string }
  | { kind: "phone"; value: string }
  | { kind: "mention"; jid: string };

type SessionReference =
  | { kind: "current" }
  | { kind: "next_open" }
  | { kind: "date"; isoDate: string };
```

## MVP command list

### Read-only commands first

1. `player.balance.get`
   - Examples:
     - `כמה חייב רונן?`
     - `מה החוב של עדי?`
     - `כמה אני חייב?`
   - Uses `computePlayerBalance` / balance aggregation.
   - Reply examples:
     - `רונן חייב כרגע ₪120.`
     - `לעדי יש יתרה חיובית של ₪40.`
     - `אצל יקיר מאוזן — אין חוב כרגע.`

2. `player.payments.list`
   - Examples:
     - `שלח פירוט תשלומים של עדי`
     - `תשלומים אחרונים של רונן`
   - Returns recent payments and total paid.
   - Sensitive enough to start as admin-only.

3. `session.roster.status`
   - Examples:
     - `מה מצב הרשומים כרגע?`
     - `מי רשום?`
     - `כמה מקומות נשארו?`
   - Uses the next/current open session.
   - Reply includes registered count, max players, waitlist if relevant, and maybe short list.

4. `help`
   - Examples:
     - `מייקי עזרה`
     - `מה אפשר לשאול?`
   - Lists supported commands compactly.

### Mutating commands, second phase

5. `session.roster.add`
   - Examples:
     - `תוסיף את יקיר`
     - `תרשום את עדי למשחק`
   - Adds attendance for next/current open session.
   - Idempotent: if already registered, reply accordingly.

6. `session.roster.remove`
   - Examples:
     - `תוריד את יקיר`
     - `בטל הרשמה לעדי`
   - Removes attendance from next/current open session.
   - Idempotent: if not registered, reply accordingly.

### Later commands

- `payment.add`: `סמן שעדי שילם 100 בביט`
- `payment.delete`: admin correction flow only
- `session.open` / `session.close`
- `session.broadcast.roster`
- `debtors.broadcast`
- `player.lookup`
- `session.charge.preview` / `session.charge.apply`

## Intent parsing strategy

Start deterministic; add LLM only after the typed API is stable.

### Phase 1: deterministic parser

Use Hebrew keyword/regex matching:

- Balance:
  - `/כמה .*חייב/`
  - `/מה החוב של/`
  - `/יתרה של/`
- Roster status:
  - `/מצב הרשומים/`
  - `/מי רשום/`
  - `/כמה מקומות/`
- Payments:
  - `/פירוט .*תשלומים/`
  - `/תשלומים .*של/`
- Add:
  - `/תוסיף/`, `/תרשום/`, `/שים .*ברשימה/`
- Remove:
  - `/תוריד/`, `/תסיר/`, `/בטל הרשמה/`

### Phase 2: structured LLM parser

Only if regex confidence is low. The LLM returns only JSON matching `WaCommandIntent`; no direct DB access and no direct free-form execution.

The command handler should still be deterministic and should reject invalid or risky outputs.

## Command registry

Each command should be registered with metadata:

```ts
type WaCommandDefinition<TIntent> = {
  name: WaIntentName;
  description: string;
  access: "group_member" | "self_or_admin" | "admin_only";
  mutates: boolean;
  requiresConfirmation: boolean;
  handler: (ctx: WaCommandContext, intent: TIntent) => Promise<WaCommandResult>;
};
```

For MVP:

| Intent | Access | Mutates | Confirmation |
| --- | --- | --- | --- |
| `help` | group member | no | no |
| `session.roster.status` | group member | no | no |
| `player.balance.get` | self or admin | no | no |
| `player.payments.list` | admin only | no | no |
| `session.roster.add` | admin only initially | yes | maybe later |
| `session.roster.remove` | admin only initially | yes | maybe later |

## Permission model

### Actor resolution

Map WhatsApp sender to player:

1. Extract phone from sender JID: `97250...@s.whatsapp.net` → `050...`.
2. Find `Player.phone`.
3. Actor context:

```ts
type WaActor = {
  jid: string;
  phone?: string;
  playerId?: string;
  displayName: string;
  isKnownPlayer: boolean;
  isAdmin: boolean;
};
```

### Recommended initial policy

- Only configured IRBA group(s) can trigger commands.
- Unknown senders can use only `help` and possibly public roster status.
- Players can ask about themselves: `כמה אני חייב?`
- Admins can ask about anyone and run mutating commands.
- Mutating commands should initially be admin-only.
- Later, allow self-service add/remove for known players if Avi wants.

## Player identity resolution

`player-resolver.ts` should support:

- exact phone match
- exact nickname/name match
- normalized Hebrew/English display names
- mention JID → phone → player
- fuzzy match only if confidence is high

Possible outcomes:

```ts
type PlayerResolution =
  | { status: "found"; player: Player }
  | { status: "not_found"; query: string }
  | { status: "ambiguous"; query: string; candidates: Player[] };
```

Ambiguity reply:

```text
מצאתי כמה אפשרויות ל"עדי":
1. עדי כהן
2. עדי לוי
תגיד לי למי התכוונת.
```

For MVP, do not keep multi-message state yet. Ask the user to retry with the fuller name. Later, add short-lived pending clarification state.

## Session selection rules

For commands that do not specify a date:

1. Prefer an open, non-cancelled, non-archived upcoming session with the closest date.
2. If none exists, use the next upcoming non-cancelled session only for read-only status, but do not mutate unless it is open.
3. If multiple sessions are plausible, ask for clarification.
4. Never add/remove from a charged, archived, cancelled, or past session.

Recommended helper:

```ts
resolveTargetSession(reference?: SessionReference): Promise<SessionResolution>
```

## Mutating operation safety

For add/remove:

- Check actor permission first.
- Resolve target player exactly.
- Resolve session exactly.
- Check session is open, upcoming, not cancelled, not archived, not charged.
- Use DB transaction.
- Make operation idempotent:
  - add existing attendance → no-op success
  - remove missing attendance → no-op success or clear message
- Recompute waitlist/roster status if existing business logic requires it.
- Send one concise reply.
- Write audit log with before/after.

Optional confirmation pattern for risky future commands:

```text
אני עומד לרשום את יקיר למשחק ביום שלישי. לאשר? כתוב: אשר 1234
```

## Audit logging

Reuse existing `AuditLog`, but add WhatsApp-specific actions if the enum currently requires explicit values:

- `WA_COMMAND_RECEIVED`
- `WA_COMMAND_EXECUTED`
- `WA_COMMAND_DENIED`
- `WA_COMMAND_FAILED`

Audit fields should include:

- `actor`: `wa:<phone>` or `wa:<jid>`
- `entityType`: `WaCommand`, `Player`, `GameSession`, etc.
- `entityId`: message id or affected entity id
- `before`: relevant previous state for mutating commands
- `after`: result, intent, affected ids, reply summary

Do not log sensitive OTPs or secrets.

## WhatsApp reply behavior

Sidecar should support reply-to-message if Baileys exposes it reliably:

```ts
POST /send-group
{
  groupId: string;
  message: string;
  mentions?: string[];
  replyToMessageId?: string;
}
```

Guidelines:

- Replies should be concise Hebrew.
- Avoid markdown tables in WhatsApp.
- Mention/tag only when useful.
- Do not post stack traces or internal errors to the group.
- For permission denial, be polite and short:
  - `אין לי הרשאה לבצע את זה מהמספר הזה.`
- For internal failures:
  - `משהו נתקע לי בצד המערכת. לא ביצעתי שינוי.`

## Data/privacy policy

- Financial details are sensitive.
- Group-visible balance details should be approved by Avi; until confirmed, default to:
  - Admin can ask about anyone in group.
  - Non-admin can ask only about self.
- Payment history should start admin-only.
- Mutating financial commands should require admin and later maybe confirmation.

## Testing plan

### Unit tests

- intent parser:
  - Hebrew examples for each command
  - unknown/noise messages
  - ambiguous names
- player resolver:
  - exact phone
  - nickname/name
  - ambiguous candidates
  - not found
- session resolver:
  - next open session
  - no open session
  - cancelled/archived/charged exclusion
- permissions:
  - admin vs non-admin
  - self vs other
  - unknown sender
- command handlers:
  - balance output
  - payment list output
  - roster status output
  - add/remove idempotency

### Integration tests

- `POST /api/wa/inbound` with signed secret.
- Duplicate message ID ignored.
- Unauthorized group ignored/denied.
- Mutating command writes attendance and audit log.
- Handler failure does not send partial success.

### Manual QA

- Test in a staging WhatsApp group first.
- Confirm replies are threaded/quoted if supported.
- Confirm no echo loop from bot's own messages.
- Confirm Hebrew phrasing feels natural.
- Confirm audit entries appear in admin audit page.

## Rollout plan

### Milestone 0 — Plan and agreement

- Commit this plan.
- Avi reviews open questions and approves MVP scope.

### Milestone 1 — Inbound plumbing only

- Add Baileys `messages.upsert` listener.
- Add signed webhook `POST /api/wa/inbound`.
- Log inbound events in development.
- Ignore all messages by default except `help` in configured group.
- Tests: webhook auth, duplicate message handling, ignored self messages.

### Milestone 2 — Read-only MVP

- Add command registry/router.
- Add deterministic Hebrew parser.
- Implement:
  - `help`
  - `session.roster.status`
  - `player.balance.get`
  - `player.payments.list` as admin-only
- Tests for parser, permissions, replies.

### Milestone 3 — Admin mutating roster commands

- Implement:
  - `session.roster.add`
  - `session.roster.remove`
- Add idempotent transaction logic and audit.
- Keep admin-only initially.
- Add manual QA in staging group.

### Milestone 4 — Better UX

- Add reply-to support in sidecar.
- Add better ambiguity prompts.
- Add short-lived clarification state if needed.
- Add admin config toggles:
  - enable inbound commands
  - allowed group JIDs
  - read-only mode
  - allow self RSVP via WhatsApp

### Milestone 5 — Advanced commands

- Add payment add/list improvements.
- Add roster broadcast/debtors broadcast commands.
- Consider structured LLM fallback parser.
- Add confirmation flow for risky mutations.

## Open questions for Avi

1. Should normal group members be allowed to ask `כמה חייב X?`, or only admins / self?
2. Should `כמה אני חייב?` work for any known player in the group?
3. Should players be allowed to add/remove themselves from the roster through WhatsApp, or should that remain admin-only?
4. Is the target group only the official IRBA group, or also this IRBA Coding group for staging/testing?
5. When someone asks for payment details, should the answer be public in the group or private to Avi/player?
6. Do we want every successful add/remove to trigger the existing roster notification template, or only a short command reply?
7. Should unclear commands be ignored silently or answered with a help hint?

## Concrete implementation checklist

- [ ] Add internal secret/env var for sidecar → app webhook authentication.
- [ ] Add inbound message listener to `wa/src/index.ts`.
- [ ] Add `POST /api/wa/inbound` route.
- [ ] Add duplicate message guard.
- [ ] Add `src/lib/wa-command/types.ts`.
- [ ] Add actor resolver from sender JID/phone to `Player`.
- [ ] Add deterministic parser.
- [ ] Add command registry.
- [ ] Add permissions module.
- [ ] Add player resolver.
- [ ] Add session resolver.
- [ ] Implement `help`.
- [ ] Implement roster status.
- [ ] Implement balance query.
- [ ] Implement payment list query as admin-only.
- [ ] Add audit logging for command receipt/result.
- [ ] Add tests for all above.
- [ ] Implement roster add/remove as admin-only.
- [ ] Add reply-to support in sidecar if reliable.
- [ ] Add staging group QA checklist.
- [ ] Document approved command examples in README/PROJECT_STATE after rollout.

## Recommended MVP scope

For the first implementation PR, keep it intentionally narrow:

1. inbound webhook plumbing
2. command registry/router
3. `help`
4. `מה מצב הרשומים כרגע?`
5. `כמה אני חייב?`
6. admin-only `כמה חייב רונן?`

Then add mutating commands only after the read-only loop is stable in the real group.
