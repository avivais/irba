"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionSubject } from "@/lib/admin-session";
import { setConfigs, getAllConfigs, CONFIG } from "@/lib/config";
import { parseConfigForm } from "@/lib/config-validation";
import type { ConfigKey } from "@/lib/config";
import { sendWaGroupMessage } from "@/lib/wa-notify";

export type ConfigActionState = {
  ok: boolean;
  message?: string;
  errors?: Partial<Record<ConfigKey, string>>;
};

async function requireAdmin(): Promise<void> {
  const subject = await getAdminSessionSubject();
  if (!subject) redirect("/admin/login");
}

export async function updateConfigAction(
  _prev: ConfigActionState,
  formData: FormData,
): Promise<ConfigActionState> {
  await requireAdmin();

  const raw: Record<string, string> = {};
  for (const key of formData.keys()) {
    raw[key] = formData.get(key)?.toString() ?? "";
  }
  // Checkboxes omit their key when unchecked — supply the "off" value explicitly.
  raw[CONFIG.SESSION_SCHEDULE_ENABLED] ??= "false";
  raw[CONFIG.WA_NOTIFY_SESSION_OPEN_ENABLED] ??= "false";
  raw[CONFIG.WA_NOTIFY_SESSION_CLOSE_ENABLED] ??= "false";
  raw[CONFIG.WA_NOTIFY_PLAYER_REGISTERED_ENABLED] ??= "false";
  raw[CONFIG.WA_NOTIFY_PLAYER_CANCELLED_ENABLED] ??= "false";
  raw[CONFIG.WA_NOTIFY_WAITLIST_PROMOTE_ENABLED] ??= "false";

  const parsed = parseConfigForm(raw);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  await setConfigs(parsed.data);
  revalidatePath("/admin/config");
  return { ok: true, message: "ההגדרות נשמרו בהצלחה" };
}

export type WaGroup = { id: string; subject: string };
export type FetchWaGroupsResult =
  | { ok: true; groups: WaGroup[] }
  | { ok: false; message: string };

export async function fetchWaGroupsAction(): Promise<FetchWaGroupsResult> {
  await requireAdmin();
  try {
    const res = await fetch("http://wa:3100/groups", { cache: "no-store" });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, message: body.error ?? "שגיאה בקבלת הקבוצות" };
    }
    const groups = (await res.json()) as WaGroup[];
    return { ok: true, groups: groups.sort((a, b) => a.subject.localeCompare(b.subject)) };
  } catch {
    return { ok: false, message: "הבוט אינו זמין" };
  }
}

export type SendWaActionState = { ok: boolean; message: string };

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
  return { ok: true, message: "נשלח ✓" };
}
