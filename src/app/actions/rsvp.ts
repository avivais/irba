"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getNextGame } from "@/lib/game";
import { prisma } from "@/lib/prisma";
import { parseAttendFormFields } from "@/lib/rsvp-validation";
import {
  consumeRsvpRateLimit,
  getClientIpFromHeaders,
} from "@/lib/rate-limit";
import { getSessionPlayerId, setRsvpSessionCookie } from "@/lib/rsvp-session";

export type RsvpActionState = { ok: boolean; message?: string };

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
  if (game.isClosed) {
    return { ok: false, message: "ההרשמה למפגש סגורה" };
  }

  let playerId: string;

  try {
    playerId = await prisma.$transaction(async (tx) => {
      const gameRow = await tx.gameSession.findUnique({
        where: { id: game.id },
      });
      if (!gameRow || gameRow.isClosed) {
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
  revalidatePath("/");
  return { ok: true, message: "נרשמת בהצלחה" };
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

  const game = await getNextGame();
  if (!game) {
    return { ok: false, message: "אין מפגש מתוזמן" };
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

  revalidatePath("/");
  return { ok: true, message: "ביטלת את ההרשמה" };
}
