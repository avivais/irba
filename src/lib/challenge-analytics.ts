// Pure challenge leaderboard computation — no DB, no Node.js imports.
// Safe to import from tests and client components.

import { computeMatchStats, type MatchRecord } from "@/lib/match-analytics";

export type SessionStat = {
  sessionId: string;
  wins: number;
  losses: number;
  total: number;
};

export type LeaderboardEntry = {
  playerId: string;
  displayName: string;
  /** Win ratio (0–1). Ties excluded from denominator. */
  winRatio: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  rank: number;
  /** Per-session breakdown within the competition window, ordered by window session order. */
  sessionStats: SessionStat[];
};

export type IneligibleEntry = {
  playerId: string;
  displayName: string;
  /** Win ratio (0–1). Shown for comparison/incentive. */
  winRatio: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  /** How many more matches needed to reach effectiveThreshold. */
  gamesNeeded: number;
  /** Per-session breakdown within the competition window, ordered by window session order. */
  sessionStats: SessionStat[];
};

export type LeaderboardResult = {
  leaderboard: LeaderboardEntry[];
  ineligible: IneligibleEntry[];
  /** Nominal match count required for eligibility (derived from minMatchesPct × maxMatchesPlayed). */
  effectiveThreshold: number;
};

/**
 * Compute the win-% leaderboard for a competition window.
 *
 * @param minMatchesPct - 0–100; minimum matches as % of the most-active player's matches.
 *   e.g. 50 means a player must have played ≥ round(0.5 × maxMatchesPlayed) to appear.
 *   0 = everyone qualifies.
 * @param windowSessionIds - ordered session IDs in the window
 * @param matches - all matches (will be filtered to window sessions)
 * @param playerNames - playerId → displayName (only registered players — drop-ins excluded by caller)
 * @param registeredPlayerIds - only these player IDs are considered; drop-ins are skipped entirely
 */
export function computeLeaderboard(params: {
  minMatchesPct: number;
  windowSessionIds: string[];
  matches: MatchRecord[];
  playerNames: Map<string, string>;
  registeredPlayerIds: Set<string>;
}): LeaderboardResult {
  const { minMatchesPct, windowSessionIds, matches, playerNames, registeredPlayerIds } = params;

  if (windowSessionIds.length === 0) return { leaderboard: [], ineligible: [], effectiveThreshold: 0 };

  const windowSet = new Set(windowSessionIds);
  const windowMatches = matches.filter((m) => windowSet.has(m.sessionId));

  // Compute stats for every registered player first so we can find the max
  const allEntries: Array<Omit<LeaderboardEntry, "rank">> = [];
  for (const [playerId, displayName] of playerNames) {
    if (!registeredPlayerIds.has(playerId)) continue; // drop-ins excluded
    const stats = computeMatchStats(playerId, windowMatches);

    // Per-session breakdown
    const sessionStats: SessionStat[] = windowSessionIds.map((sessionId) => {
      const sessionMatches = windowMatches.filter((m) => m.sessionId === sessionId);
      const s = computeMatchStats(playerId, sessionMatches);
      return { sessionId, wins: s.wins, losses: s.losses, total: s.total };
    });

    allEntries.push({
      playerId,
      displayName,
      winRatio: stats.winRatio,
      matchesPlayed: stats.total,
      wins: stats.wins,
      losses: stats.losses,
      sessionStats,
    });
  }

  // Derive the effective threshold from the percentage
  const maxMatchesPlayed = allEntries.reduce(
    (max, e) => Math.max(max, e.matchesPlayed),
    0,
  );
  const effectiveThreshold = Math.round((minMatchesPct / 100) * maxMatchesPlayed);

  // Split into eligible and ineligible
  const eligibleEntries: LeaderboardEntry[] = [];
  const ineligibleEntries: IneligibleEntry[] = [];

  for (const entry of allEntries) {
    if (entry.matchesPlayed >= effectiveThreshold) {
      eligibleEntries.push({ ...entry, rank: 0 });
    } else {
      ineligibleEntries.push({
        ...entry,
        gamesNeeded: effectiveThreshold - entry.matchesPlayed,
      });
    }
  }

  // Sort eligible: win ratio desc, then more matches played (tie-break), then name (stable)
  eligibleEntries.sort((a, b) => {
    if (b.winRatio !== a.winRatio) return b.winRatio - a.winRatio;
    if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
    return a.displayName.localeCompare(b.displayName);
  });

  // Assign ranks — ties share rank (based on win ratio only)
  for (let i = 0; i < eligibleEntries.length; i++) {
    if (i === 0 || eligibleEntries[i].winRatio < eligibleEntries[i - 1].winRatio) {
      eligibleEntries[i].rank = i + 1;
    } else {
      eligibleEntries[i].rank = eligibleEntries[i - 1].rank;
    }
  }

  // Sort ineligible: most matches played first (closest to qualifying)
  ineligibleEntries.sort((a, b) => {
    if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
    return a.displayName.localeCompare(b.displayName);
  });

  return { leaderboard: eligibleEntries, ineligible: ineligibleEntries, effectiveThreshold };
}
