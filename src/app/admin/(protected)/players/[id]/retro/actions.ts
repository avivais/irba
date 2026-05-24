"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { getAllConfigs } from "@/lib/config";
import { CONFIG } from "@/lib/config-keys";
import { proposeSessionCharges, type ChargeType, type PlayerKind } from "@/lib/charging";
import { computePlayerBalance, computePlayerBalances } from "@/lib/balance";
import { getPlayerDisplayName } from "@/lib/player-display";

const GENERIC_ERROR = "אירעה שגיאה. נסה שוב מאוחר יותר.";

export type RetroChargeChange = {
  chargeId: string;
  playerId: string;
  playerName: string;
  isFocalPlayer: boolean;
  oldAmount: number;
  newAmount: number;
  oldChargeType: ChargeType;
  newChargeType: ChargeType;
};

export type RetroSessionEntry = {
  sessionId: string;
  sessionDate: Date;
  changes: RetroChargeChange[];
  skipped?: "admin_override_present";
};

export type RetroDebtComponent = {
  chargeId: string;
  sessionId: string;
  sessionDate: Date;
  amount: number;
  includedAmount: number;
  chargeType: ChargeType | "FREE_ENTRY";
};

export type RetroBalanceImpact = {
  playerId: string;
  playerName: string;
  isFocalPlayer: boolean;
  chargeDiff: number;
  balanceDiff: number;
  currentBalance: number;
  projectedBalance: number;
};

export type RetroPreview = {
  affectedSessions: RetroSessionEntry[];
  skippedSessions: { sessionId: string; sessionDate: Date; reason: "admin_override_present" }[];
  totals: { focalDiff: number; othersDiff: number; residual: number };
  currentBalance: number;
  projectedBalance: number;
  amountToPayNow: number;
  unchangedDebtComponents: RetroDebtComponent[];
  balanceImpacts: RetroBalanceImpact[];
  streakCount: number;
};

export type RetroPreviewState =
  | { ok: true; preview: RetroPreview }
  | { ok: false; message: string };

export type RetroApplyState = { ok: boolean; message?: string };

async function getRateForDate(date: Date): Promise<number | null> {
  const rate = await prisma.hourlyRate.findFirst({
    where: { effectiveFrom: { lte: date } },
    orderBy: { effectiveFrom: "desc" },
    select: { pricePerHour: true },
  });
  return rate?.pricePerHour ?? null;
}

/**
 * Compute the retro-close-debt diff: find all historical DROP_IN charges for the
 * focal registered player, re-run proposeSessionCharges
 * for each affected session with the focal player flipped to not-in-debt, and
 * collect every changed charge across the session — both the focal player's and
 * the teammates whose discount-from-his-debt-surplus disappears.
 *
 * Sessions containing any ADMIN_OVERRIDE charge are skipped entirely.
 */
