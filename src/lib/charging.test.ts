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

  it("charges registered players ceil(remainder / registeredCount)", () => {
    // 300/hr, 120min, 10 registered → totalCost=600, no drop-ins/debt → registeredAmount=ceil(600/10)=60
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

  it("applies ceiling to dropInAmount when totalCost/minPlayers is fractional", () => {
    // 300/hr, 90min → totalCost=450; minPlayers=7 → dropInAmount=ceil(450/7)=ceil(64.28)=65
    // 10 registered, no drop-ins → remainder=450, registeredAmount=ceil(450/10)=45
    const players = Array.from({ length: 10 }, (_, i) =>
      makePlayer({ playerId: `p${i}` }),
    );
    const result = proposeSessionCharges({
      ...BASE_INPUT,
      hourlyRate: 300,
      durationMinutes: 90,
      minPlayers: 7,
      players,
    })!;
    expect(result.dropInAmount).toBe(65);
    expect(result.registeredAmount).toBe(45);
  });

  it("applies ceiling to registeredAmount when remainder/registeredCount is fractional", () => {
    // 10 registered + 1 drop-in; totalCost=600, dropInAmount=60, remainder=600-60=540, registeredAmount=ceil(540/10)=54
    // Add fractional case: 11 registered, no drop-ins → remainder=600, registeredAmount=ceil(600/11)=ceil(54.54)=55
    const players = Array.from({ length: 11 }, (_, i) =>
      makePlayer({ playerId: `p${i}`, playerKind: "REGISTERED" }),
    );
    const result = proposeSessionCharges({ ...BASE_INPUT, players })!;
    expect(result.registeredAmount).toBe(55);
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

  // 10 registered, all balance 0 — totalCost=600, registeredAmount=ceil(600/10)=60
  const TEN_REGISTERED: PlayerChargeInput[] = Array.from({ length: 10 }, (_, i) => ({
    playerId: `r${i}`,
    playerKind: "REGISTERED",
    balance: 0,
  }));

  it("returns REGISTERED type for a registered player with good standing", () => {
    const result = computeSingleCharge({ ...BASE, playerKind: "REGISTERED", allPlayers: TEN_REGISTERED });
    expect(result.chargeType).toBe("REGISTERED");
    expect(result.calculatedAmount).toBe(60);
  });

  it("returns DROP_IN type for a drop-in player", () => {
    // 9 registered + 1 drop-in; dropInAmount=60, remainder=540, registeredAmount=54
    const allPlayers: PlayerChargeInput[] = [
      ...Array.from({ length: 9 }, (_, i) => ({ playerId: `r${i}`, playerKind: "REGISTERED" as const, balance: 0 })),
      { playerId: "d0", playerKind: "DROP_IN", balance: 0 },
    ];
    const result = computeSingleCharge({ ...BASE, playerKind: "DROP_IN", allPlayers });
    expect(result.chargeType).toBe("DROP_IN");
    expect(result.calculatedAmount).toBe(60);
  });

  it("returns DROP_IN for a registered player in debt", () => {
    const result = computeSingleCharge({
      ...BASE,
      playerKind: "REGISTERED",
      balance: -15,
      allPlayers: TEN_REGISTERED,
    });
    expect(result.chargeType).toBe("DROP_IN");
  });

  it("uses ceiling on fractional dropInAmount", () => {
    // 400/hr * 1.5hr = 600; minPlayers=7 → dropInAmount=ceil(600/7)=ceil(85.71)=86
    // 7 registered, no drop-ins → remainder=600, registeredAmount=ceil(600/7)=86
    const allPlayers: PlayerChargeInput[] = Array.from({ length: 7 }, (_, i) => ({
      playerId: `r${i}`,
      playerKind: "REGISTERED",
      balance: 0,
    }));
    const result = computeSingleCharge({
      hourlyRate: 400,
      durationMinutes: 90,
      minPlayers: 7,
      debtThreshold: 10,
      balance: 0,
      playerKind: "REGISTERED",
      allPlayers,
    });
    expect(result.calculatedAmount).toBe(86);
  });
});
