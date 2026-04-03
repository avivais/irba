"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionSubject } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { parseSessionForm } from "@/lib/session-validation";
import { getAllConfigs, getConfigInt, CONFIG } from "@/lib/config";
import { notifySessionOpen, notifySessionClose } from "@/lib/wa-notify";
import { writeAuditLog } from "@/lib/audit";

/** Return the UTC start and end of the calendar day containing `date` in Israel timezone. */
function israelDayBounds(date: Date): { gte: Date; lt: Date } {
  const dayStr = date.toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }); // "YYYY-MM-DD"
  const midnightRef = new Date(dayStr + "T00:00Z");
  const midnightIsrael = midnightRef
    .toLocaleString("sv-SE", { timeZone: "Asia/Jerusalem" })
    .replace(" ", "T")
    .slice(0, 16);
  const offsetMs = new Date(midnightIsrael + "Z").getTime() - midnightRef.getTime();
  const gte = new Date(midnightRef.getTime() - offsetMs);
  const lt = new Date(gte.getTime() + 86_400_000);
  return { gte, lt };
}

export type SessionActionState = { ok: boolean; message?: string };

const GENERIC_ERROR = "אירעה שגיאה. נסה שוב מאוחר יותר.";

async function requireAdmin(): Promise<void> {
  const subject = await getAdminSessionSubject();
  if (!subject) redirect("/admin/login");
}

/** Check whether any existing session is still running (endTime > now). */
async function hasActiveSession(excludeId?: string): Promise<boolean> {
  const configs = await getAllConfigs();
  const defaultDuration = parseInt(configs[CONFIG.SESSION_DEFAULT_DURATION_MIN], 10);
  const now = new Date();
  // Look back up to 24h to find recently-started sessions
  const candidates = await prisma.gameSession.findMany({
    where: {
      date: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, date: true, durationMinutes: true },
  });
  return candidates.some((s) => {
    const duration = s.durationMinutes ?? defaultDuration;
    const endTime = new Date(s.date.getTime() + duration * 60 * 1000);
    return endTime > now;
  });
}

export async function createSessionAction(
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  await requireAdmin();

  const raw: Record<string, string | undefined> = {
    date: formData.get("date")?.toString(),
    maxPlayers: formData.get("maxPlayers")?.toString(),
    isClosed: formData.get("isClosed")?.toString(),
    durationMinutes: formData.get("durationMinutes")?.toString(),
    locationName: formData.get("locationName")?.toString(),
    locationLat: formData.get("locationLat")?.toString(),
    locationLng: formData.get("locationLng")?.toString(),
  };

  const validation = parseSessionForm(raw);
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const { date, maxPlayers, durationMinutes, locationName, locationLat, locationLng } = validation.data;

  const { gte, lt } = israelDayBounds(date);
  const existing = await prisma.gameSession.findFirst({
    where: { date: { gte, lt } },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, message: "כבר קיים מפגש ביום זה" };
  }

  if (await hasActiveSession()) {
    return { ok: false, message: "לא ניתן לפתוח מפגש חדש לפני שהמפגש הנוכחי הסתיים" };
  }

  let newSessionId: string;
  try {
    const created = await prisma.gameSession.create({
      data: { date, maxPlayers, isClosed: false, durationMinutes, locationName, locationLat, locationLng },
    });
    newSessionId = created.id;
  } catch (e) {
    console.error("createSessionAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: "admin",
    action: "CREATE_SESSION",
    entityType: "GameSession",
    entityId: newSessionId,
    after: { date: date.toISOString(), maxPlayers, durationMinutes, locationName },
  });

  // Auto-register the admin player
  const adminPlayer = await prisma.player.findFirst({
    where: { isAdmin: true },
    select: { id: true },
  });
  if (adminPlayer) {
    try {
      await prisma.attendance.create({
        data: { playerId: adminPlayer.id, gameSessionId: newSessionId },
      });
    } catch {
      // If attendance already exists (shouldn't happen on create), ignore
    }
  }

  // Notify WA group of new session (best-effort, fire-and-forget)
  // Per-session override: form may supply wa_override_session_open_enabled / wa_override_session_open_template
  const configs = await getAllConfigs();
  const overrideEnabledRaw = formData.get("wa_override_session_open_enabled")?.toString();
  const overrideTemplate = formData.get("wa_override_session_open_template")?.toString()?.trim();
  const waOverride = overrideEnabledRaw !== undefined
    ? {
        enabled: overrideEnabledRaw === "true",
        template: overrideTemplate || configs[CONFIG.WA_NOTIFY_SESSION_OPEN_TEMPLATE],
      }
    : undefined;
  const dateStr = date.toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  void notifySessionOpen(dateStr, configs, waOverride);

  revalidatePath("/admin/sessions");
  redirect(`/admin/sessions/${newSessionId}`);
}

