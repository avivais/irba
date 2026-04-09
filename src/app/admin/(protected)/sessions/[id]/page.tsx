import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getPlayerDisplayName } from "@/lib/player-display";
import { computePrecedenceScores } from "@/lib/precedence";
import { getAllConfigs } from "@/lib/config";
import { CONFIG } from "@/lib/config-keys";
import { SessionForm } from "@/components/admin/session-form";
import { SessionChargePanel } from "@/components/admin/session-charge-panel";
import { SessionRemoveButton } from "@/components/admin/session-remove-button";
import { SessionAddPlayerForm } from "@/components/admin/session-add-player-form";
import { SessionQuickDropInForm } from "@/components/admin/session-quick-dropin-form";
import { SessionArchiveButton } from "@/components/admin/session-archive-button";
import { SessionDeleteButton } from "@/components/admin/session-delete-button";
import { SessionPromoteButton } from "@/components/admin/session-promote-button";
import { SessionMatchPanel } from "@/components/admin/session-match-panel";
import { TeamBalancePanel } from "@/components/admin/team-balance-panel";

export const metadata: Metadata = { title: "עריכת מפגש" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function AdminSessionPage({ params }: Props) {
  const { id } = await params;

  const [session, yearWeights, config, chargesRaw, rateRaw, matchesRaw] = await Promise.all([
    prisma.gameSession.findUnique({
      where: { id },
      include: {
        attendances: {
          orderBy: { createdAt: "asc" },
          include: { player: true },
        },
        _count: { select: { attendances: true } },
      },
    }),
    prisma.yearWeight.findMany(),
    getAllConfigs(),
    prisma.sessionCharge.findMany({
      where: { sessionId: id },
      select: {
        id: true,
        playerId: true,
        amount: true,
        calculatedAmount: true,
        chargeType: true,
        player: { select: { id: true, firstNameHe: true, lastNameHe: true, firstNameEn: true, lastNameEn: true, nickname: true, phone: true } },
        auditEntries: {
          orderBy: { changedAt: "desc" },
          select: { changedAt: true, changedBy: true, previousAmount: true, newAmount: true, reason: true },
        },
      },
    }),
    prisma.hourlyRate.findFirst({
      where: { effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: "desc" },
      select: { pricePerHour: true },
    }),
    prisma.match.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        teamAPlayerIds: true,
        teamBPlayerIds: true,
        scoreA: true,
        scoreB: true,
        createdAt: true,
      },
    }),
  ]);
  if (!session) notFound();

  const confirmed = session.attendances.slice(0, session.maxPlayers);
  const confirmedAttendees = confirmed.map((a) => ({
    id: a.playerId,
    displayName: a.player.nickname ?? a.player.firstNameHe ?? a.player.firstNameEn ?? getPlayerDisplayName(a.player),
  }));
  const attendeesWithRank = confirmed.map((a) => ({
    id: a.playerId,
    displayName: a.player.nickname ?? a.player.firstNameHe ?? a.player.firstNameEn ?? getPlayerDisplayName(a.player),
    rank: a.player.computedRank ?? a.player.rank,
    positions: a.player.positions as string[],
  }));
  const waitlistRaw = session.attendances.slice(session.maxPlayers);
  const attendingIds = new Set(session.attendances.map((a) => a.playerId));

  // Sort waitlist: REGISTERED by precedence desc, DROP_IN by createdAt asc (already ordered)
  const currentYear = new Date().getFullYear();
  let waiting = waitlistRaw;
  if (waitlistRaw.length > 0) {
    const registeredWaiting = waitlistRaw.filter((a) => a.player.playerKind === "REGISTERED");
    const dropinWaiting = waitlistRaw.filter((a) => a.player.playerKind === "DROP_IN");

    if (registeredWaiting.length > 1 && yearWeights.length > 0) {
      const playerIds = registeredWaiting.map((a) => a.playerId);
      const [aggregates, adjustments, liveCounts] = await Promise.all([
        prisma.playerYearAggregate.findMany({ where: { playerId: { in: playerIds } } }),
        prisma.playerAdjustment.findMany({ where: { playerId: { in: playerIds } } }),
        prisma.attendance.groupBy({
          by: ["playerId"],
          where: { playerId: { in: playerIds }, gameSession: { date: { gte: new Date(currentYear, 0, 1) } } },
          _count: { id: true },
        }),
      ]);
      const liveMap = new Map(liveCounts.map((r) => [r.playerId, r._count.id]));
      const scored = computePrecedenceScores(
        registeredWaiting.map((a) => ({
          id: a.playerId,
          playerName: getPlayerDisplayName(a.player),
          aggregates: aggregates.filter((ag) => ag.playerId === a.playerId).map((ag) => ({ year: ag.year, count: ag.count })),
          liveCount: liveMap.get(a.playerId) ?? 0,
          adjustments: adjustments.filter((adj) => adj.playerId === a.playerId).map((adj) => ({ points: adj.points })),
        })),
        yearWeights,
        currentYear,
      );
      const scoreMap = new Map(scored.map((r) => [r.playerId, r.totalScore]));
      registeredWaiting.sort((a, b) => (scoreMap.get(b.playerId) ?? 0) - (scoreMap.get(a.playerId) ?? 0));
    }
    waiting = [...registeredWaiting, ...dropinWaiting];
  }

  const allPlayers = await prisma.player.findMany({
    orderBy: [{ firstNameHe: "asc" }, { firstNameEn: "asc" }],
    select: {
      id: true,
      firstNameHe: true, lastNameHe: true,
      firstNameEn: true, lastNameEn: true,
      nickname: true, phone: true,
    },
  });
  const availablePlayers = allPlayers
    .filter((p) => !attendingIds.has(p.id))
    .map((p) => ({ id: p.id, displayName: getPlayerDisplayName(p), phone: p.phone }));

  const sessionData = {
    id: session.id,
    date: session.date,
    maxPlayers: session.maxPlayers,
    isClosed: session.isClosed,
    durationMinutes: session.durationMinutes,
    locationName: session.locationName,
    locationLat: session.locationLat,
    locationLng: session.locationLng,
  };

  const minPlayers = parseInt(config[CONFIG.SESSION_MIN_PLAYERS] ?? "10", 10);
  const defaultRank = parseInt(config[CONFIG.DEFAULT_PLAYER_RANK] ?? "50", 10);
  const confirmedCount = confirmed.length;

  // Determine if we can charge this session
  let cannotChargeReason: string | undefined;
  if (!session.durationMinutes || session.durationMinutes <= 0) {
    cannotChargeReason = "לא הוגדר משך מפגש";
  } else if (!rateRaw) {
    cannotChargeReason = "לא נמצא תעריף שעתי";
  } else if (confirmedCount < minPlayers) {
    cannotChargeReason = `${confirmedCount} משתתפים (מינימום ${minPlayers})`;
  }
  const canCharge = !cannotChargeReason;

  const charges = chargesRaw.map((c) => ({
    id: c.id,
    playerId: c.playerId,
    playerName: getPlayerDisplayName(c.player),
    amount: c.amount,
    calculatedAmount: c.calculatedAmount,
    chargeType: c.chargeType,
    auditEntries: c.auditEntries.map((e) => ({
      changedAt: e.changedAt,
      changedBy: e.changedBy,
      previousAmount: e.previousAmount,
      newAmount: e.newAmount,
      reason: e.reason,
    })),
  }));

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/sessions"
            className="text-sm text-zinc-500 hover:text-zinc-700 active:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:active:text-white"
          >
            → חזרה
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <SessionArchiveButton id={id} isArchived={session.isArchived} />
          <SessionDeleteButton id={id} attendanceCount={session._count.attendances} />
        </div>
      </header>

      {/* Session form */}
      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <SessionForm mode="edit" session={sessionData} />
      </section>

      {/* Charging */}
      <section className="mx-auto mt-4 w-full max-w-2xl md:max-w-4xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          חיוב
        </h2>
        <SessionChargePanel
          sessionId={id}
          isCharged={session.isCharged}
          charges={charges}
          confirmedCount={confirmedCount}
          minPlayers={minPlayers}
          canCharge={canCharge}
          cannotChargeReason={cannotChargeReason}
        />
      </section>

      {/* Attendance */}
      <section className="mx-auto mt-4 w-full max-w-2xl md:max-w-4xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-zinc-600 dark:text-zinc-400" aria-hidden />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            משתתפים
          </h2>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            ({confirmed.length}/{session.maxPlayers})
          </span>
        </div>

        {confirmed.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">אין נרשמים עדיין.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
            {confirmed.map((row, index) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="w-5 tabular-nums text-zinc-400 dark:text-zinc-500">
                    {index + 1}.
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {getPlayerDisplayName(row.player)}
                  </span>
                  {row.player.playerKind === "DROP_IN" && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                      מזדמן
                    </span>
                  )}
                  <span className="tabular-nums text-zinc-400 dark:text-zinc-500">
                    {row.player.phone}
                  </span>
                </span>
                <SessionRemoveButton
                  sessionId={id}
                  attendanceId={row.id}
                  playerName={getPlayerDisplayName(row.player)}
                />
              </li>
            ))}
          </ol>
        )}

        {waiting.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              רשימת המתנה ({waiting.length})
            </h3>
            <ol className="flex flex-col divide-y divide-amber-100 dark:divide-amber-900/30">
              {waiting.map((row, index) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-5 tabular-nums text-zinc-400 dark:text-zinc-500">
                      {index + 1}.
                    </span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      {getPlayerDisplayName(row.player)}
                    </span>
                    {row.player.playerKind === "DROP_IN" && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                        מזדמן
                      </span>
                    )}
                    <span className="tabular-nums text-zinc-400 dark:text-zinc-500">
                      {row.player.phone}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <SessionPromoteButton
                      sessionId={id}
                      attendanceId={row.id}
                      playerName={getPlayerDisplayName(row.player)}
                    />
                    <SessionRemoveButton
                      sessionId={id}
                      attendanceId={row.id}
                      playerName={getPlayerDisplayName(row.player)}
                    />
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-5 space-y-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <SessionAddPlayerForm sessionId={id} players={availablePlayers} />
          <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <SessionQuickDropInForm sessionId={id} />
          </div>
        </div>
      </section>

      {/* Balanced teams */}
      <section className="mx-auto mt-4 w-full max-w-2xl md:max-w-4xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <TeamBalancePanel
          attendees={attendeesWithRank}
          defaultRank={defaultRank}
          sessionDate={session.date}
          sessionId={session.id}
        />
      </section>

      {/* Match results */}
      <section className="mx-auto mt-4 w-full max-w-2xl md:max-w-4xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <SessionMatchPanel
          sessionId={id}
          attendees={confirmedAttendees}
          matches={matchesRaw}
        />
      </section>
    </div>
  );
}
