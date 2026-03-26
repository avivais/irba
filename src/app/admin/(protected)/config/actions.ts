"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionSubject } from "@/lib/admin-session";
import { setConfigs } from "@/lib/config";
import { parseConfigForm } from "@/lib/config-validation";
import type { ConfigKey } from "@/lib/config";

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

  const parsed = parseConfigForm(raw);
  if (!parsed.ok) {
    return { ok: false, errors: parsed.errors };
  }

  await setConfigs(parsed.data);
  revalidatePath("/admin/config");
  return { ok: true, message: "ההגדרות נשמרו בהצלחה" };
}
