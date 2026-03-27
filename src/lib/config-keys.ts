// Client-safe: no Prisma, no Node.js imports. Used by both server (config.ts) and client components.

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
