/**
 * In-memory sliding-window limits per app process (see README: multi-replica needs Redis, etc.).
 * Keys must never include PII — we use action kind + client IP from trusted proxy headers only.
 */

const store = new Map<string, number[]>();
const adminLoginStore = new Map<string, number[]>();
const playerLoginStore = new Map<string, number[]>();
const otpSendStore = new Map<string, number[]>();

function parsePositiveInt(env: string | undefined, fallback: number): number {
  if (env == null || env === "") return fallback;
  const n = Number.parseInt(env, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Extract client IP for rate limiting. Prefer CDN-specific header, then reverse-proxy headers.
 * Leftmost X-Forwarded-For is the original client when proxies append.
 */
export function getClientIpFromHeaders(
  getHeader: (name: string) => string | null | undefined,
): string {
  const cf = getHeader("cf-connecting-ip")?.trim();
  if (cf) return cf.split(",")[0]!.trim();

  const realIp = getHeader("x-real-ip")?.trim();
  if (realIp) return realIp.split(",")[0]!.trim();

  const xff = getHeader("x-forwarded-for")?.trim();
  if (xff) return xff.split(",")[0]!.trim();

  return "__unknown__";
}

/** Internal primitive: returns whether the request is allowed (and records this hit). */
export function slidingWindowAllow(
  bucket: Map<string, number[]>,
  key: string,
  max: number,
  windowMs: number,
  now: number,
): boolean {
  let timestamps = bucket.get(key) ?? [];
  timestamps = timestamps.filter((t) => now - t < windowMs);
  if (timestamps.length >= max) {
    bucket.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  bucket.set(key, timestamps);
  return true;
}

export function consumeAdminLoginRateLimit(ip: string, now = Date.now()): boolean {
  const max = parsePositiveInt(process.env.IRBA_RL_ADMIN_LOGIN_MAX, 10);
  const windowMs = parsePositiveInt(
    process.env.IRBA_RL_ADMIN_LOGIN_WINDOW_MS,
    15 * 60 * 1000,
  );
  return slidingWindowAllow(
    adminLoginStore,
    `admin-login:${ip}`,
    max,
    windowMs,
    now,
  );
}

export function consumeRsvpRateLimit(
  kind: "attend" | "cancel",
  ip: string,
  now = Date.now(),
): boolean {
  const attend = kind === "attend";
  const max = parsePositiveInt(
    attend ? process.env.IRBA_RL_ATTEND_MAX : process.env.IRBA_RL_CANCEL_MAX,
    attend ? 15 : 30,
  );
  const windowMs = parsePositiveInt(
    attend ? process.env.IRBA_RL_ATTEND_WINDOW_MS : process.env.IRBA_RL_CANCEL_WINDOW_MS,
    15 * 60 * 1000,
  );
  return slidingWindowAllow(store, `${kind}:${ip}`, max, windowMs, now);
}

export function consumePlayerLoginRateLimit(ip: string, now = Date.now()): boolean {
  const max = parsePositiveInt(process.env.IRBA_RL_PLAYER_LOGIN_MAX, 10);
  const windowMs = parsePositiveInt(
    process.env.IRBA_RL_PLAYER_LOGIN_WINDOW_MS,
    15 * 60 * 1000,
  );
  return slidingWindowAllow(
    playerLoginStore,
    `player-login:${ip}`,
    max,
    windowMs,
    now,
  );
}

/**
 * OTP send: stricter limiter applied only when an OTP is being *issued* (which
 * costs a WhatsApp send). Both the per-phone and per-IP buckets must allow the
 * request — phone alone protects an individual victim from spam, IP alone
 * protects the WA budget when an attacker rotates phone numbers from one host.
 *
 * Defaults: 3 sends per phone per 10 min, 5 sends per IP per 10 min.
 */
export function consumeOtpSendRateLimit(
  phone: string,
  ip: string,
  now = Date.now(),
): boolean {
  const phoneMax = parsePositiveInt(process.env.IRBA_RL_OTP_SEND_PHONE_MAX, 3);
  const ipMax = parsePositiveInt(process.env.IRBA_RL_OTP_SEND_IP_MAX, 5);
  const windowMs = parsePositiveInt(
    process.env.IRBA_RL_OTP_SEND_WINDOW_MS,
    10 * 60 * 1000,
  );
  const phoneOk = slidingWindowAllow(
    otpSendStore,
    `otp-send-phone:${phone}`,
    phoneMax,
    windowMs,
    now,
  );
  if (!phoneOk) return false;
  return slidingWindowAllow(
    otpSendStore,
    `otp-send-ip:${ip}`,
    ipMax,
    windowMs,
    now,
  );
}

/** Vitest only — clears process-local counters between tests. */
export function clearRsvpRateLimitStoreForTests(): void {
  store.clear();
}

/** Vitest only — clears admin login rate limit bucket. */
export function clearAdminLoginRateLimitStoreForTests(): void {
  adminLoginStore.clear();
}

/** Vitest only — clears player login rate limit bucket. */
export function clearPlayerLoginRateLimitStoreForTests(): void {
  playerLoginStore.clear();
}

/** Vitest only — clears OTP send rate limit bucket. */
export function clearOtpSendRateLimitStoreForTests(): void {
  otpSendStore.clear();
}
