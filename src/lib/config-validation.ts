import { z } from "zod";
import { CONFIG_DEFAULTS, type ConfigKey } from "@/lib/config-keys";

const dayOfWeek = z
  .string()
  .regex(/^[0-6]$/, "יש לבחור יום בשבוע תקין");

const timeHHMM = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "פורמט שעה: HH:MM");

const scheduleTime = z
  .string()
  .regex(/^\d{2}:\d{2}$/, "פורמט שעה: HH:MM")
  .refine((v) => {
    const [hh, mm] = v.split(":").map(Number);
    return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
  }, "שעה לא תקינה");

const autoCreateHours = z
  .string()
  .regex(/^\d+$/, "חייב להיות מספר שלם")
  .refine((v) => {
    const n = parseInt(v, 10);
    return n >= 1 && n <= 168;
  }, "חייב להיות בין 1 ל-168");

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

const nonNegativeFloat = (label: string) =>
  z.string().refine(
    (v) => !isNaN(parseFloat(v)) && isFinite(Number(v)) && parseFloat(v) >= 0,
    `${label} חייב להיות מספר לא שלילי`
  );

const pctField = (label: string) =>
  z.string().regex(/^\d+$/, `${label} חייב להיות מספר שלם`)
   .refine((v) => { const n = parseInt(v, 10); return n >= 0 && n <= 100; }, `${label} חייב להיות בין 0 ל-100`);

const enabledFlag = z.enum(["true", "false"]);

const waTemplate = z
  .string()
  .min(1, "תבנית לא יכולה להיות ריקה")
  .max(500, "תבנית ארוכה מדי (מקסימום 500 תווים)");

const waGroupJid = z
  .string()
  .max(50)
  .refine(
    (v) => v === "" || /^[\d-]+@g\.us$/.test(v),
    'מזהה קבוצה לא תקין — פורמט: XXXXXXXXXX@g.us'
  );

export const configSchema = z.object({
  session_schedule_day:             dayOfWeek,
  session_schedule_time:            scheduleTime,
  session_default_duration_min:     positiveInt("משך המפגש"),
  rsvp_close_hours:                 nonNegativeInt("חלון הרשמה"),
  session_schedule_enabled:         z.enum(["true", "false"]),
  session_auto_create_hours_before: autoCreateHours,
  location_name:                z.string().max(200),
  location_lat:                 optionalFloat,
  location_lng:                 optionalFloat,
  session_min_players:          positiveInt("מינימום משתתפים"),
  debt_threshold:               nonNegativeInt("סף חוב"),
  alert_low_attendance_enabled: enabledFlag,
  alert_early_enabled:          enabledFlag,
  alert_early_hours_before:     positiveInt("שעות התראה מוקדמת"),
  alert_early_template:         waTemplate,
  alert_critical_enabled:       enabledFlag,
  alert_critical_hours_before:  positiveInt("שעות התראה קריטית"),
  alert_critical_template:      waTemplate,
  default_player_rank:          rankDefault,
  match_win_score:              positiveInt("ניקוד ניצחון"),
  match_duration_min:           positiveInt("משך משחק"),
  regulations_version:          positiveInt("גרסת תקנון"),
  regulations_text:             z.string().min(1, "טקסט התקנון לא יכול להיות ריק").max(10000, "טקסט התקנון ארוך מדי (מקסימום 10,000 תווים)"),
  fouls_until_penalty:          positiveInt("עבירות קבוצה עד עונשין"),
  round_size:                   positiveInt("גודל סבב"),
  rank_weight_admin:            nonNegativeFloat("משקל דירוג מנהל"),
  rank_weight_peer:             nonNegativeFloat("משקל דירוג שחקנים"),
  rank_weight_winloss:          nonNegativeFloat("משקל יחס ניצחונות"),
  rank_winloss_min_games_pct:   pctField("סף משחקים מינימלי"),
  fine_no_show:                 nonNegativeInt("קנס אי-הגעה"),
  fine_kick_ball:               nonNegativeInt("קנס בעיטה בכדור"),
  fine_early_leave:             nonNegativeInt("קנס עזיבה מוקדמת"),
  competition_session_count:             positiveInt("מספר מפגשים בתחרות"),
  competition_min_matches_pct:           z.string().regex(/^\d+$/, "חייב להיות מספר שלם").refine((v) => { const n = parseInt(v, 10); return n >= 0 && n <= 100; }, "חייב להיות בין 0 ל-100"),
  wa_notify_competition_winner_enabled:  enabledFlag,
  wa_notify_competition_winner_template: waTemplate,
  wa_group_jid:                          waGroupJid,
  wa_notify_session_open_enabled:        enabledFlag,
  wa_notify_session_open_template:       waTemplate,
  wa_notify_session_close_enabled:       enabledFlag,
  wa_notify_session_close_template:      waTemplate,
  wa_notify_player_registered_enabled:   enabledFlag,
  wa_notify_player_registered_template:  waTemplate,
  wa_notify_player_cancelled_enabled:    enabledFlag,
  wa_notify_player_cancelled_template:   waTemplate,
  wa_notify_waitlist_promote_enabled:    enabledFlag,
  wa_notify_waitlist_promote_template:   waTemplate,
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
