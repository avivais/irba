import { describe, it, expect } from "vitest";
import {
  computeMatchStats,
  computeMonthlyBreakdown,
  computeSessionBreakdown,
  computeRoundBreakdown,
  computeTeammateAffinity,
  type MatchRecord,
} from "./match-analytics";

function makeMatch(
  overrides: Partial<MatchRecord> & { id: string },
): MatchRecord {
  return {
    id: overrides.id,
    sessionId: overrides.sessionId ?? "s1",
    teamAPlayerIds: overrides.teamAPlayerIds ?? ["p1", "p2", "p3", "p4", "p5"],
    teamBPlayerIds: overrides.teamBPlayerIds ?? ["p6", "p7", "p8", "p9", "p10"],
    scoreA: overrides.scoreA ?? 12,
    scoreB: overrides.scoreB ?? 8,
    createdAt: overrides.createdAt ?? new Date("2026-03-01T00:00:00Z"),
  };
}

// ── computeMatchStats ────────────────────────────────────────────────────────

describe("computeMatchStats", () => {
  it("returns zeros for empty matches", () => {
    const result = computeMatchStats("p1", []);
    expect(result).toEqual({ wins: 0, losses: 0, ties: 0, total: 0, winRatio: 0 });
  });

  it("counts a win when player is on winning team A", () => {
    const m = makeMatch({ id: "m1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8 });
    expect(computeMatchStats("p1", [m]).wins).toBe(1);
  });

  it("counts a loss when player is on losing team A", () => {
    const m = makeMatch({ id: "m1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 5, scoreB: 12 });
    expect(computeMatchStats("p1", [m]).losses).toBe(1);
  });

  it("counts a win when player is on winning team B", () => {
    const m = makeMatch({ id: "m1", teamAPlayerIds: ["p6", "p7", "p8", "p9", "p10"], teamBPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 8, scoreB: 12 });
    expect(computeMatchStats("p1", [m]).wins).toBe(1);
  });

  it("counts a tie when scores are equal", () => {
    const m = makeMatch({ id: "m1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 10, scoreB: 10 });
    expect(computeMatchStats("p1", [m]).ties).toBe(1);
  });

  it("ignores matches the player did not participate in", () => {
    const m = makeMatch({ id: "m1", teamAPlayerIds: ["x1", "x2", "x3", "x4", "x5"] });
    expect(computeMatchStats("p1", [m]).total).toBe(0);
  });

  it("computes winRatio excluding ties", () => {
    const matches = [
      makeMatch({ id: "m1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8 }),
      makeMatch({ id: "m2", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8 }),
      makeMatch({ id: "m3", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 5, scoreB: 12 }),
    ];
    const stats = computeMatchStats("p1", matches);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.winRatio).toBeCloseTo(2 / 3);
  });

  it("winRatio is 0 when only ties", () => {
    const m = makeMatch({ id: "m1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 10, scoreB: 10 });
    expect(computeMatchStats("p1", [m]).winRatio).toBe(0);
  });
});

// ── computeMonthlyBreakdown ──────────────────────────────────────────────────

describe("computeMonthlyBreakdown", () => {
  it("returns empty for no matches", () => {
    expect(computeMonthlyBreakdown("p1", [])).toEqual([]);
  });

  it("groups matches by calendar month", () => {
    const matches = [
      makeMatch({ id: "m1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8, createdAt: new Date("2026-03-05T00:00:00Z") }),
      makeMatch({ id: "m2", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 5, scoreB: 12, createdAt: new Date("2026-03-12T00:00:00Z") }),
      makeMatch({ id: "m3", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8, createdAt: new Date("2026-04-01T00:00:00Z") }),
    ];
    const result = computeMonthlyBreakdown("p1", matches);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ month: "2026-03", wins: 1, losses: 1 });
    expect(result[1]).toMatchObject({ month: "2026-04", wins: 1, losses: 0 });
  });

  it("sorts months ascending", () => {
    const matches = [
      makeMatch({ id: "m1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8, createdAt: new Date("2026-04-01T00:00:00Z") }),
      makeMatch({ id: "m2", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8, createdAt: new Date("2026-02-01T00:00:00Z") }),
    ];
    const months = computeMonthlyBreakdown("p1", matches).map((r) => r.month);
    expect(months).toEqual(["2026-02", "2026-04"]);
  });
});

// ── computeSessionBreakdown ──────────────────────────────────────────────────

describe("computeSessionBreakdown", () => {
  it("returns empty for no matches", () => {
    expect(computeSessionBreakdown("p1", [])).toEqual([]);
  });

  it("groups multiple matches within the same session", () => {
    const matches = [
      makeMatch({ id: "m1", sessionId: "s1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8, createdAt: new Date("2026-03-01T20:00:00Z") }),
      makeMatch({ id: "m2", sessionId: "s1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 5, scoreB: 12, createdAt: new Date("2026-03-01T21:00:00Z") }),
    ];
    const result = computeSessionBreakdown("p1", matches);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ sessionId: "s1", wins: 1, losses: 1 });
  });

  it("sorts sessions ascending by date", () => {
    const matches = [
      makeMatch({ id: "m1", sessionId: "s2", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8, createdAt: new Date("2026-03-08T00:00:00Z") }),
      makeMatch({ id: "m2", sessionId: "s1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8, createdAt: new Date("2026-03-01T00:00:00Z") }),
    ];
    const result = computeSessionBreakdown("p1", matches);
    expect(result[0].sessionId).toBe("s1");
    expect(result[1].sessionId).toBe("s2");
  });
});

// ── computeTeammateAffinity ──────────────────────────────────────────────────

describe("computeTeammateAffinity", () => {
  it("returns empty for no matches", () => {
    expect(computeTeammateAffinity("p1", [])).toEqual([]);
  });

  it("counts shared wins and total matches together", () => {
    const win = makeMatch({
      id: "m1",
      teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"],
      teamBPlayerIds: ["p6", "p7", "p8", "p9", "p10"],
      scoreA: 12,
      scoreB: 8,
    });
    const loss = makeMatch({
      id: "m2",
      teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"],
      teamBPlayerIds: ["p6", "p7", "p8", "p9", "p10"],
      scoreA: 5,
      scoreB: 12,
    });
    const result = computeTeammateAffinity("p1", [win, loss]);
    const p2 = result.find((r) => r.teammateId === "p2")!;
    expect(p2.sharedWins).toBe(1);
    expect(p2.totalMatchesTogether).toBe(2);
  });

  it("sorts by sharedWins descending", () => {
    const matches = [
      makeMatch({ id: "m1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8 }),
      makeMatch({ id: "m2", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8 }),
      makeMatch({ id: "m3", teamAPlayerIds: ["p1", "p3", "p4", "p5", "p6"], scoreA: 12, scoreB: 8 }),
    ];
    const result = computeTeammateAffinity("p1", matches);
    // p2 has 2 shared wins, p3/p4/p5 have 3 shared wins
    expect(result[0].sharedWins).toBeGreaterThanOrEqual(result[1].sharedWins);
  });

  it("does not include the player themselves as a teammate", () => {
    const m = makeMatch({ id: "m1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8 });
    const result = computeTeammateAffinity("p1", [m]);
    expect(result.every((r) => r.teammateId !== "p1")).toBe(true);
  });

  it("respects topN limit", () => {
    const m = makeMatch({ id: "m1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8 });
    const result = computeTeammateAffinity("p1", [m], 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("counts opponents as separate, not teammates", () => {
    const m = makeMatch({
      id: "m1",
      teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"],
      teamBPlayerIds: ["p6", "p7", "p8", "p9", "p10"],
      scoreA: 12,
      scoreB: 8,
    });
    const result = computeTeammateAffinity("p1", [m]);
    expect(result.every((r) => !["p6", "p7", "p8", "p9", "p10"].includes(r.teammateId))).toBe(true);
  });
});

// ── computeRoundBreakdown ────────────────────────────────────────────────────

describe("computeRoundBreakdown", () => {
  function makeOrders(sessionIds: string[]): Map<string, number> {
    return new Map(sessionIds.map((id, i) => [id, i]));
  }
  function makeDates(sessionIds: string[]): Map<string, Date> {
    return new Map(sessionIds.map((id, i) => [id, new Date(2026, 0, i + 1)]));
  }

  it("returns empty for no matches", () => {
    expect(computeRoundBreakdown("p1", [], new Map(), new Map(), 5)).toEqual([]);
  });

  it("groups sessions into rounds of given size", () => {
    const sessions = ["s1", "s2", "s3", "s4", "s5", "s6"];
    const orders = makeOrders(sessions);
    const dates = makeDates(sessions);
    const matches = [
      makeMatch({ id: "m1", sessionId: "s1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8 }),
      makeMatch({ id: "m2", sessionId: "s3", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 5, scoreB: 12 }),
      makeMatch({ id: "m3", sessionId: "s6", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8 }),
    ];
    const result = computeRoundBreakdown("p1", matches, orders, dates, 5);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ round: 1, wins: 1, losses: 1 });
    expect(result[1]).toMatchObject({ round: 2, wins: 1, losses: 0 });
  });

  it("sorts rounds ascending", () => {
    const sessions = ["s1", "s2", "s3", "s4", "s5", "s6"];
    const orders = makeOrders(sessions);
    const dates = makeDates(sessions);
    const matches = [
      makeMatch({ id: "m1", sessionId: "s6", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8 }),
      makeMatch({ id: "m2", sessionId: "s1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8 }),
    ];
    const result = computeRoundBreakdown("p1", matches, orders, dates, 5);
    expect(result[0].round).toBeLessThan(result[1].round);
  });

  it("ignores matches for unknown sessions", () => {
    const orders = new Map([["s1", 0]]);
    const dates = new Map<string, Date>([["s1", new Date(2026, 0, 1)]]);
    const matches = [
      makeMatch({ id: "m1", sessionId: "s_unknown", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8 }),
      makeMatch({ id: "m2", sessionId: "s1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8 }),
    ];
    const result = computeRoundBreakdown("p1", matches, orders, dates, 5);
    expect(result).toHaveLength(1);
    expect(result[0].wins).toBe(1);
  });

  it("single-session rounds work with roundSize=1", () => {
    const sessions = ["s1", "s2"];
    const orders = makeOrders(sessions);
    const dates = makeDates(sessions);
    const matches = [
      makeMatch({ id: "m1", sessionId: "s1", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 12, scoreB: 8 }),
      makeMatch({ id: "m2", sessionId: "s2", teamAPlayerIds: ["p1", "p2", "p3", "p4", "p5"], scoreA: 5, scoreB: 12 }),
    ];
    const result = computeRoundBreakdown("p1", matches, orders, dates, 1);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ round: 1, wins: 1 });
    expect(result[1]).toMatchObject({ round: 2, losses: 1 });
  });
});
