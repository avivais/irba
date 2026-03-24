"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionSubject } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { parseAdjustmentForm } from "@/lib/adjustment-validation";

export type PrecedenceActionState = { ok: boolean; message?: string };

const GENERIC_ERROR = "אירעה שגיאה. נסה שוב מאוחר יותר.";

async function requireAdmin(): Promise<void> {
  const subject = await getAdminSessionSubject();
  if (!subject) redirect("/admin/login");
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

export async function upsertAggregateAction(
  playerId: string,
  _prev: PrecedenceActionState,
  formData: FormData,
): Promise<PrecedenceActionState> {
  await requireAdmin();

  const yearStr = formData.get("year")?.toString()?.trim() ?? "";
  const countStr = formData.get("count")?.toString()?.trim() ?? "";

  if (!yearStr || !/^\d+$/.test(yearStr)) {
    return { ok: false, message: "נא להזין שנה תקינה" };
  }
  const year = parseInt(yearStr, 10);
  const currentYear = new Date().getFullYear();

  if (year >= currentYear) {
    return {
      ok: false,
      message: "לא ניתן להוסיף נתונים לשנה הנוכחית (נספרת אוטומטית)",
    };
  }
  if (year < 2000 || year > 2100) {
    return { ok: false, message: "השנה חייבת להיות בין 2000 ל-2100" };
  }

  if (!countStr || !/^\d+$/.test(countStr)) {
    return {
      ok: false,
      message: "נא להזין מספר נוכחויות תקין (אפס או יותר)",
    };
  }
  const count = parseInt(countStr, 10);

  try {
    await prisma.playerYearAggregate.upsert({
      where: { playerId_year: { playerId, year } },
      create: { playerId, year, count },
      update: { count },
    });
  } catch (e) {
    console.error("upsertAggregateAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  revalidatePath("/admin/precedence");
  revalidatePath(`/admin/precedence/${playerId}`);
  return { ok: true };
}

export async function deleteAggregateAction(
  playerId: string,
  year: number,
  _prev: PrecedenceActionState,
  _formData: FormData,
): Promise<PrecedenceActionState> {
  await requireAdmin();

  try {
    await prisma.playerYearAggregate.delete({
      where: { playerId_year: { playerId, year } },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      // already deleted
    } else {
      console.error("deleteAggregateAction failed", e);
      return { ok: false, message: GENERIC_ERROR };
    }
  }

  revalidatePath("/admin/precedence");
  revalidatePath(`/admin/precedence/${playerId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Adjustments
// ---------------------------------------------------------------------------

export async function createAdjustmentAction(
  playerId: string,
  _prev: PrecedenceActionState,
  formData: FormData,
): Promise<PrecedenceActionState> {
  await requireAdmin();

  const validation = parseAdjustmentForm({
    date: formData.get("date")?.toString(),
    points: formData.get("points")?.toString(),
    description: formData.get("description")?.toString(),
  });
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const { date, points, description } = validation.data;

  try {
    await prisma.playerAdjustment.create({
      data: { playerId, date, points, description },
    });
  } catch (e) {
    console.error("createAdjustmentAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  revalidatePath("/admin/precedence");
  revalidatePath(`/admin/precedence/${playerId}`);
  redirect(`/admin/precedence/${playerId}`);
}

export async function updateAdjustmentAction(
  playerId: string,
  adjId: string,
  _prev: PrecedenceActionState,
  formData: FormData,
): Promise<PrecedenceActionState> {
  await requireAdmin();

  const validation = parseAdjustmentForm({
    date: formData.get("date")?.toString(),
    points: formData.get("points")?.toString(),
    description: formData.get("description")?.toString(),
  });
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const { date, points, description } = validation.data;

  try {
    await prisma.playerAdjustment.update({
      where: { id: adjId },
      data: { date, points, description },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return { ok: false, message: "התאמה לא נמצאה" };
    }
    console.error("updateAdjustmentAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  revalidatePath("/admin/precedence");
  revalidatePath(`/admin/precedence/${playerId}`);
  redirect(`/admin/precedence/${playerId}`);
}

export async function deleteAdjustmentAction(
  playerId: string,
  adjId: string,
  _prev: PrecedenceActionState,
  _formData: FormData,
): Promise<PrecedenceActionState> {
  await requireAdmin();

  try {
    await prisma.playerAdjustment.delete({ where: { id: adjId } });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      // already deleted
    } else {
      console.error("deleteAdjustmentAction failed", e);
      return { ok: false, message: GENERIC_ERROR };
    }
  }

  revalidatePath("/admin/precedence");
  revalidatePath(`/admin/precedence/${playerId}`);
  return { ok: true };
}
