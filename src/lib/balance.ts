export type BalanceBreakdown = {
  totalPaid: number;
  totalCharged: number;
  balance: number;
  sessionChargesTotal: number;
  sharedExpenseChargesTotal: number;
};

/**
 * Pure helper — compute balance from pre-fetched totals.
 * balance > 0: player is in credit.
 * balance < 0: player has debt.
 */
export function computeBalanceFromTotals(
  totalPaid: number,
  sessionChargesTotal: number,
  sharedExpenseChargesTotal = 0,
): BalanceBreakdown {
  const totalCharged = sessionChargesTotal + sharedExpenseChargesTotal;
  return {
    totalPaid,
    totalCharged,
    balance: totalPaid - totalCharged,
    sessionChargesTotal,
    sharedExpenseChargesTotal,
  };
}

/**
 * Compute a player's balance from the DB.
 * Uses dynamic import to avoid loading prisma at module evaluation time.
 */
export async function computePlayerBalance(
  playerId: string,
): Promise<BalanceBreakdown> {
  const { prisma } = await import("./prisma");
  const [paymentsAgg, chargesAgg, sharedAgg] = await Promise.all([
    prisma.payment.aggregate({
      where: { playerId },
      _sum: { amount: true },
    }),
    prisma.sessionCharge.aggregate({
      where: { playerId },
      _sum: { amount: true },
    }),
    prisma.sharedExpenseCharge.aggregate({
      where: { playerId },
      _sum: { amount: true },
    }),
  ]);

  return computeBalanceFromTotals(
    paymentsAgg._sum.amount ?? 0,
    chargesAgg._sum.amount ?? 0,
    sharedAgg._sum.amount ?? 0,
  );
}

/**
 * Bulk: compute balances for many players in three queries.
 * Returns a Map<playerId, BalanceBreakdown>.
 */
export async function computePlayerBalances(
  playerIds: string[],
): Promise<Map<string, BalanceBreakdown>> {
  if (playerIds.length === 0) return new Map();

  const { prisma } = await import("./prisma");
  const [payments, charges, sharedCharges] = await Promise.all([
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
    prisma.sharedExpenseCharge.groupBy({
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
  const sharedMap = new Map(
    sharedCharges.map((r) => [r.playerId, r._sum.amount ?? 0]),
  );

  const result = new Map<string, BalanceBreakdown>();
  for (const id of playerIds) {
    result.set(
      id,
      computeBalanceFromTotals(
        paidMap.get(id) ?? 0,
        chargedMap.get(id) ?? 0,
        sharedMap.get(id) ?? 0,
      ),
    );
  }
  return result;
}
