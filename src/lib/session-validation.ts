import { z } from "zod";

/**
 * Parse a datetime-local string ("YYYY-MM-DDTHH:mm") as Israel local time and return a UTC Date.
 * Handles DST automatically by computing the Israel timezone offset at the given moment.
 */
export function parseIsraelLocalDate(localStr: string): Date {
  // If the string already carries a timezone, parse it as-is
  if (/Z$|[+-]\d{2}:\d{2}$/.test(localStr)) {
    return new Date(localStr);
  }
  // Treat localStr as UTC to get a reference point
  const refUtc = new Date(localStr + "Z");
  // Format that UTC moment in Israel timezone
  const refIsrael = refUtc
    .toLocaleString("sv-SE", { timeZone: "Asia/Jerusalem" })
    .replace(" ", "T")
    .slice(0, 16);
  // offsetMs = how many ms ahead Israel is relative to UTC at this moment
  const offsetMs = new Date(refIsrael + "Z").getTime() - refUtc.getTime();
  // Actual UTC = Israel local time - offset
  return new Date(refUtc.getTime() - offsetMs);
}

/**
 * Returns the next occurrence of the given day-of-week (0=Sun…6=Sat) at the given
 * "HH:MM" time, expressed as a datetime-local string in Israel timezone.
 *
 * If today is that day and the time is still in the future → returns today.
 * Otherwise → returns the next future occurrence (always at least 1 day ahead
 * if the slot already passed today).
 */
export function nextDefaultSessionDateISO(dayOfWeek: number, time: string): string {
  const now = new Date();
  // "YYYY-MM-DD" in Israel timezone
  const israelDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  // "HH:MM" in Israel timezone (en-GB gives 24-hour format)
  const israelTimeStr = now.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  });

  const [year, month, day] = israelDateStr.split("-").map(Number);
  // Use UTC Date at midnight of Israel date — its getUTCDay() equals Israel day-of-week
  const israelMidnight = new Date(Date.UTC(year, month - 1, day));
  const currentDayOfWeek = israelMidnight.getUTCDay();

  let daysAhead = (dayOfWeek - currentDayOfWeek + 7) % 7;
  if (daysAhead === 0) {
    // Same weekday — use today only if the session time is still upcoming
    if (israelTimeStr >= time) {
      daysAhead = 7; // past the time already; skip to next week
    }
  }

  const targetMidnight = new Date(Date.UTC(year, month - 1, day + daysAhead));
  const targetDateStr = targetMidnight.toISOString().slice(0, 10); // "YYYY-MM-DD"
  return `${targetDateStr}T${time}`;
}

export const SESSION_MAX_PLAYERS_MIN = 1;
export const SESSION_MAX_PLAYERS_MAX = 100;

const optionalFloat = z
  .string()
  .optional()
  .refine(
    (v) => !v || v === "" || (!isNaN(parseFloat(v)) && isFinite(Number(v))),
    "ערך לא תקין",
  );

export const sessionFormSchema = z.object({
  date: z.string().min(1, "נא לבחור תאריך ושעה"),
  maxPlayers: z.string().min(1, "נא להזין מספר שחקנים מקסימלי"),
  isClosed: z.string().optional(),
  durationMinutes: z
    .string()
    .optional()
    .refine(
      (v) => !v || v === "" || (Number.isInteger(Number(v)) && Number(v) >= 30 && Number(v) <= 480),
      "משך חייב להיות בין 30 ל-480 דקות",
    ),
  locationName: z.string().max(200).optional(),
  locationLat: optionalFloat,
  locationLng: optionalFloat,
});

export type SessionFieldErrors = Partial<
  Record<"date" | "maxPlayers" | "durationMinutes" | "locationName" | "locationLat" | "locationLng", string>
>;

export type ParsedSession = {
  date: Date;
  maxPlayers: number;
  isClosed: boolean;
  durationMinutes: number | null;
  locationName: string | null;
  locationLat: number | null;
  locationLng: number | null;
};

export type SessionFormValidation =
  | { ok: true; data: ParsedSession }
  | { ok: false; errors: SessionFieldErrors };

export function parseSessionForm(
  raw: Record<string, string | undefined>,
): SessionFormValidation {
  const parsed = sessionFormSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: SessionFieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof SessionFieldErrors;
      if (key && errors[key] === undefined) {
        errors[key] = issue.message;
      }
    }
    return { ok: false, errors };
  }

  // Parse date — treat datetime-local string as Israel local time
  const date = parseIsraelLocalDate(parsed.data.date);
  if (!date || isNaN(date.getTime())) {
    return { ok: false, errors: { date: "תאריך לא תקין" } };
  }

  // Parse maxPlayers (integer, range check)
  const maxPlayers = parseInt(parsed.data.maxPlayers, 10);
  if (isNaN(maxPlayers)) {
    return {
      ok: false,
      errors: { maxPlayers: `נא להזין מספר בין ${SESSION_MAX_PLAYERS_MIN} ל-${SESSION_MAX_PLAYERS_MAX}` },
    };
  }
  if (maxPlayers < SESSION_MAX_PLAYERS_MIN || maxPlayers > SESSION_MAX_PLAYERS_MAX) {
    return {
      ok: false,
      errors: { maxPlayers: `נא להזין מספר בין ${SESSION_MAX_PLAYERS_MIN} ל-${SESSION_MAX_PLAYERS_MAX}` },
    };
  }

  const isClosed = parsed.data.isClosed === "on";

  const durationMinutes =
    parsed.data.durationMinutes && parsed.data.durationMinutes !== ""
      ? parseInt(parsed.data.durationMinutes, 10)
      : null;

  const locationName =
    parsed.data.locationName && parsed.data.locationName !== ""
      ? parsed.data.locationName
      : null;

  const locationLat =
    parsed.data.locationLat && parsed.data.locationLat !== ""
      ? parseFloat(parsed.data.locationLat)
      : null;

  const locationLng =
    parsed.data.locationLng && parsed.data.locationLng !== ""
      ? parseFloat(parsed.data.locationLng)
      : null;

  return { ok: true, data: { date, maxPlayers, isClosed, durationMinutes, locationName, locationLat, locationLng } };
}
