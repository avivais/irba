"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlayerSessionPlayerId } from "@/lib/player-session";
import { writeAuditLog } from "@/lib/audit";
import { recalculateAllComputedRanks } from "@/lib/computed-rank";

export type SubmitPeerRatingState = {
  ok: boolean;
  message?: string;
};

export async function submitPeerRatingAction(
  sessionId: string,
  orderedPlayerIds: string[],
): Promise<SubmitPeerRatingState> {
  const raterId = await getPlayerSessionPlayerId();
  if (!raterId) return { ok: false, message: "יש להתחבר תחילה" };

  // Confirm rater is REGISTERED
  const rater = await prisma.player.findUnique({
    where: { id: raterId },
    select: { playerKind: true },
  });
  if (!rater || rater.playerKind !== "REGISTERED") {
    return { ok: false, message: "תכונה זו זמינה לשחקנים קבועים בלבד" };
  }

  // Confirm session is open
  const session = await prisma.peerRatingSession.findUnique({
    where: { id: sessionId },
    select: { closedAt: true },
  });
  if (!session) return { ok: false, message: "שאלון לא נמצא" };
  if (session.closedAt) return { ok: false, message: "השאלון כבר סגור" };

  // Validate orderedPlayerIds = all REGISTERED players except self
  const registeredPlayers = await prisma.player.findMany({
    where: { playerKind: "REGISTERED", id: { not: raterId } },
    select: { id: true },
  });
  const expectedIds = new Set(registeredPlayers.map((p) => p.id));
  const submittedIds = new Set(orderedPlayerIds);
  if (
    submittedIds.size !== expectedIds.size ||
    ![...expectedIds].every((id) => submittedIds.has(id))
  ) {
    return { ok: false, message: "רשימת השחקנים אינה תקינה" };
  }

  // Upsert ratings in a transaction
  await prisma.$transaction([
    prisma.peerRating.deleteMany({
      where: { ratingSessionId: sessionId, raterId },
    }),
    prisma.peerRating.createMany({
      data: orderedPlayerIds.map((ratedPlayerId, index) => ({
        ratingSessionId: sessionId,
        raterId,
        ratedPlayerId,
        position: index + 1,
      })),
    }),
  ]);

  writeAuditLog({
    actor: raterId,
    action: "SUBMIT_PEER_RATING",
    entityType: "PeerRatingSession",
    entityId: sessionId,
    after: { count: orderedPlayerIds.length },
  });

  // Recalculate ranks with fresh peer data
  await recalculateAllComputedRanks(raterId);

  redirect("/profile");
}

export type PeerRatingPageData =
  | { type: "not_logged_in" }
  | { type: "drop_in" }
  | { type: "no_session" }
  | {
      type: "ready";
      sessionId: string;
      year: number;
      players: { id: string; displayName: string }[];
      existingOrder: string[] | null;
    };

export async function fetchPeerRatingPageDataAction(): Promise<PeerRatingPageData> {
  const playerId = await getPlayerSessionPlayerId();
  if (!playerId) return { type: "not_logged_in" };

  const [player, openSession] = await Promise.all([
    prisma.player.findUnique({
      where: { id: playerId },
      select: { playerKind: true },
    }),
    prisma.peerRatingSession.findFirst({
      where: { closedAt: null },
      select: { id: true, year: true },
    }),
  ]);

  if (!player || player.playerKind !== "REGISTERED") return { type: "drop_in" };
  if (!openSession) return { type: "no_session" };

  const [registeredPlayers, existingRatings] = await Promise.all([
    prisma.player.findMany({
      where: { playerKind: "REGISTERED", id: { not: playerId } },
      orderBy: [{ rank: "desc" }, { nickname: "asc" }],
      select: {
        id: true,
        nickname: true,
        firstNameHe: true,
        lastNameHe: true,
        firstNameEn: true,
        lastNameEn: true,
        phone: true,
        rank: true,
        computedRank: true,
      },
    }),
    prisma.peerRating.findMany({
      where: { ratingSessionId: openSession.id, raterId: playerId },
      orderBy: { position: "asc" },
      select: { ratedPlayerId: true },
    }),
  ]);

  const players = registeredPlayers.map((p) => ({
    id: p.id,
    displayName: p.nickname ?? p.firstNameHe ?? p.firstNameEn ?? p.phone,
  }));

  const existingOrder =
    existingRatings.length > 0
      ? existingRatings.map((r) => r.ratedPlayerId)
      : null;

  return {
    type: "ready",
    sessionId: openSession.id,
    year: openSession.year,
    players,
    existingOrder,
  };
}
