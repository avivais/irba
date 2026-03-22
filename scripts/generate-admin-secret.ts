/**
 * Generates a random ADMIN_SESSION_SECRET and writes it to `.env`.
 * Safe to re-run — replaces an existing line or appends a new one.
 * Note: rotating the secret logs out the current admin session.
 *
 * Flags:
 *   --print-only  Print the line instead of writing `.env`.
 *   --env-file=X  Target file (default: `.env` in cwd).
 */
import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { upsertEnvKey } from "../src/lib/admin-password-env";

const KEY = "ADMIN_SESSION_SECRET";

function parseArgs(argv: string[]) {
  let printOnly = false;
  let envFile = path.resolve(process.cwd(), ".env");
  for (const a of argv) {
    if (a === "--print-only") printOnly = true;
    else if (a.startsWith("--env-file="))
      envFile = path.resolve(process.cwd(), a.slice("--env-file=".length));
  }
  return { printOnly, envFile };
}

async function main() {
  const { printOnly, envFile } = parseArgs(process.argv.slice(2));

  const secret = crypto.randomBytes(32).toString("hex");
  const formatted = `"${secret}"`;

  if (printOnly) {
    console.log(`${KEY}=${formatted}`);
    return;
  }

  let raw: string;
  try {
    raw = await fs.readFile(envFile, "utf8");
  } catch {
    console.error(
      `Could not read ${envFile}. Copy .env.example to .env first, then run again.`,
    );
    process.exit(1);
  }

  const next = upsertEnvKey(raw, KEY, formatted);
  await fs.writeFile(envFile, next, "utf8");
  console.log(
    `Updated ${path.relative(process.cwd(), envFile) || envFile} with ${KEY}.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
