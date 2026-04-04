import { describe, it, expect } from "vitest";
import { computeBalanceFromTotals } from "./balance";

describe("computeBalanceFromTotals", () => {
  it("returns zero balance when paid equals charged", () => {
    const result = computeBalanceFromTotals(100, 100);
    expect(result.balance).toBe(0);
    expect(result.totalPaid).toBe(100);
    expect(result.totalCharged).toBe(100);
  });

  it("returns positive balance (credit) when player has paid more than charged", () => {
    const result = computeBalanceFromTotals(200, 150);
    expect(result.balance).toBe(50);
  });

  it("returns negative balance (debt) when player owes money", () => {
    const result = computeBalanceFromTotals(50, 100);
    expect(result.balance).toBe(-50);
  });

  it("handles zero paid and zero charged", () => {
    const result = computeBalanceFromTotals(0, 0);
    expect(result.balance).toBe(0);
    expect(result.totalPaid).toBe(0);
    expect(result.totalCharged).toBe(0);
  });

  it("handles zero paid with non-zero charges (pure debt)", () => {
    const result = computeBalanceFromTotals(0, 80);
    expect(result.balance).toBe(-80);
  });

  it("handles non-zero paid with zero charges (pure credit)", () => {
    const result = computeBalanceFromTotals(300, 0);
    expect(result.balance).toBe(300);
  });
});
