import { describe, expect, it } from "vitest";
import { normalizePhone, PhoneValidationError } from "./phone";

describe("normalizePhone", () => {
  it("accepts canonical 10-digit Israeli mobile", () => {
    expect(normalizePhone("0501234567")).toBe("0501234567");
  });

  it("strips spaces, dashes, and parentheses", () => {
    expect(normalizePhone("050-123-4567")).toBe("0501234567");
    expect(normalizePhone("050 123 4567")).toBe("0501234567");
    expect(normalizePhone("(050) 1234567")).toBe("0501234567");
  });

  it("strips leading + and non-digits but rejects international digit form", () => {
    expect(() => normalizePhone("+972501234567")).toThrow(PhoneValidationError);
  });

  it("rejects 972… without plus after strip", () => {
    expect(() => normalizePhone("972501234567")).toThrow(PhoneValidationError);
  });

  it("rejects non-mobile Israeli prefixes", () => {
    expect(() => normalizePhone("0212345678")).toThrow(PhoneValidationError);
  });

  it("rejects empty and too short", () => {
    expect(() => normalizePhone("")).toThrow(PhoneValidationError);
    expect(() => normalizePhone("051234567")).toThrow(PhoneValidationError);
  });

  it("throws PhoneValidationError for invalid input", () => {
    expect(() => normalizePhone("invalid")).toThrow(PhoneValidationError);
  });
});
