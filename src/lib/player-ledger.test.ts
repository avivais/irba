import { describe, expect, it } from "vitest";
import { buildPlayerLedger, indexLedgerBalances } from "./player-ledger";

function at(value: string): Date {
  return new Date(value);
}

describe("buildPlayerLedger", () => {
  it("computes balances chronologically across payments and every charge type", () => {
    const entries = buildPlayerLedger([
      {
        id: "payment-late",
        kind: "PAYMENT",
        effectiveAt: at("2026-07-10T00:00:00Z"),
        createdAt: at("2026-07-10T10:00:00Z"),
        amount: 100,
      },
      {
        id: "session-early",
        kind: "SESSION_CHARGE",
        effectiveAt: at("2026-07-01T00:00:00Z"),
        createdAt: at("2026-07-01T10:00:00Z"),
        amount: 40,
      },
      {
        id: "shared-middle",
        kind: "SHARED_EXPENSE_CHARGE",
        effectiveAt: at("2026-07-05T00:00:00Z"),
        createdAt: at("2026-07-05T10:00:00Z"),
        amount: 15,
      },
    ]);

    expect(entries.map((entry) => [entry.id, entry.balanceAfter])).toEqual([
      ["session-early", -40],
      ["shared-middle", -55],
      ["payment-late", 45],
    ]);
  });

  it("uses creation time as a deterministic same-day tie breaker", () => {
    const effectiveAt = at("2026-07-07T00:00:00Z");
    const entries = buildPlayerLedger([
      {
        id: "payment",
        kind: "PAYMENT",
        effectiveAt,
        createdAt: at("2026-07-07T12:00:00Z"),
        amount: 50,
      },
      {
        id: "charge",
        kind: "SESSION_CHARGE",
        effectiveAt,
        createdAt: at("2026-07-07T09:00:00Z"),
        amount: 30,
      },
    ]);

    expect(entries.map((entry) => [entry.id, entry.balanceAfter])).toEqual([
      ["charge", -30],
      ["payment", 20],
    ]);
  });

  it("indexes balances without collisions between event kinds", () => {
    const sameId = "same-id";
    const entries = buildPlayerLedger([
      {
        id: sameId,
        kind: "SESSION_CHARGE",
        effectiveAt: at("2026-07-01T00:00:00Z"),
        createdAt: at("2026-07-01T00:00:00Z"),
        amount: 40,
      },
      {
        id: sameId,
        kind: "PAYMENT",
        effectiveAt: at("2026-07-02T00:00:00Z"),
        createdAt: at("2026-07-02T00:00:00Z"),
        amount: 60,
      },
    ]);

    const index = indexLedgerBalances(entries);
    expect(index.get(`SESSION_CHARGE:${sameId}`)).toBe(-40);
    expect(index.get(`PAYMENT:${sameId}`)).toBe(20);
  });
});