async function computeRetroChanges(playerId: string): Promise<RetroPreview | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { playerKind: true },
  });
  if (!player || player.playerKind !== "REGISTERED") return null;

  const allCharges = await prisma.sessionCharge.findMany({
    where: { playerId },
    orderBy: { session: { date: "desc" } },
    select: {
      id: true,
      chargeType: true,
      amount: true,
      calculatedAmount: true,
      session: {
        select: { id: true, date: true, durationMinutes: true },
      },
    },
  });

  const streak = allCharges.filter((c) => c.chargeType === "DROP_IN");
  if (streak.length === 0) {
    const balance = (await computePlayerBalance(playerId)).balance;
    return {
      affectedSessions: [],
      skippedSessions: [],
      totals: { focalDiff: 0, othersDiff: 0, residual: 0 },
      currentBalance: balance,
      projectedBalance: balance,
      amountToPayNow: Math.max(-balance, 0),
      unchangedDebtComponents: [],
      balanceImpacts: [],
      streakCount: 0,
    };
  }

  const config = await getAllConfigs();
  const minPlayers = parseInt(config[CONFIG.SESSION_MIN_PLAYERS] ?? "10", 10);
  const debtThreshold = parseInt(config[CONFIG.DEBT_THRESHOLD] ?? "10", 10);

  const sessionIds = streak.map((s) => s.session.id);
  const allSessionCharges = await prisma.sessionCharge.findMany({
    where: { sessionId: { in: sessionIds } },
    select: {
      id: true,
      sessionId: true,
      playerId: true,
      amount: true,
      calculatedAmount: true,
      chargeType: true,
      player: {
        select: {
          id: true,
          playerKind: true,
          firstNameHe: true,
          lastNameHe: true,
          firstNameEn: true,
          lastNameEn: true,
          nickname: true,
          phone: true,
        },
      },
    },
  });

  const chargesBySessionId = new Map<string, typeof allSessionCharges>();
  for (const c of allSessionCharges) {
    const arr = chargesBySessionId.get(c.sessionId) ?? [];
    arr.push(c);
    chargesBySessionId.set(c.sessionId, arr);
  }

  const affectedSessions: RetroSessionEntry[] = [];
  const skippedSessions: RetroPreview["skippedSessions"] = [];
  let focalDiff = 0;
  let othersDiff = 0;

  // Process oldest-first so the audit log reads chronologically
  const orderedStreak = [...streak].reverse();

  for (const focalCharge of orderedStreak) {
    const sessionCharges = chargesBySessionId.get(focalCharge.session.id) ?? [];

    if (sessionCharges.some((c) => c.chargeType === "ADMIN_OVERRIDE")) {
      skippedSessions.push({
        sessionId: focalCharge.session.id,
        sessionDate: focalCharge.session.date,
        reason: "admin_override_present",
      });
      continue;
    }

    if (!focalCharge.session.durationMinutes) continue;
    const hourlyRate = await getRateForDate(focalCharge.session.date);
    if (!hourlyRate) continue;

    const billable = sessionCharges.filter((c) => c.chargeType !== "FREE_ENTRY");
    const freeEntryPlayerIds = sessionCharges
      .filter((c) => c.chargeType === "FREE_ENTRY")
      .map((c) => c.playerId);

    const players = billable.map((c) => ({
      playerId: c.playerId,
      playerKind: c.player.playerKind as PlayerKind,
      balance:
        c.playerId === playerId
          ? 0
          : c.chargeType === "DROP_IN" && c.player.playerKind === "REGISTERED"
            ? -1_000_000
            : 0,
    }));

    const proposal = proposeSessionCharges({
      hourlyRate,
      durationMinutes: focalCharge.session.durationMinutes,
      minPlayers,
      debtThreshold,
      players,
      freeEntryPlayerIds,
    });
    if (!proposal) continue;

    const proposedById = new Map(proposal.charges.map((c) => [c.playerId, c]));

    const sessionChanges: RetroChargeChange[] = [];
    for (const existing of sessionCharges) {
      if (existing.chargeType === "FREE_ENTRY") continue;
      const proposed = proposedById.get(existing.playerId);
      if (!proposed) continue;
      const adminDelta = existing.amount - existing.calculatedAmount;
      const newAmount = proposed.calculatedAmount + adminDelta;
      if (newAmount === existing.amount && proposed.chargeType === existing.chargeType) {
        continue;
      }
      const isFocal = existing.playerId === playerId;
      const diff = newAmount - existing.amount;
      if (isFocal) focalDiff += diff;
      else othersDiff += diff;
      sessionChanges.push({
        chargeId: existing.id,
        playerId: existing.playerId,
        playerName: getPlayerDisplayName(existing.player),
        isFocalPlayer: isFocal,
        oldAmount: existing.amount,
        newAmount,
        oldChargeType: existing.chargeType as ChargeType,
        newChargeType: proposed.chargeType,
      });
    }

    if (sessionChanges.length > 0) {
      affectedSessions.push({
        sessionId: focalCharge.session.id,
        sessionDate: focalCharge.session.date,
        changes: sessionChanges,
      });
    }
  }

  // Display newest-first in the modal
  affectedSessions.reverse();

  const currentBalance = (await computePlayerBalance(playerId)).balance;
  // focalDiff < 0 means his charge dropped → balance improves by |focalDiff|
  const projectedBalance = currentBalance - focalDiff;
  const amountToPayNow = Math.max(-projectedBalance, 0);
  const allChanges = affectedSessions.flatMap((s) => s.changes);
  const unchangedDebtComponents = buildUnchangedDebtComponents({
    allCharges,
    changedChargeIds: new Set(allChanges.filter((ch) => ch.isFocalPlayer).map((ch) => ch.chargeId)),
    amountToExplain: amountToPayNow,
  });
  const balanceImpacts = await buildBalanceImpacts(allChanges, playerId);

  return {
    affectedSessions,
    skippedSessions,
    totals: { focalDiff, othersDiff, residual: focalDiff + othersDiff },
    currentBalance,
    projectedBalance,
    amountToPayNow,
    unchangedDebtComponents,
    balanceImpacts,
    streakCount: streak.length,
  };
}

