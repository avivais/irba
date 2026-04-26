export type StepLink = { label: string; href: string };

export type StepDef = {
  id: string;          // e.g. "0.1", "1.1", "9.3"
  group: string;       // e.g. "0 — Snapshot"
  title: string;
  instructions: string[];
  links?: StepLink[];
  verifyFnName: string; // matches a key in VERIFICATIONS in verify-actions.ts
  note?: string;       // optional extra note shown below instructions
  /** Phone to pre-fill in the OTP lookup widget. "custom" = free input. Omit = no OTP button. */
  otpPhone?: string | "custom";
};

export const STEP_GROUPS: { label: string; groupKey: string }[] = [
  { label: "קבוצה 0 — Snapshot", groupKey: "0" },
  { label: "קבוצה 1 — הגדרות בסיס", groupKey: "1" },
  { label: "קבוצה 2 — ניהול שחקנים", groupKey: "2" },
  { label: "קבוצה 3 — הגדרת תחרות", groupKey: "3" },
  { label: "קבוצה 4 — מחזור מפגש", groupKey: "4" },
  { label: "קבוצה 5 — הרשמה ציבורית", groupKey: "5" },
  { label: "קבוצה 6 — רישום משחקים", groupKey: "6" },
  { label: "קבוצה 7 — טבלה אחרי מפגש 1", groupKey: "7" },
  { label: "קבוצה 8 — מפגש 2 מתוך 3", groupKey: "8" },
  { label: "קבוצה 9 — מפגש 3 — סיום תחרות", groupKey: "9" },
  { label: "קבוצה 10 — צריכת כניסה חינם", groupKey: "10" },
  { label: "קבוצה 11 — עקיפת חיוב וביקורת", groupKey: "11" },
  { label: "קבוצה 12 — חישוב מחדש מדורג", groupKey: "12" },
  { label: "קבוצה 13 — כספים ותשלומים", groupKey: "13" },
  { label: "קבוצה 14 — פרופיל שחקן", groupKey: "14" },
  { label: "קבוצה 15 — דירוגים ועמיתים", groupKey: "15" },
  { label: "קבוצה 16 — תקנון", groupKey: "16" },
  { label: "קבוצה 17 — השפעת שינויי הגדרות", groupKey: "17" },
  { label: "קבוצה 18 — התראות WhatsApp", groupKey: "18" },
  { label: "קבוצה 19 — נקודות קצה Cron", groupKey: "19" },
  { label: "קבוצה 20 — ניקוי ושחזור", groupKey: "20" },
];

