"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getNextGame } from "@/lib/game";
import { getConfigInt, CONFIG } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { parseAttendFormFields } from "@/lib/rsvp-validation";
import {
  consumeRsvpRateLimit,
  getClientIpFromHeaders,
} from "@/lib/rate-limit";
import { getSessionPlayerId, setRsvpSessionCookie } from "@/lib/rsvp-session";
import { getPlayerSessionPlayerId } from "@/lib/player-session";
import { getAllConfigs } from "@/lib/config";
import { notifyPlayerRegistered, notifyPlayerCancelled } from "@/lib/wa-notify";
import { getPlayerDisplayName } from "@/lib/player-display";
import { writeAuditLog } from "@/lib/audit";

export type RsvpActionState = { ok: boolean; message?: string; isWaitlisted?: boolean };

const GENERIC_ERROR = "אירעה שגיאה. נסה שוב מאוחר יותר.";

const RATE_LIMIT_MESSAGE =
  "יותר מדי ניסיונות. נסה שוב בעוד כמה דקות.";

export async function attendAction(
  _prev: RsvpActionState,
  formData: FormData,
): Promise<RsvpActionState> {
  const nameField = formData.get("name");
  const phoneField = formData.get("phone");
  const parsed = parseAttendFormFields({
    name: typeof nameField === "string" ? nameField : "",
    phone: typeof phoneField === "string" ? phoneField : "",
  });

  if (!parsed.ok) {
    return { ok: false, message: parsed.message };
  }

  const phone = parsed.phoneNormalized;
  const name = parsed.name;

  const headerList = await headers();
  const clientIp = getClientIpFromHeaders((name) => headerList.get(name));
  if (!consumeRsvpRateLimit("attend", clientIp)) {
    return { ok: false, message: RATE_LIMIT_MESSAGE };
  }

  const game = await getNextGame();
  if (!game) {
    return { ok: false, message: "אין מפגש מתוזמן" };
  }
  // Allow registration until the session actually starts (not just the close window)
  const now = Date.now();
  if (game.isClosed || now >= game.date.getTime()) {
    return { ok: false, message: "ההרשמה למפגש סגורה" };
  }

  let playerId: string;

  try {
    playerId = await prisma.$transaction(async (tx) => {
      const gameRow = await tx.gameSession.findUnique({
        where: { id: game.id },
      });
      if (!gameRow || gameRow.isClosed || Date.now() >= gameRow.date.getTime()) {
        throw new Error("GAME_CLOSED");
      }

      const existing = await tx.player.findUnique({ where: { phone } });

      let pid: string;
      if (existing) {
        pid = existing.id;
        await tx.player.update({
          where: { id: existing.id },
          data: { firstNameHe: name },
        });
      } else {
        const created = await tx.player.create({
          data: {
            firstNameHe: name,
            phone,
            playerKind: "DROP_IN",
          },
        });
        pid = created.id;
      }

      const dup = await tx.attendance.findUnique({
        where: {
          playerId_gameSessionId: {
            playerId: pid,
            gameSessionId: game.id,
          },
        },
      });
      if (dup) {
        throw new Error("ALREADY_REGISTERED");
      }

      await tx.attendance.create({
        data: {
          playerId: pid,
          gameSessionId: game.id,
        },
      });

      return pid;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "GAME_CLOSED") {
      return { ok: false, message: "ההרשמה למפגש סגורה" };
    }
    if (e instanceof Error && e.message === "ALREADY_REGISTERED") {
      return { ok: false, message: "כבר נרשמת למפגש הזה" };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: "מספר הטלפון כבר רשום. נסה להתחבר שוב." };
    }
    console.error("attendAction failed");
    return { ok: false, message: GENERIC_ERROR };
  }

  await setRsvpSessionCookie(playerId);

  // Notify the WA group (best-effort, fire-and-forget)
  const [configs, attendanceCount] = await Promise.all([
    getAllConfigs(),
    prisma.attendance.count({ where: { gameSessionId: game.id } }),
  ]);
  const isConfirmed = attendanceCount <= game.maxPlayers;
  const status = isConfirmed ? "מאושר" : "רשימת המתנה";
  const dateStr = game.date.toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  void notifyPlayerRegistered(dateStr, name, status, configs);

  writeAuditLog({
    actor: phone,
    actorIp: clientIp,
    action: "RSVP_ATTEND",
    entityType: "Attendance",
    entityId: playerId,
    after: { phone, name, sessionId: game.id, status },
  });

  if (!isConfirmed) {
    redirect("/?waitlisted=1");
  }
  revalidatePath("/");
  return { ok: true, message: "נרשמת בהצלחה!" };
}

/**
 * RSVP for an already-authenticated player. Uses their player session
 * directly — no name/phone form fields needed.
 */
