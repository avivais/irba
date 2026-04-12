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
    startDate: formData.get("startDate")?.toString(),
    sessionCount: formData.get("sessionCount")?.toString(),
    minMatchesPct: formData.get("minMatchesPct")?.toString(),
  };

  const validation = parseChallengeForm(raw);
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const { startDate, sessionCount, minMatchesPct } = validation.data;

  // Enforce only one active (non-closed) competition at a time
  const existing = await prisma.challenge.findFirst({
    where: { isClosed: false },
    select: { id: true, number: true },
  });
  if (existing) {
    return { ok: false, message: `יש כבר תחרות פעילה (סיבוב ${existing.number}). יש לסגור אותה לפני פתיחת תחרות חדשה.` };
  }

  // Auto-number: count all challenges + 1
  const count = await prisma.challenge.count();
  const number = count + 1;

  let created: { id: string };
  try {
    created = await prisma.challenge.create({
      data: {
        number,
        startDate: new Date(startDate),
        sessionCount,
        minMatchesPct,
        createdBy: adminId,
      },
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
    after: { number, startDate, sessionCount, minMatchesPct },
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

  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge) return { ok: false, message: "תחרות לא נמצאה" };
  if (challenge.isClosed) return { ok: false, message: "לא ניתן לערוך תחרות סגורה" };

  const raw = {
    startDate: formData.get("startDate")?.toString(),
    sessionCount: formData.get("sessionCount")?.toString(),
    minMatchesPct: formData.get("minMatchesPct")?.toString(),
  };

  const validation = parseChallengeForm(raw);
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const { startDate, sessionCount, minMatchesPct } = validation.data;

  try {
    await prisma.challenge.update({
      where: { id },
      data: { startDate: new Date(startDate), sessionCount, minMatchesPct },
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
    before: challenge,
    after: { startDate, sessionCount, minMatchesPct },
  });

  revalidatePath("/admin/challenges");
  revalidatePath("/challenges");
  redirect("/admin/challenges");
}

export async function deleteChallengeAction(id: string): Promise<ChallengeActionState> {
  const adminId = await requireAdmin();

  const before = await prisma.challenge.findUnique({ where: { id } });
  if (!before) return { ok: false, message: "תחרות לא נמצאה" };
  if (before.isClosed) return { ok: false, message: "לא ניתן למחוק תחרות שהסתיימה" };

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