export async function updateSessionAction(
  id: string,
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  await requireAdmin();

  const raw: Record<string, string | undefined> = {
    date: formData.get("date")?.toString(),
    maxPlayers: formData.get("maxPlayers")?.toString(),
    isClosed: formData.get("isClosed")?.toString(),
    durationMinutes: formData.get("durationMinutes")?.toString(),
    locationName: formData.get("locationName")?.toString(),
    locationLat: formData.get("locationLat")?.toString(),
    locationLng: formData.get("locationLng")?.toString(),
  };

  const validation = parseSessionForm(raw);
  if (!validation.ok) {
    const first = Object.values(validation.errors).find(Boolean);
    return { ok: false, message: first ?? "קלט לא תקין" };
  }

  const { date, maxPlayers, isClosed, durationMinutes, locationName, locationLat, locationLng } = validation.data;

  const { gte, lt } = israelDayBounds(date);
  const existing = await prisma.gameSession.findFirst({
    where: { date: { gte, lt }, NOT: { id } },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, message: "כבר קיים מפגש ביום זה" };
  }

  const before = await prisma.gameSession.findUnique({
    where: { id },
    select: { date: true, maxPlayers: true, isClosed: true, durationMinutes: true, locationName: true },
  });

  try {
    await prisma.gameSession.update({
      where: { id },
      data: { date, maxPlayers, isClosed, durationMinutes, locationName, locationLat, locationLng },
    });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      return { ok: false, message: "מפגש לא נמצא" };
    }
    console.error("updateSessionAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: "admin",
    action: "UPDATE_SESSION",
    entityType: "GameSession",
    entityId: id,
    before: before ? { ...before, date: before.date.toISOString() } : null,
    after: { date: date.toISOString(), maxPlayers, isClosed, durationMinutes, locationName },
  });

  revalidatePath(`/admin/sessions/${id}`);
  revalidatePath("/admin/sessions");
  revalidatePath("/");
  return { ok: true, message: "נשמר בהצלחה" };
}

export async function deleteSessionAction(
  id: string,
  _prev: SessionActionState,
  _formData: FormData,
): Promise<SessionActionState> {
  await requireAdmin();

  const count = await prisma.attendance.count({ where: { gameSessionId: id } });
  if (count > 0) {
    return {
      ok: false,
      message: `לא ניתן למחוק מפגש עם ${count} נרשמים`,
    };
  }

  const before = await prisma.gameSession.findUnique({
    where: { id },
    select: { date: true, maxPlayers: true, locationName: true },
  });

  try {
    await prisma.gameSession.delete({ where: { id } });
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      // Already deleted — treat as success
    } else {
      console.error("deleteSessionAction failed", e);
      return { ok: false, message: GENERIC_ERROR };
    }
  }

  writeAuditLog({
    actor: "admin",
    action: "DELETE_SESSION",
    entityType: "GameSession",
    entityId: id,
    before: before ? { ...before, date: before.date.toISOString() } : null,
  });

  revalidatePath("/admin/sessions");
  revalidatePath("/");
  return { ok: true, message: "המפגש נמחק" };
}

