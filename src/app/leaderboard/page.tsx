import type { Metadata } from "next";
import { PlayerNav } from "@/components/player-nav";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { prisma } from "@/lib/prisma";
import { computePrecedenceScores } from "@/lib/precedence";
import { getPlayerDisplayName } from "@/lib/player-display";
import { getPlayerSession } from "@/lib/player-session";

export const metadata: Metadata = { title: "לוח קדימות" };

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  const session = await getPlayerSession();

  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear + 1, 0, 1);

  const [players, yearWeights, liveAttendances] = await Promise.all([
    prisma.player.findMany({
      where: { isAdmin: false },
      include: {
        yearAggregates: true,
        adjustments: true,
      },
    }),
    prisma.yearWeight.findMany({ orderBy: { year: "asc" } }),
    prisma.attendance.findMany({
      where: { gameSession: { date: { gte: yearStart, lt: yearEnd } } },
      select: { playerId: true },
    }),
  ]);

  const liveCountMap = new Map<string, number>();
  for (const a of liveAttendances) {
    liveCountMap.set(a.playerId, (liveCountMap.get(a.playerId) ?? 0) + 1);
  }

  const rows = computePrecedenceScores(
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

  return (
    <>
      <PlayerNav />
      <div className="flex flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
        <header className="mx-auto w-full max-w-lg md:max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            לוח קדימות
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            דירוג שחקנים לפי ניקוד קדימות — {currentYear}
          </p>
        </header>

        <main className="mx-auto mt-8 w-full max-w-lg md:max-w-2xl">
          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            {rows.length === 0 ? (
              <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
                אין שחקנים רשומים עדיין.
              </p>
            ) : (
              <LeaderboardTable rows={rows} currentPlayerId={session?.playerId ?? null} />
            )}
          </section>
        </main>
      </div>
    </>
  );
}
