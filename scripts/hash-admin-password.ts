/**
 * Dev-only: hashes an admin password and writes ADMIN_PASSWORD_HASH to `.env`.
 * Password is echoed to the terminal by readline — use in a trusted environment.
 *
 * Flags:
 *   --print-only  Do not modify `.env`; only print the line (legacy behavior).
 *   --env-file=X  Target file (default: `.env` in cwd).
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { applyAdminPasswordHashToEnvContent } from "../src/lib/admin-password-env";
import { hash } from "bcryptjs";

const KEY = "ADMIN_PASSWORD_HASH";

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

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const pwd = await rl.question("Admin password (visible as you type): ");
  await rl.close();
  if (!pwd.trim()) {
    console.error("Aborted: empty password.");
    process.exit(1);
  }
  const h = await hash(pwd, 12);

  if (printOnly) {
    console.log("\nAdd to .env (hash only; never commit real secrets):");
    console.log(applyAdminPasswordHashToEnvContent("", h).trim());
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

  const next = applyAdminPasswordHashToEnvContent(raw, h);
  await fs.writeFile(envFile, next, "utf8");
  console.log(`\nUpdated ${path.relative(process.cwd(), envFile) || envFile} with ${KEY}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
