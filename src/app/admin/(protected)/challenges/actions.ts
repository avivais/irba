"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { parseChallengeForm } from "@/lib/challenge-validation";
import { writeAuditLog } from "@/lib/audit";

export type ChallengeActionState = { ok: boolean; message?: string };

const GENERIC_ERROR = "אירעה שגיאה. נסה שוב מאוחר יותר.";

export async function createChallengeAction(
  _prev: ChallengeActionState,
  formData: FormData,
): Promise<ChallengeActionState> {
  const adminId = await requireAdmin();

  const raw = {
    title: formData.get("title")?.toString(),
    metric: formData.get("metric")?.toString(),
    eligibilityMinPct: formData.get("eligibilityMinPct")?.toString(),
    roundCount: formData.get("roundCount")?.toString(),
    prize: formData.get("prize")?.toString(),
  };

  const validation = parseChallengeForm(raw);
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const { title, metric, eligibilityMinPct, roundCount, prize } = validation.data;

  let created: { id: string };
  try {
    created = await prisma.challenge.create({
      data: { title, metric, eligibilityMinPct, roundCount, prize, createdBy: adminId },
      select: { id: true },
    });
  } catch (e) {
    console.error("createChallengeAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: adminId,
    action: "CREATE_CHALLENGE",
    entityType: "Challenge",
    entityId: created.id,
    after: { title, metric, eligibilityMinPct, roundCount, prize },
  });

  revalidatePath("/admin/challenges");
  revalidatePath("/challenges");
  redirect("/admin/challenges");
}

export async function updateChallengeAction(
  id: string,
  _prev: ChallengeActionState,
  formData: FormData,
): Promise<ChallengeActionState> {
  const adminId = await requireAdmin();

  const raw = {
    title: formData.get("title")?.toString(),
    metric: formData.get("metric")?.toString(),
    eligibilityMinPct: formData.get("eligibilityMinPct")?.toString(),
    roundCount: formData.get("roundCount")?.toString(),
    prize: formData.get("prize")?.toString(),
  };

  const validation = parseChallengeForm(raw);
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const { title, metric, eligibilityMinPct, roundCount, prize } = validation.data;

  const before = await prisma.challenge.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "תחרות לא נמצאה" };

  try {
    await prisma.challenge.update({
      where: { id },
      data: { title, metric, eligibilityMinPct, roundCount, prize },
    });
  } catch (e) {
    console.error("updateChallengeAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: adminId,
    action: "UPDATE_CHALLENGE",
    entityType: "Challenge",
    entityId: id,
    before,
    after: { title, metric, eligibilityMinPct, roundCount, prize },
  });

  revalidatePath("/admin/challenges");
  revalidatePath("/challenges");
  redirect("/admin/challenges");
}

export async function deleteChallengeAction(id: string): Promise<ChallengeActionState> {
  const adminId = await requireAdmin();

  const before = await prisma.challenge.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "תחרות לא נמצאה" };

  try {
    await prisma.challenge.delete({ where: { id } });
  } catch (e) {
    console.error("deleteChallengeAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: adminId,
    action: "DELETE_CHALLENGE",
    entityType: "Challenge",
    entityId: id,
    before,
  });

  revalidatePath("/admin/challenges");
  revalidatePath("/challenges");
  return { ok: true };
}

export async function toggleChallengeAction(
  id: string,
  isActive: boolean,
): Promise<ChallengeActionState> {
  const adminId = await requireAdmin();

  try {
    await prisma.challenge.update({ where: { id }, data: { isActive } });
  } catch (e) {
    console.error("toggleChallengeAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: adminId,
    action: "TOGGLE_CHALLENGE",
    entityType: "Challenge",
    entityId: id,
    after: { isActive },
  });

  revalidatePath("/admin/challenges");
  revalidatePath("/challenges");
  return { ok: true };
}