function buildUnchangedDebtComponents({
  allCharges,
  changedChargeIds,
  amountToExplain,
}: {
  allCharges: Array<{
    id: string;
    amount: number;
    chargeType: string;
    session: { id: string; date: Date };
  }>;
  changedChargeIds: Set<string>;
  amountToExplain: number;
}): RetroDebtComponent[] {
  if (amountToExplain <= 0) return [];

  const components: RetroDebtComponent[] = [];
  let remaining = amountToExplain;
  for (const charge of allCharges) {
    if (remaining <= 0) break;
    if (changedChargeIds.has(charge.id)) continue;
    if (charge.amount <= 0) continue;

    const includedAmount = Math.min(charge.amount, remaining);
    components.push({
      chargeId: charge.id,
      sessionId: charge.session.id,
      sessionDate: charge.session.date,
      amount: charge.amount,
      includedAmount,
      chargeType: charge.chargeType as ChargeType | "FREE_ENTRY",
    });
    remaining -= includedAmount;
  }
  return components;
}

async function buildBalanceImpacts(changes: RetroChargeChange[], focalPlayerId: string): Promise<RetroBalanceImpact[]> {
  const byPlayer = new Map<string, { playerName: string; isFocalPlayer: boolean; chargeDiff: number }>();
  for (const ch of changes) {
    const current = byPlayer.get(ch.playerId) ?? {
      playerName: ch.playerName,
      isFocalPlayer: ch.playerId === focalPlayerId,
      chargeDiff: 0,
    };
    current.chargeDiff += ch.newAmount - ch.oldAmount;
    byPlayer.set(ch.playerId, current);
  }

  const balances = await computePlayerBalances([...byPlayer.keys()]);
  return [...byPlayer.entries()]
    .map(([playerId, impact]) => {
      const currentBalance = balances.get(playerId)?.balance ?? 0;
      const balanceDiff = -impact.chargeDiff;
      return {
        playerId,
        playerName: impact.playerName,
        isFocalPlayer: impact.isFocalPlayer,
        chargeDiff: impact.chargeDiff,
        balanceDiff,
        currentBalance,
        projectedBalance: currentBalance + balanceDiff,
      };
    })
    .sort((a, b) => Number(b.isFocalPlayer) - Number(a.isFocalPlayer) || a.playerName.localeCompare(b.playerName, "he"));
}

export async function previewRetroCloseDebtAction(
  playerId: string,
): Promise<RetroPreviewState> {
  await requireAdmin();
  try {
    const preview = await computeRetroChanges(playerId);
    if (!preview) {
      return { ok: false, message: "השחקן אינו רשום כקבוע" };
    }
    return { ok: true, preview };
  } catch (e) {
    console.error("previewRetroCloseDebtAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }
}

export async function applyRetroCloseDebtAction(
  playerId: string,
): Promise<RetroApplyState> {
  await requireAdmin();
  try {
    const preview = await computeRetroChanges(playerId);
    if (!preview) return { ok: false, message: "השחקן אינו רשום כקבוע" };
    const allChanges = preview.affectedSessions.flatMap((s) => s.changes);
    if (allChanges.length === 0) return { ok: true, message: "אין שינויים" };

    await prisma.$transaction([
      ...allChanges.map((ch) =>
        prisma.sessionCharge.update({
          where: { id: ch.chargeId },
          data: {
            amount: ch.newAmount,
            calculatedAmount: ch.newAmount,
            chargeType: ch.newChargeType,
          },
        }),
      ),
      ...allChanges.map((ch) =>
        prisma.chargeAuditEntry.create({
          data: {
            sessionChargeId: ch.chargeId,
            changedBy: "admin",
            previousAmount: ch.oldAmount,
            newAmount: ch.newAmount,
            reason: "retro_close_debt",
          },
        }),
      ),
    ]);

    writeAuditLog({
      actor: "admin",
      action: "RETRO_CLOSE_DEBT",
      entityType: "Player",
      entityId: playerId,
      after: {
        affectedSessionCount: preview.affectedSessions.length,
        changedChargeCount: allChanges.length,
        focalDiff: preview.totals.focalDiff,
        othersDiff: preview.totals.othersDiff,
        skippedCount: preview.skippedSessions.length,
      },
    });

    revalidatePath(`/admin/players/${playerId}/edit`);
    for (const s of preview.affectedSessions) {
      revalidatePath(`/admin/sessions/${s.sessionId}`);
    }
    revalidatePath("/admin/finance");

    return { ok: true, message: `עודכנו ${allChanges.length} חיובים ב-${preview.affectedSessions.length} מפגשים` };
  } catch (e) {
    console.error("applyRetroCloseDebtAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }
}
