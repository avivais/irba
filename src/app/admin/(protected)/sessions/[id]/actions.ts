"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionSubject } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

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
