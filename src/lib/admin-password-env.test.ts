import { describe, expect, it } from "vitest";
import { applyAdminPasswordHashToEnvContent, quotedEnvValue } from "./admin-password-env";

describe("quotedEnvValue", () => {
  it("wraps and escapes quotes and backslashes", () => {
    expect(quotedEnvValue(`a"b\\c`)).toBe(`"a\\"b\\\\c"`);
  });
});

describe("applyAdminPasswordHashToEnvContent", () => {
  it("replaces an existing ADMIN_PASSWORD_HASH line", () => {
    const before = `FOO=1\nADMIN_PASSWORD_HASH="old"\nBAR=2\n`;
    const h = "$2b$12$newhashhere";
    expect(applyAdminPasswordHashToEnvContent(before, h)).toBe(
      `FOO=1\nADMIN_PASSWORD_HASH="${h}"\nBAR=2\n`,
    );
  });

  it("replaces an indented ADMIN_PASSWORD_HASH line (normalizes to no indent)", () => {
    const before = "  ADMIN_PASSWORD_HASH=\n";
    const h = "x";
    expect(applyAdminPasswordHashToEnvContent(before, h)).toBe(
      `ADMIN_PASSWORD_HASH="${h}"\n`,
    );
  });

  it("appends when key is missing", () => {
    expect(applyAdminPasswordHashToEnvContent("X=1\n", "h")).toBe(
      `X=1\nADMIN_PASSWORD_HASH="h"\n`,
    );
  });

  it("appends to empty file", () => {
    expect(applyAdminPasswordHashToEnvContent("", "h")).toBe(
      `ADMIN_PASSWORD_HASH="h"\n`,
    );
  });

  it("appends with newline when file has no trailing newline", () => {
    expect(applyAdminPasswordHashToEnvContent("X=1", "h")).toBe(
      `X=1\nADMIN_PASSWORD_HASH="h"\n`,
    );
  });
});
