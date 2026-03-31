import { describe, it, expect } from "vitest";
import { computePromoteTimestamp, type AttendanceStub } from "./waitlist";

function makeAttendance(id: string, offsetMs: number): AttendanceStub {
  return { id, createdAt: new Date(1_000_000 + offsetMs) };
}

describe("computePromoteTimestamp", () => {
  it("returns null for empty attendances", () => {
    expect(computePromoteTimestamp([], 5, "a")).toBeNull();
  });

  it("returns null when target is not found", () => {
    const attendances = [makeAttendance("a", 0), makeAttendance("b", 1000)];
    expect(computePromoteTimestamp(attendances, 1, "z")).toBeNull();
  });

  it("returns null when target is already confirmed (index < maxPlayers)", () => {
    const attendances = [
      makeAttendance("a", 0),
      makeAttendance("b", 1000),
      makeAttendance("c", 2000),
    ];
    // maxPlayers=3, so all are confirmed; target "b" is at index 1 < 3
    expect(computePromoteTimestamp(attendances, 3, "b")).toBeNull();
  });

  it("returns null when maxPlayers === attendances.length (all confirmed, none waitlisted)", () => {
    const attendances = [makeAttendance("a", 0), makeAttendance("b", 1000)];
    expect(computePromoteTimestamp(attendances, 2, "b")).toBeNull();
  });

  it("returns null when maxPlayers is 0 (no confirmed slots)", () => {
    const attendances = [makeAttendance("a", 0)];
    expect(computePromoteTimestamp(attendances, 0, "a")).toBeNull();
  });

  it("returns lastConfirmed.createdAt - 1ms for the first waitlisted player", () => {
    const attendances = [
      makeAttendance("confirmed1", 0),
      makeAttendance("confirmed2", 1000),
      makeAttendance("waitlist1", 2000), // index 2, first waitlisted
      makeAttendance("waitlist2", 3000),
    ];
    const result = computePromoteTimestamp(attendances, 2, "waitlist1");
    // lastConfirmed is index 1 (confirmed2) with createdAt = 1_001_000
    expect(result).toEqual(new Date(1_001_000 - 1));
  });

  it("returns lastConfirmed.createdAt - 1ms for the last waitlisted player", () => {
    const attendances = [
      makeAttendance("confirmed1", 0),
      makeAttendance("confirmed2", 1000),
      makeAttendance("waitlist1", 2000),
      makeAttendance("waitlist2", 3000), // last waitlisted
    ];
    const result = computePromoteTimestamp(attendances, 2, "waitlist2");
    expect(result).toEqual(new Date(1_001_000 - 1));
  });

  it("single waitlisted player with one confirmed → correct timestamp", () => {
    const attendances = [
      makeAttendance("only-confirmed", 5000),
      makeAttendance("only-waitlisted", 10000),
    ];
    const result = computePromoteTimestamp(attendances, 1, "only-waitlisted");
    expect(result).toEqual(new Date(1_005_000 - 1));
  });

  it("both first and last waitlisted get the same new timestamp (back of confirmed)", () => {
    const attendances = [
      makeAttendance("c1", 0),
      makeAttendance("c2", 500),
      makeAttendance("w1", 1000),
      makeAttendance("w2", 2000),
      makeAttendance("w3", 3000),
    ];
    const maxPlayers = 2;
    const resultFirst = computePromoteTimestamp(attendances, maxPlayers, "w1");
    const resultLast = computePromoteTimestamp(attendances, maxPlayers, "w3");
    // Both should be lastConfirmed (c2, offset 500 → createdAt = 1_000_500) - 1ms
    expect(resultFirst).toEqual(new Date(1_000_500 - 1));
    expect(resultLast).toEqual(new Date(1_000_500 - 1));
  });
});
