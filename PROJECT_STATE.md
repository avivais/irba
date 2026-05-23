# IRBA Manager — project state

Short resume document for quickly restarting work on IRBA. Detailed reference material lives under [`docs/`](./docs/).

## TL;DR

IRBA Manager is a self-hosted Hebrew/RTL web app for the Ilan Ramon Basketball Association, replacing the previous Google Sheets + WhatsApp workflow. It manages players, RSVP/waitlist, admin sessions, ranking/precedence, charges/payments, shared expenses, competitions, match results, WA notifications, and auditability.

Production: **https://irba.club**

## Production / runtime

- Repository: `https://github.com/avivais/irba`
- Production host: EC2 `t4g.large` / ARM / 8 GB RAM + 2 GB swap / 50 GB gp3 EBS
- Network path: Apache TLS → `localhost:3004` → Docker
- Package manager: **npm** (`package-lock.json`)
- CI: GitHub Actions runs lint, tests, and build on push / pull request to `main`

For deeper deployment/runtime notes, see [`docs/OPERATIONS.md`](./docs/OPERATIONS.md).

## Stack snapshot

- Next.js 16 App Router, React 19, Tailwind v4
- PostgreSQL + Prisma ORM 7 with `@prisma/adapter-pg`
- Signed HTTP-only JWT cookie auth via `jose`
- `Player` is the single identity/user model; admin is `Player.isAdmin`
- Vitest unit tests; no Postgres required for pure unit tests

Full stack/reference details: [`docs/OPERATIONS.md`](./docs/OPERATIONS.md).

## Current product areas

- Public RSVP flow with login/OTP, waitlist, cancellation rules, and attendance sorting
- Player/admin auth, profile completion, regulations acceptance gate
- Admin area: players, sessions, config, ranking, challenges, finance, audit, import, testing, WA admin
- Balanced team selection and match-result tracking
- Charging/payments, shared expenses, free-entry competition rewards
- WhatsApp sidecar and cron jobs for automation

Detailed feature reference: [`docs/FEATURES.md`](./docs/FEATURES.md).
Data model reference: [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md).

## Current state / working assumptions

- The app is production-oriented and already covers the core IRBA workflow end-to-end.
- The most important architectural invariant is the single identity model: `Player` is the user.
- Financial balances are computed from payments and charges; there is no stored `balance` field.
- Admin/runtime mutations should remain audited through `AuditLog` or purpose-specific request logs.
- WhatsApp-related work is operationally sensitive; prefer smoke tests and rollback notes before production changes.
- OpenClaw ↔ IRBA assistant integration is active in production through Phase 3: read-only operations, admin roster mutations, admin-only `player_lookup`, and self-service RSVP (`player_register_add`, `player_register_cancel`, `player_register_status`) are deployed. Natural roster/self-service commands are orchestrated by the local OpenClaw skill `/root/.openclaw/skills/irba-assistant/`. Live QA covered status, duplicate self-register, self-cancel, and re-register on 2026-05-23. Phase 4 Mikey UX/help polish is implemented locally in the OpenClaw skill with lightweight QA passed; live mutation QA remains deferred. Phase 5 finance assistant implementation is in progress locally: finance summary, self/admin balances, payment history, and confirmation-gated admin payment recording have targeted tests passing but are not deployed yet. Remaining assistant work is tracked in [`docs/OPENCLAW_IRBA_INTEGRATION_PLAN.md`](./docs/OPENCLAW_IRBA_INTEGRATION_PLAN.md) and [`docs/plans/openclaw-irba-completion-plan.md`](./docs/plans/openclaw-irba-completion-plan.md): production-group mention QA, notification/automation alignment QA for existing IRBA-native automations, hardening triage, and Phase 5 deploy/live QA.

## Next recommended steps

1. Keep this file short and update it only with resume-level state.
2. Put detailed implementation notes in the topic files under `docs/`.
3. Promote real upcoming work into issues/tasks instead of burying it in this state file.
4. When changing core flows, update the relevant reference doc and add/adjust the smallest meaningful test.

## Docs index

- [`README.md`](./README.md) — setup commands and general project entrypoint
- [`RUNBOOK.md`](./RUNBOOK.md) — operational runbook
- [`docs/DATA_MODEL.md`](./docs/DATA_MODEL.md) — Prisma/data model details
- [`docs/FEATURES.md`](./docs/FEATURES.md) — product/admin/user-facing feature reference
- [`docs/OPERATIONS.md`](./docs/OPERATIONS.md) — stack, runtime, WA sidecar, cron, deployment notes
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) — durable constraints and decisions
- [`docs/FUTURE_IDEAS.md`](./docs/FUTURE_IDEAS.md) — backlog-style ideas, not active commitments
- [`docs/OPENCLAW_IRBA_INTEGRATION_PLAN.md`](./docs/OPENCLAW_IRBA_INTEGRATION_PLAN.md) — assistant/API integration plan

## Maintenance rule

If a section grows beyond a short summary, move the detail to the relevant `docs/` file and link to it from here. This file should remain useful as a two-minute project resume, not become the archive again.
