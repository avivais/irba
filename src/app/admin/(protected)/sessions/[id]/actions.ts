"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionSubject } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { normalizePhone, PhoneValidationError } from "@/lib/phone";

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
  if (!name) return { ok: false, message: "נא להזין שם" };
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

  try {
    const player = await prisma.player.upsert({
      where: { phone },
      update: { firstNameHe: name },
      create: { phone, firstNameHe: name, playerKind: "DROP_IN" },
    });
    await prisma.attendance.create({
      data: { playerId: player.id, gameSessionId: sessionId },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: "השחקן כבר רשום למפגש זה" };
    }
    throw e;
  }

  revalidatePath(`/admin/sessions/${sessionId}`);
  revalidatePath("/");
  return { ok: true, message: "המזדמן נוסף" };
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
