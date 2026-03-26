import type { Metadata } from "next";
import Link from "next/link";
import { Trophy, Settings2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { computePrecedenceScores } from "@/lib/precedence";
import { getPlayerDisplayName } from "@/lib/player-display";

export const metadata: Metadata = { title: "קדימות" };
export const dynamic = "force-dynamic";

export default async function AdminPrecedencePage() {
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear + 1, 0, 1);

  const [players, yearWeights, liveAttendances] = await Promise.all([
    prisma.player.findMany({
      orderBy: [{ firstNameHe: "asc" }, { firstNameEn: "asc" }, { nickname: "asc" }],
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
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            → חזרה
          </Link>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <h1 className="flex items-center gap-2 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            <Trophy className="h-5 w-5" aria-hidden />
            קדימות
          </h1>
        </div>
        <Link
          href="/admin/precedence/weights"
          className="flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Settings2 className="h-4 w-4" aria-hidden />
          משקלות
        </Link>
      </header>

      <section className="mx-auto mt-6 w-full max-w-2xl md:max-w-4xl">
        {yearWeights.length === 0 && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            לא הוגדרו משקלות לשנים. הניקוד יהיה אפס לכולם.{" "}
            <Link
              href="/admin/precedence/weights/new"
              className="underline hover:no-underline"
            >
              הוסף משקל
            </Link>
          </p>
        )}

        {rows.length === 0 ? (
          <p className="text-center text-zinc-500">אין שחקנים במערכת עדיין.</p>
        ) : (
          <ul className="flex flex-col divide-y rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            {rows.map((row, idx) => (
              <li
                key={row.playerId}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 w-6 shrink-0 text-center text-sm font-bold text-zinc-400 dark:text-zinc-500">
                    {idx + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <Link
                      href={`/admin/precedence/${row.playerId}`}
                      className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                    >
                      {row.playerName}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>
                        היסטורי:{" "}
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {row.historicalScore % 1 === 0
                            ? row.historicalScore
                            : row.historicalScore.toFixed(1)}
                        </span>
                      </span>
                      <span>
                        {currentYear}:{" "}
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {row.currentYearScore % 1 === 0
                            ? row.currentYearScore
                            : row.currentYearScore.toFixed(1)}
                        </span>
                      </span>
                      {row.adjustmentsTotal !== 0 && (
                        <span>
                          התאמות:{" "}
                          <span
                            className={
                              row.adjustmentsTotal > 0
                                ? "font-medium text-green-700 dark:text-green-400"
                                : "font-medium text-red-600 dark:text-red-400"
                            }
                          >
                            {row.adjustmentsTotal > 0 ? "+" : ""}
                            {row.adjustmentsTotal % 1 === 0
                              ? row.adjustmentsTotal
                              : row.adjustmentsTotal.toFixed(1)}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 pr-9 sm:pr-0">
                  <span className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                    {row.totalScore % 1 === 0
                      ? row.totalScore
                      : row.totalScore.toFixed(1)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
