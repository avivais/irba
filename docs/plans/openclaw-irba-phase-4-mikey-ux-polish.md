# OpenClaw ↔ IRBA Phase 4 — Mikey UX / Help Polish

Status: Implemented locally in OpenClaw skill — lightweight QA passed  
Scope: improve Mikey/OpenClaw user-facing replies for existing IRBA assistant operations.  
No IRBA business logic changes in this phase.

Implementation date: 2026-05-23  
Implementation location: `/root/.openclaw/skills/irba-assistant/`

## Goal

Make Mikey feel reliable and predictable in the IRBA WhatsApp group by standardizing short Hebrew replies and adding a clear group-safe help response.

This phase does **not** add new IRBA capabilities. It only improves how OpenClaw/Mikey explains the results of existing typed IRBA API operations.

## Current baseline

Existing live operations:

- `help`
- `next_session`
- `session_status`
- `player_lookup`
- `session_roster_add`
- `session_roster_remove`
- `player_register_add`
- `player_register_cancel`
- `player_register_status`

IRBA owns:

- permission checks;
- actor resolution;
- roster/session/RSVP business logic;
- DB mutations;
- audit/idempotency;
- configured WhatsApp notifications.

Mikey/OpenClaw owns:

- WhatsApp/NLP handling;
- mention/name parsing;
- deciding when to call which typed operation;
- short user-facing replies.

## Non-goals

- No new IRBA API operations.
- No finance operations.
- No competition operations.
- No proactive automation changes.
- No changes to RSVP/roster rules.
- No direct DB access from OpenClaw.
- No duplicate IRBA-native notification broadcasts.

## Implementation tasks

### 1. Reply template catalog

Add/standardize concise Hebrew replies for existing result/error cases:

- No upcoming session.
- Session exists: date/time, registered count, spots left, waitlist count.
- Already registered.
- Registered successfully as confirmed.
- Registered successfully as waitlisted, including position if available.
- Not registered.
- Cancelled successfully.
- Cancel blocked by close window.
- Session closed.
- Admin add success.
- Admin remove success.
- Waitlist player promoted after admin/self removal.
- Unknown player.
- Ambiguous player lookup.
- Unresolved WhatsApp mention / LID.
- Unauthorized/non-admin mutation attempt.
- Generic safe fallback for unexpected assistant API errors.

### 2. Group-safe help response

Add one short Hebrew response for messages like:

- `מה אפשר לבקש ממך?`
- `עזרה`
- `פקודות`
- `מה אתה יודע לעשות?`

Suggested content should be concise and grouped by user role:

- Everyone:
  - “מה המפגש הבא?”
  - “כמה רשומים?”
  - “תרשום אותי”
  - “תבטל אותי”
  - “מה הסטטוס שלי?”
- Admins:
  - “תוסיף את X”
  - “תוריד את X”
  - “מי ברשימת המתנה?”

Do not mention future finance/competition features in help until implemented.

### 3. Keep replies single and non-noisy

For each incoming group request:

- Mikey should send one concise visible reply.
- Do not echo raw JSON.
- Do not duplicate IRBA-native group broadcasts.
- If IRBA already sends a configured notification, Mikey’s reply should stay short and acknowledge only the requested action.

### 4. Update OpenClaw skill references

Update local skill documentation/reference files as needed:

- `/root/.openclaw/skills/irba-assistant/SKILL.md`
- `/root/.openclaw/skills/irba-assistant/references/COMMANDS.md`

If code changes are needed, prefer changing the OpenClaw skill/helper layer, not IRBA server code.

### 5. Lightweight QA

Run safe checks without mutating production unless explicitly intended:

- `help` / command help formatting.
- `next_session` / `session_status` formatting.
- Parse-only or dry-run checks for natural admin commands.
- Existing self-service status formatting.

Mutation QA can stay for the real production-group QA window unless Avi explicitly asks to test in IRBA Coding.

## Implemented changes

Added a general OpenClaw-side router/formatter:

- `/root/.openclaw/skills/irba-assistant/scripts/irba_command.py`

Updated existing skill files:

- `/root/.openclaw/skills/irba-assistant/scripts/irba_roster_command.py`
- `/root/.openclaw/skills/irba-assistant/SKILL.md`
- `/root/.openclaw/skills/irba-assistant/references/COMMANDS.md`

Implemented behavior:

- Group-safe help response for `עזרה`, `פקודות`, `מה אפשר לבקש ממך?`, etc.
- Formatted replies for `next_session`, `session_status`, `player_register_status`.
- Dry-run-safe handling for self-register/self-cancel checks.
- Existing roster add/remove command path now routes through the general command helper when desired.
- Dates are rendered in Israel time with Hebrew weekday labels.
- Unresolved LID/mention paths remain blocking and ask for name/phone.

## Lightweight QA results

Passed safe checks on 2026-05-23:

- `python3 -m py_compile` for both skill scripts.
- `עזרה` → concise group-safe capability list.
- `כמה רשומים?` → formatted session status.
- `מה הסטטוס שלי?` → formatted personal RSVP status.
- `תרשום אותי --dry-run` → no mutation, clear dry-run reply.
- `תוסיף את פוגל --dry-run` → resolves player without mutation.
- unresolved LID mention → blocks with name/phone clarification.

Mutation QA is intentionally deferred to the real production-group QA window unless Avi asks to test in IRBA Coding.

## Acceptance criteria

- [x] Common IRBA group requests receive consistent short Hebrew replies.
- [x] Help response accurately lists only currently implemented capabilities.
- [x] Raw assistant API errors/JSON are not used as group replies by the new helper.
- [x] Ambiguous/unsafe identity cases block with a clear clarification request.
- [x] No new IRBA business logic is introduced in OpenClaw.
- [x] No duplicate WhatsApp broadcast behavior is introduced by this phase.
- [ ] Live mutation QA in the final production group remains pending until a real session/use case.

## Rollback

This phase is mostly OpenClaw skill/helper changes.

Rollback options:

1. Revert the skill/helper file changes.
2. Avoid invoking the `irba-assistant` skill for IRBA group requests.
3. If any IRBA docs were updated incorrectly, revert the docs commit.

## Recommended implementation order after approval

1. Inspect current OpenClaw skill script/references.
2. Add a small reply-formatting layer or template map.
3. Add group-safe help detection/response.
4. Update skill docs/references.
5. Run parse-only/dry-run checks.
6. Commit changes.
