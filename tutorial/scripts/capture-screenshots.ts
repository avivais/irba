/**
 * Drives Playwright through the live IRBA site and saves screenshots per
 * scene to assets/screenshots/<scene>-<n>.png.
 *
 * First run:  npm run screenshots -- --login
 *   Opens a headed Chromium so you can complete OTP login. When done, hit
 *   Enter in the terminal — auth state is saved to .auth-state.json.
 *
 * Subsequent runs: npm run screenshots
 *   Loads the saved auth state, captures everything headlessly.
 *
 * Pass `--shot=<scene>` to capture only one scene.
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium, devices, type Browser, type BrowserContext, type Page } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
const OUT_DIR = resolve(ROOT, "assets/screenshots");
const AUTH_STATE_PATH = resolve(ROOT, ".auth-state.json");

const BASE_URL = process.env.IRBA_URL ?? "https://irba.club";

// Use Playwright's iPhone 14 device profile so user-agent, viewport,
// deviceScaleFactor, isMobile and hasTouch all match a real phone — sites
// that adapt to UA strings or touch capability will serve their mobile layout.
// Logical viewport is 393x852, scale 3 → screenshot pixels ≈ 1179×2556.
const DEVICE = devices["iPhone 14"];

/** Hides admin nav icons on every page so an admin's screenshots look like a
 * regular player's view. Aria-labels are stable Hebrew strings from
 * src/components/nav-links.tsx. */
const HIDE_ADMIN_CSS = `
  nav a[href^="/admin"],
  nav a[aria-label="וואטסאפ"],
  nav a[aria-label="ניהול"],
  nav a[aria-label="בדיקות"] {
    display: none !important;
  }
`;

type RsvpState = "registered" | "unregistered" | "any";

type Shot = {
  scene: string;
  index: number;
  url: string;
  /** Optional CSS selector to wait for before screenshotting. */
  waitFor?: string;
  /** Use a fresh non-authenticated context for this shot (e.g. login form). */
  unauthenticated?: boolean;
  /** Required RSVP state for this shot; only relevant for authenticated shots. */
  rsvpState?: RsvpState;
  /** Optional async setup to run on the page before screenshot. */
  prepare?: (page: Page) => Promise<void>;
};

// Order matters: groups by RSVP state so we toggle the live RSVP at most twice.
const SHOTS: Shot[] = [
  // ── Registered-state shots (currently you're RSVPed; capture these first) ──
  { scene: "intro", index: 1, url: "/", rsvpState: "registered" },
  { scene: "cancel", index: 1, url: "/", rsvpState: "registered" },
  { scene: "outro", index: 1, url: "/", rsvpState: "registered" },

  // ── Unregistered-state shots (after we cancel) ──
  { scene: "browse-sessions", index: 1, url: "/", rsvpState: "unregistered" },
  { scene: "rsvp", index: 1, url: "/", rsvpState: "unregistered" },

  // ── State-independent ──
  { scene: "profile", index: 1, url: "/profile", rsvpState: "any" },
  {
    scene: "login",
    index: 1,
    url: "/login",
    waitFor: "input[name=phone], input[type=tel]",
    unauthenticated: true,
  },
];

type Contexts = { auth: BrowserContext; anon: BrowserContext };

async function ensureAuthState(browser: Browser): Promise<void> {
  const wantLogin = process.argv.includes("--login");
  const haveState = existsSync(AUTH_STATE_PATH);

  if (haveState && !wantLogin) return;
  if (!wantLogin && !haveState) {
    console.log("No saved auth state. Re-run with `npm run screenshots -- --login`.");
    process.exit(1);
  }

  // Headed login flow
  const headed = await chromium.launch({ headless: false });
  const ctx = await headed.newContext({ ...DEVICE });
  const page = await ctx.newPage();
  await page.goto(BASE_URL);
  console.log("\nA Chromium window opened. Complete OTP login as a player.");
  console.log("When you're at /profile (or wherever logged-in lands), come back here.\n");
  const rl = createInterface({ input, output });
  await rl.question("Press Enter once login is complete… ");
  rl.close();
  await ctx.storageState({ path: AUTH_STATE_PATH });
  console.log(`Auth state saved to ${AUTH_STATE_PATH}`);
  await ctx.close();
  await headed.close();
}

async function makeContexts(browser: Browser): Promise<Contexts> {
  // Pre-set the theme so the app's next-themes provider goes dark immediately
  // on first render, no flash. Combined with colorScheme:'dark' for any media
  // queries that gate styles on prefers-color-scheme.
  const themeInit = `try { localStorage.setItem('irba-theme', 'dark'); } catch (e) {}`;

  const auth = await browser.newContext({
    ...DEVICE,
    colorScheme: "dark",
    storageState: AUTH_STATE_PATH,
  });
  await auth.addInitScript(themeInit);

  const anon = await browser.newContext({
    ...DEVICE,
    colorScheme: "dark",
  });
  await anon.addInitScript(themeInit);

  return { auth, anon };
}

/** Detects current RSVP state on the homepage by which submit button is present.
 * - Registered → CancelRsvpForm shows a "ביטול הגעה" button
 * - Unregistered → AuthenticatedRsvpForm shows an "אני מגיע" submit button */