export const STEPS: StepDef[] = [
  // ── Group 0 ────────────────────────────────────────────────────────────────
  {
    id: "0.1",
    group: "0",
    title: "שמור Snapshot לפני הבדיקה",
    instructions: [
      'בחלק ניהול ה-Snapshot למעלה, הכנס תווית "pre-test"',
      'לחץ "שמור Snapshot"',
      "וודא שהקובץ מופיע ברשימה",
    ],
    verifyFnName: "verifySnapshotExists",
    note: "זהו הצעד הראשון והחשוב ביותר — ניתן לשחזר מצב זה בכל עת",
  },

  // ── Group 1 ────────────────────────────────────────────────────────────────
  {
    id: "1.1",
    group: "1",
    title: "וודא הגדרות ברירת מחדל",
    instructions: ["אין צורך בפעולה — בודק שהטבלת AppConfig מאוכלסת"],
    verifyFnName: "verifyConfigDefaults",
  },
  {
    id: "1.2",
    group: "1",
    title: "וודא שתעריף שעתי קיים",
    instructions: ["אם הבדיקה נכשלת, עבור להגדרות והוסף תעריף שעתי"],
    links: [{ label: "הגדרות", href: "/admin/config" }],
    verifyFnName: "verifyHourlyRate",
  },
  {
    id: "1.3",
    group: "1",
    title: "קבע הגדרות תחרות לבדיקה",
    instructions: [
      "עבור להגדרות",
      'קבע competition_session_count = 3',
      'קבע competition_min_matches_pct = 50',
      "שמור",
    ],
    links: [{ label: "הגדרות", href: "/admin/config" }],
    verifyFnName: "verifyCompetitionConfig",
  },

  // ── Group 2 ────────────────────────────────────────────────────────────────
  {
    id: "2.1",
    group: "2",
    title: "צור שחקן קבוע א",
    instructions: [
      "עבור לדף יצירת שחקן",
      "טלפון: 0500000001",
      "שם: שחקן א",
      "סוג: קבוע",
      "שמור",
    ],
    links: [{ label: "שחקן חדש", href: "/admin/players/new" }],
    verifyFnName: "verifyPlayerA",
  },
  {
    id: "2.2",
    group: "2",
    title: "צור שחקן קבוע ב",
    instructions: [
      "טלפון: 0500000002",
      "שם: שחקן ב",
      "סוג: קבוע",
      "שמור",
    ],
    links: [{ label: "שחקן חדש", href: "/admin/players/new" }],
    verifyFnName: "verifyPlayerB",
  },
  {
    id: "2.3",
    group: "2",
    title: "צור שחקן קבוע ג",
    instructions: [
      "טלפון: 0500000003",
      "שם: שחקן ג",
      "סוג: קבוע",
      "שמור",
    ],
    links: [{ label: "שחקן חדש", href: "/admin/players/new" }],
    verifyFnName: "verifyPlayerC",
  },
  {
    id: "2.4",
    group: "2",
    title: "צור שחקנים אוטומטית (ד–כ)",
    instructions: [
      "לחץ 'בדוק' — שחקנים 4 עד 11 ייווצרו אוטומטית",
      "מזדמן ד (0500000004) ייווצר כ-DROP_IN לצורך בדיקת רשימת המתנה",
      "שחקנים ה–כ (0500000005–0500000011) ייווצרו כ-REGISTERED",
      "אם שחקן כבר קיים — הפעולה תדלג עליו",
    ],
    verifyFnName: "autoCreateTestPlayers",
    note: "שחקנים א–ג נוצרו ידנית בשלבים 2.1–2.3 — שלב זה משלים את 8 הנותרים",
  },
  {
    id: "2.5",
    group: "2",
    title: "ערוך כינוי לשחקן א",
    instructions: [
      "עבור לעריכת שחקן א",
      'קבע כינוי: "אלפא"',
      "שמור",
    ],
    verifyFnName: "verifyPlayerANickname",
    note: "הקישור יופיע לאחר יצירת שחקן א",
  },
  {
    id: "2.6",
    group: "2",
    title: "וודא יתרות אפס לכל השחקנים",
    instructions: ["אין פעולה נדרשת — בודק שלאף שחקן בדיקה אין חיובים או תשלומים"],
    verifyFnName: "verifyZeroBalances",
  },

  // ── Group 3 ────────────────────────────────────────────────────────────────
  {
    id: "3.1",
    group: "3",
    title: "צור תחרות",
    instructions: [
      "עבור ליצירת תחרות חדשה",
      "תאריך התחלה: היום",
      "מספר מפגשים: 3",
      "אחוז משחקים מינימלי: 50",
      "שמור",
    ],
    links: [{ label: "תחרות חדשה", href: "/admin/challenges/new" }],
    verifyFnName: "verifyChallengeActive",
    note: "התחרות חייבת להיות קיימת לפני יצירת מפגשים כדי שהמפגשים יזקפו אליה",
  },
  {
    id: "3.2",
    group: "3",
    title: "נסה ליצור תחרות שנייה → שגיאה",
    instructions: [
      "עבור ליצירת תחרות שנייה",
      "מלא את הפרטים ושלח",
      "צפה בהודעת שגיאה",
    ],
    links: [{ label: "תחרות חדשה", href: "/admin/challenges/new" }],
    verifyFnName: "verifyOnlyOneActiveChallenge",
  },
  {
    id: "3.3",
    group: "3",
    title: "דף ציבורי מציג תחרות פעילה",
    instructions: [
      'עבור לדף התחרויות',
      'וודא תג "פעיל" מוצג על כרטיס התחרות',
    ],
    links: [{ label: "תחרויות", href: "/challenges" }],
    verifyFnName: "verifyChallengeActivePublic",
  },

  // ── Group 4 ────────────────────────────────────────────────────────────────
  {
    id: "4.1",
    group: "4",
    title: "צור מפגש 1 (חלון תחרות)",
    instructions: [
      "עבור ליצירת מפגש",
      "תאריך: היום",
      "מקסימום שחקנים: 10",
      "משך: 90 דקות",
      "שמור",
    ],
    links: [{ label: "מפגש חדש", href: "/admin/sessions/new" }],
    verifyFnName: "verifySession1Created",
  },
  {
    id: "4.2",
    group: "4",
    title: "הוסף שחקן א למפגש 1",
    instructions: [
      "עבור לדף המפגש",
      'השתמש בתפריט "הוסף שחקן"',
      "בחר שחקן א",
    ],
    verifyFnName: "verifySession1PlayerA",
  },
  {
    id: "4.3",
    group: "4",
    title: "מלא מפגש 1 עד קיבולת (ב, ג, ד, ה, ו, ז, ח, ט, י)",
    instructions: [
      "הוסף שחקנים ב, ג, ד, ה, ו, ז, ח, ט, י אחד-אחד",
      "לאחר הוספת כל 9 השחקנים המפגש אמור להיות מלא (10/10)",
    ],
    verifyFnName: "verifySession1Capacity",
  },
  {
    id: "4.4",
    group: "4",
    title: "הוסף שחקן כ (רשימת המתנה)",
    instructions: [
      "הוסף שחקן כ (0500000011) — אמור לעבור לרשימת המתנה כי המפגש מלא",
    ],
    verifyFnName: "verifySession1Waitlist",
  },
  {
    id: "4.5",
    group: "4",
    title: "בטל השתתפות שחקן ב",
    instructions: [
      "מחק את רישום שחקן ב — שחקן כ עדיין ברשימת המתנה",
    ],
    verifyFnName: "verifySession1PlayerBRemoved",
  },
  {
    id: "4.6",
    group: "4",
    title: "קדם שחקן כ מרשימת המתנה",
    instructions: [
      'לחץ "קדם" ליד שחקן כ',
    ],
    verifyFnName: "verifySession1KPromoted",
  },
  {
    id: "4.7",
    group: "4",
    title: "וודא רשימה מאושרת: א, ג–כ (10 שחקנים, ב הוסר)",
    instructions: ["אין פעולה — בודק שב הוסר וכ קודם, 10 שחקנים מאושרים"],
    verifyFnName: "verifySession1ConfirmedList",
  },

  // ── Group 5 ────────────────────────────────────────────────────────────────
  {
    id: "5.1",
    group: "5",
    title: "הרשמה ציבורית — שחקן א (כבר נרשם)",
    instructions: [
      "פתח חלון גלישה פרטית (Incognito)",
      "עבור לדף הבית",
      "הכנס 0500000001, לחץ 'שלח קוד' — אז לחץ 'שלח OTP ל-WA שלי' כאן לקבל את הקוד",
      'הכנס את הקוד בדפדפן הפרטי ווודא הודעת "כבר נרשמת" מוצגת',
    ],
    links: [{ label: "דף הבית", href: "/" }],
    verifyFnName: "verifyNoduplicateAttendanceA",
    otpPhone: "0500000001",
    note: "צעד ידני — הבדיקה מוודאת שלא נוצר רשומת נוכחות כפולה",
  },
  {
    id: "5.2",
    group: "5",
    title: "הרשמה עם טלפון חדש (DROP_IN אוטומטי)",
    instructions: [
      "עבור לדף הבית בחלון פרטי, הכנס טלפון שאינו קיים במערכת (לדוגמה 0509999991)",
      "לחץ 'שלח קוד' — המערכת תיצור שחקן DROP_IN ותשמור את הקוד ב-DB",
      "לחץ 'שלח OTP ל-WA שלי' כאן, הכנס את אותו טלפון — קוד יגיע ב-WA",
      "הכנס קוד בדפדפן, קבע שם → הירשם",
    ],
    verifyFnName: "verifyNewDropInRsvp",
    otpPhone: "custom",
    note: "שחקן DROP_IN ייצור ורישום נוכחות יווצר (רשימת המתנה כי המפגש מלא)",
  },
  {
    id: "5.3",
    group: "5",
    title: "ביטול בתוך חלון סגירה",
    instructions: [
      'עבור להגדרות, קבע rsvp_close_hours = 0',
      "כשחקן א (0500000001), היכנס בחלון פרטי ונסה לבטל — צריך להצליח",
      'קבע rsvp_close_hours = 999',
      "נסה שוב — צריך להיחסם",
    ],
    links: [{ label: "הגדרות", href: "/admin/config" }],
    verifyFnName: "verifyCancellationWindow",
    otpPhone: "0500000001",
    note: "צעד ידני — בודק רק שהגדרת rsvp_close_hours קיימת ב-DB",
  },
  {
    id: "5.4",
    group: "5",
    title: "שחזר רשימה מאושרת למפגש 1",
    instructions: [
      "אם שחקן א בוטל — הוסף מחדש",
      "הסר את רישום 0509999991",
      "וודא: א, ג, ד מאושרים",
    ],
    verifyFnName: "verifySession1ConfirmedListAfterRsvp",
  },

  // ── Group 6 ────────────────────────────────────────────────────────────────
  {
    id: "6.1",
    group: "6",
    title: "רשום משחק 1 (5 נגד 5) — א מנצח",
    instructions: [
      "עבור למפגש 1 → לוח משחקים",
      "קבוצה א = [א, ג, ה, ו, ז]",
      "קבוצה ב = [ד, ח, ט, י, כ]",
      "תוצאה א=12, ב=8",
      "שמור",
    ],
    verifyFnName: "verifyMatch1",
    note: "ב לא משחק בשום משחק במפגש 1 — יישאר לא-זכאי לצורך בדיקת שלב 7.4",
  },
  {
    id: "6.2",
    group: "6",
    title: "רשום משחק 2 (5 נגד 5) — א מנצח",
    instructions: [
      "קבוצה א = [א, ד, ח, ט, י]",
      "קבוצה ב = [ג, ה, ו, ז, כ]",
      "תוצאה א=12, ב=8",
    ],
    verifyFnName: "verifyMatch2",
  },
  {
    id: "6.3",
    group: "6",
    title: "רשום משחק 3 (5 נגד 5) — א מפסיד",
    instructions: [
      "קבוצה א = [ד, ח, ט, י, כ]",
      "קבוצה ב = [א, ג, ה, ו, ז]",
      "תוצאה א=12, ב=8",
    ],
    verifyFnName: "verifyMatch3",
  },
  {
    id: "6.4",
    group: "6",
    title: "רשום משחק 4 (5 נגד 5) — א מנצח",
    instructions: [
      "קבוצה א = [א, ה, ז, ט, כ]",
      "קבוצה ב = [ג, ד, ו, ח, י]",
      "תוצאה א=12, ב=8",
    ],
    verifyFnName: "verifyMatch4",
    note: "תוצאות: א — 3נ 1ה (75%), ג — 1נ 3ה (25%), ד (מזדמן) — אינו בדירוג, ב — 0 משחקים → לא-זכאי",
  },

  // ── Group 7 ────────────────────────────────────────────────────────────────
  {
    id: "7.1",
    group: "7",
    title: "חייב מפגש 1",
    instructions: [
      "עבור למפגש 1",
      'לחץ "גבה תשלום"',
      "אשר",
    ],
    verifyFnName: "verifySession1Charged",
  },
  {
    id: "7.2",
    group: "7",
    title: "וודא מזדמן ד מוחרג מהטבלה",
    instructions: [
      "עבור לדף התחרויות",
      "פתח את הטבלה",
      'וודא שמזדמן ד לא מופיע',
    ],
    links: [{ label: "תחרויות", href: "/challenges" }],
    verifyFnName: "verifyDropInExcluded",
  },
  {
    id: "7.3",
    group: "7",
    title: "וודא דירוג שחקנים זכאים",
    instructions: [
      "שחקן א צריך להיות ראשון עם 75%",
      "שחקן ג צריך להיות שני עם 25%",
    ],
    verifyFnName: "verifyEligibleLeaderboard",
  },
  {
    id: "7.4",
    group: "7",
    title: "וודא שחקן ב בסעיף לא זכאים",
    instructions: [
      'וודא שחקן ב מופיע ב"לא עומדים בסף עדיין"',
      "חסרים לו 2 משחקים",
    ],
    verifyFnName: "verifyBIneligible",
  },

  // ── Group 8 ────────────────────────────────────────────────────────────────
  {
    id: "8.1",
    group: "8",
    title: "צור מפגש 2",
    instructions: [
      "עבור ליצירת מפגש",
      "תאריך: מחר",
      "מקסימום שחקנים: 10",
      "משך: 90 דקות",
      "שמור",
    ],
    links: [{ label: "מפגש חדש", href: "/admin/sessions/new" }],
    verifyFnName: "verifySession2Created",
  },
  {
    id: "8.2",
    group: "8",
    title: "הוסף 10 שחקנים (כולל ב) ורשום 4 משחקי 5 נגד 5",
    instructions: [
      "הוסף: א, ב, ג, ה, ו, ז, ח, ט, י, כ (10 שחקנים — ב חייב לשחק בכולם)",
      "משחק 1: [א, ב, ג, ה, ו] נגד [ז, ח, ט, י, כ] — תוצאה 12:8",
      "משחק 2: [ב, ז, ח, ט, י] נגד [א, ג, ה, ו, כ] — תוצאה 12:8",
      "משחק 3: [א, ב, ה, ז, ט] נגד [ג, ו, ח, י, כ] — תוצאה 12:8",
      "משחק 4: [ב, ג, ו, ח, כ] נגד [א, ה, ז, ט, י] — תוצאה 12:8",
    ],
    verifyFnName: "verifySession2PlayerBMatches",
    note: "אחרי מפגש 2: ב צבר 4 משחקים (threshold=4) → יהפוך לזכאי",
  },
  {
    id: "8.3",
    group: "8",
    title: "חייב מפגש 2",
    instructions: ["עבור למפגש 2 → חייב"],
    verifyFnName: "verifySession2Charged",
  },
  {
    id: "8.4",
    group: "8",
    title: "שחקן ב זכאי עכשיו בטבלה",
    instructions: [
      "עבור לתחרויות",
      'ב אמור להיות בסעיף "דירוג" ולא "לא זכאים"',
    ],
    links: [{ label: "תחרויות", href: "/challenges" }],
    verifyFnName: "verifyBEligibleAfterSession2",
  },

  // ── Group 9 ────────────────────────────────────────────────────────────────
  {
    id: "9.1",
    group: "9",
    title: "צור מפגש 3",
    instructions: [
      "תאריך: מחרתיים",
      "מקסימום שחקנים: 10",
      "משך: 90 דקות",
    ],
    links: [{ label: "מפגש חדש", href: "/admin/sessions/new" }],
    verifyFnName: "verifySession3Created",
  },
  {
    id: "9.2",
    group: "9",
    title: "הוסף 10 שחקנים ורשום 2 ניצחונות לא",
    instructions: [
      "הוסף: א, ב, ג, ה, ו, ז, ח, ט, י, כ",
      "משחק 1: [א, ג, ה, ו, ז] נגד [ב, ח, ט, י, כ] — תוצאה 12:8 (א מנצח)",
      "משחק 2: [א, ב, ח, ט, י] נגד [ג, ה, ו, ז, כ] — תוצאה 12:8 (א מנצח)",
    ],
    verifyFnName: "verifySession3Matches",
  },
  {
    id: "9.3",
    group: "9",
    title: "חייב מפגש 3 → תחרות נסגרת",
    instructions: [
      "עבור למפגש 3",
      "לחץ חיוב",
      "אמור להופיע באנר זוכה",
    ],
    verifyFnName: "verifyCompetitionClosed",
    note: "צפה: isClosed=true, winnerId=B, FreeEntry נוצר לשחקן ב (ב — 83%, א — 70%)",
  },
  {
    id: "9.4",
    group: "9",
    title: "וודא הודעת WA נשלחה (ידני)",
    instructions: [
      "בדוק קבוצת WA להודעת זוכה תחרות",
    ],
    verifyFnName: "verifyWaWinnerNotification",
    note: "צעד ידני — אין בדיקת DB אוטומטית",
  },
  {
    id: "9.5",
    group: "9",
    title: "דף ציבורי מציג תחרות סגורה",
    instructions: [
      "עבור לתחרויות",
      'וודא תג "סגור" ושם הזוכה מוצג',
    ],
    links: [{ label: "תחרויות", href: "/challenges" }],
    verifyFnName: "verifyChallengeClosed",
  },
  {
    id: "9.6",
    group: "9",
    title: "ניתן ליצור תחרות חדשה",
    instructions: ["כיוון שהתחרות סגורה, יצירת תחרות חדשה אמורה להצליח"],
    verifyFnName: "verifyCanCreateNewChallenge",
  },

  // ── Group 10 ───────────────────────────────────────────────────────────────
  {
    id: "10.1",
    group: "10",
    title: "צור מפגש 4 (לאחר תחרות)",
    instructions: [
      "תאריך: +3 ימים",
      "מקסימום: 10, משך: 90 דקות",
    ],
    links: [{ label: "מפגש חדש", href: "/admin/sessions/new" }],
    verifyFnName: "verifySession4Created",
  },
  {
    id: "10.2",
    group: "10",
    title: "הוסף שחקן ב (זוכה) למפגש 4",
    instructions: ["הוסף שחקן ב"],
    verifyFnName: "verifySession4PlayerB",
  },
  {
    id: "10.3",
    group: "10",
    title: "הוסף 9 שחקנים נוספים למפגש 4",
    instructions: ["הוסף א, ג, ה, ו, ז, ח, ט, י, כ (9 שחקנים נוספים = 10 סה\"כ)"],
    verifyFnName: "verifySession4ThreePlayers",
  },
  {
    id: "10.4",
    group: "10",
    title: "חייב מפגש 4 — ב מוצג ₪0 FREE_ENTRY",
    instructions: [
      'לחץ "חייב מפגש"',
      "בלוח החיובים — שחקן ב אמור להופיע ב-₪0 עם תג FREE_ENTRY",
    ],
    verifyFnName: "verifyFreeEntryProposal",
    note: "אין שלב תצוגה מקדימה נפרד — החיוב מוחל מיד עם הלחיצה",
  },
  {
    id: "10.5",
    group: "10",
    title: "וודא FreeEntry נצרך ב-DB",
    instructions: ["אין פעולה — בודק את הסטטוס ב-DB אחרי החיוב"],
    verifyFnName: "verifyFreeEntryConsumed",
    note: "צפה: SessionCharge.amount=0 לשחקן ב, FreeEntry.usedAt מאוכלס",
  },

  // ── Group 11 ───────────────────────────────────────────────────────────────
  {
    id: "11.1",
    group: "11",
    title: "עקוף חיוב שחקן א במפגש 4",
    instructions: [
      "עבור למפגש 4",
      "לחץ עריכה על חיוב שחקן א",
      "שנה סכום ב-+10",
      'הוסף סיבה "בדיקה"',
      "שמור",
    ],
    verifyFnName: "verifyChargeAudit",
    note: "ב נמצא בכניסה חינם (₪0) — נבחן עקיפה על חיוב רגיל של א",
  },
  {
    id: "11.2",
    group: "11",
    title: "וודא רשומת יומן ביקורת",
    instructions: ["אין פעולה — בודק רשומת AuditLog"],
    verifyFnName: "verifyChargeAuditLog",
  },

  // ── Group 12 ───────────────────────────────────────────────────────────────
  {
    id: "12.1",
    group: "12",
    title: "הוסף תשלום שלילי לשחקן ב (חוב)",
    instructions: [
      "עבור לפרופיל שחקן ב",
      "הוסף תשלום של -500 שח",
    ],
    verifyFnName: "verifyPlayerBDebt",
  },
  {
    id: "12.2",
    group: "12",
    title: "צור מפגש 5 עם 10 שחקנים, חייב",
    instructions: [
      "צור מפגש 5 (מקסימום 10, 90 דקות)",
      "הוסף: א, ב, ג, ה, ו, ז, ח, ט, י, כ",
      "חייב — ב אמור לקבל תעריף מזדמן (עקב חוב)",
    ],
    links: [{ label: "מפגש חדש", href: "/admin/sessions/new" }],
    verifyFnName: "verifyDebtChargeType",
    note: "לאחר 4 מפגשים ללא תשלומים, סביר שכל השחקנים נכנסו לחוב מצטבר ויסומנו DROP_IN — הבדיקה האוטומטית מאמתת רק את ב",
  },
  {
    id: "12.3",
    group: "12",
    title: "בטל חיוב מפגש 4 ורחייב",
    instructions: [
      "עבור למפגש 4",
      "בטל חיוב",
      "חייב מחדש",
    ],
    verifyFnName: "verifySession4Recharged",
    note: "FreeEntry אמור לא להיצרך פעם שנייה",
  },

  // ── Group 13 ───────────────────────────────────────────────────────────────
  {
    id: "13.1",
    group: "13",
    title: "הוסף תשלום חיובי לשחקן ג",
    instructions: [
      "עבור לפרופיל שחקן ג",
      "הוסף תשלום 200 שח, שיטה: BIT",
    ],
    verifyFnName: "verifyPaymentC",
  },
  {
    id: "13.2",
    group: "13",
    title: "וודא יתרות בדף הכספים",
    instructions: [
      "עבור לכספים",
      "וודא יתרות א, ב, ג תואמות חיובים ותשלומים",
    ],
    links: [{ label: "כספים", href: "/admin/finance" }],
    verifyFnName: "verifyFinanceBalances",
  },

  // ── Group 14 ───────────────────────────────────────────────────────────────
  {
    id: "14.1",
    group: "14",
    title: "צפה בפרופיל כשחקן א",
    instructions: [
      "היכנס כשחקן א (0500000001)",
      "עבור לפרופיל",
      'וודא שסיכום תחרות מציג "סיבוב N"',
    ],
    links: [{ label: "פרופיל", href: "/profile" }],
    verifyFnName: "verifyProfileChallengeRecord",
    otpPhone: "0500000001",
    note: "צעד ידני ברובו",
  },
  {
    id: "14.2",
    group: "14",
    title: "וודא סטטיסטיקות לפי מפגש",
    instructions: [
      'עבור ללשונית "לפי מפגש"',
      "וודא מפגשים 1, 2, 3 מופיעים עם ספירות משחק נכונות",
    ],
    verifyFnName: "verifyProfileSessionStats",
    note: "צעד ידני ברובו — בודק כי מפגשי הבדיקה קיימים ב-DB",
  },
  {
    id: "14.3",
    group: "14",
    title: "וודא שותפים מובילים",
    instructions: [
      "בדוק שסעיף השותפים מציג שחקן ג (משחקו ביחד)",
    ],
    verifyFnName: "verifyTopTeammates",
    note: "צעד ידני — בודק רק שמשחקים קיימים",
  },

  // ── Group 15 ───────────────────────────────────────────────────────────────
  {
    id: "15.1",
    group: "15",
    title: "פתח סיבוב דירוג",
    instructions: [
      "עבור לדירוג",
      'לחץ "פתח סיבוב דירוג"',
      "קבע שנה",
    ],
    links: [{ label: "דירוג", href: "/admin/ranking" }],
    verifyFnName: "verifyPeerRatingOpen",
  },
  {
    id: "15.2",
    group: "15",
    title: "שלח דירוגים כשחקן א",
    instructions: [
      "היכנס כשחקן א",
      "עבור לדף שליחת דירוג",
      "דרג שחקנים",
    ],
    links: [{ label: "שליחת דירוג", href: "/ranking/submit" }],
    verifyFnName: "verifyPeerRatingsSubmitted",
    otpPhone: "0500000001",
  },
  {
    id: "15.3",
    group: "15",
    title: "סגור סיבוב דירוג",
    instructions: [
      "עבור לדירוג (אדמין)",
      'לחץ "סגור סיבוב"',
    ],
    links: [{ label: "דירוג", href: "/admin/ranking" }],
    verifyFnName: "verifyPeerRatingClosed",
  },
  {
    id: "15.4",
    group: "15",
    title: "הוסף התאמת קדימות לשחקן א",
    instructions: [
      "עבור לדף התאמות קדימות",
      "הוסף +5 נקודות, סיבה: בדיקה",
    ],
    verifyFnName: "verifyPrecedenceAdjustment",
  },

  // ── Group 16 ───────────────────────────────────────────────────────────────
  {
    id: "16.1",
    group: "16",
    title: "העלה גרסת תקנון",
    instructions: [
      "עבור להגדרות",
      "הגדל regulations_version ב-1",
      "שמור",
    ],
    links: [{ label: "הגדרות", href: "/admin/config" }],
    verifyFnName: "verifyRegulationsVersionBumped",
  },
  {
    id: "16.2",
    group: "16",
    title: "שחקן א רואה מסך תקנון",
    instructions: [
      "היכנס כשחקן א",
      "עבור לדף הבית — אמור להופיע מסך תקנון",
    ],
    links: [{ label: "דף הבית", href: "/" }],
    verifyFnName: "verifyRegulationsPrompted",
    otpPhone: "0500000001",
    note: "צעד ידני — בודק שגרסה מקובלת של שחקן א מפגרת",
  },
  {
    id: "16.3",
    group: "16",
    title: "אשר תקנון",
    instructions: ["אשר במסך התקנון"],
    verifyFnName: "verifyRegulationsAccepted",
  },

  // ── Group 17 ───────────────────────────────────────────────────────────────
  {
    id: "17.1",
    group: "17",
    title: "שנה הגדרת session_count",
    instructions: [
      "קבע competition_session_count = 4 בהגדרות",
    ],
    links: [{ label: "הגדרות", href: "/admin/config" }],
    verifyFnName: "verifySessionCountConfig4",
  },
  {
    id: "17.2",
    group: "17",
    title: "שחזר הגדרה לערך בדיקה",
    instructions: [
      "קבע competition_session_count = 3 בהגדרות",
    ],
    links: [{ label: "הגדרות", href: "/admin/config" }],
    verifyFnName: "verifySessionCountConfig3",
  },

  // ── Group 18 ───────────────────────────────────────────────────────────────
  {
    id: "18.1",
    group: "18",
    title: "השבת התראות WA",
    instructions: [
      "קבע wa_notify_session_open_enabled = false בהגדרות",
    ],
    links: [{ label: "הגדרות", href: "/admin/config" }],
    verifyFnName: "verifyWaDisabled",
  },
  {
    id: "18.2",
    group: "18",
    title: "פתח מפגש → לא נשלח WA",
    instructions: [
      "צור מפגש חדש",
      "וודא שלא התקבלה הודעת WA",
    ],
    verifyFnName: "verifyNoWaFired",
    note: "צעד ידני — בודק רק שההגדרה מושבתת",
  },
  {
    id: "18.3",
    group: "18",
    title: "הפעל מחדש ובדוק תבנית",
    instructions: [
      "הפעל wa_notify_session_open_enabled = true",
      "הוסף {date} לתבנית הודעה",
      "צור מפגש חדש → וודא הודעת WA עם תאריך",
    ],
    verifyFnName: "verifyWaTemplateConfig",
    note: "צעד ידני ברובו",
  },

  // ── Group 19 ───────────────────────────────────────────────────────────────
  {
    id: "19.1",
    group: "19",
    title: "Cron סגירה אוטומטית",
    instructions: [
      "וודא שיש מפגש עם תאריך עבר ו-isClosed=false",
      "קרא ל-/api/cron/auto-close",
    ],
    links: [{ label: "Cron סגירה", href: "/api/cron/auto-close" }],
    verifyFnName: "verifyCronAutoClose",
  },
  {
    id: "19.2",
    group: "19",
    title: "Cron יצירה אוטומטית",
    instructions: [
      "הפעל auto_create_enabled = true בהגדרות",
      "קרא ל-/api/cron/auto-create",
    ],
    links: [{ label: "Cron יצירה", href: "/api/cron/auto-create" }],
    verifyFnName: "verifyCronAutoCreate",
  },

  // ── Group 20 ───────────────────────────────────────────────────────────────
  {
    id: "20.1",
    group: "20",
    title: "שחזר Snapshot לפני הבדיקה",
    instructions: [
      'עבור לניהול Snapshot למעלה',
      'לחץ "שחזר" על snapshot "pre-test"',
      "אשר את הפעולה",
    ],
    verifyFnName: "verifyTestPlayersGone",
    note: "לאחר השחזור, שחקני הבדיקה (0500000001–0500000011) אמורים להיעלם",
  },
  {
    id: "20.2",
    group: "20",
    title: "וודא תקינות האפליקציה לאחר שחזור",
    instructions: ["אין פעולה — בודק שהחיבור ל-DB תקין"],
    verifyFnName: "verifyHealthPostRestore",
  },
];
