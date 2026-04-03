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
import { writeAuditLog } from "@/lib/audit";

export type AdminLoginState = { ok: boolean; message?: string };

const GENERIC_AUTH_ERROR = "הסיסמה שגויה או שהשירות אינו זמין.";

const RATE_LIMIT_MESSAGE =
  "יותר מדי ניסיונות התחברות. נסה שוב בעוד כמה דקות.";

const passwordSchema = z
  .string()
  .min(1, "נא להזין סיסמה")
  .max(512, "סיסמה ארוכה מדי");

const isDev = () => process.env.NODE_ENV === "development";

/** Mask a hash for dev logs: show prefix + length, never the full value. */
function hashPreview(h: string | null | undefined): string {
  if (h == null) return "(null)";
  if (h.length === 0) return "(empty string)";
  const prefix = h.slice(0, 7);
  return `"${prefix}…" (len ${h.length})`;
}

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
    if (isDev()) {
      console.error(
        "[admin login] zod validation failed:",
        parsedPw.error.issues[0]?.message,
      );
    }
    return { ok: false, message: parsedPw.error.issues[0]?.message };
  }
  const password = parsedPw.data;

  const headerList = await headers();
  const clientIp = getClientIpFromHeaders((name) => headerList.get(name));
  if (!consumeAdminLoginRateLimit(clientIp)) {
    if (isDev()) {
      console.error(`[admin login] rate-limited (ip: ${clientIp})`);
    }
    writeAuditLog({ actor: "admin", actorIp: clientIp, action: "ADMIN_LOGIN_FAIL", after: { reason: "rate_limited" } });
    return { ok: false, message: RATE_LIMIT_MESSAGE };
  }

  const rawEnv = process.env.ADMIN_PASSWORD_HASH;
  const hash = normalizeAdminPasswordHashFromEnv(rawEnv);

  if (isDev()) {
    console.log("[admin login] === login attempt ===");
    console.log(
      `  ADMIN_PASSWORD_HASH raw env : ${hashPreview(rawEnv)}`,
    );
    console.log(
      `  after normalizeAdminPasswordHashFromEnv: ${hashPreview(hash)}`,
    );
    console.log(
      `  ADMIN_SESSION_SECRET set    : ${(process.env.ADMIN_SESSION_SECRET?.length ?? 0) >= 32 ? "yes" : "NO — must be >= 32 chars"}`,
    );
    console.log(`  password length              : ${password.length}`);
  }

  if (!hash) {
    if (isDev()) {
      console.error(
        "[admin login] FAIL: hash is null after normalization.",
        "The raw value from process.env does not look like a bcrypt hash ($2...).",
        "Restart the dev server after editing .env; re-run npm run hash-admin-password to rewrite.",
      );
    }
    writeAuditLog({ actor: "admin", actorIp: clientIp, action: "ADMIN_LOGIN_FAIL", after: { reason: "no_hash_configured" } });
    return { ok: false, message: GENERIC_AUTH_ERROR };
  }

  let match = false;
  try {
    match = await compare(password, hash);
  } catch (e) {
    if (isDev()) {
      console.error(
        "[admin login] FAIL: bcrypt.compare threw — hash may be truncated or corrupted.",
        `  normalized hash: ${hashPreview(hash)}`,
        `  error: ${e instanceof Error ? e.message : e}`,
      );
    }
    writeAuditLog({ actor: "admin", actorIp: clientIp, action: "ADMIN_LOGIN_FAIL", after: { reason: "bcrypt_error" } });
    return { ok: false, message: GENERIC_AUTH_ERROR };
  }

  if (isDev()) {
    console.log(`  bcrypt.compare result        : ${match}`);
  }

  if (!match) {
    if (isDev()) {
      console.error(
        "[admin login] FAIL: password does not match hash (wrong password or stale .env — restart after changes).",
      );
    }
    writeAuditLog({ actor: "admin", actorIp: clientIp, action: "ADMIN_LOGIN_FAIL", after: { reason: "wrong_password" } });
    return { ok: false, message: GENERIC_AUTH_ERROR };
  }

  try {
    await setAdminSessionCookie();
  } catch (e) {
    if (isDev()) {
      console.error(
        "[admin login] FAIL: could not set session cookie.",
        `  ADMIN_SESSION_SECRET length: ${process.env.ADMIN_SESSION_SECRET?.length ?? 0}`,
        `  error: ${e instanceof Error ? e.message : e}`,
        "Set ADMIN_SESSION_SECRET to a random string >= 32 characters, then restart.",
      );
    }
    writeAuditLog({ actor: "admin", actorIp: clientIp, action: "ADMIN_LOGIN_FAIL", after: { reason: "cookie_error" } });
    return { ok: false, message: GENERIC_AUTH_ERROR };
  }

  if (isDev()) {
    console.log("[admin login] SUCCESS — session cookie set.");
  }

  writeAuditLog({ actor: "admin", actorIp: clientIp, action: "ADMIN_LOGIN" });
  redirect("/admin");
}

export async function adminLogoutAction(): Promise<void> {
  writeAuditLog({ actor: "admin", action: "ADMIN_LOGOUT" });
  await clearAdminSessionCookie();
  redirect("/admin/login");
}
