# OpenClaw ↔ IRBA Completion Plan

Status: Draft for Avi review  
Scope: close gaps in the existing integration before starting brand-new feature phases.

## Principle

Do not add new IRBA product features in this pass.

This plan is for alignment, QA, UX consistency, documentation, and safe rollout of the OpenClaw ↔ IRBA assistant integration that already exists.

IRBA remains the deterministic source of truth for sessions, RSVP, roster, notifications, finance, audit, and cron behavior. Mikey/OpenClaw remains responsible for WhatsApp/NLP/reply wording and calls IRBA only through typed assistant API operations.

## Current baseline

Already implemented and deployed:

- Phase 0: assistant API infrastructure, auth, allowlist, idempotency/logging.
- Phase 1: read-only operations: `help`, `next_session`, `session_status`.
- Phase 2: admin roster mutations: `session_roster_add`, `session_roster_remove`.
- Phase 2.1: natural admin roster commands through OpenClaw skill and `player_lookup`.
- Phase 3: self-service RSVP: `player_register_add`, `player_register_cancel`, `player_register_status`.

Already present in IRBA and not to be rebuilt in OpenClaw:

- Auto-create session cron.
- Auto-close session cron.
- Low-attendance alerts with early/critical tiers and config toggles.
- Session open/close/cancelled WhatsApp notifications.
- Player registered/cancelled WhatsApp notifications.
- Waitlist promotion DM notification.
- Manual roster broadcast.
- Manual debtors broadcast with optional WhatsApp tagging.
- Competition winner notification.
- Audit/assistant request log pruning.

## Workstream A — Documentation truth pass

Goal: make the repo accurately describe what is live, what is IRBA-native, and what remains.

Tasks:

- Update the master plan so automation is described as existing IRBA-native functionality, not a missing OpenClaw feature.
- Update `docs/plans/README.md` to point at this completion plan.
- Update `docs/FEATURES.md` assistant section if it still lists only Phase 1 operations.
- Update `docs/OPERATIONS.md` if production cron setup text is stale, especially auto-close/low-attendance scheduling.
- Ensure operation names are consistently underscore-style:
  - `session_status`
  - `session_roster_add`
  - `session_roster_remove`
  - `player_lookup`
  - `player_register_add`
  - `player_register_cancel`
  - `player_register_status`

Acceptance:

- A new contributor can tell that core assistant integration is live through Phase 3.
- Existing IRBA automations are not misrepresented as future OpenClaw work.

## Workstream B — Production-group rollout QA

Goal: validate the riskiest real-world surface: WhatsApp identity, mentions, and safe mutations in the final IRBA group.

Tasks:

- Test admin add/remove by explicit Hebrew/English names.
- Test admin add/remove by WhatsApp mention where possible.
- Test unresolved LID mention behavior: must block and ask for name/phone, not mutate.
- Test ambiguous name behavior: must clarify, not mutate.
- Test unknown player behavior.
- Test removing a player who is not registered.
- Test self-service flows in group:
  - register me;
  - cancel me;
  - my status;
  - duplicate register;
  - cancellation blocked inside close window for confirmed players.
- Confirm only one group-visible reply per request from Mikey/OpenClaw.
- Confirm IRBA-native notification toggles do not create noisy duplicate broadcasts during assistant-driven QA.

Acceptance:

- No unsafe mutation occurs from unresolved identity.
- Mention behavior is either proven or documented as requiring name/phone fallback.
- Duplicate/noisy broadcasts are understood and controlled by config.

## Workstream C — Mikey UX/help polish

Goal: make normal group usage consistent without changing IRBA business logic.

Tasks:

- Add/standardize concise Hebrew reply templates inside the OpenClaw skill/helper layer for common results:
  - no upcoming session;
  - already registered;
  - registered confirmed;
  - registered waitlisted;
  - not registered;
  - cancelled;
  - cancellation blocked by close window;
  - session closed;
  - waitlist promoted after removal;
  - ambiguous player lookup;
  - unknown player;
  - unresolved mention;
  - unauthorized/non-admin mutation.
