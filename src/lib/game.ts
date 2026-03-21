import { prisma } from "@/lib/prisma";

/** Next upcoming open game session (from now). */
export async function getNextGame() {
  const now = new Date();
  return prisma.gameSession.findFirst({
    where: {
      date: { gte: now },
      isClosed: false,
    },
    orderBy: { date: "asc" },
  });
}
