// Pure challenge leaderboard computation — no DB, no Node.js imports.
// Safe to import from tests and client components.

import { computeMatchStats, type MatchRecord } from "@/lib/match-analytics";

export type LeaderboardEntry = {
  playerId: string;
  displayName: string;
  /** Win ratio (0–1). Ties excluded from denominator. */
  winRatio: number;
  matchesPlayed: number;
  rank: number;
};

/**
 * Compute the win-% leaderboard for a competition window.
 *
 * @param minMatchesPct - 0–100; minimum matches as % of the most-active player's matches.
 *   e.g. 50 means a player must have played ≥ ceil(0.5 × maxMatchesPlayed) to appear.
 *   0 = everyone qualifies (even with 0 matches).
 * @param windowSessionIds - ordered session IDs in the window
 * @param matches - all matches (will be filtered to window sessions)
 * @param playerNames - playerId → displayName
 */
export function computeLeaderboard(params: {
  minMatchesPct: number;
  windowSessionIds: string[];
  matches: MatchRecord[];
  playerNames: Map<string, string>;
}): LeaderboardEntry[] {
  const { minMatchesPct, windowSessionIds, matches, playerNames } = params;

  if (windowSessionIds.length === 0) return [];

  const windowSet = new Set(windowSessionIds);
  const windowMatches = matches.filter((m) => windowSet.has(m.sessionId));

  // Compute stats for every player first so we can find the max
  const allEntries: LeaderboardEntry[] = [];
  for (const [playerId, displayName] of playerNames) {
    const stats = computeMatchStats(playerId, windowMatches);
    allEntries.push({
      playerId,
      displayName,
      winRatio: stats.winRatio,
      matchesPlayed: stats.total,
      rank: 0,
    });
  }

  // Derive the effective threshold from the percentage
  const maxMatchesPlayed = allEntries.reduce(
    (max, e) => Math.max(max, e.matchesPlayed),
    0,
  );
  const effectiveThreshold = Math.ceil((minMatchesPct / 100) * maxMatchesPlayed);

  const entries = allEntries.filter(
    (e) => e.matchesPlayed >= effectiveThreshold,
  );

  // Sort: win ratio desc, then more matches played (tie-break), then name (stable)
  entries.sort((a, b) => {
    if (b.winRatio !== a.winRatio) return b.winRatio - a.winRatio;
    if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
    return a.displayName.localeCompare(b.displayName);
  });

  // Assign ranks — ties share rank (based on win ratio only)
  for (let i = 0; i < entries.length; i++) {
    if (i === 0 || entries[i].winRatio < entries[i - 1].winRatio) {
      entries[i].rank = i + 1;
    } else {
      entries[i].rank = entries[i - 1].rank;
    }
  }

  return entries;
}
