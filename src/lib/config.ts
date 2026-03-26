import { prisma } from "@/lib/prisma";

// ─── Keys ────────────────────────────────────────────────────────────────────

export const CONFIG = {
  // Sessions
  SESSION_DEFAULT_DAY:          "session_default_day",          // 0=Sun … 6=Sat
  SESSION_DEFAULT_TIME:         "session_default_time",          // "HH:MM"
  SESSION_DEFAULT_DURATION_MIN: "session_default_duration_min", // minutes
  RSVP_CLOSE_HOURS:             "rsvp_close_hours",             // hours before start
  // Location
  LOCATION_NAME:                "location_name",
  LOCATION_LAT:                 "location_lat",
  LOCATION_LNG:                 "location_lng",
  // Charging
  DROPIN_CHARGE:                "dropin_charge",                // ILS (flat fee)
  DEBT_THRESHOLD:               "debt_threshold",               // ILS (positive; if balance ≤ -threshold → drop-in rate)
  // Players
  DEFAULT_PLAYER_RANK:          "default_player_rank",          // used when rank is null
  // Matches
  MATCH_WIN_SCORE:              "match_win_score",              // points to win a match
} as const;

export type ConfigKey = (typeof CONFIG)[keyof typeof CONFIG];

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const CONFIG_DEFAULTS: Record<ConfigKey, string> = {
  session_default_day:          "1",     // Monday
  session_default_time:         "21:00",
  session_default_duration_min: "120",
  rsvp_close_hours:             "13",
  location_name:                "מגרש כדורסל בית ספר אילן רמון, נתניה",
  location_lat:                 "",
  location_lng:                 "",
  dropin_charge:                "40",
  debt_threshold:               "10",
  default_player_rank:          "50",
  match_win_score:              "12",
};

// ─── Low-level getters ────────────────────────────────────────────────────────

export async function getConfigValue(key: ConfigKey): Promise<string> {
  const row = await prisma.appConfig.findUnique({ where: { key } });
  return row?.value ?? CONFIG_DEFAULTS[key];
}

/** Fetch all config keys merged with defaults — one DB round-trip. */
export async function getAllConfigs(): Promise<Record<ConfigKey, string>> {
  const rows = await prisma.appConfig.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const result = {} as Record<ConfigKey, string>;
  for (const key of Object.values(CONFIG)) {
    result[key] = stored[key] ?? CONFIG_DEFAULTS[key];
  }
  return result;
}

// ─── Typed convenience getters ────────────────────────────────────────────────

export async function getConfigInt(key: ConfigKey): Promise<number> {
  return parseInt(await getConfigValue(key), 10);
}

export async function getConfigFloat(key: ConfigKey): Promise<number> {
  return parseFloat(await getConfigValue(key));
}

// ─── Setter ───────────────────────────────────────────────────────────────────

export async function setConfigs(entries: Partial<Record<ConfigKey, string>>): Promise<void> {
  await prisma.$transaction(
    Object.entries(entries).map(([key, value]) =>
      prisma.appConfig.upsert({
        where:  { key },
        update: { value: value! },
        create: { key, value: value! },
      })
    )
  );
}

// ─── Map link helpers (no API key needed) ─────────────────────────────────────

export function googleMapsUrl(lat: string, lng: string): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function wazeUrl(lat: string, lng: string): string {
  return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
}
