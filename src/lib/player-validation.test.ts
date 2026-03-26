import { describe, expect, it } from "vitest";
import {
  parsePlayerForm,
  PHONE_INVALID_MESSAGE,
  PLAYER_RANK_MIN,
  PLAYER_RANK_MAX,
  POSITION_VALUES,
} from "./player-validation";

const BASE = {
  phone: "0501234567",
  playerKind: "DROP_IN" as const,
};

describe("parsePlayerForm", () => {
  it("accepts a valid minimal payload (no positions)", () => {
    const result = parsePlayerForm(BASE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.phoneNormalized).toBe("0501234567");
    expect(result.data.playerKind).toBe("DROP_IN");
    expect(result.data.positions).toEqual([]);
    expect(result.data.rank).toBeNull();
    expect(result.data.balance).toBe(0);
    expect(result.data.isAdmin).toBe(false);
  });

  it("accepts a full payload with all optional fields", () => {
    const result = parsePlayerForm({
      ...BASE,
      playerKind: "REGISTERED",
      positions: ["PG", "SF"],
      rank: "5.5",
      balance: "-100",
      isAdmin: "on",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.playerKind).toBe("REGISTERED");
    expect(result.data.positions).toEqual(["PG", "SF"]);
    expect(result.data.rank).toBe(5.5);
    expect(result.data.balance).toBe(-100);
    expect(result.data.isAdmin).toBe(true);
  });

  it("accepts all five valid position values together", () => {
    const result = parsePlayerForm({ ...BASE, positions: [...POSITION_VALUES] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.positions).toEqual([...POSITION_VALUES]);
  });

  it("accepts each position value individually", () => {
    for (const pos of POSITION_VALUES) {
      const result = parsePlayerForm({ ...BASE, positions: [pos] });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.positions).toEqual([pos]);
    }
  });

  it("rejects an unknown position value", () => {
    const result = parsePlayerForm({ ...BASE, positions: ["PG", "UNKNOWN"] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.positions).toBeTruthy();
  });

  it("accepts a single position string (not array)", () => {
    const result = parsePlayerForm({ ...BASE, positions: "PG" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.positions).toEqual(["PG"]);
  });

  it("treats absent positions as empty array", () => {
    const result = parsePlayerForm(BASE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.positions).toEqual([]);
  });

  it("treats empty string positions as empty array", () => {
    const result = parsePlayerForm({ ...BASE, positions: "" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.positions).toEqual([]);
  });

  it("rejects an empty phone", () => {
    const result = parsePlayerForm({ ...BASE, phone: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.phone).toBeTruthy();
  });

  it("rejects a non-Israeli phone", () => {
    const result = parsePlayerForm({ ...BASE, phone: "123" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.phone).toBe(PHONE_INVALID_MESSAGE);
  });

  it("accepts a phone with dashes and normalizes it", () => {
    const result = parsePlayerForm({ ...BASE, phone: "050-123-4567" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.phoneNormalized).toBe("0501234567");
  });

  it("rejects rank below minimum", () => {
    const result = parsePlayerForm({ ...BASE, rank: "0" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.rank).toBeTruthy();
  });

  it("rejects rank above maximum", () => {
    const result = parsePlayerForm({ ...BASE, rank: String(PLAYER_RANK_MAX + 1) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.rank).toBeTruthy();
  });

  it("accepts rank at minimum and maximum boundaries", () => {
    const minResult = parsePlayerForm({ ...BASE, rank: String(PLAYER_RANK_MIN) });
    expect(minResult.ok).toBe(true);
    if (!minResult.ok) return;
    expect(minResult.data.rank).toBe(PLAYER_RANK_MIN);

    const maxResult = parsePlayerForm({ ...BASE, rank: String(PLAYER_RANK_MAX) });
    expect(maxResult.ok).toBe(true);
    if (!maxResult.ok) return;
    expect(maxResult.data.rank).toBe(PLAYER_RANK_MAX);
  });

  it("rejects a non-number rank", () => {
    const result = parsePlayerForm({ ...BASE, rank: "abc" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.rank).toBeTruthy();
  });

  it("treats empty rank as null", () => {
    const result = parsePlayerForm({ ...BASE, rank: "" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.rank).toBeNull();
  });

  it("rejects a non-number balance", () => {
    const result = parsePlayerForm({ ...BASE, balance: "abc" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.balance).toBeTruthy();
  });

  it("allows a negative balance", () => {
    const result = parsePlayerForm({ ...BASE, balance: "-50" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.balance).toBe(-50);
  });

  it("treats empty balance as 0", () => {
    const result = parsePlayerForm({ ...BASE, balance: "" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.balance).toBe(0);
  });

  it("parses isAdmin 'on' as true", () => {
    const result = parsePlayerForm({ ...BASE, isAdmin: "on" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isAdmin).toBe(true);
  });

  it("defaults isAdmin to false when absent", () => {
    const result = parsePlayerForm(BASE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isAdmin).toBe(false);
  });
});
