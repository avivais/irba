"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { z } from "zod";
import type { PaymentMethod } from "@prisma/client";

const GENERIC_ERROR = "אירעה שגיאה. נסה שוב מאוחר יותר.";

export type PaymentActionState = { ok: boolean; message?: string };

const addPaymentSchema = z.object({
  date: z.string().min(1, "נא לבחור תאריך"),
  amount: z
    .string()
    .min(1, "נא להזין סכום")
    .refine((v) => /^-?\d+$/.test(v.trim()), "נא להזין מספר שלם")
    .transform((v) => parseInt(v.trim(), 10)),
  method: z.enum(["CASH", "PAYBOX", "BIT", "BANK_TRANSFER", "OTHER"]),
  description: z.string().max(200).optional(),
});

export async function addPaymentAction(
  playerId: string,
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  await requireAdmin();

  const parsed = addPaymentSchema.safeParse({
    date: formData.get("date")?.toString(),
    amount: formData.get("amount")?.toString(),
    method: formData.get("method")?.toString(),
    description: formData.get("description")?.toString() || undefined,
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "קלט לא תקין";
    return { ok: false, message: first };
  }

  const { date, amount, method, description } = parsed.data;

  let id: string;
  try {
    const payment = await prisma.payment.create({
      data: {
        playerId,
        date: new Date(date),
        amount,
        method: method as PaymentMethod,
        description: description ?? null,
      },
      select: { id: true },
    });
    id = payment.id;
  } catch (e) {
    console.error("addPaymentAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: "admin",
    action: "ADD_PAYMENT",
    entityType: "Payment",
    entityId: id,
    after: { playerId, date, amount, method, description },
  });

  revalidatePath(`/admin/players/${playerId}/edit`);
  return { ok: true, message: "התשלום נוסף" };
}

export async function deletePaymentAction(
  playerId: string,
  paymentId: string,
): Promise<PaymentActionState> {
  await requireAdmin();

  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { amount: true, date: true, method: true, description: true },
  });

  try {
    await prisma.payment.delete({ where: { id: paymentId } });
  } catch (e) {
    console.error("deletePaymentAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: "admin",
    action: "DELETE_PAYMENT",
    entityType: "Payment",
    entityId: paymentId,
    before: existing ? (existing as Record<string, unknown>) : null,
  });

  revalidatePath(`/admin/players/${playerId}/edit`);
  return { ok: true };
}
