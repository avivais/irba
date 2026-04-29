"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  computeSharedExpenseShares,
  findEligiblePlayers,
  listAllPlayersForManualAdd,
  type EligibilityPool,
  type EligiblePlayer,
  type RosterPlayer,
} from "@/lib/shared-expenses";

const GENERIC_ERROR = "אירעה שגיאה. נסה שוב מאוחר יותר.";

export type LoadPreviewInput = {
  totalAmount: number;
  lookbackYears: number;
  minAttendancePct: number;
  eligibilityPool: EligibilityPool;
};

export type LoadPreviewResult = {
  ok: true;
  eligible: EligiblePlayer[];
  roster: RosterPlayer[];
} | {
  ok: false;
  error: string;
};

export async function loadInitialPreviewAction(
  input: LoadPreviewInput,
): Promise<LoadPreviewResult> {
  await requireAdmin();

  if (!Number.isFinite(input.lookbackYears) || input.lookbackYears <= 0) {
    return { ok: false, error: "תקופת הסתכלות חייבת להיות גדולה מאפס." };
  }
  if (
    !Number.isFinite(input.minAttendancePct) ||
    input.minAttendancePct < 0 ||
    input.minAttendancePct > 1
  ) {
    return { ok: false, error: "אחוז ההשתתפות המינימלי חייב להיות בין 0 ל-100." };
  }

  try {
    const [eligible, roster] = await Promise.all([
      findEligiblePlayers({
        lookbackYears: input.lookbackYears,
        minAttendancePct: input.minAttendancePct,
        eligibilityPool: input.eligibilityPool,
      }),
      listAllPlayersForManualAdd(),
    ]);
    return { ok: true, eligible, roster };
  } catch (e) {
    console.error("[shared-expense] preview failed", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export type CreateSharedExpenseInput = {
  title: string;
  description: string | null;
  totalAmount: number;
  lookbackYears: number;
  minAttendancePct: number;
  eligibilityPool: EligibilityPool;
  /** Players from the eligible list the admin kept. */
  includedPlayerIds: string[];
  /** Players the admin manually added despite not qualifying. */
  manuallyAddedPlayerIds: string[];
};

export type CreateSharedExpenseResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createSharedExpenseAction(
  input: CreateSharedExpenseInput,
): Promise<CreateSharedExpenseResult> {
  const adminId = await requireAdmin();

  const title = input.title.trim();
  if (!title) {
    return { ok: false, error: "יש להזין כותרת לחיוב." };
  }
  if (
    !Number.isFinite(input.totalAmount) ||
    !Number.isInteger(input.totalAmount) ||
    input.totalAmount <= 0
  ) {
    return { ok: false, error: "סכום החיוב חייב להיות מספר שלם חיובי." };
  }

  const includedSet = new Set(input.includedPlayerIds);
  const manualSet = new Set(input.manuallyAddedPlayerIds);
  if (includedSet.size !== input.includedPlayerIds.length) {
    return { ok: false, error: "התקבל מזהה שחקן כפול ברשימה הראשית." };
  }
  if (manualSet.size !== input.manuallyAddedPlayerIds.length) {
    return { ok: false, error: "התקבל מזהה שחקן כפול ברשימת הוספה ידנית." };
  }
  for (const id of manualSet) {
    if (includedSet.has(id)) {
      return { ok: false, error: "שחקן מופיע גם ברשימה הראשית וגם בהוספה ידנית." };
    }
  }

  const allChargedIds = [...input.includedPlayerIds, ...input.manuallyAddedPlayerIds];
  if (allChargedIds.length === 0) {
    return { ok: false, error: "יש לבחור לפחות שחקן אחד לחיוב." };
  }

  try {
    // Re-run eligibility on the server: don't trust the client list.
    const eligible = await findEligiblePlayers({
      lookbackYears: input.lookbackYears,
      minAttendancePct: input.minAttendancePct,
      eligibilityPool: input.eligibilityPool,
    });
    const eligibleIds = new Set(eligible.map((p) => p.playerId));
    for (const id of input.includedPlayerIds) {
      if (!eligibleIds.has(id)) {
        return {
          ok: false,
          error:
            "אחד או יותר מהשחקנים ברשימה הראשית כבר לא עומדים בקריטריונים. רענן/י את התצוגה המקדימה.",
        };
      }
    }

    // Manually-added IDs only need to exist in the player table.
    if (manualSet.size > 0) {
      const found = await prisma.player.findMany({
        where: { id: { in: [...manualSet] } },
        select: { id: true },
      });
      if (found.length !== manualSet.size) {
        return { ok: false, error: "אחד מהשחקנים שנוספו ידנית לא נמצא במאגר." };
      }
    }

    const split = computeSharedExpenseShares(input.totalAmount, allChargedIds.length);

    const created = await prisma.$transaction(async (tx) => {
      const expense = await tx.sharedExpense.create({
        data: {
          title,
          description: input.description?.trim() || null,
          totalAmount: input.totalAmount,
          lookbackYears: input.lookbackYears,
          minAttendancePct: input.minAttendancePct,
          eligibilityPool: input.eligibilityPool,
          createdById: adminId,
        },
        select: { id: true },
      });

      await tx.sharedExpenseCharge.createMany({
        data: allChargedIds.map((playerId, idx) => ({
          sharedExpenseId: expense.id,
          playerId,
          amount: split.perPlayer[idx],
          manuallyAdded: manualSet.has(playerId),
        })),
      });

      return expense;
    });

    writeAuditLog({
      actor: adminId,
      action: "CREATE_SHARED_EXPENSE",
      entityType: "SharedExpense",
      entityId: created.id,
      after: {
        title,
        totalAmount: input.totalAmount,
        lookbackYears: input.lookbackYears,
        minAttendancePct: input.minAttendancePct,
        eligibilityPool: input.eligibilityPool,
        playerCount: allChargedIds.length,
        manualCount: manualSet.size,
      },
    });

    revalidatePath("/admin/finance");
    revalidatePath("/admin/finance/shared-expenses");

    return { ok: true, id: created.id };
  } catch (e) {
    console.error("[shared-expense] create failed", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}

export type RevertSharedExpenseResult =
  | { ok: true }
  | { ok: false; error: string };

export async function revertSharedExpenseAction(
  id: string,
): Promise<RevertSharedExpenseResult> {
  const adminId = await requireAdmin();

  try {
    const existing = await prisma.sharedExpense.findUnique({
      where: { id },
      select: { id: true, revertedAt: true },
    });
    if (!existing) {
      return { ok: false, error: "החיוב לא נמצא." };
    }
    if (existing.revertedAt) {
      return { ok: false, error: "החיוב כבר בוטל." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.sharedExpenseCharge.deleteMany({ where: { sharedExpenseId: id } });
      await tx.sharedExpense.update({
        where: { id },
        data: { revertedAt: new Date() },
      });
    });

    writeAuditLog({
      actor: adminId,
      action: "REVERT_SHARED_EXPENSE",
      entityType: "SharedExpense",
      entityId: id,
    });

    revalidatePath("/admin/finance");
    revalidatePath("/admin/finance/shared-expenses");
    revalidatePath(`/admin/finance/shared-expenses/${id}`);

    return { ok: true };
  } catch (e) {
    console.error("[shared-expense] revert failed", e);
    return { ok: false, error: GENERIC_ERROR };
  }
}
