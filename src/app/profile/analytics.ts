import { prisma } from "@/lib/prisma";
import { getPlayerDisplayName } from "@/lib/player-display";
import {
  computeMatchStats,
  computeMonthlyBreakdown,
  computeSessionBreakdown,
  computeTeammateAffinity,
  type MatchRecord,
  type MatchStats,
  type MonthlyRecord,
  type SessionRecord,
  type TeammateAffinity,
} from "@/lib/match-analytics";

export type TeammateWithName = TeammateAffinity & { displayName: string };

export type PlayerAnalytics = {
  stats: MatchStats;
  monthlyBreakdown: MonthlyRecord[];
  sessionBreakdown: SessionRecord[];
  /** Session dates keyed by sessionId, for display */
  sessionDates: Record<string, Date>;
  topTeammates: TeammateWithName[];
};

export async function fetchPlayerMatchAnalytics(
  playerId: string,
): Promise<PlayerAnalytics> {
  // Single round-trip: fetch all matches involving the player
  const rawMatches = await prisma.$queryRaw<
    {
      id: string;
      sessionId: string;
      teamAPlayerIds: string[];
      teamBPlayerIds: string[];
      scoreA: number;
      scoreB: number;
      createdAt: Date;
    }[]
  >`
    SELECT id, "sessionId", "teamAPlayerIds", "teamBPlayerIds", "scoreA", "scoreB", "createdAt"
    FROM "Match"
    WHERE ${playerId} = ANY("teamAPlayerIds") OR ${playerId} = ANY("teamBPlayerIds")
    ORDER BY "createdAt" ASC
  `;

  const matches: MatchRecord[] = rawMatches.map((m) => ({
    id: m.id,
    sessionId: m.sessionId,
    teamAPlayerIds: m.teamAPlayerIds,
    teamBPlayerIds: m.teamBPlayerIds,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    createdAt: new Date(m.createdAt),
  }));

  const stats = computeMatchStats(playerId, matches);
  const monthlyBreakdown = computeMonthlyBreakdown(playerId, matches);
  const sessionBreakdown = computeSessionBreakdown(playerId, matches);
  const affinityRaw = computeTeammateAffinity(playerId, matches, 5);

  // Resolve session dates from the DB for display
  const sessionIds = Array.from(new Set(matches.map((m) => m.sessionId)));
  const sessions =
    sessionIds.length > 0
      ? await prisma.gameSession.findMany({
          where: { id: { in: sessionIds } },
          select: { id: true, date: true },
        })
      : [];
  const sessionDates: Record<string, Date> = Object.fromEntries(
    sessions.map((s) => [s.id, s.date]),
  );

  // Resolve teammate display names
  const teammateIds = affinityRaw.map((a) => a.teammateId);
  const teammates =
    teammateIds.length > 0
      ? await prisma.player.findMany({
          where: { id: { in: teammateIds } },
          select: {
            id: true,
            firstNameHe: true,
            lastNameHe: true,
            firstNameEn: true,
            lastNameEn: true,
            nickname: true,
            phone: true,
          },
        })
      : [];
  const nameById = new Map(teammates.map((p) => [p.id, getPlayerDisplayName(p)]));

  const topTeammates: TeammateWithName[] = affinityRaw.map((a) => ({
    ...a,
    displayName: nameById.get(a.teammateId) ?? "שחקן",
  }));

  return { stats, monthlyBreakdown, sessionBreakdown, sessionDates, topTeammates };
}
