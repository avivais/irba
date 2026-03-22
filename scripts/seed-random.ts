/**
 * Random local/dev data for manual QA (waiting list, mixed player kinds).
 *
 * Safety: requires NODE_ENV=development OR IRBA_ALLOW_RANDOM_SEED=1.
 * Destructive wipe: IRBA_SEED_RESET=1 (deletes all Attendance, Player, GameSession).
 */
import "dotenv/config";
import { faker } from "@faker-js/faker";
import type { PlayerKind, Position } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const POSITIONS: Position[] = ["PG", "SG", "SF", "PF", "C"];

function assertAllowedToRun(): void {
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.IRBA_ALLOW_RANDOM_SEED !== "1"
  ) {
    console.error(
      "Refusing to run: set NODE_ENV=development or IRBA_ALLOW_RANDOM_SEED=1",
    );
    process.exit(1);
  }
}

function chance(probability: number): boolean {
  return Math.random() < probability;
}

/** 10-digit Israeli mobile: 05 + 8 random digits, unique within this run. */
function randomIsraeliMobileUnique(seen: Set<string>): string {
  for (let attempt = 0; attempt < 10_000; attempt++) {
    let s = "05";
    for (let i = 0; i < 8; i++) {
      s += String(Math.floor(Math.random() * 10));
    }
    if (!seen.has(s)) {
      seen.add(s);
      return s;
    }
  }
  throw new Error("Could not generate unique phone (too many collisions)");
}

async function optionalReset(): Promise<void> {
  if (process.env.IRBA_SEED_RESET === "1") {
    console.warn(
      "[IRBA] IRBA_SEED_RESET=1 — deleting ALL Attendance, Player, and GameSession rows.",
    );
    await prisma.attendance.deleteMany();
    await prisma.player.deleteMany();
    await prisma.gameSession.deleteMany();
  }
}

async function main(): Promise<void> {
  assertAllowedToRun();

  const seed = process.env.IRBA_SEED_FAKER_SEED;
  if (seed !== undefined && seed !== "") {
    faker.seed(Number(seed));
  } else {
    faker.seed(Date.now() % 2_147_483_647);
  }

  await optionalReset();

  const existingPlayers = await prisma.player.count();
  if (existingPlayers > 0 && process.env.IRBA_SEED_RESET !== "1") {
    console.warn(
      "[IRBA] Database already has players. Use IRBA_SEED_RESET=1 for a clean slate, or you may hit unique constraint errors on phone.",
    );
  }

  const playerCount = Math.min(
    80,
    Math.max(10, Number(process.env.IRBA_RANDOM_PLAYERS ?? "28") || 28),
  );

  const phones = new Set<string>();
  const rows: Array<{
    name: string;
    phone: string;
    playerKind: PlayerKind;
    position: Position | null;
    rank: number | null;
    balance: number;
  }> = [];

  for (let i = 0; i < playerCount; i++) {
    const phone = randomIsraeliMobileUnique(phones);
    const playerKind: PlayerKind = chance(0.65) ? "REGISTERED" : "DROP_IN";
    const position: Position | null =
      playerKind === "REGISTERED"
        ? faker.helpers.arrayElement(POSITIONS)
        : chance(0.4)
          ? faker.helpers.arrayElement(POSITIONS)
          : null;
    const rank: number | null =
      playerKind === "REGISTERED" && chance(0.9)
        ? faker.number.float({ min: 1, max: 5, fractionDigits: 1 })
        : null;
    const balance =
      playerKind === "REGISTERED"
        ? faker.number.int({ min: -200, max: 400 })
        : 0;

    rows.push({
      name: faker.person.fullName(),
      phone,
      playerKind,
      position,
      rank,
      balance,
    });
  }

  await prisma.player.createMany({ data: rows });

  const now = new Date();
  const past = new Date(now);
  past.setDate(past.getDate() - 5);
  past.setHours(18, 0, 0, 0);

  const futureNear = new Date(now);
  futureNear.setDate(futureNear.getDate() + 2);
  futureNear.setHours(19, 30, 0, 0);

  const futureFar = new Date(now);
  futureFar.setDate(futureFar.getDate() + 9);
  futureFar.setHours(20, 0, 0, 0);

  const [gamePast, gameNext, gameLater] = await prisma.$transaction([
    prisma.gameSession.create({
      data: {
        date: past,
        maxPlayers: 15,
        isClosed: true,
      },
    }),
    prisma.gameSession.create({
      data: {
        date: futureNear,
        maxPlayers: 15,
        isClosed: false,
      },
    }),
    prisma.gameSession.create({
      data: {
        date: futureFar,
        maxPlayers: 12,
        isClosed: false,
      },
    }),
  ]);

  const allPlayers = await prisma.player.findMany({ select: { id: true } });
  const shuffled = faker.helpers.shuffle(allPlayers.map((p) => p.id));

  const pastSubset = shuffled.slice(0, 8);
  for (let i = 0; i < pastSubset.length; i++) {
    await prisma.attendance.create({
      data: {
        playerId: pastSubset[i],
        gameSessionId: gamePast.id,
        createdAt: new Date(past.getTime() - (pastSubset.length - i) * 60_000),
      },
    });
  }

  const rsvpCount = Math.min(20, shuffled.length);
  const nextPlayers = shuffled.slice(0, rsvpCount);
  const base = futureNear.getTime() - rsvpCount * 120_000;
  for (let i = 0; i < nextPlayers.length; i++) {
    await prisma.attendance.create({
      data: {
        playerId: nextPlayers[i],
        gameSessionId: gameNext.id,
        createdAt: new Date(base + i * 120_000),
      },
    });
  }

  const laterSubset = shuffled.slice(rsvpCount, rsvpCount + 10);
  for (let i = 0; i < laterSubset.length; i++) {
    await prisma.attendance.create({
      data: {
        playerId: laterSubset[i],
        gameSessionId: gameLater.id,
        createdAt: new Date(
          futureFar.getTime() - (laterSubset.length - i) * 90_000,
        ),
      },
    });
  }

  console.log(
    `[IRBA] Random seed done: ${rows.length} players; sessions past=${gamePast.id} next=${gameNext.id} later=${gameLater.id} (next game has ${rsvpCount} RSVPs → waiting list if > maxPlayers).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
