# Phase 2.1 — OpenClaw ↔ IRBA Integration: Human-Friendly Roster Commands Execution Plan

## Implementation status — 2026-05-22

Approved by Avi, implemented/deployed, and QA-smoked enough for operational use.

Completed:

- IRBA production API commit `7c1f5dd` adds admin-only `player_lookup`.
- Production deploy succeeded and `/api/health.version` reports `7c1f5dd`.
- Production smoke: `help` lists `player_lookup`; admin lookup for `פוגל` returns `unique` by `nickname`; non-admin lookup returns `FORBIDDEN_OPERATION`.
- OpenClaw local skill created at `/root/.openclaw/skills/irba-assistant/` with:
  - `SKILL.md`
  - `scripts/irba_roster_command.py`
  - `references/COMMANDS.md`
- Skill smoke tests passed for Hebrew multi-target parsing, dry-run lookup, phone/JID mention resolution, local LID→phone mapping, and safe refusal for unmapped LID-only mentions.
- Real IRBA Coding group QA against upcoming session `cmpha1zfy000508qh2aot2huj` passed for: self remove/add, multi-add (`אבי`, `אדיר`, `יקיר`, `פוגל`), duplicate add (`ALREADY_REGISTERED`), status reply, and LID-mapped mention remove (`@138435436224615` → `יקיר`).
- Skill was polished after QA to strip surrounding schedule words such as `מהמפגש הקרוב`, support `אותי`, use local WhatsApp/Baileys reverse LID→phone mappings when available, and format mutation success replies from API `data.player.display_name` instead of raw phone input.

Still pending / deferred before treating mentions as fully proven in the final production group:

- Live mention QA in the future production WhatsApp group, because that group may expose different LID/JID behavior and may not have local LID→phone mappings yet.
- Ambiguous-name group QA against real data.
- Unknown-name group QA against real data.
- Not-registered remove edge case against an open session.

## Context

Phase 2 shipped admin-only roster mutations in the production assistant API:

- `session_roster_add`
- `session_roster_remove`

Those operations are deployed to production on commit `df8aaea` and currently require `params.player_phone`. That is safe for an API boundary, but awkward for real WhatsApp use: Avi expects to write natural group commands such as “תוסיף את פוגל”, “תוסיף את אדיר ויקיר”, or to mention a WhatsApp participant.

Phase 2.1 adds the missing human-friendly resolution layer while keeping the Phase 2 API safety model: resolve a requested person to an exact known `Player`, then call the existing phone-based mutation operation. No roster mutation should happen when resolution is ambiguous or unsafe.

---

## 1. Purpose and explicit non-goals

### In scope

- Resolve roster mutation targets from natural text names, not only full phone numbers.
- Support adding/removing multiple players in one command, e.g. “תוסיף את אדיר ויקיר”.
- Resolve names by language-aware database fields in Avi’s required priority order:
  1. `nickname`
  2. last name
  3. first name
- Use Hebrew name fields for Hebrew input and English name fields for English input.
- Support WhatsApp mentions when OpenClaw metadata exposes enough identity to map the mention to a known IRBA `Player`.
- Ask for clarification instead of mutating when a name/mention is ambiguous.
- Preserve Phase 2 admin-only permissions and existing assistant API audit/idempotency behavior.
- Add tests for lookup priority, ambiguity handling, multi-target commands, and mention fallback behavior.

### Not in scope

- Creating brand-new players from free text or unknown mentions.
- Fuzzy ML-style matching that guesses between close names without deterministic confidence.
- Self-service member RSVP flows.
- Player DM/push notifications.
- Mutating any session other than the next upcoming mutable IRBA session.
- Bypassing `session_roster_add` / `session_roster_remove`; those remain the only execution layer.

---

## 2. User-facing command model

OpenClaw/Mikey should support commands like:

- “תוסיף את פוגל”
- “תוסיף את אדיר ויקיר”
- “תוריד את פוגל”
- “תסיר את Adir”
- “תוסיף את @Somebody”
- “תוריד את @Somebody ואת פוגל”

The natural-language layer produces one or more resolved players. For each resolved player it calls the existing assistant API with:

