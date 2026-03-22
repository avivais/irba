import { z } from "zod";

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

  // Parse date
  const date = new Date(parsed.data.date);
  if (isNaN(date.getTime())) {
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
