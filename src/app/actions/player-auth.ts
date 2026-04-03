"use server";

import { compare, hash } from "bcryptjs";
import { randomInt } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  setPlayerSessionCookie,
  clearPlayerSessionCookie,
  getPlayerSessionPlayerId,
} from "@/lib/player-session";
import { setAdminSessionCookie } from "@/lib/admin-session";
import {
  consumePlayerLoginRateLimit,
  getClientIpFromHeaders,
} from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { normalizePhone } from "@/lib/phone";
import { sendWaMessage } from "@/lib/wa-notify";
import { isValidIsraeliId, normalizeIsraeliId } from "@/lib/israeli-id";

const isDev = () => process.env.NODE_ENV === "development";

export type PlayerAuthState = {
  ok: boolean;
  message?: string;
  step?: "otp_sent" | "set_profile" | "logged_in";
  /** Dev mode only — raw OTP for testing when WA is not enabled. */
  devOtp?: string;
};

const GENERIC_ERROR = "אירעה שגיאה. נסה שוב.";
const RATE_LIMIT_MESSAGE = "יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.";
const PLAYER_NOT_FOUND =
  "מספר הטלפון לא קיים במערכת. פנה למנהל להוספה.";

const phoneSchema = z.string().min(1, "נא להזין מספר טלפון");
const otpSchema = z
  .string()
  .regex(/^\d{6}$/, "קוד אימות חייב להיות 6 ספרות");
const passwordSchema = z
  .string()
  .min(8, "סיסמה חייבת להכיל לפחות 8 תווים")
  .max(512, "סיסמה ארוכה מדי");
const emailSchema = z
  .string()
  .email("כתובת מייל לא תקינה")
  .or(z.literal(""))
  .optional();

// ── Internal helpers ──────────────────────────────────────────────────────────