```json
{
  "operation": "session_roster_add",
  "params": {
    "player_phone": "0501234567"
  }
}
```

or:

```json
{
  "operation": "session_roster_remove",
  "params": {
    "player_phone": "0501234567"
  }
}
```

The assistant should summarize per-player success/failure in one concise Hebrew reply.

---

## 3. Name lookup rules

### Language detection

Detect the query token language before choosing name fields:

- Hebrew token: contains Hebrew Unicode letters → Hebrew lookup path.
- English/Latin token: contains Latin letters and no Hebrew letters → English lookup path.
- Numeric token / phone-like token: use the existing phone path.
- Mixed token: treat as unsafe unless one side clearly normalizes to a known exact value; otherwise ask for clarification.

### Field priority

For each requested name token, lookup must happen in this exact priority order:

1. `nickname`
2. last name
3. first name

Language-specific fields:

- Hebrew input:
  1. `nickname`
  2. `lastNameHe`
  3. `firstNameHe`
- English input:
  1. `nickname`
  2. `lastNameEn`
  3. `firstNameEn`

`nickname` is checked first for both languages because nicknames may be Hebrew, English, or mixed in the database. Matching should normalize whitespace and case where relevant.

### Matching semantics

Use deterministic matching first:

- Exact normalized match is accepted.
- Case-insensitive exact match for Latin text is accepted.
- Trimmed whitespace and repeated spaces are ignored.
- Do not silently choose a partial match if exact matches exist.

Partial/contains matching may be added only as a fallback if it remains deterministic:

- If fallback finds exactly one player, it may resolve.
- If fallback finds multiple players, ask for clarification.
- If fallback finds no players, return not-found.

### Priority examples

If Avi writes “פוגל”:

1. Search `nickname = "פוגל"`.
2. If no nickname match, search `lastNameHe = "פוגל"`.
3. If no last-name match, search `firstNameHe = "פוגל"`.
4. If exactly one result at the first matching priority level, use it.
5. If multiple results at that same priority level, ask which one.
6. Do not continue to lower-priority fields once a higher-priority level matched.

If Avi writes “Fogel”, use the same priority with `lastNameEn` / `firstNameEn`.

---

## 4. Multi-player parsing

The command parser should extract multiple targets from one instruction.

Hebrew separators:

- `ו` prefix when it clearly joins names: “אדיר ויקיר” → `אדיר`, `יקיר`
- commas: “אדיר, יקיר”
- “וגם”: “אדיר וגם יקיר”

English separators:

- `and`
- commas
- ampersand (`&`) if present

Safety rules:

- Resolve all targets before executing any mutation when possible.
- If one target is ambiguous or missing, prefer not to partially mutate unless the admin explicitly confirms partial execution.
- If all targets resolve uniquely, call the existing mutation operation once per player with a unique idempotency key per player/action.
- Return a grouped summary:
  - successes
  - already registered / not registered
  - not found
  - needs clarification

Recommended default for Phase 2.1: **all-or-clarify before mutation** for natural-name commands. This avoids “added Adir but not Yakir” surprises in a fast group chat.

---

## 5. WhatsApp mention lookup

Mentions should be supported only when the inbound OpenClaw WhatsApp metadata exposes enough stable identity to map the mention to a known `Player`.

Possible metadata paths to investigate during implementation:

- Mentioned participant phone / E.164.
- Mentioned WhatsApp JID that includes a phone number.
- Mentioned LID/internal WhatsApp ID.
- Display label only.

Resolution rules:

1. If mention metadata includes a phone number, normalize it with `normalizeAssistantPhone()` and lookup `Player.phone`.
2. If mention metadata includes a WhatsApp JID with an embedded phone, extract and normalize that phone.
3. If mention metadata/text only includes LID/internal ID, do **not** guess. Either:
   - use an existing local WhatsApp/Baileys reverse LID→phone mapping if one exists, or
   - return “לא הצלחתי לזהות את התיוג למספר/שחקן — תכתוב שם או מספר.”
4. If mention metadata only includes display text, treat it like a normal name lookup and apply ambiguity rules.

No mutation should happen from a mention unless it resolves to exactly one known `Player`.

---

## 6. API and architecture options

### Recommended implementation

