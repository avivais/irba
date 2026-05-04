import { prisma } from "@/lib/prisma";

/** Next upcoming game session (from now), excluding archived and cancelled sessions. */
export async function getNextGame() {
  const now = new Date();
  return prisma.gameSession.findFirst({
    where: { date: { gte: now }, isArchived: false, cancelledAt: null },
    orderBy: { date: "asc" },
  });
}
