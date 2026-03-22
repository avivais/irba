const KEY = "ADMIN_PASSWORD_HASH";

/** Dotenv-safe double-quoted value (bcrypt hashes have no quotes). */
export function quotedEnvValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Replaces an existing ADMIN_PASSWORD_HASH line or appends one.
 * Preserves other lines; ensures file ends with a newline after append.
 */
export function applyAdminPasswordHashToEnvContent(
  content: string,
  hashValue: string,
): string {
  const newLine = `${KEY}=${quotedEnvValue(hashValue)}`;
  const lineRegex = new RegExp(`^\\s*${KEY}=.*$`, "m");
  if (lineRegex.test(content)) {
    return content.replace(lineRegex, newLine);
  }
  const endsWithNl = content.endsWith("\n");
  const prefix =
    content.length === 0 ? "" : endsWithNl ? content : `${content}\n`;
  return `${prefix}${newLine}\n`;
}