function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Generates, hashes, stores, and returns the raw OTP string. */
async function issueOtp(playerId: string): Promise<string> {
  const raw = generateOtp();
  const hashed = await hash(raw, 8);
  await prisma.player.update({
    where: { id: playerId },
    data: {
      otpCode: hashed,
      otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
  return raw;
}

async function getClientIp(): Promise<string> {
  const headerList = await headers();
  return getClientIpFromHeaders((name) => headerList.get(name));
}

function parseRememberMe(formData: FormData): boolean {
  return formData.get("rememberMe") === "on";
}

/** Sets player session and optionally admin session for isAdmin players. */
async function establishSession(
  playerId: string,
  isAdmin: boolean,
  rememberMe: boolean,
): Promise<void> {
  await setPlayerSessionCookie(playerId, rememberMe);
  if (isAdmin) {
    await setAdminSessionCookie();
  }
}

function otpMessage(rawOtp: string): string {
  return `קוד האימות שלך ל-IRBA: ${rawOtp}\nהקוד תקף ל-10 דקות.`;
}

// ── OTP flow ──────────────────────────────────────────────────────────────────

/**
 * Step 1a: Player enters phone → generate OTP, hash + store, send via WA.
 * Returns step:"otp_sent" on success. In dev without WA, returns devOtp.
 */
export async function requestOtpAction(
  _prev: PlayerAuthState,
  formData: FormData,
): Promise<PlayerAuthState> {
  const parsedPhone = phoneSchema.safeParse(formData.get("phone"));
  if (!parsedPhone.success) {
    return { ok: false, message: parsedPhone.error.issues[0]?.message };
  }

  let phone: string;
  try {
    phone = normalizePhone(parsedPhone.data);
  } catch {
    return { ok: false, message: "מספר טלפון לא תקין (דוגמה: 0501234567)" };
  }

  const clientIp = await getClientIp();
  if (!consumePlayerLoginRateLimit(clientIp)) {
    return { ok: false, message: RATE_LIMIT_MESSAGE };
  }

  const player = await prisma.player.findUnique({
    where: { phone },
    select: { id: true, phone: true },
  });
  if (!player) {
    return { ok: false, message: PLAYER_NOT_FOUND };
  }

  let rawOtp: string;
  try {
    rawOtp = await issueOtp(player.id);
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: phone,
    actorIp: clientIp,
    action: "PLAYER_OTP_SENT",
    entityType: "Player",
    entityId: player.id,
  });

  if (process.env.WA_NOTIFY_ENABLED !== "true") {
    if (isDev()) {
      return { ok: true, step: "otp_sent", devOtp: rawOtp };
    }
    return { ok: true, step: "otp_sent", message: "קוד נשלח אם המספר קיים" };
  }

  await sendWaMessage(phone, otpMessage(rawOtp));
  return { ok: true, step: "otp_sent" };
}

/**
 * Step 1b: Player enters 6-digit OTP → verify, issue session.
 * On first login (no passwordHash): returns step:"set_profile".
 * Otherwise: redirects to /profile.
 */
export async function verifyOtpAction(
  _prev: PlayerAuthState,
  formData: FormData,
): Promise<PlayerAuthState> {
  const parsedPhone = phoneSchema.safeParse(formData.get("phone"));
  const parsedOtp = otpSchema.safeParse(formData.get("otp"));

  if (!parsedPhone.success) {
    return { ok: false, message: parsedPhone.error.issues[0]?.message };
  }
  if (!parsedOtp.success) {
    return { ok: false, message: parsedOtp.error.issues[0]?.message };
  }

  let phone: string;
  try {
    phone = normalizePhone(parsedPhone.data);
  } catch {
    return { ok: false, message: "מספר טלפון לא תקין" };
  }

  const clientIp = await getClientIp();
  if (!consumePlayerLoginRateLimit(clientIp)) {
    return { ok: false, message: RATE_LIMIT_MESSAGE };
  }

  const player = await prisma.player.findUnique({
    where: { phone },
    select: {
      id: true,
      isAdmin: true,
      passwordHash: true,
      otpCode: true,
      otpExpiresAt: true,
    },
  });

  if (!player || !player.otpCode || !player.otpExpiresAt) {
    return { ok: false, message: "קוד לא תקין או שפג תוקפו" };
  }

  if (player.otpExpiresAt < new Date()) {
    return { ok: false, message: "קוד האימות פג תוקף. בקש קוד חדש." };
  }

  const match = await compare(parsedOtp.data, player.otpCode);
  if (!match) {
    writeAuditLog({
      actor: phone,
      actorIp: clientIp,
      action: "PLAYER_LOGIN_FAIL",
      entityType: "Player",
      entityId: player.id,
      after: { reason: "wrong_otp" },
    });
    return { ok: false, message: "קוד שגוי. בדוק ונסה שוב." };
  }

  // Clear OTP after successful verify
  await prisma.player.update({
    where: { id: player.id },
    data: { otpCode: null, otpExpiresAt: null },
  });

  writeAuditLog({
    actor: phone,
    actorIp: clientIp,
    action: "PLAYER_OTP_VERIFIED",
    entityType: "Player",
    entityId: player.id,
  });

  const rememberMe = parseRememberMe(formData);
  await establishSession(player.id, player.isAdmin, rememberMe);

  writeAuditLog({
    actor: phone,
    actorIp: clientIp,
    action: "PLAYER_LOGIN",
    entityType: "Player",
    entityId: player.id,
    after: { method: "otp" },
  });

  // First login: no password set yet → prompt to complete profile
  if (!player.passwordHash) {
    return { ok: true, step: "set_profile" };
  }

  redirect("/profile");
}

// ── Password flow ─────────────────────────────────────────────────────────────

/**
 * Phone + password login.
 * If player has no passwordHash → step:"otp_sent" (trigger OTP flow from UI).
 */
export async function playerPasswordLoginAction(
  _prev: PlayerAuthState,
  formData: FormData,
): Promise<PlayerAuthState> {
  const parsedPhone = phoneSchema.safeParse(formData.get("phone"));
  const parsedPassword = passwordSchema.safeParse(formData.get("password"));

  if (!parsedPhone.success) {
    return { ok: false, message: parsedPhone.error.issues[0]?.message };
  }
  if (!parsedPassword.success) {
    return { ok: false, message: parsedPassword.error.issues[0]?.message };
  }

  let phone: string;
  try {
    phone = normalizePhone(parsedPhone.data);
  } catch {
    return { ok: false, message: "מספר טלפון לא תקין" };
  }

  const clientIp = await getClientIp();
  if (!consumePlayerLoginRateLimit(clientIp)) {
    return { ok: false, message: RATE_LIMIT_MESSAGE };
  }

  const player = await prisma.player.findUnique({
    where: { phone },
    select: { id: true, isAdmin: true, passwordHash: true },
  });

  if (!player) {
    // Timing-safe: still return a generic error, not "not found"
    return { ok: false, message: "מספר טלפון או סיסמה שגויים" };
  }

  // Player exists but has no password — fall back to OTP
  if (!player.passwordHash) {
    return { ok: true, step: "otp_sent", message: "לא הוגדרה סיסמה. שלחנו קוד אימות לוואטסאפ." };
  }

  const match = await compare(parsedPassword.data, player.passwordHash);
  if (!match) {
    writeAuditLog({
      actor: phone,
      actorIp: clientIp,
      action: "PLAYER_LOGIN_FAIL",
      entityType: "Player",
      entityId: player.id,
      after: { reason: "wrong_password" },
    });
    return { ok: false, message: "מספר טלפון או סיסמה שגויים" };
  }

  const rememberMe = parseRememberMe(formData);
  await establishSession(player.id, player.isAdmin, rememberMe);

  writeAuditLog({
    actor: phone,
    actorIp: clientIp,
    action: "PLAYER_LOGIN",
    entityType: "Player",
    entityId: player.id,
    after: { method: "password" },
  });

  redirect("/profile");
}

// ── Profile completion (first login) ─────────────────────────────────────────

/**
 * After first OTP verification: player sets password, optionally email + nationalId.
 * Requires an active player session.
 */
export async function completeProfileAction(
  _prev: PlayerAuthState,
  formData: FormData,
): Promise<PlayerAuthState> {
  const playerId = await getPlayerSessionPlayerId();
  if (!playerId) {
    return { ok: false, message: "לא מחובר. נא להתחבר שוב." };
  }

  const parsedPassword = passwordSchema.safeParse(formData.get("password"));
  if (!parsedPassword.success) {
    return { ok: false, message: parsedPassword.error.issues[0]?.message };
  }

  const confirmPassword = formData.get("confirmPassword");
  if (parsedPassword.data !== confirmPassword) {
    return { ok: false, message: "הסיסמאות אינן תואמות" };
  }

  const emailRaw = (formData.get("email") as string | null) ?? "";
  const parsedEmail = emailSchema.safeParse(emailRaw);
  if (!parsedEmail.success) {
    return { ok: false, message: parsedEmail.error.issues[0]?.message };
  }

  const nationalIdRaw = (formData.get("nationalId") as string | null) ?? "";
  let nationalId: string | undefined;
  if (nationalIdRaw.replace(/\D/g, "").length > 0) {
    if (!isValidIsraeliId(nationalIdRaw)) {
      return { ok: false, message: "תעודת זהות לא תקינה" };
    }
    nationalId = normalizeIsraeliId(nationalIdRaw);
  }

  const passwordHash = await hash(parsedPassword.data, 10);
  await prisma.player.update({
    where: { id: playerId },
    data: {
      passwordHash,
      email: parsedEmail.data || undefined,
      nationalId,
    },
  });

  writeAuditLog({
    actor: playerId,
    action: "PLAYER_PASSWORD_SET",
    entityType: "Player",
    entityId: playerId,
  });

  redirect("/profile");
}

// ── Password reset ────────────────────────────────────────────────────────────

/**
 * Step 1: Request password reset OTP (reuses same otpCode/otpExpiresAt fields).
 */
export async function requestPasswordResetAction(
  _prev: PlayerAuthState,
  formData: FormData,
): Promise<PlayerAuthState> {
  const parsedPhone = phoneSchema.safeParse(formData.get("phone"));
  if (!parsedPhone.success) {
    return { ok: false, message: parsedPhone.error.issues[0]?.message };
  }

  let phone: string;
  try {
    phone = normalizePhone(parsedPhone.data);
  } catch {
    return { ok: false, message: "מספר טלפון לא תקין" };
  }

  const clientIp = await getClientIp();
  if (!consumePlayerLoginRateLimit(clientIp)) {
    return { ok: false, message: RATE_LIMIT_MESSAGE };
  }

  const player = await prisma.player.findUnique({
    where: { phone },
    select: { id: true },
  });

  if (!player) {
    // Don't reveal whether phone exists — same response either way
    return { ok: true, step: "otp_sent", message: "קוד נשלח אם המספר קיים" };
  }

  let rawOtp: string;
  try {
    rawOtp = await issueOtp(player.id);
  } catch {
    return { ok: false, message: GENERIC_ERROR };
  }

  if (process.env.WA_NOTIFY_ENABLED !== "true") {
    if (isDev()) {
      return { ok: true, step: "otp_sent", devOtp: rawOtp };
    }
    return { ok: true, step: "otp_sent", message: "קוד נשלח אם המספר קיים" };
  }

  await sendWaMessage(phone, otpMessage(rawOtp));
  return { ok: true, step: "otp_sent" };
}

/**
 * Step 2: Verify reset OTP + set new password.
 */
export async function confirmPasswordResetAction(
  _prev: PlayerAuthState,
  formData: FormData,
): Promise<PlayerAuthState> {
  const parsedPhone = phoneSchema.safeParse(formData.get("phone"));
  const parsedOtp = otpSchema.safeParse(formData.get("otp"));
  const parsedPassword = passwordSchema.safeParse(formData.get("password"));

  if (!parsedPhone.success) {
    return { ok: false, message: parsedPhone.error.issues[0]?.message };
  }
  if (!parsedOtp.success) {
    return { ok: false, message: parsedOtp.error.issues[0]?.message };
  }
  if (!parsedPassword.success) {
    return { ok: false, message: parsedPassword.error.issues[0]?.message };
  }

  const confirmPassword = formData.get("confirmPassword");
  if (parsedPassword.data !== confirmPassword) {
    return { ok: false, message: "הסיסמאות אינן תואמות" };
  }

  let phone: string;
  try {
    phone = normalizePhone(parsedPhone.data);
  } catch {
    return { ok: false, message: "מספר טלפון לא תקין" };
  }

  const clientIp = await getClientIp();
  if (!consumePlayerLoginRateLimit(clientIp)) {
    return { ok: false, message: RATE_LIMIT_MESSAGE };
  }

  const player = await prisma.player.findUnique({
    where: { phone },
    select: { id: true, isAdmin: true, otpCode: true, otpExpiresAt: true },
  });

  if (!player || !player.otpCode || !player.otpExpiresAt) {
    return { ok: false, message: "קוד לא תקין או שפג תוקפו" };
  }

  if (player.otpExpiresAt < new Date()) {
    return { ok: false, message: "קוד האימות פג תוקף. בקש קוד חדש." };
  }

  const match = await compare(parsedOtp.data, player.otpCode);
  if (!match) {
    return { ok: false, message: "קוד שגוי. בדוק ונסה שוב." };
  }

  const passwordHash = await hash(parsedPassword.data, 10);
  await prisma.player.update({
    where: { id: player.id },
    data: { passwordHash, otpCode: null, otpExpiresAt: null },
  });

  writeAuditLog({
    actor: phone,
    actorIp: clientIp,
    action: "PLAYER_PASSWORD_RESET",
    entityType: "Player",
    entityId: player.id,
  });

  // Issue session after successful password reset
  const rememberMe = parseRememberMe(formData);
  await establishSession(player.id, player.isAdmin, rememberMe);

  writeAuditLog({
    actor: phone,
    actorIp: clientIp,
    action: "PLAYER_LOGIN",
    entityType: "Player",
    entityId: player.id,
    after: { method: "password_reset" },
  });

  redirect("/profile");
}

// ── Change password (from profile) ───────────────────────────────────────────

/**
 * Allows a logged-in player to set or change their password.
 * If the player already has a password, currentPassword must be correct.
 */
export async function changePasswordAction(
  _prev: PlayerAuthState,
  formData: FormData,
): Promise<PlayerAuthState> {
  const playerId = await getPlayerSessionPlayerId();
  if (!playerId) {
    return { ok: false, message: "לא מחובר. נא להתחבר שוב." };
  }

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { passwordHash: true },
  });
  if (!player) {
    return { ok: false, message: "לא מחובר. נא להתחבר שוב." };
  }

  // If player already has a password, verify the current one first
  if (player.passwordHash) {
    const currentPassword = formData.get("currentPassword");
    if (!currentPassword || typeof currentPassword !== "string") {
      return { ok: false, message: "נא להזין את הסיסמה הנוכחית" };
    }
    const match = await compare(currentPassword, player.passwordHash);
    if (!match) {
      return { ok: false, message: "הסיסמה הנוכחית שגויה" };
    }
  }

  const parsedPassword = passwordSchema.safeParse(formData.get("newPassword"));
  if (!parsedPassword.success) {
    return { ok: false, message: parsedPassword.error.issues[0]?.message };
  }

  const confirmPassword = formData.get("confirmPassword");
  if (parsedPassword.data !== confirmPassword) {
    return { ok: false, message: "הסיסמאות אינן תואמות" };
  }

  const passwordHash = await hash(parsedPassword.data, 10);
  await prisma.player.update({
    where: { id: playerId },
    data: { passwordHash },
  });

  const isFirstTime = !player.passwordHash;
  writeAuditLog({
    actor: playerId,
    action: isFirstTime ? "PLAYER_PASSWORD_SET" : "PLAYER_PASSWORD_CHANGE",
    entityType: "Player",
    entityId: playerId,
  });

  return { ok: true, message: isFirstTime ? "הסיסמה הוגדרה בהצלחה" : "הסיסמה עודכנה בהצלחה" };
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function playerLogoutAction(): Promise<void> {
  const playerId = await getPlayerSessionPlayerId();
  writeAuditLog({
    actor: playerId ?? "unknown",
    action: "PLAYER_LOGOUT",
    entityType: playerId ? "Player" : undefined,
    entityId: playerId ?? undefined,
  });
  await clearPlayerSessionCookie();
  redirect("/");
}
