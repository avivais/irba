"use server";

import fs from "fs";
import path from "path";
import zlib from "zlib";
import { promisify } from "util";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

const SNAPSHOT_DIR = "/opt/irba/backups/snapshots";

function ensureDir() {
  if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
}

// FK-safe insert order (parents before children)
const INSERT_ORDER = [
  "appConfig", "hourlyRate", "yearWeight", "player",
  "gameSession", "peerRatingSession", "challenge",
  "attendance", "match", "payment", "freeEntry",
  "sessionCharge", "peerRating", "playerYearAggregate",
  "playerAdjustment", "chargeAuditEntry", "auditLog",
] as const;

// FK-safe delete order (children before parents)
const DELETE_ORDER = [...INSERT_ORDER].reverse();

type SnapshotFile = {
  filename: string;
  label: string;
  createdAt: string;
  sizeBytes: number;
};

export async function listSnapshots(): Promise<SnapshotFile[]> {
  await requireAdmin();
  ensureDir();
  const files = fs.readdirSync(SNAPSHOT_DIR).filter((f) => f.endsWith(".json.gz"));
  return files
    .map((filename) => {
      const stat = fs.statSync(path.join(SNAPSHOT_DIR, filename));
      const parts = filename.replace(".json.gz", "").split("__");
      return {
        filename,
        label: parts[0] ?? filename,
        createdAt: parts[1] ? parts[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3") : stat.mtime.toISOString(),
        sizeBytes: stat.size,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createSnapshot(label: string): Promise<{ ok: boolean; filename?: string; error?: string }> {
  await requireAdmin();
  try {
    ensureDir();
    const data = await serializeAll();
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const safeLabel = label.replace(/[^a-zA-Z0-9_\u0590-\u05FF-]/g, "_").slice(0, 40);
    const filename = `${safeLabel}__${ts}.json.gz`;
    const json = JSON.stringify(data);
    const compressed = await gzip(json);
    fs.writeFileSync(path.join(SNAPSHOT_DIR, filename), compressed);
    return { ok: true, filename };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function restoreSnapshot(filename: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  // Validate filename (no path traversal)
  if (filename.includes("/") || filename.includes("..") || !filename.endsWith(".json.gz")) {
    return { ok: false, error: "Invalid filename" };
  }
  const filepath = path.join(SNAPSHOT_DIR, filename);
  if (!fs.existsSync(filepath)) return { ok: false, error: "Snapshot not found" };

  try {
    const compressed = fs.readFileSync(filepath);
    const json = await gunzip(compressed);
    const data = JSON.parse(json.toString());
    await deserializeAll(data.tables);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function deleteSnapshot(filename: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (filename.includes("/") || filename.includes("..") || !filename.endsWith(".json.gz")) {
    return { ok: false, error: "Invalid filename" };
  }
  const filepath = path.join(SNAPSHOT_DIR, filename);
  if (!fs.existsSync(filepath)) return { ok: false, error: "Not found" };
  fs.unlinkSync(filepath);
  return { ok: true };
}

// ── Serialization ─────────────────────────────────────────────────────────────

async function serializeAll() {
  const [
    appConfig, hourlyRate, yearWeight, player,
    gameSession, peerRatingSession, challenge,
    attendance, match, payment, freeEntry,
    sessionCharge, peerRating, playerYearAggregate,
    playerAdjustment, chargeAuditEntry, auditLog,
  ] = await Promise.all([
    prisma.appConfig.findMany(),
    prisma.hourlyRate.findMany(),
    prisma.yearWeight.findMany(),
    prisma.player.findMany(),
    prisma.gameSession.findMany(),
    prisma.peerRatingSession.findMany(),
    prisma.challenge.findMany(),
    prisma.attendance.findMany(),
    prisma.match.findMany(),
    prisma.payment.findMany(),
    prisma.freeEntry.findMany(),
    prisma.sessionCharge.findMany(),
    prisma.peerRating.findMany(),
    prisma.playerYearAggregate.findMany(),
    prisma.playerAdjustment.findMany(),
    prisma.chargeAuditEntry.findMany(),
    prisma.auditLog.findMany(),
  ]);

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    tables: {
      appConfig, hourlyRate, yearWeight, player,
      gameSession, peerRatingSession, challenge,
      attendance, match, payment, freeEntry,
      sessionCharge, peerRating, playerYearAggregate,
      playerAdjustment, chargeAuditEntry, auditLog,
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deserializeAll(tables: Record<string, any[]>) {
  await prisma.$transaction(async (tx) => {
    // Delete in FK-safe reverse order
    for (const table of DELETE_ORDER) {
      switch (table) {
        case "chargeAuditEntry": await tx.chargeAuditEntry.deleteMany(); break;
        case "auditLog":         await tx.auditLog.deleteMany(); break;
        case "playerAdjustment": await tx.playerAdjustment.deleteMany(); break;
        case "playerYearAggregate": await tx.playerYearAggregate.deleteMany(); break;
        case "peerRating":       await tx.peerRating.deleteMany(); break;
        case "sessionCharge":    await tx.sessionCharge.deleteMany(); break;
        case "freeEntry":        await tx.freeEntry.deleteMany(); break;
        case "payment":          await tx.payment.deleteMany(); break;
        case "match":            await tx.match.deleteMany(); break;
        case "attendance":       await tx.attendance.deleteMany(); break;
        case "challenge":        await tx.challenge.deleteMany(); break;
        case "peerRatingSession": await tx.peerRatingSession.deleteMany(); break;
        case "gameSession":      await tx.gameSession.deleteMany(); break;
        case "player":           await tx.player.deleteMany(); break;
        case "hourlyRate":       await tx.hourlyRate.deleteMany(); break;
        case "yearWeight":       await tx.yearWeight.deleteMany(); break;
        case "appConfig":        await tx.appConfig.deleteMany(); break;
      }
    }

    // Insert in FK-safe order
    for (const table of INSERT_ORDER) {
      const rows = tables[table] ?? [];
      if (rows.length === 0) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coerce = (r: any) => ({
        ...r,
        // Ensure Date strings become Date objects where needed
        createdAt:    r.createdAt    ? new Date(r.createdAt)    : undefined,
        updatedAt:    r.updatedAt    ? new Date(r.updatedAt)    : undefined,
        date:         r.date         ? new Date(r.date)         : undefined,
        effectiveFrom: r.effectiveFrom ? new Date(r.effectiveFrom) : undefined,
        startDate:    r.startDate    ? new Date(r.startDate)    : undefined,
        openedAt:     r.openedAt     ? new Date(r.openedAt)     : undefined,
        closedAt:     r.closedAt     ? new Date(r.closedAt)     : undefined,
        submittedAt:  r.submittedAt  ? new Date(r.submittedAt)  : undefined,
        usedAt:       r.usedAt       ? new Date(r.usedAt)       : undefined,
        changedAt:    r.changedAt    ? new Date(r.changedAt)    : undefined,
        timestamp:    r.timestamp    ? new Date(r.timestamp)    : undefined,
        birthdate:    r.birthdate    ? new Date(r.birthdate)    : undefined,
        otpExpiresAt: r.otpExpiresAt ? new Date(r.otpExpiresAt) : undefined,
        regulationsAcceptedAt: r.regulationsAcceptedAt ? new Date(r.regulationsAcceptedAt) : undefined,
        alertEarlyFiredAt:    r.alertEarlyFiredAt    ? new Date(r.alertEarlyFiredAt)    : undefined,
        alertCriticalFiredAt: r.alertCriticalFiredAt ? new Date(r.alertCriticalFiredAt) : undefined,
      });

      switch (table) {
        case "appConfig":    for (const r of rows) await tx.appConfig.create({ data: coerce(r) }); break;
        case "hourlyRate":   await tx.hourlyRate.createMany({ data: rows.map(coerce) }); break;
        case "yearWeight":   await tx.yearWeight.createMany({ data: rows.map(coerce) }); break;
        case "player":       for (const r of rows) await tx.player.create({ data: coerce(r) }); break;
        case "gameSession":  await tx.gameSession.createMany({ data: rows.map(coerce) }); break;
        case "peerRatingSession": await tx.peerRatingSession.createMany({ data: rows.map(coerce) }); break;
        case "challenge":    await tx.challenge.createMany({ data: rows.map(coerce) }); break;
        case "attendance":   await tx.attendance.createMany({ data: rows.map(coerce) }); break;
        case "match":        await tx.match.createMany({ data: rows.map(coerce) }); break;
        case "payment":      await tx.payment.createMany({ data: rows.map(coerce) }); break;
        case "freeEntry":    await tx.freeEntry.createMany({ data: rows.map(coerce) }); break;
        case "sessionCharge": await tx.sessionCharge.createMany({ data: rows.map(coerce) }); break;
        case "peerRating":   await tx.peerRating.createMany({ data: rows.map(coerce) }); break;
        case "playerYearAggregate": await tx.playerYearAggregate.createMany({ data: rows.map(coerce) }); break;
        case "playerAdjustment": await tx.playerAdjustment.createMany({ data: rows.map(coerce) }); break;
        case "chargeAuditEntry": await tx.chargeAuditEntry.createMany({ data: rows.map(coerce) }); break;
        case "auditLog":
          for (const r of rows) {
            await tx.auditLog.create({ data: { ...coerce(r), id: r.id } });
          }
          break;
      }
    }
  }, { timeout: 30000 });

  // Reset AuditLog auto-increment sequence
  await prisma.$executeRaw`SELECT setval('"AuditLog_id_seq"', COALESCE((SELECT MAX(id) FROM "AuditLog"), 0))`;
}
