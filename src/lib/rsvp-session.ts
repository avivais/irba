import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const RSVP_COOKIE_NAME = "irba_rsvp_session";

function getSigningKey(): Uint8Array {
  const secret = process.env.RSVP_SESSION_SECRET;
  // HS256: require a sufficiently long secret to reduce brute-force risk.
  if (!secret || secret.length < 32) {
    throw new Error("RSVP_SESSION_SECRET must be set to at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function setRsvpSessionCookie(playerId: string): Promise<void> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(playerId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSigningKey());

  const store = await cookies();
  store.set(RSVP_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
    });
    const sub = payload.sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}
