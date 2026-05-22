# IRBA Decisions & Constraints

Durable decisions and constraints extracted from `PROJECT_STATE.md`.

## Decisions & Constraints

| Topic | Decision |
|--------|----------|
| **Player = User** | No separate User model. `Player` IS the user. Phone is the identity key. |
| **Admin auth** | Single `Player.isAdmin` flag — no separate admin login. Legacy `ADMIN_PASSWORD_HASH` files kept for reference but unused. |
| **First-login UX** | OTP verify drops the player straight on `/profile`; no forced password setup, no `set_name` step. The layout overlays (regulations + profile completion) collect anything that's still missing. Password is opt-in from `/profile`. |
| **Balance** | Always computed: `Σ(payments) − Σ(sessionCharges) − Σ(sharedExpenseCharges)`. Never stored. Opening balances handled via a payment record at import time. |
| **WhatsApp** | Baileys library, dedicated SIM. Used for OTP delivery + all notifications + group-broadcast roster + manual debt reminders + admin-forwarded test OTPs. |
| **Cascade recalc** | Editing any past `SessionCharge` triggers chronological re-evaluation of all subsequent sessions for all players (running balance at each session determines charge tier). |
| **Admin court cost** | Admin is auto-attended on every session and charged as a regular registered player; `chargeSessionAction` writes a matching `Payment` (`method: OTHER`, "קיזוז מנהל") so balance stays ~0. |
| **In-debt drop-in pricing** | A registered player below `−debt_threshold` is charged at the drop-in tariff. Their surplus is redistributed as a discount across normal-registered teammates in the same session. Retroactive / what-if work must reverse this end-to-end (focal player drops to registered AND every teammate loses their discount). |
| **Waitlist order** | Admin first, then REGISTERED by precedence score desc, then DROP_IN by `createdAt` asc. Promotion is manual. |
| **Cancellation tombstones** | Cancelled `GameSession` records remain in the DB with cleared attendance and act as same-day tombstones; auto-create won't recreate, charging is blocked, excluded from `getNextGame` / auto-close / alerts / challenge windows / `hasActiveSession`. |
| **Profile completion** | Required for both player kinds — REGISTERED need 5 fields (Hebrew first+last name, birthdate, nationalId, email); DROP_IN need only Hebrew first+last name. Enforced by the post-login `ProfileCompletionOverlay`. |
| **PWA** | Deferred indefinitely — app is fully server-dependent, offline adds no value. |
| **Results import (תוצאות sheet)** | Deferred. |
| **Municipality CSV export** | Deferred. |
| **Redis rate limits** | Single replica; in-memory per-process is fine for now. |

---
