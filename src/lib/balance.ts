export type BalanceBreakdown = {
  totalPaid: number;
  totalCharged: number;
  balance: number;
};

/**
 * Pure helper — compute balance from pre-fetched totals.
 * balance > 0: player is in credit.
 * balance < 0: player has debt.
 */
export function computeBalanceFromTotals(
  totalPaid: number,
  totalCharged: number,
): BalanceBreakdown {
  return { totalPaid, totalCharged, balance: totalPaid - totalCharged };
}

/**
 * Compute a player's balance from the DB.
 * Uses dynamic import to avoid loading prisma at module evaluation time.
 */
export async function computePlayerBalance(
  playerId: string,
): Promise<BalanceBreakdown> {
  const { prisma } = await import("./prisma");
  const [paymentsAgg, chargesAgg] = await Promise.all([
    prisma.payment.aggregate({
      where: { playerId },
      _sum: { amount: true },
    }),
    prisma.sessionCharge.aggregate({
      where: { playerId },
      _sum: { amount: true },
    }),
  ]);

  const totalPaid = paymentsAgg._sum.amount ?? 0;
  const totalCharged = chargesAgg._sum.amount ?? 0;
  return computeBalanceFromTotals(totalPaid, totalCharged);
}

/**
 * Bulk: compute balances for many players in two queries.
 * Returns a Map<playerId, BalanceBreakdown>.
 */
export async function computePlayerBalances(
  playerIds: string[],
): Promise<Map<string, BalanceBreakdown>> {
  if (playerIds.length === 0) return new Map();

  const { prisma } = await import("./prisma");
  const [payments, charges] = await Promise.all([
    prisma.payment.groupBy({
      by: ["playerId"],
      where: { playerId: { in: playerIds } },
      _sum: { amount: true },
    }),
    prisma.sessionCharge.groupBy({
      by: ["playerId"],
      where: { playerId: { in: playerIds } },
      _sum: { amount: true },
    }),
  ]);

  const paidMap = new Map(
    payments.map((r) => [r.playerId, r._sum.amount ?? 0]),
  );
  const chargedMap = new Map(
    charges.map((r) => [r.playerId, r._sum.amount ?? 0]),
  );

  const result = new Map<string, BalanceBreakdown>();
  for (const id of playerIds) {
    const totalPaid = paidMap.get(id) ?? 0;
    const totalCharged = chargedMap.get(id) ?? 0;
    result.set(id, computeBalanceFromTotals(totalPaid, totalCharged));
  }
  return result;
}
