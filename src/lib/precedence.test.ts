import { describe, it, expect } from "vitest";
import {
  computePrecedenceScores,
  type PlayerPrecedenceInput,
  type YearWeightInput,
} from "./precedence";

const CURRENT_YEAR = 2026;

function makePlayer(
  overrides: Partial<PlayerPrecedenceInput> & { id: string },
): PlayerPrecedenceInput {
  return {
    id: overrides.id,
    playerName: overrides.playerName ?? "שחקן",
    aggregates: overrides.aggregates ?? [],
    liveCount: overrides.liveCount ?? 0,
    adjustments: overrides.adjustments ?? [],
  };
}

const weights: YearWeightInput[] = [
  { year: 2024, weight: 1.0 },
  { year: 2025, weight: 1.5 },
  { year: 2026, weight: 2.0 },
];

describe("computePrecedenceScores", () => {
  it("returns empty array for no players", () => {
    expect(computePrecedenceScores([], weights, CURRENT_YEAR)).toEqual([]);
  });

  it("computes historical score for past years only", () => {
    const player = makePlayer({
      id: "p1",
      aggregates: [
        { year: 2024, count: 10 },
        { year: 2025, count: 8 },
      ],
      liveCount: 0,
    });
    const [row] = computePrecedenceScores([player], weights, CURRENT_YEAR);
    // 10 × 1.0 + 8 × 1.5 = 10 + 12 = 22
    expect(row.historicalScore).toBeCloseTo(22);
    expect(row.currentYearScore).toBe(0);
    expect(row.totalScore).toBeCloseTo(22);
  });

  it("computes current year from liveCount", () => {
    const player = makePlayer({ id: "p1", liveCount: 5 });
    const [row] = computePrecedenceScores([player], weights, CURRENT_YEAR);
    // 5 × 2.0 = 10
    expect(row.currentYearScore).toBeCloseTo(10);
  });

  it("ignores aggregate entries for current year", () => {
    const player = makePlayer({
      id: "p1",
      aggregates: [{ year: CURRENT_YEAR, count: 999 }],
      liveCount: 3,
    });
    const [row] = computePrecedenceScores([player], weights, CURRENT_YEAR);
    // aggregate for current year is ignored; liveCount × 2.0 = 6
    expect(row.historicalScore).toBe(0);
    expect(row.currentYearScore).toBeCloseTo(6);
  });

  it("sums positive adjustments", () => {
    const player = makePlayer({
      id: "p1",
      adjustments: [{ points: 3 }, { points: 2 }],
    });
    const [row] = computePrecedenceScores([player], weights, CURRENT_YEAR);
    expect(row.adjustmentsTotal).toBeCloseTo(5);
  });

  it("sums negative adjustments (fines)", () => {
    const player = makePlayer({
      id: "p1",
      adjustments: [{ points: 5 }, { points: -2 }],
    });
    const [row] = computePrecedenceScores([player], weights, CURRENT_YEAR);
    expect(row.adjustmentsTotal).toBeCloseTo(3);
  });

  it("returns 0 for year with missing weight", () => {
    const player = makePlayer({
      id: "p1",
      aggregates: [{ year: 2023, count: 10 }], // no weight for 2023
    });
    const [row] = computePrecedenceScores([player], weights, CURRENT_YEAR);
    expect(row.historicalScore).toBe(0);
  });

  it("current year with no weight contributes 0", () => {
    const noCurrentYearWeights: YearWeightInput[] = [
      { year: 2024, weight: 1.0 },
    ];
    const player = makePlayer({ id: "p1", liveCount: 10 });
    const [row] = computePrecedenceScores(
      [player],
      noCurrentYearWeights,
      CURRENT_YEAR,
    );
    expect(row.currentYearScore).toBe(0);
  });

  it("sorts players by totalScore descending", () => {
    const players = [
      makePlayer({ id: "low", liveCount: 1 }),
      makePlayer({ id: "high", liveCount: 10 }),
      makePlayer({ id: "mid", liveCount: 5 }),
    ];
    const rows = computePrecedenceScores(players, weights, CURRENT_YEAR);
    expect(rows.map((r) => r.playerId)).toEqual(["high", "mid", "low"]);
  });

  it("combines all components into totalScore", () => {
    const player = makePlayer({
      id: "p1",
      aggregates: [{ year: 2024, count: 5 }],
      liveCount: 3,
      adjustments: [{ points: 2 }, { points: -1 }],
    });
    const [row] = computePrecedenceScores([player], weights, CURRENT_YEAR);
    // historical: 5 × 1.0 = 5
    // current: 3 × 2.0 = 6
    // adjustments: 2 + (-1) = 1
    // total: 12
    expect(row.totalScore).toBeCloseTo(12);
  });

  it("handles player with no data (zero score)", () => {
    const player = makePlayer({ id: "p1" });
    const [row] = computePrecedenceScores([player], weights, CURRENT_YEAR);
    expect(row.totalScore).toBe(0);
    expect(row.historicalScore).toBe(0);
    expect(row.currentYearScore).toBe(0);
    expect(row.adjustmentsTotal).toBe(0);
  });
});
