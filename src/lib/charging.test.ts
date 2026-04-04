import { describe, it, expect } from "vitest";
import { proposeSessionCharges, computeSingleCharge } from "./charging";
import type { ChargeEngineInput, PlayerChargeInput } from "./charging";

const BASE_INPUT: ChargeEngineInput = {
  hourlyRate: 300,        // ₪300/hr
  durationMinutes: 120,  // 2 hours → totalCost = ₪600
  minPlayers: 10,
  debtThreshold: 10,
  players: [],
};

function makePlayer(overrides: Partial<PlayerChargeInput> & { playerId: string }): PlayerChargeInput {
  return {
    playerId: overrides.playerId,
    playerKind: overrides.playerKind ?? "REGISTERED",
    balance: overrides.balance ?? 0,
  };
}

describe("proposeSessionCharges", () => {
  it("returns null when player count is below minPlayers", () => {
    const result = proposeSessionCharges({
      ...BASE_INPUT,
      players: [makePlayer({ playerId: "p1" })],
    });
    expect(result).toBeNull();
  });

  it("returns null when player count exactly equals minPlayers - 1", () => {
    const players = Array.from({ length: 9 }, (_, i) =>
      makePlayer({ playerId: `p${i}` }),
    );
    expect(proposeSessionCharges({ ...BASE_INPUT, players })).toBeNull();
  });

  it("returns a proposal when count equals minPlayers", () => {
    const players = Array.from({ length: 10 }, (_, i) =>
      makePlayer({ playerId: `p${i}` }),
    );
    const result = proposeSessionCharges({ ...BASE_INPUT, players });
    expect(result).not.toBeNull();
  });

  it("computes totalCost as hourlyRate * durationHours", () => {
    const players = Array.from({ length: 10 }, (_, i) =>
      makePlayer({ playerId: `p${i}` }),
    );
    const result = proposeSessionCharges({ ...BASE_INPUT, players })!;
    // 300 * (120/60) = 600
    expect(result.totalCost).toBe(600);
  });

  it("charges registered players ceil(totalCost / minPlayers)", () => {
    // 300/hr, 120min, 10 players → ₪600 / 10 = ₪60
    const players = Array.from({ length: 10 }, (_, i) =>
      makePlayer({ playerId: `p${i}`, playerKind: "REGISTERED" }),
    );
    const result = proposeSessionCharges({ ...BASE_INPUT, players })!;
    expect(result.registeredAmount).toBe(60);
    for (const c of result.charges) {
      expect(c.chargeType).toBe("REGISTERED");
      expect(c.calculatedAmount).toBe(60);
    }
  });

  it("applies ceiling when totalCost / minPlayers is not integer", () => {
    // 300/hr, 90min → totalCost = 450, 10 players → 45 (exact, no ceiling needed)
    // Use 7 players instead: 450/7 = 64.28... → ceil = 65
    const players = Array.from({ length: 10 }, (_, i) =>
      makePlayer({ playerId: `p${i}` }),
    );
    const result = proposeSessionCharges({
      ...BASE_INPUT,
      hourlyRate: 300,
      durationMinutes: 90,  // 1.5hr → 450
      minPlayers: 7,
      players,
    })!;
    // ceil(450 / 7) = ceil(64.28) = 65
    expect(result.registeredAmount).toBe(65);
  });

  it("charges drop-in players at the same ceil(totalCost / minPlayers) rate", () => {
    const players = Array.from({ length: 10 }, (_, i) =>
      makePlayer({ playerId: `p${i}`, playerKind: "DROP_IN" }),
    );
    const result = proposeSessionCharges({ ...BASE_INPUT, players })!;
    expect(result.dropInAmount).toBe(60);
    for (const c of result.charges) {
      expect(c.chargeType).toBe("DROP_IN");
      expect(c.calculatedAmount).toBe(60);
    }
  });

  it("bills a registered player at drop-in rate when balance <= -debtThreshold", () => {
    const players = [
      ...Array.from({ length: 9 }, (_, i) => makePlayer({ playerId: `p${i}` })),
      makePlayer({ playerId: "indebted", playerKind: "REGISTERED", balance: -10 }),
    ];
    const result = proposeSessionCharges({ ...BASE_INPUT, debtThreshold: 10, players })!;
    const indebtedCharge = result.charges.find((c) => c.playerId === "indebted")!;
    expect(indebtedCharge.chargeType).toBe("DROP_IN");
    expect(indebtedCharge.calculatedAmount).toBe(result.dropInAmount);
  });

  it("does NOT bill at drop-in when balance is exactly -debtThreshold + 1 (above threshold)", () => {
    const players = [
      ...Array.from({ length: 9 }, (_, i) => makePlayer({ playerId: `p${i}` })),
      makePlayer({ playerId: "borderline", playerKind: "REGISTERED", balance: -9 }),
    ];
    const result = proposeSessionCharges({ ...BASE_INPUT, debtThreshold: 10, players })!;
    const charge = result.charges.find((c) => c.playerId === "borderline")!;
    expect(charge.chargeType).toBe("REGISTERED");
  });

  it("produces one charge entry per player", () => {
    const players = Array.from({ length: 12 }, (_, i) =>
      makePlayer({ playerId: `p${i}` }),
    );
    const result = proposeSessionCharges({ ...BASE_INPUT, players })!;
    expect(result.charges).toHaveLength(12);
  });

  it("handles mixed registered and drop-in players", () => {
    const players = [
      ...Array.from({ length: 5 }, (_, i) =>
        makePlayer({ playerId: `reg${i}`, playerKind: "REGISTERED" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makePlayer({ playerId: `drop${i}`, playerKind: "DROP_IN" }),
      ),
    ];
    const result = proposeSessionCharges({ ...BASE_INPUT, players })!;
    expect(result.charges.filter((c) => c.chargeType === "REGISTERED")).toHaveLength(5);
    expect(result.charges.filter((c) => c.chargeType === "DROP_IN")).toHaveLength(5);
  });
});

describe("computeSingleCharge", () => {
  const BASE = {
    hourlyRate: 300,
    durationMinutes: 120,
    minPlayers: 10,
    debtThreshold: 10,
    balance: 0,
  };

  it("returns REGISTERED type for a registered player with good standing", () => {
    const result = computeSingleCharge({ ...BASE, playerKind: "REGISTERED" });
    expect(result.chargeType).toBe("REGISTERED");
    expect(result.calculatedAmount).toBe(60);
  });

  it("returns DROP_IN type for a drop-in player", () => {
    const result = computeSingleCharge({ ...BASE, playerKind: "DROP_IN" });
    expect(result.chargeType).toBe("DROP_IN");
    expect(result.calculatedAmount).toBe(60);
  });

  it("returns DROP_IN for a registered player in debt", () => {
    const result = computeSingleCharge({
      ...BASE,
      playerKind: "REGISTERED",
      balance: -15,
    });
    expect(result.chargeType).toBe("DROP_IN");
  });

  it("uses ceiling on fractional amounts", () => {
    // 400/hr * 1.5hr = 600; 600/7 = 85.71 → 86
    const result = computeSingleCharge({
      hourlyRate: 400,
      durationMinutes: 90,
      minPlayers: 7,
      debtThreshold: 10,
      balance: 0,
      playerKind: "REGISTERED",
    });
    expect(result.calculatedAmount).toBe(86);
  });
});
