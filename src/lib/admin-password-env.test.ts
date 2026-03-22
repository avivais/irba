import { describe, expect, it } from "vitest";
import {
  applyAdminPasswordHashToEnvContent,
  escapeDollarsForDotenvExpand,
  normalizeAdminPasswordHashFromEnv,
  quotedEnvValue,
} from "./admin-password-env";

describe("escapeDollarsForDotenvExpand", () => {
  it("doubles each dollar for Next/dotenv-expand", () => {
    expect(escapeDollarsForDotenvExpand("$2b$12$x")).toBe("$$2b$$12$$x");
  });
});

describe("quotedEnvValue", () => {
  it("wraps and escapes quotes, backslashes, and dollars", () => {
    expect(quotedEnvValue(`a"b\\c`)).toBe(`"a\\"b\\\\c"`);
    expect(quotedEnvValue("$2b$12$ab")).toBe(`"$$2b$$12$$ab"`);
  });
});

describe("normalizeAdminPasswordHashFromEnv", () => {
  it("strips quotes and accepts bcrypt hashes", () => {
    expect(
      normalizeAdminPasswordHashFromEnv('  "$2b$04$abc"  '),
    ).toBe("$2b$04$abc");
  });

  it("returns null for empty or non-bcrypt", () => {
    expect(normalizeAdminPasswordHashFromEnv("")).toBeNull();
    expect(normalizeAdminPasswordHashFromEnv(undefined)).toBeNull();
    expect(normalizeAdminPasswordHashFromEnv("plain")).toBeNull();
  });
});

describe("applyAdminPasswordHashToEnvContent", () => {
  it("removes duplicate ADMIN_PASSWORD_HASH lines and appends one", () => {
    const before = `ADMIN_PASSWORD_HASH=""\nFOO=1\nADMIN_PASSWORD_HASH="$2b$old"\n`;
    const h = "$2b$12$newhashhere";
    expect(applyAdminPasswordHashToEnvContent(before, h)).toBe(
      `FOO=1\nADMIN_PASSWORD_HASH="$$2b$$12$$newhashhere"\n`,
    );
  });

  it("replaces an existing ADMIN_PASSWORD_HASH line (moves key to end)", () => {
    const before = `FOO=1\nADMIN_PASSWORD_HASH="old"\nBAR=2\n`;
    const h = "$2b$12$newhashhere";
    expect(applyAdminPasswordHashToEnvContent(before, h)).toBe(
      `FOO=1\nBAR=2\nADMIN_PASSWORD_HASH="$$2b$$12$$newhashhere"\n`,
    );
  });

  it("replaces an indented ADMIN_PASSWORD_HASH line", () => {
    const before = "  ADMIN_PASSWORD_HASH=\n";
    const h = "$2b$x";
    expect(applyAdminPasswordHashToEnvContent(before, h)).toBe(
      `ADMIN_PASSWORD_HASH="$$2b$$x"\n`,
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
