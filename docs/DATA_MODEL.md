# IRBA Data Model Reference

This file preserves the detailed Prisma/data-model notes that used to live in `PROJECT_STATE.md`.

## Data model (Prisma)

- **`Player`**: `name`, unique `phone` (normalized Israeli mobile `05xxxxxxxx`), `playerKind` (`REGISTERED` | `DROP_IN`, UI labels **קבוע** / **מזדמן**), `positions` (`Position[]`, multi-value array, default `[]`), optional manual `rank`, `computedRank Float?` (blended 0–100 score, recalculated on rank/config/peer changes), `isAdmin`. Auth fields: `email`, `nationalId`, `passwordHash`, `otpCode`, `otpExpiresAt`, `emailVerified`, name components (`nickname`, `firstNameHe/En`, `lastNameHe/En`), `birthdate`. Regulations: `regulationsAcceptedAt`, `regulationsAcceptedVersion`. **No stored `balance`** — balance is always computed: `Σ(payments.amount) − Σ(sessionCharges.amount) − Σ(sharedExpenseCharges.amount)`.
- **`GameSession`**: `date`, `maxPlayers` (default 15), `isClosed`, `isCharged`, `isArchived`, `durationMinutes Int?` (null = use config default), `locationName/Lat/Lng`, alert flags `alertEarlyFiredAt` / `alertCriticalFiredAt`, cancellation `cancelledAt DateTime?` (null = active — acts as flag) + `cancellationReason String?`.
- **`Attendance`**: links player ↔ session; `createdAt` for RSVP order (confirmed = first `maxPlayers` by precedence-then-FIFO; rest = waitlist).
- **`AppConfig`**: `key` PK + `value` + `updatedAt`. Single source for all admin-editable settings.
- **`HourlyRate`**: `effectiveFrom Date` + `pricePerHour Float`. Newest row with `effectiveFrom ≤ today` is the active rate.
- **`Payment`**: `playerId`, `date`, `amount Int` (ILS, signed), `method PaymentMethod` (enum: `CASH | PAYBOX | BIT | BANK_TRANSFER | OTHER`, default `BIT`), `description?`, `sessionId?` (FK → `GameSession`, `onDelete: SetNull`, indexed — links admin auto-offset payments to their source session).
- **`SessionCharge`**: `sessionId`, `playerId`, `amount`, `calculatedAmount`, `chargeType` (`REGISTERED | DROP_IN | ADMIN_OVERRIDE | FREE_ENTRY`), unique on `(sessionId, playerId)`. Has `auditEntries ChargeAuditEntry[]`.
- **`ChargeAuditEntry`**: per-charge override audit (`changedBy`, `previousAmount`, `newAmount`, `reason?`, `changedAt`).
- **`SharedExpense`**: `title`, `totalAmount`, `lookbackYears`, `minAttendancePct`, `eligibilityPool` (enum `REGISTERED_ONLY | ALL_PLAYERS`), `createdBy`, `revertedAt?`. Children: `SharedExpenseCharge(playerId, amount, manuallyAdded)`.
- **`PeerRatingSession`**: `id`, `year @unique`, `openedAt`, `closedAt?`, `openedBy` (admin playerId).
- **`PeerRating`**: `ratingSessionId`, `raterId`, `ratedPlayerId`, `position Int` (1 = best), `submittedAt`. Unique on `(ratingSessionId, raterId, ratedPlayerId)`.
- **`Match`**: `sessionId`, `teamAPlayerIds String[]`, `teamBPlayerIds String[]`, `scoreA`, `scoreB`. Cascades on session delete; indexed on `(sessionId, createdAt)`.
- **`Challenge`**: `number @unique` (auto-sequenced), `startDate Date`, `sessionCount`, `minMatchesPct`, `isActive`, `isClosed`, `winnerId?`, `createdBy`. Relations: `winner Player?`, `freeEntry FreeEntry[]`. No leaderboard model — computed passively from Match data.
- **`FreeEntry`**: `playerId`, `challengeId`, `usedInSessionId?`, `usedAt?`. Created when a competition closes; consumed when winner attends next charged session.
- **`YearWeight`**: PK `year` → `weight Float`. Controls how much each past year counts in precedence.
- **`PlayerYearAggregate`**: `(playerId, year)` unique — historical attendance count for years before live tracking; not created for the current year (counted from live `Attendance` rows).
- **`PlayerAdjustment`**: `playerId`, `date`, `points` (Float, signed), `description`. Bonuses (+) and fines (−).
- **`AuditLog`**: append-only log of every mutation. `id Int PK`, `timestamp`, `actor` (`"admin"` | player phone | `"cron"`), `actorIp?`, `action` (constant string), `entityType?`, `entityId?`, `before Json?`, `after Json?`. Indexed on `timestamp DESC`, `action`, `(entityType, entityId)`, `actor`.
- **`AssistantRequestLog`**: idempotency/audit log for the OpenClaw assistant API. `id`, unique `idempotencyKey`, `operation`, `actorPhone`, `groupJid`, `resultCode`, sanitized `resultSnapshot`, `createdAt`; indexed on `createdAt`. Used by `POST /api/assistant/v1`, retained separately from `AuditLog` (default 7 days).
