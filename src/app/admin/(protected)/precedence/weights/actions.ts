"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionSubject } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { parseYearWeightForm } from "@/lib/year-weight-validation";
import { writeAuditLog } from "@/lib/audit";

export type WeightActionState = { ok: boolean; message?: string };

const GENERIC_ERROR = "אירעה שגיאה. נסה שוב מאוחר יותר.";

async function requireAdmin(): Promise<void> {
  const subject = await getAdminSessionSubject();
  if (!subject) redirect("/admin/login");
}

export async function createYearWeightAction(
  _prev: WeightActionState,
  formData: FormData,
): Promise<WeightActionState> {
  await requireAdmin();

  const validation = parseYearWeightForm({
    year: formData.get("year")?.toString(),
    weight: formData.get("weight")?.toString(),
  });
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const { year, weight } = validation.data;

  try {
    await prisma.yearWeight.create({ data: { year, weight } });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      return { ok: false, message: `משקל לשנת ${year} כבר קיים` };
    }
    console.error("createYearWeightAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: "admin",
    action: "CREATE_YEAR_WEIGHT",
    entityType: "YearWeight",
    entityId: String(year),
    after: { year, weight },
  });

  revalidatePath("/admin/precedence");
  revalidatePath("/admin/precedence/weights");
  redirect("/admin/precedence/weights");
}

export async function updateYearWeightAction(
  year: number,
  _prev: WeightActionState,
  formData: FormData,
): Promise<WeightActionState> {
  await requireAdmin();

  const validation = parseYearWeightForm({
    year: String(year),
    weight: formData.get("weight")?.toString(),
  });
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const existing = await prisma.yearWeight.findUnique({
    where: { year },
    select: { weight: true },
  });

  try {
    await prisma.yearWeight.update({
      where: { year },
      data: { weight: validation.data.weight },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return { ok: false, message: "שנה לא נמצאה" };
    }
    console.error("updateYearWeightAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: "admin",
    action: "UPDATE_YEAR_WEIGHT",
    entityType: "YearWeight",
    entityId: String(year),
    before: existing ? { year, weight: existing.weight } : null,
    after: { year, weight: validation.data.weight },
  });

  revalidatePath("/admin/precedence");
  revalidatePath("/admin/precedence/weights");
  redirect("/admin/precedence/weights");
}

export async function deleteYearWeightAction(
  year: number,
  _prev: WeightActionState,
  _formData: FormData,
): Promise<WeightActionState> {
  await requireAdmin();

  const existing = await prisma.yearWeight.findUnique({
    where: { year },
    select: { weight: true },
  });

  try {
    await prisma.yearWeight.delete({ where: { year } });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      // already deleted — treat as success
    } else {
      console.error("deleteYearWeightAction failed", e);
      return { ok: false, message: GENERIC_ERROR };
    }
  }

  writeAuditLog({
    actor: "admin",
    action: "DELETE_YEAR_WEIGHT",
    entityType: "YearWeight",
    entityId: String(year),
    before: existing ? { year, weight: existing.weight } : null,
  });

  revalidatePath("/admin/precedence");
  revalidatePath("/admin/precedence/weights");
  return { ok: true, message: "המשקל נמחק" };
}
