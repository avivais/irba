import { describe, expect, it } from "vitest";
import { nextScheduledSession } from "./schedule";

// Helper: parse an Israel local datetime string to a UTC Date.
// We rely on the same Intl approach to validate, but for test fixtures
// we use known UTC offsets (verified against historical data):
//   Israel is UTC+2 (winter/standard) and UTC+3 (summer/DST).
// DST in 2025: clocks spring forward on March 28 at 02:00 -> 03:00 (UTC+3 starts)
//              clocks fall back  on October 26 at 02:00 -> 01:00 (UTC+2 resumes)

const IL_WINTER_OFFSET = 2; // UTC+2
const IL_SUMMER_OFFSET = 3; // UTC+3

/** Build a UTC Date from an Israel local time, given the known offset. */
function ilDate(
  year: number,
  month: number, // 1-based
  day: number,
  hour: number,
  min: number,
  offsetHours: number,
): Date {
  return new Date(
    Date.UTC(year, month - 1, day, hour - offsetHours, min, 0),
  );
}

/** Return the Israel local time components of a Date for assertions. */
function ilParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: parseInt(get("year")),
    month: parseInt(get("month")),
    day: parseInt(get("day")),
    hour: parseInt(get("hour")),
    minute: parseInt(get("minute")),
    weekday: get("weekday"),
  };
}

