"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionSubject } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { normalizePhone, PhoneValidationError } from "@/lib/phone";
import { getPlayerDisplayName } from "@/lib/player-display";
import { computePromoteTimestamp } from "@/lib/waitlist";
import { sendWaMessage } from "@/lib/wa-notify";

export type SessionAttendanceState = { ok: boolean; message?: string };

async function requireAdmin(): Promise<void> {
  const subject = await getAdminSessionSubject();
  if (!subject) redirect("/admin/login");
}

export async function addPlayerAction(
  sessionId: string,
  _prev: SessionAttendanceState,
  formData: FormData,
): Promise<SessionAttendanceState> {
  await requireAdmin();

  const playerId = formData.get("playerId")?.toString().trim() ?? "";
  if (!playerId) return { ok: false, message: "נא לבחור שחקן" };

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) return { ok: false, message: "מפגש לא נמצא" };

  try {
    await prisma.attendance.create({ data: { playerId, gameSessionId: sessionId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: "השחקן כבר רשום למפגש זה" };
    }
    throw e;
  }

  revalidatePath(`/admin/sessions/${sessionId}`);
  revalidatePath("/");
  return { ok: true, message: "השחקן נוסף" };
}

export async function quickAddDropInAction(
  sessionId: string,
  _prev: SessionAttendanceState,
  formData: FormData,
): Promise<SessionAttendanceState> {
  await requireAdmin();

  const name = formData.get("name")?.toString().trim() ?? "";
  const rawPhone = formData.get("phone")?.toString().trim() ?? "";
  if (!rawPhone) return { ok: false, message: "נא להזין טלפון" };

  let phone: string;
  try {
    phone = normalizePhone(rawPhone);
  } catch (e) {
    if (e instanceof PhoneValidationError) {
      return { ok: false, message: "מספר טלפון לא תקין (05XXXXXXXX)" };
    }
    throw e;
  }

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) return { ok: false, message: "מפגש לא נמצא" };

  const existing = await prisma.player.findUnique({ where: { phone }, select: { id: true } });
  if (!existing && !name) return { ok: false, message: "נא להזין שם" };
  const playerId = existing
    ? existing.id
    : (await prisma.player.create({ data: { phone, firstNameHe: name, playerKind: "DROP_IN" }, select: { id: true } })).id;

  const alreadyRegistered = await prisma.attendance.findFirst({
    where: { playerId, gameSessionId: sessionId },
    select: { id: true },
  });
  if (alreadyRegistered) return { ok: false, message: "השחקן כבר רשום למפגש זה" };

  await prisma.attendance.create({ data: { playerId, gameSessionId: sessionId } });

  revalidatePath(`/admin/sessions/${sessionId}`);
  revalidatePath("/");
  return { ok: true, message: "המזדמן נוסף" };
}

export type PhoneLookupResult =
  | { status: "new" }
  | { status: "existing_not_registered"; displayName: string }
  | { status: "already_registered"; displayName: string };

export async function lookupPlayerByPhoneAction(
  sessionId: string,
  rawPhone: string,
): Promise<PhoneLookupResult> {
  await requireAdmin();

  let phone: string;
  try {
    phone = normalizePhone(rawPhone);
  } catch {
    return { status: "new" };
  }

  const player = await prisma.player.findUnique({
    where: { phone },
    select: { id: true, firstNameHe: true, lastNameHe: true, firstNameEn: true, lastNameEn: true, nickname: true },
  });
  if (!player) return { status: "new" };

  const displayName = getPlayerDisplayName(player);

  const attending = await prisma.attendance.findFirst({
    where: { playerId: player.id, gameSessionId: sessionId },
    select: { id: true },
  });

  return attending
    ? { status: "already_registered", displayName }
    : { status: "existing_not_registered", displayName };
}

export async function promoteWaitlistAction(
  sessionId: string,
  attendanceId: string,
  _prev: SessionAttendanceState,
  _formData: FormData,
): Promise<SessionAttendanceState> {
  await requireAdmin();

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      maxPlayers: true,
      attendances: { orderBy: { createdAt: "asc" }, select: { id: true, createdAt: true } },
    },
  });
  if (!session) return { ok: false, message: "מפגש לא נמצא" };

  const newTimestamp = computePromoteTimestamp(session.attendances, session.maxPlayers, attendanceId);
  if (newTimestamp === null) {
    return { ok: false, message: "השחקן כבר ברשימת המשתתפים" };
  }

  const [attendance] = await Promise.all([
    prisma.attendance.update({
      where: { id: attendanceId },
      data: { createdAt: newTimestamp },
      select: { player: { select: { phone: true } }, gameSession: { select: { date: true } } },
    }),
  ]);

  revalidatePath(`/admin/sessions/${sessionId}`);
  revalidatePath("/");

  // Notify promoted player (best-effort)
  const dateStr = attendance.gameSession.date.toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  void sendWaMessage(attendance.player.phone, `עברת מרשימת ההמתנה לרשימת המשתתפים במפגש ${dateStr}!`);

  return { ok: true, message: "השחקן קודם בהצלחה" };
}

export async function removePlayerAction(
  sessionId: string,
  attendanceId: string,
  _prev: SessionAttendanceState,
  _formData: FormData,
): Promise<SessionAttendanceState> {
  await requireAdmin();

  try {
    await prisma.attendance.delete({ where: { id: attendanceId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      // already gone
    } else throw e;
  }

  revalidatePath(`/admin/sessions/${sessionId}`);
  revalidatePath("/");
  return { ok: true };
}
