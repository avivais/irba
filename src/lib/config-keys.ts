// Client-safe: no Prisma, no Node.js imports. Used by both server (config.ts) and client components.

export const CONFIG = {
  // Sessions
  SESSION_SCHEDULE_DAY:              "session_schedule_day",              // 0=Sun … 6=Sat — used for both manual pre-fill and auto-create
  SESSION_SCHEDULE_TIME:             "session_schedule_time",             // "HH:MM" — used for both manual pre-fill and auto-create
  SESSION_DEFAULT_DURATION_MIN: "session_default_duration_min", // minutes
  RSVP_CLOSE_HOURS:             "rsvp_close_hours",             // hours before start
  // Schedule (auto-create)
  SESSION_SCHEDULE_ENABLED:          "session_schedule_enabled",          // "true" | "false"
  SESSION_AUTO_CREATE_HOURS_BEFORE:  "session_auto_create_hours_before",  // hours before session to open registration
  // Location
  LOCATION_NAME:                "location_name",
  LOCATION_LAT:                 "location_lat",
  LOCATION_LNG:                 "location_lng",
  // Charging
  SESSION_MIN_PLAYERS:          "session_min_players",          // minimum confirmed players required to charge a session
  DEBT_THRESHOLD:               "debt_threshold",               // ILS (positive; if balance ≤ -threshold → drop-in rate)
  // Low-attendance alerts
  ALERT_LOW_ATTENDANCE_ENABLED: "alert_low_attendance_enabled", // "true" | "false" master toggle
  ALERT_EARLY_ENABLED:          "alert_early_enabled",          // "true" | "false"
  ALERT_EARLY_HOURS_BEFORE:     "alert_early_hours_before",     // hours before session
  ALERT_EARLY_TEMPLATE:         "alert_early_template",
  ALERT_CRITICAL_ENABLED:       "alert_critical_enabled",       // "true" | "false"
  ALERT_CRITICAL_HOURS_BEFORE:  "alert_critical_hours_before",  // hours before session
  ALERT_CRITICAL_TEMPLATE:      "alert_critical_template",
  // Players
  DEFAULT_PLAYER_RANK:          "default_player_rank",          // used when rank is null
  // Matches
  MATCH_WIN_SCORE:              "match_win_score",              // points to win a match
  MATCH_DURATION_MIN:           "match_duration_min",           // per-match time limit (minutes)
  // Regulations
  REGULATIONS_VERSION:          "regulations_version",          // bump to force all players to re-accept
  REGULATIONS_TEXT:             "regulations_text",             // admin-editable template with {vars}, ##/###, **, - bullets
  FOULS_UNTIL_PENALTY:          "fouls_until_penalty",          // team fouls before opponents shoot free throws
  // Precedence fines
  FINE_NO_SHOW:                 "fine_no_show",                 // precedence points deducted for no-show after RSVP
  FINE_KICK_BALL:               "fine_kick_ball",               // precedence points deducted for kicking the ball
  FINE_EARLY_LEAVE:             "fine_early_leave",             // precedence points deducted for leaving early
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
  session_schedule_day:             "1",     // Monday
  session_schedule_time:            "21:00",
  session_default_duration_min: "120",
  rsvp_close_hours:             "13",
  session_schedule_enabled:             "false",
  session_auto_create_hours_before: "48",
  location_name:                "מגרש כדורסל בית ספר אילן רמון, נתניה",
  location_lat:                 "",
  location_lng:                 "",
  session_min_players:          "10",
  debt_threshold:               "10",
  alert_low_attendance_enabled: "false",
  alert_early_enabled:          "false",
  alert_early_hours_before:     "48",
  alert_early_template:         "⚠️ מפגש ב-{date}: רק {confirmed} מתוך {min_players} נרשמו (48 שעות לפני)",
  alert_critical_enabled:       "false",
  alert_critical_hours_before:  "2",
  alert_critical_template:      "🚨 מפגש ב-{date}: רק {confirmed} מתוך {min_players} נרשמו (שעתיים לפני)",
  default_player_rank:          "50",
  match_win_score:              "12",
  match_duration_min:           "7",
  regulations_version:          "1",
  regulations_text:             `## ידידות
אנחנו חברים — לא פרופסיונלים. המשחק נועד ליהנות ולהתחבר, לא להתחרות.

## הוגנות וספורטיביות
משחק נקי והוגן. כבד את השחקנים האחרים. ניצחון בכבוד, הפסד בכבוד.

## כיף
המטרה הסופית היא לצאת עם חיוך. אל תיקחו את זה יותר מדי ברצינות.

## כללי המשחק
משחק נגמר ב-**{match_win_score} נקודות** או ב-**{match_duration_min} דקות** — הראשון מביניהם.

### עבירות קבוצה
לאחר **{fouls_until_penalty} עבירות קבוצה**, היריב מקבל זריקות עונשין.

## סמכות מנהל המפגש
החלטות המנהל סופיות ואינן ניתנות לערעור. **אין ויכוחים עם המנהל.** במקרה של ספק שלא ניתן להכריע — יורים על זה.

## לוח זמנים ברירת מחדל
מפגשים מתקיימים ביום **{session_schedule_day_name}** בשעה **{session_schedule_time}**. ההרשמה נסגרת **{rsvp_close_hours} שעות** לפני תחילת המפגש. עדיפות ניתנת לשחקנים קבועים על פני מזדמנים. שינויים יפורסמו בקבוצת הוואטסאפ.

## כספים
עלות כל מפגש מחושבת לפי עלות המגרש חלקי מספר המשתתפים. תשלום מצופה לפני תחילת כל מפגש שנרשמת אליו. שחקן שחובו עולה על **₪{debt_threshold}** ייכנס כ"מזדמן" (בתעריף גבוה יותר) עד לסילוק החוב.

## הרשמה והגעה
הרשמה למפגש מחייבת הגעה. ביטול לאחר סגירת ההרשמה אפשרי רק בתיאום עם המנהל.

## קנסות עדיפות
הפרת כללי ההתנהגות גוררת קנסות בנקודות עדיפות:

- **אי-הגעה לאחר הרשמה** — {fine_no_show} נקודות
- **בעיטה בכדור** — {fine_kick_ball} נקודות
- **עזיבה מוקדמת ללא הודעה** — {fine_early_leave} נקודות

## אפס סובלנות לאלימות
**אין כל סובלנות לאלימות פיזית או מילולית**, גזענות, או התנהגות פוגענית. הפרה תגרור הרחקה מיידית מהקבוצה.

## הסכמה לקבלת הודעות וואטסאפ
בהצטרפות לקבוצה ובאישור תקנון זה, אתה מסכים לקבל הודעות וואטסאפ מ-IRBA בנושאי מפגשים, שינויים ועדכוני ארגון. לא ישלחו הודעות שיווקיות.`,
  fouls_until_penalty:          "5",
  fine_no_show:                 "3",
  fine_kick_ball:               "2",
  fine_early_leave:             "1",
  wa_group_jid:                          "",
  wa_notify_session_open_enabled:        "true",
  wa_notify_session_open_template:       "ההרשמה למפגש ב{date} פתוחה! כנסו ל-irba.sportgroup.cl להירשם",
  wa_notify_session_close_enabled:       "false",
  wa_notify_session_close_template:      "ההרשמה למפגש ב{date} נסגרה",
  wa_notify_player_registered_enabled:   "false",
  wa_notify_player_registered_template:  "{player_name} נרשם למפגש ב{date} ({status})",
  wa_notify_player_cancelled_enabled:    "false",
  wa_notify_player_cancelled_template:   "{player_name} ביטל הרשמה למפגש ב{date}",
  wa_notify_waitlist_promote_enabled:    "true",
  wa_notify_waitlist_promote_template:   "עברת מרשימת ההמתנה לרשימת המשתתפים במפגש ב{date}!",
};
