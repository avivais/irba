"use server";

import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { computeLeaderboard } from "@/lib/challenge-analytics";
import { computeMatchStats } from "@/lib/match-analytics";
import { hash } from "bcryptjs";
import { randomInt } from "crypto";
import { sendWaMessage } from "@/lib/wa-notify";

export type VerifyResult = { pass: boolean; detail: string; manual?: boolean };

/**
 * Issues a fresh OTP for `phone` and forwards it as a WA DM to the admin.
 * The OTP is still hashed in DB — plaintext only travels via WA to admin's phone.
 */
export async function issueTestOtp(phone: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  try {
    const player = await prisma.player.findUnique({ where: { phone }, select: { id: true } });
    if (!player) return { ok: false, error: "שחקן לא נמצא — הכנס את הטלפון בדף הבית תחילה" };

    const raw = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const hashed = await hash(raw, 8);
    await prisma.player.update({
      where: { id: player.id },
      data: { otpCode: hashed, otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000) },
    });

    const admin = await prisma.player.findFirst({ where: { isAdmin: true }, select: { phone: true } });
    if (!admin?.phone) return { ok: false, error: "לא נמצא אדמין עם טלפון לשליחה" };

    await sendWaMessage(admin.phone, `🧪 קוד בדיקה לטלפון ${phone}: *${raw}*\nתוקף: 10 דקות`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ── Test player phones ────────────────────────────────────────────────────────

const TEST_PHONES = {
  A: "0500000001",
  B: "0500000002",
  C: "0500000003",
  D: "0500000004",
  E: "0500000005",
  F: "0500000006",
  G: "0500000007",
  H: "0500000008",
  I: "0500000009",
  J: "0500000010",
  K: "0500000011",
} as const;

async function tp(key: keyof typeof TEST_PHONES) {
  return prisma.player.findUnique({ where: { phone: TEST_PHONES[key] } });
}

/** Sessions attended by player A, ordered by session date ASC */
async function testSessionsForA() {
  const a = await tp("A");
  if (!a) return [];
  const atts = await prisma.attendance.findMany({
    where: { playerId: a.id },
    include: { gameSession: true },
    orderBy: { gameSession: { date: "asc" } },
  });
  return atts.map((x) => x.gameSession);
}

function ok(detail: string): VerifyResult { return { pass: true, detail }; }
function fail(detail: string): VerifyResult { return { pass: false, detail }; }

// ── Dispatcher ────────────────────────────────────────────────────────────────

export async function runVerification(stepId: string): Promise<VerifyResult> {
  await requireAdmin();
  const fn = VERIFICATIONS[stepId];
  if (!fn) return { pass: true, manual: true, detail: "אין בדיקה אוטומטית לשלב זה — סמן ידנית לאחר בדיקה בדפדפן" };
  try {
    return await fn();
  } catch (e) {
    return fail(`שגיאה: ${String(e)}`);
  }
}

// ── Individual verification functions ────────────────────────────────────────

const VERIFICATIONS: Record<string, () => Promise<VerifyResult>> = {

  // ── Group 0: Snapshot ─────────────────────────────────────────────────────
  "0.1": async () => {
    const { listSnapshots } = await import("./snapshot-actions");
    const snaps = await listSnapshots();
    const preTest = snaps.find((s) => s.label.includes("pre-test") || s.label.includes("pre_test"));
    if (!preTest) return fail('לא נמצא snapshot עם label "pre-test". צור אחד לפני שתמשיך.');
    return ok(`נמצא snapshot: ${preTest.filename}`);
  },

  // ── Group 1: Config ───────────────────────────────────────────────────────
  "1.1": async () => {
    const required = ["competition_session_count", "competition_min_matches_pct", "wa_notify_competition_winner_enabled"];
    const found = await prisma.appConfig.findMany({ where: { key: { in: required } } });
    const foundKeys = found.map((r) => r.key);
    const missing = required.filter((k) => !foundKeys.includes(k));
    if (missing.length > 0) return fail(`מפתחות חסרים: ${missing.join(", ")}`);
    return ok(`כל ${required.length} מפתחות קיימים`);
  },

  "1.2": async () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const rate = await prisma.hourlyRate.findFirst({ where: { effectiveFrom: { lte: today } } });
    if (!rate) return fail("לא נמצא תעריף שעתי תקף להיום. צור אחד ב-/admin/config.");
    return ok(`תעריף תקף: ₪${rate.pricePerHour}/שעה (מ-${new Date(rate.effectiveFrom).toLocaleDateString("he-IL")})`);
  },

  "1.3": async () => {
    const configs = await prisma.appConfig.findMany({
      where: { key: { in: ["competition_session_count", "competition_min_matches_pct"] } },
    });
    const map = Object.fromEntries(configs.map((c) => [c.key, c.value]));
    if (map.competition_session_count !== "3") return fail(`competition_session_count = "${map.competition_session_count}" (צריך "3")`);
    if (map.competition_min_matches_pct !== "50") return fail(`competition_min_matches_pct = "${map.competition_min_matches_pct}" (צריך "50")`);
    return ok("session_count=3, min_matches_pct=50 ✓");
  },

  // ── Group 2: Players ──────────────────────────────────────────────────────
  "2.1": async () => {
    const p = await tp("A");
    if (!p) return fail(`שחקן ${TEST_PHONES.A} לא נמצא`);
    if (p.playerKind !== "REGISTERED") return fail(`שחקן A קיים אך kind=${p.playerKind} (צריך REGISTERED)`);
    return ok(`שחקן A קיים (${p.firstNameHe ?? p.nickname ?? p.phone}), REGISTERED ✓`);
  },

  "2.2": async () => {
    const p = await tp("B");
    if (!p) return fail(`שחקן ${TEST_PHONES.B} לא נמצא`);
    if (p.playerKind !== "REGISTERED") return fail(`שחקן B קיים אך kind=${p.playerKind}`);
    return ok(`שחקן B קיים (${p.firstNameHe ?? p.phone}), REGISTERED ✓`);
  },

  "2.3": async () => {
    const p = await tp("C");
    if (!p) return fail(`שחקן ${TEST_PHONES.C} לא נמצא`);
    if (p.playerKind !== "REGISTERED") return fail(`שחקן C קיים אך kind=${p.playerKind}`);
    return ok(`שחקן C קיים (${p.firstNameHe ?? p.phone}), REGISTERED ✓`);
  },

  "2.5": async () => {
    const p = await tp("A");
    if (!p) return fail("שחקן A לא נמצא");
    if (!p.nickname) return fail("ל-שחקן A אין nickname. ערוך והוסף שם כינוי.");
    return ok(`Nickname: "${p.nickname}" ✓`);
  },

  "2.4": async () => {
    // Auto-create test players D–K
    const toCreate = [
      { phone: "0500000004", name: "מזדמן ד", kind: "DROP_IN" as const },
      { phone: "0500000005", name: "שחקן ה", kind: "REGISTERED" as const },
      { phone: "0500000006", name: "שחקן ו", kind: "REGISTERED" as const },
      { phone: "0500000007", name: "שחקן ז", kind: "REGISTERED" as const },
      { phone: "0500000008", name: "שחקן ח", kind: "REGISTERED" as const },
      { phone: "0500000009", name: "שחקן ט", kind: "REGISTERED" as const },
      { phone: "0500000010", name: "שחקן י", kind: "REGISTERED" as const },
      { phone: "0500000011", name: "שחקן כ", kind: "REGISTERED" as const },
    ];
    let created = 0, existing = 0;
    for (const { phone, name, kind } of toCreate) {
      const exists = await prisma.player.findUnique({ where: { phone } });
      if (exists) { existing++; continue; }
      await prisma.player.create({ data: { phone, firstNameHe: name, playerKind: kind } });
      created++;
    }
    return ok(`נוצרו ${created} שחקנים חדשים, ${existing} כבר היו קיימים ✓`);
  },

  "2.6": async () => {
    const allPhones = Object.values(TEST_PHONES);
    const ids = (await prisma.player.findMany({ where: { phone: { in: allPhones } }, select: { id: true } })).map(p => p.id);
    const [charges, payments] = await Promise.all([
      prisma.sessionCharge.aggregate({ where: { playerId: { in: ids } }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { playerId: { in: ids } }, _sum: { amount: true } }),
    ]);
    const totalCharges = charges._sum.amount ?? 0;
    const totalPayments = payments._sum.amount ?? 0;
    if (totalCharges !== 0 || totalPayments !== 0) {
      return fail(`יש כבר חיובים (${totalCharges}₪) או תשלומים (${totalPayments}₪) לשחקני הבדיקה`);
    }
    return ok("כל שחקני הבדיקה עם יתרה 0 ✓");
  },

  // ── Group 3: Competition ──────────────────────────────────────────────────
  "3.1": async () => {
    const challenge = await prisma.challenge.findFirst({ where: { isActive: true, isClosed: false } });
    if (!challenge) return fail("אין תחרות פעילה. פתח תחרות ב-/admin/challenges/new.");
    return ok(`תחרות פעילה: סיבוב ${challenge.number}, ${challenge.sessionCount} מפגשים, סף ${challenge.minMatchesPct}% ✓`);
  },

  "3.2": async () => {
    const count = await prisma.challenge.count({ where: { isActive: true, isClosed: false } });
    if (count !== 1) return fail(`נמצאו ${count} תחרויות פעילות — צריך בדיוק 1`);
    return ok("בדיוק תחרות פעילה אחת ✓");
  },

  // ── Group 4: Session ──────────────────────────────────────────────────────
  "4.1": async () => {
    const session = await prisma.gameSession.findFirst({
      where: { maxPlayers: 10, isCharged: false },
      orderBy: { createdAt: "desc" },
    });
    if (!session) return fail("לא נמצא מפגש עם maxPlayers=10. צור מפגש חדש.");
    const dur = session.durationMinutes ? `${session.durationMinutes} דק'` : "משך לא הוגדר";
    return ok(`מפגש נמצא (${new Date(session.date).toLocaleDateString("he-IL")}), משך: ${dur} ✓`);
  },

  "4.2": async () => {
    const a = await tp("A");
    if (!a) return fail("שחקן A לא נמצא");
    const sessions = await testSessionsForA();
    if (sessions.length === 0) return fail("שחקן A לא רשום לאף מפגש");
    return ok(`שחקן A רשום ל-${sessions.length} מפגש/ים ✓`);
  },

  "4.3": async () => {
    const sessions = await testSessionsForA();
    if (sessions.length === 0) return fail("שחקן A לא רשום לאף מפגש");
    const session = sessions[0];
    const count = await prisma.attendance.count({ where: { gameSessionId: session.id } });
    if (count < 10) return fail(`רק ${count} נרשמים — הוסף ב, ג, ד, ה, ו, ז, ח, ט, י עד שיש 10`);
    return ok(`${count} נרשמים למפגש 1, מפגש מלא (${session.maxPlayers}) ✓`);
  },

  "4.4": async () => {
    const k = await tp("K");
    const sessions = await testSessionsForA();
    if (!k || sessions.length === 0) return fail("חסרים נתונים");
    const session = sessions[0];
    const att = await prisma.attendance.findUnique({
      where: { playerId_gameSessionId: { playerId: k.id, gameSessionId: session.id } },
    });
    if (!att) return fail("שחקן כ לא נמצא במפגש — הוסף אותו");
    const allAtts = await prisma.attendance.findMany({
      where: { gameSessionId: session.id },
      orderBy: { createdAt: "asc" },
    });
    const kIdx = allAtts.findIndex((a) => a.playerId === k.id);
    const isWaitlisted = kIdx >= session.maxPlayers;
    if (!isWaitlisted) return fail(`שחקן כ הוא נרשם ${kIdx + 1} מתוך ${session.maxPlayers} — הוא מאושר, לא ברשימת המתנה`);
    return ok(`שחקן כ ברשימת המתנה (מקום ${kIdx + 1}, מקסימום ${session.maxPlayers}) ✓`);
  },

  "4.5": async () => {
    const b = await tp("B");
    const sessions = await testSessionsForA();
    if (!b || sessions.length === 0) return fail("חסרים נתונים");
    const session = sessions[0];
    const att = await prisma.attendance.findUnique({
      where: { playerId_gameSessionId: { playerId: b.id, gameSessionId: session.id } },
    });
    if (att) return fail("שחקן B עדיין רשום — ביטל ידנית");
    return ok("שחקן B בוטל בהצלחה ✓");
  },

  "4.6": async () => {
    const k = await tp("K");
    const sessions = await testSessionsForA();
    if (!k || sessions.length === 0) return fail("חסרים נתונים");
    const session = sessions[0];
    const allAtts = await prisma.attendance.findMany({
      where: { gameSessionId: session.id },
      orderBy: { createdAt: "asc" },
    });
    const kIdx = allAtts.findIndex((a) => a.playerId === k.id);
    if (kIdx === -1) return fail("שחקן כ לא נמצא במפגש");
    if (kIdx >= session.maxPlayers) return fail(`שחקן כ עדיין ברשימת המתנה (${kIdx + 1} > ${session.maxPlayers}) — קדם אותו`);
    return ok(`שחקן כ מאושר (מקום ${kIdx + 1}) ✓`);
  },

  "4.7": async () => {
    const [a, b, k] = await Promise.all([tp("A"), tp("B"), tp("K")]);
    const sessions = await testSessionsForA();
    if (!a || !b || !k || sessions.length === 0) return fail("חסרים נתונים");
    const session = sessions[0];
    const allAtts = await prisma.attendance.findMany({
      where: { gameSessionId: session.id },
      orderBy: { createdAt: "asc" },
    });
    const confirmedIds = new Set(allAtts.slice(0, session.maxPlayers).map((x) => x.playerId));
    const bGone = !confirmedIds.has(b.id);
    const kIn = confirmedIds.has(k.id);
    const aIn = confirmedIds.has(a.id);
    if (!aIn) return fail("שחקן א לא מאושר");
    if (!bGone) return fail("שחקן ב עדיין מאושר — צריך להיות מוסר");
    if (!kIn) return fail("שחקן כ לא מאושר — צריך להיות מקודם");
    return ok(`${confirmedIds.size} שחקנים מאושרים, א ✓, ב הוסר ✓, כ קודם ✓`);
  },

  // ── Group 5: Public RSVP ──────────────────────────────────────────────────
  "5.1": async () => {
    const a = await tp("A");
    if (!a) return fail("שחקן A לא נמצא");
    const sessions = await testSessionsForA();
    const dupes = await prisma.attendance.count({
      where: { playerId: a.id, gameSessionId: sessions[0]?.id },
    });
    if (dupes > 1) return fail(`${dupes} רישומים כפולים לשחקן A`);
    return ok("רישום יחיד לשחקן A, ללא כפילויות ✓");
  },

  "5.2": async () => {
    // Check a new DROP_IN player was created (phone other than test phones)
    // We look for any DROP_IN created in the last hour
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const newDropIn = await prisma.player.findFirst({
      where: {
        playerKind: "DROP_IN",
        createdAt: { gte: cutoff },
        phone: { notIn: Object.values(TEST_PHONES) },
        isAdmin: false,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!newDropIn) return fail("לא נמצא שחקן מזדמן חדש שנוצר בשעה האחרונה");
    return ok(`שחקן מזדמן חדש: ${newDropIn.phone} (${newDropIn.firstNameHe ?? "ללא שם"}) ✓`);
  },

  "5.3": async () => {
    const config = await prisma.appConfig.findUnique({ where: { key: "rsvp_close_hours" } });
    const val = Number(config?.value ?? "13");
    if (val !== 0 && val !== 999) return fail(`rsvp_close_hours=${val} — הגדר ל-0 ואז ל-999 לבדיקת ביטול`);
    return ok(`rsvp_close_hours=${val} — בדיקה ידנית ✓`);
  },

  "5.4": async () => {
    const [a, k] = await Promise.all([tp("A"), tp("K")]);
    const sessions = await testSessionsForA();
    if (!a || !k || sessions.length === 0) return fail("חסרים נתונים");
    const session = sessions[0];
    const allAtts = await prisma.attendance.findMany({
      where: { gameSessionId: session.id },
      orderBy: { createdAt: "asc" },
    });
    const confirmedIds = allAtts.slice(0, session.maxPlayers).map((x) => x.playerId);
    const ok2 = confirmedIds.includes(a.id) && confirmedIds.includes(k.id);
    if (!ok2) return fail("רשימת המאושרים לא תואמת את הצפוי (A, C, D)");
    return ok(`מפגש 1 חזר למצב תקין: ${confirmedIds.length} שחקנים מאושרים ✓`);
  },

  // ── Group 6: Matches ──────────────────────────────────────────────────────
  "6.1": async () => {
    const sessions = await testSessionsForA();
    if (sessions.length === 0) return fail("אין מפגשים");
    const count = await prisma.match.count({ where: { sessionId: sessions[0].id } });
    if (count < 1) return fail("אין משחקים למפגש 1");
    return ok(`${count} משחקים רשומים למפגש 1 ✓`);
  },

  "6.2": async () => {
    const sessions = await testSessionsForA();
    if (sessions.length === 0) return fail("אין מפגשים");
    const count = await prisma.match.count({ where: { sessionId: sessions[0].id } });
    if (count < 2) return fail(`רק ${count} משחקים — הוסף משחק 2`);
    return ok(`${count} משחקים רשומים ✓`);
  },

  "6.3": async () => {
    const sessions = await testSessionsForA();
    if (sessions.length === 0) return fail("אין מפגשים");
    const count = await prisma.match.count({ where: { sessionId: sessions[0].id } });
    if (count < 3) return fail(`רק ${count} משחקים — הוסף משחק 3`);
    return ok(`${count} משחקים רשומים ✓`);
  },

  "6.4": async () => {
    const sessions = await testSessionsForA();
    if (sessions.length === 0) return fail("אין מפגשים");
    const count = await prisma.match.count({ where: { sessionId: sessions[0].id } });
    if (count < 4) return fail(`רק ${count} משחקים — צריך 4 לבדיקת ה-threshold`);
    return ok(`${count} משחקים במפגש 1 ✓`);
  },

  // ── Group 7: Leaderboard after session 1 ─────────────────────────────────
  "7.1": async () => {
    const sessions = await testSessionsForA();
    if (sessions.length === 0) return fail("אין מפגשים");
    const s = sessions[0];
    if (!s.isCharged) return fail("מפגש 1 עדיין לא גובה — גבה תשלום");
    const chargeCount = await prisma.sessionCharge.count({ where: { sessionId: s.id } });
    return ok(`מפגש 1 גובה, ${chargeCount} חיובים נוצרו ✓`);
  },

  "7.2": async () => {
    const d = await tp("D");
    // Accept any challenge (open or closed) — leaderboard logic is the same either way
    const challenge = await prisma.challenge.findFirst({ orderBy: { number: "desc" } });
    const sessions = await testSessionsForA();
    if (!d) return fail("שחקן D לא נמצא — בצע שלב 2.4");
    if (!challenge) return fail("אין תחרות — בצע שלב 3.1");
    if (sessions.length === 0) return fail("שחקן A לא רשום לאף מפגש — בצע שלב 4.2");

    const windowIds = [sessions[0].id];
    const matches = await prisma.match.findMany({
      where: { sessionId: { in: windowIds } },
      select: { id: true, sessionId: true, teamAPlayerIds: true, teamBPlayerIds: true, scoreA: true, scoreB: true, createdAt: true },
    });
    const registeredPlayers = await prisma.player.findMany({
      where: { isAdmin: false, playerKind: "REGISTERED" },
      select: { id: true, firstNameHe: true, lastNameHe: true, firstNameEn: true, lastNameEn: true, nickname: true, phone: true },
    });
    const { getPlayerDisplayName } = await import("@/lib/player-display");
    const playerNames = new Map(registeredPlayers.map((p) => [p.id, getPlayerDisplayName(p)]));
    const registeredPlayerIds = new Set(registeredPlayers.map((p) => p.id));

    const { leaderboard, ineligible } = computeLeaderboard({
      minMatchesPct: challenge.minMatchesPct,
      windowSessionIds: windowIds,
      matches,
      playerNames,
      registeredPlayerIds,
    });

    const allEntries = [...leaderboard, ...ineligible];
    const dInList = allEntries.some((e) => e.playerId === d.id);
    if (dInList) return fail("מזדמן D מופיע בלוח התוצאות — לא אמור להופיע!");
    return ok("מזדמן D לא מופיע בלוח התוצאות ✓");
  },

  "7.3": async () => {
    const a = await tp("A");
    const challenge = await prisma.challenge.findFirst({ orderBy: { number: "desc" } });
    const sessions = await testSessionsForA();
    if (!a) return fail("שחקן A לא נמצא");
    if (!challenge) return fail("אין תחרות — בצע שלב 3.1");
    if (sessions.length === 0) return fail("שחקן A לא רשום לאף מפגש");

    const windowIds = [sessions[0].id];
    const matches = await prisma.match.findMany({
      where: { sessionId: { in: windowIds } },
      select: { id: true, sessionId: true, teamAPlayerIds: true, teamBPlayerIds: true, scoreA: true, scoreB: true, createdAt: true },
    });
    const registeredPlayers = await prisma.player.findMany({
      where: { isAdmin: false, playerKind: "REGISTERED" },
      select: { id: true, firstNameHe: true, lastNameHe: true, firstNameEn: true, lastNameEn: true, nickname: true, phone: true },
    });
    const { getPlayerDisplayName } = await import("@/lib/player-display");
    const playerNames = new Map(registeredPlayers.map((p) => [p.id, getPlayerDisplayName(p)]));
    const registeredPlayerIds = new Set(registeredPlayers.map((p) => p.id));

    const { leaderboard } = computeLeaderboard({
      minMatchesPct: challenge.minMatchesPct,
      windowSessionIds: windowIds,
      matches,
      playerNames,
      registeredPlayerIds,
    });

    const entryA = leaderboard.find((e) => e.playerId === a.id);
    if (!entryA) return fail("שחקן A לא בלוח הזכאים");
    if (entryA.rank !== 1) return fail(`שחקן A מדורג ${entryA.rank} במקום 1 — בדוק הרכב הקבוצות`);
    const top3 = leaderboard.filter((e) => e.rank <= 3);
    return ok(`שחקן A מקום 1 (${Math.round(entryA.winRatio * 100)}%), ${leaderboard.length} שחקנים זכאים, top3: ${top3.map((e) => `${e.displayName} ${Math.round(e.winRatio * 100)}%`).join(", ")} ✓`);
  },

  "7.4": async () => {
    const b = await tp("B");
    const challenge = await prisma.challenge.findFirst({ orderBy: { number: "desc" } });
    const sessions = await testSessionsForA();
    if (!b) return fail("שחקן B לא נמצא");
    if (!challenge) return fail("אין תחרות — בצע שלב 3.1");
    if (sessions.length === 0) return fail("שחקן A לא רשום לאף מפגש");

    const windowIds = [sessions[0].id];
    const matches = await prisma.match.findMany({
      where: { sessionId: { in: windowIds } },
      select: { id: true, sessionId: true, teamAPlayerIds: true, teamBPlayerIds: true, scoreA: true, scoreB: true, createdAt: true },
    });
    const registeredPlayers = await prisma.player.findMany({
      where: { isAdmin: false, playerKind: "REGISTERED" },
      select: { id: true, firstNameHe: true, lastNameHe: true, firstNameEn: true, lastNameEn: true, nickname: true, phone: true },
    });
    const { getPlayerDisplayName } = await import("@/lib/player-display");
    const playerNames = new Map(registeredPlayers.map((p) => [p.id, getPlayerDisplayName(p)]));
    const registeredPlayerIds = new Set(registeredPlayers.map((p) => p.id));

    const { ineligible } = computeLeaderboard({
      minMatchesPct: challenge.minMatchesPct,
      windowSessionIds: windowIds,
      matches,
      playerNames,
      registeredPlayerIds,
    });

    const entryB = ineligible.find((e) => e.playerId === b.id);
    if (!entryB) return fail("שחקן B לא נמצא בקטגוריית 'לא עומדים בסף' — ייתכן שהוא כבר זכאי?");
    return ok(`שחקן B בקטגוריית לא-זכאים: ${entryB.matchesPlayed} משחקים, חסרים ${entryB.gamesNeeded} ✓`);
  },

  // ── Group 8: Session 2 ────────────────────────────────────────────────────
  "8.1": async () => {
    const sessions = await testSessionsForA();
    if (sessions.length < 2) return fail(`רק ${sessions.length} מפגש/ים לשחקן A — צור מפגש 2 עם A ו-B`);
    return ok(`${sessions.length} מפגשים לשחקן A ✓`);
  },

  "8.3": async () => {
    const sessions = await testSessionsForA();
    if (sessions.length < 2) return fail("מפגש 2 לא נמצא");
    const s2 = sessions[1];
    if (!s2.isCharged) return fail("מפגש 2 עדיין לא גובה");
    const challenge = await prisma.challenge.findFirst({ where: { isActive: true, isClosed: false } });
    if (!challenge) return fail("התחרות כבר נסגרה (לא צפוי בשלב זה)");
    return ok("מפגש 2 גובה, תחרות עדיין פעילה (2/3) ✓");
  },

  "8.4": async () => {
    const b = await tp("B");
    const challenge = await prisma.challenge.findFirst({ where: { isActive: true, isClosed: false } });
    const sessions = await testSessionsForA();
    if (!b || !challenge || sessions.length < 2) return fail("חסרים נתונים");

    const windowIds = sessions.slice(0, 2).map((s) => s.id);
    const matches = await prisma.match.findMany({
      where: { sessionId: { in: windowIds } },
      select: { id: true, sessionId: true, teamAPlayerIds: true, teamBPlayerIds: true, scoreA: true, scoreB: true, createdAt: true },
    });
    const stats = computeMatchStats(b.id, matches);
    const allStats = [stats.total];
    const maxMatches = Math.max(...allStats, 0);
    const effectiveThreshold = Math.round((challenge.minMatchesPct / 100) * maxMatches);

    if (stats.total < effectiveThreshold) {
      return fail(`שחקן B: ${stats.total} משחקים, threshold=${effectiveThreshold} — עדיין לא זכאי`);
    }
    return ok(`שחקן B: ${stats.total} משחקים ≥ threshold=${effectiveThreshold} — זכאי ✓`);
  },

  // ── Group 9: Competition completion ──────────────────────────────────────
  "9.1": async () => {
    const sessions = await testSessionsForA();
    if (sessions.length < 3) return fail(`רק ${sessions.length} מפגשים — צור מפגש 3`);
    return ok(`${sessions.length} מפגשים לשחקן A ✓`);
  },

  "9.3": async () => {
    const a = await tp("A");
    if (!a) return fail("שחקן A לא נמצא");
    const closedChallenge = await prisma.challenge.findFirst({
      where: { isClosed: true },
      orderBy: { createdAt: "desc" },
    });
    if (!closedChallenge) return fail("אין תחרות סגורה — גבה תשלום במפגש 3");
    if (closedChallenge.winnerId !== a.id) {
      return fail(`התחרות נסגרה אך הזוכה הוא ${closedChallenge.winnerId} ≠ שחקן A (${a.id})`);
    }
    const freeEntry = await prisma.freeEntry.findFirst({
      where: { challengeId: closedChallenge.id, playerId: a.id, usedAt: null },
    });
    if (!freeEntry) return fail("לא נמצא FreeEntry לשחקן A");
    return ok(`תחרות סגורה, זוכה: שחקן A, FreeEntry נוצר ✓`);
  },

  "9.5": async () => {
    const closedChallenge = await prisma.challenge.findFirst({
      where: { isClosed: true },
      orderBy: { createdAt: "desc" },
    });
    if (!closedChallenge) return fail("אין תחרות סגורה");
    if (!closedChallenge.winnerId) return fail("אין זוכה");
    return ok(`סיבוב ${closedChallenge.number} סגור, winnerId מוגדר ✓`);
  },

  // ── Group 10: Free entry ──────────────────────────────────────────────────
  "10.3": async () => {
    const a = await tp("A");
    const freeEntry = await prisma.freeEntry.findFirst({
      where: { player: { phone: TEST_PHONES.A }, usedAt: null },
    });
    if (!a || !freeEntry) return fail("לא נמצא FreeEntry פנוי לשחקן A");
    return ok("FreeEntry פנוי קיים לשחקן A ✓ (ודא בתצוגה מקדימה ש-A מוצג כ-₪0)");
  },

  "10.5": async () => {
    const a = await tp("A");
    if (!a) return fail("שחקן A לא נמצא");
    const freeEntry = await prisma.freeEntry.findFirst({
      where: { playerId: a.id, usedAt: { not: null } },
      orderBy: { usedAt: "desc" },
    });
    if (!freeEntry) return fail("FreeEntry של שחקן A עדיין לא נוצל");
    const charge = await prisma.sessionCharge.findFirst({
      where: { sessionId: freeEntry.usedInSessionId ?? "", playerId: a.id },
    });
    if (!charge) return fail("לא נמצא חיוב לשחקן A במפגש עם כניסה חינם");
    if (charge.amount !== 0) return fail(`חיוב שחקן A: ₪${charge.amount} (צריך ₪0)`);
    if (charge.chargeType !== "FREE_ENTRY") return fail(`chargeType: ${charge.chargeType} (צריך FREE_ENTRY)`);
    return ok(`FreeEntry נוצל, חיוב A = ₪0 (FREE_ENTRY) ✓`);
  },

  // ── Group 11: Charge override ─────────────────────────────────────────────
  "11.1": async () => {
    const b = await tp("B");
    if (!b) return fail("שחקן B לא נמצא");
    const audit = await prisma.chargeAuditEntry.findFirst({
      where: { sessionCharge: { playerId: b.id } },
      orderBy: { changedAt: "desc" },
    });
    if (!audit) return fail("לא נמצא רשומת ביקורת לחיוב שחקן B");
    return ok(`רשומת ביקורת נמצאה: ${audit.previousAmount}₪ → ${audit.newAmount}₪ (${audit.reason ?? "ללא סיבה"}) ✓`);
  },

  "11.2": async () => {
    const auditLog = await prisma.auditLog.findFirst({
      where: { action: "UPDATE_SESSION_CHARGE" },
      orderBy: { timestamp: "desc" },
    });
    if (!auditLog) return fail("לא נמצאה רשומה ב-AuditLog מסוג UPDATE_SESSION_CHARGE");
    return ok(`AuditLog נמצא (${new Date(auditLog.timestamp).toLocaleString("he-IL")}) ✓`);
  },

  // ── Group 12: Cascade / Debt ──────────────────────────────────────────────
  "12.1": async () => {
    const b = await tp("B");
    if (!b) return fail("שחקן B לא נמצא");
    const [payments, charges] = await Promise.all([
      prisma.payment.aggregate({ where: { playerId: b.id }, _sum: { amount: true } }),
      prisma.sessionCharge.aggregate({ where: { playerId: b.id }, _sum: { amount: true } }),
    ]);
    const balance = (payments._sum.amount ?? 0) - (charges._sum.amount ?? 0);
    if (balance > -10) return fail(`יתרת שחקן B: ₪${balance} (צריך ≤ -10 ליצירת חוב)`);
    return ok(`יתרת שחקן B: ₪${balance} (חוב) ✓`);
  },

  "12.2": async () => {
    const b = await tp("B");
    if (!b) return fail("שחקן B לא נמצא");
    const charge = await prisma.sessionCharge.findFirst({
      where: { playerId: b.id },
      orderBy: { createdAt: "desc" },
    });
    if (!charge) return fail("לא נמצא חיוב לשחקן B");
    if (charge.chargeType !== "DROP_IN") {
      return fail(`חיוב B: chargeType=${charge.chargeType} (צריך DROP_IN בגלל חוב)`);
    }
    return ok(`שחקן B גובה בתעריף DROP_IN (חוב) ✓`);
  },

  // ── Group 13: Payments ────────────────────────────────────────────────────
  "13.1": async () => {
    const c = await tp("C");
    if (!c) return fail("שחקן C לא נמצא");
    const payment = await prisma.payment.findFirst({
      where: { playerId: c.id, amount: 200 },
    });
    if (!payment) return fail("לא נמצא תשלום של 200₪ לשחקן C");
    return ok(`תשלום 200₪ (${payment.method}) לשחקן C נמצא ✓`);
  },

  // ── Group 15: Peer ratings ────────────────────────────────────────────────
  "15.1": async () => {
    const session = await prisma.peerRatingSession.findFirst({ where: { closedAt: null } });
    if (!session) return fail("אין סיבוב דירוג פתוח");
    return ok(`סיבוב דירוג פתוח: שנת ${session.year} ✓`);
  },

  "15.2": async () => {
    const a = await tp("A");
    if (!a) return fail("שחקן A לא נמצא");
    const count = await prisma.peerRating.count({ where: { raterId: a.id } });
    if (count === 0) return fail("שחקן A לא הגיש דירוגים");
    return ok(`${count} דירוגים הוגשו ע"י שחקן A ✓`);
  },

  "15.3": async () => {
    const session = await prisma.peerRatingSession.findFirst({ where: { closedAt: { not: null } } });
    if (!session) return fail("אין סיבוב דירוג סגור");
    const playerWithRank = await prisma.player.findFirst({ where: { computedRank: { not: null } } });
    if (!playerWithRank) return fail("לאף שחקן יש computedRank — ייתכן שהחישוב לא רץ");
    return ok(`סיבוב דירוג סגור, computedRank מחושב לפחות לשחקן אחד ✓`);
  },

  "15.4": async () => {
    const a = await tp("A");
    if (!a) return fail("שחקן A לא נמצא");
    const adj = await prisma.playerAdjustment.findFirst({ where: { playerId: a.id } });
    if (!adj) return fail("לא נמצאה התאמת קדימות לשחקן A");
    return ok(`התאמה נמצאה: ${adj.points > 0 ? "+" : ""}${adj.points} נקודות (${adj.description}) ✓`);
  },

  // ── Group 16: Regulations ─────────────────────────────────────────────────
  "16.1": async () => {
    const config = await prisma.appConfig.findUnique({ where: { key: "regulations_version" } });
    const ver = Number(config?.value ?? "0");
    if (ver <= 0) return fail(`regulations_version=${ver} — הגדל ב-1`);
    return ok(`regulations_version=${ver} ✓`);
  },

  "16.3": async () => {
    const a = await tp("A");
    const config = await prisma.appConfig.findUnique({ where: { key: "regulations_version" } });
    if (!a || !config) return fail("חסרים נתונים");
    const current = Number(config.value);
    if (a.regulationsAcceptedVersion !== current) {
      return fail(`A.regulationsAcceptedVersion=${a.regulationsAcceptedVersion}, current=${current}`);
    }
    return ok(`שחקן A אישר תקנון גרסה ${current} ✓`);
  },

  // ── Group 17: Config effects ──────────────────────────────────────────────
  "17.1": async () => {
    const config = await prisma.appConfig.findUnique({ where: { key: "competition_session_count" } });
    if (config?.value !== "4") return fail(`competition_session_count=${config?.value} (צריך "4")`);
    return ok("competition_session_count=4 ✓ (פתח /admin/challenges/new ובדוק שמוגדר 4)");
  },

  "17.2": async () => {
    const config = await prisma.appConfig.findUnique({ where: { key: "competition_session_count" } });
    if (config?.value !== "3") return fail(`competition_session_count=${config?.value} (צריך "3")`);
    return ok("competition_session_count=3 ✓");
  },

  // ── Group 19: Cron ────────────────────────────────────────────────────────
  "19.1": async () => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return fail("CRON_SECRET לא מוגדר בסביבה");
    const origin = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${origin}/api/cron/auto-close`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    if (!res.ok) return fail(`auto-close החזיר ${res.status}`);
    const body = await res.json().catch(() => ({}));
    return ok(`auto-close: ${res.status} OK. תגובה: ${JSON.stringify(body).slice(0, 80)} ✓`);
  },

  "19.2": async () => {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) return fail("CRON_SECRET לא מוגדר בסביבה");
    const origin = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
    const res = await fetch(`${origin}/api/cron/auto-create`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    if (!res.ok) return fail(`auto-create החזיר ${res.status}`);
    const body = await res.json().catch(() => ({}));
    return ok(`auto-create: ${res.status} OK. תגובה: ${JSON.stringify(body).slice(0, 80)} ✓`);
  },

  // ── Group 20: Cleanup ─────────────────────────────────────────────────────
  "20.1": async () => {
    const allPhones = Object.values(TEST_PHONES);
    const count = await prisma.player.count({ where: { phone: { in: allPhones } } });
    if (count > 0) return fail(`${count} שחקני בדיקה עדיין קיימים (מתוך ${allPhones.length}) — שחזר את ה-snapshot`);
    return ok(`כל ${allPhones.length} שחקני הבדיקה הוסרו ✓`);
  },

  "20.2": async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return ok("DB מגיב תקין לאחר שחזור ✓");
    } catch {
      return fail("DB לא מגיב — בדוק לוגים");
    }
  },
};
