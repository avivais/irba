"use server";

import { requireAdmin } from "@/lib/admin-guard";
import { getAllConfigs, CONFIG } from "@/lib/config";
import { sendWaGroupMessage } from "@/lib/wa-notify";
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
