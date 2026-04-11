// Pure challenge leaderboard computation — no DB, no Node.js imports.
// Safe to import from tests and client components.

import { computeMatchStats, type MatchRecord } from "@/lib/match-analytics";

export type ChallengeMetric = "win_ratio" | "total_wins" | "attendance";

export type LeaderboardEntry = {
  playerId: string;
  displayName: string;
  value: number; // win_ratio: 0–1, total_wins: integer, attendance: integer
  matchesPlayed: number;
  sessionsAttended: number;
  rank: number;
};

/**
 * Compute the leaderboard for a challenge.
 *
 * @param metric - which metric to rank by
 * @param eligibilityMinPct - minimum % of sessions in window a player must attend (0 = all qualify)
 * @param windowSessionIds - ordered session IDs in the window
 * @param matches - all matches (will be filtered to window sessions)
 * @param attendanceBySession - sessionId → [playerId]
 * @param playerNames - playerId → displayName
 */
export function computeLeaderboard(params: {
  metric: ChallengeMetric;
  eligibilityMinPct: number;
  windowSessionIds: string[];
  matches: MatchRecord[];
  attendanceBySession: Map<string, string[]>;
  playerNames: Map<string, string>;
}): LeaderboardEntry[] {
  const {
    metric,
    eligibilityMinPct,
    windowSessionIds,
    matches,
    attendanceBySession,
    playerNames,
  } = params;

  const windowSet = new Set(windowSessionIds);
  const windowMatches = matches.filter((m) => windowSet.has(m.sessionId));

  // Count sessions attended per player across the window
  const attendanceCount = new Map<string, number>();
  for (const sid of windowSessionIds) {
    const players = attendanceBySession.get(sid) ?? [];
    for (const pid of players) {
      attendanceCount.set(pid, (attendanceCount.get(pid) ?? 0) + 1);
    }
  }

  const sessionCount = windowSessionIds.length;
  if (sessionCount === 0) return [];

  const minRequired =
    sessionCount === 0
      ? 0
      : Math.ceil((eligibilityMinPct / 100) * sessionCount);

  const entries: LeaderboardEntry[] = [];

  for (const [playerId, displayName] of playerNames) {
    const attended = attendanceCount.get(playerId) ?? 0;
    if (attended < minRequired) continue;

    const stats = computeMatchStats(playerId, windowMatches);
    let value: number;

    switch (metric) {
      case "win_ratio":
        value = stats.winRatio;
        break;
      case "total_wins":
        value = stats.wins;
        break;
      case "attendance":
        value = attended;
        break;
    }

    entries.push({
      playerId,
      displayName,
      value,
      matchesPlayed: stats.total,
      sessionsAttended: attended,
      rank: 0, // assigned below
    });
  }

  // Sort descending by value, then alphabetically for stable tie-breaking
  entries.sort((a, b) => {
    if (b.value !== a.value) return b.value - a.value;
    return a.displayName.localeCompare(b.displayName);
  });

  // Assign ranks — ties share rank
  for (let i = 0; i < entries.length; i++) {
    if (i === 0 || entries[i].value < entries[i - 1].value) {
      entries[i].rank = i + 1;
    } else {
      entries[i].rank = entries[i - 1].rank;
    }
  }

  return entries;
}
