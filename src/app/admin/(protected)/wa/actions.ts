"use server";

import { hash } from "bcryptjs";
import { randomInt } from "crypto";
import { requireAdmin } from "@/lib/admin-guard";
import { getAllConfigs, CONFIG } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";
import { sendWaGroupMessage, sendWaMessage } from "@/lib/wa-notify";
import { writeAuditLog } from "@/lib/audit";

export type WaStatusResult = { ready: boolean; qr: string | null };

export async function fetchWaStatusAction(): Promise<WaStatusResult> {
  await requireAdmin();
  try {
    const [statusRes, qrRes] = await Promise.all([
      fetch("http://wa:3100/status", { cache: "no-store" }),
      fetch("http://wa:3100/qr", { cache: "no-store" }),
    ]);
    const { ready } = (await statusRes.json()) as { ready: boolean };
    const { qr } = (await qrRes.json()) as { qr: string | null };
    return { ready, qr: qr ?? null };
  } catch {
    return { ready: false, qr: null };
  }
}

export type SendWaActionState = { ok: boolean; message: string };

export async function logoutWaAction(): Promise<SendWaActionState> {
  await requireAdmin();
  try {
    const res = await fetch("http://wa:3100/logout", {
      method: "POST",
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, message: "שגיאה בהתנתקות" };
    writeAuditLog({ actor: "admin", action: "WA_LOGOUT" });
    return { ok: true, message: "התנתק בהצלחה" };
  } catch {
    return { ok: false, message: "הבוט אינו זמין" };
  }
}

export async function sendWaGroupMessageAction(
  _prev: SendWaActionState,
  formData: FormData,
): Promise<SendWaActionState> {
  await requireAdmin();
  const text = (formData.get("message") as string | null)?.trim() ?? "";
  if (!text) return { ok: false, message: "הודעה ריקה" };
  const configs = await getAllConfigs();
  const groupJid = configs[CONFIG.WA_GROUP_JID];
  if (!groupJid) return { ok: false, message: "Group JID לא מוגדר" };
  await sendWaGroupMessage(groupJid, text);
  writeAuditLog({
    actor: "admin",
    action: "SEND_WA_MESSAGE",
    after: { message: text, groupJid },
  });
  return { ok: true, message: "נשלח ✓" };
}

export async function sendAdminTestOtpAction(
  _prev: SendWaActionState,
  formData: FormData,
): Promise<SendWaActionState> {
  await requireAdmin();

  const rawPhone = (formData.get("phone") as string | null)?.trim() ?? "";
  if (!rawPhone) return { ok: false, message: "נא להזין מספר טלפון" };

  let phone: string;
  try {
    phone = normalizePhone(rawPhone);
  } catch {
    return { ok: false, message: "מספר טלפון לא תקין (דוגמה: 0501234567)" };
  }

  const admin = await prisma.player.findFirst({
    where: { isAdmin: true, phone: { not: "" } },
    orderBy: { createdAt: "asc" },
    select: { phone: true },
  });
  if (!admin?.phone) return { ok: false, message: "לא נמצא אדמין עם טלפון לשליחה" };

  if (process.env.WA_NOTIFY_ENABLED !== "true") {
    return { ok: false, message: "שליחת WhatsApp כבויה בסביבה הזו" };
  }

  const player = await prisma.player.findUnique({
    where: { phone },
    select: { id: true },
  });
  if (!player) {
    return { ok: false, message: "שחקן לא נמצא — בקש ממנו להזין את הטלפון במסך הכניסה תחילה" };
  }

  const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const hashed = await hash(otp, 8);
  await prisma.player.update({
    where: { id: player.id },
    data: {
      otpCode: hashed,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await sendWaMessage(
    admin.phone,
    `קוד בדיקה ל-IRBA עבור ${phone}: ${otp}\nהקוד תקף ל-10 דקות.`,
  );

  writeAuditLog({
    actor: "admin",
    action: "SEND_ADMIN_TEST_OTP",
    entityType: "Player",
    entityId: player.id,
    after: { targetPhone: phone, adminPhone: admin.phone },
  });

  return { ok: true, message: "קוד נוצר ונשלח לוואטסאפ של האדמין" };
}
