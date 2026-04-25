"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { getAllConfigs } from "@/lib/config";
import { CONFIG } from "@/lib/config-keys";
import { proposeSessionCharges, computeSingleCharge } from "@/lib/charging";
import { computePlayerBalances } from "@/lib/balance";
import { computeLeaderboard } from "@/lib/challenge-analytics";
import { getPlayerDisplayName } from "@/lib/player-display";
import { notifyCompetitionWinner } from "@/lib/wa-notify";

export type CompetitionResult = {
  winnerName: string;
  roundNumber: number;
};

export type ChargeActionState = {
  ok: boolean;
  message?: string;
  /** Set when charging this session closed an active competition. */
  competitionResult?: CompetitionResult;
};

const GENERIC_ERROR = "אירעה שגיאה. נסה שוב מאוחר יותר.";

/** Find the hourly rate in effect on a given date. */
async function getRateForDate(date: Date): Promise<number | null> {
  const rate = await prisma.hourlyRate.findFirst({
    where: { effectiveFrom: { lte: date } },
    orderBy: { effectiveFrom: "desc" },
    select: { pricePerHour: true },
  });
  return rate?.pricePerHour ?? null;
}

/**
 * After a session is charged, check if it was the last session in an active competition.
 * If so: compute winner, award free entry, close competition, send WA.
 */
async function checkCompetitionCompletion(
  chargedSessionId: string,
  configs: Record<string, string>,
): Promise<CompetitionResult | null> {
  // Find the one active, non-closed competition
  const challenge = await prisma.challenge.findFirst({
    where: { isClosed: false, isActive: true },
    select: {
      id: true,
      number: true,
      startDate: true,
      sessionCount: true,
      minMatchesPct: true,
    },
  });
  if (!challenge) return null;

  // Sessions from startDate, ordered by date asc, take first sessionCount
  const windowSessions = await prisma.gameSession.findMany({
    where: { date: { gte: challenge.startDate } },
    orderBy: { date: "asc" },
    take: challenge.sessionCount,
    select: { id: true, isCharged: true },
  });

  // The window must be fully populated — otherwise charging the only existing
  // session would close a 3-session competition after just session 1 (the
  // "last" session would simply be the only one created so far).
  if (windowSessions.length < challenge.sessionCount) return null;

  // Check if the charged session is the Nth session (last in window)
  const lastSession = windowSessions[windowSessions.length - 1];
  if (!lastSession || lastSession.id !== chargedSessionId) return null;

  // All sessions in window must now be charged
  const allCharged = windowSessions.every((s) => s.isCharged || s.id === chargedSessionId);
  if (!allCharged) return null;

  const windowSessionIds = windowSessions.map((s) => s.id);

  // Fetch matches in window
  const matches = await prisma.match.findMany({
    where: { sessionId: { in: windowSessionIds } },
    select: {
      id: true,
      sessionId: true,
      teamAPlayerIds: true,
      teamBPlayerIds: true,
      scoreA: true,
      scoreB: true,
      createdAt: true,
    },
  });

  // Fetch registered (non-drop-in) non-admin players for name resolution
  const players = await prisma.player.findMany({
    where: { isAdmin: false, playerKind: "REGISTERED" },
    select: {
      id: true,
      firstNameHe: true,
      lastNameHe: true,
      firstNameEn: true,
      lastNameEn: true,
      nickname: true,
      phone: true,
    },
  });

  const playerNames = new Map<string, string>(
    players.map((p) => [p.id, getPlayerDisplayName(p)]),
  );
  const registeredPlayerIds = new Set(players.map((p) => p.id));

  const { leaderboard } = computeLeaderboard({
    minMatchesPct: challenge.minMatchesPct,
    windowSessionIds,
    matches,
    playerNames,
    registeredPlayerIds,
  });

  const winner = leaderboard.find((e) => e.rank === 1) ?? null;

  // Close the competition
  await prisma.challenge.update({
    where: { id: challenge.id },
    data: {
      isClosed: true,
      isActive: false,
      winnerId: winner?.playerId ?? null,
    },
  });

  if (!winner) {
    writeAuditLog({
      actor: "system",
      action: "CLOSE_CHALLENGE",
      entityType: "Challenge",
      entityId: challenge.id,
      after: { number: challenge.number, winnerId: null, reason: "no_eligible_players" },
    });
    return null;
  }

  // Award free entry
  await prisma.freeEntry.create({
    data: {
      playerId: winner.playerId,
      challengeId: challenge.id,
    },
  });

  writeAuditLog({
    actor: "system",
    action: "CLOSE_CHALLENGE",
    entityType: "Challenge",
    entityId: challenge.id,
    after: { number: challenge.number, winnerId: winner.playerId, winnerName: winner.displayName },
  });

  // Send WA notification (best-effort)
  notifyCompetitionWinner(winner.displayName, challenge.number, configs as Parameters<typeof notifyCompetitionWinner>[2]).catch(() => {});

  revalidatePath("/challenges");
  revalidatePath("/admin/challenges");

  return { winnerName: winner.displayName, roundNumber: challenge.number };
}

