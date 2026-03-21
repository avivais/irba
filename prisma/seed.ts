import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { normalizePhone } from "../src/lib/phone";

async function main() {
  const gameDate = new Date();
  gameDate.setDate(gameDate.getDate() + 7);
  gameDate.setHours(20, 0, 0, 0);

  await prisma.gameSession.create({
    data: {
      date: gameDate,
      maxPlayers: 15,
    },
  });

  await prisma.player.createMany({
    data: [
      {
        name: "שחקן לדוגמה א׳",
        phone: normalizePhone("0521111111"),
        playerKind: "REGISTERED",
        position: "PG",
        rank: 3.5,
      },
      {
        name: "שחקן לדוגמה ב׳",
        phone: normalizePhone("0522222222"),
        playerKind: "REGISTERED",
        position: "SG",
        rank: 4.0,
      },
    ],
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
