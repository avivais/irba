import { prisma } from "@/lib/prisma";

/** Next upcoming game session (from now), regardless of isClosed status. */
export async function getNextGame() {
  const now = new Date();
  return prisma.gameSession.findFirst({
    where: { date: { gte: now } },
    orderBy: { date: "asc" },
  });
}