export async function rsvpAuthenticatedAction(
  _prev: RsvpActionState,
  _formData: FormData,
): Promise<RsvpActionState> {
  const headerList = await headers();
  const clientIp = getClientIpFromHeaders((name) => headerList.get(name));
  if (!consumeRsvpRateLimit("attend", clientIp)) {
    return { ok: false, message: RATE_LIMIT_MESSAGE };
  }

  const playerId = await getPlayerSessionPlayerId();
  if (!playerId) return { ok: false, message: "לא מחובר" };

  const game = await getNextGame();
  if (!game) return { ok: false, message: "אין מפגש מתוזמן" };
  if (game.isClosed || Date.now() >= game.date.getTime()) {
    return { ok: false, message: "ההרשמה למפגש סגורה" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const gameRow = await tx.gameSession.findUnique({ where: { id: game.id } });
      if (!gameRow || gameRow.isClosed || Date.now() >= gameRow.date.getTime()) {
        throw new Error("GAME_CLOSED");
      }
      const dup = await tx.attendance.findUnique({
        where: { playerId_gameSessionId: { playerId, gameSessionId: game.id } },
      });
      if (dup) throw new Error("ALREADY_REGISTERED");
      await tx.attendance.create({ data: { playerId, gameSessionId: game.id } });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "GAME_CLOSED") {
      return { ok: false, message: "ההרשמה למפגש סגורה" };
    }
    if (e instanceof Error && e.message === "ALREADY_REGISTERED") {
      return { ok: false, message: "כבר נרשמת למפגש הזה" };
    }
    console.error("rsvpAuthenticatedAction failed");
    return { ok: false, message: GENERIC_ERROR };
  }

  await setRsvpSessionCookie(playerId);

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { firstNameHe: true, lastNameHe: true, firstNameEn: true, lastNameEn: true, nickname: true, phone: true },
  });
  const name = player ? getPlayerDisplayName(player) : "שחקן";

  const [configs, attendanceCount] = await Promise.all([
    getAllConfigs(),
    prisma.attendance.count({ where: { gameSessionId: game.id } }),
  ]);
  const isConfirmed = attendanceCount <= game.maxPlayers;
  const status = isConfirmed ? "מאושר" : "רשימת המתנה";
  const dateStr = game.date.toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  void notifyPlayerRegistered(dateStr, name, status, configs);

  writeAuditLog({
    actor: player?.phone ?? playerId,
    actorIp: clientIp,
    action: "RSVP_ATTEND",
    entityType: "Attendance",
    entityId: playerId,
    after: { name, sessionId: game.id, status },
  });

  if (!isConfirmed) {
    redirect("/?waitlisted=1");
  }
  revalidatePath("/");
  return { ok: true, message: "נרשמת בהצלחה!" };
}

export async function cancelAttendanceAction(
  _prev: RsvpActionState,
  _formData: FormData,
): Promise<RsvpActionState> {
  const headerList = await headers();
  const clientIp = getClientIpFromHeaders((name) => headerList.get(name));
  if (!consumeRsvpRateLimit("cancel", clientIp)) {
    return { ok: false, message: RATE_LIMIT_MESSAGE };
  }

  const playerId = await getSessionPlayerId();
  if (!playerId) {
    return { ok: false, message: "לא נמצאה הרשמה פעילה" };
  }

  const [game, closeHours] = await Promise.all([
    getNextGame(),
    getConfigInt(CONFIG.RSVP_CLOSE_HOURS),
  ]);
  if (!game) {
    return { ok: false, message: "אין מפגש מתוזמן" };
  }

  // Determine if player is confirmed or on the waitlist
  const attendances = await prisma.attendance.findMany({
    where: { gameSessionId: game.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, playerId: true },
  });

  const playerIndex = attendances.findIndex((a) => a.playerId === playerId);
  if (playerIndex === -1) {
    return { ok: false, message: "לא נמצאה הרשמה פעילה" };
  }

  const isConfirmed = playerIndex < game.maxPlayers;
  const withinCloseWindow =
    Date.now() >= game.date.getTime() - closeHours * 3_600_000;

  // Confirmed players cannot cancel within the close window
  if (isConfirmed && withinCloseWindow) {
    return {
      ok: false,
      message: "ביטול הרשמה אינו אפשרי בשלב זה — פנה למנהל",
    };
  }

  let playerPhone = "";
  let playerName = "שחקן";
  try {
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      select: { firstNameHe: true, lastNameHe: true, firstNameEn: true, lastNameEn: true, nickname: true, phone: true },
    });
    if (player) {
      playerName = getPlayerDisplayName(player);
      playerPhone = player.phone;
    }
  } catch {
    // non-critical — name lookup failure should not block cancel
  }

  try {
    await prisma.attendance.deleteMany({
      where: {
        playerId,
        gameSessionId: game.id,
      },
    });
  } catch {
    console.error("cancelAttendanceAction failed");
    return { ok: false, message: GENERIC_ERROR };
  }

  writeAuditLog({
    actor: playerPhone || playerId,
    actorIp: clientIp,
    action: "RSVP_CANCEL",
    entityType: "Attendance",
    entityId: playerId,
    before: { playerId, sessionId: game.id, name: playerName },
  });

  // Notify the WA group (best-effort, fire-and-forget)
  const dateStr = game.date.toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const configs = await getAllConfigs();
  void notifyPlayerCancelled(dateStr, playerName, configs);

  revalidatePath("/");
  return { ok: true, message: "ביטלת את ההרשמה" };
}
