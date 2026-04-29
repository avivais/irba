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

  it("subtracts shared-expense charges from balance", () => {
    const result = computeBalanceFromTotals(200, 100, 50);
    expect(result.balance).toBe(50);
    expect(result.totalPaid).toBe(200);
    expect(result.totalCharged).toBe(150);
    expect(result.sessionChargesTotal).toBe(100);
    expect(result.sharedExpenseChargesTotal).toBe(50);
  });

  it("treats shared-expense-only debt the same as session-charge debt", () => {
    const sessionOnly = computeBalanceFromTotals(0, 50, 0);
    const sharedOnly = computeBalanceFromTotals(0, 0, 50);
    expect(sharedOnly.balance).toBe(sessionOnly.balance);
    expect(sharedOnly.totalCharged).toBe(50);
  });

  it("defaults sharedExpenseChargesTotal to 0 when omitted", () => {
    const result = computeBalanceFromTotals(100, 30);
    expect(result.sharedExpenseChargesTotal).toBe(0);
    expect(result.totalCharged).toBe(30);
    expect(result.balance).toBe(70);
  });
});
