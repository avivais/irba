"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { parsePlayerForm } from "@/lib/player-validation";
import { writeAuditLog } from "@/lib/audit";
import { recalculateAllComputedRanks } from "@/lib/computed-rank";

export type PlayerActionState = { ok: boolean; message?: string; savedInPlace?: boolean };

const GENERIC_ERROR = "אירעה שגיאה. נסה שוב מאוחר יותר.";

export async function createPlayerAction(
  _prev: PlayerActionState,
  formData: FormData,
): Promise<PlayerActionState> {
  await requireAdmin();

  const raw: Record<string, string | string[] | undefined> = {
    phone: formData.get("phone")?.toString(),
    playerKind: formData.get("playerKind")?.toString(),
    positions: formData.getAll("positions").map((v) => v.toString()),
    rank: formData.get("rank")?.toString(),
    isAdmin: formData.get("isAdmin")?.toString(),
    nickname: formData.get("nickname")?.toString(),
    firstNameHe: formData.get("firstNameHe")?.toString(),
    lastNameHe: formData.get("lastNameHe")?.toString(),
    firstNameEn: formData.get("firstNameEn")?.toString(),
    lastNameEn: formData.get("lastNameEn")?.toString(),
    birthdate: formData.get("birthdate")?.toString(),
    email: formData.get("email")?.toString(),
    nationalId: formData.get("nationalId")?.toString(),
  };

  const validation = parsePlayerForm(raw);
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const { phoneNormalized, playerKind, positions, rank, isAdmin,
    nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, birthdate, email, nationalId } =
    validation.data;

  let created: { id: string };
  try {
    created = await prisma.player.create({
      data: { phone: phoneNormalized, playerKind, positions, rank, isAdmin,
        nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, birthdate, email, nationalId },
      select: { id: true },
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

  writeAuditLog({
    actor: "admin",
    action: "CREATE_PLAYER",
    entityType: "Player",
    entityId: created.id,
    after: { phone: phoneNormalized, playerKind, positions, rank, isAdmin,
      nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, email, nationalId },
  });

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
    // phone is identity — pass through to satisfy Zod but server ignores it on update
    phone: formData.get("phone")?.toString(),
    playerKind: formData.get("playerKind")?.toString(),
    positions: formData.getAll("positions").map((v) => v.toString()),
    rank: formData.get("rank")?.toString(),
    isAdmin: formData.get("isAdmin")?.toString(),
    nickname: formData.get("nickname")?.toString(),
    firstNameHe: formData.get("firstNameHe")?.toString(),
    lastNameHe: formData.get("lastNameHe")?.toString(),
    firstNameEn: formData.get("firstNameEn")?.toString(),
    lastNameEn: formData.get("lastNameEn")?.toString(),
    birthdate: formData.get("birthdate")?.toString(),
    email: formData.get("email")?.toString(),
    nationalId: formData.get("nationalId")?.toString(),
  };

  const validation = parsePlayerForm(raw);
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const { playerKind, positions, rank, isAdmin,
    nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, birthdate, email, nationalId } = validation.data;

  const existing = await prisma.player.findUnique({
    where: { id },
    select: { playerKind: true, positions: true, rank: true, isAdmin: true,
      nickname: true, firstNameHe: true, lastNameHe: true, firstNameEn: true, lastNameEn: true,
      email: true, nationalId: true },
  });

  try {
    await prisma.player.update({
      where: { id },
      // Intentionally omit phone — phone is the player's identity and cannot be changed here
      data: { playerKind, positions, rank, isAdmin,
        nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, birthdate, email, nationalId },
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

  writeAuditLog({
    actor: "admin",
    action: "UPDATE_PLAYER",
    entityType: "Player",
    entityId: id,
    before: existing ? (existing as Record<string, unknown>) : null,
    after: { playerKind, positions, rank, isAdmin,
      nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, email, nationalId },
  });

  // Recalculate if the admin rank changed
  if (existing?.rank !== rank) {
    await recalculateAllComputedRanks("admin");
  }

  revalidatePath("/admin/players");
  const returnToList = formData.get("returnToList") !== "false";
  if (returnToList) {
    redirect("/admin/players");
  }
  return { ok: true, savedInPlace: true };
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

  const existing = await prisma.player.findUnique({
    where: { id },
    select: { phone: true, nickname: true, firstNameHe: true, lastNameHe: true, playerKind: true },
  });

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

  writeAuditLog({
    actor: "admin",
    action: "DELETE_PLAYER",
    entityType: "Player",
    entityId: id,
    before: existing ? (existing as Record<string, unknown>) : null,
  });

  revalidatePath("/admin/players");
  return { ok: true, message: "השחקן נמחק" };
}
