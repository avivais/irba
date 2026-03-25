"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionSubject } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { Position } from "@prisma/client";

async function requireAdmin(): Promise<void> {
  const subject = await getAdminSessionSubject();
  if (!subject) redirect("/admin/login");
}

export type ImportPlayerRow = {
  nickname: string;
  firstNameHe: string | null;
  lastNameHe: string | null;
  firstNameEn: string | null;
  lastNameEn: string | null;
  phone: string | null;
  birthdate: string | null; // ISO string
  playerKind: "REGISTERED" | "DROP_IN";
  positions: string[];
};

export type ConflictItem = {
  rowIndex: number;
  message: string;
};

export type ImportResult = {
  imported: number;
  errors: string[];
};

export async function importPlayersAction(
  rows: ImportPlayerRow[],
): Promise<ImportResult> {
  await requireAdmin();

  let imported = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const birthdate = row.birthdate ? new Date(row.birthdate) : null;

      // Derive display name
      const name =
        row.firstNameHe && row.lastNameHe
          ? `${row.firstNameHe} ${row.lastNameHe}`
          : row.firstNameEn && row.lastNameEn
            ? `${row.firstNameEn} ${row.lastNameEn}`
            : row.nickname;

      if (row.phone) {
        // Upsert by phone
        await prisma.player.upsert({
          where: { phone: row.phone },
          update: {
            nickname: row.nickname,
            firstNameHe: row.firstNameHe,
            lastNameHe: row.lastNameHe,
            firstNameEn: row.firstNameEn,
            lastNameEn: row.lastNameEn,
            birthdate,
            playerKind: row.playerKind,
            positions: { set: row.positions as Position[] },
          },
          create: {
            name,
            phone: row.phone,
            nickname: row.nickname,
            firstNameHe: row.firstNameHe,
            lastNameHe: row.lastNameHe,
            firstNameEn: row.firstNameEn,
            lastNameEn: row.lastNameEn,
            birthdate,
            playerKind: row.playerKind,
            positions: { set: row.positions as Position[] },
          },
        });
      } else {
        // Find by nickname
        const existing = await prisma.player.findFirst({
          where: { nickname: row.nickname },
        });
        if (existing) {
          await prisma.player.update({
            where: { id: existing.id },
            data: {
              firstNameHe: row.firstNameHe,
              lastNameHe: row.lastNameHe,
              firstNameEn: row.firstNameEn,
              lastNameEn: row.lastNameEn,
              birthdate,
              playerKind: row.playerKind,
              positions: { set: row.positions as Position[] },
            },
          });
        } else {
          errors.push(`שחקן עם כינוי "${row.nickname}" לא נמצא ואין טלפון ליצירה`);
          continue;
        }
      }
      imported++;
    } catch (e) {
      console.error("importPlayersAction row error", e);
      errors.push(`שגיאה בשורת "${row.nickname}"`);
    }
  }

  revalidatePath("/admin/players");
  return { imported, errors };
}

export async function checkPlayerConflictsAction(
  rows: Array<{ nickname: string; phone: string | null }>,
): Promise<ConflictItem[]> {
  await requireAdmin();

  const phones = rows.map((r) => r.phone).filter(Boolean) as string[];
  const nicknames = rows.map((r) => r.nickname);

  const [byPhone, byNickname] = await Promise.all([
    phones.length > 0
      ? prisma.player.findMany({ where: { phone: { in: phones } }, select: { phone: true, nickname: true } })
      : [],
    prisma.player.findMany({ where: { nickname: { in: nicknames } }, select: { nickname: true } }),
  ]);

  const phoneSet = new Set(byPhone.map((p) => p.phone));
  const nicknameSet = new Set(byNickname.map((p) => p.nickname));

  const conflicts: ConflictItem[] = [];
  for (let i = 0; i < rows.length; i++) {
    const parts: string[] = [];
    if (rows[i].phone && phoneSet.has(rows[i].phone!)) parts.push(`טלפון קיים: ${rows[i].phone}`);
    if (nicknameSet.has(rows[i].nickname)) parts.push(`nickname קיים: ${rows[i].nickname}`);
    if (parts.length > 0) conflicts.push({ rowIndex: i, message: parts.join(" | ") });
  }
  return conflicts;
}
