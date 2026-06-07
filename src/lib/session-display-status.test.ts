import { describe, expect, it } from "vitest";
import { getSessionDisplayStatus } from "./session-display-status";

const base = {
  cancelledAt: null,
  isArchived: false,
  isCharged: false,
  isClosed: false,
};

describe("getSessionDisplayStatus", () => {
  it("marks a charged session as charged even when it is not closed", () => {
    expect(getSessionDisplayStatus({ ...base, isCharged: true })).toMatchObject({
      label: "חויב",
      tone: "charged",
    });
  });

  it("keeps cancelled and archived states above charged", () => {
    expect(
      getSessionDisplayStatus({
        ...base,
        cancelledAt: new Date("2026-06-01T18:00:00Z"),
        isCharged: true,
      }).label,
    ).toBe("בוטל");

    expect(
      getSessionDisplayStatus({
        ...base,
        isArchived: true,
        isCharged: true,
      }).label,
    ).toBe("ארכיון");
  });
});
