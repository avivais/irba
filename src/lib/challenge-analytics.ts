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
 * @param minMatchesThreshold - minimum matches played in window to appear (absolute count)
 * @param windowSessionIds - ordered session IDs in the window
 * @param matches - all matches (will be filtered to window sessions)
 * @param playerNames - playerId → displayName
 */
export function computeLeaderboard(params: {
  minMatchesThreshold: number;
  windowSessionIds: string[];
  matches: MatchRecord[];
  playerNames: Map<string, string>;
}): LeaderboardEntry[] {
  const { minMatchesThreshold, windowSessionIds, matches, playerNames } =
    params;

  if (windowSessionIds.length === 0) return [];

  const windowSet = new Set(windowSessionIds);
  const windowMatches = matches.filter((m) => windowSet.has(m.sessionId));

  const entries: LeaderboardEntry[] = [];

  for (const [playerId, displayName] of playerNames) {
    const stats = computeMatchStats(playerId, windowMatches);
    if (stats.total < minMatchesThreshold) continue;

    entries.push({
      playerId,
      displayName,
      winRatio: stats.winRatio,
      matchesPlayed: stats.total,
      rank: 0, // assigned below
    });
  }

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