export async function chargeSessionAction(
  sessionId: string,
): Promise<ChargeActionState> {
  await requireAdmin();

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: {
      attendances: {
        select: {
          playerId: true,
          player: { select: { playerKind: true } },
        },
      },
    },
  });
  if (!session) return { ok: false, message: "מפגש לא נמצא" };
  if (session.isCharged) return { ok: false, message: "המפגש כבר חויב" };

  if (!session.durationMinutes || session.durationMinutes <= 0) {
    return { ok: false, message: "לא ניתן לחייב: משך המפגש לא הוגדר" };
  }

  const hourlyRate = await getRateForDate(session.date);
  if (!hourlyRate) {
    return { ok: false, message: "לא ניתן לחייב: לא נמצא תעריף שעתי" };
  }

  const config = await getAllConfigs();
  const minPlayers = parseInt(config[CONFIG.SESSION_MIN_PLAYERS] ?? "10", 10);
  const debtThreshold = parseInt(config[CONFIG.DEBT_THRESHOLD] ?? "10", 10);

  const confirmedAttendances = session.attendances.slice(0, session.maxPlayers);
  const playerIds = confirmedAttendances.map((a) => a.playerId);

  if (playerIds.length < minPlayers) {
    return {
      ok: false,
      message: `לא ניתן לחייב: רק ${playerIds.length} משתתפים (מינימום ${minPlayers})`,
    };
  }

  // Check for unused free entries among confirmed attendees
  const unusedFreeEntries = await prisma.freeEntry.findMany({
    where: {
      playerId: { in: playerIds },
      usedAt: null,
    },
    select: { id: true, playerId: true },
  });
  const freeEntryPlayerIds = unusedFreeEntries.map((fe) => fe.playerId);

  const balances = await computePlayerBalances(playerIds);

  const proposal = proposeSessionCharges({
    hourlyRate,
    durationMinutes: session.durationMinutes,
    minPlayers,
    debtThreshold,
    freeEntryPlayerIds,
    players: confirmedAttendances.map((a) => ({
      playerId: a.playerId,
      playerKind: a.player.playerKind as "REGISTERED" | "DROP_IN",
      balance: balances.get(a.playerId)?.balance ?? 0,
    })),
  });

  if (!proposal) {
    return {
      ok: false,
      message: `לא ניתן לחייב: פחות מ-${minPlayers} משתתפים`,
    };
  }

  try {
    await prisma.$transaction([
      ...proposal.charges.map((c) =>
        prisma.sessionCharge.create({
          data: {
            sessionId,
            playerId: c.playerId,
            amount: c.calculatedAmount,
            calculatedAmount: c.calculatedAmount,
            chargeType: c.chargeType,
          },
        }),
      ),
      // Mark used free entries
      ...unusedFreeEntries.map((fe) =>
        prisma.freeEntry.update({
          where: { id: fe.id },
          data: { usedAt: new Date(), usedInSessionId: sessionId },
        }),
      ),
      prisma.gameSession.update({
        where: { id: sessionId },
        data: { isCharged: true },
      }),
    ]);
  } catch (e) {
    console.error("chargeSessionAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: "admin",
    action: "CHARGE_SESSION",
    entityType: "GameSession",
    entityId: sessionId,
    after: {
      hourlyRate,
      durationMinutes: session.durationMinutes,
      minPlayers,
      chargeCount: proposal.charges.length,
      registeredAmount: proposal.registeredAmount,
      dropInAmount: proposal.dropInAmount,
      freeEntryCount: freeEntryPlayerIds.length,
    },
  });

  // Check if this session completes an active competition
  const competitionResult = await checkCompetitionCompletion(sessionId, config);

  revalidatePath(`/admin/sessions/${sessionId}`);
  return { ok: true, message: "המפגש חויב בהצלחה", competitionResult: competitionResult ?? undefined };
}

