# OpenClaw ↔ IRBA Integration Plan

> **Status:** Core WhatsApp assistant integration is live in production. Phases 0, 1, 2, 2.1, and 3 are implemented, deployed, and smoke/QA tested. Remaining work is mainly production-group rollout validation, Mikey UX polish, notification/automation alignment QA, hardening triage, and a separate decision on sensitive financial operations.
>
> **Last updated:** 2026-05-23
>
> **Replaces:** `docs/WHATSAPP_COMMAND_API_PLAN.md`

---

## 0. Executive Summary

The integration goal is to let Mikey/OpenClaw participate in the IRBA WhatsApp group and answer or execute IRBA actions through a **narrow, typed, authenticated API** on the IRBA production server.

The important architectural decision remains unchanged:

- **OpenClaw/Mikey owns conversation:** WhatsApp inbound messages, natural-language understanding, mention/name parsing, ambiguity handling, Hebrew replies, and group/DM routing.
- **IRBA owns deterministic execution:** authentication, group allowlist, actor resolution, permission checks, typed operation validation, business logic, DB mutations, idempotency, and audit logging.

The core integration is now live:

- Mikey can answer next-session and roster/status questions.
- Admins can add/remove known players by natural WhatsApp commands.
- Known players can self-register, self-cancel, and check their own RSVP status.
- Production health and assistant API smoke checks passed on commit `b2d2433`.
- Live IRBA Coding QA with Avi covered status, duplicate self-register, self-cancel, and re-register.

What remains is not “make the integration work” — it works. The remaining work is to make it complete, safer, clearer, and ready for broader real-world group usage.

---

## 1. Execution Plan Index

Detailed implementation plans live in `docs/plans/`:

| Phase | Plan | Current status |
|---|---|---|
| 0 | [`openclaw-irba-phase-0-infrastructure.md`](plans/openclaw-irba-phase-0-infrastructure.md) | Complete, deployed, production-smoked |
| 1 | [`openclaw-irba-phase-1-read-only-mvp.md`](plans/openclaw-irba-phase-1-read-only-mvp.md) | Complete, deployed, production-smoked |
| 2 | [`openclaw-irba-phase-2-admin-mutations.md`](plans/openclaw-irba-phase-2-admin-mutations.md) | Complete, deployed, OpenClaw QA-smoked |
| 2.1 | [`openclaw-irba-phase-2-1-human-friendly-roster-commands.md`](plans/openclaw-irba-phase-2-1-human-friendly-roster-commands.md) | Complete enough for operational use; some edge QA deferred |
| 3 | [`openclaw-irba-phase-3-self-service-rsvp.md`](plans/openclaw-irba-phase-3-self-service-rsvp.md) | Complete, deployed, live WhatsApp QA passed |

This document is the master/source-of-truth roadmap. Phase documents are execution notes and should be updated when their implementation or QA status changes.

---

## 2. Product Goal

Enable natural WhatsApp workflows in the IRBA group:

- “מתי המפגש?” → Mikey answers from IRBA production data.
- “מי רשום?” / “כמה מקומות נשארו?” → Mikey returns roster/status.
- Admin: “תוסיף את פוגל” → Mikey resolves the player safely and IRBA mutates the roster.
- Admin: “תסיר את @player” → Mikey resolves the mention safely and IRBA removes the player.
- Player: “תרשום אותי” → IRBA registers the actor.
- Player: “תבטל אותי” → IRBA cancels the actor if allowed by the RSVP window.
- Player: “אני רשום?” → IRBA returns the actor’s current RSVP status.

The target UX is that the group can treat Mikey as a reliable IRBA assistant, while the server remains deterministic and safe.

---

## 3. Non-Goals / Boundaries

These are intentional boundaries, not missing features:

