import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { normalizePhone } from "../src/lib/phone";

async function main() {
  const gameDate = new Date();
  gameDate.setDate(gameDate.getDate() + 7);
  gameDate.setHours(20, 0, 0, 0);

  const openGame = await prisma.gameSession.findFirst({
    where: { isClosed: false },
  });
  if (!openGame) {
    await prisma.gameSession.create({
      data: {
        date: gameDate,
        maxPlayers: 15,
      },
    });
  }

  await prisma.player.createMany({
    data: [
      {
        name: "שחקן לדוגמה א׳",
        phone: normalizePhone("0521111111"),
        playerKind: "REGISTERED",
        positions: ["PG"],
        rank: 3.5,
      },
      {
        name: "שחקן לדוגמה ב׳",
        phone: normalizePhone("0522222222"),
        playerKind: "REGISTERED",
        positions: ["SG"],
        rank: 4.0,
      },
    ],
    skipDuplicates: true,
  });

  // Year weights
  await prisma.yearWeight.createMany({
    data: [
      { year: 2024, weight: 1.0 },
      { year: 2025, weight: 1.5 },
      { year: 2026, weight: 2.0 },
    ],
    skipDuplicates: true,
  });

  // Historical aggregates + adjustments for seeded players
  const playerA = await prisma.player.findUnique({
    where: { phone: normalizePhone("0521111111") },
  });
  const playerB = await prisma.player.findUnique({
    where: { phone: normalizePhone("0522222222") },
  });

  if (playerA) {
    await prisma.playerYearAggregate.createMany({
      data: [
        { playerId: playerA.id, year: 2024, count: 14 },
        { playerId: playerA.id, year: 2025, count: 12 },
      ],
      skipDuplicates: true,
    });
    await prisma.playerAdjustment.createMany({
      data: [
        {
          playerId: playerA.id,
          date: new Date("2025-06-10"),
          points: 2,
          description: "בונוס ארגון",
        },
      ],
      skipDuplicates: false,
    });
  }

  if (playerB) {
    await prisma.playerYearAggregate.createMany({
      data: [
        { playerId: playerB.id, year: 2024, count: 10 },
        { playerId: playerB.id, year: 2025, count: 15 },
      ],
      skipDuplicates: true,
    });
    await prisma.playerAdjustment.createMany({
      data: [
        {
          playerId: playerB.id,
          date: new Date("2025-03-01"),
          points: -1,
          description: "קנס ביטול",
        },
      ],
      skipDuplicates: false,
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
