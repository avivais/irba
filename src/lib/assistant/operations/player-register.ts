import { z } from "zod";
import { Prisma } from "@prisma/client";
import { CONFIG, getConfigInt } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { sortAttendancesByPrecedence } from "@/lib/sort-attendances";
import { writeAuditLog } from "@/lib/audit";
import { AssistantApiError } from "../errors";
import { getNextAssistantSession, getSafeAssistantDisplayName } from "./session-status";
import type { AssistantActor } from "../types";

const emptyParamsSchema = z.object({}).strict();

type PlayerForAssistant = {
  id: string;
  phone: string;
  nickname: string | null;
  firstNameHe: string | null;
  lastNameHe: string | null;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
};

type PlayerResponse = { id: string; display_name: string; phone: string };

export type AssistantPlayerRegisterAddData = {
  session_id: string;
  session_date: string;
  player: PlayerResponse;
  status: "confirmed" | "waitlisted";
  position: number;
  confirmed_count: number;
  waitlisted_count: number;
};

export type AssistantPlayerRegisterCancelData = {
  session_id: string;
  session_date: string;
  player: PlayerResponse;
  was_confirmed: boolean;
  confirmed_count: number;
  waitlisted_count: number;
  promoted_player: { display_name: string; phone: string } | null;
};

export type AssistantPlayerRegisterStatusData = {
  session_id: string;
  session_date: string;
  player: { id: string; display_name: string; phone: string };
  registered: boolean;
  status: "confirmed" | "waitlisted" | null;
  position: number | null;
  confirmed_count: number;
  waitlisted_count: number;
};

export async function assistantPlayerRegisterAdd(
  params: unknown,
  actor: AssistantActor,
): Promise<AssistantPlayerRegisterAddData> {
  emptyParamsSchema.parse(params ?? {});
  const player = requireKnownActor(actor);

  const session = await getNextAssistantSession();
  if (!session) throw new AssistantApiError("SESSION_NOT_FOUND", "No upcoming session found", 404);
  if (session.isClosed || Date.now() >= session.date.getTime()) {
    throw new AssistantApiError("SESSION_CLOSED", "Session is closed for registration", 409);
  }

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
    actor: player.id,
    action: "ASSISTANT_SELF_REGISTER_ADD",
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

  return {
    session_id: session.id,
    session_date: session.date.toISOString(),
    player: toPlayerResponse(player),
    status: position <= session.maxPlayers ? "confirmed" : "waitlisted",
    position,
    confirmed_count: confirmedCount,
    waitlisted_count: waitlistedCount,
  };
}

export async function assistantPlayerRegisterCancel(
  params: unknown,
  actor: AssistantActor,
): Promise<AssistantPlayerRegisterCancelData> {
  emptyParamsSchema.parse(params ?? {});
  const player = requireKnownActor(actor);

  const session = await getNextAssistantSession();
  if (!session) throw new AssistantApiError("SESSION_NOT_FOUND", "No upcoming session found", 404);

  const attendanceRow = await prisma.attendance.findFirst({
    where: { playerId: player.id, gameSessionId: session.id },
    select: { id: true },
  });
  if (!attendanceRow) throw new AssistantApiError("NOT_REGISTERED", "Player is not registered for this session", 409);

  const preDeleteSession = await prisma.gameSession.findUnique({
    where: { id: session.id },
    include: { attendances: { include: { player: true } } },
  });
  const sortedBefore = await sortAttendancesByPrecedence(preDeleteSession!.attendances, preDeleteSession!.date.getFullYear());
  const positionBefore = sortedBefore.findIndex((a) => a.playerId === player.id) + 1;
  const wasConfirmed = positionBefore > 0 && positionBefore <= session.maxPlayers;
  const waitlistedBefore = sortedBefore.slice(session.maxPlayers);
  const firstWaitlisted = wasConfirmed && waitlistedBefore.length > 0 ? waitlistedBefore[0] : null;

  const closeHours = await getConfigInt(CONFIG.RSVP_CLOSE_HOURS);
  const withinCloseWindow = Date.now() >= session.date.getTime() - closeHours * 3_600_000;
  if (wasConfirmed && withinCloseWindow) {
    throw new AssistantApiError(
      "CANCEL_WINDOW_CLOSED",
      "Confirmed player cancellation is closed; contact an admin",
      409,
    );
  }

  try {
    await prisma.attendance.delete({ where: { id: attendanceRow.id } });
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")) throw e;
  }

  writeAuditLog({
    actor: player.id,
    action: "ASSISTANT_SELF_REGISTER_CANCEL",
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

  return {
    session_id: session.id,
    session_date: session.date.toISOString(),
    player: toPlayerResponse(player),
    was_confirmed: wasConfirmed,
    confirmed_count: Math.min(sortedAfter.length, session.maxPlayers),
    waitlisted_count: Math.max(sortedAfter.length - session.maxPlayers, 0),
    promoted_player: firstWaitlisted
      ? {
          display_name: getSafeAssistantDisplayName(firstWaitlisted.player),
          phone: firstWaitlisted.player.phone,
        }
      : null,
  };
}

export async function assistantPlayerRegisterStatus(
  params: unknown,
  actor: AssistantActor,
): Promise<AssistantPlayerRegisterStatusData> {
  emptyParamsSchema.parse(params ?? {});
  const player = requireKnownActor(actor);

  const session = await getNextAssistantSession();
  if (!session) throw new AssistantApiError("SESSION_NOT_FOUND", "No upcoming session found", 404);

  const sorted = await sortAttendancesByPrecedence(session.attendances, session.date.getFullYear());
  const position = sorted.findIndex((a) => a.playerId === player.id) + 1;
  const registered = position > 0;

  return {
    session_id: session.id,
    session_date: session.date.toISOString(),
    player: toPlayerResponse(player),
    registered,
    status: registered ? (position <= session.maxPlayers ? "confirmed" : "waitlisted") : null,
    position: registered ? position : null,
    confirmed_count: Math.min(sorted.length, session.maxPlayers),
    waitlisted_count: Math.max(sorted.length - session.maxPlayers, 0),
  };
}

function requireKnownActor(actor: AssistantActor): PlayerForAssistant {
  if (actor.level === "guest" || !actor.player) {
    throw new AssistantApiError("FORBIDDEN_OPERATION", "Known player required for this operation", 403);
  }
  return actor.player;
}

function toPlayerResponse(player: PlayerForAssistant): PlayerResponse {
  return {
    id: player.id,
    display_name: getSafeAssistantDisplayName(player),
    phone: player.phone,
  };
}