| Not doing | Why |
|---|---|
| Inbound WhatsApp listener inside IRBA | OpenClaw already owns inbound WhatsApp/Baileys handling |
| Raw natural-language execution on IRBA | Server must only accept typed, validated operations |
| LLM database access | Strong trust boundary; IRBA business logic stays server-side |
| Generic admin/database API | Keep the assistant surface narrow and auditable |
| Creating unknown players from free text | Too risky; unknown/ambiguous people require clarification or admin UI |
| Mutating arbitrary sessions from chat | Current workflow targets the next upcoming active session only |
| IRBA sending duplicate assistant replies | Mikey owns group reply formatting; avoid double/noisy messages |
| Financial details in group replies | Sensitive data should use DM/private routing if added later |

---

## 4. Current Architecture

```text
WhatsApp group message
        │
        ▼
OpenClaw / Mikey
- receives inbound WhatsApp metadata
- decides whether to respond
- classifies intent
- extracts actor, target names, mentions, or self-service intent
- resolves ambiguity when needed
- calls typed IRBA assistant API
- formats Hebrew group/DM reply
        │
        ▼
IRBA production API: POST /api/assistant/v1
- verifies Bearer token
- enforces `assistant_allowed_groups`
- resolves `actor_phone` to Player/admin/member/guest
- checks operation permission
- validates params
- executes deterministic handler
- stores idempotency/request log
- writes AuditLog for mutations
        │
        ▼
Structured `{ ok, data, error }` response
        │
        ▼
Mikey replies in WhatsApp
```

### Responsibility Split

| Concern | Owner |
|---|---|
| Raw WhatsApp inbound handling | OpenClaw |
| Natural-language parsing | Mikey / OpenClaw skill |
| Mention/name/LID handling | Mikey / OpenClaw skill |
| Ambiguity and clarification UX | Mikey |
| Hebrew reply formatting | Mikey |
| Group vs DM routing | Mikey |
| API authentication | IRBA |
| Group allowlist | IRBA |
| Actor/permission model | IRBA |
| Business logic and DB writes | IRBA |
| Idempotency and audit trail | IRBA |

---

## 5. Production API Contract

Endpoint:

```http
POST https://irba.club/api/assistant/v1
Content-Type: application/json
Authorization: Bearer <ASSISTANT_API_SECRET>
```

Request envelope:

```jsonc
{
  "operation": "next_session",
  "actor_phone": "0507666550",
  "group_jid": "120363409761679942@g.us",
  "idempotency_key": "uuid-v4",
  "params": {}
}
```

Success response:

```jsonc
{
  "ok": true,
  "data": {},
  "error": null,
  "idempotent_replay": false
}
```

Error response:

```jsonc
{
  "ok": false,
  "data": null,
  "error": {
    "code": "FORBIDDEN_OPERATION",
    "message": "Actor cannot access this operation",
    "detail": null
  },
  "idempotent_replay": false
}
```

---

## 6. Implemented Operations

### 6.1 Public/read-only operations

| Operation | Access | Purpose | Status |
|---|---|---|---|
| `help` | guest/member/admin | List operations available to actor | Live |
| `next_session` | guest/member/admin | Next session time/location/counts | Live |
| `session_status` | guest/member/admin | Roster/status/counts/waitlist | Live |

### 6.2 Admin roster operations

| Operation | Access | Purpose | Status |
|---|---|---|---|
| `player_lookup` | admin | Resolve name/nickname/phone query to known player(s) | Live |
| `session_roster_add` | admin | Add known player to next upcoming session | Live |
| `session_roster_remove` | admin | Remove known player from next upcoming session | Live |

### 6.3 Self-service RSVP operations

| Operation | Access | Purpose | Status |
|---|---|---|---|
| `player_register_add` | known member/admin | Actor registers themself | Live |
| `player_register_cancel` | known member/admin | Actor cancels themself when allowed | Live |
| `player_register_status` | known member/admin | Actor checks own RSVP status | Live |

---

## 7. Completed Work and Evidence

### Phase 0 — Infrastructure

