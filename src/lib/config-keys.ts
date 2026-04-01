// Client-safe: no Prisma, no Node.js imports. Used by both server (config.ts) and client components.

export const CONFIG = {
  // Sessions
  SESSION_DEFAULT_DAY:          "session_default_day",          // 0=Sun … 6=Sat
  SESSION_DEFAULT_TIME:         "session_default_time",          // "HH:MM"
  SESSION_DEFAULT_DURATION_MIN: "session_default_duration_min", // minutes
  RSVP_CLOSE_HOURS:             "rsvp_close_hours",             // hours before start
  // Schedule (auto-create)
  SESSION_SCHEDULE_ENABLED:          "session_schedule_enabled",          // "true" | "false"
  SESSION_SCHEDULE_DAY:              "session_schedule_day",              // 0=Sun … 6=Sat, Israel time
  SESSION_SCHEDULE_TIME:             "session_schedule_time",             // "HH:MM", Israel time
  SESSION_AUTO_CREATE_HOURS_BEFORE:  "session_auto_create_hours_before",  // hours before session to open registration
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
  // WhatsApp notifications
  WA_GROUP_JID:                          "wa_group_jid",                          // group JID for broadcasts, e.g. "XXXXXXXXXX@g.us"
  WA_NOTIFY_SESSION_OPEN_ENABLED:        "wa_notify_session_open_enabled",        // "true" | "false"
  WA_NOTIFY_SESSION_OPEN_TEMPLATE:       "wa_notify_session_open_template",
  WA_NOTIFY_SESSION_CLOSE_ENABLED:       "wa_notify_session_close_enabled",       // "true" | "false"
  WA_NOTIFY_SESSION_CLOSE_TEMPLATE:      "wa_notify_session_close_template",
  WA_NOTIFY_PLAYER_REGISTERED_ENABLED:   "wa_notify_player_registered_enabled",   // "true" | "false"
  WA_NOTIFY_PLAYER_REGISTERED_TEMPLATE:  "wa_notify_player_registered_template",
  WA_NOTIFY_PLAYER_CANCELLED_ENABLED:    "wa_notify_player_cancelled_enabled",    // "true" | "false"
  WA_NOTIFY_PLAYER_CANCELLED_TEMPLATE:   "wa_notify_player_cancelled_template",
  WA_NOTIFY_WAITLIST_PROMOTE_ENABLED:    "wa_notify_waitlist_promote_enabled",    // "true" | "false"
  WA_NOTIFY_WAITLIST_PROMOTE_TEMPLATE:   "wa_notify_waitlist_promote_template",
} as const;

export type ConfigKey = (typeof CONFIG)[keyof typeof CONFIG];

export const CONFIG_DEFAULTS: Record<ConfigKey, string> = {
  session_default_day:          "1",     // Monday
  session_default_time:         "21:00",
  session_default_duration_min: "120",
  rsvp_close_hours:             "13",
  session_schedule_enabled:             "false",
  session_schedule_day:             "1",     // Monday
  session_schedule_time:            "21:00",
  session_auto_create_hours_before: "48",
  location_name:                "מגרש כדורסל בית ספר אילן רמון, נתניה",
  location_lat:                 "",
  location_lng:                 "",
  dropin_charge:                "40",
  debt_threshold:               "10",
  default_player_rank:          "50",
  match_win_score:              "12",
  wa_group_jid:                          "",
  wa_notify_session_open_enabled:        "true",
  wa_notify_session_open_template:       "ההרשמה למפגש {date} פתוחה! כנסו ל-irba.sportgroup.cl להירשם",
  wa_notify_session_close_enabled:       "false",
  wa_notify_session_close_template:      "ההרשמה למפגש {date} נסגרה",
  wa_notify_player_registered_enabled:   "false",
  wa_notify_player_registered_template:  "{player_name} נרשם למפגש {date} ({status})",
  wa_notify_player_cancelled_enabled:    "false",
  wa_notify_player_cancelled_template:   "{player_name} ביטל הרשמה למפגש {date}",
  wa_notify_waitlist_promote_enabled:    "true",
  wa_notify_waitlist_promote_template:   "עברת מרשימת ההמתנה לרשימת המשתתפים במפגש {date}!",
};
