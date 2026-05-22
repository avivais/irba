import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sortAttendancesByPrecedence } from "@/lib/sort-attendances";
import { writeAuditLog } from "@/lib/audit";
import { normalizeAssistantPhone } from "../actor";
import { AssistantApiError } from "../errors";
import { getNextAssistantSession, getSafeAssistantDisplayName } from "./session-status";
import type { AssistantActor } from "../types";

const paramsSchema = z.object({ player_phone: z.string() }).strict();

export type AssistantRosterRemoveData = {
  session_id: string;
  session_date: string;
  player: { id: string; display_name: string; phone: string };
  was_confirmed: boolean;
  confirmed_count: number;
  waitlisted_count: number;
  promoted_player: { display_name: string; phone: string } | null;
};

export async function assistantRosterRemove(params: unknown, actor: AssistantActor): Promise<AssistantRosterRemoveData> {
  const { player_phone } = paramsSchema.parse(params ?? {});

  const session = await getNextAssistantSession();
  if (!session) throw new AssistantApiError("SESSION_NOT_FOUND", "No upcoming session found", 404);
  if (session.isClosed) throw new AssistantApiError("SESSION_CLOSED", "Session is closed for changes", 409);

  const normalizedPhone = normalizeAssistantPhone(player_phone);
  const player = await prisma.player.findUnique({
    where: { phone: normalizedPhone },
    select: { id: true, phone: true, nickname: true, firstNameHe: true, lastNameHe: true, firstNameEn: true, lastNameEn: true },
  });
  if (!player) throw new AssistantApiError("PLAYER_NOT_FOUND", "Player not found", 404);

  const attendanceRow = await prisma.attendance.findFirst({
    where: { playerId: player.id, gameSessionId: session.id },
    select: { id: true },
  });
  if (!attendanceRow) throw new AssistantApiError("NOT_REGISTERED", "Player is not registered for this session", 409);

  // Fetch sorted attendances before delete to determine was_confirmed and first waitlisted
  const preDeleteSession = await prisma.gameSession.findUnique({
    where: { id: session.id },
    include: { attendances: { include: { player: true } } },
  });
  const sortedBefore = await sortAttendancesByPrecedence(preDeleteSession!.attendances, preDeleteSession!.date.getFullYear());
  const positionBefore = sortedBefore.findIndex((a) => a.playerId === player.id) + 1;
  const wasConfirmed = positionBefore <= session.maxPlayers;
  const waitlistedBefore = sortedBefore.slice(session.maxPlayers);
  const firstWaitlisted = wasConfirmed && waitlistedBefore.length > 0 ? waitlistedBefore[0] : null;

  try {
    await prisma.attendance.delete({ where: { id: attendanceRow.id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      // Race: already gone — treat as success
    } else {
      throw e;
    }
  }

  writeAuditLog({
    actor: actor.player!.id,
    action: "ASSISTANT_ROSTER_REMOVE",
    entityType: "Attendance",
    entityId: attendanceRow.id,
    before: { sessionId: session.id, playerId: player.id, playerPhone: player.phone },
    after: firstWaitlisted
      ? { promotedPlayerId: firstWaitlisted.player.id, promotedPlayerPhone: firstWaitlisted.player.phone }
      : null,
  });

  const postDeleteSession = await prisma.gameSession.findUnique({
    where: { id: session.id },
    include: { attendances: { include: { player: true } } },
  });
  const sortedAfter = await sortAttendancesByPrecedence(postDeleteSession!.attendances, postDeleteSession!.date.getFullYear());
  const confirmedCount = Math.min(sortedAfter.length, session.maxPlayers);
  const waitlistedCount = Math.max(sortedAfter.length - session.maxPlayers, 0);

  return {
    session_id: session.id,
    session_date: session.date.toISOString(),
    player: {
      id: player.id,
      display_name: getSafeAssistantDisplayName(player),
      phone: player.phone,
    },
    was_confirmed: wasConfirmed,
    confirmed_count: confirmedCount,
    waitlisted_count: waitlistedCount,
    promoted_player: firstWaitlisted
      ? {
          display_name: getSafeAssistantDisplayName(firstWaitlisted.player),
          phone: firstWaitlisted.player.phone,
        }
      : null,
  };
}