Complete and production-smoked on 2026-05-22.

Delivered:

- `POST /api/assistant/v1` route.
- Bearer token auth via `ASSISTANT_API_SECRET`.
- AppConfig group allowlist via `assistant_allowed_groups`.
- Actor resolution from `actor_phone`.
- Permission model.
- `AssistantRequestLog` with idempotency.
- Prune support through existing audit pruning flow.
- `help` skeleton operation.

Evidence:

- Commit: `eb048a3 feat(assistant): add OpenClaw integration infrastructure`.
- Production smoke covered valid help, replay, unauthenticated request, forbidden group, and unknown operation.

### Phase 1 — Read-only MVP

Complete and production-smoked on 2026-05-22.

Delivered:

- `help`
- `next_session`
- `session_status`
- OpenClaw helper at `/root/.openclaw/workspace/bin/irba-assistant-api`.
- Mikey can answer next-session/status/count questions from production data.

Evidence:

- Commits: `63d6d96 feat(assistant): add read-only session operations`, `fd2f245 docs: mark assistant phase 1 complete`.
- Production smoke passed for `help`, `next_session`, `session_status`, idempotency replay, validation error, and forbidden group.

### Phase 2 — Admin roster mutations

Complete, deployed, and QA-smoked.

Delivered:

- `session_roster_add`
- `session_roster_remove`
- Admin-only permission enforcement.
- Audit logging for mutations.
- Waitlist promotion semantics through existing attendance sorting.
- Clear errors: `FORBIDDEN_OPERATION`, `PLAYER_NOT_FOUND`, `ALREADY_REGISTERED`, `NOT_REGISTERED`, `SESSION_CLOSED`, etc.

Evidence:

- Commit: `df8aaea feat: add assistant roster mutations`.
- Production deploy succeeded.
- OpenClaw QA covered add/remove flows against an upcoming session.

### Phase 2.1 — Human-friendly roster commands

Complete enough for operational use; specific edge QA remains tracked below.

Delivered:

- `player_lookup` production API operation.
- Local OpenClaw skill at `/root/.openclaw/skills/irba-assistant/`.
- Natural admin commands such as:
  - `תוסיף את פוגל`
  - `תוסיף את אדיר ויקיר`
  - `תסיר את @player`
- Safe all-or-clarify behavior for natural-name mutations.
- Conservative mention handling:
  - phone/JID mentions resolve directly;
  - LID/internal IDs resolve only if OpenClaw has a local LID→phone mapping;
  - unresolved LIDs do not mutate.

Evidence:

- Commit: `7c1f5dd feat: add assistant player lookup`.
- Skill files created under `/root/.openclaw/skills/irba-assistant/`.
- QA passed for Hebrew multi-target parsing, dry-run lookup, phone/JID mention resolution, LID mapping, safe refusal for unmapped LID, duplicate add, status reply, and selected real group roster flows.

Deferred QA still worth doing later:

- Live mention QA in the final/real production WhatsApp group if its LID/JID behavior differs from IRBA Coding.
- Ambiguous-name QA against real data.
- Unknown-name QA against real data.
- Not-registered remove edge case against an open session.

### Phase 3 — Self-service RSVP

Complete, deployed, and live WhatsApp QA passed on 2026-05-23.

Delivered:

- `player_register_add`
- `player_register_cancel`
- `player_register_status`
- `CANCEL_WINDOW_CLOSED` for clear cancellation-window failures.
- Known members/admins can self-register/cancel/status.
- Guests are denied.
- Confirmed players cannot cancel inside the close window.
- Waitlisted players can cancel inside the close window.
- No extra server-side WhatsApp roster broadcast; Mikey replies once in the group.

Evidence:

