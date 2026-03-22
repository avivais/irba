import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cookieSecure } from "@/lib/cookie-secure";

export const RSVP_COOKIE_NAME = "irba_rsvp_session";

/** Stable issuer claim — override only if you run multiple logical apps on one secret (not typical). */
function jwtIssuer(): string {
  return process.env.RSVP_JWT_ISSUER ?? "irba";
}

/** Audience ties tokens to this app so cookies from another deploy or product are rejected. */
function jwtAudience(): string {
  return process.env.RSVP_JWT_AUDIENCE ?? "irba-rsvp";
}

function getSigningKey(): Uint8Array {
  const secret = process.env.RSVP_SESSION_SECRET;
  // HS256: require a sufficiently long secret to reduce brute-force risk.
  if (!secret || secret.length < 32) {
    throw new Error("RSVP_SESSION_SECRET must be set to at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function setRsvpSessionCookie(playerId: string): Promise<void> {
  const issuer = jwtIssuer();
  const audience = jwtAudience();
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(playerId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSigningKey());

  const store = await cookies();
  store.set(RSVP_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearRsvpSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(RSVP_COOKIE_NAME);
}

/** Returns player id from signed cookie, or null if missing/invalid. */
export async function getSessionPlayerId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(RSVP_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSigningKey(), {
      algorithms: ["HS256"],
      issuer: jwtIssuer(),
      audience: jwtAudience(),
    });
    const sub = payload.sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}
