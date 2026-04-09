"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { setConfigs, getAllConfigs, CONFIG } from "@/lib/config";
import { parseConfigForm } from "@/lib/config-validation";
import type { ConfigKey } from "@/lib/config";
import { autoCreateNextSession } from "@/lib/auto-create-session";
import { writeAuditLog } from "@/lib/audit";
import { recalculateAllComputedRanks } from "@/lib/computed-rank";

export type ConfigActionState = {
  ok: boolean;
  message?: string;
  errors?: Partial<Record<ConfigKey, string>>;
};

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
  raw[CONFIG.ALERT_LOW_ATTENDANCE_ENABLED] ??= "false";
  raw[CONFIG.ALERT_EARLY_ENABLED] ??= "false";
  raw[CONFIG.ALERT_CRITICAL_ENABLED] ??= "false";
  raw[CONFIG.WA_NOTIFY_SESSION_OPEN_ENABLED] ??= "false";
  raw[CONFIG.WA_NOTIFY_SESSION_CLOSE_ENABLED] ??= "false";
  raw[CONFIG.WA_NOTIFY_PLAYER_REGISTERED_ENABLED] ??= "false";
  raw[CONFIG.WA_NOTIFY_PLAYER_CANCELLED_ENABLED] ??= "false";
  raw[CONFIG.WA_NOTIFY_WAITLIST_PROMOTE_ENABLED] ??= "false";

  const parsed = parseConfigForm(raw);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  const before = await getAllConfigs();
  await setConfigs(parsed.data);

  writeAuditLog({
    actor: "admin",
    action: "UPDATE_CONFIG",
    entityType: "AppConfig",
    before: before as Record<string, unknown>,
    after: parsed.data as Record<string, unknown>,
  });

  // Recalculate ranks if any weight key changed
  const rankKeys = [
    CONFIG.RANK_WEIGHT_ADMIN,
    CONFIG.RANK_WEIGHT_PEER,
    CONFIG.RANK_WEIGHT_WINLOSS,
    CONFIG.RANK_WINLOSS_MIN_GAMES_PCT,
    CONFIG.DEFAULT_PLAYER_RANK,
  ] as const;
  const rankWeightsChanged = rankKeys.some(
    (k) => before[k] !== (parsed.data as Record<string, string>)[k],
  );
  if (rankWeightsChanged) {
    await recalculateAllComputedRanks("admin");
  }

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
      const message =
        res.status === 503 ? "הבוט לא מחובר לוואטסאפ" : "שגיאה בקבלת הקבוצות";
      return { ok: false, message };
    }
    const groups = (await res.json()) as WaGroup[];
    return { ok: true, groups: groups.sort((a, b) => a.subject.localeCompare(b.subject)) };
  } catch {
    return { ok: false, message: "הבוט אינו זמין" };
  }
}

export type RunAutoCreateResult = { ok: boolean; message: string };

export async function runAutoCreateAction(): Promise<RunAutoCreateResult> {
  await requireAdmin();
  const result = await autoCreateNextSession({ force: true });
  writeAuditLog({
    actor: "admin",
    action: "RUN_AUTO_CREATE",
    after: { created: result.created, ...(result.created ? { sessionId: result.sessionId } : { reason: result.reason }) },
  });
  if (result.created) {
    return { ok: true, message: "מפגש נוצר בהצלחה" };
  }
  const reasons: Record<string, string> = {
    "schedule disabled": "לוח הזמנים האוטומטי אינו מופעל",
    "already exists": "מפגש כבר קיים לתאריך הבא",
  };
  return { ok: false, message: reasons[result.reason] ?? result.reason };
}

