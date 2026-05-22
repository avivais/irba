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

export type AssistantRosterAddData = {
  session_id: string;
  session_date: string;
  player: { id: string; display_name: string; phone: string };
  status: "confirmed" | "waitlisted";
  position: number;
  confirmed_count: number;
  waitlisted_count: number;
};

export async function assistantRosterAdd(params: unknown, actor: AssistantActor): Promise<AssistantRosterAddData> {
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

  let attendanceId: string;
  try {
    const att = await prisma.attendance.create({
      data: { playerId: player.id, gameSessionId: session.id },
      select: { id: true },
    });
    attendanceId = att.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new AssistantApiError("ALREADY_REGISTERED", "Player is already registered for this session", 409);
    }
    throw e;
  }

  writeAuditLog({
    actor: actor.player!.id,
    action: "ASSISTANT_ROSTER_ADD",
    entityType: "Attendance",
    entityId: attendanceId,
    before: null,
    after: { sessionId: session.id, playerId: player.id, playerPhone: player.phone },
  });

  const updatedSession = await prisma.gameSession.findUnique({
    where: { id: session.id },
    include: { attendances: { include: { player: true } } },
  });
  const sorted = await sortAttendancesByPrecedence(updatedSession!.attendances, updatedSession!.date.getFullYear());

  const position = sorted.findIndex((a) => a.playerId === player.id) + 1;
  const confirmedCount = Math.min(sorted.length, session.maxPlayers);
  const waitlistedCount = Math.max(sorted.length - session.maxPlayers, 0);
  const status: "confirmed" | "waitlisted" = position <= session.maxPlayers ? "confirmed" : "waitlisted";

  return {
    session_id: session.id,
    session_date: session.date.toISOString(),
    player: {
      id: player.id,
      display_name: getSafeAssistantDisplayName(player),
      phone: player.phone,
    },
    status,
    position,
    confirmed_count: confirmedCount,
    waitlisted_count: waitlistedCount,
  };
}
