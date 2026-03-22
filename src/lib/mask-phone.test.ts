import { describe, expect, it } from "vitest";
import { maskPhone } from "./mask-phone";

describe("maskPhone", () => {
  it("masks last 4 digits for normal length", () => {
    expect(maskPhone("0501234567")).toBe("****4567");
  });

  it("returns placeholder for short strings", () => {
    expect(maskPhone("05")).toBe("****");
    expect(maskPhone("")).toBe("****");
  });
});
