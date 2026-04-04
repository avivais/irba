"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import type { ImportResult } from "../players/actions";
import { writeAuditLog } from "@/lib/audit";

export type ImportAggregateRow = {
  nickname: string;
  year: number;
  count: number;
};

export async function importAggregatesAction(
  rows: ImportAggregateRow[],
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
      await prisma.playerYearAggregate.upsert({
        where: { playerId_year: { playerId, year: row.year } },
        update: { count: row.count },
        create: { playerId, year: row.year, count: row.count },
      });
      imported++;
    } catch (e) {
      console.error("importAggregatesAction row error", e);
      errors.push(`שגיאה בשורת "${row.nickname}" שנה ${row.year}`);
    }
  }

  writeAuditLog({
    actor: "admin",
    action: "IMPORT_AGGREGATES",
    entityType: "PlayerYearAggregate",
    after: { imported, errorCount: errors.length, total: rows.length },
  });

  revalidatePath("/admin/precedence");
  return { imported, errors };
}
