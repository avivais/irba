/**
 * Charging engine — pure, no Prisma imports at module level.
 *
 * Concepts:
 * - REGISTERED rate: (hourlyRate * durationHours) / minPlayers — same for every confirmed registered player.
 * - DROP_IN rate: ceil(totalCost / minPlayers) — same for every confirmed drop-in player.
 *   A registered player with balance ≤ -debtThreshold is billed at the drop-in rate.
 * - totalCost = hourlyRate * durationHours (fractional shekels OK before ceiling).
 * - Charge amounts are always whole shekels (Math.ceil).
 */

export type PlayerKind = "REGISTERED" | "DROP_IN";

export type ChargeType = "REGISTERED" | "DROP_IN" | "ADMIN_OVERRIDE";

export type PlayerChargeInput = {
  playerId: string;
  playerKind: PlayerKind;
  balance: number; // current balance in ILS (can be negative)
};

export type ProposedCharge = {
  playerId: string;
  chargeType: ChargeType;
  calculatedAmount: number; // whole shekels
};

export type SessionChargeProposal = {
  charges: ProposedCharge[];
  /** Total cost of the session (hourlyRate * durationHours). */
  totalCost: number;
  /** Per-session cost for a registered player. */
  registeredAmount: number;
  /** Per-session cost for a drop-in player. */
  dropInAmount: number;
};

export type ChargeEngineInput = {
  /** Hourly court rental rate in ILS. */
  hourlyRate: number;
  /** Session duration in minutes. */
  durationMinutes: number;
  /** Minimum number of players needed to charge a session. */
  minPlayers: number;
  /** Debt threshold: balance ≤ -debtThreshold → charge drop-in rate. */
  debtThreshold: number;
  /** Confirmed attendees. */
  players: PlayerChargeInput[];
};

/**
 * Propose charges for a session.
 *
 * Returns null if the confirmed player count is below minPlayers.
 */
export function proposeSessionCharges(
  input: ChargeEngineInput,
): SessionChargeProposal | null {
  const { hourlyRate, durationMinutes, minPlayers, debtThreshold, players } =
    input;

  if (players.length < minPlayers) return null;

  const durationHours = durationMinutes / 60;
  const totalCost = hourlyRate * durationHours;

  // Registered rate: proportional share (fractional before ceil)
  const registeredAmount = Math.ceil(totalCost / minPlayers);
  // Drop-in rate: same formula — ceil(totalCost / minPlayers)
  const dropInAmount = Math.ceil(totalCost / minPlayers);

  const charges: ProposedCharge[] = players.map((p) => {
    const isDebt = p.balance <= -debtThreshold;
    const effectiveDropIn = p.playerKind === "DROP_IN" || isDebt;

    const chargeType: ChargeType = effectiveDropIn ? "DROP_IN" : "REGISTERED";
    const calculatedAmount = effectiveDropIn ? dropInAmount : registeredAmount;

    return { playerId: p.playerId, chargeType, calculatedAmount };
  });

  return { charges, totalCost, registeredAmount, dropInAmount };
}

/**
 * Compute the amount for a single player given session cost params.
 * Useful for cascade recalculation of individual charges.
 */
export function computeSingleCharge(opts: {
  hourlyRate: number;
  durationMinutes: number;
  minPlayers: number;
  debtThreshold: number;
  playerKind: PlayerKind;
  balance: number;
}): { chargeType: ChargeType; calculatedAmount: number } {
  const { hourlyRate, durationMinutes, minPlayers, debtThreshold, playerKind, balance } = opts;
  const durationHours = durationMinutes / 60;
  const totalCost = hourlyRate * durationHours;
  const amount = Math.ceil(totalCost / minPlayers);
  const isDebt = balance <= -debtThreshold;
  const effectiveDropIn = playerKind === "DROP_IN" || isDebt;
  return {
    chargeType: effectiveDropIn ? "DROP_IN" : "REGISTERED",
    calculatedAmount: amount,
  };
}
