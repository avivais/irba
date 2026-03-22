import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieJar: Record<string, string> = {};

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = cookieJar[name];
      return value !== undefined ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      cookieJar[name] = value;
    },
    delete: (name: string) => {
      delete cookieJar[name];
    },
  })),
}));

import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_SUBJECT,
  clearAdminSessionCookie,
  getAdminSessionSubject,
  setAdminSessionCookie,
} from "./admin-session";

const TEST_SECRET = "0123456789abcdef0123456789abcdef";

describe("getAdminSessionSubject", () => {
  beforeEach(() => {
    Object.keys(cookieJar).forEach((k) => delete cookieJar[k]);
    process.env.ADMIN_SESSION_SECRET = TEST_SECRET;
    delete process.env.ADMIN_JWT_ISSUER;
    delete process.env.ADMIN_JWT_AUDIENCE;
  });

  afterEach(() => {
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.ADMIN_JWT_ISSUER;
    delete process.env.ADMIN_JWT_AUDIENCE;
  });

  it("returns null when ADMIN_SESSION_SECRET is missing or too short", async () => {
    delete process.env.ADMIN_SESSION_SECRET;
    expect(await getAdminSessionSubject()).toBeNull();
    process.env.ADMIN_SESSION_SECRET = "short";
    expect(await getAdminSessionSubject()).toBeNull();
  });

  it("returns null when cookie is absent", async () => {
    expect(await getAdminSessionSubject()).toBeNull();
  });

  it("returns admin subject for a valid JWT", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(ADMIN_SESSION_SUBJECT)
      .setIssuer("irba")
      .setAudience("irba-admin")
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(new TextEncoder().encode(TEST_SECRET));

    cookieJar[ADMIN_COOKIE_NAME] = token;
    expect(await getAdminSessionSubject()).toBe(ADMIN_SESSION_SUBJECT);
  });

  it("returns null when subject is not the admin sentinel", async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("other")
      .setIssuer("irba")
      .setAudience("irba-admin")
      .setIssuedAt()
      .setExpirationTime(exp)
      .sign(new TextEncoder().encode(TEST_SECRET));

    cookieJar[ADMIN_COOKIE_NAME] = token;
    expect(await getAdminSessionSubject()).toBeNull();
  });

  it("returns null for tampered token", async () => {
    cookieJar[ADMIN_COOKIE_NAME] = "not-a-jwt";
    expect(await getAdminSessionSubject()).toBeNull();
  });
});

describe("setAdminSessionCookie", () => {
  beforeEach(() => {
    Object.keys(cookieJar).forEach((k) => delete cookieJar[k]);
    process.env.ADMIN_SESSION_SECRET = TEST_SECRET;
    delete process.env.ADMIN_SESSION_MAX_AGE_SEC;
  });

  afterEach(() => {
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.ADMIN_SESSION_MAX_AGE_SEC;
  });

  it("throws when secret is not configured", async () => {
    delete process.env.ADMIN_SESSION_SECRET;
    await expect(setAdminSessionCookie()).rejects.toThrow(
      /ADMIN_SESSION_SECRET/,
    );
  });

  it("stores a verifiable cookie", async () => {
    await setAdminSessionCookie();
    expect(await getAdminSessionSubject()).toBe(ADMIN_SESSION_SUBJECT);
  });
});

describe("clearAdminSessionCookie", () => {
  beforeEach(() => {
    Object.keys(cookieJar).forEach((k) => delete cookieJar[k]);
    process.env.ADMIN_SESSION_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.ADMIN_SESSION_SECRET;
  });

  it("removes session", async () => {
    await setAdminSessionCookie();
    expect(await getAdminSessionSubject()).toBe(ADMIN_SESSION_SUBJECT);
    await clearAdminSessionCookie();
    expect(await getAdminSessionSubject()).toBeNull();
  });
});