- Add a group-safe “מה אפשר לבקש ממני?” help response based on live `help` operations.
- Keep OpenClaw replies short and avoid exposing raw API JSON/errors.
- Keep IRBA notification broadcasts separate from Mikey’s direct reply; do not have Mikey duplicate IRBA broadcasts.

Acceptance:

- Common requests get predictable Hebrew answers.
- Mikey still calls typed IRBA operations only; no business logic is moved into OpenClaw.

## Workstream D — Notification/automation alignment QA

Goal: verify existing IRBA automations and document their interaction with assistant requests.

This is not a new automation feature phase.

Tasks:

- Confirm production config values for:
  - `session_schedule_enabled`
  - `session_auto_create_hours_before`
  - `alert_low_attendance_enabled`
  - `alert_early_enabled`
  - `alert_critical_enabled`
  - `wa_notify_session_open_enabled`
  - `wa_notify_session_close_enabled`
  - `wa_notify_player_registered_enabled`
  - `wa_notify_player_cancelled_enabled`
  - `wa_notify_waitlist_promote_enabled`
  - `wa_notify_session_roster_enabled`
  - `wa_notify_debtors_enabled`
- Confirm EC2 cron actually calls the intended endpoints:
  - `/api/cron/auto-create`
  - `/api/cron/auto-close`
  - `/api/cron/prune-audit`
- If `auto-close` is expected every minute, ensure the runbook cron example includes it.
- Smoke-test low-attendance alert behavior in a controlled/staging-safe way or document why not tested live.
- Document which notifications are group broadcasts vs private DM.

Acceptance:

- Automation ownership is clear: IRBA schedules/sends its own configured notifications.
- OpenClaw assistant flows do not accidentally double-announce what IRBA already broadcasts.

## Workstream E — Security/ops hardening triage

Goal: decide what is needed now versus later.

Current implemented security/ops baseline:

- Bearer token auth via `ASSISTANT_API_SECRET`.
- AppConfig group allowlist via `assistant_allowed_groups`.
- Actor phone resolution and admin enforcement.
- Idempotency via `AssistantRequestLog`.
- Sanitized result snapshots.
- Retention pruning via cron.
- Domain mutation audit logs for roster/self-RSVP operations.

Candidate follow-ups, not required to close current core rollout:

- HMAC request signing over raw body.
- Rate limiting per actor/group/operation.
- Secret rotation runbook.
- Admin UI/CLI for assistant request logs.
- More structured assistant failure observability.

Acceptance:

- Decide explicitly: do now, defer, or reject.
- No hardening item blocks production-group QA unless Avi marks it as required.

## Workstream F — Sensitive finance assistant operations decision

Goal: decide whether finance belongs in the OpenClaw assistant at all.

No implementation in this completion pass unless a separate approved plan is created.

Candidate operations from the broader vision:

- `player_balance_get`
- `player_payments_list`
- `payment_add`

Decision points:

- Should financial data ever be returned through WhatsApp group context? Recommended: no.
- Can Mikey reliably DM the requesting player privately?
- Should admin `payment_add` require explicit confirmation? Recommended: yes.
- Should finance remain IRBA-admin-only for now? Recommended default: yes.

Acceptance:

- A written decision exists before any finance assistant implementation starts.

## Recommended execution order

1. Documentation truth pass.
2. Production-group rollout QA.
3. Mikey UX/help polish.
4. Notification/automation alignment QA.
5. Security/ops hardening triage.
6. Finance assistant decision.

## Final acceptance for closing the existing integration

- Master plan and phase index reflect production reality.
- Production-group mention/name/admin/self-service QA is complete or limitations are documented.
- Mikey replies are consistent enough for normal Hebrew group use.
- Existing IRBA automations are documented as existing and their config/cron status is verified.
- No duplicate/noisy WhatsApp behavior remains unexplained.
- Any finance/security expansion is explicitly deferred or separately approved.
