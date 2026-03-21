"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getNextGame } from "@/lib/game";
import { normalizePhone, PhoneValidationError } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { getSessionPlayerId, setRsvpSessionCookie } from "@/lib/rsvp-session";

const attendSchema = z.object({
  name: z.string().trim().min(1, "נא להזין שם").max(80),
  phone: z.string().min(1, "נא להזין מספר טלפון"),
});

export type RsvpActionState = { ok: boolean; message?: string };

const GENERIC_ERROR = "אירעה שגיאה. נסה שוב מאוחר יותר.";

export async function attendAction(
  _prev: RsvpActionState,
  formData: FormData,
): Promise<RsvpActionState> {
  const parsed = attendSchema.safeParse({
    name: typeof formData.get("name") === "string" ? formData.get("name") : "",
    phone: typeof formData.get("phone") === "string" ? formData.get("phone") : "",
  });

  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message ?? "קלט לא תקין";
    return { ok: false, message: msg };
  }

  let phone: string;
  try {
    phone = normalizePhone(parsed.data.phone);
  } catch (e) {
    if (e instanceof PhoneValidationError) {
      return {
        ok: false,
        message: "מספר הטלפון חייב להיות ישראלי בפורמט 05xxxxxxxx",
      };
    }
    throw e;
  }

  const game = await getNextGame();
  if (!game) {
    return { ok: false, message: "אין אימון מתוזמן" };
  }
  if (game.isClosed) {
    return { ok: false, message: "ההרשמה לאימון סגורה" };
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
          data: { name: parsed.data.name },
        });
      } else {
        const created = await tx.player.create({
          data: {
            name: parsed.data.name,
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
      return { ok: false, message: "ההרשמה לאימון סגורה" };
    }
    if (e instanceof Error && e.message === "ALREADY_REGISTERED") {
      return { ok: false, message: "כבר נרשמת לאימון הזה" };
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
  const playerId = await getSessionPlayerId();
  if (!playerId) {
    return { ok: false, message: "לא נמצאה הרשמה פעילה" };
  }

  const game = await getNextGame();
  if (!game) {
    return { ok: false, message: "אין אימון מתוזמן" };
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
