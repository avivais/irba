import { describe, expect, it } from "vitest";
import { isValidIsraeliId, normalizeIsraeliId } from "./israeli-id";

describe("isValidIsraeliId", () => {
  it("accepts known valid IDs", () => {
    // Publicly documented valid Israeli IDs
    expect(isValidIsraeliId("000000018")).toBe(true);
    expect(isValidIsraeliId("123456782")).toBe(true);
    expect(isValidIsraeliId("039337423")).toBe(true);
  });

  it("strips dashes and spaces before validating", () => {
    expect(isValidIsraeliId("12345678-2")).toBe(true);
    expect(isValidIsraeliId("123 456 782")).toBe(true);
  });

  it("pads short digit strings to 9 digits", () => {
    // "18" padded to "000000018" is valid
    expect(isValidIsraeliId("18")).toBe(true);
  });

  it("rejects invalid checksum", () => {
    expect(isValidIsraeliId("123456789")).toBe(false);
    expect(isValidIsraeliId("000000001")).toBe(false);
  });

  it("rejects more than 9 digits", () => {
    expect(isValidIsraeliId("1234567890")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidIsraeliId("")).toBe(false);
  });

  it("rejects all non-digit characters after stripping", () => {
    expect(isValidIsraeliId("abc")).toBe(false);
  });
});

describe("normalizeIsraeliId", () => {
  it("returns zero-padded 9-digit string for valid ID", () => {
    expect(normalizeIsraeliId("123456782")).toBe("123456782");
    expect(normalizeIsraeliId("18")).toBe("000000018");
  });

  it("strips dashes and spaces", () => {
    expect(normalizeIsraeliId("12345678-2")).toBe("123456782");
  });

  it("throws for invalid checksum", () => {
    expect(() => normalizeIsraeliId("123456789")).toThrow();
  });

  it("throws for empty string", () => {
    expect(() => normalizeIsraeliId("")).toThrow();
  });

  it("throws for too many digits", () => {
    expect(() => normalizeIsraeliId("1234567890")).toThrow();
  });
});
