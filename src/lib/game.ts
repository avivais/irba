import { prisma } from "@/lib/prisma";

/** Next upcoming game session (from now), excluding archived sessions. */
export async function getNextGame() {
  const now = new Date();
  return prisma.gameSession.findFirst({
    where: { date: { gte: now }, isArchived: false },
    orderBy: { date: "asc" },
  });
}
