import { z } from "zod";
import { CONFIG_DEFAULTS, type ConfigKey } from "@/lib/config-keys";

const dayOfWeek = z
  .string()
  .regex(/^[0-6]$/, "יש לבחור יום בשבוע תקין");

const timeHHMM = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "פורמט שעה: HH:MM");

const positiveInt = (label: string) =>
  z.string().regex(/^\d+$/, `${label} חייב להיות מספר חיובי`).refine(
    (v) => parseInt(v, 10) > 0,
    `${label} חייב להיות גדול מ-0`
  );

const nonNegativeInt = (label: string) =>
  z.string().regex(/^\d+$/, `${label} חייב להיות מספר לא שלילי`);

const optionalFloat = z
  .string()
  .refine(
    (v) => v === "" || (!isNaN(parseFloat(v)) && isFinite(Number(v))),
    "ערך לא תקין"
  );

const rankDefault = z
  .string()
  .regex(/^\d+$/, "דירוג חייב להיות מספר שלם")
  .refine((v) => {
    const n = parseInt(v, 10);
    return n >= 1 && n <= 100;
  }, "דירוג חייב להיות בין 1 ל-100");

export const configSchema = z.object({
  session_default_day:          dayOfWeek,
  session_default_time:         timeHHMM,
  session_default_duration_min: positiveInt("משך המפגש"),
  rsvp_close_hours:             nonNegativeInt("חלון הרשמה"),
  location_name:                z.string().max(200),
  location_lat:                 optionalFloat,
  location_lng:                 optionalFloat,
  dropin_charge:                positiveInt("מחיר מזדמן"),
  debt_threshold:               nonNegativeInt("סף חוב"),
  default_player_rank:          rankDefault,
  match_win_score:              positiveInt("ניקוד ניצחון"),
});

export type ConfigFormData = z.infer<typeof configSchema>;

export function parseConfigForm(
  raw: Record<string, string>
): { ok: true; data: Record<ConfigKey, string> } | { ok: false; errors: Partial<Record<ConfigKey, string>> } {
  const result = configSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, data: result.data as Record<ConfigKey, string> };
  }
  const errors: Partial<Record<ConfigKey, string>> = {};
  for (const [key, issues] of Object.entries(result.error.flatten().fieldErrors)) {
    errors[key as ConfigKey] = (issues as string[])[0];
  }
  return { ok: false, errors };
}

export { CONFIG_DEFAULTS };