async function detectRsvpState(page: Page): Promise<"registered" | "unregistered" | "unknown"> {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForTimeout(400);
  if ((await page.locator('button:has-text("ביטול הגעה")').first().count()) > 0) return "registered";
  if ((await page.locator('button:has-text("אני מגיע")').first().count()) > 0) return "unregistered";
  return "unknown";
}

/** Toggle RSVP state. Cancel has a 2-step confirm UI; register is single-click. */
async function setRsvpState(page: Page, target: "registered" | "unregistered") {
  const current = await detectRsvpState(page);
  if (current === target) return;
  if (current === "unknown") {
    throw new Error("Could not detect RSVP state — neither cancel nor register button found");
  }
  console.log(`  · toggling RSVP: ${current} → ${target}`);

  if (target === "unregistered") {
    // Step 1: open the confirmation panel (replaces the "ביטול הגעה" button
    // with a "כן, בטל" / "לא" pair — see CancelRsvpForm.tsx).
    await page.locator('button:has-text("ביטול הגעה")').first().click();
    await page.locator('button:has-text("כן, בטל")').first().waitFor({ timeout: 5_000 });
    // Step 2: confirm — this submits the form.
    await page.locator('button:has-text("כן, בטל")').first().click();
  } else {
    // Single-click register submit.
    await page.locator('button:has-text("אני מגיע")').first().click();
  }

  // Server action returns + revalidates — give it time, then re-detect.
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1_500);
  const after = await detectRsvpState(page);
  if (after !== target) {
    throw new Error(`RSVP toggle failed: expected ${target}, got ${after}`);
  }
}

async function captureShot(page: Page, shot: Shot) {
  // Force a clean navigation by hitting about:blank first — re-visiting the
  // same URL in a SPA can leave React state stale and cause `waitForSelector`
  // to time out even though the URL appears to load.
  await page.goto("about:blank");
  await page.goto(`${BASE_URL}${shot.url}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  // Wait for *any* meaningful content. `body` always exists once parsing is
  // done; the explicit timeout below covers React hydration time.
  await page.waitForSelector("body", { state: "attached", timeout: 5_000 });
  if (shot.waitFor) {
    // Best-effort: don't fail the shot if the optional selector isn't present
    // (e.g. when the page legitimately doesn't show that content yet).
    await page
      .waitForSelector(shot.waitFor, { timeout: 5_000, state: "visible" })
      .catch(() => {});
  }
  // Inject admin-hiding CSS post-navigation
  await page.addStyleTag({ content: HIDE_ADMIN_CSS });
  if (shot.prepare) await shot.prepare(page);
  // Wait for fonts/images to settle, then a small pause for layout shifts
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.waitForTimeout(500);
  const out = resolve(OUT_DIR, `${shot.scene}-${shot.index}.png`);
  // fullPage=true captures the entire scrollable page — we can animate-scroll
  // through tall screenshots in Remotion so the viewer sees all content.
  await page.screenshot({ path: out, fullPage: true });
  return out;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const onlyArg = process.argv.find((a) => a.startsWith("--shot="));
  const only = onlyArg ? onlyArg.split("=")[1] : null;

  const browser = await chromium.launch({ headless: true });
  await ensureAuthState(browser);
  const { auth, anon } = await makeContexts(browser);

  // One page per context, reused across shots. Avoids newPage churn and any
  // weirdness from many tabs sharing cookies on a polling-heavy page.
  const authPage = await auth.newPage();
  const anonPage = await anon.newPage();

  // Detect the original RSVP state so we can restore it at the end.
  const originalState = await detectRsvpState(authPage);
  console.log(`Original RSVP state: ${originalState}`);

  let currentState: "registered" | "unregistered" | "unknown" = originalState;

  try {
    for (const shot of SHOTS) {
      if (only && shot.scene !== only) continue;

      // Toggle RSVP if the shot needs a different state
      if (
        !shot.unauthenticated &&
        shot.rsvpState &&
        shot.rsvpState !== "any" &&
        currentState !== shot.rsvpState
      ) {
        await setRsvpState(authPage, shot.rsvpState);
        currentState = shot.rsvpState;
      }

      process.stdout.write(`… ${shot.scene}-${shot.index} ${shot.url} `);
      try {
        const page = shot.unauthenticated ? anonPage : authPage;
        const out = await captureShot(page, shot);
        console.log(`✓ ${out.replace(ROOT + "/", "")}`);
      } catch (e) {
        console.log(`✗ ${e instanceof Error ? e.message.split("\n")[0] : e}`);
      }
    }
  } finally {
    // Always restore original state, even if a shot threw mid-run.
    if (
      originalState !== "unknown" &&
      currentState !== "unknown" &&
      currentState !== originalState
    ) {
      console.log(`\nRestoring original RSVP state: ${currentState} → ${originalState}`);
      try {
        await setRsvpState(authPage, originalState);
      } catch (e) {
        console.error(`⚠️  Failed to restore RSVP state — please check manually: ${e}`);
      }
    }
  }

  await authPage.close();
  await anonPage.close();
  await auth.close();
  await anon.close();
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
