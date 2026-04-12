/**
 * Charging engine — pure, no Prisma imports at module level.
 *
 * Concepts:
 * - totalCost = hourlyRate * durationHours
 * - dropInAmount = ceil(totalCost / minPlayers)
 * - Drop-ins and registered players in debt (balance ≤ -debtThreshold) each pay dropInAmount.
 * - The remainder after subtracting those payments is split equally among remaining registered players.
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
  /**
   * Player IDs who have an unused free entry. They are excluded from cost
   * calculation entirely (cost absorbed by the rest) and charged ₪0.
   */
  freeEntryPlayerIds?: string[];
};

/**
 * Propose charges for a session.
 *
 * Returns null if the confirmed player count is below minPlayers.
 */
export function proposeSessionCharges(
  input: ChargeEngineInput,
): SessionChargeProposal | null {
  const { hourlyRate, durationMinutes, minPlayers, debtThreshold, players, freeEntryPlayerIds } =
    input;

  if (players.length < minPlayers) return null;

  const freeEntrySet = new Set(freeEntryPlayerIds ?? []);

  // Split out free-entry players — they attend but pay ₪0; cost absorbed by rest
  const billablePlayers = players.filter((p) => !freeEntrySet.has(p.playerId));
  const freeEntryPlayers = players.filter((p) => freeEntrySet.has(p.playerId));

  const durationHours = durationMinutes / 60;
  const totalCost = hourlyRate * durationHours;

  // Step 2: fixed drop-in rate (based on minPlayers, unchanged)
  const dropInAmount = Math.ceil(totalCost / minPlayers);

  // Categorise billable players only
  const dropIns = billablePlayers.filter((p) => p.playerKind === "DROP_IN");
  const registered = billablePlayers.filter((p) => p.playerKind === "REGISTERED");
  const registeredInDebt = registered.filter((p) => p.balance <= -debtThreshold);
  const registeredNormal = registered.filter((p) => p.balance > -debtThreshold);

  // Step 3–4.3: subtract drop-in and debt contributions from total
  const dropInsTotal = dropIns.length * dropInAmount;
  const debtTotal = registeredInDebt.length * dropInAmount;
  const remainder = totalCost - dropInsTotal - debtTotal;

  // Step 4.4: split remainder equally among normal registered players
  const registeredAmount =
    registeredNormal.length > 0 ? Math.ceil(remainder / registeredNormal.length) : 0;

  const charges: ProposedCharge[] = [
    // Billable players — normal algorithm
    ...billablePlayers.map((p) => {
      const isDebt = p.playerKind === "REGISTERED" && p.balance <= -debtThreshold;
      const effectiveDropIn = p.playerKind === "DROP_IN" || isDebt;
      const chargeType: ChargeType = effectiveDropIn ? "DROP_IN" : "REGISTERED";
      const calculatedAmount = effectiveDropIn ? dropInAmount : registeredAmount;
      return { playerId: p.playerId, chargeType, calculatedAmount };
    }),
    // Free-entry players — ₪0
    ...freeEntryPlayers.map((p) => ({
      playerId: p.playerId,
      chargeType: "FREE_ENTRY" as ChargeType,
      calculatedAmount: 0,
    })),
  ];

  return { charges, totalCost, registeredAmount, dropInAmount };
}

/**
 * Compute the amount for a single player given session cost params.
 * Requires the full confirmed player list to correctly split the registered remainder.
 */
export function computeSingleCharge(opts: {
  hourlyRate: number;
  durationMinutes: number;
  minPlayers: number;
  debtThreshold: number;
  playerKind: PlayerKind;
  balance: number;
  allPlayers: PlayerChargeInput[];
}): { chargeType: ChargeType; calculatedAmount: number } {
  const proposal = proposeSessionCharges({
    hourlyRate: opts.hourlyRate,
    durationMinutes: opts.durationMinutes,
    minPlayers: opts.minPlayers,
    debtThreshold: opts.debtThreshold,
    players: opts.allPlayers,
  });
  if (!proposal) return { chargeType: "REGISTERED", calculatedAmount: 0 };
  const isDebt = opts.playerKind === "REGISTERED" && opts.balance <= -opts.debtThreshold;
  const effectiveDropIn = opts.playerKind === "DROP_IN" || isDebt;
  return {
    chargeType: effectiveDropIn ? "DROP_IN" : "REGISTERED",
    calculatedAmount: effectiveDropIn ? proposal.dropInAmount : proposal.registeredAmount,
  };
}
