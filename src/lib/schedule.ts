const ISRAEL_TZ = "Asia/Jerusalem";

/**
 * Given a weekly schedule (day-of-week 0=Sun…6=Sat, time "HH:MM") and a reference
 * "now" timestamp, returns the Date of the next occurrence of that schedule in
 * Israel timezone (Asia/Jerusalem).
 *
 * "Next occurrence" means: the soonest future datetime matching day+time,
 * including today if the scheduled time hasn't passed yet in Israel time.
 */
export function nextScheduledSession(
  scheduleDayOfWeek: number, // 0=Sunday … 6=Saturday
  scheduleTime: string, // "HH:MM" in 24h Israel time
  now: Date = new Date(),
): Date {
  const [schedHour, schedMin] = scheduleTime.split(":").map(Number);

  // Get Israel local parts for "now"
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const nowDow = weekdayMap[get("weekday")];
  const nowHour = parseInt(get("hour"), 10);
  const nowMin = parseInt(get("minute"), 10);

  // How many days until the next matching weekday?
  let daysUntil = (scheduleDayOfWeek - nowDow + 7) % 7;

  // If it's the same day, check whether the scheduled time has already passed.
  // If it has, push forward 7 days.
  if (daysUntil === 0) {
    const nowMinutes = nowHour * 60 + nowMin;
    const schedMinutes = schedHour * 60 + schedMin;
    if (nowMinutes > schedMinutes) {
      daysUntil = 7;
    }
  }

  // Build the target date string in Israel local time and convert to UTC.
  // We derive the base Israel date from the formatter parts, advance by daysUntil,
  // then construct an ISO-like local string and re-parse it in the Israel TZ.
  const nowYear = parseInt(get("year"), 10);
  const nowMonth = parseInt(get("month"), 10) - 1; // 0-based
  const nowDay = parseInt(get("day"), 10);

  // Build a UTC midnight for the Israel calendar date, then shift by daysUntil.
  // We use a trick: create a Date that represents noon UTC on the Israel calendar
  // date (to stay within the same calendar day regardless of offset), advance by
  // daysUntil days, then derive the new Israel date string.
  const israelNoon = new Date(
    Date.UTC(nowYear, nowMonth, nowDay + daysUntil, 12, 0, 0),
  );

  // Format the target Israel date
  const targetFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const targetDateStr = targetFormatter.format(israelNoon); // "YYYY-MM-DD"

  // Build a local Israel datetime string and find the UTC instant it corresponds to.
  // Strategy: find the UTC offset at roughly the target time by binary-searching
  // or, more simply, construct the datetime and read back via Intl to verify/correct.
  const paddedHour = String(schedHour).padStart(2, "0");
  const paddedMin = String(schedMin).padStart(2, "0");
  const localISOish = `${targetDateStr}T${paddedHour}:${paddedMin}:00`;

  // Convert local Israel time to UTC using the Temporal-free approach:
  // Parse the date parts, guess the UTC time, then verify and correct once for DST.
  const [tYear, tMonth, tDay] = targetDateStr.split("-").map(Number);

  // Initial guess: assume UTC+2 (Israel winter)
  const guess = new Date(
    Date.UTC(tYear, tMonth - 1, tDay, schedHour - 2, schedMin, 0),
  );

  // Read back what Israel time that guess actually represents
  const verifyParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(guess);

  const guessHour = parseInt(
    verifyParts.find((p) => p.type === "hour")?.value ?? "0",
    10,
  );
  const guessMin = parseInt(
    verifyParts.find((p) => p.type === "minute")?.value ?? "0",
    10,
  );

  const offsetMinutes =
    (guessHour - schedHour) * 60 + (guessMin - schedMin);

  // Correct the guess by subtracting the error (in ms)
  const result = new Date(guess.getTime() - offsetMinutes * 60 * 1000);

  // Paranoia check: verify result is correct (handles DST gap/fold edge cases)
  const finalParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(result);

  const finalHour = parseInt(
    finalParts.find((p) => p.type === "hour")?.value ?? "0",
    10,
  );
  const finalMin = parseInt(
    finalParts.find((p) => p.type === "minute")?.value ?? "0",
    10,
  );
  const finalDay = parseInt(
    finalParts.find((p) => p.type === "day")?.value ?? "1",
    10,
  );

  if (finalHour !== schedHour || finalMin !== schedMin || finalDay !== tDay) {
    // Apply a second correction (shouldn't be needed except in DST gaps)
    const remainingOffsetMs =
      ((finalHour - schedHour) * 60 + (finalMin - schedMin)) * 60 * 1000;
    return new Date(result.getTime() - remainingOffsetMs);
  }

  void localISOish; // suppress unused warning
  return result;
}
