import { prisma } from "@/lib/prisma";
import { getPlayerDisplayName } from "@/lib/player-display";
import { computeLeaderboard, type LeaderboardEntry, type IneligibleEntry } from "@/lib/challenge-analytics";
import type { Challenge, Player } from "@prisma/client";

export type ChallengeWithWinner = Challenge & {
  winner: Pick<Player, "id" | "firstNameHe" | "lastNameHe" | "firstNameEn" | "lastNameEn" | "nickname" | "phone"> | null;
};

export type ChallengeSession = { id: string; date: Date };

export type ChallengeLeaderboardResult = {
  challenge: ChallengeWithWinner;
  leaderboard: LeaderboardEntry[];
  ineligible: IneligibleEntry[];
  /** Nominal match count required for eligibility */
  effectiveThreshold: number;
  /** Number of sessions charged so far in the window */
  completedSessions: number;
  /** Ordered window sessions (for per-session breakdown display) */
  sessions: ChallengeSession[];
};

export async function fetchChallengeLeaderboard(
  challengeId: string,
): Promise<ChallengeLeaderboardResult | null> {
  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    include: {
      winner: {
        select: { id: true, firstNameHe: true, lastNameHe: true, firstNameEn: true, lastNameEn: true, nickname: true, phone: true },
      },
    },
  });
  if (!challenge) return null;

  // Sessions from startDate, ordered by date asc, take first sessionCount
  const windowSessions = await prisma.gameSession.findMany({
    where: { date: { gte: challenge.startDate } },
    orderBy: { date: "asc" },
    take: challenge.sessionCount,
    select: { id: true, isCharged: true, date: true },
  });

  const windowSessionIds = windowSessions.map((s) => s.id);
  const completedSessions = windowSessions.filter((s) => s.isCharged).length;
  const sessions: ChallengeSession[] = windowSessions.map((s) => ({ id: s.id, date: new Date(s.date) }));

  if (windowSessionIds.length === 0) {
    return { challenge, leaderboard: [], ineligible: [], effectiveThreshold: 0, completedSessions: 0, sessions: [] };
  }

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

  // Fetch registered (non-drop-in) non-admin players for name resolution
  const players = await prisma.player.findMany({
    where: { isAdmin: false, playerKind: "REGISTERED" },
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
  const registeredPlayerIds = new Set(players.map((p) => p.id));

  const { leaderboard, ineligible, effectiveThreshold } = computeLeaderboard({
    minMatchesPct: challenge.minMatchesPct,
    windowSessionIds,
    matches,
    playerNames,
    registeredPlayerIds,
  });

  return { challenge, leaderboard, ineligible, effectiveThreshold, completedSessions, sessions };
}

export async function fetchAllChallengeLeaderboards(): Promise<ChallengeLeaderboardResult[]> {
  const challenges = await prisma.challenge.findMany({
    orderBy: [{ isActive: "desc" }, { number: "desc" }],
    include: {
      winner: {
        select: { id: true, firstNameHe: true, lastNameHe: true, firstNameEn: true, lastNameEn: true, nickname: true, phone: true },
      },
    },
  });

  const results = await Promise.all(
    challenges.map((c) => fetchChallengeLeaderboard(c.id)),
  );

  return results.filter((r): r is ChallengeLeaderboardResult => r !== null);
}
