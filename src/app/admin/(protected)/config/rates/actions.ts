"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionSubject } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export type RateActionState = { ok: boolean; message?: string };

async function requireAdmin(): Promise<void> {
  const subject = await getAdminSessionSubject();
  if (!subject) redirect("/admin/login");
}

function parseRateForm(formData: FormData): { effectiveFrom: Date; pricePerHour: number } | { error: string } {
  const dateStr = formData.get("effectiveFrom")?.toString().trim() ?? "";
  const priceStr = formData.get("pricePerHour")?.toString().trim() ?? "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { error: "נא לבחור תאריך תקין" };
  const effectiveFrom = new Date(dateStr + "T00:00:00.000Z");
  if (isNaN(effectiveFrom.getTime())) return { error: "תאריך לא תקין" };

  const pricePerHour = parseFloat(priceStr);
  if (isNaN(pricePerHour) || pricePerHour <= 0) return { error: "מחיר חייב להיות מספר חיובי" };

  return { effectiveFrom, pricePerHour };
}

export async function createRateAction(
  _prev: RateActionState,
  formData: FormData,
): Promise<RateActionState> {
  await requireAdmin();

  const parsed = parseRateForm(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  const { effectiveFrom, pricePerHour } = parsed;

  const existing = await prisma.hourlyRate.findFirst({
    where: { effectiveFrom },
    select: { id: true },
  });
  if (existing) return { ok: false, message: "כבר קיים תעריף לתאריך זה" };

  await prisma.hourlyRate.create({ data: { effectiveFrom, pricePerHour } });

  revalidatePath("/admin/config/rates");
  redirect("/admin/config/rates");
}

export async function updateRateAction(
  id: string,
  _prev: RateActionState,
  formData: FormData,
): Promise<RateActionState> {
  await requireAdmin();

  const parsed = parseRateForm(formData);
  if ("error" in parsed) return { ok: false, message: parsed.error };

  const { effectiveFrom, pricePerHour } = parsed;

  const conflict = await prisma.hourlyRate.findFirst({
    where: { effectiveFrom, NOT: { id } },
    select: { id: true },
  });
  if (conflict) return { ok: false, message: "כבר קיים תעריף לתאריך זה" };

  try {
    await prisma.hourlyRate.update({ where: { id }, data: { effectiveFrom, pricePerHour } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, message: "תעריף לא נמצא" };
    }
    throw e;
  }

  revalidatePath("/admin/config/rates");
  redirect("/admin/config/rates");
}

export async function deleteRateAction(
  id: string,
  _prev: RateActionState,
  _formData: FormData,
): Promise<RateActionState> {
  await requireAdmin();

  try {
    await prisma.hourlyRate.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      // already gone
    } else throw e;
  }

  revalidatePath("/admin/config/rates");
  return { ok: true, message: "התעריף נמחק" };
}
