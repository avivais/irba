/**
 * Shared Secure flag for HttpOnly session cookies (RSVP + admin).
 * RSVP_COOKIE_SECURE forces HTTPS cookies when NODE_ENV is not production (e.g. staging).
 */
export function cookieSecure(): boolean {
  const v = process.env.RSVP_COOKIE_SECURE?.toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  return process.env.NODE_ENV === "production";
}
