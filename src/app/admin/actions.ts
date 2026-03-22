"use server";

import { compare } from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  clearAdminSessionCookie,
  setAdminSessionCookie,
} from "@/lib/admin-session";
import { normalizeAdminPasswordHashFromEnv } from "@/lib/admin-password-env";
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

  const hash = normalizeAdminPasswordHashFromEnv(
    process.env.ADMIN_PASSWORD_HASH,
  );
  if (!hash) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[admin login] ADMIN_PASSWORD_HASH missing or invalid. Restart the dev server after editing .env; ensure a single bcrypt line (run npm run hash-admin-password again if unsure).",
      );
    }
    return { ok: false, message: GENERIC_AUTH_ERROR };
  }

  let match = false;
  try {
    match = await compare(password, hash);
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[admin login] bcrypt.compare failed — hash in .env may be truncated or corrupted.",
        e instanceof Error ? e.message : e,
      );
    }
    return { ok: false, message: GENERIC_AUTH_ERROR };
  }

  if (!match) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[admin login] Password does not match ADMIN_PASSWORD_HASH (wrong password or stale .env).",
      );
    }
    return { ok: false, message: GENERIC_AUTH_ERROR };
  }

  try {
    await setAdminSessionCookie();
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[admin login] Failed to set session cookie. Set ADMIN_SESSION_SECRET to a different random string of at least 32 characters, then restart the dev server.",
        e instanceof Error ? e.message : e,
      );
    }
    return { ok: false, message: GENERIC_AUTH_ERROR };
  }

  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  await clearAdminSessionCookie();
  redirect("/admin/login");
}
