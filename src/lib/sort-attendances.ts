import { computePrecedenceScores } from "@/lib/precedence";
import { getPlayerDisplayName } from "@/lib/player-display";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type AttendanceWithPlayer = Prisma.AttendanceGetPayload<{
  include: { player: true };
}>;

/**
 * Sort REGISTERED players by precedence score (desc), DROP_IN by createdAt (asc).
 * REGISTERED players always come before DROP_IN players.
 */
export async function sortAttendancesByPrecedence(
  attendances: AttendanceWithPlayer[],
  sessionYear: number,
): Promise<AttendanceWithPlayer[]> {
  const registered = attendances.filter((a) => a.player.playerKind === "REGISTERED");
  const dropIns = attendances.filter((a) => a.player.playerKind !== "REGISTERED");

  if (registered.length === 0) {
    return [...dropIns];
  }

  const registeredIds = registered.map((a) => a.player.id);
  const yearStart = new Date(sessionYear, 0, 1);
  const yearEnd = new Date(sessionYear + 1, 0, 1);

  const [aggregates, adjustments, liveCounts, yearWeights] = await Promise.all([
    prisma.playerYearAggregate.findMany({
      where: { playerId: { in: registeredIds } },
      select: { playerId: true, year: true, count: true },
    }),
    prisma.playerAdjustment.findMany({
      where: { playerId: { in: registeredIds } },
      select: { playerId: true, points: true },
    }),
    prisma.attendance.groupBy({
      by: ["playerId"],
      where: {
        playerId: { in: registeredIds },
        gameSession: { date: { gte: yearStart, lt: yearEnd } },
      },
      _count: { id: true },
    }),
    prisma.yearWeight.findMany(),
  ]);

  const liveCountMap = new Map(liveCounts.map((r) => [r.playerId, r._count.id]));

  const scored = computePrecedenceScores(
    registered.map((a) => ({
      id: a.player.id,
      playerName: getPlayerDisplayName(a.player),
      aggregates: aggregates
        .filter((ag) => ag.playerId === a.player.id)
        .map((ag) => ({ year: ag.year, count: ag.count })),
      liveCount: liveCountMap.get(a.player.id) ?? 0,
      adjustments: adjustments
        .filter((adj) => adj.playerId === a.player.id)
        .map((adj) => ({ points: adj.points })),
    })),
    yearWeights,
    sessionYear,
  );

  const scoreById = new Map(scored.map((r) => [r.playerId, r.totalScore]));

  const sortedRegistered = [...registered].sort((a, b) => {
    if (a.player.isAdmin !== b.player.isAdmin) return a.player.isAdmin ? -1 : 1;
    const scoreA = scoreById.get(a.player.id) ?? 0;
    const scoreB = scoreById.get(b.player.id) ?? 0;
    return scoreB - scoreA;
  });

  return [...sortedRegistered, ...dropIns];
}
