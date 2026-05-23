# OpenClaw ↔ IRBA Phase Plans

This directory contains execution plans for the OpenClaw ↔ IRBA integration.

For the current source-of-truth roadmap, start with:

- [`../OPENCLAW_IRBA_INTEGRATION_PLAN.md`](../OPENCLAW_IRBA_INTEGRATION_PLAN.md)

## Phase status

| Phase | File | Status | Notes |
|---|---|---|---|
| 0 | [`openclaw-irba-phase-0-infrastructure.md`](openclaw-irba-phase-0-infrastructure.md) | Complete | Assistant API foundation, auth, allowlist, actor resolution, idempotency/logging |
| 1 | [`openclaw-irba-phase-1-read-only-mvp.md`](openclaw-irba-phase-1-read-only-mvp.md) | Complete | `help`, `next_session`, `session_status` |
| 2 | [`openclaw-irba-phase-2-admin-mutations.md`](openclaw-irba-phase-2-admin-mutations.md) | Complete | Admin `session_roster_add` / `session_roster_remove` |
| 2.1 | [`openclaw-irba-phase-2-1-human-friendly-roster-commands.md`](openclaw-irba-phase-2-1-human-friendly-roster-commands.md) | Operational | Natural admin commands via `player_lookup` + OpenClaw skill; some edge QA remains |
| 3 | [`openclaw-irba-phase-3-self-service-rsvp.md`](openclaw-irba-phase-3-self-service-rsvp.md) | Complete | `player_register_add`, `player_register_cancel`, `player_register_status`; live QA passed |

## Remaining work tracked in the master plan

The remaining work is no longer basic API enablement. It is tracked in the master plan as:

1. Documentation cleanup/status alignment.
2. Production-group rollout QA, especially mention identity behavior.
3. Mikey UX/help/reply polish.
4. Optional sensitive financial operations, with private-routing requirements.
5. Optional security hardening.
6. Optional proactive automation, only with explicit approval and anti-noise controls.
