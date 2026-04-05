"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-guard";
import { writeAuditLog } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export type MatchActionResult = { ok: boolean; message?: string };

function validateMatchInput(
  teamAPlayerIds: string[],
  teamBPlayerIds: string[],
  scoreA: number,
  scoreB: number,
  confirmedIds: Set<string>,
): string | null {
  if (teamAPlayerIds.length < 1) return "קבוצה א׳ חייבת לכלול לפחות שחקן אחד";
  if (teamBPlayerIds.length < 1) return "קבוצה ב׳ חייבת לכלול לפחות שחקן אחד";
  const overlap = teamAPlayerIds.filter((id) => teamBPlayerIds.includes(id));
  if (overlap.length > 0) return "שחקן לא יכול להיות בשתי הקבוצות";
  const allIds = [...teamAPlayerIds, ...teamBPlayerIds];
  if (allIds.some((id) => !confirmedIds.has(id))) return "שחקן שנבחר אינו רשום למפגש זה";
  if (!Number.isInteger(scoreA) || scoreA < 0) return "תוצאת קבוצה א׳ לא תקינה";
  if (!Number.isInteger(scoreB) || scoreB < 0) return "תוצאת קבוצה ב׳ לא תקינה";
  return null;
}

async function getConfirmedIds(sessionId: string): Promise<Set<string>> {
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: {
      maxPlayers: true,
      attendances: { orderBy: { createdAt: "asc" }, select: { playerId: true } },
    },
  });
  if (!session) return new Set();
  return new Set(session.attendances.slice(0, session.maxPlayers).map((a) => a.playerId));
}

export async function createMatchAction(
  sessionId: string,
  teamAPlayerIds: string[],
  teamBPlayerIds: string[],
  scoreA: number,
  scoreB: number,
): Promise<MatchActionResult> {
  await requireAdmin();
  const confirmedIds = await getConfirmedIds(sessionId);
  if (confirmedIds.size === 0) return { ok: false, message: "מפגש לא נמצא" };
  const err = validateMatchInput(teamAPlayerIds, teamBPlayerIds, scoreA, scoreB, confirmedIds);
  if (err) return { ok: false, message: err };

  const match = await prisma.match.create({
    data: { sessionId, teamAPlayerIds, teamBPlayerIds, scoreA, scoreB },
  });
  writeAuditLog({
    actor: "admin",
    action: "CREATE_MATCH",
    entityType: "Match",
    entityId: match.id,
    after: { sessionId, teamAPlayerIds, teamBPlayerIds, scoreA, scoreB },
  });
  revalidatePath(`/admin/sessions/${sessionId}`);
  return { ok: true };
}

export async function updateMatchAction(
  matchId: string,
  sessionId: string,
  teamAPlayerIds: string[],
  teamBPlayerIds: string[],
  scoreA: number,
  scoreB: number,
): Promise<MatchActionResult> {
  await requireAdmin();
  const existing = await prisma.match.findUnique({ where: { id: matchId } });
  if (!existing || existing.sessionId !== sessionId) return { ok: false, message: "משחק לא נמצא" };
  const confirmedIds = await getConfirmedIds(sessionId);
  const err = validateMatchInput(teamAPlayerIds, teamBPlayerIds, scoreA, scoreB, confirmedIds);
  if (err) return { ok: false, message: err };

  await prisma.match.update({
    where: { id: matchId },
    data: {
      teamAPlayerIds: { set: teamAPlayerIds },
      teamBPlayerIds: { set: teamBPlayerIds },
      scoreA,
      scoreB,
    },
  });
  writeAuditLog({
    actor: "admin",
    action: "UPDATE_MATCH",
    entityType: "Match",
    entityId: matchId,
    before: {
      teamAPlayerIds: existing.teamAPlayerIds,
      teamBPlayerIds: existing.teamBPlayerIds,
      scoreA: existing.scoreA,
      scoreB: existing.scoreB,
    },
    after: { teamAPlayerIds, teamBPlayerIds, scoreA, scoreB },
  });
  revalidatePath(`/admin/sessions/${sessionId}`);
  return { ok: true };
}

export async function deleteMatchAction(
  matchId: string,
  sessionId: string,
): Promise<MatchActionResult> {
  await requireAdmin();
  const existing = await prisma.match.findUnique({ where: { id: matchId } });
  if (!existing || existing.sessionId !== sessionId) return { ok: false, message: "משחק לא נמצא" };
  await prisma.match.delete({ where: { id: matchId } });
  writeAuditLog({
    actor: "admin",
    action: "DELETE_MATCH",
    entityType: "Match",
    entityId: matchId,
    before: {
      teamAPlayerIds: existing.teamAPlayerIds,
      teamBPlayerIds: existing.teamBPlayerIds,
      scoreA: existing.scoreA,
      scoreB: existing.scoreB,
    },
  });
  revalidatePath(`/admin/sessions/${sessionId}`);
  return { ok: true };
}
