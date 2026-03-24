"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionSubject } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { parsePlayerForm } from "@/lib/player-validation";

export type PlayerActionState = { ok: boolean; message?: string };

const GENERIC_ERROR = "אירעה שגיאה. נסה שוב מאוחר יותר.";

async function requireAdmin(): Promise<void> {
  const subject = await getAdminSessionSubject();
  if (!subject) redirect("/admin/login");
}

export async function createPlayerAction(
  _prev: PlayerActionState,
  formData: FormData,
): Promise<PlayerActionState> {
  await requireAdmin();

  const raw: Record<string, string | string[] | undefined> = {
    name: formData.get("name")?.toString(),
    phone: formData.get("phone")?.toString(),
    playerKind: formData.get("playerKind")?.toString(),
    positions: formData.getAll("positions").map((v) => v.toString()),
    rank: formData.get("rank")?.toString(),
    balance: formData.get("balance")?.toString(),
    isAdmin: formData.get("isAdmin")?.toString(),
    nickname: formData.get("nickname")?.toString(),
    firstNameHe: formData.get("firstNameHe")?.toString(),
    lastNameHe: formData.get("lastNameHe")?.toString(),
    firstNameEn: formData.get("firstNameEn")?.toString(),
    lastNameEn: formData.get("lastNameEn")?.toString(),
    birthdate: formData.get("birthdate")?.toString(),
  };

  const validation = parsePlayerForm(raw);
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const { name, phoneNormalized, playerKind, positions, rank, balance, isAdmin,
    nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, birthdate } =
    validation.data;

  try {
    await prisma.player.create({
      data: { name, phone: phoneNormalized, playerKind, positions, rank, balance, isAdmin,
        nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, birthdate },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, message: "מספר הטלפון כבר קיים במערכת" };
    }
    console.error("createPlayerAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  revalidatePath("/admin/players");
  redirect("/admin/players");
}

export async function updatePlayerAction(
  id: string,
  _prev: PlayerActionState,
  formData: FormData,
): Promise<PlayerActionState> {
  await requireAdmin();

  const raw: Record<string, string | string[] | undefined> = {
    name: formData.get("name")?.toString(),
    // phone is identity — pass through to satisfy Zod but server ignores it on update
    phone: formData.get("phone")?.toString(),
    playerKind: formData.get("playerKind")?.toString(),
    positions: formData.getAll("positions").map((v) => v.toString()),
    rank: formData.get("rank")?.toString(),
    balance: formData.get("balance")?.toString(),
    isAdmin: formData.get("isAdmin")?.toString(),
    nickname: formData.get("nickname")?.toString(),
    firstNameHe: formData.get("firstNameHe")?.toString(),
    lastNameHe: formData.get("lastNameHe")?.toString(),
    firstNameEn: formData.get("firstNameEn")?.toString(),
    lastNameEn: formData.get("lastNameEn")?.toString(),
    birthdate: formData.get("birthdate")?.toString(),
  };

  const validation = parsePlayerForm(raw);
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const { name, playerKind, positions, rank, balance, isAdmin,
    nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, birthdate } = validation.data;

  try {
    await prisma.player.update({
      where: { id },
      // Intentionally omit phone — phone is the player's identity and cannot be changed here
      data: { name, playerKind, positions, rank, balance, isAdmin,
        nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, birthdate },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return { ok: false, message: "שחקן לא נמצא" };
    }
    console.error("updatePlayerAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  revalidatePath("/admin/players");
  redirect("/admin/players");
}

export async function deletePlayerAction(
  id: string,
  _prev: PlayerActionState,
  _formData: FormData,
): Promise<PlayerActionState> {
  await requireAdmin();

  const count = await prisma.attendance.count({ where: { playerId: id } });
  if (count > 0) {
    return {
      ok: false,
      message: `לא ניתן למחוק שחקן שהשתתף ב-${count} מפגשים`,
    };
  }

  try {
    await prisma.player.delete({ where: { id } });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      // Already deleted — treat as success
    } else {
      console.error("deletePlayerAction failed", e);
      return { ok: false, message: GENERIC_ERROR };
    }
  }

  revalidatePath("/admin/players");
  return { ok: true, message: "השחקן נמחק" };
}