export async function unchargeSessionAction(
  sessionId: string,
): Promise<ChargeActionState> {
  await requireAdmin();

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { isCharged: true },
  });
  if (!session) return { ok: false, message: "מפגש לא נמצא" };
  if (!session.isCharged) return { ok: false, message: "המפגש לא חויב" };

  try {
    await prisma.$transaction([
      // Unmark free entries used in this session
      prisma.freeEntry.updateMany({
        where: { usedInSessionId: sessionId },
        data: { usedAt: null, usedInSessionId: null },
      }),
      prisma.sessionCharge.deleteMany({ where: { sessionId } }),
      prisma.gameSession.update({
        where: { id: sessionId },
        data: { isCharged: false },
      }),
    ]);
  } catch (e) {
    console.error("unchargeSessionAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: "admin",
    action: "UNCHARGE_SESSION",
    entityType: "GameSession",
    entityId: sessionId,
  });

  revalidatePath(`/admin/sessions/${sessionId}`);
  return { ok: true, message: "החיוב בוטל" };
}

export async function updateSessionChargeAction(
  chargeId: string,
  sessionId: string,
  newAmount: number,
  reason: string,
): Promise<ChargeActionState> {
  await requireAdmin();

  const charge = await prisma.sessionCharge.findUnique({
    where: { id: chargeId },
    select: { amount: true, calculatedAmount: true, playerId: true },
  });
  if (!charge) return { ok: false, message: "חיוב לא נמצא" };

  if (!Number.isInteger(newAmount) || newAmount < 0) {
    return { ok: false, message: "סכום לא תקין" };
  }

  try {
    await prisma.$transaction([
      prisma.chargeAuditEntry.create({
        data: {
          sessionChargeId: chargeId,
          changedBy: "admin",
          previousAmount: charge.amount,
          newAmount,
          reason: reason || null,
        },
      }),
      prisma.sessionCharge.update({
        where: { id: chargeId },
        data: { amount: newAmount, chargeType: "ADMIN_OVERRIDE" },
      }),
    ]);
  } catch (e) {
    console.error("updateSessionChargeAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: "admin",
    action: "UPDATE_SESSION_CHARGE",
    entityType: "SessionCharge",
    entityId: chargeId,
    before: { amount: charge.amount },
    after: { amount: newAmount, reason },
  });

  revalidatePath(`/admin/sessions/${sessionId}`);
  return { ok: true };
}

// ─── Cascade recalculation ────────────────────────────────────────────────────

export type CascadeChange = {
  sessionId: string;
  sessionDate: Date;
  chargeId: string;
  playerId: string;
  playerName: string;
  oldAmount: number;
  newAmount: number;
  newCalculatedAmount: number;
  oldChargeType: string;
  newChargeType: string;
};

export type CascadePreviewState =
  | { ok: true; changes: CascadeChange[] }
  | { ok: false; message: string };

/**
 * Shared helper: compute cascade changes for all downstream sessions after fromSessionId.
 * Returns all charges that would change (amount or chargeType).
 */
