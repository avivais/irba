import { describe, expect, it } from "vitest";
import {
  parseSessionForm,
  SESSION_MAX_PLAYERS_MIN,
  SESSION_MAX_PLAYERS_MAX,
} from "./session-validation";

const BASE = {
  date: "2026-06-01T19:00",
  maxPlayers: "15",
};

describe("parseSessionForm", () => {
  it("accepts a valid date and maxPlayers", () => {
    const result = parseSessionForm(BASE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.date).toBeInstanceOf(Date);
    expect(isNaN(result.data.date.getTime())).toBe(false);
    expect(result.data.maxPlayers).toBe(15);
    expect(result.data.isClosed).toBe(false);
  });

  it("rejects an empty date", () => {
    const result = parseSessionForm({ ...BASE, date: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.date).toBeTruthy();
  });

  it("rejects an invalid date string", () => {
    const result = parseSessionForm({ ...BASE, date: "not-a-date" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.date).toBe("תאריך לא תקין");
  });

  it("allows past dates (no restriction for admin)", () => {
    const result = parseSessionForm({ ...BASE, date: "2020-01-01T10:00" });
    expect(result.ok).toBe(true);
  });

  it("rejects maxPlayers of 0", () => {
    const result = parseSessionForm({ ...BASE, maxPlayers: "0" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.maxPlayers).toBeTruthy();
  });

  it("rejects maxPlayers above maximum", () => {
    const result = parseSessionForm({
      ...BASE,
      maxPlayers: String(SESSION_MAX_PLAYERS_MAX + 1),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.maxPlayers).toBeTruthy();
  });

  it("accepts maxPlayers at minimum boundary", () => {
    const result = parseSessionForm({ ...BASE, maxPlayers: String(SESSION_MAX_PLAYERS_MIN) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.maxPlayers).toBe(SESSION_MAX_PLAYERS_MIN);
  });

  it("accepts maxPlayers at maximum boundary", () => {
    const result = parseSessionForm({ ...BASE, maxPlayers: String(SESSION_MAX_PLAYERS_MAX) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.maxPlayers).toBe(SESSION_MAX_PLAYERS_MAX);
  });

  it("rejects non-numeric maxPlayers", () => {
    const result = parseSessionForm({ ...BASE, maxPlayers: "abc" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.maxPlayers).toBeTruthy();
  });

  it("rejects missing maxPlayers", () => {
    const result = parseSessionForm({ date: BASE.date, maxPlayers: "" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.maxPlayers).toBeTruthy();
  });

  it("parses isClosed 'on' as true", () => {
    const result = parseSessionForm({ ...BASE, isClosed: "on" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isClosed).toBe(true);
  });

  it("defaults isClosed to false when absent", () => {
    const result = parseSessionForm(BASE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.isClosed).toBe(false);
  });

  it("accepts an ISO date string", () => {
    const result = parseSessionForm({ ...BASE, date: "2026-08-15T18:30:00.000Z" });
    expect(result.ok).toBe(true);
  });
});
