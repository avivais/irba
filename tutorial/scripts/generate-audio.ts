/**
 * Reads src/script.json, generates an MP3 per scene under assets/audio/<id>.mp3.
 * Also writes assets/audio/durations.json with each clip's length in seconds —
 * Remotion reads it synchronously to size each scene to its narration.
 *
 * Skips scenes whose audio already exists unless --force is passed.
 *
 * Run with: npm run tts            # incremental
 *           npm run tts -- --force # regenerate all
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { synthesise } from "../src/lib/azure-tts.js";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");
dotenv.config({ path: resolve(ROOT, ".env.local") });

type Scene = { id: string; title: string; text: string };

const force = process.argv.includes("--force");
const scenes: Scene[] = JSON.parse(
  readFileSync(resolve(ROOT, "src/script.json"), "utf8"),
);
const outDir = resolve(ROOT, "assets/audio");
mkdirSync(outDir, { recursive: true });

/** Probe an MP3's duration via ffprobe. Falls back to size/bitrate estimate if unavailable. */
function getDurationSec(path: string): number {
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path],
      { encoding: "utf8" },
    );
    const sec = parseFloat(out.trim());
    if (Number.isFinite(sec) && sec > 0) return sec;
  } catch {
    // ffprobe unavailable — fall through to size estimate
  }
  // Azure returns 96 kbps mono MP3 → ~12,000 bytes per second
  return statSync(path).size / 12_000;
}

let totalChars = 0;
const durations: Record<string, number> = {};
for (const scene of scenes) {
  const outPath = resolve(outDir, `${scene.id}.mp3`);
  if (existsSync(outPath) && !force) {
    durations[scene.id] = getDurationSec(outPath);
    console.log(`✓ ${scene.id} (cached, ${durations[scene.id].toFixed(2)}s)`);
    continue;
  }
  const charCount = scene.text.length;
  totalChars += charCount;
  process.stdout.write(`… ${scene.id} (${charCount} chars) `);
  await synthesise({ text: scene.text, outputPath: outPath });
  durations[scene.id] = getDurationSec(outPath);
  console.log(`✓ ${outPath.replace(ROOT + "/", "")} (${durations[scene.id].toFixed(2)}s)`);
}

writeFileSync(resolve(outDir, "durations.json"), JSON.stringify(durations, null, 2) + "\n");
const totalSec = Object.values(durations).reduce((a, b) => a + b, 0);
console.log(`\nDone. ${totalChars} new chars. Total runtime: ${totalSec.toFixed(1)}s`);
