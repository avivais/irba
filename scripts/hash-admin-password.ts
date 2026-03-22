/**
 * Dev-only: hashes an admin password for ADMIN_PASSWORD_HASH.
 * Password is echoed to the terminal by readline — use in a trusted environment.
 */
import * as readline from "node:readline/promises";
import { hash } from "bcryptjs";

async function main() {
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
  console.log("\nAdd to .env (hash only; never commit real secrets):");
  console.log(`ADMIN_PASSWORD_HASH=${h}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
