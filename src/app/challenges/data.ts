import { prisma } from "@/lib/prisma";
import { getConfigInt } from "@/lib/config";
import { CONFIG } from "@/lib/config-keys";
import { getPlayerDisplayName } from "@/lib/player-display";
import { computeLeaderboard, type LeaderboardEntry } from "@/lib/challenge-analytics";
import type { ChallengeMetric } from "@/lib/challenge-analytics";
import type { Challenge } from "@prisma/client";

export type ChallengeLeaderboardResult = {
  challenge: Challenge;
  leaderboard: LeaderboardEntry[];
  windowLabel: string;
  sessionCount: number;
};

export async function fetchChallengeLeaderboard(
  challengeId: string,
): Promise<ChallengeLeaderboardResult | null> {
  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return null;

  const roundSize = await getConfigInt(CONFIG.ROUND_SIZE);

  // All sessions ordered by date ascending
  const allSessions = await prisma.gameSession.findMany({
    orderBy: { date: "asc" },
    select: { id: true },
  });
  const allSessionIds = allSessions.map((s) => s.id);

  // Determine window
  let windowSessionIds: string[];
  let windowLabel: string;

  if (challenge.roundCount === 0) {
    windowSessionIds = allSessionIds;
    windowLabel = "כל הזמן";
  } else {
    const windowSize = challenge.roundCount * roundSize;
    // Take last windowSize sessions
    windowSessionIds = allSessionIds.slice(-windowSize);
    windowLabel = `${challenge.roundCount} סבבים אחרונים`;
  }

  const sessionCount = windowSessionIds.length;
  if (sessionCount === 0) {
    return {
      challenge,
      leaderboard: [],
      windowLabel,
      sessionCount: 0,
    };
  }

  const windowSet = new Set(windowSessionIds);

  // Fetch matches in window
  const matches = await prisma.match.findMany({
    where: { sessionId: { in: windowSessionIds } },
    select: {
      id: true,
      sessionId: true,
      teamAPlayerIds: true,
      teamBPlayerIds: true,
      scoreA: true,
      scoreB: true,
      createdAt: true,
    },
  });

  // Fetch attendances in window
  const attendances = await prisma.attendance.findMany({
    where: { gameSessionId: { in: windowSessionIds } },
    select: { gameSessionId: true, playerId: true },
  });

  const attendanceBySession = new Map<string, string[]>();
  for (const a of attendances) {
    if (!attendanceBySession.has(a.gameSessionId)) {
      attendanceBySession.set(a.gameSessionId, []);
    }
    attendanceBySession.get(a.gameSessionId)!.push(a.playerId);
  }

  // Fetch all non-admin players for name resolution
  const players = await prisma.player.findMany({
    where: { isAdmin: false },
    select: {
      id: true,
      firstNameHe: true,
      lastNameHe: true,
      firstNameEn: true,
      lastNameEn: true,
      nickname: true,
      phone: true,
    },
  });

  const playerNames = new Map<string, string>(
    players.map((p) => [p.id, getPlayerDisplayName(p)]),
  );

  const leaderboard = computeLeaderboard({
    metric: challenge.metric as ChallengeMetric,
    eligibilityMinPct: challenge.eligibilityMinPct,
    windowSessionIds,
    matches,
    attendanceBySession,
    playerNames,
  });

  return { challenge, leaderboard, windowLabel, sessionCount };
}

export async function fetchAllChallengeLeaderboards(): Promise<ChallengeLeaderboardResult[]> {
  const challenges = await prisma.challenge.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  });

  const results = await Promise.all(
    challenges.map((c) => fetchChallengeLeaderboard(c.id)),
  );

  return results.filter((r): r is ChallengeLeaderboardResult => r !== null);
}
