"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { recalculateAllComputedRanks } from "@/lib/computed-rank";
import { getPlayerSessionPlayerId } from "@/lib/player-session";

export type RankingSessionActionState = {
  ok: boolean;
  message?: string;
};

// ---------------------------------------------------------------------------
// Open a new peer rating session for a given year
// ---------------------------------------------------------------------------

export async function openPeerRatingSessionAction(
  _prev: RankingSessionActionState,
  formData: FormData,
): Promise<RankingSessionActionState> {
  const adminId = await requireAdmin();

  const yearStr = formData.get("year")?.toString() ?? "";
  const year = parseInt(yearStr, 10);
  if (isNaN(year) || year < 2000 || year > 2100) {
    return { ok: false, message: "שנה לא תקינה" };
  }

  // Only one open session at a time
  const openSession = await prisma.peerRatingSession.findFirst({
    where: { closedAt: null },
  });
  if (openSession) {
    return { ok: false, message: `כבר קיים שאלון פתוח לשנת ${openSession.year}` };
  }

  const session = await prisma.peerRatingSession.create({
    data: { year, openedBy: adminId },
  });

  writeAuditLog({
    actor: adminId,
    action: "OPEN_PEER_RATING_SESSION",
    entityType: "PeerRatingSession",
    entityId: session.id,
    after: { year },
  });

  revalidatePath("/admin/ranking");
  return { ok: true, message: `שאלון לשנת ${year} נפתח` };
}

// ---------------------------------------------------------------------------
// Close an open peer rating session (triggers rank recalculation)
// ---------------------------------------------------------------------------

export async function closePeerRatingSessionAction(
  sessionId: string,
): Promise<RankingSessionActionState> {
  const adminId = await requireAdmin();

  const session = await prisma.peerRatingSession.findUnique({
    where: { id: sessionId },
    include: { _count: { select: { ratings: true } } },
  });
  if (!session) return { ok: false, message: "שאלון לא נמצא" };
  if (session.closedAt) return { ok: false, message: "השאלון כבר סגור" };

  await prisma.peerRatingSession.update({
    where: { id: sessionId },
    data: { closedAt: new Date() },
  });

  writeAuditLog({
    actor: adminId,
    action: "CLOSE_PEER_RATING_SESSION",
    entityType: "PeerRatingSession",
    entityId: sessionId,
    after: { year: session.year },
  });

  await recalculateAllComputedRanks(adminId);

  revalidatePath("/admin/ranking");
  revalidatePath("/admin/players");
  return { ok: true, message: `שאלון לשנת ${session.year} נסגר ודירוגים חושבו מחדש` };
}

// ---------------------------------------------------------------------------
// Delete a peer rating session (and cascade-delete its ratings)
// ---------------------------------------------------------------------------

export async function deletePeerRatingSessionAction(
  sessionId: string,
): Promise<RankingSessionActionState> {
  const adminId = await requireAdmin();

  const session = await prisma.peerRatingSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) return { ok: false, message: "שאלון לא נמצא" };

  await prisma.peerRatingSession.delete({ where: { id: sessionId } });

  writeAuditLog({
    actor: adminId,
    action: "DELETE_PEER_RATING_SESSION",
    entityType: "PeerRatingSession",
    entityId: sessionId,
    before: { year: session.year },
  });

  revalidatePath("/admin/ranking");
  return { ok: true, message: `שאלון לשנת ${session.year} נמחק` };
}

// ---------------------------------------------------------------------------
// Manual "recalculate all ranks" button
// ---------------------------------------------------------------------------

export async function recalculateRanksAction(): Promise<RankingSessionActionState> {
  const adminId = await requireAdmin();
  const { updatedCount } = await recalculateAllComputedRanks(adminId);
  revalidatePath("/admin/players");
  revalidatePath("/admin/ranking");
  return { ok: true, message: `דירוגים חושבו מחדש — ${updatedCount} שחקנים עודכנו` };
}

// ---------------------------------------------------------------------------
// Fetch session submission summary (for display)
// ---------------------------------------------------------------------------

export type PeerRatingSessionSummary = {
  id: string;
  year: number;
  openedAt: Date;
  closedAt: Date | null;
  submitterCount: number;
  totalRegistered: number;
  /** Only for closed sessions: sorted by peer score desc */
  results?: { displayName: string; avgPosition: number; peerScore: number }[];
};

export async function fetchRankingSessionsAction(): Promise<PeerRatingSessionSummary[]> {
  await requireAdmin();

  const [sessions, totalRegistered, players] = await Promise.all([
    prisma.peerRatingSession.findMany({
      orderBy: { year: "desc" },
      include: { ratings: true },
    }),
    prisma.player.count({ where: { playerKind: "REGISTERED" } }),
    prisma.player.findMany({
      where: { playerKind: "REGISTERED" },
      select: {
        id: true,
        nickname: true,
        firstNameHe: true,
        lastNameHe: true,
        firstNameEn: true,
        lastNameEn: true,
        phone: true,
      },
    }),
  ]);

  const nameById = new Map(
    players.map((p) => [
      p.id,
      p.nickname ?? p.firstNameHe ?? p.firstNameEn ?? p.phone,
    ]),
  );

  return sessions.map((s) => {
    const submitterCount = new Set(s.ratings.map((r) => r.raterId)).size;
    const summary: PeerRatingSessionSummary = {
      id: s.id,
      year: s.year,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      submitterCount,
      totalRegistered,
    };

    if (s.closedAt) {
      const positionsByPlayer = new Map<string, number[]>();
      for (const r of s.ratings) {
        const arr = positionsByPlayer.get(r.ratedPlayerId) ?? [];
        arr.push(r.position);
        positionsByPlayer.set(r.ratedPlayerId, arr);
      }
      const N = positionsByPlayer.size;
      const results = Array.from(positionsByPlayer.entries())
        .map(([playerId, positions]) => {
          const avg = positions.reduce((a, b) => a + b, 0) / positions.length;
          const peerScore =
            N <= 1 ? 100 : (1 - (avg - 1) / (N - 1)) * 100;
          return {
            displayName: nameById.get(playerId) ?? "שחקן",
            avgPosition: avg,
            peerScore,
          };
        })
        .sort((a, b) => b.peerScore - a.peerScore);
      summary.results = results;
    }

    return summary;
  });
}

// ---------------------------------------------------------------------------
// Check if current player has a pending (unsubmitted) rating
// ---------------------------------------------------------------------------

export type PendingRatingInfo =
  | { hasPending: false }
  | { hasPending: true; sessionId: string; year: number };

export async function checkPendingPeerRatingAction(): Promise<PendingRatingInfo> {
  const playerId = await getPlayerSessionPlayerId();
  if (!playerId) return { hasPending: false };

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { playerKind: true },
  });
  if (!player || player.playerKind !== "REGISTERED") return { hasPending: false };

  const openSession = await prisma.peerRatingSession.findFirst({
    where: { closedAt: null },
    select: { id: true, year: true },
  });
  if (!openSession) return { hasPending: false };

  const existing = await prisma.peerRating.findFirst({
    where: { ratingSessionId: openSession.id, raterId: playerId },
  });
  if (existing) return { hasPending: false };

  return { hasPending: true, sessionId: openSession.id, year: openSession.year };
}
