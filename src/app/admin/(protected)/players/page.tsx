import type { Metadata } from "next";
import Link from "next/link";
import { Users, Plus, Settings2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computePrecedenceScores } from "@/lib/precedence";
import { getPlayerDisplayName } from "@/lib/player-display";
import { PlayerList } from "@/components/admin/player-list";

export const metadata: Metadata = { title: "שחקנים" };

export const dynamic = "force-dynamic";

export default async function AdminPlayersPage() {
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear + 1, 0, 1);

  const [players, yearWeights, liveAttendances, totalSessions] = await Promise.all([
    prisma.player.findMany({
      include: {
        _count: { select: { attendances: true } },
        yearAggregates: true,
        adjustments: true,
      },
    }),
    prisma.yearWeight.findMany({ orderBy: { year: "asc" } }),
    prisma.attendance.findMany({
      where: { gameSession: { date: { gte: yearStart, lt: yearEnd } } },
      select: { playerId: true },
    }),
    prisma.gameSession.count({
      where: { date: { gte: yearStart, lt: yearEnd } },
    }),
  ]);

  const liveCountMap = new Map<string, number>();
  for (const a of liveAttendances) {
    liveCountMap.set(a.playerId, (liveCountMap.get(a.playerId) ?? 0) + 1);
  }

  const precedenceRows = computePrecedenceScores(
    players.map((p) => ({
      id: p.id,
      playerName: getPlayerDisplayName(p),
      aggregates: p.yearAggregates,
      liveCount: liveCountMap.get(p.id) ?? 0,
      adjustments: p.adjustments,
    })),
    yearWeights,
    currentYear,
  );

  // Sort players by precedence score (precedenceRows is already sorted desc), admin pinned first
  const sortedByPrecedence = precedenceRows.map((row) =>
    players.find((p) => p.id === row.playerId)!,
  );
  const sortedPlayers = [
    ...sortedByPrecedence.filter((p) => p.isAdmin),
    ...sortedByPrecedence.filter((p) => !p.isAdmin),
  ];

  const liveCountByPlayerId = Object.fromEntries(liveCountMap);

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-sm text-zinc-500 hover:text-zinc-700 active:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:active:text-white"
          >
            → חזרה
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            <Users className="h-5 w-5" aria-hidden />
            שחקנים
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/precedence/weights"
            className="flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Settings2 className="h-4 w-4" aria-hidden />
            משקלות
          </Link>
          <Link
            href="/admin/players/new"
            aria-label="הוסף שחקן"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-800 active:bg-zinc-700 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
          >
            <Plus className="h-5 w-5" aria-hidden />
          </Link>
        </div>
      </header>

      {/* Player list */}
      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl">
        {sortedPlayers.length === 0 ? (
          <p className="text-center text-zinc-500 dark:text-zinc-400">
            אין שחקנים במערכת עדיין.
          </p>
        ) : (
          <PlayerList
            players={sortedPlayers}
            precedenceRows={precedenceRows}
            currentYear={currentYear}
            liveCountByPlayerId={liveCountByPlayerId}
            totalSessions={totalSessions}
          />
        )}
      </section>
    </div>
  );
}