async function computeCascadeChanges(fromSessionId: string): Promise<CascadeChange[]> {
  const fromSession = await prisma.gameSession.findUnique({
    where: { id: fromSessionId },
    select: { date: true },
  });
  if (!fromSession) return [];

  const config = await getAllConfigs();
  const minPlayers = parseInt(config[CONFIG.SESSION_MIN_PLAYERS] ?? "10", 10);
  const debtThreshold = parseInt(config[CONFIG.DEBT_THRESHOLD] ?? "10", 10);

  // Find all players who have a charge in this session
  const thisSessionCharges = await prisma.sessionCharge.findMany({
    where: { sessionId: fromSessionId },
    select: { playerId: true },
  });
  const affectedPlayerIds = thisSessionCharges.map((c) => c.playerId);
  if (affectedPlayerIds.length === 0) return [];

  // Find all charged sessions strictly after this one, that have at least one affected player
  const downstreamSessions = await prisma.gameSession.findMany({
    where: {
      isCharged: true,
      date: { gt: fromSession.date },
      sessionCharges: { some: { playerId: { in: affectedPlayerIds } } },
    },
    orderBy: { date: "asc" },
    select: {
      id: true,
      date: true,
      durationMinutes: true,
      maxPlayers: true,
      sessionCharges: {
        where: { playerId: { in: affectedPlayerIds } },
        select: {
          id: true,
          playerId: true,
          amount: true,
          calculatedAmount: true,
          chargeType: true,
          player: {
            select: {
              firstNameHe: true, lastNameHe: true,
              firstNameEn: true, lastNameEn: true,
              nickname: true, phone: true,
              playerKind: true,
            },
          },
        },
      },
    },
  });

  const changes: CascadeChange[] = [];

  for (const session of downstreamSessions) {
    const hourlyRate = await getRateForDate(session.date);
    if (!hourlyRate || !session.durationMinutes) continue;

    const chargePlayerIds = session.sessionCharges.map((c) => c.playerId);

    // Compute each player's balance strictly before this session (all payments + charges with session date < this session's date)
    const [paymentsAgg, chargesAgg] = await Promise.all([
      prisma.payment.groupBy({
        by: ["playerId"],
        where: { playerId: { in: chargePlayerIds } },
        _sum: { amount: true },
      }),
      prisma.sessionCharge.groupBy({
        by: ["playerId"],
        where: {
          playerId: { in: chargePlayerIds },
          session: { date: { lt: session.date } },
        },
        _sum: { amount: true },
      }),
    ]);

    const paidMap = new Map(paymentsAgg.map((r) => [r.playerId, r._sum.amount ?? 0]));
    const chargedMap = new Map(chargesAgg.map((r) => [r.playerId, r._sum.amount ?? 0]));

    const allPlayers = session.sessionCharges.map((c) => ({
      playerId: c.playerId,
      playerKind: c.player.playerKind as "REGISTERED" | "DROP_IN",
      balance: (paidMap.get(c.playerId) ?? 0) - (chargedMap.get(c.playerId) ?? 0),
    }));

    for (const charge of session.sessionCharges) {
      // Don't recalculate free entries — they stay at ₪0
      if (charge.chargeType === "FREE_ENTRY") continue;

      const balance = (paidMap.get(charge.playerId) ?? 0) - (chargedMap.get(charge.playerId) ?? 0);
      const { chargeType: newChargeType, calculatedAmount: newCalculatedAmount } = computeSingleCharge({
        hourlyRate,
        durationMinutes: session.durationMinutes,
        minPlayers,
        debtThreshold,
        playerKind: charge.player.playerKind as "REGISTERED" | "DROP_IN",
        balance,
        allPlayers,
      });

      const adminDelta = charge.amount - charge.calculatedAmount;
      const newAmount = newCalculatedAmount + adminDelta;

      if (newAmount !== charge.amount || newChargeType !== charge.chargeType) {
        changes.push({
          sessionId: session.id,
          sessionDate: session.date,
          chargeId: charge.id,
          playerId: charge.playerId,
          playerName: getPlayerDisplayName(charge.player),
          oldAmount: charge.amount,
          newAmount,
          newCalculatedAmount,
          oldChargeType: charge.chargeType,
          newChargeType,
        });
      }
    }
  }

  return changes;
}

export async function previewCascadeAction(
  fromSessionId: string,
): Promise<CascadePreviewState> {
  await requireAdmin();
  try {
    const changes = await computeCascadeChanges(fromSessionId);
    return { ok: true, changes };
  } catch (e) {
    console.error("previewCascadeAction failed", e);
    return { ok: false, message: "שגיאה בחישוב תצוגה מקדימה" };
  }
}

export async function applyCascadeAction(
  fromSessionId: string,
): Promise<ChargeActionState> {
  await requireAdmin();

  try {
    const changes = await computeCascadeChanges(fromSessionId);
    if (changes.length === 0) return { ok: true, message: "אין שינויים" };

    await prisma.$transaction([
      ...changes.map((ch) =>
        prisma.sessionCharge.update({
          where: { id: ch.chargeId },
          data: {
            amount: ch.newAmount,
            calculatedAmount: ch.newCalculatedAmount,
            chargeType: ch.newChargeType as "REGISTERED" | "DROP_IN" | "ADMIN_OVERRIDE" | "FREE_ENTRY",
          },
        }),
      ),
      ...changes.map((ch) =>
        prisma.chargeAuditEntry.create({
          data: {
            sessionChargeId: ch.chargeId,
            changedBy: "admin",
            previousAmount: ch.oldAmount,
            newAmount: ch.newAmount,
            reason: "cascade_recalc",
          },
        }),
      ),
    ]);

    writeAuditLog({
      actor: "admin",
      action: "CASCADE_RECALC",
      entityType: "GameSession",
      entityId: fromSessionId,
      after: { changedCount: changes.length },
    });

    // Revalidate all affected session pages
    const sessionIds = [...new Set(changes.map((c) => c.sessionId))];
    for (const sid of sessionIds) {
      revalidatePath(`/admin/sessions/${sid}`);
    }
    revalidatePath(`/admin/sessions/${fromSessionId}`);

    return { ok: true, message: `עודכנו ${changes.length} חיובים` };
  } catch (e) {
    console.error("applyCascadeAction failed", e);
    return { ok: false, message: "שגיאה בעדכון חיובים" };
  }
}
