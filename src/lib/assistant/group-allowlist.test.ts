import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config", () => ({
  getConfigValue: vi.fn(),
}));

import { getConfigValue } from "@/lib/config";
import { isAssistantGroupAllowed, parseAllowedGroups } from "./group-allowlist";

describe("parseAllowedGroups", () => {
  it("splits comma-separated group JIDs and trims whitespace", () => {
    expect(
      parseAllowedGroups("120363409761679942@g.us, 972507666550-1441540291@g.us, "),
    ).toEqual(["120363409761679942@g.us", "972507666550-1441540291@g.us"]);
  });

  it("treats an empty value as disabled", () => {
    expect(parseAllowedGroups("")).toEqual([]);
  });
});

describe("isAssistantGroupAllowed", () => {
  beforeEach(() => {
    vi.mocked(getConfigValue).mockReset();
  });

  it("allows exact allowlisted group JIDs", async () => {
    vi.mocked(getConfigValue).mockResolvedValue("120363409761679942@g.us");
    await expect(isAssistantGroupAllowed("120363409761679942@g.us")).resolves.toBe(true);
  });

  it("denies when the allowlist is empty", async () => {
    vi.mocked(getConfigValue).mockResolvedValue("");
    await expect(isAssistantGroupAllowed("120363409761679942@g.us")).resolves.toBe(false);
  });
});
