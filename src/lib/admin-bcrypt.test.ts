import { compare } from "bcryptjs";
import { describe, expect, it } from "vitest";

/** Precomputed at cost 4 for fast tests — matches `bcryptjs.hash("testpass", 4)`. */
const TESTPASS_HASH =
  "$2b$04$xgFHXeb/c59JpikDMZwO6uwxNr3K/4L8lnlPVJxYycQnxzguZUpw.";

describe("admin password hashing (bcryptjs)", () => {
  it("compare succeeds for correct password", async () => {
    expect(await compare("testpass", TESTPASS_HASH)).toBe(true);
  });

  it("compare fails for wrong password", async () => {
    expect(await compare("wrong", TESTPASS_HASH)).toBe(false);
  });
});
