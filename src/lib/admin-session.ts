import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cookieSecure } from "@/lib/cookie-secure";

export const ADMIN_COOKIE_NAME = "irba_admin_session";

/** Fixed subject for single-operator MVP (no DB-backed admin user in this spike). */
export const ADMIN_SESSION_SUBJECT = "admin";

function jwtIssuer(): string {
  return process.env.ADMIN_JWT_ISSUER ?? "irba";
}

function jwtAudience(): string {
  return process.env.ADMIN_JWT_AUDIENCE ?? "irba-admin";
}

/** Default session length — align maxAge with JWT exp. */
function sessionMaxAgeSeconds(): number {
  const raw = process.env.ADMIN_SESSION_MAX_AGE_SEC;
  if (raw == null || raw === "") return 60 * 60 * 24 * 14;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 300 || n > 60 * 60 * 24 * 90) {
    return 60 * 60 * 24 * 14;
  }
  return n;
}

function getSigningKeyOrNull(): Uint8Array | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

function getSigningKeyForIssue(): Uint8Array {
  const key = getSigningKeyOrNull();
  if (!key) {
    throw new Error(
      "ADMIN_SESSION_SECRET must be set to at least 32 characters",
    );
  }
  return key;
}

export async function setAdminSessionCookie(): Promise<void> {
  const maxAge = sessionMaxAgeSeconds();
  const issuer = jwtIssuer();
  const audience = jwtAudience();
  const exp = Math.floor(Date.now() / 1000) + maxAge;
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(ADMIN_SESSION_SUBJECT)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(getSigningKeyForIssue());

  const store = await cookies();
  store.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE_NAME);
}

/**
 * Returns admin subject when the cookie is valid; null if missing, invalid, or secret not configured.
 * Verification must not throw so builds and public routes stay stable without admin env.
 */
export async function getAdminSessionSubject(): Promise<string | null> {
  const key = getSigningKeyOrNull();
  if (!key) return null;

  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: jwtIssuer(),
      audience: jwtAudience(),
    });
    const sub = payload.sub;
    return sub === ADMIN_SESSION_SUBJECT ? ADMIN_SESSION_SUBJECT : null;
  } catch {
    return null;
  }
}
