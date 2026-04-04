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

describe("cascadeRecalc", () => {
  it("returns a result for each input charge", () => {
    const charges = [
      makeCharge({ sessionChargeId: "c1", playerId: "p1" }),
      makeCharge({ sessionChargeId: "c2", playerId: "p2" }),
    ];
    const results = cascadeRecalc(charges, BASE_PARAMS);
    expect(results).toHaveLength(2);
  });

  it("recalculates to new amount when params change (rate increases)", () => {
    const charges = [makeCharge({ sessionChargeId: "c1", playerId: "p1", amount: 60, calculatedAmount: 60 })];
    // Increase hourly rate: 400/hr * 2hr = 800; 800/10 = 80
    const results = cascadeRecalc(charges, { ...BASE_PARAMS, hourlyRate: 400 });
    expect(results[0].newCalculatedAmount).toBe(80);
    expect(results[0].newAmount).toBe(80);
    expect(results[0].adminDelta).toBe(0);
  });

  it("preserves admin delta when recalculating", () => {
    // Player was charged 40 (calculated 60, admin reduced by 20 → delta = -20)
    const charges = [makeCharge({ sessionChargeId: "c1", playerId: "p1", amount: 40, calculatedAmount: 60 })];
    // Same params → newCalculated = 60, delta = -20, newAmount = 40
    const results = cascadeRecalc(charges, BASE_PARAMS);
    expect(results[0].adminDelta).toBe(-20);
    expect(results[0].newCalculatedAmount).toBe(60);
    expect(results[0].newAmount).toBe(40);
  });

  it("applies admin delta on top of new calculated amount", () => {
    // delta = -20, newCalculated = 80 → newAmount = 60
    const charges = [makeCharge({ sessionChargeId: "c1", playerId: "p1", amount: 40, calculatedAmount: 60 })];
    const results = cascadeRecalc(charges, { ...BASE_PARAMS, hourlyRate: 400 });
    expect(results[0].adminDelta).toBe(-20);
    expect(results[0].newCalculatedAmount).toBe(80);
    expect(results[0].newAmount).toBe(60); // 80 + (-20)
  });

  it("preserves positive admin delta (admin increased the charge)", () => {
    // amount = 80, calculatedAmount = 60 → delta = +20
    const charges = [makeCharge({ sessionChargeId: "c1", playerId: "p1", amount: 80, calculatedAmount: 60 })];
    const results = cascadeRecalc(charges, BASE_PARAMS);
    expect(results[0].adminDelta).toBe(20);
    expect(results[0].newAmount).toBe(80); // 60 + 20
  });

  it("detects charge type change when player crosses debt threshold", () => {
    // Player has balance -10 (exactly at threshold) → DROP_IN
    const charges = [
      makeCharge({
        sessionChargeId: "c1",
        playerId: "p1",
        playerKind: "REGISTERED",
        balance: -10,
        amount: 60,
        calculatedAmount: 60,
        chargeType: "REGISTERED",
      }),
    ];
    const results = cascadeRecalc(charges, BASE_PARAMS);
    expect(results[0].newChargeType).toBe("DROP_IN");
  });

  it("handles zero adminDelta (no override)", () => {
    const charges = [makeCharge({ sessionChargeId: "c1", playerId: "p1", amount: 60, calculatedAmount: 60 })];
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
    const charges = [
      makeCharge({ sessionChargeId: "c1", playerId: "p1", amount: 60, calculatedAmount: 60 }),
      makeCharge({ sessionChargeId: "c2", playerId: "p2", amount: 60, calculatedAmount: 60 }),
    ];
    const results = cascadeRecalc(charges, { ...BASE_PARAMS, hourlyRate: 400 }); // 80 each
    const summary = summarizeRecalc(charges, results);
    expect(summary.totalCharges).toBe(2);
    expect(summary.changedCount).toBe(2);
    expect(summary.totalOldAmount).toBe(120);
    expect(summary.totalNewAmount).toBe(160);
    expect(summary.netDifference).toBe(40);
  });

  it("shows 0 changed when amounts are unchanged", () => {
    const charges = [makeCharge({ sessionChargeId: "c1", playerId: "p1", amount: 60, calculatedAmount: 60 })];
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
