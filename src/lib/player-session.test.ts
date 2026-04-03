import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar: Record<string, { value: string; maxAge?: number }> = {};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const entry = cookieJar[name];
      return entry !== undefined ? { name, value: entry.value } : undefined;
    },
    set: (name: string, value: string, opts?: { maxAge?: number }) => {
      cookieJar[name] = { value, maxAge: opts?.maxAge };
    },
    delete: (name: string) => {
      delete cookieJar[name];
    },
  })),
}));

import {
  PLAYER_COOKIE_NAME,
  clearPlayerSessionCookie,
  getPlayerSession,
  getPlayerSessionPlayerId,
  setPlayerSessionCookie,
} from "./player-session";

const TEST_SECRET = "0123456789abcdef0123456789abcdef";
const TEST_PLAYER_ID = "cltest000000000000000000000";

describe("getPlayerSession", () => {
  beforeEach(() => {
    Object.keys(cookieJar).forEach((k) => delete cookieJar[k]);
    process.env.PLAYER_SESSION_SECRET = TEST_SECRET;
    delete process.env.PLAYER_JWT_ISSUER;
    delete process.env.PLAYER_JWT_AUDIENCE;
  });

  afterEach(() => {
    delete process.env.PLAYER_SESSION_SECRET;
  });

  it("returns null when PLAYER_SESSION_SECRET is missing", async () => {
    delete process.env.PLAYER_SESSION_SECRET;
    expect(await getPlayerSession()).toBeNull();
  });

  it("returns null when secret is too short", async () => {
    process.env.PLAYER_SESSION_SECRET = "short";
    expect(await getPlayerSession()).toBeNull();
  });

  it("returns null when cookie is absent", async () => {
    expect(await getPlayerSession()).toBeNull();
  });

  it("returns session for a valid rememberMe JWT", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = await new SignJWT({ rememberMe: true })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(TEST_PLAYER_ID)
      .setIssuer("irba")
      .setAudience("irba-player")
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(new TextEncoder().encode(TEST_SECRET));

    cookieJar[PLAYER_COOKIE_NAME] = { value: token };
    const session = await getPlayerSession();
    expect(session).not.toBeNull();
    expect(session?.playerId).toBe(TEST_PLAYER_ID);
    expect(session?.isRemembered).toBe(true);
  });

  it("returns isRemembered=false when claim is false", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = await new SignJWT({ rememberMe: false })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(TEST_PLAYER_ID)
      .setIssuer("irba")
      .setAudience("irba-player")
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(new TextEncoder().encode(TEST_SECRET));

    cookieJar[PLAYER_COOKIE_NAME] = { value: token };
    const session = await getPlayerSession();
    expect(session?.isRemembered).toBe(false);
  });

  it("returns null for tampered token", async () => {
    cookieJar[PLAYER_COOKIE_NAME] = { value: "not-a-jwt" };
    expect(await getPlayerSession()).toBeNull();
  });

  it("returns null for expired token", async () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    const token = await new SignJWT({ rememberMe: false })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(TEST_PLAYER_ID)
      .setIssuer("irba")
      .setAudience("irba-player")
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(new TextEncoder().encode(TEST_SECRET));

    cookieJar[PLAYER_COOKIE_NAME] = { value: token };
    expect(await getPlayerSession()).toBeNull();
  });
});

describe("setPlayerSessionCookie", () => {
  beforeEach(() => {
    Object.keys(cookieJar).forEach((k) => delete cookieJar[k]);
    process.env.PLAYER_SESSION_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.PLAYER_SESSION_SECRET;
  });

  it("throws when secret is not configured", async () => {
    delete process.env.PLAYER_SESSION_SECRET;
    await expect(
      setPlayerSessionCookie(TEST_PLAYER_ID, true),
    ).rejects.toThrow(/PLAYER_SESSION_SECRET/);
  });

  it("rememberMe=true sets maxAge and stores verifiable cookie", async () => {
    await setPlayerSessionCookie(TEST_PLAYER_ID, true);
    expect(cookieJar[PLAYER_COOKIE_NAME]?.maxAge).toBe(60 * 60 * 24 * 30);
    const session = await getPlayerSession();
    expect(session?.playerId).toBe(TEST_PLAYER_ID);
    expect(session?.isRemembered).toBe(true);
  });

  it("rememberMe=false sets no maxAge (session cookie)", async () => {
    await setPlayerSessionCookie(TEST_PLAYER_ID, false);
    expect(cookieJar[PLAYER_COOKIE_NAME]?.maxAge).toBeUndefined();
    const session = await getPlayerSession();
    expect(session?.playerId).toBe(TEST_PLAYER_ID);
    expect(session?.isRemembered).toBe(false);
  });
});

describe("getPlayerSessionPlayerId", () => {
  beforeEach(() => {
    Object.keys(cookieJar).forEach((k) => delete cookieJar[k]);
    process.env.PLAYER_SESSION_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.PLAYER_SESSION_SECRET;
  });

  it("returns playerId when session is valid", async () => {
    await setPlayerSessionCookie(TEST_PLAYER_ID, false);
    expect(await getPlayerSessionPlayerId()).toBe(TEST_PLAYER_ID);
  });

  it("returns null when no session", async () => {
    expect(await getPlayerSessionPlayerId()).toBeNull();
  });
});

describe("clearPlayerSessionCookie", () => {
  beforeEach(() => {
    Object.keys(cookieJar).forEach((k) => delete cookieJar[k]);
    process.env.PLAYER_SESSION_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.PLAYER_SESSION_SECRET;
  });

  it("removes the session", async () => {
    await setPlayerSessionCookie(TEST_PLAYER_ID, true);
    expect(await getPlayerSessionPlayerId()).toBe(TEST_PLAYER_ID);
    await clearPlayerSessionCookie();
    expect(await getPlayerSessionPlayerId()).toBeNull();
  });
});