describe("nextScheduledSession", () => {
  // ──────────────────────────────────────────────
  // 1. Next occurrence is TODAY (time hasn't passed)
  // ──────────────────────────────────────────────
  it("returns today when scheduled time has not yet passed", () => {
    // Monday 2025-01-06, 09:00 IL (UTC+2 winter) → now is 08:00 IL
    const now = ilDate(2025, 1, 6, 8, 0, IL_WINTER_OFFSET); // Mon 08:00 IL
    const result = nextScheduledSession(1 /* Monday */, "09:00", now);
    const p = ilParts(result);
    expect(p.year).toBe(2025);
    expect(p.month).toBe(1);
    expect(p.day).toBe(6);
    expect(p.hour).toBe(9);
    expect(p.minute).toBe(0);
  });

  // ──────────────────────────────────────────────
  // 2. Next occurrence is TODAY — exactly at now (include it)
  // ──────────────────────────────────────────────
  it("returns today when now equals the scheduled time exactly", () => {
    // Wednesday 2025-01-08, 20:30 IL
    const now = ilDate(2025, 1, 8, 20, 30, IL_WINTER_OFFSET);
    const result = nextScheduledSession(3 /* Wednesday */, "20:30", now);
    const p = ilParts(result);
    expect(p.day).toBe(8);
    expect(p.hour).toBe(20);
    expect(p.minute).toBe(30);
  });

  // ──────────────────────────────────────────────
  // 3. Next occurrence is TOMORROW
  // ──────────────────────────────────────────────
  it("returns tomorrow when scheduled time has already passed today", () => {
    // Thursday 2025-01-09, 21:00 IL — schedule is Thursday 20:00 (passed)
    // So next occurrence is Friday 2025-01-10
    const now = ilDate(2025, 1, 9, 21, 0, IL_WINTER_OFFSET);
    const result = nextScheduledSession(5 /* Friday */, "18:00", now);
    const p = ilParts(result);
    expect(p.day).toBe(10); // Friday Jan 10
    expect(p.hour).toBe(18);
    expect(p.minute).toBe(0);
  });

  // ──────────────────────────────────────────────
  // 4. Next occurrence is 6 days away (same day, time just passed)
  // ──────────────────────────────────────────────
  it("returns 6 days away when same weekday but time just passed", () => {
    // Sunday 2025-01-05, 19:01 IL — schedule is Sunday 19:00 (just passed by 1 min)
    const now = ilDate(2025, 1, 5, 19, 1, IL_WINTER_OFFSET);
    const result = nextScheduledSession(0 /* Sunday */, "19:00", now);
    const p = ilParts(result);
    expect(p.day).toBe(12); // Sunday Jan 12 (6 days later)
    expect(p.hour).toBe(19);
    expect(p.minute).toBe(0);
  });

  // ──────────────────────────────────────────────
  // 5. Next occurrence is same day next week (exactly 7 days)
  // ──────────────────────────────────────────────
  it("returns same weekday next week when time has just passed", () => {
    // Tuesday 2025-02-11, 22:00 IL — schedule is Tuesday 21:59
    const now = ilDate(2025, 2, 11, 22, 0, IL_WINTER_OFFSET);
    const result = nextScheduledSession(2 /* Tuesday */, "21:59", now);
    const p = ilParts(result);
    expect(p.day).toBe(18); // Tuesday Feb 18
    expect(p.hour).toBe(21);
    expect(p.minute).toBe(59);
  });

  // ──────────────────────────────────────────────
  // 6. DST — Israel is UTC+2 in winter (Jan)
  // ──────────────────────────────────────────────
  it("correctly converts to UTC when Israel is UTC+2 (winter)", () => {
    // Saturday 2025-01-18, 20:00 IL (UTC+2) → UTC should be 18:00
    const now = ilDate(2025, 1, 18, 15, 0, IL_WINTER_OFFSET); // before schedule
    const result = nextScheduledSession(6 /* Saturday */, "20:00", now);
    expect(result.getUTCHours()).toBe(18);
    expect(result.getUTCMinutes()).toBe(0);
  });

  // ──────────────────────────────────────────────
  // 7. DST — Israel is UTC+3 in summer (July)
  // ──────────────────────────────────────────────
  it("correctly converts to UTC when Israel is UTC+3 (summer)", () => {
    // Friday 2025-07-04, 20:00 IL (UTC+3) → UTC should be 17:00
    const now = ilDate(2025, 7, 4, 15, 0, IL_SUMMER_OFFSET); // before schedule
    const result = nextScheduledSession(5 /* Friday */, "20:00", now);
    expect(result.getUTCHours()).toBe(17);
    expect(result.getUTCMinutes()).toBe(0);
  });

  // ──────────────────────────────────────────────
  // 8. Edge case: midnight "00:00"
  // ──────────────────────────────────────────────
  it("handles midnight scheduleTime 00:00", () => {
    // Monday 2025-03-10, 23:00 IL — schedule is Tuesday 00:00 (next day midnight)
    const now = ilDate(2025, 3, 10, 23, 0, IL_WINTER_OFFSET);
    const result = nextScheduledSession(2 /* Tuesday */, "00:00", now);
    const p = ilParts(result);
    expect(p.day).toBe(11); // Tuesday Mar 11
    expect(p.hour).toBe(0);
    expect(p.minute).toBe(0);
  });

  // ──────────────────────────────────────────────
  // 9. Edge case: end-of-day "23:59"
  // ──────────────────────────────────────────────
  it("handles end-of-day scheduleTime 23:59", () => {
    // Wednesday 2025-03-12, 23:58 IL — schedule is Wednesday 23:59 (not yet passed)
    const now = ilDate(2025, 3, 12, 23, 58, IL_WINTER_OFFSET);
    const result = nextScheduledSession(3 /* Wednesday */, "23:59", now);
    const p = ilParts(result);
    expect(p.day).toBe(12); // same Wednesday
    expect(p.hour).toBe(23);
    expect(p.minute).toBe(59);
  });

  // ──────────────────────────────────────────────
  // 10. Multi-day skip (e.g., now=Monday, schedule=Friday)
  // ──────────────────────────────────────────────
  it("skips forward multiple days correctly", () => {
    // Monday 2025-04-07, 10:00 IL (UTC+3 summer) — schedule is Friday 18:00
    const now = ilDate(2025, 4, 7, 10, 0, IL_SUMMER_OFFSET);
    const result = nextScheduledSession(5 /* Friday */, "18:00", now);
    const p = ilParts(result);
    expect(p.day).toBe(11); // Friday Apr 11
    expect(p.hour).toBe(18);
    expect(p.minute).toBe(0);
  });
});
