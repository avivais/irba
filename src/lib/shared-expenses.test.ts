import { describe, it, expect } from "vitest";
import {
  computeSharedExpenseShares,
  computeEligible,
  rollingCutoff,
  type EligibilityCandidate,
} from "./shared-expenses";

describe("computeSharedExpenseShares", () => {
  it("splits a clean total evenly with zero remainder", () => {
    const r = computeSharedExpenseShares(100, 4);
    expect(r.share).toBe(25);
    expect(r.remainder).toBe(0);
    expect(r.perPlayer).toEqual([25, 25, 25, 25]);
  });

  it("distributes the remainder +1 to the first players, sums exactly", () => {
    const r = computeSharedExpenseShares(101, 4);
    expect(r.share).toBe(25);
    expect(r.remainder).toBe(1);
    expect(r.perPlayer).toEqual([26, 25, 25, 25]);
    expect(r.perPlayer.reduce((a, b) => a + b, 0)).toBe(101);
  });

  it("distributes a 3-shekel remainder across the first 3 players", () => {
    const r = computeSharedExpenseShares(103, 5);
    expect(r.share).toBe(20);
    expect(r.remainder).toBe(3);
    expect(r.perPlayer).toEqual([21, 21, 21, 20, 20]);
    expect(r.perPlayer.reduce((a, b) => a + b, 0)).toBe(103);
  });

  it("handles total smaller than playerCount (some get 0)", () => {
    const r = computeSharedExpenseShares(1, 3);
    expect(r.share).toBe(0);
    expect(r.remainder).toBe(1);
    expect(r.perPlayer).toEqual([1, 0, 0]);
  });

  it("returns empty split when playerCount is 0", () => {
    const r = computeSharedExpenseShares(100, 0);
    expect(r.share).toBe(0);
    expect(r.remainder).toBe(0);
    expect(r.perPlayer).toEqual([]);
  });

  it("handles a totalAmount of 0", () => {
    const r = computeSharedExpenseShares(0, 5);
    expect(r.share).toBe(0);
    expect(r.remainder).toBe(0);
    expect(r.perPlayer).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("rollingCutoff", () => {
  it("subtracts whole years correctly", () => {
    const now = new Date("2026-04-29T00:00:00.000Z");
    const cutoff = rollingCutoff(2, now);
    // 2 * 365.25 = 730.5 days back
    const diffDays = (now.getTime() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(730.5, 5);
  });

  it("supports fractional years", () => {
    const now = new Date("2026-04-29T00:00:00.000Z");
    const cutoff = rollingCutoff(0.5, now);
    const diffDays = (now.getTime() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(365.25 / 2, 5);
  });
});

function makeCandidate(
  partial: Partial<EligibilityCandidate> & { playerId: string; sessionsAttended: number },
): EligibilityCandidate {
  return {
    playerId: partial.playerId,
    name: partial.name ?? `Player ${partial.playerId}`,
    playerKind: partial.playerKind ?? "REGISTERED",
    currentBalance: partial.currentBalance ?? 0,
    sessionsAttended: partial.sessionsAttended,
  };
}

describe("computeEligible", () => {
  it("includes players at or above the threshold", () => {
    const candidates = [
      makeCandidate({ playerId: "p1", sessionsAttended: 60 }), // 60% — passes
      makeCandidate({ playerId: "p2", sessionsAttended: 50 }), // 50% — passes (>=)
      makeCandidate({ playerId: "p3", sessionsAttended: 40 }), // 40% — fails
    ];
    const r = computeEligible(candidates, 100, 0.5, "REGISTERED_ONLY");
    expect(r.map((p) => p.playerId).sort()).toEqual(["p1", "p2"]);
    const p1 = r.find((p) => p.playerId === "p1")!;
    expect(p1.attendancePct).toBe(0.6);
    expect(p1.sessionsTotal).toBe(100);
  });

  it("excludes DROP_IN players under REGISTERED_ONLY even at 100% attendance", () => {
    const candidates = [
      makeCandidate({ playerId: "reg1", sessionsAttended: 50 }),
      makeCandidate({ playerId: "drop1", playerKind: "DROP_IN", sessionsAttended: 100 }),
    ];
    const r = computeEligible(candidates, 100, 0.5, "REGISTERED_ONLY");
    expect(r).toHaveLength(1);
    expect(r[0].playerId).toBe("reg1");
  });

  it("includes DROP_IN players under ALL_PLAYERS when they pass the threshold", () => {
    const candidates = [
      makeCandidate({ playerId: "reg1", sessionsAttended: 60 }),
      makeCandidate({ playerId: "drop1", playerKind: "DROP_IN", sessionsAttended: 70 }),
      makeCandidate({ playerId: "drop2", playerKind: "DROP_IN", sessionsAttended: 30 }),
    ];
    const r = computeEligible(candidates, 100, 0.5, "ALL_PLAYERS");
    expect(r.map((p) => p.playerId).sort()).toEqual(["drop1", "reg1"]);
  });

  it("returns empty when sessionsTotal is 0 even with attended sessions", () => {
    const candidates = [makeCandidate({ playerId: "p1", sessionsAttended: 5 })];
    const r = computeEligible(candidates, 0, 0.5, "ALL_PLAYERS");
    expect(r).toEqual([]);
  });

  it("sorts by attendance desc, then by name asc", () => {
    const candidates = [
      makeCandidate({ playerId: "a", name: "Charlie", sessionsAttended: 50 }),
      makeCandidate({ playerId: "b", name: "Alice", sessionsAttended: 50 }),
      makeCandidate({ playerId: "c", name: "Bob", sessionsAttended: 80 }),
    ];
    const r = computeEligible(candidates, 100, 0.5, "ALL_PLAYERS");
    expect(r.map((p) => p.name)).toEqual(["Bob", "Alice", "Charlie"]);
  });

  it("preserves the players' currentBalance", () => {
    const candidates = [
      makeCandidate({ playerId: "p1", sessionsAttended: 60, currentBalance: -200 }),
      makeCandidate({ playerId: "p2", sessionsAttended: 60, currentBalance: 50 }),
    ];
    const r = computeEligible(candidates, 100, 0.5, "ALL_PLAYERS");
    expect(r.find((p) => p.playerId === "p1")!.currentBalance).toBe(-200);
    expect(r.find((p) => p.playerId === "p2")!.currentBalance).toBe(50);
  });
});
