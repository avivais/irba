import { describe, it, expect } from "vitest";
import { computeLeaderboard, type ChallengeMetric } from "./challenge-analytics";
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

function makeAttendance(sessions: Record<string, string[]>): Map<string, string[]> {
  return new Map(Object.entries(sessions));
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
    const attendance = makeAttendance({ s1: ["p1", "p2"] });
    const names = makeNames(["p1", "p2"]);
    const result = computeLeaderboard({
      metric: "win_ratio",
      eligibilityMinPct: 0,
      windowSessionIds: ["s1"],
      matches,
      attendanceBySession: attendance,
      playerNames: names,
    });
    expect(result[0].playerId).toBe("p1");
    expect(result[0].rank).toBe(1);
    expect(result[0].value).toBeCloseTo(1.0);
    expect(result[1].playerId).toBe("p2");
    expect(result[1].rank).toBe(2);
    expect(result[1].value).toBeCloseTo(0.0);
  });

  it("player with 0 matches has win_ratio 0", () => {
    const attendance = makeAttendance({ s1: ["p1"] });
    const names = makeNames(["p1"]);
    const result = computeLeaderboard({
      metric: "win_ratio",
      eligibilityMinPct: 0,
      windowSessionIds: ["s1"],
      matches: [],
      attendanceBySession: attendance,
      playerNames: names,
    });
    expect(result[0].value).toBe(0);
    expect(result[0].matchesPlayed).toBe(0);
  });

  it("ties share rank", () => {
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1"], ["p2"], 12, 8),
      makeMatch("m2", "s1", ["p3"], ["p4"], 12, 8),
    ];
    const attendance = makeAttendance({ s1: ["p1", "p2", "p3", "p4"] });
    const names = makeNames(["p1", "p2", "p3", "p4"]);
    const result = computeLeaderboard({
      metric: "win_ratio",
      eligibilityMinPct: 0,
      windowSessionIds: ["s1"],
      matches,
      attendanceBySession: attendance,
      playerNames: names,
    });
    const rank1 = result.filter((e) => e.value === 1.0);
    const rank2 = result.filter((e) => e.value === 0.0);
    expect(rank1.every((e) => e.rank === 1)).toBe(true);
    expect(rank2.every((e) => e.rank === rank1.length + 1)).toBe(true);
  });
});

// ── total_wins ────────────────────────────────────────────────────────────────

describe("computeLeaderboard — total_wins", () => {
  it("ranks players by total wins descending", () => {
    // p1: 3 wins, p2: 1 win
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1"], ["p2"], 12, 8),
      makeMatch("m2", "s1", ["p1"], ["p2"], 12, 8),
      makeMatch("m3", "s1", ["p1"], ["p2"], 12, 8),
    ];
    const attendance = makeAttendance({ s1: ["p1", "p2"] });
    const names = makeNames(["p1", "p2"]);
    const result = computeLeaderboard({
      metric: "total_wins",
      eligibilityMinPct: 0,
      windowSessionIds: ["s1"],
      matches,
      attendanceBySession: attendance,
      playerNames: names,
    });
    expect(result[0].playerId).toBe("p1");
    expect(result[0].value).toBe(3);
    expect(result[1].value).toBe(0);
  });
});

// ── attendance ────────────────────────────────────────────────────────────────

describe("computeLeaderboard — attendance", () => {
  it("ranks players by sessions attended", () => {
    // p1 attends 3 sessions, p2 attends 1
    const attendance = makeAttendance({
      s1: ["p1", "p2"],
      s2: ["p1"],
      s3: ["p1"],
    });
    const names = makeNames(["p1", "p2"]);
    const result = computeLeaderboard({
      metric: "attendance",
      eligibilityMinPct: 0,
      windowSessionIds: ["s1", "s2", "s3"],
      matches: [],
      attendanceBySession: attendance,
      playerNames: names,
    });
    expect(result[0].playerId).toBe("p1");
    expect(result[0].value).toBe(3);
    expect(result[1].value).toBe(1);
  });
});

// ── eligibility threshold ─────────────────────────────────────────────────────

