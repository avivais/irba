import { prisma } from "@/lib/prisma";
import { getPlayerDisplayName } from "@/lib/player-display";
import { getConfigInt, CONFIG } from "@/lib/config";
import {
  computeMatchStats,
  computeSessionBreakdown,
  computeRoundBreakdown,
  computeTeammateAffinity,
  type MatchRecord,
  type MatchStats,
  type SessionRecord,
  type RoundRecord,
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

export type PlayerAnalytics = {
  stats: MatchStats;
  sessionBreakdown: SessionRecord[];
  roundBreakdown: RoundRecord[];
  /** Individual match results grouped by round number */
  matchesByRound: Record<number, MatchResult[]>;
  /** Session dates keyed by sessionId, for display in session breakdown */
  sessionDates: Record<string, Date>;
  roundSize: number;
  topTeammates: TeammateWithName[];
};

export async function fetchPlayerMatchAnalytics(
  playerId: string,
): Promise<PlayerAnalytics> {
  // Fetch all matches involving the player + all sessions (for ordering) in parallel
  const [rawMatches, allSessions, roundSize] = await Promise.all([
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
    // All sessions ordered by date — used to assign round numbers
    prisma.gameSession.findMany({
      orderBy: { date: "asc" },
      select: { id: true, date: true },
    }),
    getConfigInt(CONFIG.ROUND_SIZE),
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

  // Build session order map (sessionId → 0-based index) and date map
  const sessionOrder = new Map<string, number>(
    allSessions.map((s, i) => [s.id, i]),
  );
  const sessionDateMap = new Map<string, Date>(
    allSessions.map((s) => [s.id, s.date]),
  );

  const stats = computeMatchStats(playerId, matches);
  const sessionBreakdown = computeSessionBreakdown(playerId, matches);
  const roundBreakdown = computeRoundBreakdown(playerId, matches, sessionOrder, sessionDateMap, roundSize);
  const affinityRaw = computeTeammateAffinity(playerId, matches, 5);

  // Group individual matches by round for expandable display
  const matchesByRound: Record<number, MatchResult[]> = {};
  for (const m of matches) {
    const idx = sessionOrder.get(m.sessionId);
    if (idx === undefined) continue;
    const round = Math.floor(idx / roundSize) + 1;
    const inA = m.teamAPlayerIds.includes(playerId);
    const inB = m.teamBPlayerIds.includes(playerId);
    if (!inA && !inB) continue;
    let outcome: "win" | "loss" | "tie";
    if (m.scoreA === m.scoreB) outcome = "tie";
    else if (inA) outcome = m.scoreA > m.scoreB ? "win" : "loss";
    else outcome = m.scoreB > m.scoreA ? "win" : "loss";
    if (!matchesByRound[round]) matchesByRound[round] = [];
    matchesByRound[round].push({ id: m.id, scoreA: m.scoreA, scoreB: m.scoreB, outcome });
  }

  // Session dates for the per-session breakdown display
  const sessionDates: Record<string, Date> = Object.fromEntries(
    allSessions.map((s) => [s.id, s.date]),
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

  return { stats, sessionBreakdown, roundBreakdown, matchesByRound, sessionDates, roundSize, topTeammates };
}
