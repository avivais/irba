export type YearWeightInput = { year: number; weight: number };
export type AggregateInput = { year: number; count: number };
export type AdjustmentInput = { points: number };

export type PlayerPrecedenceInput = {
  id: string;
  name: string;
  aggregates: AggregateInput[];
  liveCount: number;
  adjustments: AdjustmentInput[];
};

export type PrecedenceRow = {
  playerId: string;
  playerName: string;
  historicalScore: number;
  currentYearScore: number;
  adjustmentsTotal: number;
  totalScore: number;
};

/**
 * Computes precedence scores for all players.
 *
 * - Historical years: aggregate.count × yearWeight (for years < currentYear)
 * - Current year: liveCount × yearWeight (if a weight exists for currentYear)
 * - Adjustments: sum of signed points
 *
 * Returns rows sorted by totalScore descending.
 * Missing year weight → 0 contribution (silent).
 */
export function computePrecedenceScores(
  players: PlayerPrecedenceInput[],
  yearWeights: YearWeightInput[],
  currentYear: number,
): PrecedenceRow[] {
  const weightByYear = new Map<number, number>(
    yearWeights.map((yw) => [yw.year, yw.weight]),
  );

  const rows: PrecedenceRow[] = players.map((player) => {
    const historicalScore = player.aggregates.reduce((sum, agg) => {
      if (agg.year >= currentYear) return sum;
      const w = weightByYear.get(agg.year) ?? 0;
      return sum + agg.count * w;
    }, 0);

    const currentYearWeight = weightByYear.get(currentYear) ?? 0;
    const currentYearScore = player.liveCount * currentYearWeight;

    const adjustmentsTotal = player.adjustments.reduce(
      (sum, adj) => sum + adj.points,
      0,
    );

    const totalScore = historicalScore + currentYearScore + adjustmentsTotal;

    return {
      playerId: player.id,
      playerName: player.name,
      historicalScore,
      currentYearScore,
      adjustmentsTotal,
      totalScore,
    };
  });

  rows.sort((a, b) => b.totalScore - a.totalScore);

  return rows;
}
