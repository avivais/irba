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

export const SESSION_MAX_PLAYERS_MIN = 1;
export const SESSION_MAX_PLAYERS_MAX = 100;

export const sessionFormSchema = z.object({
  date: z.string().min(1, "נא לבחור תאריך ושעה"),
  maxPlayers: z.string().min(1, "נא להזין מספר שחקנים מקסימלי"),
  isClosed: z.string().optional(),
});

export type SessionFieldErrors = Partial<Record<"date" | "maxPlayers", string>>;

export type ParsedSession = {
  date: Date;
  maxPlayers: number;
  isClosed: boolean;
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

  return { ok: true, data: { date, maxPlayers, isClosed } };
}
