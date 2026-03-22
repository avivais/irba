"use server";

import { compare } from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  clearAdminSessionCookie,
  setAdminSessionCookie,
} from "@/lib/admin-session";
import {
  consumeAdminLoginRateLimit,
  getClientIpFromHeaders,
} from "@/lib/rate-limit";

export type AdminLoginState = { ok: boolean; message?: string };

const GENERIC_AUTH_ERROR = "הסיסמה שגויה או שהשירות אינו זמין.";

const RATE_LIMIT_MESSAGE =
  "יותר מדי ניסיונות התחברות. נסה שוב בעוד כמה דקות.";

const passwordSchema = z
  .string()
  .min(1, "נא להזין סיסמה")
  .max(512, "סיסמה ארוכה מדי");

export async function adminLoginAction(
  _prev: AdminLoginState,
  formData: FormData,
): Promise<AdminLoginState> {
  const raw =
    typeof formData.get("password") === "string"
      ? formData.get("password")
      : "";
  const parsedPw = passwordSchema.safeParse(raw);
  if (!parsedPw.success) {
    return { ok: false, message: parsedPw.error.issues[0]?.message };
  }
  const password = parsedPw.data;

  const headerList = await headers();
  const clientIp = getClientIpFromHeaders((name) => headerList.get(name));
  if (!consumeAdminLoginRateLimit(clientIp)) {
    return { ok: false, message: RATE_LIMIT_MESSAGE };
  }

  const hash = process.env.ADMIN_PASSWORD_HASH?.trim();
  if (!hash) {
    return { ok: false, message: GENERIC_AUTH_ERROR };
  }

  let match = false;
  try {
    match = await compare(password, hash);
  } catch {
    return { ok: false, message: GENERIC_AUTH_ERROR };
  }

  if (!match) {
    return { ok: false, message: GENERIC_AUTH_ERROR };
  }

  try {
    await setAdminSessionCookie();
  } catch {
    return { ok: false, message: GENERIC_AUTH_ERROR };
  }

  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}
