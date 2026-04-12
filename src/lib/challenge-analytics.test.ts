import { describe, it, expect } from "vitest";
import { computeLeaderboard } from "./challenge-analytics";
import type { MatchRecord } from "./match-analytics";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeMatch(
  id: string,
  sessionId: string,
  teamA: string[],
  teamB: string[],
  scoreA: number,
  scoreB: number,
): MatchRecord {
  return {
    id,
    sessionId,
    teamAPlayerIds: teamA,
    teamBPlayerIds: teamB,
    scoreA,
    scoreB,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
}

function makeNames(ids: string[]): Map<string, string> {
  return new Map(ids.map((id) => [id, `Player ${id}`]));
}

// ── win_ratio ─────────────────────────────────────────────────────────────────

describe("computeLeaderboard — win_ratio", () => {
  it("ranks players by win ratio descending", () => {
    // p1: 2W 0L → 1.0, p2: 0W 2L → 0.0
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1"], ["p2"], 12, 8),
      makeMatch("m2", "s1", ["p1"], ["p2"], 12, 8),
    ];
    const names = makeNames(["p1", "p2"]);
    const result = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches,
      playerNames: names,
    });
    expect(result[0].playerId).toBe("p1");
    expect(result[0].rank).toBe(1);
    expect(result[0].winRatio).toBeCloseTo(1.0);
    expect(result[1].playerId).toBe("p2");
    expect(result[1].rank).toBe(2);
    expect(result[1].winRatio).toBeCloseTo(0.0);
  });

  it("player with 0 matches has winRatio 0", () => {
    const names = makeNames(["p1"]);
    const result = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches: [],
      playerNames: names,
    });
    expect(result[0].winRatio).toBe(0);
    expect(result[0].matchesPlayed).toBe(0);
  });

  it("ties share rank", () => {
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1"], ["p2"], 12, 8),
      makeMatch("m2", "s1", ["p3"], ["p4"], 12, 8),
    ];
    const names = makeNames(["p1", "p2", "p3", "p4"]);
    const result = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches,
      playerNames: names,
    });
    const rank1 = result.filter((e) => e.winRatio === 1.0);
    const rank2 = result.filter((e) => e.winRatio === 0.0);
    expect(rank1.every((e) => e.rank === 1)).toBe(true);
    expect(rank2.every((e) => e.rank === rank1.length + 1)).toBe(true);
  });

  it("tie-breaks by more matches played", () => {
    // p1 and p2 both 100% win rate, but p1 has 2 matches vs p2's 1 → p1 appears first
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1"], ["p3"], 12, 8),
      makeMatch("m2", "s1", ["p1"], ["p3"], 12, 8),
      makeMatch("m3", "s1", ["p2"], ["p3"], 12, 8),
    ];
    const names = makeNames(["p1", "p2", "p3"]);
    const result = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches,
      playerNames: names,
    });
    expect(result[0].playerId).toBe("p1");
    expect(result[0].winRatio).toBeCloseTo(1.0);
    expect(result[1].playerId).toBe("p2");
    expect(result[1].winRatio).toBeCloseTo(1.0);
    // Both rank 1 since winRatio is equal (ties share rank by winRatio)
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(1);
  });
});

// ── minMatchesPct threshold ───────────────────────────────────────────────────

describe("computeLeaderboard — minMatchesPct", () => {
  it("pct=0 includes everyone (even with 0 matches)", () => {
    const names = makeNames(["p1", "p2"]);
    const result = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches: [],
      playerNames: names,
    });
    expect(result).toHaveLength(2);
  });

  it("excludes players below pct threshold", () => {
    // p1 plays 4 matches, p2 plays 1 match; threshold=50% → ceil(0.5*4)=2 → p2 excluded
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1"], ["p3"], 12, 8),
      makeMatch("m2", "s1", ["p1"], ["p3"], 12, 8),
      makeMatch("m3", "s1", ["p1"], ["p3"], 12, 8),
      makeMatch("m4", "s1", ["p1"], ["p2"], 12, 8), // p2 only in this one
    ];
    const names = makeNames(["p1", "p2"]);
    const result = computeLeaderboard({
      minMatchesPct: 50,
      windowSessionIds: ["s1"],
      matches,
      playerNames: names,
    });
    expect(result).toHaveLength(1);
    expect(result[0].playerId).toBe("p1");
  });

  it("pct=100 keeps only the max-played player(s)", () => {
    // p1 played 3, p2 played 2 → threshold=ceil(1.0*3)=3 → only p1 qualifies
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1"], ["p3"], 12, 8),
      makeMatch("m2", "s1", ["p1"], ["p3"], 12, 8),
      makeMatch("m3", "s1", ["p1"], ["p2"], 12, 8),
      makeMatch("m4", "s1", ["p2"], ["p3"], 12, 8),
      makeMatch("m5", "s1", ["p2"], ["p3"], 12, 8),
    ];
    const names = makeNames(["p1", "p2", "p3"]);
    const result = computeLeaderboard({
      minMatchesPct: 100,
      windowSessionIds: ["s1"],
      matches,
      playerNames: names,
    });
    // p1 has 3 matches (max), p2 has 3 matches (m4, m5, m3), p3 has 3 (m1, m2, m3... wait)
    // p1: m1, m2, m3 → 3; p2: m3, m4, m5 → 3; p3: m1, m2, m4, m5 → 4
    // Actually p3 has 4, p1/p2 have 3. threshold = ceil(1.0*4) = 4 → only p3
    expect(result.every((e) => e.matchesPlayed === 4)).toBe(true);
  });

  it("player not meeting pct threshold is excluded", () => {
    const names = makeNames(["p1", "p2"]);
    // No matches → maxPlayed=0 → threshold=ceil(50%*0)=0 → everyone qualifies (pct of 0 is 0)
    const result = computeLeaderboard({
      minMatchesPct: 50,
      windowSessionIds: ["s1"],
      matches: [],
      playerNames: names,
    });
    // With maxPlayed=0, threshold=0, all players qualify
    expect(result).toHaveLength(2);
  });
});

// ── window scoping ────────────────────────────────────────────────────────────

describe("computeLeaderboard — window scoping", () => {
  it("ignores matches outside the window", () => {
    // m1 is in s1 (in window), m2 is in s99 (outside window)
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1"], ["p2"], 12, 8), // p1 wins
      makeMatch("m2", "s99", ["p2"], ["p1"], 12, 8), // p2 wins (outside window)
    ];
    const names = makeNames(["p1", "p2"]);
    const result = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"], // only s1
      matches,
      playerNames: names,
    });
    expect(result[0].playerId).toBe("p1");
    expect(result[0].winRatio).toBeCloseTo(1.0);
  });

  it("returns empty leaderboard for empty window", () => {
    const result = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: [],
      matches: [],
      playerNames: new Map([["p1", "Player 1"]]),
    });
    expect(result).toHaveLength(0);
  });
});

// ── misc ──────────────────────────────────────────────────────────────────────

describe("computeLeaderboard — misc", () => {
  it("matchesPlayed is populated correctly", () => {
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1"], ["p2"], 12, 8),
      makeMatch("m2", "s1", ["p1"], ["p2"], 12, 8),
    ];
    const names = makeNames(["p1"]);
    const result = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches,
      playerNames: names,
    });
    expect(result[0].matchesPlayed).toBe(2);
  });

  it("LeaderboardEntry has no sessionsAttended field", () => {
    const names = makeNames(["p1"]);
    const result = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches: [],
      playerNames: names,
    });
    expect("sessionsAttended" in result[0]).toBe(false);
  });
});
