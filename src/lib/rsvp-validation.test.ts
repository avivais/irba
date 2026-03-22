import { describe, expect, it } from "vitest";
import {
  getAttendFormValidation,
  parseAttendFormFields,
} from "./rsvp-validation";

describe("parseAttendFormFields", () => {
  it("accepts valid name and Israeli mobile", () => {
    const r = parseAttendFormFields({
      name: "  יוסי  ",
      phone: "050-1234567",
    });
    expect(r).toEqual({
      ok: true,
      name: "יוסי",
      phoneNormalized: "0501234567",
    });
  });

  it("rejects empty name", () => {
    const r = parseAttendFormFields({ name: "   ", phone: "0501234567" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("שם");
  });

  it("rejects empty phone", () => {
    const r = parseAttendFormFields({ name: "יוסי", phone: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("טלפון");
  });

  it("rejects invalid phone", () => {
    const r = parseAttendFormFields({ name: "יוסי", phone: "123" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("05");
  });

  it("rejects name over 80 chars", () => {
    const r = parseAttendFormFields({
      name: "א".repeat(81),
      phone: "0501234567",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("80");
  });
});

describe("getAttendFormValidation", () => {
  it("returns field errors for empty name and phone", () => {
    const v = getAttendFormValidation({ name: "", phone: "" });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.errors.name).toBeDefined();
      expect(v.errors.phone).toBeDefined();
    }
  });

  it("returns only phone error when name valid and phone invalid", () => {
    const v = getAttendFormValidation({ name: "יוסי", phone: "12" });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.errors.name).toBeUndefined();
      expect(v.errors.phone).toContain("05");
    }
  });

  it("returns name and phone errors when name empty but phone format invalid", () => {
    const v = getAttendFormValidation({ name: "", phone: "12" });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.errors.name).toBeDefined();
      expect(v.errors.phone).toContain("05");
    }
  });

  it("matches parseAttendFormFields on success", () => {
    const raw = { name: "יוסי", phone: "0501234567" };
    const v = getAttendFormValidation(raw);
    const p = parseAttendFormFields(raw);
    expect(v.ok).toBe(true);
    expect(p.ok).toBe(true);
    if (v.ok && p.ok) {
      expect(v.name).toBe(p.name);
      expect(v.phoneNormalized).toBe(p.phoneNormalized);
    }
  });
});
