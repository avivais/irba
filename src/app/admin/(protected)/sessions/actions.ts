"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionSubject } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { parseSessionForm } from "@/lib/session-validation";

export type SessionActionState = { ok: boolean; message?: string };

const GENERIC_ERROR = "אירעה שגיאה. נסה שוב מאוחר יותר.";

async function requireAdmin(): Promise<void> {
  const subject = await getAdminSessionSubject();
  if (!subject) redirect("/admin/login");
}

export async function createSessionAction(
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  await requireAdmin();

  const raw: Record<string, string | undefined> = {
    date: formData.get("date")?.toString(),
    maxPlayers: formData.get("maxPlayers")?.toString(),
    isClosed: formData.get("isClosed")?.toString(),
  };

  const validation = parseSessionForm(raw);
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const { date, maxPlayers } = validation.data;

  try {
    await prisma.gameSession.create({
      data: { date, maxPlayers, isClosed: false },
    });
  } catch (e) {
    console.error("createSessionAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  revalidatePath("/admin/sessions");
  redirect("/admin/sessions");
}

export async function updateSessionAction(
  id: string,
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  await requireAdmin();

  const raw: Record<string, string | undefined> = {
    date: formData.get("date")?.toString(),
    maxPlayers: formData.get("maxPlayers")?.toString(),
    isClosed: formData.get("isClosed")?.toString(),
  };

  const validation = parseSessionForm(raw);
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const { date, maxPlayers, isClosed } = validation.data;

  try {
    await prisma.gameSession.update({
      where: { id },
      data: { date, maxPlayers, isClosed },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return { ok: false, message: "מפגש לא נמצא" };
    }
    console.error("updateSessionAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  revalidatePath("/admin/sessions");
  redirect("/admin/sessions");
}

export async function deleteSessionAction(
  id: string,
  _prev: SessionActionState,
  _formData: FormData,
): Promise<SessionActionState> {
  await requireAdmin();

  const count = await prisma.attendance.count({ where: { gameSessionId: id } });
  if (count > 0) {
    return {
      ok: false,
      message: `לא ניתן למחוק מפגש עם ${count} נרשמים`,
    };
  }

  try {
    await prisma.gameSession.delete({ where: { id } });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      // Already deleted — treat as success
    } else {
      console.error("deleteSessionAction failed", e);
      return { ok: false, message: GENERIC_ERROR };
    }
  }

  revalidatePath("/admin/sessions");
  return { ok: true, message: "המפגש נמחק" };
}

export async function toggleSessionAction(
  id: string,
  _prev: SessionActionState,
  _formData: FormData,
): Promise<SessionActionState> {
  await requireAdmin();

  const session = await prisma.gameSession.findUnique({
    where: { id },
    select: { isClosed: true },
  });

  if (!session) {
    return { ok: false, message: "מפגש לא נמצא" };
  }

  const newClosed = !session.isClosed;

  try {
    await prisma.gameSession.update({
      where: { id },
      data: { isClosed: newClosed },
    });
  } catch (e) {
    console.error("toggleSessionAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  revalidatePath("/admin/sessions");
  revalidatePath("/");
  return { ok: true, message: newClosed ? "המפגש נסגר" : "המפגש נפתח" };
}