Add a new assistant-side resolution layer while keeping Phase 2 mutations unchanged.

Two acceptable shapes:

#### Option A — New assistant API resolver operation

Add read-only/admin-safe operation:

- `player_lookup`

Input:

```json
{
  "query": "פוגל",
  "language_hint": "he"
}
```

Output:

```json
{
  "status": "unique",
  "player": {
    "id": "...",
    "display_name": "פוגל",
    "phone": "050..."
  },
  "matched_field": "lastNameHe",
  "matched_value": "פוגל"
}
```

Statuses:

- `unique`
- `ambiguous`
- `not_found`

Then OpenClaw/Mikey resolves names first, asks clarification if needed, and calls `session_roster_add/remove` with `player_phone`.

#### Option B — Extend roster mutations to accept a target object

Allow:

```json
{
  "player_phone": "050..."
}
```

or:

```json
{
  "player_query": "פוגל"
}
```

The API resolves and mutates in one operation.

### Recommendation

Use **Option A** unless implementation discovers a strong reason not to.

Why:

- Keeps existing Phase 2 mutation contracts stable.
- Separates safe lookup/clarification from irreversible roster changes.
- Easier to test in WhatsApp before mutation.
- Lets Mikey show ambiguity choices naturally.
- Reduces risk of accidental add/remove from a misunderstood free-text command.

If Option A is chosen, `help` should list `player_lookup` as an admin/read helper or internal helper depending on whether we want to expose it publicly. It does not mutate state.

---

## 7. Error cases and reply guidance

### Lookup statuses

| Status / code | Scenario | Hebrew reply guidance |
|---|---|---|
| `unique` | Exactly one player resolved | Continue to mutation or ask confirmation if appropriate |
| `ambiguous` | More than one player matched same priority level | “מצאתי כמה אפשרויות ל־פוגל: 1. ... 2. ... למי התכוונת?” |
| `not_found` / `PLAYER_NOT_FOUND` | No matching player | “לא מצאתי שחקן בשם/תיוג הזה.” |
| `MENTION_UNRESOLVED` | Mention lacks phone/mapping | “לא הצלחתי לזהות את התיוג לשחקן — תכתוב שם או מספר.” |
| `MIXED_LANGUAGE_AMBIGUOUS` | Mixed token cannot be safely resolved | “השם הזה לא חד־משמעי, תכתוב שם מלא או מספר.” |
| `FORBIDDEN_OPERATION` | Non-admin tried to mutate | “רק מנהל יכול להוסיף/להסיר שחקנים.” |

### Mutation summary examples

Single add success:

> ✅ פוגל נוסף למשחק.

Multiple add success:

> ✅ הוספתי את אדיר ויקיר למשחק.

Mixed result:

> הוספתי את אדיר. את “יקיר” לא מצאתי — תכתוב שם מלא או מספר.

Ambiguous before mutation:

> מצאתי שני “פוגל”: אורי פוגל ויונתן פוגל. למי התכוונת?

For Phase 2.1 default all-or-clarify behavior, avoid mixed partial results unless Avi explicitly confirms partial execution.

---

## 8. Tests

### Lookup unit tests

New file candidate:

- `src/lib/assistant/player-lookup.test.ts`

Cases:

- Hebrew nickname exact match wins over Hebrew last name.
- Hebrew last name exact match wins over Hebrew first name.
- English nickname exact match wins over English last name.
- English last name exact match wins over English first name.
- Lower-priority matches are ignored when higher-priority match exists.
- Multiple matches at same priority return `ambiguous`.
- No matches return `not_found`.
- Case-insensitive English matching.
- Whitespace normalization.
- Mixed-language unsafe case returns clarification/validation error.

### Multi-target parser tests

New file candidate:

- `src/lib/assistant/target-parser.test.ts`

Cases:

- “תוסיף את אדיר ויקיר” → `['אדיר', 'יקיר']`
- “תוסיף את אדיר, יקיר” → `['אדיר', 'יקיר']`
- “add Adir and Yakir” → `['Adir', 'Yakir']`
- Phone numbers are preserved as phone targets.
- Mentions are preserved as mention targets when metadata exists.

### Route/API tests