export async function archiveSessionAction(
  id: string,
  archive: boolean,
  _prev: SessionActionState,
  _formData: FormData,
): Promise<SessionActionState> {
  await requireAdmin();

  try {
    await prisma.gameSession.update({
      where: { id },
      data: { isArchived: archive },
    });
  } catch (e) {
    console.error("archiveSessionAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: "admin",
    action: archive ? "ARCHIVE_SESSION" : "UNARCHIVE_SESSION",
    entityType: "GameSession",
    entityId: id,
  });

  revalidatePath("/admin/sessions");
  revalidatePath(`/admin/sessions/${id}`);
  revalidatePath("/");
  return { ok: true, message: archive ? "המפגש הועבר לארכיון" : "המפגש שוחזר מהארכיון" };
}

export async function addAttendanceAction(
  sessionId: string,
  _prev: SessionActionState,
  formData: FormData,
): Promise<SessionActionState> {
  await requireAdmin();

  const playerId = formData.get("playerId")?.toString();
  if (!playerId) return { ok: false, message: "לא נבחר שחקן" };

  let attendanceId: string;
  try {
    const created = await prisma.attendance.create({
      data: { playerId, gameSessionId: sessionId },
      select: { id: true },
    });
    attendanceId = created.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: "השחקן כבר רשום למפגש זה" };
    }
    console.error("addAttendanceAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: "admin",
    action: "ADD_ATTENDANCE",
    entityType: "Attendance",
    entityId: attendanceId,
    after: { playerId, sessionId },
  });

  revalidatePath(`/admin/sessions/${sessionId}`);
  revalidatePath("/");
  return { ok: true, message: "השחקן נוסף" };
}

export async function removeAttendanceAction(
  sessionId: string,
  attendanceId: string,
  _prev: SessionActionState,
  _formData: FormData,
): Promise<SessionActionState> {
  await requireAdmin();

  const before = await prisma.attendance.findUnique({
    where: { id: attendanceId },
    select: { playerId: true, gameSessionId: true },
  });

  try {
    await prisma.attendance.delete({ where: { id: attendanceId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      // Already removed — treat as success
    } else {
      console.error("removeAttendanceAction failed", e);
      return { ok: false, message: GENERIC_ERROR };
    }
  }

  writeAuditLog({
    actor: "admin",
    action: "REMOVE_ATTENDANCE",
    entityType: "Attendance",
    entityId: attendanceId,
    before: before ?? null,
  });

  revalidatePath(`/admin/sessions/${sessionId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function toggleSessionAction(
  id: string,
  _prev: SessionActionState,
  _formData: FormData,
): Promise<SessionActionState> {
  await requireAdmin();

  const [session, closeHours] = await Promise.all([
    prisma.gameSession.findUnique({
      where: { id },
      select: { isClosed: true, date: true },
    }),
    getConfigInt(CONFIG.RSVP_CLOSE_HOURS),
  ]);

  if (!session) {
    return { ok: false, message: "מפגש לא נמצא" };
  }

  const newClosed = !session.isClosed;

  // Block re-opening a session that is within the RSVP close window
  if (!newClosed) {
    const windowStart = session.date.getTime() - closeHours * 3_600_000;
    if (Date.now() >= windowStart && Date.now() < session.date.getTime()) {
      return {
        ok: false,
        message: `לא ניתן לפתוח מחדש מפגש שנמצא בחלון סגירת ההרשמה (${closeHours} שעות לפני המפגש)`,
      };
    }
  }

  try {
    await prisma.gameSession.update({
      where: { id },
      data: { isClosed: newClosed },
    });
  } catch (e) {
    console.error("toggleSessionAction failed", e);
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: "admin",
    action: newClosed ? "CLOSE_SESSION" : "OPEN_SESSION",
    entityType: "GameSession",
    entityId: id,
  });

  revalidatePath("/admin/sessions");
  revalidatePath(`/admin/sessions/${id}`);
  revalidatePath("/");

  // Notify WA group when session is closed (best-effort, fire-and-forget)
  if (newClosed) {
    const configs = await getAllConfigs();
    const dateStr = session.date.toLocaleDateString("he-IL", {
      timeZone: "Asia/Jerusalem",
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    void notifySessionClose(dateStr, configs);
  }

  return { ok: true, message: newClosed ? "המפגש נסגר" : "המפגש נפתח" };
}