- Commit: `b2d2433 Add assistant self-service RSVP operations`.
- Build-image workflow succeeded.
- Deploy workflow succeeded.
- Production health verified: `status ok`, DB up, WA up, version `b2d2433`.
- Production `help` exposes `player_register_add`, `player_register_cancel`, `player_register_status`.
- Live IRBA Coding QA with Avi covered:
  - duplicate self-register → `ALREADY_REGISTERED`, Mikey replied “already registered”;
  - self-status + next session details;
  - self-cancel removed Avi from the upcoming session;
  - self-register re-added Avi successfully.

---

## 8. Current OpenClaw Skill State

Production OpenClaw uses the `irba-assistant` skill:

```text
/root/.openclaw/skills/irba-assistant/
  SKILL.md
  scripts/irba_roster_command.py
  references/COMMANDS.md
```

The skill currently handles:

- Read-only questions through the low-level helper.
- Admin natural roster commands through parse → lookup → mutation.
- Self-service RSVP commands directly through `player_register_*` operations.
- Mention safety and LID handling.

Operational rule:

- For direct API questions, use `/root/.openclaw/workspace/bin/irba-assistant-api`.
- For natural admin roster add/remove commands, use `/root/.openclaw/skills/irba-assistant/scripts/irba_roster_command.py` unless the task is a clearly self-service `אותי` command.
- Never mutate based on ambiguous names or unresolved LIDs.

---

## 9. Remaining Work to Finish the Full Integration

The remaining work should be treated as planned follow-up, not as blockers for the core RSVP/roster integration.

### 9.1 Documentation cleanup and status alignment — recommended next

Purpose: make the repo tell the truth so future work does not drift.

Tasks:

- Update phase docs to clearly say complete/deployed/QA status.
- Keep `docs/plans/README.md` as an index of phase status.
- Update `PROJECT_STATE.md` assistant/API section if it still reflects older status.
- Ensure operation names are consistently documented in the current underscore format:
  - `session_status`, not `session.roster.status`
  - `session_roster_add`, not `session.roster.add`
  - `player_register_add`, not `player.register.add`

Acceptance:

- A new contributor can read this master plan plus `docs/plans/README.md` and understand exactly what exists and what remains.

### 9.2 Production-group rollout QA

Purpose: verify behavior in the real intended WhatsApp environment, especially mentions.

Tasks:

- Test mention add/remove in the final production IRBA group, not only IRBA Coding.
- Test ambiguous-name and unknown-name paths with real roster data.
- Test not-registered remove path.
- Confirm reply threading/quoting behavior is good enough in the group.

Acceptance:

- Mention resolution is either proven or clearly documented as “name/phone fallback required”.
- No unsafe mutation occurs from unresolved mentions.

### 9.3 Mikey UX polish / command help

Purpose: make the assistant feel reliable and discoverable, not like a raw API wrapper.

Tasks:

- Add/standardize concise Hebrew reply templates for all success/error cases.
- Add a group-safe “מה אפשר לבקש ממני?” response.
- Add consistent replies for:
  - no upcoming session;
  - already registered;
  - not registered;
  - close-window cancellation blocked;
  - waitlist position;
  - ambiguous player lookup;
  - unresolved mention.
- Keep replies short and avoid noisy duplicate broadcasts.

Acceptance:

- Common user/admin questions get consistent replies without manual improvisation.

### 9.4 Sensitive financial operations — optional but originally part of broader vision

Original master-plan candidates included balance/payment operations. These were intentionally deferred from the first RSVP/roster rollout.

Possible operations:

| Operation | Access | Routing policy |
|---|---|---|
| `player_balance_get` | self, admin | DM/private for self; admin-only for others |
| `player_payments_list` | self, admin | DM/private always |
| `payment_add` | admin only | requires explicit confirmation before mutation |

Before implementation, decide:

1. Do we still want financial data in the OpenClaw integration?
2. Should financial replies ever appear in a group? Recommended: no.
3. Does Mikey have reliable private-DM routing for every requesting member?
4. Should `payment_add` require a confirmation step every time? Recommended: yes.

