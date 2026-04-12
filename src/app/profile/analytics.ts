import { prisma } from "@/lib/prisma";
import { getPlayerDisplayName } from "@/lib/player-display";
import { getConfigInt, CONFIG } from "@/lib/config";
import {
  computeMatchStats,
  computeSessionBreakdown,
  computeTeammateAffinity,
  type MatchRecord,
  type MatchStats,
  type SessionRecord,
  type TeammateAffinity,
} from "@/lib/match-analytics";

export type TeammateWithName = TeammateAffinity & { displayName: string };

export type MatchResult = {
  id: string;
  scoreA: number;
  scoreB: number;
  /** "win" | "loss" | "tie" from the perspective of this player */
  outcome: "win" | "loss" | "tie";
};

export type CompetitionRecord = {
  number: number;
  startDate: Date;
  wins: number;
  losses: number;
  ties: number;
  total: number;
  winRatio: number;
  isClosed: boolean;
  isActive: boolean;
};

export type PlayerAnalytics = {
  stats: MatchStats;
  sessionBreakdown: SessionRecord[];
  competitionBreakdown: CompetitionRecord[];
  /** Session dates keyed by sessionId, for display in session breakdown */
  sessionDates: Record<string, Date>;
  topTeammates: TeammateWithName[];
};

export async function fetchPlayerMatchAnalytics(
  playerId: string,
): Promise<PlayerAnalytics> {
  // Fetch all matches involving the player + all sessions (for ordering) + challenges in parallel
  const [rawMatches, allSessions, challenges] = await Promise.all([
    prisma.$queryRaw<
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
    `,
    // All sessions ordered by date — used to build competition windows
    prisma.gameSession.findMany({
      orderBy: { date: "asc" },
      select: { id: true, date: true },
    }),
    prisma.challenge.findMany({
      orderBy: { number: "asc" },
      select: {
        id: true,
        number: true,
        startDate: true,
        sessionCount: true,
        isActive: true,
        isClosed: true,
      },
    }),
  ]);

  const matches: MatchRecord[] = rawMatches.map((m) => ({
    id: m.id,
    sessionId: m.sessionId,
    teamAPlayerIds: m.teamAPlayerIds,
    teamBPlayerIds: m.teamBPlayerIds,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    createdAt: new Date(m.createdAt),
  }));

  // Session dates for display
  const sessionDates: Record<string, Date> = Object.fromEntries(
    allSessions.map((s) => [s.id, s.date]),
  );

  const stats = computeMatchStats(playerId, matches);
  const sessionBreakdown = computeSessionBreakdown(playerId, matches);
  const affinityRaw = computeTeammateAffinity(playerId, matches, 5);

  // Build per-competition breakdown
  const competitionBreakdown: CompetitionRecord[] = [];
  for (const challenge of challenges) {
    // Sessions from startDate ordered by date asc, take first sessionCount
    const windowSessions = allSessions
      .filter((s) => s.date >= challenge.startDate)
      .slice(0, challenge.sessionCount);

    if (windowSessions.length === 0) continue;

    const windowSessionIds = new Set(windowSessions.map((s) => s.id));
    const windowMatches = matches.filter((m) => windowSessionIds.has(m.sessionId));

    const cStats = computeMatchStats(playerId, windowMatches);
    if (cStats.total === 0) continue; // player didn't play in this competition window

    competitionBreakdown.push({
      number: challenge.number,
      startDate: windowSessions[0].date,
      wins: cStats.wins,
      losses: cStats.losses,
      ties: cStats.ties,
      total: cStats.total,
      winRatio: cStats.winRatio,
      isClosed: challenge.isClosed,
      isActive: challenge.isActive,
    });
  }

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

  return { stats, sessionBreakdown, competitionBreakdown, sessionDates, topTeammates };
}
