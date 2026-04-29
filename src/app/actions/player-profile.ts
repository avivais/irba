"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getPlayerSessionPlayerId } from "@/lib/player-session";
import { writeAuditLog } from "@/lib/audit";
import {
  parseProfileForm,
  type ProfileFieldErrors,
} from "@/lib/player-validation";

export type ProfileActionState = {
  ok: boolean;
  errors?: ProfileFieldErrors;
  message?: string;
};

export async function updatePlayerProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const playerId = await getPlayerSessionPlayerId();
  if (!playerId) redirect("/");

  const raw: Record<string, string | undefined> = {
    nickname: (formData.get("nickname") as string | null) ?? undefined,
    firstNameHe: (formData.get("firstNameHe") as string | null) ?? undefined,
    lastNameHe: (formData.get("lastNameHe") as string | null) ?? undefined,
    firstNameEn: (formData.get("firstNameEn") as string | null) ?? undefined,
    lastNameEn: (formData.get("lastNameEn") as string | null) ?? undefined,
    birthdate: (formData.get("birthdate") as string | null) ?? undefined,
    email: (formData.get("email") as string | null) ?? undefined,
    nationalId: (formData.get("nationalId") as string | null) ?? undefined,
  };

  const validation = parseProfileForm(raw);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const { nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, birthdate, email, nationalId } =
    validation.data;

  const before = await prisma.player.findUnique({
    where: { id: playerId },
    select: { nickname: true, firstNameHe: true, lastNameHe: true, firstNameEn: true, lastNameEn: true, birthdate: true, email: true, nationalId: true },
  });

  await prisma.player.update({
    where: { id: playerId },
    data: { nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, birthdate, email, nationalId },
  });

  writeAuditLog({
    actor: playerId,
    action: "PLAYER_PROFILE_UPDATED",
    entityType: "Player",
    entityId: playerId,
    before,
    after: { nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, birthdate, email, nationalId },
  });

  return { ok: true };
}

export async function completeProfileDetailsAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const playerId = await getPlayerSessionPlayerId();
  if (!playerId) redirect("/");

  const raw: Record<string, string | undefined> = {
    nickname: (formData.get("nickname") as string | null) ?? undefined,
    firstNameHe: (formData.get("firstNameHe") as string | null) ?? undefined,
    lastNameHe: (formData.get("lastNameHe") as string | null) ?? undefined,
    firstNameEn: (formData.get("firstNameEn") as string | null) ?? undefined,
    lastNameEn: (formData.get("lastNameEn") as string | null) ?? undefined,
    birthdate: (formData.get("birthdate") as string | null) ?? undefined,
    email: (formData.get("email") as string | null) ?? undefined,
    nationalId: (formData.get("nationalId") as string | null) ?? undefined,
  };

  const validation = parseProfileForm(raw);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const { nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, birthdate, email, nationalId } =
    validation.data;

  const before = await prisma.player.findUnique({
    where: { id: playerId },
    select: { nickname: true, firstNameHe: true, lastNameHe: true, firstNameEn: true, lastNameEn: true, birthdate: true, email: true, nationalId: true },
  });

  await prisma.player.update({
    where: { id: playerId },
    data: { nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, birthdate, email, nationalId },
  });

  writeAuditLog({
    actor: playerId,
    action: "PLAYER_PROFILE_COMPLETED",
    entityType: "Player",
    entityId: playerId,
    before,
    after: { nickname, firstNameHe, lastNameHe, firstNameEn, lastNameEn, birthdate, email, nationalId },
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