describe("computeLeaderboard — eligibility", () => {
  it("excludes players below threshold", () => {
    // 4 sessions, threshold 50% → need ≥2 sessions
    // p1 attends 3, p2 attends 1 → p2 excluded
    const attendance = makeAttendance({
      s1: ["p1", "p2"],
      s2: ["p1"],
      s3: ["p1"],
      s4: ["p1"],
    });
    const names = makeNames(["p1", "p2"]);
    const result = computeLeaderboard({
      metric: "win_ratio",
      eligibilityMinPct: 50,
      windowSessionIds: ["s1", "s2", "s3", "s4"],
      matches: [],
      attendanceBySession: attendance,
      playerNames: names,
    });
    expect(result).toHaveLength(1);
    expect(result[0].playerId).toBe("p1");
  });

  it("0% eligibility includes everyone who attended at least once", () => {
    const attendance = makeAttendance({ s1: ["p1"], s2: ["p2"] });
    const names = makeNames(["p1", "p2"]);
    const result = computeLeaderboard({
      metric: "attendance",
      eligibilityMinPct: 0,
      windowSessionIds: ["s1", "s2"],
      matches: [],
      attendanceBySession: attendance,
      playerNames: names,
    });
    expect(result).toHaveLength(2);
  });

  it("100% eligibility requires attending every session", () => {
    // 3 sessions; p1 attends all 3, p2 attends 2
    const attendance = makeAttendance({
      s1: ["p1", "p2"],
      s2: ["p1", "p2"],
      s3: ["p1"],
    });
    const names = makeNames(["p1", "p2"]);
    const result = computeLeaderboard({
      metric: "attendance",
      eligibilityMinPct: 100,
      windowSessionIds: ["s1", "s2", "s3"],
      matches: [],
      attendanceBySession: attendance,
      playerNames: names,
    });
    expect(result).toHaveLength(1);
    expect(result[0].playerId).toBe("p1");
  });

  it("player with 0 attendance is excluded when threshold > 0", () => {
    const attendance = makeAttendance({ s1: ["p1"] });
    const names = makeNames(["p1", "p2"]);
    const result = computeLeaderboard({
      metric: "win_ratio",
      eligibilityMinPct: 50,
      windowSessionIds: ["s1"],
      matches: [],
      attendanceBySession: attendance,
      playerNames: names,
    });
    const ids = result.map((e) => e.playerId);
    expect(ids).not.toContain("p2");
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
    const attendance = makeAttendance({ s1: ["p1", "p2"] });
    const names = makeNames(["p1", "p2"]);
    const result = computeLeaderboard({
      metric: "win_ratio",
      eligibilityMinPct: 0,
      windowSessionIds: ["s1"], // only s1
      matches,
      attendanceBySession: attendance,
      playerNames: names,
    });
    expect(result[0].playerId).toBe("p1");
    expect(result[0].value).toBeCloseTo(1.0);
  });

  it("returns empty leaderboard for empty window", () => {
    const result = computeLeaderboard({
      metric: "win_ratio",
      eligibilityMinPct: 0,
      windowSessionIds: [],
      matches: [],
      attendanceBySession: new Map(),
      playerNames: new Map([["p1", "Player 1"]]),
    });
    expect(result).toHaveLength(0);
  });
});

// ── misc ──────────────────────────────────────────────────────────────────────

describe("computeLeaderboard — misc", () => {
  it("sessionsAttended is populated correctly", () => {
    const attendance = makeAttendance({ s1: ["p1"], s2: ["p1"], s3: ["p1"] });
    const names = makeNames(["p1"]);
    const result = computeLeaderboard({
      metric: "attendance",
      eligibilityMinPct: 0,
      windowSessionIds: ["s1", "s2", "s3"],
      matches: [],
      attendanceBySession: attendance,
      playerNames: names,
    });
    expect(result[0].sessionsAttended).toBe(3);
  });

  it("matchesPlayed is populated correctly", () => {
    const matches: MatchRecord[] = [
      makeMatch("m1", "s1", ["p1"], ["p2"], 12, 8),
      makeMatch("m2", "s1", ["p1"], ["p2"], 12, 8),
    ];
    const attendance = makeAttendance({ s1: ["p1", "p2"] });
    const names = makeNames(["p1"]);
    const result = computeLeaderboard({
      metric: "win_ratio",
      eligibilityMinPct: 0,
      windowSessionIds: ["s1"],
      matches,
      attendanceBySession: attendance,
      playerNames: names,
    });
    expect(result[0].matchesPlayed).toBe(2);
  });
});
