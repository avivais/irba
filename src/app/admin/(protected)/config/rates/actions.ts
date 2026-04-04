"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export type RateActionState = { ok: boolean; message?: string };

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

  const created = await prisma.hourlyRate.create({
    data: { effectiveFrom, pricePerHour },
    select: { id: true },
  });

  writeAuditLog({
    actor: "admin",
    action: "CREATE_RATE",
    entityType: "HourlyRate",
    entityId: created.id,
    after: { effectiveFrom: effectiveFrom.toISOString(), pricePerHour },
  });

  revalidatePath("/admin/config");
  redirect("/admin/config");
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

  const before = await prisma.hourlyRate.findUnique({
    where: { id },
    select: { effectiveFrom: true, pricePerHour: true },
  });

  try {
    await prisma.hourlyRate.update({ where: { id }, data: { effectiveFrom, pricePerHour } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, message: "תעריף לא נמצא" };
    }
    throw e;
  }

  writeAuditLog({
    actor: "admin",
    action: "UPDATE_RATE",
    entityType: "HourlyRate",
    entityId: id,
    before: before ? { effectiveFrom: before.effectiveFrom.toISOString(), pricePerHour: before.pricePerHour } : null,
    after: { effectiveFrom: effectiveFrom.toISOString(), pricePerHour },
  });

  revalidatePath("/admin/config");
  redirect("/admin/config");
}

export async function deleteRateAction(
  id: string,
  _prev: RateActionState,
  _formData: FormData,
): Promise<RateActionState> {
  await requireAdmin();

  const before = await prisma.hourlyRate.findUnique({
    where: { id },
    select: { effectiveFrom: true, pricePerHour: true },
  });

  try {
    await prisma.hourlyRate.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      // already gone
    } else throw e;
  }

  writeAuditLog({
    actor: "admin",
    action: "DELETE_RATE",
    entityType: "HourlyRate",
    entityId: id,
    before: before ? { effectiveFrom: before.effectiveFrom.toISOString(), pricePerHour: before.pricePerHour } : null,
  });

  revalidatePath("/admin/config");
  return { ok: true, message: "התעריף נמחק" };
}
