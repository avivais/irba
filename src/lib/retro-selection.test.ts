import { describe, expect, it } from "vitest";
import { selectRetroSessionChanges } from "./retro-selection";

const sessions = [
  {
    sessionId: "2026-08-04",
    changes: [
      { isFocalPlayer: true, oldAmount: 40, newAmount: 30 },
      { isFocalPlayer: false, oldAmount: 20, newAmount: 22 },
    ],
  },
  {
    sessionId: "2026-07-07",
    changes: [
      { isFocalPlayer: true, oldAmount: 40, newAmount: 30 },
      { isFocalPlayer: false, oldAmount: 20, newAmount: 23 },
    ],
  },
];

describe("selectRetroSessionChanges", () => {
  it("includes every candidate when no explicit selection is supplied", () => {
    const result = selectRetroSessionChanges(sessions);

    expect(result.selectedSessions).toHaveLength(2);
    expect(result.allChanges).toHaveLength(4);
    expect(result.focalDiff).toBe(-20);
    expect(result.othersDiff).toBe(5);
  });

  it("fully excludes a deselected historical debt from preview totals", () => {
    const result = selectRetroSessionChanges(sessions, ["2026-08-04"]);

    expect(result.selectedSessions.map((session) => session.sessionId)).toEqual([
      "2026-08-04",
    ]);
    expect(result.allChanges).toHaveLength(2);
    expect(result.focalDiff).toBe(-10);
    expect(result.othersDiff).toBe(2);
  });

  it("returns no changes and zero deltas when every debt is deselected", () => {
    const result = selectRetroSessionChanges(sessions, []);

    expect(result.selectedSessions).toEqual([]);
    expect(result.allChanges).toEqual([]);
    expect(result.focalDiff).toBe(0);
    expect(result.othersDiff).toBe(0);
  });
});
