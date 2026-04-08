import { describe, it, expect } from "vitest";
import { cascadeRecalc, summarizeRecalc } from "./cascade-recalc";
import type { ExistingCharge, RecalcParams } from "./cascade-recalc";

const BASE_PARAMS: RecalcParams = {
  hourlyRate: 300,
  durationMinutes: 120, // 2hr → ₪600 total → ₪60/player @ 10 min
  minPlayers: 10,
  debtThreshold: 10,
};

function makeCharge(overrides: Partial<ExistingCharge> & { sessionChargeId: string; playerId: string }): ExistingCharge {
  return {
    sessionChargeId: overrides.sessionChargeId,
    playerId: overrides.playerId,
    playerKind: overrides.playerKind ?? "REGISTERED",
    balance: overrides.balance ?? 0,
    amount: overrides.amount ?? 60,
    calculatedAmount: overrides.calculatedAmount ?? 60,
    chargeType: overrides.chargeType ?? "REGISTERED",
  };
}

// Build a pool of minPlayers charges so proposeSessionCharges doesn't return null.
// The first entry is the "focus" charge; the rest are default REGISTERED fillers.
function makePool(
  focus: Partial<ExistingCharge> & { sessionChargeId: string; playerId: string },
  total: number = BASE_PARAMS.minPlayers,
): ExistingCharge[] {
  const charges: ExistingCharge[] = [makeCharge(focus)];
  for (let i = 2; i <= total; i++) {
    charges.push(makeCharge({ sessionChargeId: `cfiller${i}`, playerId: `pfiller${i}` }));
  }
  return charges;
}

describe("cascadeRecalc", () => {
  it("returns a result for each input charge", () => {
    const charges = makePool({ sessionChargeId: "c1", playerId: "p1" });
    const results = cascadeRecalc(charges, BASE_PARAMS);
    expect(results).toHaveLength(BASE_PARAMS.minPlayers);
  });

  it("recalculates to new amount when params change (rate increases)", () => {
    // 10 REGISTERED, no debt; 400/hr * 2hr = 800; 800/10 = 80 each
    const charges = makePool({ sessionChargeId: "c1", playerId: "p1", amount: 60, calculatedAmount: 60 });
    const results = cascadeRecalc(charges, { ...BASE_PARAMS, hourlyRate: 400 });
    expect(results[0].newCalculatedAmount).toBe(80);
    expect(results[0].newAmount).toBe(80);
    expect(results[0].adminDelta).toBe(0);
  });

  it("preserves admin delta when recalculating", () => {
    // p1: amount=40 (calculated 60, admin reduced by 20 → delta=-20)
    // Same params → newCalculated=60, delta=-20, newAmount=40
    const charges = makePool({ sessionChargeId: "c1", playerId: "p1", amount: 40, calculatedAmount: 60 });
    const results = cascadeRecalc(charges, BASE_PARAMS);
    expect(results[0].adminDelta).toBe(-20);
    expect(results[0].newCalculatedAmount).toBe(60);
    expect(results[0].newAmount).toBe(40);
  });

  it("applies admin delta on top of new calculated amount", () => {
    // p1: delta=-20; with rate increase newCalculated=80 → newAmount=60
    const charges = makePool({ sessionChargeId: "c1", playerId: "p1", amount: 40, calculatedAmount: 60 });
    const results = cascadeRecalc(charges, { ...BASE_PARAMS, hourlyRate: 400 });
    expect(results[0].adminDelta).toBe(-20);
    expect(results[0].newCalculatedAmount).toBe(80);
    expect(results[0].newAmount).toBe(60); // 80 + (-20)
  });

  it("preserves positive admin delta (admin increased the charge)", () => {
    // p1: amount=80, calculatedAmount=60 → delta=+20; newAmount=80
    const charges = makePool({ sessionChargeId: "c1", playerId: "p1", amount: 80, calculatedAmount: 60 });
    const results = cascadeRecalc(charges, BASE_PARAMS);
    expect(results[0].adminDelta).toBe(20);
    expect(results[0].newAmount).toBe(80); // 60 + 20
  });

  it("detects charge type change when player crosses debt threshold", () => {
    // p1: REGISTERED balance=-10 (at threshold) → upgraded to DROP_IN
    // 9 normal registered fillers; dropInAmount=60, remainder=540/9=60 for normal
    const charges = makePool({
      sessionChargeId: "c1",
      playerId: "p1",
      playerKind: "REGISTERED",
      balance: -10,
      amount: 60,
      calculatedAmount: 60,
      chargeType: "REGISTERED",
    });
    const results = cascadeRecalc(charges, BASE_PARAMS);
    expect(results[0].newChargeType).toBe("DROP_IN");
  });

  it("handles zero adminDelta (no override)", () => {
    const charges = makePool({ sessionChargeId: "c1", playerId: "p1", amount: 60, calculatedAmount: 60 });
    const results = cascadeRecalc(charges, BASE_PARAMS);
    expect(results[0].adminDelta).toBe(0);
    expect(results[0].newAmount).toBe(results[0].newCalculatedAmount);
  });

  it("handles empty charges array", () => {
    expect(cascadeRecalc([], BASE_PARAMS)).toEqual([]);
  });
});

describe("summarizeRecalc", () => {
  it("correctly counts changed and total amounts", () => {
    // 10 REGISTERED charges all at 60; rate increase → all 80
    const charges = makePool({ sessionChargeId: "c1", playerId: "p1", amount: 60, calculatedAmount: 60 });
    // Override filler amounts to 60 (makePool default) — consistent with makeCharge default
    const results = cascadeRecalc(charges, { ...BASE_PARAMS, hourlyRate: 400 }); // 80 each
    const summary = summarizeRecalc(charges, results);
    expect(summary.totalCharges).toBe(BASE_PARAMS.minPlayers);
    expect(summary.changedCount).toBe(BASE_PARAMS.minPlayers);
    expect(summary.totalOldAmount).toBe(600); // 10 × 60
    expect(summary.totalNewAmount).toBe(800); // 10 × 80
    expect(summary.netDifference).toBe(200);
  });

  it("shows 0 changed when amounts are unchanged", () => {
    const charges = makePool({ sessionChargeId: "c1", playerId: "p1", amount: 60, calculatedAmount: 60 });
    const results = cascadeRecalc(charges, BASE_PARAMS);
    const summary = summarizeRecalc(charges, results);
    expect(summary.changedCount).toBe(0);
    expect(summary.netDifference).toBe(0);
  });

  it("handles empty input", () => {
    const summary = summarizeRecalc([], []);
    expect(summary.totalCharges).toBe(0);
    expect(summary.changedCount).toBe(0);
    expect(summary.totalOldAmount).toBe(0);
    expect(summary.totalNewAmount).toBe(0);
  });
});