Acceptance:

- No financial operation ships without a written plan and Avi approval.
- Sensitive replies are routed privately.

### 9.5 Security hardening

Not required for current trusted deployment, but worthwhile before broader expansion.

Candidates:

- HMAC request signing over raw body in addition to Bearer token.
- Secret rotation runbook.
- Assistant API rate limiting per actor/group/operation.
- Admin UI or CLI for assistant request logs.
- More structured observability around failed assistant calls.

Acceptance:

- A compromised/replayed request is harder to abuse.
- Debugging assistant failures does not require digging through raw logs.

### 9.6 Notification / automation alignment — IRBA-native, not new OpenClaw work

Earlier versions of this plan treated proactive automation as possible future OpenClaw work. That is misleading: IRBA already owns the notification and scheduling layer.

Existing IRBA capabilities include:

- Auto-create session cron.
- Auto-close session cron.
- Low-attendance alerts with early/critical tiers and config toggles.
- Session open/close/cancelled WhatsApp notifications.
- Player registered/cancelled WhatsApp notifications.
- Waitlist promotion private DM.
- Manual roster broadcast.
- Manual debtors broadcast with optional WhatsApp tagging.
- Competition winner notification.
- Audit/assistant request log pruning.

Remaining work here is alignment, not feature implementation:

- Verify production config values for the relevant notification toggles.
- Verify EC2 cron is calling the expected endpoints.
- Update runbook/docs if cron examples are stale.
- Document which notifications are group broadcasts vs private DMs.
- Confirm assistant-driven OpenClaw replies do not duplicate IRBA-native broadcasts.

Acceptance:

- Automation ownership is clear: IRBA schedules and sends configured notifications; Mikey/OpenClaw only responds to user requests and calls typed API operations.
- No duplicate/noisy WhatsApp behavior remains unexplained.

---

## 10. Recommended Next Step

Do **not** start another feature phase immediately.

Recommended immediate next step:

1. Finish documentation cleanup in this PR/commit:
   - master plan updated;
   - `docs/plans/README.md` added/updated;
   - phase status headers aligned;
   - `PROJECT_STATE.md` checked.
2. Then choose between:
   - production-group rollout QA; or
   - Mikey UX/help polish.

My recommendation after this cleanup: **production-group rollout QA first**, because it validates the riskiest remaining integration surface — WhatsApp mention identity — before we add more capability.

---

## 11. Rollback / Disable Strategy

If assistant behavior becomes unsafe or noisy:

1. Disable at IRBA level by clearing/removing the target group from `assistant_allowed_groups`.
2. Or disable at OpenClaw level by avoiding the `irba-assistant` skill/command path.
3. For bad code deploys, roll back to the previous GHCR image SHA using the runbook.
4. Because operations are additive, older read-only/admin flows should remain unaffected by disabling self-service skill handling.

Rollback reference: `RUNBOOK.md` → Deploy / Rollback.

---

## 12. Final Acceptance for “Full Integration Complete”

The integration can be considered fully complete when:

- [x] Assistant API infrastructure is deployed and logged.
- [x] Read-only session/status operations work from OpenClaw.
- [x] Admin roster mutations work through typed API.
- [x] Natural name/mention admin commands are operational with safe ambiguity handling.
- [x] Self-service RSVP works for known members.
- [x] Production health and API smoke checks pass after deploys.
- [x] Live QA covers self-register/status/cancel/re-register.
- [ ] Final production-group mention QA is complete or documented as name/phone-only fallback.
- [ ] Ambiguous/unknown/not-registered edge paths are QA-smoked in group context.
- [ ] User-facing Hebrew reply templates are consistent enough for normal group use.
- [ ] Existing IRBA-native notifications/automations are documented, config/cron status is verified, and assistant replies do not duplicate broadcasts.
- [ ] Sensitive operations, if added, are private-routed and separately approved.

---

*End of master plan.*
