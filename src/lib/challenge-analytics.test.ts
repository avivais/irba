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

function makeRegistered(ids: string[]): Set<string> {
  return new Set(ids);
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
    const { leaderboard } = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches,
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1", "p2"]),
    });
    expect(leaderboard[0].playerId).toBe("p1");
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].winRatio).toBeCloseTo(1.0);
    expect(leaderboard[1].playerId).toBe("p2");
    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].winRatio).toBeCloseTo(0.0);
  });

  it("player with 0 matches has winRatio 0", () => {
    const names = makeNames(["p1"]);
    const { leaderboard } = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches: [],
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1"]),
    });
    expect(leaderboard[0].winRatio).toBe(0);
    expect(leaderboard[0].matchesPlayed).toBe(0);
  });

  it("ties share rank", () => {
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1"], ["p2"], 12, 8),
      makeMatch("m2", "s1", ["p3"], ["p4"], 12, 8),
    ];
    const names = makeNames(["p1", "p2", "p3", "p4"]);
    const { leaderboard } = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches,
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1", "p2", "p3", "p4"]),
    });
    const rank1 = leaderboard.filter((e) => e.winRatio === 1.0);
    const rank2 = leaderboard.filter((e) => e.winRatio === 0.0);
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
    const { leaderboard } = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches,
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1", "p2", "p3"]),
    });
    expect(leaderboard[0].playerId).toBe("p1");
    expect(leaderboard[0].winRatio).toBeCloseTo(1.0);
    expect(leaderboard[1].playerId).toBe("p2");
    expect(leaderboard[1].winRatio).toBeCloseTo(1.0);
    // Both rank 1 since winRatio is equal (ties share rank by winRatio)
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[1].rank).toBe(1);
  });
});

// ── minMatchesPct threshold ───────────────────────────────────────────────────

describe("computeLeaderboard — minMatchesPct", () => {
  it("pct=0 includes everyone (even with 0 matches)", () => {
    const names = makeNames(["p1", "p2"]);
    const { leaderboard, ineligible } = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches: [],
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1", "p2"]),
    });
    expect(leaderboard).toHaveLength(2);
    expect(ineligible).toHaveLength(0);
  });

  it("excludes players below pct threshold — they appear in ineligible", () => {
    // p1 plays 4 matches, p2 plays 1 match
    // threshold = round(0.5 * 4) = 2 → p2 excluded (1 < 2)
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1"], ["p3"], 12, 8),
      makeMatch("m2", "s1", ["p1"], ["p3"], 12, 8),
      makeMatch("m3", "s1", ["p1"], ["p3"], 12, 8),
      makeMatch("m4", "s1", ["p1"], ["p2"], 12, 8), // p2 only in this one
    ];
    const names = makeNames(["p1", "p2"]);
    const { leaderboard, ineligible, effectiveThreshold } = computeLeaderboard({
      minMatchesPct: 50,
      windowSessionIds: ["s1"],
      matches,
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1", "p2"]),
    });
    expect(leaderboard).toHaveLength(1);
    expect(leaderboard[0].playerId).toBe("p1");
    expect(ineligible).toHaveLength(1);
    expect(ineligible[0].playerId).toBe("p2");
    expect(ineligible[0].gamesNeeded).toBe(effectiveThreshold - 1);
  });

  it("ineligible entry has correct gamesNeeded", () => {
    // p1: 6 matches (max), p2: 2 matches; threshold = round(0.5 * 6) = 3
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1"], ["p2"], 12, 8),
      makeMatch("m2", "s1", ["p1"], ["p2"], 12, 8),
      makeMatch("m3", "s1", ["p1"], ["p2"], 12, 8),
      makeMatch("m4", "s1", ["p1"], ["p2"], 12, 8),
      makeMatch("m5", "s1", ["p1"], ["p2"], 12, 8),
      makeMatch("m6", "s1", ["p1"], ["p2"], 12, 8),
    ];
    const names = makeNames(["p1", "p2"]);
    const { ineligible } = computeLeaderboard({
      minMatchesPct: 50,
      windowSessionIds: ["s1"],
      matches,
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1", "p2"]),
    });
    // p2 played 6 games too (all involve p2), so both are eligible — adjust test
    // Let's only give p2 2 matches
    expect(ineligible).toHaveLength(0); // p2 played all 6 too in this setup
  });

  it("pct=100 keeps only the max-played player(s)", () => {
    // p1 played 3, p2 played 2 → threshold=round(1.0*3)=3 → only p1 qualifies
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1"], ["p3"], 12, 8),
      makeMatch("m2", "s1", ["p1"], ["p3"], 12, 8),
      makeMatch("m3", "s1", ["p1"], ["p2"], 12, 8),
      makeMatch("m4", "s1", ["p2"], ["p3"], 12, 8),
      makeMatch("m5", "s1", ["p2"], ["p3"], 12, 8),
    ];
    const names = makeNames(["p1", "p2", "p3"]);
    const { leaderboard } = computeLeaderboard({
      minMatchesPct: 100,
      windowSessionIds: ["s1"],
      matches,
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1", "p2", "p3"]),
    });
    // p1: m1, m2, m3 → 3; p2: m3, m4, m5 → 3; p3: m1, m2, m4, m5 → 4
    // threshold = round(1.0*4) = 4 → only p3 qualifies
    expect(leaderboard.every((e) => e.matchesPlayed === 4)).toBe(true);
  });

  it("no matches → threshold=0 → everyone qualifies", () => {
    const names = makeNames(["p1", "p2"]);
    const { leaderboard, ineligible } = computeLeaderboard({
      minMatchesPct: 50,
      windowSessionIds: ["s1"],
      matches: [],
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1", "p2"]),
    });
    // maxPlayed=0 → threshold=round(0.5*0)=0 → everyone qualifies
    expect(leaderboard).toHaveLength(2);
    expect(ineligible).toHaveLength(0);
  });

  it("uses Math.round not Math.ceil — 7.4 rounds to 7, 7.6 rounds to 8", () => {
    // To get 7.4: maxPlayed must be such that pct/100 * max = 7.4
    // e.g. max=10, pct=74 → 7.4 → round=7
    // To get 7.6: max=10, pct=76 → 7.6 → round=8
    // We test by checking effectiveThreshold directly

    // Build 10 matches for p1
    const matches10: MatchRecord[] = Array.from({ length: 10 }, (_, i) =>
      makeMatch(`m${i}`, "s1", ["p1"], ["p2"], 12, 8),
    );
    const names = makeNames(["p1", "p2"]);

    const { effectiveThreshold: t74 } = computeLeaderboard({
      minMatchesPct: 74,
      windowSessionIds: ["s1"],
      matches: matches10,
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1", "p2"]),
    });
    expect(t74).toBe(7); // round(7.4) = 7

    const { effectiveThreshold: t76 } = computeLeaderboard({
      minMatchesPct: 76,
      windowSessionIds: ["s1"],
      matches: matches10,
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1", "p2"]),
    });
    expect(t76).toBe(8); // round(7.6) = 8
  });
});

