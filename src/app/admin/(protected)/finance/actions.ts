"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { getAllConfigs } from "@/lib/config";
import { computePlayerBalances } from "@/lib/balance";
import { getPlayerDisplayName } from "@/lib/player-display";
import { notifyDebtors } from "@/lib/wa-notify";

export type FinanceActionState = { ok: boolean; message?: string };

export async function broadcastDebtorsAction(): Promise<FinanceActionState> {
  await requireAdmin();

  const players = await prisma.player.findMany({
    where: { isAdmin: false },
    select: {
      id: true,
      nickname: true,
      firstNameHe: true,
      lastNameHe: true,
      firstNameEn: true,
      lastNameEn: true,
      phone: true,
    },
  });

  const balances = await computePlayerBalances(players.map((p) => p.id));

  const debtors = players
    .map((p) => ({ player: p, balance: balances.get(p.id)?.balance ?? 0 }))
    .filter((r) => r.balance < 0)
    .sort((a, b) => a.balance - b.balance);

  if (debtors.length === 0) {
    return { ok: false, message: "אין שחקנים בחוב" };
  }

  const debtorEntries = debtors.map((r) => ({
    name: getPlayerDisplayName(r.player),
    phone: r.player.phone,
    amount: Math.abs(r.balance),
  }));

  const configs = await getAllConfigs();
  await notifyDebtors(debtorEntries, configs);

  await prisma.auditLog.create({
    data: {
      actor: "admin",
      action: "BROADCAST_DEBTORS",
      after: {
        count: debtors.length,
        totalDebt: debtors.reduce((s, r) => s + r.balance, 0),
      },
    },
  });

  revalidatePath("/admin/finance");

  return { ok: true, message: `נשלחה הודעה על ${debtors.length} חייבים` };
}
