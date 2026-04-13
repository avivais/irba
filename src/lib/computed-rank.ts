import { prisma } from "@/lib/prisma";
import { getAllConfigs, CONFIG } from "@/lib/config";
import { writeAuditLog } from "@/lib/audit";
import { computeMatchStats, type MatchRecord } from "@/lib/match-analytics";
import {
  computeBlendedRank,
  normalizePeerScore,
  normalizeWinScore,
  type RankComponentInput,
  type RankWeights,
  type RankBreakdown,
} from "@/lib/computed-rank-pure";

// Re-export pure functions and types so callers can import from one place
export {
  computeBlendedRank,
  normalizePeerScore,
  normalizeWinScore,
  type RankComponentInput,
  type RankWeights,
  type RankBreakdown,
};

// ---------------------------------------------------------------------------
// DB orchestrator
// ---------------------------------------------------------------------------

/**
 * Recompute and persist `computedRank` for every player.
 * Synchronous on the DB level (fine for ~20–30 players).
 * Writes a RECALCULATE_RANKS audit entry.
 */
export async function recalculateAllComputedRanks(
  actor: string,
): Promise<{ updatedCount: number }> {
  const config = await getAllConfigs();
  const defaultRank = parseInt(config[CONFIG.DEFAULT_PLAYER_RANK] ?? "50", 10);
  const adminWeight = parseFloat(config[CONFIG.RANK_WEIGHT_ADMIN] ?? "1");
  const peerWeight = parseFloat(config[CONFIG.RANK_WEIGHT_PEER] ?? "1");
  const winWeight = parseFloat(config[CONFIG.RANK_WEIGHT_WINLOSS] ?? "1");
  const minGamesPct = parseInt(config[CONFIG.RANK_WINLOSS_MIN_GAMES_PCT] ?? "50", 10);

  const weights: RankWeights = { adminWeight, peerWeight, winWeight };

  // 1. Fetch all players
  const players = await prisma.player.findMany({
    select: { id: true, rank: true, playerKind: true },
  });

  // 2. Fetch all matches
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
    ORDER BY "createdAt" ASC
  `;

  const allMatches: MatchRecord[] = rawMatches.map((m) => ({
    id: m.id,
    sessionId: m.sessionId,
    teamAPlayerIds: m.teamAPlayerIds,
    teamBPlayerIds: m.teamBPlayerIds,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    createdAt: new Date(m.createdAt),
  }));

  // 3. Compute per-player match stats + find max games played
  const statsByPlayer = new Map(
    players.map((p) => [p.id, computeMatchStats(p.id, allMatches)]),
  );
  const maxGamesPlayed = Math.max(
    0,
    ...Array.from(statsByPlayer.values()).map((s) => s.total),
  );

  // 4. Build peer score map from latest closed session
  const latestPeerSession = await prisma.peerRatingSession.findFirst({
    where: { closedAt: { not: null } },
    orderBy: { year: "desc" },
    include: { ratings: true },
  });

  // avgPosition keyed by ratedPlayerId (from the perspective of all raters)
  const avgPositionByPlayer = new Map<string, number>();
  if (latestPeerSession) {
    // Group ratings by ratedPlayerId
    const positionsByPlayer = new Map<string, number[]>();
    for (const r of latestPeerSession.ratings) {
      const arr = positionsByPlayer.get(r.ratedPlayerId) ?? [];
      arr.push(r.position);
      positionsByPlayer.set(r.ratedPlayerId, arr);
    }
    // How many registered players were being rated in that session
    // N = number of distinct ratedPlayerIds
    const N = positionsByPlayer.size;
    for (const [playerId, positions] of positionsByPlayer) {
      const avg = positions.reduce((a, b) => a + b, 0) / positions.length;
      avgPositionByPlayer.set(playerId, normalizePeerScore(avg, N));
    }
  }

  // 5. Compute blended rank for each player
  const updates = players.map((p) => {
    const stats = statsByPlayer.get(p.id)!;
    const meetsThreshold =
      maxGamesPlayed > 0 &&
      minGamesPct > 0 &&
      stats.total >= Math.ceil((minGamesPct / 100) * maxGamesPlayed);

    const input: RankComponentInput = {
      playerId: p.id,
      playerKind: p.playerKind as "REGISTERED" | "DROP_IN",
      adminRank: p.rank,
      peerScore: avgPositionByPlayer.get(p.id) ?? null,
      winScore: meetsThreshold ? normalizeWinScore(stats.winRatio) : null,
      defaultRank,
    };

    const computed = computeBlendedRank(input, weights);
    return { id: p.id, computedRank: computed };
  });

  // 6. Batch-write in a transaction
  await prisma.$transaction(
    updates.map(({ id, computedRank }) =>
      prisma.player.update({ where: { id }, data: { computedRank } }),
    ),
  );

  const updatedCount = updates.length;
  writeAuditLog({
    actor,
    action: "RECALCULATE_RANKS",
    after: { updatedCount, timestamp: new Date().toISOString() },
  });

  return { updatedCount };
}

/**
 * Compute the rank breakdown for a single player (for display in admin UI).
 * Does not write to DB.
 */
export async function getPlayerRankBreakdown(
  playerId: string,
): Promise<RankBreakdown> {
  const [player, config, latestPeerSession, rawMatches] = await Promise.all([
    prisma.player.findUniqueOrThrow({
      where: { id: playerId },
      select: { rank: true, playerKind: true, computedRank: true },
    }),
    getAllConfigs(),
    prisma.peerRatingSession.findFirst({
      where: { closedAt: { not: null } },
      orderBy: { year: "desc" },
      include: { ratings: true },
    }),
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
      ORDER BY "createdAt" ASC
    `,
  ]);

  const defaultRank = parseInt(config[CONFIG.DEFAULT_PLAYER_RANK] ?? "50", 10);
  const minGamesPct = parseInt(config[CONFIG.RANK_WINLOSS_MIN_GAMES_PCT] ?? "50", 10);
  const weights: RankWeights = {
    adminWeight: parseFloat(config[CONFIG.RANK_WEIGHT_ADMIN] ?? "1"),
    peerWeight: parseFloat(config[CONFIG.RANK_WEIGHT_PEER] ?? "1"),
    winWeight: parseFloat(config[CONFIG.RANK_WEIGHT_WINLOSS] ?? "1"),
  };

  const allMatches: MatchRecord[] = rawMatches.map((m) => ({
    id: m.id,
    sessionId: m.sessionId,
    teamAPlayerIds: m.teamAPlayerIds,
    teamBPlayerIds: m.teamBPlayerIds,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    createdAt: new Date(m.createdAt),
  }));

  const stats = computeMatchStats(playerId, allMatches);
  const maxGamesPlayed = Math.max(
    0,
    ...allMatches
      .flatMap((m) => [...m.teamAPlayerIds, ...m.teamBPlayerIds])
      // count distinct matches per player (rough max)
      .reduce((acc, id) => {
        acc.set(id, (acc.get(id) ?? 0) + 1);
        return acc;
      }, new Map<string, number>())
      .values(),
  );

  const winThreshold = maxGamesPlayed > 0 && minGamesPct > 0
    ? Math.ceil((minGamesPct / 100) * maxGamesPlayed)
    : 0;
  const meetsThreshold = winThreshold > 0 && stats.total >= winThreshold;

  // Peer score
  let peerScore: number | null = null;
  if (latestPeerSession) {
    const ratings = latestPeerSession.ratings.filter(
      (r) => r.ratedPlayerId === playerId,
    );
    if (ratings.length > 0) {
      const N = new Set(
        latestPeerSession.ratings.map((r) => r.ratedPlayerId),
      ).size;
      const avg = ratings.reduce((a, r) => a + r.position, 0) / ratings.length;
      peerScore = normalizePeerScore(avg, N);
    }
  }

  const winScore = meetsThreshold ? normalizeWinScore(stats.winRatio) : null;
  const adminRank = player.rank ?? defaultRank;

  const input: RankComponentInput = {
    playerId,
    playerKind: player.playerKind as "REGISTERED" | "DROP_IN",
    adminRank: player.rank,
    peerScore,
    winScore,
    defaultRank,
  };

  return {
    computedRank: computeBlendedRank(input, weights),
    adminRank,
    peerScore,
    winScore,
    weights,
    matchStats: stats.total > 0
      ? { total: stats.total, wins: stats.wins, losses: stats.losses, ties: stats.ties, winRatio: stats.winRatio }
      : null,
    meetsThreshold,
    winThreshold,
  };
}
