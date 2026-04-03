import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearAdminLoginRateLimitStoreForTests,
  clearPlayerLoginRateLimitStoreForTests,
  clearRsvpRateLimitStoreForTests,
  consumeAdminLoginRateLimit,
  consumePlayerLoginRateLimit,
  consumeRsvpRateLimit,
  getClientIpFromHeaders,
  slidingWindowAllow,
} from "./rate-limit";

describe("getClientIpFromHeaders", () => {
  it("prefers cf-connecting-ip", () => {
    expect(
      getClientIpFromHeaders((n) =>
        n === "cf-connecting-ip" ? "203.0.113.5" : null,
      ),
    ).toBe("203.0.113.5");
  });

  it("uses first address in x-forwarded-for chain", () => {
    expect(
      getClientIpFromHeaders((n) =>
        n === "x-forwarded-for"
          ? "198.51.100.1, 10.0.0.1"
          : null,
      ),
    ).toBe("198.51.100.1");
  });

  it("falls back to x-real-ip", () => {
    expect(
      getClientIpFromHeaders((n) =>
        n === "x-real-ip" ? "192.0.2.8" : null,
      ),
    ).toBe("192.0.2.8");
  });

  it("returns sentinel when no proxy headers", () => {
    expect(getClientIpFromHeaders(() => null)).toBe("__unknown__");
  });
});

describe("slidingWindowAllow", () => {
  it("allows up to max hits within the window", () => {
    const bucket = new Map<string, number[]>();
    const t0 = 1_000_000;
    expect(slidingWindowAllow(bucket, "k", 2, 60_000, t0)).toBe(true);
    expect(slidingWindowAllow(bucket, "k", 2, 60_000, t0 + 1000)).toBe(true);
    expect(slidingWindowAllow(bucket, "k", 2, 60_000, t0 + 2000)).toBe(false);
  });

  it("drops timestamps outside the window", () => {
    const bucket = new Map<string, number[]>();
    const windowMs = 60_000;
    expect(slidingWindowAllow(bucket, "k", 1, windowMs, 0)).toBe(true);
    expect(slidingWindowAllow(bucket, "k", 1, windowMs, 30_000)).toBe(false);
    expect(slidingWindowAllow(bucket, "k", 1, windowMs, 61_000)).toBe(true);
  });
});

describe("consumeRsvpRateLimit", () => {
  beforeEach(() => {
    clearRsvpRateLimitStoreForTests();
    delete process.env.IRBA_RL_ATTEND_MAX;
    delete process.env.IRBA_RL_ATTEND_WINDOW_MS;
    delete process.env.IRBA_RL_CANCEL_MAX;
    delete process.env.IRBA_RL_CANCEL_WINDOW_MS;
  });

  afterEach(() => {
    clearRsvpRateLimitStoreForTests();
    delete process.env.IRBA_RL_ATTEND_MAX;
    delete process.env.IRBA_RL_ATTEND_WINDOW_MS;
    delete process.env.IRBA_RL_CANCEL_MAX;
    delete process.env.IRBA_RL_CANCEL_WINDOW_MS;
  });

  it("respects IRBA_RL_ATTEND_MAX and window", () => {
    process.env.IRBA_RL_ATTEND_MAX = "2";
    process.env.IRBA_RL_ATTEND_WINDOW_MS = "60000";
    const ip = "10.0.0.1";
    const now = 500_000;
    expect(consumeRsvpRateLimit("attend", ip, now)).toBe(true);
    expect(consumeRsvpRateLimit("attend", ip, now + 1000)).toBe(true);
    expect(consumeRsvpRateLimit("attend", ip, now + 2000)).toBe(false);
  });
});

describe("consumeAdminLoginRateLimit", () => {
  beforeEach(() => {
    clearAdminLoginRateLimitStoreForTests();
    delete process.env.IRBA_RL_ADMIN_LOGIN_MAX;
    delete process.env.IRBA_RL_ADMIN_LOGIN_WINDOW_MS;
  });

  afterEach(() => {
    clearAdminLoginRateLimitStoreForTests();
    delete process.env.IRBA_RL_ADMIN_LOGIN_MAX;
    delete process.env.IRBA_RL_ADMIN_LOGIN_WINDOW_MS;
  });

  it("respects IRBA_RL_ADMIN_LOGIN_MAX and window", () => {
    process.env.IRBA_RL_ADMIN_LOGIN_MAX = "2";
    process.env.IRBA_RL_ADMIN_LOGIN_WINDOW_MS = "60000";
    const ip = "10.0.0.2";
    const now = 700_000;
    expect(consumeAdminLoginRateLimit(ip, now)).toBe(true);
    expect(consumeAdminLoginRateLimit(ip, now + 1000)).toBe(true);
    expect(consumeAdminLoginRateLimit(ip, now + 2000)).toBe(false);
  });
});

describe("consumePlayerLoginRateLimit", () => {
  beforeEach(() => {
    clearPlayerLoginRateLimitStoreForTests();
    delete process.env.IRBA_RL_PLAYER_LOGIN_MAX;
    delete process.env.IRBA_RL_PLAYER_LOGIN_WINDOW_MS;
  });

  afterEach(() => {
    clearPlayerLoginRateLimitStoreForTests();
    delete process.env.IRBA_RL_PLAYER_LOGIN_MAX;
    delete process.env.IRBA_RL_PLAYER_LOGIN_WINDOW_MS;
  });

  it("respects IRBA_RL_PLAYER_LOGIN_MAX and window", () => {
    process.env.IRBA_RL_PLAYER_LOGIN_MAX = "2";
    process.env.IRBA_RL_PLAYER_LOGIN_WINDOW_MS = "60000";
    const ip = "10.0.0.3";
    const now = 900_000;
    expect(consumePlayerLoginRateLimit(ip, now)).toBe(true);
    expect(consumePlayerLoginRateLimit(ip, now + 1000)).toBe(true);
    expect(consumePlayerLoginRateLimit(ip, now + 2000)).toBe(false);
  });

  it("resets after the window expires", () => {
    process.env.IRBA_RL_PLAYER_LOGIN_MAX = "1";
    process.env.IRBA_RL_PLAYER_LOGIN_WINDOW_MS = "60000";
    const ip = "10.0.0.4";
    const now = 1_000_000;
    expect(consumePlayerLoginRateLimit(ip, now)).toBe(true);
    expect(consumePlayerLoginRateLimit(ip, now + 30_000)).toBe(false);
    expect(consumePlayerLoginRateLimit(ip, now + 61_000)).toBe(true);
  });

  it("uses separate bucket from admin login", () => {
    process.env.IRBA_RL_PLAYER_LOGIN_MAX = "1";
    process.env.IRBA_RL_ADMIN_LOGIN_MAX = "1";
    process.env.IRBA_RL_PLAYER_LOGIN_WINDOW_MS = "60000";
    process.env.IRBA_RL_ADMIN_LOGIN_WINDOW_MS = "60000";
    const ip = "10.0.0.5";
    const now = 1_100_000;
    // Exhaust admin bucket
    consumeAdminLoginRateLimit(ip, now);
    // Player bucket should still be open
    expect(consumePlayerLoginRateLimit(ip, now)).toBe(true);
  });
});
