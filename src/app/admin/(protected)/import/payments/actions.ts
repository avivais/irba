"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionSubject } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import type { ImportResult } from "../players/actions";

async function requireAdmin(): Promise<void> {
  const subject = await getAdminSessionSubject();
  if (!subject) redirect("/admin/login");
}

export type ImportPaymentRow = {
  nickname: string;
  date: string; // ISO string
  amount: number;
};

export async function importPaymentsAction(
  rows: ImportPaymentRow[],
): Promise<ImportResult> {
  await requireAdmin();

  let imported = 0;
  const errors: string[] = [];

  // Batch-resolve nicknames
  const nicknames = [...new Set(rows.map((r) => r.nickname))];
  const players = await prisma.player.findMany({
    where: { nickname: { in: nicknames } },
    select: { id: true, nickname: true },
  });
  const nicknameToId = new Map(players.map((p) => [p.nickname!, p.id]));

  for (const row of rows) {
    const playerId = nicknameToId.get(row.nickname);
    if (!playerId) {
      errors.push(`כינוי לא נמצא: "${row.nickname}"`);
      continue;
    }

    try {
      await prisma.payment.create({
        data: { playerId, date: new Date(row.date), amount: row.amount },
      });
      imported++;
    } catch (e) {
      console.error("importPaymentsAction row error", e);
      errors.push(`שגיאה בשורת "${row.nickname}" תאריך ${row.date}`);
    }
  }

  revalidatePath("/admin/players");
  return { imported, errors };
}
