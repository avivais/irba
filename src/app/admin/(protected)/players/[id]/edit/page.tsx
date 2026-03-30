import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PlayerForm } from "@/components/admin/player-form";
import { getPlayerDisplayName } from "@/lib/player-display";
import { AggregateDeleteButton } from "@/components/admin/aggregate-delete-button";
import { AggregateUpsertForm } from "@/components/admin/aggregate-upsert-form";
import { AdjustmentDeleteButton } from "@/components/admin/adjustment-delete-button";
import { computePrecedenceScores } from "@/lib/precedence";

export const metadata: Metadata = { title: "עריכת שחקן" };

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(d);
}

function formatScore(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export default async function AdminPlayersEditPage({ params }: Props) {
  const { id } = await params;
  const currentYear = new Date().getFullYear();
  const yearStart = new Date(currentYear, 0, 1);
  const yearEnd = new Date(currentYear + 1, 0, 1);

  const [player, yearWeights, allLiveAttendances, allPlayers] = await Promise.all([
    prisma.player.findUnique({
      where: { id },
      include: {
        yearAggregates: { orderBy: { year: "desc" } },
        adjustments: { orderBy: { date: "desc" } },
      },
    }),
    prisma.yearWeight.findMany(),
    prisma.attendance.findMany({
      where: { gameSession: { date: { gte: yearStart, lt: yearEnd } } },
      select: { playerId: true },
    }),
    prisma.player.findMany({
      select: {
        id: true,
        nickname: true,
        firstNameHe: true,
        lastNameHe: true,
        firstNameEn: true,
        lastNameEn: true,
        phone: true,
        yearAggregates: true,
        adjustments: { select: { points: true } },
      },
    }),
  ]);

  if (!player) notFound();

  const liveCountMap = new Map<string, number>();
  for (const a of allLiveAttendances) {
    liveCountMap.set(a.playerId, (liveCountMap.get(a.playerId) ?? 0) + 1);
  }

  const liveCount = liveCountMap.get(id) ?? 0;

  const precedenceRows = computePrecedenceScores(
    allPlayers.map((p) => ({
      id: p.id,
      playerName: getPlayerDisplayName(p),
      aggregates: p.yearAggregates,
      liveCount: liveCountMap.get(p.id) ?? 0,
      adjustments: p.adjustments,
    })),
    yearWeights,
    currentYear,
  );

  const playerRank = precedenceRows.findIndex((r) => r.playerId === id) + 1;
  const playerPrecedence = precedenceRows.find((r) => r.playerId === id);

  return (
    <div className="flex min-h-full flex-1 flex-col px-4 pb-10 pt-6 sm:px-6">
      <header className="mx-auto flex w-full max-w-2xl md:max-w-4xl items-start gap-3">
        <Link
          href="/admin/players"
          className="mt-1 shrink-0 text-sm text-zinc-500 hover:text-zinc-700 active:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 dark:active:text-white"
        >
          → חזרה לשחקנים
        </Link>
        <span className="mt-1 text-zinc-300 dark:text-zinc-600">|</span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            {getPlayerDisplayName(player)}
          </h1>
          {playerPrecedence && (
            <p className="mt-0.5 text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
              <span dir="ltr">
                מקום {playerRank} · ניקוד {formatScore(playerPrecedence.totalScore)}
              </span>
            </p>
          )}
        </div>
      </header>

      <div className="mx-auto mt-6 flex w-full max-w-2xl md:max-w-4xl flex-col gap-6">
        {/* Player details form */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <PlayerForm
            mode="edit"
            player={{
              id: player.id,
              phone: player.phone,
              playerKind: player.playerKind,
              positions: player.positions,
              rank: player.rank,
              balance: player.balance,
              isAdmin: player.isAdmin,
              nickname: player.nickname,
              firstNameHe: player.firstNameHe,
              lastNameHe: player.lastNameHe,
              firstNameEn: player.firstNameEn,
              lastNameEn: player.lastNameEn,
              birthdate: player.birthdate,
            }}
          />
        </section>

        {/* Current year (read-only) */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            שנה נוכחית — {currentYear}
            <span className="mr-2 text-xs font-normal text-zinc-400 dark:text-zinc-500">
              (נספר אוטומטית)
            </span>
          </h2>
          <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {liveCount}
            <span className="mr-1 text-base font-normal text-zinc-500 dark:text-zinc-400">
              נוכחויות
            </span>
          </p>
        </section>

        {/* Historical aggregates */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            נוכחויות היסטוריות (שנים קודמות)
          </h2>

          {player.yearAggregates.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              אין נתונים היסטוריים עדיין.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {player.yearAggregates.map((agg) => (
                <li
                  key={agg.year}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-12 font-medium tabular-nums text-zinc-800 dark:text-zinc-200">
                      {agg.year}
                    </span>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {agg.count} נוכחויות
                    </span>
                  </div>
                  <AggregateDeleteButton playerId={id} year={agg.year} />
                </li>
              ))}
            </ul>
          )}

          <AggregateUpsertForm playerId={id} currentYear={currentYear} />
        </section>

        {/* Adjustments */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              בונוסים / קנסות
            </h2>
            <Link
              href={`/admin/precedence/${id}/adjustments/new`}
              className="flex min-h-8 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-4 focus:ring-zinc-600/40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              הוסף
            </Link>
          </div>

          {player.adjustments.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              אין בונוסים / קנסות עדיין.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
              {player.adjustments.map((adj) => (
                <li
                  key={adj.id}
                  className="flex flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span
                        dir="ltr"
                        className={`tabular-nums font-semibold ${
                          adj.points > 0
                            ? "text-green-700 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {adj.points > 0 ? "+" : ""}
                        {adj.points % 1 === 0 ? adj.points : adj.points.toFixed(1)}
                      </span>
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        {adj.description}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {formatDate(adj.date)}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/admin/precedence/${id}/adjustments/${adj.id}/edit`}
                      className="flex min-h-9 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                      עריכה
                    </Link>
                    <AdjustmentDeleteButton playerId={id} adjId={adj.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