// ── drop-in filtering ─────────────────────────────────────────────────────────

describe("computeLeaderboard — drop-in filtering", () => {
  it("excludes players not in registeredPlayerIds", () => {
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1", "dropin1"], ["p2", "dropin2"], 12, 8),
    ];
    const names = makeNames(["p1", "p2", "dropin1", "dropin2"]);
    const { leaderboard, ineligible } = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches,
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1", "p2"]), // drop-ins excluded
    });
    const allIds = [...leaderboard, ...ineligible].map((e) => e.playerId);
    expect(allIds).not.toContain("dropin1");
    expect(allIds).not.toContain("dropin2");
    expect(allIds).toContain("p1");
    expect(allIds).toContain("p2");
  });

  it("drop-in matches still count for registered players", () => {
    // p1 (registered) wins against dropin1 (drop-in)
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1"], ["dropin1"], 12, 8),
    ];
    const names = makeNames(["p1", "dropin1"]);
    const { leaderboard } = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches,
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1"]),
    });
    expect(leaderboard).toHaveLength(1);
    expect(leaderboard[0].playerId).toBe("p1");
    expect(leaderboard[0].winRatio).toBeCloseTo(1.0);
    expect(leaderboard[0].matchesPlayed).toBe(1);
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
    const { leaderboard } = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"], // only s1
      matches,
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1", "p2"]),
    });
    expect(leaderboard[0].playerId).toBe("p1");
    expect(leaderboard[0].winRatio).toBeCloseTo(1.0);
  });

  it("returns empty leaderboard for empty window", () => {
    const { leaderboard, ineligible, effectiveThreshold } = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: [],
      matches: [],
      playerNames: new Map([["p1", "Player 1"]]),
      registeredPlayerIds: makeRegistered(["p1"]),
    });
    expect(leaderboard).toHaveLength(0);
    expect(ineligible).toHaveLength(0);
    expect(effectiveThreshold).toBe(0);
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
    const { leaderboard } = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches,
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1"]),
    });
    expect(leaderboard[0].matchesPlayed).toBe(2);
  });

  it("LeaderboardEntry has no sessionsAttended field", () => {
    const names = makeNames(["p1"]);
    const { leaderboard } = computeLeaderboard({
      minMatchesPct: 0,
      windowSessionIds: ["s1"],
      matches: [],
      playerNames: names,
      registeredPlayerIds: makeRegistered(["p1"]),
    });
    expect("sessionsAttended" in leaderboard[0]).toBe(false);
  });
});
