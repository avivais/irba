"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { getAllConfigs } from "@/lib/config";
import { CONFIG } from "@/lib/config-keys";
import { proposeSessionCharges } from "@/lib/charging";
import { computePlayerBalances } from "@/lib/balance";

export type ChargeActionState = { ok: boolean; message?: string };

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

  const balances = await computePlayerBalances(playerIds);

  const proposal = proposeSessionCharges({
    hourlyRate,
    durationMinutes: session.durationMinutes,
    minPlayers,
    debtThreshold,
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
    },
  });

  revalidatePath(`/admin/sessions/${sessionId}`);
  return { ok: true, message: "המפגש חויב בהצלחה" };
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
        data: { amount: newAmount },
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
