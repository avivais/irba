const KEY = "ADMIN_PASSWORD_HASH";

/**
 * Wraps value for `.env` in single quotes so dotenv reads it literally.
 *
 * Single-quoted dotenv values are parsed as-is — no variable expansion,
 * no escape processing. `$` characters in bcrypt hashes are safe as-is.
 * Any single quotes inside the value are handled with shell-style escaping.
 */
export function envSafeValue(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
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
 * Removes every occurrence of `key=...` then appends one canonical line at the end.
 * Avoids duplicate keys where dotenv would keep the first (often empty) value.
 */
export function upsertEnvKey(
  content: string,
  key: string,
  formattedValue: string,
): string {
  const newLine = `${key}=${formattedValue}`;
  const keyRegex = new RegExp(`^\\s*${key}=`, "");
  const lines = content.split(/\r?\n/);
  const filtered = lines.filter((line) => !keyRegex.test(line));
  const body = filtered.join("\n");
  const prefix =
    body.length === 0 ? "" : body.endsWith("\n") ? body : `${body}\n`;
  return `${prefix}${newLine}\n`;
}

/**
 * Removes every ADMIN_PASSWORD_HASH line, then appends one with proper escaping.
 */
export function applyAdminPasswordHashToEnvContent(
  content: string,
  hashValue: string,
): string {
  return upsertEnvKey(content, KEY, envSafeValue(hashValue));
}
