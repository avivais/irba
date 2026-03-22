const KEY = "ADMIN_PASSWORD_HASH";

/**
 * Next.js loads `.env` with dotenv-expand. Inside double-quoted values, `$foo`
 * is treated as interpolation, which corrupts bcrypt hashes (`$2`, `$12`, …).
 * Write each literal `$` as `$$` in the file so expansion yields a single `$`.
 */
export function escapeDollarsForDotenvExpand(s: string): string {
  return s.replace(/\$/g, "$$$$");
}

/** Dotenv-safe double-quoted value for Next.js (escapes `\`, `"`, and `$`). */
export function quotedEnvValue(value: string): string {
  const escaped = escapeDollarsForDotenvExpand(
    value.replace(/\\/g, "\\\\").replace(/"/g, '\\"'),
  );
  return `"${escaped}"`;
}

/**
 * Normalizes hash read from process.env (strip whitespace; optional wrapping quotes).
 * Returns null if missing or not bcrypt-shaped.
 */
export function normalizeAdminPasswordHashFromEnv(
  raw: string | undefined,
): string | null {
  if (raw == null) return null;
  let h = raw.trim();
  if (h.length === 0) return null;
  if (
    (h.startsWith('"') && h.endsWith('"')) ||
    (h.startsWith("'") && h.endsWith("'"))
  ) {
    h = h.slice(1, -1).trim();
  }
  if (!h.startsWith("$2")) return null;
  return h;
}

/**
 * Removes every ADMIN_PASSWORD_HASH line, then appends one canonical line at the end.
 * Avoids duplicate keys where dotenv would keep the first (often empty) value.
 */
export function applyAdminPasswordHashToEnvContent(
  content: string,
  hashValue: string,
): string {
  const newLine = `${KEY}=${quotedEnvValue(hashValue)}`;
  const lines = content.split(/\r?\n/);
  const filtered = lines.filter(
    (line) => !new RegExp(`^\\s*${KEY}=`).test(line),
  );
  const body = filtered.join("\n");
  const prefix =
    body.length === 0 ? "" : body.endsWith("\n") ? body : `${body}\n`;
  return `${prefix}${newLine}\n`;
}
