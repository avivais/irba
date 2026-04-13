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
  { label: "קבוצה 3 — מחזור מפגש", groupKey: "3" },
  { label: "קבוצה 4 — הרשמה ציבורית", groupKey: "4" },
  { label: "קבוצה 5 — רישום משחקים", groupKey: "5" },
  { label: "קבוצה 6 — הגדרת תחרות", groupKey: "6" },
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
    title: "צור שחקן מזדמן ד",
    instructions: [
      "טלפון: 0500000004",
      "שם: מזדמן ד",
      "סוג: מזדמן",
      "שמור",
    ],
    links: [{ label: "שחקן חדש", href: "/admin/players/new" }],
    verifyFnName: "verifyPlayerD",
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
    title: "צור מפגש 1 (חלון תחרות)",
    instructions: [
      "עבור ליצירת מפגש",
      "תאריך: היום",
      "מקסימום שחקנים: 3",
      "משך: 90 דקות",
      "שמור",
    ],
    links: [{ label: "מפגש חדש", href: "/admin/sessions/new" }],
    verifyFnName: "verifySession1Created",
  },
  {
    id: "3.2",
    group: "3",
    title: "הוסף שחקן א למפגש 1 (אדמין)",
    instructions: [
      "עבור לדף המפגש",
      'השתמש בתפריט "הוסף שחקן"',
      "בחר שחקן א",
    ],
    verifyFnName: "verifySession1PlayerA",
  },
  {
    id: "3.3",
    group: "3",
    title: "הוסף שחקנים ב ו-ג",
    instructions: [
      "הוסף שחקן ב",
      "הוסף שחקן ג",
    ],
    verifyFnName: "verifySession1Capacity",
  },
  {
    id: "3.4",
    group: "3",
    title: "הוסף מזדמן ד (רשימת המתנה)",
    instructions: [
      "הוסף מזדמן ד — אמור לעבור לרשימת המתנה כי המפגש מלא",
    ],
    verifyFnName: "verifySession1Waitlist",
  },
  {
    id: "3.5",
    group: "3",
    title: "בטל השתתפות שחקן ב",
    instructions: [
      "מחק את רישום שחקן ב",
    ],
    verifyFnName: "verifySession1PlayerBRemoved",
  },
  {
    id: "3.6",
    group: "3",
    title: "קדם מזדמן ד מרשימת המתנה",
    instructions: [
      'לחץ "קדם" ליד מזדמן ד',
    ],
    verifyFnName: "verifySession1DPromoted",
  },
  {
    id: "3.7",
    group: "3",
    title: "וודא רשימה מאושרת: א, ג, ד",
    instructions: ["אין פעולה — בודק שרק שלושה שחקנים מאושרים: א, ג, ד"],
    verifyFnName: "verifySession1ConfirmedList",
  },

  // ── Group 4 ────────────────────────────────────────────────────────────────
  {
    id: "4.1",
    group: "4",
    title: "הרשמה ציבורית — שחקן א (כבר נרשם)",
    instructions: [
      "פתח חלון גלישה פרטית (Incognito)",
      "עבור לדף הבית",
      "הכנס 0500000001, לחץ 'שלח קוד' — אז לחץ 'הצג קוד OTP' כאן לקבל את הקוד",
      'הכנס את הקוד בדפדפן הפרטי ווודא הודעת "כבר נרשמת" מוצגת',
    ],
    links: [{ label: "דף הבית", href: "/" }],
    verifyFnName: "verifyNoduplicateAttendanceA",
    otpPhone: "0500000001",
    note: "צעד ידני — הבדיקה מוודאת שלא נוצר רשומת נוכחות כפולה",
  },
  {
    id: "4.2",
    group: "4",
    title: "הרשמה עם טלפון חדש (DROP_IN אוטומטי)",
    instructions: [
      "עבור לדף הבית בחלון פרטי, הכנס טלפון שאינו קיים במערכת (לדוגמה 0509999991)",
      "לחץ 'שלח קוד' — המערכת תיצור שחקן DROP_IN ותשמור את הקוד ב-DB",
      "לחץ 'הצג קוד OTP' כאן, הכנס את אותו טלפון — קבל את הקוד",
      "הכנס קוד בדפדפן, קבע שם → הירשם",
    ],
    verifyFnName: "verifyNewDropInRsvp",
    otpPhone: "custom",
    note: "שחקן DROP_IN ייצור ורישום נוכחות יווצר (רשימת המתנה כי המפגש מלא)",
  },
  {
    id: "4.3",
    group: "4",
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
    id: "4.4",
    group: "4",
    title: "שחזר רשימה מאושרת למפגש 1",
    instructions: [
      "אם שחקן א בוטל — הוסף מחדש",
      "הסר את רישום 0509999991",
      "וודא: א, ג, ד מאושרים",
    ],
    verifyFnName: "verifySession1ConfirmedListAfterRsvp",
  },

  // ── Group 5 ────────────────────────────────────────────────────────────────
  {
    id: "5.1",
    group: "5",
    title: "רשום משחק 1: א+ג נגד ד",
    instructions: [
      "עבור למפגש 1 → לוח משחקים",
      "קבוצה א = [שחקן א, שחקן ג]",
      "קבוצה ב = [מזדמן ד]",
      "תוצאה א=12, ב=8",
      "שמור",
    ],
    verifyFnName: "verifyMatch1",
  },
  {
    id: "5.2",
    group: "5",
    title: "רשום משחק 2: א נגד ג+ד",
    instructions: [
      "קבוצה א = [שחקן א]",
      "קבוצה ב = [שחקן ג, מזדמן ד]",
      "תוצאה א=12, ב=8",
    ],
    verifyFnName: "verifyMatch2",
  },
  {
    id: "5.3",
    group: "5",
    title: "רשום משחק 3: ג+ד נגד א",
    instructions: [
      "קבוצה א = [שחקן ג, מזדמן ד]",
      "קבוצה ב = [שחקן א]",
      "תוצאה א=12, ב=8",
    ],
    verifyFnName: "verifyMatch3",
  },
  {
    id: "5.4",
    group: "5",
    title: "רשום משחק 4: א נגד ג",
    instructions: [
      "קבוצה א = [שחקן א]",
      "קבוצה ב = [שחקן ג]",
      "תוצאה א=12, ב=8",
    ],
    verifyFnName: "verifyMatch4",
    note: "אחרי 4 משחקים: א — 3 ניצחון 1 הפסד (75%), ג — 1 ניצחון 3 הפסד (25%), ד — מזדמן, אינו בדירוג",
  },

  // ── Group 6 ────────────────────────────────────────────────────────────────
  {
    id: "6.1",
    group: "6",
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
  },
  {
    id: "6.2",
    group: "6",
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
    id: "6.3",
    group: "6",
    title: "דף ציבורי מציג תחרות פעילה",
    instructions: [
      'עבור לדף התחרויות',
      'וודא תג "פעיל" מוצג על כרטיס התחרות',
    ],
    links: [{ label: "תחרויות", href: "/challenges" }],
    verifyFnName: "verifyChallengeActivePublic",
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
      "מקסימום שחקנים: 4",
      "משך: 90 דקות",
      "שמור",
    ],
    links: [{ label: "מפגש חדש", href: "/admin/sessions/new" }],
    verifyFnName: "verifySession2Created",
  },
  {
    id: "8.2",
    group: "8",
    title: "הוסף שחקנים ורשום 3 משחקים לשחקן ב",
    instructions: [
      "הוסף א, ב, ג, ד",
      "רשום לפחות 3 משחקים שבהם ב משתתף",
      "לדוגמה: ב+א נגד ג, ב נגד א, ב+ג נגד ד",
    ],
    verifyFnName: "verifySession2PlayerBMatches",
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
      "מקסימום שחקנים: 4",
      "משך: 90 דקות",
    ],
    links: [{ label: "מפגש חדש", href: "/admin/sessions/new" }],
    verifyFnName: "verifySession3Created",
  },
  {
    id: "9.2",
    group: "9",
    title: "הוסף שחקנים ורשום 2 ניצחונות לשחקן א",
    instructions: [
      "הוסף א, ב, ג (לא ד)",
      "רשום 2 משחקים שבהם א מנצח",
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
    note: "צפה: isClosed=true, winnerId=A, FreeEntry נוצר לשחקן א",
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
      "מקסימום: 4, משך: 90 דקות",
    ],
    links: [{ label: "מפגש חדש", href: "/admin/sessions/new" }],
    verifyFnName: "verifySession4Created",
  },
  {
    id: "10.2",
    group: "10",
    title: "הוסף שחקן א (זוכה) למפגש 4",
    instructions: ["הוסף שחקן א"],
    verifyFnName: "verifySession4PlayerA",
  },
  {
    id: "10.3",
    group: "10",
    title: "הוסף שחקנים ב ו-ג",
    instructions: ["הוסף שחקן ב ו-ג"],
    verifyFnName: "verifySession4ThreePlayers",
  },
  {
    id: "10.4",
    group: "10",
    title: "תצוגה מקדימה — א מציג ₪0 FREE_ENTRY",
    instructions: [
      'צפה בתצוגה מקדימה של החיוב',
      "שחקן א אמור להיות ₪0 עם סוג FREE_ENTRY",
    ],
    verifyFnName: "verifyFreeEntryProposal",
  },
  {
    id: "10.5",
    group: "10",
    title: "אשר חיובים",
    instructions: ["לחץ אשר חיובים"],
    verifyFnName: "verifyFreeEntryConsumed",
    note: "צפה: SessionCharge.amount=0 לשחקן א, FreeEntry.usedAt מאוכלס",
  },

  // ── Group 11 ───────────────────────────────────────────────────────────────
  {
    id: "11.1",
    group: "11",
    title: "עקוף חיוב שחקן ב במפגש 4",
    instructions: [
      "עבור למפגש 4",
      "לחץ עריכה על חיוב שחקן ב",
      "שנה סכום ב-+10",
      'הוסף סיבה "בדיקה"',
      "שמור",
    ],
    verifyFnName: "verifyChargeAudit",
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
    title: "צור מפגש 5, הוסף א+ב+ג, חייב",
    instructions: [
      "צור מפגש 5 (90 דקות)",
      "הוסף א, ב, ג",
      "חייב — ב אמור לקבל תעריף מזדמן (עקב חוב)",
    ],
    links: [{ label: "מפגש חדש", href: "/admin/sessions/new" }],
    verifyFnName: "verifyDebtChargeType",
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
    note: "לאחר השחזור, שחקני הבדיקה (0500000001–0500000004) אמורים להיעלם",
  },
  {
    id: "20.2",
    group: "20",
    title: "וודא תקינות האפליקציה לאחר שחזור",
    instructions: ["אין פעולה — בודק שהחיבור ל-DB תקין"],
    verifyFnName: "verifyHealthPostRestore",
  },
];
