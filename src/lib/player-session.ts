import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { cookieSecure } from "@/lib/cookie-secure";

export const PLAYER_COOKIE_NAME = "irba_player_session";

const SESSION_30D_SECONDS = 60 * 60 * 24 * 30;
const SESSION_12H_SECONDS = 60 * 60 * 12;

function jwtIssuer(): string {
  return process.env.PLAYER_JWT_ISSUER ?? "irba";
}

function jwtAudience(): string {
  return process.env.PLAYER_JWT_AUDIENCE ?? "irba-player";
}

function getSigningKeyOrNull(): Uint8Array | null {
  const secret = process.env.PLAYER_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

function getSigningKeyForIssue(): Uint8Array {
  const key = getSigningKeyOrNull();
  if (!key) {
    throw new Error(
      "PLAYER_SESSION_SECRET must be set to at least 32 characters",
    );
  }
  return key;
}

/**
 * Issues a player session cookie.
 * rememberMe=true  → persisted 30-day cookie, JWT exp +30d
 * rememberMe=false → session cookie (no maxAge), JWT exp +12h safety net
 */
export async function setPlayerSessionCookie(
  playerId: string,
  rememberMe: boolean,
): Promise<void> {
  const issuer = jwtIssuer();
  const audience = jwtAudience();
  const expSeconds = rememberMe ? SESSION_30D_SECONDS : SESSION_12H_SECONDS;
  const exp = Math.floor(Date.now() / 1000) + expSeconds;

  const token = await new SignJWT({ rememberMe })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(playerId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(getSigningKeyForIssue());

  const store = await cookies();
  store.set(PLAYER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    ...(rememberMe ? { maxAge: SESSION_30D_SECONDS } : {}),
  });
}

export async function clearPlayerSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(PLAYER_COOKIE_NAME);
}

/** Returns playerId or null if cookie is missing/invalid/secret not configured. */
export async function getPlayerSessionPlayerId(): Promise<string | null> {
  const session = await getPlayerSession();
  return session?.playerId ?? null;
}

/** Returns full session payload or null. */
export async function getPlayerSession(): Promise<{
  playerId: string;
  isRemembered: boolean;
} | null> {
  const key = getSigningKeyOrNull();
  if (!key) return null;

  const store = await cookies();
  const token = store.get(PLAYER_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer: jwtIssuer(),
      audience: jwtAudience(),
    });
    const playerId = payload.sub;
    if (!playerId) return null;
    return {
      playerId,
      isRemembered: payload.rememberMe === true,
    };
  } catch {
    return null;
  }
}
