/**
 * Cascade recalculation — no Prisma at module level.
 *
 * When a session's cost parameters change (or when undoing a charge), every
 * existing SessionCharge needs to be recalculated. Admin overrides are
 * preserved as a delta:
 *
 *   adminDelta = charge.amount - charge.calculatedAmount
 *   newAmount  = newCalculatedAmount + adminDelta
 *
 * This means:
 * - A charge that was never overridden (delta=0) gets the new calculated amount.
 * - A charge with an admin override keeps its relative adjustment.
 */

import { computeSingleCharge } from "./charging";
import type { PlayerKind, ChargeType } from "./charging";

export type ExistingCharge = {
  sessionChargeId: string;
  playerId: string;
  playerKind: PlayerKind;
  balance: number;
  /** Current stored amount (may include admin delta). */
  amount: number;
  /** The engine-calculated amount at time of last recalc. */
  calculatedAmount: number;
  chargeType: ChargeType;
};

export type RecalcParams = {
  hourlyRate: number;
  durationMinutes: number;
  minPlayers: number;
  debtThreshold: number;
};

export type RecalcResult = {
  sessionChargeId: string;
  playerId: string;
  /** New engine-computed amount (before applying admin delta). */
  newCalculatedAmount: number;
  /** Final amount to store = newCalculatedAmount + adminDelta. */
  newAmount: number;
  newChargeType: ChargeType;
  /** The preserved admin delta (0 if no override). */
  adminDelta: number;
};

/**
 * Pure function: given existing charges and new cost params, compute
 * the new amount for each charge. Returns one RecalcResult per input charge.
 */
export function cascadeRecalc(
  charges: ExistingCharge[],
  params: RecalcParams,
): RecalcResult[] {
  const allPlayers = charges.map((c) => ({
    playerId: c.playerId,
    playerKind: c.playerKind,
    balance: c.balance,
  }));

  return charges.map((charge) => {
    const adminDelta = charge.amount - charge.calculatedAmount;

    const { chargeType: newChargeType, calculatedAmount: newCalculatedAmount } =
      computeSingleCharge({
        hourlyRate: params.hourlyRate,
        durationMinutes: params.durationMinutes,
        minPlayers: params.minPlayers,
        debtThreshold: params.debtThreshold,
        playerKind: charge.playerKind,
        balance: charge.balance,
        allPlayers,
      });

    const newAmount = newCalculatedAmount + adminDelta;

    return {
      sessionChargeId: charge.sessionChargeId,
      playerId: charge.playerId,
      newCalculatedAmount,
      newAmount,
      newChargeType,
      adminDelta,
    };
  });
}

/**
 * Build a summary of changes: how many charges change, total delta.
 * Useful for showing a preview before applying.
 */
export type RecalcSummary = {
  totalCharges: number;
  changedCount: number;
  totalNewAmount: number;
  totalOldAmount: number;
  netDifference: number;
};

export function summarizeRecalc(
  charges: ExistingCharge[],
  results: RecalcResult[],
): RecalcSummary {
  let changedCount = 0;
  let totalNewAmount = 0;
  let totalOldAmount = 0;

  for (let i = 0; i < charges.length; i++) {
    totalOldAmount += charges[i].amount;
    totalNewAmount += results[i].newAmount;
    if (results[i].newAmount !== charges[i].amount) changedCount++;
  }

  return {
    totalCharges: charges.length,
    changedCount,
    totalNewAmount,
    totalOldAmount,
    netDifference: totalNewAmount - totalOldAmount,
  };
}