If implementing `player_lookup`:

- Unknown operation behavior remains unchanged.
- `player_lookup` returns unique/ambiguous/not_found statuses.
- Permissions: if exposed externally, decide whether `member` may lookup. Recommendation: admin-only initially because roster mutation workflow is admin-only and player lookup may expose phone-backed identity.
- `help` metadata includes the operation only if it is intentionally public.

### Integration tests for command orchestration

If OpenClaw-side command handling is implemented in repo scripts/helpers:

- Natural add by unique name calls `session_roster_add` with resolved `player_phone`.
- Ambiguous name does not call mutation.
- Not-found name does not call mutation.
- Multi-target command resolves all before mutation.
- Mention with phone resolves.
- Mention with only LID fails safely.

---

## 9. Production QA checklist

Before treating Phase 2.1 as fully proven in the final production WhatsApp group:

- [x] Unit tests pass for lookup priority and parser behavior. (`src/lib/assistant/player-lookup.test.ts`, 23 tests)
- [x] Full test suite passes. (`398 passed` for Phase 2.1 implementation; later `400 passed` after the admin config save fix on 2026-05-22)
- [x] Lint passes with no new errors. (`0 errors`, 9 pre-existing warnings)
- [x] Production deploy completed and `/api/health.version` reports the Phase 2.1 commit. (`7c1f5dd`)
- [x] WhatsApp/API smoke: `help`/capability text lists `player_lookup` as admin-only.
- [x] OpenClaw skill smoke: Hebrew multi-target parse works in `irba_roster_command.py`.
- [x] OpenClaw skill smoke: `תוסיף את פוגל --dry-run` resolves through production `player_lookup` without mutating.
- [x] OpenClaw skill smoke: mention with phone/JID resolves; unresolved LID-only mention fails safely; LID with local reverse mapping resolves to phone.
- [x] WhatsApp group QA: add by unique Hebrew nickname works on a safe/open session. (`יקיר`)
- [x] WhatsApp group QA: add multiple players in one Hebrew command works. (`אבי`, `אדיר`, `יקיר`, `פוגל`)
- [x] WhatsApp group QA: self remove/add works. (`אותי` → Avi's actor phone)
- [x] WhatsApp group QA: LID-mapped mention remove works in the current IRBA Coding group. (`@138435436224615` → `יקיר`)
- [x] Duplicate add reply remains clear. (`אדיר` already registered)
- [ ] WhatsApp group QA: ambiguous name asks clarification and does not mutate.
- [ ] WhatsApp group QA: unknown name returns a clear not-found reply and does not mutate.
- [ ] WhatsApp group QA: mention lookup in the future production group succeeds when phone metadata/mapping is available, or fails safely when only unmapped LID/internal metadata is available.
- [ ] Remove by name tested after add in final production-style flow.
- [ ] Not-registered remove reply remains clear.

---

## 10. Implementation sequence

1. [blocked for real-message QA] Inspect current OpenClaw WhatsApp inbound metadata for mentions in this group.
2. [x] Inspect IRBA `Player` schema and existing display-name helpers.
3. [x] Implement deterministic player lookup helper with priority order:
   - `nickname`
   - language-specific last name
   - language-specific first name
4. [x] Add parser for one/multiple command targets. Implemented in the OpenClaw `irba-assistant` skill script.
5. [x] Choose final architecture:
   - preferred: `player_lookup` resolver operation + OpenClaw orchestration,
   - fallback: extend mutation params with `player_query` only if resolver operation is too awkward.
6. [x] Add tests for lookup, parser, route/permissions, and orchestration. IRBA tests cover lookup/route/permissions; OpenClaw skill smoke covers parser/orchestration safety.
7. [x] Run targeted tests.
8. [x] Run full tests + lint.
9. [x] Commit and push implementation after Avi approved this plan.
10. [x] Deploy to production.
11. [pending] Run real group QA before marking Phase 2.1 complete.

---

## 11. Approval gate

This document is a plan only. Do **not** implement Phase 2.1 until Avi explicitly approves this plan.

If implementation discovers that WhatsApp mention metadata cannot expose a phone or stable mapping, stop and report that limitation before inventing a workaround.
